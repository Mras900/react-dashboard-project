from database import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, func


class Reclamo(Base):
    __tablename__ = "reclamos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket = Column(String(255), nullable=True, index=True)
    mes = Column(String(50), nullable=True)
    region = Column(String(255), nullable=True, index=True)
    ciudad = Column(String(255), nullable=True)
    comuna = Column(String(255), nullable=True, index=True)
    cliente = Column(String(255), nullable=True)
    prioridad = Column(String(50), nullable=True)
    retiro_muestra = Column(Boolean, nullable=True)
    estado_visita = Column(String(50), nullable=True)
    fecha_recepcion = Column(String(50), nullable=True)
    fecha_visita = Column(String(50), nullable=True)
    tarifa_ruta = Column(Float, nullable=True)
    km = Column(Float, nullable=True)
    precio_neto = Column(Float, nullable=True)
    traslado = Column(Float, nullable=True)
    precio_neto_traslado = Column(Float, nullable=True)
    facturacion = Column(Float, nullable=True, default=0)
    promedio = Column(Float, nullable=True, default=0)
    fecha_envio = Column(String(50), nullable=True)
    tracking = Column(String(255), nullable=True)
    valor_envio = Column(Float, nullable=True)
    observacion = Column(Text, nullable=True)
    factura = Column(String(255), nullable=True)
    calle = Column(String(255), nullable=True)
    numero = Column(String(100), nullable=True)
    source_file_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=True, server_default=func.now())
    updated_at = Column(DateTime, nullable=True, onupdate=func.now())
