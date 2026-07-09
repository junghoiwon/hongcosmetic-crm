import { useEffect, useState } from "react";
import { GripVertical, Eye, EyeOff, Lock } from "lucide-react";
import { fetchAllAppMenus, updateAppMenu, reorderAppMenus } from "../lib/appMenus";
import { ICON_MAP, ICON_OPTIONS, getMenuIcon } from "../lib/icons";
import { TextInput } from "../components/ui/Field";

export default function MenuEditor({ onMenusChanged }) {
  const [menus, setMenus] = useState([]);
  const [iconPickerFor, setIconPickerFor] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const load = () => fetchAllAppMenus().then(setMenus);

  useEffect(() => {
    load();
  }, []);

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

  const handleDragStart = (menu) => setDraggedId(menu.id);

  const handleDragOver = (e, menu) => {
    e.preventDefault();
    if (menu.id !== draggedId) setDragOverId(menu.id);
  };

  const handleDrop = async (targetMenu) => {
    setDragOverId(null);
    if (!draggedId || draggedId === targetMenu.id) return;
    const fromIndex = menus.findIndex((m) => m.id === draggedId);
    const toIndex = menus.findIndex((m) => m.id === targetMenu.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...menus];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setMenus(next);
    setDraggedId(null);
    await reorderAppMenus(next.map((m) => m.id));
    notifyChanged();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">메뉴 편집</h1>
        <p className="text-sm text-subink mt-1">
          좌측 사이드바에 표시되는 메뉴의 이름·아이콘·순서·표시 여부를 관리합니다. (관리자 전용)
        </p>
      </div>

      <p className="text-xs text-subink mb-2">왼쪽 손잡이(⋮⋮)를 드래그해서 순서를 바꿀 수 있습니다.</p>
      <div className="bg-white border border-line rounded-card shadow-card divide-y divide-line max-w-2xl">
        {menus.map((menu) => {
          const Icon = getMenuIcon(menu.icon_key);
          return (
            <div
              key={menu.id}
              draggable
              onDragStart={() => handleDragStart(menu)}
              onDragOver={(e) => handleDragOver(e, menu)}
              onDragLeave={() => setDragOverId((id) => (id === menu.id ? null : id))}
              onDrop={() => handleDrop(menu)}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              className={`flex items-center gap-3 px-4 py-3 relative bg-white ${
                draggedId === menu.id ? "opacity-40" : ""
              } ${dragOverId === menu.id ? "border-t-2 border-jade-500" : ""}`}
            >
              <span
                className="text-subink/50 cursor-grab active:cursor-grabbing shrink-0"
                title="드래그해서 순서 변경"
              >
                <GripVertical size={16} />
              </span>

              <button
                onClick={() => setIconPickerFor(iconPickerFor === menu.id ? null : menu.id)}
                className="w-9 h-9 rounded-lg border border-line bg-porcelain flex items-center justify-center shrink-0 text-ink hover:border-jade-500"
                title="아이콘 변경"
              >
                <Icon size={17} />
              </button>
              {iconPickerFor === menu.id && (
                <div className="absolute left-16 top-14 z-10 bg-white border border-line rounded-lg shadow-card p-2 grid grid-cols-6 gap-1 w-64">
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
                <p className="text-[11px] text-subink mt-1">{menu.menu_key}</p>
              </div>

              {menu.is_protected ? (
                <span
                  className="p-1.5 text-subink/60 shrink-0"
                  title="사용자관리/설정 등 보안 메뉴는 숨길 수 없습니다"
                >
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
