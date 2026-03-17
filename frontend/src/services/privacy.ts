/**
 * Privacy meta API — contract §8.
 */
import type { PrivacyMeta } from "@/types";
import { API_BASE } from "./config";

const FALLBACK_PRIVACY_META: PrivacyMeta = {
  permissions: [
    {
      name: "Location",
      description: "Used to rank nearby providers and compute travel distance.",
      required: true,
    },
  ],
  data_collected: ["Approximate device location", "Search queries", "Preference weights"],
  data_not_collected: ["Payment card numbers", "Precise background tracking history"],
};

export async function getPrivacyMeta(): Promise<PrivacyMeta> {
  try {
    const res = await fetch(`${API_BASE}/meta/privacy`);
    if (!res.ok) return FALLBACK_PRIVACY_META;
    return res.json();
  } catch {
    return FALLBACK_PRIVACY_META;
  }
}
