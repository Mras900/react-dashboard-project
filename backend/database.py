import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=False)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


class DatabaseUnavailableError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message
        self.env_path_checked = str(ENV_PATH)

class Base(DeclarativeBase):
    pass


engine = (
    create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
    if DATABASE_URL
    else None
)
SessionLocal = (
    sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    if engine is not None
    else None
)


def create_database_tables() -> bool:
    if engine is None:
        return False

    try:
        Base.metadata.create_all(bind=engine)
        return True
    except SQLAlchemyError:
        return False


def check_database_health() -> tuple[bool, str]:
    if engine is None:
        return False, "DATABASE_URL no está configurada. Revisa backend/.env"

    try:
        with engine.connect() as connection:
            database_name = connection.scalar(text("SELECT current_database()"))
        return True, str(database_name or "")
    except SQLAlchemyError:
        return False, "No se pudo conectar a PostgreSQL. Revisa host, puerto, credenciales y disponibilidad."


def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise DatabaseUnavailableError("DATABASE_URL no está configurada. Revisa backend/.env")

    session = SessionLocal()
    try:
        session.execute(text("SELECT 1"))
        yield session
    except DatabaseUnavailableError:
        raise
    except SQLAlchemyError as error:
        session.rollback()
        raise DatabaseUnavailableError(
            "No se pudo conectar a PostgreSQL. Revisa host, puerto, credenciales y disponibilidad."
        ) from error
    finally:
        session.close()
