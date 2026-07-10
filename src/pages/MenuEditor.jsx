import { useEffect, useMemo, useState } from "react";
import { GripVertical, Eye, EyeOff, Lock, Plus, Trash2, FolderPlus, ChevronRight } from "lucide-react";
import { fetchAllAppMenus, updateAppMenu, reorderAppMenus, createAppMenu, deleteAppMenu } from "../lib/appMenus";
import { ICON_MAP, ICON_OPTIONS, getMenuIcon } from "../lib/icons";
import { TextInput, Select } from "../components/ui/Field";
import { Button, ConfirmDialog, Toast } from "../components/ui/Basics";

const LEVEL_LABEL = { 1: "대분류", 2: "중분류", 3: "소분류(화면)" };

function buildTree(menus) {
  const byParent = {};
  for (const m of menus) {
    const key = m.parent_menu_key || "__root__";
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(m);
  }
  const attach = (parentKey) =>
    (byParent[parentKey] || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ ...m, children: attach(m.menu_key) }));
  return attach("__root__");
}

export default function MenuEditor({ onMenusChanged }) {
  const [menus, setMenus] = useState([]);
  const [iconPickerFor, setIconPickerFor] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [addTarget, setAddTarget] = useState(undefined); // undefined=닫힘, null=최상위 추가, menu=하위 추가
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const load = () => fetchAllAppMenus().then(setMenus);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const tree = useMemo(() => buildTree(menus), [menus]);

  const notifyChanged = async () => {
    await load();
    onMenusChanged?.();
  };

  const renameMenu = (id, menu_name) => {
    setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, menu_name } : m)));
  };

  const commitRename = async (menu) => {
    await updateAppMenu(menu.id, { menu_name: menu.menu_name });
    notifyChanged();
  };

  const setIcon = async (menu, icon_key) => {
    setIconPickerFor(null);
    await updateAppMenu(menu.id, { icon_key });
    notifyChanged();
  };

  const toggleActive = async (menu) => {
    if (menu.is_protected) return;
    await updateAppMenu(menu.id, { is_active: !menu.is_active });
    notifyChanged();
  };

  const setColor = async (menu, color) => {
    await updateAppMenu(menu.id, { color });
    notifyChanged();
  };

  const toggleExpand = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleDragStart = (menu) => setDraggedId(menu.id);
  const handleDragOver = (e, menu) => {
    e.preventDefault();
    if (menu.id !== draggedId) setDragOverId(menu.id);
  };
  const handleDrop = async (targetMenu) => {
    setDragOverId(null);
    if (!draggedId || draggedId === targetMenu.id) return;
    const dragged = menus.find((m) => m.id === draggedId);
    if (!dragged) return;
    // 같은 상위 메뉴를 가진 형제끼리만 드래그로 순서를 바꿉니다.
    if ((dragged.parent_menu_key || null) !== (targetMenu.parent_menu_key || null)) {
      setDraggedId(null);
      return;
    }
    const siblings = menus
      .filter((m) => (m.parent_menu_key || null) === (dragged.parent_menu_key || null))
      .sort((a, b) => a.sort_order - b.sort_order);
    const fromIndex = siblings.findIndex((m) => m.id === draggedId);
    const toIndex = siblings.findIndex((m) => m.id === targetMenu.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...siblings];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setDraggedId(null);
    await reorderAppMenus(next.map((m) => m.id));
    notifyChanged();
  };

  const changeParent = async (menu, parentKey) => {
    const parent = parentKey ? menus.find((m) => m.menu_key === parentKey) : null;
    const level = parent ? Math.min(3, (parent.level || 1) + 1) : 1;
    await updateAppMenu(menu.id, { parent_menu_key: parent?.menu_key || null, level });
    notifyChanged();
  };

  const openAdd = (parentMenu) => {
    setAddTarget(parentMenu === undefined ? null : parentMenu);
    setNewName("");
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const parentMenu = addTarget || null;
    await createAppMenu({ menuName: newName.trim(), parentMenu });
    setAddTarget(undefined);
    setNewName("");
    setToastMsg("메뉴를 추가했습니다.");
    notifyChanged();
  };

  const confirmDelete = async () => {
    try {
      await deleteAppMenu(deleteTarget, menus);
      setDeleteTarget(null);
      setDeleteError("");
      setToastMsg("메뉴를 삭제했습니다.");
      notifyChanged();
    } catch (err) {
      setDeleteError(err.message || "삭제할 수 없습니다.");
    }
  };

  const parentOptionsFor = (menu) =>
    menus.filter((m) => m.menu_key !== menu.menu_key && (m.level || 1) < 3 && m.menu_key !== menu.parent_menu_key);

  const renderNode = (menu, depth) => {
    const Icon = getMenuIcon(menu.icon_key);
    const hasChildren = (menu.children || []).length > 0;
    const isOpen = expanded.has(menu.menu_key) || hasChildren;
    const canAddChild = (menu.level || 1) < 3;

    return (
      <div key={menu.id}>
        <div
          draggable
          onDragStart={() => handleDragStart(menu)}
          onDragOver={(e) => handleDragOver(e, menu)}
          onDragLeave={() => setDragOverId((id) => (id === menu.id ? null : id))}
          onDrop={() => handleDrop(menu)}
          onDragEnd={() => {
            setDraggedId(null);
            setDragOverId(null);
          }}
          style={{ paddingLeft: 8 + depth * 20 }}
          className={`flex items-center gap-2 px-2 py-2.5 relative bg-white border-b border-line last:border-b-0 ${
            draggedId === menu.id ? "opacity-40" : ""
          } ${dragOverId === menu.id ? "border-t-2 border-jade-500" : ""}`}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(menu.menu_key)}
              className="text-subink shrink-0"
              title="펼치기/접기"
            >
              <ChevronRight size={13} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <span className="w-[13px] shrink-0" />
          )}

          <span className="text-subink/50 cursor-grab active:cursor-grabbing shrink-0" title="드래그해서 형제 메뉴 순서 변경">
            <GripVertical size={15} />
          </span>

          <button
            onClick={() => setIconPickerFor(iconPickerFor === menu.id ? null : menu.id)}
            className="w-8 h-8 rounded-lg border border-line bg-porcelain flex items-center justify-center shrink-0 text-ink hover:border-jade-500"
            title="아이콘 변경"
          >
            <Icon size={15} />
          </button>
          {iconPickerFor === menu.id && (
            <div className="absolute left-16 top-12 z-10 bg-white border border-line rounded-lg shadow-card p-2 grid grid-cols-6 gap-1 w-64">
              {ICON_OPTIONS.map((key) => {
                const OptIcon = ICON_MAP[key];
                return (
                  <button
                    key={key}
                    onClick={() => setIcon(menu, key)}
                    className={`w-9 h-9 rounded-md flex items-center justify-center hover:bg-porcelain ${
                      menu.icon_key === key ? "bg-jade-50 text-jade-600" : "text-ink"
                    }`}
                  >
                    <OptIcon size={16} />
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <TextInput
              value={menu.menu_name}
              onChange={(e) => renameMenu(menu.id, e.target.value)}
              onBlur={() => commitRename(menu)}
              className="max-w-xs"
            />
            <p className="text-[11px] text-subink mt-1">
              {LEVEL_LABEL[menu.level || 1]} · {menu.menu_key}
              {!menu.is_page && " · 화면 없음(펼침 전용)"}
            </p>
          </div>

          <div className="w-32 shrink-0">
            <Select
              value={menu.parent_menu_key || ""}
              onChange={(e) => changeParent(menu, e.target.value || null)}
              placeholder="최상위"
              options={parentOptionsFor(menu).map((m) => ({ value: m.menu_key, label: m.menu_name }))}
            />
          </div>

          <div className="flex items-center gap-1 shrink-0" title="메뉴 색상">
            <input
              type="color"
              value={menu.color || "#6B665F"}
              onChange={(e) => setColor(menu, e.target.value)}
              className="w-7 h-7 rounded-md border border-line cursor-pointer"
            />
          </div>

          {canAddChild && (
            <button
              onClick={() => openAdd(menu)}
              className="p-1.5 rounded-md text-subink hover:bg-porcelain hover:text-jade-600 shrink-0"
              title="하위 메뉴 추가"
            >
              <FolderPlus size={15} />
            </button>
          )}

          {menu.is_protected ? (
            <span className="p-1.5 text-subink/60 shrink-0" title="보안 메뉴는 숨길 수 없습니다">
              <Lock size={15} />
            </span>
          ) : (
            <button
              onClick={() => toggleActive(menu)}
              title={menu.is_active ? "숨기기" : "표시하기"}
              className="p-1.5 rounded-md text-subink hover:bg-porcelain hover:text-jade-600 shrink-0"
            >
              {menu.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          )}

          {!menu.is_protected && !hasChildren && (
            <button
              onClick={() => {
                setDeleteTarget(menu);
                setDeleteError("");
              }}
              className="p-1.5 rounded-md text-subink hover:bg-porcelain hover:text-clay-600 shrink-0"
              title="삭제"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
        {hasChildren && isOpen && menu.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">메뉴 편집</h1>
          <p className="text-sm text-subink mt-1">
            좌측 사이드바에 표시되는 메뉴를 대/중/소분류 3단계로 구성하고, 이름·아이콘·순서·표시 여부·상위 메뉴를
            관리합니다. (관리자 전용)
          </p>
        </div>
        <Button size="sm" onClick={() => openAdd(null)}>
          <Plus size={15} /> 대분류 추가
        </Button>
      </div>

      <p className="text-xs text-subink mb-2">
        왼쪽 손잡이(⋮⋮)를 드래그하면 같은 단계(형제) 메뉴끼리 순서를 바꿀 수 있고, 상위 메뉴 드롭다운으로 소속을
        옮길 수 있습니다. 화살표가 있는 항목만 하위 메뉴를 가지고 있습니다.
      </p>
      <div className="bg-white border border-line rounded-card shadow-card overflow-hidden max-w-4xl">
        {tree.length === 0 ? (
          <p className="text-sm text-subink text-center py-8">등록된 메뉴가 없습니다.</p>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      {addTarget !== undefined && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-ink/30" onClick={() => setAddTarget(undefined)} />
          <div className="relative bg-white rounded-card shadow-card border border-line max-w-sm w-full p-6">
            <h3 className="font-display font-semibold text-ink mb-3">
              {addTarget ? `"${addTarget.menu_name}" 하위 메뉴 추가` : "대분류 메뉴 추가"}
            </h3>
            <form onSubmit={submitAdd} className="space-y-4">
              <TextInput
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="메뉴 이름"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddTarget(undefined)}
                  className="px-4 py-2 text-sm rounded-lg border border-line text-ink hover:bg-porcelain"
                >
                  취소
                </button>
                <Button type="submit" size="sm">추가</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="메뉴를 삭제할까요?"
        description={deleteError || `"${deleteTarget?.menu_name}" 메뉴가 삭제됩니다. 하위 메뉴가 있으면 삭제할 수 없습니다.`}
        confirmLabel="삭제"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
      />
      <Toast message={toastMsg} />
    </div>
  );
}
