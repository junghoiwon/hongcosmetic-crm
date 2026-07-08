import { useEffect, useState } from "react";
import { Menu, AlertTriangle } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import Quotes from "./pages/Quotes";
import Samples from "./pages/Samples";
import Settings from "./pages/Settings";
import UpdateLog from "./pages/UpdateLog";
import { seedDemoData, getSettings, DEFAULT_SETTINGS } from "./lib/db";
import { getSession, setSession as persistSession } from "./lib/session";
import { withAlpha } from "./lib/utils";
import { isSupabaseConfigured } from "./lib/supabaseClient";

function applyBranding(settings) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", settings.mainColor);
  root.style.setProperty("--brand-primary-soft", withAlpha(settings.mainColor, 0.12));
  root.style.setProperty("--brand-secondary", settings.subColor);
  root.style.setProperty("--brand-secondary-soft", withAlpha(settings.subColor, 0.12));
  document.title = settings.appNameKo || "영업관리 프로그램";

  let link = document.querySelector("link[rel~='icon']");
  if (settings.faviconDataUrl) {
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = settings.faviconDataUrl;
  }
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [pendingClientId, setPendingClientId] = useState(null);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(null);
  const [session, setSessionState] = useState(getSession());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const shouldSeed = import.meta.env.VITE_SEED_DEMO_DATA === "true";
    (shouldSeed ? seedDemoData() : Promise.resolve())
      .then(getSettings)
      .then((s) => {
        setSettings(s);
        applyBranding(s);
      })
      .catch((err) => {
        // Supabase 연결이 안 되어 있어도 화면이 빈 채로 멈추지 않도록 기본값으로 진행합니다.
        console.error("[App] 초기 설정 로드 실패, 기본값으로 진행합니다.", err);
        setSettings(DEFAULT_SETTINGS);
        applyBranding(DEFAULT_SETTINGS);
      })
      .finally(() => setReady(true));
  }, []);

  const navigateToClient = (clientId) => {
    setPendingClientId(clientId);
    setPage("clients");
  };

  const handleSettingsChange = (updated) => {
    const merged = { ...settings, ...updated };
    setSettings(merged);
    applyBranding(merged);
  };

  const handleSessionChange = (next) => {
    setSessionState(next);
    persistSession(next);
  };

  if (!ready || !settings) return null;

  return (
    <div className="flex min-h-screen bg-porcelain">
      <Sidebar
        current={page}
        onNavigate={setPage}
        settings={settings}
        session={session}
        onSessionChange={handleSessionChange}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <main className="flex-1 px-5 md:px-8 py-6 md:py-8 max-w-[1400px] min-w-0">
        <div className="flex items-center justify-between mb-5 md:mb-0">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-2 rounded-lg border border-line bg-white text-ink"
            aria-label="메뉴 열기"
          >
            <Menu size={18} />
          </button>
        </div>
        {!isSupabaseConfigured && (
          <div className="flex items-start gap-2.5 bg-clay-50 border border-clay-100 text-clay-600 rounded-card px-4 py-3 mb-5 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다.
              데이터가 저장되지 않을 수 있습니다. .env 파일 또는 Vercel 프로젝트 환경변수를 확인해주세요.
            </span>
          </div>
        )}
        {page === "dashboard" && (
          <Dashboard onNavigate={setPage} onNavigateToClient={navigateToClient} />
        )}
        {page === "clients" && (
          <Clients
            openClientId={pendingClientId}
            clearOpenClientId={() => setPendingClientId(null)}
            session={session}
          />
        )}
        {page === "products" && <Products session={session} />}
        {page === "quotes" && <Quotes session={session} />}
        {page === "samples" && <Samples session={session} />}
        {page === "logs" && <UpdateLog />}
        {page === "settings" && <Settings session={session} onSettingsChange={handleSettingsChange} />}
      </main>
    </div>
  );
}
