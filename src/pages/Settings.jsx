import { useEffect, useRef, useState } from "react";
import { ShieldAlert, Upload, Image as ImageIcon } from "lucide-react";
import { getSettings, updateSettings, logActivity } from "../lib/db";
import { isAdmin } from "../lib/session";
import { Field, TextInput } from "../components/ui/Field";
import { Button } from "../components/ui/Basics";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Settings({ session, onSettingsChange }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);
  const mainBgImageInputRef = useRef(null);
  const sidebarBgImageInputRef = useRef(null);

  useEffect(() => {
    getSettings().then(setForm);
  }, []);

  if (!isAdmin(session)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <ShieldAlert size={32} className="mx-auto text-clay-500 mb-3" />
        <h1 className="font-display text-lg font-semibold text-ink mb-1.5">
          관리자만 접근할 수 있는 메뉴입니다
        </h1>
        <p className="text-sm text-subink">
          왼쪽 하단에서 사용자를 "관리자"로 전환하면 설정을 변경할 수 있습니다.
        </p>
      </div>
    );
  }

  if (!form) return null;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleImage = async (file, key) => {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    set({ [key]: dataUrl });
  };

  const save = async (e) => {
    e.preventDefault();
    await updateSettings(form);
    await logActivity({
      actor: session.name,
      action: "설정 변경",
      summary: "프로그램 설정이 변경되었습니다.",
    });
    onSettingsChange(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">설정</h1>
        <p className="text-sm text-subink mt-1">프로그램 브랜딩과 회사 정보를 관리합니다. (관리자 전용)</p>
      </div>

      <form onSubmit={save} className="space-y-8">
        {/* 브랜딩 */}
        <section className="bg-white border border-line rounded-card shadow-card p-5">
          <h2 className="font-display text-sm font-semibold text-ink mb-4">브랜딩</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="프로그램명 (한글)">
              <TextInput value={form.appNameKo} onChange={(e) => set({ appNameKo: e.target.value })} />
            </Field>
            <Field label="프로그램명 (영문)">
              <TextInput value={form.appNameEn} onChange={(e) => set({ appNameEn: e.target.value })} />
            </Field>
            <Field label="회사명" className="col-span-2">
              <TextInput value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="로고 이미지">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg border border-line bg-porcelain flex items-center justify-center overflow-hidden shrink-0">
                  {form.logoDataUrl ? (
                    <img src={form.logoDataUrl} alt="로고" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={18} className="text-subink" />
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImage(e.target.files?.[0], "logoDataUrl")}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => logoInputRef.current?.click()}>
                  <Upload size={13} /> 업로드
                </Button>
                {form.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => set({ logoDataUrl: "" })}
                    className="text-xs text-subink hover:text-clay-600"
                  >
                    제거
                  </button>
                )}
              </div>
            </Field>
            <Field label="파비콘">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg border border-line bg-porcelain flex items-center justify-center overflow-hidden shrink-0">
                  {form.faviconDataUrl ? (
                    <img src={form.faviconDataUrl} alt="파비콘" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={18} className="text-subink" />
                  )}
                </div>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImage(e.target.files?.[0], "faviconDataUrl")}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => faviconInputRef.current?.click()}>
                  <Upload size={13} /> 업로드
                </Button>
                {form.faviconDataUrl && (
                  <button
                    type="button"
                    onClick={() => set({ faviconDataUrl: "" })}
                    className="text-xs text-subink hover:text-clay-600"
                  >
                    제거
                  </button>
                )}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="메인 컬러">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.mainColor}
                  onChange={(e) => set({ mainColor: e.target.value })}
                  className="w-10 h-9 rounded-md border border-line cursor-pointer"
                />
                <TextInput value={form.mainColor} onChange={(e) => set({ mainColor: e.target.value })} />
              </div>
            </Field>
            <Field label="서브 컬러">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.subColor}
                  onChange={(e) => set({ subColor: e.target.value })}
                  className="w-10 h-9 rounded-md border border-line cursor-pointer"
                />
                <TextInput value={form.subColor} onChange={(e) => set({ subColor: e.target.value })} />
              </div>
            </Field>
          </div>
        </section>

        {/* 화면 배경 */}
        <section className="bg-white border border-line rounded-card shadow-card p-5">
          <h2 className="font-display text-sm font-semibold text-ink mb-1">화면 배경</h2>
          <p className="text-xs text-subink mb-4">
            메인 화면과 좌측 메뉴(사이드바)의 배경색/배경 이미지를 바꿀 수 있습니다. 비워두면 기본 배경을
            사용합니다.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="메인 화면 배경색">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.mainBgColor || "#FAF9F5"}
                  onChange={(e) => set({ mainBgColor: e.target.value })}
                  className="w-10 h-9 rounded-md border border-line cursor-pointer"
                />
                <TextInput
                  value={form.mainBgColor}
                  onChange={(e) => set({ mainBgColor: e.target.value })}
                  placeholder="기본값 사용"
                />
              </div>
            </Field>
            <Field label="사이드바 배경색">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.sidebarBgColor || "#FFFFFF"}
                  onChange={(e) => set({ sidebarBgColor: e.target.value })}
                  className="w-10 h-9 rounded-md border border-line cursor-pointer"
                />
                <TextInput
                  value={form.sidebarBgColor}
                  onChange={(e) => set({ sidebarBgColor: e.target.value })}
                  placeholder="기본값 사용"
                />
              </div>
            </Field>

            <Field label="메인 화면 배경 이미지">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg border border-line bg-porcelain flex items-center justify-center overflow-hidden shrink-0">
                  {form.mainBgImageUrl ? (
                    <img src={form.mainBgImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={18} className="text-subink" />
                  )}
                </div>
                <input
                  ref={mainBgImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImage(e.target.files?.[0], "mainBgImageUrl")}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => mainBgImageInputRef.current?.click()}>
                  <Upload size={13} /> 업로드
                </Button>
                {form.mainBgImageUrl && (
                  <button
                    type="button"
                    onClick={() => set({ mainBgImageUrl: "" })}
                    className="text-xs text-subink hover:text-clay-600"
                  >
                    제거
                  </button>
                )}
              </div>
            </Field>
            <Field label="사이드바 배경 이미지">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg border border-line bg-porcelain flex items-center justify-center overflow-hidden shrink-0">
                  {form.sidebarBgImageUrl ? (
                    <img src={form.sidebarBgImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={18} className="text-subink" />
                  )}
                </div>
                <input
                  ref={sidebarBgImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImage(e.target.files?.[0], "sidebarBgImageUrl")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => sidebarBgImageInputRef.current?.click()}
                >
                  <Upload size={13} /> 업로드
                </Button>
                {form.sidebarBgImageUrl && (
                  <button
                    type="button"
                    onClick={() => set({ sidebarBgImageUrl: "" })}
                    className="text-xs text-subink hover:text-clay-600"
                  >
                    제거
                  </button>
                )}
              </div>
            </Field>
            <Field label="사이드바 메뉴 글자색">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.sidebarMenuTextColor || "#6B665F"}
                  onChange={(e) => set({ sidebarMenuTextColor: e.target.value })}
                  className="w-10 h-9 rounded-md border border-line cursor-pointer"
                />
                <TextInput
                  value={form.sidebarMenuTextColor}
                  onChange={(e) => set({ sidebarMenuTextColor: e.target.value })}
                  placeholder="기본값 사용"
                />
              </div>
            </Field>
          </div>
        </section>

        {/* 회사 정보 */}
        <section className="bg-white border border-line rounded-card shadow-card p-5">
          <h2 className="font-display text-sm font-semibold text-ink mb-4">회사 정보</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="회사 주소" className="col-span-2">
              <TextInput value={form.companyAddress} onChange={(e) => set({ companyAddress: e.target.value })} />
            </Field>
            <Field label="전화번호">
              <TextInput value={form.companyPhone} onChange={(e) => set({ companyPhone: e.target.value })} />
            </Field>
            <Field label="이메일">
              <TextInput value={form.companyEmail} onChange={(e) => set({ companyEmail: e.target.value })} />
            </Field>
            <Field label="홈페이지" className="col-span-2">
              <TextInput value={form.companyWebsite} onChange={(e) => set({ companyWebsite: e.target.value })} />
            </Field>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit">저장</Button>
          {saved && <span className="text-sm text-jade-600">저장되었습니다.</span>}
        </div>
      </form>
    </div>
  );
}
