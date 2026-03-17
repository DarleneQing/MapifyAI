/**
 * Providers API.
 */
import type { Provider } from "@/types";
import { API_BASE } from "./config";

export async function listProviders(options?: {
  category?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
}): Promise<Provider[]> {
  const params = new URLSearchParams();
  if (options?.category) params.set("category", options.category);
  if (options?.lat != null) params.set("lat", String(options.lat));
  if (options?.lng != null) params.set("lng", String(options.lng));
  if (options?.radius_km != null) params.set("radius_km", String(options.radius_km));

  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/providers/${qs}`);
  if (!res.ok) throw new Error(`GET /providers failed: ${res.status}`);
  return res.json();
}

export async function getProvider(providerId: string): Promise<Provider> {
  const res = await fetch(`${API_BASE}/providers/${providerId}`);
  if (!res.ok) throw new Error(`GET /providers/${providerId} failed: ${res.status}`);
  return res.json();
}
