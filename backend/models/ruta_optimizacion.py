from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RutaOptimizacion(Base):
    __tablename__ = "ruta_optimizaciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fecha_visita: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    visitador: Mapped[str | None] = mapped_column(String(160), index=True)
    inicio_label: Mapped[str | None] = mapped_column(String(500))
    inicio_lat: Mapped[float | None] = mapped_column(Float)
    inicio_lon: Mapped[float | None] = mapped_column(Float)
    geometry_json: Mapped[dict | None] = mapped_column(JSON)
    distance_m: Mapped[float] = mapped_column(Float, default=0)
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    duration_s: Mapped[float] = mapped_column(Float, default=0)
    travel_duration_s: Mapped[float] = mapped_column(Float, default=0)
    service_duration_s: Mapped[float] = mapped_column(Float, default=0)
    service_minutes_per_stop: Mapped[int] = mapped_column(Integer, default=10)
    fuel_efficiency_km_l: Mapped[float] = mapped_column(Float, default=0)
    fuel_price: Mapped[float] = mapped_column(Float, default=0)
    fuel_liters: Mapped[float] = mapped_column(Float, default=0)
    fuel_cost: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
