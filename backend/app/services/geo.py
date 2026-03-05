"""
Geo utilities — complete, shared by all backends.
"""
import math


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def eta_minutes(distance_km: float, speed_kmh: float = 20.0) -> int:
    """Estimated travel time in minutes given distance and average speed."""
    if speed_kmh <= 0:
        return 9999
    return max(1, round((distance_km / speed_kmh) * 60))
