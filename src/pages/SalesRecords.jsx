import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Receipt, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { clientsDB, productsDB, logActivity } from "../lib/db";
import { fetchClientContacts } from "../lib/clientContacts";
import {
  fetchSalesRecords,
  createSalesRecord,
  updateSalesRecord,
  deleteSalesRecord,
  fetchAllSalesRecordItems,
  replaceSalesRecordItems,
} from "../lib/salesRecords";
import { canAccess, isAdminProfile } from "../lib/permissions";
import { SALE_TYPE, PAYMENT_STATUS, PAYMENT_STATUS_COLOR, CURRENCY } from "../lib/constants";
import { formatMoney, formatDate, todayISO, PERIOD_OPTIONS, isWithinPeriod } from "../lib/utils";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { Field, TextInput, NumberInput, Select, TextArea } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog, Toast } from "../components/ui/Basics";

const EMPTY_HEADER = {
  clientId: "",
  contactId: "",
  rep: "",
  saleDate: todayISO(),
  saleType: "직접입력",
  orderNumber: "",
  paymentStatus: "미입금",
  expectedPaymentDate: "",
  actualPaymentDate: "",
  salesChannel: "",
  country: "",
  currency: "KRW",
  exchangeRate: 1,
  memo: "",
};

const EMPTY_ITEM = () => ({
  _key: Math.random().toString(36).slice(2),
  productId: "",
  productName: "",
  quantity: "",
  unitPrice: "",
  discountRate: "",
});

function calcItem(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  const rate = Number(item.discountRate) || 0;
  const gross = qty * price;
  const discountAmount = Math.round(gross * (rate / 100));
  return { discountAmount, supplyAmount: gross - discountAmount };
}

function monthKey(dateStr) {
  return (dateStr || "").slice(0, 7);
}

function MonthlyChart({ records }) {
  const months = useMemo(() => {
    const now = new Date();
    const keys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return keys;
  }, []);

  const totals = useMemo(() => {
    const map = Object.fromEntries(months.map((m) => [m, 0]));
    for (const r of records) {
      const k = monthKey(r.saleDate);
      if (k in map) map[k] += r.krwAmount || 0;
    }
    return map;
  }, [records, months]);

  const max = Math.max(1, ...Object.values(totals));

  return (
    <div className="flex items-end gap-3 h-40 px-2">
      {months.map((m) => {
        const value = totals[m];
        const heightPct = Math.max(2, (value / max) * 100);
        return (
          <div key={m} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-[10px] text-subink mb-1">{value > 0 ? `${Math.round(value / 10000)}만` : ""}</span>
            <div
              className="w-full rounded-t-md"
              style={{ height: `${heightPct}%`, backgroundColor: "var(--brand-primary)", minHeight: 2 }}
            />
            <span className="text-[10px] text-subink mt-1">{m.slice(5)}월</span>
          </div>
        );
      })}
    </div>
  );
}

function TopProductsChart({ items }) {
  const top = useMemo(() => {
    const map = {};
    for (const it of items) {
      if (!map[it.productName]) map[it.productName] = 0;
      map[it.productName] += it.supplyAmount || 0;
    }
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [items]);

  const max = Math.max(1, ...top.map((t) => t.amount));

  if (top.length === 0) return <p className="text-sm text-subink text-center py-6">표시할 품목 데이터가 없습니다.</p>;

  return (
    <div className="space-y-2.5">
      {top.map((t) => (
        <div key={t.name}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-ink truncate">{t.name}</span>
            <span className="text-subink shrink-0">{formatMoney(t.amount, "KRW")}</span>
          </div>
          <div className="h-2 rounded-full bg-porcelain overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(t.amount / max) * 100}%`, backgroundColor: "var(--brand-secondary)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SalesRecords({ session, permissionMap }) {
  const [records, setRecords] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [itemsBySale, setItemsBySale] = useState({});
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [items, setItems] = useState([EMPTY_ITEM()]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const canCreate = canAccess(session, permissionMap, "sales_records", "create");
  const canEdit = canAccess(session, permissionMap, "sales_records", "edit");
  const canDelete = isAdminProfile(session) || canAccess(session, permissionMap, "sales_records", "delete");

  const load = () => {
    fetchSalesRecords().then(setRecords);
    clientsDB.list().then(setClients);
    productsDB.list().then(setProducts);
    fetchAllSalesRecordItems().then(setItemsBySale);
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
  const clientName = (id) => clientMap[id]?.companyName || "삭제된 거래처";

  const periodFiltered = useMemo(() => records.filter((r) => isWithinPeriod(r.saleDate, period)), [records, period]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return periodFiltered;
    return periodFiltered.filter((r) => {
      const itemNames = (itemsBySale[r.id] || []).map((it) => it.productName).join(" ");
      return [clientName(r.clientId), r.rep, r.orderNumber, itemNames].filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [periodFiltered, search, itemsBySale, clients]);

  const allFilteredItems = useMemo(
    () => filtered.flatMap((r) => itemsBySale[r.id] || []),
    [filtered, itemsBySale]
  );

  const totalsByCurrency = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      if (!map[r.currency]) map[r.currency] = 0;
      map[r.currency] += r.totalAmount || 0;
    }
    return Object.entries(map);
  }, [filtered]);

  const itemTotals = useMemo(() => {
    const calced = items.map((it) => ({ ...it, ...calcItem(it) }));
    const subtotal = calced.reduce((s, it) => s + it.supplyAmount, 0);
    return { calced, subtotal };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setHeader({ ...EMPTY_HEADER, rep: session?.name || "" });
    setItems([EMPTY_ITEM()]);
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setHeader({
      clientId: r.clientId || "",
      contactId: r.contactId || "",
      rep: r.rep || "",
      saleDate: r.saleDate || todayISO(),
      saleType: r.saleType || "직접입력",
      orderNumber: r.orderNumber || "",
      paymentStatus: r.paymentStatus || "미입금",
      expectedPaymentDate: r.expectedPaymentDate || "",
      actualPaymentDate: r.actualPaymentDate || "",
      salesChannel: r.salesChannel || "",
      country: r.country || "",
      currency: r.currency || "KRW",
      exchangeRate: r.exchangeRate || 1,
      memo: r.memo || "",
    });
    const real = itemsBySale[r.id] || [];
    setItems(
      real.length > 0
        ? real.map((it) => ({ _key: it.id, productId: it.productId || "", productName: it.productName, quantity: it.quantity, unitPrice: it.unitPrice, discountRate: "" }))
        : [EMPTY_ITEM()]
    );
    setModalOpen(true);
  };

  const [clientContactOptions, setClientContactOptions] = useState([]);
  useEffect(() => {
    if (header.clientId) fetchClientContacts(header.clientId).then(setClientContactOptions);
    else setClientContactOptions([]);
  }, [header.clientId]);

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
  const updateItem = (key, patch) => setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  const selectProduct = (key, productId) => {
    const p = products.find((p) => p.id === productId);
    updateItem(key, { productId, productName: p?.name || "", unitPrice: p?.basePrice ?? "" });
  };

  const save = async (e) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.productName.trim());
    if (validItems.length === 0) {
      alert("품목을 1개 이상 입력해주세요.");
      return;
    }
    const calced = validItems.map((it) => ({ ...it, ...calcItem(it) }));
    const totalAmount = calced.reduce((s, it) => s + it.supplyAmount, 0);
    const krwAmount = header.currency === "KRW" ? totalAmount : Math.round(totalAmount * (Number(header.exchangeRate) || 1));
    const payload = { ...header, exchangeRate: Number(header.exchangeRate) || 1, totalAmount, krwAmount };
    const actor = session?.name || "사용자";
    const cName = clientName(payload.clientId);
    let salesId;

    if (editing) {
      salesId = editing.id;
      await updateSalesRecord(editing.id, payload);
      await logActivity({ actor, action: "판매실적 수정", summary: `${cName} 판매실적 수정 (품목 ${calced.length}건)` });
    } else {
      const created = await createSalesRecord(payload);
      salesId = created.id;
      await logActivity({ actor, action: "판매실적 등록", summary: `${cName} 판매실적 등록`, detail: formatMoney(totalAmount, payload.currency) });
    }

    await replaceSalesRecordItems(
      salesId,
      calced.map((it) => ({
        productId: it.productId || null,
        productName: it.productName,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discountAmount: it.discountAmount,
        supplyAmount: it.supplyAmount,
      }))
    );

    setModalOpen(false);
    setToastMsg(editing ? "판매실적을 수정했습니다." : "판매실적을 등록했습니다.");
    load();
  };

  const confirmDelete = async () => {
    await deleteSalesRecord(deleteTarget.id);
    await logActivity({ actor: session?.name || "사용자", action: "판매실적 삭제", summary: `${clientName(deleteTarget.clientId)} 판매실적이 삭제되었습니다.` });
    setDeleteTarget(null);
    setToastMsg("판매실적을 삭제했습니다.");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">판매실적 등록</h1>
          <p className="text-sm text-subink mt-1">견적 여부와 관계없이 실제 판매/입금 실적을 직접 관리합니다.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus size={16} /> 판매실적 등록
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-line rounded-card shadow-card p-4">
          <p className="text-sm font-medium text-ink mb-2">월별 판매 추이 (원화환산, 최근 6개월)</p>
          <MonthlyChart records={filtered} />
        </div>
        <div className="bg-white border border-line rounded-card shadow-card p-4">
          <p className="text-sm font-medium text-ink mb-3">Top 5 품목 (공급가액 기준)</p>
          <TopProductsChart items={allFilteredItems} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative max-w-xs w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subink" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="거래처, 담당자, 주문번호, 품목으로 검색"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm outline-none focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15"
          />
        </div>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIOD_OPTIONS} className="!w-auto" />
        <div className="ml-auto flex items-center gap-2">
          {totalsByCurrency.map(([currency, amount]) => (
            <Badge key={currency} className="bg-jade-50 text-jade-600">{formatMoney(amount, currency)}</Badge>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={records.length === 0 ? "등록된 판매실적이 없습니다" : "검색 결과가 없습니다"}
          description={records.length === 0 ? "견적 전환 없이도 바로 판매실적을 등록할 수 있습니다." : "다른 조건을 시도해보세요."}
          action={records.length === 0 && canCreate && <Button onClick={openCreate}><Plus size={16} /> 판매실적 등록</Button>}
        />
      ) : (
        <div className="bg-white border border-line rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="bg-porcelain text-subink text-xs">
                <th className="text-left font-medium px-4 py-3">판매일</th>
                <th className="text-left font-medium px-4 py-3">거래처</th>
                <th className="text-left font-medium px-4 py-3">품목</th>
                <th className="text-left font-medium px-4 py-3">유형</th>
                <th className="text-left font-medium px-4 py-3">채널</th>
                <th className="text-right font-medium px-4 py-3">금액</th>
                <th className="text-left font-medium px-4 py-3">입금상태</th>
                <th className="px-4 py-3 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const rItems = itemsBySale[r.id] || [];
                return (
                  <tr
                    key={r.id}
                    onClick={canEdit ? () => openEdit(r) : undefined}
                    className={`border-t border-line hover:bg-porcelain/60 ${canEdit ? "cursor-pointer" : ""}`}
                  >
                    <td className="px-4 py-3 text-subink whitespace-nowrap">{formatDate(r.saleDate)}</td>
                    <td className="px-4 py-3 font-medium text-ink flex items-center gap-1.5">
                      <Receipt size={13} className="text-jade-500 shrink-0" />
                      {clientName(r.clientId)}
                    </td>
                    <td className="px-4 py-3 text-subink">
                      {rItems.length === 0 ? "-" : rItems.length === 1 ? rItems[0].productName : `${rItems[0].productName} 외 ${rItems.length - 1}건`}
                    </td>
                    <td className="px-4 py-3 text-subink">{r.saleType}</td>
                    <td className="px-4 py-3 text-subink">{r.salesChannel || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium text-ink">{formatMoney(r.totalAmount, r.currency)}</td>
                    <td className="px-4 py-3">
                      <Badge className={PAYMENT_STATUS_COLOR[r.paymentStatus] || "bg-line text-subink"}>{r.paymentStatus}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
                          className="p-1.5 rounded-md text-subink hover:bg-white hover:text-clay-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "판매실적 수정" : "새 판매실적 등록"} width="max-w-3xl">
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
                  setHeader({ ...header, clientId: c?.id || "", contactId: "", country: c?.country || header.country });
                }}
              />
            </Field>
            <Field label="거래처 담당자">
              <Select
                placeholder="선택 안 함"
                options={clientContactOptions.map((c) => ({ value: c.id, label: c.name }))}
                value={header.contactId}
                onChange={(e) => setHeader({ ...header, contactId: e.target.value })}
              />
            </Field>
            <Field label="우리측 담당자">
              <TextInput value={header.rep} onChange={(e) => setHeader({ ...header, rep: e.target.value })} />
            </Field>
            <Field label="판매일" required>
              <TextInput type="date" required value={header.saleDate} onChange={(e) => setHeader({ ...header, saleDate: e.target.value })} />
            </Field>
            <Field label="판매 유형">
              <Select options={SALE_TYPE} value={header.saleType} onChange={(e) => setHeader({ ...header, saleType: e.target.value })} />
            </Field>
            <Field label="주문번호">
              <TextInput value={header.orderNumber} onChange={(e) => setHeader({ ...header, orderNumber: e.target.value })} />
            </Field>
            <Field label="판매 채널">
              <TextInput value={header.salesChannel} onChange={(e) => setHeader({ ...header, salesChannel: e.target.value })} placeholder="예: 자사몰, 아마존" />
            </Field>
            <Field label="국가">
              <TextInput value={header.country} onChange={(e) => setHeader({ ...header, country: e.target.value })} />
            </Field>
            <Field label="통화">
              <Select options={CURRENCY} value={header.currency} onChange={(e) => setHeader({ ...header, currency: e.target.value })} />
            </Field>
            <Field label="환율 (KRW 환산용)">
              <NumberInput value={header.exchangeRate} onChange={(e) => setHeader({ ...header, exchangeRate: e.target.value })} disabled={header.currency === "KRW"} />
            </Field>
            <Field label="입금 상태">
              <Select options={PAYMENT_STATUS} value={header.paymentStatus} onChange={(e) => setHeader({ ...header, paymentStatus: e.target.value })} />
            </Field>
            <Field label="입금 예정일">
              <TextInput type="date" value={header.expectedPaymentDate} onChange={(e) => setHeader({ ...header, expectedPaymentDate: e.target.value })} />
            </Field>
            <Field label="실제 입금일">
              <TextInput type="date" value={header.actualPaymentDate} onChange={(e) => setHeader({ ...header, actualPaymentDate: e.target.value })} />
            </Field>
          </div>

          <div className="border-t border-line pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-ink">품목</p>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus size={13} /> 품목 추가
              </Button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {items.map((it, index) => {
                const { discountAmount, supplyAmount } = calcItem(it);
                return (
                  <div key={it._key} className="border border-line rounded-lg p-3 bg-porcelain/40">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-4 gap-2">
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
                        <NumberInput placeholder="수량" value={it.quantity} onChange={(e) => updateItem(it._key, { quantity: e.target.value })} />
                        <NumberInput placeholder="단가" value={it.unitPrice} onChange={(e) => updateItem(it._key, { unitPrice: e.target.value })} />
                      </div>
                      <div className="flex flex-col shrink-0">
                        <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="text-subink/60 hover:text-jade-600 disabled:opacity-20">
                          <ChevronUp size={13} />
                        </button>
                        <button type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} className="text-subink/60 hover:text-jade-600 disabled:opacity-20">
                          <ChevronDown size={13} />
                        </button>
                      </div>
                      <button type="button" onClick={() => removeItem(it._key)} disabled={items.length === 1} className="p-1.5 rounded-md text-subink hover:text-clay-600 disabled:opacity-20 shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="text-right text-xs text-subink mt-1.5">
                      할인액 {formatMoney(discountAmount, header.currency)} · 공급가액 <span className="font-medium text-ink">{formatMoney(supplyAmount, header.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-right text-sm font-semibold text-ink mt-2">합계: {formatMoney(itemTotals.subtotal, header.currency)}</div>
          </div>

          <Field label="메모">
            <TextArea value={header.memo} onChange={(e) => setHeader({ ...header, memo: e.target.value })} />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit">{editing ? "저장" : "등록"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="판매실적을 삭제할까요?"
        description="삭제해도 연결된 견적서 원본은 삭제되지 않습니다. 삭제된 판매실적은 복구할 수 없습니다."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <Toast message={toastMsg} />
    </div>
  );
}
