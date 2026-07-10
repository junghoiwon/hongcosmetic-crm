export function Button({ variant = "primary", size = "md", className = "", style, ...props }) {
  const variants = {
    primary: "text-white",
    ghost: "bg-transparent text-ink hover:bg-porcelain border border-line",
    danger: "bg-transparent text-clay-600 hover:bg-clay-50 border border-clay-100",
    subtle: "bg-porcelain text-ink hover:bg-line/60",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };
  const primaryStyle =
    variant === "primary"
      ? { backgroundColor: "var(--brand-primary)", ...style }
      : style;
  return (
    <button
      {...props}
      style={primaryStyle}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[filter] hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    />
  );
}

export function StatCard({ label, value, icon: Icon, accent = "jade", onClick, sub }) {
  const accents = {
    jade: "bg-jade-50 text-jade-600",
    clay: "bg-clay-50 text-clay-600",
    gold: "bg-gold-400/15 text-gold-500",
  };
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white border border-line rounded-card p-5 shadow-card transition-transform ${
        onClick ? "hover:-translate-y-0.5 cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-subink">{label}</span>
        {Icon && (
          <span className={`p-2 rounded-lg ${accents[accent]}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <div className="font-display text-3xl font-semibold text-ink">{value}</div>
      {sub && <div className="text-xs text-subink mt-1">{sub}</div>}
    </button>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-line rounded-card bg-white/60">
      <p className="font-display text-base font-medium text-ink mb-1">{title}</p>
      {description && <p className="text-sm text-subink max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

export function ConfirmDialog({ open, title, description, onConfirm, onCancel, confirmLabel = "삭제" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-ink/30" onClick={onCancel} />
      <div className="relative bg-white rounded-card shadow-card border border-line max-w-sm w-full p-6">
        <h3 className="font-display font-semibold text-ink mb-1.5">{title}</h3>
        <p className="text-sm text-subink mb-5">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-line text-ink hover:bg-porcelain"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-clay-500 text-white hover:bg-clay-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 작업 완료(삭제/등록/수정 등) 후 잠깐 표시되는 알림. 부모가 message 상태를 setTimeout으로 비워주면 됩니다. */
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[70] bg-ink text-white text-sm px-4 py-2.5 rounded-lg shadow-card">
      {message}
    </div>
  );
}
