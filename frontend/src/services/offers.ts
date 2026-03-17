/**
 * Offers API — contract §6.
 */
import type { SubmitOfferBody, OffersResponse, OfferSseEvent } from "@/types";
import { API_BASE } from "./config";

export async function getOffers(
  requestId: string
): Promise<OffersResponse> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/offers`);
  if (!res.ok) throw new Error(`GET /requests/${requestId}/offers failed: ${res.status}`);
  return res.json();
}

export async function submitOffer(payload: SubmitOfferBody) {
  const res = await fetch(`${API_BASE}/offers/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST /offers failed: ${res.status}`);
  return res.json();
}

export async function updateOffer(
  offerId: string,
  payload: Record<string, unknown>
) {
  const res = await fetch(`${API_BASE}/offers/${offerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PATCH /offers/${offerId} failed: ${res.status}`);
  return res.json();
}

export function subscribeOffersStream(
  requestId: string,
  onEvent: (event: OfferSseEvent) => void,
  onError?: (err: Event) => void
): EventSource {
  const es = new EventSource(`${API_BASE}/requests/${requestId}/offers/stream`);

  (["offer_created", "offer_updated"] as const).forEach((type) => {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as OfferSseEvent;
        onEvent(data);
      } catch {
        console.warn(`Failed to parse SSE event: ${type}`, e.data);
      }
    });
  });

  if (onError) es.onerror = onError;

  return es;
}
