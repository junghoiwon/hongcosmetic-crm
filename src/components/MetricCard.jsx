import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useElementSize, getCardTier } from "../lib/useElementSize";

const ACCENTS = {
  jade: { chip: "bg-jade-50 text-jade-600", solid: "bg-jade-600 text-white" },
  clay: { chip: "bg-clay-50 text-clay-600", solid: "bg-clay-500 text-white" },
  gold: { chip: "bg-gold-400/15 text-gold-500", solid: "bg-gold-400 text-white" },
};

function TrendBadge({ trend }) {
  if (!trend) return null;
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const color =
    trend.direction === "up" ? "bg-jade-50 text-jade-600" : trend.direction === "down" ? "bg-clay-50 text-clay-600" : "bg-line text-subink";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full shrink-0 ${color}`}>
      <Icon size={11} />
      {trend.value}
    </span>
  );
}

function MiniBars({ history }) {
  const max = Math.max(1, ...history.map((h) => h.value));
  return (
    <div className="flex items-end gap-1.5 h-12">
      {history.map((h, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h.label}: ${h.value}`}>
          <div
            className="w-full rounded-t bg-jade-500/70"
            style={{ height: `${Math.max(6, (h.value / max) * 100)}%`, minHeight: 3 }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * 크기에 맞춰 내부 레이아웃이 자동으로 바뀌는 통계/KPI 카드.
 * - small: 제목 + 값만 (여백 위주)
 * - medium: 아이콘 카드안카드 + 값 + 증감률 배지
 * - large/full: + 전월/이번달 비교, 실데이터 기반 상세 목록, (full일 때) 미니 막대그래프
 *
 * trend/compare/breakdown/history는 전부 선택 값이며, 실제로 계산 가능한 값이 있을
 * 때만 넘겨줍니다(가짜 수치를 만들어 채우지 않음).
 */
export default function MetricCard({
  label,
  value,
  icon: Icon,
  accent = "jade",
  onClick,
  trend, // { value: "+12%", direction: "up" | "down" | "flat", note: "전월 대비" }
  compare, // { prevLabel, prevValue, curLabel, curValue }
  breakdown, // [{ label, value }]
  breakdownTitle,
  history, // [{ label, value }] — full 크기일 때 미니 막대그래프
}) {
  const [ref, size] = useElementSize();
  const tier = getCardTier(size.width, size.height);
  const a = ACCENTS[accent] || ACCENTS.jade;

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`w-full h-full flex flex-col text-left bg-white border border-line rounded-card shadow-card overflow-hidden transition-transform ${
        onClick ? "hover:-translate-y-0.5 cursor-pointer" : "cursor-default"
      } ${tier === "small" ? "justify-center p-5" : "p-4"}`}
    >
      {tier === "small" && (
        <div className="min-w-0">
          <p className="text-sm text-subink truncate">{label}</p>
          <p className="font-display text-3xl font-semibold text-ink truncate mt-1">{value}</p>
        </div>
      )}

      {tier !== "small" && (
        <div className="flex flex-col h-full min-h-0 gap-3">
          <div
            className={`rounded-lg border border-line/70 bg-porcelain/50 p-3 flex flex-col gap-2 ${
              tier === "medium" ? "" : "shrink-0"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {Icon && (
                  <span className={`p-1.5 rounded-md shrink-0 ${a.chip}`}>
                    <Icon size={14} />
                  </span>
                )}
                <span className="text-xs text-subink truncate">{label}</span>
              </div>
              {tier === "medium" && <TrendBadge trend={trend} />}
            </div>
            <p className="font-display text-2xl font-semibold text-ink truncate">{value}</p>
            {tier === "medium" && trend?.note && <p className="text-[11px] text-subink">{trend.note}</p>}
            {tier !== "medium" && trend && (
              <div className="flex items-center gap-1.5">
                <TrendBadge trend={trend} />
                {trend.note && <span className="text-[11px] text-subink">{trend.note}</span>}
              </div>
            )}
          </div>

          {(tier === "large" || tier === "full") && compare && (
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <div className="rounded-lg bg-porcelain/60 px-3 py-2">
                <p className="text-[11px] text-subink">{compare.prevLabel}</p>
                <p className="text-sm font-semibold text-ink truncate">{compare.prevValue}</p>
              </div>
              <div className={`rounded-lg px-3 py-2 ${a.chip}`}>
                <p className="text-[11px] opacity-80">{compare.curLabel}</p>
                <p className="text-sm font-semibold truncate">{compare.curValue}</p>
              </div>
            </div>
          )}

          {tier === "full" && history && history.length > 0 && (
            <div className="shrink-0">
              <MiniBars history={history} />
            </div>
          )}

          {(tier === "large" || tier === "full") && breakdown && breakdown.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto -mx-1">
              {breakdownTitle && <p className="text-[11px] font-medium text-subink px-1 mb-1">{breakdownTitle}</p>}
              <ul>
                {breakdown.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-porcelain/60"
                  >
                    <span className="text-ink truncate">{b.label}</span>
                    <span className="text-subink shrink-0">{b.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
