import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, List, LayoutGrid, X, Trash2 } from "lucide-react";
import { fetchCalendarEvents, rescheduleEvent, SOURCE_LABEL, SOURCE_COLOR } from "../lib/calendarEvents";
import { createScheduleEvent, updateScheduleEvent, deleteScheduleEvent } from "../lib/scheduleEvents";
import { clientsDB } from "../lib/db";
import { CALENDAR_EVENT_TYPES } from "../lib/constants";
import { formatDate, todayISO } from "../lib/utils";
import Modal from "../components/ui/Modal";
import { Field, TextInput, Select, TextArea } from "../components/ui/Field";
import { Button, ConfirmDialog, Toast } from "../components/ui/Basics";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const EMPTY_FORM = { title: "", event_date: todayISO(), event_type: "미팅", client_id: "", memo: "" };

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const start = new Date(year, month, 1 - startDay);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarPage({ session, onNavigateToClient }) {
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [view, setView] = useState("month");
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [sourceFilter, setSourceFilter] = useState({ direct: true, consultation: true, quote: true, sample_sent: true, sample_followup: true });
  const [clientFilter, setClientFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detailEvent, setDetailEvent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const load = () => {
    fetchCalendarEvents().then(setEvents);
    clientsDB.list().then(setClients);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const today = todayISO();

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (!sourceFilter[e.source]) return false;
      if (clientFilter && e.clientId !== clientFilter) return false;
      if (mineOnly && e.source === "direct" && e.createdBy !== session?.userId) return false;
      return true;
    });
  }, [events, sourceFilter, clientFilter, mineOnly, session]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const e of filteredEvents) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [filteredEvents]);

  const days = useMemo(() => monthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const goPrevMonth = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNextMonth = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => setCursor(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });

  const openCreate = (dateStr) => {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM, event_date: dateStr || todayISO() });
    setFormOpen(true);
  };

  const openEditDirect = (event) => {
    setDetailEvent(null);
    setEditingEvent(event);
    setForm({
      title: event.raw.title,
      event_date: event.raw.event_date,
      event_type: event.raw.event_type,
      client_id: event.raw.client_id || "",
      memo: event.raw.memo || "",
    });
    setFormOpen(true);
  };

  const saveForm = async (e) => {
    e.preventDefault();
    const payload = { ...form, client_id: form.client_id || null };
    if (editingEvent) {
      await updateScheduleEvent(editingEvent.raw.id, payload);
      setToastMsg("일정을 수정했습니다.");
    } else {
      await createScheduleEvent({ ...payload, created_by: session?.userId });
      setToastMsg("일정을 등록했습니다.");
    }
    setFormOpen(false);
    load();
  };

  const confirmDeleteEvent = async () => {
    await deleteScheduleEvent(deleteTarget.raw.id);
    setDeleteTarget(null);
    setDetailEvent(null);
    setToastMsg("일정을 삭제했습니다.");
    load();
  };

  const canEditDirect = (event) => event.source === "direct" && (event.createdBy === session?.userId);

  const handleDrop = async (dateStr) => {
    setDragOverDate(null);
    if (!draggedEvent) return;
    if (draggedEvent.date === dateStr) {
      setDraggedEvent(null);
      return;
    }
    if (draggedEvent.source === "direct" && !canEditDirect(draggedEvent)) {
      setDraggedEvent(null);
      return;
    }
    await rescheduleEvent(draggedEvent, dateStr);
    setDraggedEvent(null);
    setToastMsg("일정 날짜를 변경했습니다.");
    load();
  };

  const listEvents = useMemo(
    () =>
      [...filteredEvents]
        .filter((e) => e.date >= toISODate(days[0]) && e.date <= toISODate(days[41]))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [filteredEvents, days]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">일정 캘린더</h1>
          <p className="text-sm text-subink mt-1">
            직접 등록한 일정과 상담 후속연락일·견적일·샘플 발송/후속연락일을 한 화면에서 확인합니다.
          </p>
        </div>
        <Button onClick={() => openCreate(today)}>
          <Plus size={16} /> 일정 등록
        </Button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={goPrevMonth} className="p-2 rounded-lg border border-line bg-white hover:bg-porcelain">
            <ChevronLeft size={16} />
          </button>
          <p className="font-display text-lg font-semibold text-ink w-32 text-center">
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </p>
          <button onClick={goNextMonth} className="p-2 rounded-lg border border-line bg-white hover:bg-porcelain">
            <ChevronRight size={16} />
          </button>
          <Button variant="ghost" size="sm" onClick={goToday}>오늘</Button>
        </div>
        <div className="flex items-center gap-1 bg-white border border-line rounded-lg p-1">
          <button
            onClick={() => setView("month")}
            className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1 ${view === "month" ? "bg-jade-50 text-jade-600" : "text-subink"}`}
          >
            <LayoutGrid size={13} /> 월간
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1 ${view === "list" ? "bg-jade-50 text-jade-600" : "text-subink"}`}
          >
            <List size={13} /> 목록
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
        {[
          ["direct", "직접등록"],
          ["consultation", "상담일지"],
          ["quote", "견적서"],
          ["sample_sent", "샘플발송"],
          ["sample_followup", "샘플 후속연락"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sourceFilter[key]}
              onChange={(e) => setSourceFilter((prev) => ({ ...prev, [key]: e.target.checked }))}
              className="w-3.5 h-3.5 accent-jade-600"
            />
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLOR[key] }} />
            {label}
          </label>
        ))}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-line bg-white outline-none"
        >
          <option value="">전체 거래처</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.companyName}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="w-3.5 h-3.5 accent-jade-600" />
          내가 등록한 직접일정만
        </label>
      </div>

      {view === "month" ? (
        <div className="bg-white border border-line rounded-card shadow-card overflow-hidden">
          <div className="grid grid-cols-7 bg-porcelain text-subink text-xs">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center py-2 font-medium">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const dateStr = toISODate(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const dayEvents = eventsByDate[dateStr] || [];
              const isToday = dateStr === today;
              return (
                <div
                  key={dateStr}
                  onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateStr); }}
                  onDragLeave={() => setDragOverDate((v) => (v === dateStr ? null : v))}
                  onDrop={() => handleDrop(dateStr)}
                  onClick={() => openCreate(dateStr)}
                  className={`min-h-[92px] border-t border-l border-line p-1.5 cursor-pointer hover:bg-porcelain/40 ${
                    inMonth ? "" : "bg-porcelain/30"
                  } ${dragOverDate === dateStr ? "ring-2 ring-inset ring-jade-500" : ""}`}
                >
                  <p className={`text-xs mb-1 ${isToday ? "inline-flex items-center justify-center w-5 h-5 rounded-full text-white" : inMonth ? "text-ink" : "text-subink/50"}`}
                     style={isToday ? { backgroundColor: "var(--brand-primary)" } : undefined}>
                    {d.getDate()}
                  </p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        draggable
                        onDragStart={(ev) => { ev.stopPropagation(); setDraggedEvent(e); }}
                        onClick={(ev) => { ev.stopPropagation(); setDetailEvent(e); }}
                        title={e.title}
                        className="truncate text-[11px] px-1.5 py-0.5 rounded text-white cursor-grab"
                        style={{ backgroundColor: SOURCE_COLOR[e.source] }}
                      >
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-subink px-1">+{dayEvents.length - 3}건 더</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-card shadow-card overflow-hidden">
          {listEvents.length === 0 ? (
            <p className="text-sm text-subink text-center py-10">이번 달 일정이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line">
              {listEvents.map((e) => (
                <li key={e.id} onClick={() => setDetailEvent(e)} className="flex items-center gap-3 px-4 py-3 hover:bg-porcelain/60 cursor-pointer">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLOR[e.source] }} />
                  <span className="text-xs text-subink w-24 shrink-0">{formatDate(e.date)}</span>
                  <span className="text-sm text-ink flex-1 min-w-0 truncate">{e.title}</span>
                  <span className="text-[11px] text-subink shrink-0">{e.sourceLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 일정 등록/수정 */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingEvent ? "일정 수정" : "새 일정 등록"}>
        <form onSubmit={saveForm} className="space-y-4">
          <Field label="제목" required>
            <TextInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="날짜" required>
              <TextInput type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </Field>
            <Field label="구분">
              <Select options={CALENDAR_EVENT_TYPES} value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} />
            </Field>
          </div>
          <Field label="관련 거래처">
            <Select
              placeholder="선택 안 함"
              options={clients.map((c) => ({ value: c.id, label: c.companyName }))}
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            />
          </Field>
          <Field label="메모">
            <TextArea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>취소</Button>
            <Button type="submit">{editingEvent ? "저장" : "등록"}</Button>
          </div>
        </form>
      </Modal>

      {/* 일정 상세 */}
      {detailEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-ink/30" onClick={() => setDetailEvent(null)} />
          <div className="relative bg-white rounded-card shadow-card border border-line max-w-sm w-full p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="inline-block text-[11px] px-2 py-0.5 rounded-full text-white mb-1.5" style={{ backgroundColor: SOURCE_COLOR[detailEvent.source] }}>
                  {detailEvent.sourceLabel}
                </span>
                <h3 className="font-display font-semibold text-ink">{detailEvent.title}</h3>
              </div>
              <button onClick={() => setDetailEvent(null)} className="text-subink hover:text-ink"><X size={16} /></button>
            </div>
            <p className="text-sm text-subink mb-1">날짜: {formatDate(detailEvent.date)}</p>
            {detailEvent.type && <p className="text-sm text-subink mb-1">구분: {detailEvent.type}</p>}
            {detailEvent.memo && <p className="text-sm text-subink mb-1">메모: {detailEvent.memo}</p>}
            <div className="flex justify-end gap-2 mt-4">
              {detailEvent.clientId && (
                <Button variant="ghost" size="sm" onClick={() => { setDetailEvent(null); onNavigateToClient?.(detailEvent.clientId); }}>
                  거래처로 이동
                </Button>
              )}
              {detailEvent.source === "direct" && canEditDirect(detailEvent) && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => openEditDirect(detailEvent)}>수정</Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(detailEvent)}>
                    <Trash2 size={13} /> 삭제
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="일정을 삭제할까요?"
        description="삭제된 일정은 복구할 수 없습니다."
        onConfirm={confirmDeleteEvent}
        onCancel={() => setDeleteTarget(null)}
      />
      <Toast message={toastMsg} />
    </div>
  );
}
