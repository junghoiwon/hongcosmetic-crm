import { Menu, X,
  LayoutGrid,
  Building2,
  FlaskConical,
  FileText,
  PackageOpen,
  History,
  Settings as SettingsIcon,
  UserCog,
  LayoutTemplate,
  LogOut,
} from "lucide-react";
import { ROLE_LABELS } from "../lib/session";
import { canAccess, isAdminProfile } from "../lib/permissions";

const NAV = [
  { key: "dashboard", icon: LayoutGrid },
  { key: "clients", icon: Building2 },
  { key: "products", icon: FlaskConical },
  { key: "quotes", icon: FileText },
  { key: "samples", icon: PackageOpen },
];

export default function Sidebar({ current, onNavigate, settings, session, permissionMap, onLogout, mobileOpen, onCloseMobile }) {
  const menuLabels = settings?.menuLabels || {};
  const admin = isAdminProfile(session);
  const canView = (menuKey) => canAccess(session, permissionMap, menuKey, "view");
  const visibleNav = NAV.filter((item) => canView(item.key));

  const navigate = (key) => {
    onNavigate(key);
    onCloseMobile?.();
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
        {visibleNav.map(({ key, icon: Icon }) => {
          const active = current === key;
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              style={
                active
                  ? { backgroundColor: "var(--brand-primary-soft)", color: "var(--brand-primary)" }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? "font-medium" : "text-subink hover:bg-porcelain hover:text-ink"
              }`}
            >
              <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
              {menuLabels[key] || key}
            </button>
          );
        })}

        <div className="pt-2 mt-2 border-t border-line space-y-0.5">
          {canView("logs") && (
            <button
              onClick={() => navigate("logs")}
              style={
                current === "logs"
                  ? { backgroundColor: "var(--brand-primary-soft)", color: "var(--brand-primary)" }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                current === "logs" ? "font-medium" : "text-subink hover:bg-porcelain hover:text-ink"
              }`}
            >
              <History size={17} strokeWidth={current === "logs" ? 2.3 : 1.8} />
              업데이트 로그
            </button>
          )}
          {canView("settings") && (
            <button
              onClick={() => navigate("settings")}
              style={
                current === "settings"
                  ? { backgroundColor: "var(--brand-primary-soft)", color: "var(--brand-primary)" }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                current === "settings" ? "font-medium" : "text-subink hover:bg-porcelain hover:text-ink"
              }`}
            >
              <SettingsIcon size={17} strokeWidth={current === "settings" ? 2.3 : 1.8} />
              설정
            </button>
          )}
          {admin && (
            <button
              onClick={() => navigate("users")}
              style={
                current === "users"
                  ? { backgroundColor: "var(--brand-primary-soft)", color: "var(--brand-primary)" }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                current === "users" ? "font-medium" : "text-subink hover:bg-porcelain hover:text-ink"
              }`}
            >
              <UserCog size={17} strokeWidth={current === "users" ? 2.3 : 1.8} />
              사용자관리
            </button>
          )}
          {admin && (
            <button
              onClick={() => navigate("layout")}
              style={
                current === "layout"
                  ? { backgroundColor: "var(--brand-primary-soft)", color: "var(--brand-primary)" }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                current === "layout" ? "font-medium" : "text-subink hover:bg-porcelain hover:text-ink"
              }`}
            >
              <LayoutTemplate size={17} strokeWidth={current === "layout" ? 2.3 : 1.8} />
              화면 편집
            </button>
          )}
        </div>
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
