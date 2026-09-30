/* Casa ID · versione demo — applicazione web (Supabase) */
'use strict';

/* ---------- costanti ---------- */
const SEZ=[{id:'atti',n:'Proprietà e atti'},{id:'catasto',n:'Catasto'},{id:'urbanistica',n:'Urbanistica'},{id:'impianti',n:'Impianti ed energia'},{id:'condominio',n:'Condominio'},{id:'contratti',n:'Contratti'}];
const SEZN=Object.fromEntries(SEZ.map(s=>[s.id,s.n]));
const RUOLO={proprietario:'Proprietario',familiare:'Familiare',agenzia:'Agenzia immobiliare',broker:'Broker immobiliare',tecnico:'Tecnico',notaio:'Notaio'};
const RUOLO_BREVE={proprietario:'Proprietario',familiare:'Familiare',agenzia:'Agenzia',broker:'Broker',tecnico:'Tecnico',notaio:'Notaio'};
const PROF=['agenzia','broker','tecnico','notaio'];
const SEZ_DEFAULT={agenzia:['catasto','contratti','condominio'],broker:['atti','catasto','contratti'],tecnico:['urbanistica','impianti','catasto'],notaio:['atti']};
const LIV={titolare:'Titolare',delegato:'Delegato',professionista:'Professionista'};
const SERV=[
 {id:'accesso-atti',n:'Accesso agli atti',d:'Pratiche edilizie presso il Comune',sez:'urbanistica',r:'tecnico'},
 {id:'ispezione',n:'Ispezione ipotecaria',d:'Conservatoria: trascrizioni e iscrizioni',sez:'atti',r:'tecnico'},
 {id:'visura',n:'Visura e planimetria',d:'Catasto: visura storica e planimetria',sez:'catasto',r:'tecnico'},
 {id:'ape',n:'APE',d:'Attestato di prestazione energetica',sez:'impianti',r:'tecnico'},
 {id:'cdu',n:'CDU',d:'Certificato di destinazione urbanistica',sez:'urbanistica',r:'tecnico'},
 {id:'copia-atto',n:'Copia di atto notarile',d:'Rogito o atto di provenienza',sez:'atti',r:'notaio'}];
const SERVN=Object.fromEntries(SERV.map(s=>[s.id,s]));
const RSTATO={inviata:['In attesa di un professionista','p-warn'],lavorazione:['In lavorazione','p-info'],consegnata:['Consegnata','p-ok']};
const TABLES=['profiles','immobili','accessi','documenti','richieste','condivisioni','eventi'];
const BUCKET='documenti';

/* ---------- stato ---------- */
let raf=0;
const S={sb:null,state:'boot',session:null,data:Object.fromEntries(TABLES.map(t=>[t,{}])),
  cur:null,view:'home',tab:'documenti',sez:'tutti',q:'',guest:null,guestData:null,guestPreview:false,seen:new Set(),authMode:'login',authMsg:''};

/* ---------- utilità ---------- */
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rid=(n=16)=>{const a='abcdefghijkmnpqrstuvwxyz23456789';let s='';for(const b of crypto.getRandomValues(new Uint8Array(n)))s+=a[b%a.length];return s};
const now=()=>new Date().toISOString();
const today=()=>new Date().toISOString().slice(0,10);
const addDays=d=>new Date(Date.now()+d*864e5).toISOString().slice(0,10);
const MESI=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const fmt=iso=>{if(!iso)return '—';const s=String(iso).slice(0,10).split('-');return s.length===3?`${s[2]}/${s[1]}/${s[0]}`:iso};
const fmtT=iso=>{if(!iso)return '';const d=new Date(iso);return `${fmt(d.toISOString())} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
const daysTo=iso=>Math.ceil((Date.parse(String(iso).slice(0,10))-Date.parse(today()))/864e5);
const ini=n=>String(n||'?').replace(/^(Geom\.|Arch\.|Notaio|Ing\.|Dott\.)\s*/,'').split(/[\s@.]+/).filter(Boolean).map(p=>p[0]).slice(0,2).join('').toUpperCase();
const size=b=>b==null?'':b>1048576?(b/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(b/1024))+' KB';
const camel=s=>s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const snake=s=>s.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
const toCamel=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[camel(k),v]));
const toSnake=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[snake(k),v]));
const vals=t=>Object.values(S.data[t]);
const user=id=>S.data.profiles[id];
const userByEmail=e=>vals('profiles').find(p=>p.email===String(e||'').toLowerCase());
const me=()=>S.session?user(S.session.user.id):null;
const myEmail=()=>S.session?String(S.session.user.email||'').toLowerCase():'';
const uname=id=>user(id)?.nome||'Utente';
const ename=e=>userByEmail(e)?.nome||e;
const I={
 file:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
 up:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/></svg>',
 plus:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 search:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
 x:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 qr:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></svg>',
 link:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
 eye:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
 bell:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'
};
const LOGO=(fill='#FFFFFF',slot='#0066CC',w=44)=>`<svg width="${w}" height="${Math.round(w*.75)}" viewBox="0 0 64 48" aria-hidden="true"><rect x="1" y="1" width="62" height="46" rx="7" fill="${fill}"/><rect x="7" y="9" width="22" height="27" rx="3" fill="${slot}"/><path d="M10.5 22.5L18 16l7.5 6.5" fill="none" stroke="${fill}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.8 21v10h10.4V21" fill="none" stroke="${fill}" stroke-width="2.2" stroke-linejoin="round"/><rect x="34" y="11" width="23" height="3.6" rx="1.8" fill="${slot}"/><rect x="34" y="18" width="16" height="3.6" rx="1.8" fill="${slot}" opacity=".55"/><rect x="34" y="25" width="19" height="3.6" rx="1.8" fill="${slot}" opacity=".55"/><rect x="34" y="33" width="6" height="3" fill="#009246"/><rect x="40" y="33" width="6" height="3" fill="#E6ECF2"/><rect x="46" y="33" width="6" height="3" fill="#CE2B37"/></svg>`;

function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,3500)}
function errMsg(e){const m=String(e&&(e.message||e.error_description||e)||'');
  if(/Invalid login/i.test(m))return 'Email o password non corrette.';
  if(/already registered|already exists/i.test(m))return 'Esiste già un account con questa email: accedi.';
  if(/Password should be/i.test(m))return 'La password deve avere almeno 6 caratteri.';
  if(/Email not confirmed/i.test(m))return 'Conferma prima l\'email: controlla la posta.';
  if(/row-level security|violates|permission/i.test(m))return 'Operazione non consentita con il tuo ruolo.';
  if(/exceeded the maximum|too large|Payload too large/i.test(m))return 'Il file supera il limite di 20 MB.';
  if(/mime type|not supported/i.test(m))return 'Formato non supportato: carica un PDF o un\'immagine.';
  return 'Operazione non riuscita. Riprova. ('+m.slice(0,80)+')'}

/* ---------- accesso ai dati ---------- */
async function loadAll(){
  const res=await Promise.all(TABLES.map(t=>{let q=S.sb.from(t).select('*');if(t==='eventi')q=q.order('ts',{ascending:false}).limit(500);return q}));
  res.forEach((r,i)=>{if(r.error){console.warn(TABLES[i],r.error);return}
    S.data[TABLES[i]]=Object.fromEntries(r.data.map(row=>{const o=toCamel(row);return [o.id,o]}))});
  S.state='ready';render();
}
let reloadT=0;
function reloadSoon(){clearTimeout(reloadT);reloadT=setTimeout(()=>{if(S.session)loadAll()},250)}
async function write(p){const {data,error}=await p;if(error)throw error;reloadSoon();return data}
async function evento(imId,azione){if(!S.session||!imId)return;try{await S.sb.from('eventi').insert({immobile_id:imId,user_id:S.session.user.id,azione})}catch(e){}}

/* ---------- permessi (specchio delle regole del database) ---------- */
function acc(imId,email=myEmail()){const a=vals('accessi').find(x=>x.immobileId===imId&&x.email===email);if(!a)return null;if(a.scadenza&&daysTo(a.scadenza)<0)return null;return a}
function sezOf(a){return !a?[]:(a.livello==='professionista'?(a.sezioni||[]):SEZ.map(s=>s.id))}
const isOwnerLike=a=>a&&(a.livello==='titolare'||a.livello==='delegato');
const canInvite=a=>a&&(a.livello==='titolare'||(a.livello==='delegato'&&a.puoInvitare));
function myImmobili(){return vals('immobili').filter(i=>acc(i.id)).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''))}
function docsOf(imId,a){const allow=sezOf(a);return vals('documenti').filter(d=>d.immobileId===imId&&allow.includes(d.sezione))}
function completezza(imId){const ds=vals('documenti').filter(d=>d.immobileId===imId&&d.stato!=='richiesto');return Math.round(SEZ.filter(s=>ds.some(d=>d.sezione===s.id)).length/SEZ.length*100)}
function prossimaScadenza(imId,a){const ds=docsOf(imId,a).filter(d=>d.scadenza).sort((x,y)=>x.scadenza.localeCompare(y.scadenza));return ds.find(d=>daysTo(d.scadenza)>=0)||ds[ds.length-1]}
function scadPill(iso){const n=daysTo(iso);if(n<0)return `<span class="pill p-crit">Scaduto</span>`;if(n<=90)return `<span class="pill p-warn">Tra ${n} giorni</span>`;return `<span class="pill p-ok">In regola</span>`}
function incarichiMiei(){const u=me();if(!u||!PROF.includes(u.ruolo))return[];return vals('richieste').filter(r=>r.stato!=='consegnata'&&(r.assegnatoA===u.id||(!r.assegnatoA&&r.ruoloRichiesto===u.ruolo))).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))}
function badge(ruolo){return ruolo?`<span class="pill r-${esc(ruolo)}">${esc(RUOLO_BREVE[ruolo]||ruolo)}</span>`:''}

/* ---------- avvio ---------- */
function parseHash(){const m=/^#g([a-z0-9]{8,32})$/.exec(location.hash||'');if(m){S.guest=m[1];S.guestPreview=false;S.guestData=null;loadGuest()}}
async function boot(){
  const cfg=window.CASAID_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||/INCOLLA/.test(cfg.SUPABASE_URL)){S.state='config';render();return}
  S.sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  parseHash();
  const {data:{session}}=await S.sb.auth.getSession();
  S.session=session;S.state=session?'loading':'auth';render();
  if(session)startData();
  S.sb.auth.onAuthStateChange((ev,sess)=>{
    const had=!!S.session;S.session=sess;
    if(sess&&!had){S.state='loading';render();startData()}
    if(!sess&&had){S.data=Object.fromEntries(TABLES.map(t=>[t,{}]));S.state='auth';S.cur=null;S.view='home';stopRealtime();render()}
  });
}
let channel=null;
function startData(){loadAll();stopRealtime();
  channel=S.sb.channel('casaid');TABLES.forEach(t=>channel.on('postgres_changes',{event:'*',schema:'public',table:t},reloadSoon));channel.subscribe()}
function stopRealtime(){if(channel){S.sb.removeChannel(channel);channel=null}}
addEventListener('hashchange',()=>{parseHash();render()});

/* ---------- rendering ---------- */
function render(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;draw()})}
function draw(){
  const ae=document.activeElement,fid=ae&&ae.id&&$('#app').contains(ae)?ae.id:null,sel=fid&&ae.selectionStart;
  let h;
  if(S.state==='boot')h=loading('Avvio di Casa ID…');
  else if(S.state==='config')h=configView();
  else if(S.guest)h=guestView();
  else if(S.state==='auth')h=authView();
  else if(S.state==='loading'||!me())h=loading('Carico i tuoi fascicoli…');
  else h=shell();
  $('#app').innerHTML=h;
  if(fid){const el=document.getElementById(fid);if(el){el.focus();try{if(sel!=null)el.setSelectionRange(sel,sel)}catch(e){}}}
}
function barHtml(right=''){return `<header class="bar"><div class="bar-in"><button class="brand" data-act="home" aria-label="Casa ID, torna alla home">${LOGO()}<span><b>Casa ID</b><small>Carta d'Identità dell'Immobile</small></span></button><span class="test-pill">Versione demo</span><span class="bar-sp"></span>${right}</div></header>`}
function loading(t){return barHtml()+`<main class="wrap"><div class="card empty"><p class="lead">${esc(t)}</p></div></main>`}
function configView(){return barHtml()+`<main class="wrap"><div class="card empty"><h2>Configurazione mancante</h2><p class="lead">Inserisci in <b class="code">config.js</b> l'indirizzo del progetto Supabase e la chiave pubblica, poi ricarica la pagina.</p></div></main>`}

/* accesso e registrazione */
function authView(){
  const reg=S.authMode==='register';
  return barHtml()+`<main class="wrap"><div class="login">
  <section><p class="eyebrow">Versione demo</p><h1>${reg?'Crea il tuo profilo di prova':'Accedi al tuo fascicolo'}</h1>
   <p class="lead">Casa ID raccoglie in un unico fascicolo digitale i documenti del tuo immobile, caricati da agenzia, tecnico e notaio. In questa demo ti registri con email e password; nella versione definitiva il proprietario entrerà con SPID o CIE.</p>
   <div class="note" style="margin-top:20px">Stai provando una versione dimostrativa: usa documenti di prova, non caricare documenti reali o dati personali di terzi.</div></section>
  <form class="card form" data-form="${reg?'register':'login'}" autocomplete="on">
   <div class="tools" style="margin:0"><button type="button" class="chip" data-act="auth-mode" data-id="login" aria-pressed="${!reg}">Accedi</button><button type="button" class="chip" data-act="auth-mode" data-id="register" aria-pressed="${reg}">Registrati</button></div>
   ${reg?`<div class="fld"><label for="a-nome">Nome e cognome</label><input id="a-nome" name="nome" required autocomplete="name"></div>
   <div class="fgrid"><div class="fld"><label for="a-ruolo">Ruolo</label><select id="a-ruolo" name="ruolo">${Object.entries(RUOLO).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
   <div class="fld"><label for="a-studio">Studio o società (facoltativo)</label><input id="a-studio" name="studio" autocomplete="organization"></div></div>`:''}
   <div class="fld"><label for="a-email">Email</label><input id="a-email" name="email" type="email" required autocomplete="email"></div>
   <div class="fld"><label for="a-pwd">Password</label><input id="a-pwd" name="pwd" type="password" required minlength="6" autocomplete="${reg?'new-password':'current-password'}"></div>
   <p class="err" id="a-err" ${S.authMsg?'':'hidden'}>${esc(S.authMsg)}</p>
   <button class="btn btn-p" type="submit" id="a-ok">${reg?'Crea profilo':'Accedi'}</button>
   ${reg?'<p class="muted" style="font-size:13px">Se sei stato invitato in un fascicolo, registrati con la stessa email a cui è arrivato l\'invito: lo troverai subito.</p>':''}
  </form></div></main>`;
}

/* shell */
function shell(){
  const u=me(),ims=myImmobili(),pro=PROF.includes(u.ruolo);
  if(S.cur&&!acc(S.cur))S.cur=null;
  const inc=incarichiMiei();
  const side=`<nav class="side" aria-label="Fascicoli">
    <h2>${pro?'Fascicoli dei clienti':'I miei immobili'}</h2>
    ${ims.map(i=>`<button class="side-item" data-act="open" data-id="${esc(i.id)}" aria-current="${S.view==='fascicolo'&&S.cur===i.id}"><b>${esc(i.tipo)} · ${esc(i.indirizzo)}</b><span>${esc(i.comune||'')} · ${esc(LIV[acc(i.id).livello])}</span></button>`).join('')||'<p class="muted" style="padding:4px 12px">Nessun fascicolo.</p>'}
    <button class="side-item" data-act="new-im"><b style="color:var(--brand)">+ ${pro?'Nuovo fascicolo per un cliente':'Aggiungi immobile'}</b></button>
    ${pro?`<div class="side-sep"></div><h2>Lavoro</h2><button class="side-item" data-act="incarichi" aria-current="${S.view==='incarichi'}"><b>Incarichi dai servizi</b><span>${inc.length} da gestire</span></button>`:''}
  </nav>`;
  let main;
  if(S.view==='incarichi'&&pro)main=incarichiView();
  else if(S.view==='fascicolo'&&S.cur)main=fascicolo();
  else main=home();
  const right=`<div class="me"><div class="who"><b>${esc(u.nome)}</b><span>${esc(RUOLO[u.ruolo]||u.ruolo)}</span></div><button class="btn-bar" data-act="logout">Esci</button></div>`;
  return barHtml(right)+`<main class="wrap"><div class="layout">${side}<div>${main}</div></div></main>`;
}

function home(){
  const u=me(),ims=myImmobili(),pro=PROF.includes(u.ruolo);
  const cards=ims.map(i=>{const a=acc(i.id),c=completezza(i.id),p=prossimaScadenza(i.id,a);return `<button class="card im-card" data-act="open" data-id="${esc(i.id)}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="code muted">${esc(i.codice)}</span><span class="pill p-mute">${esc(LIV[a.livello])}</span></div>
    <h3>${esc(i.tipo)} · ${esc(i.indirizzo)}</h3><p class="muted">${esc(i.comune||'')}${i.categoria?' · Cat. '+esc(i.categoria):''}</p>
    <div style="display:flex;align-items:center;gap:10px"><div class="bar-prog" style="flex:1"><i style="width:${c}%"></i></div><b class="num" style="font-size:13px">${c}%</b></div>
    <p style="font-size:13px">${p?`${esc(p.titolo)}: <span class="${daysTo(p.scadenza)<0?'st-crit':daysTo(p.scadenza)<=90?'st-warn':'st-ok'}">scade il ${fmt(p.scadenza)}</span>`:'<span class="muted">Nessuna scadenza</span>'}</p>
    ${i.esempio?'<span class="pill p-info" style="align-self:flex-start">Dati di esempio</span>':''}</button>`}).join('');
  const inc=incarichiMiei();
  const nome=(u.nome||'').split(' ').filter(w=>!/\./.test(w)&&w!=='Notaio')[0]||u.nome;
  return `<div class="hello"><p class="eyebrow">${esc(RUOLO[u.ruolo]||'')}</p><h1>Ciao, ${esc(nome)}</h1>
  <p class="lead">${pro?'Qui trovi i fascicoli dei clienti a cui hai accesso e gli incarichi arrivati dai servizi in app.':'Qui trovi i fascicoli dei tuoi immobili, con i documenti caricati dai professionisti.'}</p></div>
  ${cards?`<div class="grid-im">${cards}</div>`:`<div class="card empty"><h2>Nessun fascicolo ancora</h2><p class="lead">${pro?'Crea il fascicolo per un cliente indicando la sua email, oppure attendi che un proprietario ti inviti.':'Aggiungi il tuo immobile, oppure crea un fascicolo di esempio già compilato per vedere come funziona.'}</p>
   <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button class="btn btn-p" data-act="new-im">${I.plus} ${pro?'Nuovo fascicolo':'Aggiungi immobile'}</button>${pro?'':`<button class="btn btn-s" data-act="esempio">Crea un fascicolo di esempio</button>`}</div></div>`}
  ${cards&&!pro?`<p style="margin-top:16px"><button class="btn btn-g btn-sm" data-act="esempio">+ Crea un altro fascicolo di esempio</button></p>`:''}
  ${pro&&inc.length?`<h2 class="section-t">Incarichi da gestire</h2><div class="card list">${inc.slice(0,3).map(incRow).join('')}</div>`:''}`;
}

/* fascicolo */
function fascicolo(){
  const i=S.data.immobili[S.cur];if(!i)return home();
  const a=acc(i.id),c=completezza(i.id),own=isOwnerLike(a);
  if(!S.seen.has(i.id)){S.seen.add(i.id);evento(i.id,'ha aperto il fascicolo')}
  const tabs=[['documenti','Documenti'],['scadenze','Scadenze'],...(own?[['servizi','Servizi'],['accessi','Accessi'],['registro','Registro accessi']]:[])];
  if(!tabs.some(t=>t[0]===S.tab))S.tab='documenti';
  const cat=[i.foglio&&'Fg. '+i.foglio,i.particella&&'Part. '+i.particella,i.sub&&'Sub. '+i.sub,i.categoria&&'Cat. '+i.categoria].filter(Boolean).join(' · ');
  const body={documenti:tabDocumenti,scadenze:tabScadenze,servizi:tabServizi,accessi:tabAccessi,registro:tabRegistro}[S.tab](i,a);
  return `<section class="card fhead">
    <div class="t"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="eyebrow">Fascicolo immobile</span><span class="pill p-info code">${esc(i.codice)}</span>${i.esempio?'<span class="pill p-mute">Dati di esempio</span>':''}</div>
      <h1>${esc(i.tipo)} · ${esc(i.indirizzo)}</h1><p class="muted">${esc(i.comune||'')}${cat?' · '+esc(cat):''}</p>
      <p style="font-size:14px">Il tuo ruolo: <b>${esc(LIV[a.livello])}</b>${a.livello==='professionista'?' · sezioni: '+esc((a.sezioni||[]).map(s=>SEZN[s]).join(', '))+(a.scadenza?' · fino al '+fmt(a.scadenza):''):''}</p>
      <div class="acts"><button class="btn btn-p" data-act="upload">${I.up} Carica documento</button><button class="btn btn-s" data-act="qr">${I.qr} Codice</button>${canInvite(a)?`<button class="btn btn-s" data-act="invite">${I.plus} Invita</button>`:''}</div></div>
    <div class="comp"><span class="muted" style="font-size:13px">Completezza del fascicolo</span><b class="num">${c}%</b><div class="bar-prog"><i style="width:${c}%"></i></div><span class="muted" style="font-size:12px">Sezioni con almeno un documento</span></div>
  </section>
  <div class="tabs" role="tablist">${tabs.map(([k,n])=>`<button class="tab" role="tab" aria-selected="${S.tab===k}" data-act="tab" data-id="${k}">${n}</button>`).join('')}</div>
  ${body}`;
}
function docRow(d){
  const st=d.stato==='verificato'?['Verificato','st-ok']:d.stato==='richiesto'?['Richiesto','st-warn']:['Caricato dal proprietario','st-mute'];
  return `<button class="row" data-act="${d.filePath?'view':'doc'}" data-id="${esc(d.id)}"><span class="ico ico-${esc(d.sezione)}">${I.file}</span>
   <span style="min-width:0"><b>${esc(d.titolo)}</b><small>${esc(SEZN[d.sezione])} · ${d.dataDocumento?fmt(d.dataDocumento):'senza data'}${d.fileName?' · '+esc(d.fileName):d.stato==='richiesto'?'':' · nessun file'}</small></span>
   <span class="rb">${badge(d.caricatoRuolo||user(d.caricatoDa)?.ruolo)}</span>
   <span class="right"><span class="${st[1]}" style="font-weight:700">${st[0]}</span>${d.scadenza?`<span class="muted">scade ${fmt(d.scadenza)}</span>`:''}</span></button>`;
}
function tabDocumenti(i,a){
  const all=docsOf(i.id,a),allow=sezOf(a),q=S.q.trim().toLowerCase();
  const ds=all.filter(d=>(S.sez==='tutti'||d.sezione===S.sez)&&(!q||(d.titolo+' '+(d.note||'')+' '+(d.fileName||'')).toLowerCase().includes(q)))
    .sort((x,y)=>(y.dataDocumento||y.createdAt||'').localeCompare(x.dataDocumento||x.createdAt||''));
  const chips=[['tutti','Tutti',all.length],...SEZ.filter(s=>allow.includes(s.id)).map(s=>[s.id,s.n,all.filter(d=>d.sezione===s.id).length])];
  return `<div class="tools">${chips.map(([k,n,c])=>`<button class="chip" data-act="sez" data-id="${k}" aria-pressed="${S.sez===k}">${esc(n)} <span class="num muted">${c}</span></button>`).join('')}</div>
  <div class="tools"><label class="search" for="q">${I.search}<input id="q" type="search" placeholder="Cerca un documento" value="${esc(S.q)}" aria-label="Cerca un documento"></label></div>
  <div class="card list">${ds.map(docRow).join('')||`<div class="empty"><p class="lead">${all.length?'Nessun documento corrisponde alla ricerca.':'Ancora nessun documento in questo fascicolo.'}</p><button class="btn btn-p" data-act="upload">${I.up} Carica il primo documento</button></div>`}</div>`;
}
function tabScadenze(i,a){
  const ds=docsOf(i.id,a).filter(d=>d.scadenza).sort((x,y)=>x.scadenza.localeCompare(y.scadenza));
  return `<div class="card list">${ds.map(d=>{const [y,m]=d.scadenza.split('-');return `<div class="deadline"><div class="d"><span>${MESI[+m-1]}</span><b class="num">${y}</b></div><div style="min-width:0"><b>${esc(d.titolo)}</b><p class="muted" style="font-size:13px">${esc(SEZN[d.sezione])} · scade il ${fmt(d.scadenza)}</p></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${scadPill(d.scadenza)}<button class="btn btn-g btn-sm" data-act="doc" data-id="${esc(d.id)}">Apri</button></div></div>`}).join('')||'<div class="empty"><p class="lead">Nessuna scadenza. Quando carichi un documento con una data di scadenza (APE, revisione caldaia, contratto) la trovi qui.</p></div>'}</div>
  <p class="muted" style="font-size:13px;margin-top:12px">Nella versione definitiva il proprietario e il suo tecnico ricevono un avviso 90 giorni prima di ogni scadenza.</p>`;
}
function tabServizi(i){
  const rs=vals('richieste').filter(r=>r.immobileId===i.id).sort((x,y)=>(y.createdAt||'').localeCompare(x.createdAt||''));
  return `<p class="lead" style="margin-bottom:16px">Con l'abbonamento i servizi tecnici costano <b>0 € di servizio</b>. Restano dovuti solo diritti, tributi e bolli degli enti.</p>
  <div class="svc">${SERV.map(s=>`<div class="card"><h3>${esc(s.n)}</h3><p class="muted" style="font-size:14px">${esc(s.d)}</p><p class="zero">0 € di servizio</p><button class="btn btn-s btn-sm" style="align-self:flex-start" data-act="req" data-id="${s.id}">Richiedi</button></div>`).join('')}</div>
  <h2 class="section-t">Richieste per questo immobile</h2>
  <div class="card list">${rs.map(r=>{const s=SERVN[r.servizio]||{n:r.servizio},st=RSTATO[r.stato]||['',''];return `<div class="person" style="grid-template-columns:minmax(0,1fr) auto"><div><b>${esc(s.n)}</b><p class="muted" style="font-size:13px">Richiesta da ${esc(uname(r.richiestoDa))} il ${fmt(r.createdAt)}${r.assegnatoA?' · affidata a '+esc(uname(r.assegnatoA)):''}${r.note?' · '+esc(r.note):''}</p></div><span class="pill ${st[1]}">${st[0]}</span></div>`}).join('')||'<div class="empty"><p class="lead">Nessuna richiesta finora.</p></div>'}</div>`;
}
function tabAccessi(i,a){
  const order=['titolare','delegato','professionista'];
  const ps=vals('accessi').filter(x=>x.immobileId===i.id).sort((x,y)=>order.indexOf(x.livello)-order.indexOf(y.livello));
  const links=vals('condivisioni').filter(l=>l.immobileId===i.id&&l.attivo!==false).sort((x,y)=>(y.createdAt||'').localeCompare(x.createdAt||''));
  const row=p=>{const u=userByEmail(p.email),ru=u?.ruolo||'proprietario',scad=p.scadenza&&daysTo(p.scadenza)<0;
    const canRev=p.livello!=='titolare'&&p.email!==myEmail()&&(a.livello==='titolare'||(canInvite(a)&&p.invitatoDa===S.session.user.id));
    return `<div class="person"><span class="av r-${esc(ru)}">${esc(ini(u?.nome||p.email))}</span><div style="min-width:0"><b>${esc(u?.nome||p.email)}</b> ${u?badge(u.ruolo):'<span class="pill p-warn">Non ancora registrato</span>'}<p class="muted" style="font-size:13px">${esc(p.email)} · ${esc(LIV[p.livello])}${p.livello==='professionista'?' · '+esc((p.sezioni||[]).map(s=>SEZN[s]).join(', ')):p.livello==='delegato'?(p.puoInvitare?' · può invitare professionisti':''):''}${p.scadenza?` · <span class="${scad?'st-crit':''}">${scad?'scaduto il':'fino al'} ${fmt(p.scadenza)}</span>`:''}${p.invitatoDa&&p.livello!=='titolare'?' · invitato da '+esc(uname(p.invitatoDa)):''}</p></div>${canRev?`<button class="btn btn-g btn-sm" data-act="revoke" data-id="${esc(p.id)}">Revoca</button>`:''}</div>`};
  return `<div class="two"><section class="card"><div class="box-h"><h3>Persone con accesso</h3>${canInvite(a)?`<button class="btn btn-p btn-sm" data-act="invite">${I.plus} Invita</button>`:''}</div><div class="list">${ps.map(row).join('')}</div></section>
  <section class="card"><div class="box-h"><h3>Link di sola lettura</h3>${canInvite(a)?`<button class="btn btn-s btn-sm" data-act="glink">${I.link} Crea link</button>`:''}</div><div class="list">${links.map(l=>{const exp=daysTo(l.scadenza)<0;return `<div class="person" style="grid-template-columns:minmax(0,1fr)"><div style="min-width:0"><b>${esc(l.etichetta)}</b><p class="muted" style="font-size:13px">${esc((l.sezioni||[]).map(s=>SEZN[s]).join(', '))} · <span class="${exp?'st-crit':''}">${exp?'scaduto':'scade'} il ${fmt(l.scadenza)}</span></p></div><div style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn btn-g btn-sm" data-act="gcopy" data-id="${esc(l.id)}">Copia link</button><button class="btn btn-g btn-sm" data-act="gprev" data-id="${esc(l.id)}">Anteprima</button>${canInvite(a)?`<button class="btn btn-g btn-sm" data-act="grevoke" data-id="${esc(l.id)}">Revoca</button>`:''}</div></div>`}).join('')||'<div class="empty"><p class="muted">Crea un link per la banca, l\'acquirente o l\'inquilino: vedono solo le sezioni che scegli, fino alla data che decidi, senza bisogno di registrarsi.</p></div>'}</div></section></div>`;
}
function tabRegistro(i){
  const evs=vals('eventi').filter(e=>e.immobileId===i.id).sort((x,y)=>(y.ts||'').localeCompare(x.ts||''));
  return `<div class="card list">${evs.map(e=>`<div class="ev"><span class="muted num">${fmtT(e.ts)}</span><span><b>${esc(e.attore||uname(e.userId))}</b> ${esc(e.azione)}</span></div>`).join('')||'<div class="empty"><p class="lead">Nessuna attività registrata.</p></div>'}</div>
  <p class="muted" style="font-size:13px;margin-top:12px">Ogni apertura del fascicolo, consultazione, caricamento e modifica degli accessi viene registrata qui.</p>`;
}

/* incarichi */
function incRow(r){const s=SERVN[r.servizio]||{n:r.servizio},im=S.data.immobili[r.immobileId],st=RSTATO[r.stato]||['',''];
  return `<div class="person" style="grid-template-columns:minmax(0,1fr) auto"><div style="min-width:0"><b>${esc(s.n)}</b> <span class="pill ${st[1]}">${st[0]}</span><p class="muted" style="font-size:13px">${im?esc(im.tipo+' · '+im.indirizzo+', '+(im.comune||'')):'Immobile di un cliente'} · richiesta il ${fmt(r.createdAt)}${r.note?' · «'+esc(r.note)+'»':''}</p></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">${r.assegnatoA===S.session.user.id?`<button class="btn btn-p btn-sm" data-act="deliver" data-id="${esc(r.id)}">${I.up} Consegna</button>`:`<button class="btn btn-s btn-sm" data-act="take" data-id="${esc(r.id)}">Prendi in carico</button>`}</div></div>`}
function incarichiView(){const inc=incarichiMiei(),done=vals('richieste').filter(r=>r.assegnatoA===S.session.user.id&&r.stato==='consegnata');
  return `<div class="hello"><p class="eyebrow">Servizi in app</p><h1>Incarichi dai servizi</h1><p class="lead">Richieste degli abbonati per la tua categoria. Prendi in carico, lavora la pratica e consegna: il documento arriva nel fascicolo del cliente con il tuo nome.</p></div>
  <div class="card list">${inc.map(incRow).join('')||'<div class="empty"><p class="lead">Nessun incarico da gestire in questo momento.</p></div>'}</div>
  ${done.length?`<h2 class="section-t">Consegnati</h2><div class="card list">${done.map(r=>`<div class="person" style="grid-template-columns:minmax(0,1fr) auto"><div><b>${esc(SERVN[r.servizio]?.n||r.servizio)}</b><p class="muted" style="font-size:13px">${esc(S.data.immobili[r.immobileId]?.indirizzo||'')} · consegnato il ${fmt(r.consegnataIl)}</p></div><span class="pill p-ok">Consegnata</span></div>`).join('')}</div>`:''}`}

/* ospite */
async function loadGuest(){
  if(!S.sb||!S.guest)return;
  const {data,error}=await S.sb.rpc('guest_view',{token:S.guest});
  S.guestData=error?{error:true}:(data||{invalid:true});
  if(data&&!S.guestPreview&&!S.seen.has('g'+S.guest)){S.seen.add('g'+S.guest);S.sb.rpc('guest_log',{token:S.guest,azione:'ha aperto il link'})}
  render();
}
function guestView(){
  const back=S.guestPreview?`<button class="btn-bar" data-act="gclose">Chiudi anteprima</button>`:`<button class="btn-bar" data-act="gclose">${S.session?'Torna ai fascicoli':'Accedi'}</button>`;
  const g=S.guestData;
  if(!g)return loading('Apro il fascicolo condiviso…');
  if(g.error||g.invalid)return barHtml(back)+`<main class="wrap"><div class="card empty"><h2>Link non valido</h2><p class="lead">Questo link di sola lettura è scaduto o è stato revocato dal proprietario.</p></div></main>`;
  const l=toCamel(g.link),i=toCamel(g.immobile),ds=(g.documenti||[]).map(toCamel);
  S.guestDocs=Object.fromEntries(ds.map(d=>[d.id,d]));
  return barHtml(back)+`<div class="guest-bar">Vista condivisa di sola lettura · valida fino al ${fmt(l.scadenza)}</div><main class="wrap">
   <section class="card fhead"><div class="t"><span class="eyebrow">Fascicolo condiviso${l.creatoDaNome?' da '+esc(l.creatoDaNome):''}</span><h1>${esc(i.tipo)} · ${esc(i.indirizzo)}</h1><p class="muted">${esc(i.comune||'')} · ${esc(i.codice)}</p><p style="font-size:14px">Sezioni condivise: ${esc((l.sezioni||[]).map(s=>SEZN[s]).join(', '))}</p></div></section>
   <div class="card list" style="margin-top:20px">${ds.map(d=>`<div class="row" style="cursor:default"><span class="ico ico-${esc(d.sezione)}">${I.file}</span><span style="min-width:0"><b>${esc(d.titolo)}</b><small>${esc(SEZN[d.sezione])} · ${fmt(d.dataDocumento)}</small></span><span class="rb">${badge(d.caricatoRuolo)}</span><span class="right">${d.filePath?`<button type="button" class="btn btn-s btn-sm" data-act="view" data-id="${esc(d.id)}">Visualizza</button>`:'<span class="muted">nessun file</span>'}</span></div>`).join('')||'<div class="empty"><p class="lead">Nessun documento nelle sezioni condivise.</p></div>'}</div></main>`;
}

/* ---------- modali ---------- */
function modal(title,body,foot='',form='',wide=false){
  const m=$('#modal'),cls='sheet'+(wide?' wide':'');
  const inner=`<div class="sheet-h"><h2 id="m-t">${esc(title)}</h2><button type="button" class="x" data-act="close" aria-label="Chiudi">${I.x}</button></div><div class="sheet-b">${body}</div>${foot?`<div class="sheet-f">${foot}</div>`:''}`;
  m.innerHTML=form?`<form class="${cls}" role="dialog" aria-modal="true" aria-labelledby="m-t" data-form="${form}" novalidate>${inner}</form>`:`<div class="${cls}" role="dialog" aria-modal="true" aria-labelledby="m-t">${inner}</div>`;
  m.hidden=false;const f=m.querySelector('input:not([type=hidden]):not([disabled]),select,textarea');(f||m.querySelector('.x')).focus();
}
function closeModal(){$('#modal').hidden=true;$('#modal').innerHTML='';V.doc=null}
const secCheckboxes=(name,allowed,checked)=>`<div class="checks">${SEZ.filter(s=>allowed.includes(s.id)).map(s=>`<label><input type="checkbox" name="${name}" value="${s.id}" ${checked.includes(s.id)?'checked':''}> ${esc(s.n)}</label>`).join('')}</div>`;

function openUpload(opts={}){
  const imId=opts.immobileId||S.cur,a=acc(imId),allow=opts.sezione?[opts.sezione]:sezOf(a);
  modal(opts.richiestaId?'Consegna della pratica':'Carica documento',`
   ${opts.richiestaId?`<div class="note">Stai consegnando: <b>${esc(SERVN[opts.servizio]?.n||'')}</b>. Il documento andrà nel fascicolo del cliente, sezione ${esc(SEZN[allow[0]])}.</div>`:''}
   <input type="hidden" name="richiestaId" value="${esc(opts.richiestaId||'')}"><input type="hidden" name="immobileId" value="${esc(imId)}">
   <div class="fld"><label for="u-titolo">Titolo del documento</label><input id="u-titolo" name="titolo" required value="${esc(opts.titolo||'')}" placeholder="Es. Attestato di prestazione energetica"></div>
   <div class="fgrid"><div class="fld"><label for="u-sez">Sezione</label><select id="u-sez" name="sezione">${SEZ.filter(s=>allow.includes(s.id)).map(s=>`<option value="${s.id}">${esc(s.n)}</option>`).join('')}</select></div>
   <div class="fld"><label for="u-data">Data del documento</label><input id="u-data" name="dataDocumento" type="date" value="${today()}"></div>
   <div class="fld"><label for="u-scad">Scadenza (facoltativa)</label><input id="u-scad" name="scadenza" type="date"></div></div>
   <div class="fld"><label for="u-file">File</label><input id="u-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"><span class="muted" style="font-size:13px">PDF o immagine, fino a 20 MB. Usa solo documenti di prova.</span></div>
   <div class="fld"><label for="u-note">Note (facoltative)</label><textarea id="u-note" name="note" placeholder="Es. protocollo, riferimento pratica"></textarea></div>
   <p class="err" id="u-err" hidden></p>`,
   `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p" id="u-ok">${I.up} ${opts.richiestaId?'Consegna':'Carica'}</button>`,'upload');
}
function openDoc(id){
  const d=S.data.documenti[id];if(!d)return;const a=acc(d.immobileId);
  const canDel=a&&(a.livello==='titolare'||d.caricatoDa===S.session.user.id);
  if(!S.seen.has('d'+id)){S.seen.add('d'+id);evento(d.immobileId,`ha consultato «${d.titolo}»`)}
  modal(d.titolo,`
   ${d.filePath?`<button type="button" class="btn btn-p" style="align-self:flex-start" data-act="view" data-id="${esc(id)}">${I.eye} Visualizza documento</button>`:''}
   <dl class="kv"><dt>Sezione</dt><dd>${esc(SEZN[d.sezione])}</dd><dt>Caricato da</dt><dd>${esc(uname(d.caricatoDa))} ${badge(d.caricatoRuolo)}</dd>
   <dt>Data documento</dt><dd>${fmt(d.dataDocumento)}</dd><dt>Caricato il</dt><dd>${fmtT(d.createdAt)}</dd>
   <dt>Stato</dt><dd>${d.stato==='verificato'?'<span class="st-ok"><b>Verificato</b></span> · caricato da un professionista':d.stato==='richiesto'?'<span class="st-warn"><b>Richiesto</b></span> · in attesa del professionista':'Caricato dal proprietario'}</dd>
   <dt>File</dt><dd>${d.fileName?esc(d.fileName)+' · '+size(d.size):'Nessun file allegato'}</dd>
   ${d.note?`<dt>Note</dt><dd>${esc(d.note)}</dd>`:''}</dl>
   <form class="fgrid" data-form="scad" style="align-items:end"><input type="hidden" name="docId" value="${esc(id)}"><div class="fld"><label for="d-scad">Scadenza</label><input id="d-scad" name="scadenza" type="date" value="${esc(d.scadenza||'')}"></div><button class="btn btn-s" type="submit">Salva scadenza</button></form>`,
   `${canDel?`<button type="button" class="btn btn-g" data-act="del" data-id="${esc(id)}" style="margin-right:auto;color:var(--crit)">Elimina</button>`:''}${d.filePath?`<button type="button" class="btn btn-s" data-act="dl" data-id="${esc(id)}">Scarica</button>`:''}<button type="button" class="btn btn-s" data-act="close">Chiudi</button>`);
}
function openInvite(){
  const a=acc(S.cur),i=S.data.immobili[S.cur];
  const levels=a.livello==='titolare'?['professionista','delegato']:['professionista'];
  modal('Invita una persona',`
   <p class="muted">Fascicolo: ${esc(i.tipo)} · ${esc(i.indirizzo)}</p>
   <div class="fld"><label for="i-email">Email della persona</label><input id="i-email" name="email" type="email" required placeholder="nome@esempio.it" list="i-known"><datalist id="i-known">${vals('profiles').filter(p=>p.email!==myEmail()).map(p=>`<option value="${esc(p.email)}">${esc(p.nome)} · ${esc(RUOLO[p.ruolo]||'')}</option>`).join('')}</datalist>
    <span class="muted" style="font-size:13px" id="i-hint">Se non è ancora registrata, troverà il fascicolo appena crea il profilo con questa email.</span></div>
   <div class="fld"><span class="lbl">Livello di accesso</span><div class="checks">${levels.map((l,k)=>`<label><input type="radio" name="livello" value="${l}" ${k===0?'checked':''}> ${LIV[l]}</label>`).join('')}</div>
   <span class="muted" style="font-size:13px">Professionista: vede e carica solo le sezioni scelte, per un tempo limitato. Delegato: vede tutto e carica; se vuoi, può invitare professionisti.</span></div>
   <div class="fld"><span class="lbl">Sezioni visibili (professionista)</span>${secCheckboxes('sezioni',SEZ.map(s=>s.id),['catasto'])}</div>
   <div class="fgrid"><div class="fld"><label for="i-scad">Accesso fino al</label><input id="i-scad" name="scadenza" type="date" value="${addDays(90)}"></div>
   ${a.livello==='titolare'?`<div class="fld"><span class="lbl">Delegato</span><div class="checks"><label><input type="checkbox" name="puoInvitare" value="1" checked> può invitare professionisti</label></div></div>`:''}</div>
   <p class="err" id="i-err" hidden></p>`,
   `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p">Invia invito</button>`,'invite');
  const inp=$('#i-email');inp.addEventListener('input',()=>{const p=userByEmail(inp.value.trim());const h=$('#i-hint');
    if(p){h.textContent=`${p.nome} · ${RUOLO[p.ruolo]||''}: già registrato.`;if(SEZ_DEFAULT[p.ruolo])document.querySelectorAll('input[name=sezioni]').forEach(c=>c.checked=SEZ_DEFAULT[p.ruolo].includes(c.value))}
    else h.textContent='Se non è ancora registrata, troverà il fascicolo appena crea il profilo con questa email.'});
}
function openGlink(){
  modal('Crea un link di sola lettura',`
   <div class="fld"><label for="g-et">Per chi è</label><input id="g-et" name="etichetta" required placeholder="Es. Banca per il mutuo"></div>
   <div class="fld"><span class="lbl">Sezioni visibili</span>${secCheckboxes('sezioni',SEZ.map(s=>s.id),['atti','catasto','urbanistica'])}</div>
   <div class="fld"><label for="g-days">Valido per</label><select id="g-days" name="giorni"><option value="7">7 giorni</option><option value="30" selected>30 giorni</option><option value="90">90 giorni</option></select></div>
   <p class="err" id="g-err" hidden></p>`,
   `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p">${I.link} Crea link</button>`,'glink');
}
function openNewIm(){
  const u=me(),pro=PROF.includes(u.ruolo);
  modal(pro?'Nuovo fascicolo per un cliente':'Aggiungi immobile',`
   ${pro?`<div class="fld"><label for="n-own">Email del proprietario</label><input id="n-own" name="titolare" type="email" required placeholder="cliente@esempio.it"><span class="muted" style="font-size:13px">Il cliente diventa titolare del fascicolo; lo trova appena si registra con questa email.</span></div>`:''}
   <div class="fgrid"><div class="fld"><label for="n-tipo">Tipo</label><select id="n-tipo" name="tipo"><option>Appartamento</option><option>Villa</option><option>Box auto</option><option>Negozio</option><option>Ufficio</option><option>Terreno</option><option>Fabbricato rurale</option></select></div>
   <div class="fld"><label for="n-cat">Categoria catastale</label><input id="n-cat" name="categoria" placeholder="Es. A/2"></div></div>
   <div class="fld"><label for="n-ind">Indirizzo</label><input id="n-ind" name="indirizzo" required placeholder="Es. Via Roma 10"></div>
   <div class="fld"><label for="n-com">Comune</label><input id="n-com" name="comune" required placeholder="Es. Salerno"></div>
   <div class="fgrid"><div class="fld"><label for="n-fg">Foglio</label><input id="n-fg" name="foglio" inputmode="numeric"></div><div class="fld"><label for="n-pa">Particella</label><input id="n-pa" name="particella" inputmode="numeric"></div><div class="fld"><label for="n-sub">Subalterno</label><input id="n-sub" name="sub" inputmode="numeric"></div></div>
   <p class="err" id="n-err" hidden></p>`,
   `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p" id="n-ok">Crea fascicolo</button>`,'newim');
}
function openReq(sid){
  const s=SERVN[sid];
  modal('Richiedi: '+s.n,`<p class="lead">${esc(s.d)}.</p><div class="note"><b>0 € di servizio</b> con l'abbonamento. Diritti, tributi e bolli degli enti ti verranno indicati dal professionista prima di procedere.</div>
   <input type="hidden" name="servizio" value="${esc(sid)}"><div class="fld"><label for="r-note">Note per il professionista (facoltative)</label><textarea id="r-note" name="note" placeholder="Es. mi serve entro fine mese per il mutuo"></textarea></div>`,
   `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p">Invia richiesta</button>`,'req');
}
function openCode(){const i=S.data.immobili[S.cur];
  modal('Codice Casa ID',`<div style="display:flex;flex-direction:column;gap:10px"><span class="muted">Codice univoco dell'immobile</span><b class="code" style="font-size:28px">${esc(i.codice)}</b><p class="muted" style="font-size:14px">Stampalo sulla tessera o nel contratto: un professionista autorizzato lo usa per trovare il fascicolo giusto.</p><button type="button" class="btn btn-s btn-sm" style="align-self:flex-start" data-act="copy" data-id="${esc(i.codice)}">Copia codice</button></div>`,
  `<button type="button" class="btn btn-p" data-act="close">Chiudi</button>`)}

/* ---------- visualizzatore in app ---------- */
const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function loadScript(src){return new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>ko(new Error('script'));document.head.appendChild(s)})}
let pdfReady=null;
function ensurePdf(){if(!pdfReady)pdfReady=(async()=>{await loadScript(PDFJS+'pdf.min.js');window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js';return window.pdfjsLib})().catch(e=>{pdfReady=null;throw e});return pdfReady}
const blobCache=new Map();
async function getBlob(path){if(blobCache.has(path))return blobCache.get(path);const {data,error}=await S.sb.storage.from(BUCKET).download(path);if(error)throw error;blobCache.set(path,data);return data}
const V={doc:null,pdf:null,scale:1,url:null};
const findDoc=id=>S.data.documenti[id]||(S.guestDocs||{})[id];
async function openViewer(id){
  const d=findDoc(id);if(!d||!d.filePath)return;
  V.doc=d;V.pdf=null;V.scale=1;if(V.url){URL.revokeObjectURL(V.url);V.url=null}
  const isPdf=(d.fileType||'').includes('pdf')||/\.pdf$/i.test(d.fileName||'');
  modal(d.titolo,`<div class="vbar"><span class="muted" style="font-size:13px">${esc(d.fileName||'')} · ${size(d.size)}</span><span class="sp"></span>${isPdf?`<span class="muted num" id="v-pages"></span><button type="button" class="btn btn-s btn-sm" data-act="zoom" data-id="-1" aria-label="Riduci">−</button><button type="button" class="btn btn-s btn-sm" data-act="zoom" data-id="1" aria-label="Ingrandisci">+</button>`:''}</div>
   <div class="viewer" id="viewer"><p class="vmsg">Apro il documento…</p></div>`,
   `${S.guest?'':`<button type="button" class="btn btn-g" data-act="doc" data-id="${esc(id)}" style="margin-right:auto">Dettagli</button>`}<button type="button" class="btn btn-s" data-act="dl" data-id="${esc(id)}">Scarica</button><button type="button" class="btn btn-p" data-act="close">Chiudi</button>`,'',true);
  if(!S.seen.has('v'+id)){S.seen.add('v'+id);if(S.guest&&!S.guestPreview)S.sb.rpc('guest_log',{token:S.guest,azione:`ha visualizzato «${d.titolo}»`});else if(!S.guest)evento(d.immobileId,`ha visualizzato il file di «${d.titolo}»`)}
  const box=document.getElementById('viewer');
  try{
    const blob=await getBlob(d.filePath);if(V.doc!==d)return;
    if(isPdf){const lib=await ensurePdf();V.pdf=await lib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;await renderPdf()}
    else{V.url=URL.createObjectURL(blob);box.innerHTML=`<img src="${V.url}" alt="${esc(d.titolo)}">`}
  }catch(e){console.warn(e);if(box.isConnected)box.innerHTML=`<p class="vmsg">Non riesco ad aprire il file.<br>Prova con «Scarica».</p>`}
}
async function renderPdf(){
  const box=document.getElementById('viewer');if(!box||!V.pdf)return;
  const pdf=V.pdf,w=Math.max(260,box.clientWidth-24),dpr=Math.min(2,window.devicePixelRatio||1);
  const pg=document.getElementById('v-pages');if(pg)pg.textContent=pdf.numPages+(pdf.numPages===1?' pagina':' pagine');
  box.innerHTML='';
  for(let n=1;n<=pdf.numPages;n++){
    if(V.pdf!==pdf||!box.isConnected)return;
    const page=await pdf.getPage(n),base=page.getViewport({scale:1}),sc=(w/base.width)*V.scale,vp=page.getViewport({scale:sc*dpr});
    const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;c.style.width=Math.round(vp.width/dpr)+'px';c.setAttribute('aria-label','Pagina '+n);
    box.appendChild(c);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
  }
}
async function download(id){
  const d=findDoc(id);if(!d||!d.filePath)return;
  try{const blob=await getBlob(d.filePath);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=d.fileName||'documento';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  catch(e){toast('Download non riuscito')}
}

/* ---------- azioni ---------- */
async function copy(t){try{await navigator.clipboard.writeText(t);toast('Copiato')}catch(e){prompt('Copia il testo:',t)}}
const guestUrl=id=>location.origin+location.pathname+'#g'+id;
const H={
 home(){if(S.guest){H.gclose();return}S.view='home';S.cur=null;render()},
 'auth-mode'(t){S.authMode=t.dataset.id;S.authMsg='';render()},
 async logout(){await S.sb.auth.signOut()},
 open(t){S.cur=t.dataset.id;S.view='fascicolo';S.tab='documenti';S.sez='tutti';S.q='';render();scrollTo(0,0)},
 incarichi(){S.view='incarichi';S.cur=null;render()},
 tab(t){S.tab=t.dataset.id;render()},
 sez(t){S.sez=t.dataset.id;render()},
 upload(){openUpload()},
 doc(t){openDoc(t.dataset.id)},
 view(t){openViewer(t.dataset.id)},
 dl(t){download(t.dataset.id)},
 zoom(t){V.scale=Math.min(2.5,Math.max(.5,V.scale+(+t.dataset.id)*.25));renderPdf()},
 invite(){openInvite()},
 glink(){openGlink()},
 'new-im'(){openNewIm()},
 async esempio(t){t.disabled=true;try{const {data,error}=await S.sb.rpc('crea_esempio');if(error)throw error;await loadAll();S.cur=data;S.view='fascicolo';S.tab='documenti';render();toast('Fascicolo di esempio creato')}catch(e){toast(errMsg(e));t.disabled=false}},
 req(t){openReq(t.dataset.id)},
 qr(){openCode()},
 close(){closeModal()},
 copy(t){copy(t.dataset.id)},
 gcopy(t){copy(guestUrl(t.dataset.id))},
 gprev(t){S.guest=t.dataset.id;S.guestPreview=true;S.guestData=null;loadGuest();render();scrollTo(0,0)},
 gclose(){S.guest=null;S.guestData=null;S.guestPreview=false;try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}render()},
 async grevoke(t){try{await write(S.sb.from('condivisioni').update({attivo:false}).eq('id',t.dataset.id));evento(S.cur,`ha revocato il link «${S.data.condivisioni[t.dataset.id]?.etichetta||''}»`);toast('Link revocato')}catch(e){toast(errMsg(e))}},
 async revoke(t){const p=S.data.accessi[t.dataset.id];if(!p)return;
   if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Conferma revoca';t.style.color='var(--crit)';return}
   try{await write(S.sb.from('accessi').delete().eq('id',p.id));evento(p.immobileId,`ha revocato l'accesso a ${ename(p.email)}`);toast('Accesso revocato')}catch(e){toast(errMsg(e))}},
 async del(t){const d=S.data.documenti[t.dataset.id];if(!d)return;
   if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Conferma eliminazione';return}
   try{if(d.filePath)await S.sb.storage.from(BUCKET).remove([d.filePath]);await write(S.sb.from('documenti').delete().eq('id',d.id));evento(d.immobileId,`ha eliminato «${d.titolo}»`);closeModal();toast('Documento eliminato')}catch(e){toast(errMsg(e))}},
 async take(t){const r=S.data.richieste[t.dataset.id];if(!r)return;t.disabled=true;
   try{const {error}=await S.sb.rpc('prendi_incarico',{rid:r.id});if(error)throw error;await loadAll();toast('Incarico preso in carico')}catch(e){toast(errMsg(e));t.disabled=false}},
 deliver(t){const r=S.data.richieste[t.dataset.id];if(!r)return;const s=SERVN[r.servizio];openUpload({richiestaId:r.id,servizio:r.servizio,sezione:r.sezione||s.sez,immobileId:r.immobileId,titolo:s.n})}
};
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(t&&H[t.dataset.act]){e.preventDefault();H[t.dataset.act](t)}});
$('#modal').addEventListener('mousedown',e=>{if(e.target.id==='modal')closeModal()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)closeModal()});
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;render()}});

const ACCEPT={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
const busy=(b,t)=>{if(b){b.disabled=!!t;if(t)b.dataset.l=b.innerHTML,b.textContent=t;else if(b.dataset.l)b.innerHTML=b.dataset.l}};
const showErr=(id,m)=>{const e=document.getElementById(id);if(e){e.textContent=m;e.hidden=false}};
const F={
 async login(f){const b=$('#a-ok');busy(b,'Accesso…');S.authMsg='';
   const {error}=await S.sb.auth.signInWithPassword({email:f.email.value.trim(),password:f.pwd.value});
   if(error){S.authMsg=errMsg(error);busy(b);showErr('a-err',S.authMsg)}},
 async register(f){const b=$('#a-ok');if(!f.nome.value.trim()){showErr('a-err','Scrivi nome e cognome.');return}
   if(f.pwd.value.length<6){showErr('a-err','La password deve avere almeno 6 caratteri.');return}
   busy(b,'Creazione…');
   const {data,error}=await S.sb.auth.signUp({email:f.email.value.trim(),password:f.pwd.value,options:{data:{nome:f.nome.value.trim(),ruolo:f.ruolo.value,studio:f.studio.value.trim()}}});
   if(error){busy(b);showErr('a-err',errMsg(error));return}
   if(!data.session){S.authMode='login';S.authMsg='Profilo creato. Controlla la posta per confermare l\'email, poi accedi.';render()}},
 async upload(f){
   const ok=$('#u-ok'),titolo=f.titolo.value.trim();if(!titolo){showErr('u-err','Scrivi il titolo del documento.');return}
   const imId=f.immobileId.value,file=f.file.files&&f.file.files[0],u=me();let meta={};
   busy(ok,'Salvataggio…');
   try{
     if(file){const ext=(file.name.split('.').pop()||'').toLowerCase(),type=ACCEPT[ext]||file.type;
       if(!Object.values(ACCEPT).includes(type))throw new Error('mime type not supported');
       if(file.size>20*1048576)throw new Error('too large');
       const path=`${imId}/${crypto.randomUUID()}.${ext||'pdf'}`;
       const {error}=await S.sb.storage.from(BUCKET).upload(path,file,{contentType:type,upsert:false});if(error)throw error;
       meta={file_path:path,file_name:file.name,file_type:type,size:file.size}}
     const row={immobile_id:imId,titolo,sezione:f.sezione.value,data_documento:f.dataDocumento.value||null,scadenza:f.scadenza.value||null,note:f.note.value.trim()||null,
       caricato_da:u.id,caricato_ruolo:u.ruolo,stato:PROF.includes(u.ruolo)?'verificato':'caricato',...meta};
     const {data,error}=await S.sb.from('documenti').insert(row).select('id').single();if(error)throw error;
     if(f.richiestaId.value){await write(S.sb.from('richieste').update({stato:'consegnata',documento_id:data.id,consegnata_il:now()}).eq('id',f.richiestaId.value));evento(imId,`ha consegnato: ${titolo}`)}
     else evento(imId,`ha caricato «${titolo}» in ${SEZN[f.sezione.value]}`);
     reloadSoon();closeModal();toast(f.richiestaId.value?'Pratica consegnata nel fascicolo':'Documento caricato');
   }catch(e){showErr('u-err',errMsg(e));busy(ok)}},
 async scad(f){const id=f.docId.value;try{await write(S.sb.from('documenti').update({scadenza:f.scadenza.value||null}).eq('id',id));evento(S.data.documenti[id]?.immobileId,`ha aggiornato la scadenza di «${S.data.documenti[id]?.titolo}»`);toast('Scadenza salvata')}catch(e){toast(errMsg(e))}},
 async invite(f){const email=f.email.value.trim().toLowerCase(),liv=(f.querySelector('input[name=livello]:checked')||{}).value,
   sez=[...f.querySelectorAll('input[name=sezioni]:checked')].map(c=>c.value);
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){showErr('i-err','Scrivi un\'email valida.');return}
   if(email===myEmail()){showErr('i-err','Hai già accesso a questo fascicolo.');return}
   if(liv==='professionista'&&!sez.length){showErr('i-err','Scegli almeno una sezione.');return}
   if(acc(S.cur,email)){showErr('i-err','Questa persona ha già accesso: revoca l\'accesso attuale per cambiarlo.');return}
   try{await write(S.sb.from('accessi').insert({immobile_id:S.cur,email,livello:liv,sezioni:liv==='professionista'?sez:null,scadenza:liv==='professionista'?(f.scadenza.value||null):null,puo_invitare:liv==='delegato'?!!(f.puoInvitare&&f.puoInvitare.checked):false,invitato_da:S.session.user.id}));
     evento(S.cur,`ha invitato ${ename(email)} come ${LIV[liv]}${liv==='professionista'?' ('+sez.map(s=>SEZN[s]).join(', ')+')':''}`);closeModal();toast(userByEmail(email)?'Accesso concesso':'Invito registrato: vedrà il fascicolo appena si registra')}
   catch(e){showErr('i-err',errMsg(e))}},
 async glink(f){const sez=[...f.querySelectorAll('input[name=sezioni]:checked')].map(c=>c.value),et=f.etichetta.value.trim();
   if(!et||!sez.length){showErr('g-err',!et?'Scrivi per chi è il link.':'Scegli almeno una sezione.');return}
   const id=rid(14),giorni=+f.giorni.value;
   try{await write(S.sb.from('condivisioni').insert({id,immobile_id:S.cur,etichetta:et,sezioni:sez,scadenza:addDays(giorni),creato_da:S.session.user.id}));
     evento(S.cur,`ha creato il link «${et}» (${giorni} giorni)`);closeModal();
     modal('Link creato',`<p class="lead">Invia questo indirizzo a chi deve consultare il fascicolo. Non serve registrarsi.</p><p class="code" style="font-size:14px;word-break:break-all;background:var(--surface-2);padding:12px;border-radius:10px">${esc(guestUrl(id))}</p><p class="muted" style="font-size:14px">Vedrà solo le sezioni scelte fino al ${fmt(addDays(giorni))}. Puoi revocarlo quando vuoi dalla scheda Accessi.</p>`,
       `<button type="button" class="btn btn-s" data-act="gcopy" data-id="${esc(id)}">Copia link</button><button type="button" class="btn btn-p" data-act="close">Fatto</button>`)}
   catch(e){showErr('g-err',errMsg(e))}},
 async newim(f){const u=me(),pro=PROF.includes(u.ruolo);
   if(!f.indirizzo.value.trim()||!f.comune.value.trim()){showErr('n-err','Indirizzo e comune sono obbligatori.');return}
   if(pro&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.titolare.value.trim())){showErr('n-err','Scrivi l\'email del proprietario.');return}
   const b=$('#n-ok');busy(b,'Creazione…');
   const p={tipo:f.tipo.value,indirizzo:f.indirizzo.value.trim(),comune:f.comune.value.trim(),foglio:f.foglio.value.trim(),particella:f.particella.value.trim(),sub:f.sub.value.trim(),categoria:f.categoria.value.trim(),titolare_email:pro?f.titolare.value.trim().toLowerCase():''};
   const {data,error}=await S.sb.rpc('crea_immobile',{p});
   if(error){busy(b);showErr('n-err',errMsg(error));return}
   await loadAll();closeModal();S.cur=data;S.view='fascicolo';S.tab='documenti';render();toast('Fascicolo creato')},
 async req(f){const s=SERVN[f.servizio.value];
   const prof=vals('accessi').filter(x=>x.immobileId===S.cur&&x.livello==='professionista'&&(x.sezioni||[]).includes(s.sez)&&!(x.scadenza&&daysTo(x.scadenza)<0)).map(x=>userByEmail(x.email)).find(u=>u&&u.ruolo===s.r);
   try{await write(S.sb.from('richieste').insert({immobile_id:S.cur,servizio:s.id,sezione:s.sez,ruolo_richiesto:s.r,note:f.note.value.trim()||null,richiesto_da:S.session.user.id,assegnato_a:prof?prof.id:null,stato:prof?'lavorazione':'inviata'}));
     evento(S.cur,`ha richiesto: ${s.n}${prof?' (affidata a '+prof.nome+')':''}`);closeModal();toast(prof?`Richiesta affidata a ${prof.nome}`:'Richiesta inviata ai professionisti partner')}
   catch(e){toast(errMsg(e))}}
};
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.form&&F[f.dataset.form]){e.preventDefault();F[f.dataset.form](f)}});

boot();
