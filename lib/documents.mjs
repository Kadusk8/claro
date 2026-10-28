import {randomUUID} from 'node:crypto';
import {order,asaas,validatePayment} from './payments.mjs';
export const MAX_FILE_BYTES=1024*1024;
export class DocumentError extends Error{constructor(code,status,message){super(message);this.code=code;this.status=status;}}
export async function paidOrder(req){
 const session=order(req);
 if(!session?.payment)throw new DocumentError('SESSION_REQUIRED',401,'Sua sessão de pagamento expirou ou não foi encontrada. Não faça outro pagamento; a recuperação de acesso ainda está em preparação.');
 const payment=validatePayment(await asaas('/payments/'+encodeURIComponent(session.payment)),session.id);
 if(!['RECEIVED','CONFIRMED'].includes(payment.status))throw new DocumentError('PAYMENT_REQUIRED',403,'O pagamento não está confirmado. Consulte o Pix antes de enviar documentos.');
 return session;
}
export function storageConfig(){
 const raw=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!raw||!key)throw new DocumentError('STORAGE_NOT_CONFIGURED',503,'O armazenamento privado ainda não foi configurado. Seu pagamento de teste foi reconhecido; não é necessário pagar novamente.');
 let url;try{url=new URL(raw);}catch{throw new DocumentError('STORAGE_CONFIGURATION',503,'Configuração do armazenamento inválida.');}
 if(url.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw new DocumentError('STORAGE_CONFIGURATION',503,'Configuração do armazenamento inválida.');
 return {url:url.origin,key};
}
async function storage(path,options={}){
 const {url,key}=storageConfig();
 let response;try{response=await fetch(url+'/storage/v1/'+path,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,...options.headers},signal:AbortSignal.timeout(15000)});}catch{throw new DocumentError('STORAGE_CONNECTION',502,'Não foi possível conectar ao armazenamento. Tente novamente.');}
 if(!response.ok)throw new DocumentError('STORAGE_FAILURE',502,'O armazenamento não concluiu a operação. Nenhum documento foi enviado para análise.');
 try{return await response.json();}catch{throw new DocumentError('STORAGE_RESPONSE',502,'Resposta inesperada do armazenamento.');}
}
const bucket='contracts-quarantine';
export async function privateBucket(){
 const info=await storage('bucket/'+bucket);
 if(info.id!==bucket||info.public!==false)throw new DocumentError('PRIVATE_BUCKET_REQUIRED',503,'O envio está bloqueado: é necessário um bucket privado para os documentos.');
}
export function validateDocument(body){
 if(body?.kind!=='contract'&&body?.kind!=='insurance')throw new DocumentError('INVALID_KIND',400,'Escolha contrato ou seguro.');
 if(body?.synthetic!==true)throw new DocumentError('TEST_DOCUMENT_REQUIRED',400,'Nesta etapa, envie somente um PDF fictício, sem dados pessoais.');
 const value=body?.base64;
 if(typeof value!=='string'||!value.length||value.length>Math.ceil(MAX_FILE_BYTES/3)*4||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw new DocumentError('INVALID_FILE',400,'Selecione um PDF de até 1 MB.');
 const data=Buffer.from(value,'base64');
 if(data.length>MAX_FILE_BYTES||data.toString('base64')!==value||data.subarray(0,5).toString()!=='%PDF-'||!data.subarray(-1024).includes(Buffer.from('%%EOF')))throw new DocumentError('INVALID_FILE',400,'O arquivo precisa ser um PDF de até 1 MB.');
 return {data,kind:body.kind};
}
export async function listDocuments(session){
 await privateBucket();
 const files=await storage('object/list/'+bucket,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:session.id+'/',limit:11,sortBy:{column:'created_at',order:'desc'}})});
 if(!Array.isArray(files))throw new DocumentError('STORAGE_RESPONSE',502,'Resposta inesperada do armazenamento.');
 return files.filter(f=>f.id&&/^(contract|insurance)-[a-f0-9-]+\.pdf$/.test(f.name)).map(f=>({id:f.id,kind:f.name.startsWith('contract-')?'contract':'insurance',createdAt:f.created_at,status:'quarantined'}));
}
export async function saveDocument(session,body){
 const {data,kind}=validateDocument(body);
 const files=await listDocuments(session);
 if(files.length>=5)throw new DocumentError('FILE_LIMIT',409,'O limite desta etapa é de cinco arquivos de teste por pedido.');
 const path=session.id+'/'+kind+'-'+randomUUID()+'.pdf';
 await storage('object/'+bucket+'/'+path,{method:'POST',headers:{'Content-Type':'application/pdf','x-upsert':'false'},body:data});
 return {kind,status:'quarantined'};
}
export function documentFailure(res,error){
 if(error instanceof DocumentError){res.status(error.status).json({code:error.code,error:error.message});return true;}return false;
}
