const screens = ['intro', 'details', 'payment', 'documents'];
function show(id) {
 for (const screen of screens) document.getElementById(screen).hidden = screen !== id;
 window.scrollTo({top:0, behavior:'instant'});
 const heading = document.querySelector(`#${id} h1`);
 heading.setAttribute('tabindex','-1');
 heading.focus({preventScroll:true});
}
document.getElementById('begin').addEventListener('click',()=>show('details'));
document.getElementById('back').addEventListener('click',()=>show('intro'));
document.getElementById('edit').addEventListener('click',()=>show('details'));
document.getElementById('intake').addEventListener('submit',event=>{
 event.preventDefault();
 const name=document.getElementById('name');
 if(!name.value.trim()){name.setCustomValidity('Informe seu primeiro nome.');name.reportValidity();return;}
 name.setCustomValidity('');
 show('payment');
});
document.getElementById('name').addEventListener('input',event=>event.target.setCustomValidity(''));

async function request(path,body){
 const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Serviço indisponível.');return data;
}
const message=document.getElementById('payment-message');
function updatePayment(data){
 document.getElementById('pix-details').hidden=!data.code;
 if(data.code){document.getElementById('pix-details').hidden=false;document.getElementById('pix-code').value=data.code;}
 const states={approved:'Pagamento de teste confirmado pelo servidor.',pending:'Pix de teste gerado. Aguardando confirmação.',in_process:'Pagamento em processamento.',rejected:'Pagamento rejeitado.',expired:'Cobrança de teste vencida.',cancelled:'Pagamento cancelado.',refunded:'Pagamento reembolsado.'};
 message.textContent=states[data.status]||'Aguardando atualização do pagamento.';
 if(data.status==='approved'){show('documents');loadDocuments();}
}
document.getElementById('generate').addEventListener('click',async event=>{
 const button=event.currentTarget;button.disabled=true;message.textContent='Preparando Pix de teste…';
 try{await request('order',{});const data=await request('payment',{name:document.getElementById('name').value,email:document.getElementById('email').value,cpf:document.getElementById('cpf').value.replace(/\D/g,'')});updatePayment(data);button.textContent='Consultar Pix existente';}
 catch(error){message.textContent=error.message;}finally{button.disabled=false;}
});
document.getElementById('check-payment').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{updatePayment(await request('status'));}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
document.getElementById('copy-pix').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(document.getElementById('pix-code').value);message.textContent='Código copiado.';}catch{message.textContent='Selecione e copie o código acima.';}});

const documentsMessage=document.getElementById('documents-message');
const documentForm=document.getElementById('document-form');
let loadingDocuments=false;
async function loadDocuments(){
 if(loadingDocuments)return;loadingDocuments=true;documentForm.hidden=true;
 try{
  const data=await request('documents');
  documentForm.hidden=!data.ready;
  documentsMessage.textContent=data.ready?'Área de teste liberada. Seus PDFs serão guardados em um espaço privado, aguardando validação.':data.message;
  const list=document.getElementById('document-list');list.replaceChildren();
  for(const file of data.documents){const item=document.createElement('li');const title=document.createElement('strong');title.textContent=file.kind==='contract'?'Contrato de financiamento':'Documento de seguro';const state=document.createElement('small');state.textContent='Recebido · em quarentena · ainda não analisado';item.append(title,state);list.append(item);}
 }catch(error){documentsMessage.textContent=error.message;}finally{loadingDocuments=false;}
}
document.getElementById('refresh-documents').addEventListener('click',loadDocuments);
documentForm.addEventListener('submit',async event=>{
 event.preventDefault();const file=document.getElementById('document-file').files[0];
 if(!file||file.size===0||file.size>1024*1024){documentsMessage.textContent='Escolha um PDF de até 1 MB.';return;}
 const button=document.getElementById('upload-document');button.disabled=true;documentsMessage.textContent='Enviando PDF de teste…';
 try{
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  await request('documents',{base64:btoa(binary),kind:document.getElementById('document-kind').value,synthetic:document.getElementById('synthetic').checked});
  documentForm.reset();await loadDocuments();
 }catch(error){documentsMessage.textContent=error.message+' Antes de reenviar, use “Verificar envio e atualizar” para conferir se o arquivo já foi recebido.';}finally{button.disabled=false;}
});
// Restore the paid workflow in this browser while its HttpOnly session is valid.
request('status').then(data=>{if(data.status==='approved')updatePayment(data);}).catch(()=>{});
