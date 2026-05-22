#!/usr/bin/env python3
"""
Run Prisma migrations via the Neon HTTP SQL endpoint.
Needed when TCP port 5432 is blocked but HTTPS works (e.g., in sandboxed CI environments).

Usage: python3 scripts/migrate.py [--reset]
"""

import json
import os
import re
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlparse

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _neon_env import resolve_neon_http_config

SQL_URL, NEON_CONN = resolve_neon_http_config()
MIGRATIONS_DIR = Path(__file__).parent.parent / "prisma" / "migrations"


def run_query(sql: str, description: str = ""):
    """Execute SQL via Neon HTTP endpoint using curl."""
    import tempfile
    body = json.dumps({"query": sql})
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        f.write(body)
        tmp_path = f.name
    try:
        result = subprocess.run(
            [
                "curl", "-s", "-X", "POST",
                "-H", "Content-Type: application/json",
                "-H", f"Neon-Connection-String: {NEON_CONN}",
                SQL_URL,
                "--data-binary", f"@{tmp_path}",
            ],
            capture_output=True,
            text=True,
        )
    finally:
        os.unlink(tmp_path)
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"Invalid JSON response: {result.stdout[:200]}")

    if "message" in data and data["message"]:
        raise RuntimeError(
            f"SQL Error [{description}]: {data['message']}\nSQL: {sql[:300]}"
        )
    return data


def split_statements(sql: str) -> list[str]:
    """
    Split SQL into individual statements, correctly handling:
    - Dollar-quoted blocks: DO $$ ... END $$;
    - Single-quoted strings: 'text'
    - Single-line comments: -- comment
    """
    statements = []
    current = []
    i = 0
    n = len(sql)
    in_single_quote = False
    in_dollar_quote = False
    dollar_tag = ""
    in_line_comment = False

    while i < n:
        c = sql[i]

        # Handle line comments
        if in_line_comment:
            current.append(c)
            if c == "\n":
                in_line_comment = False
            i += 1
            continue

        # Start line comment
        if not in_single_quote and not in_dollar_quote and c == "-" and i + 1 < n and sql[i + 1] == "-":
            in_line_comment = True
            current.append(c)
            i += 1
            continue

        # Handle single quotes
        if not in_dollar_quote and c == "'":
            in_single_quote = not in_single_quote
            current.append(c)
            i += 1
            continue

        # Handle dollar-quoted blocks
        if not in_single_quote and c == "$":
            # detect start tag
            if not in_dollar_quote:
                m = re.match(r"\$[A-Za-z_]*\$", sql[i:])
                if m:
                    dollar_tag = m.group(0)
                    in_dollar_quote = True
                    current.append(dollar_tag)
                    i += len(dollar_tag)
                    continue
            else:
                if sql.startswith(dollar_tag, i):
                    in_dollar_quote = False
                    current.append(dollar_tag)
                    i += len(dollar_tag)
                    continue

        # End of statement
        if c == ";" and not in_single_quote and not in_dollar_quote:
            current.append(c)
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            i += 1
            continue

        current.append(c)
        i += 1

    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def main():
    print(f"Using migrations dir: {MIGRATIONS_DIR}")
    if not MIGRATIONS_DIR.exists():
        raise SystemExit("Migrations directory not found")

    for mig_dir in sorted(MIGRATIONS_DIR.iterdir()):
        sql_file = mig_dir / "migration.sql"
        if not sql_file.exists():
            continue
        print(f"Applying {mig_dir.name}...")
        content = sql_file.read_text(encoding="utf-8").strip()
        if not content or content == "-- This is an empty migration.":
            print("  Skipping empty migration")
            continue
        for stmt in split_statements(content):
            trimmed = stmt.strip()
            if not trimmed:
                continue
            run_query(trimmed, mig_dir.name)
        print("  Done")


if __name__ == "__main__":
    main()
