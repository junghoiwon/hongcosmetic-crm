import { useState } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import {
  parseProductExcel,
  matchProductRows,
  downloadProductExcelTemplate,
  describeParseError,
  buildProductPatch,
} from "../lib/productExcel";
import { productsDB, logActivity } from "../lib/db";
import Modal from "./ui/Modal";
import Badge from "./ui/Badge";
import { Button } from "./ui/Basics";

const STATUS_LABEL = { matched: "매칭됨", new: "신규", error: "오류" };
const STATUS_COLOR = {
  matched: "bg-jade-50 text-jade-600",
  new: "bg-gold-400/15 text-gold-500",
  error: "bg-clay-50 text-clay-600",
};

export default function ProductExcelUploadModal({ open, onClose, products, canCreate, actor, onApplied }) {
  const [step, setStep] = useState("select");
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [unmatchedHeaders, setUnmatchedHeaders] = useState([]);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [rowResults, setRowResults] = useState([]);

  const reset = () => {
    setStep("select");
    setFileName("");
    setPreviewRows([]);
    setParseErrors([]);
    setUnmatchedHeaders([]);
    setResult(null);
    setRowResults([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    const { rows, errors, unmatchedHeaders: unmatched } = await parseProductExcel(file);
    setParseErrors(errors || []);
    setUnmatchedHeaders(unmatched || []);
    const matched = matchProductRows(rows, products).map((r) =>
      r.status === "new" && !canCreate ? { ...r, include: false } : r
    );
    setPreviewRows(matched);
    setStep("preview");
  };

  const toggleInclude = (rowIndex) => {
    setPreviewRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, include: !r.include } : r))
    );
  };

  const apply = async () => {
    setApplying(true);
    let matchedCount = 0;
    let createdCount = 0;
    let failCount = 0;
    const results = [];

    for (const item of previewRows) {
      if (item.status === "error" || !item.include) continue;
      try {
        if (item.status === "matched") {
          const patch = buildProductPatch(item.row);
          if (Object.keys(patch).length > 0) {
            await productsDB.update(item.product.id, patch);
          }
          matchedCount += 1;
          results.push({ rowIndex: item.rowIndex, ok: true, message: `${item.product.name} 정보 반영` });
        } else if (item.status === "new" && canCreate) {
          const patch = buildProductPatch(item.row);
          await productsDB.create({ name: item.row.name, productCode: item.row.productCode || "", ...patch });
          createdCount += 1;
          results.push({ rowIndex: item.rowIndex, ok: true, message: `${item.row.name} 신규 등록` });
        }
      } catch (err) {
        failCount += 1;
        results.push({
          rowIndex: item.rowIndex,
          ok: false,
          message: `${item.row.name || item.row.productCode || "행"}: ${err.message || "저장 실패"}`,
        });
      }
    }

    await logActivity({
      actor: actor || "사용자",
      action: "제품 엑셀 업로드",
      summary: `${fileName} 업로드로 ${matchedCount}건 정보 반영, ${createdCount}건 신규 등록${failCount ? `, ${failCount}건 실패` : ""}`,
    });

    setResult({ matchedCount, createdCount, failCount, total: previewRows.length });
    setRowResults(results);
    setApplying(false);
    setStep("result");
    onApplied?.();
  };

  const matchedCount = previewRows.filter((r) => r.status === "matched").length;
  const newCount = previewRows.filter((r) => r.status === "new").length;
  const errorCount = previewRows.filter((r) => r.status === "error").length;

  return (
    <Modal open={open} onClose={handleClose} title="제품 엑셀 업로드" width="max-w-4xl">
      {step === "select" && (
        <div className="space-y-4">
          <p className="text-sm text-subink">
            제품코드, 제품명, 영문명, 브랜드, 카테고리, 구분, 용량규격, 단위, 현재고, 안전재고, 공급가, 소비자가,
            원가, 도매가, MOQ, 박스입수량, 바코드, 제조사, 제조국, 보관위치, 상태, 사용여부, 설명, 비고,
            이미지주소, 정렬순서 등 제품의 모든 항목이 저장됩니다.
            <br />
            헤더의 띄어쓰기·대소문자 차이는 자동으로 인식하며, 필요한 컬럼만 있어도 됩니다. 제품코드가 있으면
            코드로, 없으면 제품명으로 기존 제품과 매칭합니다.
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={downloadProductExcelTemplate}>
            <Download size={13} /> 엑셀 양식 다운로드
          </Button>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-card py-10 cursor-pointer hover:border-jade-500 hover:bg-porcelain/50">
            <FileSpreadsheet size={28} className="text-subink" />
            <span className="text-sm text-ink font-medium">엑셀 파일 선택 (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={handleClose}>
              취소
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-subink">
            <FileSpreadsheet size={15} /> {fileName}
          </div>

          {unmatchedHeaders.length > 0 && (
            <div className="flex items-start gap-2 bg-gold-400/10 border border-gold-400/30 text-gold-600 rounded-card px-3 py-2 text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-1">인식하지 못한 컬럼 (무시됩니다)</p>
                <p>{unmatchedHeaders.join(", ")}</p>
              </div>
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="flex items-start gap-2 bg-clay-50 border border-clay-100 text-clay-600 rounded-card px-3 py-2 text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-1">
                  일부 값의 형식이 올바르지 않아 해당 값만 비워두고 나머지는 그대로 진행합니다.
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {parseErrors.slice(0, 8).map((e, i) => (
                    <li key={i}>
                      {e.row}행 "{e.column}" 컬럼: {describeParseError(e)}
                      {e.value != null ? ` (입력값: ${e.value})` : ""}
                    </li>
                  ))}
                </ul>
                {parseErrors.length > 8 && <p className="mt-1">외 {parseErrors.length - 8}건 더 있습니다.</p>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs">
            <Badge className={STATUS_COLOR.matched}>매칭 {matchedCount}건</Badge>
            <Badge className={STATUS_COLOR.new}>신규 {newCount}건</Badge>
            <Badge className={STATUS_COLOR.error}>오류 {errorCount}건</Badge>
          </div>

          <div className="border border-line rounded-card overflow-auto max-h-96">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="sticky top-0 bg-porcelain text-subink text-xs">
                <tr>
                  <th className="text-left font-medium px-3 py-2">상태</th>
                  <th className="text-left font-medium px-3 py-2">제품명</th>
                  <th className="text-left font-medium px-3 py-2">제품코드</th>
                  <th className="text-right font-medium px-3 py-2">현재고</th>
                  <th className="text-left font-medium px-3 py-2">비고/사유</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((item) => (
                  <tr key={item.rowIndex} className="border-t border-line">
                    <td className="px-3 py-2">
                      <Badge className={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-ink">{item.row.name || "-"}</td>
                    <td className="px-3 py-2 text-subink">{item.row.productCode || "-"}</td>
                    <td className="px-3 py-2 text-right text-ink">
                      {item.status === "matched"
                        ? `${item.product.currentStock || 0} → ${
                            item.row.currentStock === "" || item.row.currentStock == null
                              ? item.product.currentStock || 0
                              : item.row.currentStock
                          }`
                        : item.row.currentStock ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-subink">
                      {item.status === "error" ? item.reason : item.row.note || "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.status === "new" && (
                        <input
                          type="checkbox"
                          checked={item.include && canCreate}
                          disabled={!canCreate}
                          onChange={() => toggleInclude(item.rowIndex)}
                          className="w-4 h-4 accent-jade-600"
                          title={!canCreate ? "신규 등록 권한이 없어 제외됩니다" : "신규 등록에 포함"}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={reset}>
              다른 파일 선택
            </Button>
            <Button type="button" onClick={apply} disabled={applying || previewRows.length === 0}>
              <Upload size={15} /> {applying ? "반영 중..." : "반영하기"}
            </Button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-5 py-4">
          <p className="font-display text-lg font-semibold text-ink text-center">업로드 반영 완료</p>
          <div className="flex justify-center gap-3 text-sm">
            <Badge className={STATUS_COLOR.matched}>정보 반영 {result.matchedCount}건</Badge>
            <Badge className={STATUS_COLOR.new}>신규 등록 {result.createdCount}건</Badge>
            {result.failCount > 0 && <Badge className={STATUS_COLOR.error}>실패 {result.failCount}건</Badge>}
          </div>
          {rowResults.some((r) => !r.ok) && (
            <div className="border border-line rounded-card overflow-auto max-h-56 text-xs">
              <ul className="divide-y divide-line">
                {rowResults
                  .filter((r) => !r.ok)
                  .map((r, i) => (
                    <li key={i} className="px-3 py-2 text-clay-600">
                      {r.rowIndex}행: {r.message}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div className="flex justify-center">
            <Button onClick={handleClose}>완료</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
