# Types

TypeScript type definitions aligned with **doc/controller-frontend-contract.md §10**.

- **common.ts** — LatLng, UserPreferences, validation errors
- **place.ts** — Place summary/detail, reviews, transit, flash deals
- **request.ts** — Search request payloads, SSE events
- **profile.ts** — User profile, cold-start survey
- **offer.ts** — Offers (bidding)
- **provider.ts** — Providers
- **trace.ts** — Debug trace
- **privacy.ts** — Privacy meta

All types are re-exported from **index.ts**. When adding or changing types, keep the contract in sync with controller-frontend-contract.md §10.
