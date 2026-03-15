# Frontend Restructure Plan — Approach B (Domain Layers + Feature Grouping)

**Created:** 2025-03-15  
**Approach:** Hybrid — split types and API by domain; group components by feature; keep hooks/contexts at top level.  
**Contract:** All changes preserve compatibility with `doc/controller-frontend-contract.md`; types and API signatures remain the single source of truth.

---

## 1. Types — Domain Split and Barrel

**Goal:** Split `src/types/index.ts` into domain files. Keep `src/types/index.ts` as a barrel that re-exports all types so existing `from "@/types"` imports continue to work. Dependency order for domain files: `common` → `place` → `request` (request imports place) → `profile` → `offer` → `provider` → `trace` → `privacy`.

**New files and contents:**

| File | Exported types |
|------|----------------|
| `src/types/common.ts` | `LatLng`, `UserPreferences`, `ValidationErrorItem`, `HTTPValidationError` |
| `src/types/place.ts` | `TransportType`, `TransitConnection`, `TransitInfo`, `FlashDeal`, `PlaceSummary`, `OpeningHoursToday`, `PlaceBasic`, `ReviewSummary`, `RatingDistribution`, `QuestionAndAnswer`, `CustomerUpdate`, `PlaceDetail`, `PlaceDetailResponse`, `PlaceReview`, `PlaceReviewsPage` |
| `src/types/request.ts` | `CreateRequestPayload`, `SubmitOfferBody`, `StructuredRequest`, `RequestWithResults`, `ReviewFetchedItem`, `RequestSseEvent`. Imports: `LatLng`, `UserPreferences` from `./common`; `PlaceSummary` from `./place`. |
| `src/types/profile.ts` | `UserProfileWeights`, `UserProfile`, `ColdStartSurveyPayload`, `ProfileResponse` |
| `src/types/offer.ts` | `OfferSlot`, `Offer`, `OffersResponse`, `OfferSseEvent` |
| `src/types/provider.ts` | `Provider`. Imports: `LatLng` from `./common`. |
| `src/types/trace.ts` | `TraceGraphNode`, `TraceGraphEdge`, `TraceStepView`, `TraceResponse` |
| `src/types/privacy.ts` | `PrivacyPermission`, `PrivacyMeta` |

**Barrel:** `src/types/index.ts` — replace current content with re-exports only:  
`export * from "./common"; export * from "./place"; export * from "./request"; export * from "./profile"; export * from "./offer"; export * from "./provider"; export * from "./trace"; export * from "./privacy";`  
Plus the file header comment: "TypeScript 类型契约 — 严格对齐 controller-frontend-contract 文档. 更新时请同步 controller-frontend-contract.md 第 10 节."

**Verification:** No changes to any consuming file imports; all currently use `from "@/types"` or `from "@/types"` with named types; barrel preserves that.

---

## 2. Services — Domain Split and Barrel

**Goal:** Split `src/services/api.ts` into domain modules. Keep `src/services/api.ts` as a single file that re-exports every public function and type from the new modules so existing `from "@/services/api"` imports continue to work.

**New files and their exports:**

| File | Exports | Notes |
|------|---------|--------|
| `src/services/requests.ts` | `createSearchRequest`, `getRequest`, `subscribeRequestStream` | Import types from `@/types`. |
| `src/services/places.ts` | `getPlaceDetail`, `getPlaceReviews` | Import types from `@/types`. |
| `src/services/providers.ts` | `listProviders`, `getProvider` | Import types from `@/types`. |
| `src/services/offers.ts` | `getOffers`, `submitOffer`, `updateOffer`, `subscribeOffersStream` | Import types from `@/types`. |
| `src/services/profile.ts` | `mapPreferencesToProfileResponse`, `submitColdStartSurvey`, `getProfile`, `updateProfile`, `updatePreferences` | Internal helper `mapPreferencesToProfileResponse` stays in this file. Import types from `@/types`. |
| `src/services/location.ts` | `DeviceLocationPayload`, `DeviceLocation`, `putDeviceLocation`, `getDeviceLocation` | Interfaces `DeviceLocationPayload` and `DeviceLocation` stay in this file (not in types per contract). |
| `src/services/traces.ts` | `getTrace` | Internal helper `mapAgentTraceToTraceResponse` stays in this file. Import `TraceResponse` from `@/types`. |
| `src/services/privacy.ts` | `getPrivacyMeta` | `FALLBACK_PRIVACY_META` constant stays in this file. Import `PrivacyMeta` from `@/types`. |
| `src/services/health.ts` | `healthCheck` | No types. |

**Barrel:** `src/services/api.ts` — replace implementation with: (1) optional short comment referencing contract; (2) re-exports:  
`export * from "./requests"; export * from "./places"; export * from "./providers"; export * from "./offers"; export * from "./profile"; export * from "./location"; export * from "./traces"; export * from "./privacy"; export * from "./health";`

**Verification:** All current imports are `from "@/services/api"` (see: useDeviceLocation, PlaceDetail, useSearchStream, Profile, DebugTracePanel, Privacy, ReviewsList). No import path changes required.

---

## 3. Components — Feature Folders and Moves

**Goal:** Group app components (excluding `components/ui/`) into feature subfolders. Move files physically; then update every import that references a moved component. Do not add a barrel for components; use direct paths (e.g. `@/components/place/PlaceCard`).

**Folder and file mapping:**

| Target folder | Components to move (from `src/components/`) |
|---------------|---------------------------------------------|
| `src/components/place/` | PlaceCard.tsx, RatingDistributionChart.tsx, PopularTimesChart.tsx, ReviewsList.tsx, FlashDealBanner.tsx, QueueIndicator.tsx, BidDrawer.tsx, QueueDrawer.tsx |
| `src/components/chat/` | ChatDrawer.tsx, AgentPipeline.tsx, AIChatOverlay.tsx |
| `src/components/explore/` | MapBackground.tsx, MapPins.tsx, SearchBar.tsx, VibeFilter.tsx |
| `src/components/layout/` | BottomTabBar.tsx, AppSidebar.tsx, NavLink.tsx, BottomSheet.tsx, NotificationCenter.tsx |
| `src/components/onboarding/` | OnboardingSurvey.tsx |
| `src/components/merchant/` | MerchantOnboarding.tsx |
| `src/components/debug/` | DebugTracePanel.tsx, DebugTraceWrapper.tsx |

**Cross-component imports within moved files:**  
After moves, update internal imports in moved components that reference another moved component:

- `PlaceCard.tsx` imports FlashDealBanner, BidDrawer, ChatDrawer, VibeFilter → change to `@/components/place/FlashDealBanner`, `@/components/place/BidDrawer`, `@/components/place/ChatDrawer`, `@/components/explore/VibeFilter`.
- No other moved component imports another moved component except PlaceCard (above). All others import only `@/components/ui/*` or hooks/contexts/types/services.

**Consuming files and new import paths:**

| Consuming file | Current import(s) | New import path(s) |
|----------------|--------------------|--------------------|
| App.tsx | AIChatOverlay, DebugTraceWrapper | @/components/chat/AIChatOverlay, @/components/debug/DebugTraceWrapper |
| pages/Index.tsx | BottomTabBar, ChatDrawer, QueueDrawer, QueueIndicator, VibeFilter, NotificationCenter | @/components/layout/BottomTabBar, @/components/chat/ChatDrawer, @/components/place/QueueDrawer, @/components/place/QueueIndicator, @/components/explore/VibeFilter, @/components/layout/NotificationCenter |
| pages/Chat.tsx | BottomTabBar, AgentPipeline | @/components/layout/BottomTabBar, @/components/chat/AgentPipeline |
| pages/Recommendations.tsx | PlaceCard, AgentPipeline, BottomTabBar, VibeFilter | @/components/place/PlaceCard, @/components/chat/AgentPipeline, @/components/layout/BottomTabBar, @/components/explore/VibeFilter |
| pages/PlaceDetail.tsx | BidDrawer, ChatDrawer, FlashDealBanner, QueueIndicator, QueueDrawer, RatingDistributionChart, ReviewsList, PopularTimesChart | All from @/components/place/* (BidDrawer, ChatDrawer, FlashDealBanner, QueueIndicator, QueueDrawer, RatingDistributionChart, ReviewsList, PopularTimesChart) |
| pages/Explore.tsx | BottomTabBar, ChatDrawer, FlashDealBanner, QueueIndicator, QueueDrawer, VibeFilter, NotificationCenter | @/components/layout/BottomTabBar, @/components/chat/ChatDrawer, @/components/place/FlashDealBanner, @/components/place/QueueIndicator, @/components/place/QueueDrawer, @/components/explore/VibeFilter, @/components/layout/NotificationCenter |
| pages/Saved.tsx | BottomTabBar, ChatDrawer, FlashDealBanner, QueueIndicator, QueueDrawer, VibeFilter (PLACE_VIBES) | @/components/layout/BottomTabBar, @/components/chat/ChatDrawer, @/components/place/FlashDealBanner, @/components/place/QueueIndicator, @/components/place/QueueDrawer, @/components/explore/VibeFilter |
| pages/Profile.tsx | BottomTabBar, OnboardingSurvey, MerchantOnboarding | @/components/layout/BottomTabBar, @/components/onboarding/OnboardingSurvey, @/components/merchant/MerchantOnboarding |
| pages/Login.tsx | OnboardingSurvey | @/components/onboarding/OnboardingSurvey |
| pages/MerchantDashboard.tsx | MerchantOnboarding | @/components/merchant/MerchantOnboarding |
| pages/MerchantSettings.tsx | MerchantOnboarding (type MerchantPreferences) | @/components/merchant/MerchantOnboarding |
| pages/MapExplorer.tsx | BottomTabBar | @/components/layout/BottomTabBar |
| components/place/PlaceCard.tsx (after move) | FlashDealBanner, BidDrawer, ChatDrawer, VibeFilter | @/components/place/FlashDealBanner, @/components/place/BidDrawer, @/components/place/ChatDrawer, @/components/explore/VibeFilter |

**UI and hooks:**  
- All `src/components/ui/*` remain unchanged (path `@/components/ui/...`).  
- `components/ui/use-toast.ts` re-exports from `@/hooks/use-toast` — unchanged.  
- Hooks that import from components: `usePreferences` and `useSearchStream` import type `UserPreferences` from `@/components/OnboardingSurvey` → change to `@/components/onboarding/OnboardingSurvey`.  
- `lib/preferenceScoring.ts` imports `UserPreferences` from `@/components/OnboardingSurvey` → change to `@/components/onboarding/OnboardingSurvey`.  
- `components/ui/sidebar.tsx` imports `useIsMobile` from `@/hooks/use-mobile` — unchanged.

---

## 4. README Files for Discoverability

**Goal:** Add one short README per new feature folder and for `types/` and `services/` so new contributors know where to add code and how it aligns with the contract.

**Files to create:**

| File | Content (summary) |
|------|-------------------|
| `src/types/README.md` | State that types are the frontend contract; align with doc/controller-frontend-contract.md §10. List domain files: common, place, request, profile, offer, provider, trace, privacy. New shared types: add to the appropriate domain file and re-export from types/index.ts. |
| `src/services/README.md` | State that services call the backend API; align with controller-frontend-contract. List domain modules: requests, places, providers, offers, profile, location, traces, privacy, health. New API calls: add to the right module and export from api.ts. |
| `src/components/place/README.md` | Place feature: place cards, detail blocks (reviews, charts, flash deals, queue), bid/queue drawers. Used by: Index, Explore, Recommendations, PlaceDetail, Saved. |
| `src/components/chat/README.md` | Chat feature: AI chat drawer, pipeline visualization, global chat FAB. Used by: Chat, Recommendations, App. |
| `src/components/explore/README.md` | Explore feature: map, pins, search bar, vibe filters. Used by: Index, Explore, MapExplorer. |
| `src/components/layout/README.md` | Layout: bottom tab bar, sidebar, nav link, bottom sheet, notification center. Used by: all pages. |
| `src/components/onboarding/README.md` | Onboarding: taste survey. Used by: Login, Profile. |
| `src/components/merchant/README.md` | Merchant: merchant onboarding and settings UI. Used by: Profile, MerchantDashboard, MerchantSettings. |
| `src/components/debug/README.md` | Debug: trace panel and wrapper. Used by: App (conditional). |

---

## 5. Documentation Update

**Goal:** Update `doc/frontend-architecture.md` so the documented structure matches the new layout.

**Changes in frontend-architecture.md:**

- **§2 Directory Structure:** Replace the `frontend/src/` tree with the new structure: `types/` (common.ts, place.ts, request.ts, profile.ts, offer.ts, provider.ts, trace.ts, privacy.ts, index.ts), `services/` (requests.ts, places.ts, providers.ts, offers.ts, profile.ts, location.ts, traces.ts, privacy.ts, health.ts, api.ts), `components/` (ui/, place/, chat/, explore/, layout/, onboarding/, merchant/, debug/). Keep pages/, contexts/, hooks/, lib/, i18n/ as-is.
- **§6 Components Architecture:** Update paths in examples and lists: e.g. PlaceCard → components/place/PlaceCard, AgentPipeline → components/chat/AgentPipeline, BottomTabBar → components/layout/BottomTabBar. Mention that feature folders have a README describing scope.
- **§8 API Service Layer:** State that API is split by domain under `services/` and re-exported from `services/api.ts`; list the domain modules.
- **§10 TypeScript Types:** State that types are split by domain under `types/` and re-exported from `types/index.ts`; list the domain files.
- **Quick Reference table (Key Files):** Update paths for components (e.g. PlaceCard → src/components/place/PlaceCard.tsx). Keep API and types as src/services/api.ts and src/types/index.ts.

---

## 6. Error Handling and Testing

- **Build:** After all steps, run `npm run build` in `frontend/` and fix any broken imports or type errors.
- **Lint:** Run `npm run lint` in `frontend/` and fix any new issues.
- **Contract:** No changes to request/response shapes or endpoint behavior; only file organization. Manual smoke test: run app, open home, search, place detail, profile, and merchant screen to confirm no runtime import errors.

---

## IMPLEMENTATION CHECKLIST

1. Create `src/types/common.ts` and move `LatLng`, `UserPreferences`, `ValidationErrorItem`, `HTTPValidationError` from `src/types/index.ts` into it (with header comment).
2. Create `src/types/place.ts` and move `TransportType`, `TransitConnection`, `TransitInfo`, `FlashDeal`, `PlaceSummary`, `OpeningHoursToday`, `PlaceBasic`, `ReviewSummary`, `RatingDistribution`, `QuestionAndAnswer`, `CustomerUpdate`, `PlaceDetail`, `PlaceDetailResponse`, `PlaceReview`, `PlaceReviewsPage` from `src/types/index.ts` into it; add import of `LatLng` from `./common` only if needed (PlaceBasic uses LatLng).
3. Create `src/types/request.ts` and move `CreateRequestPayload`, `SubmitOfferBody`, `StructuredRequest`, `RequestWithResults`, `ReviewFetchedItem`, `RequestSseEvent` from `src/types/index.ts` into it; add imports from `./common` and `./place` as needed.
4. Create `src/types/profile.ts` and move `UserProfileWeights`, `UserProfile`, `ColdStartSurveyPayload`, `ProfileResponse` from `src/types/index.ts` into it.
5. Create `src/types/offer.ts` and move `OfferSlot`, `Offer`, `OffersResponse`, `OfferSseEvent` from `src/types/index.ts` into it.
6. Create `src/types/provider.ts` and move `Provider` from `src/types/index.ts` into it; add import of `LatLng` from `./common`.
7. Create `src/types/trace.ts` and move `TraceGraphNode`, `TraceGraphEdge`, `TraceStepView`, `TraceResponse` from `src/types/index.ts` into it.
8. Create `src/types/privacy.ts` and move `PrivacyPermission`, `PrivacyMeta` from `src/types/index.ts` into it.
9. Replace `src/types/index.ts` with barrel: header comment plus `export * from "./common"; export * from "./place"; export * from "./request"; export * from "./profile"; export * from "./offer"; export * from "./provider"; export * from "./trace"; export * from "./privacy";`.
10. Run TypeScript build or typecheck; fix any type reference issues in new type files (e.g. PlaceSummary referencing FlashDeal is in same file).
11. Create `src/services/requests.ts`: move `createSearchRequest`, `getRequest`, `subscribeRequestStream` from api.ts; import types from `@/types`.
12. Create `src/services/places.ts`: move `getPlaceDetail`, `getPlaceReviews` from api.ts; import types from `@/types`.
13. Create `src/services/providers.ts`: move `listProviders`, `getProvider` from api.ts; import types from `@/types`.
14. Create `src/services/offers.ts`: move `getOffers`, `submitOffer`, `updateOffer`, `subscribeOffersStream` from api.ts; import types from `@/types`.
15. Create `src/services/profile.ts`: move `mapPreferencesToProfileResponse`, `submitColdStartSurvey`, `getProfile`, `updateProfile`, `updatePreferences` from api.ts; import types from `@/types`.
16. Create `src/services/location.ts`: move `DeviceLocationPayload`, `DeviceLocation`, `putDeviceLocation`, `getDeviceLocation` from api.ts.
17. Create `src/services/traces.ts`: move `mapAgentTraceToTraceResponse`, `getTrace` from api.ts; import types from `@/types`.
18. Create `src/services/privacy.ts`: move `FALLBACK_PRIVACY_META`, `getPrivacyMeta` from api.ts; import types from `@/types`.
19. Create `src/services/health.ts`: move `healthCheck` from api.ts.
20. Replace `src/services/api.ts` with barrel: short contract comment plus re-exports from requests, places, providers, offers, profile, location, traces, privacy, health.
21. Run build again; fix any service import/type errors.
22. Create directory `src/components/place/` and move PlaceCard.tsx, RatingDistributionChart.tsx, PopularTimesChart.tsx, ReviewsList.tsx, FlashDealBanner.tsx, QueueIndicator.tsx, BidDrawer.tsx, QueueDrawer.tsx from `src/components/` into it.
23. Create directory `src/components/chat/` and move ChatDrawer.tsx, AgentPipeline.tsx, AIChatOverlay.tsx from `src/components/` into it.
24. Create directory `src/components/explore/` and move MapBackground.tsx, MapPins.tsx, SearchBar.tsx, VibeFilter.tsx from `src/components/` into it.
25. Create directory `src/components/layout/` and move BottomTabBar.tsx, AppSidebar.tsx, NavLink.tsx, BottomSheet.tsx, NotificationCenter.tsx from `src/components/` into it.
26. Create directory `src/components/onboarding/` and move OnboardingSurvey.tsx from `src/components/` into it.
27. Create directory `src/components/merchant/` and move MerchantOnboarding.tsx from `src/components/` into it.
28. Create directory `src/components/debug/` and move DebugTracePanel.tsx, DebugTraceWrapper.tsx from `src/components/` into it.
29. In `src/components/place/PlaceCard.tsx`, update imports: FlashDealBanner, BidDrawer, ChatDrawer to `@/components/place/...`; VibeFilter to `@/components/explore/VibeFilter`.
30. Update `src/App.tsx`: AIChatOverlay → `@/components/chat/AIChatOverlay`, DebugTraceWrapper → `@/components/debug/DebugTraceWrapper`.
31. Update `src/pages/Index.tsx`: BottomTabBar → layout, ChatDrawer → chat, QueueDrawer/QueueIndicator → place, VibeFilter → explore, NotificationCenter → layout.
32. Update `src/pages/Chat.tsx`: BottomTabBar → layout, AgentPipeline → chat.
33. Update `src/pages/Recommendations.tsx`: PlaceCard → place, AgentPipeline → chat, BottomTabBar → layout, VibeFilter → explore.
34. Update `src/pages/PlaceDetail.tsx`: all component imports to @/components/place/* (BidDrawer, ChatDrawer, FlashDealBanner, QueueIndicator, QueueDrawer, RatingDistributionChart, ReviewsList, PopularTimesChart).
35. Update `src/pages/Explore.tsx`: BottomTabBar, NotificationCenter → layout; ChatDrawer → chat; FlashDealBanner, QueueIndicator, QueueDrawer → place; VibeFilter → explore.
36. Update `src/pages/Saved.tsx`: BottomTabBar → layout; ChatDrawer → chat; FlashDealBanner, QueueIndicator, QueueDrawer → place; VibeFilter → explore.
37. Update `src/pages/Profile.tsx`: BottomTabBar → layout; OnboardingSurvey → onboarding; MerchantOnboarding → merchant.
38. Update `src/pages/Login.tsx`: OnboardingSurvey → onboarding.
39. Update `src/pages/MerchantDashboard.tsx`: MerchantOnboarding → merchant.
40. Update `src/pages/MerchantSettings.tsx`: MerchantOnboarding → merchant.
41. Update `src/pages/MapExplorer.tsx`: BottomTabBar → layout.
42. Update `src/hooks/usePreferences.ts`: UserPreferences type import from `@/components/onboarding/OnboardingSurvey`.
43. Update `src/hooks/useSearchStream.ts`: UserPreferences type import from `@/components/onboarding/OnboardingSurvey`.
44. Update `src/lib/preferenceScoring.ts`: UserPreferences type import from `@/components/onboarding/OnboardingSurvey`.
45. Update any remaining internal imports in moved components that reference another moved component (e.g. DebugTraceWrapper importing DebugTracePanel → @/components/debug/DebugTracePanel).
46. Add `src/types/README.md` with content per §4.
47. Add `src/services/README.md` with content per §4.
48. Add `src/components/place/README.md`, `src/components/chat/README.md`, `src/components/explore/README.md`, `src/components/layout/README.md`, `src/components/onboarding/README.md`, `src/components/merchant/README.md`, `src/components/debug/README.md` with content per §4.
49. Update `doc/frontend-architecture.md` §2 Directory Structure, §6 Components Architecture, §8 API Service Layer, §10 TypeScript Types, and Quick Reference table per §5.
50. Run `npm run build` and `npm run lint` in frontend; fix any errors.
51. Smoke-test: run dev server, open home, search, place detail, profile, merchant screen; confirm no runtime errors.

---

# Task Progress

[2025-03-15]
- Modified: src/types/*.ts (common, place, request, profile, offer, provider, trace, privacy, index barrel), src/services/*.ts (requests, places, providers, offers, profile, location, traces, privacy, health, api barrel), src/components/ (created place/, chat/, explore/, layout/, onboarding/, merchant/, debug/ and moved 24 components), App.tsx, all pages, hooks/usePreferences.ts, useSearchStream.ts, lib/preferenceScoring.ts, components/place/PlaceCard.tsx; added READMEs in types/, services/, and each component feature folder; doc/frontend-architecture.md §2, §6, §8, §10, Quick Reference.
- Changes: Domain split for types and services with barrels; feature-based component folders with moved files and updated imports; READMEs for discoverability; architecture doc updated.
- Reason: Approach B restructure per approved plan.
- Blockers: None. Lint reports pre-existing issues (deps, ui, Index.tsx, etc.); not introduced by this restructure.
- Status: UNCONFIRMED
