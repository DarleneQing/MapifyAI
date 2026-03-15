import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Check, Sparkles, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { MerchantPreferences } from "@/components/merchant/MerchantOnboarding";

const SERVICE_OPTIONS = [
  { id: "coffee", icon: "☕", label: "Coffee & Café" },
  { id: "dining", icon: "🍽", label: "Dining" },
  { id: "barber", icon: "✂️", label: "Barber & Beauty" },
  { id: "car_wash", icon: "🚗", label: "Car Wash" },
  { id: "fitness", icon: "💪", label: "Fitness" },
  { id: "spa", icon: "🧖", label: "Spa & Wellness" },
  { id: "retail", icon: "🛍", label: "Retail" },
  { id: "repair", icon: "🔧", label: "Repair & Service" },
];

const CUSTOMER_OPTIONS = [
  { id: "students", icon: "🎓", label: "Students" },
  { id: "families", icon: "👨‍👩‍👧", label: "Families" },
  { id: "professionals", icon: "💼", label: "Professionals" },
  { id: "tourists", icon: "🗺", label: "Tourists" },
  { id: "elderly", icon: "🧓", label: "Elderly" },
  { id: "pet_owners", icon: "🐕", label: "Pet Owners" },
];

const OPERATING_STYLES = [
  { id: "walk_in", icon: "🚶", label: "Walk-in Only", desc: "First come, first served" },
  { id: "appointment", icon: "📅", label: "Appointment", desc: "Booking required" },
  { id: "hybrid", icon: "🔄", label: "Hybrid", desc: "Both walk-in and booking" },
];

const FEATURE_TOGGLES = [
  { key: "biddingEnabled" as const, icon: "🏷", label: "Enable Bidding", desc: "Let customers bid for your services" },
  { key: "flashDealsEnabled" as const, icon: "⚡", label: "Flash Deals", desc: "Publish time-limited promotions" },
  { key: "queueEnabled" as const, icon: "👥", label: "Queue System", desc: "Let customers join a virtual queue" },
];

const PRICE_LABELS = ["$", "$$", "$$$", "$$$$", "$$$$$"];

const DEFAULT_PREFS: MerchantPreferences = {
  serviceCategories: [],
  targetCustomers: [],
  biddingEnabled: false,
  flashDealsEnabled: true,
  queueEnabled: true,
  operatingStyle: "",
  priceRange: 3,
  maxCapacity: 20,
};

export default function MerchantSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const storageKey = `merchant_onboarded_${user?.shopName || "default"}_prefs`;

  const [prefs, setPrefs] = useState<MerchantPreferences>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : { ...DEFAULT_PREFS };
  });

  const [saved, setSaved] = useState(false);

  const toggleItem = (field: "serviceCategories" | "targetCustomers", id: string) => {
    setPrefs((p) => ({
      ...p,
      [field]: p[field].includes(id) ? p[field].filter((x) => x !== id) : [...p[field], id],
    }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Live preview summary
  const serviceLabels = SERVICE_OPTIONS.filter((s) => prefs.serviceCategories.includes(s.id));
  const customerLabels = CUSTOMER_OPTIONS.filter((c) => prefs.targetCustomers.includes(c.id));
  const styleLabel = OPERATING_STYLES.find((s) => s.id === prefs.operatingStyle);
  const activeFeatures = FEATURE_TOGGLES.filter((f) => prefs[f.key]);

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/merchant")}
            className="p-1.5 rounded-full hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          <div>
            <h1 className="text-xl font-bold text-foreground font-[DM_Serif_Display]">Business Settings</h1>
            <p className="text-sm text-muted-foreground">Edit your preferences anytime</p>
          </div>
        </div>
      </div>

      {/* Live preview card */}
      <div className="px-4 mt-4">
        <motion.div
          layout
          className="p-4 rounded-2xl bg-primary/5 border-2 border-primary/20"
        >
          <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Live Preview
          </p>
          <div className="flex flex-wrap gap-1.5">
            {serviceLabels.map((s) => (
              <span key={s.id} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {s.icon} {s.label}
              </span>
            ))}
            {customerLabels.map((c) => (
              <span key={c.id} className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                {c.icon} {c.label}
              </span>
            ))}
            {styleLabel && (
              <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                {styleLabel.icon} {styleLabel.label}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              💰 {PRICE_LABELS[prefs.priceRange - 1]}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              👥 ≤{prefs.maxCapacity}
            </span>
            {activeFeatures.map((f) => (
              <span key={f.key} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {f.icon} {f.label}
              </span>
            ))}
          </div>
          {serviceLabels.length === 0 && customerLabels.length === 0 && !styleLabel && (
            <p className="text-xs text-muted-foreground">Configure your preferences below to see a live preview</p>
          )}
        </motion.div>
      </div>

      {/* Editable sections */}
      <div className="px-4 mt-6 space-y-8">
        {/* Services */}
        <Section title="🏪 Service Categories">
          <div className="grid grid-cols-2 gap-2">
            {SERVICE_OPTIONS.map((opt) => {
              const active = prefs.serviceCategories.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleItem("serviceCategories", opt.id)}
                  className={`relative flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                    active ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                  {active && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </motion.div>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Target Customers */}
        <Section title="🎯 Target Customers">
          <div className="grid grid-cols-2 gap-2">
            {CUSTOMER_OPTIONS.map((opt) => {
              const active = prefs.targetCustomers.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleItem("targetCustomers", opt.id)}
                  className={`relative flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                    active ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                  {active && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </motion.div>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Operating Style */}
        <Section title="⚙️ Operating Style">
          <div className="space-y-2">
            {OPERATING_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => { setPrefs((p) => ({ ...p, operatingStyle: style.id })); setSaved(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  prefs.operatingStyle === style.id ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <span className="text-xl">{style.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{style.label}</p>
                  <p className="text-xs text-muted-foreground">{style.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Price & Capacity */}
        <Section title="💰 Price & Capacity">
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-foreground">Price Range</span>
                <span className="text-primary font-bold text-lg">{PRICE_LABELS[prefs.priceRange - 1]}</span>
              </div>
              <Slider
                value={[prefs.priceRange]}
                onValueChange={([v]) => { setPrefs((p) => ({ ...p, priceRange: v })); setSaved(false); }}
                min={1} max={5} step={1} className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Budget</span><span>Premium</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-foreground">Max Daily Capacity</span>
                <span className="text-primary font-bold text-lg">{prefs.maxCapacity}</span>
              </div>
              <Slider
                value={[prefs.maxCapacity]}
                onValueChange={([v]) => { setPrefs((p) => ({ ...p, maxCapacity: v })); setSaved(false); }}
                min={1} max={100} step={1} className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1 customer</span><span>100 customers</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Features */}
        <Section title="🚀 Platform Features">
          <div className="space-y-2">
            {FEATURE_TOGGLES.map((feat) => {
              const active = prefs[feat.key];
              return (
                <button
                  key={feat.key}
                  onClick={() => { setPrefs((p) => ({ ...p, [feat.key]: !p[feat.key] })); setSaved(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    active ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <span className="text-xl">{feat.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{feat.label}</p>
                    <p className="text-xs text-muted-foreground">{feat.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    active ? "bg-primary border-primary" : "border-muted-foreground/30"
                  }`}>
                    {active && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Sticky save button */}
      <div className="sticky bottom-0 px-4 py-4 bg-background/80 backdrop-blur-md border-t border-border">
        <Button size="lg" onClick={handleSave} className="w-full rounded-xl gap-2">
          {saved ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> Save Changes</>
          )}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-bold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}
