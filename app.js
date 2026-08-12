const pages = [
  ['acerca','Acerca de','./acerca.html'],
  ['funciones','Funciones','./funciones.html'],
  ['descarga','Descarga','./descarga.html'],
  ['agradecimientos','Agradecimientos','./agradecimientos.html']
];
const iconPaths = {
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M17.2 2.4a4.4 4.4 0 0 0 4.4 4.4 4.4 4.4 0 1 1-4.4-4.4Z"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z"/><path d="m9 12 2 2 4-4"/>',
  sparkles: '<path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5C2 11 4 13 5 14l7 7Z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 8.4 7.2 6.1 4.9a4 4 0 0 0 5 5l-7.8 7.8a2.1 2.1 0 0 0 3 3l7.8-7.8a4 4 0 0 0 5-5l-2.3 2.3-3.6-3.6Z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  close: '<path d="m6 6 12 12"/><path d="M18 6 6 18"/>',
  external: '<path d="M15 3h6v6"/><path d="m10 14 11-11"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]}</svg>`;
const active = document.body.dataset.page;
const shell = document.querySelector('#site-shell');
const navigation = document.createElement('header');
navigation.className = 'top-navigation';
const utilityLabels = {guias:'Guías',herramientas:'Herramientas',licencia:'Licencia',repositorio:'Repositorio'};
const activeLabel = pages.find(([id]) => id === active)?.[1] || utilityLabels[active] || 'Inicio';
const activeIndex = pages.findIndex(([id]) => id === active);
navigation.style.setProperty('--active-index', activeIndex);
navigation.classList.toggle('home-active', activeIndex < 0);
navigation.innerHTML = `<a class="top-brand" href="./index.html" aria-label="Cloud"><img src="./assets/cloud-logo.png" alt=""></a><nav class="top-tabs" aria-label="Secciones principales">${pages.map(([id,label,url]) => `<a href="${url}" data-nav-index="${pages.findIndex(([pageId]) => pageId === id)}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}>${label}</a>`).join('')}<span class="nav-selection" aria-hidden="true"></span></nav><div class="top-actions"><a href="./guias.html" class="icon-link ${active==='guias'?'active':''}" aria-label="Guías" title="Guías">${icon('book')}</a><a href="./herramientas.html" class="icon-link ${active==='herramientas'?'active':''}" aria-label="Herramientas" title="Herramientas">${icon('wrench')}</a><a href="https://github.com/Slourzz" class="profile-link" target="_blank" rel="noreferrer" aria-label="Perfil de Sam" title="Sam!"><img src="https://github.com/Slourzz.png?size=96" alt="Sam!"></a></div><span class="mobile-current">${activeLabel}</span><button class="mobile-nav-trigger" type="button" aria-label="Abrir navegación" aria-expanded="false">${icon('menu')}</button>`;
shell.prepend(navigation);

navigation.querySelectorAll('.top-tabs a').forEach(link => {
  link.addEventListener('click', event => {
    const nextIndex = Number(link.dataset.navIndex);
    if (nextIndex === activeIndex || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigation.classList.remove('home-active');
    navigation.style.setProperty('--active-index', nextIndex);
    navigation.querySelectorAll('.top-tabs a').forEach(item => item.classList.toggle('active', item === link));
    window.setTimeout(() => { window.location.href = link.href; }, 320);
  });
});

const mobileNavigation = document.createElement('aside');
mobileNavigation.className = 'mobile-navigation';
mobileNavigation.setAttribute('aria-hidden', 'true');
mobileNavigation.innerHTML = `<div class="mobile-navigation-head"><a href="./index.html"><img src="./assets/cloud-logo.png" alt=""><b>Cloud</b></a><button type="button" class="mobile-navigation-close" aria-label="Cerrar navegación">${icon('close')}</button></div><nav aria-label="Navegación móvil">${pages.map(([id,label,url], index) => `<a href="${url}" class="${active===id?'active':''}"><span>${String(index + 1).padStart(2,'0')}</span>${label}</a>`).join('')}<a href="./licencia.html" class="${active==='licencia'?'active':''}"><span>05</span>Licencia</a><a href="./repositorio.html" class="${active==='repositorio'?'active':''}"><span>06</span>Repositorio</a><a href="./guias.html" class="${active==='guias'?'active':''}"><span>07</span>Guías</a><a href="./herramientas.html" class="${active==='herramientas'?'active':''}"><span>08</span>Herramientas</a></nav><div class="mobile-navigation-foot"><a href="./repositorio.html"><span>Repositorio</span></a><a href="https://github.com/Slourzz" target="_blank" rel="noreferrer"><img src="https://github.com/Slourzz.png?size=96" alt="Sam!"><span>Sam!</span></a></div>`;
document.body.append(mobileNavigation);

const mobileNavTrigger = navigation.querySelector('.mobile-nav-trigger');
const mobileNavClose = mobileNavigation.querySelector('.mobile-navigation-close');
const setMobileNavigation = (open) => {
  document.body.classList.toggle('mobile-navigation-open', open);
  mobileNavTrigger.setAttribute('aria-expanded', String(open));
  mobileNavigation.setAttribute('aria-hidden', String(!open));
};
mobileNavTrigger.addEventListener('click', () => setMobileNavigation(true));
mobileNavClose.addEventListener('click', () => setMobileNavigation(false));
mobileNavigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMobileNavigation(false)));

const mobileButton = document.createElement('button');
mobileButton.className = 'mobile-menu'; mobileButton.type = 'button'; mobileButton.setAttribute('aria-label','Abrir navegación'); mobileButton.innerHTML = '<i></i><i></i>';
document.body.append(mobileButton);
const shade = document.createElement('button'); shade.className = 'nav-shade'; shade.setAttribute('aria-label','Cerrar navegación'); document.body.append(shade);
const closeMenu = () => document.body.classList.remove('nav-open');
mobileButton.addEventListener('click', () => document.body.classList.toggle('nav-open'));
shade.addEventListener('click', closeMenu);
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));

const observer = new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting){ entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), {threshold:.1});
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

const scrollHero = document.querySelector('.home-hero-restructured');
if (scrollHero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  scrollHero.classList.add('hero-scroll-sequence');
  const clamp = value => Math.min(1, Math.max(0, value));
  let heroFrame = 0;
  const updateHeroSequence = () => {
    heroFrame = 0;
    const start = scrollHero.offsetTop;
    const distance = Math.max(1, scrollHero.offsetHeight - window.innerHeight);
    const rawProgress = (window.scrollY - start) / distance;
    const progress = clamp(rawProgress);
    const copyProgress = clamp((progress - .08) / .34);
    const detailsProgress = clamp((progress - .34) / .38);
    const arrowProgress = rawProgress > 1.04 ? 0 : clamp((progress - .82) / .14);
    scrollHero.style.setProperty('--hero-copy-progress', copyProgress.toFixed(3));
    scrollHero.style.setProperty('--hero-details-progress', detailsProgress.toFixed(3));
    scrollHero.style.setProperty('--hero-arrow-progress', arrowProgress.toFixed(3));
    scrollHero.classList.toggle('hero-sequence-complete', arrowProgress > .98);
  };
  const requestHeroSequence = () => {
    if (!heroFrame) heroFrame = requestAnimationFrame(updateHeroSequence);
  };
  window.addEventListener('scroll', requestHeroSequence, {passive:true});
  window.addEventListener('resize', requestHeroSequence);
  updateHeroSequence();
}
document.querySelectorAll('.cards, .credit-list, .quick-links').forEach(group => {
  [...group.children].forEach((item, index) => item.style.setProperty('--stagger-delay', `${Math.min(index, 7) * 70}ms`));
});

const parallaxItems = [...document.querySelectorAll('.player-showcase, .page-header, .content-section, .home-hero, .intro-grid')];
const scrollMediaItems = [...document.querySelectorAll('.guide-media img, .guide-media video, .hero-media img')];
parallaxItems.forEach((element, index) => {
  const isMedia = element.matches('.player-showcase, .guide-media, .hero-media');
  element.dataset.parallaxDepth = isMedia ? '1' : String(.34 + (index % 3) * .14);
});
let parallaxFrame = 0;
const updateParallax = () => {
  parallaxFrame = 0;
  const viewportCenter = window.innerHeight / 2;
  parallaxItems.forEach(element => {
    const rect = element.getBoundingClientRect();
    const distance = (rect.top + rect.height / 2 - viewportCenter) / window.innerHeight;
    const depth = Number(element.dataset.parallaxDepth || 1);
    const offset = Math.max(-58, Math.min(58, distance * -76 * depth));
    element.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
  });
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const documentProgress = window.scrollY / maxScroll;
  scrollMediaItems.forEach((element, index) => {
    const spread = scrollMediaItems.length > 1 ? index / (scrollMediaItems.length - 1) : .5;
    const localStart = Math.max(0, spread * .34 - .12);
    const localEnd = Math.min(1, localStart + .78);
    const progress = Math.max(0, Math.min(1, (documentProgress - localStart) / Math.max(.01, localEnd - localStart)));
    const centered = Math.sin(progress * Math.PI);
    const translateY = 86 - progress * 172;
    const scale = 1.2 - centered * .15;
    const cropY = 11 - centered * 11;
    const cropX = 6 - centered * 6;
    element.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    element.style.clipPath = `inset(${cropY.toFixed(2)}% ${cropX.toFixed(2)}% round ${(12 + (1 - centered) * 10).toFixed(2)}px)`;
  });
};
const requestParallax = () => {
  if (!parallaxFrame) parallaxFrame = requestAnimationFrame(updateParallax);
};
window.addEventListener('scroll', requestParallax, {passive:true});
window.addEventListener('resize', requestParallax);
requestParallax();

const motionCards = document.querySelectorAll('.info-card, .credit, .guide-card, .stat, .download-card');
motionCards.forEach(card => {
  card.addEventListener('pointermove', event => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--card-rx', `${((event.clientY - rect.top) / rect.height - .5) * -3.5}deg`);
    card.style.setProperty('--card-ry', `${((event.clientX - rect.left) / rect.width - .5) * 4.5}deg`);
    card.style.setProperty('--card-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--card-y', `${event.clientY - rect.top}px`);
  });
  card.addEventListener('pointerleave', () => {
    card.style.removeProperty('--card-rx');
    card.style.removeProperty('--card-ry');
  });
});

const catalog = document.querySelector('[data-catalog]');
if (catalog) {
  const catalogItems = [...catalog.querySelectorAll('[data-category]')];
  const catalogSearch = document.querySelector('[data-catalog-search]');
  const catalogFilters = [...document.querySelectorAll('[data-catalog-filter]')];
  const catalogEmpty = document.querySelector('[data-catalog-empty]');
  let selectedCategory = 'all';
  const updateCatalog = () => {
    const query = (catalogSearch?.value || '').trim().toLocaleLowerCase('es');
    let visible = 0;
    catalogItems.forEach(item => {
      const matchesCategory = selectedCategory === 'all' || item.dataset.category === selectedCategory;
      const haystack = `${item.dataset.search || ''} ${item.textContent}`.toLocaleLowerCase('es');
      const matchesSearch = !query || haystack.includes(query);
      const show = matchesCategory && matchesSearch;
      item.hidden = !show;
      if (show) visible += 1;
    });
    if (catalogEmpty) catalogEmpty.style.display = visible ? 'none' : 'block';
  };
  catalogSearch?.addEventListener('input', updateCatalog);
  catalogFilters.forEach(filter => filter.addEventListener('click', () => {
    selectedCategory = filter.dataset.catalogFilter || 'all';
    catalogFilters.forEach(item => item.classList.toggle('active', item === filter));
    updateCatalog();
  }));
}

const guideProgress = document.querySelector('.guide-progress');
const guideSections = [...document.querySelectorAll('.guide-step[id], .guide-callout[id]')];
const guideLinks = [...document.querySelectorAll('.guide-toc a')];
if (guideProgress) {
  const updateGuideProgress = () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    document.documentElement.style.setProperty('--guide-progress', `${Math.min(100, window.scrollY / maxScroll * 100)}%`);
    let current = guideSections[0]?.id;
    guideSections.forEach(section => { if (section.getBoundingClientRect().top <= 190) current = section.id; });
    guideLinks.forEach(link => link.classList.toggle('active', link.hash === `#${current}`));
  };
  window.addEventListener('scroll', updateGuideProgress, {passive:true});
  updateGuideProgress();
}
