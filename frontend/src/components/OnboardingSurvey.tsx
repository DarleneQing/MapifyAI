import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export interface UserPreferences {
  categories: string[];
  budget: number;       // 1-5: 1=budget, 5=luxury
  maxDistance: number;   // km
  vibes: string[];
  priorities: { price: number; distance: number; rating: number }; // price/rating: 1-5, distance: 1-30 km
}

const DEFAULT_PREFS: UserPreferences = {
  categories: [],
  budget: 3,
  maxDistance: 5,
  vibes: [],
  priorities: { price: 3, distance: 5, rating: 3 },
};

const CATEGORY_OPTIONS = [
  { id: "coffee", icon: "☕", label: "Coffee" },
  { id: "dining", icon: "🍽", label: "Dining" },
  { id: "barber", icon: "✂️", label: "Barber" },
  { id: "car_wash", icon: "🚗", label: "Car Wash" },
  { id: "hotels", icon: "🏨", label: "Hotels" },
  { id: "bakery", icon: "🥐", label: "Bakery" },
  { id: "fitness", icon: "💪", label: "Fitness" },
  { id: "spa", icon: "🧖", label: "Spa" },
];

const VIBE_OPTIONS = [
  { id: "cozy", icon: "🛋", label: "Cozy & Warm" },
  { id: "trendy", icon: "🔥", label: "Trendy" },
  { id: "quiet", icon: "🤫", label: "Quiet" },
  { id: "lively", icon: "🎉", label: "Lively" },
  { id: "outdoor", icon: "🌿", label: "Outdoor" },
  { id: "luxury", icon: "✨", label: "Luxury" },
  { id: "family", icon: "👨‍👩‍👧", label: "Family" },
  { id: "pet", icon: "🐕", label: "Pet-friendly" },
];

const BUDGET_LABELS = ["Super Saver", "Budget", "Moderate", "Comfort", "Luxury"];

const STEPS = ["categories", "vibes", "budget", "priorities"] as const;

interface Props {
  onComplete: (prefs: UserPreferences) => void;
  onClose?: () => void;
}

export default function OnboardingSurvey({ onComplete, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<UserPreferences>({ ...DEFAULT_PREFS });

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const toggleItem = (field: "categories" | "vibes", id: string) => {
    setPrefs((p) => ({
      ...p,
      [field]: p[field].includes(id)
        ? p[field].filter((x) => x !== id)
        : [...p[field], id],
    }));
  };

  const handleNext = () => {
    if (isLast) {
      onComplete(prefs);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
    >
      {/* Progress */}
      <div className="pt-safe px-6 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5 flex-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
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
          {currentStep === "categories" && (
            <StepWrapper key="categories">
              <StepHeader
                icon="🎯"
                title="What interests you?"
                subtitle="Pick the categories you love (select multiple)"
              />
              <div className="grid grid-cols-2 gap-3 mt-6">
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = prefs.categories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleItem("categories", cat.id)}
                      className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                        active
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                      {active && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                        >
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </StepWrapper>
          )}

          {currentStep === "vibes" && (
            <StepWrapper key="vibes">
              <StepHeader
                icon="✨"
                title="Your vibe?"
                subtitle="What atmosphere do you prefer?"
              />
              <div className="grid grid-cols-2 gap-3 mt-6">
                {VIBE_OPTIONS.map((vibe) => {
                  const active = prefs.vibes.includes(vibe.id);
                  return (
                    <button
                      key={vibe.id}
                      onClick={() => toggleItem("vibes", vibe.id)}
                      className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                        active
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl">{vibe.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{vibe.label}</span>
                      {active && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                        >
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </StepWrapper>
          )}

          {currentStep === "budget" && (
            <StepWrapper key="budget">
              <StepHeader
                icon="💰"
                title="Budget & Distance"
                subtitle="Help us find the right fit for you"
              />
              <div className="mt-8 space-y-10">
                {/* Budget */}
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-medium text-foreground">Budget Level</span>
                    <span className="text-primary font-bold text-lg">
                      {"$".repeat(prefs.budget)}
                    </span>
                  </div>
                  <Slider
                    value={[prefs.budget]}
                    onValueChange={([v]) => setPrefs((p) => ({ ...p, budget: v }))}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>Budget</span>
                    <span>{BUDGET_LABELS[prefs.budget - 1]}</span>
                    <span>Luxury</span>
                  </div>
                </div>

                {/* Distance */}
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-medium text-foreground">Max Distance</span>
                    <span className="text-primary font-bold text-lg">{prefs.maxDistance} km</span>
                  </div>
                  <Slider
                    value={[prefs.maxDistance]}
                    onValueChange={([v]) => setPrefs((p) => ({ ...p, maxDistance: v }))}
                    min={1}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>1 km</span>
                    <span>30 km</span>
                  </div>
                </div>
              </div>
            </StepWrapper>
          )}

          {currentStep === "priorities" && (
            <StepWrapper key="priorities">
              <StepHeader
                icon="⚖️"
                title="What matters most?"
                subtitle="Adjust the weight of each factor in recommendations"
              />
              <div className="mt-8 space-y-10">
                {/* Price: 1-5 */}
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-foreground font-medium">💰 Price Preference</span>
                    <span className="text-primary font-bold text-lg">
                      {"$".repeat(prefs.priorities.price)}
                    </span>
                  </div>
                  <Slider
                    value={[prefs.priorities.price]}
                    onValueChange={([v]) =>
                      setPrefs((p) => ({ ...p, priorities: { ...p.priorities, price: v } }))
                    }
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>Budget</span>
                    <span>Luxury</span>
                  </div>
                </div>

                {/* Distance: 1-30 km */}
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-foreground font-medium">📍 Distance Preference</span>
                    <span className="text-primary font-bold text-lg">{prefs.priorities.distance} km</span>
                  </div>
                  <Slider
                    value={[prefs.priorities.distance]}
                    onValueChange={([v]) =>
                      setPrefs((p) => ({ ...p, priorities: { ...p.priorities, distance: v } }))
                    }
                    min={1}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>1 km</span>
                    <span>30 km</span>
                  </div>
                </div>

                {/* Rating: 1-5 */}
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-foreground font-medium">⭐ Rating Preference</span>
                    <span className="text-primary font-bold text-lg">
                      {prefs.priorities.rating} ★
                    </span>
                  </div>
                  <Slider
                    value={[prefs.priorities.rating]}
                    onValueChange={([v]) =>
                      setPrefs((p) => ({ ...p, priorities: { ...p.priorities, rating: v } }))
                    }
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>1 ★</span>
                    <span>5 ★</span>
                  </div>
                </div>
              </div>
            </StepWrapper>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="px-6 pb-safe pb-6 pt-4 flex items-center gap-3">
        {step > 0 && (
          <Button variant="outline" size="lg" onClick={handleBack} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
        <Button
          size="lg"
          onClick={handleNext}
          className="flex-1 rounded-xl gap-2"
        >
          {isLast ? (
            <>
              <Sparkles className="w-4 h-4" />
              Start Exploring
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

function StepWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
    >
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
