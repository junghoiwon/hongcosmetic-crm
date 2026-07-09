import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, UserRoundCog, Search, Ban, CheckCircle2 } from "lucide-react";
import {
  fetchAllProfiles,
  fetchAppMenus,
  fetchMenuPermissionsForUser,
  saveMenuPermissions,
  updateProfile,
  createUserAccount,
  deleteUserAccount,
} from "../lib/adminUsers";
import { logActivity } from "../lib/db";
import { ROLES, ROLE_LABELS } from "../lib/session";
import Modal from "../components/ui/Modal";
import { Field, TextInput, Select } from "../components/ui/Field";
import { Button, EmptyState, ConfirmDialog } from "../components/ui/Basics";
import Badge from "../components/ui/Badge";

const EMPTY_CREATE = { email: "", password: "", name: "", department: "", position: "", role: "viewer" };
const ACTIONS = [
  ["can_view", "보기"],
  ["can_create", "등록"],
  ["can_edit", "수정"],
  ["can_delete", "삭제"],
];
const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
const ACTIVE_OPTIONS = [
  { value: "true", label: "사용" },
  { value: "false", label: "비활성화" },
];

function emptyMatrixRow(menuKey) {
  return { menu_key: menuKey, can_view: false, can_create: false, can_edit: false, can_delete: false };
}

export default function Users({ session }) {
  const [users, setUsers] = useState([]);
  const [appMenus, setAppMenus] = useState([]);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [matrix, setMatrix] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    fetchAllProfiles().then(setUsers);
    fetchAppMenus().then(setAppMenus);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.department, u.position].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [users, search]);

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE);
    setCreateError("");
    setCreateOpen(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    setSaving(true);
    try {
      await createUserAccount(createForm);
      await logActivity({
        actor: session?.name || "관리자",
        action: "사용자 등록",
        summary: `${createForm.email} 계정이 등록되었습니다.`,
      });
      setCreateOpen(false);
      load();
    } catch (err) {
      setCreateError(err.message || "계정 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (user) => {
    setEditing(user);
    setEditForm({
      name: user.name || "",
      department: user.department || "",
      position: user.position || "",
      role: user.role || "viewer",
      is_active: user.is_active,
    });
    const rows = await fetchMenuPermissionsForUser(user.user_id);
    const byKey = Object.fromEntries(rows.map((r) => [r.menu_key, r]));
    const nextMatrix = {};
    for (const menu of appMenus) {
      nextMatrix[menu.menu_key] = byKey[menu.menu_key]
        ? { ...emptyMatrixRow(menu.menu_key), ...byKey[menu.menu_key] }
        : emptyMatrixRow(menu.menu_key);
    }
    setMatrix(nextMatrix);
  };

  const toggleMatrix = (menuKey, action) => {
    setMatrix((m) => ({
      ...m,
      [menuKey]: { ...m[menuKey], [action]: !m[menuKey]?.[action] },
    }));
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(editing.id, editForm);
      if (editForm.role !== "admin") {
        await saveMenuPermissions(editing.user_id, Object.values(matrix));
      }
      await logActivity({
        actor: session?.name || "관리자",
        action: "사용자 정보 수정",
        summary: `${editForm.name || editing.email} 계정 정보가 수정되었습니다.`,
      });
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user) => {
    await updateProfile(user.id, { is_active: !user.is_active });
    await logActivity({
      actor: session?.name || "관리자",
      action: user.is_active ? "사용자 비활성화" : "사용자 활성화",
      summary: `${user.name || user.email} 계정이 ${user.is_active ? "비활성화" : "활성화"}되었습니다.`,
    });
    load();
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    await deleteUserAccount(target.user_id);
    await logActivity({
      actor: session?.name || "관리자",
      action: "사용자 삭제",
      summary: `${target.name || target.email} 계정이 삭제되었습니다.`,
    });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">사용자관리</h1>
          <p className="text-sm text-subink mt-1">직원 계정과 메뉴별 접근 권한을 관리합니다. (관리자 전용)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> 사용자 등록
        </Button>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subink" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 이메일, 부서로 검색"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-white text-sm outline-none focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15"
        />
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState
          title={users.length === 0 ? "등록된 사용자가 없습니다" : "검색 결과가 없습니다"}
          description={users.length === 0 ? "첫 직원 계정을 등록해보세요." : "다른 검색어를 시도해보세요."}
          action={
            users.length === 0 && (
              <Button onClick={openCreate}>
                <Plus size={16} /> 사용자 등록
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-white border border-line rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="bg-porcelain text-subink text-xs">
                <th className="text-left font-medium px-4 py-3">이름</th>
                <th className="text-left font-medium px-4 py-3">이메일</th>
                <th className="text-left font-medium px-4 py-3">부서</th>
                <th className="text-left font-medium px-4 py-3">직급</th>
                <th className="text-left font-medium px-4 py-3">역할</th>
                <th className="text-left font-medium px-4 py-3">사용 여부</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSelf = u.user_id === session?.userId;
                return (
                  <tr key={u.id} className="border-t border-line hover:bg-porcelain/60">
                    <td className="px-4 py-3 font-medium text-ink flex items-center gap-2">
                      <UserRoundCog size={14} className="text-jade-500 shrink-0" />
                      {u.name || "-"}
                      {isSelf && <span className="text-[11px] text-subink">(나)</span>}
                    </td>
                    <td className="px-4 py-3 text-subink">{u.email}</td>
                    <td className="px-4 py-3 text-subink">{u.department || "-"}</td>
                    <td className="px-4 py-3 text-subink">{u.position || "-"}</td>
                    <td className="px-4 py-3 text-ink">{ROLE_LABELS[u.role] || u.role}</td>
                    <td className="px-4 py-3">
                      <Badge className={u.is_active ? "bg-jade-50 text-jade-600" : "bg-clay-50 text-clay-600"}>
                        {u.is_active ? "사용" : "비활성화"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-md text-subink hover:bg-white hover:text-jade-600"
                          title="수정"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => !isSelf && toggleActive(u)}
                          disabled={isSelf}
                          className="p-1.5 rounded-md text-subink hover:bg-white hover:text-gold-500 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={u.is_active ? "비활성화" : "활성화"}
                        >
                          {u.is_active ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                        <button
                          onClick={() => !isSelf && setDeleteTarget(u)}
                          disabled={isSelf}
                          className="p-1.5 rounded-md text-subink hover:bg-white hover:text-clay-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 사용자 등록 */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="새 사용자 등록"
        subtitle="로그인 계정을 즉시 생성합니다."
      >
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="이메일" required className="col-span-2">
              <TextInput
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="user@company.com"
              />
            </Field>
            <Field label="초기 비밀번호" required className="col-span-2">
              <TextInput
                type="text"
                required
                minLength={6}
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="6자 이상"
              />
            </Field>
            <Field label="이름">
              <TextInput
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </Field>
            <Field label="역할">
              <Select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                options={ROLE_OPTIONS}
              />
            </Field>
            <Field label="부서">
              <TextInput
                value={createForm.department}
                onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
              />
            </Field>
            <Field label="직급">
              <TextInput
                value={createForm.position}
                onChange={(e) => setCreateForm({ ...createForm, position: e.target.value })}
              />
            </Field>
          </div>
          {createError && <p className="text-sm text-clay-600">{createError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "생성 중..." : "등록"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 사용자 수정 + 메뉴 권한 */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="사용자 정보 수정"
        subtitle={editing?.email}
        width="max-w-3xl"
      >
        {editForm && (
          <form onSubmit={submitEdit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="이름">
                <TextInput value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </Field>
              <Field label="역할">
                <Select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  options={ROLE_OPTIONS}
                />
              </Field>
              <Field label="부서">
                <TextInput
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                />
              </Field>
              <Field label="직급">
                <TextInput
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                />
              </Field>
              <Field label="사용 여부">
                <Select
                  value={editForm.is_active ? "true" : "false"}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === "true" })}
                  options={ACTIVE_OPTIONS}
                />
              </Field>
            </div>

            <div>
              <h3 className="font-display text-sm font-semibold text-ink mb-1">메뉴별 권한</h3>
              {editForm.role === "admin" ? (
                <p className="text-xs text-subink">관리자는 모든 메뉴에 항상 접근할 수 있습니다.</p>
              ) : (
                <div className="border border-line rounded-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-porcelain text-subink text-xs">
                        <th className="text-left font-medium px-3 py-2">메뉴</th>
                        {ACTIONS.map(([key, label]) => (
                          <th key={key} className="font-medium px-3 py-2 text-center w-16">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {appMenus.map((menu) => (
                        <tr key={menu.menu_key} className="border-t border-line">
                          <td className="px-3 py-2 text-ink">{menu.menu_name}</td>
                          {ACTIONS.map(([key]) => (
                            <td key={key} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(matrix[menu.menu_key]?.[key])}
                                onChange={() => toggleMatrix(menu.menu_key, key)}
                                className="w-4 h-4 accent-jade-600"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="사용자를 삭제할까요?"
        description={`"${deleteTarget?.name || deleteTarget?.email}" 계정이 완전히 삭제되며 복구할 수 없습니다. 되돌릴 수 있는 방법이 필요하면 삭제 대신 비활성화를 사용하세요.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
