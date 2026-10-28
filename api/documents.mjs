import {guard,failure} from '../lib/payments.mjs';
import {paidOrder,listDocuments,saveDocument,documentFailure,DocumentError} from '../lib/documents.mjs';
export default async function handler(req,res){
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');res.status(405).json({error:'Método não permitido.'});return;}
 if(!guard(req,res,req.method))return;
 try{
  const session=await paidOrder(req);
  if(req.method==='GET'){
   try{res.status(200).json({ready:true,documents:await listDocuments(session)});}
   catch(error){if(error instanceof DocumentError&&error.code==='STORAGE_NOT_CONFIGURED'){res.status(200).json({ready:false,documents:[],message:error.message});return;}throw error;}
   return;
  }
  const result=await saveDocument(session,req.body);res.status(201).json(result);
 }catch(error){if(!documentFailure(res,error))failure(res,error);}
}
