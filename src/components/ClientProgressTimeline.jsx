import { Check } from "lucide-react";
import { formatDate } from "../lib/utils";
import Badge from "./ui/Badge";

// 거래처 진행 단계의 "정상 경로" 순서입니다. 보류/실패는 예외 상태라
// 노선도에는 포함하지 않고 별도 배지로만 표시합니다.
const STAGE_ORDER = ["신규문의", "상담중", "샘플발송", "견적발송", "인허가검토", "발주대기", "출고완료"];
const EXCEPTION_STATUSES = ["보류", "실패"];

function firstDateReached(historyRows, stage) {
  const matches = historyRows
    .filter((h) => h.status === stage)
    .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
  return matches.length ? matches[0].changed_at : null;
}

export default function ClientProgressTimeline({ client, historyRows, onClick }) {
  const isException = EXCEPTION_STATUSES.includes(client.status);
  const statusIndex = STAGE_ORDER.indexOf(client.status);

  const reachedIndexes = historyRows
    .map((h) => STAGE_ORDER.indexOf(h.status))
    .filter((i) => i >= 0);
  const currentIndex = isException
    ? reachedIndexes.length
      ? Math.max(...reachedIndexes)
      : -1
    : statusIndex;

  return (
    <div
      onClick={onClick}
      className="py-4 px-5 border-t border-line first:border-t-0 hover:bg-porcelain/40 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-ink truncate">{client.companyName}</p>
          <span className="text-xs text-subink shrink-0">{client.country}</span>
        </div>
        {isException && <Badge className="bg-clay-50 text-clay-600 shrink-0">{client.status}</Badge>}
      </div>

      <div className="flex items-start">
        {STAGE_ORDER.map((stage, i) => {
          const date = firstDateReached(historyRows, stage);
          const isCurrent = i === currentIndex && !isException;
          const isCompleted = i < currentIndex || (i === currentIndex && isException);
          const isFilled = isCompleted || isCurrent;

          return (
            <div key={stage} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <div
                  className={`absolute top-[7px] h-0.5 ${i <= currentIndex ? "bg-jade-500" : "bg-line"}`}
                  style={{ right: "50%", width: "100%" }}
                />
              )}
              <span className="relative flex items-center justify-center w-4 h-4 z-10">
                {isCurrent && (
                  <span className="absolute inline-flex h-4 w-4 rounded-full bg-jade-400 opacity-75 animate-ping" />
                )}
                <span
                  className={`relative w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                    isFilled ? "bg-jade-500 border-jade-500" : "bg-white border-line"
                  }`}
                >
                  {isCompleted && <Check size={9} className="text-white" strokeWidth={3} />}
                </span>
              </span>
              <p className={`text-[11px] mt-2 text-center ${isCurrent ? "font-semibold text-ink" : "text-subink"}`}>
                {stage}
              </p>
              <p className="text-[10px] text-subink/70">{date ? formatDate(date) : "-"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
