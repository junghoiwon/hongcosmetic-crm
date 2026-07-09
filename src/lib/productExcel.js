/**
 * productExcel.js
 * ------------------------------------------------------------------
 * 제품 재고 엑셀 업로드 파싱/매칭 로직.
 * 엑셀 컬럼: 제품명, 제품코드, 현재고, 입고수량, 출고수량, 비고
 * - 제품코드가 있으면 코드로, 없으면 제품명으로 기존 제품과 매칭합니다.
 * - "현재고" 값은 매칭된 제품의 재고를 덮어씁니다(절대값). 입고/출고수량은
 *   참고용으로만 기록되고 재고 계산에는 사용하지 않습니다.
 * ------------------------------------------------------------------
 */
import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";

// 스키마의 키는 결과 객체의 속성명이고, 각 항목의 column이 엑셀 헤더 텍스트입니다.
// required:false로 두어, 값 하나가 비어있거나 형식이 안 맞아도 전체 업로드가
// 통째로 실패하지 않도록 합니다 (이 라이브러리는 기본적으로 오류가 하나라도
// 있으면 전체 결과를 반환하지 않는 all-or-nothing 방식입니다).
const SCHEMA = {
  productName: { column: "제품명", type: String, required: false },
  productCode: { column: "제품코드", type: String, required: false },
  currentStock: { column: "현재고", type: Number, required: false },
  inQty: { column: "입고수량", type: Number, required: false },
  outQty: { column: "출고수량", type: Number, required: false },
  note: { column: "비고", type: String, required: false },
};

/** 엑셀 파일을 읽어 원본 행 배열로 반환합니다. */
export async function parseProductExcel(file) {
  const result = await readSheet(file, { schema: SCHEMA });
  if (result.errors) {
    return { rows: [], errors: result.errors };
  }
  return { rows: result.objects || [], errors: [] };
}

const TEMPLATE_COLUMNS = [
  { header: "제품명", cell: (row) => row.productName, width: 22 },
  { header: "제품코드", cell: (row) => row.productCode, width: 16 },
  { header: "현재고", cell: (row) => row.currentStock, width: 10 },
  { header: "입고수량", cell: (row) => row.inQty, width: 10 },
  { header: "출고수량", cell: (row) => row.outQty, width: 10 },
  { header: "비고", cell: (row) => row.note, width: 30 },
];

const TEMPLATE_SAMPLE_ROWS = [
  {
    productName: "수분 진정 크림",
    productCode: "HC-CR-001",
    currentStock: 500,
    inQty: 100,
    outQty: 20,
    note: "예시 행입니다. 실제 데이터로 바꾸거나 이 행을 지우고 사용하세요.",
  },
];

/** 업로드용 엑셀 양식(예시 행 포함)을 다운로드합니다. */
export async function downloadProductExcelTemplate() {
  await writeXlsxFile(TEMPLATE_SAMPLE_ROWS, { columns: TEMPLATE_COLUMNS }).toFile("제품재고_업로드양식.xlsx");
}

/** 파싱 오류 객체를 사람이 읽기 쉬운 한글 문구로 바꿉니다. */
export function describeParseError(e) {
  if (e.error === "required") return "값이 비어 있습니다.";
  if (e.reason === "not_a_number" || e.error === "not_a_number") return "숫자로 인식할 수 없습니다.";
  if (e.error === "not_a_string") return "텍스트로 인식할 수 없습니다.";
  return e.reason ? `${e.error} (${e.reason})` : e.error;
}

/**
 * 파싱된 행들을 기존 제품 목록과 매칭해 미리보기용 항목으로 변환합니다.
 * status: 'matched' | 'new' | 'error'
 */
export function matchProductRows(rows, products) {
  return rows.map((row, index) => {
    const productName = (row.productName || "").trim();
    const productCode = (row.productCode || "").trim();

    if (!productName && !productCode) {
      return { rowIndex: index, row, status: "error", reason: "제품명과 제품코드가 모두 비어있습니다." };
    }

    const matched =
      (productCode && products.find((p) => (p.productCode || "").trim() === productCode)) ||
      (productName && products.find((p) => p.name === productName));

    if (matched) {
      return { rowIndex: index, row, status: "matched", product: matched, include: true };
    }

    if (!productName) {
      return { rowIndex: index, row, status: "error", reason: "매칭되는 제품이 없고 제품명도 없어 신규 등록할 수 없습니다." };
    }

    return { rowIndex: index, row, status: "new", include: true };
  });
}
