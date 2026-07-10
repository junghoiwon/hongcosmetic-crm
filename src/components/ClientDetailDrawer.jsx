import { useEffect, useMemo, useState } from "react";
import { X, Pin, PinOff, Trash2, Plus, Phone, Mail, MessageCircle, Pencil, TrendingUp, Users, Star } from "lucide-react";
import { consultationsDB, quotesDB, samplesDB, productsDB, logActivity } from "../lib/db";
import { fetchAllQuotationItems } from "../lib/quotationItems";
import {
  fetchClientContacts,
  createClientContact,
  updateClientContact,
  deleteClientContact,
} from "../lib/clientContacts";
import { CLIENT_STATUS_COLOR, IMPORTANCE_COLOR } from "../lib/constants";
import { formatDate, todayISO, formatMoney, PERIOD_OPTIONS, isWithinPeriod } from "../lib/utils";
import Badge from "./ui/Badge";
import Modal from "./ui/Modal";
import { Field, TextArea, TextInput, Select } from "./ui/Field";
import { Button, ConfirmDialog } from "./ui/Basics";

const EMPTY_CONTACT = {
  name: "",
  position: "",
  phone: "",
  email: "",
  kakao: "",
  wechat: "",
  whatsapp: "",
  memo: "",
  is_primary: false,
};

export default function ClientDetailDrawer({ client, onClose, onEdit, session, canEdit, canCreate, canDelete }) {
  const [consultations, setConsultations] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [samples, setSamples] = useState([]);
  const [products, setProducts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [salesPeriod, setSalesPeriod] = useState("all");
  const [note, setNote] = useState("");
  const [nextContactDate, setNextContactDate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [contactDeleteTarget, setContactDeleteTarget] = useState(null);
  const [itemsByQuotation, setItemsByQuotation] = useState({});

  const loadConsultations = () =>
    consultationsDB.list().then((rows) =>
      setConsultations(
        rows
          .filter((r) => r.clientId === client.id)
          .sort((a, b) => (a.pinned === b.pinned ? new Date(b.date) - new Date(a.date) : a.pinned ? -1 : 1))
      )
    );

  const loadContacts = () => fetchClientContacts(client.id).then(setContacts);

  useEffect(() => {
    if (!client) return;
    loadConsultations();
    loadContacts();
    quotesDB.list().then((rows) => setQuotes(rows.filter((r) => r.clientId === client.id)));
    samplesDB.list().then((rows) => setSamples(rows.filter((r) => r.clientId === client.id)));
    productsDB.list().then(setProducts);
    fetchAllQuotationItems().then(setItemsByQuotation);
    setNote("");
    setNextContactDate("");
  }, [client]);

  const salesSummary = useMemo(() => {
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
    const approved = quotes.filter((q) => q.status === "승인" && isWithinPeriod(q.quoteDate, salesPeriod));

    const byProduct = {};
    for (const q of approved) {
      const realItems = itemsByQuotation[q.id];
      const lineItems =
        realItems && realItems.length > 0
          ? realItems
          : q.productId
          ? [
              {
                productId: q.productId,
                quantity: q.quantity || 0,
                supplyAmount: (q.quantity || 0) * (q.unitPrice || 0),
              },
            ]
          : [];
      for (const it of lineItems) {
        const key = `${it.productId}__${q.currency}`;
        if (!byProduct[key]) {
          byProduct[key] = {
            productName: it.productName || productMap[it.productId]?.name || "삭제된 제품",
            currency: q.currency,
            quantity: 0,
            amount: 0,
          };
        }
        byProduct[key].quantity += it.quantity || 0;
        byProduct[key].amount += it.supplyAmount || 0;
      }
    }

    const totalsByCurrency = {};
    for (const row of Object.values(byProduct)) {
      if (!totalsByCurrency[row.currency]) totalsByCurrency[row.currency] = { quantity: 0, amount: 0 };
      totalsByCurrency[row.currency].quantity += row.quantity;
      totalsByCurrency[row.currency].amount += row.amount;
    }

    return {
      rows: Object.values(byProduct).sort((a, b) => b.amount - a.amount),
      totals: Object.entries(totalsByCurrency).map(([currency, v]) => ({ currency, ...v })),
    };
  }, [quotes, products, salesPeriod, itemsByQuotation]);

  if (!client) return null;

  const addNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    await consultationsDB.create({
      clientId: client.id,
      date: todayISO(),
      content: note.trim(),
      nextContactDate: nextContactDate || "",
      pinned: false,
    });
    await logActivity({
      actor: session?.name || "사용자",
      action: "상담 이력 등록",
      summary: `${client.companyName} 상담 기록 추가`,
      detail: note.trim().slice(0, 60),
    });
    setNote("");
    setNextContactDate("");
    loadConsultations();
  };

  const togglePin = async (c) => {
    await consultationsDB.update(c.id, { pinned: !c.pinned });
    loadConsultations();
  };

  const confirmDelete = async () => {
    await consultationsDB.remove(deleteTarget.id);
    setDeleteTarget(null);
    loadConsultations();
  };

  const openCreateContact = () => {
    setEditingContact(null);
    setContactForm(EMPTY_CONTACT);
    setContactModalOpen(true);
  };

  const openEditContact = (contact) => {
    setEditingContact(contact);
    setContactForm(contact);
    setContactModalOpen(true);
  };

  const saveContact = async (e) => {
    e.preventDefault();
    if (editingContact) {
      await updateClientContact(editingContact.id, contactForm);
      await logActivity({
        actor: session?.name || "사용자",
        action: "거래처 담당자 수정",
        summary: `${client.companyName} 담당자(${contactForm.name}) 정보 수정`,
      });
    } else {
      await createClientContact(client.id, contactForm);
      await logActivity({
        actor: session?.name || "사용자",
        action: "거래처 담당자 등록",
        summary: `${client.companyName}에 담당자(${contactForm.name}) 추가`,
      });
    }
    setContactModalOpen(false);
    loadContacts();
  };

  const confirmDeleteContact = async () => {
    await deleteClientContact(contactDeleteTarget.id);
    setContactDeleteTarget(null);
    loadContacts();
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-ink/30" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-porcelain border-l border-line shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-line px-6 py-5 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className={CLIENT_STATUS_COLOR[client.status]}>{client.status}</Badge>
              <Badge className={IMPORTANCE_COLOR[client.importance]}>중요도 {client.importance}</Badge>
            </div>
            <h2 className="font-display text-lg font-semibold text-ink">{client.companyName}</h2>
            <p className="text-sm text-subink">{client.country} · {client.contactName}</p>
          </div>
          <div className="flex items-center gap-1">
            {canEdit && (
              <button
                onClick={() => onEdit(client)}
                className="p-1.5 rounded-full text-subink hover:bg-porcelain hover:text-jade-600"
                aria-label="수정"
              >
                <Pencil size={17} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-subink hover:bg-porcelain hover:text-ink"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* 연락처 정보 */}
          <section className="bg-white border border-line rounded-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-ink">
              <Phone size={14} className="text-subink" /> {client.phone || "-"}
            </div>
            <div className="flex items-center gap-2 text-sm text-ink">
              <Mail size={14} className="text-subink" /> {client.email || "-"}
            </div>
            {(client.kakao || client.wechat || client.whatsapp) && (
              <div className="flex items-center gap-2 text-sm text-ink">
                <MessageCircle size={14} className="text-subink" />
                {[
                  client.kakao && `카카오톡 ${client.kakao}`,
                  client.wechat && `위챗 ${client.wechat}`,
                  client.whatsapp && `WhatsApp ${client.whatsapp}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            <div className="text-sm text-subink pt-1 border-t border-line mt-2">
              관심 제품: <span className="text-ink">{client.interestProduct || "-"}</span>
            </div>
            {client.memo && (
              <div className="text-sm text-subink whitespace-pre-wrap pt-2 border-t border-line mt-2">
                {client.memo}
              </div>
            )}
          </section>

          {/* 담당자 (여러 명) */}
          <section className="bg-white border border-line rounded-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold text-ink flex items-center gap-1.5">
                <Users size={15} className="text-jade-500" /> 담당자
              </h3>
              {canCreate && (
                <Button type="button" variant="ghost" size="sm" onClick={openCreateContact}>
                  <Plus size={13} /> 담당자 추가
                </Button>
              )}
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-subink text-center py-3">등록된 담당자가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div key={contact.id} className="border border-line rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {contact.is_primary && <Star size={12} className="text-gold-500 shrink-0" fill="currentColor" />}
                          <p className="text-sm font-medium text-ink truncate">{contact.name || "이름 미입력"}</p>
                          {contact.position && <span className="text-xs text-subink shrink-0">{contact.position}</span>}
                        </div>
                        <p className="text-xs text-subink mt-1">
                          {[
                            contact.phone,
                            contact.email,
                            contact.kakao && `카카오톡 ${contact.kakao}`,
                            contact.wechat && `위챗 ${contact.wechat}`,
                            contact.whatsapp && `WhatsApp ${contact.whatsapp}`,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "연락처 미입력"}
                        </p>
                        {contact.memo && <p className="text-xs text-subink mt-1 whitespace-pre-wrap">{contact.memo}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canEdit && (
                          <button
                            onClick={() => openEditContact(contact)}
                            className="p-1 rounded-md text-subink hover:text-jade-600"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setContactDeleteTarget(contact)}
                            className="p-1 rounded-md text-subink hover:text-clay-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 관련 현황 요약 */}
          <section className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-line rounded-card p-3">
              <p className="text-xs text-subink mb-1">견적 이력</p>
              <p className="font-display text-xl font-semibold text-ink">{quotes.length}건</p>
            </div>
            <div className="bg-white border border-line rounded-card p-3">
              <p className="text-xs text-subink mb-1">샘플 발송</p>
              <p className="font-display text-xl font-semibold text-ink">{samples.length}건</p>
            </div>
          </section>

          {/* 판매 실적 (승인된 견적 기준) */}
          <section className="bg-white border border-line rounded-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold text-ink flex items-center gap-1.5">
                <TrendingUp size={15} className="text-jade-500" /> 판매 실적
              </h3>
              <Select
                value={salesPeriod}
                onChange={(e) => setSalesPeriod(e.target.value)}
                options={PERIOD_OPTIONS}
                className="!w-auto !text-xs !py-1"
              />
            </div>
            {salesSummary.rows.length === 0 ? (
              <p className="text-sm text-subink text-center py-4">
                승인된 견적이 없습니다. (견적 상태가 "승인"인 건만 집계됩니다)
              </p>
            ) : (
              <>
                <table className="w-full text-sm mb-3">
                  <thead>
                    <tr className="text-xs text-subink border-b border-line">
                      <th className="text-left font-medium py-1.5">제품</th>
                      <th className="text-right font-medium py-1.5">수량</th>
                      <th className="text-right font-medium py-1.5">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesSummary.rows.map((row, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="py-1.5 text-ink">{row.productName}</td>
                        <td className="py-1.5 text-right text-ink">{row.quantity.toLocaleString("ko-KR")}개</td>
                        <td className="py-1.5 text-right text-ink">{formatMoney(row.amount, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap justify-end gap-2">
                  {salesSummary.totals.map((t) => (
                    <Badge key={t.currency} className="bg-jade-50 text-jade-600">
                      총 {formatMoney(t.amount, t.currency)} · {t.quantity.toLocaleString("ko-KR")}개
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* 상담 이력 */}
          <section>
            <h3 className="font-display text-sm font-semibold text-ink mb-3">상담 이력</h3>

            {canCreate && (
              <form onSubmit={addNote} className="bg-white border border-line rounded-card p-4 mb-4 space-y-3">
                <Field label="새 상담 내용">
                  <TextArea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="오늘 나눈 상담 내용을 기록하세요."
                  />
                </Field>
                <Field label="다음 연락일">
                  <TextInput
                    type="date"
                    value={nextContactDate}
                    onChange={(e) => setNextContactDate(e.target.value)}
                  />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" size="sm">
                    <Plus size={14} /> 기록 추가
                  </Button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {consultations.length === 0 && (
                <p className="text-sm text-subink text-center py-6">아직 상담 기록이 없습니다.</p>
              )}
              {consultations.map((c) => (
                <div
                  key={c.id}
                  className={`bg-white border rounded-card p-4 ${
                    c.pinned ? "border-gold-400/60 ring-1 ring-gold-400/20" : "border-line"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs text-subink">{formatDate(c.date)}</span>
                    <div className="flex items-center gap-1">
                      {c.nextContactDate && (
                        <Badge className="bg-jade-50 text-jade-600">
                          다음 연락 {formatDate(c.nextContactDate)}
                        </Badge>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => togglePin(c)}
                          className={`p-1 rounded-md ${c.pinned ? "text-gold-500" : "text-subink hover:text-gold-500"}`}
                          title={c.pinned ? "고정 해제" : "중요 내용 고정"}
                        >
                          {c.pinned ? <Pin size={14} fill="currentColor" /> : <PinOff size={14} />}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="p-1 rounded-md text-subink hover:text-clay-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-ink whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="상담 기록을 삭제할까요?"
        description="삭제된 상담 기록은 복구할 수 없습니다."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title={editingContact ? "담당자 정보 수정" : "담당자 추가"}
        width="max-w-md"
      >
        <form onSubmit={saveContact} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="이름" required>
              <TextInput
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
              />
            </Field>
            <Field label="직급">
              <TextInput
                value={contactForm.position}
                onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })}
              />
            </Field>
            <Field label="전화">
              <TextInput
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
              />
            </Field>
            <Field label="이메일">
              <TextInput
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              />
            </Field>
            <Field label="카카오톡 ID">
              <TextInput
                value={contactForm.kakao}
                onChange={(e) => setContactForm({ ...contactForm, kakao: e.target.value })}
              />
            </Field>
            <Field label="위챗 ID">
              <TextInput
                value={contactForm.wechat}
                onChange={(e) => setContactForm({ ...contactForm, wechat: e.target.value })}
              />
            </Field>
            <Field label="WhatsApp" className="col-span-2">
              <TextInput
                value={contactForm.whatsapp}
                onChange={(e) => setContactForm({ ...contactForm, whatsapp: e.target.value })}
              />
            </Field>
            <Field label="메모" className="col-span-2">
              <TextArea
                value={contactForm.memo}
                onChange={(e) => setContactForm({ ...contactForm, memo: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={contactForm.is_primary}
              onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })}
              className="w-4 h-4 accent-jade-600"
            />
            대표 담당자로 표시
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setContactModalOpen(false)}>
              취소
            </Button>
            <Button type="submit">{editingContact ? "저장" : "등록"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!contactDeleteTarget}
        title="담당자를 삭제할까요?"
        description={`"${contactDeleteTarget?.name}" 담당자 정보가 삭제됩니다.`}
        onConfirm={confirmDeleteContact}
        onCancel={() => setContactDeleteTarget(null)}
      />
    </div>
  );
}
