export type Lang = "en" | "zh";

interface TranslationStrings {
  greeting: string;
  subtitle: string;
  searchPlaceholder: string;
  quickAccess: string;
  chips: string[];
  resultsTitle: string;
  resultsCount: (n: number) => string;
  searching: string;
  loading: string;
  back: string;
  located: string;
  locating: string;
  whyThis: string;
  open: string;
  closingSoon: string;
  closed: string;
  settings: string;
  profile: string;
  preferences: string;
  completeSurvey: string;
  priceFirst: string;
  distanceFirst: string;
  ratingFirst: string;
  privacy: string;
  privacyNote: string;
}

const translations: Record<Lang, TranslationStrings> = {
  en: {
    greeting: "How can I help you today?",
    subtitle: "Find any service or book an appointment instantly.",
    searchPlaceholder: "Ask me anything... (e.g., find a barber nearby)",
    quickAccess: "QUICK ACCESS",
    chips: ["Barber", "Car Wash", "Dining", "Coffee", "Hotels"],
    resultsTitle: "DISCOVERY RESULTS",
    resultsCount: (n: number) => `${n} results`,
    searching: "Searching...",
    loading: "Loading",
    back: "← Back",
    located: "Located",
    locating: "Locating...",
    whyThis: "Why this?",
    open: "Open",
    closingSoon: "Closing soon",
    closed: "Closed",
    settings: "Settings",
    profile: "Profile",
    preferences: "Preferences",
    completeSurvey: "Complete preference survey →",
    priceFirst: "Price priority",
    distanceFirst: "Distance priority",
    ratingFirst: "Rating priority",
    privacy: "Privacy",
    privacyNote: "We only collect location data for recommendations. Data is encrypted and never shared with third parties.",
  },
  zh: {
    greeting: "今天需要什么帮助？",
    subtitle: "搜索附近的餐厅、咖啡馆、景点...",
    searchPlaceholder: "搜索地点...",
    quickAccess: "快速访问",
    chips: ["理发店", "洗车", "美食", "咖啡", "酒店"],
    resultsTitle: "发现结果",
    resultsCount: (n: number) => `${n} 个结果`,
    searching: "搜索中...",
    loading: "加载中",
    back: "← 返回",
    located: "已定位",
    locating: "定位中...",
    whyThis: "为什么推荐？",
    open: "营业中",
    closingSoon: "即将关门",
    closed: "已关门",
    settings: "设置",
    profile: "用户画像",
    preferences: "偏好调节",
    completeSurvey: "完成偏好问卷 →",
    priceFirst: "价格优先",
    distanceFirst: "距离优先",
    ratingFirst: "评分优先",
    privacy: "隐私说明",
    privacyNote: "我们仅收集位置信息用于推荐，数据加密存储，不会分享给第三方。",
  },
} as const;

export type Translations = TranslationStrings;
export default translations;
