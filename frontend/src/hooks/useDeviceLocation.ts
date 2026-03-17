import { useState, useEffect } from "react";
import type { LatLng } from "@/types";
import { putDeviceLocation } from "@/services/api";

const DEVICE_ID_KEY = "localbid_device_id";

// Default location: Zurich, Switzerland
const DEFAULT_LOCATION: LatLng = { lat: 47.3769, lng: 8.5417 };

// Temporary override: set to a LatLng to force this location (no browser/IP). Set to null to use normal flow.
const TEMPORARY_OVERRIDE_LOCATION: LatLng | null = { lat: 47.36667, lng: 8.54861 }; // Stadelhofen, Zurich

// Module-level singleton cache - shared across all hook instances
let cachedLocation: LatLng | null = TEMPORARY_OVERRIDE_LOCATION;
let locationPromise: Promise<LatLng> | null = null;
let deviceId: string | null = null;

function generateDeviceId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // e.g. non-secure context (HTTP on phone) where randomUUID can throw
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getOrCreateDeviceId(): string {
  if (deviceId) return deviceId;
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  deviceId = id;
  return id;
}

function isSecureContext(): boolean {
  return window.isSecureContext || window.location.hostname === "localhost";
}

async function getLocationFromIP(): Promise<LatLng | null> {
  try {
    const res = await fetch("http://ip-api.com/json/?fields=status,lat,lon,city,country");
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === "success" && typeof data.lat === "number" && typeof data.lon === "number") {
      console.info(`[Geolocation] IP-based location: ${data.city}, ${data.country}`);
      return { lat: data.lat, lng: data.lon };
    }
    return null;
  } catch {
    return null;
  }
}

function getBrowserLocation(): Promise<LatLng> {
  return new Promise((resolve) => {
    if (!navigator.geolocation || !isSecureContext()) {
      resolve(DEFAULT_LOCATION);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.info("[Geolocation] Browser location acquired");
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        resolve(DEFAULT_LOCATION);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  });
}

async function fetchLocationOnce(): Promise<LatLng> {
  // Temporary override: use fixed location (no browser, no IP)
  if (TEMPORARY_OVERRIDE_LOCATION) {
    console.info("[Geolocation] Using temporary override: Stadelhofen");
    cachedLocation = TEMPORARY_OVERRIDE_LOCATION;
    syncLocationToBackend(TEMPORARY_OVERRIDE_LOCATION);
    return TEMPORARY_OVERRIDE_LOCATION;
  }

  // Return cached location if available
  if (cachedLocation) {
    return cachedLocation;
  }

  // Return existing promise if fetch is in progress
  if (locationPromise) {
    return locationPromise;
  }

  // Start new fetch
  locationPromise = (async () => {
    console.info("[Geolocation] Fetching location (one-time)...");

    // Try browser geolocation first if in secure context (IP fallback disabled when override was used)
    if (navigator.geolocation && isSecureContext()) {
      const browserLoc = await getBrowserLocation();
      if (browserLoc.lat !== DEFAULT_LOCATION.lat || browserLoc.lng !== DEFAULT_LOCATION.lng) {
        cachedLocation = browserLoc;
        syncLocationToBackend(browserLoc);
        return browserLoc;
      }
    }

    // Fall back to IP geolocation
    console.info("[Geolocation] Trying IP-based geolocation...");
    const ipLoc = await getLocationFromIP();
    if (ipLoc) {
      cachedLocation = ipLoc;
      syncLocationToBackend(ipLoc);
      return ipLoc;
    }

    // Final fallback to Zurich
    console.info("[Geolocation] Using default location (Zurich)");
    cachedLocation = DEFAULT_LOCATION;
    syncLocationToBackend(DEFAULT_LOCATION);
    return DEFAULT_LOCATION;
  })();

  return locationPromise;
}

function syncLocationToBackend(loc: LatLng) {
  const id = getOrCreateDeviceId();
  putDeviceLocation(id, {
    lat: loc.lat,
    lng: loc.lng,
    accuracy_m: null,
    timestamp: new Date().toISOString(),
  }).catch(() => {
    // silent fail – backend may not be up
  });
}

interface DeviceLocationState {
  location: LatLng | null;
  error: string | null;
  loading: boolean;
  deviceId: string;
}

export function useDeviceLocation(): DeviceLocationState {
  const id = getOrCreateDeviceId();

  const [state, setState] = useState<DeviceLocationState>(() => ({
    location: cachedLocation,
    error: null,
    loading: !cachedLocation,
    deviceId: id,
  }));

  useEffect(() => {
    // If already cached, no need to fetch
    if (cachedLocation) {
      setState((s) => ({
        ...s,
        location: cachedLocation,
        loading: false,
      }));
      return;
    }

    let mounted = true;

    fetchLocationOnce().then((loc) => {
      if (mounted) {
        setState((s) => ({
          ...s,
          location: loc,
          loading: false,
        }));
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
