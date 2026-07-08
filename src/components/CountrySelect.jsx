import { useEffect, useMemo, useState } from "react";
import { customCountriesDB, saveCustomCountryIfNew } from "../lib/db";
import { COUNTRIES } from "../lib/constants";
import { TextInput } from "./ui/Field";

const BUILT_IN = COUNTRIES.filter((c) => c !== "기타");

/**
 * 국가 선택 컴포넌트.
 * - 기본 국가 목록에서 드롭다운으로 선택할 수 있습니다.
 * - "기타"를 선택하면 직접 입력란이 나타납니다.
 * - 직접 입력한 국가는 저장 시 목록에 추가되어, 다음 거래처 등록부터는
 *   드롭다운에서 바로 선택할 수 있습니다.
 */
export default function CountrySelect({ value, onChange }) {
  const [customCountries, setCustomCountries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    customCountriesDB.list().then((rows) => {
      setCustomCountries(rows.map((r) => r.name));
      setLoaded(true);
    });
  }, []);

  const options = useMemo(() => {
    const extra = customCountries.filter((c) => !BUILT_IN.includes(c));
    return [...BUILT_IN, ...extra, "기타"];
  }, [customCountries]);

  const knownList = useMemo(() => options.filter((c) => c !== "기타"), [options]);

  // 값이 로드된 뒤, 기존에 저장된 값이 알려진 목록에 없으면(예: 방금
  // 저장되기 전의 커스텀 값) 직접입력 모드로 전환합니다.
  useEffect(() => {
    if (loaded && value && !knownList.includes(value)) {
      setCustomMode(true);
    }
  }, [loaded, value, knownList]);

  const handleSelectChange = (e) => {
    const v = e.target.value;
    if (v === "기타") {
      setCustomMode(true);
      onChange("");
    } else {
      setCustomMode(false);
      onChange(v);
    }
  };

  const handleCustomTextChange = (e) => {
    onChange(e.target.value);
  };

  const handleCustomBlur = async () => {
    if (!value?.trim()) return;
    await saveCustomCountryIfNew(value.trim(), knownList);
    const rows = await customCountriesDB.list();
    setCustomCountries(rows.map((r) => r.name));
  };

  const selectValue = customMode ? "기타" : value || "";

  return (
    <div className="space-y-2">
      <select
        value={selectValue}
        onChange={handleSelectChange}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15"
      >
        <option value="">국가 선택</option>
        {options.map((c) => (
          <option key={c} value={c}>
            {c === "기타" ? "기타 (직접 입력)" : c}
          </option>
        ))}
      </select>

      {customMode && (
        <TextInput
          autoFocus
          value={value || ""}
          onChange={handleCustomTextChange}
          onBlur={handleCustomBlur}
          placeholder="국가명을 직접 입력하세요"
        />
      )}
    </div>
  );
}
