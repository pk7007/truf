const assert = require('node:assert/strict');
const test = require('node:test');
const D = require('./domain.js');
test('standalone prototype embeds the exact tested domain module and valid JavaScript',()=>{const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert.ok(html.includes(fs.readFileSync(path.join(__dirname,'domain.js'),'utf8')));assert.doesNotThrow(()=>new Function(html.split('<script>')[1].split('</script>')[0]));});
const now = new Date('2030-01-01T10:00:00+05:30').getTime();
function data() { return { matches: [], payments: [], slots: [{id:1,venue:'Arena',sport:'Football',date:'2030-01-02',time:'18:30',price:1200,blocked:false}] }; }
function match(s) { const m = D.create({id:10,title:'Team game',sport:'Football',slot:1,total:12},s,now);s.matches.push(m);return m; }
test('rejects blank title, odd teams and incompatible sport',()=>{for(const patch of [{title:'  '},{total:11},{sport:'Badminton',total:4}])assert.throws(()=>D.create({id:10,title:'Game',sport:'Football',slot:1,total:12,...patch},data(),now));});
test('reserved slots cannot be reused',()=>{const s=data();match(s);assert.equal(D.available(s.slots[0],s,now),false);assert.throws(()=>match(s));});
test('joining is idempotent and refuses overcapacity',()=>{const s=data(),m=match(s);m.joined=11;D.join(s,10,now);assert.equal(m.joined,12);assert.throws(()=>D.join(s,10,now));assert.equal(m.joined,12);});
test('withdraw refunds once and preserves history',()=>{const s=data(),m=match(s);D.join(s,10,now);s.payments.push({match:10,status:'Paid'});D.withdraw(s,10,now);assert.equal(m.joined,0);assert.equal(m.wasMine,true);assert.equal(s.payments[0].status,'Refunded');assert.throws(()=>D.withdraw(s,10,now));});
test('cancellation clears attendance and releases slot',()=>{const s=data(),m=match(s);D.join(s,10,now);D.cancel(s,10);assert.equal(m.mine,false);assert.equal(m.joined,0);assert.equal(D.available(s.slots[0],s,now),true);});
test('deadline expires unpaid roster and refunds paid places',()=>{const s=data(),m=match(s);D.join(s,10,now);s.payments.push({match:10,status:'Paid'});D.expire(s,D.deadline(m));assert.equal(m.status,'expired');assert.equal(s.payments[0].status,'Refunded');assert.throws(()=>D.join(s,10,D.deadline(m)));});
test('complete roster survives deadline and completes after match',()=>{const s=data(),m=match(s);m.joined=12;D.expire(s,D.deadline(m));assert.equal(m.status,'open');D.expire(s,D.starts(m)+3600000);assert.equal(m.status,'completed');});
test('overlapping slots rejected but adjoining slot allowed',()=>{const s=data();assert.throws(()=>D.validateSlot({...s.slots[0],venue:'  ARENA ',time:'19:00'},s,now));assert.equal(D.validateSlot({...s.slots[0],time:'19:30'},s,now).time,'19:30');});
test('joining conflicting games is rejected',()=>{const s=data(),m=match(s);D.join(s,10,now);s.matches.push({...m,id:11,mine:false,time:'19:00'});assert.throws(()=>D.join(s,11,now));});
test('formatting preserves minutes and midnight rollover',()=>{assert.equal(D.endTime('18:30'),'19:30');assert.equal(D.endTime('23:30'),'00:30');});
test('invalid storage, price, calendar date and old slot fail validation',()=>{assert.throws(()=>D.normalize({}));for(const patch of [{price:-1},{date:'2030-02-30'},{date:'2020-01-01'}])assert.throws(()=>D.validateSlot({...data().slots[0],...patch},data(),now));});
