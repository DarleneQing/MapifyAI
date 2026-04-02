import { motion } from "framer-motion";
import screenshot1 from "@/assets/app-screenshot-1.png";
import screenshot2 from "@/assets/app-screenshot-2.png";

const AppPreviewSection = () => {
  return (
    <section className="py-14 sm:py-24 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-2xl sm:text-3xl font-bold tracking-display mb-3"
        >
          See it in <span className="text-gradient-primary">action</span>
        </motion.h2>
        <p className="text-muted-foreground text-sm">
          AI search · flash deals · transit times · review summaries — all in one flow
        </p>
      </div>

      <div className="flex gap-2 sm:gap-5 justify-center items-center max-w-4xl mx-auto">
        {/* Left — map view, tilted left */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotate: -4 }}
          whileInView={{ opacity: 1, y: 0, rotate: -4 }}
          viewport={{ once: true }}
          transition={{ type: "spring", bounce: 0 }}
          className="w-28 sm:w-44 md:w-52 shrink-0"
        >
          <div className="rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border-2 border-border shadow-2xl shadow-primary/5">
            <img src={screenshot1} alt="Mapify AI map view with nearby places" className="w-full" />
          </div>
        </motion.div>

        {/* Center — AI recommendations, straight and slightly larger */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", bounce: 0, delay: 0.1 }}
          className="w-36 sm:w-52 md:w-64 shrink-0 z-10"
        >
          <div className="rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border-2 border-primary/30 shadow-2xl shadow-primary/15">
            <img src="/app-screenshot-3.png" alt="Mapify AI recommendations with discovery results" className="w-full" />
          </div>
        </motion.div>

        {/* Right — place detail, tilted right */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotate: 4 }}
          whileInView={{ opacity: 1, y: 0, rotate: 4 }}
          viewport={{ once: true }}
          transition={{ type: "spring", bounce: 0, delay: 0.2 }}
          className="w-28 sm:w-44 md:w-52 shrink-0"
        >
          <div className="rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border-2 border-border shadow-2xl shadow-accent/5">
            <img src={screenshot2} alt="Mapify AI place detail with flash deal" className="w-full" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AppPreviewSection;
