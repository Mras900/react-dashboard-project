from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AddressCorrection(Base):
    __tablename__ = "address_corrections"
    __table_args__ = (UniqueConstraint("normalized_original", name="uq_address_correction_normalized"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    original_address: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_original: Mapped[str] = mapped_column(Text, nullable=False)
    corrected_label: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(80), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
