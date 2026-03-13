import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, CheckCircle, X, ArrowDown } from "lucide-react";
import type { QueueInfo, UserQueuePosition } from "@/hooks/useQueueStatus";

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  placeName: string;
  placeId: string;
  queueInfo: QueueInfo | null;
  userQueue: UserQueuePosition | null;
  onJoin: () => void;
  onLeave: () => void;
}

const levelConfig = {
  low: { label: "No Wait", color: "bg-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
  medium: { label: "Moderate", color: "bg-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" },
  busy: { label: "Busy", color: "bg-destructive", textColor: "text-destructive", bgColor: "bg-destructive/10", borderColor: "border-destructive/20" },
};

export default function QueueDrawer({ isOpen, onClose, placeName, placeId, queueInfo, userQueue, onJoin, onLeave }: QueueDrawerProps) {
  const isInThisQueue = userQueue?.placeId === placeId;
  const level = queueInfo?.level || "low";
  const config = levelConfig[level];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl max-h-[70vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            <div className="px-5 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">QUEUE STATUS</p>
                  <h3 className="text-lg font-bold text-foreground">{placeName}</h3>
                </div>
                <button onClick={onClose} className="p-2 rounded-full bg-muted/50">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Queue Status Card */}
              <div className={`rounded-2xl border ${config.borderColor} ${config.bgColor} p-4 mb-4`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-3 h-3 rounded-full ${config.color} ${level !== "low" ? "animate-pulse" : ""}`} />
                  <span className={`text-sm font-bold ${config.textColor}`}>{config.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background/60 rounded-xl p-3 text-center">
                    <Users className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xl font-bold text-foreground">{queueInfo?.peopleAhead ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">People ahead</p>
                  </div>
                  <div className="bg-background/60 rounded-xl p-3 text-center">
                    <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xl font-bold text-foreground">~{queueInfo?.waitMinutes ?? 0}<span className="text-xs font-normal">min</span></p>
                    <p className="text-[10px] text-muted-foreground">Est. wait</p>
                  </div>
                </div>
              </div>

              {/* User Queue Position */}
              {isInThisQueue && userQueue && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-primary/20 bg-primary/5 p-4 mb-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-primary">You're in the queue!</span>
                  </div>

                  {/* Visual position indicator */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 relative">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: "0%" }}
                          animate={{ width: `${Math.max(10, 100 - (userQueue.position / (queueInfo?.peopleAhead || 1 + 1)) * 100)}%` }}
                          transition={{ type: "spring", damping: 20 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-foreground">#{userQueue.position}</p>
                      <p className="text-[11px] text-muted-foreground">Your position</p>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ArrowDown className="w-3 h-3" />
                      <span className="text-[11px]">~{userQueue.estimatedWaitMinutes} min remaining</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Action Button */}
              {isInThisQueue ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onLeave}
                  className="w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Leave Queue
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onJoin}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Join Queue · Position #{(queueInfo?.peopleAhead ?? 0) + 1}
                </motion.button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
