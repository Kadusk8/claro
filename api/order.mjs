import {config,guard,order,newOrder,cookie,failure} from '../lib/payments.mjs';
export default async function handler(req,res){if(!guard(req,res,'POST'))return;try{config();const data=order(req)||newOrder();cookie(res,data);res.status(200).json({ready:true});}catch(e){failure(res,e);}}
