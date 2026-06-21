import os

import psycopg2
from psycopg2.extensions import connection


def get_connection() -> connection:
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL no está configurada en el entorno.")

    return psycopg2.connect(database_url)
