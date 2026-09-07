import os
import shutil
import subprocess
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
START_SCRIPT = ROOT / "scripts" / "start-local-reconciler.ps1"
SLUG = "99-demo"
BRANCH = f"feature/{SLUG}"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

pytestmark = pytest.mark.skipif(
    os.name != "nt" or shutil.which("powershell.exe") is None,
    reason="Requiere Windows con PowerShell 5.1",
)


def powershell() -> str:
    path = shutil.which("powershell.exe")
    if not path:
        pytest.skip("PowerShell no esta disponible")
    return path


def command_env() -> dict[str, str]:
    env = os.environ.copy()
    env["GIT_CONFIG_GLOBAL"] = "NUL"
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["NO_COLOR"] = "1"
    env["TERM"] = "dumb"
    return env


def run(command: list[str], cwd: Path, check: bool = True):
    result = subprocess.run(
        command,
        cwd=cwd,
        env=command_env(),
        text=True,
        capture_output=True,
        check=False,
        creationflags=CREATE_NO_WINDOW,
    )
    if check and result.returncode != 0:
        raise AssertionError(f"Command failed: {command}\n{result.stdout}\n{result.stderr}")
    return result


def git(repo: Path, *args: str, check: bool = True):
    return run(["git", *args], repo, check=check)


def write_roadmap(repo: Path, entries: dict[str, str]) -> None:
    lines = ["# Roadmap", "", "## Features", ""]
    for slug, marker in entries.items():
        lines.append(f"- [{marker}] {slug} — Feature {slug}")
    (repo / "ROADMAP.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def make_repo(tmp_path: Path) -> tuple[Path, Path]:
    seed = tmp_path / "seed"
    origin = tmp_path / "origin.git"
    main = tmp_path / "main"
    run(["git", "init", "-b", "develop", str(seed)], tmp_path)
    git(seed, "config", "user.email", "test@example.com")
    git(seed, "config", "user.name", "Test")
    write_roadmap(seed, {SLUG: " "})
    git(seed, "add", "ROADMAP.md")
    git(seed, "commit", "-m", "init")
    run(["git", "clone", "--bare", str(seed), str(origin)], tmp_path)
    run(["git", "clone", str(origin), str(main)], tmp_path)
    git(main, "config", "user.email", "test@example.com")
    git(main, "config", "user.name", "Test")
    return origin, main


def push_remote_roadmap(main: Path, entries: dict[str, str]) -> None:
    write_roadmap(main, entries)
    git(main, "add", "ROADMAP.md")
    git(main, "commit", "-m", "roadmap")
    git(main, "push", "origin", "develop")


def start_reconciler(
    cwd: Path,
    slug: str,
    worktree_dir: Path | None = None,
    poll_seconds: int = 1,
    max_minutes: int = 2,
) -> subprocess.CompletedProcess[str]:
    command = [
        powershell(),
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(START_SCRIPT),
        "-Slug",
        slug,
        "-PollSeconds",
        str(poll_seconds),
        "-MaxMinutes",
        str(max_minutes),
    ]
    if worktree_dir is not None:
        command.extend(["-WorktreeDir", str(worktree_dir)])
    return run(command, cwd)


def state_dir(main: Path) -> Path:
    return main / ".git" / "feature-reconcilers"


def lock_path(main: Path, slug: str) -> Path:
    return state_dir(main) / f"{slug}.pid"


def process_alive(pid: int) -> bool:
    query = f"if (Get-Process -Id {pid} -ErrorAction SilentlyContinue) {{ 'yes' }} else {{ 'no' }}"
    result = run([powershell(), "-NoProfile", "-Command", query], Path(os.getcwd()))
    return result.stdout.strip() == "yes"


def kill_pid(pid: int) -> None:
    run(["taskkill", "/PID", str(pid), "/T", "/F"], Path(os.getcwd()), check=False)


# Estas esperas son de reloj sobre un proceso PowerShell externo, asi que
# dependen de lo cargada que este la maquina. Con los valores originales
# -60s y 90s, sondeando cada segundo- la suite fallaba de forma no
# determinista al correr en paralelo con otras cosas: un test distinto en
# cada corrida, y verde en aislamiento y en CI.
#
# Se corrige en tres frentes, ninguno de los cuales afloja lo que el test
# comprueba:
#
# 1. Sondeo mucho mas fino. Con `sleep(1)` se perdia hasta un segundo por
#    comprobacion, y `process_alive()` lanza un PowerShell propio que en
#    una maquina cargada tarda cientos de milisegundos: el "timeout" se
#    consumia en gran parte midiendo, no esperando.
# 2. Margen mas amplio, y configurable por entorno. No es aflojar el
#    criterio: el test sigue exigiendo exactamente el mismo resultado, solo
#    deja de exigir que la maquina este ociosa.
# 3. Diagnostico al fallar. Antes el mensaje era mudo -"no termino en
#    90s"- y no habia forma de saber si el reconciliador habia arrancado,
#    fallado o simplemente ido lento. Ahora se adjunta la cola de sus dos
#    logs.
POLL_INTERVAL_SECONDS = 0.2

# Multiplicador global, para poder darle mas aire en una maquina cargada
# sin editar el test: `RECONCILER_TIMEOUT_FACTOR=3 pytest ...`
TIMEOUT_FACTOR = float(os.environ.get("RECONCILER_TIMEOUT_FACTOR", "1") or "1")

ARRANQUE_TIMEOUT_SECONDS = 120.0 * TIMEOUT_FACTOR
FIN_TIMEOUT_SECONDS = 180.0 * TIMEOUT_FACTOR


def log_paths(main: Path, slug: str) -> list[Path]:
    return [state_dir(main) / f"{slug}.log", state_dir(main) / f"{slug}.err.log"]


def diagnostico(main: Path, slug: str) -> str:
    """Cola de los logs del reconciliador, para que el fallo se pueda leer.

    Un timeout sin contexto no dice si el proceso arranco, si murio o si
    solo fue lento, y esa diferencia es justamente la que importa.
    """
    partes = []
    lock = lock_path(main, slug)
    partes.append(f"lock={'existe' if lock.exists() else 'ausente'}")
    for ruta in log_paths(main, slug):
        if not ruta.exists():
            partes.append("\n--- " + ruta.name + ": no existe ---")
            continue
        texto = ruta.read_text(encoding="utf-8", errors="replace").strip()
        cola = "\n".join(texto.splitlines()[-20:]) or "(vacio)"
        partes.append("\n--- " + ruta.name + " ---\n" + cola)
    return "".join(partes)


def wait_until(predicate, timeout_seconds: float, message):
    """`message` puede ser un callable, para calcular el diagnostico recien
    cuando hace falta y no en cada corrida exitosa."""
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(POLL_INTERVAL_SECONDS)
    raise AssertionError(message() if callable(message) else message)


def wait_for_reconciler_running(
    main: Path, slug: str, timeout_seconds: float = ARRANQUE_TIMEOUT_SECONDS
) -> int:
    lock = lock_path(main, slug)

    def started() -> bool:
        if not lock.exists():
            return False
        raw = lock.read_text(encoding="ascii", errors="replace").strip()
        return raw.isdigit() and process_alive(int(raw))

    wait_until(
        started,
        timeout_seconds,
        lambda: (
            f"El reconciliador de {slug} no arranco en {timeout_seconds}s.\n"
            + diagnostico(main, slug)
        ),
    )
    return int(lock.read_text(encoding="ascii", errors="replace").strip())


def wait_for_reconciler_finished(
    main: Path, slug: str, timeout_seconds: float = FIN_TIMEOUT_SECONDS
) -> None:
    lock = lock_path(main, slug)
    wait_until(
        lambda: not lock.exists(),
        timeout_seconds,
        lambda: (
            f"El reconciliador de {slug} no termino en {timeout_seconds}s.\n"
            + diagnostico(main, slug)
        ),
    )


def find_lock_pids(tmp_path: Path) -> list[int]:
    pids: list[int] = []
    for lock in tmp_path.glob("*/main/.git/feature-reconcilers/*.pid"):
        raw = lock.read_text(encoding="ascii", errors="replace").strip()
        if raw.isdigit():
            pids.append(int(raw))
    return pids


@pytest.fixture
def cleanup_reconcilers(tmp_path):
    """Deja la máquina como la encontró antes de pasar al siguiente test.

    Varios de estos tests dejan el reconciliador **corriendo** a propósito:
    solo verifican que arrancó. Antes el teardown lo mataba y seguía sin
    comprobar nada, así que un proceso que tardaba en morir —o sus hijos:
    `cmd.exe` lanza un `powershell.exe` que hace `git fetch` en bucle—
    sobrevivía al test y se acumulaba con los de los siguientes.

    Eso explicaba la rareza que se veía: cada test pasaba en segundos por
    separado, y el módulo completo fallaba de forma no determinista, en un
    test distinto cada vez. No era la máquina cargada por casualidad: la
    cargaba la propia suite.

    Ahora el teardown **espera a que los procesos estén realmente
    muertos**, con un margen acotado.
    """
    try:
        yield
    finally:
        pids = find_lock_pids(tmp_path)
        for pid in pids:
            kill_pid(pid)
        for pid in pids:
            wait_until(
                lambda pid=pid: not process_alive(pid),
                30.0,
                "El reconciliador " + str(pid) + " sigue vivo tras taskkill /T /F; "
                "dejarlo correr contamina los tests siguientes.",
            )


def make_worktree(main: Path, tmp_path: Path, name: str, slug: str) -> Path:
    worktree = tmp_path / name
    git(main, "worktree", "add", str(worktree), "-b", f"feature/{slug}")
    return worktree


def branch_exists(main: Path, branch: str) -> bool:
    return git(main, "branch", "--list", branch).stdout.strip() != ""


def test_start_reconciler_in_main_checkout(tmp_path, cleanup_reconcilers):
    _, main = make_repo(tmp_path)
    result = start_reconciler(main, SLUG, worktree_dir=tmp_path / "no-matter")
    assert result.returncode == 0, result.stdout + result.stderr
    wait_for_reconciler_running(main, SLUG)
    wait_until(
        lambda: (state_dir(main) / f"{SLUG}.log").exists()
        and (state_dir(main) / f"{SLUG}.err.log").exists(),
        30,
        "El reconciliador no escribio sus logs.",
    )


def test_start_reconciler_from_linked_worktree(tmp_path, cleanup_reconcilers):
    _, main = make_repo(tmp_path)
    worktree = make_worktree(main, tmp_path, "wt-demo", SLUG)
    assert (worktree / ".git").is_file()
    result = start_reconciler(worktree, SLUG)
    assert result.returncode == 0, result.stdout + result.stderr
    wait_for_reconciler_running(main, SLUG)
    assert (state_dir(main) / f"{SLUG}.log").exists()
    assert not (worktree / ".git" / "feature-reconcilers").exists()


def test_start_reconciler_does_not_duplicate_while_running(tmp_path, cleanup_reconcilers):
    _, main = make_repo(tmp_path)
    sleeper = subprocess.Popen(
        [powershell(), "-NoProfile", "-Command", "Start-Sleep -Seconds 120"],
        env=command_env(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=CREATE_NO_WINDOW,
    )
    try:
        lock = lock_path(main, SLUG)
        lock.parent.mkdir(parents=True, exist_ok=True)
        lock.write_text(str(sleeper.pid), encoding="ascii")
        result = start_reconciler(main, SLUG)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "Ya existe un reconciliador local" in result.stdout
        assert lock.read_text(encoding="ascii").strip() == str(sleeper.pid)
    finally:
        sleeper.terminate()
        sleeper.wait(timeout=30)


def test_start_reconciler_replaces_stale_lock(tmp_path, cleanup_reconcilers):
    _, main = make_repo(tmp_path)
    lock = lock_path(main, SLUG)
    lock.parent.mkdir(parents=True, exist_ok=True)
    lock.write_text("400000001", encoding="ascii")
    result = start_reconciler(main, SLUG, worktree_dir=tmp_path / "no-matter")
    assert result.returncode == 0, result.stdout + result.stderr
    pid = wait_for_reconciler_running(main, SLUG)
    assert int(lock.read_text(encoding="ascii").strip()) == pid


def test_reconciler_cleans_worktree_and_branch_when_remote_closed(tmp_path, cleanup_reconcilers):
    _, main = make_repo(tmp_path)
    worktree = make_worktree(main, tmp_path, "wt-demo", SLUG)
    push_remote_roadmap(main, {SLUG: "x"})
    result = start_reconciler(worktree, SLUG)
    assert result.returncode == 0, result.stdout + result.stderr
    wait_for_reconciler_finished(main, SLUG)
    assert not worktree.exists()
    assert not branch_exists(main, BRANCH)
    log = (state_dir(main) / f"{SLUG}.log").read_text(encoding="utf-8", errors="replace")
    assert "Reconciliacion local completa" in log
    assert main.exists()
    assert (main / "ROADMAP.md").exists()


def test_reconciler_cleans_only_target_worktree_and_branch(tmp_path, cleanup_reconcilers):
    _, main = make_repo(tmp_path)
    alpha = make_worktree(main, tmp_path, "wt-alpha", "98-alpha")
    beta = make_worktree(main, tmp_path, "wt-beta", "97-beta")
    push_remote_roadmap(main, {"98-alpha": "x", "97-beta": " "})
    result = start_reconciler(alpha, "98-alpha")
    assert result.returncode == 0, result.stdout + result.stderr
    wait_for_reconciler_finished(main, "98-alpha")
    assert not alpha.exists()
    assert not branch_exists(main, "feature/98-alpha")
    assert beta.exists()
    assert branch_exists(main, "feature/97-beta")


def test_reconciler_never_removes_dirty_worktree(tmp_path, cleanup_reconcilers):
    _, main = make_repo(tmp_path)
    worktree = make_worktree(main, tmp_path, "wt-demo", SLUG)
    (worktree / "draft.txt").write_text("trabajo no confirmado", encoding="utf-8")
    push_remote_roadmap(main, {SLUG: "x"})
    result = start_reconciler(worktree, SLUG)
    assert result.returncode == 0, result.stdout + result.stderr
    wait_for_reconciler_finished(main, SLUG)
    assert worktree.exists()
    assert (worktree / "draft.txt").read_text(encoding="utf-8") == "trabajo no confirmado"
    assert branch_exists(main, BRANCH)
    error_log = (state_dir(main) / f"{SLUG}.err.log").read_text(encoding="utf-8", errors="replace")
    assert error_log.strip() != ""
