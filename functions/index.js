'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,Timestamp,FieldValue}=require('firebase-admin/firestore');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {randomBytes}=require('node:crypto');
initializeApp();
const db=getFirestore(), auth=getAuth();
const REGION='asia-northeast3';
const ADMINS=['urildlduri@gmail.com','liferefix@naver.com'];
const CATS=['karaoke_bar','karaoke','danran','yuheung','club','massage','spa'];
const ACTIVE=['searching','accepted','going','matched'];
const TERMINAL=['done','noshow','cancelled','expired'];
const ms=t=>t?.toMillis?.()||0;
const fail=(message)=>{throw new HttpsError('failed-precondition',message);};
const id=x=>typeof x==='string' && /^[A-Za-z0-9_-]{1,160}$/.test(x);
async function actor(req,admin=false){
  if(!req.auth)throw new HttpsError('unauthenticated','로그인이 필요합니다');
  const u=await auth.getUser(req.auth.uid);
  if(u.disabled || req.auth.token.iat*1000 < Date.parse(u.tokensValidAfterTime||0))
    throw new HttpsError('unauthenticated','다시 로그인해주세요');
  if(admin && (!u.emailVerified || !ADMINS.includes(u.email?.toLowerCase())))
    throw new HttpsError('permission-denied','관리자만 가능합니다');
  return u;
}
// 기존 UID·bizId를 유지한다. 비밀번호는 응답에만 포함하고 DB·로그에는 저장하지 않는다.
exports.adminResetMerchantPassword=onCall({region:REGION},async req=>{
  await actor(req,true);
  const bizId=req.data?.bizId;
  if(!id(bizId))throw new HttpsError('invalid-argument','매장 ID 오류');
  const b=(await db.doc(`biz/${bizId}`).get()).data();
  if(!b?.ownerId || !b.merchantId)fail('관리자가 생성한 매장 계정만 재발급 가능합니다');
  const owner=await auth.getUser(b.ownerId);
  if(owner.email!==`${b.merchantId.toLowerCase()}@bimilcall-biz.local`)fail('매장 소유자와 계정 정보가 다릅니다');
  const password=randomBytes(18).toString('base64url');
  await auth.updateUser(b.ownerId,{password});
  await auth.revokeRefreshTokens(b.ownerId);
  return {merchantId:b.merchantId,password,bizId};
});
// 프로필의 activeCallId는 서버만 설정한다. 다중 탭에서도 한 건만 생성한다.
exports.createCall=onCall({region:REGION},async req=>{
  const u=await actor(req), d=req.data||{};
  if(!u.email?.endsWith('@bimilcall.local'))fail('사용자 계정으로 로그인해주세요');
  if(!Number.isInteger(d.party)||d.party<1||d.party>6 || !Array.isArray(d.cats)||!d.cats.length||d.cats.length>7||d.cats.some(c=>!CATS.includes(c))||new Set(d.cats).size!==d.cats.length)
    throw new HttpsError('invalid-argument','인원·업종을 확인해주세요');
  if(!Number.isFinite(d.lat)||!Number.isFinite(d.lng)||Math.abs(d.lat)>90||Math.abs(d.lng)>180)
    throw new HttpsError('invalid-argument','좌표 오류');
  const ref=db.collection('calls').doc(), pr=db.doc(`users/${u.uid}`);
  const result=await db.runTransaction(async tx=>{
    const p=(await tx.get(pr)).data();
    if(!p||p.deleting || !Number.isInteger(Number(p.birthYear))||Number(p.birthYear)<1920||new Date().getUTCFullYear()-Number(p.birthYear)<19)fail('가입 시 출생연도를 확인해주세요');
    const owned=await tx.get(db.doc(`biz/${u.uid}`));
    if(owned.exists && owned.data().approved)fail('매장 계정은 사용자 호출을 만들 수 없습니다');
    const now=Date.now();
    let penalty=ms(p.penaltyUntil);
    let old=null, oldRef=null, target=null;
    if(p.activeCallId){oldRef=db.doc(`calls/${p.activeCallId}`);old=(await tx.get(oldRef)).data();}
    if(d.directBizId){
      if(!id(d.directBizId))fail('매장 ID 오류');
      target=(await tx.get(db.doc(`biz/${d.directBizId}`))).data();
      if(!target?.approved||target.status==='closed'||!d.cats.includes(target.cat))fail('현재 호출할 수 없는 매장입니다');
    }
    if(old && ['going','matched','noshow'].includes(old.status)){
      if(old.status==='noshow'||(ACTIVE.includes(old.status)&&ms(old.matchExpiresAt)<=now))
        penalty=Math.max(penalty,ms(old.matchExpiresAt)+30*60*1000);
    }
    if(old && ACTIVE.includes(old.status)){
      const end=ms(old.status==='searching'?old.expiresAt:old.status==='accepted'?old.goingDeadline:old.matchExpiresAt);
      if(end>now)fail('진행 중인 호출이 있습니다');
      tx.update(oldRef,{status:old.status==='searching'?'expired':old.status==='accepted'?'cancelled':'noshow'});
    }
    if(penalty>now){tx.update(pr,{penaltyUntil:Timestamp.fromMillis(penalty)});return {blocked:true};}
    const data={callerId:u.uid,callerName:String(p.nickname||'익명').slice(0,20),party:d.party,cats:d.cats,cat:d.cats[0],lat:d.lat,lng:d.lng,status:'searching',createdAt:Timestamp.fromMillis(now),expiresAt:Timestamp.fromMillis(now+(target?180:60)*1000)};
    if(target)Object.assign(data,{directBizId:d.directBizId,directBizName:target.name});
    tx.create(ref,data);tx.update(pr,{activeCallId:ref.id});
    return {id:ref.id,expiresAt:ms(data.expiresAt)};
  });
  if(result.blocked)fail('노쇼 패널티 적용 중입니다');
  return result;
});
async function expire(ref){
  await db.runTransaction(async tx=>{
    const c=(await tx.get(ref)).data();if(!c||!ACTIVE.includes(c.status))return;
    const end=ms(c.status==='searching'?c.expiresAt:c.status==='accepted'?c.goingDeadline:c.matchExpiresAt);
    if(end>Date.now())return;
    tx.update(ref,{status:c.status==='searching'?'expired':c.status==='accepted'?'cancelled':'noshow'});
  });
}
exports.expireCall=onCall({region:REGION},async req=>{
  const u=await actor(req), callId=req.data?.callId;
  if(!id(callId))throw new HttpsError('invalid-argument','호출 ID 오류');
  const ref=db.doc(`calls/${callId}`), c=(await ref.get()).data();
  if(!c||!(c.callerId===u.uid||c.matchedBizId===u.uid||ADMINS.includes(u.email)))
    throw new HttpsError('permission-denied','본인 호출만 처리 가능합니다');
  await expire(ref);return {ok:true};
});
// 브라우저가 닫혀 있어도 만료 처리. 한 번에 400건씩 각 상태의 만료 순서로 처리.
exports.expireCalls=onSchedule({region:REGION,schedule:'every 1 minutes',timeZone:'Asia/Seoul'},async()=>{
  for(const status of ACTIVE){
    const field=status==='searching'?'expiresAt':status==='accepted'?'goingDeadline':'matchExpiresAt';
    const snap=await db.collection('calls').where('status','==',status).where(field,'<=',Timestamp.now()).orderBy(field).limit(400).get();
    for(const d of snap.docs)await expire(d.ref);
  }
});
// 중복 이벤트에도 한 번만 포인트를 지급. 클라이언트는 points/penalty를 수정할 수 없다.
exports.settleCall=onDocumentWritten({region:REGION,document:'calls/{callId}',retry:true},async event=>{
  const ref=event.data.after.ref;
  if(!event.data.after.exists)return;
  const callId=event.params.callId;
  await db.runTransaction(async tx=>{
    const c=(await tx.get(ref)).data();if(!c)return;
    const pr=db.doc(`users/${c.callerId}`), ps=await tx.get(pr);
    if(!ps.exists || ps.data().deleting)return;
    const rewards=[];
    if(c.goingAt)rewards.push(['matched',20,'호출 성사']);
    if(c.status==='done')rewards.push(['done',100,'도착 완료']);
    if(c.status==='noshow')rewards.push(['noshow',-200,'노쇼']);
    const ledgers=await Promise.all(rewards.map(([s])=>tx.get(pr.collection('points').doc(`${callId}_${s}`))));
    let delta=0;
    rewards.forEach(([s,amount,reason],i)=>{
      if(!ledgers[i].exists){tx.create(ledgers[i].ref,{delta:amount,reason,callId,at:Timestamp.now()});delta+=amount;}
    });
    const patch={};
    if(delta)patch.points=FieldValue.increment(delta);
    if(c.status==='noshow')patch.penaltyUntil=Timestamp.fromMillis(Math.max(ms(ps.data().penaltyUntil),ms(c.matchExpiresAt)+1800000));
    if(Object.keys(patch).length)tx.update(pr,patch);
    if(TERMINAL.includes(c.status)){
      tx.set(pr.collection('history').doc(callId),{bizId:c.matchedBizId||'',bizName:c.matchedBizName||'-',cat:c.cat,party:c.party,status:c.status,at:c.arrivedAt||c.createdAt});
      if(!c.locationCoarsened)tx.update(ref,{lat:+c.lat.toFixed(3),lng:+c.lng.toFixed(3),locationCoarsened:true});
    }
  });
});
// 집계는 실제 문서 기준으로 재계산. 이벤트 중복/순서 역전에도 맞는 값으로 수렴.
async function countCommunity(postId){
  const pr=db.doc(`community/${postId}`);
  await db.runTransaction(async tx=>{
    const p=await tx.get(pr);if(!p.exists)return;
    const comments=await tx.get(pr.collection('comments'));
    const likes=await tx.get(pr.collection('likes'));
    tx.update(pr,{commentCount:comments.size,likes:likes.size});
  });
}
exports.countComments=onDocumentWritten({region:REGION,document:'community/{postId}/comments/{id}',retry:true},e=>countCommunity(e.params.postId));
exports.countLikes=onDocumentWritten({region:REGION,document:'community/{postId}/likes/{uid}',retry:true},e=>countCommunity(e.params.postId));
exports.settleReview=onDocumentWritten({region:REGION,document:'reviews/{reviewId}',retry:true},async event=>{
  const r=event.data.after.exists?event.data.after.data():event.data.before.data();
  if(!r)return;
  await db.runTransaction(async tx=>{
    const br=db.doc(`biz/${r.bizId}`), bs=await tx.get(br);
    const reviews=await tx.get(db.collection('reviews').where('bizId','==',r.bizId));
    const pr=db.doc(`users/${r.uid}`), p=await tx.get(pr);
    const reward=pr.collection('points').doc(`review_${r.bizId}`), prev=await tx.get(reward);
    if(bs.exists)tx.update(br,{ratingAvg:reviews.size?Math.round(reviews.docs.reduce((n,d)=>n+d.data().rating,0)/reviews.size*100)/100:0,ratingCount:reviews.size});
    if(event.data.after.exists && p.exists && !p.data().deleting && !prev.exists){
      tx.create(reward,{delta:50,reason:'리뷰 작성',at:Timestamp.now()});tx.update(pr,{points:FieldValue.increment(50)});
    }
  });
});
// Firestore의 부모 삭제는 하위 문서를 지우지 않는다.
exports.cleanCallChildren=onDocumentWritten({region:REGION,document:'calls/{id}',retry:true},async e=>{
  if(!e.data.after.exists && e.data.before.exists)await db.recursiveDelete(e.data.before.ref.collection('responses'));
});
exports.cleanPostChildren=onDocumentWritten({region:REGION,document:'community/{id}',retry:true},async e=>{
  if(!e.data.after.exists && e.data.before.exists){
    await db.recursiveDelete(e.data.before.ref.collection('comments'));
    await db.recursiveDelete(e.data.before.ref.collection('likes'));
  }
});
exports.deleteMyAccount=onCall({region:REGION,timeoutSeconds:540},async req=>{
  const u=await actor(req);
  if(!u.email?.endsWith('@bimilcall.local'))fail('사용자 계정에서만 탈퇴할 수 있습니다');
  if(Date.now()/1000-req.auth.token.auth_time>300)fail('로그아웃 후 다시 로그인하고 5분 안에 탈퇴해주세요');
  if(!(await db.collection('biz').where('ownerId','==',u.uid).get()).empty)fail('매장 해지 처리를 운영자에게 먼저 요청해주세요');
  await db.doc(`users/${u.uid}`).set({deleting:true},{merge:true});
  try{
  for(const col of ['calls','reviews','community']){
    const field=col==='calls'?'callerId':'uid';
    const snap=await db.collection(col).where(field,'==',u.uid).get();
    for(const d of snap.docs)await db.recursiveDelete(d.ref);
  }
  const comments=await db.collectionGroup('comments').where('uid','==',u.uid).get();
  for(const d of comments.docs)await d.ref.delete();
  const likes=await db.collectionGroup('likes').where('uid','==',u.uid).get();
  for(const d of likes.docs)await d.ref.delete();
  await db.recursiveDelete(db.doc(`users/${u.uid}`));
  await auth.deleteUser(u.uid);
  return {ok:true};
  }catch(e){
    // 실패를 완료로 표시하지 않는다. 남은 데이터 삭제를 재시도할 수 있게 한다.
    await db.doc(`users/${u.uid}`).set({deleting:false},{merge:true});
    throw new HttpsError('internal','일부 삭제가 완료되지 않았습니다. 다시 시도하거나 운영자에게 문의해주세요');
  }
});
