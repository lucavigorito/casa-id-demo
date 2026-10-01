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
const RSTATO={inviata:['In attesa di preventivo','p-warn'],preventivo:['Preventivo da valutare','p-info'],lavorazione:['In lavorazione','p-info'],consegnata:['Consegnata','p-ok'],annullata:['Annullata','p-mute']};
const DSTATO={verificato:['Caricato da professionista','st-ok'],caricato:['Caricato dal proprietario','st-mute'],richiesto:['Da recuperare','st-warn']};
const euro=n=>n==null?'':Number(n).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const TABLES=['profiles','immobili','accessi','documenti','richieste','condivisioni','eventi','passaggi'];
const BUCKET='documenti';

/* ---------- stato ---------- */
let raf=0;
const S={sb:null,state:'boot',session:null,data:Object.fromEntries(TABLES.map(t=>[t,{}])),
  cur:null,view:'home',page:null,tab:'documenti',sez:'tutti',q:'',guest:null,guestData:null,selMode:false,sel:new Set(),pendingCode:null,shareIds:[],guestPreview:false,seen:new Set(),authMode:'login',authMsg:''};

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
 check:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
 key:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
 share:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
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
  if(S.pendingCode&&me()){const c=S.pendingCode;S.pendingCode=null;
    if(PROF.includes(me().ruolo))openScan(true,fmtCode(c));
    else modal('QR code di collegamento','<p>Questo QR code serve ai <b>professionisti</b> (agenzia, broker, tecnico, notaio) per collegarsi al fascicolo di un cliente. Hai effettuato l\'accesso come '+esc(RUOLO[me().ruolo]||'')+'.</p><p class="muted" style="font-size:14px">Se sei un familiare, chiedi al titolare di invitarti dalla scheda Accessi.</p>','<button type="button" class="btn btn-p" data-act="close">Ho capito</button>')}
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
function presenza(imId){const ds=vals('documenti').filter(d=>d.immobileId===imId&&d.stato!=='richiesto');return {n:ds.length,sez:SEZ.filter(s=>ds.some(d=>d.sezione===s.id)).length}}
function prossimaScadenza(imId,a){const ds=docsOf(imId,a).filter(d=>d.scadenza).sort((x,y)=>x.scadenza.localeCompare(y.scadenza));return ds.find(d=>daysTo(d.scadenza)>=0)||ds[ds.length-1]}
function scadPill(iso){const n=daysTo(iso);if(n<0)return `<span class="pill p-crit">Scaduto</span>`;if(n<=90)return `<span class="pill p-warn">Tra ${n} giorni</span>`;return `<span class="pill p-ok">In regola</span>`}
function incarichiMiei(){const u=me();if(!u||!PROF.includes(u.ruolo))return[];return vals('richieste').filter(r=>!['consegnata','annullata'].includes(r.stato)&&(r.assegnatoA===u.id||(!r.assegnatoA&&r.ruoloRichiesto===u.ruolo))).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))}
function badge(ruolo){return ruolo?`<span class="pill r-${esc(ruolo)}">${esc(RUOLO_BREVE[ruolo]||ruolo)}</span>`:''}

/* ---------- avvio ---------- */
function parseHash(){const m=/^#g([a-z0-9]{8,32})$/.exec(location.hash||'');if(m){S.guest=m[1];S.guestPreview=false;S.guestData=null;loadGuest()}}
async function boot(){
  const cfg=window.CASAID_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||/INCOLLA/.test(cfg.SUPABASE_URL)){S.state='config';render();return}
  S.sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  parseHash();
  try{const g=new URLSearchParams(location.search).get('guida');if(g!==null){S.page='guida';S.guida=g==='professionista'?'professionista':'proprietario'}}catch(e){}
  try{const c=normCode(new URLSearchParams(location.search).get('collega'));if(c){S.pendingCode=c;history.replaceState(null,'',location.pathname+location.hash)}}catch(e){}
  const {data:{session}}=await S.sb.auth.getSession();
  S.session=session;S.state=session?'loading':'auth';render();
  if(session)startData();
  S.sb.auth.onAuthStateChange((ev,sess)=>{
    const had=!!S.session;S.session=sess;
    if(sess&&!had){if(S.page==='accedi')S.page=null;S.state='loading';render();startData()}
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
  else if(S.page==='guida')h=guideView();
  else if(S.page==='faq')h=faqView();
  else if(S.page==='esempio')h=esempioView();
  else if(S.state==='auth')h=(S.page==='accedi'||S.pendingCode)?authView():landingView();
  else if(S.state==='loading'||!me())h=loading('Carico i tuoi fascicoli…');
  else h=shell();
  $('#app').innerHTML=h;
  if(fid){const el=document.getElementById(fid);if(el){el.focus();try{if(sel!=null)el.setSelectionRange(sel,sel)}catch(e){}}}
}
function barHtml(right=''){return `<header class="bar"><div class="bar-in"><button class="brand" data-act="home" aria-label="Casa ID, torna alla home">${LOGO()}<span><b>Casa ID</b><small>Carta d'Identità dell'Immobile</small></span></button><span class="test-pill">Versione demo</span><span class="bar-sp"></span><button class="btn-bar" style="border-color:transparent" data-act="page" data-id="faq">Domande frequenti</button>${right}</div></header>`}
function loading(t){return barHtml()+`<main class="wrap"><div class="card empty"><p class="lead">${esc(t)}</p></div></main>`}
function configView(){return barHtml()+`<main class="wrap"><div class="card empty"><h2>Configurazione mancante</h2><p class="lead">Inserisci in <b class="code">config.js</b> l'indirizzo del progetto Supabase e la chiave pubblica, poi ricarica la pagina.</p></div></main>`}

/* accesso e registrazione */
function authView(){
  const reg=S.authMode==='register';
  return barHtml(`<button class="btn-bar" data-act="page" data-id="">Torna alla home</button>`)+`<main class="wrap"><div class="login">
  <section><p class="eyebrow">Casa ID · versione demo</p><h1>I documenti della tua casa, organizzati e pronti da condividere</h1>
   <p class="lead">Casa ID riunisce il fascicolo del tuo immobile. I professionisti caricano i documenti prodotti per te; tu li ritrovi e decidi con chi condividerli e per quanto tempo.</p>
   <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px"><button type="button" class="btn btn-p" data-act="page" data-id="esempio">${I.eye} Guarda un fascicolo di esempio</button><button type="button" class="btn btn-s" data-act="page" data-id="faq">Domande frequenti</button></div>
   <h2 style="font-size:18px;margin:28px 0 10px">Come si costruisce il tuo fascicolo</h2>
   <div class="card list">
    <div class="person" style="grid-template-columns:minmax(0,1fr)"><div><b>1 · Attivi il fascicolo</b><p class="muted" style="font-size:14px">Tu ti registri e inserisci l'immobile. Il fascicolo nasce vuoto, a tuo nome.</p></div></div>
    <div class="person" style="grid-template-columns:minmax(0,1fr)"><div><b>2 · Raccogli i documenti che hai già</b><p class="muted" style="font-size:14px">Li carichi tu, oppure inviti agenzia, tecnico e notaio a caricare quelli che hanno prodotto per te. Se non aderiscono, puoi caricare tu quelli che ti hanno consegnato.</p></div></div>
    <div class="person" style="grid-template-columns:minmax(0,1fr)"><div><b>3 · Recuperi quelli che mancano, se vuoi</b><p class="muted" style="font-size:14px">Richiedi la pratica (visura, accesso agli atti, APE…) a un professionista: ricevi un preventivo con il costo totale e decidi se procedere.</p></div></div>
   </div>
   <div class="note" style="margin-top:16px">Versione dimostrativa: accesso con email e password (nella versione definitiva SPID o CIE). Usa solo documenti di prova.</div></section>
  <form class="card form" data-form="${reg?'register':'login'}" autocomplete="on">
   <div class="tools" style="margin:0"><button type="button" class="chip" data-act="auth-mode" data-id="login" aria-pressed="${!reg}">Accedi</button><button type="button" class="chip" data-act="auth-mode" data-id="register" aria-pressed="${reg}">Registrati</button></div>
   ${reg?`<div class="fld"><label for="a-nome">Nome e cognome</label><input id="a-nome" name="nome" required autocomplete="name"></div>
   <div class="fgrid"><div class="fld"><label for="a-ruolo">Ruolo</label><select id="a-ruolo" name="ruolo">${Object.entries(RUOLO).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
   <div class="fld"><label for="a-studio">Studio o società (facoltativo)</label><input id="a-studio" name="studio" autocomplete="organization"></div></div>`:''}
   <div class="fld"><label for="a-email">Email</label><input id="a-email" name="email" type="email" required autocomplete="email"></div>
   <div class="fld"><label for="a-pwd">Password</label><input id="a-pwd" name="pwd" type="password" required minlength="6" autocomplete="${reg?'new-password':'current-password'}"></div>
   ${S.pendingCode?`<div class="note">${I.qr} Hai inquadrato un QR code di collegamento (<b class="code">${fmtCode(S.pendingCode)}</b>). Accedi o registrati come professionista: ti colleghiamo subito al fascicolo.</div>`:''}
   <p class="err" id="a-err" ${S.authMsg?'':'hidden'}>${esc(S.authMsg)}</p>
   <button class="btn btn-p" type="submit" id="a-ok">${reg?'Crea profilo':'Accedi'}</button>
   ${reg?'<p class="muted" style="font-size:13px">Se sei stato invitato in un fascicolo, registrati con la stessa email dell\'invito: lo troverai subito.</p>':''}
  </form></div></main>`;
}
function shell(){
  const u=me(),ims=myImmobili(),pro=PROF.includes(u.ruolo);
  if(S.cur&&!acc(S.cur))S.cur=null;
  const inc=incarichiMiei();
  const side=`<nav class="side" aria-label="Fascicoli">
    ${pro?`<button class="btn btn-p side-scan" data-act="scan">${I.qr} Collega con QR</button>`:''}
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
  const cards=ims.map(i=>{const a=acc(i.id),c=presenza(i.id),p=prossimaScadenza(i.id,a);return `<button class="card im-card" data-act="open" data-id="${esc(i.id)}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="code muted">${esc(i.codice)}</span><span class="pill p-mute">${esc(LIV[a.livello])}</span></div>
    <h3>${esc(i.tipo)} · ${esc(i.indirizzo)}</h3><p class="muted">${esc(i.comune||'')}${i.categoria?' · Cat. '+esc(i.categoria):''}</p>
    <div class="im-pct"><span>Lista di base <b class="num">${lista(i.id).pct}%</b></span>${pctBar(lista(i.id).pct)}<small class="muted">${c.n} documenti nel fascicolo</small></div>
    <p style="font-size:13px">${p?`${esc(p.titolo)}: <span class="${daysTo(p.scadenza)<0?'st-crit':daysTo(p.scadenza)<=90?'st-warn':'st-ok'}">scade il ${fmt(p.scadenza)}</span>`:'<span class="muted">Nessuna scadenza</span>'}</p>
    ${i.esempio?'<span class="pill p-info" style="align-self:flex-start">Dati di esempio</span>':''}</button>`}).join('');
  const inc=incarichiMiei();
  const nome=(u.nome||'').split(' ').filter(w=>!/\./.test(w)&&w!=='Notaio')[0]||u.nome;
  return `${passaggiInArrivo()}<div class="hello"><p class="eyebrow">${esc(RUOLO[u.ruolo]||'')}</p><h1>Ciao, ${esc(nome)}</h1>
  <p class="lead">${pro?'Qui trovi i fascicoli dei clienti a cui hai accesso e gli incarichi arrivati dai servizi in app.':'Qui trovi i fascicoli dei tuoi immobili, con i documenti caricati dai professionisti.'}</p></div>
  ${pro?proCta():''}
  ${cards?`<div class="grid-im">${cards}</div>`:`<div class="card empty"><h2>Nessun fascicolo ancora</h2><p class="lead">${pro?'Crea il fascicolo per un cliente indicando la sua email, oppure attendi che un proprietario ti inviti.':'Aggiungi il tuo immobile, oppure crea un fascicolo di esempio già compilato per vedere come funziona.'}</p>
   <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button class="btn btn-p" data-act="new-im">${I.plus} ${pro?'Nuovo fascicolo':'Aggiungi immobile'}</button>${pro?'':`<button class="btn btn-s" data-act="esempio">Crea un fascicolo di esempio</button>`}</div></div>`}
  ${cards&&!pro?`<p style="margin-top:16px"><button class="btn btn-g btn-sm" data-act="esempio">+ Crea un altro fascicolo di esempio</button></p>`:''}
  ${pro&&inc.length?`<h2 class="section-t">Incarichi da gestire</h2><div class="card list">${inc.slice(0,3).map(incRow).join('')}</div>`:''}`;
}

/* fascicolo */
function fascicolo(){
  const i=S.data.immobili[S.cur];if(!i)return home();
  const a=acc(i.id),c=presenza(i.id),own=isOwnerLike(a);
  if(!S.seen.has(i.id)){S.seen.add(i.id);evento(i.id,'ha aperto il fascicolo')}
  const tabs=[['documenti','Documenti'],['scadenze','Scadenze'],...(own?[['servizi','Servizi'],['accessi','Accessi'],['registro','Registro accessi']]:[])];
  if(!tabs.some(t=>t[0]===S.tab))S.tab='documenti';
  const cat=[i.foglio&&'Fg. '+i.foglio,i.particella&&'Part. '+i.particella,i.sub&&'Sub. '+i.sub,i.categoria&&'Cat. '+i.categoria].filter(Boolean).join(' · ');
  const body={documenti:tabDocumenti,scadenze:tabScadenze,servizi:tabServizi,accessi:tabAccessi,registro:tabRegistro}[S.tab](i,a);
  return `<section class="card fhead">
    <div class="t"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="eyebrow">Fascicolo immobile</span><span class="pill p-info code">${esc(i.codice)}</span>${i.esempio?'<span class="pill p-mute">Dati di esempio</span>':''}</div>
      <h1>${esc(i.tipo)} · ${esc(i.indirizzo)}</h1><p class="muted">${esc(i.comune||'')}${cat?' · '+esc(cat):''}</p>
      <p style="font-size:14px">Il tuo ruolo: <b>${esc(LIV[a.livello])}</b>${a.livello==='professionista'?' · sezioni: '+esc((a.sezioni||[]).map(s=>SEZN[s]).join(', '))+(a.scadenza?' · fino al '+fmt(a.scadenza):''):''}</p>
      <div class="acts"><button class="btn btn-p" data-act="upload">${I.up} Carica documento</button><button class="btn btn-s" data-act="qr">${I.qr} ${canInvite(a)?'Codice e QR':'Codice'}</button>${own?`<button class="btn btn-s" data-act="export">Scarica fascicolo</button>`:''}${canInvite(a)?`<button class="btn btn-s" data-act="invite">${I.plus} Invita</button>`:''}</div></div>
    ${compBlock(i,c,lista(i.id),own)}
  </section>
  <div class="tabs" role="tablist">${tabs.map(([k,n])=>`<button class="tab" role="tab" aria-selected="${S.tab===k}" data-act="tab" data-id="${k}">${n}</button>`).join('')}</div>
  ${body}`;
}
function docRow(d){
  const st=DSTATO[d.stato]||DSTATO.caricato;
  if(S.selMode){const can=!!d.filePath,on=S.sel.has(d.id);return `<button class="row pick${on?' on':''}" data-act="pick" data-id="${esc(d.id)}" aria-pressed="${on}" ${can?'':'disabled'}><span class="cbx">${on?I.check:''}</span>
   <span style="min-width:0"><b>${esc(d.titolo)}</b><small>${esc(SEZN[d.sezione])} · ${d.dataDocumento?'del '+fmt(d.dataDocumento):'senza data'}${can?'':' · nessun file da condividere'}</small></span><span></span><span></span></button>`}
  return `<button class="row" data-act="${d.filePath?'view':'doc'}" data-id="${esc(d.id)}"><span class="ico ico-${esc(d.sezione)}">${I.file}</span>
   <span style="min-width:0"><b>${esc(d.titolo)}</b><small>${esc(SEZN[d.sezione])} · ${d.dataDocumento?'del '+fmt(d.dataDocumento):'senza data'}${d.fileName?' · '+esc(d.fileName):d.stato==='richiesto'?'':' · nessun file'}</small></span>
   <span class="rb">${badge(d.caricatoRuolo||user(d.caricatoDa)?.ruolo)}</span>
   <span class="right"><span class="${st[1]}" style="font-weight:700">${st[0]}</span>${d.scadenza?`<span class="muted">scade ${fmt(d.scadenza)}</span>`:''}</span></button>`;
}
function tabDocumenti(i,a){
  const all=docsOf(i.id,a),allow=sezOf(a),q=S.q.trim().toLowerCase();
  const ds=all.filter(d=>(S.sez==='tutti'||d.sezione===S.sez)&&(!q||(d.titolo+' '+(d.note||'')+' '+(d.fileName||'')).toLowerCase().includes(q)))
    .sort((x,y)=>(y.dataDocumento||y.createdAt||'').localeCompare(x.dataDocumento||x.createdAt||''));
  const chips=[['tutti','Tutti',all.length],...SEZ.filter(s=>allow.includes(s.id)).map(s=>[s.id,s.n,all.filter(d=>d.sezione===s.id).length])];
  return `<div class="tools">${chips.map(([k,n,c])=>`<button class="chip" data-act="sez" data-id="${k}" aria-pressed="${S.sez===k}">${esc(n)} <span class="num muted">${c}</span></button>`).join('')}</div>
  <div class="tools"><label class="search" for="q">${I.search}<input id="q" type="search" placeholder="Cerca un documento" value="${esc(S.q)}" aria-label="Cerca un documento"></label>${canInvite(a)&&all.some(d=>d.filePath)?`<button class="btn btn-s btn-sm" data-act="selmode" aria-pressed="${S.selMode}">${S.selMode?'Fine selezione':I.share+' Seleziona e condividi'}</button>`:''}</div>
  <p class="muted" style="font-size:13px;margin:-4px 0 12px">Lo stato indica chi ha caricato il documento e quando. Casa ID non certifica contenuto, aggiornamento o conformità dei documenti.</p>
  ${S.selMode?`<p class="note" style="margin-bottom:12px">Tocca i documenti da condividere, poi crea un unico link.</p>`:''}
  <div class="card list">${ds.map(docRow).join('')||`<div class="empty"><p class="lead">${all.length?'Nessun documento corrisponde alla ricerca.':'Ancora nessun documento in questo fascicolo.'}</p><button class="btn btn-p" data-act="upload">${I.up} Carica il primo documento</button></div>`}</div>
  ${S.selMode?`<div class="selbar" role="region" aria-label="Selezione"><span><b class="num">${S.sel.size}</b> ${S.sel.size===1?'documento selezionato':'documenti selezionati'}</span><span class="sp"></span><button class="btn btn-g btn-sm" data-act="selall">${ds.filter(d=>d.filePath).every(d=>S.sel.has(d.id))&&S.sel.size?'Deseleziona tutti':'Seleziona tutti'}</button><button class="btn btn-p btn-sm" data-act="share" ${S.sel.size?'':'disabled'}>${I.share} Condividi</button></div>`:''}`;
}
function tabScadenze(i,a){
  const ds=docsOf(i.id,a).filter(d=>d.scadenza).sort((x,y)=>x.scadenza.localeCompare(y.scadenza));
  return `<div class="card list">${ds.map(d=>{const [y,m]=d.scadenza.split('-');return `<div class="deadline"><div class="d"><span>${MESI[+m-1]}</span><b class="num">${y}</b></div><div style="min-width:0"><b>${esc(d.titolo)}</b><p class="muted" style="font-size:13px">${esc(SEZN[d.sezione])} · scade il ${fmt(d.scadenza)}</p></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${scadPill(d.scadenza)}<button class="btn btn-g btn-sm" data-act="doc" data-id="${esc(d.id)}">Apri</button></div></div>`}).join('')||'<div class="empty"><p class="lead">Nessuna scadenza inserita. Quando carichi un documento con una data di scadenza (APE, controllo caldaia, contratto) la trovi qui.</p></div>'}</div>
  <p class="muted" style="font-size:13px;margin-top:12px">Qui compaiono solo le scadenze inserite nei documenti del fascicolo, da chi li carica o da te. Casa ID non verifica gli adempimenti. In questa demo gli avvisi non vengono inviati: nella versione definitiva arriveranno per email.</p>`;
}
function tabServizi(i,a){
  const rs=vals('richieste').filter(r=>r.immobileId===i.id).sort((x,y)=>(y.createdAt||'').localeCompare(x.createdAt||''));
  const own=isOwnerLike(a);
  return `<p class="lead" style="margin-bottom:6px">Richiedi a un professionista una pratica per recuperare o aggiornare un documento.</p>
  <p class="muted" style="font-size:14px;margin-bottom:16px">Ricevi un preventivo con il costo totale (compenso del professionista e oneri degli enti) e decidi se accettare. Nessun costo prima della tua conferma. Il documento consegnato arriva nel fascicolo.</p>
  <div class="svc">${SERV.map(s=>`<div class="card"><h3>${esc(s.n)}</h3><p class="muted" style="font-size:14px">${esc(s.d)}</p><p class="muted" style="font-size:13px">Esegue: ${esc(RUOLO[s.r])}${s.id==='ape'?' · richiede un sopralluogo':''}</p><button class="btn btn-s btn-sm" style="align-self:flex-start" data-act="req" data-id="${s.id}">Chiedi un preventivo</button></div>`).join('')}</div>
  <h2 class="section-t">Richieste per questo immobile</h2>
  <div class="card list">${rs.map(r=>{const s=SERVN[r.servizio]||{n:r.servizio},st=RSTATO[r.stato]||['',''];
    const acts=own&&r.stato==='preventivo'?`<button class="btn btn-p btn-sm" data-act="qok" data-id="${esc(r.id)}">Accetta</button><button class="btn btn-g btn-sm" data-act="qno" data-id="${esc(r.id)}">Rifiuta</button>`:'';
    const canc=own&&['inviata','preventivo'].includes(r.stato)?`<button class="btn btn-g btn-sm" data-act="qcancel" data-id="${esc(r.id)}">Annulla</button>`:'';
    return `<div class="person req"><div style="min-width:0"><b>${esc(s.n)}</b> <span class="pill ${st[1]}">${st[0]}</span>
      <p class="muted" style="font-size:13px">Richiesta da ${esc(uname(r.richiestoDa))} il ${fmt(r.createdAt)}${r.assegnatoA?' · '+esc(uname(r.assegnatoA)):''}${r.note?' · «'+esc(r.note)+'»':''}</p>
      ${r.preventivoImporto!=null&&r.stato!=='inviata'?`<p style="font-size:14px;margin-top:4px">Preventivo: <b>${euro(r.preventivoImporto)}</b> totali${r.preventivoNote?' · '+esc(r.preventivoNote):''}</p>`:''}</div>
      <div class="req-acts">${acts}${canc}</div></div>`}).join('')||'<div class="empty"><p class="lead">Nessuna richiesta finora.</p></div>'}</div>`;
}
function tabAccessi(i,a){
  const order=['titolare','delegato','professionista'];
  const ps=vals('accessi').filter(x=>x.immobileId===i.id).sort((x,y)=>order.indexOf(x.livello)-order.indexOf(y.livello));
  const links=vals('condivisioni').filter(l=>l.immobileId===i.id&&l.attivo!==false).sort((x,y)=>(y.createdAt||'').localeCompare(x.createdAt||''));
  const row=p=>{const u=userByEmail(p.email),ru=u?.ruolo||'proprietario',scad=p.scadenza&&daysTo(p.scadenza)<0;
    const canRev=p.livello!=='titolare'&&p.email!==myEmail()&&(a.livello==='titolare'||(canInvite(a)&&p.invitatoDa===S.session.user.id));
    return `<div class="person"><span class="av r-${esc(ru)}">${esc(ini(u?.nome||p.email))}</span><div style="min-width:0"><b>${esc(u?.nome||p.email)}</b> ${u?badge(u.ruolo):'<span class="pill p-warn">Invito in attesa</span>'}<p class="muted" style="font-size:13px">${esc(p.email)} · ${esc(LIV[p.livello])}${p.livello==='professionista'?' · '+esc((p.sezioni||[]).map(s=>SEZN[s]).join(', ')):p.livello==='delegato'?(p.puoInvitare?' · può invitare professionisti':''):''}${p.scadenza?` · <span class="${scad?'st-crit':''}">${scad?'scaduto il':'fino al'} ${fmt(p.scadenza)}</span>`:''}${p.invitatoDa&&p.livello!=='titolare'?' · invitato da '+esc(uname(p.invitatoDa)):''}</p></div>${canRev?`<button class="btn btn-g btn-sm" data-act="revoke" data-id="${esc(p.id)}">Revoca</button>`:''}</div>`};
  const pending=ps.some(p=>!userByEmail(p.email));
  return `${pending?'<div class="note" style="margin-bottom:16px">Chi ha un invito in attesa vedrà il fascicolo appena si registra con quella email. Se un professionista non usa Casa ID, puoi caricare tu i documenti che ti ha consegnato.</div>':''}<div class="two"><section class="card"><div class="box-h"><h3>Persone con accesso</h3>${canInvite(a)?`<button class="btn btn-p btn-sm" data-act="invite">${I.plus} Invita</button>`:''}</div><div class="list">${ps.map(row).join('')}</div></section>
  <section class="card"><div class="box-h"><h3>Link di sola lettura</h3>${canInvite(a)?`<button class="btn btn-s btn-sm" data-act="glink">${I.link} Crea link</button>`:''}</div><div class="list">${links.map(l=>{const exp=daysTo(l.scadenza)<0;return `<div class="person" style="grid-template-columns:minmax(0,1fr)"><div style="min-width:0"><b>${esc(l.etichetta)}</b><p class="muted" style="font-size:13px">${esc(l.documenti&&l.documenti.length?(l.documenti.length===1?'Documento: '+(S.data.documenti[l.documenti[0]]?.titolo||'1 documento'):l.documenti.length+' documenti scelti'):(l.sezioni||[]).map(s=>SEZN[s]).join(', '))} · <span class="${exp?'st-crit':''}">${exp?'scaduto':'scade'} il ${fmt(l.scadenza)}</span></p></div><div style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn btn-g btn-sm" data-act="gcopy" data-id="${esc(l.id)}">Copia link</button><button class="btn btn-g btn-sm" data-act="gprev" data-id="${esc(l.id)}">Anteprima</button>${canInvite(a)?`<button class="btn btn-g btn-sm" data-act="grevoke" data-id="${esc(l.id)}">Revoca</button>`:''}</div></div>`}).join('')||'<div class="empty"><p class="muted">Crea un link per la banca, l\'acquirente o l\'inquilino: vedono solo le sezioni che scegli, fino alla data che decidi, senza bisogno di registrarsi. Per singoli documenti usa «Condividi» dal documento o la selezione nella scheda Documenti.</p></div>'}</div></section></div>${passaggioBox(i,a)}`;
}
function tabRegistro(i){
  const evs=vals('eventi').filter(e=>e.immobileId===i.id).sort((x,y)=>(y.ts||'').localeCompare(x.ts||''));
  return `<div class="card list">${evs.map(e=>`<div class="ev"><span class="muted num">${fmtT(e.ts)}</span><span><b>${esc(e.attore||uname(e.userId))}</b> ${esc(e.azione)}</span></div>`).join('')||'<div class="empty"><p class="lead">Nessuna attività registrata.</p></div>'}</div>
  <p class="muted" style="font-size:13px;margin-top:12px">Ogni apertura del fascicolo, consultazione, caricamento e modifica degli accessi viene registrata qui.</p>`;
}

/* incarichi */
function incRow(r){const s=SERVN[r.servizio]||{n:r.servizio},im=S.data.immobili[r.immobileId],st=RSTATO[r.stato]||['',''],mine=r.assegnatoA===S.session.user.id;
  const act=r.stato==='lavorazione'&&mine?`<button class="btn btn-p btn-sm" data-act="deliver" data-id="${esc(r.id)}">${I.up} Consegna</button>`
    :r.stato==='preventivo'&&mine?`<button class="btn btn-s btn-sm" data-act="quote" data-id="${esc(r.id)}">Modifica preventivo</button>`
    :`<button class="btn btn-p btn-sm" data-act="quote" data-id="${esc(r.id)}">Invia preventivo</button>`;
  return `<div class="person req"><div style="min-width:0"><b>${esc(s.n)}</b> <span class="pill ${st[1]}">${r.stato==='preventivo'&&mine?'In attesa del cliente':st[0]}</span><p class="muted" style="font-size:13px">${im?esc(im.tipo+' · '+im.indirizzo+', '+(im.comune||'')):'Immobile di un cliente: l\'indirizzo è visibile dopo l\'accettazione'} · richiesta il ${fmt(r.createdAt)}${r.note?' · «'+esc(r.note)+'»':''}</p>${r.preventivoImporto!=null&&mine?`<p style="font-size:14px">Tuo preventivo: <b>${euro(r.preventivoImporto)}</b></p>`:''}</div>
  <div class="req-acts">${act}</div></div>`}
function incarichiView(){const inc=incarichiMiei(),done=vals('richieste').filter(r=>r.assegnatoA===S.session.user.id&&r.stato==='consegnata');
  return `<div class="hello"><p class="eyebrow">Servizi in app</p><h1>Incarichi dai servizi</h1><p class="lead">Richieste dei proprietari per la tua categoria. Invia un preventivo con il costo totale; se il cliente accetta, ricevi l'accesso alla sezione che serve e consegni il documento nel suo fascicolo.</p></div>
  <div class="card list">${inc.map(incRow).join('')||'<div class="empty"><p class="lead">Nessun incarico da gestire in questo momento.</p></div>'}</div>
  ${done.length?`<h2 class="section-t">Consegnati</h2><div class="card list">${done.map(r=>`<div class="person req"><div><b>${esc(SERVN[r.servizio]?.n||r.servizio)}</b><p class="muted" style="font-size:13px">${esc(S.data.immobili[r.immobileId]?.indirizzo||'')} · consegnato il ${fmt(r.consegnataIl)}${r.preventivoImporto!=null?' · '+euro(r.preventivoImporto):''}</p></div><span class="pill p-ok">Consegnata</span></div>`).join('')}</div>`:''}`}
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
function closeModal(){stopQ();$('#modal').hidden=true;$('#modal').innerHTML='';V.doc=null}
const secCheckboxes=(name,allowed,checked)=>`<div class="checks">${SEZ.filter(s=>allowed.includes(s.id)).map(s=>`<label><input type="checkbox" name="${name}" value="${s.id}" ${checked.includes(s.id)?'checked':''}> ${esc(s.n)}</label>`).join('')}</div>`;

function openUpload(opts={}){
  const imId=opts.immobileId||S.cur,a=acc(imId),allow=opts.sezione?[opts.sezione]:sezOf(a);
  if(opts.voce&&VOCIN[opts.voce]){opts.titolo=opts.titolo||VOCIN[opts.voce].n}
  modal(opts.richiestaId?'Consegna della pratica':'Carica documento',`
   ${opts.richiestaId?`<div class="note">Stai consegnando: <b>${esc(SERVN[opts.servizio]?.n||'')}</b>. Il documento andrà nel fascicolo del cliente, sezione ${esc(SEZN[allow[0]])}.</div>`:''}
   <input type="hidden" name="richiestaId" value="${esc(opts.richiestaId||'')}"><input type="hidden" name="immobileId" value="${esc(imId)}">
   <div class="fld"><label for="u-titolo">Titolo del documento</label><input id="u-titolo" name="titolo" required value="${esc(opts.titolo||'')}" placeholder="Es. Attestato di prestazione energetica"></div>
   <div class="fgrid"><div class="fld"><label for="u-sez">Sezione</label><select id="u-sez" name="sezione">${SEZ.filter(s=>allow.includes(s.id)).map(s=>`<option value="${s.id}">${esc(s.n)}</option>`).join('')}</select></div>
   <div class="fld"><label for="u-data">Data del documento</label><input id="u-data" name="dataDocumento" type="date" value="${today()}"></div>
   <div class="fld"><label for="u-scad">Scadenza (facoltativa)</label><input id="u-scad" name="scadenza" type="date"></div></div>
   <div class="fld"><label for="u-voce">Tipo per la lista di base</label><select id="u-voce" name="voce"><option value="">Altro documento</option>${VOCI.map(v=>`<option value="${v.id}" ${opts.voce===v.id?'selected':''}>${esc(v.n)}</option>`).join('')}</select><span class="muted" style="font-size:13px">Serve a calcolare la percentuale della lista di base.</span></div>
   <div class="fld"><label for="u-file">File</label><input id="u-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"><span class="muted" style="font-size:13px">PDF o immagine, fino a 20 MB. Usa solo documenti di prova.</span></div>
   <div class="fld"><label for="u-note">Note (facoltative)</label><textarea id="u-note" name="note" placeholder="Es. protocollo, riferimento pratica"></textarea></div>
   <p class="err" id="u-err" hidden></p>`,
   `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p" id="u-ok">${I.up} ${opts.richiestaId?'Consegna':'Carica'}</button>`,'upload');
  const t=$('#u-titolo'),vs=$('#u-voce'),ss=$('#u-sez');let touched=!!opts.voce;
  if(opts.voce&&VOCIN[opts.voce]&&ss&&allow.includes(VOCIN[opts.voce].sez))ss.value=VOCIN[opts.voce].sez;
  vs.addEventListener('change',()=>{touched=true;const v=VOCIN[vs.value];if(v&&ss&&allow.includes(v.sez))ss.value=v.sez});
  t.addEventListener('input',()=>{if(touched)return;const v=VOCI.find(x=>x.re.test(t.value));vs.value=v?v.id:'';if(v&&ss&&allow.includes(v.sez))ss.value=v.sez});
}
function openDoc(id){
  const d=S.data.documenti[id];if(!d)return;const a=acc(d.immobileId);
  const canDel=a&&(a.livello==='titolare'||d.caricatoDa===S.session.user.id);
  if(!S.seen.has('d'+id)){S.seen.add('d'+id);evento(d.immobileId,`ha consultato «${d.titolo}»`)}
  modal(d.titolo,`
   ${d.filePath?`<button type="button" class="btn btn-p" style="align-self:flex-start" data-act="view" data-id="${esc(id)}">${I.eye} Visualizza documento</button>`:''}
   <dl class="kv"><dt>Sezione</dt><dd>${esc(SEZN[d.sezione])}</dd><dt>Caricato da</dt><dd>${esc(uname(d.caricatoDa))} ${badge(d.caricatoRuolo)}</dd>
   <dt>Data documento</dt><dd>${fmt(d.dataDocumento)}</dd><dt>Caricato il</dt><dd>${fmtT(d.createdAt)}</dd>
   <dt>Stato</dt><dd>${(DSTATO[d.stato]||DSTATO.caricato)[0]}<br><span class="muted" style="font-size:13px">Indica chi ha caricato il documento. Casa ID non ne certifica contenuto o conformità.</span></dd>
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
  modal('Preventivo: '+s.n,`<p class="lead">${esc(s.d)}.</p><div class="note">Un ${esc((RUOLO[s.r]||'').toLowerCase())} ti invierà un preventivo con il <b>costo totale</b>: compenso, eventuali sopralluoghi e oneri degli enti. Decidi tu se accettare; nessun costo prima della conferma. Nella demo non avviene alcun pagamento.</div>
   <input type="hidden" name="servizio" value="${esc(sid)}"><div class="fld"><label for="r-note">Cosa ti serve (facoltativo)</label><textarea id="r-note" name="note" placeholder="Es. mi serve entro fine mese per il mutuo"></textarea></div>`,
   `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p">Chiedi il preventivo</button>`,'req');
}
function openQuote(rid){
  const r=S.data.richieste[rid];if(!r)return;const s=SERVN[r.servizio]||{n:r.servizio};
  modal('Preventivo: '+s.n,`<p class="muted">${r.note?'Richiesta del cliente: «'+esc(r.note)+'»':'Il cliente non ha aggiunto note.'}</p>
   <input type="hidden" name="rid" value="${esc(rid)}">
   <div class="fld"><label for="q-imp">Importo totale (€)</label><input id="q-imp" name="importo" type="number" min="0" step="0.01" required value="${r.preventivoImporto??''}" inputmode="decimal"><span class="muted" style="font-size:13px">Comprendi compenso, sopralluoghi e oneri degli enti: è la cifra che il cliente vede prima di accettare.</span></div>
   <div class="fld"><label for="q-note">Dettaglio (facoltativo)</label><textarea id="q-note" name="note" placeholder="Es. compenso 120 € + diritti di segreteria 30 €; consegna in 10 giorni lavorativi">${esc(r.preventivoNote||'')}</textarea></div>
   <p class="err" id="q-err" hidden></p>`,
   `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p" id="q-ok">Invia preventivo</button>`,'quote');
}
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
   `${S.guest?'':`<button type="button" class="btn btn-g" data-act="doc" data-id="${esc(id)}" style="margin-right:auto">Dettagli</button>`}${!S.guest&&canInvite(acc(d.immobileId))?`<button type="button" class="btn btn-s" data-act="share" data-id="${esc(id)}">${I.share} Condividi</button>`:''}<button type="button" class="btn btn-s" data-act="dl" data-id="${esc(id)}">Scarica</button><button type="button" class="btn btn-p" data-act="close">Chiudi</button>`,'',true);
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


/* ---------- pagine informative ---------- */
const FAQ=[
 ['Cos\'è e come si inizia',[
  ['Cos\'è Casa ID?','È il fascicolo digitale del tuo immobile: i documenti della casa divisi in sei sezioni (proprietà e atti, catasto, urbanistica, impianti ed energia, condominio, contratti), caricati da te e dai professionisti che inviti. Li ritrovi da telefono o computer e decidi tu con chi condividerli e per quanto tempo.'],
  ['In cosa è diverso da una cartella su Drive o Dropbox?','È organizzato per immobile e per sezione; i professionisti caricano direttamente nel tuo fascicolo; gli accessi si concedono per sezione e con una scadenza; ogni consultazione resta nel registro; le scadenze dei documenti sono raccolte in un\'unica lista.'],
  ['Devo caricare tutto io?','No. Puoi invitare agenzia, tecnico e notaio a caricare i documenti che hanno prodotto per te. Puoi aggiungere anche quelli che hai già in casa. Casa ID non raccoglie i documenti al posto tuo.'],
  ['E se il mio professionista non usa Casa ID?','Lo inviti con la sua email: l\'invito resta in attesa finché non si registra con quell\'indirizzo, e vedrà solo le sezioni che hai scelto. Non possiamo garantire che aderisca: nel frattempo puoi caricare tu i documenti che ti ha consegnato.'],
  ['Posso gestire più immobili?','Sì. Ogni immobile ha il suo fascicolo, con documenti e accessi separati.']]],
 ['Documenti e attendibilità',[
  ['Casa ID verifica i documenti?','No. Ogni documento mostra chi l\'ha caricato e quando. Contenuto, aggiornamento e conformità restano responsabilità di chi li ha prodotti. «Caricato da professionista» indica chi ha caricato il file, non una verifica tecnica.'],
  ['Cosa indica la percentuale?','Quanti documenti della lista di base di Casa ID sono presenti: atto di provenienza, visura, planimetria, titolo edilizio, conformità urbanistica, agibilità, APE, conformità degli impianti, libretto d\'impianto, regolamento di condominio. Il titolare può segnare una voce come non applicabile. È un riferimento: non dice se il fascicolo basta per una vendita, un mutuo o una pratica, né se i documenti sono corretti.'],
  ['Come recupero un documento che manca?','Dalla scheda Servizi chiedi un preventivo (visura, ispezione ipotecaria, accesso agli atti, APE, CDU, copia di atto). Il professionista indica costo totale e tempi; si procede solo se accetti. I tempi dipendono anche dagli enti.'],
  ['Banca e notaio accettano il fascicolo?','Puoi mandare loro un link di sola lettura alle sezioni utili. Non esistono accordi con banche o notai: se e come useranno i documenti va concordato con loro.'],
  ['Il codice Casa ID ha valore ufficiale?','No. Identifica il fascicolo dentro Casa ID. Non è un dato catastale e non sostituisce visure o atti.']]],
 ['Accessi e privacy',[
  ['Chi può vedere i miei documenti?','Solo le persone che inviti, nelle sezioni e fino alla data che scegli, e chi apre un link di sola lettura che hai creato, finché non scade o lo revochi. Registrarsi su Casa ID non dà accesso ai fascicoli degli altri.'],
  ['Che differenza c\'è tra titolare, delegato e professionista?','Il titolare gestisce tutto. Il delegato (per esempio un familiare) vede tutto e, se lo consenti, può invitare professionisti. Il professionista vede e carica solo nelle sezioni indicate, fino alla scadenza.'],
  ['Come si collega un professionista con il QR code?','Da «Codice e QR» scegli le sezioni e la durata e generi un QR code. Il professionista tocca «Collega con QR» in Casa ID e lo inquadra, oppure digita il codice scritto sotto. Il QR vale 15 minuti e per una sola persona; l\'accesso compare nella scheda Accessi e puoi revocarlo quando vuoi.'],
  ['Posso condividere un solo documento?','Sì. Dal documento aperto tocca «Condividi», oppure usa «Seleziona e condividi» per sceglierne più di uno: crei un unico link di sola lettura con una scadenza, da inviare via WhatsApp, email o copiandolo.'],
  ['Cosa succede quando revoco un accesso?','Da quel momento la persona o il link non vedono più il fascicolo. Chi ha già scaricato un documento ne conserva la copia.'],
  ['Dove sono conservati i file?','In un archivio privato su server nell\'Unione Europea, accessibile solo secondo i permessi del fascicolo. I dati non sono venduti né usati per pubblicità.']]],
 ['Costi e servizi',[
  ['Quanto costa?','Il canone previsto è di 10 € all\'anno per immobile. Rinnovo, disdetta e imposte saranno indicati prima dell\'attivazione a pagamento. La demo non ha costi.'],
  ['I servizi tecnici sono compresi nel canone?','No. Ogni pratica ha un preventivo con il costo totale (compenso, eventuale sopralluogo, diritti e bolli degli enti). Lo vedi prima e decidi tu; senza conferma non si procede.'],
  ['Chi risponde della pratica?','Il professionista che la svolge. Casa ID mette in contatto, raccoglie il preventivo e archivia il documento consegnato.']]],
 ['Continuità',[
  ['Posso scaricare tutti i documenti?','Sì. Titolare e delegati usano «Scarica fascicolo»: ottieni un file ZIP con i documenti divisi per sezione e un indice leggibile con Excel. Puoi farlo in qualsiasi momento.'],
  ['Se disdico, perdo i documenti?','Puoi scaricare l\'intero fascicolo prima di disdire. Le regole su conservazione e cancellazione dopo la disdetta saranno pubblicate nelle condizioni del servizio.'],
  ['Se vendo la casa, il fascicolo passa all\'acquirente?','Sì: il fascicolo appartiene all\'immobile. Dalla scheda Accessi avvii il «Passaggio di proprietà» indicando l\'email dell\'acquirente; quando lui accetta diventa titolare con documenti, scadenze e codice Casa ID. Tu e le persone che avevi invitato perdete l\'accesso; registro, link e richieste restano riservati e non passano. Prima puoi scaricare una copia. Casa ID non verifica l\'atto di vendita.'],
  ['Mi avvisate delle scadenze?','Oggi le scadenze inserite nei documenti (APE, caldaia, contratti) sono raccolte in un\'unica lista. Gli avvisi via email non sono ancora attivi. Casa ID non verifica gli adempimenti.']]],
 ['Sulla demo',[
  ['Posso caricare documenti veri?','No. Questa è una versione di prova: usa solo documenti di esempio, senza dati reali tuoi o di altre persone.'],
  ['Come si accede?','Nella demo con email e password. Nella versione definitiva il proprietario accederà con SPID o CIE. Chi riceve un link di sola lettura non deve registrarsi.'],
  ['Cosa succede ai dati della demo?','Possono essere cancellati al termine del periodo di prova o in caso di aggiornamenti tecnici. Non usarla come archivio.'],
  ['Ho trovato un problema: a chi lo dico?','Scrivi a chi ti ha invitato a provare Casa ID, indicando cosa stavi facendo e, se puoi, uno screenshot.']]]
];
function faqView(){
  const cfg=window.CASAID_CONFIG||{};
  const back=`<button class="btn-bar" data-act="page" data-id="">${S.session?'Torna ai fascicoli':'Torna alla home'}</button>`;
  return barHtml(back)+`<main class="wrap" style="max-width:860px"><div class="hello"><p class="eyebrow">Casa ID · versione demo</p><h1>Domande frequenti</h1><p class="lead">Cosa fa Casa ID oggi, cosa dipende dai professionisti e cosa è ancora in definizione.</p></div>
  ${FAQ.map(([t,qs])=>`<h2 class="section-t">${esc(t)}</h2><div class="card list">${qs.map(([q,a])=>`<details class="person" style="display:block"><summary style="cursor:pointer;font-weight:700;font-size:16px">${esc(q)}</summary><p style="margin-top:8px;color:var(--ink-2)">${esc(a)}</p></details>`).join('')}</div>`).join('')}
  <h2 class="section-t">Chi gestisce la demo</h2><div class="card" style="padding:20px">${cfg.GESTORE?`<p><b>${esc(cfg.GESTORE)}</b></p>`:'<p>Versione dimostrativa in fase di test con un gruppo ristretto di utenti.</p>'}${cfg.CONTATTO?`<p class="muted" style="margin-top:6px">Assistenza e segnalazioni: <b>${esc(cfg.CONTATTO)}</b></p>`:''}</div></main>`;
}
const ESEMPIO={codice:'CID-ESEM-PIO1',tipo:'Appartamento',indirizzo:'Via dei Mille 14',comune:'Salerno',cat:'Fg. 12 · Part. 348 · Sub. 7 · Cat. A/2',
 docs:[['Atto di compravendita','atti','2024-03-14',null,'notaio','verificato'],['Nota di trascrizione','atti','2024-04-02',null,'notaio','verificato'],['Visura catastale storica','catasto','2024-01-15',null,'agenzia','verificato'],['Planimetria catastale','catasto','2024-01-15',null,'agenzia','verificato'],['Relazione di conformità urbanistica','urbanistica','2024-02-20',null,'tecnico','verificato'],['Attestato di prestazione energetica','impianti','2018-03-20','2028-03-20','tecnico','verificato'],['Libretto d\'impianto caldaia','impianti','2024-11-15',null,'tecnico','verificato'],['Garanzia della caldaia','contratti','2023-10-02','2028-10-02','proprietario','caricato'],['Certificato di agibilità','urbanistica',null,null,'proprietario','richiesto']],
 accessi:[['Mario Rossi','proprietario','Titolare'],['Anna Rossi','familiare','Delegata · può invitare professionisti'],['Geom. Luca Bianchi','tecnico','Urbanistica, Impianti ed energia · fino al 31/03/2027'],['Banca per il mutuo','','Link di sola lettura · Proprietà e atti, Catasto · scade il 31/12/2026']]};
function esempioView(){
  const e=ESEMPIO;
  const back=S.session?`<button class="btn-bar" data-act="page" data-id="">Torna ai fascicoli</button>`:`<button class="btn-bar" data-act="page" data-id="">Torna alla home</button><button class="btn-bar solid" data-act="page" data-id="accedi" data-mode="register">Prova la demo</button>`;
  const ds=e.docs.map(([t,sez,dt,sc,r,st])=>{const x=DSTATO[st];return `<div class="row" style="cursor:default"><span class="ico ico-${sez}">${I.file}</span><span style="min-width:0"><b>${esc(t)}</b><small>${esc(SEZN[sez])} · ${dt?'del '+fmt(dt):'senza data'}</small></span><span class="rb">${badge(r)}</span><span class="right"><span class="${x[1]}" style="font-weight:700">${x[0]}</span>${sc?`<span class="muted">scade ${fmt(sc)}</span>`:''}</span></div>`}).join('');
  return barHtml(back)+`<div class="guest-bar">Esempio illustrativo con dati fittizi: nessun documento reale</div><main class="wrap">
  <section class="card fhead"><div class="t"><span class="eyebrow">Fascicolo immobile · esempio</span><h1>${e.tipo} · ${e.indirizzo}</h1><p class="muted">${e.comune} · ${e.cat}</p>
   <p style="font-size:15px">Così appare un fascicolo dopo qualche settimana: il notaio ha caricato gli atti, l'agenzia il catasto, il tecnico le pratiche e l'APE; il proprietario la garanzia della caldaia. Il certificato di agibilità manca ed è da recuperare.</p>
   <div class="acts"><button class="btn btn-p" data-act="page" data-id="">Crea il tuo fascicolo</button><button class="btn btn-s" data-act="page" data-id="faq">Domande frequenti</button></div></div>
   ${(()=>{const docs=e.docs.map(([t,sez,dt,sc,r,st])=>({titolo:t,sezione:sez,stato:st})),pres=docs.filter(d=>d.stato!=='richiesto'),l=(()=>{const voci=VOCI.map(v=>({...v,docs:pres.filter(d=>voceDi(d)===v.id)}));const ok=voci.filter(v=>v.docs.length).length;return {ok,tot:VOCI.length,pct:Math.round(ok*100/VOCI.length)}})();
   return `<div class="comp"><span class="muted" style="font-size:13px">Completamento della lista di base</span><span class="pct"><b class="num">${l.pct}%</b><span class="muted">${l.ok} di ${l.tot} documenti</span></span>${pctBar(l.pct)}<span style="font-size:13px">Documenti nel fascicolo: <strong>${pres.length}</strong></span><span class="muted" style="font-size:12px">La lista di base è un riferimento di Casa ID: non dice se il fascicolo basta per una vendita o una pratica.</span></div>`})()}</section>
  <h2 class="section-t">1 · Ritrovi i documenti</h2><p class="muted" style="font-size:14px;margin-bottom:12px">Ogni documento mostra chi l'ha caricato e la sua data. Lo stato non è una certificazione.</p><div class="card list">${ds}</div>
  <h2 class="section-t">2 · Tieni d'occhio le scadenze inserite</h2><div class="card list"><div class="deadline"><div class="d"><span>mar</span><b class="num">2028</b></div><div><b>Attestato di prestazione energetica</b><p class="muted" style="font-size:13px">Data inserita dal tecnico che ha caricato l'APE</p></div><span class="pill p-ok">In regola</span></div><div class="deadline"><div class="d"><span>ott</span><b class="num">2028</b></div><div><b>Garanzia della caldaia</b><p class="muted" style="font-size:13px">Data inserita dal proprietario</p></div><span class="pill p-ok">In regola</span></div></div>
  <h2 class="section-t">3 · Decidi chi vede cosa, e fino a quando</h2><div class="card list">${e.accessi.map(([n,r,d])=>`<div class="person"><span class="av r-${r||'proprietario'}">${esc(ini(n))}</span><div><b>${esc(n)}</b> ${badge(r)}<p class="muted" style="font-size:13px">${esc(d)}</p></div><span class="muted" style="font-size:13px">${r==='proprietario'?'':'revocabile'}</span></div>`).join('')}</div>
  <h2 class="section-t">4 · Recuperi ciò che manca, con un preventivo</h2><div class="card" style="padding:20px;display:flex;flex-direction:column;gap:6px"><b>Accesso agli atti per il certificato di agibilità</b><p class="muted" style="font-size:14px">Il proprietario chiede la pratica; un tecnico risponde con il costo totale (compenso e oneri degli enti). Solo se il proprietario accetta, il tecnico ottiene accesso alla sezione Urbanistica e consegna il documento nel fascicolo.</p></div>
  </main>`;
}

/* ---------- esportazione del fascicolo ---------- */
let zipReady=null;
function ensureZip(){if(!zipReady)zipReady=loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js').then(()=>window.JSZip).catch(e=>{zipReady=null;throw e});return zipReady}
async function exportFascicolo(btn){
  const i=S.data.immobili[S.cur],a=acc(S.cur);if(!i||!isOwnerLike(a))return;
  const ds=docsOf(i.id,a).sort((x,y)=>x.sezione.localeCompare(y.sezione));
  const old=btn.textContent;btn.disabled=true;btn.textContent='Preparo il file…';
  try{
    const JSZip=await ensureZip(),zip=new JSZip(),used=new Set();
    const csvq=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const rows=[['Titolo','Sezione','Data documento','Scadenza','Caricato da','Ruolo','Stato','Note','File nello ZIP']];
    let n=0,missing=0;
    for(const d of ds){
      let fname='';
      if(d.filePath){try{const blob=await getBlob(d.filePath);const ext=(d.fileName||'').split('.').pop()||'pdf';
        let base=`${SEZN[d.sezione]}/${(d.titolo||'documento').replace(/[\\/:*?"<>|]+/g,'-').slice(0,80)}`,k=1;fname=`${base}.${ext}`;while(used.has(fname))fname=`${base} (${++k}).${ext}`;used.add(fname);
        zip.file(fname,blob);n++;btn.textContent=`Preparo il file… ${n}`}catch(e){missing++;fname='(non scaricabile)'}}
      rows.push([d.titolo,SEZN[d.sezione],fmt(d.dataDocumento),d.scadenza?fmt(d.scadenza):'',uname(d.caricatoDa),RUOLO_BREVE[d.caricatoRuolo]||'',(DSTATO[d.stato]||DSTATO.caricato)[0],d.note||'',fname]);
    }
    zip.file('indice.csv','﻿'+rows.map(r=>r.map(csvq).join(';')).join('\r\n'));
    zip.file('LEGGIMI.txt',`Fascicolo Casa ID ${i.codice}\r\n${i.tipo} - ${i.indirizzo}, ${i.comune}\r\nEsportato il ${fmtT(now())}\r\n\r\nI documenti sono divisi in cartelle per sezione.\r\nIl file indice.csv (apribile con Excel) elenca tutti i documenti con date, autore e note,\r\ncompresi quelli senza file allegato.\r\n`);
    const out=await zip.generateAsync({type:'blob'});
    const url=URL.createObjectURL(out),l=document.createElement('a');l.href=url;l.download=`CasaID-${i.codice}.zip`;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    evento(i.id,'ha scaricato l\'intero fascicolo');
    toast(missing?`Fascicolo scaricato, ${missing} file non disponibili`:'Fascicolo scaricato');
  }catch(e){console.warn(e);toast('Esportazione non riuscita. Riprova.')}
  finally{btn.disabled=false;btn.textContent=old}
}

/* ---------- lista dei documenti di base (percentuale) ---------- */
const VOCI=[
 {id:'provenienza',n:'Atto di provenienza',d:'Rogito, donazione o successione',sez:'atti',re:/rogito|compravendita|provenienza|donazione|successione|atto (di|notarile)/i,serv:'copia-atto'},
 {id:'visura',n:'Visura catastale',d:'Meglio la visura storica',sez:'catasto',re:/visura/i,serv:'visura'},
 {id:'planimetria',n:'Planimetria catastale',d:'Quella depositata al Catasto',sez:'catasto',re:/planimetri/i,serv:'visura'},
 {id:'titolo',n:'Titolo edilizio',d:'Licenza, concessione, permesso, condono, SCIA o CILA',sez:'urbanistica',re:/licenza|concessione|permesso di costruire|condono|\bscia\b|\bcila\b|\bdia\b|titolo edilizio/i,serv:'accesso-atti'},
 {id:'conformita',n:'Conformità urbanistica',d:'Relazione o attestazione di stato legittimo',sez:'urbanistica',re:/conformit[aà] urbanistic|relazione di conformit|stato legittimo|regolarit[aà] urbanistic/i,serv:'accesso-atti'},
 {id:'agibilita',n:'Agibilità o abitabilità',d:'Certificato o segnalazione certificata',sez:'urbanistica',re:/agibilit|abitabilit/i,serv:'accesso-atti'},
 {id:'ape',n:'APE',d:'Attestato di prestazione energetica',sez:'impianti',re:/\bape\b|prestazione energetica/i,serv:'ape'},
 {id:'impianti',n:'Conformità degli impianti',d:'Dichiarazioni di conformità (elettrico, gas, termico)',sez:'impianti',re:/dichiarazion[ei] di conformit|\bdi\.?co\b|conformit[aà] (dell'|degli )?impiant/i},
 {id:'libretto',n:'Libretto d\'impianto',d:'Caldaia o climatizzazione',sez:'impianti',re:/libretto/i},
 {id:'condominio',n:'Regolamento di condominio',d:'Se l\'immobile è in condominio',sez:'condominio',re:/regolamento/i}];
const VOCIN=Object.fromEntries(VOCI.map(v=>[v.id,v]));
const voceDi=d=>d.voce&&VOCIN[d.voce]?d.voce:(VOCI.find(v=>v.re.test(d.titolo||''))||{}).id||null;
function lista(imId,docs){
 const i=S.data.immobili[imId]||{},na=i.vociNa||[];
 const ds=(docs||vals('documenti').filter(d=>d.immobileId===imId)).filter(d=>d.stato!=='richiesto');
 const voci=VOCI.map(v=>({...v,na:na.includes(v.id),docs:ds.filter(d=>voceDi(d)===v.id)}));
 const app=voci.filter(v=>!v.na),ok=app.filter(v=>v.docs.length).length;
 return {voci,ok,tot:app.length,pct:app.length?Math.round(ok*100/app.length):100};
}
const pctBar=p=>`<span class="pbar" role="img" aria-label="${p}%"><i style="width:${p}%"></i></span>`;
function compBlock(i,c,l,own){
 return `<div class="comp"><span class="muted" style="font-size:13px">Completamento della lista di base</span>
  <span class="pct"><b class="num">${l.pct}%</b><span class="muted">${l.ok} di ${l.tot} documenti</span></span>${pctBar(l.pct)}
  <button type="button" class="btn btn-g btn-sm" style="align-self:flex-start;padding-inline:0" data-act="lista">${l.ok<l.tot?'Vedi cosa manca':'Vedi la lista'}</button>
  <span style="font-size:13px">Documenti nel fascicolo: <strong class="num">${c.n}</strong> · sezioni: <strong class="num">${c.sez} su 6</strong></span>
  <span class="muted" style="font-size:12px">La lista di base è un riferimento di Casa ID: non dice se il fascicolo basta per una vendita o una pratica.</span></div>`;
}
function openLista(){
 const i=S.data.immobili[S.cur],a=acc(S.cur),own=a&&a.livello==='titolare',l=lista(i.id),allow=sezOf(a);
 modal('Lista dei documenti di base',`<div class="pct-head"><b class="num">${l.pct}%</b><span>${l.ok} di ${l.tot} documenti presenti${l.voci.some(v=>v.na)?` · ${l.voci.filter(v=>v.na).length} non applicabili`:''}</span></div>${pctBar(l.pct)}
  <div class="card list voci">${l.voci.map(v=>{const has=v.docs.length;return `<div class="voce${v.na?' na':''}"><span class="vk ${has?'ok':v.na?'na':'no'}">${has?I.check:v.na?'–':''}</span>
   <div style="min-width:0"><b>${esc(v.n)}</b><small>${has?esc(v.docs.map(d=>d.titolo).join(', ')):v.na?'Non applicabile a questo immobile':esc(v.d)}</small></div>
   <div class="va">${!has&&!v.na&&allow.includes(v.sez)?`<button type="button" class="btn btn-s btn-sm" data-act="vup" data-id="${v.id}">Carica</button>`:''}${!has&&!v.na&&v.serv&&isOwnerLike(a)?`<button type="button" class="btn btn-g btn-sm" data-act="vreq" data-id="${v.serv}">Preventivo</button>`:''}${own&&!has?`<button type="button" class="btn btn-g btn-sm" data-act="vna" data-id="${v.id}">${v.na?'Ripristina':'Non applicabile'}</button>`:''}</div></div>`}).join('')}</div>
  <p class="muted" style="font-size:13px">Un documento conta quando è caricato con il tipo corrispondente o quando il titolo lo indica chiaramente. Casa ID non ne controlla contenuto, aggiornamento o conformità.</p>`,
  `<button type="button" class="btn btn-p" data-act="close">Chiudi</button>`);
}

/* ---------- QR code: collegamento del professionista ---------- */
const QRGEN='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',JSQR='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const libs=new Map();
function ensureLib(src){if(!libs.has(src))libs.set(src,loadScript(src).catch(e=>{libs.delete(src);throw e}));return libs.get(src)}
const Q={timer:0,poll:0,stream:null,raf:0,busy:false,bad:'',badT:0};
function stopQ(){clearInterval(Q.timer);clearInterval(Q.poll);Q.timer=Q.poll=0;if(Q.stream){Q.stream.getTracks().forEach(t=>t.stop());Q.stream=null}cancelAnimationFrame(Q.raf);Q.raf=0;Q.busy=false}
const COD_RE=/^[A-HJ-NP-Z2-9]{10}$/;
function normCode(t){t=String(t||'').trim();const m=/[?&]collega=([A-Za-z0-9-]+)/.exec(t);if(m)t=m[1];t=t.toUpperCase().replace(/[^A-Z0-9]/g,'');return COD_RE.test(t)?t:null}
const fmtCode=c=>c.slice(0,5)+'-'+c.slice(5);
const collegaUrl=c=>location.origin+location.pathname+'?collega='+c;
function openCode(){const i=S.data.immobili[S.cur],a=acc(S.cur),can=canInvite(a);
 modal(can?'Codice e QR code':'Codice Casa ID',`
  <div class="codehead"><div><span class="muted" style="font-size:13px">Codice del fascicolo</span><b class="code" style="font-size:20px;display:block">${esc(i.codice)}</b></div><button type="button" class="btn btn-g btn-sm" data-act="copy" data-id="${esc(i.codice)}">Copia</button></div>
  <p class="muted" style="font-size:13px;margin-top:-6px">Identifica il fascicolo dentro Casa ID. Non è un dato catastale e non ha valore ufficiale.</p>
  ${can?`<div><h3 style="font-size:18px">Collega un professionista con il QR code</h3><p style="font-size:14px;color:var(--ink-2);margin-top:4px">Il professionista inquadra il QR dall'app Casa ID e si ritrova subito nel fascicolo, con le sezioni e la durata che scegli qui. Il QR vale 15 minuti e per una sola persona.</p></div>
  <div class="fld"><span class="lbl">Sezioni che potrà vedere e aggiornare</span>
   <div class="presets"><span class="muted">Scelta rapida:</span>${['tecnico','notaio','agenzia','broker'].map(r=>`<button type="button" class="chip" data-act="qpreset" data-id="${r}">${esc(RUOLO_BREVE[r]||RUOLO[r])}</button>`).join('')}</div>
   ${secCheckboxes('sezioni',SEZ.map(s=>s.id),[])}</div>
  <div class="fld"><label for="c-days">Accesso valido per</label><select id="c-days" name="giorni"><option value="30">30 giorni</option><option value="60" selected>60 giorni</option><option value="90">90 giorni</option><option value="180">6 mesi</option><option value="365">1 anno</option></select></div>
  <p class="err" id="c-err" hidden></p>`:''}`,
  can?`<button type="button" class="btn btn-s" data-act="close">Chiudi</button><button type="submit" class="btn btn-p" id="c-ok">${I.qr} Genera QR code</button>`:`<button type="button" class="btn btn-p" data-act="close">Chiudi</button>`,can?'qrgen':'');
 $('#modal .x').focus();
}
async function showQr(c,sez,giorni){
 const imId=S.cur;
 modal('Fai inquadrare questo QR code',`<div class="qr-wrap"><div class="qrbox big" id="qr-img"><p class="vmsg">Preparo il QR code…</p></div>
  <div class="qr-code-txt"><span class="muted" style="font-size:13px">oppure il professionista digita il codice</span><b class="code">${fmtCode(c.codice)}</b></div>
  <p class="qr-timer" id="qr-timer" aria-live="polite"></p></div>
  <dl class="kv"><dt>Sezioni</dt><dd>${esc(sez.map(s=>SEZN[s]).join(', '))}</dd><dt>Accesso</dt><dd>per ${giorni} giorni dal collegamento, revocabile quando vuoi</dd></dl>
  <p class="muted" style="font-size:13px">Il professionista apre Casa ID e tocca «Collega con QR», oppure inquadra il codice con la fotocamera del telefono. Ti avvisiamo qui appena si collega.</p>`,
  `<button type="button" class="btn btn-s" data-act="qr">Nuovo QR code</button><button type="button" class="btn btn-p" data-act="close">Chiudi</button>`);
 const box=$('#qr-img');
 try{await ensureLib(QRGEN);if(!box.isConnected)return;const q=qrcode(0,'M');q.addData(collegaUrl(c.codice));q.make();
   box.innerHTML=q.createSvgTag({cellSize:8,margin:2,scalable:true});const svg=box.querySelector('svg');if(svg){svg.setAttribute('role','img');svg.setAttribute('aria-label','QR code di collegamento '+fmtCode(c.codice))}}
 catch(e){box.innerHTML='<p class="vmsg">Non riesco a disegnare il QR code: usa il codice qui sotto.</p>'}
 const end=Date.parse(c.validoFino||c.valido_fino),tick=()=>{const t=$('#qr-timer');if(!t){stopQ();return}const r=end-Date.now();
   if(r<=0){stopQ();box.classList.add('expired');t.className='qr-timer exp';t.textContent='QR code scaduto: generane uno nuovo.';return}
   const m=Math.floor(r/60000),s=Math.floor(r%60000/1000);t.className='qr-timer'+(r<120000?' low':'');t.textContent=`Valido ancora ${m}:${String(s).padStart(2,'0')}`};
 tick();Q.timer=setInterval(tick,1000);
 Q.poll=setInterval(async()=>{try{const {data}=await S.sb.from('collegamenti').select('usato_da,usato_il').eq('id',c.id).single();
   if(data&&data.usato_da){stopQ();await loadAll();const u=user(data.usato_da),p=acc(imId,u?.email);
     modal('Professionista collegato',`<div class="done"><span class="tick">${I.check}</span><h3>${esc(u?.nome||'Il professionista')} si è collegato</h3><p class="muted">${esc(RUOLO[u?.ruolo]||'')}${u?.studio?' · '+esc(u.studio):''}</p></div>
      <dl class="kv"><dt>Sezioni</dt><dd>${esc((p?.sezioni||sez).map(s=>SEZN[s]).join(', '))}</dd><dt>Fino al</dt><dd>${p?.scadenza?fmt(p.scadenza):'—'}</dd></dl>
      <p class="muted" style="font-size:13px">Lo trovi nella scheda Accessi, dove puoi revocarlo quando vuoi.</p>`,
      `<button type="button" class="btn btn-s" data-act="tab" data-id="accessi">Vai agli accessi</button><button type="button" class="btn btn-p" data-act="close">Fatto</button>`)}}catch(e){}},3000);
}
function openScan(manual=false,prefill=''){
 modal('Collega un immobile',`
  ${manual?'':`<div class="scan" id="scan"><video id="scan-v" playsinline muted autoplay></video><div class="scan-frame" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="scan-line"></span></div><p class="scan-msg" id="scan-msg">Attivo la fotocamera…</p></div>
  <p style="font-size:14px;text-align:center;color:var(--ink-2)">Inquadra il QR code che il proprietario ti mostra in Casa ID.</p>
  <div class="or"><span>oppure</span></div>`}
  <div class="fld"><label for="s-code">Codice di collegamento</label><input id="s-code" name="codice" class="code-in" placeholder="ABCDE-FGHJK" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="11" value="${esc(prefill)}"><span class="muted" style="font-size:13px">È scritto sotto il QR code, sullo schermo del proprietario. Vale 15 minuti.</span></div>
  <p class="err" id="s-err" hidden></p>`,
  `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p" id="s-ok">Collega</button>`,'scan');
 const inp=$('#s-code');inp.addEventListener('input',()=>{const v=inp.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);inp.value=v.length>5?v.slice(0,5)+'-'+v.slice(5):v});
 if(!manual){$('#modal .x').focus();startCamera()}
}
function scanMsg(t){const m=$('#scan-msg');if(m)m.textContent=t||''}
async function startCamera(){
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){camFail('Questo browser non permette di usare la fotocamera. Inserisci il codice qui sotto.');return}
 try{
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  const v=$('#scan-v');if(!v){stream.getTracks().forEach(t=>t.stop());return}
  Q.stream=stream;v.srcObject=stream;try{await v.play()}catch(e){}
  let det=null;
  if('BarcodeDetector' in window){try{const f=await BarcodeDetector.getSupportedFormats();if(f.includes('qr_code'))det=new BarcodeDetector({formats:['qr_code']})}catch(e){}}
  if(!det)await ensureLib(JSQR);
  if(!Q.stream)return;
  $('#scan').classList.add('live');scanMsg('');
  const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});let last=0;
  const tick=async t=>{if(!Q.stream)return;Q.raf=requestAnimationFrame(tick);if(Q.busy||t-last<160||v.readyState<2||!v.videoWidth)return;last=t;
   let txt=null;
   try{if(det){const r=await det.detect(v);txt=r[0]&&r[0].rawValue}
    else{const w=Math.min(800,v.videoWidth),h=Math.round(v.videoHeight*w/v.videoWidth);cv.width=w;cv.height=h;cx.drawImage(v,0,0,w,h);const r=jsQR(cx.getImageData(0,0,w,h).data,w,h,{inversionAttempts:'dontInvert'});txt=r&&r.data}}catch(e){}
   if(txt)onScan(txt)};
  Q.raf=requestAnimationFrame(tick);
 }catch(e){camFail(e&&e.name==='NotAllowedError'?'Accesso alla fotocamera negato. Puoi consentirlo dalle impostazioni del browser, oppure inserire il codice qui sotto.':'Non riesco ad attivare la fotocamera. Inserisci il codice qui sotto.')}
}
function camFail(t){const s=$('#scan');if(s){s.classList.add('off');scanMsg(t)}}
function onScan(txt){const c=normCode(txt);
 if(!c){if(Date.now()-Q.badT>2500){Q.badT=Date.now();scanMsg('Questo QR code non è un codice Casa ID')}return}
 if(c===Q.bad&&Date.now()-Q.badT<5000)return;
 Q.busy=true;try{navigator.vibrate&&navigator.vibrate(60)}catch(e){}
 $('#scan')&&$('#scan').classList.add('hit');const inp=$('#s-code');if(inp)inp.value=fmtCode(c);redeem(c)}
async function redeem(c){
 scanMsg('Collegamento in corso…');const b=$('#s-ok');busy(b,'Collego…');
 const {data,error}=await S.sb.rpc('usa_collegamento',{p_codice:c});
 if(error){busy(b);showErr('s-err',errMsg(error));Q.bad=c;Q.badT=Date.now();Q.busy=false;const s=$('#scan');if(s)s.classList.remove('hit');scanMsg('');return}
 stopQ();await loadAll();closeModal();
 const d=data||{};S.cur=d.immobile_id;S.view='fascicolo';S.tab='documenti';S.sez='tutti';S.q='';render();scrollTo(0,0);
 modal('Sei collegato',`<div class="done"><span class="tick">${I.check}</span><h3>${esc((d.tipo||'')+' · '+(d.indirizzo||''))}</h3><p class="muted">${esc(d.comune||'')}</p></div>
  <dl class="kv"><dt>Sezioni</dt><dd>${esc((d.sezioni||[]).map(s=>SEZN[s]).join(', '))}</dd><dt>Fino al</dt><dd>${d.scadenza?fmt(d.scadenza):'—'}</dd></dl>
  <p class="muted" style="font-size:13px">Il fascicolo ora è tra i tuoi. Il proprietario vede che ti sei collegato e può revocare l'accesso.</p>`,
  `<button type="button" class="btn btn-p" data-act="close">Apri il fascicolo</button>`);
}
function proCta(){return `<div class="card cta"><span class="cta-ico">${I.qr}</span><div style="flex:1;min-width:200px"><h3>Collega un immobile</h3><p class="muted" style="font-size:14px">Dal cliente: inquadri il QR code che ti mostra in Casa ID e trovi subito il suo fascicolo.</p></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p" data-act="scan">${I.qr} Scansiona QR code</button><button class="btn btn-s" data-act="scan" data-id="manual">Inserisci codice</button></div></div>`}

/* ---------- condivisione di documenti ---------- */
function openShare(ids){
 const ds=ids.map(id=>S.data.documenti[id]).filter(d=>d&&d.filePath);if(!ds.length){toast('Seleziona almeno un documento con un file');return}
 closeModal();S.shareIds=ds.map(d=>d.id);
 modal(ds.length===1?'Condividi documento':`Condividi ${ds.length} documenti`,`
  <div class="sharelist">${ds.slice(0,6).map(d=>`<div><span class="ico ico-${esc(d.sezione)}">${I.file}</span><span style="min-width:0"><b>${esc(d.titolo)}</b><small>${esc(SEZN[d.sezione])}${d.fileName?' · '+esc(d.fileName):''}</small></span></div>`).join('')}${ds.length>6?`<p class="muted" style="font-size:13px">e altri ${ds.length-6}</p>`:''}</div>
  <div class="fld"><label for="sh-et">Per chi è</label><input id="sh-et" name="etichetta" required placeholder="Es. Geometra Rossi, Banca per il mutuo"></div>
  <div class="fld"><label for="sh-days">Valido per</label><select id="sh-days" name="giorni"><option value="2">48 ore</option><option value="7" selected>7 giorni</option><option value="30">30 giorni</option><option value="90">90 giorni</option></select></div>
  <p class="muted" style="font-size:13px">Chi riceve il link vede e scarica solo ${ds.length===1?'questo documento':'questi documenti'}, senza registrarsi. Puoi revocarlo dalla scheda Accessi.</p>
  <p class="err" id="sh-err" hidden></p>`,
  `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p" id="sh-ok">${I.link} Crea link</button>`,'share');
}
function linkReady(id,what,scad){
 const i=S.data.immobili[S.cur]||{},url=guestUrl(id);
 const text=`Ti condivido ${what} del fascicolo Casa ID di ${i.indirizzo||'un immobile'}${i.comune?', '+i.comune:''}. Il link è valido fino al ${fmt(scad)}:`;
 S.lastShare={url,text};
 modal('Link pronto',`<p class="lead" style="font-size:16px">Invialo a chi deve consultare ${esc(what)}. Non serve registrarsi.</p>
  <p class="linkbox">${esc(url)}</p>
  <div class="share-acts"><button type="button" class="btn btn-p" data-act="gcopy" data-id="${esc(id)}">Copia link</button>${navigator.share?`<button type="button" class="btn btn-s" data-act="gshare">Invia…</button>`:''}
   <a class="btn btn-s" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}" target="_blank" rel="noopener">WhatsApp</a>
   <a class="btn btn-s" href="mailto:?subject=${encodeURIComponent('Documenti Casa ID')}&body=${encodeURIComponent(text+'\n'+url)}">Email</a></div>
  <p class="muted" style="font-size:13px">Valido fino al ${fmt(scad)}. Lo trovi nella scheda Accessi, dove puoi revocarlo.</p>`,
  `<button type="button" class="btn btn-p" data-act="close">Fatto</button>`);
}

/* ---------- passaggio di proprietà ---------- */
function passaggioAperto(imId){return vals('passaggi').find(p=>p.immobileId===imId&&p.stato==='in_attesa')}
function passaggiPerMe(){return vals('passaggi').filter(p=>p.stato==='in_attesa'&&p.aEmail===myEmail())}
function passaggioBox(i,a){
 if(!a||a.livello!=='titolare')return '';
 const p=passaggioAperto(i.id);
 return `<section class="card" style="margin-top:20px"><div class="box-h"><h3>Passaggio di proprietà</h3>${p?'':`<button class="btn btn-s btn-sm" data-act="pstart">Avvia passaggio</button>`}</div>
  <div style="padding:0 20px 20px">${p?`<div class="note">In attesa che <b>${esc(p.aEmail)}</b> accetti${p.dataAtto?` · atto del ${fmt(p.dataAtto)}`:''}. Finché non accetta, il fascicolo resta tuo. <button class="btn btn-g btn-sm" data-act="pcancel" data-id="${esc(p.id)}">Annulla passaggio</button></div>`
  :`<p class="muted" style="font-size:14px">Il fascicolo appartiene all'immobile. Quando vendi, lo passi al nuovo proprietario con documenti, scadenze e codice Casa ID; tu e le persone che hai invitato perdete l'accesso.</p>`}</div></section>`;
}
function openPassaggio(){
 const i=S.data.immobili[S.cur],n=presenza(i.id).n,lav=vals('richieste').filter(r=>r.immobileId===i.id&&r.stato==='lavorazione').length;
 modal('Passaggio di proprietà',`
  <div class="pas-grid"><div><h4>Passa al nuovo proprietario</h4><ul><li>${n} documenti e le relative scadenze</li><li>Codice Casa ID del fascicolo</li><li>Dati dell'immobile</li></ul></div>
   <div><h4>Non passa</h4><ul><li>Registro degli accessi e attività</li><li>Link condivisi e inviti (vengono chiusi)</li><li>Richieste e preventivi</li></ul></div></div>
  <div class="note">Dopo l'accettazione <b>tu perdi l'accesso</b>, come familiari e professionisti che hai invitato. Se vuoi tenerne una copia, scarica prima il fascicolo.</div>
  ${lav?`<p class="err">Ci sono ${lav} pratiche in lavorazione: il passaggio potrà essere accettato solo dopo la consegna.</p>`:''}
  <div class="fld"><label for="p-email">Email del nuovo proprietario</label><input id="p-email" name="email" type="email" required placeholder="acquirente@esempio.it"><span class="muted" style="font-size:13px">Se non usa ancora Casa ID, troverà la richiesta appena si registra con questa email.</span></div>
  <div class="fld"><label for="p-data">Data dell'atto (facoltativa)</label><input id="p-data" name="dataAtto" type="date"></div>
  <div class="checks block"><label><input type="checkbox" name="ok1" value="1"> Ho tolto dal fascicolo i documenti personali che non riguardano l'immobile</label><label><input type="checkbox" name="ok2" value="1"> Ho capito che, dopo l'accettazione, non avrò più accesso al fascicolo</label></div>
  <p class="err" id="p-err" hidden></p>`,
  `<button type="button" class="btn btn-g" data-act="export" style="margin-right:auto">Scarica una copia</button><button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="submit" class="btn btn-p" id="p-ok">Avvia passaggio</button>`,'passaggio');
}
function passaggiInArrivo(){const ps=passaggiPerMe();if(!ps.length)return '';
 return ps.map(p=>`<div class="card pas-in"><span class="cta-ico">${I.key||I.file}</span><div style="flex:1;min-width:220px"><p class="eyebrow">Passaggio di proprietà</p><h3>${esc((p.tipo||'Immobile')+' · '+(p.indirizzo||''))}</h3>
  <p class="muted" style="font-size:14px">${esc(p.daNome||'Il proprietario')} ti trasferisce il fascicolo${p.comune?' di '+esc(p.comune):''}: ${p.nDocumenti||0} documenti${p.dataAtto?` · atto del ${fmt(p.dataAtto)}`:''}.</p></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p" data-act="paccept" data-id="${esc(p.id)}">Accetta</button><button class="btn btn-s" data-act="prefuse" data-id="${esc(p.id)}">Rifiuta</button></div></div>`).join('');
}
function openAccept(pid){const p=S.data.passaggi[pid];if(!p)return;
 modal('Accetta il passaggio',`<p class="lead" style="font-size:16px">Diventi titolare del fascicolo di <b>${esc((p.tipo||'')+' · '+(p.indirizzo||''))}</b>.</p>
  <ul class="plain"><li>Ricevi ${p.nDocumenti||0} documenti, le scadenze e il codice Casa ID.</li><li>${esc(p.daNome||'Il precedente proprietario')} e le persone che aveva invitato perdono l'accesso.</li><li>Registro, link e richieste del precedente proprietario non ti vengono mostrati.</li><li>Casa ID non verifica la proprietà né il contenuto dei documenti.</li></ul>`,
  `<button type="button" class="btn btn-s" data-act="close">Annulla</button><button type="button" class="btn btn-p" data-act="pconfirm" data-id="${esc(pid)}">Accetto il passaggio</button>`);
}

/* ---------- landing pubblica ---------- */
function landingView(){
 const cfg=window.CASAID_CONFIG||{};
 const nav=`<nav class="lp-nav" aria-label="Sezioni"><button class="btn-link" data-act="goto" data-id="lp-come">Come funziona</button><button class="btn-link" data-act="goto" data-id="lp-pro">Professionisti</button><button class="btn-link" data-act="goto" data-id="lp-prezzo">Prezzo</button></nav>
  <button class="btn-bar" data-act="page" data-id="accedi" data-mode="login">Accedi</button><button class="btn-bar solid" data-act="page" data-id="accedi" data-mode="register">Prova la demo</button>`;
 const ck=t=>`<li>${I.check}<span>${t}</span></li>`;
 const feat=(id,eye,h,p,items,img,alt,rev,extra='')=>`<section class="lp-feat${rev?' rev':''}" id="${id}"><div class="lp-ft"><p class="eyebrow">${eye}</p><h2>${h}</h2><p class="lead">${p}</p><ul class="lp-ck">${items.map(ck).join('')}</ul>${extra}</div>
  <figure class="lp-phone"><div class="frame"><img src="img/${img}.webp" alt="${alt}" loading="lazy" width="390" height="844"></div><figcaption>Esempio con dati fittizi</figcaption></figure></section>`;
 return barHtml(nav)+`<main class="lp">
 <section class="lp-hero"><div class="lp-in lp-hero-in">
  <div class="lp-hero-t"><p class="eyebrow">Carta d'identità dell'immobile</p>
   <h1>I documenti della tua casa, organizzati e pronti da condividere</h1>
   <p class="lead">Casa ID riunisce il fascicolo del tuo immobile. I professionisti caricano i documenti prodotti per te; tu li ritrovi e decidi con chi condividerli e per quanto tempo.</p>
   <div class="lp-cta"><button class="btn btn-p btn-lg" data-act="page" data-id="accedi" data-mode="register">Prova la demo</button><button class="btn btn-s btn-lg" data-act="page" data-id="esempio">${I.eye} Guarda un fascicolo di esempio</button></div>
   <p class="muted lp-small">Versione dimostrativa: si entra con email e password, con documenti di prova.</p></div>
  <div class="lp-shot" aria-hidden="true"><div class="lp-browser"><span class="dots"><i></i><i></i><i></i></span><img src="img/app-fascicolo.webp" alt="" width="1280" height="650"></div>
   <div class="lp-phone mini"><div class="frame"><img src="img/app-telefono.webp" alt="" width="390" height="844"></div></div></div>
 </div></section>

 <section class="lp-band"><div class="lp-in"><p class="eyebrow">Ti riconosci?</p><h2>Quando servono, i documenti della casa non si trovano mai</h2>
  <div class="lp-grid3">
   <div class="lp-card">${I.search}<p>La banca chiede il rogito per il mutuo e non ricordi dove l'hai messo.</p></div>
   <div class="lp-card">${I.file}<p>Il notaio chiede planimetria e pratiche edilizie, e devi ricostruire chi le aveva.</p></div>
   <div class="lp-card">${I.bell}<p>Vuoi affittare e scopri all'ultimo che l'APE è scaduto.</p></div></div></div></section>

 <section class="lp-sec" id="lp-come"><div class="lp-in"><p class="eyebrow">Come funziona</p><h2>Come si costruisce il tuo fascicolo</h2>
  <ol class="lp-steps">
   <li><b>1</b><h3>Attivi il fascicolo</h3><p>Indichi il tuo immobile. Nella versione definitiva l'accesso sarà con SPID o CIE.</p></li>
   <li><b>2</b><h3>Inviti i professionisti</h3><p>Agenzia, tecnico e notaio caricano i documenti che hanno prodotto per te. Puoi aggiungere anche quelli che hai già.</p></li>
   <li class="hi"><b>3</b><h3>Li ritrovi quando servono</h3><p>Da telefono o computer, ordinati in sei sezioni: atti, catasto, urbanistica, impianti, condominio, contratti.</p></li></ol>
  <p class="lp-note">${I.search}<span><b>Ti manca un documento?</b> Il recupero è un servizio a parte: lo chiedi a un professionista e decidi dopo aver visto il preventivo.</span></p></div></section>

 <div class="lp-in lp-feats">
 ${feat('lp-lista','Lista di base','Vedi subito cosa c\'è e cosa manca','Una percentuale calcolata su dieci documenti di base, dall\'atto di provenienza all\'APE. Per ogni voce mancante puoi caricarla, chiedere un preventivo o segnarla come non applicabile.',['Atto di provenienza, visura, planimetria, titoli edilizi, agibilità, APE e impianti','Ogni documento mostra chi l\'ha caricato e quando','È un riferimento: non certifica che il fascicolo basti per una vendita o una pratica'],'app-lista','La lista dei documenti di base con la percentuale',false)}
 ${feat('lp-cond','Condivisione','Condividi solo quello che serve','Scegli un documento o una selezione e crei un unico link di sola lettura, con la scadenza che decidi. Lo mandi su WhatsApp o per email; chi lo riceve non deve registrarsi.',['Un documento, più documenti o intere sezioni','Link da 48 ore a 90 giorni, revocabile quando vuoi','Ogni apertura resta nel registro degli accessi'],'app-condividi','Selezione di più documenti da condividere',true)}
 ${feat('lp-qr','QR code','Il professionista si collega con un QR code','Mostri il QR dal telefono, il professionista lo inquadra con Casa ID e si ritrova nel tuo fascicolo, solo nelle sezioni che hai scelto e per il tempo che hai deciso.',['Vale 15 minuti e per una sola persona','In alternativa il professionista digita il codice','Lo trovi nella scheda Accessi e lo revochi con un tocco'],'app-qr','Il QR code di collegamento sul telefono del proprietario',false)}
 </div>

 <section class="lp-sec lp-alt" id="lp-passaggio"><div class="lp-in lp-pass">
  <div><p class="eyebrow">Passaggio di proprietà</p><h2>Il fascicolo resta alla casa</h2><p class="lead">Quando vendi, avvii il passaggio indicando l'email dell'acquirente. Quando accetta, diventa titolare del fascicolo; tu e le persone che avevi invitato perdete l'accesso.</p>
   <p class="muted lp-small">Prima puoi scaricare una copia. Casa ID non verifica l'atto di vendita.</p></div>
  <div class="lp-pass-v" role="img" aria-label="Passano documenti, scadenze e codice Casa ID; restano riservati registro, link, richieste e preventivi">
   <div class="who"><span class="av">V</span><b>Venditore</b><small>avvia il passaggio</small></div>
   <div class="mid"><div class="box ok"><h4>Passa</h4><p>Documenti e scadenze</p><p>Codice Casa ID</p><p>Dati dell'immobile</p></div><div class="box no"><h4>Resta riservato</h4><p>Registro accessi</p><p>Link e inviti</p><p>Richieste e preventivi</p></div></div>
   <div class="who"><span class="av b">A</span><b>Acquirente</b><small>accetta e diventa titolare</small></div></div>
 </div></section>

 <section class="lp-sec"><div class="lp-in"><p class="eyebrow">Il controllo è tuo</p><h2>Decidi tu chi vede cosa</h2>
  <div class="lp-grid4">
   <div class="lp-card">${I.key}<h3>Accesso a tuo nome</h3><p>Con SPID o CIE nella versione definitiva. Il codice Casa ID identifica il fascicolo e non ha valore ufficiale.</p></div>
   <div class="lp-card">${I.plus}<h3>Famiglia e delegati</h3><p>Coniuge, figli, co-intestatari, con i permessi che scegli.</p></div>
   <div class="lp-card">${I.qr}<h3>Professionisti a tempo</h3><p>Vedono solo le sezioni che indichi, fino alla data che decidi.</p></div>
   <div class="lp-card">${I.eye}<h3>Registro e revoca</h3><p>Vedi chi ha consultato cosa e chiudi un accesso quando vuoi.</p></div></div>
  <p class="muted lp-small" style="margin-top:16px">La revoca vale da quel momento: chi ha già scaricato un documento ne conserva la copia. I file sono in un archivio privato su server nell'Unione Europea.</p></div></section>

 <section class="lp-sec lp-dark" id="lp-pro"><div class="lp-in lp-pro">
  <div><p class="eyebrow">Per agenzie, tecnici e notai</p><h2>Lavori sui documenti del cliente, senza rincorrerli</h2>
   <p class="lead">Il cliente ti invita o ti mostra il QR code: entri nel suo fascicolo con le sezioni che ti servono, carichi i documenti che produci e ricevi le richieste di preventivo per le pratiche.</p>
   <div class="lp-cta"><button class="btn btn-w btn-lg" data-act="page" data-id="accedi" data-mode="register">Registrati come professionista</button></div></div>
  <ul class="lp-ck light">${['Collegamento con QR code o invito via email','Carichi direttamente nel fascicolo del cliente','Crei il fascicolo per un cliente che non lo ha ancora','Ricevi richieste di preventivo e consegni il documento in app'].map(ck).join('')}</ul>
 </div></section>

 <section class="lp-sec" id="lp-prezzo"><div class="lp-in lp-price">
  <div class="lp-pcard"><p class="eyebrow light">Abbonamento previsto</p><p class="big">10 €</p><p class="per">all'anno, per immobile</p><p class="lp-small light">La demo non ha costi. Rinnovo, disdetta e imposte saranno indicati prima dell'attivazione a pagamento.</p></div>
  <div><h2>Il tuo fascicolo digitale</h2><ul class="lp-ck cols">${['Fascicolo in sei sezioni','Visualizzazione in app, da telefono e computer','Link di condivisione a tempo','Accessi per familiari, delegati e professionisti','Lista delle scadenze inserite','Esportazione del fascicolo in ZIP'].map(ck).join('')}</ul>
   <p class="lp-note">${I.file}<span><b>Servizi tecnici a preventivo.</b> Visure, accesso agli atti, APE e altre pratiche non sono compresi: il professionista indica il costo totale e decidi tu se procedere.</span></p></div>
 </div></section>

 <section class="lp-sec lp-alt"><div class="lp-in lp-faq"><div><p class="eyebrow">Domande frequenti</p><h2>Prima di provare</h2><button class="btn btn-s" data-act="page" data-id="faq">Tutte le domande</button></div>
  <div class="card list">${[
   ['Casa ID verifica i documenti?','No. Mostra chi ha caricato ogni documento e quando. Contenuto, aggiornamento e conformità restano responsabilità di chi li ha prodotti.'],
   ['E se il mio tecnico non usa Casa ID?','Lo inviti con la sua email o gli mostri il QR code: si registra e vede solo le sezioni che scegli. Oppure carichi tu i documenti che ti consegna.'],
   ['I servizi tecnici sono compresi?','No. Ogni pratica ha un preventivo con il costo totale, che accetti o rifiuti prima che parta.'],
   ['Se disdico, perdo i documenti?','Puoi scaricare l\'intero fascicolo in ZIP, con indice, in qualsiasi momento.'],
   ['Posso caricare documenti veri nella demo?','No: è una versione di prova. Usa solo documenti di esempio, senza dati reali tuoi o di altre persone.']].map(([q,a])=>`<details class="person" style="display:block"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>

 <section class="lp-final"><div class="lp-in"><h2>Inizia dal tuo fascicolo</h2><p class="lead">Crea un fascicolo di esempio in un minuto e prova condivisione, QR code e passaggio di proprietà.</p>
  <div class="lp-cta center"><button class="btn btn-w btn-lg" data-act="page" data-id="accedi" data-mode="register">Prova la demo</button><button class="btn btn-o btn-lg" data-act="page" data-id="esempio">Guarda un fascicolo di esempio</button></div></div></section>
 </main>
 <footer class="lp-foot"><div class="lp-in"><div class="brandline">${LOGO()}<span><b>Casa ID</b><small>Carta d'identità dell'immobile</small></span></div>
  <p>Versione dimostrativa${cfg.GESTORE?' gestita da '+esc(cfg.GESTORE):''}. Usa solo documenti di prova. Il codice Casa ID identifica il fascicolo nel servizio e non ha valore catastale o ufficiale. Casa ID non certifica contenuto, aggiornamento o conformità dei documenti.${cfg.CONTATTO?' Contatti: '+esc(cfg.CONTATTO)+'.':''}</p>
  <p><button class="btn-link" data-act="page" data-id="faq">Domande frequenti</button> · <button class="btn-link" data-act="page" data-id="esempio">Fascicolo di esempio</button> · <button class="btn-link" data-act="page" data-id="accedi" data-mode="login">Accedi</button></p></div></footer>`;
}

/* ---------- vademecum (pagina nascosta: ?guida=proprietario | professionista) ---------- */
function mdHtml(src){
 const inl=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>'),L=src.split('\n');let h='',i=0;
 const isList=x=>/^(\d+\.|-) /.test(x),isSub=x=>/^\s+- /.test(x);
 while(i<L.length){const l=L[i];
  if(!l.trim()){i++;continue}
  if(l.startsWith('## ')){const t=l.slice(3),n=(t.match(/^\d+/)||[''])[0];h+=`<h2 id="g-${n||i}">${inl(t)}</h2>`;i++;continue}
  if(l.startsWith('|')){const rows=[];while(i<L.length&&L[i].startsWith('|'))rows.push(L[i++]);const cells=r=>r.trim().slice(1,-1).split('|').map(c=>c.trim());
   h+=`<div class="g-tw"><table class="g-t"><thead><tr>${cells(rows[0]).map(c=>`<th>${inl(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(2).map(r=>`<tr>${cells(r).map(c=>`<td>${inl(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;continue}
  if(isList(l)){const ord=/^\d+\./.test(l),items=[];while(i<L.length&&(isList(L[i])||isSub(L[i]))){const x=L[i++];if(isSub(x)&&items.length)items[items.length-1].sub.push(x.trim().slice(2));else items.push({t:x.replace(/^(\d+\.|-) /,''),sub:[]})}
   const tag=ord?'ol':'ul';h+=`<${tag}>${items.map(it=>`<li>${inl(it.t)}${it.sub.length?`<ul>${it.sub.map(s=>`<li>${inl(s)}</li>`).join('')}</ul>`:''}</li>`).join('')}</${tag}>`;continue}
  const p=[];while(i<L.length&&L[i].trim()&&!/^(## |\|)/.test(L[i])&&!isList(L[i]))p.push(L[i++]);h+=`<p>${inl(p.join(' '))}</p>`}
 return h;
}
function guideView(){
 const G=window.CASAID_GUIDE;
 const right=`<button class="btn-bar" data-act="page" data-id="">${S.session?'Torna ai fascicoli':'Apri la demo'}</button>`;
 if(!G){ensureLib('guida.js').then(render).catch(()=>{S.guideErr=true;render()});return barHtml(right)+`<main class="wrap">${S.guideErr?'<div class="card empty"><p class="lead">Non riesco a caricare la guida. Ricarica la pagina.</p></div>':loading('Carico la guida…')}</main>`}
 const k=G[S.guida]?S.guida:'proprietario',g=G[k],secs=[...g.md.matchAll(/^## (\d+)\. (.+)$/gm)];
 return barHtml(right)+`<main class="wrap g-wrap">
  <div class="g-head"><p class="eyebrow">Casa ID · versione demo</p><h1>${esc(g.t)}</h1>
   <div class="g-tools"><div class="tools" style="margin:0">${Object.entries(G).map(([id,x])=>`<button class="chip" data-act="guida" data-id="${id}" aria-pressed="${id===k}">${esc(x.t.replace('Vademecum del ','').replace(/^./,c=>c.toUpperCase()))}</button>`).join('')}</div>
   <a class="btn btn-s btn-sm" href="docs/Casa-ID_Vademecum-${k}.pdf" download>Scarica il PDF</a></div></div>
  <div class="g-grid"><nav class="g-toc" aria-label="Indice"><p class="eyebrow">Indice</p>${secs.map(m=>`<button class="btn-link" data-act="goto" data-id="g-${m[1]}">${m[1]}. ${esc(m[2])}</button>`).join('')}</nav>
  <article class="g-body">${mdHtml(g.md)}</article></div></main>`;
}

/* ---------- azioni ---------- */
async function copy(t){try{await navigator.clipboard.writeText(t);toast('Copiato')}catch(e){prompt('Copia il testo:',t)}}
const guestUrl=id=>location.origin+location.pathname+'#g'+id;
const H={
 home(){if(S.guest){H.gclose();return}S.page=null;S.view='home';S.cur=null;render()},
 page(t){try{if(new URLSearchParams(location.search).has('guida'))history.replaceState(null,'',location.pathname+location.hash)}catch(e){}S.page=t.dataset.id||null;if(S.page==='accedi'){S.authMode=t.dataset.mode||'login';S.authMsg=''}render();scrollTo(0,0)},
 guida(t){S.guida=t.dataset.id;try{history.replaceState(null,'',location.pathname+'?guida='+S.guida)}catch(e){}render();scrollTo(0,0)},
 gprint(){print()},
 goto(t){const el=document.getElementById(t.dataset.id);if(el)el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})},
 export(t){exportFascicolo(t)},
 quote(t){openQuote(t.dataset.id)},
 async qok(t){t.disabled=true;try{const {error}=await S.sb.rpc('rispondi_preventivo',{rid:t.dataset.id,accetta:true});if(error)throw error;await loadAll();toast('Preventivo accettato: il professionista può procedere')}catch(e){toast(errMsg(e));t.disabled=false}},
 async qno(t){t.disabled=true;try{const {error}=await S.sb.rpc('rispondi_preventivo',{rid:t.dataset.id,accetta:false});if(error)throw error;await loadAll();toast('Preventivo rifiutato: la richiesta torna disponibile')}catch(e){toast(errMsg(e));t.disabled=false}},
 async qcancel(t){if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Conferma annullamento';return}try{const {error}=await S.sb.rpc('annulla_richiesta',{rid:t.dataset.id});if(error)throw error;await loadAll();toast('Richiesta annullata')}catch(e){toast(errMsg(e))}},
 'auth-mode'(t){S.authMode=t.dataset.id;S.authMsg='';render()},
 async logout(){S.page=null;await S.sb.auth.signOut()},
 open(t){S.cur=t.dataset.id;S.view='fascicolo';S.tab='documenti';S.sez='tutti';S.q='';S.selMode=false;S.sel.clear();render();scrollTo(0,0)},
 lista(){openLista()},
 vup(t){closeModal();openUpload({voce:t.dataset.id})},
 vreq(t){closeModal();S.tab='servizi';render();setTimeout(()=>{const b=document.querySelector(`[data-act=req][data-id="${t.dataset.id}"]`);if(b)b.click()},50)},
 async vna(t){const i=S.data.immobili[S.cur],na=new Set(i.vociNa||[]),id=t.dataset.id;na.has(id)?na.delete(id):na.add(id);
   try{await write(S.sb.from('immobili').update({voci_na:[...na]}).eq('id',i.id));i.vociNa=[...na];openLista()}catch(e){toast(errMsg(e))}},
 qpreset(t){const set=SEZ_DEFAULT[t.dataset.id]||[];document.querySelectorAll('#modal input[name=sezioni]').forEach(c=>c.checked=set.includes(c.value));document.querySelectorAll('#modal [data-act=qpreset]').forEach(b=>b.setAttribute('aria-pressed',b===t))},
 scan(t){openScan(t.dataset.id==='manual')},
 selmode(){S.selMode=!S.selMode;S.sel.clear();render()},
 pick(t){const id=t.dataset.id;S.sel.has(id)?S.sel.delete(id):S.sel.add(id);render()},
 selall(){const i=S.data.immobili[S.cur],a=acc(S.cur),q=S.q.trim().toLowerCase();
   const ds=docsOf(i.id,a).filter(d=>d.filePath&&(S.sez==='tutti'||d.sezione===S.sez)&&(!q||(d.titolo+' '+(d.note||'')+' '+(d.fileName||'')).toLowerCase().includes(q)));
   if(ds.length&&ds.every(d=>S.sel.has(d.id)))ds.forEach(d=>S.sel.delete(d.id));else ds.forEach(d=>S.sel.add(d.id));render()},
 share(t){openShare(t.dataset.id?[t.dataset.id]:[...S.sel])},
 async gshare(){const s=S.lastShare;if(!s)return;try{await navigator.share({title:'Casa ID',text:s.text,url:s.url})}catch(e){}},
 pstart(){openPassaggio()},
 async pcancel(t){if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Conferma annullamento';return}
   try{const {error}=await S.sb.rpc('annulla_passaggio',{pid:t.dataset.id});if(error)throw error;await loadAll();toast('Passaggio annullato')}catch(e){toast(errMsg(e))}},
 paccept(t){openAccept(t.dataset.id)},
 async prefuse(t){if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='Conferma rifiuto';return}
   try{const {error}=await S.sb.rpc('rispondi_passaggio',{pid:t.dataset.id,accetta:false});if(error)throw error;await loadAll();toast('Passaggio rifiutato')}catch(e){toast(errMsg(e))}},
 async pconfirm(t){busy(t,'Un momento…');const {data,error}=await S.sb.rpc('rispondi_passaggio',{pid:t.dataset.id,accetta:true});
   if(error){busy(t);toast(errMsg(error));return}
   await loadAll();closeModal();S.cur=data;S.view='fascicolo';S.tab='documenti';S.sez='tutti';render();scrollTo(0,0);toast('Ora sei titolare del fascicolo')},
 incarichi(){S.view='incarichi';S.cur=null;render()},
 tab(t){if(!$('#modal').hidden)closeModal();S.tab=t.dataset.id;S.selMode=false;S.sel.clear();render()},
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
       caricato_da:u.id,caricato_ruolo:u.ruolo,stato:PROF.includes(u.ruolo)?'verificato':'caricato',...(f.voce&&f.voce.value?{voce:f.voce.value}:{}),...meta};
     const {data,error}=await S.sb.from('documenti').insert(row).select('id').single();if(error)throw error;
     if(f.richiestaId.value){await write(S.sb.from('richieste').update({stato:'consegnata',documento_id:data.id,consegnata_il:now()}).eq('id',f.richiestaId.value));evento(imId,`ha consegnato: ${titolo}`)}
     else evento(imId,`ha caricato «${titolo}» in ${SEZN[f.sezione.value]}`);
     reloadSoon();closeModal();toast(f.richiestaId.value?'Pratica consegnata nel fascicolo':'Documento caricato');
   }catch(e){showErr('u-err',errMsg(e));busy(ok)}},
 async quote(f){const v=parseFloat(String(f.importo.value).replace(',','.'));if(!(v>=0)){showErr('q-err','Indica l\'importo totale in euro.');return}
   const b=$('#q-ok');busy(b,'Invio…');const {error}=await S.sb.rpc('invia_preventivo',{rid:f.rid.value,p_importo:v,p_note:f.note.value.trim()});
   if(error){busy(b);showErr('q-err',errMsg(error));return}await loadAll();closeModal();toast('Preventivo inviato al cliente')},
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
 async qrgen(f){const sez=[...f.querySelectorAll('input[name=sezioni]:checked')].map(c=>c.value),giorni=+f.giorni.value;
   if(!sez.length){showErr('c-err','Scegli almeno una sezione.');return}
   const b=$('#c-ok');busy(b,'Genero…');
   const {data,error}=await S.sb.rpc('crea_collegamento',{imm:S.cur,p_sezioni:sez,p_giorni:giorni});
   if(error){busy(b);showErr('c-err',errMsg(error));return}
   evento(S.cur,`ha generato un QR code di collegamento (${sez.map(s=>SEZN[s]).join(', ')}, ${giorni} giorni)`);showQr(data,sez,giorni)},
 scan(f){const c=normCode(f.codice.value);if(!c){showErr('s-err','Il codice ha 10 caratteri tra lettere e numeri, per esempio ABCDE-FGHJK.');return}Q.busy=true;redeem(c)},
 async share(f){const et=f.etichetta.value.trim(),giorni=+f.giorni.value,ds=S.shareIds.map(id=>S.data.documenti[id]).filter(Boolean);
   if(!et){showErr('sh-err','Scrivi per chi è il link.');return}if(!ds.length)return;
   const id=rid(14),imId=ds[0].immobileId,sez=[...new Set(ds.map(d=>d.sezione))],what=ds.length===1?`il documento «${ds[0].titolo}»`:`${ds.length} documenti`;
   const b=$('#sh-ok');busy(b,'Creo il link…');
   try{await write(S.sb.from('condivisioni').insert({id,immobile_id:imId,etichetta:et,sezioni:sez,documenti:ds.map(d=>d.id),scadenza:addDays(giorni),creato_da:S.session.user.id}));
     evento(imId,`ha condiviso ${what} con «${et}» (${giorni===2?'48 ore':giorni+' giorni'})`);S.selMode=false;S.sel.clear();render();linkReady(id,what,addDays(giorni))}
   catch(e){busy(b);showErr('sh-err',errMsg(e))}},
 async passaggio(f){const email=f.email.value.trim().toLowerCase();
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){showErr('p-err','Scrivi l\'email del nuovo proprietario.');return}
   if(!f.ok1.checked||!f.ok2.checked){showErr('p-err','Conferma le due dichiarazioni prima di avviare il passaggio.');return}
   const b=$('#p-ok');busy(b,'Avvio…');
   const {error}=await S.sb.rpc('avvia_passaggio',{imm:S.cur,p_email:email,p_data:f.dataAtto.value||null});
   if(error){busy(b);showErr('p-err',errMsg(error));return}
   await loadAll();closeModal();toast(userByEmail(email)?'Passaggio avviato: il nuovo proprietario deve accettarlo':'Passaggio avviato: lo troverà appena si registra con questa email')},
 async glink(f){const sez=[...f.querySelectorAll('input[name=sezioni]:checked')].map(c=>c.value),et=f.etichetta.value.trim();
   if(!et||!sez.length){showErr('g-err',!et?'Scrivi per chi è il link.':'Scegli almeno una sezione.');return}
   const id=rid(14),giorni=+f.giorni.value;
   try{await write(S.sb.from('condivisioni').insert({id,immobile_id:S.cur,etichetta:et,sezioni:sez,scadenza:addDays(giorni),creato_da:S.session.user.id}));
     evento(S.cur,`ha creato il link «${et}» (${giorni} giorni)`);linkReady(id,`le sezioni ${sez.map(s=>SEZN[s]).join(', ')}`,addDays(giorni))}
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
   const prof=vals('accessi').filter(x=>x.immobileId===S.cur&&x.livello==='professionista'&&!(x.scadenza&&daysTo(x.scadenza)<0)).map(x=>userByEmail(x.email)).find(u=>u&&u.ruolo===s.r);
   try{await write(S.sb.from('richieste').insert({immobile_id:S.cur,servizio:s.id,sezione:s.sez,ruolo_richiesto:s.r,note:f.note.value.trim()||null,richiesto_da:S.session.user.id,assegnato_a:prof?prof.id:null,stato:'inviata'}));
     evento(S.cur,`ha chiesto un preventivo per: ${s.n}${prof?' a '+prof.nome:''}`);closeModal();toast(prof?`Richiesta inviata a ${prof.nome}: riceverai il preventivo qui`:'Richiesta inviata: riceverai il preventivo qui')}
   catch(e){toast(errMsg(e))}}
};
document.addEventListener('submit',e=>{const f=e.target;if(f.dataset.form&&F[f.dataset.form]){e.preventDefault();F[f.dataset.form](f)}});

boot();
