import { useState, useEffect } from "react";
import type { LatLng } from "@/types";
import { putDeviceLocation } from "@/services/api";

const DEVICE_ID_KEY = "localbid_device_id";

// Default location: Bahnhof Stadelhofen, Zurich
const DEFAULT_LOCATION: LatLng = { lat: 47.36667, lng: 8.54861 };

// Module-level singleton cache - shared across all hook instances
let cachedLocation: LatLng | null = null;
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
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.latitude === "number" && typeof data.longitude === "number") {
      console.info(`[Geolocation] IP-based location: ${data.city}, ${data.country_name}`);
      return { lat: data.latitude, lng: data.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

function getBrowserLocation(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation || !isSecureContext()) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.info("[Geolocation] Browser location acquired");
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  });
}

async function fetchLocationOnce(): Promise<LatLng> {
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

    // 1. Try browser Geolocation API
    const browserLoc = await getBrowserLocation();
    if (browserLoc) {
      cachedLocation = browserLoc;
      syncLocationToBackend(browserLoc);
      return browserLoc;
    }

    // 2. Fall back to IP geolocation
    console.info("[Geolocation] Trying IP-based geolocation...");
    const ipLoc = await getLocationFromIP();
    if (ipLoc) {
      cachedLocation = ipLoc;
      syncLocationToBackend(ipLoc);
      return ipLoc;
    }

    // 3. Final fallback to Bahnhof Stadelhofen, Zurich
    console.info("[Geolocation] Using default location (Stadelhofen, Zurich)");
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
