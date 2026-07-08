import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { activityLogsDB } from "../lib/db";
import { formatDate } from "../lib/utils";
import { EmptyState } from "../components/ui/Basics";
import Badge from "../components/ui/Badge";

export default function UpdateLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    activityLogsDB.list().then((rows) =>
      setLogs(rows.sort((a, b) => new Date(b.ts) - new Date(a.ts)))
    );
  }, []);

  // 날짜별로 묶기
  const grouped = logs.reduce((acc, log) => {
    (acc[log.date] ||= []).push(log);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">업데이트 로그</h1>
        <p className="text-sm text-subink mt-1">
          거래처, 제품, 견적, 샘플, 설정 등 시스템에서 일어난 모든 변경 이력입니다.
        </p>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          title="아직 기록된 변경 이력이 없습니다"
          description="거래처나 제품, 견적 등을 등록·수정하면 여기에 자동으로 쌓입니다."
        />
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <section key={date}>
              <p className="text-xs font-medium text-subink mb-2">{formatDate(date)}</p>
              <div className="bg-white border border-line rounded-card shadow-card divide-y divide-line overflow-hidden">
                {grouped[date].map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                    <History size={14} className="text-jade-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-jade-50 text-jade-600">{log.action}</Badge>
                        <span className="text-xs text-subink">{log.time}</span>
                        <span className="text-xs text-subink">· {log.actor}</span>
                      </div>
                      <p className="text-sm text-ink mt-1">{log.summary}</p>
                      {log.detail && <p className="text-xs text-subink mt-0.5">{log.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
