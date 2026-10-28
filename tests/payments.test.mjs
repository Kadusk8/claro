import test from 'node:test';
import assert from 'node:assert/strict';
import {config,cookie,order,asaas,createTestPayment,publicPayment,validatePayment,failure} from '../lib/payments.mjs';
process.env.VERCEL_ENV='preview';
process.env.ASAAS_API_KEY='synthetic-sandbox-key';
const payment={id:'pay_test',externalReference:'order-test',value:19.9,billingType:'PIX',status:'PENDING'};
test('production is blocked and missing keys are diagnosed',()=>{
 process.env.VERCEL_ENV='production';assert.throws(config,/PREVIEW_REQUIRED/);process.env.VERCEL_ENV='preview';delete process.env.ASAAS_API_KEY;assert.throws(config,/TOKEN_MISSING/);process.env.ASAAS_API_KEY='synthetic-sandbox-key';
});
test('sessions reject tampering and expired signatures',()=>{
 let header;const res={setHeader:(_,v)=>header=v};const data={id:'order-test',expires:Date.now()+10000};cookie(res,data);const raw=header.split(';')[0];assert.deepEqual(order({headers:{cookie:raw}}),data);assert.equal(order({headers:{cookie:raw+'x'}}),null);cookie(res,{...data,expires:0});assert.equal(order({headers:{cookie:header.split(';')[0]}}),null);
});
test('financial fields and reference must match',()=>{
 for(const change of [{value:1},{billingType:'BOLETO'},{externalReference:'other'},{deleted:true}])assert.throws(()=>validatePayment({...payment,...change},'order-test'),/PAYMENT_MISMATCH/);
});
test('only sandbox endpoints are contacted and secrets are not forwarded in errors',async()=>{
 const original=globalThis.fetch;try{
  globalThis.fetch=async(url,options)=>{assert.ok(url.startsWith('https://api-sandbox.asaas.com/v3/'));assert.equal(options.headers.access_token,'synthetic-sandbox-key');return {ok:false,status:401,json:async()=>({errors:[{code:'invalid_access_token',description:'SECRET_CONTENT'}]})};};
  let error;try{await asaas('/customers');}catch(e){error=e;}
  let body;failure({status(n){assert.equal(n,502);return this;},json(v){body=v;}},error);assert.equal(body.code,'ASAAS_CUSTOMER_401');assert.ok(!JSON.stringify(body).includes('SECRET_CONTENT'));
  await assert.rejects(asaas('https://api.asaas.com/v3/payments'),/INVALID_PATH/);
 }finally{globalThis.fetch=original;}
});
test('existing payments are reused, duplicates stop creation',async()=>{
 const original=globalThis.fetch;try{
  let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({data:[payment]})};};assert.equal((await createTestPayment({},'order-test')).id,payment.id);assert.equal(calls,1);
  globalThis.fetch=async()=>({ok:true,json:async()=>({data:[payment,payment]})});await assert.rejects(createTestPayment({},'order-test'),/DUPLICATE_PAYMENT/);
 }finally{globalThis.fetch=original;}
});
test('new sandbox charge uses server price and reference, then QR payload',async()=>{
 const original=globalThis.fetch;try{
  const calls=[];globalThis.fetch=async(url,options)=>{
   calls.push({url,options});let data;
   if(url.includes('externalReference='))data={data:[]};
   else if(url.endsWith('/customers'))data={id:'cus_test'};
   else if(url.endsWith('/pixQrCode'))data={payload:'synthetic-pix-payload',expirationDate:'2030-01-01'};
   else data=payment;
   return {ok:true,json:async()=>data};
  };
  const result=await createTestPayment({name:'Teste',email:'teste@example.com',cpf:'00000000000'},'order-test');
  const payload=JSON.parse(calls.find(c=>c.url.endsWith('/payments')).options.body);assert.equal(payload.value,19.9);assert.equal(payload.billingType,'PIX');assert.equal(payload.externalReference,'order-test');assert.match(payload.dueDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal((await publicPayment(result,'order-test')).code,'synthetic-pix-payload');
  const count=calls.length;assert.deepEqual(await publicPayment({...payment,status:'RECEIVED'},'order-test'),{status:'approved',code:null});assert.equal(calls.length,count);
 }finally{globalThis.fetch=original;}
});
