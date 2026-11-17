export type BranchCode = "dream-city-main" | "crispy-meals";

export type RestaurantBranch = {
  code: BranchCode;
  name: string;
  address: string;
  serviceType: string;
  lat: number | null;
  lng: number | null;
};

export const RESTAURANT_BRANCHES: RestaurantBranch[] = [
  {
    code: "dream-city-main",
    name: "المركز الرئيسي: مطاعم دريم سيتي",
    address: "تعز - الحوبان - أمام حديقة دريم لاند",
    serviceType: "متكامل (صالة عوائل، صالة شباب، سفري، وتوصيل)",
    lat: null,
    lng: null,
  },
  {
    code: "crispy-meals",
    name: "كرسبي ميلز (Crispy Meals)",
    address: "تعز - الحوبان - أمام حديقة الحيوانات - مول جوهرة تعز - الدور الرابع",
    serviceType: "وجبات سريعة، سفري، وتوصيل",
    lat: null,
    lng: null,
  },
];

export const DELIVERY_PHONES = ["774888018", "733666828"] as const;
export const CUSTOMER_SERVICE_PHONES = ["771010207", "04285756"] as const;

export const ORDER_STATUSES = [
  { key: "pending", label: "قيد المراجعة", color: "#d97706" },
  { key: "preparing", label: "قيد التحضير", color: "#2563eb" },
  { key: "ready", label: "جاهز", color: "#7c3aed" },
  { key: "out_for_delivery", label: "في الطريق", color: "#0f766e" },
  { key: "completed", label: "تم التسليم", color: "#15803d" },
] as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: "مدير عام",
  manager: "مدير فرع",
  cashier: "كاشير",
  chef: "شيف مطبخ",
  driver: "موصل طلبات",
  accountant: "محاسب",
  customer: "عميل",
  user: "عميل",
  waiter: "مضيف صالة",
  inventory: "مسؤول مخزون",
};
