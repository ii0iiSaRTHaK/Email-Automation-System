const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { generateDraft, baseDraft } = require('./support-agent');

try {
  const envFile=path.join(__dirname,'.env');
  if(fs.existsSync(envFile)) for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){
    const match=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if(match && !Object.hasOwn(process.env,match[1])) process.env[match[1]]=match[2].replace(/^(["'])(.*)\1$/,'$2');
  }
} catch {}

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'demo site');
const flows = [
  { id: 'welcome', name: 'A good first page', trigger: 'New subscriber joins', key: 'signup', delay: 'Immediately', subject: 'Welcome to Fieldnote — your first page is on us', preheader: 'A small thank-you for joining our little paper shop.', body: (e) => `Hi ${e.name},\n\nThanks for joining Fieldnote Supply. We make thoughtful paper goods for everyday notes, plans and ideas.\n\nHere is 10% off your first order: FIRSTPAGE10\n\nTake a look around, and find a page worth filling.\n\n— The Fieldnote team`, cta: 'Shop paper goods', color: '#55735f' },
  { id: 'order', name: 'Order in good hands', trigger: 'Order is placed', key: 'order.placed', delay: 'Immediately', subject: (e) => `Order ${e.orderId} is on its way to our packing table`, preheader: 'We have your order. Here is what happens next.', body: (e) => `Hi ${e.name},\n\nYour order ${e.orderId} is confirmed. We are getting your paper goods ready with care.\n\nOrder total: $${Number(e.total).toFixed(2)}\n\nWe will send another note as soon as your parcel is on its way. Thanks for choosing Fieldnote.\n\n— The Fieldnote team`, cta: 'View your order', color: '#55735f' },
  { id: 'shipped', name: 'Your parcel is on its way', trigger: 'Order is dispatched', key: 'order.shipped', delay: 'When tracking is ready', subject: (e) => `A little Fieldnote parcel is headed your way`, preheader: 'Your tracking details are ready.', body: (e) => `Hi ${e.name},\n\nOrder ${e.orderId} has left our packing table. ${e.tracking ? `Track your parcel: ${e.tracking}` : 'Your tracking link will be available in your order details.'}\n\nThanks for making room for Fieldnote.\n\n— The Fieldnote team`, cta: 'Track your parcel', color: '#55735f' },
  { id: 'return', name: 'We received your return', trigger: 'Return is received', key: 'return.received', delay: 'After inspection', subject: (e) => `An update on return ${e.orderId}`, preheader: 'Your return has arrived at Fieldnote.', body: (e) => `Hi ${e.name},\n\nWe have received the return for order ${e.orderId}. Our team will inspect it and email you with the next update. If a refund is approved, it goes to your original payment method; banks may take 5–10 business days to post it.\n\nQuestions? Reply to this email and our team will help.\n\n— The Fieldnote team`, cta: 'Contact support', color: '#55735f' },
  { id: 'cart', name: 'A note about your basket', trigger: 'Cart is left for 1 hour', key: 'cart.abandoned', delay: '1 hour', subject: 'Still thinking it over? Your basket is saved', preheader: 'Your picks are here whenever you are ready.', body: (e) => `Hi ${e.name},\n\nYou left a few good things in your basket. We saved them here so you can pick up where you left off.\n\n${e.items || 'Your Fieldnote paper goods'}\n\nNo rush. Your next great idea can wait until you are ready.\n\n— The Fieldnote team`, cta: 'Return to your basket', color: '#55735f' },
  { id: 'winback', name: 'A page for what is next', trigger: 'No order for 60 days', key: 'customer.dormant', delay: '60 days', subject: 'It has been a little while, ${name}', preheader: 'A fresh page, whenever you need one.', body: (e) => `Hi ${e.name},\n\nWe hope the pages you picked up are serving you well. If you are ready for something new, we have added a few thoughtful things to the shop.\n\nTake 10% off your next order with AGAIN10.\n\n— The Fieldnote team`, cta: 'See what is new', color: '#55735f' }
];
const events = [];
const supportCases = [];
const counts = { sent: 0, queued: 0, skipped: 0 };
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

function reply(res, code, data, type='application/json; charset=utf-8') { res.writeHead(code, { 'content-type': type }); res.end(type.includes('json') ? JSON.stringify(data) : data); }
function authorizedWebhook(req) {
  const secret=process.env.WEBHOOK_SECRET;
  if(!secret) return process.env.NODE_ENV !== 'production';
  const provided=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const expectedBuffer=Buffer.from(secret); const providedBuffer=Buffer.from(provided);
  return expectedBuffer.length===providedBuffer.length && crypto.timingSafeEqual(expectedBuffer,providedBuffer);
}
function readBody(req) { return new Promise((resolve, reject) => { let raw=''; req.on('data', c=>{ raw+=c; if(raw.length>1e6) reject(new Error('Payload too large')); }); req.on('end',()=>{ try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Send valid JSON')); } }); req.on('error',reject); }); }
function renderEmail(flow, event) {
  const subject = typeof flow.subject === 'function' ? flow.subject(event) : flow.subject.replace('${name}', event.name);
  const body = flow.body(event);
  return { subject, preheader: flow.preheader, text: body, html: `<!doctype html><html><body style="margin:0;background:#f4f2eb;font-family:Arial,sans-serif;color:#27332c"><main style="max-width:600px;margin:32px auto;background:white;padding:44px"><p style="font-size:14px;letter-spacing:2px;color:#55735f">FIELDNOTE SUPPLY</p><h1 style="font-family:Georgia,serif;font-size:34px;font-weight:400">A little room for good ideas.</h1><p style="color:#718078">${flow.preheader}</p><div style="white-space:pre-line;line-height:1.7;margin:32px 0">${body.replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</div><a href="#" style="display:inline-block;background:#55735f;color:#fff;padding:14px 20px;text-decoration:none">${flow.cta}</a><p style="font-size:12px;color:#718078;margin-top:40px">Fieldnote Supply · Thoughtful paper for everyday life<br><a href="#">Unsubscribe</a></p></main></body></html>` };
}
function validateEvent(input) {
  const type = String(input.type || input.event || '');
  const aliases = { subscriber_created:'signup', 'subscriber.created':'signup', 'signup':'signup', order_placed:'order.placed', 'order.placed':'order.placed', order_shipped:'order.shipped', 'order.shipped':'order.shipped', return_received:'return.received', 'return.received':'return.received', abandoned_cart:'cart.abandoned', 'cart.abandoned':'cart.abandoned', customer_dormant:'customer.dormant' };
  const key = aliases[type] || type;
  const flow = flows.find(f=>f.key===key);
  if (!flow) return { error: `No active flow is mapped to event "${type}".` };
  const name = String(input.name || input.customer_name || 'Fieldnote friend').trim().slice(0,80);
  const email = String(input.email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'A valid customer email is required.' };
  const event = { id: `FN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`, type:key, name, email, orderId:String(input.orderId||input.order_id||'FN-2048').slice(0,32), total:Number(input.total ?? input.order_total ?? 42.5), items:String(input.items||'A5 linen notebook · Forest green').slice(0,300), createdAt:new Date().toISOString() };
  event.tracking = String(input.tracking || '').slice(0,300);
  if (!Number.isFinite(event.total) || event.total < 0) return { error: 'Order total must be zero or more.' };
  return { flow, event, email:renderEmail(flow,event) };
}
async function handleInbound(input) {
  const from = String(input.from || input.email || input.sender || '').trim();
  const text = String(input.text || input.body || input.plainText || '').trim().slice(0,6000);
  const subject = String(input.subject || '').trim().slice(0,180);
  const name = String(input.name || input.fromName || '').trim().slice(0,80);
  if (!/^\S+@\S+\.\S+$/.test(from)) return { error:'A valid sender email address is required.' };
  if (!text) return { error:'The incoming email body is required.' };
  const sourceMessageId=String(input.messageId||input.message_id||'').trim().slice(0,180);
  if(sourceMessageId){const prior=supportCases.find(c=>c.sourceMessageId===sourceMessageId);if(prior)return {case:prior,duplicate:true,message:'This message already has a support draft.'};}
  try {
    const draft = await generateDraft({from,text,subject,name});
    const record={id:`SUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,sourceMessageId,from,name,subject,text,category:draft.category,replySubject:draft.subject,replyBody:draft.body,reviewRequired:draft.reviewRequired,autoSendEligible:false,generatedBy:draft.generatedBy,status:'draft_for_review',createdAt:new Date().toISOString()};
    supportCases.unshift(record);
    return { case:record, message:'Support email classified and a reply draft was created. It requires a person to review before sending.' };
  } catch (error) {
    const safeDraft=baseDraft({from,text,subject,name});
    const record={id:`SUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,sourceMessageId,from,name,subject,text,category:safeDraft.category,replySubject:safeDraft.subject,replyBody:safeDraft.body,reviewRequired:true,autoSendEligible:false,generatedBy:'store-policy fallback after AI error',status:'draft_for_review',createdAt:new Date().toISOString()};
    supportCases.unshift(record);
    return { case:record, warning:'AI was unavailable; a policy fallback draft was created for review.' };
  }
}
function handleEvent(input) {
  const result = validateEvent(input);
  if (result.error) return result;
  const sourceEventId=String(input.eventId||input.event_id||input.idempotencyKey||'').trim().slice(0,180);
  if(sourceEventId){const prior=events.find(e=>e.sourceEventId===sourceEventId);if(prior)return {event:prior,duplicate:true,message:'This store event was already composed.'};}
  const record = { ...result.event, sourceEventId, flowId:result.flow.id, flowName:result.flow.name, subject:result.email.subject, preheader:result.email.preheader, text:result.email.text, html:result.email.html, status:'queued', provider:'Demo outbox' };
  events.unshift(record); counts.queued++;
  return { event:record, message:'Email composed and added to the demo outbox.' };
}
const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if(url.pathname.startsWith('/webhooks/') && !authorizedWebhook(req)) return reply(res,401,{error:'A valid webhook bearer token is required.'});
  if(req.method==='OPTIONS'){ res.writeHead(204); return res.end(); }
  if(req.method==='GET' && url.pathname==='/api/state') return reply(res,200,{ store:'Fieldnote Supply', flows:flows.map(({body,subject,...f})=>({...f,subject:typeof subject==='function'?subject({name:'Jamie Rivera',orderId:'FN-2048'}):subject})), events, supportCases, ai:{provider:'OpenAI Responses API',configured:Boolean(process.env.OPENAI_API_KEY)}, counts });
  if(req.method==='DELETE' && url.pathname==='/api/events'){ events.length=0; counts.queued=0; return reply(res,200,{ok:true}); }
  if(req.method==='DELETE' && url.pathname==='/api/support'){ supportCases.length=0; return reply(res,200,{ok:true}); }
  if(req.method==='POST' && (url.pathname==='/api/inbound' || /^\/webhooks\/(n8n|make|zapier)\/inbound$/.test(url.pathname))){
    try { const input=await readBody(req); const result=await handleInbound(input); return reply(res,result.error?400:201,result); } catch(e){ return reply(res,400,{error:e.message}); }
  }
  if(req.method==='POST' && (url.pathname==='/api/events' || url.pathname.startsWith('/webhooks/'))){
    try { const input=await readBody(req); const result=handleEvent(input); return reply(res,result.error?400:201,result); } catch(e){ return reply(res,400,{error:e.message}); }
  }
  if(req.method==='GET' && url.pathname.startsWith('/api/email/')) { const id=decodeURIComponent(url.pathname.split('/').pop()); const record=events.find(e=>e.id===id); if(record)return reply(res,200,{subject:record.subject,preheader:record.preheader,text:record.text,html:record.html}); const support=supportCases.find(c=>c.id===id); return support?reply(res,200,{subject:support.replySubject,preheader:'Support reply draft · review before sending',text:support.replyBody,html:`<!doctype html><html><body style="font-family:Arial,sans-serif;white-space:pre-line;line-height:1.6;padding:32px;color:#26332c"><p>${support.replyBody.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p><small>Draft only. Review in the connected email platform before sending.</small></body></html>`}):reply(res,404,{error:'Email not found'}); }
  let file=path.join(ROOT, url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));
  if(!file.startsWith(ROOT)){ return reply(res,403,'Forbidden','text/plain'); }
  fs.readFile(file,(err,data)=>err?reply(res,404,'Not found','text/plain'):reply(res,200,data,mime[path.extname(file)]||'application/octet-stream'));
});
server.listen(PORT,()=>console.log(`Fieldnote Supply is ready at http://localhost:${PORT}`));
