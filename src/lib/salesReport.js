/**
 * salesReport.js
 * ------------------------------------------------------------------
 * 판매 실적 리포트용 데이터 조합. 승인된 견적(quotations.status==='승인')을
 * 거래처/제품 정보와 합쳐 평평한 행 목록으로 만듭니다. 별도 테이블 없이
 * 기존 견적 데이터를 그대로 집계합니다.
 * ------------------------------------------------------------------
 */
import { clientsDB, productsDB, quotesDB } from "./db";

/** 승인된 견적을 거래처/제품 정보와 합쳐 반환합니다. */
export async function fetchSalesRows() {
  const [clients, products, quotes] = await Promise.all([clientsDB.list(), productsDB.list(), quotesDB.list()]);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  return quotes
    .filter((q) => q.status === "승인")
    .map((q) => {
      const client = clientMap[q.clientId];
      const product = productMap[q.productId];
      return {
        id: q.id,
        clientId: q.clientId,
        companyName: client?.companyName || "삭제된 거래처",
        country: client?.country || "미상",
        productId: q.productId,
        productName: product?.name || "삭제된 제품",
        quantity: q.quantity || 0,
        unitPrice: q.unitPrice || 0,
        totalAmount: q.totalAmount || 0,
        currency: q.currency || "KRW",
        quoteDate: q.quoteDate,
      };
    });
}
