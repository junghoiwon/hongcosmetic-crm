import { useEffect, useMemo, useState } from "react";
import { Building2, MessagesSquare, PackageOpen, FileText, Flame, CalendarClock, History, Image as ImageIcon } from "lucide-react";
import { clientsDB, quotesDB, samplesDB, consultationsDB, activityLogsDB } from "../lib/db";
import { fetchLayoutItems } from "../lib/dashboardLayout";
import { supabase } from "../lib/supabaseClient";
import { ACTIVE_CLIENT_STATUS, HOT_CLIENT_STATUS, CLIENT_STATUS_COLOR, IMPORTANCE_COLOR } from "../lib/constants";
import { formatDate, todayISO } from "../lib/utils";
import { StatCard, EmptyState } from "../components/ui/Basics";
import Badge from "../components/ui/Badge";

function LayoutItemView({ item }) {
  const style = item.style_json || {};
  if (item.item_type === "text") {
    return (
      <div
        className="w-full h-full flex px-1"
        style={{
          fontSize: style.fontSize || 16,
          color: style.color || "#1f2937",
          fontWeight: style.fontWeight || "500",
          justifyContent: style.align === "center" ? "center" : style.align === "right" ? "flex-end" : "flex-start",
          alignItems: "center",
          textAlign: style.align || "left",
        }}
      >
        {item.content}
      </div>
    );
  }
  if (item.item_type === "image") {
    return item.image_url ? (
      <img
        src={item.image_url}
        alt=""
        className="w-full h-full object-cover"
        style={{ borderRadius: style.borderRadius ?? 8 }}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center bg-porcelain text-subink">
        <ImageIcon size={20} />
      </div>
    );
  }
  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor: style.backgroundColor || "#2F6F62",
        borderRadius: style.shapeType === "circle" ? "50%" : style.borderRadius ?? 12,
      }}
    />
  );
}

export default function Dashboard({ onNavigateToClient, onNavigate }) {
  const [clients, setClients] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [samples, setSamples] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [layoutItems, setLayoutItems] = useState([]);

  const loadAll = () => {
    clientsDB.list().then(setClients);
    quotesDB.list().then(setQuotes);
    samplesDB.list().then(setSamples);
    consultationsDB.list().then(setConsultations);
    activityLogsDB
      .list()
      .then((rows) => setRecentLogs(rows.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 10)));
  };

  useEffect(() => {
    fetchLayoutItems().then(setLayoutItems);
  }, []);

  useEffect(() => {
    loadAll();

    // 거래처 등록/견적·샘플 등록 등이 다른 탭이나 다른 직원 화면에서
    // 일어나도 대시보드가 새로고침 없이 자동으로 갱신되도록 실시간 구독합니다.
    const channel = supabase
      .channel("dashboard-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "quotations" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "samples" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "update_logs" }, loadAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeCount = useMemo(
    () => clients.filter((c) => ACTIVE_CLIENT_STATUS.includes(c.status)).length,
    [clients]
  );

  const hotClients = useMemo(
    () =>
      clients
        .filter((c) => c.importance === "상" && HOT_CLIENT_STATUS.includes(c.status))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 6),
    [clients]
  );

  const today = todayISO();

  const todayFollowUps = useMemo(() => {
    const fromConsultations = consultations
      .filter((c) => c.nextContactDate === today)
      .map((c) => ({
        id: `cs_${c.id}`,
        clientId: c.clientId,
        label: "상담 후속 연락",
        detail: c.content,
      }));
    const fromSamples = samples
      .filter((s) => s.followUpDate === today)
      .map((s) => ({
        id: `sp_${s.id}`,
        clientId: s.clientId,
        label: "샘플 후속 연락",
        detail: `${s.productName} · ${s.quantity}개 발송`,
      }));
    return [...fromConsultations, ...fromSamples];
  }, [consultations, samples, today]);

  const clientMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">대시보드</h1>
        <p className="text-sm text-subink mt-1">
          {formatDate(today)} 기준 영업 현황입니다.
        </p>
      </div>

      {layoutItems.length > 0 && (
        <div className="overflow-x-auto mb-8">
          <div className="relative" style={{ width: 1160, height: 420, maxWidth: "100%" }}>
            {layoutItems.map((item) => (
              <div
                key={item.id}
                className="absolute"
                style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
              >
                <LayoutItemView item={item} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="전체 거래처"
          value={`${clients.length}개`}
          icon={Building2}
          accent="jade"
          onClick={() => onNavigate("clients")}
        />
        <StatCard
          label="진행 중인 상담"
          value={`${activeCount}건`}
          icon={MessagesSquare}
          accent="jade"
          onClick={() => onNavigate("clients")}
        />
        <StatCard
          label="샘플 발송"
          value={`${samples.length}건`}
          icon={PackageOpen}
          accent="gold"
          onClick={() => onNavigate("samples")}
        />
        <StatCard
          label="견적 발송"
          value={`${quotes.length}건`}
          icon={FileText}
          accent="clay"
          onClick={() => onNavigate("quotes")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 발주 가능성 높은 거래처 */}
        <section className="bg-white border border-line rounded-card shadow-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-line">
            <Flame size={16} className="text-clay-500" />
            <h2 className="font-display text-sm font-semibold text-ink">발주 가능성이 높은 거래처</h2>
          </div>
          {hotClients.length === 0 ? (
            <div className="p-5">
              <EmptyState title="아직 없습니다" description="중요도 '상'이면서 견적/인허가/발주 단계인 거래처가 여기 표시됩니다." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {hotClients.map((c) => (
                <li
                  key={c.id}
                  onClick={() => onNavigateToClient(c.id)}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-porcelain/60 cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{c.companyName}</p>
                    <p className="text-xs text-subink mt-0.5">{c.country} · {c.interestProduct || "관심 제품 미입력"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className={IMPORTANCE_COLOR[c.importance]}>중요도 {c.importance}</Badge>
                    <Badge className={CLIENT_STATUS_COLOR[c.status]}>{c.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 오늘 해야 할 후속 연락 */}
        <section className="bg-white border border-line rounded-card shadow-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-line">
            <CalendarClock size={16} className="text-jade-500" />
            <h2 className="font-display text-sm font-semibold text-ink">오늘 해야 할 후속 연락</h2>
          </div>
          {todayFollowUps.length === 0 ? (
            <div className="p-5">
              <EmptyState title="오늘 예정된 후속 연락이 없습니다" description="상담 이력과 샘플 발송에서 등록한 후속 연락일이 여기 표시됩니다." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {todayFollowUps.map((item) => {
                const client = clientMap[item.clientId];
                return (
                  <li
                    key={item.id}
                    onClick={() => client && onNavigateToClient(client.id)}
                    className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-porcelain/60 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {client?.companyName || "삭제된 거래처"}
                      </p>
                      <p className="text-xs text-subink mt-0.5 truncate">{item.detail}</p>
                    </div>
                    <Badge className="bg-jade-50 text-jade-600 shrink-0">{item.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 최근 업데이트 */}
        <section className="bg-white border border-line rounded-card shadow-card lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <History size={16} className="text-jade-500" />
              <h2 className="font-display text-sm font-semibold text-ink">최근 업데이트</h2>
            </div>
            <button
              onClick={() => onNavigate("logs")}
              className="text-xs font-medium hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              전체보기
            </button>
          </div>
          {recentLogs.length === 0 ? (
            <div className="p-5">
              <EmptyState title="아직 기록된 변경 이력이 없습니다" description="거래처, 제품, 견적, 샘플, 설정 변경 등이 자동으로 기록됩니다." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <Badge className="bg-jade-50 text-jade-600 shrink-0">{log.action}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">{log.summary}</p>
                    <p className="text-xs text-subink mt-0.5">
                      {formatDate(log.date)} {log.time} · {log.actor}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
