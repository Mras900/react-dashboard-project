from schemas.ruta_schema import OptimizedRoutePoint, OptimizeRouteRequest, OptimizeRouteResponse
from services.geocoding_service import geocode_address
from services.osrm_service import osrm_route_geometry, osrm_table


class RouteOptimizationError(Exception):
    def __init__(self, message: str, status_code: int) -> None:
        super().__init__(message)
        self.status_code = status_code


def nearest_neighbor_route(durations: list[list[float | None]], priority_weights: list[float]) -> list[int]:
    n = len(durations)
    no_visitados = set(range(1, n))
    ruta = [0]
    actual = 0

    while no_visitados:
        siguiente = min(
            no_visitados,
            key=lambda index: (durations[actual][index] / max(priority_weights[index], 1)) if durations[actual][index] is not None else float("inf"),
        )
        ruta.append(siguiente)
        no_visitados.remove(siguiente)
        actual = siguiente

    return ruta


def two_opt_duration(route: list[int], durations: list[list[float | None]], priority_weights: list[float]) -> float:
    total = 0.0

    for index in range(len(route) - 1):
        origin = route[index]
        destination = route[index + 1]
        duration = durations[origin][destination]

        if duration is None:
            return float("inf")

        total += duration

    urgency_penalty = sum(position * priority_weights[node] * 180 for position, node in enumerate(route[1:], start=1))
    return total + urgency_penalty


def improve_route_2opt(route: list[int], durations: list[list[float | None]], priority_weights: list[float]) -> list[int]:
    mejor = route[:]
    mejor_costo = two_opt_duration(mejor, durations, priority_weights)
    mejorado = True

    while mejorado:
        mejorado = False
        for i in range(1, len(mejor) - 2):
            for j in range(i + 1, len(mejor)):
                if j - i == 1:
                    continue

                nueva = mejor[:]
                nueva[i:j] = reversed(mejor[i:j])
                nuevo_costo = two_opt_duration(nueva, durations, priority_weights)

                if nuevo_costo < mejor_costo:
                    mejor = nueva
                    mejor_costo = nuevo_costo
                    mejorado = True

    return mejor


def build_optimized_route(
    inicio: str,
    visitas: list[dict],
    inicio_lat: float | None = None,
    inicio_lon: float | None = None,
    service_minutes_per_stop: int | None = 10,
) -> OptimizeRouteResponse:
    if isinstance(inicio_lat, (int, float)) and isinstance(inicio_lon, (int, float)):
        inicio_coords = {"lat": inicio_lat, "lon": inicio_lon}
    else:
        inicio_coords = geocode_address(inicio)

    if not inicio_coords:
        raise RouteOptimizationError("No se pudo geocodificar el punto de inicio.", 400)

    service_minutes = max(service_minutes_per_stop or 10, 10)
    visitas_validas = [
        visita
        for visita in visitas
        if isinstance(visita.get("lat"), (int, float)) and isinstance(visita.get("lon"), (int, float))
    ]
    valid_visits_count = len(visitas_validas)

    if not visitas_validas:
        raise RouteOptimizationError("No hay visitas con coordenadas válidas.", 400)

    puntos: list[OptimizedRoutePoint] = [
        OptimizedRoutePoint(
            orden=0,
            tipo="inicio",
            referencia="Inicio",
            nombre="Inicio",
            rut="",
            direccion=inicio,
            lat=inicio_coords["lat"],
            lon=inicio_coords["lon"],
            peligro=False,
        )
    ]

    for visita in visitas_validas:
        puntos.append(
            OptimizedRoutePoint(
                orden=0,
                tipo="visita",
                referencia=visita.get("referencia") or "",
                nombre=visita.get("nombre") or "",
                rut=visita.get("rut") or "",
                direccion=visita.get("direccion") or "",
                lat=visita["lat"],
                lon=visita["lon"],
                peligro=bool(visita.get("peligro", False)),
            )
        )

    coords = [{"lat": punto.lat, "lon": punto.lon} for punto in puntos]
    durations = osrm_table(coords)

    if not durations:
        raise RouteOptimizationError("No se pudo obtener la matriz de tiempos de ruta.", 502)

    priority_map = {"alta": 4.0, "alto": 4.0, "high": 4.0, "media": 2.0, "medio": 2.0, "medium": 2.0}
    priority_weights = [1.0]
    for visit in visitas_validas:
        explicit_priority = str(visit.get("prioridad") or "").strip().lower()
        claims_weight = min(max(int(visit.get("cantidad_reclamos") or 1), 1), 4)
        priority_weights.append(max(priority_map.get(explicit_priority, 1.0), float(claims_weight)))

    route = improve_route_2opt(nearest_neighbor_route(durations, priority_weights), durations, priority_weights)
    ordered_points = [puntos[index].model_copy(update={"orden": order}) for order, index in enumerate(route)]
    ordered_coords = [{"lat": point.lat, "lon": point.lon} for point in ordered_points]
    route_data = osrm_route_geometry(ordered_coords)

    if not route_data["geometry"]:
        raise RouteOptimizationError("No se pudo obtener la geometría de la ruta.", 502)

    detalle = [point.model_dump() for point in ordered_points]
    travel_duration_s = route_data["duration_s"]
    service_duration_s = valid_visits_count * service_minutes * 60
    total_duration_s = travel_duration_s + service_duration_s

    return OptimizeRouteResponse(
        inicio=inicio,
        puntos=ordered_points,
        geometry=route_data["geometry"],
        distance_m=route_data["distance_m"],
        duration_s=total_duration_s,
        travel_duration_s=travel_duration_s,
        service_duration_s=service_duration_s,
        service_minutes_per_stop=service_minutes,
        valid_visits_count=valid_visits_count,
        detalle=detalle,
    )


def build_optimized_route_from_request(request: OptimizeRouteRequest) -> OptimizeRouteResponse:
    visitas = [visita.model_dump() for visita in request.visitas]
    return build_optimized_route(
        request.inicio,
        visitas,
        inicio_lat=request.inicio_lat,
        inicio_lon=request.inicio_lon,
        service_minutes_per_stop=request.service_minutes_per_stop,
    )
