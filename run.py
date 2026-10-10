"""
Single-command development launcher for Text-to-SQL Studio.
Starts both FastAPI backend (port 8000) and Vite React frontend (port 5173) simultaneously.
Gracefully shuts down both processes on Ctrl+C.
"""

import os
import sys
import subprocess
import signal
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

# Locate virtual environment python executable
if sys.platform == "win32":
    VENV_PYTHON = os.path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
    VENV_UVICORN = os.path.join(ROOT_DIR, ".venv", "Scripts", "uvicorn.exe")
    NPM_CMD = "npm.cmd"
else:
    VENV_PYTHON = os.path.join(ROOT_DIR, ".venv", "bin", "python")
    VENV_UVICORN = os.path.join(ROOT_DIR, ".venv", "bin", "uvicorn")
    NPM_CMD = "npm"

python_bin = VENV_PYTHON if os.path.exists(VENV_PYTHON) else sys.executable


def main():
    print("=" * 65)
    print(" 🚀 Launching Text-to-SQL Studio (Backend + Frontend)")
    print("=" * 65)
    print(" • Backend API:       http://127.0.0.1:8000 (Docs: /docs)")
    print(" • Frontend Web App:  http://localhost:5173")
    print(" • Press Ctrl+C at any time to stop both servers.")
    print("=" * 65 + "\n")

    # Ensure demo database exists
    demo_db = os.path.join(BACKEND_DIR, "demo_data", "ecommerce.db")
    if not os.path.exists(demo_db):
        print("📦 Initializing demo e-commerce SQLite database...")
        subprocess.run([python_bin, os.path.join(BACKEND_DIR, "demo_data", "init_demo_db.py")], cwd=ROOT_DIR)

    # Launch Backend
    backend_env = os.environ.copy()
    backend_env["PYTHONPATH"] = BACKEND_DIR
    backend_cmd = [
        python_bin, "-m", "uvicorn", "app.main:app",
        "--host", "127.0.0.1",
        "--port", "8000",
        "--reload"
    ]
    print("🟢 Starting FastAPI backend on http://127.0.0.1:8000...")
    backend_proc = subprocess.Popen(backend_cmd, cwd=BACKEND_DIR, env=backend_env)

    # Launch Frontend
    print("🔵 Starting Vite React frontend on http://localhost:5173...")
    frontend_proc = subprocess.Popen([NPM_CMD, "run", "dev"], cwd=FRONTEND_DIR)

    def shutdown(sig, frame):
        print("\n\n🛑 Stopping both servers...")
        try:
            backend_proc.terminate()
        except Exception:
            pass
        try:
            frontend_proc.terminate()
        except Exception:
            pass
        backend_proc.wait()
        frontend_proc.wait()
        print("✅ Servers stopped cleanly. Goodbye!\n")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    try:
        # Keep process alive while monitoring children
        while True:
            if backend_proc.poll() is not None:
                print("⚠️ Backend server exited unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("⚠️ Frontend server exited unexpectedly.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown(None, None)


if __name__ == "__main__":
    main()
