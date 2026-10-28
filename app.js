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
