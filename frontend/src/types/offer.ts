/**
 * Offer types — contract §6.
 */
export interface OfferSlot {
  from: string;
  to: string;
}

export interface Offer {
  id: string;
  request_id: string;
  provider_id: string;
  price: number;
  currency: string;
  eta_minutes: number;
  slot: OfferSlot;
  status: string;
}

export interface OffersResponse {
  request_id: string;
  offers: Offer[];
}

export type OfferSseEvent =
  | { type: "offer_created"; offer: Offer }
  | { type: "offer_updated"; offer: Offer };
