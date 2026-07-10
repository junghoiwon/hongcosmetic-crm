/**
 * salesReport.js
 * ------------------------------------------------------------------
 * 판매 실적 리포트용 데이터 조합. 승인된 견적(quotations.status==='승인')의
 * 품목(quotation_items)을 거래처/제품 정보와 합쳐 평평한 행 목록으로
 * 만듭니다. 품목 테이블이 없는 과거(단일 품목) 견적서는 헤더 값으로부터
 * 품목 1건을 만들어 호환성을 유지합니다.
 * ------------------------------------------------------------------
 */
import { clientsDB, productsDB, quotesDB } from "./db";
import { fetchAllQuotationItems } from "./quotationItems";

/** 승인된 견적의 품목들을 거래처/제품 정보와 합쳐 반환합니다. */
export async function fetchSalesRows() {
  const [clients, products, quotes, itemsByQuotation] = await Promise.all([
    clientsDB.list(),
    productsDB.list(),
    quotesDB.list(),
    fetchAllQuotationItems(),
  ]);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const rows = [];
  for (const q of quotes.filter((q) => q.status === "승인")) {
    const client = clientMap[q.clientId];
    const realItems = itemsByQuotation[q.id];
    const lineItems =
      realItems && realItems.length > 0
        ? realItems
        : q.productId
        ? [
            {
              productId: q.productId,
              productName: productMap[q.productId]?.name || "삭제된 제품",
              quantity: q.quantity || 0,
              unitPrice: q.unitPrice || 0,
              supplyAmount: (q.quantity || 0) * (q.unitPrice || 0),
            },
          ]
        : [];

    for (const it of lineItems) {
      rows.push({
        id: `${q.id}_${it.id || it.productId || rows.length}`,
        quotationId: q.id,
        clientId: q.clientId,
        companyName: client?.companyName || "삭제된 거래처",
        country: client?.country || "미상",
        productId: it.productId,
        productName: it.productName || productMap[it.productId]?.name || "삭제된 제품",
        quantity: it.quantity || 0,
        unitPrice: it.unitPrice || 0,
        totalAmount: it.supplyAmount || 0,
        currency: q.currency || "KRW",
        quoteDate: q.quoteDate,
      });
    }
  }
  return rows;
}
