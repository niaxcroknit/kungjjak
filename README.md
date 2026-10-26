# 여행 합의서 (안드로이드 + Supabase)

친구들과 여행 취향을 체크하고 한 장 표로 비교하는 앱이에요.
화면은 웹(HTML/JS)이고 **Capacitor**로 안드로이드 앱으로 감쌌어요. 데이터는 **Supabase** 프로젝트 `trip-agree`(서울)에 저장돼요.

## 공유는 이렇게 돼요
1. 방장이 **새 여행 만들기** → 6자리 **초대 코드**가 생겨요
2. **친구 초대** 버튼 → 카톡으로 코드를 보내요
3. 친구가 앱에서 구글 로그인 → **코드로 참여** → 같은 여행에 들어와요
4. 누가 체크하면 다른 사람 화면에도 **바로** 반영돼요 (Supabase Realtime)

## DB는 이미 만들어져 있어요
`supabase/schema.sql` 내용이 `trip-agree` 프로젝트에 적용돼 있어요.

| 규칙 | 어떻게 지켜지나 |
|---|---|
| 그 여행 멤버만 여행·답·멤버 목록을 볼 수 있음 | RLS 정책 |
| 각자 **자기 답만** 쓰기 (방장도 남의 답 수정 불가) | RLS 정책 |
| 방장이 **마감**하면 아무도 답을 못 씀 | RLS 정책 |
| 코드 없이는 여행에 못 들어옴, 직접 멤버 추가 불가 | `join_trip` 함수로만 참여 |
| 초대 코드·방장은 바뀌지 않음 | 트리거 |
| 방장은 못 나가고(삭제만), 멤버는 자기만 나갈 수 있음 | RLS 정책 |

---

## 남은 설정 3가지 (구글 로그인, 약 10분)

### 1. 구글 OAuth 클라이언트 만들기
1. https://console.cloud.google.com → 프로젝트 선택(없으면 새로 만들기)
2. **API 및 서비스 → OAuth 동의 화면** 설정 (외부, 앱 이름 "여행 합의서")
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 리디렉션 URI:
     ```
     https://ofddzgicbvogshfzfmbo.supabase.co/auth/v1/callback
     ```
4. 나오는 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 복사

### 2. Supabase에 구글 로그인 켜기
Supabase 대시보드 → `trip-agree` → **Authentication → Sign In / Providers → Google**
→ 사용 설정, 1번의 ID와 비밀번호 붙여넣기 → 저장

### 3. 앱으로 돌아오는 주소 등록
**Authentication → URL Configuration → Redirect URLs**에 추가:
```
com.tripagree.app://login-callback
```

> 이 방식은 휴대폰의 크롬 탭에서 로그인하고 앱으로 돌아오는 방식이라 **SHA-1 지문 등록이 필요 없어요.**

---

## 앱 실행
```bash
npm install
npm run android        # 웹 빌드 → 안드로이드에 복사 → 안드로이드 스튜디오 열기
```
`.env`에 Supabase 주소와 공개 키가 이미 들어 있어요. 이 키는 앱에 들어가도 되는 공개용 키라서 괜찮아요. 권한은 위의 RLS가 지켜요.

플레이스토어 주소가 생기면 `.env`의 `VITE_STORE_URL`에 넣으면 초대 문구에 같이 붙어요.

## 화면 구성
- **홈**: 내 여행 목록 · 새 여행 만들기 · 초대 코드가 있어요
- **여행**: 탭 2개
  - **체크**: 한 장에 질문 하나. '하나만' 질문은 누르면 바로 넘어가고, '여러 개'·날짜·직접 쓰기만 '다음' 버튼이 있어요. 날짜는 달력에서 되는 날을 눌러요. 좌우로 밀거나 '5 / 26'을 눌러 질문 목록에서 바로 이동
  - **결과**: "얘기할 것 N개"가 먼저, 갈린 질문은 같은 답끼리 묶어서 보여줘요. 일부만 같은 것·각자 적은 것·다 같은 것은 접혀 있고, 전체 표는 맨 아래 버튼으로
- **⚙ 설정**: 내 이름, 바뀐 기록, 내 답 지우기, (방장) 질문 편집·여행 이름·마감·삭제
- 누가 답을 바꾸면 결과 카드에 **바뀜** 표시가 붙고, 누르면 그 질문의 기록이 보여요

## 질문 넣고 빼기 (방장)
- 여행을 만들 때 **질문 고르고 만들기**를 누르거나, 나중에 **⚙ 설정 → 질문 편집**으로 들어가요.
- 기본 질문 26개에서 **빼기 / 다시 넣기**, 문구·선택지·답 방식(하나만/여러 개/직접 쓰기) **수정**, 새 질문 **추가**가 돼요.
- 질문 목록은 여행마다 따로 저장돼요(`trips.questions`). 친구들 화면에도 바로 반영돼요.
- 마감 중에는 질문을 못 바꿔요. 이미 답한 뒤 질문을 빼면 그 답은 표에서 숨겨지기만 하고 지워지지 않아서, 다시 넣으면 돌아와요.

## 아이폰·PC 친구용 웹 버전
앱과 웹은 **같은 Supabase DB**를 써요. 아이폰 친구가 웹에서 체크한 답이 갤럭시 앱 결과 표에 그대로 나오고, 그 반대도 마찬가지예요.

1. 사이트 올리기 (무료, 5분)
   ```bash
   npm run build          # dist 폴더가 생겨요
   ```
   https://app.netlify.com/drop 에 `dist` 폴더를 끌어다 놓으면 주소가 생겨요 (예: `https://trip-agree.netlify.app`).
   Vercel이나 Cloudflare Pages도 같은 방식으로 돼요.
2. `.env`의 `VITE_WEB_URL`에 그 주소를 넣고 다시 빌드 (`npm run build`, 앱은 `npm run android`)
3. Supabase → **Authentication → URL Configuration**
   - **Site URL**: 웹 주소
   - **Redirect URLs**에 웹 주소도 추가 (`com.tripagree.app://login-callback`은 그대로 두기)

그러면 **친구 초대** 문구가 이렇게 바뀌어요.
```
[여행 합의서] '제주 2박 3일' 같이 체크하자!
초대 코드: ABC201

갤럭시(안드로이드): 앱 받고 '코드로 참여'
https://play.google.com/store/apps/details?id=com.tripagree.app

아이폰·PC: 아래 링크 누르면 바로 참여
https://trip-agree.netlify.app/?join=ABC201
```
아이폰 친구가 링크를 누르면 웹이 열리고, 구글 로그인 뒤 **코드가 채워진 참여 화면**이 바로 떠요. 홈 화면에 추가하면 앱처럼 쓸 수 있어요.

## 기록과 계정 (출시 필수)
- **바뀐 기록은 서버가 직접 써요.** `answers` 테이블 트리거(`answers_track_history`)가 답이 바뀔 때마다 기록을 쌓고, 앱이 보낸 기록은 무시해요. 본인도 자기 기록을 지우거나 고칠 수 없어요.
- **계정 삭제**: 홈 오른쪽 위 **계정 → 계정 삭제**. Edge Function `delete-account`가 로그인한 본인 계정만 지우고, 내 답·참여·내가 방장인 여행이 함께 지워져요. (코드 사본: `supabase/functions/delete-account/index.ts`)
- **Play Console → 데이터 보안 → 계정 삭제 URL**에는 웹 주소 뒤에 `?account=delete`를 붙여 넣으세요. 예: `https://trip-agree.netlify.app/?account=delete` → 로그인하면 계정 삭제 화면이 바로 열려요.

## 자동 깨우기 (Supabase 일시정지 방지)
`.github/workflows/keepalive.yml`이 하루 3번 DB의 `keepalive()` 함수를 불러요. 데이터는 읽지 않는 가벼운 요청이에요.

1. 이 폴더를 GitHub 저장소로 올려요. **비공개(Private) 저장소를 추천**해요. 공개 저장소는 60일 동안 커밋이 없으면 GitHub이 예약 작업을 자동으로 꺼버려요.
2. 주소와 공개 키는 워크플로 파일에 이미 들어 있어서 따로 설정할 건 없어요. (다른 Supabase 프로젝트로 바꾸면 저장소 Secrets에 `SUPABASE_URL`, `SUPABASE_KEY`를 넣으면 그게 우선해요.)
3. **Actions** 탭 → **Supabase keepalive** → **Run workflow**로 한 번 돌려서 초록 체크가 뜨면 끝이에요.

실패하면 GitHub이 메일로 알려줘요. 사용자가 늘어서 매일 누군가 쓰게 되면 이 작업은 없어도 돼요.

## 자주 고치는 곳
| 하고 싶은 것 | 파일 |
|---|---|
| 기본 질문 26개 | `src/questions.js` (여행별 질문은 앱에서 방장이 편집) |
| 화면 동작 | `src/main.js` |
| 색·글꼴 | `src/style.css` |
| 로그인·연결 | `src/supabase.js` |
| DB·권한 | `supabase/schema.sql` (참고용 사본. 바꿀 땐 Supabase SQL Editor에서) |

## 알아둘 것
- 패키지 이름 `com.tripagree.app`을 바꾸면 `capacitor.config.json`, `android/app/build.gradle`, `AndroidManifest.xml`의 로그인 주소, `src/supabase.js`의 `REDIRECT`, 3번의 Redirect URL을 모두 같이 바꿔야 해요.
- 무료 플랜 프로젝트는 **1주일 동안 활동이 적으면 일시정지**돼요. 아래 '자동 깨우기'를 켜두면 막을 수 있어요. 정지돼도 90일 안에는 대시보드의 **Resume project**로 데이터 그대로 살아나요.
- Play Console의 데이터 보안 항목에 이름, 이메일, 사용자 ID 수집을 적고 개인정보처리방침 주소를 넣어야 해요.
