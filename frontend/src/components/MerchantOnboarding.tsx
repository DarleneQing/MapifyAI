import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export interface MerchantPreferences {
  serviceCategories: string[];
  targetCustomers: string[];
  biddingEnabled: boolean;
  flashDealsEnabled: boolean;
  queueEnabled: boolean;
  operatingStyle: string;
  priceRange: number; // 1-5
  maxCapacity: number; // 1-100
}

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

const STEPS = ["services", "customers", "operating", "features"] as const;

interface Props {
  onComplete: (prefs: MerchantPreferences) => void;
  onClose?: () => void;
}

export default function MerchantOnboarding({ onComplete, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<MerchantPreferences>({ ...DEFAULT_PREFS });

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const toggleItem = (field: "serviceCategories" | "targetCustomers", id: string) => {
    setPrefs((p) => ({
      ...p,
      [field]: p[field].includes(id) ? p[field].filter((x) => x !== id) : [...p[field], id],
    }));
  };

  const handleNext = () => {
    if (isLast) {
      onComplete(prefs);
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
    >
      {/* Header with progress & close */}
      <div className="pt-safe px-6 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5 flex-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          {onClose && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="ml-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6">
        <AnimatePresence mode="wait">
          {currentStep === "services" && (
            <StepWrapper key="services">
              <StepHeader icon="🏪" title="What services do you offer?" subtitle="Select all that apply to your business" />
              <div className="grid grid-cols-2 gap-3 mt-6">
                {SERVICE_OPTIONS.map((opt) => {
                  const active = prefs.serviceCategories.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleItem("serviceCategories", opt.id)}
                      className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                        active ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                      {active && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </StepWrapper>
          )}

          {currentStep === "customers" && (
            <StepWrapper key="customers">
              <StepHeader icon="🎯" title="Who are your target customers?" subtitle="Help us match the right audience to your business" />
              <div className="grid grid-cols-2 gap-3 mt-6">
                {CUSTOMER_OPTIONS.map((opt) => {
                  const active = prefs.targetCustomers.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleItem("targetCustomers", opt.id)}
                      className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                        active ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                      {active && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </StepWrapper>
          )}

          {currentStep === "operating" && (
            <StepWrapper key="operating">
              <StepHeader icon="⚙️" title="Operating Style & Pricing" subtitle="Set up how your business runs" />
              <div className="mt-6 space-y-8">
                {/* Operating style */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">How do you serve customers?</p>
                  <div className="space-y-2">
                    {OPERATING_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setPrefs((p) => ({ ...p, operatingStyle: style.id }))}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                          prefs.operatingStyle === style.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card"
                        }`}
                      >
                        <span className="text-2xl">{style.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{style.label}</p>
                          <p className="text-xs text-muted-foreground">{style.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price range */}
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-medium text-foreground">Price Range</span>
                    <span className="text-primary font-bold text-lg">{PRICE_LABELS[prefs.priceRange - 1]}</span>
                  </div>
                  <Slider
                    value={[prefs.priceRange]}
                    onValueChange={([v]) => setPrefs((p) => ({ ...p, priceRange: v }))}
                    min={1} max={5} step={1} className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>Budget</span>
                    <span>Premium</span>
                  </div>
                </div>

                {/* Capacity */}
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-medium text-foreground">Max Daily Capacity</span>
                    <span className="text-primary font-bold text-lg">{prefs.maxCapacity}</span>
                  </div>
                  <Slider
                    value={[prefs.maxCapacity]}
                    onValueChange={([v]) => setPrefs((p) => ({ ...p, maxCapacity: v }))}
                    min={1} max={100} step={1} className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>1 customer</span>
                    <span>100 customers</span>
                  </div>
                </div>
              </div>
            </StepWrapper>
          )}

          {currentStep === "features" && (
            <StepWrapper key="features">
              <StepHeader icon="🚀" title="Enable Platform Features" subtitle="Choose which features to activate for your business" />
              <div className="mt-6 space-y-3">
                {FEATURE_TOGGLES.map((feat) => {
                  const active = prefs[feat.key];
                  return (
                    <button
                      key={feat.key}
                      onClick={() => setPrefs((p) => ({ ...p, [feat.key]: !p[feat.key] }))}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                        active ? "border-primary bg-primary/10" : "border-border bg-card"
                      }`}
                    >
                      <span className="text-2xl">{feat.icon}</span>
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
            </StepWrapper>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="px-6 pb-safe pb-6 pt-4 flex items-center gap-3">
        {step > 0 && (
          <Button variant="outline" size="lg" onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
        <Button size="lg" onClick={handleNext} className="flex-1 rounded-xl gap-2">
          {isLast ? (
            <><Sparkles className="w-4 h-4" /> Launch Dashboard</>
          ) : (
            <>Next <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

function StepWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  );
}

function StepHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div>
      <span className="text-4xl">{icon}</span>
      <h2 className="text-2xl font-bold text-foreground mt-3 font-[DM_Serif_Display]">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
