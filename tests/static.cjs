const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),acorn=require('acorn');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
let count=0;
for(const file of ['index.html','user.html','merchant.html','admin.html','bc-core.js','functions/index.js']){
 const source=fs.readFileSync(path.join(root,file),'utf8');
 const scripts=file.endsWith('.html')?[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim()):[source];
 for(const script of scripts){
  const ast=acorn.parse(script,{ecmaVersion:'latest',sourceType:'script'});
  const names=new Set();
  for(const n of ast.body){
   let name=n.type==='FunctionDeclaration'?n.id.name:null;
   if(n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'){
    const l=n.expression.left,r=n.expression.right;
    if(l.type==='MemberExpression' && ['FunctionExpression','ArrowFunctionExpression'].includes(r.type))name=script.slice(l.start,l.end);
   }
   if(name){assert(!names.has(name),`${file}: duplicate ${name}`);names.add(name);}
  }
  count++;
 }
}
// Test escaping and protocol filtering from the real core, without running network init.
const source=fs.readFileSync(path.join(root,'bc-core.js'),'utf8');
const c={window:{location:{href:'https://example.test/bimilcall/admin.html'}},URL};
vm.createContext(c);vm.runInContext(source.slice(source.indexOf('const NW ='),source.indexOf('/* ── 카카오맵')),c);
assert.equal(c.window.NW.SITE_URL,'https://example.test/bimilcall/');
assert.equal(c.window.NW.safeURL('javascript:alert(1)'),'');
assert.equal(c.window.NW.safeURL('data:text/html,hi'),'');
assert.equal(c.window.NW.html('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
const attack=`');alert(1)//"<&`;
assert.equal(vm.runInNewContext(`'${c.window.NW.inline(attack)}'`),attack);
const preserved={"merchantLogin": "acfa683507f4e183f425f7db01850f559e62bb50abd580e0a6ea7049239bf196", "adminCreateMerchant": "970a2a26b6fccee7616a1172beb160ab54cadc97d0f8a7985752bdef40291032", "uploadBizPhoto": "c02ffcda950c51775709cabc58d44c8e65e9122778cf00d10fa5ecb56f65a800"};
for(const [fn,expected] of Object.entries(preserved)){
 const at=source.indexOf(`NW.${fn} =`),body=source.slice(at,source.indexOf('\n};',at)+3);
 assert.equal(require('node:crypto').createHash('sha256').update(body).digest('hex'),expected,`${fn} must stay unchanged`);
}
console.log(`PASS ${count} script parses, duplicate definitions, escaping, URL validation, 3 preserved APIs`);
