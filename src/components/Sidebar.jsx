import { Menu, X,
  LayoutGrid,
  Building2,
  FlaskConical,
  FileText,
  PackageOpen,
  History,
  Settings as SettingsIcon,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { ROLES, ROLE_LABELS, isAdmin } from "../lib/session";

const NAV = [
  { key: "dashboard", icon: LayoutGrid },
  { key: "clients", icon: Building2 },
  { key: "products", icon: FlaskConical },
  { key: "quotes", icon: FileText },
  { key: "samples", icon: PackageOpen },
];

export default function Sidebar({ current, onNavigate, settings, session, onSessionChange, mobileOpen, onCloseMobile }) {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const menuLabels = settings?.menuLabels || {};
  const admin = isAdmin(session);

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
        {NAV.map(({ key, icon: Icon }) => {
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
          {admin && (
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
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-line relative">
        <button
          onClick={() => setRoleMenuOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-porcelain text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink truncate">{session?.name}</span>
            <span className="block text-[11px] text-subink">{ROLE_LABELS[session?.role]}</span>
          </span>
          <ChevronDown size={14} className="text-subink shrink-0" />
        </button>

        {roleMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-line rounded-lg shadow-card p-2.5 z-10 space-y-2">
            <p className="text-[11px] text-subink px-0.5">
              데모용 사용자 전환 (실제 로그인 연동 예정)
            </p>
            <input
              value={session?.name || ""}
              onChange={(e) => onSessionChange({ ...session, name: e.target.value })}
              placeholder="담당자 이름"
              className="w-full px-2 py-1.5 rounded-md border border-line text-sm outline-none focus:border-jade-500"
            />
            <div className="space-y-0.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    onSessionChange({ ...session, role: r });
                    setRoleMenuOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-porcelain ${
                    session?.role === r ? "text-jade-600 font-medium" : "text-ink"
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
