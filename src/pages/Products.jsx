import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, FlaskConical, Search } from "lucide-react";
import { productsDB, logActivity } from "../lib/db";
import { canAccess } from "../lib/permissions";
import { formatMoney, formatNumber } from "../lib/utils";
import Modal from "../components/ui/Modal";
import { Field, TextInput, NumberInput, TextArea } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog } from "../components/ui/Basics";

const EMPTY = {
  name: "",
  capacity: "",
  cost: "",
  basePrice: "",
  price1000: "",
  price2000: "",
  moq: "",
  boxQty: "",
  hsCode: "",
  note: "",
};

export default function Products({ session, permissionMap }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canCreate = canAccess(session, permissionMap, "products", "create");
  const canEdit = canAccess(session, permissionMap, "products", "edit");
  const canDelete = canAccess(session, permissionMap, "products", "delete");

  const load = () => productsDB.list().then((rows) =>
    setProducts(rows.sort((a, b) => a.name.localeCompare(b.name, "ko")))
  );

  useEffect(() => {
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.hsCode, p.capacity, p.note].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [products, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm(p);
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      cost: form.cost === "" ? "" : Number(form.cost),
      basePrice: form.basePrice === "" ? "" : Number(form.basePrice),
      price1000: form.price1000 === "" ? "" : Number(form.price1000),
      price2000: form.price2000 === "" ? "" : Number(form.price2000),
      moq: form.moq === "" ? "" : Number(form.moq),
      boxQty: form.boxQty === "" ? "" : Number(form.boxQty),
    };
    const actor = session?.name || "사용자";
    if (editing) {
      await productsDB.update(editing.id, payload);
      const priceFields = [
        ["basePrice", "기본 공급가"],
        ["price1000", "1,000개 단가"],
        ["price2000", "2,000개 단가"],
      ];
      const changed = priceFields.filter(([key]) => editing[key] !== payload[key]);
      if (changed.length) {
        await logActivity({
          actor,
          action: "제품 단가 수정",
          summary: `${payload.name} 단가 수정`,
          detail: changed
            .map(([key, label]) => `${label} ${editing[key] || 0}원 → ${payload[key] || 0}원`)
            .join(", "),
        });
      } else {
        await logActivity({
          actor,
          action: "제품 정보 수정",
          summary: `${payload.name} 제품 정보 수정`,
        });
      }
    } else {
      await productsDB.create(payload);
      await logActivity({
        actor,
        action: "신규 제품 등록",
        summary: `${payload.name} 제품이 신규 등록되었습니다.`,
      });
    }
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    await productsDB.remove(deleteTarget.id);
    await logActivity({
      actor: session?.name || "사용자",
      action: "제품 삭제",
      summary: `${deleteTarget.name} 제품이 삭제되었습니다.`,
    });
    setDeleteTarget(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">제품 관리</h1>
          <p className="text-sm text-subink mt-1">공급 제품과 수량별 단가를 관리합니다.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus size={16} /> 제품 등록
          </Button>
        )}
      </div>

      <div className="relative max-w-sm mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subink" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제품명, HS CODE, 용량으로 검색"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm outline-none focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15"
        />
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          title={products.length === 0 ? "등록된 제품이 없습니다" : "검색 결과가 없습니다"}
          description={
            products.length === 0
              ? "첫 제품을 등록하고 견적서 작성에 바로 활용해보세요."
              : "다른 검색어를 시도해보세요."
          }
          action={
            products.length === 0 && canCreate && (
              <Button onClick={openCreate}>
                <Plus size={16} /> 제품 등록
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-white border border-line rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-porcelain text-subink text-xs">
                <th className="text-left font-medium px-4 py-3">제품명</th>
                <th className="text-left font-medium px-4 py-3">용량</th>
                <th className="text-right font-medium px-4 py-3">원가</th>
                <th className="text-right font-medium px-4 py-3">기본 공급가</th>
                <th className="text-right font-medium px-4 py-3">1,000개 단가</th>
                <th className="text-right font-medium px-4 py-3">2,000개 단가</th>
                <th className="text-right font-medium px-4 py-3">MOQ</th>
                <th className="text-right font-medium px-4 py-3">박스 입수</th>
                <th className="text-left font-medium px-4 py-3">HS CODE</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id} className="border-t border-line hover:bg-porcelain/60">
                  <td className="px-4 py-3 font-medium text-ink flex items-center gap-2">
                    <FlaskConical size={14} className="text-jade-500 shrink-0" />
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-subink">{p.capacity || "-"}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatMoney(p.cost)}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatMoney(p.basePrice)}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatMoney(p.price1000)}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatMoney(p.price2000)}</td>
                  <td className="px-4 py-3 text-right text-subink">{formatNumber(p.moq)}</td>
                  <td className="px-4 py-3 text-right text-subink">{formatNumber(p.boxQty)}</td>
                  <td className="px-4 py-3 text-subink">{p.hsCode || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit && (
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-md text-subink hover:bg-white hover:text-jade-600"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(p)}
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
        title={editing ? "제품 정보 수정" : "새 제품 등록"}
        subtitle={editing ? editing.name : "제품 상세 정보를 입력해주세요."}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="제품명" required className="col-span-2">
              <TextInput
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 수분 진정 크림"
              />
            </Field>
            <Field label="용량">
              <TextInput
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                placeholder="예: 50ml"
              />
            </Field>
            <Field label="HS CODE">
              <TextInput
                value={form.hsCode}
                onChange={(e) => setForm({ ...form, hsCode: e.target.value })}
                placeholder="예: 3304.99"
              />
            </Field>
            <Field label="원가 (₩)">
              <NumberInput
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </Field>
            <Field label="기본 공급가 (₩)">
              <NumberInput
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
              />
            </Field>
            <Field label="1,000개 단가 (₩)">
              <NumberInput
                value={form.price1000}
                onChange={(e) => setForm({ ...form, price1000: e.target.value })}
              />
            </Field>
            <Field label="2,000개 단가 (₩)">
              <NumberInput
                value={form.price2000}
                onChange={(e) => setForm({ ...form, price2000: e.target.value })}
              />
            </Field>
            <Field label="MOQ">
              <NumberInput
                value={form.moq}
                onChange={(e) => setForm({ ...form, moq: e.target.value })}
              />
            </Field>
            <Field label="박스 입수">
              <NumberInput
                value={form.boxQty}
                onChange={(e) => setForm({ ...form, boxQty: e.target.value })}
              />
            </Field>
            <Field label="비고" className="col-span-2">
              <TextArea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="기능성 표시, 원료 특이사항 등"
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
        title="제품을 삭제할까요?"
        description={`"${deleteTarget?.name}" 제품이 영구적으로 삭제됩니다. 이미 작성된 견적서에는 영향을 주지 않습니다.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
