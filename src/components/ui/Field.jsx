export function Field({ label, required, hint, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-ink mb-1.5">
        {label}
        {required && <span className="text-clay-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-subink mt-1">{hint}</span>}
    </label>
  );
}

const baseInput =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-subink/60 outline-none transition-colors focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15";

export function TextInput(props) {
  return <input {...props} className={`${baseInput} ${props.className || ""}`} />;
}

export function NumberInput(props) {
  return (
    <input
      type="number"
      {...props}
      className={`${baseInput} ${props.className || ""}`}
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`${baseInput} resize-none ${props.className || ""}`}
    />
  );
}

export function Select({ options, placeholder, ...props }) {
  return (
    <select {...props} className={`${baseInput} ${props.className || ""}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
