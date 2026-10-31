# BIMILCALL 배포 체크리스트

2026-10-31 기준. 프런트 빌드 도구는 추가하지 않았습니다. Firebase 서버 함수만 Node.js 22로 별도 배포합니다.

## 현재 상태

- 원본 10개 파일 전체 확인, 함수 중복 검사 완료.
- 6개 스크립트 구문 검사·중복 정의 검사 완료.
- Firestore·Storage 권한/상태 전환 47개 검증 완료.
- 서버 재발급 권한·실제 Auth 새 비밀번호 로그인·UID 보존·동시 호출 배제·자동 만료·중복 정산 방지·패널티 차단 검증 완료.
- 운영 Firebase 또는 GitHub에 실제 배포하지 않았습니다. 운영 계정 로그인·저장소 접근 권한이 필요합니다.
- GitHub 연결 후 urildlduri/bimil 저장소를 확인했습니다. 수정본은 codex/bimilcall-security-20261031 브랜치로 준비합니다.
- 실제 커스텀 도메인은 미확인입니다. 도메인을 임의로 정하거나 DNS를 변경하지 않았습니다.

## 배포 순서

현재 운영 트래픽이 있다면 점검 시간을 잡고 기존 규칙·데이터를 백업한 후 전환합니다.

1. `bimilcall` 프로젝트의 실제 DB 위치·현재 사용량·기존 컬렉션/활성 호출·매장 ID를 확인합니다. 코드는 지역을 추정해 데이터베이스 위치를 변경하지 않습니다.
2. 기존 비 UID 매장 문서와 memberEmails 계정은 아래 호환성 절차를 먼저 확인합니다.
3. Firebase 서버 함수·인덱스를 배포하고 인덱스 상태가 Enabled가 될 때까지 확인합니다.
4. 보안 규칙 게시와 프런트 교체를 같은 점검 시간에 수행합니다. **프런트만 먼저 배포하면 createCall이 없어 호출이 실패합니다.** 기존 프런트는 강화 규칙과 호환되지 않습니다.
5. 관리자·사용자·서로 다른 매장 2개로 실제 서비스 동작을 확인합니다.
6. 기본 GitHub Pages 주소에서 검증한 뒤 소유한 커스텀 도메인을 연결합니다.

## Firebase Console에서 직접 확인할 일

- [ ] Authentication → Sign-in method → Email/Password 활성화.
- [ ] 운영자 두 계정의 이메일이 정확한지, **emailVerified=true**인지 확인. 사용자 프로필의 role 필드로 관리자가 되지 않습니다.
- [ ] Functions 배포에 필요한 Blaze/결제 상태 확인. 변경에 비용이 발생할 수 있으며 이 작업에서 요금제를 변경하지 않았습니다.
- [ ] Functions/Cloud Scheduler/Eventarc 관련 API와 런타임 서비스 계정 권한 확인. Auth 비밀번호 변경 권한과 Firestore 접근 권한이 필요합니다.
- [ ] `firestore.indexes.json` 인덱스 배포 및 구축 완료 확인.
- [ ] Firestore → Rules에 `firestore.rules` 전체 게시.
- [ ] Storage → Rules에 `storage.rules` 전체 게시. 첫 cross-service Firestore 조회 시 안내되는 접근 권한 활성화.
- [ ] Functions에 createCall, expireCall, adminResetMerchantPassword, deleteMyAccount 및 이벤트·예약 함수가 배포됐는지 확인.
- [ ] Cloud Scheduler의 expireCalls가 매분 실행되는지 확인. 브라우저가 닫혀 있어도 처리됩니다. 과부하 시 지연될 수 있지만 새 호출은 서버가 마감·패널티를 다시 검사합니다.
- [ ] Authentication → Settings → Authorized domains에 실제 Pages 호스트와 커스텀 도메인 추가. 프로토콜·경로는 제외.
- [ ] 일반 사용자 비밀번호 재설정 메일은 사용하지 않음. 매장 재발급은 관리자 전용 함수 사용.
- [ ] App Check와 사용량 제한은 운영 유입을 확인해 별도 적용. 본 코드에는 App Check enforcement를 설정하지 않았습니다.

CLI를 사용할 경우, Node.js 22 환경에서 프로젝트 루트 기준:

```sh
npm install
npm --prefix functions ci
npx firebase login
npx firebase use bimilcall
npm run test:static
npm run test:rules
npx firebase deploy --only functions,firestore:indexes --project bimilcall
npx firebase deploy --only firestore:rules,storage --project bimilcall
```

테스트에는 Java 17 이상이 필요합니다(향후 Firebase CLI에서는 Java 21 필요). 운영 배포 전 실제 프로젝트가 `bimilcall`인지 재확인합니다. 테스트는 `demo-bimilcall` 에뮬레이터에만 실행됩니다.

## GitHub Pages

- [ ] 배포할 계정/저장소 확인. 기존 저장소를 다른 프로젝트로 덮어쓰지 않음.
- [ ] `index.html`, `user.html`, `merchant.html`, `admin.html`, `bc-core.js`, `bc.css`, `terms.html`, `privacy.html`을 Pages 배포 루트에 배치.
- [ ] `node_modules`, 테스트 결과, 서비스 계정 키, CLI 인증 파일을 게시하지 않음.
- [ ] 저장소 Settings → Pages에서 배포 브랜치 및 폴더 선택.
- [ ] 커스텀 도메인이 없으면 발급된 `https://<계정>.github.io/<저장소>/`로 먼저 확인. 상대 경로를 유지해 하위 경로에서도 동작.
- [ ] Pages의 HTTPS 강제 적용.
- [ ] 비밀키 파일은 추가하지 않음. Firebase 웹 apiKey·카카오 JavaScript 키는 브라우저용 공개 설정이며 접근 통제는 인증·규칙·도메인 등록으로 수행.

## 커스텀 도메인 / CNAME / DNS

`CNAME.example`은 설명용 템플릿입니다. 실제 배포용 CNAME은 아직 생성하지 않았습니다.

- [ ] 소유 도메인과 사용할 호스트(루트 또는 www)를 확정.
- [ ] GitHub 계정의 Pages 도메인 소유 확인(TXT)을 먼저 완료.
- [ ] 저장소 Settings → Pages → Custom domain에 실제 호스트 등록.
- [ ] Pages 게시 루트의 `CNAME` 파일에는 해당 호스트 **한 줄만** 입력. `https://`·경로·주석 제외.
- [ ] 루트 도메인의 A 레코드는 GitHub 공식 값 사용:

| 유형 | 이름 | 값 |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www 또는 선택한 서브도메인 | `<GitHub계정>.github.io` |

- [ ] GitHub Pages 대상 CNAME에는 저장소 경로를 넣지 않음. 해당 호스트의 충돌하는 A/AAAA/CNAME을 정리하고 MX 등 무관한 레코드는 유지.
- [ ] 서브도메인을 외부 서비스로 연결할 때 와일드카드 DNS는 피함.
- [ ] DNS 확인/인증서 발급 후 Enforce HTTPS 활성화.
- [ ] `bc-core.js`의 `NW.SITE_URL`은 기본적으로 현재 배포 루트를 계산. canonical 주소를 고정하려면 이 변수 하나만 `https://실제호스트/`로 변경. 모든 복사 문구가 이 값을 사용.

## Firebase Authentication 도메인

- [ ] `https://계정.github.io/저장소/`라면 Authorized domains에는 `계정.github.io`만 입력.
- [ ] 커스텀 도메인의 루트와 www를 각각 사용한다면 둘 다 등록.
- [ ] 가상 이메일 도메인 `bimilcall.local`, `bimilcall-biz.local`을 사이트 승인 도메인으로 넣는 것은 아님.
- [ ] 기존 `authDomain: bimilcall.firebaseapp.com`은 유지. GitHub Pages를 Firebase 인증 핸들러 호스트로 임의 변경하지 않음.

## 카카오맵

- [ ] 카카오 개발자 콘솔에서 이 프로젝트의 JavaScript 키를 선택.
- [ ] 현재 메뉴 기준 앱 → 앱 설정 → 앱 → 플랫폼 키 → JavaScript 키 → JavaScript SDK 도메인에 `https://실제호스트` 등록. 콘솔의 구 메뉴가 보이면 플랫폼 → Web → 사이트 도메인에서 같은 설정 확인.
- [ ] Pages 기본 주소도 쓸 경우 `https://계정.github.io` 등록. 경로 제외.
- [ ] 루트/www를 모두 사용할 경우 각각 등록.
- [ ] 카카오맵 API 사용 설정과 허용량 확인. 실제 등록된 도메인에서 지도·주소 검색을 테스트.

## 매장 비밀번호 재발급

관리자 매장 목록 → 비밀번호 재발급 → 새 비밀번호 표시 → 복사.

- 기존 아이디·Firebase UID·bizId·사진 경로·호출/리뷰 참조를 유지.
- 관리자는 비밀번호를 DB나 로그에 저장하지 않음. 브라우저 결과 화면에서만 표시.
- Admin SDK의 updateUser로 비밀번호를 변경하고 refresh token을 폐기. 이미 발급된 ID token은 만료 전까지(통상 최대 1시간) 유효할 수 있으므로 즉각적인 모든 세션 차단을 뜻하지 않음.
- 관리자 사전 생성 계정(merchantId와 ownerId가 일치하는 계정)에만 적용. 일반 사용자에서 파트너 승인된 계정은 이 버튼 대상이 아님.
- 서버 함수 배포 전에는 버튼을 눌러도 실제 재발급이 수행되지 않음.

## 호환성과 남은 운영 확인

- 새 파트너 신청은 `biz/{auth.uid}`로 생성. 기존 `addDoc`의 랜덤 ID 매장은 본인 UID 경로 제한과 호환되지 않음. 운영 데이터 확인·백업·기존 호출/리뷰/사진 참조 이전 계획을 세운 뒤 전환해야 하며 본 작업은 실데이터를 임의 이전하지 않음.
- memberEmails 직원 공유 권한은 제거. UI 버튼도 숨김. 직원 계정 설계는 별도 작업이며 이메일 수집을 재도입하지 않음.
- 기존 self-reported history는 리뷰 자격으로 인정하지 않음. 실제 calls의 done 기록이 필요. 새 리뷰에 callId를 추가해 규칙에서 검사.
- 기존 포인트/위조 리뷰/비승인자가 승인한 매장 데이터는 자동 정정되지 않음. 원래 느슨했던 규칙 기간의 데이터는 운영자가 확인해야 함.
- 보존 요청한 NW.adminCreateMerchant의 Math.random 8자리 비밀번호·4자리 ID 생성 방식은 그대로. 새 재발급은 암호학적 난수 24자를 사용. 최초 발급의 충돌 가능성과 강도 개선은 잔여 항목.
- 출생연도/생일은 본인 입력 검증이며 실명 기반 성인 인증이 아님. 프런트는 정확한 생일 나이와 달력 유효성을 확인하되 서버에는 출생연도만 보존하므로 생일 이전 가입에 대한 서버 검증은 연도 단위 한계가 있음.
- 첨부본에는 manifest·아이콘·서비스 워커가 없음. 이번 수정은 웹 흐름·보안 개선이며 설치형/오프라인 PWA 완성을 포함하지 않음.
- 기존 terms/privacy는 요청대로 수정하지 않음. 기재된 30일 자동 보관/1년 미접속 자동 파기 작업은 원본에도 없었으며 이번 수정에서도 추가하지 않음. 실제 DB 리전, 제공 범위(매장에 호출 좌표가 전달됨), 회원 탈퇴 범위와 문구 정합성을 출시 전 별도로 확인.
- 모든 승인 매장은 자기 업종의 탐색 중 호출을 읽음. Firestore는 문서 필드별 숨김을 지원하지 않으며 서버의 정밀 반경별 fan-out은 미구현. 응답 쓰기에는 실제 거리/최소인원을 검증하지만 수신된 탐색 호출의 위치 열람 자체를 반경 안으로 제한하지는 못함.
- 리뷰/좋아요/댓글 수·포인트는 서버 이벤트로 갱신되어 화면 반영에 잠깐 지연이 있음. 매우 큰 게시물 댓글/좋아요·매장 리뷰 집계는 전체 문서를 재계산하므로 규모 확장 시 집계 구조 개선 필요.
- MY 데이터 내려받기는 기존 프로필·호출·history 범위. 전체 리뷰/댓글/좋아요/포인트를 포함하는 완전한 자료 요청 기능은 별도 보완 필요.

## 운영 확인 시나리오

- [ ] 신규 사용자 가입·닉네임·재로그인. 미성년 입력/존재하지 않는 생일 거부.
- [ ] 일반 호출 → 매장 A/B 응답 → 하나 선택 → 다른 매장이 완료 처리 불가.
- [ ] 직접호출 → 가능 → 30초 안에 갈게요 → 15분 도착. 불가/10분후/타임아웃 시 종료.
- [ ] 도착 마감 전에 노쇼 금지, 마감 후 done 금지. 브라우저를 닫아도 예약 함수가 노쇼 처리.
- [ ] 새로고침/다중 탭에서도 30분 패널티와 한 건 호출 제한 유지.
- [ ] 실제 done 방문만 리뷰 가능, 1~5점 검증. 리뷰 삭제/재작성으로 포인트 반복 획득 불가.
- [ ] 다른 사람 글에 댓글/좋아요 가능. 중복 좋아요 금지. 부모 삭제 시 하위 문서 정리.
- [ ] 일반 사용자의 승인·소유자·평점·포인트·패널티 직접 변경 거부.
- [ ] 재발급 후 새 비밀번호 로그인·기존 UID 유지·사진 업로드·매장 응답 확인.
- [ ] 최근 재로그인 후 탈퇴 → Auth 및 프로필·호출·리뷰·글·댓글·좋아요·포인트 삭제 확인.

## 공식 문서

- GitHub Pages 도메인: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- Firebase 관리자 계정/비밀번호: https://firebase.google.com/docs/auth/admin/manage-users
- Callable 함수: https://firebase.google.com/docs/functions/callable
- Firebase 승인 도메인: https://firebase.google.com/docs/auth/faq-and-troubleshooting
- 카카오맵: https://apis.map.kakao.com/web/guide/
