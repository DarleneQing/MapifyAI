import { useState, useEffect, useRef, useCallback } from "react";
import type { LatLng } from "@/types";
import { putDeviceLocation } from "@/services/api";

const DEVICE_ID_KEY = "localbid_device_id";
const MIN_DISTANCE_M = 100; // only sync if moved > 100m

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

interface DeviceLocationState {
  location: LatLng | null;
  error: string | null;
  loading: boolean;
  deviceId: string;
}

export function useDeviceLocation(): DeviceLocationState {
  const deviceId = useRef(getOrCreateDeviceId()).current;
  const lastSynced = useRef<LatLng | null>(null);

  const [state, setState] = useState<DeviceLocationState>({
    location: null,
    error: null,
    loading: true,
    deviceId,
  });

  const syncToBackend = useCallback(
    (lat: number, lng: number, accuracy?: number) => {
      const current: LatLng = { lat, lng };
      if (
        lastSynced.current &&
        haversineMeters(lastSynced.current, current) < MIN_DISTANCE_M
      ) {
        return;
      }
      lastSynced.current = current;
      putDeviceLocation(deviceId, {
        lat,
        lng,
        accuracy_m: accuracy ?? null,
        timestamp: new Date().toISOString(),
      }).catch(() => {
        // silent fail – backend may not be up
      });
    },
    [deviceId]
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((s) => ({
        ...s,
        error: "Geolocation not supported",
        loading: false,
      }));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setState((s) => ({ ...s, location: loc, error: null, loading: false }));
        syncToBackend(loc.lat, loc.lng, pos.coords.accuracy ?? undefined);
      },
      (err) => {
        // default Shanghai
        const fallback: LatLng = { lat: 31.2304, lng: 121.4737 };
        setState((s) => ({
          ...s,
          location: fallback,
          error: err.message,
          loading: false,
        }));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [syncToBackend]);

  return state;
}
