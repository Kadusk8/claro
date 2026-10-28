import test from 'node:test';
import assert from 'node:assert/strict';
import {config,cookie,order,publicPayment,failure,createTestPayment,mp} from '../lib/payments.mjs';
process.env.VERCEL_ENV='preview';
process.env.MERCADO_PAGO_ACCESS_TOKEN='TEST-synthetic-not-a-credential';
test('prefix does not determine account type; production deployments remain blocked',()=>{
 process.env.MERCADO_PAGO_ACCESS_TOKEN='APP_USR-synthetic';assert.equal(config(),'APP_USR-synthetic');
 process.env.MERCADO_PAGO_ACCESS_TOKEN='TEST-synthetic-not-a-credential';process.env.VERCEL_ENV='production';assert.throws(config);process.env.VERCEL_ENV='preview';
});
test('signed session rejects tampering and expiry',()=>{
 let header;const res={setHeader:(_,v)=>header=v};const data={id:'order-id',expires:Date.now()+10000};cookie(res,data);const raw=header.split(';')[0];assert.deepEqual(order({headers:{cookie:raw}}),data);assert.equal(order({headers:{cookie:raw+'x'}}),null);cookie(res,{...data,expires:Date.now()-1});assert.equal(order({headers:{cookie:header.split(';')[0]}}),null);
});
test('amount, reference, currency and live mode must match',()=>{
 const payment={external_reference:'a',transaction_amount:19.9,currency_id:'BRL',live_mode:false,status:'approved'};
 assert.equal(publicPayment(payment,'a').status,'approved');
 for(const change of [{external_reference:'b'},{transaction_amount:1},{currency_id:'USD'},{live_mode:true}])assert.throws(()=>publicPayment({...payment,...change},'a'));
});

test('configuration diagnostics identify the prerequisite without exposing credentials',()=>{
 const token='TEST-synthetic-not-a-credential';
 const scenarios=[['production',token,'PREVIEW_REQUIRED'],['preview',undefined,'TOKEN_MISSING'],['preview',' '+token,'TOKEN_WHITESPACE']];
 for(const [environment,value,code] of scenarios){
  process.env.VERCEL_ENV=environment;if(value===undefined)delete process.env.MERCADO_PAGO_ACCESS_TOKEN;else process.env.MERCADO_PAGO_ACCESS_TOKEN=value;
  let error;try{config();}catch(e){error=e;}assert.equal(error?.message,code);
  let status,body;failure({status(v){status=v;return this;},json(v){body=v;}},error);assert.equal(status,503);assert.equal(body.code,code);if(value)assert.ok(!JSON.stringify(body).includes(value));
 }
 process.env.VERCEL_ENV='preview';process.env.MERCADO_PAGO_ACCESS_TOKEN=token;
});

test('provider account verification precedes creation, regardless of token prefix',async()=>{
 const original=globalThis.fetch;
 process.env.MERCADO_PAGO_ACCESS_TOKEN='APP_USR-synthetic-not-a-credential';
 try{
  for(const account of [{id:42,site_id:'MLB',tags:[]},{id:42,site_id:'MLB'},{id:42,site_id:'MLA',tags:['test_user']}]){
   const calls=[];globalThis.fetch=async(url)=>{calls.push(url);return {ok:true,json:async()=>account};};
   await assert.rejects(createTestPayment({},'id'),/TEST_ACCOUNT_REQUIRED/);assert.deepEqual(calls,['https://api.mercadopago.com/users/me']);
  }
  const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/users/me')?{id:42,site_id:'MLB',tags:['test_user']}:{collector_id:42,live_mode:false}};};
  await createTestPayment({transaction_amount:19.9},'stable-key');assert.equal(calls.length,2);assert.equal(calls[1].options.headers['X-Idempotency-Key'],'stable-key');
  globalThis.fetch=async(url)=>({ok:true,json:async()=>url.endsWith('/users/me')?{id:42,site_id:'MLB',tags:['test_user']}:{collector_id:99}});
  await assert.rejects(createTestPayment({},'id'),/PAYMENT_MISMATCH/);
  globalThis.fetch=async()=>({ok:false});await assert.rejects(createTestPayment({},'id'),/PROVIDER_FAILURE/);
 }finally{globalThis.fetch=original;process.env.MERCADO_PAGO_ACCESS_TOKEN='TEST-synthetic-not-a-credential';}
});

test('provider diagnostics distinguish stages and exclude raw provider content',async()=>{
 const original=globalThis.fetch;
 try{
  for(const [path,options,stage] of [['/users/me',{},'ACCOUNT'],['/v1/payments',{method:'POST'},'CREATE'],['/v1/payments/42',{},'STATUS']]){
   globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({error:'forbidden',message:'DO_NOT_EXPOSE',cause:[{code:13253,description:'DO_NOT_EXPOSE'},{code:'DO_NOT_EXPOSE'}]})});
   let caught;try{await mp(path,options);}catch(e){caught=e;}
   let result;failure({status(n){assert.equal(n,502);return this;},json(v){result=v;}},caught);
   assert.equal(result.code,`MP_${stage}_403`);assert.ok(result.error.includes('13253'));assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPOSE'));
  }
  globalThis.fetch=async()=>{throw new Error('DO_NOT_EXPOSE');};
  await assert.rejects(mp('/users/me'),e=>e.stage==='ACCOUNT'&&e.kind==='NETWORK'&&!e.message.includes('DO_NOT_EXPOSE'));
  globalThis.fetch=async()=>({ok:true,json:async()=>{throw new Error('DO_NOT_EXPOSE');}});
  await assert.rejects(mp('/users/me'),e=>e.kind==='INVALID_RESPONSE');
 }finally{globalThis.fetch=original;}
});
