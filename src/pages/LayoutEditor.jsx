import { useEffect, useMemo, useRef, useState } from "react";
import {
  Type,
  ImageIcon,
  Square,
  LayoutDashboard,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Archive,
  ArchiveRestore,
  Layers,
} from "lucide-react";
import {
  fetchAllLayoutItemsForEditor,
  createLayoutItem,
  updateLayoutItem,
  deleteLayoutItem,
  hideLayoutItem,
  restoreLayoutItem,
  BUILTIN_WIDGETS,
  WIDGET_DEFAULT_LAYOUT,
  SIZE_PRESETS,
} from "../lib/dashboardLayout";
import { formatDate } from "../lib/utils";
import { Field, TextArea, TextInput, Select, NumberInput } from "../components/ui/Field";
import { Button, ConfirmDialog } from "../components/ui/Basics";

const CANVAS_WIDTH = 1160;
const MIN_CANVAS_HEIGHT = 420;
const GRID_SIZE = 10;

function snap(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

const DEFAULTS = {
  text: {
    width: 240,
    height: 60,
    content: "새 텍스트",
    style_json: { fontSize: 16, color: "#1f2937", fontWeight: "500", align: "left" },
  },
  image: {
    width: 200,
    height: 140,
    content: "",
    image_url: "",
    style_json: { borderRadius: 8 },
  },
  shape: {
    width: 160,
    height: 100,
    content: "",
    style_json: { shapeType: "rect", backgroundColor: "#2F6F62", borderRadius: 12 },
  },
};

const TYPE_LABELS = { text: "텍스트", image: "이미지", shape: "도형", widget: "기존 대시보드 요소" };

function layerLabel(item) {
  if (item.name?.trim()) return item.name.trim();
  if (item.item_type === "widget") return BUILTIN_WIDGETS[item.content] || item.content;
  if (item.item_type === "text") return item.content?.trim().slice(0, 18) || "(빈 텍스트)";
  return TYPE_LABELS[item.item_type];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ItemPreview({ item }) {
  const style = item.style_json || {};
  if (item.item_type === "widget") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-jade-500/50 bg-jade-50/60 text-jade-700 px-2 text-center pointer-events-none">
        <LayoutDashboard size={16} />
        <span className="text-xs font-medium leading-tight">{BUILTIN_WIDGETS[item.content] || item.content}</span>
      </div>
    );
  }
  if (item.item_type === "text") {
    return (
      <div
        className="w-full h-full flex overflow-hidden px-1 pointer-events-none"
        style={{
          fontSize: style.fontSize || 16,
          color: style.color || "#1f2937",
          fontWeight: style.fontWeight || "500",
          justifyContent: style.align === "center" ? "center" : style.align === "right" ? "flex-end" : "flex-start",
          alignItems: "center",
          textAlign: style.align || "left",
        }}
      >
        {item.content || "(빈 텍스트)"}
      </div>
    );
  }
  if (item.item_type === "image") {
    return item.image_url ? (
      <img
        src={item.image_url}
        alt=""
        className="w-full h-full object-cover pointer-events-none"
        style={{ borderRadius: style.borderRadius ?? 8 }}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center bg-porcelain text-subink pointer-events-none">
        <ImageIcon size={20} />
      </div>
    );
  }
  // shape
  return (
    <div
      className="w-full h-full pointer-events-none"
      style={{
        backgroundColor: style.backgroundColor || "#2F6F62",
        borderRadius: style.shapeType === "circle" ? "50%" : style.borderRadius ?? 12,
      }}
    />
  );
}

export default function LayoutEditor({ session }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const dragRef = useRef(null);
  const fileInputRef = useRef(null);

  const load = () => fetchAllLayoutItemsForEditor().then(setItems);

  useEffect(() => {
    load();
  }, []);

  const activeItems = useMemo(
    () => items.filter((i) => i.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );
  const hiddenItems = useMemo(() => items.filter((i) => !i.is_active), [items]);

  const canvasHeight = useMemo(
    () => Math.max(MIN_CANVAS_HEIGHT, ...activeItems.map((i) => i.y + i.height), 0) + 40,
    [activeItems]
  );

  const selected = items.find((i) => i.id === selectedId) || null;

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      name: selected.name || "",
      content: selected.content || "",
      image_url: selected.image_url || "",
      x: selected.x,
      y: selected.y,
      width: selected.width,
      height: selected.height,
      style_json: { ...selected.style_json },
    });
  }, [selectedId, selected?.x, selected?.y, selected?.width, selected?.height]);

  const patchLocal = (id, patch) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const addItem = async (type) => {
    const base = DEFAULTS[type];
    const created = await createLayoutItem({
      item_type: type,
      content: base.content || "",
      image_url: base.image_url || "",
      x: 20,
      y: 20,
      width: base.width,
      height: base.height,
      style_json: base.style_json,
      sort_order: items.length,
      is_active: true,
    });
    setItems((prev) => [...prev, created]);
    setSelectedId(created.id);
  };

  // ---- 드래그 이동 / 크기 조절 ----
  const beginDrag = (e, item, mode) => {
    e.stopPropagation();
    setSelectedId(item.id);
    dragRef.current = {
      id: item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      originX: item.x,
      originY: item.y,
      width: item.width,
      height: item.height,
      currentX: item.x,
      currentY: item.y,
      currentWidth: item.width,
      currentHeight: item.height,
    };
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.mode === "move") {
      const nextX = snap(clamp(d.originX + dx, 0, Math.max(0, CANVAS_WIDTH - d.width)));
      const nextY = snap(Math.max(0, d.originY + dy));
      d.currentX = nextX;
      d.currentY = nextY;
      patchLocal(d.id, { x: nextX, y: nextY });
    } else {
      const nextWidth = snap(Math.max(40, d.width + dx));
      const nextHeight = snap(Math.max(30, d.height + dy));
      d.currentWidth = nextWidth;
      d.currentHeight = nextHeight;
      patchLocal(d.id, { width: nextWidth, height: nextHeight });
    }
  };

  const onPointerUp = async () => {
    const d = dragRef.current;
    window.removeEventListener("mousemove", onPointerMove);
    window.removeEventListener("mouseup", onPointerUp);
    dragRef.current = null;
    if (!d) return;
    if (d.mode === "move") {
      await updateLayoutItem(d.id, { x: d.currentX, y: d.currentY });
    } else {
      await updateLayoutItem(d.id, { width: d.currentWidth, height: d.currentHeight });
    }
  };

  const saveDraft = async () => {
    if (!selected || !draft) return;
    const patch = {
      name: draft.name,
      content: draft.content,
      image_url: draft.image_url,
      x: Number(draft.x),
      y: Number(draft.y),
      width: Number(draft.width),
      height: Number(draft.height),
      style_json: draft.style_json,
    };
    const updated = await updateLayoutItem(selected.id, patch);
    patchLocal(selected.id, updated);
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    await deleteLayoutItem(target.id);
    if (selectedId === target.id) setSelectedId(null);
    setItems((prev) => prev.filter((i) => i.id !== target.id));
  };

  const confirmPermanentDelete = async () => {
    const target = permanentDeleteTarget;
    setPermanentDeleteTarget(null);
    await deleteLayoutItem(target.id);
    setItems((prev) => prev.filter((i) => i.id !== target.id));
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setDraft((d) => ({ ...d, image_url: dataUrl }));
  };

  const setStyle = (patch) => setDraft((d) => ({ ...d, style_json: { ...d.style_json, ...patch } }));

  const applyPreset = async (preset) => {
    if (!selected) return;
    const updated = await updateLayoutItem(selected.id, { width: preset.width, height: preset.height });
    patchLocal(selected.id, updated);
    setDraft((d) => ({ ...d, width: updated.width, height: updated.height }));
  };

  const resetWidgetLayout = async () => {
    setResetConfirmOpen(false);
    const widgetItems = items.filter((i) => i.item_type === "widget" && WIDGET_DEFAULT_LAYOUT[i.content]);
    await Promise.all(
      widgetItems.map((item) => updateLayoutItem(item.id, { ...WIDGET_DEFAULT_LAYOUT[item.content], is_active: true }))
    );
    setSelectedId(null);
    load();
  };

  // ---- 레이어 패널: 숨기기/복원/앞으로/뒤로 ----
  const hideItem = async (item) => {
    await hideLayoutItem(item.id, session?.name);
    if (selectedId === item.id) setSelectedId(null);
    load();
  };

  const restoreItem = async (item) => {
    await restoreLayoutItem(item.id);
    load();
  };

  const moveLayer = async (item, direction) => {
    const idx = activeItems.findIndex((i) => i.id === item.id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= activeItems.length) return;
    const other = activeItems[targetIdx];
    await Promise.all([
      updateLayoutItem(item.id, { sort_order: other.sort_order }),
      updateLayoutItem(other.id, { sort_order: item.sort_order }),
    ]);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">화면 편집</h1>
          <p className="text-sm text-subink mt-1">
            메인 대시보드 상단에 표시할 텍스트/이미지/도형을 배치합니다. (관리자 전용)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => addItem("text")}>
            <Type size={15} /> 텍스트 추가
          </Button>
          <Button variant="ghost" onClick={() => addItem("image")}>
            <ImageIcon size={15} /> 이미지 추가
          </Button>
          <Button variant="ghost" onClick={() => addItem("shape")}>
            <Square size={15} /> 도형 추가
          </Button>
          <Button variant="ghost" onClick={() => setResetConfirmOpen(true)}>
            <RotateCcw size={15} /> 기본 배치로 초기화
          </Button>
        </div>
      </div>

      <p className="text-xs text-subink mb-2">
        점선 테두리의 초록색 칸은 대시보드에 이미 있던 기존 요소(통계 카드 등)입니다. 드래그·크기조절은
        10px 단위로 자동 정렬(스냅)되고, 오른쪽 레이어 패널에서 순서/표시 여부를 관리할 수 있습니다. 숨긴
        요소는 캔버스 공간을 차지하지 않고 "숨김 보관함"으로 이동합니다.
      </p>

      <div className="flex gap-4 mb-6 items-start">
        <div className="overflow-x-auto flex-1">
          <div
            onMouseDown={() => setSelectedId(null)}
            className="relative bg-white border border-line rounded-card shadow-card"
            style={{ width: CANVAS_WIDTH, height: canvasHeight }}
          >
            {activeItems.map((item) => (
              <div
                key={item.id}
                onMouseDown={(e) => beginDrag(e, item, "move")}
                className={`absolute cursor-move border ${
                  selectedId === item.id ? "border-jade-500 ring-2 ring-jade-500/25" : "border-transparent"
                }`}
                style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
              >
                <ItemPreview item={item} />
                <div
                  onMouseDown={(e) => beginDrag(e, item, "resize")}
                  className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 rounded-full bg-jade-600 cursor-se-resize"
                />
              </div>
            ))}
            {activeItems.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-subink">
                위 버튼으로 텍스트/이미지/도형을 추가해보세요.
              </p>
            )}
          </div>
        </div>

        {/* 레이어 패널 */}
        <div className="w-72 shrink-0 bg-white border border-line rounded-card shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
            <Layers size={15} className="text-jade-500" />
            <h2 className="font-display text-sm font-semibold text-ink">레이어 ({activeItems.length})</h2>
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-line">
            {activeItems.length === 0 ? (
              <p className="text-xs text-subink text-center py-6">표시 중인 요소가 없습니다.</p>
            ) : (
              [...activeItems].reverse().map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer text-xs ${
                    selectedId === item.id ? "bg-jade-50" : "hover:bg-porcelain/60"
                  }`}
                >
                  <span className="flex-1 min-w-0 truncate text-ink">{layerLabel(item)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveLayer(item, 1); }}
                    title="앞으로 (위 레이어로)"
                    className="p-1 rounded text-subink hover:text-jade-600"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveLayer(item, -1); }}
                    title="뒤로 (아래 레이어로)"
                    className="p-1 rounded text-subink hover:text-jade-600"
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); hideItem(item); }}
                    title="숨기기"
                    className="p-1 rounded text-subink hover:text-clay-600"
                  >
                    <EyeOff size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-line text-xs text-subink hover:bg-porcelain"
          >
            <Archive size={13} /> 숨김 보관함 ({hiddenItems.length}){showHidden ? " 닫기" : " 열기"}
          </button>
          {showHidden && (
            <div className="max-h-64 overflow-y-auto divide-y divide-line border-t border-line">
              {hiddenItems.length === 0 ? (
                <p className="text-xs text-subink text-center py-6">숨긴 요소가 없습니다.</p>
              ) : (
                hiddenItems.map((item) => (
                  <div key={item.id} className="px-3 py-2 text-xs">
                    <p className="text-ink font-medium truncate">{layerLabel(item)}</p>
                    <p className="text-subink mt-0.5">
                      {item.hidden_by && `${item.hidden_by} · `}
                      {item.hidden_at ? formatDate(item.hidden_at) : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => restoreItem(item)}
                        className="flex items-center gap-1 text-jade-600 hover:underline"
                      >
                        <ArchiveRestore size={12} /> 복원
                      </button>
                      {item.item_type !== "widget" && (
                        <button
                          onClick={() => setPermanentDeleteTarget(item)}
                          className="flex items-center gap-1 text-clay-600 hover:underline"
                        >
                          <Trash2 size={12} /> 완전삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {selected && draft && (
        <div className="bg-white border border-line rounded-card shadow-card p-5 max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-semibold text-ink">
              선택한 요소 편집 · {TYPE_LABELS[selected.item_type]}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => hideItem(selected)}
                title="화면에서 숨기기"
                className="p-1.5 rounded-md text-subink hover:bg-porcelain hover:text-jade-600"
              >
                <Eye size={15} />
              </button>
              {selected.item_type !== "widget" && (
                <button
                  onClick={() => setDeleteTarget(selected)}
                  className="p-1.5 rounded-md text-subink hover:bg-porcelain hover:text-clay-600"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          {selected.item_type === "widget" && (
            <p className="text-xs text-subink mb-4">
              대시보드 기본 요소는 삭제할 수 없고, 위치·크기 변경과 표시/숨김만 가능합니다.
            </p>
          )}

          <Field label="레이어 이름" hint="비워두면 자동으로 표시됩니다." className="mb-3">
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={layerLabel(selected)} />
          </Field>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <Field label="X">
              <NumberInput value={draft.x} onChange={(e) => setDraft({ ...draft, x: e.target.value })} />
            </Field>
            <Field label="Y">
              <NumberInput value={draft.y} onChange={(e) => setDraft({ ...draft, y: e.target.value })} />
            </Field>
            <Field label="너비">
              <NumberInput value={draft.width} onChange={(e) => setDraft({ ...draft, width: e.target.value })} />
            </Field>
            <Field label="높이">
              <NumberInput value={draft.height} onChange={(e) => setDraft({ ...draft, height: e.target.value })} />
            </Field>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-subink">빠른 크기:</span>
            {SIZE_PRESETS.map((preset) => (
              <Button key={preset.label} type="button" variant="ghost" size="sm" onClick={() => applyPreset(preset)}>
                {preset.label} ({preset.width}×{preset.height})
              </Button>
            ))}
          </div>

          {selected.item_type === "text" && (
            <div className="space-y-4 mb-4">
              <Field label="내용">
                <TextArea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label="글자 크기">
                  <NumberInput
                    value={draft.style_json.fontSize || 16}
                    onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
                  />
                </Field>
                <Field label="색상">
                  <input
                    type="color"
                    value={draft.style_json.color || "#1f2937"}
                    onChange={(e) => setStyle({ color: e.target.value })}
                    className="w-full h-9 rounded-md border border-line cursor-pointer"
                  />
                </Field>
                <Field label="정렬">
                  <Select
                    value={draft.style_json.align || "left"}
                    onChange={(e) => setStyle({ align: e.target.value })}
                    options={[
                      { value: "left", label: "왼쪽" },
                      { value: "center", label: "가운데" },
                      { value: "right", label: "오른쪽" },
                    ]}
                  />
                </Field>
              </div>
            </div>
          )}

          {selected.item_type === "image" && (
            <div className="mb-4">
              <Field label="이미지">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border border-line bg-porcelain flex items-center justify-center overflow-hidden shrink-0">
                    {draft.image_url ? (
                      <img src={draft.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={18} className="text-subink" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0])}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={13} /> 업로드
                  </Button>
                </div>
              </Field>
            </div>
          )}

          {selected.item_type === "shape" && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Field label="도형 종류">
                <Select
                  value={draft.style_json.shapeType || "rect"}
                  onChange={(e) => setStyle({ shapeType: e.target.value })}
                  options={[
                    { value: "rect", label: "사각형" },
                    { value: "circle", label: "원" },
                  ]}
                />
              </Field>
              <Field label="색상">
                <input
                  type="color"
                  value={draft.style_json.backgroundColor || "#2F6F62"}
                  onChange={(e) => setStyle({ backgroundColor: e.target.value })}
                  className="w-full h-9 rounded-md border border-line cursor-pointer"
                />
              </Field>
              {draft.style_json.shapeType !== "circle" && (
                <Field label="모서리 둥글기">
                  <NumberInput
                    value={draft.style_json.borderRadius ?? 12}
                    onChange={(e) => setStyle({ borderRadius: Number(e.target.value) })}
                  />
                </Field>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={saveDraft}>저장</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="요소를 삭제할까요?"
        description="삭제된 요소는 복구할 수 없습니다."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!permanentDeleteTarget}
        title="숨김 보관함에서 완전히 삭제할까요?"
        description="완전삭제된 요소는 복구할 수 없습니다."
        onConfirm={confirmPermanentDelete}
        onCancel={() => setPermanentDeleteTarget(null)}
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        title="기본 배치로 초기화할까요?"
        description="통계 카드 등 기존 대시보드 요소들의 위치와 크기가 처음 상태로 되돌아갑니다. 직접 추가한 텍스트/이미지/도형은 그대로 유지됩니다."
        onConfirm={resetWidgetLayout}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
}
