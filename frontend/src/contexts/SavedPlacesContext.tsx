import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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
}

interface SavedPlacesContextValue {
  savedPlaces: SavedPlace[];
  isSaved: (id: string) => boolean;
  toggleSave: (place: SavedPlace) => void;
  removeSaved: (id: string) => void;
}

const SavedPlacesContext = createContext<SavedPlacesContextValue | null>(null);

// Default seed data
const DEFAULT_SAVED: SavedPlace[] = [
  { id: "p5", name: "The Sage Bistro", rating: 4.8, category: "Fine Dining", address: "Gastronomy Park, SF", savedAt: "2 days ago", priceLevel: "$$$", status: "open_now", tags: ["Farm-to-table", "Date night"], flashDeal: { title: "Dinner Set Menu", discount: "-30%", expires_at: new Date(Date.now() + 7200000).toISOString(), remaining: 8 } },
  { id: "p1", name: "The Ground Brew", rating: 4.9, category: "Coffee", address: "12 Market Street", savedAt: "1 week ago", priceLevel: "$$", status: "open_now", tags: ["Minimalist design", "Strong espresso"], flashDeal: { title: "Espresso Happy Hour", discount: "-40%", expires_at: new Date(Date.now() + 3600000).toISOString(), remaining: 12 } },
  { id: "p2", name: "Komorebi Tables", rating: 4.7, category: "Café & Workspace", address: "88 Oak Avenue", savedAt: "2 weeks ago", priceLevel: "$$", status: "closing_soon", tags: ["High-speed WiFi", "Quiet environment"] },
  { id: "p3", name: "Velvet Crumb", rating: 4.8, category: "Bakery", address: "45 Elm Street", savedAt: "3 weeks ago", priceLevel: "$", status: "open_now", tags: ["Artisanal sourdough", "Trending"], flashDeal: { title: "Buy 2 Get 1 Free", discount: "3 for 2", expires_at: new Date(Date.now() + 1800000).toISOString(), remaining: 5 } },
];

export function SavedPlacesProvider({ children }: { children: ReactNode }) {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => {
    const stored = localStorage.getItem("saved_places");
    return stored ? JSON.parse(stored) : DEFAULT_SAVED;
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
