# Services

API client layer aligned with **doc/controller-frontend-contract.md**.

- **requests.ts** — Search requests, stream (contract §2)
- **places.ts** — Place detail, reviews (contract §4)
- **providers.ts** — List/get providers
- **offers.ts** — Offers, offer stream (contract §6)
- **profile.ts** — Profile, cold-start, preferences (contract §5)
- **location.ts** — Device location (contract §9)
- **traces.ts** — Debug trace (contract §7)
- **privacy.ts** — Privacy meta (contract §8)
- **health.ts** — Health check

All functions are re-exported from **api.ts**. New API calls: add to the appropriate module and export from api.ts.
