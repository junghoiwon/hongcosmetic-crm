import { useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2, X } from "lucide-react";
import { fetchScheduleEvents, createScheduleEvent, deleteScheduleEvent } from "../lib/scheduleEvents";
import { formatDate, todayISO } from "../lib/utils";
import { Field, TextInput, TextArea } from "./ui/Field";
import { Button, Card, CardHeader, CardBody } from "./ui/Basics";

const EMPTY = { title: "", event_date: todayISO(), event_type: "기타", memo: "" };

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=일 ... 6=토
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

function endOfWeek(date) {
  const start = new Date(startOfWeek(date));
  start.setDate(start.getDate() + 6);
  return start.toISOString().slice(0, 10);
}

export default function ScheduleWidget({ session }) {
  const [events, setEvents] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = () => fetchScheduleEvents().then(setEvents);

  useEffect(() => {
    load();
  }, []);

  const today = todayISO();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);

  const todayEvents = events.filter((e) => e.event_date === today);
  const weekEvents = events.filter((e) => e.event_date > today && e.event_date >= weekStart && e.event_date <= weekEnd);

  const addEvent = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await createScheduleEvent(form);
    setForm(EMPTY);
    setFormOpen(false);
    load();
  };

  const remove = async (id) => {
    await deleteScheduleEvent(id);
    load();
  };

  const renderItem = (item) => {
    const canDelete = item.created_by === session?.userId;
    return (
      <li key={item.id} className="flex items-start justify-between gap-2 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm text-ink truncate">{item.title}</p>
          <p className="text-xs text-subink mt-0.5">
            {formatDate(item.event_date)} · {item.event_type}
          </p>
        </div>
        {canDelete && (
          <button onClick={() => remove(item.id)} className="p-1 rounded-md text-subink hover:text-clay-600 shrink-0">
            <Trash2 size={13} />
          </button>
        )}
      </li>
    );
  };

  return (
    <Card>
      <CardHeader
        icon={CalendarDays}
        title="일정"
        action={
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="p-1 rounded-md text-subink hover:bg-porcelain hover:text-jade-600"
          >
            {formOpen ? <X size={15} /> : <Plus size={15} />}
          </button>
        }
      />

      {formOpen && (
        <form onSubmit={addEvent} className="p-4 border-b border-line space-y-2 bg-porcelain/40">
          <Field label="제목">
            <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="날짜">
              <TextInput
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              />
            </Field>
            <Field label="구분">
              <TextInput
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                placeholder="미팅/전시회 등"
              />
            </Field>
          </div>
          <Field label="메모">
            <TextArea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              등록
            </Button>
          </div>
        </form>
      )}

      <CardBody>
        <p className="text-xs font-medium text-subink px-4 pt-3">오늘</p>
        {todayEvents.length === 0 ? (
          <p className="text-sm text-subink text-center py-3">오늘 일정이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-line">{todayEvents.map(renderItem)}</ul>
        )}
        <p className="text-xs font-medium text-subink px-4 pt-3">이번주</p>
        {weekEvents.length === 0 ? (
          <p className="text-sm text-subink text-center py-3">이번주 남은 일정이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-line">{weekEvents.map(renderItem)}</ul>
        )}
      </CardBody>
    </Card>
  );
}
