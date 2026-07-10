/**
 * productCountryPrices.js
 * ------------------------------------------------------------------
 * 제품별 국가별 가격관리 CRUD.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

const COLUMNS = "id, product_id, country, price, currency, moq, created_at, updated_at";

export async function fetchProductCountryPrices(productId) {
  const { data, error } = await supabase
    .from("product_country_prices")
    .select(COLUMNS)
    .eq("product_id", productId)
    .order("country", { ascending: true });
  if (error) {
    console.error("[productCountryPrices] 조회 실패", error);
    return [];
  }
  return data || [];
}

export async function upsertProductCountryPrice(productId, patch) {
  const { data, error } = await supabase
    .from("product_country_prices")
    .upsert({ product_id: productId, ...patch }, { onConflict: "product_id,country" })
    .select(COLUMNS)
    .single();
  if (error) {
    console.error("[productCountryPrices] 저장 실패", error);
    throw error;
  }
  return data;
}

export async function deleteProductCountryPrice(id) {
  const { error } = await supabase.from("product_country_prices").delete().eq("id", id);
  if (error) {
    console.error("[productCountryPrices] 삭제 실패", error);
    throw error;
  }
}
