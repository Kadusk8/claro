import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
export function config(){
 const token=process.env.MERCADO_PAGO_ACCESS_TOKEN;
 if(process.env.VERCEL_ENV!=='preview') throw new Error('PREVIEW_REQUIRED');
 if(!token?.trim()) throw new Error('TOKEN_MISSING');
 if(token!==token.trim()) throw new Error('TOKEN_WHITESPACE');
 return token;
}
function sign(value){return createHmac('sha256',config()).update('contrato-claro/test-order/v1:'+value).digest('base64url');}
export function cookie(res,data){const value=Buffer.from(JSON.stringify(data)).toString('base64url');res.setHeader('Set-Cookie',`cc_test_order=${value}.${sign(value)}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=3600`);}
export function order(req){
 const raw=(req.headers.cookie||'').split('; ').find(c=>c.startsWith('cc_test_order='))?.slice(14);
 if(!raw)return null;
 try{const [value,mac]=raw.split('.');const expected=Buffer.from(sign(value));const actual=Buffer.from(mac||'');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const data=JSON.parse(Buffer.from(value,'base64url'));if(data.expires<Date.now())return null;return data;}catch{return null;}
}
export function newOrder(){return {id:randomUUID(),expires:Date.now()+3600000};}
export function guard(req,res,method){res.setHeader('Cache-Control','no-store');if(req.method!==method){res.setHeader('Allow',method);res.status(405).json({error:'Método não permitido.'});return false;}if(method==='POST'){const origin=req.headers.origin;const host=req.headers.host;if(!origin||new URL(origin).host!==host){res.status(403).json({error:'Origem não permitida.'});return false;}}return true;}
export async function mp(path,options={}){const response=await fetch('https://api.mercadopago.com'+path,{...options,headers:{Authorization:`Bearer ${config()}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('PROVIDER_FAILURE');return response.json();}
// A token prefix does not establish that its owner is a test account.
// Fail closed unless the authenticated provider response identifies a test user.
export async function testAccount(){
 const account=await mp('/users/me');
 if(!account.id||account.site_id!=='MLB'||!Array.isArray(account.tags)||!account.tags.includes('test_user')) throw new Error('TEST_ACCOUNT_REQUIRED');
 return account;
}
export async function createTestPayment(payload,key){
 const account=await testAccount();
 const payment=await mp('/v1/payments',{method:'POST',headers:{'X-Idempotency-Key':key},body:JSON.stringify(payload)});
 if(String(payment.collector_id)!==String(account.id)) throw new Error('PAYMENT_MISMATCH');
 return payment;
}
export function publicPayment(payment,id){
 if(payment.external_reference!==id||payment.transaction_amount!==19.9||payment.currency_id!=='BRL'||payment.live_mode!==false)throw new Error('PAYMENT_MISMATCH');
 return {status:payment.status,code:payment.point_of_interaction?.transaction_data?.qr_code||null,expires:payment.date_of_expiration};
}
const configurationErrors = {
 PREVIEW_REQUIRED: 'Este deployment não é do ambiente Preview. Abra a publicação da branch pix-test com ambiente Preview. Cobranças reais continuam bloqueadas.',
 TOKEN_MISSING: 'A variável MERCADO_PAGO_ACCESS_TOKEN não está disponível neste deployment. Configure-a no ambiente Preview e faça um novo deploy da branch pix-test.',
 TOKEN_WHITESPACE: 'A credencial foi configurada com espaços ou quebras de linha nas extremidades. Corrija a variável no ambiente Preview e faça um novo deploy.',
 TEST_ACCOUNT_REQUIRED: 'O Mercado Pago não identificou esta credencial como pertencente a uma conta de teste brasileira. Nenhum Pix foi criado. Confira a conta de teste vinculada à aplicação.',
 PAYMENT_MISMATCH: 'O pagamento retornado não corresponde aos requisitos deste teste. O código Pix não será exibido e nenhum acesso será liberado.'
};
export function failure(res,error){
 const message=configurationErrors[error.message];
 res.status(message?503:502).json({code:message?error.message:'PROVIDER_FAILURE',error:message||'Não foi possível consultar o Mercado Pago. Tente novamente; a tentativa será reutilizada.'});
}
