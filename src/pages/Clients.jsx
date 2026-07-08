import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Building2 } from "lucide-react";
import { clientsDB, customCountriesDB, saveCustomCountryIfNew, logActivity } from "../lib/db";
import { CLIENT_STATUS, CLIENT_STATUS_COLOR, IMPORTANCE, IMPORTANCE_COLOR, COUNTRIES } from "../lib/constants";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { Field, TextInput, Select, TextArea } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog } from "../components/ui/Basics";
import ClientDetailDrawer from "../components/ClientDetailDrawer";
import CountrySelect from "../components/CountrySelect";

const EMPTY = {
  companyName: "",
  country: "",
  contactName: "",
  phone: "",
  email: "",
  kakao: "",
  wechat: "",
  whatsapp: "",
  interestProduct: "",
  status: "신규문의",
  importance: "중",
  memo: "",
};

export default function Clients({ openClientId, clearOpenClientId, session }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = () =>
    clientsDB.list().then((rows) =>
      setClients(rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)))
    );

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (openClientId && clients.length) {
      const c = clients.find((c) => c.id === openClientId);
      if (c) setSelected(c);
      clearOpenClientId?.();
    }
  }, [openClientId, clients]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchesStatus = !statusFilter || c.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        [c.companyName, c.contactName, c.country, c.interestProduct, c.email]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [clients, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm(c);
    setModalOpen(true);
    setSelected(null);
  };

  const save = async (e) => {
    e.preventDefault();
    if (form.country) {
      const rows = await customCountriesDB.list();
      await saveCustomCountryIfNew(form.country, [...COUNTRIES, ...rows.map((r) => r.name)]);
    }
    const actor = session?.name || "사용자";
    if (editing) {
      await clientsDB.update(editing.id, form);
      if (editing.status !== form.status) {
        await logActivity({
          actor,
          action: "거래처 상태 변경",
          summary: `${form.companyName} 거래처 상태 변경`,
          detail: `${editing.status} → ${form.status}`,
        });
      } else {
        await logActivity({
          actor,
          action: "거래처 정보 수정",
          summary: `${form.companyName} 거래처 정보 수정`,
        });
      }
    } else {
      await clientsDB.create(form);
      await logActivity({
        actor,
        action: "신규 거래처 등록",
        summary: `${form.companyName} 거래처가 신규 등록되었습니다.`,
      });
    }
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    await clientsDB.remove(deleteTarget.id);
    await logActivity({
      actor: session?.name || "사용자",
      action: "거래처 삭제",
      summary: `${deleteTarget.companyName} 거래처가 삭제되었습니다.`,
    });
    setDeleteTarget(null);
    setSelected(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">거래처 관리</h1>
          <p className="text-sm text-subink mt-1">전체 {clients.length}개 거래처</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> 거래처 등록
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subink" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="회사명, 담당자, 국가, 제품으로 검색"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm outline-none focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              statusFilter === "" ? "bg-ink text-white border-ink" : "border-line text-subink hover:bg-white"
            }`}
          >
            전체
          </button>
          {CLIENT_STATUS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                statusFilter === s ? "bg-ink text-white border-ink" : "border-line text-subink hover:bg-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={clients.length === 0 ? "등록된 거래처가 없습니다" : "검색 결과가 없습니다"}
          description={
            clients.length === 0
              ? "첫 거래처를 등록하고 상담 진행 상황을 관리해보세요."
              : "다른 검색어나 필터를 시도해보세요."
          }
          action={
            clients.length === 0 && (
              <Button onClick={openCreate}>
                <Plus size={16} /> 거래처 등록
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-white border border-line rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-porcelain text-subink text-xs">
                <th className="text-left font-medium px-4 py-3">회사명</th>
                <th className="text-left font-medium px-4 py-3">국가</th>
                <th className="text-left font-medium px-4 py-3">담당자</th>
                <th className="text-left font-medium px-4 py-3">관심 제품</th>
                <th className="text-left font-medium px-4 py-3">거래 상태</th>
                <th className="text-left font-medium px-4 py-3">중요도</th>
                <th className="px-4 py-3 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="border-t border-line hover:bg-porcelain/60 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-jade-500 shrink-0" />
                      {c.companyName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-subink">{c.country || "-"}</td>
                  <td className="px-4 py-3 text-subink">{c.contactName || "-"}</td>
                  <td className="px-4 py-3 text-subink">{c.interestProduct || "-"}</td>
                  <td className="px-4 py-3">
                    <Badge className={CLIENT_STATUS_COLOR[c.status]}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={IMPORTANCE_COLOR[c.importance]}>{c.importance}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(c);
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
        title={editing ? "거래처 정보 수정" : "새 거래처 등록"}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="회사명" required className="col-span-2">
              <TextInput
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </Field>
            <Field label="국가">
              <CountrySelect
                value={form.country}
                onChange={(v) => setForm({ ...form, country: v })}
              />
            </Field>
            <Field label="담당자명">
              <TextInput
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </Field>
            <Field label="연락처">
              <TextInput
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+82 10-0000-0000"
              />
            </Field>
            <Field label="이메일">
              <TextInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="카카오톡 ID">
              <TextInput
                value={form.kakao}
                onChange={(e) => setForm({ ...form, kakao: e.target.value })}
              />
            </Field>
            <Field label="위챗 ID">
              <TextInput
                value={form.wechat}
                onChange={(e) => setForm({ ...form, wechat: e.target.value })}
              />
            </Field>
            <Field label="WhatsApp" className="col-span-2">
              <TextInput
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              />
            </Field>
            <Field label="관심 제품" className="col-span-2">
              <TextInput
                value={form.interestProduct}
                onChange={(e) => setForm({ ...form, interestProduct: e.target.value })}
              />
            </Field>
            <Field label="거래 상태" required>
              <Select
                required
                options={CLIENT_STATUS}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              />
            </Field>
            <Field label="중요도" required>
              <Select
                required
                options={IMPORTANCE}
                value={form.importance}
                onChange={(e) => setForm({ ...form, importance: e.target.value })}
              />
            </Field>
            <Field label="메모" className="col-span-2">
              <TextArea
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
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

      {selected && (
        <ClientDetailDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onEdit={openEdit}
          session={session}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="거래처를 삭제할까요?"
        description={`"${deleteTarget?.companyName}" 거래처와 관련 상담 기록이 함께 영향을 받을 수 있습니다.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
