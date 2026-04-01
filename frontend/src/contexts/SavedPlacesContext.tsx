import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { getDefaultSavedPlaces } from "@/data/providers";

/** Queue snapshot for display on Saved tab when live lookup by id is not available. */
export interface SavedPlaceQueueSnapshot {
  level: "low" | "medium" | "busy";
  waitMinutes: number;
  peopleAhead: number;
}

export interface SavedPlace {
  id: string;
  name: string;
  rating: number;
  category: string;
  address: string;
  priceLevel: string;
  status: "open_now" | "closing_soon" | "closed";
  tags: string[];
  savedAt: string;
  flashDeal?: {
    title: string;
    discount: string;
    expires_at: string;
    remaining: number;
  };
  /** Queue info at save time; used on Saved tab when getQueueInfo(place.id) is null (e.g. different id format). */
  queueSnapshot?: SavedPlaceQueueSnapshot;
}

interface SavedPlacesContextValue {
  savedPlaces: SavedPlace[];
  isSaved: (id: string) => boolean;
  toggleSave: (place: SavedPlace) => void;
  removeSaved: (id: string) => void;
}

const SavedPlacesContext = createContext<SavedPlacesContextValue | null>(null);

// Seven specific default places shown on first launch (2 restaurants, 1 café, 1 bar, 1 haircut, 2 massage)
const DEFAULT_SAVED: SavedPlace[] = getDefaultSavedPlaces().map((p) => ({
  ...p,
  status: "open_now",
}));

const OLD_MOCK_NAMES = new Set([
  // Very first generation of mock data
  "The Sage Bistro", "The Ground Brew", "Komorebi Tables", "Velvet Crumb", "Origin Roast", "Blue Bottle Coffee",
]);

// Names that were auto-seeded via getFourSavedPerCategory (many items, not a real user list)
const SEED_DEFAULT_NAMES = new Set(
  getDefaultSavedPlaces().map((p) => p.name)
);

function isOldMockSavedList(places: SavedPlace[]): boolean {
  if (!places.length) return false;
  // Old generation of mock names → reset
  if (places.every((p) => OLD_MOCK_NAMES.has(p.name))) return true;
  // Old large auto-seed (>3 items) where every item came from the seed dataset
  // but none are from the current 3-place default → reset to new default
  if (places.length > SEED_DEFAULT_NAMES.size && places.every((p) => !SEED_DEFAULT_NAMES.has(p.name))) return true;
  return false;
}

export function SavedPlacesProvider({ children }: { children: ReactNode }) {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => {
    const stored = localStorage.getItem("saved_places");
    if (!stored) return DEFAULT_SAVED;
    try {
      const parsed: SavedPlace[] = JSON.parse(stored).map((p: SavedPlace) => ({
        ...p,
        status: "open_now",
      }));
      if (isOldMockSavedList(parsed)) {
        localStorage.setItem("saved_places", JSON.stringify(DEFAULT_SAVED));
        return DEFAULT_SAVED;
      }
      return parsed;
    } catch {
      return DEFAULT_SAVED;
    }
  });

  const persist = (places: SavedPlace[]) => {
    setSavedPlaces(places);
    localStorage.setItem("saved_places", JSON.stringify(places));
  };

  const isSaved = useCallback(
    (id: string) => savedPlaces.some((p) => p.id === id),
    [savedPlaces]
  );

  const toggleSave = useCallback(
    (place: SavedPlace) => {
      if (savedPlaces.some((p) => p.id === place.id)) {
        persist(savedPlaces.filter((p) => p.id !== place.id));
      } else {
        persist([{ ...place, savedAt: "Just now" }, ...savedPlaces]);
      }
    },
    [savedPlaces]
  );

  const removeSaved = useCallback(
    (id: string) => {
      persist(savedPlaces.filter((p) => p.id !== id));
    },
    [savedPlaces]
  );

  return (
    <SavedPlacesContext.Provider value={{ savedPlaces, isSaved, toggleSave, removeSaved }}>
      {children}
    </SavedPlacesContext.Provider>
  );
}

export function useSavedPlaces() {
  const ctx = useContext(SavedPlacesContext);
  if (!ctx) throw new Error("useSavedPlaces must be used within SavedPlacesProvider");
  return ctx;
}
