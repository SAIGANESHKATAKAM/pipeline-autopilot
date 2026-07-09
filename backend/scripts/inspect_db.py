import os
import sqlite3
import json
from pathlib import Path

# Locate database file (expected at backend/pipeline_autopilot.db)
root = Path(__file__).resolve().parents[1]
db_path = root / "pipeline_autopilot.db"
if not db_path.exists():
    # fallback: search for any .db file in repo
    candidates = list(root.glob("*.db"))
    if candidates:
        db_path = candidates[0]

print(f"Using DB: {db_path}")
if not db_path.exists():
    print("Database file not found. Is the app using a different DB or not initialized?")
    raise SystemExit(1)

con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
cur = con.cursor()

def fetch_all(table):
    try:
        cur.execute(f"SELECT * FROM {table} LIMIT 100")
        rows = [dict(r) for r in cur.fetchall()]
        return rows
    except Exception as e:
        return {"error": str(e)}

print(json.dumps({
    "installations": fetch_all('installations'),
    "users": fetch_all('users')
}, indent=2, default=str))
con.close()
