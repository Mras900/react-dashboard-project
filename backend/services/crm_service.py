import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

from schemas.ruta_schema import RutaTicketResponse
from services.geocoding_service import clean_crm_address, geocode_address
from services.red_zones_service import is_point_in_red_zone


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

CRM_BASE_URL = os.getenv("CRM_BASE_URL", "").rstrip("/")
CRM_USERNAME = os.getenv("CRM_USERNAME", "")
CRM_PASSWORD = os.getenv("CRM_PASSWORD", "")
HEADERS = {"Accept": "application/json"}


class CrmServiceError(Exception):
    pass


class CrmNotFoundError(Exception):
    pass


def _get_results(payload: dict[str, Any]) -> list[dict[str, Any]]:
    results = payload.get("d", {}).get("results", [])
    return results if isinstance(results, list) else []


def _ensure_crm_config() -> None:
    if not CRM_BASE_URL or not CRM_USERNAME or not CRM_PASSWORD:
        raise CrmServiceError("Configuracion CRM incompleta en variables de entorno")


def safe_json_request(url: str) -> dict[str, Any]:
    _ensure_crm_config()

    try:
        response = requests.get(
            url,
            auth=HTTPBasicAuth(CRM_USERNAME, CRM_PASSWORD),
            headers=HEADERS,
            timeout=15,
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as error:
        status_code = error.response.status_code if error.response is not None else "sin estado"
        raise CrmServiceError(f"Error HTTP CRM: {status_code}") from error
    except requests.exceptions.RequestException as error:
        raise CrmServiceError(f"Error de conexion CRM: {error}") from error
    except ValueError as error:
        raise CrmServiceError("Respuesta CRM no es JSON valido") from error


def get_ticket_by_id(ticket_id: str) -> dict[str, Any] | None:
    url = f"{CRM_BASE_URL}/ServiceRequestCollection?$filter=ID eq '{ticket_id}'&$format=json"
    payload = safe_json_request(url)
    results = _get_results(payload)
    return results[0] if results else None


def get_customer_by_id(customer_id: str) -> dict[str, Any] | None:
    url = f"{CRM_BASE_URL}/IndividualCustomerCollection?$filter=CustomerID eq '{customer_id}'&$format=json"
    payload = safe_json_request(url)
    results = _get_results(payload)
    return results[0] if results else None


def get_customer_by_rut(rut: str) -> dict[str, Any] | None:
    url = f"{CRM_BASE_URL}/IndividualCustomerCollection?$filter=ZX_RUT_KUT eq '{rut}'&$format=json"
    payload = safe_json_request(url)
    results = _get_results(payload)
    return results[0] if results else None


def get_tickets_by_customer(customer_id: str) -> list[dict[str, Any]]:
    url = f"{CRM_BASE_URL}/ServiceRequestCollection?$filter=BuyerPartyID eq '{customer_id}'&$format=json"
    payload = safe_json_request(url)
    return _get_results(payload)


def _get_customer_location(customer: dict[str, Any]) -> tuple[float | None, float | None, bool, str | None]:
    direccion = customer.get("FormattedPostalAddressDescription")
    coords = geocode_address(direccion)

    if not coords:
        return None, None, False, None

    lat = coords.get("lat")
    lon = coords.get("lon")
    lat_number = lat if isinstance(lat, (int, float)) else None
    lon_number = lon if isinstance(lon, (int, float)) else None
    peligro = is_point_in_red_zone(lat_number, lon_number)
    query_used = coords.get("query_used")

    return lat_number, lon_number, peligro, query_used if isinstance(query_used, str) else None


def build_visit_from_ticket(ticket_id: str) -> RutaTicketResponse:
    ticket = get_ticket_by_id(ticket_id)

    if not ticket:
        raise CrmNotFoundError("Ticket no encontrado")

    customer_id = ticket.get("BuyerPartyID")
    customer = get_customer_by_id(customer_id)

    if not customer:
        raise CrmNotFoundError("Cliente asociado no encontrado")

    direccion = customer.get("FormattedPostalAddressDescription")
    lat, lon, peligro, query_used = _get_customer_location(customer)

    return RutaTicketResponse(
        referencia=f"Ticket {ticket_id}",
        ticket_id=ticket_id,
        nombre=customer.get("FormattedName"),
        rut=customer.get("ZX_RUT_KUT"),
        direccion=direccion,
        direccion_limpia=clean_crm_address(direccion),
        telefono=customer.get("Phone"),
        correo=customer.get("Email"),
        cantidad_reclamos=1,
        tickets=[ticket_id],
        lat=lat,
        lon=lon,
        peligro=peligro,
        customer_id=customer.get("CustomerID"),
        geocode_query_used=query_used,
    )


def build_visit_from_rut(rut: str) -> RutaTicketResponse:
    customer = get_customer_by_rut(rut)

    if not customer:
        raise CrmNotFoundError("RUT no encontrado")

    customer_id = customer.get("CustomerID")
    tickets = get_tickets_by_customer(customer_id)
    ticket_ids = [ticket.get("ID") for ticket in tickets if ticket.get("ID")]
    direccion = customer.get("FormattedPostalAddressDescription")
    lat, lon, peligro, query_used = _get_customer_location(customer)

    return RutaTicketResponse(
        referencia=f"RUT {rut}",
        ticket_id=None,
        nombre=customer.get("FormattedName"),
        rut=customer.get("ZX_RUT_KUT"),
        direccion=direccion,
        direccion_limpia=clean_crm_address(direccion),
        telefono=customer.get("Phone"),
        correo=customer.get("Email"),
        cantidad_reclamos=len(tickets),
        tickets=ticket_ids,
        lat=lat,
        lon=lon,
        peligro=peligro,
        customer_id=customer.get("CustomerID"),
        geocode_query_used=query_used,
    )
