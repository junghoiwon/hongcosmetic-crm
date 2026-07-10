import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { activityLogsDB } from "../lib/db";
import { formatDate } from "../lib/utils";
import { EmptyState } from "../components/ui/Basics";

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    activityLogsDB
      .list()
      .then((rows) => setLogs(rows.sort((a, b) => new Date(b.ts) - new Date(a.ts))))
      .finally(() => setLoaded(true));
  }, []);

  const grouped = logs.reduce((acc, log) => {
    (acc[log.date] ||= []).push(log);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  if (!loaded) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">활동로그</h1>
        <p className="text-sm text-subink mt-1 flex items-center gap-1.5">
          <ShieldAlert size={14} className="text-clay-500" />
          시스템에서 일어난 모든 변경을 자동으로 기록하며, 누구도 삭제할 수 없습니다. (관리자 전용)
        </p>
      </div>

      {logs.length === 0 ? (
        <EmptyState title="아직 기록된 활동이 없습니다" description="거래처, 제품, 견적 등을 등록·수정하면 여기 자동으로 쌓입니다." />
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <section key={date}>
              <p className="text-xs font-medium text-subink mb-2">{formatDate(date)}</p>
              <div className="bg-white border border-line rounded-card shadow-card divide-y divide-line overflow-hidden">
                {grouped[date].map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{log.actor}</p>
                      <p className="text-sm text-ink mt-0.5">{log.summary}</p>
                      {log.detail && <p className="text-xs text-subink mt-0.5">{log.detail}</p>}
                    </div>
                    <span className="text-xs text-subink shrink-0">{log.time}</span>
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
