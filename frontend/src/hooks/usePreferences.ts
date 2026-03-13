import { useState, useCallback } from "react";
import type { UserPreferences } from "@/components/OnboardingSurvey";

const STORAGE_KEY = "user_preferences";
const ONBOARDED_KEY = "user_onboarded";

export function usePreferences() {
  const [preferences, setPreferencesState] = useState<UserPreferences | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const [hasOnboarded, setHasOnboarded] = useState(() => {
    return localStorage.getItem(ONBOARDED_KEY) === "true";
  });

  const savePreferences = useCallback((prefs: UserPreferences) => {
    setPreferencesState(prefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    localStorage.setItem(ONBOARDED_KEY, "true");
    setHasOnboarded(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDED_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setHasOnboarded(false);
    setPreferencesState(null);
  }, []);

  return { preferences, hasOnboarded, savePreferences, resetOnboarding };
}
