import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Users, Ticket, Clock, TrendingUp, Eye, ShoppingBag,
  Plus, ToggleLeft, ToggleRight, ChevronRight, Zap, LogOut, ChevronLeft, Settings,
  X, PieChart, BarChart2, LineChart, Check, User, Star, RefreshCw, Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MerchantOnboarding, { type MerchantPreferences } from "@/components/merchant/MerchantOnboarding";

const SERVICE_LABELS = [
  { id: "coffee", label: "Coffee" }, { id: "dining", label: "Dining" },
  { id: "barber", label: "Barber & Beauty" }, { id: "car_wash", label: "Car Wash" },
  { id: "fitness", label: "Fitness" }, { id: "spa", label: "Spa & Wellness" },
  { id: "retail", label: "Retail" }, { id: "repair", label: "Repair & Service" },
];
const CUSTOMER_LABELS = [
  { id: "students", label: "Students" }, { id: "families", label: "Families" },
  { id: "professionals", label: "Professionals" }, { id: "tourists", label: "Tourists" },
  { id: "elderly", label: "Elderly" }, { id: "pet_owners", label: "Pet Owners" },
];
const STYLE_LABELS: Record<string, string> = {
  walk_in: "Walk-in Only", appointment: "Appointment", hybrid: "Hybrid",
};

// ── Mock Data ──
const MOCK_STATS_DATA: { key: MetricKey; label: string; value: string; numValue: number; icon: React.ElementType; change: string; color: string }[] = [
  { key: "views", label: "Today Views", value: "342", numValue: 342, icon: Eye, change: "+12%", color: "hsl(var(--primary))" },
  { key: "queue", label: "Queue Size", value: "7", numValue: 7, icon: Users, change: "3 waiting", color: "hsl(var(--accent-foreground))" },
  { key: "transactions", label: "Transactions", value: "28", numValue: 28, icon: ShoppingBag, change: "+5 today", color: "hsl(262 80% 60%)" },
  { key: "revenue", label: "Revenue", value: "CHF 1,240", numValue: 1240, icon: TrendingUp, change: "+18%", color: "hsl(142 70% 45%)" },
];

const MOCK_QUEUE = [
  { id: "q1", name: "Anna M.", position: 1, waitMin: 0, status: "serving" as const },
  { id: "q2", name: "Lucas T.", position: 2, waitMin: 8, status: "waiting" as const },
  { id: "q3", name: "Sarah K.", position: 3, waitMin: 16, status: "waiting" as const },
  { id: "q4", name: "James L.", position: 4, waitMin: 24, status: "waiting" as const },
];

const MOCK_DEALS = [
  { id: "d1", title: "Flash Espresso Deal", discount: "30%", original: "CHF 5.50", price: "CHF 3.85", expires: "2h left", active: true },
  { id: "d2", title: "Lunch Combo Special", discount: "20%", original: "CHF 18", price: "CHF 14.40", expires: "Tomorrow", active: false },
];

const MOCK_VISITORS = [
  { name: "Mia W.", time: "3 min ago", action: "Viewed menu" },
  { name: "Tom B.", time: "12 min ago", action: "Joined queue" },
  { name: "Lisa R.", time: "25 min ago", action: "Used coupon" },
  { name: "Kevin Z.", time: "1h ago", action: "Left a review ★★★★★" },
];

const queueStatusColor = {
  serving: "bg-emerald-500",
  waiting: "bg-amber-400",
};

type ChartType = "cards" | "bar" | "pie" | "line";
type MetricKey = "views" | "queue" | "transactions" | "revenue";

const CHART_OPTIONS: { id: ChartType; icon: React.ElementType; label: string }[] = [
  { id: "cards", icon: BarChart3, label: "Cards" },
  { id: "bar", icon: BarChart2, label: "Bar Chart" },
  { id: "pie", icon: PieChart, label: "Pie Chart" },
  { id: "line", icon: LineChart, label: "Line Chart" },
];

const METRIC_OPTIONS: { id: MetricKey; label: string; icon: React.ElementType }[] = [
  { id: "views", label: "Today Views", icon: Eye },
  { id: "queue", label: "Queue Size", icon: Users },
  { id: "transactions", label: "Transactions", icon: ShoppingBag },
  { id: "revenue", label: "Revenue", icon: TrendingUp },
];

export default function MerchantDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [queueOpen, setQueueOpen] = useState(true);
  const [busyMode, setBusyMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "queue" | "deals" | "visitors">("overview");
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealDiscount, setNewDealDiscount] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [chartType, setChartType] = useState<ChartType>(() => {
    return (localStorage.getItem("merchant_chart_type") as ChartType) || "cards";
  });
  const [visibleMetrics, setVisibleMetrics] = useState<MetricKey[]>(() => {
    const saved = localStorage.getItem("merchant_visible_metrics");
    return saved ? JSON.parse(saved) : ["views", "queue", "transactions", "revenue"];
  });

  // Merchant onboarding: check if first time
  const storageKey = `merchant_onboarded_${user?.shopName || "default"}`;
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(storageKey);
  });
  const [merchantPrefs, setMerchantPrefs] = useState<MerchantPreferences | null>(() => {
    const saved = localStorage.getItem(`${storageKey}_prefs`);
    return saved ? JSON.parse(saved) : null;
  });

  const handleOnboardingComplete = (prefs: MerchantPreferences) => {
    localStorage.setItem(storageKey, "true");
    localStorage.setItem(`${storageKey}_prefs`, JSON.stringify(prefs));
    setMerchantPrefs(prefs);
    setShowOnboarding(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (showOnboarding) {
    return <MerchantOnboarding onComplete={handleOnboardingComplete} onClose={() => setShowOnboarding(false)} />;
  }

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: BarChart3 },
    { key: "queue" as const, label: "Queue", icon: Users },
    { key: "deals" as const, label: "Deals", icon: Ticket },
    { key: "visitors" as const, label: "Visitors", icon: Eye },
  ];

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Profile Header */}
      <div className="bg-card px-4 pt-12 pb-6">
        {/* Top actions row */}
        <div className="flex items-center justify-between mb-6">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/")}
            className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          <div className="flex items-center gap-2">
            <Badge variant={busyMode ? "destructive" : "default"} className="text-xs">
              {busyMode ? "🔴 Busy" : "🟢 Available"}
            </Badge>
            <button onClick={() => setBusyMode(!busyMode)} className="p-2 text-muted-foreground hover:text-foreground">
              {busyMode ? <ToggleRight className="w-5 h-5 text-destructive" /> : <ToggleLeft className="w-5 h-5 text-primary" />}
            </button>
            <button onClick={handleLogout} className="p-2 text-muted-foreground hover:text-foreground" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Avatar + Name */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-3">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-[DM_Serif_Display]">
            {user?.shopName || "My Shop"}
          </h1>
          <p className="text-sm text-muted-foreground">{user?.shopCategory || "Merchant"}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 -mt-1">
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-around">
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">12</p>
            <p className="text-xs text-muted-foreground">Deals</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">7</p>
            <p className="text-xs text-muted-foreground">Queue Today</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">45</p>
            <p className="text-xs text-muted-foreground">Reviews</p>
          </div>
        </div>
      </div>

      {/* Business Profile Card */}
      <div className="px-4 mt-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Business Profile
              </CardTitle>
              <button
                onClick={() => setShowOnboarding(true)}
                className="flex items-center gap-1 px-3 py-1 rounded-full border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Retake
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {merchantPrefs ? (
              <>
                {merchantPrefs.serviceCategories.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {merchantPrefs.serviceCategories.map((id) => {
                        const opt = SERVICE_LABELS.find(s => s.id === id);
                        return opt ? (
                          <span key={id} className="px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium">{opt.label}</span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                {merchantPrefs.targetCustomers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Target Customers</p>
                    <div className="flex flex-wrap gap-1.5">
                      {merchantPrefs.targetCustomers.map((id) => {
                        const opt = CUSTOMER_LABELS.find(c => c.id === id);
                        return opt ? (
                          <span key={id} className="px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium">{opt.label}</span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                {merchantPrefs.operatingStyle && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Operating Style</p>
                    <span className="px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium">
                      {STYLE_LABELS[merchantPrefs.operatingStyle] || merchantPrefs.operatingStyle}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No preferences set. Tap Retake to configure.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 mt-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 mt-4">
        <AnimatePresence mode="wait">
          {/* Overview */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Chart type label */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">
                  {CHART_OPTIONS.find(c => c.id === chartType)?.label || "Cards"} View
                </p>
                <button onClick={() => setShowSettings(true)} className="text-xs text-primary font-medium">Customize</button>
              </div>

              {(() => {
                const filtered = MOCK_STATS_DATA.filter(s => visibleMetrics.includes(s.key));
                if (filtered.length === 0) return <p className="text-center text-sm text-muted-foreground py-8">No metrics selected. Tap Customize to add.</p>;

                if (chartType === "cards") {
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      {filtered.map(stat => (
                        <Card key={stat.key} className="border-border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <stat.icon className="w-4 h-4 text-primary" />
                              <span className="text-xs text-emerald-600 font-medium">{stat.change}</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                }

                if (chartType === "bar") {
                  const max = Math.max(...filtered.map(s => s.numValue));
                  return (
                    <Card className="border-border">
                      <CardContent className="p-4 space-y-3">
                        {filtered.map(stat => (
                          <div key={stat.key}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground">{stat.label}</span>
                              <span className="text-xs font-bold text-foreground">{stat.value}</span>
                            </div>
                            <div className="h-6 bg-muted rounded-lg overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(stat.numValue / max) * 100}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full rounded-lg bg-primary"
                              />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                }

                if (chartType === "pie") {
                  const total = filtered.reduce((s, m) => s + m.numValue, 0);
                  let cumulative = 0;
                  const segments = filtered.map(m => {
                    const pct = (m.numValue / total) * 100;
                    const start = cumulative;
                    cumulative += pct;
                    return { ...m, pct, start };
                  });
                  const gradientParts = segments.map(s => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ");
                  return (
                    <Card className="border-border">
                      <CardContent className="p-4 flex items-center gap-6">
                        <div
                          className="w-28 h-28 rounded-full flex-shrink-0"
                          style={{ background: `conic-gradient(${gradientParts})` }}
                        />
                        <div className="space-y-2 flex-1">
                          {segments.map(s => (
                            <div key={s.key} className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                              <span className="text-xs text-foreground font-medium">{s.label}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{s.pct.toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                if (chartType === "line") {
                  // Mock 7-day trend data
                  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
                  return (
                    <Card className="border-border">
                      <CardContent className="p-4 space-y-4">
                        {filtered.map(stat => {
                          const base = stat.numValue;
                          const points = days.map((_, i) => Math.max(1, base + Math.round((Math.random() - 0.4) * base * 0.3 * (i - 3))));
                          const max = Math.max(...points);
                          const min = Math.min(...points);
                          const range = max - min || 1;
                          return (
                            <div key={stat.key}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-foreground">{stat.label}</span>
                                <span className="text-xs font-bold text-foreground">{stat.value}</span>
                              </div>
                              <div className="flex items-end gap-px h-12">
                                {points.map((v, i) => (
                                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: `${((v - min) / range) * 100}%` }}
                                      transition={{ duration: 0.5, delay: i * 0.05 }}
                                      className="w-full rounded-t-sm bg-primary/70"
                                      style={{ minHeight: 4 }}
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-px mt-0.5">
                                {days.map(d => (
                                  <span key={d} className="flex-1 text-center text-[7px] text-muted-foreground">{d}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                }

                return null;
              })()}

              {/* Quick actions */}
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setActiveTab("deals")} className="rounded-full gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Publish Flash Deal
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setQueueOpen(!queueOpen)} className="rounded-full gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {queueOpen ? "Close Queue" : "Open Queue"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Queue */}
          {activeTab === "queue" && (
            <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Queue ({MOCK_QUEUE.length})</h3>
                <Button
                  size="sm"
                  variant={queueOpen ? "destructive" : "default"}
                  onClick={() => setQueueOpen(!queueOpen)}
                  className="rounded-full text-xs"
                >
                  {queueOpen ? "Close Queue" : "Open Queue"}
                </Button>
              </div>

              {!queueOpen && (
                <div className="text-center py-8 text-muted-foreground text-sm">Queue is currently closed</div>
              )}

              {queueOpen && MOCK_QUEUE.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${queueStatusColor[item.status]}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.status === "serving" ? "Currently serving" : `~${item.waitMin} min wait`}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">#{item.position}</span>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Deals */}
          {activeTab === "deals" && (
            <motion.div key="deals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Flash Deals</h3>
                <Button size="sm" onClick={() => setShowNewDeal(!showNewDeal)} className="rounded-full gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> New Deal
                </Button>
              </div>

              <AnimatePresence>
                {showNewDeal && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <Card className="border-primary/30 border-dashed">
                      <CardContent className="p-4 space-y-3">
                        <Input
                          placeholder="Deal title (e.g. Happy Hour Latte)"
                          value={newDealTitle}
                          onChange={e => setNewDealTitle(e.target.value)}
                        />
                        <Input
                          placeholder="Discount % (e.g. 30)"
                          value={newDealDiscount}
                          onChange={e => setNewDealDiscount(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="rounded-full flex-1">Publish Now ⚡</Button>
                          <Button size="sm" variant="outline" onClick={() => setShowNewDeal(false)} className="rounded-full">Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {MOCK_DEALS.map(deal => (
                <Card key={deal.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <p className="font-semibold text-foreground text-sm">{deal.title}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs line-through text-muted-foreground">{deal.original}</span>
                          <span className="text-sm font-bold text-primary">{deal.price}</span>
                          <Badge variant="secondary" className="text-xs">-{deal.discount}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{deal.expires}</p>
                      </div>
                      <Badge variant={deal.active ? "default" : "outline"} className="text-xs">
                        {deal.active ? "Live" : "Draft"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          )}

          {/* Visitors */}
          {activeTab === "visitors" && (
            <motion.div key="visitors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <h3 className="font-semibold text-foreground">Recent Activity</h3>
              {MOCK_VISITORS.map((v, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {v.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.action}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{v.time}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings Sheet */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl max-h-[75dvh] overflow-y-auto"
            >
              <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Display Settings</h3>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              </div>

              <div className="px-5 py-4 space-y-6">
                {/* Chart Type */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Chart Type</p>
                  <div className="grid grid-cols-4 gap-2">
                    {CHART_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setChartType(opt.id);
                          localStorage.setItem("merchant_chart_type", opt.id);
                        }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          chartType === opt.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card"
                        }`}
                      >
                        <opt.icon className={`w-5 h-5 ${chartType === opt.id ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-[10px] font-medium ${chartType === opt.id ? "text-primary" : "text-muted-foreground"}`}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visible Metrics */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Visible Metrics</p>
                  <div className="space-y-2">
                    {METRIC_OPTIONS.map(metric => {
                      const active = visibleMetrics.includes(metric.id);
                      return (
                        <button
                          key={metric.id}
                          onClick={() => {
                            const updated = active
                              ? visibleMetrics.filter(m => m !== metric.id)
                              : [...visibleMetrics, metric.id];
                            setVisibleMetrics(updated);
                            localStorage.setItem("merchant_visible_metrics", JSON.stringify(updated));
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                            active ? "border-primary bg-primary/10" : "border-border bg-card"
                          }`}
                        >
                          <metric.icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-medium flex-1 text-left ${active ? "text-foreground" : "text-muted-foreground"}`}>{metric.label}</span>
                          {active && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-5 pb-safe pb-6 pt-2">
                <Button className="w-full rounded-xl" onClick={() => setShowSettings(false)}>
                  Done
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
