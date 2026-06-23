
let cells=[], selectedId=null, nextId=1;
let running=false, paused=false, simDay=0, timer=null, orders=0, dots=[], lastRootProduced=0, stopReason="";
let fulfilledOrders=0; // commandes client livrées par le produit fini
const $=id=>document.getElementById(id); const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a; const byId=id=>cells.find(c=>c.id===id);
const colors=['#3b82f6','#f59e0b','#8b5cf6','#22c55e','#06b6d4'];
function maxLevel(){ return cells.length?Math.max(...cells.map(c=>c.level)):0; }
function isLowestRank(c){ return c && c.level===maxLevel(); }
function isInfiniteOut(c){ return isLowestRank(c); }
function log(msg,type=''){ const e=$('events'); const t=`<div class="${type}">J${simDay} · ${msg}</div>`; e.innerHTML=t+e.innerHTML; }
function generateBOM(){ stopSim(false); cells=[]; nextId=1; selectedId=null; simDay=0; orders=0; fulfilledOrders=0; dots=[];
  const depth=+$('depth').value, width=+$('width').value, customRate=+$('customRate').value;
  function make(level,parent=null,index=1,path='PF'){
    const custom=level>0 && Math.random()*100<customRate; const id=nextId++;
    const c={id,name:level===0?'Produit fini':`${level===1?'Sous-ensemble':'Pièce'} ${path}.${index}`, level,parent,children:[], custom,
      mode:level===0||custom?'MTO':'MTS', stockIn:level>0, stockOut:!custom && level>0, stockInQty:rnd(8,35), stockOutQty:rnd(6,32), targetStock:rnd(10,45), reorderPoint:rnd(4,18),
      prodTime:rnd(1,4), setupTime:rnd(0,2), capacity:rnd(8,28), qtyPerParent:level===0?1:rnd(1,3), maxStock:rnd(35,90),
      x:0,y:0, produced:0, consumed:0, wip:0, blocked:0, incomingNeed:0, status:'good', issue:''};
    cells.push(c);
    if(level<depth){ const n=Math.max(1,Math.round(width+rnd(-1,1))); for(let i=1;i<=n;i++){ const ch=make(level+1,id,i,path+'.'+index); c.children.push(ch.id); }}
    return c;
  }
  make(0,null,1,'PF');
  cells.forEach(c=>{ if(isLowestRank(c)){ c.stockOut=true; c.stockOutQty=Infinity; c.maxStock=Infinity; c.issue=''; }});
  layoutCells(); renderAll(); log('Nouvelle nomenclature générée. Les cellules du rang le plus bas ont un stock aval infini.');
}
function layoutCells(){ const max=Math.max(...cells.map(c=>c.level)); const canvas=$('flowCanvas'); canvas.style.minHeight=Math.max(760,(max+1)*170+90)+'px';
  for(let l=0;l<=max;l++){ const row=cells.filter(c=>c.level===l); const gap=1020/Math.max(1,row.length); row.forEach((c,i)=>{ c.x=220+i*gap; c.y=55+l*165; }); }
}
function renderAll(){ renderFlow(); renderTree(); renderEditor(); updateKpis(); }
function renderFlow(){ const canvas=$('flowCanvas'); [...canvas.querySelectorAll('.node,.stockbox,.layer-title')].forEach(n=>n.remove()); $('svg').innerHTML='';
  const showInfo=false; const max=Math.max(...cells.map(c=>c.level));
  for(let l=0;l<=max;l++){ const lt=document.createElement('div'); lt.className='layer-title'; lt.style.top=(72+l*165)+'px'; lt.textContent=l===0?'Produit fini':l===1?'Sous-ensembles':'Niveau '+l; canvas.appendChild(lt); }
  // links
  cells.forEach(c=>{ c.children.forEach(chId=>{ const ch=byId(chId); const active=(c.wip>0||ch.wip>0||c.incomingNeed>0||ch.incomingNeed>0); const bad=(c.status==='blocked'||c.status==='saturated'||ch.status==='blocked'||ch.status==='saturated'); const col=bad?'#ef4444':(active?'#22c55e':'#64748b'); drawLine(ch.x+85,ch.y+10,c.x+85,c.y+116,col,false,active,bad); if(showInfo) drawLine(c.x+85,c.y+116,ch.x+85,ch.y+10,'#f59e0b',true,false,false); }); });
  // customer order line
  const root=cells.find(c=>c.level===0); drawLine(root.x+170,root.y+58,1115,root.y+58,(root.wip>0||root.incomingNeed>0)?'#22c55e':'#64748b',false,(root.wip>0||root.incomingNeed>0),root.status==='blocked'||root.status==='saturated');
  const cmd=document.createElement('div'); cmd.className='node'; cmd.style.left='1000px'; cmd.style.top=(root.y+24)+'px'; cmd.innerHTML='<div class="name">Commande client</div><div class="type">Demande produit fini</div><div class="metrics">Flux violet = commandes<br>Déclenchement MTO aval</div>'; canvas.appendChild(cmd);
  cells.forEach(c=>{
    if(selectedId===c.id){ addStock(c,'in'); addStock(c,'out'); }
    const n=document.createElement('div'); n.className=`node ${selectedId===c.id?'selected':''} ${c.status==='blocked'?'blocked':c.status}`; n.style.left=c.x+'px'; n.style.top=c.y+'px'; n.onclick=()=>{selectedId=c.id;renderAll();};
    const isActive=c.wip>0||c.incomingNeed>0; const flowText=c.status==='blocked'?('Rupture'+(c.issue?' · '+c.issue:'')):c.status==='saturated'?('Saturation'+(c.issue?' · '+c.issue:'')):(isActive?'Flux actif':'En attente'); const flowCls=(c.status==='blocked'||c.status==='saturated')?'blocked':(isActive?'active':'wait');
    n.innerHTML=`<span class="tag ${c.mode.toLowerCase()}">${c.mode}</span><div class="name">${c.name}</div><div class="type">${c.custom?'Personnalisable':'Standard'} · qté/parent ${c.qtyPerParent}</div><div class="flow-state ${flowCls}">${flowText}</div><div class="metrics">Cap ${c.capacity}/j · LT ${c.prodTime+c.setupTime}j<br>WIP ${Math.round(c.wip)} · Ruptures ${Math.round(c.blocked)}</div>`;
    canvas.appendChild(n);
  });
}
function addStock(c,side){ if(c.level===0 && side==='in') return; const active=side==='in'?c.stockIn:c.stockOut; const infinite=side==='out'&&isInfiniteOut(c); const qty=side==='in'?c.stockInQty:c.stockOutQty; const box=document.createElement('div'); box.className='stockbox '+(!active?'off ':infinite?'':qty>c.maxStock?'full ':qty<=0?'empty ':qty<c.reorderPoint?'low ':'');
  box.className += ' selected-stock'; box.style.left=(c.x+(side==='in'?-136:188))+'px'; box.style.top=(c.y+18)+'px'; box.innerHTML=`${side==='in'?'STK amont':'STK aval'}<div class="qty">${infinite?'∞':Math.round(qty)+' u.'}</div>${infinite?'<div>Source infinie</div>':''}`; $('flowCanvas').appendChild(box);
  if(active){ if(side==='in') drawLine(c.x-18,c.y+45,c.x,c.y+45,'#22c55e',false); else drawLine(c.x+170,c.y+45,c.x+188,c.y+45,'#22c55e',false); }
}
function drawLine(x1,y1,x2,y2,color,dash,active=false,bad=false){ const svg=$('svg'); const p=document.createElementNS('http://www.w3.org/2000/svg','path'); const mid=(y1+y2)/2; p.setAttribute('d',`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`); p.setAttribute('stroke',color); p.setAttribute('stroke-width',bad?'4':(active?'3.2':(dash?'1.5':'2.2'))); p.setAttribute('fill','none'); p.setAttribute('opacity',active||bad?'.95':(dash?'.55':'.35')); if(dash||!active) p.setAttribute('stroke-dasharray',dash?'4 4':'7 6'); svg.appendChild(p); }
function renderTree(){ const root=cells.find(c=>c.level===0); function rec(c,indent=''){ return `<div class="l${c.level}">${indent}${c.level?'└ ':'● '}${c.name} <span class="${c.custom?'custom':''}">${c.mode}${c.custom?' · custom':''}</span></div>`+c.children.map(id=>rec(byId(id),indent+'&nbsp;&nbsp;&nbsp;')).join(''); } $('tree').innerHTML=rec(root); }
function renderEditor(){ if(!selectedId){ $('editor').innerHTML='<div class="footer-note">Clique sur une cellule au centre pour modifier son comportement. Le flux reste lisible au centre : vert = actif, gris = attente, rouge = blocage.</div>'; return; } const c=byId(selectedId); const infiniteOut=isInfiniteOut(c);
 const statusLabel=c.status==='blocked'?'RUPTURE':c.status==='saturated'?'SATURATION':c.status==='warn'?'À SURVEILLER':(c.wip>0||c.incomingNeed>0?'ACTIF':'EN ATTENTE');
 const statusColor=(c.status==='blocked'||c.status==='saturated')?'#fca5a5':(c.status==='warn'?'#fcd34d':'#86efac');
 const modeHint=c.mode==='MTO'?'Produit uniquement à la commande : moins de stock, mais lead time plus long.':'Produit pour stock : meilleur service si bien dimensionné, mais risque de saturation.';
 $('editor').innerHTML=`
 <div class="status-strip">
   <div class="status-tile"><div class="big" style="color:${statusColor}">${statusLabel}</div><div class="caption">État cellule</div></div>
   <div class="status-tile"><div class="big">${c.mode}</div><div class="caption">Mode courant</div></div>
 </div>
 <div class="editor-card"><h3>1. Identité & stratégie</h3><div class="content">
   <div class="field-inline"><label>Nom</label><input value="${c.name}" onchange="setC('name',this.value)"></div>
   <div class="field-inline"><label>Mode</label><div class="mode-toggle"><button class="${c.mode==='MTO'?'active-mto':''}" onclick="setC('mode','MTO')">MTO</button><button class="${c.mode==='MTS'?'active-mts':''}" onclick="setC('mode','MTS')">MTS</button></div></div>
   <div class="field-inline"><label>Personnalisable</label><select onchange="setC('custom',this.value==='true')"><option value="false" ${!c.custom?'selected':''}>Non</option><option value="true" ${c.custom?'selected':''}>Oui</option></select></div>
   <div class="hint-box">${modeHint}${c.custom?' Attention : une cellule personnalisable en MTS est rarement souhaitable.':''}</div>
 </div></div>
 <div class="editor-card"><h3>2. Stocks de la cellule sélectionnée</h3><div class="content">
   <div class="status-strip">
     <div class="status-tile"><div class="big">${Math.round(c.stockInQty)}</div><div class="caption">Stock amont ${c.stockIn?'activé':'désactivé'}</div></div>
     <div class="status-tile"><div class="big">${infiniteOut?'∞':Math.round(c.stockOutQty)}</div><div class="caption">Stock aval ${infiniteOut?'infini':(c.stockOut?'activé':'désactivé')}</div></div>
   </div>
   <div class="hint-box">Les boîtes de stock de cette cellule apparaissent sur le schéma central. Les cellules du rang le plus bas ont un stock aval infini : elles ne saturent pas et ne provoquent pas de rupture aval.</div>
   <div class="grid2">
    <div class="field"><label>Stock amont</label><select onchange="setC('stockIn',this.value==='true')"><option value="true" ${c.stockIn?'selected':''}>Activé</option><option value="false" ${!c.stockIn?'selected':''}>Désactivé</option></select></div>
    <div class="field"><label>Stock aval</label><select ${infiniteOut?'disabled':''} onchange="setC('stockOut',this.value==='true')"><option value="true" ${c.stockOut?'selected':''}>${infiniteOut?'Infini':'Activé'}</option><option value="false" ${!c.stockOut?'selected':''}>Désactivé</option></select></div>
    <div class="field"><label>Qté amont</label><input type="number" value="${Math.round(c.stockInQty)}" onchange="setC('stockInQty',+this.value)"></div>
    <div class="field"><label>Qté aval</label><input ${infiniteOut?'disabled':'type="number"'} value="${infiniteOut?'∞':Math.round(c.stockOutQty)}" onchange="setC('stockOutQty',+this.value)"></div>
    <div class="field"><label>Point de commande</label><input type="number" value="${c.reorderPoint}" onchange="setC('reorderPoint',+this.value)"></div>
    <div class="field"><label>Stock cible</label><input type="number" value="${c.targetStock}" onchange="setC('targetStock',+this.value)"></div>
    <div class="field"><label>Stock max saturation</label><input ${infiniteOut?'disabled':'type="number"'} value="${infiniteOut?'∞':c.maxStock}" onchange="setC('maxStock',+this.value)"></div>
    <div class="field"><label>Stock aval utilisé</label><input disabled value="${infiniteOut?'∞ / ∞':Math.round(c.stockOutQty)+' / '+c.maxStock}"></div>
   </div>
 </div></div>
 <div class="editor-card"><h3>3. Production</h3><div class="content"><div class="grid2">
   <div class="field"><label>Capacité / jour</label><input type="number" value="${c.capacity}" onchange="setC('capacity',+this.value)"></div>
   <div class="field"><label>WIP actuel</label><input disabled value="${Math.round(c.wip)}"></div>
   <div class="field"><label>Lead time prod</label><input type="number" value="${c.prodTime}" onchange="setC('prodTime',+this.value)"></div>
   <div class="field"><label>Setup</label><input type="number" value="${c.setupTime}" onchange="setC('setupTime',+this.value)"></div>
   <div class="field"><label>Qté par parent</label><input type="number" value="${c.qtyPerParent}" onchange="setC('qtyPerParent',+this.value)"></div>
   <div class="field"><label>Besoin entrant</label><input disabled value="${Math.round(c.incomingNeed)}"></div>
 </div></div></div>
 <div class="mini-actions"><button class="btn-gray" onclick="selectedId=null;renderAll()">Fermer</button><button onclick="recomputeStatuses();renderAll()">Recalculer</button></div>`; }
function setC(k,v){ const c=byId(selectedId); if(isInfiniteOut(c) && ['stockOut','stockOutQty','maxStock'].includes(k)){ c.stockOut=true; c.stockOutQty=Infinity; c.maxStock=Infinity; } else { c[k]=v; } c.issue=""; recomputeStatuses(); renderAll(); }
function applyHeuristic(){ cells.forEach(c=>{ if(c.level===0||c.custom){c.mode='MTO'; c.stockOut=false;} else if(c.level>=2){c.mode='MTS'; c.stockIn=true; c.stockOut=true;} else {c.mode='MTO'; c.stockIn=true; c.stockOut=false;} if(isInfiniteOut(c)){ c.stockOut=true; c.stockOutQty=Infinity; c.maxStock=Infinity; } }); renderAll(); log('Mix auto appliqué: custom/final en MTO, composants standards profonds en MTS. Sources aval infinies conservées au rang le plus bas.'); }
function startSim(){ if(running&&!paused) return; stopReason=''; running=true; paused=false; $('simStatus').textContent='En continu'; $('simStatus').className='pill ok'; clearInterval(timer); timer=setInterval(tick, Math.max(120,650/(+$('speed').value))); }
function pauseSim(){ paused=!paused; $('simStatus').textContent=paused?'Pause':'En cours'; $('simStatus').className=paused?'pill warn':'pill ok'; }
function stopSim(render=true){ running=false; paused=false; clearInterval(timer); timer=null; if(render){ $('simStatus').textContent='Arrêté'; $('simStatus').className='pill'; }}
function tick(){ if(!running||paused) return; simDay++;
 const root=cells.find(c=>c.level===0);
 const vari=+$('variability').value/100;
 const base=Math.max(1,+$('releaseLot').value||1);
 if(orders===0){ launchOrder(root,base,`Flux initial lancé: ${base} u.`); }
 // production capacity drains WIP to output
 cells.forEach(c=>{
   const before=c.produced;
   if(c.wip>0){ const made=Math.min(c.wip,c.capacity); c.wip-=made; c.produced+=made; if(c.stockOut) c.stockOutQty+=made; spawnMaterial(c,made); }
   c.justProduced=Math.max(0,c.produced-before);
   if(!isInfiniteOut(c) && c.mode==='MTS' && c.stockOut && c.stockOutQty<c.reorderPoint){ const qty=Math.max(0,Math.min(c.targetStock,c.maxStock)-c.stockOutQty); if(qty>0){ createProductionOrder(c,qty,false); log(`${c.name}: réapprovisionnement MTS ${Math.round(qty)} u. avec explosion de nomenclature.`,''); }}
 });
 const completedNow=Math.max(0,Math.floor(root.produced-lastRootProduced));
 if(completedNow>0){ fulfilledOrders+=completedNow; }
 if($('continuousFlow').checked && completedNow>0){ lastRootProduced+=completedNow; const lot=Math.max(1,Math.round(completedNow*base*(1+(Math.random()*2-1)*vari))); launchOrder(root,lot,`Produit fini terminé: ${completedNow} u. → relance immédiate de ${lot} u.`); }
 recomputeStatuses();
 const issue=cells.find(c=>c.status==='blocked'||c.status==='saturated');
 if(issue && $('stopOnIssue').checked){ stopReason=issue.status==='blocked'?`Rupture sur ${issue.name}`:`Saturation sur ${issue.name}`; stopSim(false); $('simStatus').textContent=stopReason; $('simStatus').className='pill bad'; log(`Simulation arrêtée: ${stopReason}. Ajuste la cellule puis relance.`,'warning'); }
 animateDots(); updateKpis(); renderFlow(); $('dayBadge').textContent='Jour '+simDay; $('orderBadge').textContent='Commandes '+orders; }

function recomputeStatuses(){ cells.forEach(c=>{ if(isInfiniteOut(c)){ c.stockOut=true; c.stockOutQty=Infinity; c.maxStock=Infinity; } c.status='good'; if(!c.issue) c.issue='';
  if(!isInfiniteOut(c) && c.stockOut && c.stockOutQty<=0 && (c.wip>0 || c.incomingNeed>0)){ c.status='blocked'; c.issue='stock aval vide'; }
  else if(c.stockIn && c.stockInQty<=0 && c.level>0){ c.status='blocked'; c.issue='stock amont vide'; }
  else if(!isInfiniteOut(c) && c.stockOut && c.stockOutQty>c.maxStock){ c.status='saturated'; c.issue='stock aval plein'; }
  else if(c.stockIn && c.stockInQty>c.maxStock){ c.status='saturated'; c.issue='stock amont plein'; }
  else if(c.wip>Math.max(c.capacity*6, c.maxStock)){ c.status='saturated'; c.issue='WIP trop élevé'; }
  else if(!isInfiniteOut(c) && c.stockOut && c.stockOutQty<c.reorderPoint){ c.status='warn'; c.issue='sous point commande'; }
  else { c.issue=''; }
 }); }

function launchOrder(root,qty,msg){
 orders+=qty;
 requestFromCell(root,qty,true);
 log(msg);
}
function requestFromCell(c,qty,customerCritical=true){
 c.incomingNeed+=qty;
 // Les cellules du rang le plus bas sont des sources : disponibilité aval infinie.
 if(isInfiniteOut(c)){
   c.consumed+=qty;
   return;
 }
 // MTS : on sert d'abord depuis le stock aval. La production ne se déclenche que sur le manque
 // ou sur une boucle de réapprovisionnement au point de commande.
 if(c.mode==='MTS' && c.stockOut){
   const used=Math.min(c.stockOutQty,qty);
   c.stockOutQty-=used;
   c.consumed+=used;
   const missing=qty-used;
   if(missing>0){
     if(customerCritical){
       c.blocked+=missing;
       c.issue='stock aval insuffisant pour besoin aval';
       spawnBlocked(c);
       log(`${c.name}: besoin aval ${Math.round(qty)} u., stock servi ${Math.round(used)} u., manque ${Math.round(missing)} u.`,'warning');
     }
     createProductionOrder(c,missing,customerCritical);
   }
   return;
 }
 // MTO : aucune production sans besoin aval. Le besoin explose immédiatement vers les enfants.
 createProductionOrder(c,qty,customerCritical);
}
function createProductionOrder(c,qty,customerCritical=true){
 c.wip+=qty;
 c.children.forEach(id=>{
   const child=byId(id);
   const childQty=qty*child.qtyPerParent;
   spawnInfo(c,child);
   requestFromCell(child,childQty,customerCritical);
 });
}
function spawnOrder(c,qty){ /* points supprimés : état du flux affiché par badges et lignes */ }
function spawnInfo(parent,child){ }
function spawnMaterial(c,qty){ }
function spawnBlocked(c){ }
function addDot(x1,y1,x2,y2,cls,dur){ }
function animateDots(){ dots=[]; [...$('flowCanvas').querySelectorAll('.dot')].forEach(d=>d.remove()); }
function updateKpis(){ const anyActive=cells.some(c=>c.wip>0||c.incomingNeed>0); const issue=cells.find(c=>c.status==='blocked'||c.status==='saturated'); const anyBlocked=!!issue; const fb=$('flowBadge'); if(fb){ fb.textContent=issue?(issue.status==='blocked'?'Flux en rupture':'Flux saturé'):(anyActive?'Flux actif':'Flux en attente'); fb.className=anyBlocked?'pill bad':(anyActive?'pill ok':'pill warn'); } const totalStock=cells.reduce((s,c)=>s+(c.stockIn?c.stockInQty:0)+(c.stockOut&&!isInfiniteOut(c)?c.stockOutQty:0),0); const totalBlocked=cells.reduce((s,c)=>s+c.blocked,0); const wip=cells.reduce((s,c)=>s+c.wip,0); const produced=cells.find(c=>c.level===0)?.produced||0; const service=orders?Math.max(0,Math.min(100,fulfilledOrders/orders*100)):0; const lead=estimateLead(cells.find(c=>c.level===0));
 $('kService').textContent=service.toFixed(0)+'%'; $('kLead').textContent=lead.toFixed(1)+'j'; $('kStock').textContent=Math.round(totalStock); $('kWip').textContent=Math.round(wip);
 const risky=cells.filter(c=>c.custom&&c.mode==='MTS').length; const bottlenecks=cells.filter(c=>c.status==='blocked'||c.status==='warn').slice(0,5);
 $('diagnostic').innerHTML=`<div class="row"><span>Commandes reçues</span><strong>${orders}</strong></div><div class="row"><span>Produits finis sortis</span><strong>${Math.round(produced)}</strong></div><div class="row"><span>Commandes livrées</span><strong>${Math.round(fulfilledOrders)}</strong></div><div class="row"><span>Ruptures cumulées</span><strong style="color:${totalBlocked?'#fca5a5':'#86efac'}">${Math.round(totalBlocked)}</strong></div><div class="row"><span>État arrêt</span><strong style="color:${stopReason?'#fca5a5':'#86efac'}">${stopReason||'Aucun'}</strong></div><div class="row"><span>Custom en MTS</span><strong style="color:${risky?'#fcd34d':'#86efac'}">${risky}</strong></div><p class="footer-note">${bottlenecks.length?'Points à regarder : '+bottlenecks.map(c=>c.name).join(', '):'Flux OK : pas de cellule critique détectée.'}</p>`; }
function estimateLead(c){ if(!c) return 0; let own=c.mode==='MTO'?c.prodTime+c.setupTime:Math.max(.2,(c.stockOutQty<c.reorderPoint?1.5:.3)); if(!c.children.length) return own; const childMax=Math.max(...c.children.map(id=>estimateLead(byId(id)))); return own + (c.mode==='MTO'?childMax:childMax*.35); }
['stopOnIssue','continuousFlow'].forEach(id=>$(id).addEventListener('change',renderFlow));
$('genBtn').onclick=()=>{ lastRootProduced=0; stopReason=''; generateBOM(); }; $('heuristicBtn').onclick=applyHeuristic; $('startBtn').onclick=startSim; $('pauseBtn').onclick=pauseSim; $('stopBtn').onclick=()=>stopSim(); $('speed').oninput=()=>{ $('speedLbl').textContent='x'+$('speed').value; if(running&&!paused) startSim(); };
window.onload=generateBOM;
