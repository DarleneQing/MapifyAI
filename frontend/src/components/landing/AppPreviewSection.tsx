import { motion } from "framer-motion";
import screenshot1 from "@/assets/app-screenshot-1.png";
import screenshot2 from "@/assets/app-screenshot-2.png";

const AppPreviewSection = () => {
  return (
    <section className="py-14 sm:py-24 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-lg mx-auto text-center mb-8 sm:mb-12">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-2xl sm:text-3xl font-bold tracking-display mb-3"
        >
          See it in <span className="text-gradient-primary">action</span>
        </motion.h2>
        <p className="text-muted-foreground text-sm">
          AI search, flash deals, transit times, review summary and insights — all in one flow
        </p>
      </div>

      <div className="flex gap-3 sm:gap-6 justify-center items-center max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30, rotate: -3 }}
          whileInView={{ opacity: 1, y: 0, rotate: -3 }}
          viewport={{ once: true }}
          transition={{ type: "spring", bounce: 0 }}
          className="w-36 sm:w-56 md:w-64 shrink-0"
        >
          <div className="rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border-2 border-border shadow-2xl shadow-primary/5">
            <img src={screenshot1} alt="TourAgent AI map view with nearby places" className="w-full" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, rotate: 3 }}
          whileInView={{ opacity: 1, y: 0, rotate: 3 }}
          viewport={{ once: true }}
          transition={{ type: "spring", bounce: 0, delay: 0.1 }}
          className="w-36 sm:w-56 md:w-64 shrink-0"
        >
          <div className="rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border-2 border-border shadow-2xl shadow-accent/5">
            <img src={screenshot2} alt="TourAgent AI place detail with flash deal" className="w-full" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AppPreviewSection;
