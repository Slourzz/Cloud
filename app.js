const pages = [
  ['inicio','Inicio','home','./index.html'],
  ['descarga','Descarga','download','./descarga.html'],
  ['licencia','Licencia','shield','./licencia.html'],
  ['repositorio','Repositorio','github','./repositorio.html'],
  ['funciones','Funciones','sparkles','./funciones.html'],
  ['agradecimientos','Agradecimientos','heart','./agradecimientos.html'],
  ['herramientas','Herramientas','wrench','./herramientas.html']
];
const iconPaths = {
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z"/><path d="m9 12 2 2 4-4"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.3 4 5 5 0 0 0 19.2.5S18 0 15 2a13.4 13.4 0 0 0-7 0C5 .1 3.8.5 3.8.5A5 5 0 0 0 3.7 4a5.4 5.4 0 0 0-1.5 3.7c0 5.4 3.5 6.6 6.8 7A4.8 4.8 0 0 0 8 18v4"/><path d="M8 19c-3 .9-3-1.5-4-2"/>',
  sparkles: '<path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5C2 11 4 13 5 14l7 7Z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 8.4 7.2 6.1 4.9a4 4 0 0 0 5 5l-7.8 7.8a2.1 2.1 0 0 0 3 3l7.8-7.8a4 4 0 0 0 5-5l-2.3 2.3-3.6-3.6Z"/>',
  external: '<path d="M15 3h6v6"/><path d="m10 14 11-11"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]}</svg>`;
const active = document.body.dataset.page;
const shell = document.querySelector('#site-shell');
const navigation = document.createElement('aside');
navigation.className = 'side-navigation';
navigation.innerHTML = `<a class="side-brand" href="./index.html" aria-label="Cloud"><span class="cloud-logo">${icon('cloud')}</span><b>Cloud</b></a><nav aria-label="Secciones">${pages.map(([id,label,iconName,url]) => `<a href="${url}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}><span>${icon(iconName)}</span><b>${label}</b></a>`).join('')}</nav><div class="side-footer"><a href="https://github.com/Slourzz/Cloud" target="_blank" rel="noreferrer"><span>${icon('external')}</span><b>GitHub</b></a></div>`;
shell.prepend(navigation);

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
