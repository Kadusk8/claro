import {guard,order,mp,publicPayment,failure} from '../lib/payments.mjs';
export default async function handler(req,res){if(!guard(req,res,'GET'))return;try{const session=order(req);if(!session?.payment){res.status(401).json({error:'Nenhum pagamento nesta sessão.'});return;}res.status(200).json(publicPayment(await mp(`/v1/payments/${session.payment}`),session.id));}catch(e){failure(res,e);}}
