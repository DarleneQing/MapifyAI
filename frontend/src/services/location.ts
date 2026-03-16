/**
 * Device location API — contract §9.
 */

const BASE = "/api";

export interface DeviceLocationPayload {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  timestamp?: string | null;
}

export interface DeviceLocation {
  device_id: string;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  updated_at: string;
}

export async function putDeviceLocation(
  deviceId: string,
  payload: DeviceLocationPayload
): Promise<DeviceLocation> {
  const res = await fetch(
    `${BASE}/location/current?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`PUT /location/current failed: ${res.status}`);
  return res.json();
}

export async function getDeviceLocation(
  deviceId: string
): Promise<DeviceLocation> {
  const res = await fetch(
    `${BASE}/location/current?device_id=${encodeURIComponent(deviceId)}`
  );
  if (!res.ok) throw new Error(`GET /location/current failed: ${res.status}`);
  return res.json();
}
