import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  fetchProductCountryPrices,
  upsertProductCountryPrice,
  deleteProductCountryPrice,
} from "../lib/productCountryPrices";
import { CURRENCY } from "../lib/constants";
import { formatMoney } from "../lib/utils";
import Modal from "./ui/Modal";
import CountrySelect from "./CountrySelect";
import { Field, NumberInput, Select } from "./ui/Field";
import { Button, ConfirmDialog } from "./ui/Basics";

const EMPTY_ROW = { country: "", price: "", currency: "USD", moq: "" };

export default function ProductCountryPriceModal({ product, open, onClose, canEdit }) {
  const [prices, setPrices] = useState([]);
  const [form, setForm] = useState(EMPTY_ROW);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    if (!product) return;
    fetchProductCountryPrices(product.id).then(setPrices);
  };

  useEffect(() => {
    if (open) load();
    setForm(EMPTY_ROW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  if (!product) return null;

  const addOrUpdate = async (e) => {
    e.preventDefault();
    if (!form.country || form.price === "") return;
    await upsertProductCountryPrice(product.id, {
      country: form.country,
      price: Number(form.price),
      currency: form.currency,
      moq: form.moq === "" ? null : Number(form.moq),
    });
    setForm(EMPTY_ROW);
    load();
  };

  const confirmDelete = async () => {
    await deleteProductCountryPrice(deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  return (
    <Modal open={open} onClose={onClose} title="국가별 가격관리" subtitle={product.name} width="max-w-lg">
      <div className="space-y-4">
        {prices.length === 0 ? (
          <p className="text-sm text-subink text-center py-3">등록된 국가별 가격이 없습니다.</p>
        ) : (
          <div className="border border-line rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-porcelain text-subink text-xs">
                  <th className="text-left font-medium px-3 py-2">국가</th>
                  <th className="text-right font-medium px-3 py-2">가격</th>
                  <th className="text-right font-medium px-3 py-2">MOQ</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {prices.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{row.country}</td>
                    <td className="px-3 py-2 text-right text-ink">{formatMoney(row.price, row.currency)}</td>
                    <td className="px-3 py-2 text-right text-subink">{row.moq ?? "-"}</td>
                    <td className="px-3 py-2 text-center">
                      {canEdit && (
                        <button
                          onClick={() => setDeleteTarget(row)}
                          className="p-1 rounded-md text-subink hover:text-clay-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canEdit && (
          <form onSubmit={addOrUpdate} className="grid grid-cols-4 gap-2 items-end">
            <div className="col-span-4 sm:col-span-1">
              <Field label="국가">
                <CountrySelect value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
              </Field>
            </div>
            <Field label="가격">
              <NumberInput value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="통화">
              <Select
                options={CURRENCY}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </Field>
            <Field label="MOQ">
              <NumberInput value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} />
            </Field>
            <div className="col-span-4 flex justify-end">
              <Button type="submit" size="sm">
                <Plus size={14} /> 추가/갱신
              </Button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="국가별 가격을 삭제할까요?"
        description={`"${deleteTarget?.country}" 가격 정보가 삭제됩니다.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Modal>
  );
}
