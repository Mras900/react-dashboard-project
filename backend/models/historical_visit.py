import hashlib

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def hash_rut(rut: str) -> str | None:
    """Normaliza y hashea RUT chileno con SHA-256."""
    if not rut or not rut.strip():
        return None
    cleaned = rut.strip().upper().replace(".", "").replace("-", "").replace(" ", "")
    if not cleaned:
        return None
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


class HistoricalVisit(Base):
    __tablename__ = "historical_visits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Metadata
    source_year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    dataset_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Datos del reclamo/visita
    ticket: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    # cliente no se usa nunca (PII). Columna mantenida nullable para compatibilidad.
    cliente: Mapped[str | None] = mapped_column(Text, nullable=True)
    region: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    comuna: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    prioridad: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    estado: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    kut_estado_2: Mapped[str | None] = mapped_column(Text, nullable=True)
    subclasificacion_ac: Mapped[str | None] = mapped_column(Text, nullable=True)
    categoria_objeto: Mapped[str | None] = mapped_column(Text, nullable=True)
    atribucion_responsable: Mapped[str | None] = mapped_column(Text, nullable=True)
    categoria_incidente: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    categoria_causa: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    producto_reclamado: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    mapa: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Fechas (guardadas como ISO string yyyy-mm-dd)
    fecha_visita: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    fecha_envio_laboratorio: Mapped[str | None] = mapped_column(String(50), nullable=True)
    fecha_respuesta: Mapped[str | None] = mapped_column(String(50), nullable=True)
    requiere_respuesta: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Flags binarios (texto libre del CSV)
    tiene_envase: Mapped[str | None] = mapped_column(Text, nullable=True)
    tiene_muestra: Mapped[str | None] = mapped_column(Text, nullable=True)
    imposibilidad_contacto: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Numericos
    contador: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Privacidad: hash de RUT, flags de presencia
    rut_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    has_email: Mapped[bool] = mapped_column(Boolean, default=False)
    has_address: Mapped[bool] = mapped_column(Boolean, default=False)

    # Fila cruda sanitizada (sin RUT, correo ni direccion)
    raw_row: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Auditoria
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=True, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<HistoricalVisit id={self.id} ticket={self.ticket} year={self.source_year}>"
