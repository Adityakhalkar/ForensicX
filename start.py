#!/usr/bin/env python3
"""Cross-platform start script for ForensicX. Works on macOS, Linux, and Windows."""

import os
import platform
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
VENV_DIR = BACKEND_DIR / "venv"
WEIGHTS_DIR = BACKEND_DIR / "weights"

IS_WINDOWS = platform.system() == "Windows"
PYTHON_CMD = sys.executable  # Use whatever Python is running this script
VENV_PYTHON = VENV_DIR / ("Scripts" / "python.exe" if IS_WINDOWS else "bin" / "python")
VENV_PIP = VENV_DIR / ("Scripts" / "pip.exe" if IS_WINDOWS else "bin" / "pip")
VENV_UVICORN = VENV_DIR / ("Scripts" / "uvicorn.exe" if IS_WINDOWS else "bin" / "uvicorn")

processes: list[subprocess.Popen] = []


def log(msg: str) -> None:
    print(f"[ForensicX] {msg}", flush=True)


def err(msg: str) -> None:
    print(f"[ForensicX] ERROR: {msg}", file=sys.stderr, flush=True)


def cleanup(*_: object) -> None:
    log("Shutting down...")
    for p in processes:
        try:
            p.terminate()
            p.wait(timeout=5)
        except Exception:
            p.kill()
    log("Done.")
    sys.exit(0)


signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)


def check_command(name: str, install_hint: str) -> bool:
    if shutil.which(name):
        return True
    err(f"{name} not found. {install_hint}")
    return False


def download_file(url: str, dest: Path) -> None:
    if dest.exists():
        return
    log(f"Downloading {dest.name}...")
    try:
        urllib.request.urlretrieve(url, str(dest))
        log(f"{dest.name} downloaded ({dest.stat().st_size // (1024*1024)}MB).")
    except Exception as e:
        err(f"Failed to download {dest.name}: {e}")
        if dest.exists():
            dest.unlink()


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> None:
    result = subprocess.run(cmd, cwd=cwd)
    if check and result.returncode != 0:
        err(f"Command failed: {' '.join(str(c) for c in cmd)}")
        sys.exit(1)


def main() -> None:
    log("Checking prerequisites...")

    # Check Python version
    if sys.version_info < (3, 10):
        err(f"Python 3.10+ required, got {sys.version}. Install from https://python.org")
        sys.exit(1)
    log(f"Python {sys.version.split()[0]}")

    # Check Node.js
    if not check_command("node", "Install from https://nodejs.org"):
        sys.exit(1)
    if not check_command("npm", "Install from https://nodejs.org"):
        sys.exit(1)

    # --- Backend setup ---
    log("Setting up backend...")

    if not VENV_DIR.exists():
        log("Creating virtual environment...")
        run([PYTHON_CMD, "-m", "venv", str(VENV_DIR)])

    log("Installing backend dependencies...")
    run([str(VENV_PIP), "install", "--quiet", "--upgrade", "pip"])
    run([str(VENV_PIP), "install", "--quiet", "-r", str(BACKEND_DIR / "requirements.txt")])

    # --- Download model weights ---
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

    # Lightweight models only (~5MB each) — BSRGAN/x4plus omitted (too heavy for 8GB machines)
    weights = {
        "realesr-general-x4v3.pth": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth",
        "realesr-general-wdn-x4v3.pth": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-wdn-x4v3.pth",
    }

    for name, url in weights.items():
        download_file(url, WEIGHTS_DIR / name)

    # SRGAN weights — check if they exist (custom trained, not publicly hosted)
    srgan_path = WEIGHTS_DIR / "srgan_generator.pth"
    if not srgan_path.exists():
        log(f"WARNING: {srgan_path.name} not found. SRGAN model will not be available.")
        log("  Place the weights file in backend/weights/ manually.")

    # --- Frontend setup ---
    log("Setting up frontend...")

    if not (FRONTEND_DIR / "node_modules").exists():
        log("Installing frontend dependencies...")
        run(["npm", "install"], cwd=FRONTEND_DIR)
    else:
        log("Frontend dependencies already installed.")

    # --- Create .env if missing ---
    frontend_env = FRONTEND_DIR / ".env"
    if not frontend_env.exists():
        log("Creating frontend .env...")
        frontend_env.write_text("VITE_API_BASE=http://127.0.0.1:8000/api\n")

    # --- Start backend ---
    log("Starting backend on http://127.0.0.1:8000 ...")
    backend = subprocess.Popen(
        [str(VENV_UVICORN), "app.main:app", "--reload", "--port", "8000", "--host", "127.0.0.1"],
        cwd=BACKEND_DIR,
    )
    processes.append(backend)

    # Wait for backend
    log("Waiting for backend...")
    for i in range(30):
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2)
            log("Backend is ready.")
            break
        except Exception:
            if i == 29:
                err("Backend failed to start. Check the logs above.")
                cleanup()
            time.sleep(1)

    # --- Start frontend ---
    log("Starting frontend on http://localhost:5173 ...")
    npm_cmd = "npm.cmd" if IS_WINDOWS else "npm"
    frontend = subprocess.Popen([npm_cmd, "run", "dev"], cwd=FRONTEND_DIR)
    processes.append(frontend)

    time.sleep(2)
    print()
    log("=========================================")
    log("  ForensicX is running!")
    log("  Frontend: http://localhost:5173")
    log("  Backend:  http://127.0.0.1:8000")
    log("  API docs: http://127.0.0.1:8000/docs")
    log("=========================================")
    log("Press Ctrl+C to stop both servers.")
    print()

    # Wait for either process to exit
    try:
        while True:
            if backend.poll() is not None or frontend.poll() is not None:
                break
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
