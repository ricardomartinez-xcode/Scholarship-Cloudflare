import os
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"").strip("'")
        os.environ.setdefault(key, value)


def load_local_env() -> None:
    project_root = Path(__file__).resolve().parent.parent
    _load_env_file(project_root / ".env.local")
    _load_env_file(project_root / ".env")


def _derive_http_sql_url() -> str | None:
    explicit = os.environ.get("NEON_HTTP_SQL_URL")
    if explicit:
        return explicit.rstrip("/")

    host = (
        os.environ.get("NEON_HOST")
        or os.environ.get("POSTGRES_HOST")
        or os.environ.get("PGHOST")
    )
    if host:
        return f"https://{host.rstrip('/')}/sql"

    direct_url = (
        os.environ.get("DIRECT_URL")
        or os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL_NON_POOLING")
        or os.environ.get("POSTGRES_URL")
    )
    if direct_url and "@" in direct_url:
        host_part = direct_url.split("@", 1)[1].split("/", 1)[0]
        return f"https://{host_part.rstrip('/')}/sql"

    return None


def _derive_connection_string() -> str | None:
    explicit = (
        os.environ.get("NEON_CONNECTION_STRING")
        or os.environ.get("DIRECT_URL")
        or os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL_NON_POOLING")
        or os.environ.get("POSTGRES_URL")
    )
    if explicit:
        return explicit

    user = os.environ.get("NEON_USER")
    password = os.environ.get("NEON_PASSWORD") or os.environ.get("NEON_PASS")
    host = os.environ.get("NEON_HOST")
    database = os.environ.get("NEON_DATABASE") or os.environ.get("NEON_DB") or "neondb"
    if user and password and host:
        return f"postgresql://{user}:{password}@{host}/{database}?sslmode=require"
    return None


def load_neon_http_config() -> tuple[str, str]:
    load_local_env()
    http_sql_url = _derive_http_sql_url()
    connection_string = _derive_connection_string()
    if not http_sql_url or not connection_string:
        raise RuntimeError(
            "Missing Neon HTTP configuration. Set NEON_HTTP_SQL_URL plus NEON_CONNECTION_STRING, "
            "or provide DIRECT_URL / DATABASE_URL / NEON_HOST + credentials in environment."
        )
    return http_sql_url, connection_string
