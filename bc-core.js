/* ============================================================
   BIMILCALL 공통 코어  ·  bc-core.js
   ① Firebase 설정은 여기 한 곳에서만 관리합니다.
   ============================================================ */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBTcQKjBTXIl6UuNIndOuTI-nsBH5Wz0J4",
  authDomain:        "nowait-84116.firebaseapp.com",
  projectId:         "nowait-84116",
  storageBucket:     "nowait-84116.firebasestorage.app",
  messagingSenderId: "121578768600",
  appId:             "1:121578768600:web:3c57e58e21945dca956fad"
};
/* ============================================================ */

const NW = {};
window.NW = NW;

/* ── 카카오맵 (JavaScript 키 · 무료) ── */
NW.KAKAO_KEY = "56d96a0427d001e4d5fd597bd5e458e0";
NW.loadKakao = ()=> new Promise((res,rej)=>{
  if(window.kakao && window.kakao.maps){res(window.kakao);return;}
  const s=document.createElement('script');
  s.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${NW.KAKAO_KEY}&autoload=false&libraries=services`;
  s.onload=()=>window.kakao.maps.load(()=>res(window.kakao));
  s.onerror=()=>rej(new Error('kakao sdk load fail'));
  document.head.appendChild(s);
});
/* 카카오맵 길찾기 링크 (앱/웹에서 열림) */
NW.kakaoRoute = (name,lat,lng)=>`https://map.kakao.com/link/to/${encodeURIComponent(name||'매장')},${lat},${lng}`;

/* 다음 우편번호 스크립트 로더 (무료, 키 불필요) */
NW.loadPostcode = ()=> new Promise((res,rej)=>{
  if(window.daum && window.daum.Postcode){res();return;}
  const s=document.createElement('script');
  s.src='https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
  s.onload=()=>res(); s.onerror=()=>rej(new Error('postcode load fail'));
  document.head.appendChild(s);
});

/* 주소 검색 → 좌표 변환. onResult({address, lat, lng}) 콜백.
   1) 다음 우편번호 팝업으로 주소 선택
   2) 카카오 Geocoder(무료 JS SDK)로 주소→좌표 변환 */
NW.searchAddress = async function(onResult){
  try{
    await NW.loadPostcode();
    const kakao=await NW.loadKakao();
    // geocoder는 services 라이브러리 필요 — loadKakao가 libraries 포함해야 함
    if(!kakao.maps.services){ NW.toast('주소 변환 모듈 로드 실패'); return; }
    new window.daum.Postcode({
      oncomplete:function(data){
        const addr=data.roadAddress||data.jibunAddress||data.address;
        const geocoder=new kakao.maps.services.Geocoder();
        geocoder.addressSearch(addr,(result,status)=>{
          if(status===kakao.maps.services.Status.OK && result[0]){
            onResult({address:addr, lat:parseFloat(result[0].y), lng:parseFloat(result[0].x)});
          }else{
            NW.toast('주소를 좌표로 변환하지 못했어요. 지도에서 선택해 주세요.');
            onResult({address:addr, lat:null, lng:null});
          }
        });
      }
    }).open();
  }catch(e){ console.error('searchAddress',e); NW.toast('주소 검색을 열 수 없어요'); }
};

/* 업종별 데모 메뉴 샘플 */
NW.DEMO_MENU = {
  pub:[{name:'생맥주 500cc',price:5000},{name:'모둠 안주',price:23000},{name:'하이볼',price:7000}],
  karaoke:[{name:'1시간 (룸)',price:18000},{name:'음료 세트',price:6000},{name:'서비스 30분',price:0}],
  escape:[{name:'테마 입장 (2인)',price:44000},{name:'테마 입장 (4인)',price:80000}],
  golf:[{name:'1시간 이용',price:30000},{name:'프리미엄 룸',price:45000}],
  party:[{name:'2시간 대관',price:60000},{name:'파티 패키지',price:120000}],
  stay:[{name:'대실 3시간',price:30000},{name:'숙박 (1박)',price:60000}],
  massage:[{name:'전신 60분',price:50000},{name:'발 마사지 40분',price:30000}],
  board:[{name:'음료+보드게임 2시간',price:12000},{name:'룸 대여 (4인)',price:30000}],
  pcroom:[{name:'1시간',price:1500},{name:'심야 패키지',price:8000}]
};
NW.DEMO_HOURS = '매일 17:00 – 02:00';

/* ── 상수 ── */
// 카테고리 추가/수정은 이 배열만 손보면 됨 (k=내부키, e=이모지, n=표시명)
NW.CATS = [
  {k:'karaoke_bar', e:'🎙️', n:'노래주점'},
  {k:'karaoke',     e:'🎤', n:'노래연습장'},
  {k:'danran',      e:'🍶', n:'단란주점'},
  {k:'yuheung',     e:'🎭', n:'유흥주점'},
  {k:'club',        e:'💃', n:'클럽'},
  {k:'massage',     e:'💆', n:'마사지샵'},
  {k:'spa',         e:'♨️', n:'스파'},
];
NW.catOf  = k => NW.CATS.find(c=>c.k===k) || {e:'📍',n:k};
NW.PARTY  = [1,2,3,4,5,6];
NW.RADII  = [500,1000,2000];
NW.CALL_TTL  = 60;        // 호출 응답 대기(초)
NW.MATCH_TTL = 15*60;     // 입장 마감(초) — 자리 점유 최소화
NW.PENALTY   = 30*60;     // 노쇼 패널티(초)
NW.FALLBACK  = {lat:37.4979, lng:127.0276, name:'강남역'}; // 지도 picker 초기 중심으로만 사용

/* GPS 위치 획득 — 성공 시 {lat,lng}, 실패 시 reject(에러). 기본값으로 조용히 넘어가지 않음 */
NW.getGPS = ()=> new Promise((res,rej)=>{
  if(!navigator.geolocation){ rej(new Error('no-geo')); return; }
  navigator.geolocation.getCurrentPosition(
    p=>res({lat:p.coords.latitude, lng:p.coords.longitude, name:'현재 위치'}),
    e=>rej(e),
    {enableHighAccuracy:true, timeout:9000, maximumAge:0});
});

/* 지도 위치 선택 picker — boxId 컨테이너에 카카오맵을 띄우고, 탭/드래그로 좌표 선택.
   onPick(lat,lng) 콜백 호출. 초기중심 center({lat,lng}) 선택적. */
NW.locationPicker = async function(boxId, center, onPick){
  const box=NW.$(boxId); if(!box) return;
  const c = center || NW.FALLBACK;
  try{
    const kakao=await NW.loadKakao();
    box.innerHTML='';
    const ll=new kakao.maps.LatLng(c.lat,c.lng);
    const map=new kakao.maps.Map(box,{center:ll,level:4});
    const marker=new kakao.maps.Marker({map,position:ll,draggable:true});
    const upd=p=>{ marker.setPosition(p); onPick(p.getLat(),p.getLng()); };
    kakao.maps.event.addListener(map,'click',e=>upd(e.latLng));
    kakao.maps.event.addListener(marker,'dragend',()=>onPick(marker.getPosition().getLat(),marker.getPosition().getLng()));
    return {map,marker};
  }catch(e){
    box.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--tx3);font-size:12px;text-align:center;padding:10px">지도 로드 실패 — 좌표 직접 입력으로 진행하세요</div>';
  }
};

/* ── 유틸 ── */
NW.$ = id => document.getElementById(id);
NW.toast = m=>{const t=NW.$('toast');if(!t)return;t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2200);};
NW.fmtT = s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
NW.haversine = (a,b)=>{const R=6371e3,r=x=>x*Math.PI/180;
  const dla=r(b.lat-a.lat),dlo=r(b.lng-a.lng);
  const x=Math.sin(dla/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dlo/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)));};
NW.distLabel = m=>m>=1000?(m/1000).toFixed(1)+'km':m+'m';
NW.nowMs = ()=>Date.now();
NW.tsMs  = t=>t&&t.toMillis?t.toMillis():(t||0);

/* ── Firebase 동적 로드 (file://·오프라인이어도 페이지는 살아있음) ── */
NW.cfgOk = !FIREBASE_CONFIG.apiKey.startsWith("YOUR_");
NW.fbLoaded = false;
NW.uid = null;
NW.fb = {};   // firestore/auth 함수 모음
const FB_BASE = "https://www.gstatic.com/firebasejs/10.12.0/";

NW.fbReady = (async()=>{
  try{
    const A  = await import(FB_BASE+"firebase-app.js");
    const Au = await import(FB_BASE+"firebase-auth.js");
    const F  = await import(FB_BASE+"firebase-firestore.js");
    Object.assign(NW.fb, {
      getAuth:Au.getAuth, signInAnonymously:Au.signInAnonymously, onAuthStateChanged:Au.onAuthStateChanged,
      GoogleAuthProvider:Au.GoogleAuthProvider, signInWithPopup:Au.signInWithPopup, signOut:Au.signOut,
      signInWithRedirect:Au.signInWithRedirect, getRedirectResult:Au.getRedirectResult,
      collection:F.collection, collectionGroup:F.collectionGroup, doc:F.doc, addDoc:F.addDoc, setDoc:F.setDoc, updateDoc:F.updateDoc,
      getDoc:F.getDoc, getDocs:F.getDocs, query:F.query, where:F.where, onSnapshot:F.onSnapshot,
      serverTimestamp:F.serverTimestamp, deleteDoc:F.deleteDoc, orderBy:F.orderBy, limit:F.limit, Timestamp:F.Timestamp, increment:F.increment
    });
    if(NW.cfgOk){
      NW.app  = A.initializeApp(FIREBASE_CONFIG);
      NW.auth = Au.getAuth(NW.app);
      NW.db   = F.getFirestore(NW.app);
    }
    NW.fbLoaded = true;
  }catch(e){
    console.error('[NOWAIT] Firebase 로드 실패:',e);
    const w=NW.$('cfgWarn');
    if(w){w.classList.remove('hide');
      w.textContent='⚠️ Firebase 로드 실패 — file://이 아닌 http(s)로 열어야 합니다. 콘솔(F12) 로그 참고.';}
  }
})();

if(!NW.cfgOk){const w=NW.$('cfgWarn');if(w)w.classList.remove('hide');}

/* ── 관리자 이메일 화이트리스트 ── */
NW.ADMIN_EMAILS = ["urildlduri@gmail.com"];

/* ── 익명 인증 (사용 안 함 — 구글 로그인으로 대체) ── */
NW.ensureAuth = async function(){
  if(!NW.cfgOk) return null;
  await NW.fbReady;
  if(!NW.fbLoaded) return null;
  if(NW.uid) return NW.uid;
  return new Promise(res=>{
    NW.fb.onAuthStateChanged(NW.auth,u=>{
      if(u){NW.uid=u.uid;NW.user=u;res(u.uid);} else res(null);
    });
  });
};

/* ── 구글 로그인 (리다이렉트 방식 — GitHub Pages COOP 회피) ── */
NW.googleLogin = async function(){
  await NW.fbReady;
  if(!NW.fbLoaded) throw new Error('firebase not loaded');
  const {GoogleAuthProvider,signInWithRedirect,signInWithPopup}=NW.fb;
  const provider=new GoogleAuthProvider();
  // 팝업 먼저 시도, COOP 등으로 막히면 리다이렉트로 폴백
  try{
    const res=await signInWithPopup(NW.auth,provider);
    NW.uid=res.user.uid; NW.user=res.user;
    await NW.ensureProfile(res.user);
    return res.user;
  }catch(e){
    if(e.code==='auth/popup-blocked' || e.code==='auth/cancelled-popup-request'
       || e.code==='auth/popup-closed-by-user' || String(e.message||'').includes('Cross-Origin')){
      await signInWithRedirect(NW.auth,provider); // 페이지 이동 → 돌아오면 onAuth가 처리
      return null;
    }
    throw e;
  }
};
NW.logout = async function(){
  await NW.fbReady; if(NW.fb.signOut) await NW.fb.signOut(NW.auth);
  location.href='index.html';
};

/* 공통 계정 메뉴 위젯 — 컨테이너 id를 받아 프로필칩+드롭다운 렌더 */
NW.mountAccount = function(containerId){
  const el=NW.$(containerId); if(!el||!NW.user)return;
  const u=NW.user;
  const initial=(u.displayName||u.email||'U').trim().charAt(0).toUpperCase();
  const avatar=u.photoURL
    ? `<img src="${u.photoURL}" style="width:30px;height:30px;border-radius:50%">`
    : `<div style="width:30px;height:30px;border-radius:50%;background:var(--y);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${initial}</div>`;
  el.style.position='relative';
  el.innerHTML=`
    <button id="nwAcctBtn" style="background:var(--bg2);border:1px solid var(--bd);border-radius:30px;padding:4px 10px 4px 4px;display:flex;align-items:center;gap:8px">
      ${avatar}<span style="font-size:13px;font-weight:700;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.displayName||u.email}</span>
      <span style="color:var(--tx3);font-size:10px">▼</span>
    </button>
    <div id="nwAcctMenu" class="hide" style="position:absolute;right:0;top:46px;background:var(--bg2);border:1px solid var(--bd);border-radius:12px;padding:8px;min-width:200px;z-index:120;box-shadow:0 8px 24px rgba(0,0,0,.4)">
      <div style="padding:10px 12px;border-bottom:1px solid var(--bd);margin-bottom:6px">
        <div style="font-size:13px;font-weight:700">${u.displayName||''}</div>
        <div style="font-size:12px;color:var(--tx3);font-family:var(--mono);margin-top:2px">${u.email||''}</div>
      </div>
      <button onclick="NW.logout()" style="width:100%;text-align:left;background:none;padding:10px 12px;border-radius:8px;font-size:14px;font-weight:600;color:var(--no)">로그아웃</button>
    </div>`;
  const btn=NW.$('nwAcctBtn'), menu=NW.$('nwAcctMenu');
  btn.onclick=e=>{e.stopPropagation();menu.classList.toggle('hide');};
  document.addEventListener('click',()=>menu.classList.add('hide'));
};

/* 로그인 상태 구독 (페이지 가드용). cb(user|null) */
NW.onAuth = function(cb){
  NW.fbReady.then(async()=>{
    if(!NW.fbLoaded){cb(null);return;}
    // 리다이렉트 로그인에서 돌아온 경우 결과 수거
    try{ if(NW.fb.getRedirectResult) await NW.fb.getRedirectResult(NW.auth); }catch(e){ console.warn('redirect result',e); }
    NW.fb.onAuthStateChanged(NW.auth, async u=>{
      if(u){NW.uid=u.uid;NW.user=u;await NW.ensureProfile(u);}
      cb(u);
    });
  });
};

/* 프로필 문서 생성/조회 (bc_users/{uid}) */
NW.ensureProfile = async function(u){
  const {doc,getDoc,setDoc,serverTimestamp}=NW.fb;
  const ref=doc(NW.db,'bc_users',u.uid);
  const s=await getDoc(ref);
  if(!s.exists()){
    await setDoc(ref,{name:u.displayName||'',email:u.email||'',photo:u.photoURL||'',
      role:'user', createdAt:serverTimestamp()});
    NW.profile={name:u.displayName||'',email:u.email||'',role:'user'};
  }else NW.profile=s.data();
  return NW.profile;
};
NW.isAdmin = u => !!(u && u.email && NW.ADMIN_EMAILS.includes(u.email));

/* 계정의 단일 역할 판별: 'admin' | 'merchant' | 'user'
   - 관리자 이메일 → admin
   - 승인된 매장 보유 → merchant
   - 그 외 → user (승인대기 신청이 있어도 아직은 user) */
NW.getRole = async function(u){
  if(NW.isAdmin(u)) return 'admin';
  const biz=await NW.myBusiness();
  if(biz && biz.approved) return 'merchant';
  return 'user';
};

/* 내 역할 판별: 'admin' | 'merchant' | 'user' */
NW.resolveRole = async function(u){
  if(NW.isAdmin(u)) return 'admin';
  const biz=await NW.myBusiness();
  if(biz && biz.approved) return 'merchant';
  return 'user';
};
/* 페이지 가드: 로그인 필수 + 역할 일치 아니면 제자리로 리다이렉트.
   want='user'|'merchant'|'admin'. onOk(user,role) 호출. */
NW.guardPage = function(want, onOk){
  NW.onAuth(async u=>{
    if(!u){ location.replace('index.html'); return; }
    const role=await NW.resolveRole(u);
    if(role!==want){
      const dest = role==='admin'?'admin.html' : role==='merchant'?'merchant.html' : 'user.html';
      location.replace(dest); return;
    }
    onOk(u, role);
  });
};

/* 내 매장 조회: ownerId 본인이거나 memberEmails에 본인 이메일 포함된 매장.
   여러 개면 승인된 것 우선. */
NW.myBusiness = async function(){
  if(!NW.uid) return null;
  const {collection,query,where,getDocs}=NW.fb;
  const [byOwner, byMember] = await Promise.all([
    getDocs(query(collection(NW.db,'bc_biz'),where('ownerId','==',NW.uid))).catch(()=>({docs:[]})),
    NW.user?.email
      ? getDocs(query(collection(NW.db,'bc_biz'),where('memberEmails','array-contains',NW.user.email))).catch(()=>({docs:[]}))
      : Promise.resolve({docs:[]})
  ]);
  const map=new Map();
  byOwner.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data(),_role:'owner'}));
  byMember.docs.forEach(d=>{ if(!map.has(d.id)) map.set(d.id,{id:d.id,...d.data(),_role:'member'}); });
  const list=[...map.values()];
  if(!list.length) return null;
  return list.find(b=>b.approved)||list[0];
};

