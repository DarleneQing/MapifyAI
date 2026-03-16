import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Star, Settings, CreditCard, Bell, HelpCircle,
  LogOut, ChevronRight, DollarSign, MapPin, ThumbsUp, Clock, LogIn,
  ClipboardList, RotateCcw, Sparkles, Users, BarChart3, Eye, ShoppingBag, TrendingUp,
} from "lucide-react";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { useAuth } from "@/contexts/AuthContext";
import OnboardingSurvey from "@/components/onboarding/OnboardingSurvey";
import MerchantOnboarding, { type MerchantPreferences } from "@/components/merchant/MerchantOnboarding";
import { usePreferences } from "@/hooks/usePreferences";

import { getProfile, updatePreferences } from "@/services/api";
import type { UserPreferences } from "@/types";

import { toast } from "@/hooks/use-toast";

const STATS = [
  { label: "Visited", value: "23" },
  { label: "Reviews", value: "8" },
  { label: "Saved", value: "14" },
];

const RECENT_VISITS = [
  { name: "The Ground Brew", rating: 5, date: "Yesterday" },
  { name: "Velvet Crumb", rating: 4, date: "3 days ago" },
  { name: "The Sage Bistro", rating: 5, date: "1 week ago" },
];

const MENU_ITEMS = [
  { icon: CreditCard, label: "Payment Methods" },
  { icon: Bell, label: "Notifications" },
  { icon: HelpCircle, label: "Help & Support" },
];

const PREF_CONFIG = [
  {
    key: "weight_price" as const,
    label: "Price Preference",
    description: "How much do you value affordability?",
    icon: DollarSign,
    color: "text-emerald-500",
    min: 1,
    max: 5,
    minLabel: "Budget",
    maxLabel: "Luxury",
  },
  {
    key: "weight_distance" as const,
    label: "Distance Preference",
    description: "Maximum distance you're willing to travel",
    icon: MapPin,
    color: "text-blue-500",
    min: 3,
    max: 30,
    minLabel: "3 km",
    maxLabel: "30 km",
  },
  {
    key: "weight_rating" as const,
    label: "Rating Preference",
    description: "Minimum star rating you'd accept",
    icon: ThumbsUp,
    color: "text-amber-500",
    min: 1,
    max: 5,
    minLabel: "1 ★",
    maxLabel: "5 ★",
  },
];

function ProfileAuthButton() {
  const { user, isAuthenticated, logout, isMerchant } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate("/login")}
        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors mt-2"
      >
        <LogIn className="w-4 h-4 text-primary" />
        <span className="text-sm text-primary font-medium">Sign In</span>
      </motion.button>
    );
  }

  return (
    <div className="space-y-1 mt-2">
      {isMerchant && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/merchant")}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors"
        >
          <Settings className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">Merchant Dashboard</span>
        </motion.button>
      )}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => { logout(); navigate("/login"); }}
        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-destructive/10 transition-colors"
      >
        <LogOut className="w-4 h-4 text-destructive" />
        <span className="text-sm text-destructive">Sign Out ({user?.email})</span>
      </motion.button>
    </div>
  );
}

export default function Profile() {
  const { user, isMerchant } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<UserPreferences>({
    weight_price: 0.33,
    weight_distance: 0.33,
    weight_rating: 0.34,
  });
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("prefs");
  const [showSurvey, setShowSurvey] = useState(false);
  const { preferences: surveyPrefs, hasOnboarded, savePreferences, resetOnboarding } = usePreferences();

  // Merchant prefs from localStorage
  const merchantStorageKey = `merchant_onboarded_${user?.shopName || "default"}_prefs`;
  const [merchantPrefs, setMerchantPrefs] = useState<MerchantPreferences | null>(() => {
    const saved = localStorage.getItem(merchantStorageKey);
    return saved ? JSON.parse(saved) : null;
  });
  const hasMerchantOnboarded = isMerchant && !!localStorage.getItem(`merchant_onboarded_${user?.shopName || "default"}`);
  const [showMerchantSurvey, setShowMerchantSurvey] = useState(false);

  useEffect(() => {
    getProfile()
      .then((res) => {
        if (res?.profile?.weights) {
          setPreferences({
            weight_price: res.profile.weights.price ?? 0.33,
            weight_distance: res.profile.weights.distance ?? 0.33,
            weight_rating: res.profile.weights.rating ?? 0.34,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSliderChange = (key: keyof UserPreferences, rawValue: number) => {
    // rawValue is 1-5, convert to 0-1 range for API
    const value = rawValue / 5;
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);

    setSaving(true);
    updatePreferences(updated)
      .then(() => {
        toast({ title: "Preferences updated" });
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  // Merchant survey overlay
  if (showMerchantSurvey) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background">
        <MerchantOnboarding
          onClose={() => setShowMerchantSurvey(false)}
          onComplete={(prefs) => {
            const key = `merchant_onboarded_${user?.shopName || "default"}`;
            localStorage.setItem(key, "true");
            localStorage.setItem(`${key}_prefs`, JSON.stringify(prefs));
            setMerchantPrefs(prefs);
            setShowMerchantSurvey(false);
            toast({ title: "🎉 Business profile updated!", description: "Your dashboard settings have been saved." });
          }}
        />
      </div>
    );
  }

  // Consumer survey overlay
  if (showSurvey) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background">
        <OnboardingSurvey
          onClose={() => setShowSurvey(false)}
          onComplete={(prefs) => {
            savePreferences(prefs);
            setShowSurvey(false);
            toast({ title: "🎉 Taste profile updated!", description: "Your recommendations will now be personalized." });
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <div className="flex-shrink-0 safe-top border-b border-border/50">
        <div className="flex items-center justify-center px-5 py-3">
          <h1 className="text-base font-semibold text-foreground">Profile</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 px-5 py-6">
        {/* Avatar & Name — always first */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-2">
            <User className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{isMerchant ? (user?.shopName || "My Shop") : "Alex Chen"}</h2>
          <p className="text-xs text-muted-foreground">{isMerchant ? (user?.shopCategory || "Merchant") : "San Francisco, CA"}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-around py-4 rounded-2xl bg-card border border-border/60 mb-6">
          {(isMerchant
            ? [{ label: "Deals", value: "12" }, { label: "Queue Today", value: "7" }, { label: "Reviews", value: "45" }]
            : STATS
          ).map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Merchant Dashboard Summary — below avatar for merchants */}
        {isMerchant && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Dashboard</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/merchant")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                Open Full Dashboard
                <ChevronRight className="w-3 h-3" />
              </motion.button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Today Views", value: "342", icon: Eye, change: "+12%" },
                { label: "Queue Size", value: "7", icon: Users, change: "3 waiting" },
                { label: "Transactions", value: "28", icon: ShoppingBag, change: "+5 today" },
                { label: "Revenue", value: "CHF 1,240", icon: TrendingUp, change: "+18%" },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-xl bg-card border border-border/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <stat.icon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] text-emerald-600 font-medium">{stat.change}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Taste Profile Card */}
        <div className="mb-4 p-4 rounded-2xl bg-card border border-border/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {isMerchant ? "Business Profile" : "My Taste Profile"}
              </span>
            </div>
            {isMerchant ? (
              hasMerchantOnboarded && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowMerchantSurvey(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retake
                </motion.button>
              )
            ) : (
              hasOnboarded && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { resetOnboarding(); setShowSurvey(true); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retake
                </motion.button>
              )
            )}
          </div>

          {isMerchant ? (
            hasMerchantOnboarded && merchantPrefs ? (
              <div className="space-y-3">
                {/* Service Categories */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Services</p>
                  <div className="flex flex-wrap gap-1">
                    {merchantPrefs.serviceCategories.map((c) => (
                      <span key={c} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium capitalize">{c.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
                {/* Target Customers */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Target Customers</p>
                  <div className="flex flex-wrap gap-1">
                    {merchantPrefs.targetCustomers.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-medium capitalize">{t.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
                {/* Business Settings tags */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Settings</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                      💰 {"$".repeat(Math.min(5, Math.max(1, merchantPrefs.priceRange)))}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                      👥 ≤ {merchantPrefs.maxCapacity} / day
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium capitalize">
                      🔄 {merchantPrefs.operatingStyle.replace(/_/g, " ") || "Not set"}
                    </span>
                  </div>
                </div>
                {/* Feature toggles */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Features</p>
                  <div className="flex flex-wrap gap-1">
                    {merchantPrefs.flashDealsEnabled && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">⚡ Flash Deals</span>
                    )}
                    {merchantPrefs.queueEnabled && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">👥 Queue</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowMerchantSurvey(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                <ClipboardList className="w-4 h-4" />
                Set Up Business Profile
              </motion.button>
            )
          ) : (
            hasOnboarded && surveyPrefs ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Interests</p>
                  <div className="flex flex-wrap gap-1">
                    {surveyPrefs.categories.map((c) => (
                      <span key={c} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium capitalize">{c.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Vibes</p>
                  <div className="flex flex-wrap gap-1">
                    {surveyPrefs.vibes.map((v) => (
                      <span key={v} className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-medium capitalize">{v.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Preferences</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                      💰 {"$".repeat(Math.min(5, Math.max(1, surveyPrefs.budget)))}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                      📍 ≤ {surveyPrefs.maxDistance} km
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                      ⭐ ≥ {Math.min(5, Math.max(1, surveyPrefs.priorities.rating))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowSurvey(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                <ClipboardList className="w-4 h-4" />
                Take Taste Survey
              </motion.button>
            )
          )}
        </div>

        {/* Menu */}
        <div className="space-y-1">
          {/* Preferences button */}
          <div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setExpandedSection(expandedSection === "prefs" ? null : "prefs")}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-card transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Preferences</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground/40 transition-transform ${expandedSection === "prefs" ? "rotate-90" : ""}`} />
            </motion.button>
            <AnimatePresence>
              {expandedSection === "prefs" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 p-4 mx-3 mb-2 rounded-xl bg-card border border-border/60">
                  {isMerchant && hasMerchantOnboarded && merchantPrefs ? (
                    <div className="space-y-4">
                      {/* Price Range */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm font-medium text-foreground">Price Range</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">Your service pricing tier</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">$</span>
                          <input type="range" min={1} max={5} step={1} value={merchantPrefs.priceRange}
                            onChange={(e) => {
                              const updated = { ...merchantPrefs, priceRange: Number(e.target.value) };
                              setMerchantPrefs(updated);
                              localStorage.setItem(merchantStorageKey, JSON.stringify(updated));
                            }}
                            className="w-full h-2 rounded-full appearance-none bg-primary/20 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                          />
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">$$$$$</span>
                        </div>
                      </div>
                      {/* Max Capacity */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-foreground">Max Daily Capacity</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">Maximum customers you can serve per day</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">1</span>
                          <input type="range" min={1} max={100} step={1} value={merchantPrefs.maxCapacity}
                            onChange={(e) => {
                              const updated = { ...merchantPrefs, maxCapacity: Number(e.target.value) };
                              setMerchantPrefs(updated);
                              localStorage.setItem(merchantStorageKey, JSON.stringify(updated));
                            }}
                            className="w-full h-2 rounded-full appearance-none bg-primary/20 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                          />
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">100</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                    {PREF_CONFIG.map((pref) => {
                      let sliderValue: number;
                      if (hasOnboarded && surveyPrefs) {
                        if (pref.key === "weight_price") sliderValue = Math.min(5, Math.max(1, surveyPrefs.budget));
                        else if (pref.key === "weight_distance") sliderValue = Math.min(30, Math.max(3, surveyPrefs.maxDistance));
                        else sliderValue = Math.min(5, Math.max(1, surveyPrefs.priorities.rating));
                      } else {
                        const rawVal = preferences[pref.key] ?? 0.33;
                        sliderValue = Math.round(rawVal * (pref.max - pref.min) + pref.min);
                      }
                      return (
                        <div key={pref.key}>
                          <div className="flex items-center gap-2 mb-1">
                            <pref.icon className={`w-4 h-4 ${pref.color}`} />
                            <span className="text-sm font-medium text-foreground">{pref.label}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-2">{pref.description}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{pref.minLabel}</span>
                            <input type="range" min={pref.min} max={pref.max} step={1} value={sliderValue}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (hasOnboarded && surveyPrefs) {
                                  const updated = { ...surveyPrefs };
                                  if (pref.key === "weight_price") updated.budget = v;
                                  else if (pref.key === "weight_distance") updated.maxDistance = v;
                                  else updated.priorities = { ...updated.priorities, rating: v };
                                  savePreferences(updated);
                                  // Sync normalized weights to backend
                                  updatePreferences({
                                    weight_price: updated.budget / 5,
                                    weight_distance: (updated.maxDistance - 3) / (30 - 3),
                                    weight_rating: updated.priorities.rating / 5,
                                  }).catch(() => {});
                                } else {
                                  const normalized = (v - pref.min) / (pref.max - pref.min);
                                  const updated = { ...preferences, [pref.key]: normalized };
                                  setPreferences(updated);
                                  updatePreferences(updated).catch(() => {});
                                }
                              }}
                              className="w-full h-2 rounded-full appearance-none bg-primary/20 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                            />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{pref.maxLabel}</span>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recent Visits button */}
          <div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setExpandedSection(expandedSection === "visits" ? null : "visits")}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-card transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Recent Visits</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground/40 transition-transform ${expandedSection === "visits" ? "rotate-90" : ""}`} />
            </motion.button>
            <AnimatePresence>
              {expandedSection === "visits" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 mx-3 mb-2">
                    {RECENT_VISITS.map((visit) => (
                      <div key={visit.name} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/60">
                        <div>
                          <p className="text-sm font-medium text-foreground">{visit.name}</p>
                          <p className="text-xs text-muted-foreground">{visit.date}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < visit.rating ? "text-amber-500 fill-amber-500" : "text-muted"}`} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Other menu items */}
          {MENU_ITEMS.map((item) => (
            <motion.button
              key={item.label}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-card transition-colors"
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
            </motion.button>
          ))}

          <ProfileAuthButton />
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
