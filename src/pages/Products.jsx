import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  FlaskConical,
  Search,
  FileSpreadsheet,
  Download,
  Upload,
  Image as ImageIcon,
  Globe,
  GripVertical,
  ChevronUp,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { productsDB, logActivity } from "../lib/db";
import { canAccess } from "../lib/permissions";
import { formatMoney, formatNumber } from "../lib/utils";
import { downloadProductsExcel } from "../lib/productExcel";
import Modal from "../components/ui/Modal";
import ProductExcelUploadModal from "../components/ProductExcelUploadModal";
import ProductCountryPriceModal from "../components/ProductCountryPriceModal";
import { Field, TextInput, NumberInput, TextArea } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog, Toast } from "../components/ui/Basics";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMPTY = {
  name: "",
  productCode: "",
  imageUrl: "",
  englishName: "",
  brand: "",
  category: "",
  division: "",
  capacity: "",
  unit: "",
  cost: "",
  basePrice: "",
  consumerPrice: "",
  wholesalePrice: "",
  price1000: "",
  price2000: "",
  moq: "",
  boxQty: "",
  hsCode: "",
  barcode: "",
  manufacturer: "",
  manufactureCountry: "",
  storageLocation: "",
  status: "",
  isActive: true,
  currentStock: "",
  safetyStock: "",
  description: "",
  note: "",
};

const NUMERIC_FIELDS = [
  "cost",
  "basePrice",
  "consumerPrice",
  "wholesalePrice",
  "price1000",
  "price2000",
  "moq",
  "boxQty",
  "currentStock",
  "safetyStock",
];

export default function Products({ session, permissionMap }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [countryPriceTarget, setCountryPriceTarget] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [resetOrderConfirm, setResetOrderConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const imageInputRef = useRef(null);

  const canCreate = canAccess(session, permissionMap, "products", "create");
  const canEdit = canAccess(session, permissionMap, "products", "edit");
  const canDelete = canAccess(session, permissionMap, "products", "delete");

  // 정렬 순서(sortOrder)가 없는 제품(신규 등록/과거 데이터)이 있으면, 기존 순서는
  // 최대한 유지하고 없는 항목만 이름순으로 뒤에 이어붙여 한 번만 채워줍니다.
  const load = async () => {
    const rows = await productsDB.list();
    const hasMissing = rows.some((p) => p.sortOrder === "" || p.sortOrder == null);
    let ordered;
    if (hasMissing) {
      const withOrder = rows
        .filter((p) => p.sortOrder !== "" && p.sortOrder != null)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const withoutOrder = rows
        .filter((p) => p.sortOrder === "" || p.sortOrder == null)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      ordered = [...withOrder, ...withoutOrder];
      await Promise.all(ordered.map((p, idx) => productsDB.update(p.id, { sortOrder: idx })));
      ordered = ordered.map((p, idx) => ({ ...p, sortOrder: idx }));
    } else {
      ordered = rows.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    }
    setProducts(ordered);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const persistOrder = async (ordered) => {
    await Promise.all(ordered.map((p, idx) => productsDB.update(p.id, { sortOrder: idx })));
  };

  const handleDragStart = (p) => setDraggedId(p.id);
  const handleDragOver = (e, p) => {
    e.preventDefault();
    if (p.id !== draggedId) setDragOverId(p.id);
  };
  const handleDrop = async (target) => {
    setDragOverId(null);
    if (!draggedId || draggedId === target.id) return;
    const fromIndex = products.findIndex((p) => p.id === draggedId);
    const toIndex = products.findIndex((p) => p.id === target.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...products];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setProducts(next);
    setDraggedId(null);
    await persistOrder(next);
  };

  const moveBy = async (p, delta) => {
    const index = products.findIndex((x) => x.id === p.id);
    const target = index + delta;
    if (target < 0 || target >= products.length) return;
    const next = [...products];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setProducts(next);
    await persistOrder(next);
  };

  const confirmResetOrder = async () => {
    const ordered = [...products].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    setProducts(ordered);
    await persistOrder(ordered);
    setResetOrderConfirm(false);
    setToastMsg("이름순으로 정렬을 초기화했습니다.");
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.productCode, p.hsCode, p.capacity, p.note, p.englishName, p.brand, p.category, p.barcode]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [products, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...EMPTY, ...p, isActive: p.isActive === false ? false : true });
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    for (const key of NUMERIC_FIELDS) {
      payload[key] = form[key] === "" ? "" : Number(form[key]);
    }
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
      if (editing.currentStock !== payload.currentStock) {
        await logActivity({
          actor,
          action: "재고 수정",
          summary: `${payload.name} 재고 수정`,
          detail: `${editing.currentStock || 0}개 → ${payload.currentStock || 0}개`,
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => downloadProductsExcel(filteredProducts)}>
            <Download size={15} /> 엑셀 다운로드
          </Button>
          {canEdit && (
            <Button variant="ghost" onClick={() => setExcelModalOpen(true)}>
              <FileSpreadsheet size={15} /> 엑셀 업로드
            </Button>
          )}
          {canCreate && (
            <Button onClick={openCreate}>
              <Plus size={16} /> 제품 등록
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="relative max-w-sm w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subink" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제품명, 코드, 브랜드, 카테고리로 검색"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm outline-none focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15"
          />
        </div>
        {canEdit && !search.trim() && products.length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => setResetOrderConfirm(true)}>
            <RotateCcw size={13} /> 이름순으로 정렬 초기화
          </Button>
        )}
      </div>
      {search.trim() && canEdit && (
        <p className="text-xs text-subink -mt-2 mb-3">검색 중에는 순서 변경이 비활성화됩니다. 검색어를 지우면 드래그로 순서를 바꿀 수 있습니다.</p>
      )}

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
                {canEdit && <th className="px-2 py-3 w-16"></th>}
                <th className="text-left font-medium px-4 py-3">제품명</th>
                <th className="text-left font-medium px-4 py-3">제품코드</th>
                <th className="text-left font-medium px-4 py-3">용량</th>
                <th className="text-right font-medium px-4 py-3">원가</th>
                <th className="text-right font-medium px-4 py-3">기본 공급가</th>
                <th className="text-right font-medium px-4 py-3">1,000개 단가</th>
                <th className="text-right font-medium px-4 py-3">2,000개 단가</th>
                <th className="text-right font-medium px-4 py-3">MOQ</th>
                <th className="text-right font-medium px-4 py-3">박스 입수</th>
                <th className="text-right font-medium px-4 py-3">현재고</th>
                <th className="text-right font-medium px-4 py-3">안전재고</th>
                <th className="text-left font-medium px-4 py-3">HS CODE</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, index) => {
                const reorderable = canEdit && !search.trim();
                return (
                <tr
                  key={p.id}
                  draggable={reorderable}
                  onDragStart={() => reorderable && handleDragStart(p)}
                  onDragOver={(e) => reorderable && handleDragOver(e, p)}
                  onDragLeave={() => reorderable && setDragOverId((id) => (id === p.id ? null : id))}
                  onDrop={() => reorderable && handleDrop(p)}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  className={`border-t border-line hover:bg-porcelain/60 ${draggedId === p.id ? "opacity-40" : ""} ${
                    dragOverId === p.id ? "border-t-2 border-jade-500" : ""
                  }`}
                >
                  {canEdit && (
                    <td className="px-2 py-3">
                      {!search.trim() && (
                        <div className="flex items-center gap-0.5">
                          <span className="cursor-grab active:cursor-grabbing text-subink/50 shrink-0" title="드래그해서 순서 변경">
                            <GripVertical size={14} />
                          </span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveBy(p, -1)}
                              disabled={index === 0}
                              className="text-subink/60 hover:text-jade-600 disabled:opacity-20"
                              title="위로 이동"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBy(p, 1)}
                              disabled={index === filteredProducts.length - 1}
                              className="text-subink/60 hover:text-jade-600 disabled:opacity-20"
                              title="아래로 이동"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-ink flex items-center gap-2">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
                    ) : (
                      <FlaskConical size={14} className="text-jade-500 shrink-0" />
                    )}
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-subink">{p.productCode || "-"}</td>
                  <td className="px-4 py-3 text-subink">{p.capacity || "-"}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatMoney(p.cost)}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatMoney(p.basePrice)}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatMoney(p.price1000)}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatMoney(p.price2000)}</td>
                  <td className="px-4 py-3 text-right text-subink">{formatNumber(p.moq)}</td>
                  <td className="px-4 py-3 text-right text-subink">{formatNumber(p.boxQty)}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      p.safetyStock !== "" && p.safetyStock != null && Number(p.currentStock || 0) < Number(p.safetyStock)
                        ? "text-clay-600"
                        : "text-ink"
                    }`}
                  >
                    {formatNumber(p.currentStock)}
                  </td>
                  <td className="px-4 py-3 text-right text-subink">{formatNumber(p.safetyStock)}</td>
                  <td className="px-4 py-3 text-subink">{p.hsCode || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setCountryPriceTarget(p)}
                        className="p-1.5 rounded-md text-subink hover:bg-white hover:text-jade-600"
                        title="국가별 가격관리"
                      >
                        <Globe size={14} />
                      </button>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={resetOrderConfirm}
        title="정렬을 이름순으로 초기화할까요?"
        description="현재 지정된 드래그 순서가 사라지고, 제품명 가나다순으로 다시 정렬됩니다."
        confirmLabel="초기화"
        onConfirm={confirmResetOrder}
        onCancel={() => setResetOrderConfirm(false)}
      />
      <Toast message={toastMsg} />

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
            <Field label="제품 이미지" className="col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg border border-line bg-porcelain flex items-center justify-center overflow-hidden shrink-0">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={18} className="text-subink" />
                  )}
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const dataUrl = await readFileAsDataUrl(file);
                    setForm((f) => ({ ...f, imageUrl: dataUrl }));
                  }}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()}>
                  <Upload size={13} /> 업로드
                </Button>
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    className="text-xs text-subink hover:text-clay-600"
                  >
                    제거
                  </button>
                )}
              </div>
            </Field>
            <Field label="영문명">
              <TextInput
                value={form.englishName}
                onChange={(e) => setForm({ ...form, englishName: e.target.value })}
                placeholder="예: Moisture Calming Cream"
              />
            </Field>
            <Field label="제품코드">
              <TextInput
                value={form.productCode}
                onChange={(e) => setForm({ ...form, productCode: e.target.value })}
                placeholder="예: HC-CR-001"
              />
            </Field>
            <Field label="브랜드">
              <TextInput value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </Field>
            <Field label="카테고리">
              <TextInput
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="예: 스킨케어"
              />
            </Field>
            <Field label="구분">
              <TextInput
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
                placeholder="예: 크림"
              />
            </Field>
            <Field label="용량규격">
              <TextInput
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                placeholder="예: 50ml"
              />
            </Field>
            <Field label="단위">
              <TextInput
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="예: EA"
              />
            </Field>
            <Field label="HS CODE">
              <TextInput
                value={form.hsCode}
                onChange={(e) => setForm({ ...form, hsCode: e.target.value })}
                placeholder="예: 3304.99"
              />
            </Field>
            <Field label="바코드">
              <TextInput value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </Field>

            <div className="col-span-2 pt-1 border-t border-line">
              <p className="text-xs font-medium text-subink pt-3">가격 정보</p>
            </div>
            <Field label="원가 (₩)">
              <NumberInput
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </Field>
            <Field label="공급가 (₩)">
              <NumberInput
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
              />
            </Field>
            <Field label="소비자가 (₩)">
              <NumberInput
                value={form.consumerPrice}
                onChange={(e) => setForm({ ...form, consumerPrice: e.target.value })}
              />
            </Field>
            <Field label="도매가 (₩)">
              <NumberInput
                value={form.wholesalePrice}
                onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })}
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

            <div className="col-span-2 pt-1 border-t border-line">
              <p className="text-xs font-medium text-subink pt-3">재고·물류 정보</p>
            </div>
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
            <Field label="현재고" hint="엑셀 업로드로 일괄 반영할 수도 있습니다.">
              <NumberInput
                value={form.currentStock}
                onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
              />
            </Field>
            <Field label="안전재고" hint="현재고가 이 값보다 적으면 대시보드에 재고부족으로 표시됩니다.">
              <NumberInput
                value={form.safetyStock}
                onChange={(e) => setForm({ ...form, safetyStock: e.target.value })}
              />
            </Field>
            <Field label="제조사">
              <TextInput
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
              />
            </Field>
            <Field label="제조국">
              <TextInput
                value={form.manufactureCountry}
                onChange={(e) => setForm({ ...form, manufactureCountry: e.target.value })}
                placeholder="예: 대한민국"
              />
            </Field>
            <Field label="보관위치">
              <TextInput
                value={form.storageLocation}
                onChange={(e) => setForm({ ...form, storageLocation: e.target.value })}
              />
            </Field>
            <Field label="상태">
              <TextInput
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                placeholder="예: 판매중 / 단종 / 일시품절"
              />
            </Field>
            <Field label="사용 여부" className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.isActive !== false}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 accent-jade-600"
                />
                사용 중인 제품입니다
              </label>
            </Field>

            <div className="col-span-2 pt-1 border-t border-line">
              <p className="text-xs font-medium text-subink pt-3">설명</p>
            </div>
            <Field label="설명" className="col-span-2">
              <TextArea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="제품 상세 설명"
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

      <ProductExcelUploadModal
        open={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        products={products}
        canCreate={canCreate}
        actor={session?.name}
        onApplied={load}
      />

      <ProductCountryPriceModal
        product={countryPriceTarget}
        open={!!countryPriceTarget}
        onClose={() => setCountryPriceTarget(null)}
        canEdit={canEdit}
      />
    </div>
  );
}
