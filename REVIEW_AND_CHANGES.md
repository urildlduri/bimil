# BIMILCALL 코드 리뷰 및 부분 수정 내역

2026-10-31. 첨부 ZIP의 10개 파일을 전체 읽은 뒤 수정했습니다. GitHub `urildlduri/bimil`의 HTML/JS/CSS/약관은 첨부본과 Git blob SHA가 일치합니다. 저장소의 firestore.rules는 첨부본과 달라 별도로 전체 읽었고, 로그인 사용자 전체에 상태 변경·평점·카운터 갱신 권한을 주는 더 오래된 규칙임을 확인했습니다. 아래 코드 비교의 기준은 사용자가 첨부한 ZIP입니다.

## 먼저 확인한 문제

| 심각도 | 위치/함수 | 원본 문제 | 처리 |
|---|---|---|---|
| 높음 | firestore.rules / calls, responses, biz | 남의 호출·매장 변경, 누구나 응답 위조, 직접 승인 | 소유 UID·승인·응답 기록·상태 전환·변경 필드 검사 |
| 높음 | bc-core.js / userIdSignup | 가입 전 users 조회가 인증 규칙에 거부됨 | 조회 제거, Auth의 이메일 유일성 검사 사용 |
| 높음 | bc-core.js / ensureProfile, onAuth | 가입 이벤트와 프로필 생성 경합·실패 시 화면 중단 | 프로필 직렬화 및 출생연도 보완, 에러 처리 |
| 높음 | user.html / 댓글 전체 | commCommentUnsub, curCommPostId, commCommentNick 미선언 | 실제 상태 변수 선언 |
| 높음 | user.html / openMatched | 시간이 지나도 타이머 정지만 하고 노쇼 미처리 | 서버 만료 함수·매분 예약 처리 및 새 호출 시 재검사 |
| 높음 | user.html / awardPoints, noShow / users rules | 포인트 무제한 적립·패널티 삭제·탈퇴 전 프로필 삭제 가능 | 서버 원장 정산·서버 생성 잠금·직접 변경 차단 |
| 높음 | user.html / arrive, reviews | 콘솔에서 셀프 도착완료 후 리뷰·포인트 위조 | 사용자 done 변경 금지, 실제 calls done 및 callId 증명 검사 |
| 높음 | HTML innerHTML 경로 | 매장명·닉네임·리뷰·메뉴·URL의 저장형 XSS | HTML 이스케이프, inline 인수 인코딩, URL 프로토콜 제한 |
| 높음 | firestore/storage / isAdmin | whitelist 이메일의 미인증 가입 사칭 | email_verified 확인 추가 |
| 중간 | user.html / 좋아요·댓글 수 | 타인 글 갱신 거부 또는 카운터 임의 조작 | likes/{uid} 1회 생성, 서버 실문서 집계 |
| 중간 | user.html / deleteAccount | modular SDK에 없는 user.delete 사용, 하위 문서 남기고 완료 표시 | 서버에서 재로그인 확인 후 Auth·본인 데이터 재귀 삭제 |
| 중간 | 직접호출 복원 | searching 상태의 직접호출을 일반 검색 화면으로 복원 | 원래 직접호출 화면·잔여 시간·리스너 복원 |
| 중간 | 호출 중복/갱신 | 여러 탭에서 중복 호출, 초기화 시 going 삭제 대상 포함 | 서버 프로필 잠금 activeCallId, 활성 상태를 정리 대상에서 제외 |
| 중간 | merchant.html | 리스너 누수·busy/closed 전환·마감 후 응답 등 | 기존 구독 해제, 마감·거리·인원 검증, 응답 오류 표시 |
| 중간 | admin.html | 전역 event 의존, 실패 후 성공 토스트, 상태 집계 누락 | 버튼 인수 전달, 실패 시 return, accepted/going 집계 |
| 낮음 | copyMcCreds | ohdiga.com 잔존 | NW.SITE_URL 한 곳으로 통합 |
| 확인 필요 | 약관·PWA·기존 매장 ID | 첨부에 PWA 리소스 없음, 보관·파기 자동화 미구현, 예전 랜덤 매장 ID | 보존 요청 범위를 유지하고 DEPLOYMENT.md에 잔여사항 명시 |

## 수정 원칙

- HTML/JS는 기존 파일에 부분 수정만 적용했습니다. 아래 diff의 `-`는 기존 코드, `+`는 새 코드이며 @@에 기존/신규 행 위치가 있습니다.
- `.rules`는 아래 전체 내용을 제공합니다. 승인/소유자/포인트/패널티/평점/카운터는 클라이언트가 임의 변경할 수 없어야 하므로 서버로 이동했습니다.
- NW.merchantLogin, NW.adminCreateMerchant, NW.uploadBizPhoto는 본문을 그대로 보존했고 SHA-256으로 검사했습니다. 사진 파일 업로드 UI, 매장 생성 패널, 커뮤니티 댓글 UI와 terms/privacy 문서도 유지했습니다.
- Storage 규칙은 관리자 이메일 사칭과 비승인 업로드를 막기 위해 보완했습니다. 사진 경로·업로드 API는 바꾸지 않았습니다.
- 관리자 계정의 비밀번호를 클라이언트에서 다른 사용자의 것으로 바꾸는 것은 불가합니다. 계정 재생성 대신 Admin SDK 서버 함수로 기존 UID를 유지하는 방법을 구현했습니다.

## 새로 추가한 API와 데이터(기존 API인 것처럼 가정하지 않음)

| 구분 | 새 이름/필드 | 목적 |
|---|---|---|
| NW 설정 | SITE_URL, FUNCTIONS_REGION | 배포 주소·함수 지역 |
| NW 유틸 | html, inline, safeURL | HTML·인라인 문자열·URL 안전 처리 |
| NW 함수 | callServer, createCall, expireCall, adminResetMerchantPassword | 신규 callable 연결 |
| callable | createCall, expireCall, adminResetMerchantPassword, deleteMyAccount | 서버 검증·재발급·삭제 |
| 이벤트/스케줄 | settleCall, settleReview, countComments, countLikes, cleanCallChildren, cleanPostChildren, expireCalls | 원장·집계·만료·하위 문서 정리 |
| users | activeCallId, deleting | 중복 호출 제어·탈퇴 중 쓰기 차단 |
| reviews | callId | 실제 도착 문서를 규칙에서 검사 |
| community 서브 | likes/{uid} | 1인 1회 좋아요 |
| points 서브 ID | callId_status, review_bizId | 이벤트 중복·리뷰 삭제/재작성 반복 적립 방지 |

## 검증과 배포

`tests/static.cjs`, `tests/security.cjs`, `tests/backend.cjs`에 재현 가능한 검증을 담았습니다. 에뮬레이터 프로젝트는 demo-bimilcall이며 운영 데이터에 테스트하지 않았습니다. 자세한 배포·도메인·Firebase 직접 설정은 DEPLOYMENT.md 참조.

실제 운영 브라우저에서 카카오 도메인, Firebase 구성, 초기 데이터, 결제/API/IAM, GitHub Pages 동작까지 확인한 상태는 아닙니다. 배포 연결이 완료되면 이 검증을 이어가야 합니다.

## bc-core.js / 아래 @@의 행 위치 / 기존 코드 → 새 코드

```diff
--- a/bc-core.js
+++ b/bc-core.js
@@ -14,6 +14,21 @@
 
 const NW = {};
 window.NW = NW;
+// 배포 주소는 이 한 곳에서 관리. 커스텀 도메인 확정 전에는 현재 배포 URL 사용.
+NW.SITE_URL = new URL('./', window.location.href).href;
+NW.FUNCTIONS_REGION = 'asia-northeast3';
+NW.html = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
+// onclick의 작은따옴표 문자열 안에 삽입할 값. HTML/JS 양쪽 탈출 차단.
+NW.inline = value => String(value ?? '').split('').map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
+NW.safeURL = value => { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; } };
+NW.callServer = async function(name, data={}) {
+  await NW.fbReady;
+  const F = await import(FB_BASE+'firebase-functions.js');
+  return (await F.httpsCallable(F.getFunctions(NW.app,NW.FUNCTIONS_REGION),name)(data)).data;
+};
+NW.createCall = data => NW.callServer('createCall',data);
+NW.expireCall = callId => NW.callServer('expireCall',{callId});
+NW.adminResetMerchantPassword = bizId => NW.callServer('adminResetMerchantPassword',{bizId});
 
 /* ── 카카오맵 (JavaScript 키 · 무료) ── */
 NW.KAKAO_KEY = "56d96a0427d001e4d5fd597bd5e458e0";
@@ -202,12 +217,13 @@
   // 아이디 검증
   if(!/^[a-zA-Z0-9_]{4,16}$/.test(userId)) throw new Error('아이디는 영문/숫자/_ 4~16자여야 합니다');
   // 만 19세 검증
-  const age = new Date().getFullYear() - parseInt(birthYear);
-  if(age < 19) throw new Error('만 19세 이상만 가입 가능합니다');
-  // 아이디 중복 체크 (users 컬렉션의 userId 필드)
-  const {collection, query, where, getDocs, createUserWithEmailAndPassword, updateProfile} = NW.fb;
-  const dupSnap = await getDocs(query(collection(NW.db,'users'), where('userId','==',userId.toLowerCase().trim())));
-  if(!dupSnap.empty) throw new Error('이미 사용 중인 아이디입니다');
+  const year = Number(birthYear);
+  const age = new Date().getFullYear() - year;
+  if(!Number.isInteger(year) || year < 1920 || age < 19) throw new Error('만 19세 이상만 가입 가능합니다');
+  // Firebase Auth가 아이디(가상 이메일) 중복을 원자적으로 검사한다.
+  // 비로그인 users 쿼리는 금지된 상태를 유지한다.
+  const {createUserWithEmailAndPassword, updateProfile} = NW.fb;
+  if(typeof password!=='string' || password.length<8) throw new Error('비밀번호는 8자 이상이어야 합니다');
 
   const fakeEmail = NW.userIdToFakeEmail(userId);
   const res = await createUserWithEmailAndPassword(NW.auth, fakeEmail, password);
@@ -268,16 +284,16 @@
   const u=NW.user;
   const nick = (NW.profile?.nickname) || u.displayName || '익명';
   const initial = nick.trim().charAt(0).toUpperCase();
-  const avatar = `<div style="width:30px;height:30px;border-radius:50%;background:var(--y);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${initial}</div>`;
+  const avatar = `<div style="width:30px;height:30px;border-radius:50%;background:var(--y);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${NW.html(initial)}</div>`;
   el.style.position='relative';
   el.innerHTML=`
     <button id="nwAcctBtn" style="background:var(--bg2);border:1px solid var(--bd);border-radius:30px;padding:4px 10px 4px 4px;display:flex;align-items:center;gap:8px">
-      ${avatar}<span style="font-size:13px;font-weight:700;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--y)">${nick}</span>
+      ${avatar}<span style="font-size:13px;font-weight:700;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--y)">${NW.html(nick)}</span>
       <span style="color:var(--tx3);font-size:10px">▼</span>
     </button>
     <div id="nwAcctMenu" class="hide" style="position:absolute;right:0;top:46px;background:var(--bg2);border:1px solid var(--bd);border-radius:12px;padding:8px;min-width:200px;z-index:120;box-shadow:0 8px 24px rgba(0,0,0,.4)">
       <div style="padding:10px 12px;border-bottom:1px solid var(--bd);margin-bottom:6px">
-        <div style="font-size:13px;font-weight:800;color:var(--y)">🎭 ${nick}</div>
+        <div style="font-size:13px;font-weight:800;color:var(--y)">🎭 ${NW.html(nick)}</div>
         <div style="font-size:11px;color:var(--tx3);margin-top:2px">완전 익명</div>
       </div>
       <button onclick="NW.logout()" style="width:100%;text-align:left;background:none;padding:10px 12px;border-radius:8px;font-size:14px;font-weight:600;color:var(--no)">로그아웃</button>
@@ -294,14 +310,22 @@
     // 리다이렉트 로그인에서 돌아온 경우 결과 수거
     try{ if(NW.fb.getRedirectResult) await NW.fb.getRedirectResult(NW.auth); }catch(e){ console.warn('redirect result',e); }
     NW.fb.onAuthStateChanged(NW.auth, async u=>{
-      if(u){NW.uid=u.uid;NW.user=u;await NW.ensureProfile(u);}
+      if(u){
+        NW.uid=u.uid;NW.user=u;
+        try { await NW.ensureProfile(u); } catch(e) { console.error('profile',e); NW.toast('프로필을 읽지 못했습니다. 새로고침해주세요'); return; }
+      }else{ NW.uid=null;NW.user=null;NW.profile=null; }
       cb(u);
     });
   });
 };
 
 /* 프로필 문서 생성/조회 (users/{uid}) */
-NW.ensureProfile = async function(u, extra){
+NW._profileQueue = Promise.resolve();
+NW.ensureProfile = function(u, extra){
+  const task=NW._profileQueue.catch(()=>{}).then(()=>NW._ensureProfile(u,extra));
+  NW._profileQueue=task; return task;
+};
+NW._ensureProfile = async function(u, extra){
   const {doc,getDoc,setDoc,serverTimestamp}=NW.fb;
   const ref=doc(NW.db,'users',u.uid);
   const s=await getDoc(ref);
@@ -320,6 +344,10 @@
     NW.profile = profile;
   }else{
     NW.profile = s.data();
+    if(extra && NW.profile.birthYear==null){
+      await setDoc(ref,{userId:extra.userId,nickname:extra.nickname,birthYear:extra.birthYear},{merge:true});
+      Object.assign(NW.profile,extra);
+    }
     if(!NW.profile.nickname){
       const nick = NW.genNickname();
       await setDoc(ref, {nickname:nick}, {merge:true});
@@ -415,7 +443,7 @@
   return await getDownloadURL(ref);
 };
 
-NW.isAdmin = u => !!(u && u.email && NW.ADMIN_EMAILS.includes(u.email));
+NW.isAdmin = u => !!(u && u.email && u.emailVerified && NW.ADMIN_EMAILS.includes(u.email.toLowerCase()));
 
 /* 계정의 단일 역할 판별: 'admin' | 'merchant' | 'user'
    - 관리자 이메일 → admin
@@ -454,17 +482,11 @@
 NW.myBusiness = async function(){
   if(!NW.uid) return null;
   const {collection,query,where,getDocs}=NW.fb;
-  const [byOwner, byMember] = await Promise.all([
-    getDocs(query(collection(NW.db,'biz'),where('ownerId','==',NW.uid))).catch(()=>({docs:[]})),
-    NW.user?.email
-      ? getDocs(query(collection(NW.db,'biz'),where('memberEmails','array-contains',NW.user.email))).catch(()=>({docs:[]}))
-      : Promise.resolve({docs:[]})
-  ]);
+  const byOwner=await getDocs(query(collection(NW.db,'biz'),where('ownerId','==',NW.uid)));
   const map=new Map();
   byOwner.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data(),_role:'owner'}));
-  byMember.docs.forEach(d=>{ if(!map.has(d.id)) map.set(d.id,{id:d.id,...d.data(),_role:'member'}); });
   const list=[...map.values()];
   if(!list.length) return null;
-  return list.find(b=>b.approved)||list[0];
-};
-
+  return list.find(b=>b.approved && b.id===NW.uid)||list.find(b=>b.approved)||list[0];
+};
+
```

## index.html / 아래 @@의 행 위치 / 기존 코드 → 새 코드

```diff
--- a/index.html
+++ b/index.html
@@ -119,7 +119,9 @@
 // 스플래시
 setTimeout(()=>{const sp=$('splash');sp.style.opacity='0';setTimeout(()=>sp.style.display='none',500);},1200);
 
+let signupInProgress=false;
 NW.onAuth(async u=>{
+  if(signupInProgress)return;
   if(u){ await afterLogin(u); }
   else {
     showScr('loginScr');
@@ -184,20 +186,23 @@
   if(pw !== pw2){ toast('비밀번호가 일치하지 않습니다'); return; }
   if(!by || by < 1920 || by > new Date().getFullYear()){ toast('출생연도를 확인해주세요'); return; }
   if(!bm || bm < 1 || bm > 12 || !bd || bd < 1 || bd > 31){ toast('생년월일을 확인해주세요'); return; }
-  const age = new Date().getFullYear() - by;
+  const today=new Date(), birth=new Date(by,bm-1,bd);
+  if(birth.getFullYear()!==by || birth.getMonth()!==bm-1 || birth.getDate()!==bd){toast('존재하는 생년월일을 입력해주세요');return;}
+  const age = today.getFullYear()-by-((today.getMonth()<bm-1 || (today.getMonth()===bm-1 && today.getDate()<bd))?1:0);
   if(age < 19){ toast('만 19세 이상만 가입 가능합니다'); return; }
   if(!$('suAgree1').checked){ toast('약관 동의가 필요합니다'); return; }
   if(!$('suAgree2').checked){ toast('19세 이상 확인 동의가 필요합니다'); return; }
   if(!signupNick) rerollSignupNick();
 
   try{
+    signupInProgress=true;
     const u = await NW.userIdSignup({userId, password:pw, nickname:signupNick, birthYear:by});
     toast('🎉 가입 완료! 환영합니다, '+signupNick);
     setTimeout(()=>afterLogin(u), 600);
   }catch(e){
     const msg = errMsg(e.code) || e.message;
     toast('가입 실패: '+msg);
-  }
+  }finally{signupInProgress=false;}
 };
 
 function errMsg(code){
```

## admin.html / 아래 @@의 행 위치 / 기존 코드 → 새 코드

```diff
--- a/admin.html
+++ b/admin.html
@@ -55,7 +55,7 @@
       <input type="hidden" id="mcLng">
     </div>
     <div style="padding:0 16px 16px">
-      <button class="adm-btn" style="background:var(--y);color:#000;width:100%;justify-content:center" onclick="createMerchantNow()">계정 생성하기</button>
+      <button class="adm-btn" style="background:var(--y);color:#000;width:100%;justify-content:center" onclick="createMerchantNow(this)">계정 생성하기</button>
     </div>
     <div id="mcResult" class="hide" style="padding:0 16px 16px"></div>
     <div style="padding:0 16px 16px">
@@ -180,7 +180,7 @@
 let callsUnsub=null, bizUnsub=null;
 
 const ST={
-  searching:['탐색중','st-search'], matched:['매칭','st-match'], done:['입장완료','st-done'],
+  searching:['탐색중','st-search'], accepted:['확정대기','st-match'], going:['이동중','st-match'], matched:['매칭','st-match'], done:['입장완료','st-done'],
   noshow:['노쇼','st-noshow'], expired:['응답없음','st-expired'], cancelled:['취소','st-cancelled']
 };
 const BST={open:['영업중','st-open'],busy:['혼잡','st-busy'],closed:['마감','st-closed']};
@@ -223,15 +223,15 @@
     const t=r.at?.toDate?r.at.toDate():null;
     const ts=t?`${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`:'';
     return `<div class="adm-row">
-      <div class="mid"><b>${'⭐'.repeat(r.rating||0)} ${r.bizName||'?'}</b>
-      <small>${(r.text||'').slice(0,80)} · ${r.userName||r.uid?.slice(0,6)||'?'} · ${ts}</small></div>
-      <button class="adm-btn danger" style="padding:6px 10px" onclick="delReview('${r.id}')">삭제</button></div>`;
+      <div class="mid"><b>${'⭐'.repeat(Math.max(0,Math.min(5,Number(r.rating)||0)))} ${NW.html(r.bizName||'?')}</b>
+      <small>${NW.html((r.text||'').slice(0,80))} · ${NW.html(r.userName||r.uid?.slice(0,6)||'?')} · ${ts}</small></div>
+      <button class="adm-btn danger" style="padding:6px 10px" onclick="delReview('${NW.inline(r.id)}')">삭제</button></div>`;
   }).join('');
 }
 window.delReview=async(id)=>{
   if(!confirm('이 리뷰를 삭제할까요?'))return;
   const {doc,deleteDoc}=NW.fb;
-  await deleteDoc(doc(NW.db,'reviews',id)).catch(e=>toast('실패: '+e.message));
+  try{ await deleteDoc(doc(NW.db,'reviews',id)); }catch(e){toast('실패: '+e.message);return;}
   toast('리뷰 삭제 완료');
 };
 
@@ -240,7 +240,7 @@
 function render(){
   const live=calls.filter(isLive).length;
   const total=calls.length;
-  const match=calls.filter(c=>['matched','done'].includes(c.status)).length;
+  const match=calls.filter(c=>['accepted','going','matched','done'].includes(c.status)).length;
   const noshow=calls.filter(c=>c.status==='noshow').length;
   const finished=calls.filter(c=>c.status!=='searching').length;
   const rate=finished? Math.round((match/finished)*100):0;
@@ -258,10 +258,10 @@
     const ts=t?`${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`:'--';
     let extra='';
     if(isLive(c)){const left=(tsMs(c.expiresAt)-nowMs())/1000;extra=` · ⏱${fmtT(left)}`;}
-    else if(c.status==='matched'&&c.matchExpiresAt){const left=(tsMs(c.matchExpiresAt)-nowMs())/1000;extra=left>0?` · 입장 ${fmtT(left)}`:' · 시간초과';}
-    const where=c.matchedBizName?` → ${c.matchedBizName}`:'';
+    else if(['going','matched'].includes(c.status)&&c.matchExpiresAt){const left=(tsMs(c.matchExpiresAt)-nowMs())/1000;extra=left>0?` · 입장 ${fmtT(left)}`:' · 시간초과';}
+    const where=c.matchedBizName?` → ${NW.html(c.matchedBizName)}`:'';
     return `<div class="adm-row"><div class="em">${cat.e}</div>
-      <div class="mid"><b>${c.party}명 · ${cat.n}${where}</b><small>${ts}${extra} · ${c.id.slice(0,6)}</small></div>
+      <div class="mid"><b>${NW.html(c.party)}명 · ${NW.html(cat.n)}${where}</b><small>${ts}${extra} · ${NW.html(c.id.slice(0,6))}</small></div>
       <span class="st ${st[1]}">${st[0]}</span></div>`;
   }).join('');
 }
@@ -273,46 +273,47 @@
   if(!pending.length){$('pendList').innerHTML='<div class="adm-empty">대기 중인 신청이 없습니다.</div>';}
   else $('pendList').innerHTML=pending.map(b=>{const cat=catOf(b.cat);
     return `<div class="adm-row"><div class="em">${cat.e}</div>
-      <div class="mid"><b>${b.name||'매장'}</b>
-      <small>${cat.n} · ${b.ownerName||b.ownerEmail||'?'} · ${(b.lat||0).toFixed(3)},${(b.lng||0).toFixed(3)}</small></div>
+      <div class="mid"><b>${NW.html(b.name||'매장')}</b>
+      <small>${NW.html(cat.n)} · ${NW.html(b.ownerName||b.ownerEmail||'?')} · ${(b.lat||0).toFixed(3)},${(b.lng||0).toFixed(3)}</small></div>
       <div style="display:flex;gap:6px">
-        <button class="adm-btn" style="padding:7px 12px;color:var(--ok);border-color:var(--ok)" onclick="approve('${b.id}')">승인</button>
-        <button class="adm-btn danger" style="padding:7px 12px" onclick="reject('${b.id}','${(b.name||'').replace(/'/g,'')}')">거절</button>
+        <button class="adm-btn" style="padding:7px 12px;color:var(--ok);border-color:var(--ok)" onclick="approve('${NW.inline(b.id)}')">승인</button>
+        <button class="adm-btn danger" style="padding:7px 12px" onclick="reject('${NW.inline(b.id)}','${NW.inline((b.name||'').replace(/'/g,''))}')">거절</button>
       </div></div>`;}).join('');
   // 승인 매장
   $('bizCnt').textContent=approved.length+'곳';$('sBiz').textContent=approved.length;
   if(!approved.length){$('bizList').innerHTML='<div class="adm-empty">승인된 매장이 없습니다.</div>';return;}
   $('bizList').innerHTML=approved.map(b=>{const cat=catOf(b.cat);const st=BST[b.status]||['?','st-closed'];
-    const rating=b.ratingAvg?`⭐ ${(+b.ratingAvg).toFixed(1)}(${b.ratingCount||0})`:'';
+    const rating=b.ratingAvg?`⭐ ${(+b.ratingAvg).toFixed(1)}(${NW.html(b.ratingCount||0)})`:'';
     const hotBtn=b.isHot
-      ? `<button class="adm-btn" style="padding:6px 10px;color:var(--y);border-color:var(--y)" onclick="toggleHot('${b.id}',false)">🔥 핫플 ON</button>`
-      : `<button class="adm-btn" style="padding:6px 10px" onclick="toggleHot('${b.id}',true)">🔥 핫플 OFF</button>`;
+      ? `<button class="adm-btn" style="padding:6px 10px;color:var(--y);border-color:var(--y)" onclick="toggleHot('${NW.inline(b.id)}',false)">🔥 핫플 ON</button>`
+      : `<button class="adm-btn" style="padding:6px 10px" onclick="toggleHot('${NW.inline(b.id)}',true)">🔥 핫플 OFF</button>`;
     return `<div class="adm-row"><div class="em">${cat.e}</div>
-      <div class="mid"><b>${b.name||'매장'} ${b.demo?'<span style="color:var(--tx3);font-size:11px">[데모]</span>':''}</b>
-      <small>${cat.n} · 반경 ${distLabel(b.radius||1000)} · ${b.ownerName||b.ownerEmail||'데모'} ${rating?'· '+rating:''}</small></div>
+      <div class="mid"><b>${NW.html(b.name||'매장')} ${b.demo?'<span style="color:var(--tx3);font-size:11px">[데모]</span>':''}</b>
+      <small>${NW.html(cat.n)} · 반경 ${distLabel(b.radius||1000)} · ${NW.html(b.ownerName||b.ownerEmail||'데모')} ${rating?'· '+rating:''}</small></div>
       <span class="st ${st[1]}">${st[0]}</span>
       <div style="display:flex;gap:6px;flex-shrink:0">
         ${hotBtn}
-        <button class="adm-btn danger" style="padding:6px 10px" onclick="reject('${b.id}','${(b.name||'').replace(/'/g,'')}')">삭제</button>
+        ${b.merchantId?`<button class="adm-btn" onclick="resetMerchantPassword('${NW.inline(b.id)}',this)">비밀번호 재발급</button>`:''}
+        <button class="adm-btn danger" style="padding:6px 10px" onclick="reject('${NW.inline(b.id)}','${NW.inline((b.name||'').replace(/'/g,''))}')">삭제</button>
       </div></div>`;}).join('');
 }
 
 window.toggleHot=async(id,on)=>{
   const {doc,updateDoc}=NW.fb;
-  await updateDoc(doc(NW.db,'biz',id),{isHot:on}).catch(e=>toast('실패: '+e.message));
+  try{ await updateDoc(doc(NW.db,'biz',id),{isHot:on}); }catch(e){toast('실패: '+e.message);return;}
   toast(on?'🔥 핫플로 등록됨':'핫플에서 제외됨');
 };
 
 /* ── 파트너 승인/거절/삭제 ── */
 window.approve=async(id)=>{
   const {doc,updateDoc}=NW.fb;
-  await updateDoc(doc(NW.db,'biz',id),{approved:true}).catch(e=>toast('승인 실패: '+e.message));
+  try{ await updateDoc(doc(NW.db,'biz',id),{approved:true}); }catch(e){toast('승인 실패: '+e.message);return;}
   toast('✓ 매장 승인 완료');
 };
 window.reject=async(id,name)=>{
   if(!confirm(`"${name||'이 매장'}"을(를) 삭제할까요?`))return;
   const {doc,deleteDoc}=NW.fb;
-  await deleteDoc(doc(NW.db,'biz',id)).catch(e=>toast('삭제 실패: '+e.message));
+  try{ await deleteDoc(doc(NW.db,'biz',id)); }catch(e){toast('삭제 실패: '+e.message);return;}
   toast('매장 삭제 완료');
 };
 /* 데모 매장(승인 상태) 생성 — 관리자 위치 기준 */
@@ -323,7 +324,7 @@
   });
   const {collection,addDoc,serverTimestamp}=NW.fb;
   const off=[[0.0012,0.0008],[-0.0009,0.0014],[0.0018,-0.0006]];
-  const demos=[{name:'데모 라운지펍',cat:'pub'},{name:'데모 코인노래방',cat:'karaoke'},{name:'데모 방탈출 강남',cat:'escape'}];
+  const demos=[{name:'데모 노래주점',cat:'karaoke_bar'},{name:'데모 노래연습장',cat:'karaoke'},{name:'데모 스파',cat:'spa'}];
   for(let i=0;i<demos.length;i++){
     await addDoc(collection(NW.db,'biz'),{...demos[i],radius:2000,
       lat:loc.lat+off[i][0],lng:loc.lng+off[i][1],status:'open',approved:true,
@@ -335,11 +336,11 @@
 /* ── 테스트용 정리 도구 ── */
 async function delDocs(arr,col){
   const {doc,deleteDoc}=NW.fb;let n=0;
-  for(const d of arr){await deleteDoc(doc(NW.db,col,d.id)).catch(()=>{});n++;}
+  for(const d of arr){try{ await deleteDoc(doc(NW.db,col,d.id));n++; }catch(e){toast('일부 삭제 실패: '+e.message);}}
   return n;
 }
 window.cleanFinished=async()=>{
-  const target=calls.filter(c=>c.status!=='searching'&&c.status!=='matched');
+  const target=calls.filter(c=>!['searching','accepted','going','matched'].includes(c.status));
   if(!target.length){toast('정리할 종료 호출이 없어요.');return;}
   if(!confirm(`종료된 호출 ${target.length}건을 삭제할까요?`))return;
   const n=await delDocs(target,'calls');toast(`${n}건 정리 완료`);
@@ -366,7 +367,7 @@
   const panel = $('merchantCreator');
   panel.classList.toggle('hide');
   if(!panel.classList.contains('hide')){
-    $('mcCat').innerHTML = NW.CATS.map(c=>`<option value="${c.k}">${c.e} ${c.n}</option>`).join('');
+    $('mcCat').innerHTML = NW.CATS.map(c=>`<option value="${c.k}">${c.e} ${NW.html(c.n)}</option>`).join('');
     renderMcHistory();
   }
 };
@@ -400,7 +401,7 @@
   }
 };
 
-window.createMerchantNow=async()=>{
+window.createMerchantNow=async(btn)=>{
   const name = $('mcName').value.trim();
   const cat = $('mcCat').value;
   const addr = $('mcAddr').value.trim();
@@ -411,7 +412,6 @@
   if(!addr){ toast('주소를 입력해주세요'); return; }
   if(isNaN(lat)||isNaN(lng)){ toast('📍 좌표 찾기 버튼을 먼저 눌러주세요'); return; }
 
-  const btn = event.target;
   btn.disabled = true; btn.textContent = '생성 중…';
   try{
     const result = await NW.adminCreateMerchant({name, cat, addr, lat, lng});
@@ -434,23 +434,37 @@
   el.classList.remove('hide');
   el.innerHTML = `
     <div style="background:var(--okbg);border:1.5px solid var(--ok);border-radius:10px;padding:14px">
-      <div style="font-size:13px;font-weight:700;color:var(--ok);margin-bottom:10px">✅ "${name}" 계정 생성 완료 — 사장님께 전달하세요</div>
+      <div style="font-size:13px;font-weight:700;color:var(--ok);margin-bottom:10px">✅ "${NW.html(name)}" 계정 생성 완료 — 사장님께 전달하세요</div>
       <div style="background:var(--bg2);border-radius:8px;padding:12px;font-family:var(--mono)">
         <div style="display:flex;justify-content:space-between;margin-bottom:6px">
           <span style="color:var(--tx3);font-size:12px">아이디</span>
-          <b style="font-size:14px">${result.merchantId}</b>
+          <b style="font-size:14px">${NW.html(result.merchantId)}</b>
         </div>
         <div style="display:flex;justify-content:space-between">
           <span style="color:var(--tx3);font-size:12px">비밀번호</span>
-          <b style="font-size:14px">${result.password}</b>
+          <b style="font-size:14px">${NW.html(result.password)}</b>
         </div>
       </div>
-      <button onclick="copyMcCreds('${result.merchantId}','${result.password}')" style="width:100%;margin-top:10px;background:var(--ok);color:#fff;padding:9px;border-radius:8px;font-size:12px;font-weight:700">📋 복사하기</button>
+      <button onclick="copyMcCreds('${NW.inline(result.merchantId)}','${NW.inline(result.password)}')" style="width:100%;margin-top:10px;background:var(--ok);color:#fff;padding:9px;border-radius:8px;font-size:12px;font-weight:700">📋 복사하기</button>
     </div>`;
 }
 
+window.resetMerchantPassword=async(bizId,btn)=>{
+  if(!confirm('새 비밀번호를 발급할까요? 기존 비밀번호는 즉시 사용할 수 없게 됩니다.'))return;
+  btn.disabled=true;
+  try{
+    const result=await NW.adminResetMerchantPassword(bizId);
+    const b=biz.find(x=>x.id===bizId);
+    $('merchantCreator').classList.remove('hide');
+    renderMcResult(result,(b?.name||'매장')+' — 비밀번호 재발급');
+    $('mcResult').scrollIntoView({behavior:'smooth',block:'center'});
+    toast('재발급 완료. 새 비밀번호를 전달해주세요');
+  }catch(e){toast('재발급 실패: '+e.message);}
+  finally{btn.disabled=false;}
+};
+
 window.copyMcCreds=(id,pw)=>{
-  const text = `[BIMILCALL 매장 로그인]\n아이디: ${id}\n비밀번호: ${pw}\nohdiga.com 에서 로그인하세요.`;
+  const text = `[BIMILCALL 매장 로그인]\n아이디: ${id}\n비밀번호: ${pw}\n${NW.SITE_URL} 에서 로그인하세요.`;
   navigator.clipboard.writeText(text).then(()=>toast('📋 복사됨')).catch(()=>toast('복사 실패 — 직접 선택해주세요'));
 };
 
@@ -459,8 +473,8 @@
   if(!mcHistoryList.length){ el.innerHTML='<div class="muted" style="font-size:12px">아직 생성한 계정이 없어요.</div>'; return; }
   el.innerHTML = mcHistoryList.map(m=>`
     <div style="background:var(--bg2);border:1px solid var(--bd);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;font-size:12px">
-      <div><b>${m.name}</b><div style="color:var(--tx3);font-family:var(--mono);margin-top:2px">${m.merchantId} / ${m.password}</div></div>
-      <button onclick="copyMcCreds('${m.merchantId}','${m.password}')" style="background:var(--bg3);color:var(--y);padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700">복사</button>
+      <div><b>${NW.html(m.name)}</b><div style="color:var(--tx3);font-family:var(--mono);margin-top:2px">${NW.html(m.merchantId)} / ${NW.html(m.password)}</div></div>
+      <button onclick="copyMcCreds('${NW.inline(m.merchantId)}','${NW.inline(m.password)}')" style="background:var(--bg3);color:var(--y);padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700">복사</button>
     </div>`).join('');
 }
 
@@ -539,7 +553,7 @@
 
     $('dBizByCat').innerHTML = Object.entries(byCatMap).map(([cat,n])=>{
       const c = NW.CATS.find(x=>x.k===cat) || {e:'❓', n:cat};
-      return `<span style="background:var(--bg3);padding:5px 10px;border-radius:8px;font-size:12px;font-weight:700">${c.e} ${c.n}: <b style="color:var(--y)">${n}</b></span>`;
+      return `<span style="background:var(--bg3);padding:5px 10px;border-radius:8px;font-size:12px;font-weight:700">${c.e} ${NW.html(c.n)}: <b style="color:var(--y)">${n}</b></span>`;
     }).join('') || '<span class="muted" style="font-size:12px">데이터 없음</span>';
   }catch(e){console.warn('biz 통계 실패',e);}
 
@@ -587,7 +601,7 @@
     $('dPostsLikes').textContent=pLikes.toLocaleString();
     $('dPostsByCat').innerHTML = Object.entries(byCatMap).map(([cat,n])=>{
       const lbl = COMM_CAT_NAMES[cat]||cat;
-      return `<span style="background:var(--bg3);padding:5px 10px;border-radius:8px;font-size:12px;font-weight:700">${lbl}: <b style="color:var(--y)">${n}</b></span>`;
+      return `<span style="background:var(--bg3);padding:5px 10px;border-radius:8px;font-size:12px;font-weight:700">${NW.html(lbl)}: <b style="color:var(--y)">${n}</b></span>`;
     }).join('') || '<span class="muted" style="font-size:12px">데이터 없음</span>';
   }catch(e){console.warn('community 통계 실패',e);}
 
```

## merchant.html / 아래 @@의 행 위치 / 기존 코드 → 새 코드

```diff
--- a/merchant.html
+++ b/merchant.html
@@ -186,7 +186,7 @@
       myBizId=biz.id; myBiz={...biz};
       openConsole();
     }else if(biz && !biz.approved){
-      $('pendName').textContent=`"${biz.name}" 신청이 접수되었어요.`;
+      $('pendName').textContent=`"${NW.html(biz.name)}" 신청이 접수되었어요.`;
       subShow('m-pending');
     }else{
       location.replace('user.html');
@@ -195,15 +195,16 @@
 })();
 
 function openConsole(){
+  if(myBizId!==NW.uid && !NW.isAdmin(NW.user)){subShow('m-pending');$('pendName').textContent='기존 매장 ID 전환이 필요합니다. 운영자에게 문의해주세요.';return;}
   subShow('m-console');
   NW.mountAccount('acct');
   $('cBizName').textContent=myBiz.name;
-  $('cBizCat').textContent=catOf(myBiz.cat).e+' '+catOf(myBiz.cat).n+' · 반경 '+distLabel(myBiz.radius);
+  $('cBizCat').textContent=catOf(myBiz.cat).e+' '+catOf(myBiz.cat).n+' · 반경 '+distLabel(myBiz.radius||1000);
   const pin=$('cBizPin'); if(pin) pin.textContent=myBiz.lat.toFixed(4)+', '+myBiz.lng.toFixed(4);
-  const p2=$('cBizPin2'); if(p2) p2.textContent=myBiz.lat.toFixed(5)+', '+myBiz.lng.toFixed(5)+' · 반경 '+distLabel(myBiz.radius);
+  const p2=$('cBizPin2'); if(p2) p2.textContent=myBiz.lat.toFixed(5)+', '+myBiz.lng.toFixed(5)+' · 반경 '+distLabel(myBiz.radius||1000);
   // 직원 관리 버튼은 오너에게만 보임
   const memBtn=$('memBtn');
-  if(memBtn) memBtn.classList.toggle('hide', myBiz.ownerId!==NW.uid);
+  if(memBtn) memBtn.classList.add('hide'); // UID 전용 계정: 이메일 직원 공유 중단
   setBizStatus(myBiz.status,true); listenCalls(); listenArrivals();
 }
 
@@ -216,8 +217,8 @@
   const list=myBiz.memberEmails||[];
   if(!list.length){$('memList').innerHTML='<div class="muted" style="font-size:13px">아직 등록된 직원이 없어요.</div>';return;}
   $('memList').innerHTML=list.map(em=>`
-    <div class="hist-item"><div class="hi-l"><b>${em}</b></div>
-    <button class="adm-btn danger" style="padding:6px 10px" onclick="removeMember('${em}')">제거</button></div>`).join('');
+    <div class="hist-item"><div class="hi-l"><b>${NW.html(em)}</b></div>
+    <button class="adm-btn danger" style="padding:6px 10px" onclick="removeMember('${NW.inline(em)}')">제거</button></div>`).join('');
 }
 window.addMember=async()=>{
   const em=$('memEmail').value.trim().toLowerCase();
@@ -237,7 +238,7 @@
   }
 };
 window.removeMember=async(em)=>{
-  if(!confirm(`"${em}" 직원을 제거할까요?`))return;
+  if(!confirm(`"${NW.html(em)}" 직원을 제거할까요?`))return;
   const next=(myBiz.memberEmails||[]).filter(x=>x!==em);
   const {doc,updateDoc}=NW.fb;
   try{
@@ -257,12 +258,12 @@
   $('ePhoto').value=myBiz.photo||'';
   renderPhotoPreview(myBiz.photo||'');
   $('eWebsite').value=myBiz.website||'';
-  $('eMenu').value=(myBiz.menu||[]).map(m=>`${m.name},${m.price||0}`).join('\n');
+  $('eMenu').value=(myBiz.menu||[]).map(m=>`${NW.html(m.name)},${m.price||0}`).join('\n');
   $('eHours').value=myBiz.hours||'';
   $('ePhone').value=myBiz.phone||'';
   $('eParking').classList.toggle('on',!!myBiz.parking);
   $('eReserv').classList.toggle('on',!!myBiz.reservation);
-  $('eCat').innerHTML=CATS.map(c=>`<button class="chip ${c.k===eSel.cat?'on':''}" data-c="${c.k}" onclick="ePickCat('${c.k}')">${c.e} ${c.n}</button>`).join('');
+  $('eCat').innerHTML=CATS.map(c=>`<button class="chip ${c.k===eSel.cat?'on':''}" data-c="${c.k}" onclick="ePickCat('${NW.inline(c.k)}')">${c.e} ${NW.html(c.n)}</button>`).join('');
   $('eRad').innerHTML=RADII.map(r=>`<button class="chip ${r===eSel.rad?'on':''}" data-r="${r}" onclick="ePickRad(${r})">${distLabel(r)}</button>`).join('');
   $('eMinParty').innerHTML=[1,2,3,4].map(n=>`<button class="chip ${n===eSel.minParty?'on':''}" data-m="${n}" onclick="ePickMin(${n})">${n}명 가능${n===4?'+':''}</button>`).join('');
   drawEditMap();
@@ -270,7 +271,7 @@
 function renderPhotoPreview(url){
   const el=$('ePhotoPreview');
   if(!el) return;
-  if(url){ el.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:cover">`; }
+  if(url){ url=NW.safeURL(url); el.innerHTML=`<img src="${NW.html(url)}" style="width:100%;height:100%;object-fit:cover">`; }
   else{ el.innerHTML='사진 없음'; el.style.color='var(--tx3)'; }
 }
 window.handlePhotoSelect=async(event)=>{
@@ -333,7 +334,7 @@
   if(isNaN(lat)||isNaN(lng)){toast('위치 좌표가 필요해요');return;}
   const menu=$('eMenu').value.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.lastIndexOf(',');if(i<0)return{name:l,price:0};return{name:l.slice(0,i).trim(),price:parseInt(l.slice(i+1).replace(/[^0-9]/g,''))||0};});
   const patch={name:$('eName').value.trim(),cat:eSel.cat,radius:eSel.rad,minParty:eSel.minParty||1,lat,lng,
-    photo:$('ePhoto').value.trim(),website:$('eWebsite').value.trim(),menu,hours:$('eHours').value.trim(),phone:$('ePhone').value.trim(),
+    photo:NW.safeURL($('ePhoto').value.trim()),website:NW.safeURL($('eWebsite').value.trim()),menu,hours:$('eHours').value.trim(),phone:$('ePhone').value.trim(),
     parking:$('eParking').classList.contains('on'),reservation:$('eReserv').classList.contains('on')};
   const {doc,updateDoc}=NW.fb;
   await updateDoc(doc(NW.db,'biz',myBizId),patch).catch(e=>{toast('저장 실패: '+e.message);throw e;});
@@ -345,6 +346,7 @@
 };
 let arrUnsub=null, arrivals=[], arrTimer=null;
 function listenArrivals(){
+  if(arrUnsub)arrUnsub();
   const {collection,query,where,onSnapshot}=NW.fb;
   console.log('[listenArrivals] 시작 — myBizId:', myBizId);
   const q=query(collection(NW.db,'calls'),where('matchedBizId','==',myBizId));
@@ -439,26 +441,26 @@
   area.innerHTML='<div class="calls-grid">'+arrivals.map(c=>{
     const cat=catOf(c.cat);
     const uid=(c.callerId||'').slice(0,6)||'guest';
-    const guest = c.callerName ? `<b>${c.callerName}</b>님` : `손님 <span class="mono">#${uid}</span>`;
+    const guest = c.callerName ? `<b>${NW.html(c.callerName)}</b>님` : `손님 <span class="mono">#${NW.html(uid)}</span>`;
     if(c.status==='accepted'){
       const left=c.goingDeadline?(tsMs(c.goingDeadline)-nowMs())/1000:0;
       return `<div class="callcard" style="border-color:var(--soon)">
-        <div class="ch"><div class="party">${c.party}<span>명</span></div>
+        <div class="ch"><div class="party">${NW.html(c.party)}<span>명</span></div>
           <div class="dist mono" style="background:var(--soonbg);color:var(--soon)">응답 대기</div></div>
-        <div class="cmeta">${cat.e} ${cat.n} · ${guest}</div>
+        <div class="cmeta">${cat.e} ${NW.html(cat.n)} · ${guest}</div>
         <div class="ctimer mono" style="color:var(--soon)">⏳ 손님이 「갈게요」를 누르길 대기 (${left>0?Math.ceil(left)+'초':'마감'})</div>
         </div>`;
     }
     const left=c.matchExpiresAt?(tsMs(c.matchExpiresAt)-nowMs())/1000:0;
     const over=left<=0;
     return `<div class="callcard" style="border-color:${over?'var(--no)':'var(--ok)'}">
-      <div class="ch"><div class="party">${c.party}<span>명</span></div>
+      <div class="ch"><div class="party">${NW.html(c.party)}<span>명</span></div>
         <div class="dist mono" style="background:${over?'var(--nobg)':'var(--okbg)'};color:${over?'var(--no)':'var(--ok)'}">${over?'시간초과':'도착중'}</div></div>
-      <div class="cmeta">${cat.e} ${cat.n} · ${guest}</div>
-      <div class="ctimer mono" style="color:${over?'var(--no)':'var(--soon)'}">⏱ ${over?'노쇼 가능 — 자동 처리됨':fmtT(left)+' 내 도착 예정'}</div>
+      <div class="cmeta">${cat.e} ${NW.html(cat.n)} · ${guest}</div>
+      <div class="ctimer mono" style="color:${over?'var(--no)':'var(--soon)'}">⏱ ${over?'노쇼 처리 대기':fmtT(left)+' 내 도착 예정'}</div>
       <div class="resp-row" style="margin-top:8px">
-        <button class="resp-btn rb-ok" onclick="confirmArrival('${c.id}')">✓ 도착 확인</button>
-        <button class="resp-btn rb-no" onclick="markNoShow('${c.id}')">노쇼</button>
+        <button class="resp-btn rb-ok" onclick="confirmArrival('${NW.inline(c.id)}')">✓ 도착 확인</button>
+        <button class="resp-btn rb-no" onclick="markNoShow('${NW.inline(c.id)}')">노쇼</button>
       </div>
       </div>`;}).join('')+'</div>';
 }
@@ -466,8 +468,9 @@
 window.confirmArrival=async(callId)=>{
   const c=arrivals.find(x=>x.id===callId);
   const name=c?.callerName||'손님';
-  if(!confirm(`${name}님이 도착했나요?`))return;
+  if(!confirm(`${NW.html(name)}님이 도착했나요?`))return;
   const {doc,updateDoc,serverTimestamp}=NW.fb;
+  /* 진단 로그 제거
   // 진단 — 인증 상태 출력
   const u=NW.auth.currentUser;
   console.log('=== 진단 정보 ===');
@@ -479,7 +482,7 @@
   console.log('호출 matchedBizId:', c?.matchedBizId, '→ 내 매장?', c?.matchedBizId===myBizId);
   console.log('호출 status:', c?.status);
   console.log('매장 ownerId:', myBiz?.ownerId, '→ 나와 같음?', myBiz?.ownerId===u?.uid);
-  console.log('==============');
+  console.log('=============='); */
   try{
     await updateDoc(doc(NW.db,'calls',callId),{status:'done',arrivedAt:serverTimestamp()});
     toast('🎉 도착 확인 완료');
@@ -490,8 +493,9 @@
 };
 window.markNoShow=async(callId)=>{
   const c=arrivals.find(x=>x.id===callId);
+  if(!c || tsMs(c.matchExpiresAt)>nowMs()){toast('도착 마감 후에만 노쇼 처리할 수 있어요');return;}
   const name=c?.callerName||'이 손님';
-  if(!confirm(`${name}을(를) 노쇼 처리할까요? (손님에게 패널티 적용)`))return;
+  if(!confirm(`${NW.html(name)}을(를) 노쇼 처리할까요? (손님에게 패널티 적용)`))return;
   const {doc,updateDoc}=NW.fb;
   try{ await updateDoc(doc(NW.db,'calls',callId),{status:'noshow'}); toast('노쇼 처리됨'); }
   catch(e){toast('실패: '+e.message);}
@@ -501,14 +505,15 @@
   $('st-open').classList.toggle('on',s==='open');
   $('st-busy').classList.toggle('on',s==='busy');
   $('st-close').classList.toggle('on',s==='closed');
-  if(myBizId){const {doc,updateDoc}=NW.fb;await updateDoc(NW.fb.doc(NW.db,'biz',myBizId),{status:s}).catch(()=>{});}
+  if(myBizId && !silent){const {doc,updateDoc}=NW.fb;await updateDoc(NW.fb.doc(NW.db,'biz',myBizId),{status:s}).catch(()=>{});}
   if(!silent)toast(s==='open'?'영업중으로 변경':s==='busy'?'혼잡 상태로 변경':'마감 처리');
 };
 function listenCalls(){
+  if(callsUnsub)callsUnsub();
   const {collection,query,where,onSnapshot}=NW.fb;
   // 단일 where(cat)만 사용 → 복합 인덱스 불필요. status는 클라이언트에서 필터.
   // 새 호출은 cats[] 배열로 저장됨. array-contains로 매칭. (구 호출도 cat=cats[0]이라 별도 처리 X)
-  const q=query(collection(NW.db,'calls'),where('cats','array-contains',myBiz.cat));
+  const q=query(collection(NW.db,'calls'),where('status','==','searching'),where('cats','array-contains',myBiz.cat));
   callsUnsub=onSnapshot(q,snap=>{
     const list=[];
     snap.forEach(d=>{const c={id:d.id,...d.data()};
@@ -521,7 +526,7 @@
       if(!isDirectToMe){
         if(c.party < (myBiz.minParty||1))return;
         const dist=haversine(myBiz,{lat:c.lat,lng:c.lng});
-        if(dist>(myBiz.radius||2000))return;
+        if(dist>Math.min(myBiz.radius||2000,2000))return;
         c._dist=dist;
       }else{
         c._dist=haversine(myBiz,{lat:c.lat,lng:c.lng});
@@ -628,18 +633,19 @@
 function callCard(c){const cat=catOf(c.cat);const done=respondedCalls.has(c.id);let action;
   const isDirect = c.directBizId === myBizId;
   if(done)action=`<div class="resp-done" style="background:var(--okbg);color:var(--ok)">✓ 응답 완료</div>`;
-  else if(myBiz.status==='busy')action=`<div class="resp-row"><button class="resp-btn rb-soon" onclick="respond('${c.id}','soon')">10분 후</button><button class="resp-btn rb-no" onclick="respond('${c.id}','no')">불가</button></div>`;
-  else action=`<div class="resp-row"><button class="resp-btn rb-ok" onclick="respond('${c.id}','ok')">가능</button><button class="resp-btn rb-soon" onclick="respond('${c.id}','soon')">10분 후</button><button class="resp-btn rb-no" onclick="respond('${c.id}','no')">불가</button></div>`;
+  else if(myBiz.status==='busy')action=`<div class="resp-row"><button class="resp-btn rb-soon" onclick="respond('${NW.inline(c.id)}','soon')">10분 후</button><button class="resp-btn rb-no" onclick="respond('${NW.inline(c.id)}','no')">불가</button></div>`;
+  else action=`<div class="resp-row"><button class="resp-btn rb-ok" onclick="respond('${NW.inline(c.id)}','ok')">가능</button><button class="resp-btn rb-soon" onclick="respond('${NW.inline(c.id)}','soon')">10분 후</button><button class="resp-btn rb-no" onclick="respond('${NW.inline(c.id)}','no')">불가</button></div>`;
   const directBadge = isDirect ? `<div style="position:absolute;top:8px;right:8px;background:var(--y);color:#fff;font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px">📞 직접호출</div>` : '';
-  return `<div class="callcard fresh" id="call-${c.id}" style="position:relative">${directBadge}<div class="ch"><div class="party">${c.party}<span>명</span></div><div class="dist mono">${distLabel(c._dist)}</div></div>
-    <div class="cmeta">${cat.e} ${cat.n} 요청${isDirect?' · 본 매장 지목':''}</div><div class="ctimer mono" id="ct-${c.id}">⏱ 대기중</div>${action}</div>`;}
+  return `<div class="callcard fresh" id="call-${c.id}" style="position:relative">${directBadge}<div class="ch"><div class="party">${NW.html(c.party)}<span>명</span></div><div class="dist mono">${distLabel(c._dist)}</div></div>
+    <div class="cmeta">${cat.e} ${NW.html(cat.n)} 요청${isDirect?' · 본 매장 지목':''}</div><div class="ctimer mono" id="ct-${c.id}">⏱ 대기중</div>${action}</div>`;}
 function startCallTimer(id,exp){if(callTimers[id])return;
   callTimers[id]=setInterval(()=>{const el=$('ct-'+id);if(!el){clearInterval(callTimers[id]);delete callTimers[id];return;}
     const left=(exp-nowMs())/1000;el.textContent='⏱ '+fmtT(left)+' 남음';if(left<=0){clearInterval(callTimers[id]);delete callTimers[id];}},500);}
 window.respond=async(callId,type)=>{
+  try{
   const {doc,getDoc,setDoc,updateDoc,onSnapshot,serverTimestamp,Timestamp}=NW.fb;
   const cs=await getDoc(doc(NW.db,'calls',callId));
-  if(!cs.exists()||cs.data().status!=='searching'){toast('이미 마감된 호출이에요.');return;}
+  if(!cs.exists()||cs.data().status!=='searching'||tsMs(cs.data().expiresAt)<=nowMs()){toast('이미 마감된 호출이에요.');return;}
   const cd=cs.data();const realDist=haversine(myBiz,{lat:cd.lat,lng:cd.lng});
   await setDoc(doc(NW.db,'calls',callId,'responses',myBizId),{bizId:myBizId,bizName:myBiz.name,cat:myBiz.cat,type,dist:realDist,
     responderUid:NW.uid, responderName:NW.user?.displayName||'', responderEmail:NW.user?.email||'',
@@ -652,16 +658,17 @@
     await updateDoc(doc(NW.db,'calls',callId),{
       status:'accepted', matchedBizId:myBizId, matchedBizName:myBiz.name,
       acceptedAt:serverTimestamp(), goingDeadline
-    }).catch(()=>{});
+    });
     toast('🎉 직접호출 수락 — 손님이 30초 안에 「갈게요」를 누르면 예약 확정');
   }else{
     toast(type==='ok'?'「가능」 응답 전송':type==='soon'?'「10분 후」 응답 전송':'「불가」 응답');
   }
   const un=onSnapshot(doc(NW.db,'calls',callId),s=>{if(!s.exists())return;const d=s.data();
-    if(d.status==='matched'&&d.matchedBizId===myBizId){un();}
-    else if(d.status==='matched'&&d.matchedBizId!==myBizId){toast('아쉽게도 다른 매장으로 매칭됐어요.');un();}
+    if(['going','matched'].includes(d.status)&&d.matchedBizId===myBizId){stats.match++;$('tsMatch').textContent=stats.match;un();}
+    else if(['going','matched'].includes(d.status)&&d.matchedBizId!==myBizId){toast('아쉽게도 다른 매장으로 매칭됐어요.');un();}
     else if(['expired','cancelled','done','noshow'].includes(d.status))un();});
   const el=$('call-'+callId);if(el){const btn=el.querySelector('.resp-row');if(btn)btn.outerHTML='<div class="resp-done" style="background:var(--okbg);color:var(--ok)">✓ 응답 완료</div>';}
+  }catch(e){toast('응답 실패: '+e.message);}
 };
 window.addEventListener('beforeunload',()=>{if(callsUnsub)callsUnsub();if(arrUnsub)arrUnsub();});
 </script>
```

## user.html / 아래 @@의 행 위치 / 기존 코드 → 새 코드

```diff
--- a/user.html
+++ b/user.html
@@ -392,11 +392,11 @@
       a.style.cssText='font-size:12px;color:var(--y);font-weight:700;margin-right:10px';
       t.insertBefore(a,t.querySelector('#acct'));
     }
-    refreshPenalty();
+    await refreshPenalty();
     loadHotplaces();
     loadPoints();
     // 진행중인 호출 자동 복원 (위치 로딩 대기)
-    setTimeout(()=>restoreActiveCall(), 1500);
+    await restoreActiveCall();
   });
 }
 
@@ -429,9 +429,9 @@
         return;
       }
       // 'going' 상태에서 도착 시간 지났으면 노쇼
-      if(c.status==='going' && c.matchExpiresAt && tsMs(c.matchExpiresAt)<nowMs()){
+      if(['going','matched'].includes(c.status) && c.matchExpiresAt && tsMs(c.matchExpiresAt)<nowMs()){
         const {doc,updateDoc}=NW.fb;
-        updateDoc(doc(NW.db,'calls',c.id),{status:'noshow'}).catch(()=>{});
+        NW.expireCall(c.id).then(refreshPenalty).catch(()=>{});
         return;
       }
       // 'accepted' 상태에서 30초 지났으면 자동취소
@@ -467,6 +467,12 @@
     // 호출 중 — 호출 대기 화면 복원
     sel={party:c.party, cats:c.cats||[c.cat]};
     matchData=null;
+    if(c.directBizId){
+      dcCallId=c.id; curHotBiz=biz;
+      if(!curHotBiz){ const bs=await NW.fb.getDoc(NW.fb.doc(NW.db,'biz',c.directBizId)); curHotBiz=bs.exists()?{id:bs.id,...bs.data()}:null; }
+      dcParty=c.party; $('dcTarget').textContent=c.directBizName||'매장';
+      subShow('u-direct');startDirectTimer(tsMs(c.expiresAt));listenDirectResponse(c.directBizId);return;
+    }
     const expEnd = c.expiresAt ? tsMs(c.expiresAt) : nowMs()+CALL_TTL*1000;
     subShow('u-search');
     $('resList').innerHTML=''; $('srCount').textContent='0';
@@ -519,7 +525,7 @@
     const snap=await getDocs(query(collection(NW.db,'biz'),where('isHot','==',true)));
     let list=snap.docs.map(d=>({id:d.id,...d.data()}));
     // 3km 이내만 필터 + 거리순
-    list=list.filter(h=>h.lat&&h.lng).map(h=>{
+    list=list.filter(h=>h.approved && h.lat&&h.lng).map(h=>{
       h._dist=haversine(myLoc,{lat:h.lat,lng:h.lng});return h;
     }).filter(h=>h._dist<=HOT_RADIUS).sort((a,b)=>a._dist-b._dist);
     renderHot(list);
@@ -540,12 +546,12 @@
     const dist=h._dist!=null?distLabel(h._dist):'';
     const rating=h.ratingAvg?`<span style="color:var(--y)">⭐ ${(+h.ratingAvg).toFixed(1)}</span>`:'';
     const img=h.photo
-      ? `<img src="${h.photo}" style="width:72px;height:72px;border-radius:10px;object-fit:cover;flex-shrink:0">`
+      ? `<img src="${NW.html(NW.safeURL(h.photo))}" style="width:72px;height:72px;border-radius:10px;object-fit:cover;flex-shrink:0">`
       : `<div class="em" style="width:72px;height:72px;font-size:32px">${cat.e}</div>`;
-    return `<div class="bizcard" style="align-items:flex-start;cursor:pointer" onclick="openHotDetail('${h.id}')">
+    return `<div class="bizcard" style="align-items:flex-start;cursor:pointer" onclick="openHotDetail('${NW.inline(h.id)}')">
       ${img}
-      <div class="info"><b>${h.name||'매장'}</b>
-        <div class="meta" style="white-space:normal;font-family:inherit;color:var(--tx2);margin-top:4px">${cat.n}${h.hours?' · '+h.hours:''}</div>
+      <div class="info"><b>${NW.html(h.name||'매장')}</b>
+        <div class="meta" style="white-space:normal;font-family:inherit;color:var(--tx2);margin-top:4px">${NW.html(cat.n)}${h.hours?' · '+NW.html(h.hours):''}</div>
         <div style="margin-top:6px;display:flex;gap:8px;align-items:center;font-size:12px">${rating}${dist?`<span class="meta">${dist}</span>`:''}</div>
       </div></div>`;
   }).join('');
@@ -558,16 +564,16 @@
     const dist=h._dist!=null?distLabel(h._dist):'';
     const bg = colors[i%colors.length];
     const photo = h.photo
-      ? `<img src="${h.photo}" style="width:100%;height:130px;object-fit:cover;border-radius:12px">`
+      ? `<img src="${NW.html(NW.safeURL(h.photo))}" style="width:100%;height:130px;object-fit:cover;border-radius:12px">`
       : `<div style="width:100%;height:130px;border-radius:12px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:48px">${cat.e}</div>`;
     const rating=h.ratingAvg?`<span style="color:var(--y);font-weight:700">★ ${(+h.ratingAvg).toFixed(1)}</span>`:'';
-    return `<div onclick="openHotDetail('${h.id}')" style="flex-shrink:0;width:158px;cursor:pointer">
+    return `<div onclick="openHotDetail('${NW.inline(h.id)}')" style="flex-shrink:0;width:158px;cursor:pointer">
       <div style="position:relative;margin-bottom:8px">
         ${photo}
         <div style="position:absolute;top:8px;left:8px;background:var(--y);color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px">🔥 HOT</div>
       </div>
-      <div style="font-size:13px;font-weight:700;margin-bottom:2px">${h.name||'매장'}</div>
-      <div style="font-size:11px;color:var(--tx3)">${cat.n}${dist?' · '+dist:''}</div>
+      <div style="font-size:13px;font-weight:700;margin-bottom:2px">${NW.html(h.name||'매장')}</div>
+      <div style="font-size:11px;color:var(--tx3)">${NW.html(cat.n)}${dist?' · '+dist:''}</div>
       <div style="display:flex;gap:6px;margin-top:4px;font-size:11px">${rating}</div>
     </div>`;
   }).join('');
@@ -592,29 +598,30 @@
   const cat=catOf(b.cat);
   // 사진
   $('hd-photo').innerHTML = b.photo
-    ? `<img src="${b.photo}" style="width:100%;height:200px;object-fit:cover;border-radius:var(--rad)" onerror="this.parentNode.innerHTML='${hotPhotoFallback(cat)}'">`
+    ? `<img src="${NW.html(NW.safeURL(b.photo))}" style="width:100%;height:200px;object-fit:cover;border-radius:var(--rad)" onerror="this.style.display='none'">`
     : hotPhotoFallback(cat);
   $('hd-name').textContent=b.name||'매장';
   const dist=myLoc&&b.lat&&b.lng?' · '+distLabel(haversine(myLoc,{lat:b.lat,lng:b.lng})):'';
-  $('hd-meta').textContent=`${cat.e} ${cat.n}${dist}`;
+  $('hd-meta').textContent=`${cat.e} ${NW.html(cat.n)}${dist}`;
   // 별점
   if(b.ratingAvg){
-    $('hd-rating').innerHTML=`<div style="text-align:right"><div style="color:var(--y);font-size:18px;font-weight:800">⭐ ${(+b.ratingAvg).toFixed(1)}</div><div style="color:var(--tx3);font-size:11px">리뷰 ${b.ratingCount||0}개</div></div>`;
+    $('hd-rating').innerHTML=`<div style="text-align:right"><div style="color:var(--y);font-size:18px;font-weight:800">⭐ ${(+b.ratingAvg).toFixed(1)}</div><div style="color:var(--tx3);font-size:11px">리뷰 ${NW.html(b.ratingCount||0)}개</div></div>`;
   }else{
     $('hd-rating').innerHTML=`<div style="color:var(--tx3);font-size:12px">아직 별점 없음</div>`;
   }
   // 길찾기
+  $('hd-route').classList.toggle('hide',!(b.lat&&b.lng));
   if(b.lat&&b.lng)$('hd-route').href=NW.kakaoRoute(b.name,b.lat,b.lng);
   else $('hd-route').classList.add('hide');
   // 연락처 / 홈페이지
   const contact=[];
-  if(b.phone) contact.push(`<div class="row"><span>전화</span><b><a href="tel:${b.phone}" style="color:var(--y)">${b.phone}</a></b></div>`);
-  if(b.website) contact.push(`<div class="row"><span>홈페이지</span><b><a href="${b.website}" target="_blank" rel="noopener" style="color:var(--y)">바로가기 →</a></b></div>`);
+  if(b.phone) contact.push(`<div class="row"><span>전화</span><b><a href="tel:${NW.html(b.phone)}" style="color:var(--y)">${NW.html(b.phone)}</a></b></div>`);
+  if(b.website) contact.push(`<div class="row"><span>홈페이지</span><b><a href="${NW.html(NW.safeURL(b.website))}" target="_blank" rel="noopener" style="color:var(--y)">바로가기 →</a></b></div>`);
   $('hd-contact').innerHTML=contact.length?`<div class="bizdetail" style="margin-top:18px">${contact.join('')}</div>`:'';
   // 메뉴
   if(b.menu&&b.menu.length){
     $('hd-menu').innerHTML=`<div class="h2" style="margin-top:24px">메뉴</div><div class="bizdetail">`+
-      b.menu.map(m=>`<div class="row"><span style="color:var(--tx)">${m.name}</span><b>${m.price?m.price.toLocaleString()+'원':'-'}</b></div>`).join('')+`</div>`;
+      b.menu.map(m=>`<div class="row"><span style="color:var(--tx)">${NW.html(m.name)}</span><b>${NW.html(m.price?m.price.toLocaleString()+'원':'-')}</b></div>`).join('')+`</div>`;
   }else $('hd-menu').innerHTML='';
   // 영업정보
   const info=[];
@@ -622,7 +629,7 @@
   info.push(['주차',b.parking?'가능':'정보없음']);
   info.push(['예약',b.reservation?'가능':'정보없음']);
   $('hd-info').innerHTML=`<div class="h2" style="margin-top:24px">영업정보</div><div class="bizdetail">`+
-    info.map(r=>`<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')+`</div>`;
+    info.map(r=>`<div class="row"><span>${r[0]}</span><b>${NW.html(r[1])}</b></div>`).join('')+`</div>`;
   // 지도
   drawHotMap(b);
   // 핫플 직접호출 인원 칩
@@ -673,6 +680,7 @@
 
 let commCurrentCat = 'all';
 let commUnsub = null;
+let commCommentUnsub=null, curCommPostId=null, commCommentNick=null;
 let commCachedNick = null; // 작성 모달용
 
 function genNickname(){
@@ -711,7 +719,7 @@
 function buildCommTabs(){
   $('commTabs').innerHTML = COMM_CATS.map(c=>{
     const on = commCurrentCat===c.k;
-    return `<button onclick="setCommCat('${c.k}')" style="flex-shrink:0;padding:8px 14px;border-radius:20px;font-size:12px;font-weight:700;border:1.5px solid ${on?'var(--y)':'var(--bd)'};background:${on?'var(--y)':'transparent'};color:${on?'#000':'var(--tx2)'};white-space:nowrap;cursor:pointer">${c.n}</button>`;
+    return `<button onclick="setCommCat('${NW.inline(c.k)}')" style="flex-shrink:0;padding:8px 14px;border-radius:20px;font-size:12px;font-weight:700;border:1.5px solid ${on?'var(--y)':'var(--bd)'};background:${on?'var(--y)':'transparent'};color:${on?'#000':'var(--tx2)'};white-space:nowrap;cursor:pointer">${NW.html(c.n)}</button>`;
   }).join('');
 }
 window.setCommCat=(k)=>{commCurrentCat=k; buildCommTabs(); loadCommunity();};
@@ -731,7 +739,7 @@
     const catColor = commCatColor(p.category);
     const catLabel = commCatLabel(p.category).replace(/^[^\s]+\s/,''); // 이모지 빼기
     const catEmoji = commCatLabel(p.category).match(/^[^\s]+/)?.[0]||'';
-    return `<div onclick="openCommDetail('${p.id}')" style="padding:16px 20px;border-bottom:1px solid var(--bd);cursor:pointer;transition:.12s" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='transparent'">
+    return `<div onclick="openCommDetail('${NW.inline(p.id)}')" style="padding:16px 20px;border-bottom:1px solid var(--bd);cursor:pointer;transition:.12s" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='transparent'">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
         <span style="font-size:10px;font-weight:700;color:${catColor};background:${catColor}22;padding:3px 8px;border-radius:6px">${catEmoji} ${catLabel}</span>
         <span style="font-size:11px;color:var(--tx3)">${ts}</span>
@@ -740,8 +748,8 @@
       <div style="font-size:12px;color:var(--tx2);line-height:1.5;max-height:36px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${escapeHtml((p.content||'').slice(0,120))}</div>
       <div style="display:flex;align-items:center;gap:14px;margin-top:10px;font-size:11px;color:var(--tx3)">
         <span style="color:var(--y);font-weight:700">🎭 ${escapeHtml(p.nickname||'익명')}</span>
-        <span>❤️ ${p.likes||0}</span>
-        <span>💬 ${p.commentCount||0}</span>
+        <span>❤️ ${NW.html(p.likes||0)}</span>
+        <span>💬 ${NW.html(p.commentCount||0)}</span>
       </div>
     </div>`;
   }).join('');
@@ -772,7 +780,7 @@
   if(!writeCats.find(c=>c.k===commWriteCat)) commWriteCat = writeCats[0].k;
   $('commCatChips').innerHTML = writeCats.map(c=>{
     const on = commWriteCat===c.k;
-    return `<button onclick="pickCommCat('${c.k}')" style="padding:8px 12px;border-radius:18px;font-size:12px;font-weight:700;border:1.5px solid ${on?'var(--y)':'var(--bd)'};background:${on?'var(--y)':'transparent'};color:${on?'#000':'var(--tx2)'};cursor:pointer">${c.n}</button>`;
+    return `<button onclick="pickCommCat('${NW.inline(c.k)}')" style="padding:8px 12px;border-radius:18px;font-size:12px;font-weight:700;border:1.5px solid ${on?'var(--y)':'var(--bd)'};background:${on?'var(--y)':'transparent'};color:${on?'#000':'var(--tx2)'};cursor:pointer">${NW.html(c.n)}</button>`;
   }).join('');
   $('commTitle').value='';
   $('commContent').value='';
@@ -786,7 +794,7 @@
   const writeCats = COMM_CATS.filter(c=>c.k!=='all');
   $('commCatChips').innerHTML = writeCats.map(c=>{
     const on = commWriteCat===c.k;
-    return `<button onclick="pickCommCat('${c.k}')" style="padding:8px 12px;border-radius:18px;font-size:12px;font-weight:700;border:1.5px solid ${on?'var(--y)':'var(--bd)'};background:${on?'var(--y)':'transparent'};color:${on?'#000':'var(--tx2)'};cursor:pointer">${c.n}</button>`;
+    return `<button onclick="pickCommCat('${NW.inline(c.k)}')" style="padding:8px 12px;border-radius:18px;font-size:12px;font-weight:700;border:1.5px solid ${on?'var(--y)':'var(--bd)'};background:${on?'var(--y)':'transparent'};color:${on?'#000':'var(--tx2)'};cursor:pointer">${NW.html(c.n)}</button>`;
   }).join('');
 }
 
@@ -852,11 +860,11 @@
           <div><div style="font-size:13px;color:var(--y);font-weight:700">${escapeHtml(p.nickname||'익명')}</div>
             <div style="font-size:11px;color:var(--tx3)">${ts}</div></div>
         </div>
-        ${isMine?`<button onclick="deleteCommPost('${postId}')" style="background:var(--nobg);color:var(--no);border:1px solid var(--no);padding:6px 12px;font-size:11px;font-weight:700;border-radius:8px;cursor:pointer">🗑 삭제</button>`:''}
+        ${isMine?`<button onclick="deleteCommPost('${NW.inline(postId)}')" style="background:var(--nobg);color:var(--no);border:1px solid var(--no);padding:6px 12px;font-size:11px;font-weight:700;border-radius:8px;cursor:pointer">🗑 삭제</button>`:''}
       </div>
       <div style="font-size:15px;line-height:1.8;margin-top:20px;white-space:pre-wrap;color:var(--tx)">${escapeHtml(p.content)}</div>
       <div style="margin-top:30px;display:flex;align-items:center;gap:14px">
-        <button onclick="likeCommPost('${postId}')" style="background:var(--bg2);border:1px solid var(--bd);padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;color:var(--tx);cursor:pointer">❤️ ${p.likes||0}</button>
+        <button onclick="likeCommPost('${NW.inline(postId)}')" style="background:var(--bg2);border:1px solid var(--bd);padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;color:var(--tx);cursor:pointer">❤️ ${NW.html(p.likes||0)}</button>
       </div>
       <div class="muted" style="font-size:11px;margin-top:24px;text-align:center;padding:14px;background:var(--bg2);border-radius:var(--rad);border:1px solid var(--bd)">
         ※ 비방·욕설·허위정보·불법 행위 유도 게시물은 사전 통보 없이 삭제됩니다.<br>※ 익명이지만 작성자 식별이 가능하며 법적 책임은 작성자에게 있습니다.
@@ -905,7 +913,7 @@
           <span style="font-size:12px;font-weight:700;color:var(--y)">${escapeHtml(c.nickname||'익명')}</span>
           <div style="display:flex;align-items:center;gap:8px">
             <span style="font-size:11px;color:var(--tx3)">${ts}</span>
-            ${isMine?`<button onclick="deleteComment('${postId}','${c.id}')" style="background:none;color:var(--no);border:none;font-size:11px;font-weight:700;cursor:pointer">삭제</button>`:''}
+            ${isMine?`<button onclick="deleteComment('${NW.inline(postId)}','${NW.inline(c.id)}')" style="background:none;color:var(--no);border:none;font-size:11px;font-weight:700;cursor:pointer">삭제</button>`:''}
           </div>
         </div>
         <div style="font-size:14px;line-height:1.6;color:var(--tx2);white-space:pre-wrap">${escapeHtml(c.content||'')}</div>
@@ -939,8 +947,6 @@
       uid: NW.uid,
       at: serverTimestamp()
     });
-    // commentCount 증가
-    await updateDoc(doc(NW.db,'community',curCommPostId),{commentCount: increment(1)}).catch(()=>{});
     $('commCommentTxt').value = '';
     const el = $('commCommentCharCnt');
     if(el) el.textContent = '0 / 500';
@@ -957,7 +963,6 @@
   try{
     const {doc,deleteDoc,updateDoc,increment} = NW.fb;
     await deleteDoc(doc(NW.db,'community',postId,'comments',commentId));
-    await updateDoc(doc(NW.db,'community',postId),{commentCount: increment(-1)}).catch(()=>{});
     toast('삭제 완료');
   }catch(e){toast('실패: '+(e.code||e.message));}
 };
@@ -965,11 +970,11 @@
 window.likeCommPost=async(postId)=>{
   if(!NW.uid){toast('로그인이 필요합니다');return;}
   try{
-    const {doc,updateDoc,increment} = NW.fb;
-    await updateDoc(doc(NW.db,'community',postId),{likes: increment(1)});
+    const {doc,setDoc,serverTimestamp} = NW.fb;
+    await setDoc(doc(NW.db,'community',postId,'likes',NW.uid),{uid:NW.uid,at:serverTimestamp()});
     toast('❤️ 좋아요!');
     openCommDetail(postId);
-  }catch(e){toast('실패: '+(e.code||e.message));}
+  }catch(e){toast('이미 좋아요를 눌렀거나 권한이 없습니다');}
 };
 window.deleteCommPost=async(postId)=>{
   if(!confirm('이 글을 삭제할까요?'))return;
@@ -987,26 +992,17 @@
   if(!curHotBiz || !dcParty || !myLoc){toast('인원·위치를 확인하세요');return;}
   if(penalActive()){toast('패널티 적용 중입니다.');return;}
   const b=curHotBiz;
-  const {collection,addDoc,serverTimestamp,Timestamp}=NW.fb;
-  const expires=Timestamp.fromMillis(nowMs()+DIRECT_TTL*1000);
-  try{
-    const ref=await addDoc(collection(NW.db,'calls'),{
-      callerId:NW.uid, callerName:(NW.profile?.nickname || NW.user?.displayName || '익명'), party:dcParty,
-      cats:[b.cat], cat:b.cat,
-      lat:myLoc.lat, lng:myLoc.lng,
-      directBizId:b.id, directBizName:b.name,   // 1:1 호출 표시
-      status:'searching', createdAt:serverTimestamp(), expiresAt:expires
-    });
+  try{
+    const ref=await NW.createCall({party:dcParty,cats:[b.cat],lat:myLoc.lat,lng:myLoc.lng,directBizId:b.id});
     dcCallId=ref.id;
     $('dcTarget').textContent=b.name||'매장';
     subShow('u-direct');
-    startDirectTimer();
+    startDirectTimer(ref.expiresAt);
     listenDirectResponse(b.id);
   }catch(e){toast('호출 실패: '+e.message);}
 };
 
-function startDirectTimer(){
-  const endAt = nowMs()+DIRECT_TTL*1000;
+function startDirectTimer(endAt=nowMs()+DIRECT_TTL*1000){
   const total = DIRECT_TTL;
   if(dcTimer) clearInterval(dcTimer);
   const tick=()=>{
@@ -1048,7 +1044,7 @@
   cleanupDirect();
   toast('🎉 매장이 받아줬어요!');
   matchData={callId:dcCallId, id:curHotBiz?.id, bizName:d.matchedBizName||curHotBiz?.name,
-    cat:curHotBiz?.cat, type:'ok', biz:curHotBiz};
+    cat:curHotBiz?.cat, type:'ok', biz:curHotBiz,party:d.party};
   curCallId=dcCallId;
   $('acBizName').textContent=d.matchedBizName||curHotBiz?.name||'매장';
   subShow('u-accepted');
@@ -1061,7 +1057,7 @@
     if(left<=0){ clearInterval(acTimer); onAcceptedTimeout(); }
   };
   tick(); acTimer=setInterval(tick,500);
-  updateMatchBar();
+  matchBarState='accepted';updateMatchBar();
 }
 function onAcceptedTimeout(){
   if(curCallId){
@@ -1075,16 +1071,16 @@
 }
 window.confirmGoing=async()=>{
   if(!curCallId) return;
-  if(acTimer){clearInterval(acTimer); acTimer=null;}
   const {doc,updateDoc,serverTimestamp,Timestamp}=NW.fb;
   try{
     const matchExp=Timestamp.fromMillis(nowMs()+MATCH_TTL*1000);
     await updateDoc(doc(NW.db,'calls',curCallId),{
       status:'going', goingAt:serverTimestamp(), matchExpiresAt:matchExp
     });
+    if(acTimer){clearInterval(acTimer);acTimer=null;}
     toast('🚶 갈게요! 15분 안에 도착하세요.');
     await awardPoints(20, '호출 성사');
-    openMatched(nowMs()+MATCH_TTL*1000);
+    openMatched(matchExp.toMillis());
   }catch(e){toast('실패: '+e.message);}
 };
 window.declineGoing=async()=>{
@@ -1129,6 +1125,7 @@
   if(!dcCallId) return;
   const {doc,updateDoc}=NW.fb;
   try{ await updateDoc(doc(NW.db,'calls',dcCallId),{status}); }catch(e){}
+  if(curCallId===dcCallId)curCallId=null;
   dcCallId=null;
 }
 
@@ -1153,8 +1150,8 @@
   try{
     const {collection,query,where,getDocs}=NW.fb;
     const snap=await getDocs(query(collection(NW.db,'calls'),
-      where('callerId','==',NW.uid),where('matchedBizId','==',bizId),where('status','==','done')));
-    return !snap.empty;
+      where('callerId','==',NW.uid)));
+    return snap.docs.find(d=>d.data().matchedBizId===bizId && d.data().status==='done')?.id||null;
   }catch(e){return false;}
 }
 function renderReviewSection(bizId,list,canReview,myReview){
@@ -1162,9 +1159,9 @@
   if(myReview){
     $('hd-myreview').innerHTML=`<div class="statbox" style="margin-top:0">
       <div style="display:flex;justify-content:space-between;align-items:start">
-        <div><b style="color:var(--y)">내 리뷰 ${'⭐'.repeat(myReview.rating)}</b>
-          <div class="muted" style="margin-top:4px;font-size:13px">${myReview.text||''}</div></div>
-        <button class="adm-btn danger" style="padding:5px 9px;font-size:11px" onclick="deleteMyReview('${myReview.id}','${bizId}')">삭제</button>
+        <div><b style="color:var(--y)">내 리뷰 ${'⭐'.repeat(Math.max(0,Math.min(5,Number(myReview.rating)||0)))}</b>
+          <div class="muted" style="margin-top:4px;font-size:13px">${NW.html(myReview.text||'')}</div></div>
+        <button class="adm-btn danger" style="padding:5px 9px;font-size:11px" onclick="deleteMyReview('${NW.inline(myReview.id)}','${NW.inline(bizId)}')">삭제</button>
       </div></div>`;
   }else if(canReview){
     $('hd-myreview').innerHTML=`<div class="statbox" style="margin-top:0">
@@ -1173,7 +1170,7 @@
         ${[1,2,3,4,5].map(n=>`<span data-n="${n}" onclick="pickStar(${n})" style="cursor:pointer;color:var(--tx3)">★</span>`).join('')}
       </div>
       <textarea class="inp" id="rvText" rows="2" placeholder="음식·분위기·서비스 등 자유롭게"></textarea>
-      <button class="cta" style="margin-top:10px" onclick="submitReview('${bizId}')">리뷰 등록</button>
+      <button class="cta" style="margin-top:10px" onclick="submitReview('${NW.inline(bizId)}')">리뷰 등록</button>
     </div>`;
   }else{
     $('hd-myreview').innerHTML=`<div class="muted" style="font-size:12px;margin-bottom:14px">방문 후 도착완료한 매장만 리뷰를 작성할 수 있어요.</div>`;
@@ -1190,8 +1187,8 @@
       const ts=t?`${t.getMonth()+1}/${t.getDate()}`:'';
       return `<div class="bizdetail" style="margin-top:10px">
         <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
-          <b style="color:var(--y)">${'⭐'.repeat(r.rating||0)}</b>
-          <span style="color:var(--tx3);font-size:11px">${r.userName||r.uid?.slice(0,6)||''} · ${ts}</span>
+          <b style="color:var(--y)">${'⭐'.repeat(Math.max(0,Math.min(5,Number(r.rating)||0)))}</b>
+          <span style="color:var(--tx3);font-size:11px">${NW.html(r.userName||r.uid?.slice(0,6)||'')} · ${ts}</span>
         </div>
         <div style="color:var(--tx2);font-size:13px">${(r.text||'').replace(/</g,'&lt;')}</div></div>`;
     }).join('');
@@ -1208,11 +1205,14 @@
   const {doc,setDoc,getDoc,serverTimestamp,getDocs,collection,query,where,updateDoc}=NW.fb;
   const reviewId=`${bizId}_${NW.uid}`;
   try{
+    const callId=await checkArrivedAt(bizId);
+    if(!callId){toast('도착 완료된 방문만 리뷰를 쓸 수 있어요');return;}
+    if(text.length>1500){toast('리뷰는 1500자까지 작성 가능합니다');return;}
     // 신규 작성인지 확인 (이미 있으면 수정만, 포인트 X)
     const existing = await getDoc(doc(NW.db,'reviews',reviewId));
     const isNew = !existing.exists();
     await setDoc(doc(NW.db,'reviews',reviewId),{
-      bizId, bizName:curHotBiz?.name||'', uid:NW.uid,
+      bizId, callId, bizName:curHotBiz?.name||'', uid:NW.uid,
       userName:(NW.profile?.nickname || NW.user?.displayName || '익명'), rating:rvRating, text, at:serverTimestamp()
     });
     // 매장 평균 갱신
@@ -1231,27 +1231,16 @@
     toast('삭제 완료'); loadHotReviews(bizId);
   }catch(e){toast('실패: '+e.message);}
 };
-async function updateBizRating(bizId){
-  const {collection,query,where,getDocs,doc,updateDoc}=NW.fb;
-  const snap=await getDocs(query(collection(NW.db,'reviews'),where('bizId','==',bizId)));
-  if(snap.empty){
-    await updateDoc(doc(NW.db,'biz',bizId),{ratingAvg:0,ratingCount:0}).catch(()=>{});
-    return;
-  }
-  let sum=0,n=0;
-  snap.forEach(d=>{const r=d.data();if(r.rating){sum+=r.rating;n++;}});
-  const avg=n?+(sum/n).toFixed(2):0;
-  await updateDoc(doc(NW.db,'biz',bizId),{ratingAvg:avg,ratingCount:n}).catch(()=>{});
-}
+async function updateBizRating(bizId){ /* 서버 settleReview가 평점을 집계합니다. */ }
 
 function buildChips(){
   $('partyChips').innerHTML=PARTY.map(p=>`<button class="chip" data-p="${p}" onclick="pickParty(${p})">${p}${p===6?'+':''}명</button>`).join('');
-  $('catChips').innerHTML=CATS.map(c=>`<button class="chip" data-c="${c.k}" onclick="pickCat('${c.k}')">${c.e} ${c.n}</button>`).join('');
+  $('catChips').innerHTML=CATS.map(c=>`<button class="chip" data-c="${c.k}" onclick="pickCat('${NW.inline(c.k)}')">${c.e} ${NW.html(c.n)}</button>`).join('');
   // 상단 카테고리 그리드 (가로 스크롤)
   const colors=['#2D1F0F','#2A1F2D','#2D2510','#2D1A24','#0F2D24','#2D2218','#0F252D','#231A2D','#2D1A24'];
-  $('catGrid').innerHTML=CATS.map((c,i)=>`<div onclick="quickPickCat('${c.k}')" style="text-align:center;flex-shrink:0;width:62px;cursor:pointer">
+  $('catGrid').innerHTML=CATS.map((c,i)=>`<div onclick="quickPickCat('${NW.inline(c.k)}')" style="text-align:center;flex-shrink:0;width:62px;cursor:pointer">
     <div style="width:54px;height:54px;border-radius:50%;background:${colors[i%colors.length]};display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 4px">${c.e}</div>
-    <div style="font-size:11px;font-weight:600;color:var(--tx2)">${c.n}</div></div>`).join('');
+    <div style="font-size:11px;font-weight:600;color:var(--tx2)">${NW.html(c.n)}</div></div>`).join('');
 }
 window.quickPickCat=k=>{
   // 호출 폼 카테고리 칩 활성화 + 스크롤
@@ -1282,7 +1271,7 @@
     showLocPicker();
   }
 };
-function applyLoc(l){myLoc=l;$('locName').textContent=l.name||'선택한 위치';$('locCoord').textContent=l.lat.toFixed(4)+', '+l.lng.toFixed(4);chkReady();}
+function applyLoc(l){myLoc=l;if(NW.uid)loadHotplaces(true);$('locName').textContent=l.name||'선택한 위치';$('locCoord').textContent=l.lat.toFixed(4)+', '+l.lng.toFixed(4);chkReady();}
 let locPicker=null;
 async function showLocPicker(){
   $('locPickWrap').classList.remove('hide');
@@ -1306,6 +1295,14 @@
   penaltyUntil=s.exists()?tsMs(s.data().penaltyUntil):0;
   renderPenaltyBanner();
 }
+let penaltyUnsub=null;
+NW.onAuth(u=>{
+  if(penaltyUnsub)penaltyUnsub();
+  if(u)penaltyUnsub=NW.fb.onSnapshot(NW.fb.doc(NW.db,'users',u.uid),s=>{
+    penaltyUntil=s.exists()?tsMs(s.data().penaltyUntil):0;renderPenaltyBanner();loadPoints();
+  });
+});
+setInterval(()=>renderPenaltyBanner(),1000);
 function penalActive(){return penaltyUntil>nowMs();}
 function renderPenaltyBanner(){
   const el=$('penaltyBanner');
@@ -1315,49 +1312,26 @@
   chkReady();
 }
 
+let callCreating=false;
 window.startCall=async()=>{
   if(!NW.cfgOk){toast('Firebase config를 먼저 설정하세요.');return;}
   if(penalActive()){toast('패널티 적용 중입니다.');return;}
   if(!(sel.party&&sel.cats.length&&myLoc))return;
-  const {collection,addDoc,serverTimestamp,Timestamp}=NW.fb;
-  const expires=Timestamp.fromMillis(nowMs()+CALL_TTL*1000);
-  const ref=await addDoc(collection(NW.db,'calls'),{
-    callerId:NW.uid, callerName:(NW.profile?.nickname || NW.user?.displayName || '익명'), party:sel.party,
-    cats:sel.cats, cat:sel.cats[0],   // 다중 + 구버전 호환
-    lat:myLoc.lat, lng:myLoc.lng,
-    status:'searching', createdAt:serverTimestamp(), expiresAt:expires});
+  if(callCreating)return;
+  callCreating=true;$('callBtn').disabled=true;
+  try{
+  const ref=await NW.createCall({party:sel.party,cats:sel.cats,lat:myLoc.lat,lng:myLoc.lng});
   curCallId=ref.id; subShow('u-search');
   $('resList').innerHTML=''; $('srCount').textContent='0';
-  listenResponses(); runCallTimer(nowMs()+CALL_TTL*1000);
-  autoRespondDemo(ref.id);   // 데모 매장 자동 응답
+  listenResponses(); runCallTimer(ref.expiresAt);
+  }catch(e){toast('호출 실패: '+e.message);}
+  finally{callCreating=false;chkReady();}
 };
 
 /* 데모 매장(ownerId='demo') 자동 응답 — 반경·업종 맞으면 1~3초 뒤 '가능/10분후' 삽입.
    실제 매장 콘솔이 없어도 혼자 전체 흐름을 테스트할 수 있게 해줌. */
-async function autoRespondDemo(callId){
-  try{
-    const {collection,query,where,getDocs,doc,setDoc,serverTimestamp}=NW.fb;
-    const cats=sel.cats.slice();
-    // 'in' 쿼리는 최대 10개, 우리 cats는 최대 9개라 안전
-    const snap=await getDocs(query(collection(NW.db,'biz'),where('cat','in',cats)));
-    const demos=snap.docs.map(d=>({id:d.id,...d.data()}))
-      .filter(b=>b.demo && b.approved!==false);
-    demos.forEach(b=>{
-      if(sel.party < (b.minParty||1)) return;
-      const dist=haversine(myLoc,{lat:b.lat,lng:b.lng});
-      if(dist>(b.radius||2000)) return;
-      const type=Math.random()<0.75?'ok':'soon';
-      const delay=800+Math.random()*2500;
-      setTimeout(async()=>{
-        if(curCallId!==callId) return;
-        await setDoc(doc(NW.db,'calls',callId,'responses',b.id),{
-          bizId:b.id, bizName:b.name, cat:b.cat, type, dist, at:serverTimestamp()
-        }).catch(()=>{});
-      }, delay);
-    });
-  }catch(e){ console.warn('autoRespondDemo',e); }
-}
 function listenResponses(){
+  if(callUnsub)callUnsub();
   responses=[];
   const {collection,onSnapshot}=NW.fb;
   callUnsub=onSnapshot(collection(NW.db,'calls',curCallId,'responses'),snap=>{
@@ -1389,8 +1363,8 @@
 }
 function card(r){const c=catOf(r.cat||sel.cats[0]);
   const badge=r.type==='ok'?'<span class="badge bd-ok">지금 가능</span>':'<span class="badge bd-soon">10분 후</span>';
-  return `<div class="bizcard" onclick="openDetail('${r.id}')"><div class="em">${c.e}</div>
-    <div class="info"><b>${r.bizName||'매장'}</b><div class="meta">${distLabel(r.dist)} · ${c.n}</div></div>${badge}</div>`;}
+  return `<div class="bizcard" onclick="openDetail('${NW.inline(r.id)}')"><div class="em">${c.e}</div>
+    <div class="info"><b>${NW.html(r.bizName||'매장')}</b><div class="meta">${distLabel(r.dist)} · ${NW.html(c.n)}</div></div>${badge}</div>`;}
 
 let callEndAt=0;
 function runCallTimer(end){callEndAt=end;clearInterval(callTimer);
@@ -1400,15 +1374,15 @@
   tick();callTimer=setInterval(tick,250);}
 async function endSearch(){
   if(!curCallId)return;
-  if(responses.length===0){
+  {
     const {doc,updateDoc}=NW.fb;
     await updateDoc(doc(NW.db,'calls',curCallId),{status:'expired'}).catch(()=>{});
-    cleanupCall();toast('주변에서 응답이 없었어요. 다시 시도해 주세요.');subShow('u-home');
+    cleanupCall();curCallId=null;toast('응답·선택 시간이 끝났어요. 다시 호출해주세요.');subShow('u-home');
   }
 }
 window.cancelCall=async()=>{
   if(curCallId){const {doc,updateDoc}=NW.fb;await updateDoc(doc(NW.db,'calls',curCallId),{status:'cancelled'}).catch(()=>{});}
-  cleanupCall();subShow('u-home');
+  cleanupCall();curCallId=null;subShow('u-home');
 };
 function cleanupCall(){clearInterval(callTimer);if(callUnsub){callUnsub();callUnsub=null;}}
 
@@ -1425,12 +1399,13 @@
   subShow('u-detail');
   // 사진
   $('d-photo').innerHTML = b.photo
-    ? `<img src="${b.photo}" style="width:100%;height:170px;object-fit:cover;border-radius:var(--rad)" onerror="this.parentNode.innerHTML='${photoFallback(c)}'">`
+    ? `<img src="${NW.html(NW.safeURL(b.photo))}" style="width:100%;height:170px;object-fit:cover;border-radius:var(--rad)" onerror="this.style.display='none'">`
     : photoFallback(c);
   $('d-name').textContent=r.bizName||'매장';
-  $('d-meta').textContent=`${c.e} ${c.n} · ${distLabel(r.dist)}`;
+  $('d-meta').textContent=`${c.e} ${NW.html(c.n)} · ${distLabel(r.dist)}`;
   $('d-badge').innerHTML = r.type==='ok'?'<span class="badge bd-ok">지금 가능</span>':'<span class="badge bd-soon">10분 후</span>';
   // 길찾기 링크
+  $('d-route').classList.toggle('hide',!(b.lat&&b.lng));
   if(b.lat&&b.lng)$('d-route').href=NW.kakaoRoute(r.bizName,b.lat,b.lng);
   else $('d-route').classList.add('hide');
   // 메뉴
@@ -1444,7 +1419,7 @@
 function renderMenu(menu){
   if(!menu||!menu.length){$('d-menu').innerHTML='';return;}
   $('d-menu').innerHTML=`<div class="h2" style="margin-top:24px">메뉴</div><div class="bizdetail">`+
-    menu.map(m=>`<div class="row"><span style="color:var(--tx)">${m.name}</span><b>${m.price?m.price.toLocaleString()+'원':'-'}</b></div>`).join('')+`</div>`;
+    menu.map(m=>`<div class="row"><span style="color:var(--tx)">${NW.html(m.name)}</span><b>${NW.html(m.price?m.price.toLocaleString()+'원':'-')}</b></div>`).join('')+`</div>`;
 }
 function renderInfo(b){
   const rows=[];
@@ -1453,7 +1428,7 @@
   rows.push(['주차',b.parking?'가능':'불가']);
   rows.push(['예약',b.reservation?'가능':'불가']);
   $('d-info').innerHTML=`<div class="h2" style="margin-top:24px">영업정보</div><div class="bizdetail">`+
-    rows.map(r=>`<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')+`</div>`;
+    rows.map(r=>`<div class="row"><span>${r[0]}</span><b>${NW.html(r[1])}</b></div>`).join('')+`</div>`;
 }
 async function drawMap(b){
   const box=$('d-map');
@@ -1498,14 +1473,14 @@
     matchData={callId:curCallId,...r,biz:detailBiz, party:sel.party};
     cleanupCall();
     await awardPoints(20, '호출 성사');
-    openMatched(nowMs()+MATCH_TTL*1000);
+    openMatched(matchExp.toMillis());
   }catch(e){
     console.error('[confirmMatch] 실패:',e);
     toast('매칭 실패: '+(e.code||e.message||'알 수 없는 오류'));
     if(btn){btn.disabled=false;btn.textContent='여기로 갈게요';}
     matching=false;
     return;
-  }finally{ matching=false; }
+  }finally{ matching=false;if(btn){btn.disabled=false;btn.textContent='여기로 갈게요';} }
 };
 function openMatched(end){const r=matchData,c=catOf(r.cat||sel.cats[0]);
   matchData._matchEnd=end;
@@ -1515,10 +1490,10 @@
   const b=r.biz||{};
   let routeRow='';
   if(b.lat&&b.lng)routeRow=`<div class="row"><span>길찾기</span><b><a href="${NW.kakaoRoute(r.bizName,b.lat,b.lng)}" target="_blank" rel="noopener" style="color:var(--y)">카카오맵 열기 →</a></b></div>`;
-  $('mDetail').innerHTML=`<div class="row"><span>업종</span><b>${c.e} ${c.n}</b></div>
-    <div class="row"><span>인원</span><b>${r.party||sel.party}명</b></div>
+  $('mDetail').innerHTML=`<div class="row"><span>업종</span><b>${c.e} ${NW.html(c.n)}</b></div>
+    <div class="row"><span>인원</span><b>${NW.html(r.party||sel.party)}명</b></div>
     <div class="row"><span>거리</span><b>${distLabel(r.dist||0)}</b></div>
-    ${b.phone?`<div class="row"><span>전화</span><b>${b.phone}</b></div>`:''}
+    ${b.phone?`<div class="row"><span>전화</span><b>${NW.html(b.phone)}</b></div>`:''}
     <div class="row"><span>상태</span><b style="color:var(--ok)">입장 가능</b></div>
     ${routeRow}`;
   subShow('u-matched');clearInterval(matchTimer);
@@ -1527,7 +1502,7 @@
     const left=(end-nowMs())/1000;
     $('mTimer').textContent=fmtT(left);
     // 매장이 도착 확인하면 done 상태로 → 자동 종료
-    if(left<=0){clearInterval(matchTimer);}
+    if(left<=0){noShow();}
   };
   tick();matchTimer=setInterval(tick,500);
   // 매장이 도착확인/노쇼 처리 감지
@@ -1565,12 +1540,9 @@
   });
 }
 async function onNoShowReceived(){
-  penaltyUntil=nowMs()+PENALTY*1000;
-  const {doc,setDoc,Timestamp}=NW.fb;
-  await setDoc(doc(NW.db,'users',NW.uid),{penaltyUntil:Timestamp.fromMillis(penaltyUntil)},{merge:true}).catch(()=>{});
-  await saveHist('noshow');
+  await refreshPenalty();
   matchData=null;curCallId=null;
-  toast('노쇼 처리됐어요. 30분 패널티가 적용됩니다.');
+  toast('노쇼 처리됐어요. 도착 마감 후 30분 동안 호출이 제한됩니다.');
   renderPenaltyBanner();subShow('u-home');
 }
 
@@ -1590,7 +1562,7 @@
       const left=Math.max(0,Math.ceil((end-nowMs())/1000));
       icon='🚶'; timeText=`${fmtT(left)} 내 도착`;
     }
-    bar.innerHTML=`<span class="mb-i">${icon}</span><span class="mb-txt">${label} · ${timeText}</span><span class="mb-arrow">›</span>`;
+    bar.innerHTML=`<span class="mb-i">${icon}</span><span class="mb-txt">${NW.html(label)} · ${timeText}</span><span class="mb-arrow">›</span>`;
   };
   bar.classList.remove('hide');
   render(); matchBarTimer=setInterval(render,500);
@@ -1620,65 +1592,28 @@
   }catch(e){}
 }
 
-window.arrive=async()=>{clearInterval(matchTimer);
-  if(matchData){const {doc,updateDoc,serverTimestamp}=NW.fb;await updateDoc(doc(NW.db,'calls',matchData.callId),{status:'done',arrivedAt:serverTimestamp()}).catch(()=>{});await coarsenCallLocation(matchData.callId);}
-  await saveHist('done');toast('도착 완료! 즐거운 시간 되세요 🎉');matchData=null;curCallId=null;subShow('u-home');};
 window.cancelMatch=async()=>{
-  if(!confirm('정말 매칭을 취소할까요? 매장에 자리를 비워주세요.'))return;
-  clearInterval(matchTimer);
-  if(matchStatusUnsub){matchStatusUnsub();matchStatusUnsub=null;}
-  if(matchData){const {doc,updateDoc}=NW.fb;await updateDoc(doc(NW.db,'calls',matchData.callId),{status:'cancelled'}).catch(()=>{});await coarsenCallLocation(matchData.callId);}
-  await saveHist('cancelled');
-  hideMatchBar();
-  matchData=null;curCallId=null;subShow('u-home');
-};
+  if(!matchData || !confirm('정말 매칭을 취소할까요?'))return;
+  try{
+    await NW.fb.updateDoc(NW.fb.doc(NW.db,'calls',matchData.callId),{status:'cancelled'});
+    clearInterval(matchTimer);
+    if(matchStatusUnsub){matchStatusUnsub();matchStatusUnsub=null;}
+    hideMatchBar();matchData=null;curCallId=null;subShow('u-home');
+  }catch(e){toast('취소 실패: '+e.message);}
+};
+let expiring=false;
 async function noShow(){
-  const {doc,updateDoc,setDoc,Timestamp}=NW.fb;
-  if(matchData){await updateDoc(doc(NW.db,'calls',matchData.callId),{status:'noshow'}).catch(()=>{});await coarsenCallLocation(matchData.callId);}
-  penaltyUntil=nowMs()+PENALTY*1000;
-  await setDoc(doc(NW.db,'users',NW.uid),{penaltyUntil:Timestamp.fromMillis(penaltyUntil)},{merge:true}).catch(()=>{});
-  await saveHist('noshow');matchData=null;curCallId=null;
-  toast('시간 초과 — 노쇼 처리되어 30분 패널티가 적용됐어요.');renderPenaltyBanner();subShow('u-home');}
-
-async function saveHist(status){if(!NW.uid)return;
-  const {collection,addDoc,serverTimestamp}=NW.fb;
-  await addDoc(collection(NW.db,'users',NW.uid,'history'),{
-    bizId:matchData?.id||matchData?.matchedBizId||'',
-    bizName:matchData?.bizName||'-',cat:matchData?.cat||sel.cats?.[0]||'',party:matchData?.party||sel.party,status,at:serverTimestamp()}).catch(()=>{});
-  // 포인트 적립/차감
-  const POINT_TABLE = { matched:20, done:100, noshow:-200, cancelled:0 };
-  const REASON_TABLE = { matched:'호출 성사', done:'도착 완료', noshow:'노쇼', cancelled:'취소' };
-  const pts = POINT_TABLE[status];
-  if(pts) await awardPoints(pts, REASON_TABLE[status]);
-}
+  if(expiring||!matchData?.callId)return;
+  expiring=true;
+  try{await NW.expireCall(matchData.callId);}catch(e){toast('만료 처리 재시도 중');}
+  finally{expiring=false;}
+}
+
+async function saveHist(){ /* 서버 settleCall이 확정된 호출로 기록합니다. */ }
 
 /* 포인트 시스템 */
 let userPoints = 0;
-async function awardPoints(delta, reason){
-  if(!NW.uid || !delta) return;
-  const {doc,getDoc,setDoc,serverTimestamp,collection,addDoc,increment}=NW.fb;
-  try{
-    // 사용자 문서에 포인트 누적 (increment 사용)
-    const userRef=doc(NW.db,'users',NW.uid);
-    const inc = NW.fb.increment ? NW.fb.increment(delta) : delta;
-    // increment가 없으면 트랜잭션 없이 단순 가산
-    if(NW.fb.increment){
-      await setDoc(userRef,{points:NW.fb.increment(delta)},{merge:true});
-    }else{
-      // 수동 가산 (경합 가능하지만 단일 사용자라 문제 없음)
-      const s=await getDoc(userRef);
-      const cur = s.exists() && s.data().points ? s.data().points : 0;
-      await setDoc(userRef,{points:cur+delta},{merge:true});
-    }
-    // 포인트 로그 (서브컬렉션)
-    await addDoc(collection(NW.db,'users',NW.uid,'points'),{
-      delta, reason, balance:null, at:serverTimestamp()
-    }).catch(()=>{});
-    // 토스트로 알림
-    const emoji = delta>0 ? '💰' : '📉';
-    toast(`${emoji} ${reason} ${delta>0?'+':''}${delta}P`);
-  }catch(e){console.warn('[awardPoints] 실패:',e);}
-}
+async function awardPoints(){ /* 서버 이벤트의 중복 방지 원장이 포인트를 정산합니다. */ }
 
 async function loadPoints(){
   if(!NW.uid) { userPoints=0; }
@@ -1712,12 +1647,12 @@
     const alreadyReviewed = canReview && myReviewed.has(v.bizId);
     let actionBtn='';
     if(canReview && !alreadyReviewed){
-      actionBtn = `<button class="chip" style="margin-top:6px;padding:5px 10px;font-size:11px;color:var(--y);border-color:var(--y)" onclick="openReviewFromHist('${v.bizId}','${(v.bizName||'').replace(/'/g,'')}')">⭐ 리뷰 쓰기 (+50P)</button>`;
+      actionBtn = `<button class="chip" style="margin-top:6px;padding:5px 10px;font-size:11px;color:var(--y);border-color:var(--y)" onclick="openReviewFromHist('${NW.inline(v.bizId)}','${NW.inline((v.bizName||'').replace(/'/g,''))}')">⭐ 리뷰 쓰기 (+50P)</button>`;
     }else if(alreadyReviewed){
       actionBtn = `<span style="margin-top:6px;display:inline-block;font-size:11px;color:var(--tx3)">✓ 리뷰 작성됨</span>`;
     }
-    return `<div class="hist-item"><div class="hi-l"><b>${c.e} ${v.bizName}</b>
-      <small>${v.party}명 · ${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}</small>
+    return `<div class="hist-item"><div class="hi-l"><b>${c.e} ${NW.html(v.bizName)}</b>
+      <small>${NW.html(v.party)}명 · ${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}</small>
       ${actionBtn}</div>
       <span class="hs" style="background:${s[1]};color:${s[2]}">${s[0]}</span></div>`;}).join('');}
 
@@ -1736,8 +1671,8 @@
     const sign = p.delta>0?'+':'';
     const color = p.delta>0?'var(--ok)':'var(--no)';
     return `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--bd)">
-      <span style="color:var(--tx2)">${p.reason||''} · ${t.getMonth()+1}/${t.getDate()}</span>
-      <b style="color:${color}">${sign}${p.delta}P</b></div>`;
+      <span style="color:var(--tx2)">${NW.html(p.reason||'')} · ${t.getMonth()+1}/${t.getDate()}</span>
+      <b style="color:${color}">${sign}${NW.html(p.delta)}P</b></div>`;
   }).join('') || '<div class="muted" style="font-size:12px;padding:8px 0">아직 포인트 내역이 없어요.</div>';
   $('myPoints').innerHTML=`
     <div class="statbox" style="margin-top:0">
@@ -1757,7 +1692,7 @@
       <div style="font-size:36px">🎭</div>
       <div style="flex:1">
         <div style="font-size:11px;color:var(--tx3);font-weight:700">현재 닉네임</div>
-        <div style="font-size:18px;font-weight:800;color:var(--y);margin-top:2px">${nick}</div>
+        <div style="font-size:18px;font-weight:800;color:var(--y);margin-top:2px">${NW.html(nick)}</div>
         <div style="font-size:11px;color:var(--tx3);margin-top:4px">매장과 커뮤니티에 이 이름으로 표시돼요</div>
       </div>
       <button onclick="openChangeNick()" style="background:var(--bg3);color:var(--y);border:1px solid var(--y);padding:8px 12px;font-size:12px;font-weight:700;border-radius:8px">✏️ 변경</button>
@@ -1806,14 +1741,14 @@
   const biz=await NW.myBusiness();
   if(biz && biz.approved){
     body.innerHTML=`<div class="statbox" style="margin-top:20px"><b style="color:var(--ok)">✓ 승인된 파트너</b>
-      <div class="muted" style="margin-top:6px">${biz.name}</div></div>
+      <div class="muted" style="margin-top:6px">${NW.html(biz.name)}</div></div>
       <button class="cta" style="margin-top:16px" onclick="location.href='merchant.html'">매장 콘솔 열기 →</button>`;
     return;
   }
   if(biz && !biz.approved){
     body.innerHTML=`<div class="penalty" style="border-color:var(--soon);background:var(--soonbg);margin-top:20px">
       <div class="pi">🕒</div><div><b style="color:var(--soon)">승인 대기 중</b>
-      <div class="pt" style="color:var(--soon)">"${biz.name}" · 관리자 검토중</div></div></div>
+      <div class="pt" style="color:var(--soon)">"${NW.html(biz.name)}" · 관리자 검토중</div></div></div>
       <div class="demo-hint">관리자가 승인하면 다음 로그인 때 매장 콘솔로 바로 연결돼요.</div>`;
     return;
   }
@@ -1836,7 +1771,7 @@
       <div id="pPick" style="width:100%;height:200px;border-radius:var(--rad);margin-top:8px;background:var(--bg2);border:1px solid var(--bd);overflow:hidden"></div></div>
     <button class="cta" id="pBtn" onclick="submitPartner()" disabled>매장 파트너 신청하기</button>
     <div class="demo-hint">신청하면 <b>승인 대기</b> 상태가 되고, 관리자(BIMILCALL 운영팀) 승인 후 매장 콘솔이 열려요.</div>`;
-  $('pCat').innerHTML=NW.CATS.map(c=>`<button class="chip" data-c="${c.k}" onclick="pPickCat('${c.k}')">${c.e} ${c.n}</button>`).join('');
+  $('pCat').innerHTML=NW.CATS.map(c=>`<button class="chip" data-c="${c.k}" onclick="pPickCat('${NW.inline(c.k)}')">${c.e} ${NW.html(c.n)}</button>`).join('');
   $('pRad').innerHTML=NW.RADII.map(r=>`<button class="chip ${r===1000?'on':''}" data-r="${r}" onclick="pPickRad(${r})">${distLabel(r)}</button>`).join('');
   $('pName').addEventListener('input',pChk);
   pGetLoc();
@@ -1863,9 +1798,9 @@
 };
 function pChk(){const b=$('pBtn');if(b)b.disabled=!($('pName').value.trim()&&pSel.cat&&pLoc);}
 window.submitPartner=async()=>{
-  const {collection,addDoc,serverTimestamp}=NW.fb;
+  const {doc,setDoc,serverTimestamp}=NW.fb;
   const menu=$('pMenu').value.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.lastIndexOf(',');if(i<0)return{name:l,price:0};return{name:l.slice(0,i).trim(),price:parseInt(l.slice(i+1).replace(/[^0-9]/g,''))||0};});
-  await addDoc(collection(NW.db,'biz'),{
+  await setDoc(doc(NW.db,'biz',NW.uid),{
     name:$('pName').value.trim(),cat:pSel.cat,radius:pSel.rad,lat:pLoc.lat,lng:pLoc.lng,status:'open',
     approved:false,ownerId:NW.uid,ownerName:NW.user?.displayName||'',ownerEmail:NW.user?.email||'',
     menu,hours:$('pHours').value.trim(),phone:$('pPhone').value.trim(),parking:false,reservation:true,
@@ -1915,35 +1850,14 @@
 };
 
 window.deleteAccount=async()=>{
-  if(!confirm('정말 회원 탈퇴할까요?\n\n• 프로필, 호출 기록, 패널티 정보가 모두 영구 삭제됩니다\n• 진행 중인 호출이 있으면 자동 취소됩니다\n• 되돌릴 수 없습니다\n\n계속하려면 확인을 누르세요.'))return;
-  if(!confirm('마지막 확인 — 정말로 모든 데이터를 삭제하시겠어요?'))return;
-  const {doc,deleteDoc,getDocs,collection,query,where,updateDoc}=NW.fb;
-  toast('데이터를 삭제하는 중…');
-  try{
-    // 1) 진행 중인 호출 취소
-    const active=await getDocs(query(collection(NW.db,'calls'),where('callerId','==',NW.uid)));
-    for(const d of active.docs){
-      const s=d.data().status;
-      if(s==='searching'||s==='matched'){
-        await updateDoc(d.ref,{status:'cancelled'}).catch(()=>{});
-      }
-    }
-    // 2) history 서브컬렉션 삭제
-    const hist=await getDocs(collection(NW.db,'users',NW.uid,'history'));
-    for(const d of hist.docs){ await deleteDoc(d.ref).catch(()=>{}); }
-    // 3) 프로필 문서 삭제
-    await deleteDoc(doc(NW.db,'users',NW.uid)).catch(()=>{});
-    // 4) Firebase Auth 계정 삭제 시도 (재인증 필요할 수 있음)
-    try{
-      if(NW.user && NW.user.delete) await NW.user.delete();
-    }catch(authErr){
-      // 재인증 필요 — 로그아웃 후 안내
-      console.warn('auth delete needs re-auth',authErr);
-    }
-    toast('회원 탈퇴 완료. 안녕히 가세요.');
-    setTimeout(()=>{ NW.logout(); }, 1500);
-  }catch(e){toast('탈퇴 실패: '+e.message);}
-};
+  if(!confirm('계정·호출·리뷰·게시글·댓글·좋아요·포인트를 영구 삭제할까요?'))return;
+  try{
+    await NW.callServer('deleteMyAccount');
+    toast('회원 탈퇴 완료');
+    await NW.logout();
+  }catch(e){toast('탈퇴 미완료: '+e.message);}
+};
+
 
 
 init();
```

## firestore.rules / 전체 교체

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function active() {
      return signedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('deleting',false) == false;
    }
    // 이메일 문자열 사칭 방지: 실제 인증된 운영자 이메일만 관리자.
    function isAdmin() {
      return signedIn() && request.auth.token.get('email_verified',false) == true &&
        request.auth.token.get('email','') in ['urildlduri@gmail.com','liferefix@naver.com'];
    }
    function own(uid) { return signedIn() && request.auth.uid == uid; }
    function biz(id) { return get(/databases/$(database)/documents/biz/$(id)).data; }
    function isMerchantAccount() {
      return active() && request.auth.token.get('email','').matches('.*@bimilcall(-biz)?\\.local') &&
        exists(/databases/$(database)/documents/biz/$(request.auth.uid)) &&
        biz(request.auth.uid).ownerId == request.auth.uid && biz(request.auth.uid).approved == true;
    }
    function isUser() {
      return active() && !isMerchantAccount() && request.auth.token.get('email','').matches('.*@bimilcall\\.local');
    }
    function text(x,max) { return x is string && x.size() > 0 && x.size() <= max; }
    function changes(keys) { return request.resource.data.diff(resource.data).affectedKeys().hasOnly(keys); }
    function validBiz() {
      let d=request.resource.data;
      return text(d.name,80) && d.cat in ['karaoke_bar','karaoke','danran','yuheung','club','massage','spa'] &&
        d.status in ['open','busy','closed'] && d.get('radius',1000) in [500,1000,2000] &&
        d.lat is number && d.lat >= -90 && d.lat <= 90 &&
        d.lng is number && d.lng >= -180 && d.lng <= 180 &&
        d.get('minParty',1) is int && d.get('minParty',1) >= 1 && d.get('minParty',1) <= 6;
    }
    match /users/{uid} {
      allow read: if own(uid) || isAdmin();
      // 포인트·패널티·activeCallId는 서버 전용. 프로필 삭제로 패널티 우회 금지.
      allow create: if own(uid) && request.resource.data.keys().hasOnly([
        'userId','email','nickname','birthYear','role','points','createdAt','termsAgreedAt'
      ]) && request.resource.data.role == 'user' && request.resource.data.points == 0 &&
        request.resource.data.email == request.auth.token.email && text(request.resource.data.nickname,80) &&
        (request.resource.data.birthYear == null ||
          (request.resource.data.birthYear is int && request.resource.data.birthYear >= 1920 && request.resource.data.birthYear <= request.time.year()-19)) &&
        request.resource.data.createdAt == request.time && request.resource.data.termsAgreedAt == request.time;
      allow update: if isAdmin() || (own(uid) && active() && text(request.resource.data.nickname,20) && (
        changes(['nickname']) ||
        (resource.data.get('birthYear',null) == null && changes(['userId','nickname','birthYear']) &&
          request.resource.data.birthYear is int && request.resource.data.birthYear >= 1920 &&
          request.resource.data.birthYear <= request.time.year()-19)
      ));
      allow delete: if isAdmin();
      match /history/{hid} {
        allow read: if own(uid) || isAdmin();
        allow delete: if own(uid) || isAdmin();
        allow create, update: if isAdmin();
      }
      match /points/{pid} {
        allow read: if own(uid) || isAdmin();
        allow write: if isAdmin();
      }
    }
    match /calls/{callId} {
      function caller() { return isUser() && resource.data.callerId == request.auth.uid; }
      function answered() {
        return isMerchantAccount() && resource.data.get('matchedBizId','') == request.auth.uid &&
          exists(/databases/$(database)/documents/calls/$(callId)/responses/$(request.auth.uid));
      }
      function response(id) { return get(/databases/$(database)/documents/calls/$(callId)/responses/$(id)).data; }
      function matchDeadline() {
        return request.resource.data.matchExpiresAt is timestamp &&
          request.resource.data.matchExpiresAt >= request.time + duration.value(890,'s') &&
          request.resource.data.matchExpiresAt <= request.time + duration.value(910,'s') &&
          request.resource.data.goingAt == request.time;
      }
      function userTransition() {
        return caller() && (
          // 사용자는 도착완료를 직접 조작할 수 없다.
          (resource.data.status == 'searching' && request.resource.data.status == 'going' &&
            resource.data.expiresAt > request.time && changes(['status','matchedBizId','matchedBizName','matchedAt','goingAt','matchExpiresAt']) &&
            response(request.resource.data.matchedBizId).type in ['ok','soon'] &&
            biz(request.resource.data.matchedBizId).approved == true &&
            request.resource.data.matchedBizName == biz(request.resource.data.matchedBizId).name &&
            request.resource.data.matchedAt == request.time && matchDeadline()) ||
          (resource.data.status == 'accepted' && resource.data.goingDeadline > request.time &&
            request.resource.data.status == 'going' && changes(['status','goingAt','matchExpiresAt']) && matchDeadline()) ||
          (resource.data.status in ['searching','accepted','going','matched'] && request.resource.data.status == 'cancelled' && changes(['status']) &&
            (!(resource.data.status in ['going','matched']) || resource.data.matchExpiresAt > request.time)) ||
          (resource.data.status == 'searching' && resource.data.expiresAt <= request.time && request.resource.data.status == 'expired' && changes(['status']))
        );
      }
      function merchantTransition() {
        return isMerchantAccount() && (
          (resource.data.status == 'searching' && resource.data.expiresAt > request.time &&
            resource.data.get('directBizId','') == request.auth.uid && response(request.auth.uid).type == 'ok' &&
            request.resource.data.status == 'accepted' && request.resource.data.matchedBizId == request.auth.uid &&
            request.resource.data.matchedBizName == biz(request.auth.uid).name &&
            request.resource.data.acceptedAt == request.time &&
            request.resource.data.goingDeadline >= request.time + duration.value(20,'s') &&
            request.resource.data.goingDeadline <= request.time + duration.value(40,'s') &&
            changes(['status','matchedBizId','matchedBizName','acceptedAt','goingDeadline'])) ||
          (answered() && resource.data.status in ['going','matched'] && (
            (request.resource.data.status == 'done' && resource.data.matchExpiresAt > request.time &&
              request.resource.data.arrivedAt == request.time && changes(['status','arrivedAt'])) ||
            (request.resource.data.status == 'noshow' && resource.data.matchExpiresAt <= request.time && changes(['status']))
          ))
        );
      }
      // 일반 사용자는 타인의 위치·닉네임·호출 이력을 읽을 수 없다.
      allow read: if isAdmin() || (active() && resource.data.callerId == request.auth.uid) ||
        (isMerchantAccount() && (resource.data.get('matchedBizId','') == request.auth.uid ||
          (resource.data.status == 'searching' && biz(request.auth.uid).cat in resource.data.cats)));
      // 서버 callable이 원자적으로 중복 호출·패널티를 검증해 생성한다.
      allow create: if false;
      allow update: if isAdmin() || userTransition() || merchantTransition();
      allow delete: if isAdmin();
      match /responses/{bizId} {
        function call() { return get(/databases/$(database)/documents/calls/$(callId)).data; }
        function inRange() {
          return call().get('directBizId','') == bizId || (
            call().party >= biz(bizId).get('minParty',1) &&
            latlng.value(call().lat,call().lng).distance(latlng.value(biz(bizId).lat,biz(bizId).lng)) <= biz(bizId).get('radius',1000)
          );
        }
        allow read: if isAdmin() || (active() && call().callerId == request.auth.uid) ||
          (isMerchantAccount() && bizId == request.auth.uid);
        // 본인 UID 경로만 허용. 이메일 도메인만으로 권한을 주지 않는다.
        allow create, update: if isMerchantAccount() && bizId == request.auth.uid &&
          call().status == 'searching' && call().expiresAt > request.time &&
          biz(bizId).status in ['open','busy'] &&
          inRange() && biz(bizId).cat in call().cats && call().get('directBizId',bizId) == bizId &&
          request.resource.data.keys().hasOnly(['bizId','bizName','cat','type','dist','responderUid','responderName','responderEmail','at']) &&
          request.resource.data.bizId == bizId && request.resource.data.bizName == biz(bizId).name &&
          request.resource.data.cat == biz(bizId).cat &&
          request.resource.data.responderUid == request.auth.uid &&
          request.resource.data.responderEmail == request.auth.token.email &&
          request.resource.data.type in ['ok','soon','no'] &&
          (biz(bizId).status != 'busy' || request.resource.data.type != 'ok') &&
          request.resource.data.dist is number && request.resource.data.dist >= 0 &&
          request.resource.data.at == request.time;
        allow delete: if isMerchantAccount() && bizId == request.auth.uid && call().status == 'searching';
      }
    }
    match /biz/{bizId} {
      allow read: if active() || isAdmin();
      // 일반 사용자는 승인 대기 신청만 생성. 응답하려면 운영자가 UID 매장 계정을 발급한다.
      allow create: if isAdmin() || (isUser() && validBiz() && request.resource.data.ownerId == request.auth.uid &&
        request.resource.data.approved == false &&
        !request.resource.data.keys().hasAny(['isHot','memberEmails','merchantId','ratingAvg','ratingCount','demo']));
      // 승인·소유자·추천·평점·직원 권한은 소유자도 변경 불가.
      allow update: if isAdmin() || (active() && resource.data.ownerId == request.auth.uid &&
        changes(['name','cat','radius','minParty','lat','lng','photo','website','menu','hours','phone','parking','reservation','status']) &&
        validBiz());
      allow delete: if isAdmin();
    }
    match /reviews/{reviewId} {
      function proof() { return get(/databases/$(database)/documents/calls/$(request.resource.data.callId)).data; }
      allow read: if active() || isAdmin();
      // 서버 기록으로 방문 검증. 자기신고 history는 리뷰 자격으로 쓰지 않는다.
      allow create, update: if isUser() && request.resource.data.keys().hasOnly(['bizId','bizName','uid','userName','rating','text','at','callId']) &&
        request.resource.data.uid == request.auth.uid &&
        reviewId == request.resource.data.bizId + '_' + request.auth.uid &&
        proof().callerId == request.auth.uid && proof().matchedBizId == request.resource.data.bizId && proof().status == 'done' &&
        request.resource.data.rating is int && request.resource.data.rating >= 1 && request.resource.data.rating <= 5 &&
        request.resource.data.text is string && request.resource.data.text.size() <= 1500 &&
        text(request.resource.data.userName,20) && request.resource.data.at == request.time;
      allow delete: if isAdmin() || (isUser() && resource.data.uid == request.auth.uid);
    }
    match /community/{postId} {
      allow read: if active() || isAdmin();
      allow create: if isUser() && request.resource.data.keys().hasOnly(['title','content','category','nickname','uid','likes','commentCount','createdAt']) &&
        request.resource.data.uid == request.auth.uid && text(request.resource.data.title,60) && text(request.resource.data.content,1500) &&
        text(request.resource.data.nickname,20) && request.resource.data.category in ['live','review','recommend','hiring','free'] &&
        request.resource.data.likes == 0 && request.resource.data.commentCount == 0 && request.resource.data.createdAt == request.time;
      // 카운터는 서버가 집계. 사용자 ID나 타인의 글 변경을 금지한다.
      allow update: if isAdmin();
      allow delete: if isAdmin() || (isUser() && resource.data.uid == request.auth.uid);
      match /comments/{commentId} {
        allow read: if active() || isAdmin();
        allow create: if isUser() && exists(/databases/$(database)/documents/community/$(postId)) &&
          request.resource.data.keys().hasOnly(['content','nickname','uid','at']) &&
          request.resource.data.uid == request.auth.uid && text(request.resource.data.content,500) &&
          text(request.resource.data.nickname,20) && request.resource.data.at == request.time;
        allow delete: if isAdmin() || (isUser() && resource.data.uid == request.auth.uid);
        allow update: if false;
      }
      match /likes/{uid} {
        allow read: if active() || isAdmin();
        allow create: if isUser() && own(uid) && exists(/databases/$(database)/documents/community/$(postId)) &&
          request.resource.data.keys().hasOnly(['uid','at']) && request.resource.data.uid == uid && request.resource.data.at == request.time;
        allow delete: if isUser() && own(uid);
        allow update: if false;
      }
    }
    // collectionGroup 통계 쿼리. 쓰기 권한은 절대로 추가하지 않는다.
    match /{path=**}/history/{id} { allow read: if isAdmin(); }
    match /{path=**}/points/{id} { allow read: if isAdmin(); }
    match /{path=**}/responses/{id} {
      allow read: if isAdmin() || (isMerchantAccount() && resource.data.bizId == request.auth.uid);
    }
  }
}
```

## storage.rules / 전체 교체

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 관리자 이메일을 직접 가입해 사칭하는 것을 방지한다.
    function admin() {
      return request.auth != null && request.auth.token.get('email_verified',false) == true &&
        request.auth.token.get('email','') in ['urildlduri@gmail.com','liferefix@naver.com'];
    }
    function owner(bizId) {
      return request.auth != null && request.auth.uid == bizId &&
        firestore.get(/databases/(default)/documents/biz/$(bizId)).data.ownerId == request.auth.uid &&
        firestore.get(/databases/(default)/documents/biz/$(bizId)).data.approved == true;
    }
    match /biz_photos/{bizId}/{filename} {
      allow read: if true;
      // 승인된 본인 매장만 업로드하며, 실행 가능한 SVG는 제외한다.
      allow create, update: if (admin() || owner(bizId)) &&
        request.resource.contentType.matches('image/(jpeg|png|gif|webp|avif|heic|heif)') &&
        request.resource.size > 0 && request.resource.size <= 5 * 1024 * 1024;
      allow delete: if admin() || owner(bizId);
    }
    match /{allPaths=**} { allow read, write: if false; }
  }
}
```

