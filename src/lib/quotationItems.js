/**
 * quotationItems.js
 * ------------------------------------------------------------------
 * 견적서 품목(quotation_items) CRUD. 견적서 기본정보(quotations)는 여전히
 * lib/db.js의 quotesDB가 담당하고, 이 파일은 품목 라인만 다룹니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS =
  "id, quotation_id, product_id, product_name, spec, quantity, unit_price, discount_rate, discount_amount, supply_amount, memo, sort_order, created_at";

function rowToItem(row) {
  return {
    id: row.id,
    quotationId: row.quotation_id,
    productId: row.product_id,
    productName: row.product_name,
    spec: row.spec,
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(row.unit_price) || 0,
    discountRate: Number(row.discount_rate) || 0,
    discountAmount: Number(row.discount_amount) || 0,
    supplyAmount: Number(row.supply_amount) || 0,
    memo: row.memo || "",
    sortOrder: row.sort_order,
  };
}

/** 모든 견적서의 품목을 한 번에 가져와 quotation_id별로 묶어 반환합니다. */
export async function fetchAllQuotationItems() {
  const { data, error } = await supabase
    .from("quotation_items")
    .select(COLUMNS)
    .order("quotation_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[quotationItems] 전체 조회 실패", error);
    return {};
  }
  const byQuotation = {};
  for (const row of data || []) {
    const item = rowToItem(row);
    if (!byQuotation[item.quotationId]) byQuotation[item.quotationId] = [];
    byQuotation[item.quotationId].push(item);
  }
  return byQuotation;
}

export async function fetchItemsForQuotation(quotationId) {
  const { data, error } = await supabase
    .from("quotation_items")
    .select(COLUMNS)
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[quotationItems] 조회 실패", error);
    return [];
  }
  return (data || []).map(rowToItem);
}

/**
 * 견적서의 품목 전체를 새 배열로 교체 저장합니다(삭제 후 재삽입).
 * 견적 작성/수정 화면에서 품목 목록 전체를 한 번에 편집하는 방식과 맞습니다.
 */
export async function replaceQuotationItems(quotationId, items) {
  const { error: delErr } = await supabase.from("quotation_items").delete().eq("quotation_id", quotationId);
  if (delErr) {
    console.error("[quotationItems] 기존 품목 삭제 실패", delErr);
    throw delErr;
  }
  if (!items || items.length === 0) return [];

  const rows = items.map((it, idx) => ({
    quotation_id: quotationId,
    product_id: it.productId || null,
    product_name: it.productName || "",
    spec: it.spec || "",
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unitPrice) || 0,
    discount_rate: Number(it.discountRate) || 0,
    discount_amount: Number(it.discountAmount) || 0,
    supply_amount: Number(it.supplyAmount) || 0,
    memo: it.memo || "",
    sort_order: idx,
  }));

  const { data, error } = await supabase.from("quotation_items").insert(rows).select(COLUMNS);
  if (error) {
    console.error("[quotationItems] 품목 저장 실패", error);
    throw error;
  }
  return (data || []).map(rowToItem);
}

export async function deleteItemsForQuotation(quotationId) {
  const { error } = await supabase.from("quotation_items").delete().eq("quotation_id", quotationId);
  if (error) {
    console.error("[quotationItems] 품목 삭제 실패", error);
    throw error;
  }
}
