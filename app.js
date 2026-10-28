const screens = ['intro', 'details', 'payment'];
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
 const states={approved:'Pagamento de teste confirmado pelo servidor. O envio de documentos ainda não está disponível.',pending:'Pix de teste gerado. Aguardando confirmação.',in_process:'Pagamento em processamento.',rejected:'Pagamento rejeitado.',expired:'Cobrança de teste vencida.',cancelled:'Pagamento cancelado.',refunded:'Pagamento reembolsado.'};
 message.textContent=states[data.status]||'Aguardando atualização do pagamento.';
}
document.getElementById('generate').addEventListener('click',async event=>{
 const button=event.currentTarget;button.disabled=true;message.textContent='Preparando Pix de teste…';
 try{await request('order',{});const data=await request('payment',{name:document.getElementById('name').value,email:document.getElementById('email').value,cpf:document.getElementById('cpf').value.replace(/\D/g,'')});updatePayment(data);button.textContent='Consultar Pix existente';}
 catch(error){message.textContent=error.message;}finally{button.disabled=false;}
});
document.getElementById('check-payment').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{updatePayment(await request('status'));}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
document.getElementById('copy-pix').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(document.getElementById('pix-code').value);message.textContent='Código copiado.';}catch{message.textContent='Selecione e copie o código acima.';}});
