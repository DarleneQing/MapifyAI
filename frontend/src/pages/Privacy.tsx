import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Shield, Check, X, Info } from "lucide-react";
import { getPrivacyMeta } from "@/services/api";
import type { PrivacyMeta } from "@/types";

const MOCK_PRIVACY: PrivacyMeta = {
  permissions: [
    { name: "location", description: "Used to recommend nearby businesses that are currently open", required: true },
  ],
  data_collected: [
    "Preference settings (budget, weights, etc.)",
    "Profile tags (student / office worker, etc.)",
    "Basic logs (Request ID, Trace ID, error codes)",
  ],
  data_not_collected: [
    "Sensitive personal identity information",
    "Exact location history (not stored in MVP)",
    "Payment or financial data",
  ],
};

export default function Privacy() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<PrivacyMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getPrivacyMeta();
        if (!cancelled) setMeta(data);
      } catch {
        if (!cancelled) setMeta(MOCK_PRIVACY);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!meta) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="p-1">
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </motion.button>
          <h1 className="text-base font-semibold text-foreground">Privacy & Data Usage</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-20">
        {/* Intro */}
        <div className="flex items-center gap-3 mb-6 mt-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Your Privacy Matters</h2>
            <p className="text-xs text-muted-foreground">Here's how we handle your data</p>
          </div>
        </div>

        {/* Permissions */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-primary" /> Permissions We Request
          </h3>
          {meta.permissions.map((p, i) => (
            <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/30 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground capitalize">{p.name}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  p.required ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {p.required ? "Required" : "Optional"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
          ))}
        </section>

        {/* Data Collected */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Data We Collect</h3>
          <div className="space-y-2">
            {meta.data_collected.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Data Not Collected */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Data We Do NOT Collect</h3>
          <div className="space-y-2">
            {meta.data_not_collected.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
