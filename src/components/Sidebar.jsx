import { Menu, X, LogOut } from "lucide-react";
import { ROLE_LABELS } from "../lib/session";
import { canAccess, isAdminProfile } from "../lib/permissions";
import { getMenuIcon } from "../lib/icons";

// 이 메뉴들은 menu_permissions로 위임하지 않고 role='admin' 여부로만 접근을 판단합니다.
// (위임 가능하게 두면 권한 상승 취약점이 생기기 때문 — 3단계에서 정한 원칙)
const ADMIN_ONLY_KEYS = ["users", "layout", "menu-editor"];

export default function Sidebar({
  current,
  onNavigate,
  settings,
  session,
  permissionMap,
  appMenus,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) {
  const admin = isAdminProfile(session);

  const canView = (menu) =>
    ADMIN_ONLY_KEYS.includes(menu.menu_key) ? admin : canAccess(session, permissionMap, menu.menu_key, "view");

  const visibleMenus = (appMenus || []).filter((m) => m.is_active && canView(m));

  const navigate = (key) => {
    onNavigate(key);
    onCloseMobile?.();
  };

  const sidebarBgStyle = {
    backgroundColor: settings?.sidebarBgColor || undefined,
    backgroundImage: settings?.sidebarBgImageUrl ? `url(${settings.sidebarBgImageUrl})` : undefined,
    backgroundSize: settings?.sidebarBgImageUrl ? "cover" : undefined,
    backgroundPosition: settings?.sidebarBgImageUrl ? "center" : undefined,
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-ink/30 z-30 md:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`w-60 shrink-0 h-screen fixed md:sticky top-0 flex flex-col bg-white border-r border-line z-40 transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={sidebarBgStyle}
      >
      <div className="px-6 pt-7 pb-6 flex items-start justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {settings?.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.companyName}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--brand-secondary)" }} />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-display text-[15px] font-semibold text-ink leading-tight truncate">
              {settings?.appNameKo || "영업관리 프로그램"}
            </p>
            <p className="text-[11px] text-subink tracking-wide truncate">
              {settings?.appNameEn || ""}
            </p>
          </div>
        </div>
        <button onClick={onCloseMobile} className="md:hidden p-1 text-subink hover:text-ink shrink-0">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {visibleMenus.map((menu) => {
          const Icon = getMenuIcon(menu.icon_key);
          const active = current === menu.menu_key;
          return (
            <button
              key={menu.menu_key}
              onClick={() => navigate(menu.menu_key)}
              style={
                active
                  ? { backgroundColor: "var(--brand-primary-soft)", color: "var(--brand-primary)" }
                  : settings?.sidebarMenuTextColor
                  ? { color: settings.sidebarMenuTextColor }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? "font-medium" : "text-subink hover:bg-porcelain hover:text-ink"
              }`}
            >
              <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
              {menu.menu_name}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-line">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink truncate">{session?.name}</span>
            <span className="block text-[11px] text-subink">
              {ROLE_LABELS[session?.role] || session?.role}
              {admin ? " · 관리자" : ""}
            </span>
          </span>
          <button
            onClick={onLogout}
            title="로그아웃"
            aria-label="로그아웃"
            className="p-1.5 rounded-md text-subink hover:text-clay-600 hover:bg-clay-50 shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
