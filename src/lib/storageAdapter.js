/**
 * storageAdapter.js
 * ------------------------------------------------------------------
 * 데이터 저장 방식을 한 곳에서 관리합니다.
 * 이 파일은 Supabase(Postgres)를 사용합니다. 상위 레이어(lib/db.js,
 * 각 페이지 컴포넌트)는 이 파일의 함수 이름/시그니처만 알면 되고,
 * 실제 저장소가 무엇인지는 몰라도 됩니다 — 그래서 나중에 다른
 * 백엔드로 바꾸더라도 이 파일만 수정하면 됩니다.
 *
 * 테이블 구조:
 *   각 테이블은 (id uuid, data jsonb, created_at, updated_at) 형태를
 *   따릅니다. 화면에서 쓰는 필드(companyName, contactName 등)는 모두
 *   data 컬럼 안에 그대로 들어가므로, 화면 쪽 코드를 바꿀 때마다
 *   DB 마이그레이션을 새로 만들 필요가 없습니다.
 *   실제 테이블 생성 SQL은 supabase/schema.sql 을 참고하세요.
 * ------------------------------------------------------------------
 */
import { supabase } from "./supabaseClient";

// 앱 내부에서 쓰는 테이블 키 → 실제 Supabase 테이블명 매핑
const TABLE_NAME = {
  clients: "customers",
  products: "products",
  quotes: "quotations",
  samples: "samples",
  consultations: "consultations",
  customCountries: "custom_countries",
  settings: "settings",
  activityLogs: "update_logs",
  users: "users",
};

function resolveTableName(table) {
  return TABLE_NAME[table] || table;
}

function rowToRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    ...row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 지정한 테이블(예: clients, products)의 모든 행을 가져옵니다. */
export async function listAll(table) {
  const { data, error } = await supabase
    .from(resolveTableName(table))
    .select("id, data, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`[storageAdapter] ${table} 목록 조회 실패`, error);
    return [];
  }
  return (data || []).map(rowToRecord);
}

/** id로 단일 행을 가져옵니다. */
export async function getById(table, id) {
  const { data, error } = await supabase
    .from(resolveTableName(table))
    .select("id, data, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(`[storageAdapter] ${table} 단건 조회 실패`, error);
    return null;
  }
  return rowToRecord(data);
}

/** 새 행을 생성합니다. id, createdAt, updatedAt은 자동 부여됩니다. */
export async function create(table, payload) {
  const { id: _ignoredId, createdAt: _ca, updatedAt: _ua, ...rest } = payload || {};
  const { data, error } = await supabase
    .from(resolveTableName(table))
    .insert({ data: rest })
    .select("id, data, created_at, updated_at")
    .single();

  if (error) {
    console.error(`[storageAdapter] ${table} 생성 실패`, error);
    throw error;
  }
  return rowToRecord(data);
}

/** 기존 행을 수정합니다. */
export async function update(table, id, patch) {
  const current = await getById(table, id);
  if (!current) throw new Error(`${table}에서 id=${id} 를 찾을 수 없습니다.`);

  const { id: _ignoredId, createdAt: _ca, updatedAt: _ua, ...currentFields } = current;
  const { id: _pid, createdAt: _pca, updatedAt: _pua, ...patchFields } = patch || {};
  const mergedData = { ...currentFields, ...patchFields };

  const { data, error } = await supabase
    .from(resolveTableName(table))
    .update({ data: mergedData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, data, created_at, updated_at")
    .single();

  if (error) {
    console.error(`[storageAdapter] ${table} 수정 실패`, error);
    throw error;
  }
  return rowToRecord(data);
}

/** 행을 삭제합니다. */
export async function remove(table, id) {
  const { error } = await supabase.from(resolveTableName(table)).delete().eq("id", id);
  if (error) {
    console.error(`[storageAdapter] ${table} 삭제 실패`, error);
    throw error;
  }
  return true;
}

/** 최초 실행 시 샘플 데이터를 넣어줄 때 사용 (이미 데이터가 있으면 무시). */
export async function seedIfEmpty(table, seedRows) {
  const existing = await listAll(table);
  if (existing.length > 0 || !seedRows?.length) return existing;

  const inserts = seedRows.map(({ id: _id, createdAt: _ca, updatedAt: _ua, ...rest }) => ({ data: rest }));
  const { data, error } = await supabase
    .from(resolveTableName(table))
    .insert(inserts)
    .select("id, data, created_at, updated_at");

  if (error) {
    console.error(`[storageAdapter] ${table} 시드 데이터 생성 실패`, error);
    return [];
  }
  return (data || []).map(rowToRecord);
}
