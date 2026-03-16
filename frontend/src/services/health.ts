/**
 * Health check.
 */

export async function healthCheck(): Promise<unknown> {
  const res = await fetch("/health");
  if (!res.ok) throw new Error(`GET /health failed: ${res.status}`);
  return res.json();
}
