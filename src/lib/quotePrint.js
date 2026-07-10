/**
 * quotePrint.js
 * ------------------------------------------------------------------
 * 견적서를 새 창으로 열어 인쇄(또는 "PDF로 저장")할 수 있게 합니다.
 * 다중 품목을 모두 표에 나열합니다. 별도 라이브러리 없이 브라우저의
 * 인쇄 기능(Ctrl+P 대응, window.print)을 그대로 사용합니다.
 * ------------------------------------------------------------------
 */
import { formatMoney, formatDate } from "./utils";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function printQuotation({ quote, items, client, settings }) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) {
    alert("팝업이 차단되었습니다. 브라우저의 팝업 차단을 해제해주세요.");
    return;
  }

  const rows = items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(it.productName)}</td>
        <td>${escapeHtml(it.spec)}</td>
        <td class="num">${(it.quantity || 0).toLocaleString("ko-KR")}</td>
        <td class="num">${formatMoney(it.unitPrice, quote.currency)}</td>
        <td class="num">${it.discountRate ? it.discountRate + "%" : "-"}</td>
        <td class="num">${formatMoney(it.supplyAmount, quote.currency)}</td>
      </tr>`
    )
    .join("");

  const subtotal = items.reduce((s, it) => s + (it.supplyAmount || 0), 0);
  const vatAmount = quote.vatIncluded ? Math.round(subtotal * 0.1) : 0;
  const grandTotal = subtotal + vatAmount;

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" />
<title>견적서 - ${escapeHtml(client?.companyName || "")}</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; padding: 32px; color: #1f2937; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 13px; text-align: left; }
  th { background: #f3f4f6; }
  td.num, th.num { text-align: right; }
  .totals { margin-top: 12px; width: 320px; margin-left: auto; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { font-weight: 700; font-size: 15px; border-top: 1px solid #1f2937; margin-top: 4px; padding-top: 8px; }
  .memo { margin-top: 20px; font-size: 13px; white-space: pre-wrap; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(settings?.companyName || "견적서")}</h1>
  <div class="meta">
    거래처: ${escapeHtml(client?.companyName || "-")} &nbsp;|&nbsp;
    견적일: ${formatDate(quote.quoteDate)} &nbsp;|&nbsp;
    상태: ${escapeHtml(quote.status)}
  </div>
  <table>
    <thead>
      <tr><th>No</th><th>품목</th><th>규격</th><th class="num">수량</th><th class="num">단가</th><th class="num">할인</th><th class="num">공급가액</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>공급가액 합계</span><span>${formatMoney(subtotal, quote.currency)}</span></div>
    ${quote.vatIncluded ? `<div><span>부가세(10%)</span><span>${formatMoney(vatAmount, quote.currency)}</span></div>` : ""}
    <div class="grand"><span>총 합계</span><span>${formatMoney(grandTotal, quote.currency)}</span></div>
  </div>
  ${quote.memo ? `<div class="memo">메모: ${escapeHtml(quote.memo)}</div>` : ""}
  <script>window.onload = () => window.print();</script>
</body></html>`;

  win.document.write(html);
  win.document.close();
}
