import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const steps = [
  { label: "Intent Parsed", description: "Understanding your vague request", color: "primary" },
  { label: "Stores Crawled", description: "Searching real local businesses", color: "primary" },
  { label: "Transit Computed", description: "Calculating SBB travel times", color: "primary" },
  { label: "Reviews Analysed", description: "Summarising strengths & trade-offs from real reviews", color: "primary" },
  { label: "Scores Computed", description: "Ranking by your preferences", color: "accent" },
];

const PipelineSection = () => {
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          let i = 0;
          const interval = setInterval(() => {
            setActiveStep(i);
            i++;
            if (i >= steps.length) {
              clearInterval(interval);
              setTimeout(() => setActiveStep(steps.length), 600);
            }
          }, 800);
        }
      },
      { threshold: 0.5 }
    );

    const el = document.getElementById("pipeline-section");
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="pipeline-section" className="py-14 sm:py-24 px-6">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-8 sm:mb-12 text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-bold tracking-display mb-3">
            How the <span className="text-gradient-primary">engine</span> works
          </h2>
          <p className="text-muted-foreground text-sm">
            Your vague prompt → structured AI pipeline → actionable results
          </p>
        </motion.div>

        <div className="space-y-6">
          {steps.map((step, i) => {
            const isActive = i <= activeStep;
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0.3, x: -10 }}
                animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0.3, x: -10 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                className="flex items-start gap-4"
              >
                <div className="flex flex-col items-center mt-1">
                  <div
                    className={`h-3 w-3 rounded-full transition-all duration-500 ${
                      isActive ? "bg-primary glow-primary" : "bg-muted"
                    }`}
                  />
                  {i < steps.length - 1 && (
                    <div
                      className={`w-px h-10 mt-1 transition-colors duration-500 ${
                        i < activeStep ? "bg-border" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
                <div>
                  <span
                    className={`text-sm font-semibold transition-colors duration-300 ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                  <p
                    className={`text-xs mt-0.5 transition-colors duration-300 ${
                      isActive ? "text-muted-foreground" : "text-muted"
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {activeStep >= steps.length && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 glass-surface rounded-2xl p-4 text-center"
          >
            <span className="text-accent-foreground text-sm font-semibold">✓ Recommendations ready</span>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default PipelineSection;
