# 홍코스메틱 영업관리 프로그램 (HONG COSMETIC Sales Management)

React + Vite + Tailwind CSS + Supabase로 만든 영업관리 프로그램입니다.
거래처, 제품, 견적, 샘플 발송, 상담 이력, 업데이트 로그가 모두
Supabase(Postgres)에 저장되며 실시간으로 동기화됩니다.

## 1. Supabase 프로젝트 준비

1. supabase.com 에서 프로젝트를 생성합니다.
2. Supabase 대시보드 > SQL Editor 에서 `supabase/schema.sql` 파일 내용을
   전체 복사해서 실행합니다. (customers, products, quotations, samples,
   users, update_logs, consultations, custom_countries, settings 테이블과
   RLS 정책, Realtime 설정이 한 번에 생성됩니다.)
3. Supabase 대시보드 > Project Settings > API 에서
   Project URL과 anon public 키를 확인합니다.

> 주의: 현재는 로그인 없이 anon key로 바로 읽고 쓰는 사내용 구조입니다.
> 외부에 공개되는 서비스라면 Supabase Auth를 붙이고 RLS 정책을
> auth.uid() 기반으로 좁혀야 합니다 (로드맵 6단계 이후 예정).

## 2. 로컬 환경변수 설정

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_SEED_DEMO_DATA=false
```

`VITE_SEED_DEMO_DATA=true`로 설정하면 첫 실행 시 예시 거래처/제품/견적
데이터가 자동으로 들어갑니다. 실제 운영 데이터베이스에서는 false
(또는 아예 생략)를 권장합니다.

## 3. 실행 방법

```bash
npm install
npm run dev
```

http://localhost:5173 접속

## 4. 프로덕션 빌드

```bash
npm run build
npm run preview
```

## 5. Vercel 배포

1. 이 저장소를 GitHub에 push 합니다 (아래 6번 참고).
2. vercel.com 에서 New Project → 방금 push한 GitHub 저장소를 선택합니다.
   Framework는 Vite로 자동 인식됩니다.
3. Vercel 프로젝트 Settings > Environment Variables 에 아래 3개를
   추가합니다 (Production/Preview/Development 모두 체크 권장).
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - VITE_SEED_DEMO_DATA (운영에서는 false)
4. Deploy를 누르면 끝입니다. Build Command는 `npm run build`,
   Output Directory는 `dist` 로 자동 설정됩니다.
5. 이후 main 브랜치에 push할 때마다 Vercel이 자동으로 재배포합니다.

## 6. GitHub에 Push하기

```bash
git remote add origin https://github.com/<your-account>/<repo-name>.git
git branch -M main
git push -u origin main
```

.env는 .gitignore에 이미 포함되어 있어 실수로 커밋되지 않습니다.
.env.example만 저장소에 올라갑니다.

## 폴더 구조

```
supabase/
  schema.sql              # Supabase 테이블/RLS/Realtime 생성 SQL (최초 1회 실행)
src/
  lib/
    supabaseClient.js      # Supabase 클라이언트 초기화 (.env 값 사용)
    storageAdapter.js       # 실제 저장 로직 (Supabase 테이블 CRUD)
    db.js                    # 거래처/제품/견적/샘플/상담이력/설정/로그 CRUD 함수
    session.js                # 데모용 로그인 시뮬레이터 (관리자/영업/물류/생산/읽기전용)
    constants.js               # 상태값, 색상 등 공통 상수
    utils.js                    # 날짜/금액 포맷 등 유틸
  components/
    Sidebar.jsx
    ClientDetailDrawer.jsx      # 거래처 상세 + 상담이력 타임라인
    CountrySelect.jsx            # 국가 드롭다운 + 직접입력
    ui/                            # 공통 UI 컴포넌트 (Badge, Modal, Field 등)
  pages/
    Dashboard.jsx                  # Supabase Realtime으로 자동 갱신
    Clients.jsx
    Products.jsx
    Quotes.jsx
    Samples.jsx
    Settings.jsx                     # 관리자 전용
    UpdateLog.jsx
```

## 데이터 저장 방식

customers, products, quotations, samples, users, update_logs,
consultations, custom_countries, settings 테이블은 모두
(id uuid, data jsonb, created_at, updated_at) 구조를 따릅니다.
화면에서 쓰는 실제 필드(회사명, 담당자 등)는 data 컬럼 안에 그대로
들어갑니다. 이렇게 하면 화면에 필드를 추가/변경할 때마다 DB 마이그레이션을
새로 만들 필요가 없습니다. 모든 데이터 접근은 src/lib/storageAdapter.js의
5개 함수(listAll, getById, create, update, remove)를 거치므로, 나중에
스키마를 정규화된 테이블로 바꾸더라도 이 파일만 수정하면 됩니다.

## Dashboard 자동 반영

거래처 등록/상태변경, 견적 등록, 샘플 발송 등록, 상담 이력 등록은
Supabase Realtime을 통해 대시보드에 새로고침 없이 즉시 반영됩니다
(다른 직원이 다른 브라우저에서 등록해도 내 화면이 자동으로 갱신됩니다).

## 최초 실행 시 데모 데이터

VITE_SEED_DEMO_DATA=true로 설정하고 처음 실행하면 거래처 3곳,
제품 2개, 견적/샘플/상담 이력 예시 데이터가 자동으로 들어갑니다.
필요 없으면 각 메뉴에서 삭제하거나 해당 환경변수를 꺼두세요.

## 개발 로드맵 진행 상황

- 완료 0단계: 브랜딩, 관리자 전용 설정 메뉴, 메뉴 이름 실시간 변경,
  업데이트 로그 자동 기록, 데모용 역할 전환, 반응형 사이드바
- 완료 Supabase 연동: 실제 DB 저장, CRUD, 검색, Dashboard 실시간 반영,
  Vercel/GitHub 배포 준비
- 예정 1단계: 거래처 상세 탭 확장 (프로젝트/인허가/파일/사진/계약서)
- 예정 2단계: 대시보드 차트, 이번주 일정, 국가별·상태별·월별 통계
- 예정 3단계: 제품/견적/샘플 확장 (수량별 단가 5단계, 견적 PDF, 다중 제품 견적 등)
- 예정 4단계: 프로젝트 칸반, 인허가, 생산관리, 출고관리
- 예정 5단계: 캘린더, 파일관리, 통합검색, AI 버튼(UI만 우선)
- 예정 6단계: Supabase Auth 연동 (현재는 role 시뮬레이터 → 실제 로그인으로 전환)

### 설정(관리자 전용) 사용법

왼쪽 사이드바 하단의 사용자 영역을 클릭하면 "관리자"로 전환할 수 있습니다
(실제 로그인 붙기 전까지의 데모용 기능입니다). 관리자 상태에서만
사이드바에 "설정" 메뉴가 보이고, 여기서 프로그램명/로고/파비콘/메인·서브
컬러/메뉴 이름/회사 정보를 바꿀 수 있습니다.

### 업데이트 로그

거래처 등록·상태변경·삭제, 제품 등록·단가변경·삭제, 견적 등록·상태변경,
샘플 발송 등록, 상담 이력 등록, 설정 변경은 자동으로 활동 로그에
기록됩니다. 대시보드의 "최근 업데이트" 카드에서 최근 10건을 볼 수 있고,
"전체보기"를 누르면 전체 로그 페이지로 이동합니다.
