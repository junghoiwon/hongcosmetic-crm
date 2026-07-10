import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search, MessagesSquare, Download, AlertTriangle, Pin, PinOff } from "lucide-react";
import { consultationsDB, clientsDB, logActivity } from "../lib/db";
import { fetchAllClientContacts, fetchClientContacts } from "../lib/clientContacts";
import { downloadConsultationsExcel } from "../lib/consultationExcel";
import { canAccess } from "../lib/permissions";
import {
  CONSULTATION_CATEGORY,
  CONSULTATION_CONTACT_METHOD,
  CONSULTATION_STATUS,
  CONSULTATION_STATUS_COLOR,
  IMPORTANCE,
  IMPORTANCE_COLOR,
} from "../lib/constants";
import { formatDate, todayISO, PERIOD_OPTIONS, isWithinPeriod } from "../lib/utils";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { Field, TextInput, Select, TextArea } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog, Toast } from "../components/ui/Basics";

const EMPTY = {
  clientId: "",
  contactId: "",
  date: todayISO(),
  time: "",
  category: "상담",
  contactMethod: "전화",
  title: "",
  content: "",
  ourRep: "",
  followUpAction: "",
  nextContactDate: "",
  status: "후속조치없음",
  importance: "중",
  pinned: false,
};

export default function ConsultationLog({ session, permissionMap, onNavigateToClient }) {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [repFilter, setRepFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [period, setPeriod] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const canCreate = canAccess(session, permissionMap, "consultation_log", "create");
  const canEdit = canAccess(session, permissionMap, "consultation_log", "edit");
  const canDelete = canAccess(session, permissionMap, "consultation_log", "delete");

  const load = () => {
    consultationsDB.list().then((r) => setRows(r.sort((a, b) => new Date(b.date) - new Date(a.date))));
    clientsDB.list().then(setClients);
    fetchAllClientContacts().then(setContacts);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const clientMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const contactMap = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, c])), [contacts]);
  const today = todayISO();

  const reps = useMemo(
    () => [...new Set(rows.map((r) => r.ourRep).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (clientFilter && r.clientId !== clientFilter) return false;
      if (repFilter && r.ourRep !== repFilter) return false;
      if (methodFilter && r.contactMethod !== methodFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (!isWithinPeriod(r.date, period)) return false;
      if (!q) return true;
      const companyName = clientMap[r.clientId]?.companyName || "";
      return [companyName, r.title, r.content, r.followUpAction].filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, search, clientFilter, repFilter, methodFilter, statusFilter, period, clientMap]);

  const exportRows = useMemo(
    () =>
      filtered.map((r) => ({
        ...r,
        clientName: clientMap[r.clientId]?.companyName || "",
        contactName: contactMap[r.contactId]?.name || "",
      })),
    [filtered, clientMap, contactMap]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, ourRep: session?.name || "", clientId: clientFilter || "" });
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({ ...EMPTY, ...r });
    setModalOpen(true);
  };

  const clientContactOptions = useMemo(
    () => contacts.filter((c) => c.client_id === form.clientId),
    [contacts, form.clientId]
  );

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, author: editing ? editing.author || session?.name : session?.name };
    const cName = clientMap[payload.clientId]?.companyName || "삭제된 거래처";
    const actor = session?.name || "사용자";
    if (editing) {
      await consultationsDB.update(editing.id, payload);
      await logActivity({ actor, action: "상담일지 수정", summary: `${cName} 상담일지 수정 (${payload.title || "제목없음"})` });
    } else {
      await consultationsDB.create(payload);
      await logActivity({
        actor,
        action: "상담일지 등록",
        summary: `${cName} 상담일지 등록 (${payload.title || payload.category})`,
      });
    }
    setModalOpen(false);
    setToastMsg(editing ? "상담일지를 수정했습니다." : "상담일지를 등록했습니다.");
    load();
  };

  const confirmDelete = async () => {
    await consultationsDB.remove(deleteTarget.id);
    await logActivity({
      actor: session?.name || "사용자",
      action: "상담일지 삭제",
      summary: `${clientMap[deleteTarget.clientId]?.companyName || "삭제된 거래처"} 상담일지가 삭제되었습니다.`,
    });
    setDeleteTarget(null);
    setToastMsg("상담일지를 삭제했습니다.");
    load();
  };

  const togglePin = async (r) => {
    await consultationsDB.update(r.id, { pinned: !r.pinned });
    load();
  };

  const isOverdue = (r) => r.nextContactDate && r.nextContactDate < today && !["완료", "보류"].includes(r.status);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">상담·미팅일지</h1>
          <p className="text-sm text-subink mt-1">거래처와의 모든 상담·미팅·연락 이력을 한 곳에서 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => downloadConsultationsExcel(exportRows)}>
            <Download size={15} /> 엑셀 다운로드
          </Button>
          {canCreate && (
            <Button onClick={openCreate}>
              <Plus size={16} /> 상담 기록 작성
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative max-w-xs w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subink" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="거래처, 제목, 내용으로 검색"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm outline-none focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15"
          />
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line bg-white text-sm outline-none"
        >
          <option value="">전체 거래처</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.companyName}</option>
          ))}
        </select>
        <select
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line bg-white text-sm outline-none"
        >
          <option value="">전체 담당자</option>
          {reps.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line bg-white text-sm outline-none"
        >
          <option value="">전체 연락방법</option>
          {CONSULTATION_CONTACT_METHOD.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line bg-white text-sm outline-none"
        >
          <option value="">전체 상태</option>
          {CONSULTATION_STATUS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line bg-white text-sm outline-none"
        >
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "등록된 상담 기록이 없습니다" : "검색 결과가 없습니다"}
          description={rows.length === 0 ? "거래처와의 상담·미팅 내용을 기록해보세요." : "다른 조건을 시도해보세요."}
          action={
            rows.length === 0 && canCreate && (
              <Button onClick={openCreate}>
                <Plus size={16} /> 상담 기록 작성
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-white border border-line rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="bg-porcelain text-subink text-xs">
                <th className="text-left font-medium px-4 py-3">날짜</th>
                <th className="text-left font-medium px-4 py-3">거래처</th>
                <th className="text-left font-medium px-4 py-3">제목/구분</th>
                <th className="text-left font-medium px-4 py-3">연락방법</th>
                <th className="text-left font-medium px-4 py-3">담당자</th>
                <th className="text-left font-medium px-4 py-3">상태</th>
                <th className="text-left font-medium px-4 py-3">중요도</th>
                <th className="text-left font-medium px-4 py-3">후속연락일</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={canEdit ? () => openEdit(r) : undefined}
                  className={`border-t border-line hover:bg-porcelain/60 ${canEdit ? "cursor-pointer" : ""}`}
                >
                  <td className="px-4 py-3 text-subink whitespace-nowrap">
                    {formatDate(r.date)} {r.time && <span className="text-xs">{r.time}</span>}
                  </td>
                  <td
                    className="px-4 py-3 font-medium text-ink flex items-center gap-1.5"
                    onClick={(e) => {
                      if (onNavigateToClient) {
                        e.stopPropagation();
                        onNavigateToClient(r.clientId);
                      }
                    }}
                  >
                    {r.pinned && <Pin size={11} className="text-clay-500 shrink-0" />}
                    <MessagesSquare size={13} className="text-jade-500 shrink-0" />
                    {clientMap[r.clientId]?.companyName || "삭제된 거래처"}
                  </td>
                  <td className="px-4 py-3 text-subink">
                    <div className="text-ink">{r.title || "-"}</div>
                    <div className="text-xs">{r.category}</div>
                  </td>
                  <td className="px-4 py-3 text-subink">{r.contactMethod}</td>
                  <td className="px-4 py-3 text-subink">{r.ourRep || "-"}</td>
                  <td className="px-4 py-3">
                    <Badge className={CONSULTATION_STATUS_COLOR[r.status] || "bg-line text-subink"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={IMPORTANCE_COLOR[r.importance]}>{r.importance}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.nextContactDate ? (
                      <span className={`inline-flex items-center gap-1 text-xs ${isOverdue(r) ? "text-clay-600 font-medium" : "text-subink"}`}>
                        {isOverdue(r) && <AlertTriangle size={11} />}
                        {formatDate(r.nextContactDate)}
                      </span>
                    ) : (
                      <span className="text-subink">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(r);
                          }}
                          className="p-1.5 rounded-md text-subink hover:bg-white hover:text-clay-600"
                          title={r.pinned ? "고정 해제" : "상단 고정"}
                        >
                          {r.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(r);
                          }}
                          className="p-1.5 rounded-md text-subink hover:bg-white hover:text-clay-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "상담 기록 수정" : "새 상담 기록 작성"}
        width="max-w-2xl"
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="거래처" required className="col-span-2">
              <Select
                required
                placeholder="거래처 선택"
                options={clients.map((c) => c.companyName)}
                value={clientMap[form.clientId]?.companyName || ""}
                onChange={(e) => {
                  const c = clients.find((c) => c.companyName === e.target.value);
                  setForm({ ...form, clientId: c?.id || "", contactId: "" });
                }}
              />
            </Field>
            <Field label="거래처 담당자">
              <Select
                placeholder="담당자 선택 (선택사항)"
                options={clientContactOptions.map((c) => c.name)}
                value={contactMap[form.contactId]?.name || ""}
                onChange={(e) => {
                  const c = clientContactOptions.find((c) => c.name === e.target.value);
                  setForm({ ...form, contactId: c?.id || "" });
                }}
              />
            </Field>
            <Field label="우리측 담당자">
              <TextInput value={form.ourRep} onChange={(e) => setForm({ ...form, ourRep: e.target.value })} />
            </Field>
            <Field label="날짜" required>
              <TextInput
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="시간">
              <TextInput type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </Field>
            <Field label="구분">
              <Select
                options={CONSULTATION_CATEGORY}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </Field>
            <Field label="연락방법">
              <Select
                options={CONSULTATION_CONTACT_METHOD}
                value={form.contactMethod}
                onChange={(e) => setForm({ ...form, contactMethod: e.target.value })}
              />
            </Field>
            <Field label="제목" className="col-span-2">
              <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="내용" className="col-span-2">
              <TextArea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </Field>
            <Field label="후속조치 내용" className="col-span-2">
              <TextArea
                value={form.followUpAction}
                onChange={(e) => setForm({ ...form, followUpAction: e.target.value })}
                placeholder="다음에 해야 할 일"
              />
            </Field>
            <Field label="후속 연락일" hint="입력하면 대시보드 '오늘 해야 할 후속 연락'에 자동으로 표시됩니다.">
              <TextInput
                type="date"
                value={form.nextContactDate}
                onChange={(e) => setForm({ ...form, nextContactDate: e.target.value })}
              />
            </Field>
            <Field label="진행상태">
              <Select
                options={CONSULTATION_STATUS}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              />
            </Field>
            <Field label="중요도">
              <Select
                options={IMPORTANCE}
                value={form.importance}
                onChange={(e) => setForm({ ...form, importance: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button type="submit">{editing ? "저장" : "등록"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="상담 기록을 삭제할까요?"
        description="삭제된 기록은 복구할 수 없습니다."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <Toast message={toastMsg} />
    </div>
  );
}
