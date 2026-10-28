import {guard,order,cookie,asaas,createTestPayment,publicPayment,failure} from '../lib/payments.mjs';
export default async function handler(req,res){
 if(!guard(req,res,'POST'))return;
 try{
  const session=order(req);if(!session){res.status(401).json({error:'Inicie novamente para preparar seu pedido.'});return;}
  if(session.payment){res.status(200).json(await publicPayment(await asaas('/payments/'+encodeURIComponent(session.payment)),session.id));return;}
  const {name,email,cpf}=req.body||{};
  if(typeof name!=='string'||!name.trim()||name.length>80||typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof cpf!=='string'||!/^\d{11}$/.test(cpf)){res.status(400).json({error:'Confira nome, e-mail e CPF de teste (11 dígitos).'});return;}
  const payment=await createTestPayment({name:name.trim(),email,cpf},session.id);
  // Retain the charge before fetching its QR so a QR failure can be retried.
  cookie(res,{...session,payment:payment.id});
  const result=await publicPayment(payment,session.id);res.status(200).json(result);
 }catch(e){failure(res,e);}
}
