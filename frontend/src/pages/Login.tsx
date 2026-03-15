import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, Store, ArrowRight, Mail, Lock, ShoppingBag, ChevronLeft } from "lucide-react";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import OnboardingSurvey from "@/components/onboarding/OnboardingSurvey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { hasOnboarded, savePreferences } = usePreferences();
  const [step, setStep] = useState<"role" | "form">("role");
  const [showSurvey, setShowSurvey] = useState(false);
  const [role, setRole] = useState<UserRole>("personal");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopCategory, setShopCategory] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, password, role, role === "merchant" ? { shopName, shopCategory } : {});
    // Show onboarding survey for personal users who haven't completed it
    if (role === "personal" && !hasOnboarded) {
      setShowSurvey(true);
    } else {
      navigate(role === "merchant" ? "/merchant" : "/");
    }
  };

  if (showSurvey) {
    return (
      <OnboardingSurvey
        onComplete={(prefs) => {
          savePreferences(prefs);
          navigate("/");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="pt-safe px-4 pt-12 pb-6">
        {step === "form" && (
          <button onClick={() => setStep("role")} className="mb-4 flex items-center gap-1 text-muted-foreground">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        <h1 className="text-2xl font-bold text-foreground font-[DM_Serif_Display]">
          {step === "role" ? "Welcome" : role === "merchant" ? "Merchant Login" : "Personal Login"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {step === "role" ? "Choose how you'd like to use the app" : "Sign in to continue"}
        </p>
      </div>

      <div className="flex-1 px-4">
        <AnimatePresence mode="wait">
          {step === "role" ? (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-4"
            >
              {/* Personal */}
              <button
                onClick={() => { setRole("personal"); setStep("form"); }}
                className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-left transition-all active:scale-[0.98] hover:border-primary/40"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-lg">Personal User</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      AI Agent helps you discover, queue, and grab flash deals — all via natural language
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground mt-1" />
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {["AI Agent", "AI Recommendations", "Queue System", "Flash Deals"].map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{tag}</span>
                  ))}
                </div>
              </button>

              {/* Merchant */}
              <button
                onClick={() => { setRole("merchant"); setStep("form"); }}
                className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-left transition-all active:scale-[0.98] hover:border-primary/40"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shrink-0">
                    <Store className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-lg">Merchant</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      AI-powered shop management — smart queue control, flash deals, and analytics insights
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground mt-1" />
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {["AI Analytics", "Smart Queue", "AI Deals", "Dashboard"].map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground font-medium">{tag}</span>
                  ))}
                </div>
              </button>

              {/* Skip */}
              <button
                onClick={() => navigate("/")}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline mt-2 self-center"
              >
                Continue as guest
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              {role === "merchant" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Shop Name</label>
                    <div className="relative">
                      <ShoppingBag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Your shop name"
                        value={shopName}
                        onChange={e => setShopName(e.target.value)}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Category</label>
                    <div className="flex gap-2 flex-wrap">
                      {["Coffee", "Dining", "Barber", "Car Wash", "Other"].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setShopCategory(cat)}
                          className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                            shopCategory === cat
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:border-primary/40"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              <Button type="submit" size="lg" className="mt-4 rounded-xl">
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-2">
                This is a demo — any email/password will work
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
