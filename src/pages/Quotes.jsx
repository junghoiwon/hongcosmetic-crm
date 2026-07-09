import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileText, Search } from "lucide-react";
import { quotesDB, clientsDB, productsDB, logActivity } from "../lib/db";
import { canAccess } from "../lib/permissions";
import { QUOTE_STATUS, QUOTE_STATUS_COLOR, CURRENCY } from "../lib/constants";
import { formatMoney, formatDate, todayISO } from "../lib/utils";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { Field, TextInput, NumberInput, Select, TextArea } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog } from "../components/ui/Basics";

const EMPTY = {
  clientId: "",
  productId: "",
  quantity: "",
  unitPrice: "",
  currency: "KRW",
  quoteDate: todayISO(),
  status: "작성중",
  memo: "",
};

export default function Quotes({ session, permissionMap }) {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canCreate = canAccess(session, permissionMap, "quotes", "create");
  const canEdit = canAccess(session, permissionMap, "quotes", "edit");
  const canDelete = canAccess(session, permissionMap, "quotes", "delete");

  const load = () => {
    quotesDB.list().then((rows) =>
      setQuotes(rows.sort((a, b) => new Date(b.quoteDate) - new Date(a.quoteDate)))
    );
    clientsDB.list().then(setClients);
    productsDB.list().then(setProducts);
  };

  useEffect(() => {
    load();
  }, []);

  const clientName = (id) => clients.find((c) => c.id === id)?.companyName || "삭제된 거래처";
  const productName = (id) => products.find((p) => p.id === id)?.name || "삭제된 제품";

  const filteredQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((quote) =>
      [clientName(quote.clientId), productName(quote.productId), quote.memo]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [quotes, search, clients, products]);

  const total = useMemo(() => {
    const q = Number(form.quantity) || 0;
    const u = Number(form.unitPrice) || 0;
    return q * u;
  }, [form.quantity, form.unitPrice]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (q) => {
    setEditing(q);
    setForm(q);
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      quantity: Number(form.quantity) || 0,
      unitPrice: Number(form.unitPrice) || 0,
      totalAmount: total,
    };
    const actor = session?.name || "사용자";
    const cName = clientName(payload.clientId);
    const pName = productName(payload.productId);
    if (editing) {
      await quotesDB.update(editing.id, payload);
      if (editing.status !== payload.status) {
        await logActivity({
          actor,
          action: "견적 상태 변경",
          summary: `${cName} 견적 상태 변경`,
          detail: `${editing.status} → ${payload.status}`,
        });
      } else {
        await logActivity({ actor, action: "견적 수정", summary: `${cName} 견적 수정` });
      }
    } else {
      await quotesDB.create(payload);
      await logActivity({
        actor,
        action: "견적 등록",
        summary: `${cName} 견적 등록 (${pName})`,
        detail: `${payload.quantity.toLocaleString("ko-KR")}개 · ${formatMoney(payload.totalAmount, payload.currency)}`,
      });
    }
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    await quotesDB.remove(deleteTarget.id);
    await logActivity({
      actor: session?.name || "사용자",
      action: "견적 삭제",
      summary: `${clientName(deleteTarget.clientId)} 견적이 삭제되었습니다.`,
    });
    setDeleteTarget(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">견적 관리</h1>
          <p className="text-sm text-subink mt-1">거래처별 견적 발송 현황을 관리합니다.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus size={16} /> 견적 작성
          </Button>
        )}
      </div>

      <div className="relative max-w-sm mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subink" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="거래처, 제품, 메모로 검색"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm outline-none focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15"
        />
      </div>

      {filteredQuotes.length === 0 ? (
        <EmptyState
          title={quotes.length === 0 ? "작성된 견적이 없습니다" : "검색 결과가 없습니다"}
          description={
            quotes.length === 0 ? "거래처와 제품을 선택해 견적서를 작성해보세요." : "다른 검색어를 시도해보세요."
          }
          action={
            quotes.length === 0 && canCreate && (
              <Button onClick={openCreate}>
                <Plus size={16} /> 견적 작성
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
                <th className="text-left font-medium px-4 py-3">제품</th>
                <th className="text-right font-medium px-4 py-3">수량</th>
                <th className="text-right font-medium px-4 py-3">단가</th>
                <th className="text-right font-medium px-4 py-3">총액</th>
                <th className="text-left font-medium px-4 py-3">견적일</th>
                <th className="text-left font-medium px-4 py-3">상태</th>
                <th className="px-4 py-3 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((q) => (
                <tr
                  key={q.id}
                  onClick={canEdit ? () => openEdit(q) : undefined}
                  className={`border-t border-line hover:bg-porcelain/60 ${canEdit ? "cursor-pointer" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-ink flex items-center gap-2">
                    <FileText size={14} className="text-jade-500 shrink-0" />
                    {clientName(q.clientId)}
                  </td>
                  <td className="px-4 py-3 text-subink">{productName(q.productId)}</td>
                  <td className="px-4 py-3 text-right text-ink">{q.quantity?.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatMoney(q.unitPrice, q.currency)}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink">
                    {formatMoney(q.totalAmount, q.currency)}
                  </td>
                  <td className="px-4 py-3 text-subink">{formatDate(q.quoteDate)}</td>
                  <td className="px-4 py-3">
                    <Badge className={QUOTE_STATUS_COLOR[q.status]}>{q.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(q);
                        }}
                        className="p-1.5 rounded-md text-subink hover:bg-white hover:text-clay-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
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
        title={editing ? "견적 수정" : "새 견적 작성"}
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
            <Field label="제품" required className="col-span-2">
              <Select
                required
                placeholder="제품 선택"
                options={products.map((p) => p.name)}
                value={productName(form.productId) === "삭제된 제품" ? "" : productName(form.productId)}
                onChange={(e) => {
                  const p = products.find((p) => p.name === e.target.value);
                  setForm({
                    ...form,
                    productId: p?.id || "",
                    unitPrice: form.unitPrice || p?.basePrice || "",
                  });
                }}
              />
            </Field>
            <Field label="수량" required>
              <NumberInput
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field label="단가" required>
              <NumberInput
                required
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              />
            </Field>
            <Field label="통화" required>
              <Select
                required
                options={CURRENCY}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </Field>
            <Field label="총액 (자동계산)">
              <div className="w-full rounded-lg border border-line bg-porcelain px-3 py-2 text-sm text-ink font-medium">
                {formatMoney(total, form.currency)}
              </div>
            </Field>
            <Field label="견적일" required>
              <TextInput
                type="date"
                required
                value={form.quoteDate}
                onChange={(e) => setForm({ ...form, quoteDate: e.target.value })}
              />
            </Field>
            <Field label="견적 상태" required>
              <Select
                required
                options={QUOTE_STATUS}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
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
            <Button type="submit">{editing ? "저장" : "작성 완료"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="견적을 삭제할까요?"
        description="삭제된 견적서는 복구할 수 없습니다."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
