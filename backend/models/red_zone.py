from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RedZone(Base):
    __tablename__ = "red_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    comuna: Mapped[str | None] = mapped_column(String(160), index=True)
    region: Mapped[str | None] = mapped_column(String(200), index=True)
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    radius_m: Mapped[float] = mapped_column(Float, default=350)
    severity: Mapped[str] = mapped_column(String(20), default="alta")
    source: Mapped[str] = mapped_column(String(80), default="manual")
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    display_mode: Mapped[str] = mapped_column(String(20), default="circle")
    polygon_geojson: Mapped[dict | None] = mapped_column(JSON)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
