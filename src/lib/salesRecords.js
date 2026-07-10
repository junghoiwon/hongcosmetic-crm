/**
 * salesRecords.js
 * ------------------------------------------------------------------
 * 견적서와 별개로 직접 등록/수정/삭제할 수 있는 판매실적(sales_records +
 * sales_record_items) CRUD. 견적서에서 전환한 경우 source_quotation_id로
 * 원본을 참조만 하며, 판매실적을 삭제해도 원본 견적서는 삭제되지 않습니다.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const HEADER_COLUMNS =
  "id, client_id, contact_id, rep, sale_date, sale_type, order_number, payment_status, expected_payment_date, actual_payment_date, sales_channel, country, currency, exchange_rate, krw_amount, total_amount, memo, source_quotation_id, source_sample_id, created_by, created_at, updated_at";

const ITEM_COLUMNS = "id, sales_record_id, product_id, product_name, quantity, unit_price, discount_amount, supply_amount, sort_order";

function rowToRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    contactId: row.contact_id,
    rep: row.rep,
    saleDate: row.sale_date,
    saleType: row.sale_type,
    orderNumber: row.order_number,
    paymentStatus: row.payment_status,
    expectedPaymentDate: row.expected_payment_date,
    actualPaymentDate: row.actual_payment_date,
    salesChannel: row.sales_channel,
    country: row.country,
    currency: row.currency,
    exchangeRate: Number(row.exchange_rate) || 1,
    krwAmount: Number(row.krw_amount) || 0,
    totalAmount: Number(row.total_amount) || 0,
    memo: row.memo,
    sourceQuotationId: row.source_quotation_id,
    sourceSampleId: row.source_sample_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToRow(patch) {
  const map = {
    clientId: "client_id",
    contactId: "contact_id",
    rep: "rep",
    saleDate: "sale_date",
    saleType: "sale_type",
    orderNumber: "order_number",
    paymentStatus: "payment_status",
    expectedPaymentDate: "expected_payment_date",
    actualPaymentDate: "actual_payment_date",
    salesChannel: "sales_channel",
    country: "country",
    currency: "currency",
    exchangeRate: "exchange_rate",
    krwAmount: "krw_amount",
    totalAmount: "total_amount",
    memo: "memo",
    sourceQuotationId: "source_quotation_id",
    sourceSampleId: "source_sample_id",
    createdBy: "created_by",
  };
  const row = {};
  for (const [k, v] of Object.entries(patch)) {
    if (map[k]) row[map[k]] = v === "" ? null : v;
  }
  return row;
}

function rowToItem(row) {
  return {
    id: row.id,
    salesRecordId: row.sales_record_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(row.unit_price) || 0,
    discountAmount: Number(row.discount_amount) || 0,
    supplyAmount: Number(row.supply_amount) || 0,
    sortOrder: row.sort_order,
  };
}

export async function fetchSalesRecords() {
  const { data, error } = await supabase
    .from("sales_records")
    .select(HEADER_COLUMNS)
    .order("sale_date", { ascending: false });
  if (error) {
    console.error("[salesRecords] 조회 실패", error);
    return [];
  }
  return (data || []).map(rowToRecord);
}

export async function createSalesRecord(patch) {
  const { data, error } = await supabase
    .from("sales_records")
    .insert(recordToRow(patch))
    .select(HEADER_COLUMNS)
    .single();
  if (error) {
    console.error("[salesRecords] 등록 실패", error);
    throw error;
  }
  return rowToRecord(data);
}

export async function updateSalesRecord(id, patch) {
  const { data, error } = await supabase
    .from("sales_records")
    .update(recordToRow(patch))
    .eq("id", id)
    .select(HEADER_COLUMNS)
    .single();
  if (error) {
    console.error("[salesRecords] 수정 실패", error);
    throw error;
  }
  return rowToRecord(data);
}

export async function deleteSalesRecord(id) {
  const { error } = await supabase.from("sales_records").delete().eq("id", id);
  if (error) {
    console.error("[salesRecords] 삭제 실패", error);
    throw error;
  }
}

export async function fetchAllSalesRecordItems() {
  const { data, error } = await supabase
    .from("sales_record_items")
    .select(ITEM_COLUMNS)
    .order("sales_record_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[salesRecords] 품목 전체 조회 실패", error);
    return {};
  }
  const bySale = {};
  for (const row of data || []) {
    const item = rowToItem(row);
    if (!bySale[item.salesRecordId]) bySale[item.salesRecordId] = [];
    bySale[item.salesRecordId].push(item);
  }
  return bySale;
}

export async function replaceSalesRecordItems(salesRecordId, items) {
  const { error: delErr } = await supabase.from("sales_record_items").delete().eq("sales_record_id", salesRecordId);
  if (delErr) {
    console.error("[salesRecords] 기존 품목 삭제 실패", delErr);
    throw delErr;
  }
  if (!items || items.length === 0) return [];
  const rows = items.map((it, idx) => ({
    sales_record_id: salesRecordId,
    product_id: it.productId || null,
    product_name: it.productName || "",
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unitPrice) || 0,
    discount_amount: Number(it.discountAmount) || 0,
    supply_amount: Number(it.supplyAmount) || 0,
    sort_order: idx,
  }));
  const { data, error } = await supabase.from("sales_record_items").insert(rows).select(ITEM_COLUMNS);
  if (error) {
    console.error("[salesRecords] 품목 저장 실패", error);
    throw error;
  }
  return (data || []).map(rowToItem);
}
