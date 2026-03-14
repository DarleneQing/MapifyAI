import { useState, useEffect, useCallback, useRef } from "react";

export type NotificationType = "flash_deal" | "queue_update" | "new_offer" | "status_change";

export interface MerchantNotification {
  id: string;
  type: NotificationType;
  placeId: string;
  placeName: string;
  title: string;
  body: string;
  icon: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

const NOTIFICATION_TEMPLATES: Omit<MerchantNotification, "id" | "timestamp" | "read">[] = [
  {
    type: "flash_deal",
    placeId: "p1",
    placeName: "The Ground Brew",
    title: "⚡ New Flash Deal!",
    body: "Espresso Happy Hour — 40% off for the next hour!",
    icon: "☕",
    actionUrl: "/place/p1",
  },
  {
    type: "queue_update",
    placeId: "p3",
    placeName: "Velvet Crumb",
    title: "🟢 Queue cleared!",
    body: "No wait right now — perfect time to visit!",
    icon: "🍞",
    actionUrl: "/place/p3",
  },
  {
    type: "flash_deal",
    placeId: "p5",
    placeName: "The Sage Bistro",
    title: "⚡ Limited: Dinner Set -30%",
    body: "Only 8 spots left for tonight's dinner set menu deal!",
    icon: "🍽",
    actionUrl: "/place/p5",
  },
  {
    type: "queue_update",
    placeId: "p7",
    placeName: "Sharp Edge Barber",
    title: "🔴 Queue getting longer",
    body: "7 people in queue · ~20 min wait. Join now to hold your spot!",
    icon: "✂️",
    actionUrl: "/place/p7",
  },
  {
    type: "new_offer",
    placeId: "p9",
    placeName: "Fresh Auto Wash",
    title: "🚗 Premium Wash -50%",
    body: "Flash deal just dropped! Only 3 spots remaining.",
    icon: "🚗",
    actionUrl: "/place/p9",
  },
  {
    type: "status_change",
    placeId: "p10",
    placeName: "Grand View Hotel",
    title: "🏨 Now accepting walk-ins",
    body: "Rooftop pool access available — no reservation needed today!",
    icon: "🏨",
    actionUrl: "/place/p10",
  },
  {
    type: "flash_deal",
    placeId: "p4",
    placeName: "Origin Roast",
    title: "⚡ Buy 1 Get 1 Free",
    body: "Single-origin pour-over special for the next 30 min!",
    icon: "☕",
    actionUrl: "/place/p4",
  },
  {
    type: "queue_update",
    placeId: "p2",
    placeName: "Komorebi Tables",
    title: "🟡 Moderate wait",
    body: "4 people ahead · ~10 min. A window seat just opened!",
    icon: "🍽",
    actionUrl: "/place/p2",
  },
];

export function useNotifications() {
  const [notifications, setNotifications] = useState<MerchantNotification[]>([]);
  const [latestPush, setLatestPush] = useState<MerchantNotification | null>(null);
  const templateIdx = useRef(0);
  const timerRef = useRef<number | null>(null);

  // Simulate merchant pushes - DISABLED for prototyping
  // Uncomment to enable fake notification simulation
  // useEffect(() => {
  //   const scheduleNext = () => {
  //     const delay = 12000 + Math.random() * 8000;
  //     timerRef.current = window.setTimeout(() => {
  //       const template = NOTIFICATION_TEMPLATES[templateIdx.current % NOTIFICATION_TEMPLATES.length];
  //       templateIdx.current++;
  //       const notif: MerchantNotification = {
  //         ...template,
  //         id: `notif-${Date.now()}`,
  //         timestamp: Date.now(),
  //         read: false,
  //       };
  //       setNotifications((prev) => [notif, ...prev].slice(0, 50));
  //       setLatestPush(notif);
  //       setTimeout(() => setLatestPush(null), 4000);
  //       scheduleNext();
  //     }, delay);
  //   };
  //   timerRef.current = window.setTimeout(() => {
  //     const template = NOTIFICATION_TEMPLATES[0];
  //     templateIdx.current = 1;
  //     const notif: MerchantNotification = {
  //       ...template,
  //       id: `notif-${Date.now()}`,
  //       timestamp: Date.now(),
  //       read: false,
  //     };
  //     setNotifications([notif]);
  //     setLatestPush(notif);
  //     setTimeout(() => setLatestPush(null), 4000);
  //     scheduleNext();
  //   }, 5000);
  //   return () => {
  //     if (timerRef.current) clearTimeout(timerRef.current);
  //   };
  // }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissToast = useCallback(() => {
    setLatestPush(null);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, latestPush, markRead, markAllRead, dismissToast };
}
