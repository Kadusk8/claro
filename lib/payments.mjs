import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
export function config(){
 const token=process.env.ASAAS_API_KEY;
 if(process.env.VERCEL_ENV!=='preview') throw new Error('PREVIEW_REQUIRED');
 if(!token?.trim()) throw new Error('TOKEN_MISSING');
 if(token!==token.trim()) throw new Error('TOKEN_WHITESPACE');
 return token;
}
function sign(value){return createHmac('sha256',config()).update('contrato-claro/asaas-sandbox/v1:'+value).digest('base64url');}
export function cookie(res,data){const value=Buffer.from(JSON.stringify(data)).toString('base64url');res.setHeader('Set-Cookie',`cc_test_order=${value}.${sign(value)}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=3600`);}
export function order(req){
 const raw=(req.headers.cookie||'').split('; ').find(c=>c.startsWith('cc_test_order='))?.slice(14);
 if(!raw)return null;
 try{const [value,mac]=raw.split('.');const expected=Buffer.from(sign(value));const actual=Buffer.from(mac||'');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const data=JSON.parse(Buffer.from(value,'base64url'));if(data.expires<Date.now())return null;return data;}catch{return null;}
}
export function newOrder(){return {id:randomUUID(),expires:Date.now()+3600000};}
export function guard(req,res,method){res.setHeader('Cache-Control','no-store');if(req.method!==method){res.setHeader('Allow',method);res.status(405).json({error:'Método não permitido.'});return false;}if(method==='POST'){const origin=req.headers.origin;const host=req.headers.host;if(!origin||new URL(origin).host!==host){res.status(403).json({error:'Origem não permitida.'});return false;}}return true;}
const SANDBOX='https://api-sandbox.asaas.com/v3';
export async function asaas(path,options={}){
 const token=config();
 if(!/^\/(customers|payments)(?:[/?]|$)/.test(path))throw new Error('INVALID_PATH');
 const stage=path.startsWith('/customers')?'CUSTOMER':options.method==='POST'?'CREATE':'STATUS';
 let response;
 try{response=await fetch(SANDBOX+path,{...options,headers:{access_token:token,'Content-Type':'application/json','User-Agent':'ContratoClaroIA-Sandbox/0.1',...options.headers},signal:AbortSignal.timeout(15000)});}
 catch{throw Object.assign(new Error('PROVIDER_FAILURE'),{stage,kind:'NETWORK'});}
 if(!response.ok){
  let body;try{body=await response.json();}catch{}
  const allowed=['invalid_access_token','invalid_environment','invalid_customer','invalid_value','invalid_cpfCnpj','invalid_billingType','invalid_object','invalid_action','invalid_dueDate'];
  const codes=Array.isArray(body?.errors)?body.errors.map(e=>e.code).filter(c=>allowed.includes(c)).slice(0,3):[];
  throw Object.assign(new Error('PROVIDER_FAILURE'),{stage,kind:'HTTP',httpStatus:response.status,codes});
 }
 try{return await response.json();}catch{throw Object.assign(new Error('PROVIDER_FAILURE'),{stage,kind:'INVALID_RESPONSE'});}
}
export function validatePayment(payment,id){
 if(!payment.id||payment.externalReference!==id||payment.value!==19.9||payment.billingType!=='PIX'||payment.deleted)throw new Error('PAYMENT_MISMATCH');
 return payment;
}
export async function createTestPayment(payer,id){
 // Reconcile a previous attempt before creating another. This is not an atomic
 // lock: production requires durable order storage and distributed exclusion.
 const existing=await asaas('/payments?externalReference='+encodeURIComponent(id)+'&limit=2');
 if(!Array.isArray(existing.data))throw new Error('PAYMENT_MISMATCH');
 if(existing.data.length>1)throw new Error('DUPLICATE_PAYMENT');
 if(existing.data.length)return validatePayment(existing.data[0],id);
 const customers=await asaas('/customers?externalReference='+encodeURIComponent(id)+'&limit=1');
 if(!Array.isArray(customers.data))throw new Error('PAYMENT_MISMATCH');
 const customer=customers.data[0]||await asaas('/customers',{method:'POST',body:JSON.stringify({name:payer.name,email:payer.email,cpfCnpj:payer.cpf,externalReference:id,notificationDisabled:true})});
 if(!customer.id)throw new Error('PAYMENT_MISMATCH');
 const dueDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const payment=await asaas('/payments',{method:'POST',body:JSON.stringify({customer:customer.id,billingType:'PIX',value:19.9,dueDate,description:'Contrato Claro IA — teste Sandbox',externalReference:id})});
 return validatePayment(payment,id);
}
export async function publicPayment(payment,id){
 validatePayment(payment,id);
 const status={PENDING:'pending',RECEIVED:'approved',CONFIRMED:'approved',OVERDUE:'expired',REFUNDED:'refunded',REFUND_REQUESTED:'in_process',CHARGEBACK_REQUESTED:'in_process'}[payment.status]||'in_process';
 const result={status,code:null};
 if(status==='pending'){
  const qr=await asaas('/payments/'+encodeURIComponent(payment.id)+'/pixQrCode');
  if(typeof qr.payload!=='string'||!qr.payload)throw new Error('PAYMENT_MISMATCH');
  result.code=qr.payload;result.expires=qr.expirationDate;
 }
 return result;
}
const configurationErrors = {
 PREVIEW_REQUIRED: 'Este deployment não é do ambiente Preview. Abra a publicação da branch pix-test com ambiente Preview. Cobranças reais continuam bloqueadas.',
 TOKEN_MISSING: 'A variável ASAAS_API_KEY não está disponível neste deployment. Configure-a no ambiente Preview e faça um novo deploy da branch pix-test.',
 TOKEN_WHITESPACE: 'A credencial foi configurada com espaços ou quebras de linha nas extremidades. Corrija a variável no ambiente Preview e faça um novo deploy.',
 DUPLICATE_PAYMENT: 'Há mais de uma cobrança de teste para este pedido. A tentativa foi interrompida para conferência.',
 PAYMENT_MISMATCH: 'O pagamento retornado não corresponde aos requisitos deste teste. O código Pix não será exibido e nenhum acesso será liberado.'
};
export function failure(res,error){
 const message=configurationErrors[error.message];
 if(message){res.status(503).json({code:error.message,error:message});return;}
 const stage={CUSTOMER:'cadastro do cliente de teste',CREATE:'criação do Pix',STATUS:'consulta da cobrança'}[error.stage];
 if(!stage){res.status(502).json({code:'INTERNAL_FAILURE',error:'Falha interna ao processar o teste. Nenhum acesso foi liberado.'});return;}
 const code=`ASAAS_${error.stage}_${error.kind==='HTTP'?error.httpStatus:error.kind}`;
 let reason='O Asaas Sandbox retornou uma resposta inesperada.';
 if(error.kind==='NETWORK')reason='Falha de conexão ou tempo limite na API Sandbox.';
 else if(error.httpStatus===401)reason='A API recusou a chave. Configure ASAAS_API_KEY com uma chave do Sandbox, não de produção.';
 else if(error.httpStatus===403)reason='A API negou permissão para esta operação no Sandbox.';
 else if(error.httpStatus===400||error.httpStatus===422)reason='Confira os dados de teste e os requisitos da cobrança no Asaas.';
 else if(error.httpStatus===429)reason='Limite de consultas atingido. Aguarde antes de tentar novamente.';
 const detail=error.codes?.length?` Códigos: ${error.codes.join(', ')}.`:'';
 res.status(502).json({code,error:`Falha no ${stage} (${code}). ${reason}${detail}`});
}
