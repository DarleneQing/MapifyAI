/**
 * Health check.
 */
import { BACKEND_BASE } from "./config";

export async function healthCheck(): Promise<unknown> {
  const url = BACKEND_BASE ? `${BACKEND_BASE}/health` : "/health";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /health failed: ${res.status}`);
  return res.json();
}
