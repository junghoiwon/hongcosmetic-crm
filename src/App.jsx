import { useEffect, useState } from "react";
import { Menu, AlertTriangle, ShieldAlert } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import Quotes from "./pages/Quotes";
import Samples from "./pages/Samples";
import Settings from "./pages/Settings";
import UpdateLog from "./pages/UpdateLog";
import Users from "./pages/Users";
import LayoutEditor from "./pages/LayoutEditor";
import Login from "./pages/Login";
import { seedDemoData, getSettings, DEFAULT_SETTINGS } from "./lib/db";
import { getCurrentSession, onAuthStateChange, signOut } from "./lib/auth";
import {
  fetchMyProfile,
  fetchMyMenuPermissions,
  buildPermissionMap,
  canAccess,
  isAdminProfile,
} from "./lib/permissions";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ---- 인증 상태 ----
  const [authChecked, setAuthChecked] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [permissionMap, setPermissionMap] = useState({});

  // 최초 세션 확인 + 로그인/로그아웃 변화 구독
  useEffect(() => {
    let active = true;
    getCurrentSession().then((session) => {
      if (!active) return;
      setAuthUser(session?.user || null);
      setAuthChecked(true);
    });
    const unsubscribe = onAuthStateChange((session) => {
      setAuthUser(session?.user || null);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // 로그인한 사용자의 profiles 행 조회 (이름/부서/직급/역할/사용여부)
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      setProfileChecked(true);
      return;
    }
    let active = true;
    setProfileChecked(false);
    fetchMyProfile(authUser.id).then((p) => {
      if (!active) return;
      setProfile(p);
      setProfileChecked(true);
    });
    return () => {
      active = false;
    };
  }, [authUser]);

  // 프로필이 활성 상태로 확인되면, 사용자별 메뉴 권한도 함께 불러옵니다.
  useEffect(() => {
    if (!profile || !profile.is_active) {
      setPermissionMap({});
      return;
    }
    let active = true;
    fetchMyMenuPermissions(profile.user_id).then((rows) => {
      if (!active) return;
      setPermissionMap(buildPermissionMap(rows));
    });
    return () => {
      active = false;
    };
  }, [profile]);

  // 로그인 + 프로필 확인이 끝난 뒤에만 프로그램 설정을 불러옵니다.
  useEffect(() => {
    if (!profile || !profile.is_active) return;
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
  }, [profile]);

  const navigateToClient = (clientId) => {
    setPendingClientId(clientId);
    setPage("clients");
  };

  const handleSettingsChange = (updated) => {
    const merged = { ...settings, ...updated };
    setSettings(merged);
    applyBranding(merged);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-porcelain px-4">
        <div className="max-w-md text-center bg-white border border-line rounded-card shadow-card p-8">
          <AlertTriangle size={28} className="mx-auto text-clay-500 mb-3" />
          <h1 className="font-display text-base font-semibold text-ink mb-1.5">
            Supabase 연결이 설정되지 않았습니다
          </h1>
          <p className="text-sm text-subink">
            VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수를 설정한 뒤 다시 시도해주세요.
          </p>
        </div>
      </div>
    );
  }

  // 최초 세션 확인 중
  if (!authChecked) return null;

  // 로그인하지 않은 경우: 로그인 화면만 표시
  if (!authUser) return <Login />;

  // 로그인 직후 프로필(권한 정보) 조회 중
  if (!profileChecked) return null;

  // 프로필이 없거나 비활성화된 계정: 접근 차단
  if (!profile || !profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-porcelain px-4">
        <div className="max-w-md text-center bg-white border border-line rounded-card shadow-card p-8">
          <AlertTriangle size={28} className="mx-auto text-clay-500 mb-3" />
          <h1 className="font-display text-base font-semibold text-ink mb-1.5">
            {profile ? "비활성화된 계정입니다" : "계정 정보를 확인할 수 없습니다"}
          </h1>
          <p className="text-sm text-subink mb-5">
            관리자에게 계정 활성화를 문의해주세요.
          </p>
          <button
            onClick={() => signOut()}
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--brand-primary)" }}
          >
            로그인 화면으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!ready || !settings) return null;

  // 기존 화면 컴포넌트들이 기대하는 { name, role } 형태로 변환합니다.
  const session = {
    name: profile.name || profile.email,
    role: profile.role,
    email: profile.email,
    userId: profile.user_id,
    profileId: profile.id,
    is_active: true,
  };

  // 메뉴별 보기 권한 확인 (관리자는 항상 통과). 사이드바에서 숨긴 메뉴를
  // 강제로 선택하더라도 여기서 한 번 더 막아, 접근 통제가 화면 하나에만
  // 의존하지 않도록 합니다. (실제 데이터 접근 차단은 Supabase RLS가 담당)
  const canView = (menuKey) => canAccess(session, permissionMap, menuKey, "view");

  const accessDenied = (
    <div className="max-w-md mx-auto mt-20 text-center">
      <ShieldAlert size={32} className="mx-auto text-clay-500 mb-3" />
      <h1 className="font-display text-lg font-semibold text-ink mb-1.5">접근 권한이 없는 메뉴입니다</h1>
      <p className="text-sm text-subink">관리자에게 메뉴 권한 부여를 요청해주세요.</p>
    </div>
  );

  const renderPage = () => {
    // 사용자관리/화면편집은 메뉴 권한 위임 대상이 아니라 관리자 여부로만 판단합니다.
    // (일반 메뉴 권한으로 위임 가능하게 두면 권한 상승/오염 위험이 생기기 때문)
    if (page === "users") {
      return isAdminProfile(session) ? <Users session={session} /> : accessDenied;
    }
    if (page === "layout") {
      return isAdminProfile(session) ? <LayoutEditor /> : accessDenied;
    }
    if (!canView(page)) {
      return accessDenied;
    }
    switch (page) {
      case "dashboard":
        return <Dashboard onNavigate={setPage} onNavigateToClient={navigateToClient} />;
      case "clients":
        return (
          <Clients
            openClientId={pendingClientId}
            clearOpenClientId={() => setPendingClientId(null)}
            session={session}
            permissionMap={permissionMap}
          />
        );
      case "products":
        return <Products session={session} permissionMap={permissionMap} />;
      case "quotes":
        return <Quotes session={session} permissionMap={permissionMap} />;
      case "samples":
        return <Samples session={session} permissionMap={permissionMap} />;
      case "logs":
        return <UpdateLog />;
      case "settings":
        return <Settings session={session} onSettingsChange={handleSettingsChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-porcelain">
      <Sidebar
        current={page}
        onNavigate={setPage}
        settings={settings}
        session={session}
        permissionMap={permissionMap}
        onLogout={() => signOut()}
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
        {renderPage()}
      </main>
    </div>
  );
}
