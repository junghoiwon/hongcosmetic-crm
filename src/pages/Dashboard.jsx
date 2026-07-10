import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  MessagesSquare,
  PackageOpen,
  FileText,
  Flame,
  CalendarClock,
  History,
  Route,
  Image as ImageIcon,
  UserPlus,
  Receipt,
  BadgeCheck,
  Truck,
  AlertTriangle,
  Check,
} from "lucide-react";
import { clientsDB, quotesDB, samplesDB, consultationsDB, productsDB, activityLogsDB } from "../lib/db";
import { fetchLayoutItems } from "../lib/dashboardLayout";
import { fetchStatusHistoryForClients } from "../lib/clientStatusHistory";
import { supabase } from "../lib/supabaseClient";
import { ACTIVE_CLIENT_STATUS, HOT_CLIENT_STATUS, CLIENT_STATUS_COLOR, IMPORTANCE_COLOR } from "../lib/constants";
import { formatDate, todayISO, sumAmountsByCurrency, formatMultiCurrencyTotal, formatMoney } from "../lib/utils";
import { EmptyState, ConfirmDialog, Toast, Card, CardHeader, CardBody } from "../components/ui/Basics";
import MetricCard from "../components/MetricCard";
import Badge from "../components/ui/Badge";
import ClientProgressTimeline from "../components/ClientProgressTimeline";
import ScheduleWidget from "../components/ScheduleWidget";
import TodoWidget from "../components/TodoWidget";

/** 두 값을 비교해 증감 배지({direction, value})를 만듭니다. 데이터가 없으면 null(가짜 수치를 만들지 않음). */
function trendFrom(current, previous) {
  if (previous === 0) {
    if (current === 0) return null;
    return { direction: "up", value: "신규" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { direction: "flat", value: "0%" };
  return { direction: pct > 0 ? "up" : "down", value: `${pct > 0 ? "+" : ""}${pct}%` };
}

function CustomItemView({ item }) {
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

export default function Dashboard({ onNavigateToClient, onNavigate, session }) {
  const [clients, setClients] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [samples, setSamples] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [products, setProducts] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [layoutItems, setLayoutItems] = useState([]);
  const [historyByClient, setHistoryByClient] = useState({});

  const loadAll = () => {
    clientsDB.list().then(setClients);
    quotesDB.list().then(setQuotes);
    samplesDB.list().then(setSamples);
    consultationsDB.list().then(setConsultations);
    productsDB.list().then(setProducts);
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

  // 거래처 진행 타임라인 위젯: 최근에 업데이트된 거래처 5곳의 진행 단계를 보여줍니다.
  const progressClients = useMemo(
    () =>
      clients
        .slice()
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5),
    [clients]
  );

  useEffect(() => {
    if (progressClients.length === 0) {
      setHistoryByClient({});
      return;
    }
    fetchStatusHistoryForClients(progressClients.map((c) => c.id)).then(setHistoryByClient);
  }, [progressClients]);

  const today = todayISO();

  const todayFollowUps = useMemo(() => {
    const fromConsultations = consultations
      .filter((c) => c.nextContactDate === today)
      .map((c) => ({
        id: `cs_${c.id}`,
        source: "consultation",
        sourceId: c.id,
        clientId: c.clientId,
        label: "상담 후속 연락",
        detail: c.content,
      }));
    const fromSamples = samples
      .filter((s) => s.followUpDate === today)
      .map((s) => ({
        id: `sp_${s.id}`,
        source: "sample",
        sourceId: s.id,
        clientId: s.clientId,
        label: "샘플 후속 연락",
        detail: `${s.productSummary || s.productName} · ${s.totalQuantity ?? s.quantity}개 발송`,
      }));
    return [...fromConsultations, ...fromSamples];
  }, [consultations, samples, today]);

  // 후속 연락 "완료 처리": 상담/샘플 기록 자체는 남기고, 오늘 목록에서만
  // 사라지도록 해당 날짜 필드만 비웁니다. (기존 상담 이력·샘플 발송 데이터는 삭제하지 않음)
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const confirmCompleteFollowUp = async () => {
    if (!followUpTarget) return;
    if (followUpTarget.source === "consultation") {
      await consultationsDB.update(followUpTarget.sourceId, { nextContactDate: "" });
    } else {
      await samplesDB.update(followUpTarget.sourceId, { followUpDate: "" });
    }
    setFollowUpTarget(null);
    setToastMsg("후속 연락을 완료 처리했습니다.");
    loadAll();
  };

  const clientMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  // ---- KPI 카드 계산 (전월/전일 대비 등은 실제로 계산 가능한 값만 사용, 가짜 수치 없음) ----
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const newInquiriesToday = useMemo(
    () => clients.filter((c) => (c.createdAt || "").slice(0, 10) === today).length,
    [clients, today]
  );
  const newInquiriesYesterday = useMemo(
    () => clients.filter((c) => (c.createdAt || "").slice(0, 10) === yesterday).length,
    [clients, yesterday]
  );
  const todaysNewClientNames = useMemo(
    () => clients.filter((c) => (c.createdAt || "").slice(0, 10) === today).map((c) => ({ label: c.companyName, value: c.country || "" })),
    [clients, today]
  );

  const isThisMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  const isLastMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth();
  };
  const last6MonthsKrw = (rows, dateKey) => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const target = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const total = rows
        .filter((r) => {
          if (!r[dateKey] || (r.currency && r.currency !== "KRW")) return false;
          const d = new Date(r[dateKey]);
          return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
        })
        .reduce((s, r) => s + (r.totalAmount || 0), 0);
      return { label: `${target.getMonth() + 1}월`, value: total };
    });
  };

  const quotesThisMonth = useMemo(() => quotes.filter((q) => isThisMonth(q.quoteDate)), [quotes]);
  const quotesLastMonth = useMemo(() => quotes.filter((q) => isLastMonth(q.quoteDate)), [quotes]);
  const contractsThisMonth = useMemo(() => quotes.filter((q) => q.status === "승인" && isThisMonth(q.quoteDate)), [quotes]);
  const contractsLastMonth = useMemo(() => quotes.filter((q) => q.status === "승인" && isLastMonth(q.quoteDate)), [quotes]);

  const quoteAmountMonth = useMemo(() => sumAmountsByCurrency(quotesThisMonth), [quotesThisMonth]);
  const quoteAmountLastMonth = useMemo(() => sumAmountsByCurrency(quotesLastMonth), [quotesLastMonth]);
  const contractAmountMonth = useMemo(() => sumAmountsByCurrency(contractsThisMonth), [contractsThisMonth]);
  const contractAmountLastMonth = useMemo(() => sumAmountsByCurrency(contractsLastMonth), [contractsLastMonth]);
  const quoteAmountHistory = useMemo(() => last6MonthsKrw(quotes, "quoteDate"), [quotes]);
  const contractAmountHistory = useMemo(
    () => last6MonthsKrw(quotes.filter((q) => q.status === "승인"), "quoteDate"),
    [quotes]
  );

  const shipmentPendingClients = useMemo(() => clients.filter((c) => c.status === "발주대기"), [clients]);
  const shipmentPendingCount = shipmentPendingClients.length;

  const lowStockProducts = useMemo(
    () =>
      products.filter(
        (p) => p.safetyStock !== "" && p.safetyStock != null && Number(p.currentStock || 0) < Number(p.safetyStock)
      ),
    [products]
  );
  const lowStockCount = lowStockProducts.length;

  const clientStatusBreakdown = useMemo(() => {
    const counts = {};
    for (const c of clients) counts[c.status] = (counts[c.status] || 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value: `${value}개` }));
  }, [clients]);

  const activeStatusBreakdown = useMemo(() => {
    const counts = {};
    for (const c of clients) {
      if (!ACTIVE_CLIENT_STATUS.includes(c.status)) continue;
      counts[c.status] = (counts[c.status] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value: `${value}건` }));
  }, [clients]);

  const recentSamples = useMemo(
    () =>
      [...samples]
        .sort((a, b) => new Date(b.sentDate) - new Date(a.sentDate))
        .slice(0, 5)
        .map((s) => ({ label: clientMap[s.clientId]?.companyName || "삭제된 거래처", value: formatDate(s.sentDate) })),
    [samples, clientMap]
  );
  const recentQuotes = useMemo(
    () =>
      [...quotes]
        .sort((a, b) => new Date(b.quoteDate) - new Date(a.quoteDate))
        .slice(0, 5)
        .map((q) => ({ label: clientMap[q.clientId]?.companyName || "삭제된 거래처", value: q.status })),
    [quotes, clientMap]
  );

  const canvasHeight = useMemo(
    () => Math.max(420, ...layoutItems.map((i) => i.y + i.height), 0) + 20,
    [layoutItems]
  );

  const renderWidget = (widgetKey) => {
    switch (widgetKey) {
      case "stat_clients": {
        const thisMonthNew = clients.filter((c) => isThisMonth(c.createdAt)).length;
        const lastMonthNew = clients.filter((c) => isLastMonth(c.createdAt)).length;
        return (
          <MetricCard
            label="전체 거래처"
            value={`${clients.length}개`}
            icon={Building2}
            accent="jade"
            onClick={() => onNavigate("clients")}
            trend={trendFrom(thisMonthNew, lastMonthNew)}
            compare={{ prevLabel: "전월 신규", prevValue: `${lastMonthNew}개`, curLabel: "이번달 신규", curValue: `${thisMonthNew}개` }}
            breakdown={clientStatusBreakdown}
            breakdownTitle="상태별 현황"
          />
        );
      }
      case "stat_active":
        return (
          <MetricCard
            label="진행 중인 상담"
            value={`${activeCount}건`}
            icon={MessagesSquare}
            accent="jade"
            onClick={() => onNavigate("clients")}
            breakdown={activeStatusBreakdown}
            breakdownTitle="단계별 현황"
          />
        );
      case "stat_samples": {
        const thisMonthCount = samples.filter((s) => isThisMonth(s.sentDate)).length;
        const lastMonthCount = samples.filter((s) => isLastMonth(s.sentDate)).length;
        return (
          <MetricCard
            label="샘플 발송"
            value={`${samples.length}건`}
            icon={PackageOpen}
            accent="gold"
            onClick={() => onNavigate("samples")}
            trend={trendFrom(thisMonthCount, lastMonthCount)}
            compare={{ prevLabel: "전월 발송", prevValue: `${lastMonthCount}건`, curLabel: "이번달 발송", curValue: `${thisMonthCount}건` }}
            breakdown={recentSamples}
            breakdownTitle="최근 발송"
          />
        );
      }
      case "stat_quotes": {
        const thisMonthCount = quotesThisMonth.length;
        const lastMonthCount = quotesLastMonth.length;
        return (
          <MetricCard
            label="견적 발송"
            value={`${quotes.length}건`}
            icon={FileText}
            accent="clay"
            onClick={() => onNavigate("quotes")}
            trend={trendFrom(thisMonthCount, lastMonthCount)}
            compare={{ prevLabel: "전월 작성", prevValue: `${lastMonthCount}건`, curLabel: "이번달 작성", curValue: `${thisMonthCount}건` }}
            breakdown={recentQuotes}
            breakdownTitle="최근 견적"
          />
        );
      }
      case "hot_clients":
        return (
          <Card>
            <CardHeader icon={Flame} title="발주 가능성이 높은 거래처" />
            <CardBody>
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
            </CardBody>
          </Card>
        );
      case "today_followups":
        return (
          <Card>
            <CardHeader icon={CalendarClock} title="오늘 해야 할 후속 연락" />
            <CardBody>
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge className="bg-jade-50 text-jade-600">{item.label}</Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFollowUpTarget(item);
                            }}
                            title="완료 처리"
                            className="p-1.5 rounded-md text-subink hover:bg-jade-50 hover:text-jade-600"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        );
      case "recent_updates":
        return (
          <Card>
            <CardHeader
              icon={History}
              title="최근 업데이트"
              action={
                <button
                  onClick={() => onNavigate("logs")}
                  className="text-xs font-medium hover:underline"
                  style={{ color: "var(--brand-primary)" }}
                >
                  전체보기
                </button>
              }
            />
            <CardBody>
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
            </CardBody>
          </Card>
        );
      case "client_progress_timeline":
        return (
          <Card>
            <CardHeader icon={Route} title="거래처 진행 현황" />
            <CardBody>
              {progressClients.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="표시할 거래처가 없습니다" description="거래처를 등록하면 진행 단계가 여기 표시됩니다." />
                </div>
              ) : (
                <div>
                  {progressClients.map((c) => (
                    <ClientProgressTimeline
                      key={c.id}
                      client={c}
                      historyRows={historyByClient[c.id] || []}
                      onClick={() => onNavigateToClient(c.id)}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        );
      case "kpi_new_inquiries_today":
        return (
          <MetricCard
            label="오늘 신규 문의"
            value={`${newInquiriesToday}건`}
            icon={UserPlus}
            accent="jade"
            onClick={() => onNavigate("clients")}
            trend={trendFrom(newInquiriesToday, newInquiriesYesterday)}
            compare={{ prevLabel: "어제", prevValue: `${newInquiriesYesterday}건`, curLabel: "오늘", curValue: `${newInquiriesToday}건` }}
            breakdown={todaysNewClientNames}
            breakdownTitle="오늘 등록된 거래처"
          />
        );
      case "kpi_quote_amount_month":
        return (
          <MetricCard
            label="이번달 견적금액"
            value={formatMultiCurrencyTotal(quoteAmountMonth)}
            icon={Receipt}
            accent="clay"
            onClick={() => onNavigate("quotes")}
            trend={trendFrom(quoteAmountMonth.KRW || 0, quoteAmountLastMonth.KRW || 0)}
            compare={{
              prevLabel: "전월",
              prevValue: formatMoney(quoteAmountLastMonth.KRW || 0),
              curLabel: "이번달",
              curValue: formatMoney(quoteAmountMonth.KRW || 0),
            }}
            history={quoteAmountHistory}
          />
        );
      case "kpi_contract_amount_month":
        return (
          <MetricCard
            label="이번달 계약금액"
            value={formatMultiCurrencyTotal(contractAmountMonth)}
            icon={BadgeCheck}
            accent="jade"
            onClick={() => onNavigate("quotes")}
            trend={trendFrom(contractAmountMonth.KRW || 0, contractAmountLastMonth.KRW || 0)}
            compare={{
              prevLabel: "전월",
              prevValue: formatMoney(contractAmountLastMonth.KRW || 0),
              curLabel: "이번달",
              curValue: formatMoney(contractAmountMonth.KRW || 0),
            }}
            history={contractAmountHistory}
          />
        );
      case "kpi_shipment_pending":
        return (
          <MetricCard
            label="출고대기 건수"
            value={`${shipmentPendingCount}건`}
            icon={Truck}
            accent="gold"
            onClick={() => onNavigate("clients")}
            breakdown={shipmentPendingClients.map((c) => ({ label: c.companyName, value: c.country || "" }))}
            breakdownTitle="출고대기 거래처"
          />
        );
      case "kpi_low_stock":
        return (
          <MetricCard
            label="재고부족 품목"
            value={`${lowStockCount}개`}
            icon={AlertTriangle}
            accent="clay"
            onClick={() => onNavigate("products")}
            breakdown={lowStockProducts.map((p) => ({ label: p.name, value: `${p.currentStock || 0}/${p.safetyStock}` }))}
            breakdownTitle="재고부족 제품 (현재고/안전재고)"
          />
        );
      case "schedule_widget":
        return <ScheduleWidget session={session} />;
      case "todo_widget":
        return <TodoWidget />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">대시보드</h1>
        <p className="text-sm text-subink mt-1">
          {formatDate(today)} 기준 영업 현황입니다.
        </p>
      </div>

      <div className="overflow-x-auto mb-8">
        <div className="relative" style={{ width: 1160, height: canvasHeight, maxWidth: "100%" }}>
          {layoutItems.map((item) => (
            <div
              key={item.id}
              className="absolute"
              style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
            >
              {item.item_type === "widget" ? renderWidget(item.content) : <CustomItemView item={item} />}
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!followUpTarget}
        title="후속 연락 완료 처리"
        description="오늘의 후속 연락 목록에서 제거됩니다. 관련 상담/샘플 기록 자체는 삭제되지 않습니다."
        confirmLabel="완료 처리"
        onConfirm={confirmCompleteFollowUp}
        onCancel={() => setFollowUpTarget(null)}
      />
      <Toast message={toastMsg} />
    </div>
  );
}
