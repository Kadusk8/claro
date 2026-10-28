import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
export function config(){
 const token=process.env.MERCADO_PAGO_ACCESS_TOKEN;
 if(process.env.VERCEL_ENV!=='preview'||!token?.startsWith('TEST-')) throw new Error('TEST_CONFIGURATION');
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
export function publicPayment(payment,id){
 if(payment.external_reference!==id||payment.transaction_amount!==19.9||payment.currency_id!=='BRL'||payment.live_mode!==false)throw new Error('PAYMENT_MISMATCH');
 return {status:payment.status,code:payment.point_of_interaction?.transaction_data?.qr_code||null,expires:payment.date_of_expiration};
}
export function failure(res,error){const configuration=error.message==='TEST_CONFIGURATION';res.status(configuration?503:502).json({error:configuration?'Pix de teste indisponível. É necessário um deployment Preview e uma credencial TEST válida. Cobranças reais estão bloqueadas.':'Não foi possível consultar o Mercado Pago. Tente novamente; a tentativa será reutilizada.'});}
