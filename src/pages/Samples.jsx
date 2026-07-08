import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, PackageOpen, Search } from "lucide-react";
import { samplesDB, clientsDB, logActivity } from "../lib/db";
import { CARRIERS } from "../lib/constants";
import { formatMoney, formatDate, todayISO, dDayLabel } from "../lib/utils";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { Field, TextInput, NumberInput, Select, TextArea } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog } from "../components/ui/Basics";

const EMPTY = {
  clientId: "",
  productName: "",
  quantity: "",
  sentDate: todayISO(),
  carrier: "EMS",
  trackingNumber: "",
  shippingCost: "",
  etaDate: "",
  followUpDate: "",
  memo: "",
};

export default function Samples({ session }) {
  const [samples, setSamples] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    samplesDB.list().then((rows) =>
      setSamples(rows.sort((a, b) => new Date(b.sentDate) - new Date(a.sentDate)))
    );
    clientsDB.list().then(setClients);
  };

  useEffect(() => {
    load();
  }, []);

  const clientName = (id) => clients.find((c) => c.id === id)?.companyName || "삭제된 거래처";

  const filteredSamples = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return samples;
    return samples.filter((s) =>
      [clientName(s.clientId), s.productName, s.trackingNumber, s.carrier]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [samples, search, clients]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm(s);
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      quantity: Number(form.quantity) || 0,
      shippingCost: form.shippingCost === "" ? "" : Number(form.shippingCost),
    };
    const actor = session?.name || "사용자";
    const cName = clientName(payload.clientId);
    if (editing) {
      await samplesDB.update(editing.id, payload);
      await logActivity({ actor, action: "샘플 발송 수정", summary: `${cName} 샘플 발송 정보 수정` });
    } else {
      await samplesDB.create(payload);
      await logActivity({
        actor,
        action: "샘플 발송 등록",
        summary: `${cName} 샘플 발송 등록 (${payload.productName})`,
        detail: `${payload.quantity.toLocaleString("ko-KR")}개 · ${payload.carrier}`,
      });
    }
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    await samplesDB.remove(deleteTarget.id);
    await logActivity({
      actor: session?.name || "사용자",
      action: "샘플 발송 삭제",
      summary: `${clientName(deleteTarget.clientId)} 샘플 발송 기록이 삭제되었습니다.`,
    });
    setDeleteTarget(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">샘플 발송 관리</h1>
          <p className="text-sm text-subink mt-1">샘플 발송 현황과 후속 연락 일정을 관리합니다.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> 샘플 발송 등록
        </Button>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subink" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="거래처, 제품명, 송장번호로 검색"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm outline-none focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15"
        />
      </div>

      {filteredSamples.length === 0 ? (
        <EmptyState
          title={samples.length === 0 ? "등록된 샘플 발송이 없습니다" : "검색 결과가 없습니다"}
          description={
            samples.length === 0
              ? "샘플을 발송하고 도착 예정일과 후속 연락일을 기록해보세요."
              : "다른 검색어를 시도해보세요."
          }
          action={
            samples.length === 0 && (
              <Button onClick={openCreate}>
                <Plus size={16} /> 샘플 발송 등록
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-white border border-line rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-porcelain text-subink text-xs">
                <th className="text-left font-medium px-4 py-3">거래처</th>
                <th className="text-left font-medium px-4 py-3">제품명</th>
                <th className="text-right font-medium px-4 py-3">수량</th>
                <th className="text-left font-medium px-4 py-3">발송일</th>
                <th className="text-left font-medium px-4 py-3">운송사 / 송장번호</th>
                <th className="text-left font-medium px-4 py-3">도착예정일</th>
                <th className="text-left font-medium px-4 py-3">후속 연락일</th>
                <th className="px-4 py-3 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {filteredSamples.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => openEdit(s)}
                  className="border-t border-line hover:bg-porcelain/60 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-ink flex items-center gap-2">
                    <PackageOpen size={14} className="text-jade-500 shrink-0" />
                    {clientName(s.clientId)}
                  </td>
                  <td className="px-4 py-3 text-subink">{s.productName}</td>
                  <td className="px-4 py-3 text-right text-ink">{s.quantity?.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3 text-subink">{formatDate(s.sentDate)}</td>
                  <td className="px-4 py-3 text-subink">
                    {s.carrier} {s.trackingNumber && `· ${s.trackingNumber}`}
                  </td>
                  <td className="px-4 py-3 text-subink">{formatDate(s.etaDate)}</td>
                  <td className="px-4 py-3">
                    {s.followUpDate ? (
                      <Badge className="bg-gold-400/15 text-gold-500">
                        {formatDate(s.followUpDate)} ({dDayLabel(s.followUpDate)})
                      </Badge>
                    ) : (
                      <span className="text-subink">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      className="p-1.5 rounded-md text-subink hover:bg-white hover:text-clay-600"
                    >
                      <Trash2 size={14} />
                    </button>
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
        title={editing ? "샘플 발송 정보 수정" : "새 샘플 발송 등록"}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="거래처" required className="col-span-2">
              <Select
                required
                placeholder="거래처 선택"
                options={clients.map((c) => c.companyName)}
                value={clientName(form.clientId) === "삭제된 거래처" ? "" : clientName(form.clientId)}
                onChange={(e) => {
                  const c = clients.find((c) => c.companyName === e.target.value);
                  setForm({ ...form, clientId: c?.id || "" });
                }}
              />
            </Field>
            <Field label="제품명" required className="col-span-2">
              <TextInput
                required
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
              />
            </Field>
            <Field label="수량" required>
              <NumberInput
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field label="발송비 (₩)">
              <NumberInput
                value={form.shippingCost}
                onChange={(e) => setForm({ ...form, shippingCost: e.target.value })}
              />
            </Field>
            <Field label="발송일" required>
              <TextInput
                type="date"
                required
                value={form.sentDate}
                onChange={(e) => setForm({ ...form, sentDate: e.target.value })}
              />
            </Field>
            <Field label="운송사">
              <Select
                options={CARRIERS}
                value={form.carrier}
                onChange={(e) => setForm({ ...form, carrier: e.target.value })}
              />
            </Field>
            <Field label="송장번호" className="col-span-2">
              <TextInput
                value={form.trackingNumber}
                onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
              />
            </Field>
            <Field label="도착예정일">
              <TextInput
                type="date"
                value={form.etaDate}
                onChange={(e) => setForm({ ...form, etaDate: e.target.value })}
              />
            </Field>
            <Field label="후속 연락일">
              <TextInput
                type="date"
                value={form.followUpDate}
                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
              />
            </Field>
            <Field label="메모" className="col-span-2">
              <TextArea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
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
        title="샘플 발송 기록을 삭제할까요?"
        description="삭제된 기록은 복구할 수 없습니다."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
