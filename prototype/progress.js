(function(root){
  const day=ms=>new Date(ms+19800000).toISOString().slice(0,10);
  const monday=date=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.getTime()};
  function records(rows){return [...new Map((rows||[]).filter(r=>r&&typeof r.match==='number'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&['Football','Cricket','Badminton'].includes(r.sport)).map(r=>[r.match,r])).values()]}
  function progress(rows, sport='All sports', now=Date.now()){
    const today=day(now), current=monday(today), week=604800000;
    const played=records(rows).filter(r=>r.date<=today&&(sport==='All sports'||r.sport===sport));
    const weeks=[...new Set(played.map(r=>monday(r.date)))].sort((a,b)=>a-b);
    let best=0,run=0,previous=-Infinity;for(const w of weeks){run=w===previous+week?run+1:1;best=Math.max(best,run);previous=w}
    let active=weeks.includes(current)?current:current-week,streak=0;while(weeks.includes(active)){streak++;active-=week}
    return {played,streak,best,hours:played.length,points:played.length*100,weeks:[0,1,2,3,4,5,6,7].map(i=>({date:new Date(current-(7-i)*week).toISOString().slice(0,10),played:weeks.includes(current-(7-i)*week)}))};
  }
  function metrics(state,venue='All venues',period='all',now=Date.now()){
    const today=day(now);const start=day(now-29*86400000),end=day(now+6*86400000);
    const matches=state.matches.filter(m=>(venue==='All venues'||m.venue===venue)&&(period==='all'||period==='past30'&&m.date>=start&&m.date<=today||period==='next7'&&m.date>=today&&m.date<=end));
    const ids=new Set(matches.map(m=>m.id));const payments=state.payments.filter(p=>ids.has(p.match));
    const gross=payments.reduce((n,p)=>n+Math.round(p.amount*100),0),refunds=payments.filter(p=>p.status==='Refunded').reduce((n,p)=>n+Math.round(p.amount*100),0);
    return {matches,total:matches.length,confirmed:matches.filter(m=>m.status==='completed'||m.status==='open'&&m.joined===m.total).length,cancelled:matches.filter(m=>['cancelled','expired'].includes(m.status)).length,pending:matches.filter(m=>m.status==='open'&&m.joined<m.total).length,gross:gross/100,refunds:refunds/100,net:(gross-refunds)/100};
  }
  const api={day,monday,records,progress,metrics};if(typeof module!=='undefined')module.exports=api;else root.TrufProgress=api;
})(typeof window!=='undefined'?window:globalThis);
