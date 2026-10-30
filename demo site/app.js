const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const glyphs = {welcome:'+',order:'↗',shipped:'↗',return:'↩',cart:'⌑',winback:'↻'};
const recipes = [
  {name:'Subscriber lifecycle',tools:'Zapier · Shopify · email provider',starts:'Opt-in, abandoned checkout, or 60 days without an order.',action:'Send the welcome note immediately. For reminders, wait, then re-check consent and current order/cart state before sending.',route:'POST /webhooks/zapier',status:'Composer ready · platform connection required'},
  {name:'Order and return updates',tools:'Make · Shopify · email provider',starts:'Order placed, fulfillment dispatched, or return received.',action:'Route each store event to its matching confirmation, tracking, or return update. Map the returned HTML and subject into the mail provider.',route:'POST /webhooks/make',status:'Composer ready · platform connection required'},
  {name:'Customer support triage',tools:'n8n · Gmail · optional OpenAI',starts:'A new customer email reaches the support mailbox.',action:'Classify with the store policy, create a Gmail reply draft, and flag billing, order lookups, and exceptions for a human review.',route:'POST /webhooks/n8n/inbound',status:'Support API ready · mailbox credentials required'}
];
let state={flows:[],events:[],counts:{queued:0}}, lastEmail='';
const escapeHTML=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function timeLabel(date){return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(date));}
function flowRow(f){return `<div class="flow-row"><div class="flow-name"><span class="flow-icon">${glyphs[f.id]}</span><div><b>${escapeHTML(f.name)}</b><small>${escapeHTML(f.trigger)}</small></div></div><div class="row-meta">${escapeHTML(f.delay)}<small>Timing rule</small></div><span class="state-pill">Preview ready</span><button class="row-action" data-test="${escapeHTML(f.key)}">Try flow →</button></div>`;}
function render(){
  $('#flowCount').textContent=state.flows.length;
  $('#emailCount').textContent=state.counts.queued||0;
  $('#aiStatus').textContent=state.ai?.configured?'OPENAI DRAFTS · REVIEW REQUIRED':'POLICY FALLBACK · DRAFTS ONLY';
  $('#flowTable').innerHTML=state.flows.map(flowRow).join('');
  $('#flowCards').innerHTML=state.flows.map(f=>`<article class="flow-card"><span class="flow-icon">${glyphs[f.id]}</span><div><h2>${escapeHTML(f.name)}</h2><p>${escapeHTML(f.trigger)} <span>·</span> ${escapeHTML(f.delay)}</p><div class="flow-subject">Subject: ${escapeHTML(f.subject)}</div></div><button class="row-action" data-test="${escapeHTML(f.key)}">Try →</button></article>`).join('');
  $('#recipes').innerHTML=recipes.map(r=>`<article class="recipe"><div class="recipe-top"><h3>${r.name}</h3><span>${r.tools}</span></div><dl><div><dt>Starts when</dt><dd>${r.starts}</dd></div><div><dt>Workflow action</dt><dd>${r.action}</dd></div></dl><code>${r.route}</code><small class="recipe-status">${r.status}</small></article>`).join('');
  const recent=state.events.slice(0,3);
  $('#recentList').innerHTML=recent.length?recent.map(e=>`<div class="recent-item"><div><b>${escapeHTML(e.flowName)} · ${escapeHTML(e.name)}</b><small>${escapeHTML(e.email)} · ${timeLabel(e.createdAt)}</small></div><button class="row-action" data-email="${escapeHTML(e.id)}">Preview →</button></div>`).join(''):'<div class="empty-state">Your first automation is one test event away.</div>';
  $('#activityTotal').textContent=`${state.events.length} ${state.events.length===1?'event':'events'}`;
  $('#activityList').innerHTML=state.events.length?state.events.map(e=>`<div class="activity-row"><time>${timeLabel(e.createdAt)}</time><b>${escapeHTML(e.flowName)}<small style="display:block;color:#78837b;font-weight:400;margin-top:4px">${escapeHTML(e.type)}</small></b><span class="email-subject">${escapeHTML(e.subject)}</span><button class="row-action" data-email="${escapeHTML(e.id)}">Preview →</button></div>`).join(''):'<div class="empty-activity">No events yet. Run a test event to see an email draft appear here.</div>';
  const cases=state.supportCases||[];
  $('#supportSummary').textContent=cases.length?`${cases.length} incoming ${cases.length===1?'message':'messages'} · ${cases.filter(c=>c.reviewRequired).length} need a human review. Replies are drafts, never auto-sent.`:'New questions are classified and drafted against Fieldnote’s store policies. A person reviews every reply.';
  $('#supportList').innerHTML=cases.length?cases.map(c=>`<article class="support-case"><b>${escapeHTML(c.replySubject)}</b><span class="${c.reviewRequired?'review-pill':'policy-pill'}">${c.reviewRequired?'Human review':'Policy draft'}</span><span class="case-from">${escapeHTML(c.name||c.from)} · ${escapeHTML(c.category.replaceAll('_',' '))} · ${escapeHTML(c.generatedBy)}</span><span class="case-question">${escapeHTML(c.text)}</span><div class="case-actions"><button class="row-action" data-email="${escapeHTML(c.id)}">Review draft →</button></div></article>`).join(''):'<div class="empty-state">No customer questions yet. Try the return-policy example.</div>';
}
async function refresh(){try{const r=await fetch('/api/state');state=await r.json();render();}catch(e){console.error(e)}}
function showView(view){$$('.page').forEach(el=>el.classList.toggle('hidden',el.id!==`view-${view}`));$$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));$('#crumb').textContent=view[0].toUpperCase()+view.slice(1);location.hash=view;}
function openForm(type){const form=$('#eventForm');form.reset();form.elements.name.value='Jamie Rivera';form.elements.email.value='jamie.rivera@fieldnote.store';form.elements.orderId.value='FN-2048';form.elements.total.value='42.50';form.elements.items.value='A5 linen notebook · Forest green';if(type)form.elements.type.value=type;$('#formError').textContent='';$('#eventDialog').showModal();}
async function showEmail(id){const r=await fetch(`/api/email/${encodeURIComponent(id)}`);if(!r.ok)return;const e=await r.json();lastEmail=e.text;$('#emailTitle').textContent=e.subject;$('#emailTo').textContent=e.preheader;$('#emailFrame').srcdoc=e.html;$('#emailDialog').showModal();}
document.addEventListener('click',async e=>{
  const view=e.target.closest('[data-view]'); if(view){showView(view.dataset.view);return;}
  const go=e.target.closest('[data-goto]');if(go){showView(go.dataset.goto);return;}
  const test=e.target.closest('[data-test]');if(test){openForm(test.dataset.test);return;}
  const preview=e.target.closest('[data-email]');if(preview){showEmail(preview.dataset.email);return;}
  if(e.target.id==='newEvent'||e.target.id==='newEvent2')openForm();
});
$('#eventForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));data.total=Number(data.total);$('#formError').textContent='';try{const r=await fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok){$('#formError').textContent=result.error||'Could not compose this email.';return;}$('#eventDialog').close();await refresh();showEmail(result.event.id);}catch(err){$('#formError').textContent='Could not reach the local server. Is it still running?';}});
$('#inboundForm').addEventListener('submit',async e=>{e.preventDefault();$('#inboundError').textContent='';const data=Object.fromEntries(new FormData(e.target));try{const r=await fetch('/api/inbound',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok){$('#inboundError').textContent=result.error||'Could not create a reply draft.';return;}await refresh();showEmail(result.case.id);}catch(err){$('#inboundError').textContent='Could not reach the local server. Is it still running?';}});
$('#clearActivity').addEventListener('click',async()=>{if(!state.events.length)return;await fetch('/api/events',{method:'DELETE'});await refresh();});
$('#clearSupport').addEventListener('click',async()=>{if(!state.supportCases?.length)return;await fetch('/api/support',{method:'DELETE'});await refresh();});
$('#emailClose').addEventListener('click',()=>$('#emailDialog').close());
$('#copyEmail').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(lastEmail);$('#copyEmail').textContent='Copied';setTimeout(()=>$('#copyEmail').textContent='Copy plain text',1400);}catch{$('#copyEmail').textContent='Clipboard unavailable';}});
window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(['overview','inbox','flows','activity'].includes(view))showView(view);});
if(['#overview','#inbox','#flows','#activity'].includes(location.hash))showView(location.hash.slice(1));
refresh();
