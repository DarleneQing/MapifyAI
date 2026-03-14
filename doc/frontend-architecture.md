# TourAgent Frontend Architecture

> Comprehensive knowledge base for debugging, modification, and development.

## Table of Contents

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Directory Structure](#2-directory-structure)
3. [Entry Points & Provider Hierarchy](#3-entry-points--provider-hierarchy)
4. [Routing System](#4-routing-system)
5. [Pages & Views](#5-pages--views)
6. [Components Architecture](#6-components-architecture)
7. [Custom Hooks](#7-custom-hooks)
8. [API Service Layer](#8-api-service-layer)
9. [State Management](#9-state-management)
10. [TypeScript Types](#10-typescript-types)
11. [Styling System](#11-styling-system)
12. [Configuration Files](#12-configuration-files)
13. [Data Flow Patterns](#13-data-flow-patterns)
14. [Debugging Guide](#14-debugging-guide)
15. [Common Modification Patterns](#15-common-modification-patterns)

---

## 1. Tech Stack Overview

| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | React | 18.3.x |
| **Build Tool** | Vite | 5.4.x |
| **Language** | TypeScript | 5.8.x |
| **Routing** | React Router DOM | 6.30.x |
| **Server State** | TanStack React Query | 5.83.x |
| **Styling** | Tailwind CSS | 3.4.x |
| **UI Components** | shadcn/ui + Radix UI | Latest |
| **Forms** | React Hook Form + Zod | 7.61.x / 3.25.x |
| **Animation** | Framer Motion | 12.35.x |
| **Maps** | Leaflet | 1.9.x |
| **Charts** | Recharts | 2.15.x |
| **Icons** | Lucide React | 0.462.x |
| **Toasts** | Sonner | 1.7.x |
| **Drawers** | Vaul | 0.9.x |

---

## 2. Directory Structure

```
frontend/
├── public/                      # Static assets
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── components/              # UI Components
│   │   ├── ui/                  # shadcn/ui primitives (40+ components)
│   │   ├── BottomTabBar.tsx     # Fixed mobile navigation
│   │   ├── PlaceCard.tsx        # Place list item
│   │   ├── MapBackground.tsx    # Leaflet map wrapper
│   │   ├── AgentPipeline.tsx    # AI pipeline visualization
│   │   ├── OnboardingSurvey.tsx # Taste profile wizard
│   │   ├── ChatDrawer.tsx       # AI chat bottom sheet
│   │   └── ...
│   ├── contexts/                # React Context providers
│   │   ├── AuthContext.tsx      # Mock authentication
│   │   ├── ChatContext.tsx      # Chat messages & search results persistence
│   │   └── SavedPlacesContext.tsx
│   ├── hooks/                   # Custom React hooks
│   │   ├── useSearchStream.ts   # SSE streaming search
│   │   ├── useDeviceLocation.ts # Geolocation
│   │   ├── usePreferences.ts    # localStorage preferences
│   │   └── ...
│   ├── i18n/                    # Internationalization
│   │   ├── LanguageContext.tsx  # Language provider
│   │   ├── en.ts                # English translations
│   │   └── zh.ts                # Chinese translations
│   ├── lib/                     # Utility functions
│   │   ├── utils.ts             # cn() class merging
│   │   └── preferenceScoring.ts # Preference-based sorting
│   ├── pages/                   # Route page components
│   │   ├── Index.tsx            # Home with map & search
│   │   ├── Explore.tsx          # Browse all places
│   │   ├── Chat.tsx             # AI chat interface
│   │   ├── Recommendations.tsx  # Streaming AI results
│   │   ├── PlaceDetail.tsx      # Place detail page
│   │   ├── Profile.tsx          # User settings
│   │   └── ...
│   ├── services/                # API layer
│   │   └── api.ts               # All API calls
│   ├── test/                    # Test setup
│   └── types/                   # TypeScript definitions
│       └── index.ts             # All type interfaces
├── index.html                   # HTML entry
├── package.json                 # Dependencies
├── vite.config.ts               # Vite configuration
├── tailwind.config.ts           # Tailwind CSS config
└── tsconfig.json                # TypeScript config
```

---

## 3. Entry Points & Provider Hierarchy

### Entry Flow

```
index.html → src/main.tsx → src/App.tsx
```

### Provider Nesting (outer → inner)

```tsx
<QueryClientProvider>           // TanStack Query
  <LanguageProvider>            // i18n context
    <AuthProvider>              // Authentication
      <SavedPlacesProvider>     // Bookmarks
        <ChatProvider>          // Chat messages & search results persistence
          <TooltipProvider>     // Radix tooltips
            <Toaster />         // shadcn toast
            <Sonner />          // Sonner toast
            <BrowserRouter>     // React Router
              <Routes />
              <AIChatOverlay /> // Global chat FAB (context-aware navigation)
              <DebugTraceWrapper /> // Debug panel
            </BrowserRouter>
          </TooltipProvider>
        </ChatProvider>
      </SavedPlacesProvider>
    </AuthProvider>
  </LanguageProvider>
</QueryClientProvider>
```

### Key File: `src/App.tsx`

```tsx
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <SavedPlacesProvider>
          <ChatProvider>
            <TooltipProvider>
              {/* Toasts */}
              <BrowserRouter>
                <Routes>
                  {/* All routes */}
                </Routes>
                <AIChatOverlay />
                <DebugTraceWrapper />
              </BrowserRouter>
            </TooltipProvider>
          </ChatProvider>
        </SavedPlacesProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);
```

---

## 4. Routing System

### Route Configuration

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Index` | Home page with map, search, categories |
| `/login` | `Login` | Authentication (personal/merchant) |
| `/merchant` | `MerchantDashboard` | Merchant analytics portal |
| `/merchant/settings` | `MerchantSettings` | Merchant configuration |
| `/explore` | `Explore` | Browse all places with filters |
| `/chat` | `Chat` | AI conversational interface |
| `/recommendations` | `Recommendations` | AI-powered results with streaming |
| `/map` | `MapExplorer` | Full-screen map view |
| `/place/:id` | `PlaceDetail` | Individual place page |
| `/saved` | `Saved` | Bookmarked places |
| `/profile` | `Profile` | User profile & preference sliders |
| `/privacy` | `Privacy` | Privacy policy |
| `*` | `NotFound` | 404 fallback |

### Navigation Patterns

- **Mobile**: `<BottomTabBar />` - Fixed bottom navigation with icons
- **Programmatic**: `useNavigate()` from react-router-dom
- **Links**: `<Link to="/path" />` component

---

## 5. Pages & Views

### Core Pages

#### `Index.tsx` - Home Page
- Map background with Leaflet
- Search bar with voice input → navigates to `/chat?q={query}`
- Category chips (Food, Coffee, Haircut, etc.)
- Vibe filters
- Explore sheet with nearby places (local mock data)
- Notification center

#### `Recommendations.tsx` - AI Results
- Receives results via multiple sources (priority order):
  1. Navigation state (passed from Chat page)
  2. `ChatContext` (persisted across tab navigation)
  3. API call via `useSearchStream` (fallback)
- Pipeline visualization (7 stages)
- Preference-based sorting via `useSearchStream` hook
- Place cards with transit info
- Results persist when switching tabs via `ChatContext`
- Empty state shown when no results available from any source

#### `PlaceDetail.tsx` - Place Page
- Place info header
- Rating distribution chart
- Popular times visualization
- Review summary (pros/cons)
- Q&A section
- Flash deals
- Queue status

#### `Chat.tsx` - AI Chat
- Conversational interface with real backend API calls
- Uses `useSearchStream` hook to call `/api/requests`
- **Uses `ChatContext`** for message persistence across navigation
- Multi-agent pipeline visualization during search
- Displays top 4 results as place cards
- "View All" button navigates to `/recommendations` with results passed via:
  1. React Router navigation state
  2. Persisted in `ChatContext` for tab switching
- Chat history preserved when navigating away and returning

#### `Profile.tsx` - Settings
- Preference weight sliders (price/distance/rating)
- Onboarding survey (taste profile)
- Account settings
- Language toggle

---

## 6. Components Architecture

### Component Categories

#### 1. UI Primitives (`src/components/ui/`)
40+ shadcn/ui components built on Radix UI:
- Button, Card, Dialog, Drawer
- Input, Select, Slider, Switch
- Tabs, Toast, Tooltip
- Accordion, Carousel, Progress
- Form, Label, Checkbox, Radio

#### 2. Layout Components
- `BottomTabBar.tsx` - Mobile bottom navigation
  - **Context-aware "Explore" tab**: If `ChatContext` has search results, navigates to `/recommendations`; otherwise to `/explore`
  - "Explore" tab shows active for both `/explore` and `/recommendations` routes
- `MapBackground.tsx` - Full-screen map container
- `AIChatOverlay.tsx` - Global chat FAB
  - **Context-aware navigation**: When on `/recommendations`, FAB navigates to `/chat` (preserving conversation) instead of opening overlay

#### 3. Data Display Components
- `PlaceCard.tsx` - Place list item with:
  - Transit info (Swiss Transit integration)
  - Flash deals
  - Queue status
  - Recommendation tags
- `AgentPipeline.tsx` - AI agent step visualization
- `ReviewsList.tsx` - Review list with pagination
- `RatingDistributionChart.tsx` - Star rating breakdown
- `PopularTimesChart.tsx` - Hourly popularity

#### 4. Interactive Components
- `SearchBar.tsx` - Search with suggestions
- `OnboardingSurvey.tsx` - Multi-step taste wizard
- `ChatDrawer.tsx` - Bottom sheet chat
- `BidDrawer.tsx` - Offer comparison
- `QueueDrawer.tsx` - Queue management
- `VibeFilter.tsx` - Vibe tag selection

### Component Pattern

```tsx
// Standard component structure
import { cn } from "@/lib/utils";

interface PlaceCardProps {
  place: PlaceSummary;
  onClick?: () => void;
  className?: string;
}

export function PlaceCard({ place, onClick, className }: PlaceCardProps) {
  return (
    <div className={cn("card-base", className)} onClick={onClick}>
      {/* Content */}
    </div>
  );
}
```

---

## 7. Custom Hooks

### `useSearchStream.ts` - Core Search Hook

Manages the AI-powered search. Currently uses JSON mode (SSE reserved for future).

```tsx
const {
  results,        // PlaceSummary[] - search results
  isLoading,      // boolean - initial loading state
  isStreaming,    // boolean - mock streaming simulation active
  requestId,      // string | null - current request ID
  pipelineStage,  // PipelineStage - current AI agent step
  startSearch,    // (query, location, options) => Promise<void>
  reset,          // () => void - clear state
} = useSearchStream(userPreferences);
```

**Pipeline Stages:**
1. `idle` - No search active
2. `intent_parsed` - Query understood
3. `stores_crawled` - Places fetched
4. `transit_computed` - Swiss Transit calculated
5. `reviews_fetched` - Reviews aggregated
6. `scores_computed` - Scores calculated
7. `recommendations_ready` - Results ranked
8. `completed` - Final results

**Behavior:**
- Calls `POST /api/requests/?stream=false` (JSON mode)
- On success: sets results and `pipelineStage` to `completed`
- On failure: falls back to mock data with simulated pipeline stages

### `useDeviceLocation.ts` - Geolocation Hook

```tsx
const {
  location,       // LatLng | null
  accuracy,       // number | null (meters)
  isLoading,      // boolean
  error,          // string | null
  refresh,        // () => void - re-fetch location
} = useDeviceLocation();
```

**Features:**
- Browser Geolocation API
- IP-based fallback
- Syncs to backend `/api/location/current`
- localStorage caching

### `usePreferences.ts` - User Preferences

```tsx
const {
  preferences,    // UserPreferences
  updatePreference, // (key, value) => void
  resetPreferences, // () => void
} = usePreferences();
```

**Stored Preferences:**
- `weight_price` (0-1)
- `weight_distance` (0-1)
- `weight_rating` (0-1)

### `useQueueStatus.ts` - Queue Management

```tsx
const {
  queuePosition,  // number | null
  estimatedWait,  // number | null (minutes)
  joinQueue,      // (placeId) => void
  leaveQueue,     // () => void
} = useQueueStatus();
```

### Other Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useIsMobile` | `use-mobile.tsx` | Responsive breakpoint detection |
| `useToast` | `use-toast.ts` | Toast notification system |
| `useNotifications` | `useNotifications.ts` | Push notification state (mock) |

---

## 8. API Service Layer

### File: `src/services/api.ts`

All API calls are centralized with full alignment to backend contract.

### API Endpoints

#### Requests (Search)
```typescript
// POST /api/requests/?stream={bool}
createSearchRequest(query, location, options) → Response

// GET /api/requests/{request_id}
getRequest(requestId) → RequestWithResults

// GET /api/requests/{request_id}/stream (SSE)
subscribeRequestStream(requestId, onEvent, onError) → EventSource
```

#### Places
```typescript
// GET /api/places/{place_id}?request_id={optional}
getPlaceDetail(placeId, requestId?) → PlaceDetailResponse

// GET /api/places/{place_id}/reviews?page=&page_size=&sort=
getPlaceReviews(placeId, page, pageSize, sort) → PlaceReviewsPage
```

#### Providers
```typescript
// GET /api/providers/?category=&lat=&lng=&radius_km=
listProviders(options?) → Provider[]

// GET /api/providers/{provider_id}
getProvider(providerId) → Provider
```

#### Offers (Bidding)
```typescript
// GET /api/requests/{request_id}/offers
getOffers(requestId) → OffersResponse

// POST /api/offers/
submitOffer(payload) → Response

// PATCH /api/offers/{offer_id}
updateOffer(offerId, payload) → Response

// GET /api/requests/{request_id}/offers/stream (SSE)
subscribeOffersStream(requestId, onEvent, onError) → EventSource
```

#### Profile
```typescript
// POST /api/profile/cold-start-survey
submitColdStartSurvey(payload) → ProfileResponse

// GET /api/profile
getProfile() → ProfileResponse

// PUT /api/profile
updateProfile(payload) → ProfileResponse
```

#### Location
```typescript
// PUT /api/location/current?device_id={id}
putDeviceLocation(deviceId, payload) → DeviceLocation

// GET /api/location/current?device_id={id}
getDeviceLocation(deviceId) → DeviceLocation
```

#### Debug
```typescript
// GET /api/traces/{trace_id}
getTrace(traceId) → TraceResponse
```

### Error Handling Pattern

```typescript
export async function getPlaceDetail(placeId: string): Promise<PlaceDetailResponse> {
  const res = await fetch(`${BASE}/places/${placeId}`);
  if (!res.ok) throw new Error(`GET /places/${placeId} failed: ${res.status}`);
  return res.json();
}
```

---

## 9. State Management

### 1. React Context (Global UI State)

#### `AuthContext.tsx`
```typescript
interface AuthContextValue {
  user: MockUser | null;
  isAuthenticated: boolean;
  isMerchant: boolean;
  login: (email, password, role, extra?) => void;
  logout: () => void;
}

// Usage
const { user, isAuthenticated, login, logout } = useAuth();
```

**User Roles:**
- `personal` - Regular consumer
- `merchant` - Business owner

#### `SavedPlacesContext.tsx`
```typescript
interface SavedPlacesContextValue {
  savedPlaces: PlaceSummary[];
  isSaved: (placeId: string) => boolean;
  toggleSave: (place: PlaceSummary) => void;
}

// Usage
const { savedPlaces, isSaved, toggleSave } = useSavedPlaces();
```

#### `ChatContext.tsx`
Persists chat messages and search results across page navigation. Ensures users don't lose their conversation or AI recommendations when switching tabs.

```typescript
interface ChatContextValue {
  messages: Message[];                    // Chat conversation history
  setMessages: (msgs) => void;
  addMessage: (msg: Message) => void;
  currentQuery: string | null;            // Active search query (cleared after results)
  setCurrentQuery: (q) => void;
  lastSearchQuery: string | null;         // Persisted query (survives after results)
  setLastSearchQuery: (q) => void;
  lastSearchResults: PlaceSummary[];      // Persisted AI results
  setLastSearchResults: (results) => void;
  resetChat: () => void;                  // Clear all state
}

// Usage
const { messages, lastSearchResults, setLastSearchResults } = useChatContext();
```

**Key Features:**
- Messages persist when navigating between Chat ↔ Recommendations ↔ other tabs
- Search results stored in `lastSearchResults` for tab-switching persistence
- `lastSearchQuery` retains the query even after results arrive (unlike `currentQuery`)
- Used by: `Chat.tsx`, `Recommendations.tsx`, `BottomTabBar.tsx`, `AIChatOverlay.tsx`

#### `LanguageContext.tsx`
```typescript
interface LanguageContextValue {
  language: "en" | "zh";
  t: (key: string) => string;
  setLanguage: (lang: "en" | "zh") => void;
}

// Usage
const { t, language, setLanguage } = useLanguage();
```

### 2. TanStack Query (Server State)

```typescript
// Example usage
const { data, isLoading, error } = useQuery({
  queryKey: ['place', placeId],
  queryFn: () => getPlaceDetail(placeId),
});
```

### 3. Local Component State

```typescript
const [results, setResults] = useState<PlaceSummary[]>([]);
const [isStreaming, setIsStreaming] = useState(false);
```

### 4. localStorage Persistence

Keys used:
- `mock_user` - Auth state
- `saved_places` - Bookmarks
- `user_preferences` - Preference weights
- `language` - i18n preference

---

## 10. TypeScript Types

### File: `src/types/index.ts`

### Core Types

```typescript
// Geo
interface LatLng { lat: number; lng: number; }

// User Preferences
interface UserPreferences {
  weight_price: number;    // 0-1, default 0.33
  weight_distance: number; // 0-1, default 0.33
  weight_rating: number;   // 0-1, default 0.34
}

// Place Summary (list/map view)
interface PlaceSummary {
  place_id: string;
  name: string;
  address: string;
  distance_km: number;
  price_level: "low" | "medium" | "high";
  rating: number;
  rating_count: number;
  recommendation_score: number;
  status: "open_now" | "closing_soon" | "closed";
  transit?: TransitInfo | null;
  reason_tags: string[];
  one_sentence_recommendation?: string;
  flash_deal?: FlashDeal | null;
  queue_status?: "low" | "medium" | "busy" | null;
}

// Transit (Swiss Transit integration via transport.opendata.ch)
interface TransitInfo {
  duration_minutes: number;
  transport_types: TransportType[];
  summary?: string;  // "22 min — Tram 4 → Bus 33"
  connections?: TransitConnection[];
}

// Flash Deal
interface FlashDeal {
  title: string;      // "50% Off Latte"
  discount: string;   // "-50%" or "CHF 5 off"
  expires_at: string; // ISO datetime
  remaining?: number;
}

// SSE Events
type RequestSseEvent =
  | { type: "intent_parsed"; request_id: string; intent: Record<string, unknown> }
  | { type: "stores_crawled"; request_id: string; store_count: number; results: PlaceSummary[] }
  | { type: "transit_computed"; request_id: string; results: PlaceSummary[] }
  | { type: "reviews_fetched"; request_id: string; reviews: ReviewFetchedItem[] }
  | { type: "scores_computed"; request_id: string; results: PlaceSummary[] }
  | { type: "recommendations_ready"; request_id: string; results: PlaceSummary[] }
  | { type: "completed"; request_id: string; results: PlaceSummary[] };
```

### Full Type Reference

See `src/types/index.ts` for complete definitions:
- Request/Response types
- Place detail types
- Review types
- User profile types
- Offer types
- Provider types
- Debug/trace types
- Privacy types
- Validation error types

---

## 11. Styling System

### Tailwind CSS Configuration

**File:** `tailwind.config.ts`

Key customizations:
- HSL-based color tokens
- Custom animations
- Dark mode support
- Safe area utilities

### CSS Variables (`src/index.css`)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 330 81% 60%;      /* Pink/magenta accent */
  --secondary: 240 4.8% 95.9%;
  /* ... */
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  /* ... */
}
```

### Utility Classes

```css
/* Glass morphism */
.glass { @apply bg-white/80 backdrop-blur-md; }
.glass-strong { @apply bg-white/95 backdrop-blur-xl; }

/* Safe areas (mobile) */
.safe-top { padding-top: env(safe-area-inset-top); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
```

### Custom Animations

```css
@keyframes pulse-warm { /* Subtle pulsing for CTAs */ }
@keyframes slide-up { /* Bottom sheet entrance */ }
@keyframes fade-in { /* Smooth fade in */ }
@keyframes pin-drop { /* Map pin animation */ }
```

### Class Merging Utility

```typescript
import { cn } from "@/lib/utils";

// Usage
<div className={cn("base-class", conditional && "conditional-class", className)} />
```

---

## 12. Configuration Files

### `vite.config.ts`

```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": { target: backendTarget, changeOrigin: true },
      "/health": { target: backendTarget, changeOrigin: true },
    },
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
```

**Key Points:**
- Dev server runs on port 8080
- Proxies `/api` and `/health` to backend (default `http://127.0.0.1:8000`)
- `VITE_BACKEND_URL` env var overrides backend target
- Path alias `@/` maps to `./src/`

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "jsx": "react-jsx",
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### Environment Variables

```env
VITE_BACKEND_URL=http://127.0.0.1:8000  # Backend API base URL
```

---

## 13. Data Flow Patterns

### Search Flow

```
1. User enters query in Home page (Index.tsx) search input
   ↓
2. handleSearch() navigates to /chat?q={query}
   ↓
3. Chat.tsx reads query from URL params
   ↓
4. useEffect triggers processQuery() which calls startSearch(query, location)
   ↓
5. POST /api/requests/?stream=false
   ↓
6. AgentPipeline component shows progress (simulated stages)
   ↓
7. Backend runs agent pipeline:
   - intent_parser → crawling_search → transit_calculator
   - evaluation_agent + review_agent (parallel)
   - orchestrator_agent → output_ranking
   ↓
8. Response: { request, results }
   ↓
9. Results stored in ChatContext (lastSearchResults, lastSearchQuery)
   ↓
10. Chat displays top results as place cards + adds assistant message to context
   ↓
11. User clicks "View All" → navigates to /recommendations with:
    - Navigation state: { query, results }
    - ChatContext also has results for persistence
```

**Note:** SSE streaming mode (`stream=true`) is reserved for future implementation.
The current implementation uses JSON mode (`stream=false`) with simulated pipeline
stage visualization for UI feedback.

### State Persistence Flow (Tab Navigation)

```
1. User on /recommendations with AI results
   ↓
2. Clicks "Saved" or "Profile" tab → navigates away
   ↓
3. Results remain in ChatContext (not lost)
   ↓
4. User clicks "Explore" tab
   ↓
5. BottomTabBar checks ChatContext.lastSearchResults.length > 0
   ↓
6. Navigates to /recommendations (not /explore)
   ↓
7. Recommendations.tsx reads from ChatContext → displays persisted results
```

**Navigation Behavior:**
- "Explore" tab → `/recommendations` if AI results exist, else `/explore`
- FAB on `/recommendations` → navigates to `/chat` (preserves conversation)
- FAB elsewhere → opens AIChatOverlay modal

### Authentication Flow

```
1. User visits /login
   ↓
2. Selects role (personal/merchant)
   ↓
3. login(email, password, role) called
   ↓
4. MockUser created and stored in localStorage
   ↓
5. AuthContext updated → UI re-renders
   ↓
6. User redirected based on role
```

### Preference Scoring Flow

```
1. User adjusts sliders on Profile page
   ↓
2. updatePreference(key, value) called
   ↓
3. Preferences saved to localStorage
   ↓
4. On next search, preferences passed to backend
   ↓
5. Results sorted by:
   - Backend: recommendation_score includes preferences
   - Frontend: sortByPreferences() for mock data
```

---

## 14. Debugging Guide

### Common Issues & Solutions

#### 1. API Connection Failed

**Symptoms:** "Backend unavailable, using mock data" in console

**Debug Steps:**
```bash
# 1. Check backend is running
curl http://localhost:8000/health

# 2. Check Vite proxy config
# In vite.config.ts, verify VITE_BACKEND_URL

# 3. Check browser network tab for CORS errors
```

#### 2. SSE Stream Not Working

**Symptoms:** Results don't update progressively

**Debug Steps:**
```typescript
// 1. Check EventSource in browser DevTools → Network → EventSource
// 2. Add logging to handleSseEvent in useSearchStream.ts
const handleSseEvent = useCallback((event: RequestSseEvent) => {
  console.log('SSE Event:', event.type, event);
  // ...
});
```

#### 3. State Not Updating

**Debug Steps:**
```typescript
// 1. Check React DevTools for state
// 2. Add useEffect logging
useEffect(() => {
  console.log('State changed:', { results, isStreaming, pipelineStage });
}, [results, isStreaming, pipelineStage]);
```

#### 4. Styling Issues

**Debug Steps:**
```bash
# 1. Check Tailwind classes are valid
# 2. Use browser DevTools to inspect computed styles
# 3. Check for CSS variable overrides in dark mode
```

### Debug Tools

1. **React DevTools** - Component tree and state inspection
2. **TanStack Query DevTools** - Server state debugging
3. **Network Tab** - API calls and SSE streams
4. **DebugTraceWrapper** - Built-in trace visualization (access via URL param)

### Console Logging Locations

| File | What to Log |
|------|-------------|
| `useSearchStream.ts` | SSE events, pipeline stages |
| `api.ts` | API requests/responses |
| `AuthContext.tsx` | Login/logout events |
| `useDeviceLocation.ts` | Geolocation updates |

---

## 15. Common Modification Patterns

### Adding a New Page

```typescript
// 1. Create page component
// src/pages/NewPage.tsx
export default function NewPage() {
  return <div>New Page</div>;
}

// 2. Add route in App.tsx
<Route path="/new-page" element={<NewPage />} />

// 3. Add navigation link (if needed)
// In BottomTabBar.tsx or elsewhere
```

### Adding a New API Endpoint

```typescript
// 1. Add type in src/types/index.ts
export interface NewResponse {
  data: string;
}

// 2. Add function in src/services/api.ts
export async function getNewData(): Promise<NewResponse> {
  const res = await fetch(`${BASE}/new-endpoint`);
  if (!res.ok) throw new Error(`GET /new-endpoint failed: ${res.status}`);
  return res.json();
}

// 3. Use in component
const { data } = useQuery({
  queryKey: ['new-data'],
  queryFn: getNewData,
});
```

### Adding a New Hook

```typescript
// 1. Create hook file
// src/hooks/useNewHook.ts
import { useState, useCallback } from "react";

export function useNewHook() {
  const [state, setState] = useState<string | null>(null);
  
  const doSomething = useCallback(() => {
    setState("done");
  }, []);
  
  return { state, doSomething };
}

// 2. Export from index (if you have one)
// 3. Use in components
const { state, doSomething } = useNewHook();
```

### Adding a New Context

```typescript
// 1. Create context file
// src/contexts/NewContext.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface NewContextValue {
  value: string;
  setValue: (v: string) => void;
  reset: () => void;
}

const NewContext = createContext<NewContextValue | null>(null);

export function NewProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState("");
  
  const reset = useCallback(() => {
    setValue("");
  }, []);
  
  return (
    <NewContext.Provider value={{ value, setValue, reset }}>
      {children}
    </NewContext.Provider>
  );
}

export function useNewContext() {
  const ctx = useContext(NewContext);
  if (!ctx) throw new Error("useNewContext must be used within NewProvider");
  return ctx;
}

// 2. Add provider in App.tsx (inside existing provider chain)
// 3. See ChatContext.tsx for a complex example with multiple state values
```

### Adding a New Component

```typescript
// 1. Create component file
// src/components/NewComponent.tsx
import { cn } from "@/lib/utils";

interface NewComponentProps {
  title: string;
  className?: string;
}

export function NewComponent({ title, className }: NewComponentProps) {
  return (
    <div className={cn("p-4 bg-card rounded-lg", className)}>
      <h2>{title}</h2>
    </div>
  );
}

// 2. Export (if using barrel exports)
// 3. Import and use in pages
```

### Modifying Styling

```css
/* 1. Global styles: src/index.css */
.my-custom-class {
  @apply bg-primary/10 rounded-xl p-4;
}

/* 2. Component-specific: Use Tailwind classes inline */
<div className="bg-primary/10 rounded-xl p-4" />

/* 3. Dark mode: Add .dark variant */
.dark .my-custom-class {
  @apply bg-primary/20;
}
```

---

## Quick Reference

### NPM Scripts

```bash
npm run dev       # Start dev server (port 8080)
npm run build     # Production build
npm run lint      # Run ESLint
npm run test      # Run tests
npm run preview   # Preview production build
```

### Import Aliases

```typescript
import { Button } from "@/components/ui/button";  // @/ = src/
import { cn } from "@/lib/utils";
import type { PlaceSummary } from "@/types";
```

### Key Files to Know

| Purpose | File |
|---------|------|
| App entry | `src/App.tsx` |
| Routes | `src/App.tsx` (Routes section) |
| API calls | `src/services/api.ts` |
| Types | `src/types/index.ts` |
| Search logic | `src/hooks/useSearchStream.ts` |
| Auth state | `src/contexts/AuthContext.tsx` |
| Chat persistence | `src/contexts/ChatContext.tsx` |
| Home page | `src/pages/Index.tsx` |
| AI Chat | `src/pages/Chat.tsx` |
| AI Results | `src/pages/Recommendations.tsx` |
| Place detail | `src/pages/PlaceDetail.tsx` |
| Tab navigation | `src/components/BottomTabBar.tsx` |

---

*Last updated: 2026-03-14 (Session: Chat context persistence, tab navigation fixes)*
