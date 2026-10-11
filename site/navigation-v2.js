(() => {
  const header=document.querySelector('.db-header');
  if(!header)return;
  const nav=header.querySelector('.db-links');
  const toggle=header.querySelector('.db-toggle');
  const services=header.querySelector('details');
  const mobile=window.matchMedia('(max-width:1100px)');
  function closeMenu(focus=false){
    nav.classList.remove('db-open');
    toggle.setAttribute('aria-expanded','false');
    toggle.textContent='Меню';
    services.open=false;
    if(focus)toggle.focus();
  }
  toggle.addEventListener('click',(event)=>{
    const open=nav.classList.toggle('db-open');
    toggle.setAttribute('aria-expanded',String(open));
    toggle.textContent=open?'Закрыть':'Меню';
    if(!open)services.open=false;
    if(open && event.detail===0)nav.querySelector('a').focus();
  });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>closeMenu()));
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(services.open){services.open=false;services.querySelector('summary').focus();}
    else if(nav.classList.contains('db-open'))closeMenu(true);
  });
  document.addEventListener('click',e=>{if(!header.contains(e.target))closeMenu();});
  header.addEventListener('focusout',()=>{setTimeout(()=>{if(!header.contains(document.activeElement))closeMenu();},0);});
  mobile.addEventListener('change',()=>closeMenu());
})();
