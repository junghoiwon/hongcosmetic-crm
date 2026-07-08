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
