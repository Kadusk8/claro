import {guard,order,cookie,mp,publicPayment,failure} from '../lib/payments.mjs';
export default async function handler(req,res){
 if(!guard(req,res,'POST'))return;
 try{
  const session=order(req);if(!session){res.status(401).json({error:'Inicie novamente para preparar seu pedido.'});return;}
  if(session.payment){res.status(200).json(publicPayment(await mp(`/v1/payments/${session.payment}`),session.id));return;}
  const {name,email}=req.body||{};
  if(typeof name!=='string'||!name.trim()||name.length>80||typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){res.status(400).json({error:'Confira seu nome e e-mail.'});return;}
  const payment=await mp('/v1/payments',{method:'POST',headers:{'X-Idempotency-Key':session.id},body:JSON.stringify({transaction_amount:19.9,description:'Contrato Claro IA — teste de análise preliminar',payment_method_id:'pix',external_reference:session.id,payer:{email,first_name:name.trim()}})});
  const result=publicPayment(payment,session.id);cookie(res,{...session,payment:payment.id});res.status(200).json(result);
 }catch(e){failure(res,e);}
}
