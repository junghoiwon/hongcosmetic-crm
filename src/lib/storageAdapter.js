/**
 * storageAdapter.js
 * ------------------------------------------------------------------
 * 데이터 저장 방식을 한 곳에서 관리합니다.
 * 지금은 브라우저 localStorage를 사용하지만, 모든 함수가 Promise를
 * 반환하도록 설계되어 있어 나중에 Supabase / Firebase 등의 실제
 * 데이터베이스로 교체할 때 이 파일만 수정하면 됩니다.
 *
 * 교체 예시:
 *   Supabase → supabase.from(table).select() 등으로 함수 내부만 변경
 *   Firebase → getDocs(collection(db, table)) 등으로 함수 내부만 변경
 * 상위 레이어(lib/db.js, 각 페이지 컴포넌트)는 전혀 수정할 필요가 없습니다.
 * ------------------------------------------------------------------
 */

const NAMESPACE = "cosmo_crm_v1";

function readTable(table) {
  try {
    const raw = localStorage.getItem(`${NAMESPACE}:${table}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`[storageAdapter] ${table} 읽기 실패`, e);
    return [];
  }
}

function writeTable(table, rows) {
  localStorage.setItem(`${NAMESPACE}:${table}`, JSON.stringify(rows));
}

function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** 지정한 테이블(예: clients, products)의 모든 행을 가져옵니다. */
export async function listAll(table) {
  return readTable(table);
}

/** id로 단일 행을 가져옵니다. */
export async function getById(table, id) {
  return readTable(table).find((row) => row.id === id) || null;
}

/** 새 행을 생성합니다. id, createdAt, updatedAt은 자동 부여됩니다. */
export async function create(table, data) {
  const rows = readTable(table);
  const now = new Date().toISOString();
  const row = { id: generateId(), createdAt: now, updatedAt: now, ...data };
  rows.push(row);
  writeTable(table, rows);
  return row;
}

/** 기존 행을 수정합니다. */
export async function update(table, id, patch) {
  const rows = readTable(table);
  const idx = rows.findIndex((row) => row.id === id);
  if (idx === -1) throw new Error(`${table}에서 id=${id} 를 찾을 수 없습니다.`);
  rows[idx] = { ...rows[idx], ...patch, updatedAt: new Date().toISOString() };
  writeTable(table, rows);
  return rows[idx];
}

/** 행을 삭제합니다. */
export async function remove(table, id) {
  const rows = readTable(table);
  const next = rows.filter((row) => row.id !== id);
  writeTable(table, next);
  return true;
}

/** 최초 실행 시 샘플 데이터를 넣어줄 때 사용 (이미 데이터가 있으면 무시). */
export async function seedIfEmpty(table, seedRows) {
  const rows = readTable(table);
  if (rows.length === 0 && seedRows?.length) {
    writeTable(table, seedRows);
    return seedRows;
  }
  return rows;
}
