from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RutaVisitaDiaria(Base):
    __tablename__ = "ruta_visitas_diarias"
    __table_args__ = (
        UniqueConstraint("ticket_id", "fecha_visita", name="uq_ruta_ticket_fecha_visita"),
        Index("ix_ruta_visitas_fecha_territorio", "fecha_visita", "territorio"),
        Index("ix_ruta_visitas_comuna", "comuna"),
        Index("ix_ruta_visitas_region", "region"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(String(120), nullable=False)
    referencia: Mapped[str] = mapped_column(String(160), default="")
    nombre: Mapped[str | None] = mapped_column(String(255))
    rut: Mapped[str | None] = mapped_column(String(40))
    direccion_original: Mapped[str | None] = mapped_column(Text)
    direccion: Mapped[str | None] = mapped_column(Text)
    comuna: Mapped[str | None] = mapped_column(String(160))
    region: Mapped[str | None] = mapped_column(String(200))
    territorio: Mapped[str] = mapped_column(String(20), nullable=False, default="regiones")
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    peligro: Mapped[bool] = mapped_column(Boolean, default=False)
    estado: Mapped[str] = mapped_column(String(30), default="pendiente")
    observacion: Mapped[str | None] = mapped_column(Text)
    cantidad_reclamos: Mapped[int] = mapped_column(Integer, default=0)
    tickets_json: Mapped[list] = mapped_column(JSON, default=list)
    fecha_carga: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_visita: Mapped[date] = mapped_column(Date, nullable=False)
    visitador: Mapped[str | None] = mapped_column(String(160))
    valor_visita: Mapped[float] = mapped_column(Float, default=0)
    valor_no_exitosa: Mapped[float] = mapped_column(Float, default=0)
    valor_calculado: Mapped[float] = mapped_column(Float, default=0)
    distancia_km: Mapped[float] = mapped_column(Float, default=0)
    combustible_litros: Mapped[float] = mapped_column(Float, default=0)
    combustible_costo: Mapped[float] = mapped_column(Float, default=0)
    tiempo_conduccion_s: Mapped[float] = mapped_column(Float, default=0)
    tiempo_atencion_s: Mapped[float] = mapped_column(Float, default=0)
    tiempo_total_s: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
