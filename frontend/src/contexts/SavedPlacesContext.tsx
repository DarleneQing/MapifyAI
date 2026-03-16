import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { getFourSavedPerCategory } from "@/data/providers";

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

// Four places per category from Zurich seed, with mock discounts on first two per category
const DEFAULT_SAVED: SavedPlace[] = getFourSavedPerCategory().map((p) => ({
  ...p,
  status: "open_now",
}));

const OLD_MOCK_NAMES = new Set(["The Sage Bistro", "The Ground Brew", "Komorebi Tables", "Velvet Crumb", "Origin Roast", "Blue Bottle Coffee"]);

function isOldMockSavedList(places: SavedPlace[]): boolean {
  if (!places.length) return false;
  return places.every((p) => OLD_MOCK_NAMES.has(p.name));
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
