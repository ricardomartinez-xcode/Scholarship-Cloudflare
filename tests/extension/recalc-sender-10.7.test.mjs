import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const base = 'chrome-extension/variants/preview-first';

function createChrome(initial = {}) {
  const store = structuredClone(initial);
  const alarms = [];
  return {
    store,
    alarms,
    chrome: {
      storage: { local: {
        async get(keys) { const out={}; for (const k of keys) out[k]=store[k]; return out; },
        async set(values) { Object.assign(store, structuredClone(values)); },
        async remove(keys) { for (const k of keys) delete store[k]; },
      }},
      alarms: {
        async clear(name) { alarms.push({type:'clear',name}); return true; },
        async create(name, options) { alarms.push({type:'create',name,options}); },
      },
    },
  };
}

function loadRunner(initial = {}) {
  const env=createChrome(initial);
  const context={ self:{}, chrome:env.chrome, console, Date, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(`${base}/lib/campaigns/runCampaign.js`, 'utf8'), context);
  return {...env, runner:context.self.RecalcCampaignRunner};
}

{
  const key='recalc.activeCampaignRunner';
  const batch={campaign:{messageDelayMs:1200,batchDelayMs:9000},recipients:[{id:'r1'},{id:'r2'}]};
  const env=loadRunner({[key]:{runId:'run1',campaignId:'c1',paused:true,enabled:true,currentBatch:batch,currentIndex:1,appBaseUrl:'https://x',extensionSessionToken:'token'}});
  const resumed=await env.runner.runCampaign({campaignId:'c1',appBaseUrl:'https://x',extensionSessionToken:'token'});
  assert.equal(resumed.currentIndex,1,'resume must preserve current index');
  assert.equal(resumed.currentBatch.recipients[1].id,'r2','resume must preserve claimed batch');
  assert.equal(resumed.paused,false);
}

{
  const key='recalc.activeCampaignRunner';
  const batch={campaign:{campaignName:'test',messageDelayMs:1200,batchDelayMs:9000},recipients:[{id:'r1',contactValue:'5211'},{id:'r2',contactValue:'5212'}]};
  const env=loadRunner({[key]:{runId:'run2',campaignId:'c2',paused:false,enabled:true,busy:false,currentBatch:batch,currentIndex:0,appBaseUrl:'https://x',extensionSessionToken:'token'}});
  const deps={
    claimNextBatch:async()=>null, loadCampaignById:async()=>({status:'processing'}),
    reportDispatch:async()=>({status:'processing',campaignName:'test'}), resolveMessage:()=>'',
    getAttachmentsForCampaign:async()=>[{name:'x.png',type:'image/png'}], ensureWhatsAppTab:async()=>1,
    ensureWhatsAppBridge:async()=>{}, sendToWhatsApp:async()=>({success:true,delayMs:1200}),
  };
  await env.runner.processTick(deps);
  let state=env.store[key];
  assert.equal(state.currentIndex,1);
  assert.equal(state.lastDelayType,'message');
  let lastCreate=env.alarms.filter(x=>x.type==='create').at(-1);
  assert.ok(lastCreate.options.when-Date.now() < 2500,'message delay should be used inside batch');

  state.busy=false; env.store[key]=state;
  await env.runner.processTick(deps);
  state=env.store[key];
  assert.equal(state.currentIndex,2);
  assert.equal(state.lastDelayType,'batch');
  lastCreate=env.alarms.filter(x=>x.type==='create').at(-1);
  assert.ok(lastCreate.options.when-Date.now() > 8000,'batch delay should be used after last recipient');
}

{
  const source=fs.readFileSync(`${base}/lib/whatsapp/wa-attachments.js`,'utf8');
  assert.ok(source.includes('sticker_option_blocked'));
  assert.ok(source.includes('sticker_input_blocked'));
  assert.ok(!source.includes('return selectors.findAttachmentOptionByPosition(1)'));
  assert.ok(source.includes('return mime.startsWith("video/");'));
  assert.ok(!source.includes('|| mime.startsWith("audio/")'));
}

{
  const bg=fs.readFileSync(`${base}/background.js`,'utf8');
  assert.ok(bg.includes('{ url, active: false }'));
  assert.ok(bg.includes('"video/mp4"'));
  assert.ok(bg.includes('"video/webm"'));
}

console.log('PASS ReCalc Sender 10.7: resume, delays, media-only and anti-sticker guards');
