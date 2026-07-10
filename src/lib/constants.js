export const CLIENT_STATUS = [
  "신규문의",
  "상담중",
  "샘플발송",
  "견적발송",
  "인허가검토",
  "발주대기",
  "출고완료",
  "보류",
  "실패",
];

// 발주 가능성 판단에 쓰이는 '진행 중'으로 간주하는 상태
export const ACTIVE_CLIENT_STATUS = [
  "신규문의",
  "상담중",
  "샘플발송",
  "견적발송",
  "인허가검토",
  "발주대기",
];

// 대시보드의 '발주 가능성 높은 거래처' 판단 기준 상태
export const HOT_CLIENT_STATUS = ["견적발송", "인허가검토", "발주대기"];

export const CLIENT_STATUS_COLOR = {
  신규문의: "bg-subink/10 text-subink",
  상담중: "bg-jade-50 text-jade-600",
  샘플발송: "bg-gold-400/15 text-gold-500",
  견적발송: "bg-clay-100 text-clay-600",
  인허가검토: "bg-jade-100 text-jade-700",
  발주대기: "bg-clay-300/40 text-clay-600",
  출고완료: "bg-jade-600 text-white",
  보류: "bg-line text-subink",
  실패: "bg-ink/5 text-ink/40",
};

export const CLIENT_GRADES = ["VIP", "A", "B", "C", "잠재", "휴면"];

export const CLIENT_GRADE_COLOR = {
  VIP: "bg-gold-400 text-white",
  A: "bg-jade-600 text-white",
  B: "bg-jade-100 text-jade-700",
  C: "bg-line text-subink",
  잠재: "bg-clay-50 text-clay-600",
  휴면: "bg-ink/5 text-ink/40",
};

export const IMPORTANCE = ["상", "중", "하"];

export const IMPORTANCE_COLOR = {
  상: "bg-clay-500 text-white",
  중: "bg-gold-400 text-white",
  하: "bg-line text-subink",
};

export const CONTACT_CHANNELS = ["카카오톡", "위챗", "WhatsApp"];

export const CURRENCY = ["KRW", "USD"];

export const QUOTE_STATUS = ["작성중", "발송완료", "협의중", "승인", "실패"];

export const QUOTE_STATUS_COLOR = {
  작성중: "bg-line text-subink",
  발송완료: "bg-jade-50 text-jade-600",
  협의중: "bg-gold-400/15 text-gold-500",
  승인: "bg-jade-600 text-white",
  실패: "bg-ink/5 text-ink/40",
};

export const CARRIERS = ["EMS", "DHL", "FedEx", "기타"];

export const COUNTRIES = [
  "한국",
  "일본",
  "중국",
  "홍콩",
  "대만",
  "베트남",
  "태국",
  "인도네시아",
  "말레이시아",
  "싱가포르",
  "몽골",
  "인도",
  "UAE",
  "사우디아라비아",
  "러시아",
  "카자흐스탄",
  "우즈베키스탄",
  "키르기스스탄",
  "타지키스탄",
  "아제르바이잔",
  "벨라루스",
  "아르메니아",
  "몰도바",
  "프랑스",
  "독일",
  "영국",
  "이탈리아",
  "스페인",
  "미국",
  "캐나다",
  "브라질",
  "멕시코",
  "호주",
  "기타",
];
