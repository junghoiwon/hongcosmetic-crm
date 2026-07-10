import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, PackageOpen, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { samplesDB, clientsDB, productsDB, logActivity } from "../lib/db";
import { canAccess } from "../lib/permissions";
import { fetchAllSampleItems, replaceSampleItems } from "../lib/sampleItems";
import { CARRIERS } from "../lib/constants";
import { formatDate, todayISO, dDayLabel } from "../lib/utils";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import { Field, TextInput, NumberInput, Select, TextArea } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog, Toast } from "../components/ui/Basics";

const EMPTY_HEADER = {
  clientId: "",
  sentDate: todayISO(),
  carrier: "EMS",
  trackingNumber: "",
  shippingCost: "",
  etaDate: "",
  followUpDate: "",
  memo: "",
};

const EMPTY_ITEM = () => ({
  _key: Math.random().toString(36).slice(2),
  productId: "",
  productName: "",
  quantity: "",
  note: "",
});

function legacyItemFromHeader(s) {
  if (!s.productName) return [];
  return [{ _key: "legacy", productId: "", productName: s.productName, quantity: s.quantity ?? "", note: "" }];
}

function summarize(items) {
  const valid = items.filter((it) => it.productName.trim());
  const totalQuantity = valid.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const productSummary =
    valid.length === 0
      ? ""
      : valid.length === 1
      ? valid[0].productName
      : `${valid[0].productName} 외 ${valid.length - 1}건`;
  return { productSummary, totalQuantity };
}

export default function Samples({ session, permissionMap }) {
  const [samples, setSamples] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [itemsBySample, setItemsBySample] = useState({});
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [items, setItems] = useState([EMPTY_ITEM()]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const canCreate = canAccess(session, permissionMap, "samples", "create");
  const canEdit = canAccess(session, permissionMap, "samples", "edit");
  const canDelete = canAccess(session, permissionMap, "samples", "delete");

  const load = () => {
    samplesDB.list().then((rows) =>
      setSamples(rows.sort((a, b) => new Date(b.sentDate) - new Date(a.sentDate)))
    );
    clientsDB.list().then(setClients);
    productsDB.list().then(setProducts);
    fetchAllSampleItems().then(setItemsBySample);
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

  const itemsOf = (s) => {
    const real = itemsBySample[s.id];
    if (real && real.length > 0) return real;
    return legacyItemFromHeader(s).map((it) => ({ ...it, note: "" }));
  };

  const filteredSamples = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return samples;
    return samples.filter((s) => {
      const productNames = itemsOf(s).map((it) => it.productName).join(" ");
      return [clientName(s.clientId), productNames, s.trackingNumber, s.carrier]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [samples, search, clients, itemsBySample]);

  const openCreate = () => {
    setEditing(null);
    setHeader(EMPTY_HEADER);
    setItems([EMPTY_ITEM()]);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setHeader({
      clientId: s.clientId || "",
      sentDate: s.sentDate || todayISO(),
      carrier: s.carrier || "EMS",
      trackingNumber: s.trackingNumber || "",
      shippingCost: s.shippingCost ?? "",
      etaDate: s.etaDate || "",
      followUpDate: s.followUpDate || "",
      memo: s.memo || "",
    });
    const real = itemsBySample[s.id];
    const initialItems =
      real && real.length > 0
        ? real.map((it) => ({ _key: it.id, productId: it.productId || "", productName: it.productName, quantity: it.quantity, note: it.note }))
        : legacyItemFromHeader(s);
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
    updateItem(key, { productId, productName: product?.name || "" });
  };

  const save = async (e) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.productName.trim());
    if (validItems.length === 0) {
      alert("품목을 1개 이상 입력해주세요.");
      return;
    }
    const { productSummary, totalQuantity } = summarize(validItems);
    const payload = {
      ...header,
      shippingCost: header.shippingCost === "" ? "" : Number(header.shippingCost),
      productSummary,
      totalQuantity,
    };
    const actor = session?.name || "사용자";
    const cName = clientName(payload.clientId);
    let sampleId;

    if (editing) {
      sampleId = editing.id;
      await samplesDB.update(editing.id, payload);
      await logActivity({ actor, action: "샘플 발송 수정", summary: `${cName} 샘플 발송 정보 수정 (품목 ${validItems.length}건)` });
    } else {
      const created = await samplesDB.create(payload);
      sampleId = created.id;
      await logActivity({
        actor,
        action: "샘플 발송 등록",
        summary: `${cName} 샘플 발송 등록 (${productSummary})`,
        detail: `총 ${totalQuantity.toLocaleString("ko-KR")}개 · ${payload.carrier}`,
      });
    }

    await replaceSampleItems(
      sampleId,
      validItems.map((it) => ({
        productId: it.productId || null,
        productName: it.productName,
        quantity: Number(it.quantity) || 0,
        note: it.note || "",
      }))
    );

    setModalOpen(false);
    setToastMsg(editing ? "샘플 발송 정보를 수정했습니다." : "샘플 발송을 등록했습니다.");
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
    setToastMsg("샘플 발송 기록을 삭제했습니다.");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">샘플 발송 관리</h1>
          <p className="text-sm text-subink mt-1">한 번의 발송에 여러 제품을 담아 관리합니다.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus size={16} /> 샘플 발송 등록
          </Button>
        )}
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
            samples.length === 0 && canCreate && (
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
                <th className="text-left font-medium px-4 py-3">품목</th>
                <th className="text-right font-medium px-4 py-3">수량</th>
                <th className="text-left font-medium px-4 py-3">발송일</th>
                <th className="text-left font-medium px-4 py-3">운송사 / 송장번호</th>
                <th className="text-left font-medium px-4 py-3">도착예정일</th>
                <th className="text-left font-medium px-4 py-3">후속 연락일</th>
                <th className="px-4 py-3 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {filteredSamples.map((s) => {
                const sItems = itemsOf(s);
                const totalQty = s.totalQuantity ?? sItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
                const label =
                  s.productSummary ||
                  (sItems.length === 0
                    ? "-"
                    : sItems.length === 1
                    ? sItems[0].productName
                    : `${sItems[0].productName} 외 ${sItems.length - 1}건`);
                return (
                  <tr
                    key={s.id}
                    onClick={canEdit ? () => openEdit(s) : undefined}
                    className={`border-t border-line hover:bg-porcelain/60 ${canEdit ? "cursor-pointer" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-ink flex items-center gap-2">
                      <PackageOpen size={14} className="text-jade-500 shrink-0" />
                      {clientName(s.clientId)}
                    </td>
                    <td className="px-4 py-3 text-subink">{label}</td>
                    <td className="px-4 py-3 text-right text-ink">{totalQty.toLocaleString("ko-KR")}</td>
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
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(s);
                          }}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "샘플 발송 정보 수정" : "새 샘플 발송 등록"}
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
            <Field label="발송비 (₩)">
              <NumberInput
                value={header.shippingCost}
                onChange={(e) => setHeader({ ...header, shippingCost: e.target.value })}
              />
            </Field>
            <Field label="발송일" required>
              <TextInput
                type="date"
                required
                value={header.sentDate}
                onChange={(e) => setHeader({ ...header, sentDate: e.target.value })}
              />
            </Field>
            <Field label="운송사">
              <Select
                options={CARRIERS}
                value={header.carrier}
                onChange={(e) => setHeader({ ...header, carrier: e.target.value })}
              />
            </Field>
            <Field label="송장번호">
              <TextInput
                value={header.trackingNumber}
                onChange={(e) => setHeader({ ...header, trackingNumber: e.target.value })}
              />
            </Field>
            <Field label="도착예정일">
              <TextInput
                type="date"
                value={header.etaDate}
                onChange={(e) => setHeader({ ...header, etaDate: e.target.value })}
              />
            </Field>
            <Field label="후속 연락일">
              <TextInput
                type="date"
                value={header.followUpDate}
                onChange={(e) => setHeader({ ...header, followUpDate: e.target.value })}
              />
            </Field>
          </div>

          <div className="border-t border-line pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-ink">발송 품목</p>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus size={13} /> 품목 추가
              </Button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {items.map((it, index) => (
                <div key={it._key} className="border border-line rounded-lg p-3 bg-porcelain/40">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
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
                      <NumberInput
                        placeholder="수량"
                        value={it.quantity}
                        onChange={(e) => updateItem(it._key, { quantity: e.target.value })}
                      />
                      <TextInput
                        placeholder="비고"
                        value={it.note}
                        onChange={(e) => updateItem(it._key, { note: e.target.value })}
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
                </div>
              ))}
            </div>
          </div>

          <Field label="메모">
            <TextArea value={header.memo} onChange={(e) => setHeader({ ...header, memo: e.target.value })} />
          </Field>

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
      <Toast message={toastMsg} />
    </div>
  );
}
