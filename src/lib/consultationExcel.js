/**
 * consultationExcel.js
 * ------------------------------------------------------------------
 * 상담·미팅일지 목록을 엑셀로 다운로드합니다.
 * ------------------------------------------------------------------
 */
import writeXlsxFile from "write-excel-file/browser";
import { formatDate } from "./utils";

const COLUMNS = [
  { header: "날짜", cell: (r) => formatDate(r.date), width: 12 },
  { header: "시간", cell: (r) => r.time || "", width: 8 },
  { header: "거래처", cell: (r) => r.clientName || "", width: 18 },
  { header: "담당자(거래처)", cell: (r) => r.contactName || "", width: 14 },
  { header: "구분", cell: (r) => r.category || "", width: 8 },
  { header: "연락방법", cell: (r) => r.contactMethod || "", width: 10 },
  { header: "제목", cell: (r) => r.title || "", width: 24 },
  { header: "내용", cell: (r) => r.content || "", width: 40 },
  { header: "우리측 담당자", cell: (r) => r.ourRep || "", width: 12 },
  { header: "후속조치 내용", cell: (r) => r.followUpAction || "", width: 24 },
  { header: "후속 연락일", cell: (r) => formatDate(r.nextContactDate), width: 12 },
  { header: "상태", cell: (r) => r.status || "", width: 12 },
  { header: "중요도", cell: (r) => r.importance || "", width: 8 },
  { header: "작성자", cell: (r) => r.author || "", width: 10 },
];

export async function downloadConsultationsExcel(rows) {
  await writeXlsxFile(rows, { columns: COLUMNS }).toFile("상담_미팅일지.xlsx");
}
