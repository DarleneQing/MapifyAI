import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gavel, CheckCircle2, ChevronDown } from "lucide-react";

interface BidDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  placeName: string;
  priceLevel: string;
}

const SERVICES = [
  "Haircut & Style",
  "Full Service",
  "Quick Wash",
  "Premium Package",
  "Custom Request",
];

export default function BidDrawer({ isOpen, onClose, placeName, priceLevel }: BidDrawerProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [selectedService, setSelectedService] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [showServices, setShowServices] = useState(false);

  const handleSubmit = () => {
    if (!selectedService || !amount) return;
    setStep("success");
    setTimeout(() => {
      setStep("form");
      setSelectedService("");
      setAmount("");
      setNotes("");
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    setStep("form");
    setSelectedService("");
    setAmount("");
    setNotes("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl max-h-[80dvh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted" />
            </div>

            {step === "form" ? (
              <div className="px-5 pb-8 overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Gavel className="w-5 h-5 text-primary" />
                      Place a Bid
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {placeName} · Avg. {priceLevel}
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleClose}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                </div>

                {/* Service selector */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">
                    Service
                  </label>
                  <button
                    onClick={() => setShowServices(!showServices)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground"
                  >
                    <span className={selectedService ? "text-foreground" : "text-muted-foreground"}>
                      {selectedService || "Select a service"}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showServices ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {showServices && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 rounded-xl border border-border bg-card overflow-hidden">
                          {SERVICES.map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                setSelectedService(s);
                                setShowServices(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                selectedService === s
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-foreground hover:bg-muted/50"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Bid amount */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">
                    Your Bid Amount
                  </label>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-card">
                    <span className="text-sm font-semibold text-foreground">$</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">
                    Notes <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any preferences or special requests..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
                  />
                </div>

                {/* Submit */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={!selectedService || !amount}
                  className={`w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    selectedService && amount
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Gavel className="w-4 h-4" />
                  Submit Bid
                </motion.button>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 px-5"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
                </motion.div>
                <h3 className="text-lg font-bold text-foreground mb-1">Bid Submitted!</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Your ${amount} bid for {selectedService} at {placeName} has been sent.
                </p>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
