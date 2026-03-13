import { useState } from "react";
import { ArrowRight, Paperclip, Mic } from "lucide-react";
import { motion } from "framer-motion";
import { useLang } from "@/i18n/LanguageContext";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching?: boolean;
}

export default function SearchBar({ onSearch, isSearching }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const { t } = useLang();

  const handleSubmit = () => {
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleChipClick = (chip: string) => {
    onSearch(chip);
  };

  const chipIcons: Record<string, string> = {
    Barber: "✂️",
    "Car Wash": "🚗",
    Dining: "🍽",
    Coffee: "☕",
    Hotels: "🏨",
    "理发店": "✂️",
    "洗车": "🚗",
    "美食": "🍽",
    "咖啡": "☕",
    "酒店": "🏨",
  };

  return (
    <motion.div
      className="w-full max-w-sm mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Greeting */}
      <motion.h1
        className="text-2xl font-bold text-foreground mb-1 text-center"
        style={{ fontFamily: "'DM Serif Display', 'Noto Serif SC', serif" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {t.greeting}
      </motion.h1>
      <motion.p
        className="text-sm text-muted-foreground mb-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {t.subtitle}
      </motion.p>

      {/* Search Input Card */}
      <motion.div
        className={`rounded-2xl bg-card border border-border/60 overflow-hidden transition-all duration-300 shadow-sm ${
          isFocused ? "ring-1 ring-primary/20 shadow-md" : ""
        }`}
        layout
      >
        <div className="px-4 pt-4 pb-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={t.searchPlaceholder}
            rows={3}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none leading-relaxed"
            disabled={isSearching}
          />
        </div>
        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Paperclip className="w-4 h-4 text-muted-foreground/60" />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Mic className="w-4 h-4 text-muted-foreground/60" />
            </button>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSubmit}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              query.trim()
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
            disabled={isSearching || !query.trim()}
          >
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>

      {/* Quick Access Chips */}
      <motion.div
        className="mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-2.5">
          {t.quickAccess}
        </p>
        <div className="flex gap-2 flex-wrap">
          {t.chips.map((chip, i) => (
            <motion.button
              key={chip}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleChipClick(chip)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card text-foreground text-xs font-medium whitespace-nowrap hover:bg-secondary transition-colors border border-border/60 shadow-sm"
            >
              <span className="text-sm">{chipIcons[chip] || "📍"}</span>
              {chip}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
