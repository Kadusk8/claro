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
export async function mp(path,options={}){
 const token=config();
 const stage=path==='/users/me'?'ACCOUNT':options.method==='POST'?'CREATE':'STATUS';
 let response;
 try{
  response=await fetch('https://api.mercadopago.com'+path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
 }catch{
  throw Object.assign(new Error('PROVIDER_FAILURE'),{stage,kind:'NETWORK'});
 }
 if(!response.ok){
  // Never forward raw provider messages, headers, account data or credentials.
  let body;try{body=await response.json();}catch{}
  const allowed=['invalid_token','invalid_access_token','unauthorized','forbidden','bad_request','invalid_payer','invalid_users_involved','invalid_payment_method','not_found'];
  const providerCode=allowed.includes(body?.error)?body.error:undefined;
  const causes=Array.isArray(body?.cause)?body.cause.map(c=>String(c.code)).filter(c=>/^\d{1,6}$/.test(c)).slice(0,3):[];
  throw Object.assign(new Error('PROVIDER_FAILURE'),{stage,kind:'HTTP',httpStatus:response.status,providerCode,causes});
 }
 try{return await response.json();}catch{throw Object.assign(new Error('PROVIDER_FAILURE'),{stage,kind:'INVALID_RESPONSE'});}
}
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
 if(message){res.status(503).json({code:error.message,error:message});return;}
 const stage={ACCOUNT:'verificação da conta de teste',CREATE:'criação do Pix',STATUS:'consulta do pagamento'}[error.stage];
 if(!stage){res.status(502).json({code:'INTERNAL_FAILURE',error:'Falha interna ao processar o pagamento. Nenhum acesso foi liberado.'});return;}
 const code=`MP_${error.stage}_${error.kind==='HTTP'?error.httpStatus:error.kind}`;
 let reason='O Mercado Pago retornou uma resposta inesperada.';
 if(error.kind==='NETWORK')reason='Não houve resposta da API dentro do prazo ou ocorreu uma falha de conexão.';
 else if(error.httpStatus===401)reason='A API recusou a autenticação. Confira se o Access Token está completo, válido e não foi revogado.';
 else if(error.httpStatus===403)reason='A API negou permissão para esta operação. Precisamos conferir as permissões da credencial e o suporte da conta a este teste.';
 else if(error.httpStatus===400||error.httpStatus===422)reason='A API recusou os dados ou a modalidade desta tentativa. Precisamos verificar os requisitos do Pix de teste.';
 else if(error.httpStatus===429)reason='O limite de consultas foi atingido. Aguarde antes de tentar novamente.';
 else if(error.httpStatus>=500)reason='A API está temporariamente indisponível.';
 const detail=error.providerCode?` Tipo: ${error.providerCode}.`:'';
 const causes=error.causes?.length?` Códigos: ${error.causes.join(', ')}.`:'';
 res.status(502).json({code,error:`Falha na ${stage} (${code}). ${reason}${detail}${causes}`});
}
