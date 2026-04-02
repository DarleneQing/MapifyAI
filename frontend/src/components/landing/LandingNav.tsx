import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const LandingNav = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/90 backdrop-blur-md border-b border-border/60 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Mapify AI" className="h-8 w-8 object-contain" />
          <span className="font-bold text-base tracking-tight text-foreground">
            Mapify AI
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate("/")}
          className="h-8 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs glow-primary transition-all hover:scale-105 active:scale-95"
        >
          Try Demo →
        </button>
      </div>
    </motion.header>
  );
};

export default LandingNav;
