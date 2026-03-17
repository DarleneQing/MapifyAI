import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-14 sm:py-24 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-lg mx-auto text-center"
      >
        <div className="glass-surface rounded-3xl p-6 sm:p-10">
          <MapPin className="h-8 w-8 sm:h-10 sm:w-10 text-primary mx-auto mb-4 sm:mb-6" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-display mb-3">
            Map your vibe.
            <br />
            <span className="text-gradient-accent">Amplify your life.</span>
          </h2>
          <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">
            Join students, travelers, and city explorers who stopped switching apps and started living.
          </p>
          <button
            onClick={() => navigate("/")}
            className="h-12 px-8 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm glow-primary transition-all hover:scale-105 active:scale-95"
          >
            Try Demo →
          </button>
          <p className="mt-4 text-xs text-muted-foreground">
            Free for users · Coming to Zurich first
          </p>
        </div>
      </motion.div>

      {/* Footer */}
      <div className="max-w-lg mx-auto mt-10 sm:mt-16 text-center">
        <p className="text-xs text-muted-foreground">
          © 2026 TourAgent · Built with ♥ at GenAI Zurich Hackathon 2026
        </p>
      </div>
    </section>
  );
};

export default CTASection;
