import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import Quotes from "./pages/Quotes";
import Samples from "./pages/Samples";
import Settings from "./pages/Settings";
import UpdateLog from "./pages/UpdateLog";
import { seedDemoData, getSettings } from "./lib/db";
import { getSession, setSession as persistSession } from "./lib/session";
import { withAlpha } from "./lib/utils";

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
    seedDemoData()
      .then(getSettings)
      .then((s) => {
        setSettings(s);
        applyBranding(s);
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
        <button
          onClick={() => setMobileNavOpen(true)}
          className="md:hidden mb-5 p-2 rounded-lg border border-line bg-white text-ink"
          aria-label="메뉴 열기"
        >
          <Menu size={18} />
        </button>
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
