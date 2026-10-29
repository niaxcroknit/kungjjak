# 출시 가이드 (처음부터)

순서대로 하면 돼요. **웹 → 구글 콘솔 → Supabase → 안드로이드 스튜디오 → Play Console** 순서예요.
웹을 먼저 올리는 이유는, 구글 콘솔과 Play Console에 넣을 **개인정보처리방침 주소**가 웹에서 나오기 때문이에요.

---

## 0. 준비물 (한 번만)

| 프로그램 | 받는 곳 | 확인 |
|---|---|---|
| Node.js (LTS) | https://nodejs.org | 터미널에서 `node -v` |
| Git | https://git-scm.com | `git -v` |
| Android Studio | https://developer.android.com/studio | 설치 후 SDK 자동 설치까지 |

## 1. 코드 받기

```bash
git clone https://github.com/niaxcroknit/kungjjak
cd kungjjak
cp .env.example .env        # 윈도우: copy .env.example .env
npm install
```
- 터미널이 싫으면 GitHub 페이지의 **Code → Download ZIP**으로 받아도 돼요.
- `.env`에는 Supabase 주소와 공개 키가 이미 들어 있어요. `VITE_WEB_URL`, `VITE_STORE_URL`은 아래 단계에서 채워요.

## 2. 웹 올리기 (Netlify, 무료)

```bash
npm run build                # dist 폴더가 생겨요
```
1. https://app.netlify.com/drop 에 로그인하고 `dist` 폴더를 끌어다 놓아요.
2. 생긴 주소를 **Site configuration → Change site name**에서 `trip-agree`처럼 바꿔요. 예: `https://trip-agree.netlify.app`
3. 확인할 주소 세 개
   - 앱(아이폰·PC용): `https://trip-agree.netlify.app/`
   - **개인정보처리방침**: `https://trip-agree.netlify.app/privacy.html`
     → 올리기 전에 `public/privacy.html`의 `[연락받을 이메일 주소]`를 실제 이메일로 바꾸세요.
   - **계정 삭제 URL**: `https://trip-agree.netlify.app/?account=delete`
4. `.env`의 `VITE_WEB_URL=https://trip-agree.netlify.app` 넣고 다시 `npm run build` → `dist`를 같은 사이트에 다시 끌어다 놓기 (Netlify의 **Deploys** 탭 아래쪽에 끌어다 놓는 칸이 있어요)

## 3. 구글 로그인 만들기 (Google Cloud Console)

https://console.cloud.google.com

1. 위쪽 프로젝트 선택 → **새 프로젝트** → 이름 `trip-agree` → 만들기
2. 왼쪽 메뉴 **API 및 서비스 → OAuth 동의 화면**(새 화면에서는 **Google 인증 플랫폼**) → **시작하기**
   - 앱 이름: `쿵짝트립` / 사용자 지원 이메일: 내 이메일
   - 대상: **외부** / 연락처 이메일: 내 이메일 → 만들기
3. **브랜딩**
   - 앱 홈페이지: `https://trip-agree.netlify.app`
   - 개인정보처리방침: `https://trip-agree.netlify.app/privacy.html`
   - 승인된 도메인: `ofddzgicbvogshfzfmbo.supabase.co` 와 `trip-agree.netlify.app` 두 개
   - **앱 로고는 올리지 마세요.** 로고를 올리면 구글 브랜드 심사(며칠~몇 주)를 받아야 해요. 로고 없이도 로그인은 잘 돼요.
4. **데이터 액세스 → 범위 추가**: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` 세 개만 → 저장
5. **클라이언트 → 클라이언트 만들기**
   - 애플리케이션 유형: **웹 애플리케이션** (안드로이드 아님. 앱도 브라우저 창으로 로그인해요)
   - 이름: `Supabase`
   - 승인된 JavaScript 원본: `https://trip-agree.netlify.app`
   - 승인된 리디렉션 URI: `https://ofddzgicbvogshfzfmbo.supabase.co/auth/v1/callback`
   - 만들기 → 나오는 **클라이언트 ID**와 **클라이언트 보안 비밀번호** 복사
6. **대상 → 앱 게시 → 프로덕션으로 푸시**
   - 이걸 안 하면 "테스트 사용자"로 등록한 사람만 로그인돼요.
   - 이름·이메일·프로필만 쓰는 앱이라 별도 심사 없이 바로 프로덕션이 돼요 (로고를 올렸다면 심사가 걸려요).

## 4. Supabase 연결

https://supabase.com/dashboard → `trip-agree` 프로젝트

1. **Authentication → Sign In / Providers → Google**
   - Enable 켜기 → 3-5의 Client ID, Client Secret 붙여넣기 → Save
2. **Authentication → URL Configuration**
   - Site URL: `https://trip-agree.netlify.app`
   - Redirect URLs에 두 개 추가: `com.tripagree.app://login-callback`, `https://trip-agree.netlify.app`
3. 확인: 웹 주소에서 **Google로 시작하기** → 로그인 → "내 여행" 화면이 나오면 성공

## 5. 안드로이드 스튜디오

### 열기
```bash
npm run android
```
웹을 빌드해서 안드로이드 폴더에 복사한 뒤 안드로이드 스튜디오를 열어줘요.
안 열리면 안드로이드 스튜디오에서 **File → Open → `trip-agree/android` 폴더**를 고르세요. (`trip-agree`가 아니라 그 안의 **android** 폴더예요)

- 처음엔 아래쪽에 **Gradle sync**가 몇 분 돌아요. 끝날 때까지 기다려요.
- 폰을 USB로 연결하고(개발자 옵션 → USB 디버깅 켜기) 위쪽 ▶ 를 누르면 폰에 설치돼요.
- 폰에서 **Google로 시작하기** → 크롬 창에서 로그인 → 앱으로 돌아오면 성공이에요.

### 출시용 파일(AAB) 만들기
1. 버전 확인: `android/app/build.gradle`의 `versionCode`(올릴 때마다 1씩 올리기), `versionName`(예: `1.0.0`)
2. **Build → Generate Signed App Bundle or APK → Android App Bundle → Next**
3. **Create new...** 로 업로드 키 만들기
   - 저장 위치: 저장소 **밖** 안전한 곳 (예: `문서/keys/trip-agree.jks`)
   - 비밀번호 두 개와 Alias(`upload`)를 꼭 따로 적어두세요. **잃어버리면 업데이트를 못 올려요.**
   - 이 파일은 GitHub에 올리지 마세요.
4. **release** 선택 → Create
5. 결과: `android/app/release/app-release.aab`

### 코드를 고친 뒤 다시 올릴 때
`versionCode` +1 → `npm run android` → 위 2~5 반복 (키는 이미 만든 것 선택)

## 6. Play Console

https://play.google.com/console → **앱 만들기**
- 앱 이름 `쿵짝트립` / 기본 언어 한국어 / 앱 / 무료

### 대시보드의 "앱 설정" 항목
| 항목 | 넣을 값 |
|---|---|
| 개인정보처리방침 | `https://trip-agree.netlify.app/privacy.html` |
| 앱 액세스 | **일부 기능 제한** → 안내: "모든 기능에 Google 로그인이 필요합니다. 아무 Google 계정으로 로그인 후 '새 여행 만들기'로 이용할 수 있습니다." |
| 광고 | 광고 없음 |
| 콘텐츠 등급 | 설문 작성. 사용자끼리 정보 공유: **예** (같은 여행 친구들끼리 답을 봄) |
| 타겟층 | 13세 이상 (13세 미만 제외) |
| 데이터 보안 | 아래 표 |
| 정부 앱 / 금융 / 건강 | 해당 없음 |
| 앱 카테고리 | 여행 및 지역정보 |

**데이터 보안**
- 데이터 수집: 예 / 전송 중 암호화: 예 / 삭제 요청 방법 제공: 예
- 계정 삭제 URL: `https://trip-agree.netlify.app/?account=delete`
- 수집 항목 (모두 "수집", 공유 아님, 필수, 목적: 앱 기능·계정 관리)
  - 개인 정보: 이름, 이메일 주소, 사용자 ID
  - 사진 및 동영상: 해당 없음 (프로필 사진은 구글 주소만 저장)
  - 앱 활동: 기타 사용자 생성 콘텐츠 (체크한 답)

### 스토어 등록정보
문구는 `docs/STORE.md`, 이미지는 `resources/store/`에 있어요.

| 칸 | 파일 |
|---|---|
| 앱 아이콘 (512×512) | `resources/store/icon-512.png` |
| 그래픽 이미지 (1024×500) | `resources/store/feature-graphic.png` |
| 휴대전화 스크린샷 (2~8장) | `resources/store/screenshot-1.png` ~ `screenshot-5.png` |

### 올리기
1. **테스트 → 비공개 테스트** → 트랙 만들기 → 테스터(친구 이메일) 추가 → **새 버전 만들기** → `app-release.aab` 업로드 → 출시
   - 개인 개발자 계정은 **테스터 12명 이상이 14일 동안** 테스트해야 프로덕션 신청이 열려요.
2. 14일이 지나면 **프로덕션 → 프로덕션 액세스 신청** → 승인 후 같은 AAB를 프로덕션으로 승격

---

## 막혔을 때

| 증상 | 확인할 곳 |
|---|---|
| 로그인 후 앱으로 안 돌아옴 | Supabase Redirect URLs에 `com.tripagree.app://login-callback` 있는지 |
| "액세스 차단됨: 승인 오류" | 구글 콘솔 리디렉션 URI 철자, 앱 게시 상태(프로덕션인지) |
| 로그인은 되는데 화면이 비어 있음 | Supabase 프로젝트가 일시정지됐는지 (대시보드 → Resume) |
| Gradle sync 실패 | `npm install` → `npx cap sync android` 후 다시 열기 |
| 업로드 시 "버전 코드 사용 중" | `versionCode` 올리기 |
