import { useLocation, useNavigate } from "react-router-dom";
import { Compass, Heart, User, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useChatContext } from "@/contexts/ChatContext";

const tabs = [
  { path: "/", icon: Compass, label: "Home" },
  { path: "/explore", icon: Search, label: "Explore" },
  { path: "/saved", icon: Heart, label: "Saved" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lastSearchResults } = useChatContext();

  const handleTabClick = (tabPath: string) => {
    if (tabPath === "/explore") {
      // If we have AI search results, go to recommendations; otherwise go to explore
      if (lastSearchResults.length > 0) {
        navigate("/recommendations");
      } else {
        navigate("/explore");
      }
    } else {
      navigate(tabPath);
    }
  };

  const isTabActive = (tabPath: string) => {
    if (tabPath === "/explore") {
      // Explore tab is active for both /explore and /recommendations
      return location.pathname === "/explore" || location.pathname === "/recommendations";
    }
    return location.pathname === tabPath;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
      <div className="bg-background/95 backdrop-blur-lg border-t border-border/50">
        <div className="flex items-center justify-around px-4 py-2 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const isActive = isTabActive(tab.path);

            return (
              <motion.button
                key={tab.path}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleTabClick(tab.path)}
                className="flex flex-col items-center gap-0.5 py-1 px-3"
              >
                <tab.icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground/60"
                  }`}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                <span
                  className={`text-[10px] transition-colors ${
                    isActive ? "text-foreground font-medium" : "text-muted-foreground/60"
                  }`}
                >
                  {tab.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
