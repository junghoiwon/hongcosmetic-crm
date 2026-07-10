export function formatNumber(n) {
  if (n === null || n === undefined || n === "") return "-";
  return Number(n).toLocaleString("ko-KR");
}

export function formatMoney(n, currency = "KRW") {
  if (n === null || n === undefined || n === "") return "-";
  const num = Number(n);
  if (currency === "USD") return `$${num.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `₩${num.toLocaleString("ko-KR")}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function daysFromToday(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayISO());
  const target = new Date(dateStr);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function dDayLabel(dateStr) {
  const diff = daysFromToday(dateStr);
  if (diff === null) return "";
  if (diff === 0) return "D-DAY";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

/** 판매 실적 등에서 쓰는 기간 필터 옵션. */
export const PERIOD_OPTIONS = [
  { value: "all", label: "전체 기간" },
  { value: "3m", label: "최근 3개월" },
  { value: "6m", label: "최근 6개월" },
  { value: "year", label: "올해" },
];

/** dateStr이 주어진 기간(period) 안에 포함되는지 확인합니다. */
export function isWithinPeriod(dateStr, period) {
  if (period === "all" || !dateStr) return true;
  const date = new Date(dateStr);
  const now = new Date();
  if (period === "year") return date.getFullYear() === now.getFullYear();
  const months = period === "3m" ? 3 : 6;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return date >= cutoff;
}

/** 금액 배열을 통화별로 합산합니다. amountKey/currencyKey로 필드명을 지정할 수 있습니다. */
export function sumAmountsByCurrency(rows, amountKey = "totalAmount", currencyKey = "currency") {
  const map = {};
  for (const row of rows) {
    const currency = row[currencyKey] || "KRW";
    map[currency] = (map[currency] || 0) + (row[amountKey] || 0);
  }
  return map;
}

/** { KRW: 1000, USD: 50 } 형태를 "₩1,000 · $50" 같은 문자열로 만듭니다. */
export function formatMultiCurrencyTotal(amountsByCurrency) {
  const entries = Object.entries(amountsByCurrency).filter(([, amount]) => amount > 0);
  if (entries.length === 0) return "0원";
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ");
}

/** #RRGGBB 형태의 hex 색상을 rgba(...) 문자열로 변환합니다. 브랜드 컬러의 옅은 배경톤을 만들 때 사용합니다. */
export function withAlpha(hex, alpha = 0.12) {
  if (!hex) return `rgba(47,111,98,${alpha})`;
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
