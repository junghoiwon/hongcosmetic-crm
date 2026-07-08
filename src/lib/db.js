/**
 * db.js
 * ------------------------------------------------------------------
 * 각 데이터(거래처, 제품, 견적, 샘플, 상담이력)에 대한 CRUD 함수 모음.
 * 실제 저장 로직은 storageAdapter.js 가 담당하므로, 나중에 DB를
 * 교체하더라도 컴포넌트들은 이 파일의 함수 이름과 시그니처를 그대로
 * 사용할 수 있습니다.
 * ------------------------------------------------------------------
 */
import * as storage from "./storageAdapter";

const TABLES = {
  clients: "clients",
  products: "products",
  quotes: "quotes",
  samples: "samples",
  consultations: "consultations",
  customCountries: "customCountries",
  settings: "settings",
  activityLogs: "activityLogs",
};

function makeRepo(table) {
  return {
    list: () => storage.listAll(table),
    get: (id) => storage.getById(table, id),
    create: (data) => storage.create(table, data),
    update: (id, patch) => storage.update(table, id, patch),
    remove: (id) => storage.remove(table, id),
  };
}

export const clientsDB = makeRepo(TABLES.clients);
export const productsDB = makeRepo(TABLES.products);
export const quotesDB = makeRepo(TABLES.quotes);
export const samplesDB = makeRepo(TABLES.samples);
export const consultationsDB = makeRepo(TABLES.consultations);
export const customCountriesDB = makeRepo(TABLES.customCountries);
export const settingsDB = makeRepo(TABLES.settings);
export const activityLogsDB = makeRepo(TABLES.activityLogs);

export const DEFAULT_MENU_LABELS = {
  dashboard: "대시보드",
  clients: "거래처",
  products: "제품",
  quotes: "견적",
  samples: "샘플 발송",
};

export const DEFAULT_SETTINGS = {
  appNameKo: "홍코스메틱 영업관리 프로그램",
  appNameEn: "HONG COSMETIC Sales Management",
  companyName: "홍코스메틱",
  logoDataUrl: "",
  faviconDataUrl: "",
  mainColor: "#2F6F62",
  subColor: "#CC6E4C",
  menuLabels: { ...DEFAULT_MENU_LABELS },
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
};

/** 설정(단일 레코드)을 가져옵니다. 없으면 기본값으로 생성합니다. */
export async function getSettings() {
  const rows = await settingsDB.list();
  if (rows.length) {
    // 이전 버전 설정에 새 필드가 추가된 경우를 대비해 기본값과 병합
    return { ...DEFAULT_SETTINGS, ...rows[0], menuLabels: { ...DEFAULT_MENU_LABELS, ...rows[0].menuLabels } };
  }
  return settingsDB.create(DEFAULT_SETTINGS);
}

/** 설정을 수정합니다. */
export async function updateSettings(patch) {
  const current = await getSettings();
  return settingsDB.update(current.id, patch);
}

/**
 * 활동 로그를 기록합니다. 거래처/제품/견적/샘플/설정 변경 등
 * 시스템에서 벌어지는 모든 주요 변경사항을 여기로 기록해두면
 * 대시보드의 "최근 업데이트" 카드와 전체 로그 페이지에 자동 반영됩니다.
 */
export async function logActivity({ actor, action, summary, detail = "" }) {
  const now = new Date();
  return activityLogsDB.create({
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    actor,
    action,
    summary,
    detail,
    ts: now.toISOString(),
  });
}

/** 사용자가 직접 입력한 국가명을 저장합니다. 이미 있으면 아무 것도 하지 않습니다. */
export async function saveCustomCountryIfNew(name, knownList) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  if (knownList.includes(trimmed)) return;
  await customCountriesDB.create({ name: trimmed });
}

export async function seedDemoData() {
  await storage.seedIfEmpty(TABLES.products, [
    {
      id: "p_demo1",
      name: "수분 진정 크림",
      capacity: "50ml",
      cost: 1800,
      basePrice: 3500,
      price1000: 3100,
      price2000: 2800,
      moq: 3000,
      boxQty: 100,
      hsCode: "3304.99",
      note: "저자극 포뮬러, 민감성 피부용",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "p_demo2",
      name: "비타민 앰플 세럼",
      capacity: "30ml",
      cost: 2600,
      basePrice: 5200,
      price1000: 4700,
      price2000: 4300,
      moq: 2000,
      boxQty: 150,
      hsCode: "3304.99",
      note: "미백 기능성 고시 원료 포함",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };

  await storage.seedIfEmpty(TABLES.clients, [
    {
      id: "c_demo1",
      companyName: "Sunrise Beauty Co.",
      country: "베트남",
      contactName: "Nguyen Thi Lan",
      phone: "+84 90 123 4567",
      email: "lan@sunrisebeauty.vn",
      kakao: "",
      wechat: "",
      whatsapp: "+84 90 123 4567",
      interestProduct: "수분 진정 크림",
      status: "견적발송",
      importance: "상",
      memo: "베트남 최대 드럭스토어 체인 입점 예정. 가격 협상 중.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "c_demo2",
      companyName: "北京美丽日记贸易",
      country: "중국",
      contactName: "王丽",
      phone: "+86 138 0013 8000",
      email: "wangli@bjbeauty.cn",
      kakao: "",
      wechat: "wangli_beauty",
      whatsapp: "",
      interestProduct: "비타민 앰플 세럼",
      status: "인허가검토",
      importance: "상",
      memo: "중국 위생허가(NMPA) 서류 준비 중. 통관 일정 확인 필요.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "c_demo3",
      companyName: "Glow House LLC",
      country: "미국",
      contactName: "Sarah Kim",
      phone: "+1 213 555 0192",
      email: "sarah@glowhouse.com",
      kakao: "",
      wechat: "",
      whatsapp: "+1 213 555 0192",
      interestProduct: "수분 진정 크림",
      status: "샘플발송",
      importance: "중",
      memo: "인스타그램 기반 인디 브랜드. 소량 발주 선호.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  await storage.seedIfEmpty(TABLES.quotes, [
    {
      id: "q_demo1",
      clientId: "c_demo1",
      productId: "p_demo1",
      quantity: 3000,
      unitPrice: 3.1,
      totalAmount: 9300,
      currency: "USD",
      quoteDate: iso(addDays(-5)),
      status: "협의중",
      memo: "3,000개 기준 단가 협의 중, 박스 디자인 별도 견적 요청받음.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  await storage.seedIfEmpty(TABLES.samples, [
    {
      id: "s_demo1",
      clientId: "c_demo3",
      productName: "수분 진정 크림",
      quantity: 5,
      sentDate: iso(addDays(-6)),
      carrier: "DHL",
      trackingNumber: "DHL7788994",
      shippingCost: 45000,
      etaDate: iso(addDays(1)),
      followUpDate: iso(today),
      memo: "인플루언서 협업용 샘플 별도 요청받음.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  await storage.seedIfEmpty(TABLES.consultations, [
    {
      id: "cs_demo1",
      clientId: "c_demo1",
      date: iso(addDays(-2)),
      content: "MOQ 3,000개 기준 단가 재요청. 박스 디자인 시안 3안 전달 예정.",
      nextContactDate: iso(today),
      pinned: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "cs_demo2",
      clientId: "c_demo2",
      date: iso(addDays(-1)),
      content: "NMPA 허가 서류 리스트 회신. 성분 배합비 자료 요청함.",
      nextContactDate: iso(addDays(2)),
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
}
