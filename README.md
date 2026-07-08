# 홍코스메틱 영업관리 프로그램 (HONG COSMETIC Sales Management)

React + Vite + Tailwind CSS로 만든 영업관리 프로그램입니다.
데이터는 현재 브라우저의 localStorage에 저장됩니다 (팀원과 공유되지 않고, 이 브라우저에만 남습니다).

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속

## 프로덕션 빌드

```bash
npm run build
npm run preview
```

## 폴더 구조

```
src/
  lib/
    storageAdapter.js   # 실제 저장 로직 (지금은 localStorage)
    db.js               # 거래처/제품/견적/샘플/상담이력 CRUD 함수
    constants.js         # 상태값, 색상 등 공통 상수
    utils.js              # 날짜/금액 포맷 등 유틸
  components/
    Sidebar.jsx
    ClientDetailDrawer.jsx  # 거래처 상세 + 상담이력 타임라인
    ui/                       # 공통 UI 컴포넌트 (Badge, Modal, Field 등)
  pages/
    Dashboard.jsx
    Clients.jsx
    Products.jsx
    Quotes.jsx
    Samples.jsx
```

## Supabase / Firebase로 전환하는 방법

모든 데이터 접근은 `src/lib/storageAdapter.js` 의 5개 함수
(`listAll`, `getById`, `create`, `update`, `remove`)를 거칩니다.
나중에 실제 데이터베이스로 옮길 때는 이 파일 내부 구현만
Supabase client 호출 또는 Firebase SDK 호출로 바꾸면 되고,
`db.js`와 각 페이지 컴포넌트는 전혀 수정할 필요가 없습니다.

예) Supabase로 교체 시 `listAll`:
```js
export async function listAll(table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return data;
}
```

## 최초 실행 시 데모 데이터

처음 실행하면 거래처 3곳, 제품 2개, 견적/샘플/상담 이력 예시 데이터가
자동으로 들어갑니다. 필요 없으면 각 메뉴에서 삭제하면 됩니다.

## 개발 로드맵 진행 상황

- ✅ 0단계: 브랜딩(로고/파비콘/메인·서브컬러), 관리자 전용 설정 메뉴,
  메뉴 이름 실시간 변경, 업데이트 로그(활동 이력) 자동 기록,
  데모용 역할 전환(관리자/영업/물류/생산/읽기전용), 반응형 사이드바(태블릿 대응)
- ⬜ 1단계: 거래처 상세 탭 확장 (회사정보/상담이력/견적/샘플발송/프로젝트/인허가/파일/메모/사진/계약서)
- ⬜ 2단계: 대시보드 차트, 이번주 일정, 국가별·상태별·월별 통계
- ⬜ 3단계: 제품/견적/샘플 확장 (수량별 단가 5단계, 견적 PDF, 다중 제품 견적 등)
- ⬜ 4단계: 프로젝트 칸반, 인허가, 생산관리, 출고관리
- ⬜ 5단계: 캘린더, 파일관리, 통합검색, AI 버튼(UI만 우선)
- ⬜ 6단계: Supabase 연동 (Repository 패턴이 이미 구조화되어 있어 어댑터 교체만 필요)

### 설정(관리자 전용) 사용법

왼쪽 사이드바 하단의 사용자 영역을 클릭하면 "관리자"로 전환할 수 있습니다
(실제 로그인 붙기 전까지의 데모용 기능입니다). 관리자 상태에서만
사이드바에 "설정" 메뉴가 보이고, 여기서 프로그램명/로고/파비콘/메인·서브
컬러/메뉴 이름/회사 정보를 바꿀 수 있습니다.

### 업데이트 로그

거래처 등록·상태변경·삭제, 제품 등록·단가변경·삭제, 견적 등록·상태변경,
샘플 발송 등록, 상담 이력 등록, 설정 변경 등은 자동으로 활동 로그에
기록됩니다. 대시보드의 "최근 업데이트" 카드에서 최근 10건을 볼 수 있고,
"전체보기"를 누르면 전체 로그 페이지로 이동합니다.

