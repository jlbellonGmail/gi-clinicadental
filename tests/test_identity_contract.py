import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "identity-contract.ps1"


def powershell():
    for name in ("powershell.exe", "pwsh"):
        found = shutil.which(name)
        if found:
            return found
    pytest.skip("PowerShell no esta disponible")


def fixture(tmp_path: Path, identity="18-demo", branch=None, run_path=None, roadmap_id=None):
    branch = branch or f"feature/{identity}"
    run_path = run_path or f"runs/{identity}"
    roadmap_id = roadmap_id or identity
    run_dir = tmp_path / run_path
    run_dir.mkdir(parents=True, exist_ok=True)
    (tmp_path / "ROADMAP.md").write_text(f"- [-] {roadmap_id} - Demo\n", encoding="utf-8")
    (run_dir / "work-unit.json").write_text(json.dumps({
        "unitId": identity,
        "canonicalSlug": identity,
        "branch": branch,
        "runPath": run_path,
    }), encoding="utf-8")
    return branch, run_path


def invoke(tmp_path: Path, slug: str, branch: str, run_path: str):
    command = (
        f". '{SCRIPT}'; Assert-WorkUnitIdentity -Slug '{slug}' -Branch '{branch}' "
        f"-RunPath '{run_path}' -RoadmapState ready -RepositoryRoot '{tmp_path}'; 'PASS'"
    )
    return subprocess.run([powershell(), "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                          text=True, capture_output=True, check=False)


def test_valid_identity_passes(tmp_path):
    branch, run_path = fixture(tmp_path)
    result = invoke(tmp_path, "18-demo", branch, run_path)
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize("branch,roadmap_id", [("feature/18-other", "18-demo"), ("feature/18-demo", "demo")])
def test_branch_or_roadmap_divergence_fails(tmp_path, branch, roadmap_id):
    actual_branch, run_path = fixture(tmp_path, branch=branch, roadmap_id=roadmap_id)
    result = invoke(tmp_path, "18-demo", actual_branch, run_path)
    assert result.returncode != 0


def test_manifest_contradiction_fails(tmp_path):
    branch, run_path = fixture(tmp_path)
    manifest = tmp_path / run_path / "work-unit.json"
    data = json.loads(manifest.read_text(encoding="utf-8"))
    data["canonicalSlug"] = "18-other"
    manifest.write_text(json.dumps(data), encoding="utf-8")
    result = invoke(tmp_path, "18-demo", branch, run_path)
    assert result.returncode != 0


def test_run_path_outside_runs_fails(tmp_path):
    branch, _ = fixture(tmp_path, run_path="runs/18-demo")
    result = invoke(tmp_path, "18-demo", branch, "../outside")
    assert result.returncode != 0


def test_run_path_basename_must_be_exact_identity(tmp_path):
    branch, run_path = fixture(tmp_path, run_path="runs/18-demo")
    manifest = tmp_path / run_path / "work-unit.json"
    data = json.loads(manifest.read_text(encoding="utf-8"))
    data["runPath"] = "runs/other"
    (tmp_path / "runs" / "other").mkdir()
    (tmp_path / "runs" / "other" / "work-unit.json").write_text(json.dumps(data), encoding="utf-8")
    result = invoke(tmp_path, "18-demo", branch, "runs/other")
    assert result.returncode != 0


def test_legacy_run_path_basename_must_be_exact_identity(tmp_path):
    branch, _ = fixture(tmp_path)
    (tmp_path / "runs" / "18-demo" / "work-unit.json").unlink()
    result = invoke(tmp_path, "18-demo", branch, "runs/other")
    assert result.returncode != 0


def test_legacy_declared_path_cannot_hide_another_manifest(tmp_path):
    branch, run_path = fixture(tmp_path, run_path="runs/a/18-demo")
    result = invoke(tmp_path, "18-demo", branch, "runs/b/18-demo")
    assert result.returncode != 0


def test_explicit_declared_path_cannot_hide_another_manifest(tmp_path):
    branch, run_path = fixture(tmp_path, run_path="runs/a/18-demo")
    result = invoke(tmp_path, "18-demo", branch, "runs/b/18-demo")
    assert result.returncode != 0


def test_explicit_declared_path_cannot_hide_manifest_in_different_directory(tmp_path):
    branch, _ = fixture(tmp_path, run_path="runs/other")
    result = invoke(tmp_path, "18-demo", branch, "runs/18-demo")
    assert result.returncode != 0


def test_ready_gate_validates_before_roadmap_write():
    content = (ROOT / "scripts" / "ready-for-pr.ps1").read_text(encoding="utf-8")
    assert content.index("Assert-WorkUnitIdentity") < content.index("$roadmapPath = \"ROADMAP.md\"")


def test_closed_lifecycle_requires_minimum_fields(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", str(repo)], check=True, capture_output=True, text=True)
    (repo / "ROADMAP.md").write_text("- [x] 18-demo - Demo\n", encoding="utf-8")
    run_dir = repo / "runs" / "18-demo"
    run_dir.mkdir(parents=True)
    (run_dir / "work-unit.json").write_text(json.dumps({
        "unitId": "18-demo", "canonicalSlug": "18-demo",
        "branch": "feature/18-demo", "runPath": "runs/18-demo"
    }), encoding="utf-8")
    (run_dir / "lifecycle.json").write_text(json.dumps({
        "schemaVersion": 1, "lifecycle": "CLOSED", "unitId": "18-demo",
        "branch": "feature/18-demo"
    }), encoding="utf-8")
    result = subprocess.run([powershell(), "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                             str(ROOT / "scripts" / "validate-unit-identities.ps1"), "-RepositoryRoot", str(repo)],
                            text=True, capture_output=True, check=False)
    assert result.returncode != 0


def test_ambiguous_manifests_fail(tmp_path):
    fixture(tmp_path, run_path="runs/a/18-demo")
    (tmp_path / "runs" / "b" / "18-demo").mkdir(parents=True)
    (tmp_path / "runs" / "b" / "18-demo" / "work-unit.json").write_text(
        (tmp_path / "runs" / "a" / "18-demo" / "work-unit.json").read_text(encoding="utf-8"), encoding="utf-8"
    )
    result = invoke(tmp_path, "18-demo", "feature/18-demo", "")
    assert result.returncode != 0
