import os
import shutil
import stat
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "scripts" / "feature-contract.ps1"
UPDATE_INDEXES = ROOT / "scripts" / "update-doc-indexes.ps1"
READY_FOR_PR = ROOT / "scripts" / "ready-for-pr.ps1"
START_MARKER = "<!-- FEATURE_LINKS_START -->"
END_MARKER = "<!-- FEATURE_LINKS_END -->"


def index_template(label: str) -> str:
    return f"""---
hide:
  - navigation
  - toc
---

<section class="page-hero page-hero--{label.lower()}">
  <div class="page-hero__content">Hero {label}</div>
</section>

<section class="documentation-directory" markdown="1">
  <div class="documentation-directory__header">
    <h2>{label}</h2>
    <p>Texto externo</p>
  </div>

  <div class="documentation-directory__grid" markdown="1">

{START_MARKER}

{END_MARKER}

  </div>
</section>
"""


def managed_zone(content: str) -> str:
    assert content.count(START_MARKER) == 1
    assert content.count(END_MARKER) == 1
    start = content.index(START_MARKER) + len(START_MARKER)
    end = content.index(END_MARKER)
    assert start < end
    return content[start:end]


def powershell() -> str:
    candidates = ["powershell.exe", "pwsh"] if os.name == "nt" else ["pwsh", "powershell"]
    for candidate in candidates:
        path = shutil.which(candidate)
        if path:
            return path
    pytest.skip("PowerShell no esta disponible")


def run_ps(command: str, cwd: Path, env: dict[str, str] | None = None):
    return subprocess.run(
        [powershell(), "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def run_file(script: Path, args: list[str], cwd: Path, env: dict[str, str] | None = None):
    return subprocess.run(
        [powershell(), "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script), *args],
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def git(repo: Path, *args: str, check: bool = True):
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        text=True,
        capture_output=True,
        check=False,
        env=git_env(),
    )
    if check and result.returncode != 0:
        raise AssertionError(result.stderr + result.stdout)
    return result


def git_env(extra_path: Path | None = None) -> dict[str, str]:
    env = os.environ.copy()
    env["GIT_CONFIG_GLOBAL"] = "NUL" if os.name == "nt" else "/dev/null"
    env["GIT_TERMINAL_PROMPT"] = "0"
    if extra_path:
        env["PATH"] = str(extra_path) + os.pathsep + env["PATH"]
    return env


def make_contract_repo(tmp_path: Path, slug: str = "99-demo-feature", title: str = "Demo feature"):
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init")
    git(repo, "checkout", "-b", "feature/99-demo-feature")
    git(repo, "config", "user.email", "tests@example.invalid")
    git(repo, "config", "user.name", "Tests")

    doc_slug = slug.split("-", 1)[1]
    for path in [
        repo / "runs" / slug,
        repo / "docs" / "tecnica",
        repo / "docs" / "usuario",
    ]:
        path.mkdir(parents=True, exist_ok=True)

    (repo / "runs" / slug / "spec.md").write_text("# Spec\n", encoding="utf-8")
    (repo / "runs" / slug / "audit-1.md").write_text("status: approved\n", encoding="utf-8")
    (repo / "runs" / slug / "test-report-1.md").write_text("status: approved\n", encoding="utf-8")
    (repo / "docs" / "tecnica" / f"{doc_slug}.md").write_text("# Tecnica\n", encoding="utf-8")
    (repo / "docs" / "usuario" / f"{doc_slug}.md").write_text("# Usuario\n", encoding="utf-8")
    (repo / "docs" / "tecnica" / "index.md").write_text(
        index_template("Tecnica"), encoding="utf-8"
    )
    (repo / "docs" / "usuario" / "index.md").write_text(
        index_template("Usuario"), encoding="utf-8"
    )
    (repo / "ROADMAP.md").write_text(f"- [ ] {slug} - Demo\n", encoding="utf-8")
    return repo, slug, title


def test_scaffolding_decision_docs_and_index_links_are_idempotent(tmp_path: Path):
    repo, slug, title = make_contract_repo(tmp_path)

    untouched_parts = {}
    for index in [repo / "docs" / "tecnica" / "index.md", repo / "docs" / "usuario" / "index.md"]:
        content = index.read_text(encoding="utf-8")
        untouched_parts[index] = (
            content[: content.index(START_MARKER) + len(START_MARKER)],
            content[content.index(END_MARKER) :],
        )

    create_decision = (
        f". '{CONTRACT}'; "
        "New-DecisionFile -Slug '99-demo-feature' -Title 'Demo feature' "
        "-Decisions @('Decision demostrable uno', 'Decision demostrable dos')"
    )
    result = run_ps(create_decision, repo)
    assert result.returncode == 0, result.stderr

    first = run_file(UPDATE_INDEXES, [slug, title], repo)
    second = run_file(UPDATE_INDEXES, [slug, title], repo)

    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    decision = (repo / "runs" / slug / "decision.md").read_text(encoding="utf-8")
    assert "- Decision demostrable uno" in decision
    assert "System.Object[]" not in decision
    for index in [repo / "docs" / "tecnica" / "index.md", repo / "docs" / "usuario" / "index.md"]:
        content = index.read_text(encoding="utf-8")
        assert content.count("- [Demo feature](demo-feature.md)") == 1
        assert "Texto externo" in content
        assert managed_zone(content).count("- [Demo feature](demo-feature.md)") == 1
        assert content.startswith(untouched_parts[index][0])
        assert content.endswith(untouched_parts[index][1])


def test_index_update_fails_for_missing_destination_and_ambiguous_links(tmp_path: Path):
    repo, slug, title = make_contract_repo(tmp_path)
    missing = repo / "docs" / "tecnica" / "demo-feature.md"
    missing.unlink()

    result = run_file(UPDATE_INDEXES, [slug, title], repo)

    assert result.returncode != 0
    assert "No existe el destino" in result.stderr

    missing.write_text("# Tecnica\n", encoding="utf-8")
    index = repo / "docs" / "tecnica" / "index.md"
    content = index_template("Tecnica").replace(
        END_MARKER,
        "- [Uno](demo-feature.md)\n- [Dos](demo-feature.md)\n\n" + END_MARKER,
    )
    index.write_text(content, encoding="utf-8")

    result = run_file(UPDATE_INDEXES, [slug, title], repo)

    assert result.returncode != 0
    assert "ambigua" in result.stderr.lower()


@pytest.mark.parametrize(
    "broken_content",
    [
        index_template("Tecnica").replace(START_MARKER, ""),
        index_template("Tecnica").replace(END_MARKER, ""),
        index_template("Tecnica").replace(START_MARKER, START_MARKER + "\n" + START_MARKER),
        index_template("Tecnica").replace(END_MARKER, END_MARKER + "\n" + END_MARKER),
        index_template("Tecnica").replace(
            START_MARKER + "\n\n" + END_MARKER,
            END_MARKER + "\n\n" + START_MARKER,
        ),
    ],
)
def test_index_update_rejects_invalid_markers_without_modifying_file(
    tmp_path: Path, broken_content: str
):
    repo, slug, title = make_contract_repo(tmp_path)
    index = repo / "docs" / "tecnica" / "index.md"
    index.write_text(broken_content, encoding="utf-8")
    before = index.read_bytes()

    result = run_file(UPDATE_INDEXES, [slug, title], repo)

    assert result.returncode != 0
    assert "FEATURE_LINKS" in result.stderr
    assert index.read_bytes() == before


def test_index_update_rejects_existing_link_outside_managed_zone(tmp_path: Path):
    repo, slug, title = make_contract_repo(tmp_path)
    index = repo / "docs" / "tecnica" / "index.md"
    content = index.read_text(encoding="utf-8")
    index.write_text(content + "\n- [Demo feature](demo-feature.md)\n", encoding="utf-8")
    before = index.read_bytes()

    result = run_file(UPDATE_INDEXES, [slug, title], repo)

    assert result.returncode != 0
    assert "fuera de la zona" in result.stderr
    assert "FEATURE_LINKS" in result.stderr
    assert index.read_bytes() == before


def test_preflight_prevents_partial_update_when_second_index_is_invalid(tmp_path: Path):
    repo, slug, title = make_contract_repo(tmp_path)
    technical_index = repo / "docs" / "tecnica" / "index.md"
    user_index = repo / "docs" / "usuario" / "index.md"
    user_index.write_text(
        user_index.read_text(encoding="utf-8").replace(END_MARKER, ""),
        encoding="utf-8",
    )
    technical_before = technical_index.read_bytes()
    user_before = user_index.read_bytes()

    result = run_file(UPDATE_INDEXES, [slug, title], repo)

    assert result.returncode != 0
    assert "FEATURE_LINKS_END" in result.stderr
    assert technical_index.read_bytes() == technical_before
    assert user_index.read_bytes() == user_before


def test_contract_rejects_link_outside_managed_zone(tmp_path: Path):
    repo, slug, title = make_contract_repo(tmp_path)
    run_ps(
        f". '{CONTRACT}'; "
        "New-DecisionFile -Slug '99-demo-feature' -Title 'Demo feature' "
        "-Decisions @('Decision demostrable')",
        repo,
    )
    for index in [repo / "docs" / "tecnica" / "index.md", repo / "docs" / "usuario" / "index.md"]:
        content = index.read_text(encoding="utf-8")
        index.write_text(content + "\n- [Demo feature](demo-feature.md)\n", encoding="utf-8")

    command = (
        f". '{CONTRACT}'; "
        f"Assert-FeatureContract -Slug '{slug}' -Title '{title}'"
    )
    result = run_ps(command, repo)

    assert result.returncode != 0
    assert "zona FEATURE_LINKS" in result.stderr


def test_ready_gate_fails_when_decision_or_index_link_is_missing(tmp_path: Path):
    repo, slug, title = make_contract_repo(tmp_path)
    command = (
        f". '{CONTRACT}'; "
        f"Assert-FeatureContract -Slug '{slug}' -Title '{title}'"
    )

    result = run_ps(command, repo)

    assert result.returncode != 0
    assert "decision.md" in result.stderr


def make_fake_tools(bin_dir: Path, mode: str):
    bin_dir.mkdir()
    if os.name == "nt":
        gh = bin_dir / "gh.cmd"
        if mode == "missing_then_create":
            # Simula el 'gh' real: 'pr view' falla (no existe todavia) y
            # 'pr create' (sin --json, que no todas las versiones de gh
            # soportan) imprime unicamente la URL de la PR en stdout.
            gh.write_text(
                "@echo off\n"
                "echo %* | findstr /C:\"pr view\" >nul && (echo no pull requests found 1>&2 & exit /b 1)\n"
                "echo https://example.test/pull/123\n",
                encoding="utf-8",
            )
        elif mode == "existing":
            gh.write_text(
                "@echo off\n"
                "echo {\"number\":45,\"url\":\"https://example.test/pull/45\",\"baseRefName\":\"develop\",\"state\":\"OPEN\"}\n",
                encoding="utf-8",
            )
        elif mode == "merged_then_create":
            # 'pr view' devuelve la PR ya mergeada de la misma rama; la PR
            # nueva debe crearse igual para los commits posteriores al merge.
            gh.write_text(
                "@echo off\n"
                "echo %* | findstr /C:\"pr view\" >nul && ("
                "echo {\"number\":18,\"url\":\"https://example.test/pull/18\",\"baseRefName\":\"develop\",\"state\":\"MERGED\"}"
                " & exit /b 0)\n"
                "echo https://example.test/pull/123\n",
                encoding="utf-8",
            )
        else:
            gh.write_text("@echo off\necho auth failed 1>&2\nexit /b 2\n", encoding="utf-8")
        pwsh = bin_dir / "pwsh.cmd"
        pwsh.write_text("@echo off\nexit /b 0\n", encoding="utf-8")
    else:
        gh = bin_dir / "gh"
        if mode == "missing_then_create":
            # Simula el 'gh' real: 'pr view' falla (no existe todavia) y
            # 'pr create' (sin --json, que no todas las versiones de gh
            # soportan) imprime unicamente la URL de la PR en stdout.
            gh.write_text(
                "#!/bin/sh\n"
                "case \"$*\" in *'pr view'*) echo 'no pull requests found' >&2; exit 1;; esac\n"
                "echo 'https://example.test/pull/123'\n",
                encoding="utf-8",
            )
        elif mode == "existing":
            gh.write_text(
                "#!/bin/sh\n"
                "echo '{\"number\":45,\"url\":\"https://example.test/pull/45\",\"baseRefName\":\"develop\",\"state\":\"OPEN\"}'\n",
                encoding="utf-8",
            )
        elif mode == "merged_then_create":
            # 'pr view' devuelve la PR ya mergeada de la misma rama; la PR
            # nueva debe crearse igual para los commits posteriores al merge.
            gh.write_text(
                "#!/bin/sh\n"
                "case \"$*\" in *'pr view'*)"
                " echo '{\"number\":18,\"url\":\"https://example.test/pull/18\","
                "\"baseRefName\":\"develop\",\"state\":\"MERGED\"}'; exit 0;; esac\n"
                "echo 'https://example.test/pull/123'\n",
                encoding="utf-8",
            )
        else:
            gh.write_text("#!/bin/sh\necho 'auth failed' >&2\nexit 2\n", encoding="utf-8")
        gh.chmod(gh.stat().st_mode | stat.S_IXUSR)
        pwsh = bin_dir / "pwsh"
        pwsh.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        pwsh.chmod(pwsh.stat().st_mode | stat.S_IXUSR)


def prepare_ready_repo(tmp_path: Path, mode: str):
    repo, slug, title = make_contract_repo(tmp_path, "99-demo-feature", "Demo feature")
    remote = tmp_path / "origin.git"
    subprocess.run(["git", "init", "--bare", str(remote)], cwd=tmp_path, check=True)
    git(repo, "remote", "add", "origin", str(remote))
    run_ps(
        f". '{CONTRACT}'; "
        "New-DecisionFile -Slug '99-demo-feature' -Title 'Demo feature' "
        "-Decisions @('Decision demostrable')",
        repo,
    )
    run_file(UPDATE_INDEXES, [slug, title], repo)
    git(repo, "add", ".")
    git(repo, "commit", "-m", "feature ready")
    git(repo, "push", "-u", "origin", "feature/99-demo-feature")
    bin_dir = tmp_path / "bin"
    make_fake_tools(bin_dir, mode)
    return repo, slug, title, git_env(bin_dir)


def test_ready_for_pr_creates_pr_after_expected_missing_pr(tmp_path: Path):
    repo, slug, title, env = prepare_ready_repo(tmp_path, "missing_then_create")

    result = run_file(READY_FOR_PR, [slug, title], repo, env)

    assert result.returncode == 0, result.stderr
    assert "PR creada: #123" in result.stdout
    assert "- [-] 99-demo-feature" in (repo / "ROADMAP.md").read_text(encoding="utf-8")


def test_ready_for_pr_reuses_existing_pr_without_duplicate(tmp_path: Path):
    repo, slug, title, env = prepare_ready_repo(tmp_path, "existing")

    result = run_file(READY_FOR_PR, [slug, title], repo, env)

    assert result.returncode == 0, result.stderr
    assert "PR existente: #45" in result.stdout


def test_ready_for_pr_creates_new_pr_when_previous_pr_is_merged(tmp_path: Path):
    repo, slug, title, env = prepare_ready_repo(tmp_path, "merged_then_create")

    result = run_file(READY_FOR_PR, [slug, title], repo, env)

    assert result.returncode == 0, result.stderr
    assert "estado 'MERGED'" in result.stdout
    assert "PR creada: #123" in result.stdout


def test_ready_for_pr_blocks_real_gh_error(tmp_path: Path):
    repo, slug, title, env = prepare_ready_repo(tmp_path, "real_error")

    result = run_file(READY_FOR_PR, [slug, title], repo, env)

    assert result.returncode != 0
    assert "auth failed" in result.stderr


def test_workflow_yaml_is_valid():
    workflow = ROOT / ".github" / "workflows" / "post-merge-close-feature.yml"
    content = workflow.read_text(encoding="utf-8")
    assert "pull_request_target:" in content
    assert "contents: write" in content
    assert "pull-requests: read" in content
    assert "group: close-feature-develop" in content
    assert "-SkipLocalCleanup" in content
