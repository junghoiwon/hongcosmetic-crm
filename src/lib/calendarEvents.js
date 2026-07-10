/**
 * calendarEvents.js
 * ------------------------------------------------------------------
 * 일정 캘린더 화면에서 쓰는 통합 일정 데이터. 직접 등록한 일정
 * (schedule_events)뿐 아니라 상담일지 후속연락일, 견적일, 샘플
 * 발송일/후속연락일을 별도로 복제 저장하지 않고 원본 테이블에서
 * 그대로 읽어와 하나의 목록으로 합칩니다. 일정을 옮기면(드래그)
 * 원본 데이터의 날짜 필드를 직접 수정합니다.
 * ------------------------------------------------------------------
 */
import { fetchScheduleEvents, updateScheduleEvent } from "./scheduleEvents";
import { clientsDB, quotesDB, samplesDB, consultationsDB } from "./db";

export const SOURCE_LABEL = {
  direct: "직접등록",
  consultation: "상담일지",
  quote: "견적서",
  sample_sent: "샘플관리",
  sample_followup: "샘플관리",
};

export const SOURCE_COLOR = {
  direct: "#2F6F62",
  consultation: "#CC6E4C",
  quote: "#D9A441",
  sample_sent: "#6b7280",
  sample_followup: "#8b5cf6",
};

export async function fetchCalendarEvents() {
  const [scheduleRows, clients, quotes, samples, consultations] = await Promise.all([
    fetchScheduleEvents(),
    clientsDB.list(),
    quotesDB.list(),
    samplesDB.list(),
    consultationsDB.list(),
  ]);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
  const events = [];

  for (const e of scheduleRows) {
    events.push({
      id: `direct_${e.id}`,
      date: e.event_date,
      title: e.title,
      type: e.event_type,
      source: "direct",
      sourceLabel: SOURCE_LABEL.direct,
      clientId: e.client_id,
      clientName: clientMap[e.client_id]?.companyName || "",
      memo: e.memo,
      createdBy: e.created_by,
      raw: e,
    });
  }
  for (const c of consultations) {
    if (!c.nextContactDate) continue;
    events.push({
      id: `consultation_${c.id}`,
      date: c.nextContactDate,
      title: `후속연락 · ${clientMap[c.clientId]?.companyName || "삭제된 거래처"}`,
      type: "후속연락",
      source: "consultation",
      sourceLabel: SOURCE_LABEL.consultation,
      clientId: c.clientId,
      clientName: clientMap[c.clientId]?.companyName || "",
      raw: c,
    });
  }
  for (const q of quotes) {
    if (!q.quoteDate) continue;
    events.push({
      id: `quote_${q.id}`,
      date: q.quoteDate,
      title: `견적 · ${clientMap[q.clientId]?.companyName || "삭제된 거래처"}`,
      type: "견적",
      source: "quote",
      sourceLabel: SOURCE_LABEL.quote,
      clientId: q.clientId,
      clientName: clientMap[q.clientId]?.companyName || "",
      raw: q,
    });
  }
  for (const s of samples) {
    if (s.sentDate) {
      events.push({
        id: `sample_sent_${s.id}`,
        date: s.sentDate,
        title: `샘플발송 · ${clientMap[s.clientId]?.companyName || "삭제된 거래처"}`,
        type: "샘플발송",
        source: "sample_sent",
        sourceLabel: SOURCE_LABEL.sample_sent,
        clientId: s.clientId,
        clientName: clientMap[s.clientId]?.companyName || "",
        raw: s,
      });
    }
    if (s.followUpDate) {
      events.push({
        id: `sample_followup_${s.id}`,
        date: s.followUpDate,
        title: `샘플 후속연락 · ${clientMap[s.clientId]?.companyName || "삭제된 거래처"}`,
        type: "후속연락",
        source: "sample_followup",
        sourceLabel: SOURCE_LABEL.sample_followup,
        clientId: s.clientId,
        clientName: clientMap[s.clientId]?.companyName || "",
        raw: s,
      });
    }
  }
  return events;
}

/** 일정을 다른 날짜로 옮깁니다. 출처별 원본 테이블의 날짜 필드를 직접 수정합니다. */
export async function rescheduleEvent(event, newDate) {
  if (event.source === "direct") {
    await updateScheduleEvent(event.raw.id, { event_date: newDate });
  } else if (event.source === "consultation") {
    await consultationsDB.update(event.raw.id, { nextContactDate: newDate });
  } else if (event.source === "quote") {
    await quotesDB.update(event.raw.id, { quoteDate: newDate });
  } else if (event.source === "sample_sent") {
    await samplesDB.update(event.raw.id, { sentDate: newDate });
  } else if (event.source === "sample_followup") {
    await samplesDB.update(event.raw.id, { followUpDate: newDate });
  }
}
