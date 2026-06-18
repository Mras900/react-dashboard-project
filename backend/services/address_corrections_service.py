import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.address_correction import AddressCorrection


def normalize_address(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return " ".join(
        "".join(character for character in normalized if unicodedata.category(character) != "Mn")
        .lower()
        .strip()
        .split()
    )


def find_address_correction(db: Session, original_address: str) -> AddressCorrection | None:
    return db.scalar(
        select(AddressCorrection).where(
            AddressCorrection.normalized_original == normalize_address(original_address)
        )
    )


def save_address_correction(
    db: Session,
    original_address: str,
    corrected_label: str,
    lat: float,
    lon: float,
    source: str = "manual",
) -> AddressCorrection:
    normalized = normalize_address(original_address)
    record = db.scalar(
        select(AddressCorrection).where(AddressCorrection.normalized_original == normalized)
    )
    if record is None:
        record = AddressCorrection(
            original_address=original_address,
            normalized_original=normalized,
            corrected_label=corrected_label,
            lat=lat,
            lon=lon,
            source=source,
        )
        db.add(record)
    else:
        record.corrected_label = corrected_label
        record.lat = lat
        record.lon = lon
        record.source = source
    db.commit()
    db.refresh(record)
    return record
