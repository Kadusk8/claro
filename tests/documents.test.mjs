import test from 'node:test';
import assert from 'node:assert/strict';
import {cookie} from '../lib/payments.mjs';
import {paidOrder,storageConfig,privateBucket,validateDocument,saveDocument,MAX_FILE_BYTES} from '../lib/documents.mjs';
import handler from '../api/documents.mjs';
process.env.VERCEL_ENV='preview';process.env.ASAAS_API_KEY='synthetic-sandbox-key';
const session={id:'order-test',payment:'pay_test',expires:Date.now()+60000};
let header;cookie({setHeader:(_,v)=>header=v},session);
const req={method:'GET',headers:{cookie:header.split(';')[0]}};
const payment={id:'pay_test',externalReference:session.id,value:19.9,billingType:'PIX',status:'RECEIVED'};
const body={kind:'contract',synthetic:true,base64:Buffer.from('%PDF-1.4\nsynthetic test fixture\n%%EOF').toString('base64')};
test('valid paid order required; absent or tampered session makes no provider request',async()=>{
 const original=globalThis.fetch;try{let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>payment};};
 await assert.rejects(paidOrder({headers:{}}),e=>e.status===401);await assert.rejects(paidOrder({headers:{cookie:req.headers.cookie+'x'}}),e=>e.status===401);assert.equal(calls,0);
 assert.equal((await paidOrder(req)).id,session.id);
 }finally{globalThis.fetch=original;}
});
test('unpaid, refunded and mismatched payment cannot reach storage',async()=>{
 const original=globalThis.fetch;try{for(const change of [{status:'PENDING'},{status:'REFUNDED'},{value:1},{externalReference:'other'}]){
 let calls=0;globalThis.fetch=async(url)=>{calls++;assert.ok(url.startsWith('https://api-sandbox.asaas.com/'));return {ok:true,json:async()=>({...payment,...change})};};
 let status;await handler(req,{setHeader(){},status(v){status=v;return this;},json(){}});assert.ok(status>=400);assert.equal(calls,1);
 }}finally{globalThis.fetch=original;}
});
test('only limited synthetic PDFs are accepted',()=>{
 assert.equal(validateDocument(body).kind,'contract');
 for(const change of [{synthetic:false},{kind:'other'},{base64:'evil'},{base64:Buffer.from('not a pdf').toString('base64')},{base64:Buffer.alloc(MAX_FILE_BYTES+1).toString('base64')}])assert.throws(()=>validateDocument({...body,...change}));
});
test('storage is required and must be a private bucket',async()=>{
 delete process.env.SUPABASE_URL;assert.throws(storageConfig,/armazenamento privado/);
 process.env.SUPABASE_URL='https://synthetic.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-server-key';
 const original=globalThis.fetch;try{globalThis.fetch=async()=>({ok:true,json:async()=>({id:'contracts-quarantine',public:true})});await assert.rejects(privateBucket(),e=>e.code==='PRIVATE_BUCKET_REQUIRED');}finally{globalThis.fetch=original;}
});
test('upload uses server namespace and no original file name, with no upsert',async()=>{
 const original=globalThis.fetch;try{let stored=false;globalThis.fetch=async(url,options)=>{
 assert.equal(options.headers.Authorization,'Bearer synthetic-server-key');
 if(url.includes('/bucket/'))return {ok:true,json:async()=>({id:'contracts-quarantine',public:false})};
 if(url.includes('/object/list/')){assert.equal(JSON.parse(options.body).prefix,'order-test/');return {ok:true,json:async()=>[]};}
 assert.match(url,/\/order-test\/contract-[a-f0-9-]+\.pdf$/);assert.equal(options.headers['x-upsert'],'false');assert.equal(options.headers['Content-Type'],'application/pdf');stored=true;return {ok:true,json:async()=>({Key:'ignored'})};};
 assert.deepEqual(await saveDocument(session,{...body,filename:'sensitive-name.pdf',orderId:'other'}),{kind:'contract',status:'quarantined'});assert.equal(stored,true);
 }finally{globalThis.fetch=original;}
});
test('paid users see setup state when storage is not configured',async()=>{
 const original=globalThis.fetch;delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 try{globalThis.fetch=async()=>({ok:true,json:async()=>payment});let status,result;await handler(req,{setHeader(){},status(v){status=v;return this;},json(v){result=v;}});assert.equal(status,200);assert.equal(result.ready,false);assert.equal(result.documents.length,0);}finally{globalThis.fetch=original;}
});
