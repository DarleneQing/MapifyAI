/**
 * Shared backend configuration for all frontend API calls.
 *
 * In development:
 * - VITE_BACKEND_URL is typically unset.
 * - We fall back to "" so relative paths like "/api" and "/health"
 *   are proxied by Vite dev server (see vite.config.ts).
 *
 * In production on Vercel:
 * - Set VITE_BACKEND_URL to your Railway backend base URL, e.g.
 *   https://your-backend.up.railway.app
 * - All API calls will go directly to that URL.
 */

const RAW_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

// Normalize: strip trailing slashes so we can safely append paths.
const NORMALIZED_BACKEND_URL = RAW_BACKEND_URL.replace(/\/+$/, "");

export const BACKEND_BASE = NORMALIZED_BACKEND_URL;

// If the user configured VITE_BACKEND_URL with a trailing "/api", avoid "/api/api".
export const API_BASE = NORMALIZED_BACKEND_URL
  ? NORMALIZED_BACKEND_URL.endsWith("/api")
    ? NORMALIZED_BACKEND_URL
    : `${NORMALIZED_BACKEND_URL}/api`
  : "/api";

