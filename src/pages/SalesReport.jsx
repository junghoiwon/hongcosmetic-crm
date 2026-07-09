import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { fetchSalesRows } from "../lib/salesReport";
import { formatDate, formatMoney, formatNumber, PERIOD_OPTIONS, isWithinPeriod } from "../lib/utils";
import { Select } from "../components/ui/Field";
import { EmptyState } from "../components/ui/Basics";
import Badge from "../components/ui/Badge";

const GROUP_OPTIONS = [
  { value: "none", label: "상세 목록" },
  { value: "client", label: "거래처별 합계" },
  { value: "product", label: "품목별 합계" },
  { value: "country", label: "국가별 합계" },
];

const GROUP_KEY = {
  client: (r) => r.companyName,
  product: (r) => r.productName,
  country: (r) => r.country,
};

const GROUP_LABEL = {
  client: "거래처",
  product: "품목",
  country: "국가",
};

export default function SalesReport() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState("all");
  const [country, setCountry] = useState("");
  const [clientName, setClientName] = useState("");
  const [productName, setProductName] = useState("");
  const [groupBy, setGroupBy] = useState("none");

  useEffect(() => {
    fetchSalesRows()
      .then(setRows)
      .finally(() => setLoaded(true));
  }, []);

  const periodFiltered = useMemo(
    () => rows.filter((r) => isWithinPeriod(r.quoteDate, period)),
    [rows, period]
  );

  const countries = useMemo(
    () => [...new Set(periodFiltered.map((r) => r.country))].sort(),
    [periodFiltered]
  );
  const clientNames = useMemo(
    () => [...new Set(periodFiltered.map((r) => r.companyName))].sort(),
    [periodFiltered]
  );
  const productNames = useMemo(
    () => [...new Set(periodFiltered.map((r) => r.productName))].sort(),
    [periodFiltered]
  );

  const filtered = useMemo(
    () =>
      periodFiltered.filter(
        (r) =>
          (!country || r.country === country) &&
          (!clientName || r.companyName === clientName) &&
          (!productName || r.productName === productName)
      ),
    [periodFiltered, country, clientName, productName]
  );

  const grouped = useMemo(() => {
    if (groupBy === "none") return null;
    const keyFn = GROUP_KEY[groupBy];
    const map = {};
    for (const r of filtered) {
      const key = `${keyFn(r)}__${r.currency}`;
      if (!map[key]) {
        map[key] = { label: keyFn(r), currency: r.currency, quantity: 0, amount: 0, count: 0 };
      }
      map[key].quantity += r.quantity;
      map[key].amount += r.totalAmount;
      map[key].count += 1;
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [filtered, groupBy]);

  const totalsByCurrency = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      if (!map[r.currency]) map[r.currency] = { quantity: 0, amount: 0 };
      map[r.currency].quantity += r.quantity;
      map[r.currency].amount += r.totalAmount;
    }
    return Object.entries(map).map(([currency, v]) => ({ currency, ...v }));
  }, [filtered]);

  const detailRows = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.quoteDate) - new Date(a.quoteDate)),
    [filtered]
  );

  if (!loaded) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">판매 실적</h1>
        <p className="text-sm text-subink mt-1">
          승인된 견적을 기준으로 거래처/품목/국가별 판매수량과 금액을 집계합니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIOD_OPTIONS} className="!w-auto" />
        <Select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="국가 전체"
          options={countries}
          className="!w-auto"
        />
        <Select
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="거래처 전체"
          options={clientNames}
          className="!w-auto"
        />
        <Select
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="품목 전체"
          options={productNames}
          className="!w-auto"
        />
        <div className="ml-auto">
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} options={GROUP_OPTIONS} className="!w-auto" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="집계할 판매 실적이 없습니다"
          description='견적 상태가 "승인"인 건만 집계됩니다. 필터 조건을 바꿔보세요.'
        />
      ) : (
        <>
          <div className="bg-white border border-line rounded-card shadow-card overflow-x-auto mb-4">
            {groupBy === "none" ? (
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-porcelain text-subink text-xs">
                    <th className="text-left font-medium px-4 py-3">거래처</th>
                    <th className="text-left font-medium px-4 py-3">국가</th>
                    <th className="text-left font-medium px-4 py-3">품목</th>
                    <th className="text-right font-medium px-4 py-3">수량</th>
                    <th className="text-right font-medium px-4 py-3">판매가격(단가)</th>
                    <th className="text-right font-medium px-4 py-3">금액</th>
                    <th className="text-left font-medium px-4 py-3">견적일</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r) => (
                    <tr key={r.id} className="border-t border-line hover:bg-porcelain/60">
                      <td className="px-4 py-3 font-medium text-ink">{r.companyName}</td>
                      <td className="px-4 py-3 text-subink">{r.country}</td>
                      <td className="px-4 py-3 text-subink">{r.productName}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatNumber(r.quantity)}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatMoney(r.unitPrice, r.currency)}</td>
                      <td className="px-4 py-3 text-right font-medium text-ink">{formatMoney(r.totalAmount, r.currency)}</td>
                      <td className="px-4 py-3 text-subink">{formatDate(r.quoteDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-porcelain text-subink text-xs">
                    <th className="text-left font-medium px-4 py-3">{GROUP_LABEL[groupBy]}</th>
                    <th className="text-right font-medium px-4 py-3">건수</th>
                    <th className="text-right font-medium px-4 py-3">수량 합계</th>
                    <th className="text-right font-medium px-4 py-3">금액 합계</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((g, i) => (
                    <tr key={i} className="border-t border-line hover:bg-porcelain/60">
                      <td className="px-4 py-3 font-medium text-ink">{g.label}</td>
                      <td className="px-4 py-3 text-right text-subink">{g.count}건</td>
                      <td className="px-4 py-3 text-right text-ink">{formatNumber(g.quantity)}</td>
                      <td className="px-4 py-3 text-right font-medium text-ink">{formatMoney(g.amount, g.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <span className="flex items-center gap-1.5 text-xs text-subink mr-1">
              <BarChart3 size={14} /> 전체 합계
            </span>
            {totalsByCurrency.map((t) => (
              <Badge key={t.currency} className="bg-jade-50 text-jade-600">
                {formatMoney(t.amount, t.currency)} · {formatNumber(t.quantity)}개
              </Badge>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
