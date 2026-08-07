/* Lioncrest Capital — comportements partagés */
(function(){
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');

  function onScroll(){
    if(!header) return;
    if(window.scrollY > 40){ header.classList.add('is-solid'); }
    else { header.classList.remove('is-solid'); }
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  if(toggle && links){
    toggle.addEventListener('click', ()=>{
      const open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Fermer' : 'Menu';
    });
    links.querySelectorAll('a').forEach(a=>{
      a.addEventListener('click', ()=> links.classList.remove('is-open'));
    });
  }

  // Apparition douce au scroll
  const revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && revealEls.length){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, {threshold:.12, rootMargin:'0px 0px -60px 0px'});
    revealEls.forEach(el=>io.observe(el));
  } else {
    revealEls.forEach(el=>el.classList.add('is-visible'));
  }
})();
