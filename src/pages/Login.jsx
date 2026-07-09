import { useState } from "react";
import { LogIn } from "lucide-react";
import { signInWithPassword } from "../lib/auth";
import { Field, TextInput } from "../components/ui/Field";
import { Button } from "../components/ui/Basics";

function describeError(error) {
  if (!error) return "";
  if (error.message === "Invalid login credentials") {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  return error.message || "로그인 중 오류가 발생했습니다.";
}

export default function Login({ settings }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      await signInWithPassword(email.trim(), password);
      // 로그인 성공 시 App.jsx의 onAuthStateChange 구독이 감지해 화면을 전환합니다.
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-porcelain px-4">
      <div className="w-full max-w-sm bg-white border border-line rounded-card shadow-card p-8">
        <div className="text-center mb-7">
          {settings?.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.companyName}
              className="w-12 h-12 rounded-full object-cover mx-auto mb-3"
            />
          ) : (
            <span
              className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: "var(--brand-secondary)" }} />
            </span>
          )}
          <h1 className="font-display text-lg font-semibold text-ink">
            {settings?.appNameKo || "영업관리 프로그램"}
          </h1>
          <p className="text-xs text-subink mt-1">{settings?.appNameEn || ""}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="이메일" required>
            <TextInput
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </Field>
          <Field label="비밀번호" required>
            <TextInput
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {error && <p className="text-sm text-clay-600">{error}</p>}

          <Button type="submit" className="w-full justify-center" disabled={loading}>
            <LogIn size={15} />
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>
      </div>
    </div>
  );
}
