export function formatYER(amount: number): string {
  return `${new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 }).format(Math.round(amount))} ر.ي`;
}

export function formatPhone(phone: string): string {
  return phone.replace(/(\d{3})(\d{3})(\d+)/, "$1 $2 $3");
}

export function shortDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ar-YE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function normalizePhone(value: string): string {
  const westernDigits = value.replace(/[٠-٩۰-۹]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹".indexOf(digit) % 10));
  return westernDigits.replace(/[^0-9]/g, "");
}

export function isValidYemeniPhone(value: string): boolean {
  let phone = normalizePhone(value);
  if (phone.startsWith("00967")) phone = phone.slice(5);
  else if (phone.startsWith("967")) phone = phone.slice(3);
  if (phone.startsWith("0")) phone = phone.slice(1);
  return /^7\d{8}$/.test(phone);
}
