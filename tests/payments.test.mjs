import test from 'node:test';
import assert from 'node:assert/strict';
import {config,cookie,order,publicPayment,failure} from '../lib/payments.mjs';
process.env.VERCEL_ENV='preview';
process.env.MERCADO_PAGO_ACCESS_TOKEN='TEST-synthetic-not-a-credential';
test('production credentials and production deployments are blocked',()=>{
 process.env.MERCADO_PAGO_ACCESS_TOKEN='APP_USR-synthetic';assert.throws(config);
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
 const scenarios=[['production',token,'PREVIEW_REQUIRED'],['preview',undefined,'TOKEN_MISSING'],['preview',' '+token,'TOKEN_WHITESPACE'],['preview','APP_USR-synthetic','TEST_TOKEN_REQUIRED']];
 for(const [environment,value,code] of scenarios){
  process.env.VERCEL_ENV=environment;if(value===undefined)delete process.env.MERCADO_PAGO_ACCESS_TOKEN;else process.env.MERCADO_PAGO_ACCESS_TOKEN=value;
  let error;try{config();}catch(e){error=e;}assert.equal(error?.message,code);
  let status,body;failure({status(v){status=v;return this;},json(v){body=v;}},error);assert.equal(status,503);assert.equal(body.code,code);if(value)assert.ok(!JSON.stringify(body).includes(value));
 }
 process.env.VERCEL_ENV='preview';process.env.MERCADO_PAGO_ACCESS_TOKEN=token;
});
