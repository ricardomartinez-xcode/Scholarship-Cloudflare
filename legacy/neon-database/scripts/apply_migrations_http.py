#!/usr/bin/env python3
"""
Apply all Prisma migration SQL files via the Neon HTTP SQL API.
Since port 5432 is blocked, we use the HTTP endpoint instead of psql.
"""

import json
import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
import urllib.request
import urllib.error

from _neon_env import resolve_neon_http_config

NEON_HTTP_SQL, NEON_CONN = resolve_neon_http_config()

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "prisma", "migrations")

# Ordered list - skip baseline (it's just a comment)
MIGRATION_ORDER = [
    "20260209_a_init_admin",
    "20260209_campus_catalog",
    "20260209_z_academic_offerings",
    "20260211_roles_invites_benefit_scope",
    "20260211_output_import_models",
    "20260219_admin_cta_app_results_location",
    "20260224_unidep_features",
    "20260303_remove_better_auth",
    "20260303_auth_schema_cleanup",
]


def execute_sql(query: str) -> dict:
    """Execute a single SQL statement via Neon HTTP API."""
    payload = json.dumps({"query": query, "params": []}).encode("utf-8")
    req = urllib.request.Request(
        NEON_HTTP_SQL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Neon-Connection-String": NEON_CONN,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return {"error": body, "status": e.code}


def split_statements(sql: str) -> list[str]:
    """
    Split SQL into individual statements, respecting:
    - DO $$ ... $$ blocks (dollar-quoted blocks)
    - Single-line -- comments
    - Multi-line /* */ comments
    Semicolon outside of dollar-quoted blocks marks statement end.
    """
    statements = []
    current = []
    in_dollar_quote = False
    dollar_tag = None
    i = 0
    lines = sql.split("\n")

    # Rebuild as single string for parsing
    text = sql

    pos = 0
    length = len(text)
    stmt_start = 0

    while pos < length:
        ch = text[pos]

        # Check for dollar-quoting start/end
        if ch == "$":
            # Find end of potential dollar tag
            end = text.find("$", pos + 1)
            if end != -1:
                tag = text[pos : end + 1]
                if re.match(r"^\$[a-zA-Z_]*\$$", tag):
                    if not in_dollar_quote:
                        in_dollar_quote = True
                        dollar_tag = tag
                        pos = end + 1
                        continue
                    elif tag == dollar_tag:
                        in_dollar_quote = False
                        dollar_tag = None
                        pos = end + 1
                        continue

        # Skip line comments (outside dollar quotes)
        if not in_dollar_quote and ch == "-" and pos + 1 < length and text[pos + 1] == "-":
            # Skip to end of line
            end = text.find("\n", pos)
            if end == -1:
                pos = length
            else:
                pos = end + 1
            continue

        # Statement delimiter
        if not in_dollar_quote and ch == ";":
            stmt = text[stmt_start : pos + 1].strip()
            if stmt and stmt != ";":
                # Remove pure-comment-only statements
                cleaned = re.sub(r"--[^\n]*", "", stmt).strip()
                cleaned = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.DOTALL).strip()
                if cleaned and cleaned != ";":
                    statements.append(stmt)
            stmt_start = pos + 1

        pos += 1

    # Trailing statement without semicolon
    remaining = text[stmt_start:].strip()
    if remaining:
        cleaned = re.sub(r"--[^\n]*", "", remaining).strip()
        if cleaned:
            statements.append(remaining)

    return statements


def apply_migration(name: str) -> bool:
    sql_path = os.path.join(MIGRATIONS_DIR, name, "migration.sql")
    if not os.path.exists(sql_path):
        print(f"  [SKIP] {name}: migration.sql not found")
        return True

    with open(sql_path, "r") as f:
        sql = f.read()

    statements = split_statements(sql)
    print(f"\n[{name}] — {len(statements)} statement(s)")

    for i, stmt in enumerate(statements):
        preview = stmt[:60].replace("\n", " ")
        print(f"  [{i+1}/{len(statements)}] {preview}...")
        result = execute_sql(stmt)

        if "error" in result:
            # Try to parse the error as JSON
            try:
                err = json.loads(result["error"])
                msg = err.get("message", result["error"])
                severity = err.get("severity", "ERROR")
                # Some errors are OK (e.g., IF NOT EXISTS guards)
                if severity == "ERROR":
                    print(f"  ✗ ERROR: {msg}")
                    return False
                else:
                    print(f"  ~ {severity}: {msg}")
            except Exception:
                print(f"  ✗ HTTP {result.get('status', '?')}: {result['error'][:200]}")
                return False
        elif "message" in result and result.get("severity") == "ERROR":
            print(f"  ✗ ERROR: {result['message']}")
            return False
        else:
            cmd = result.get("command", "OK")
            rows = result.get("rowCount", "")
            print(f"  ✓ {cmd} {rows if rows else ''}")

    return True


def create_prisma_migrations_table():
    """Create the _prisma_migrations tracking table in recalc_admin schema."""
    print("\n[Setup] Creating _prisma_migrations table...")
    sql = """
    CREATE TABLE IF NOT EXISTS "recalc_admin"."_prisma_migrations" (
        "id"                    VARCHAR(36) NOT NULL PRIMARY KEY,
        "checksum"              VARCHAR(64) NOT NULL,
        "finished_at"           TIMESTAMPTZ,
        "migration_name"        VARCHAR(255) NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        TIMESTAMPTZ,
        "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
    )
    """
    result = execute_sql(sql)
    if "error" in result:
        print(f"  ✗ {result['error'][:200]}")
        return False
    print("  ✓ Table ready")
    return True


def record_migration(name: str):
    """Record a migration as applied in _prisma_migrations."""
    import hashlib
    import uuid

    migration_id = str(uuid.uuid4())
    # Read file for checksum
    sql_path = os.path.join(MIGRATIONS_DIR, name, "migration.sql")
    content = open(sql_path).read() if os.path.exists(sql_path) else ""
    checksum = hashlib.sha256(content.encode()).hexdigest()[:64]

    sql = f"""
    INSERT INTO "recalc_admin"."_prisma_migrations"
        ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
    VALUES
        ('{migration_id}', '{checksum}', NOW(), '{name}', NOW(), 1)
    ON CONFLICT ("id") DO NOTHING
    """
    result = execute_sql(sql)
    if "error" in result:
        print(f"  ✗ Record migration failed: {result['error'][:100]}")
    else:
        print(f"  ✓ Recorded migration: {name}")


def main():
    print("=" * 72)
    print("Applying Prisma migrations via Neon HTTP SQL API")
    print("=" * 72)

    ok_all = True

    if not create_prisma_migrations_table():
        print("\nFailed to prepare _prisma_migrations table.")
        sys.exit(1)

    for name in MIGRATION_ORDER:
        success = apply_migration(name)
        if success:
            record_migration(name)
        else:
            ok_all = False
            print(f"\nStopping on failed migration: {name}")
            break

    print("\n" + "=" * 72)
    if ok_all:
        print("✅ All migrations applied successfully.")
        sys.exit(0)
    else:
        print("❌ Migration run failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
