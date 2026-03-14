import { useState } from "react";
import { motion } from "framer-motion";
import { X, SlidersHorizontal, Gavel, Shield, Bug, User } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useLang } from "@/i18n/LanguageContext";

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const [weights, setWeights] = useState({
    price: 50,
    distance: 50,
    rating: 50,
  });
  const { t } = useLang();

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.aside
        className="fixed top-0 left-0 h-full w-[85vw] max-w-sm bg-background z-50 flex flex-col safe-top shadow-2xl"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{t.settings}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <div className="flex items-center gap-3 mb-3">
              <User className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t.profile}</h3>
            </div>
            <button className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition-colors">
              {t.completeSurvey}
            </button>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t.preferences}</h3>
            </div>
            <div className="space-y-5">
              {([
                { key: "price" as const, label: t.priceFirst, emoji: "💰" },
                { key: "distance" as const, label: t.distanceFirst, emoji: "📍" },
                { key: "rating" as const, label: t.ratingFirst, emoji: "⭐" },
              ]).map(({ key, label, emoji }) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{emoji} {label}</span>
                    <span className="text-foreground font-medium">{weights[key]}%</span>
                  </div>
                  <Slider
                    value={[weights[key]]}
                    onValueChange={([v]) => setWeights((prev) => ({ ...prev, [key]: v }))}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <Gavel className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t.bidHall}</h3>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">{t.bidHallEmpty}</p>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t.privacy}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.privacyNote}
            </p>
          </section>

          {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "true" && (
            <section>
              <div className="flex items-center gap-3 mb-3">
                <Bug className="w-4 h-4 text-destructive" />
                <h3 className="text-sm font-semibold text-foreground">Agent Trace</h3>
              </div>
              <div className="rounded-xl bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground font-mono">DAG trace will appear here</p>
              </div>
            </section>
          )}
        </div>
      </motion.aside>
    </>
  );
}
