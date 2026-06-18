from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Severity = Literal["baja", "media", "alta", "critica"]
DisplayMode = Literal["circle", "heatpoint", "polygon"]
ZoneStatus = Literal["active", "inactive"]


class RedZoneBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    comuna: str | None = None
    region: str | None = None
    lat: float | None = None
    lon: float | None = None
    radius_m: float = Field(default=350, gt=0, le=100000)
    severity: Severity = "alta"
    source: str = "manual"
    status: ZoneStatus = "active"
    display_mode: DisplayMode = "circle"
    polygon_geojson: dict[str, Any] | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_geometry(self):
        if self.display_mode in {"circle", "heatpoint"} and (self.lat is None or self.lon is None):
            raise ValueError("lat y lon son obligatorios para circle y heatpoint")
        if self.display_mode == "polygon" and self.polygon_geojson is None:
            raise ValueError("polygon_geojson es obligatorio para polygon")
        return self


class RedZoneCreate(RedZoneBase):
    pass


class RedZoneUpdate(RedZoneBase):
    pass


class RedZoneResponse(RedZoneBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class HeatPointResponse(BaseModel):
    id: int
    name: str
    lat: float
    lon: float
    intensity: float
    severity: str
    radius_m: float


class ValidatedZoneResponse(BaseModel):
    id: int | None = None
    name: str
    source: str
    comuna: str | None = None
    region: str | None = None
    distance_m: float
    radius_m: float | None = None
    severity: str | None = None
    lat: float | None = None
    lon: float | None = None


class ValidatePointResponse(BaseModel):
    ok: bool = True
    status: Literal["inside", "nearby", "safe"]
    message: str
    lat: float
    lon: float
    inside_zones: list[ValidatedZoneResponse] = Field(default_factory=list)
    nearby_zones: list[ValidatedZoneResponse] = Field(default_factory=list)
    nearest_zone: ValidatedZoneResponse | None = None
