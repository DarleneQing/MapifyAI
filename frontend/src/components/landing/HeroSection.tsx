import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/zurich-hero.jpg";

const prompts = [
  "Find a quiet cafe for a date...",
  "Cheap haircut open now near me...",
  "Best brunch spot with outdoor seating...",
  "Late night ramen under 25 CHF...",
  "Pet-friendly bar with live music...",
];

const HeroSection = () => {
  const navigate = useNavigate();
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const target = prompts[currentPrompt];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayedText.length < target.length) {
      timeout = setTimeout(() => setDisplayedText(target.slice(0, displayedText.length + 1)), 60);
    } else if (!isDeleting && displayedText.length === target.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && displayedText.length > 0) {
      timeout = setTimeout(() => setDisplayedText(displayedText.slice(0, -1)), 30);
    } else if (isDeleting && displayedText.length === 0) {
      setIsDeleting(false);
      setCurrentPrompt((prev) => (prev + 1) % prompts.length);
    }

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, currentPrompt]);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={heroImage} alt="" className="w-full h-full object-cover opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto text-center">
        {/* Logo & Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-5 sm:mb-8"
        >
          <div className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 mb-5 sm:mb-8">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Built at GenAI Zurich Hackathon 2026</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-display leading-[1.1] mb-3 sm:mb-4">
            The city,{" "}
            <span className="text-gradient-primary">ranked</span>
            <br />
            for you.
          </h1>

          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-md mx-auto">
            Stop switching apps. Mapify turns Google Maps searches into "I'm going to..." in seconds.
          </p>
        </motion.div>

        {/* Search Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full mb-5 sm:mb-8"
        >
          <div className="relative h-14 sm:h-16 w-full rounded-2xl glass-surface flex items-center px-5 gap-3">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-sm sm:text-base truncate">
              {displayedText}
              <span className="animate-pulse-glow text-primary">|</span>
            </span>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <button
            onClick={() => navigate("/")}
            className="h-12 px-8 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm glow-primary transition-all hover:scale-105 active:scale-95"
          >
            Try Demo →
          </button>
          <p className="mt-4 text-xs text-muted-foreground">
            Real-time SBB transit data · AI-summarized reviews · One-tap virtual queue
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
