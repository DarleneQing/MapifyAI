import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Check, CheckCheck, Zap, Users, Tag, Store } from "lucide-react";
import type { MerchantNotification } from "@/hooks/useNotifications";

interface NotificationCenterProps {
  notifications: MerchantNotification[];
  unreadCount: number;
  latestPush: MerchantNotification | null;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismissToast: () => void;
  onOpenChange?: (open: boolean) => void;
}

const typeConfig: Record<string, { icon: typeof Zap; color: string }> = {
  flash_deal: { icon: Zap, color: "text-destructive" },
  queue_update: { icon: Users, color: "text-amber-600" },
  new_offer: { icon: Tag, color: "text-primary" },
  status_change: { icon: Store, color: "text-emerald-600" },
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationCenter({
  notifications,
  unreadCount,
  latestPush,
  onMarkRead,
  onMarkAllRead,
  onDismissToast,
  onOpenChange,
}: NotificationCenterProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  return (
    <>
      {/* Bell Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => handleOpenChange(true)}
        className={`relative w-11 h-11 rounded-full bg-card border border-border/30 shadow-md flex items-center justify-center ${unreadCount > 0 ? "animate-pulse-warm" : ""}`}
      >
        <Bell className="w-5 h-5 text-primary" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Toast Push Notification */}
      <AnimatePresence>
        {latestPush && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -40, x: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-3 left-3 right-3 z-[900] safe-top"
          >
            <div
              className="bg-card border border-border/60 rounded-2xl shadow-xl p-3 flex items-start gap-2.5 cursor-pointer"
              onClick={() => {
                onDismissToast();
                if (latestPush.actionUrl) navigate(latestPush.actionUrl);
              }}
            >
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-base">{latestPush.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-foreground leading-tight">{latestPush.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{latestPush.body}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDismissToast(); }}
                className="p-1 flex-shrink-0"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Notification Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleOpenChange(false)}
              className="fixed inset-0 z-[800] bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-[801] w-[85vw] max-w-sm bg-background shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 safe-top">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Notifications</h2>
                  <p className="text-[10px] text-muted-foreground">{unreadCount} unread</p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkAllRead}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium text-primary bg-primary/10"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Read all
                    </button>
                  )}
                  <button onClick={() => handleOpenChange(false)} className="p-1.5 rounded-full bg-muted/50">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Bell className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-xs">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif, idx) => {
                    const config = typeConfig[notif.type] || typeConfig.status_change;
                    const Icon = config.icon;
                    return (
                      <motion.div
                        key={notif.id}
                        initial={idx < 3 ? { opacity: 0, x: 20 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx < 3 ? idx * 0.05 : 0 }}
                        className={`px-4 py-3 border-b border-border/30 cursor-pointer transition-colors ${
                          notif.read ? "bg-background" : "bg-primary/3"
                        }`}
                        onClick={() => {
                          onMarkRead(notif.id);
                          if (notif.actionUrl) {
                            handleOpenChange(false);
                            navigate(notif.actionUrl);
                          }
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-sm">{notif.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Icon className={`w-3 h-3 ${config.color} flex-shrink-0`} />
                              <span className="text-[11px] font-bold text-foreground leading-tight truncate">
                                {notif.title}
                              </span>
                              {!notif.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug">{notif.body}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[9px] text-muted-foreground/60">{notif.placeName}</span>
                              <span className="text-[9px] text-muted-foreground/60">{timeAgo(notif.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
