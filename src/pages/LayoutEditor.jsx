import { useEffect, useRef, useState } from "react";
import { Type, ImageIcon, Square, Trash2, Upload } from "lucide-react";
import {
  fetchAllLayoutItemsForEditor,
  createLayoutItem,
  updateLayoutItem,
  deleteLayoutItem,
} from "../lib/dashboardLayout";
import { Field, TextArea, Select, NumberInput } from "../components/ui/Field";
import { Button, ConfirmDialog } from "../components/ui/Basics";

const CANVAS_WIDTH = 1160;
const CANVAS_HEIGHT = 420;

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

const TYPE_LABELS = { text: "텍스트", image: "이미지", shape: "도형" };

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

export default function LayoutEditor() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const dragRef = useRef(null);
  const fileInputRef = useRef(null);

  const load = () => fetchAllLayoutItemsForEditor().then(setItems);

  useEffect(() => {
    load();
  }, []);

  const selected = items.find((i) => i.id === selectedId) || null;

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      content: selected.content || "",
      image_url: selected.image_url || "",
      x: selected.x,
      y: selected.y,
      width: selected.width,
      height: selected.height,
      is_active: selected.is_active,
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
      const nextX = clamp(d.originX + dx, 0, Math.max(0, CANVAS_WIDTH - d.width));
      const nextY = clamp(d.originY + dy, 0, Math.max(0, CANVAS_HEIGHT - d.height));
      d.currentX = nextX;
      d.currentY = nextY;
      patchLocal(d.id, { x: nextX, y: nextY });
    } else {
      const nextWidth = Math.max(40, d.width + dx);
      const nextHeight = Math.max(30, d.height + dy);
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
      content: draft.content,
      image_url: draft.image_url,
      x: Number(draft.x),
      y: Number(draft.y),
      width: Number(draft.width),
      height: Number(draft.height),
      is_active: draft.is_active,
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

  const handleImageUpload = async (file) => {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setDraft((d) => ({ ...d, image_url: dataUrl }));
  };

  const setStyle = (patch) => setDraft((d) => ({ ...d, style_json: { ...d.style_json, ...patch } }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
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
        </div>
      </div>

      <div className="overflow-x-auto mb-6">
        <div
          onMouseDown={() => setSelectedId(null)}
          className="relative bg-white border border-line rounded-card shadow-card"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
          {items.map((item) => (
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
          {items.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-subink">
              위 버튼으로 텍스트/이미지/도형을 추가해보세요.
            </p>
          )}
        </div>
      </div>

      {selected && draft && (
        <div className="bg-white border border-line rounded-card shadow-card p-5 max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-semibold text-ink">
              선택한 요소 편집 · {TYPE_LABELS[selected.item_type]}
            </h2>
            <button
              onClick={() => setDeleteTarget(selected)}
              className="p-1.5 rounded-md text-subink hover:bg-porcelain hover:text-clay-600"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
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
    </div>
  );
}
