import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileText, Search, Printer, X, ChevronUp, ChevronDown } from "lucide-react";
import { quotesDB, clientsDB, productsDB, logActivity, getSettings } from "../lib/db";
import { canAccess } from "../lib/permissions";
import { fetchAllQuotationItems, replaceQuotationItems } from "../lib/quotationItems";
import { printQuotation } from "../lib/quotePrint";
import { QUOTE_STATUS, QUOTE_STATUS_COLOR, CURRENCY } from "../lib/constants";
import { formatMoney, formatDate, todayISO } from "../lib/utils";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { Field, TextInput, NumberInput, Select, TextArea } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog, Toast } from "../components/ui/Basics";

const EMPTY_HEADER = {
  clientId: "",
  currency: "KRW",
  quoteDate: todayISO(),
  status: "작성중",
  vatIncluded: false,
  memo: "",
};

const EMPTY_ITEM = () => ({
  _key: Math.random().toString(36).slice(2),
  productId: "",
  productName: "",
  spec: "",
  quantity: "",
  unitPrice: "",
  discountRate: "",
});

/** 과거(단일 품목) 견적서를 편집할 때 품목 1건으로 변환해서 보여줍니다. */
function legacyItemFromHeader(q, products) {
  if (!q.productId) return [];
  const product = products.find((p) => p.id === q.productId);
  return [
    {
      _key: "legacy",
      productId: q.productId,
      productName: product?.name || "삭제된 제품",
      spec: product?.capacity || "",
      quantity: q.quantity ?? "",
      unitPrice: q.unitPrice ?? "",
      discountRate: "",
    },
  ];
}

function calcItem(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  const rate = Number(item.discountRate) || 0;
  const gross = qty * price;
  const discountAmount = Math.round(gross * (rate / 100));
  const supplyAmount = gross - discountAmount;
  return { discountAmount, supplyAmount };
}

export default function Quotes({ session, permissionMap }) {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [itemsByQuotation, setItemsByQuotation] = useState({});
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [items, setItems] = useState([EMPTY_ITEM()]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const canCreate = canAccess(session, permissionMap, "quotes", "create");
  const canEdit = canAccess(session, permissionMap, "quotes", "edit");
  const canDelete = canAccess(session, permissionMap, "quotes", "delete");

  const load = () => {
    quotesDB.list().then((rows) =>
      setQuotes(rows.sort((a, b) => new Date(b.quoteDate) - new Date(a.quoteDate)))
    );
    clientsDB.list().then(setClients);
    productsDB.list().then(setProducts);
    fetchAllQuotationItems().then(setItemsByQuotation);
    getSettings().then(setSettings);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const clientName = (id) => clients.find((c) => c.id === id)?.companyName || "삭제된 거래처";

  // 견적서별 품목 목록: quotation_items가 있으면 그것을, 없으면(과거 단일품목 견적서)
  // 헤더의 productId/quantity/unitPrice로부터 품목 1건을 만들어 보여줍니다.
  const itemsOf = (q) => {
    const real = itemsByQuotation[q.id];
    if (real && real.length > 0) return real;
    if (q.productId) {
      const product = products.find((p) => p.id === q.productId);
      return [
        {
          productName: product?.name || "삭제된 제품",
          spec: product?.capacity || "",
          quantity: q.quantity || 0,
          unitPrice: q.unitPrice || 0,
          discountRate: 0,
          supplyAmount: (q.quantity || 0) * (q.unitPrice || 0),
        },
      ];
    }
    return [];
  };

  const filteredQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((quote) => {
      const productNames = itemsOf(quote).map((it) => it.productName).join(" ");
      return [clientName(quote.clientId), productNames, quote.memo]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [quotes, search, clients, products, itemsByQuotation]);

  const itemTotals = useMemo(() => {
    const calced = items.map((it) => ({ ...it, ...calcItem(it) }));
    const subtotal = calced.reduce((s, it) => s + it.supplyAmount, 0);
    const vatAmount = header.vatIncluded ? Math.round(subtotal * 0.1) : 0;
    return { calced, subtotal, vatAmount, grandTotal: subtotal + vatAmount };
  }, [items, header.vatIncluded]);

  const openCreate = () => {
    setEditing(null);
    setHeader(EMPTY_HEADER);
    setItems([EMPTY_ITEM()]);
    setModalOpen(true);
  };

  const openEdit = (q) => {
    setEditing(q);
    setHeader({
      clientId: q.clientId || "",
      currency: q.currency || "KRW",
      quoteDate: q.quoteDate || todayISO(),
      status: q.status || "작성중",
      vatIncluded: !!q.vatIncluded,
      memo: q.memo || "",
    });
    const real = itemsByQuotation[q.id];
    const initialItems =
      real && real.length > 0
        ? real.map((it) => ({
            _key: it.id,
            productId: it.productId || "",
            productName: it.productName,
            spec: it.spec,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountRate: it.discountRate || "",
          }))
        : legacyItemFromHeader(q, products);
    setItems(initialItems.length > 0 ? initialItems : [EMPTY_ITEM()]);
    setModalOpen(true);
  };

  const addItem = () => setItems((prev) => [...prev, EMPTY_ITEM()]);
  const removeItem = (key) => setItems((prev) => (prev.length > 1 ? prev.filter((it) => it._key !== key) : prev));
  const moveItem = (index, delta) => {
    setItems((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };
  const updateItem = (key, patch) =>
    setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));

  const selectProduct = (key, productId) => {
    const product = products.find((p) => p.id === productId);
    updateItem(key, {
      productId,
      productName: product?.name || "",
      spec: product?.capacity || "",
      unitPrice: product?.basePrice ?? "",
    });
  };

  const save = async (e) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.productName.trim());
    if (validItems.length === 0) {
      alert("품목을 1개 이상 입력해주세요.");
      return;
    }
    const calced = validItems.map((it) => ({ ...it, ...calcItem(it) }));
    const subtotal = calced.reduce((s, it) => s + it.supplyAmount, 0);
    const vatAmount = header.vatIncluded ? Math.round(subtotal * 0.1) : 0;
    const grandTotal = subtotal + vatAmount;

    const payload = {
      ...header,
      // 과거 단일 품목 필드는 더 이상 채우지 않되(다중 품목 기준으로 전환),
      // 기존 데이터 자체는 삭제하지 않습니다.
      subtotal,
      vatAmount,
      totalAmount: grandTotal,
    };

    const actor = session?.name || "사용자";
    const cName = clientName(payload.clientId);
    let quotationId;

    if (editing) {
      quotationId = editing.id;
      await quotesDB.update(editing.id, payload);
      if (editing.status !== payload.status) {
        await logActivity({
          actor,
          action: "견적 상태 변경",
          summary: `${cName} 견적 상태 변경`,
          detail: `${editing.status} → ${payload.status}`,
        });
      } else {
        await logActivity({ actor, action: "견적 수정", summary: `${cName} 견적 수정 (품목 ${calced.length}건)` });
      }
    } else {
      const created = await quotesDB.create(payload);
      quotationId = created.id;
      await logActivity({
        actor,
        action: "견적 등록",
        summary: `${cName} 견적 등록 (품목 ${calced.length}건)`,
        detail: `${formatMoney(grandTotal, payload.currency)}`,
      });
    }

    await replaceQuotationItems(
      quotationId,
      calced.map((it) => ({
        productId: it.productId || null,
        productName: it.productName,
        spec: it.spec,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discountRate: Number(it.discountRate) || 0,
        discountAmount: it.discountAmount,
        supplyAmount: it.supplyAmount,
      }))
    );

    setModalOpen(false);
    setToastMsg(editing ? "견적서를 수정했습니다." : "견적서를 등록했습니다.");
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
    setToastMsg("견적서를 삭제했습니다.");
    load();
  };

  const handlePrint = (q) => {
    const client = clients.find((c) => c.id === q.clientId);
    printQuotation({ quote: q, items: itemsOf(q), client, settings });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">견적 관리</h1>
          <p className="text-sm text-subink mt-1">거래처별 견적서를 여러 품목과 함께 관리합니다.</p>
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
                <th className="text-left font-medium px-4 py-3">품목</th>
                <th className="text-right font-medium px-4 py-3">총액</th>
                <th className="text-left font-medium px-4 py-3">견적일</th>
                <th className="text-left font-medium px-4 py-3">상태</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((q) => {
                const qItems = itemsOf(q);
                const total = q.totalAmount ?? qItems.reduce((s, it) => s + (it.supplyAmount || 0), 0);
                return (
                  <tr
                    key={q.id}
                    onClick={canEdit ? () => openEdit(q) : undefined}
                    className={`border-t border-line hover:bg-porcelain/60 ${canEdit ? "cursor-pointer" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-ink flex items-center gap-2">
                      <FileText size={14} className="text-jade-500 shrink-0" />
                      {clientName(q.clientId)}
                    </td>
                    <td className="px-4 py-3 text-subink">
                      {qItems.length === 0
                        ? "-"
                        : qItems.length === 1
                        ? qItems[0].productName
                        : `${qItems[0].productName} 외 ${qItems.length - 1}건`}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink">{formatMoney(total, q.currency)}</td>
                    <td className="px-4 py-3 text-subink">{formatDate(q.quoteDate)}</td>
                    <td className="px-4 py-3">
                      <Badge className={QUOTE_STATUS_COLOR[q.status]}>{q.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrint(q);
                          }}
                          className="p-1.5 rounded-md text-subink hover:bg-white hover:text-jade-600"
                          title="인쇄 / PDF"
                        >
                          <Printer size={14} />
                        </button>
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "견적 수정" : "새 견적 작성"}
        width="max-w-3xl"
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="거래처" required className="col-span-2">
              <Select
                required
                placeholder="거래처 선택"
                options={clients.map((c) => c.companyName)}
                value={clientName(header.clientId) === "삭제된 거래처" ? "" : clientName(header.clientId)}
                onChange={(e) => {
                  const c = clients.find((c) => c.companyName === e.target.value);
                  setHeader({ ...header, clientId: c?.id || "" });
                }}
              />
            </Field>
            <Field label="통화" required>
              <Select
                required
                options={CURRENCY}
                value={header.currency}
                onChange={(e) => setHeader({ ...header, currency: e.target.value })}
              />
            </Field>
            <Field label="견적일" required>
              <TextInput
                type="date"
                required
                value={header.quoteDate}
                onChange={(e) => setHeader({ ...header, quoteDate: e.target.value })}
              />
            </Field>
            <Field label="견적 상태" required>
              <Select
                required
                options={QUOTE_STATUS}
                value={header.status}
                onChange={(e) => setHeader({ ...header, status: e.target.value })}
              />
            </Field>
            <Field label="부가세">
              <label className="flex items-center gap-2 text-sm text-ink h-full pt-1.5">
                <input
                  type="checkbox"
                  checked={header.vatIncluded}
                  onChange={(e) => setHeader({ ...header, vatIncluded: e.target.checked })}
                  className="w-4 h-4 accent-jade-600"
                />
                10% 부가세 포함
              </label>
            </Field>
          </div>

          <div className="border-t border-line pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-ink">품목</p>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus size={13} /> 품목 추가
              </Button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {items.map((it, index) => {
                const { discountAmount, supplyAmount } = calcItem(it);
                return (
                  <div key={it._key} className="border border-line rounded-lg p-3 bg-porcelain/40">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-6 gap-2">
                        <div className="col-span-2">
                          <Select
                            placeholder="제품 선택"
                            options={products.map((p) => p.name)}
                            value={it.productName}
                            onChange={(e) => {
                              const p = products.find((p) => p.name === e.target.value);
                              if (p) selectProduct(it._key, p.id);
                              else updateItem(it._key, { productName: e.target.value, productId: "" });
                            }}
                          />
                        </div>
                        <TextInput
                          placeholder="규격"
                          value={it.spec}
                          onChange={(e) => updateItem(it._key, { spec: e.target.value })}
                        />
                        <NumberInput
                          placeholder="수량"
                          value={it.quantity}
                          onChange={(e) => updateItem(it._key, { quantity: e.target.value })}
                        />
                        <NumberInput
                          placeholder="단가"
                          value={it.unitPrice}
                          onChange={(e) => updateItem(it._key, { unitPrice: e.target.value })}
                        />
                        <NumberInput
                          placeholder="할인율(%)"
                          value={it.discountRate}
                          onChange={(e) => updateItem(it._key, { discountRate: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col shrink-0">
                        <button
                          type="button"
                          onClick={() => moveItem(index, -1)}
                          disabled={index === 0}
                          className="text-subink/60 hover:text-jade-600 disabled:opacity-20"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(index, 1)}
                          disabled={index === items.length - 1}
                          className="text-subink/60 hover:text-jade-600 disabled:opacity-20"
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(it._key)}
                        disabled={items.length === 1}
                        className="p-1.5 rounded-md text-subink hover:text-clay-600 disabled:opacity-20 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="text-right text-xs text-subink mt-1.5">
                      할인액 {formatMoney(discountAmount, header.currency)} · 공급가액{" "}
                      <span className="font-medium text-ink">{formatMoney(supplyAmount, header.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-64 text-sm space-y-1">
              <div className="flex justify-between text-subink">
                <span>공급가액 합계</span>
                <span>{formatMoney(itemTotals.subtotal, header.currency)}</span>
              </div>
              {header.vatIncluded && (
                <div className="flex justify-between text-subink">
                  <span>부가세(10%)</span>
                  <span>{formatMoney(itemTotals.vatAmount, header.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-ink border-t border-line pt-1.5">
                <span>총 합계</span>
                <span>{formatMoney(itemTotals.grandTotal, header.currency)}</span>
              </div>
            </div>
          </div>

          <Field label="메모">
            <TextArea value={header.memo} onChange={(e) => setHeader({ ...header, memo: e.target.value })} />
          </Field>

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
      <Toast message={toastMsg} />
    </div>
  );
}
