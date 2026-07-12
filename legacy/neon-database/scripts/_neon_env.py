from __future__ import annotations

import os
from urllib.parse import urlparse


def resolve_neon_http_config() -> tuple[str, str]:
    conn = os.getenv("NEON_CONNECTION_STRING", "").strip()
    host = os.getenv("NEON_HOST", "").strip()
    db = os.getenv("NEON_DB", "neondb").strip()
    user = os.getenv("NEON_USER", "").strip()
    password = os.getenv("NEON_PASSWORD", "").strip()

    if not conn:
        if host and user and password:
            conn = f"postgresql://{user}:{password}@{host}/{db}?sslmode=require"
        else:
            raise RuntimeError(
                "Missing Neon connection settings. Set NEON_CONNECTION_STRING or NEON_HOST/NEON_DB/NEON_USER/NEON_PASSWORD."
            )

    sql_url = os.getenv("NEON_HTTP_SQL", "").strip()
    if not sql_url:
        parsed = urlparse(conn)
        if not parsed.hostname:
            raise RuntimeError(
                "Missing Neon SQL endpoint. Set NEON_HTTP_SQL or provide a parsable NEON_CONNECTION_STRING."
            )
        sql_url = f"https://{parsed.hostname}/sql"

    return sql_url, conn
