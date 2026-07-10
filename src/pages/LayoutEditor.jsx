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
  Lock,
  Unlock,
  ZoomIn,
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
import { useElementSize } from "../lib/useElementSize";
import { formatDate } from "../lib/utils";
import { Field, TextArea, TextInput, Select, NumberInput } from "../components/ui/Field";
import { Button, ConfirmDialog } from "../components/ui/Basics";

const CANVAS_WIDTH = 1160;
const MIN_CANVAS_HEIGHT = 420;
const GRID_SIZE = 10;
const ZOOM_OPTIONS = [50, 75, 100, 125, 150];
const RESIZE_HANDLES = [
  { key: "nw", cursor: "nwse-resize", cls: "-left-1.5 -top-1.5" },
  { key: "ne", cursor: "nesw-resize", cls: "-right-1.5 -top-1.5" },
  { key: "sw", cursor: "nesw-resize", cls: "-left-1.5 -bottom-1.5" },
  { key: "se", cursor: "nwse-resize", cls: "-right-1.5 -bottom-1.5" },
];

function snap(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
        border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || "#1f2937"}` : undefined,
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
  const [zoom, setZoom] = useState(100);
  const [autoFit, setAutoFit] = useState(true);
  const dragRef = useRef(null);
  const fileInputRef = useRef(null);
  const [canvasWrapRef, wrapSize] = useElementSize();

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

  // 편집 영역 폭에 맞춰 자동으로 줌을 계산합니다 (가로 스크롤 없이 전체가 보이도록).
  useEffect(() => {
    if (!autoFit || wrapSize.width === 0) return;
    const fit = Math.min(1, (wrapSize.width - 48) / CANVAS_WIDTH);
    setZoom(Math.round(Math.max(0.35, fit) * 100));
  }, [wrapSize.width, autoFit]);

  const zoomScale = zoom / 100;

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
      locked: !!selected.locked,
      style_json: { ...selected.style_json },
    });
  }, [selectedId, selected?.x, selected?.y, selected?.width, selected?.height, selected?.locked]);

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

  // ---- 드래그 이동 / 4방향 리사이즈 (줌 배율 보정 포함) ----
  const beginDrag = (e, item, mode) => {
    e.stopPropagation();
    setSelectedId(item.id);
    if (item.locked) return;
    dragRef.current = {
      id: item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      originX: item.x,
      originY: item.y,
      originWidth: item.width,
      originHeight: item.height,
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
    const dx = (e.clientX - d.startX) / zoomScale;
    const dy = (e.clientY - d.startY) / zoomScale;

    if (d.mode === "move") {
      const nextX = snap(clamp(d.originX + dx, 0, Math.max(0, CANVAS_WIDTH - d.originWidth)));
      const nextY = snap(Math.max(0, d.originY + dy));
      d.currentX = nextX;
      d.currentY = nextY;
      patchLocal(d.id, { x: nextX, y: nextY });
      return;
    }

    const dir = d.mode.replace("resize-", "");
    let nextX = d.originX;
    let nextY = d.originY;
    let nextW = d.originWidth;
    let nextH = d.originHeight;
    if (dir.includes("e")) nextW = Math.max(40, d.originWidth + dx);
    if (dir.includes("s")) nextH = Math.max(30, d.originHeight + dy);
    if (dir.includes("w")) {
      nextW = Math.max(40, d.originWidth - dx);
      nextX = d.originX + (d.originWidth - nextW);
    }
    if (dir.includes("n")) {
      nextH = Math.max(30, d.originHeight - dy);
      nextY = d.originY + (d.originHeight - nextH);
    }
    nextX = snap(clamp(nextX, 0, CANVAS_WIDTH - 40));
    nextY = snap(Math.max(0, nextY));
    nextW = snap(nextW);
    nextH = snap(nextH);
    d.currentX = nextX;
    d.currentY = nextY;
    d.currentWidth = nextW;
    d.currentHeight = nextH;
    patchLocal(d.id, { x: nextX, y: nextY, width: nextW, height: nextH });
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
      await updateLayoutItem(d.id, { x: d.currentX, y: d.currentY, width: d.currentWidth, height: d.currentHeight });
    }
  };

  // ---- 우측 속성 패널: 숫자 입력 시 즉시 캔버스에 반영, blur 시 저장 ----
  const setPositionField = (field, value) => {
    const v = Number(value) || 0;
    setDraft((d) => ({ ...d, [field]: v }));
    if (selected) patchLocal(selected.id, { [field]: v });
  };
  const commitPositionField = async (field) => {
    if (!selected || !draft) return;
    await updateLayoutItem(selected.id, { [field]: Number(draft[field]) || 0 });
  };

  const saveDraft = async () => {
    if (!selected || !draft) return;
    const updated = await updateLayoutItem(selected.id, {
      name: draft.name,
      content: draft.content,
      image_url: draft.image_url,
      style_json: draft.style_json,
    });
    patchLocal(selected.id, updated);
  };

  // Select 등 즉시 반영이 필요한 스타일 값은 draft의 stale closure를 피하기 위해
  // 병합한 style_json을 바로 계산해서 저장합니다.
  const setStyleAndSave = async (patch) => {
    if (!selected || !draft) return;
    const nextStyle = { ...draft.style_json, ...patch };
    setDraft((d) => ({ ...d, style_json: nextStyle }));
    const updated = await updateLayoutItem(selected.id, { style_json: nextStyle });
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

  // ---- 레이어 패널: 숨기기/복원/앞으로/뒤로/잠금 ----
  const hideItem = async (item) => {
    await hideLayoutItem(item.id, session?.name);
    if (selectedId === item.id) setSelectedId(null);
    load();
  };

  const restoreItem = async (item) => {
    await restoreLayoutItem(item.id);
    load();
  };

  const toggleLocked = async (value) => {
    if (!selected) return;
    setDraft((d) => ({ ...d, locked: value }));
    patchLocal(selected.id, { locked: value });
    await updateLayoutItem(selected.id, { locked: value });
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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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
        점선 테두리의 초록색 칸은 대시보드에 이미 있던 기존 요소입니다. 요소를 선택하면 오른쪽 패널에서 속성을
        바로 편집할 수 있고, 편집 영역은 화면 폭에 맞춰 자동으로 줄어듭니다.
      </p>

      <div className="flex gap-4 items-start">
        {/* 중앙 편집 영역 (자동 축소 + 가운데 정렬) */}
        <div
          ref={canvasWrapRef}
          className="flex-1 min-w-0 bg-porcelain/40 rounded-card border border-line p-6 overflow-auto"
          style={{ maxHeight: "calc(100vh - 230px)" }}
        >
          <div className="flex justify-center">
            <div style={{ width: CANVAS_WIDTH * zoomScale, height: canvasHeight * zoomScale }}>
              <div
                onMouseDown={() => setSelectedId(null)}
                className="relative bg-white border border-line rounded-card shadow-card origin-top-left"
                style={{ width: CANVAS_WIDTH, height: canvasHeight, transform: `scale(${zoomScale})` }}
              >
                {activeItems.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => beginDrag(e, item, "move")}
                      className={`absolute border-2 ${isSelected ? "border-jade-500" : "border-transparent"} ${
                        item.locked ? "cursor-not-allowed" : "cursor-move"
                      }`}
                      style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
                    >
                      {isSelected && <div className="absolute inset-0 bg-jade-500/10 pointer-events-none" />}
                      <ItemPreview item={item} />
                      {item.locked && (
                        <span className="absolute top-1 left-1 bg-ink/70 text-white rounded p-0.5 pointer-events-none">
                          <Lock size={10} />
                        </span>
                      )}
                      {isSelected &&
                        !item.locked &&
                        RESIZE_HANDLES.map((h) => (
                          <div
                            key={h.key}
                            onMouseDown={(e) => beginDrag(e, item, `resize-${h.key}`)}
                            className={`absolute w-3 h-3 rounded-full bg-jade-600 border-2 border-white shadow ${h.cls}`}
                            style={{ cursor: h.cursor }}
                          />
                        ))}
                    </div>
                  );
                })}
                {activeItems.length === 0 && (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-subink">
                    위 버튼으로 텍스트/이미지/도형을 추가해보세요.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 우측 고정 패널: 레이어 + 속성 */}
        <div className="w-80 shrink-0 sticky top-6 self-start flex flex-col gap-4" style={{ maxHeight: "calc(100vh - 110px)" }}>
          <div
            className="bg-white border border-line rounded-card shadow-card overflow-hidden flex flex-col shrink-0"
            style={{ maxHeight: selected ? 230 : 460 }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0">
              <Layers size={15} className="text-jade-500" />
              <h2 className="font-display text-sm font-semibold text-ink">레이어 ({activeItems.length})</h2>
            </div>
            <div className="overflow-y-auto divide-y divide-line">
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
                    {item.locked && <Lock size={11} className="text-subink shrink-0" />}
                    <span className="flex-1 min-w-0 truncate text-ink">{layerLabel(item)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(item, 1);
                      }}
                      title="앞으로"
                      className="p-1 rounded text-subink hover:text-jade-600"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(item, -1);
                      }}
                      title="뒤로"
                      className="p-1 rounded text-subink hover:text-jade-600"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        hideItem(item);
                      }}
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
              className="w-full flex items-center gap-2 px-4 py-2 border-t border-line text-xs text-subink hover:bg-porcelain shrink-0"
            >
              <Archive size={13} /> 숨김 보관함 ({hiddenItems.length}){showHidden ? " 닫기" : " 열기"}
            </button>
            {showHidden && (
              <div className="overflow-y-auto divide-y divide-line border-t border-line max-h-40">
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
                        <button onClick={() => restoreItem(item)} className="flex items-center gap-1 text-jade-600 hover:underline">
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

          {/* 속성 패널 */}
          {selected && draft ? (
            <div className="bg-white border border-line rounded-card shadow-card flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
                <h2 className="font-display text-sm font-semibold text-ink">속성</h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => hideItem(selected)} title="숨기기" className="p-1.5 rounded-md text-subink hover:bg-porcelain hover:text-jade-600">
                    <Eye size={14} />
                  </button>
                  {selected.item_type !== "widget" && (
                    <button onClick={() => setDeleteTarget(selected)} className="p-1.5 rounded-md text-subink hover:bg-porcelain hover:text-clay-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto p-4 space-y-3">
                <Field label="블록명" hint="비워두면 자동으로 표시됩니다.">
                  <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={saveDraft} placeholder={layerLabel(selected)} />
                </Field>
                <Field label="타입">
                  <div className="px-3 py-2 rounded-lg border border-line bg-porcelain text-sm text-subink">{TYPE_LABELS[selected.item_type]}</div>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="X">
                    <NumberInput value={draft.x} onChange={(e) => setPositionField("x", e.target.value)} onBlur={() => commitPositionField("x")} />
                  </Field>
                  <Field label="Y">
                    <NumberInput value={draft.y} onChange={(e) => setPositionField("y", e.target.value)} onBlur={() => commitPositionField("y")} />
                  </Field>
                  <Field label="Width">
                    <NumberInput value={draft.width} onChange={(e) => setPositionField("width", e.target.value)} onBlur={() => commitPositionField("width")} />
                  </Field>
                  <Field label="Height">
                    <NumberInput value={draft.height} onChange={(e) => setPositionField("height", e.target.value)} onBlur={() => commitPositionField("height")} />
                  </Field>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-subink shrink-0">빠른 크기:</span>
                  {SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="text-xs px-2 py-1 rounded-md border border-line text-ink hover:bg-porcelain"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <label className="flex items-center justify-between py-1 text-xs text-ink cursor-pointer">
                  <span className="flex items-center gap-1.5">{draft.locked ? <Lock size={13} /> : <Unlock size={13} />} 잠금 (드래그/크기조절 방지)</span>
                  <input type="checkbox" checked={draft.locked} onChange={(e) => toggleLocked(e.target.checked)} className="w-4 h-4 accent-jade-600" />
                </label>

                {selected.item_type === "widget" && (
                  <p className="text-xs text-subink">대시보드 기본 요소는 위치·크기·표시여부·잠금만 변경할 수 있습니다.</p>
                )}

                {selected.item_type === "text" && (
                  <div className="space-y-3 pt-2 border-t border-line">
                    <Field label="내용">
                      <TextArea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} onBlur={saveDraft} />
                    </Field>
                    <Field label="글자크기">
                      <NumberInput value={draft.style_json.fontSize || 16} onChange={(e) => setStyle({ fontSize: Number(e.target.value) })} onBlur={saveDraft} />
                    </Field>
                    <Field label="색상">
                      <input type="color" value={draft.style_json.color || "#1f2937"} onChange={(e) => { setStyle({ color: e.target.value }); }} onBlur={saveDraft} className="w-full h-9 rounded-md border border-line cursor-pointer" />
                    </Field>
                    <Field label="정렬">
                      <Select
                        value={draft.style_json.align || "left"}
                        onChange={(e) => setStyleAndSave({ align: e.target.value })}
                        options={[
                          { value: "left", label: "왼쪽" },
                          { value: "center", label: "가운데" },
                          { value: "right", label: "오른쪽" },
                        ]}
                      />
                    </Field>
                  </div>
                )}

                {selected.item_type === "image" && (
                  <div className="pt-2 border-t border-line">
                    <Field label="이미지">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-lg border border-line bg-porcelain flex items-center justify-center overflow-hidden shrink-0">
                          {draft.image_url ? <img src={draft.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-subink" />}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                        <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload size={13} /> 업로드
                        </Button>
                      </div>
                    </Field>
                    <div className="flex justify-end mt-2">
                      <Button size="sm" onClick={saveDraft}>이미지 저장</Button>
                    </div>
                  </div>
                )}

                {selected.item_type === "shape" && (
                  <div className="space-y-3 pt-2 border-t border-line">
                    <Field label="도형 종류">
                      <Select
                        value={draft.style_json.shapeType || "rect"}
                        onChange={(e) => setStyleAndSave({ shapeType: e.target.value })}
                        options={[
                          { value: "rect", label: "사각형" },
                          { value: "circle", label: "원" },
                        ]}
                      />
                    </Field>
                    <Field label="배경색">
                      <input type="color" value={draft.style_json.backgroundColor || "#2F6F62"} onChange={(e) => setStyle({ backgroundColor: e.target.value })} onBlur={saveDraft} className="w-full h-9 rounded-md border border-line cursor-pointer" />
                    </Field>
                    {draft.style_json.shapeType !== "circle" && (
                      <Field label="모서리 둥글기">
                        <NumberInput value={draft.style_json.borderRadius ?? 12} onChange={(e) => setStyle({ borderRadius: Number(e.target.value) })} onBlur={saveDraft} />
                      </Field>
                    )}
                    <Field label="테두리 두께">
                      <NumberInput value={draft.style_json.borderWidth ?? 0} onChange={(e) => setStyle({ borderWidth: Number(e.target.value) })} onBlur={saveDraft} />
                    </Field>
                    {(draft.style_json.borderWidth ?? 0) > 0 && (
                      <Field label="테두리 색상">
                        <input type="color" value={draft.style_json.borderColor || "#1f2937"} onChange={(e) => setStyle({ borderColor: e.target.value })} onBlur={saveDraft} className="w-full h-9 rounded-md border border-line cursor-pointer" />
                      </Field>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={saveDraft}>저장</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-line rounded-card shadow-card flex-1 min-h-[160px] flex items-center justify-center text-center text-xs text-subink p-6">
              캔버스에서 요소를 선택하면
              <br />
              오른쪽에서 속성을 편집할 수 있습니다.
            </div>
          )}
        </div>
      </div>

      {/* 줌 컨트롤 */}
      <div className="fixed bottom-6 right-6 z-40 bg-white border border-line rounded-full shadow-card px-3 py-2 flex items-center gap-2">
        <ZoomIn size={14} className="text-subink" />
        <select
          value={zoom}
          onChange={(e) => {
            setAutoFit(false);
            setZoom(Number(e.target.value));
          }}
          className="text-xs outline-none bg-transparent text-ink"
        >
          {ZOOM_OPTIONS.map((z) => (
            <option key={z} value={z}>
              {z}%
            </option>
          ))}
          {!ZOOM_OPTIONS.includes(zoom) && <option value={zoom}>{zoom}% (맞춤)</option>}
        </select>
        {!autoFit && (
          <button onClick={() => setAutoFit(true)} className="text-[11px] text-jade-600 hover:underline">
            맞춤
          </button>
        )}
      </div>

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
