/**
 * productExcel.js
 * ------------------------------------------------------------------
 * 제품 엑셀 업로드/다운로드. 현재고만이 아니라 제품의 모든 필드를
 * Supabase에 저장하기 위해, 엑셀 원본을 직접 읽어(raw rows) 헤더 텍스트를
 * 공백/대소문자 차이를 무시하고 필드에 매칭합니다. 값 하나의 형식이
 * 잘못되어도 해당 행만 오류로 표시되고, 나머지 행은 정상적으로 반영됩니다.
 * ------------------------------------------------------------------
 */
import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";

// 제품의 전체 필드 정의. key는 productsDB에 저장되는 속성명, header는 다운로드
// 양식/엑셀 파일에 표시할 대표 헤더, aliases는 업로드 시 인식할 헤더 별칭들입니다.
export const PRODUCT_FIELD_DEFS = [
  { key: "productCode", header: "제품코드", aliases: ["제품코드", "코드", "제품 코드"], type: "text" },
  { key: "name", header: "제품명", aliases: ["제품명", "품명", "제품 명"], type: "text" },
  { key: "englishName", header: "영문명", aliases: ["영문명", "영문 제품명", "englishname"], type: "text" },
  { key: "brand", header: "브랜드", aliases: ["브랜드", "brand"], type: "text" },
  { key: "category", header: "카테고리", aliases: ["카테고리", "분류", "category"], type: "text" },
  { key: "division", header: "구분", aliases: ["구분", "제품구분"], type: "text" },
  { key: "capacity", header: "용량규격", aliases: ["용량규격", "용량", "규격"], type: "text" },
  { key: "unit", header: "단위", aliases: ["단위", "unit"], type: "text" },
  { key: "currentStock", header: "현재고", aliases: ["현재고", "재고", "현재 재고"], type: "number" },
  { key: "safetyStock", header: "안전재고", aliases: ["안전재고", "안전 재고"], type: "number" },
  { key: "basePrice", header: "공급가", aliases: ["공급가", "기본공급가", "기본 공급가"], type: "number" },
  { key: "consumerPrice", header: "소비자가", aliases: ["소비자가", "소비자 가격"], type: "number" },
  { key: "cost", header: "원가", aliases: ["원가"], type: "number" },
  { key: "wholesalePrice", header: "도매가", aliases: ["도매가"], type: "number" },
  { key: "price1000", header: "1000개단가", aliases: ["1000개단가", "1000개 단가", "1,000개 단가"], type: "number" },
  { key: "price2000", header: "2000개단가", aliases: ["2000개단가", "2000개 단가", "2,000개 단가"], type: "number" },
  { key: "moq", header: "MOQ", aliases: ["moq", "최소주문수량"], type: "number" },
  { key: "boxQty", header: "박스입수량", aliases: ["박스입수량", "박스입수", "박스 입수"], type: "number" },
  { key: "barcode", header: "바코드", aliases: ["바코드", "barcode"], type: "text" },
  { key: "hsCode", header: "HS CODE", aliases: ["hscode", "hs코드", "hs 코드"], type: "text" },
  { key: "manufacturer", header: "제조사", aliases: ["제조사"], type: "text" },
  { key: "manufactureCountry", header: "제조국", aliases: ["제조국", "원산지"], type: "text" },
  { key: "storageLocation", header: "보관위치", aliases: ["보관위치", "보관 위치"], type: "text" },
  { key: "status", header: "상태", aliases: ["상태"], type: "text" },
  { key: "isActive", header: "사용여부", aliases: ["사용여부", "사용 여부"], type: "bool" },
  { key: "description", header: "설명", aliases: ["설명"], type: "text" },
  { key: "note", header: "비고", aliases: ["비고", "메모"], type: "text" },
  { key: "imageUrl", header: "이미지주소", aliases: ["이미지주소", "이미지url", "이미지"], type: "text" },
  { key: "sortOrder", header: "정렬순서", aliases: ["정렬순서", "정렬 순서", "순서"], type: "number" },
];

const FIELD_BY_KEY = Object.fromEntries(PRODUCT_FIELD_DEFS.map((d) => [d.key, d]));

function normalizeHeader(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/,/g, "");
}

function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (!norm) return;
    const def = PRODUCT_FIELD_DEFS.find((d) => d.aliases.some((a) => normalizeHeader(a) === norm));
    if (def) map[idx] = def.key;
  });
  return map;
}

const TRUE_WORDS = ["y", "예", "사용", "true", "1", "o", "사용함"];
const FALSE_WORDS = ["n", "아니오", "미사용", "false", "0", "x", "사용안함"];

/** 셀 원본값을 필드 타입에 맞게 변환합니다. 실패 시 {__error} 형태를 반환합니다. */
function coerceValue(raw, type) {
  if (raw === undefined || raw === null || raw === "") return "";
  if (type === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : { __error: "숫자로 인식할 수 없습니다." };
  }
  if (type === "bool") {
    const s = String(raw).trim().toLowerCase();
    if (TRUE_WORDS.includes(s)) return true;
    if (FALSE_WORDS.includes(s)) return false;
    return { __error: "Y/N 형식으로 입력해주세요." };
  }
  return String(raw).trim();
}

/**
 * 엑셀 파일을 읽어 { rows, errors, unmatchedHeaders }를 반환합니다.
 * - rows: 헤더 매칭 + 값 변환이 끝난 행 객체 배열 (한 행에 오류가 있어도 나머지 필드는 살아있음)
 * - errors: 행 번호/컬럼/사유가 담긴 오류 목록 (해당 값만 빈 값 처리되고 업로드 자체는 막지 않음)
 * - unmatchedHeaders: 어떤 필드에도 매칭되지 않은 엑셀 헤더 (참고용 안내 표시)
 */
export async function parseProductExcel(file) {
  const sheet = await readSheet(file);
  if (!sheet || sheet.length === 0) {
    return { rows: [], errors: [], unmatchedHeaders: [] };
  }
  const [headerRow, ...dataRows] = sheet;
  const headerMap = buildHeaderMap(headerRow);
  const unmatchedHeaders = headerRow.filter((h, idx) => h && headerMap[idx] === undefined);

  const rows = [];
  const errors = [];
  dataRows.forEach((rawRow, rIdx) => {
    if (!rawRow || rawRow.every((c) => c === null || c === undefined || c === "")) return;
    const obj = {};
    Object.entries(headerMap).forEach(([colIdx, key]) => {
      const def = FIELD_BY_KEY[key];
      const value = coerceValue(rawRow[Number(colIdx)], def.type);
      if (value && typeof value === "object" && value.__error) {
        errors.push({ row: rIdx + 2, column: def.header, reason: value.__error, value: rawRow[Number(colIdx)] });
        obj[key] = "";
      } else {
        obj[key] = value;
      }
    });
    rows.push({ ...obj, __rowNumber: rIdx + 2 });
  });

  return { rows, errors, unmatchedHeaders };
}

const TEMPLATE_COLUMNS = PRODUCT_FIELD_DEFS.map((d) => ({
  header: d.header,
  cell: (row) => row[d.key] ?? "",
  width: Math.max(10, d.header.length * 2),
}));

const TEMPLATE_SAMPLE_ROWS = [
  {
    productCode: "HC-CR-001",
    name: "수분 진정 크림",
    englishName: "Moisture Calming Cream",
    brand: "홍코스메틱",
    category: "스킨케어",
    division: "크림",
    capacity: "50ml",
    unit: "EA",
    currentStock: 500,
    safetyStock: 100,
    basePrice: 8000,
    consumerPrice: 25000,
    cost: 4000,
    wholesalePrice: 12000,
    price1000: 7500,
    price2000: 7000,
    moq: 500,
    boxQty: 100,
    barcode: "8801234567890",
    hsCode: "3304.99",
    manufacturer: "홍코스메틱",
    manufactureCountry: "대한민국",
    storageLocation: "A동 1열",
    status: "판매중",
    isActive: "Y",
    description: "예시 행입니다. 실제 데이터로 바꾸거나 이 행을 지우고 사용하세요.",
    note: "",
    imageUrl: "",
    sortOrder: 1,
  },
];

/** 업로드용 엑셀 양식(예시 행 + 전체 필드 헤더 포함)을 다운로드합니다. */
export async function downloadProductExcelTemplate() {
  await writeXlsxFile(TEMPLATE_SAMPLE_ROWS, { columns: TEMPLATE_COLUMNS }).toFile("제품_업로드양식.xlsx");
}

const EXPORT_COLUMNS = PRODUCT_FIELD_DEFS.map((d) => ({
  header: d.header,
  cell: (p) => (d.type === "bool" ? (p[d.key] === false ? "N" : "Y") : p[d.key] ?? ""),
  width: Math.max(10, d.header.length * 2),
}));

/** 현재 제품 목록을 엑셀 파일로 다운로드합니다. (전체 필드 포함) */
export async function downloadProductsExcel(products) {
  await writeXlsxFile(products, { columns: EXPORT_COLUMNS }).toFile("제품목록.xlsx");
}

/** 파싱 오류 객체를 사람이 읽기 쉬운 한글 문구로 바꿉니다. */
export function describeParseError(e) {
  return e.reason || "값을 인식할 수 없습니다.";
}

/**
 * 파싱된 행들을 기존 제품 목록과 매칭해 미리보기용 항목으로 변환합니다.
 * status: 'matched' | 'new' | 'error'
 */
export function matchProductRows(rows, products) {
  return rows.map((row) => {
    const name = (row.name || "").trim();
    const productCode = (row.productCode || "").trim();

    if (!name && !productCode) {
      return { rowIndex: row.__rowNumber, row, status: "error", reason: "제품명과 제품코드가 모두 비어있습니다.", include: false };
    }

    const matched =
      (productCode && products.find((p) => (p.productCode || "").trim() === productCode)) ||
      (name && products.find((p) => p.name === name));

    if (matched) {
      return { rowIndex: row.__rowNumber, row, status: "matched", product: matched, include: true };
    }

    if (!name) {
      return { rowIndex: row.__rowNumber, row, status: "error", reason: "매칭되는 제품이 없고 제품명도 없어 신규 등록할 수 없습니다.", include: false };
    }

    return { rowIndex: row.__rowNumber, row, status: "new", include: true };
  });
}

/** 엑셀 행에서 실제로 값이 채워진 필드만 골라 Supabase에 저장할 patch 객체를 만듭니다. */
export function buildProductPatch(row) {
  const patch = {};
  for (const def of PRODUCT_FIELD_DEFS) {
    const v = row[def.key];
    if (v === "" || v === undefined || v === null) continue;
    patch[def.key] = v;
  }
  return patch;
}
