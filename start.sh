#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Starting Pipeline Autopilot..."

# ── Check prerequisites ────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Install it and try again."
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo ""
  echo "ERROR: npm / Node.js is not installed."
  echo "Install it with:  sudo apt-get install -y nodejs"
  echo "Then re-run:      ./start.sh"
  echo ""
  exit 1
fi

# ── Check .env ────────────────────────────────────────────────────────────
if [ ! -f "$ROOT_DIR/backend/.env" ]; then
  echo "No .env found — copying from .env.example ..."
  cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
  echo ""
  echo "  IMPORTANT: Edit backend/.env and fill in your API keys before continuing."
  echo "  Keys needed:"
  echo "    GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET  → github.com/settings/developers"
  echo "    AZURE_OPENAI_* or OPENAI_API_KEY          → your AI provider credentials"
  echo "    JWT_SECRET                               → any random string"
  echo ""
  read -p "Press Enter once you've filled in backend/.env to continue, or Ctrl+C to exit..."
fi

# ── Start backend ─────────────────────────────────────────────────────────
cd "$ROOT_DIR/backend"
if [ ! -d "venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv venv
fi
source venv/bin/activate
echo "Installing Python dependencies..."
pip install -r requirements.txt -q
echo "Starting FastAPI backend on http://localhost:8000 ..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# ── Start frontend ────────────────────────────────────────────────────────
cd "$ROOT_DIR/frontend"
echo "Installing frontend dependencies..."
npm install --silent
echo "Starting React frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "  Backend:   http://localhost:8000"
echo "  Frontend:  http://localhost:5173"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID
