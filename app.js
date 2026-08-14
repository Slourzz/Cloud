const pages = [
  ['acerca','Acerca de','./acerca.html'],
  ['funciones','Funciones','./funciones.html'],
  ['descarga','Descarga','./descarga.html'],
  ['agradecimientos','Agradecimientos','./agradecimientos.html']
];
const CLOUD_API_BASE = 'https://cloud-production-4b12.up.railway.app';
const DISCORD_SESSION_KEY = 'cloud-website-discord-session-v1';
const VISITOR_ID_KEY = 'cloud-website-visitor-id-v1';
const discordMark = '<svg class="discord-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.54 5.34A16.3 16.3 0 0 0 15.44 4l-.5 1.02a15.1 15.1 0 0 0-5.88 0L8.56 4a16.3 16.3 0 0 0-4.1 1.34C1.86 9.2 1.16 12.96 1.5 16.66A16.6 16.6 0 0 0 6.5 19.2l1.2-1.64a12 12 0 0 1-1.88-.93c.16.12.33.23.5.34 3.63 1.68 7.63 1.68 11.26 0 .17-.11.34-.22.5-.34-.59.37-1.22.68-1.88.93l1.2 1.64a16.6 16.6 0 0 0 5-2.54c.4-4.3-.68-8.02-2.86-11.32ZM8.68 14.5c-1.1 0-2-1.02-2-2.28s.88-2.28 2-2.28 2.02 1.03 2 2.28c0 1.26-.9 2.28-2 2.28Zm6.64 0c-1.1 0-2-1.02-2-2.28s.88-2.28 2-2.28 2.02 1.03 2 2.28c0 1.26-.9 2.28-2 2.28Z"/></svg>';
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
const utilityLabels = {guias:'Guías',herramientas:'Herramientas',licencia:'Licencia',repositorio:'Repositorio',perfil:'Perfil'};
const activeLabel = pages.find(([id]) => id === active)?.[1] || utilityLabels[active] || 'Inicio';
const activeIndex = pages.findIndex(([id]) => id === active);
navigation.style.setProperty('--active-index', activeIndex);
navigation.classList.toggle('home-active', activeIndex < 0);
navigation.innerHTML = `<a class="top-brand" href="./index.html" aria-label="Cloud"><img src="./assets/cloud-logo.png" alt=""></a><nav class="top-tabs" aria-label="Secciones principales">${pages.map(([id,label,url]) => `<a href="${url}" data-nav-index="${pages.findIndex(([pageId]) => pageId === id)}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}>${label}</a>`).join('')}<span class="nav-selection" aria-hidden="true"></span></nav><div class="top-actions"><a href="./guias.html" class="icon-link ${active==='guias'?'active':''}" aria-label="Guías" title="Guías">${icon('book')}</a><a href="./herramientas.html" class="icon-link ${active==='herramientas'?'active':''}" aria-label="Herramientas" title="Herramientas">${icon('wrench')}</a><button type="button" class="discord-auth-button discord-auth-compact" data-discord-auth aria-label="Iniciar sesión con Discord" title="Iniciar sesión con Discord">${discordMark}</button></div><span class="mobile-current">${activeLabel}</span><button class="mobile-nav-trigger" type="button" aria-label="Abrir navegación" aria-expanded="false">${icon('menu')}</button>`;
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
mobileNavigation.innerHTML = `<div class="mobile-navigation-head"><a href="./index.html"><img src="./assets/cloud-logo.png" alt=""><b>Cloud</b></a><button type="button" class="mobile-navigation-close" aria-label="Cerrar navegación">${icon('close')}</button></div><nav aria-label="Navegación móvil">${pages.map(([id,label,url], index) => `<a href="${url}" class="${active===id?'active':''}"><span>${String(index + 1).padStart(2,'0')}</span>${label}</a>`).join('')}<a href="./licencia.html" class="${active==='licencia'?'active':''}"><span>05</span>Licencia</a><a href="./repositorio.html" class="${active==='repositorio'?'active':''}"><span>06</span>Repositorio</a><a href="./guias.html" class="${active==='guias'?'active':''}"><span>07</span>Guías</a><a href="./herramientas.html" class="${active==='herramientas'?'active':''}"><span>08</span>Herramientas</a></nav><div class="mobile-navigation-foot"><button type="button" class="discord-auth-button" data-discord-auth aria-label="Iniciar sesión con Discord">${discordMark}<span>Iniciar sesión</span></button><a href="./repositorio.html"><span>Repositorio</span></a><a href="https://github.com/Slourzz" target="_blank" rel="noreferrer"><img src="https://github.com/Slourzz.png?size=96" alt="Sam!"><span>Sam!</span></a></div>`;
document.body.append(mobileNavigation);

const discordAuthButtons = [...document.querySelectorAll('[data-discord-auth]')];
let discordSession = null;
let renderedProfile = null;

try {
  const savedSession = JSON.parse(localStorage.getItem(DISCORD_SESSION_KEY) || 'null');
  if (savedSession?.token && savedSession?.user?.id) discordSession = savedSession;
} catch {
  localStorage.removeItem(DISCORD_SESSION_KEY);
}

const renderDiscordSession = () => {
  discordAuthButtons.forEach(button => {
    button.disabled = false;
    button.classList.toggle('is-connected', Boolean(discordSession));
    button.replaceChildren();
    if (discordSession) {
      if (discordSession.user.avatarUrl) {
        const avatar = document.createElement('img');
        avatar.src = discordSession.user.avatarUrl;
        avatar.alt = '';
        button.append(avatar);
      } else {
        button.insertAdjacentHTML('beforeend', discordMark);
      }
      if (!button.classList.contains('discord-auth-compact')) {
        const label = document.createElement('span');
        label.textContent = discordSession.user.displayName || discordSession.user.username;
        button.append(label);
      }
      button.setAttribute('aria-label', `Abrir perfil de ${discordSession.user.displayName}`);
      button.title = `Abrir perfil de ${discordSession.user.displayName}`;
      return;
    }
    button.insertAdjacentHTML('beforeend', discordMark);
    if (!button.classList.contains('discord-auth-compact')) {
      const label = document.createElement('span');
      label.textContent = 'Iniciar sesión';
      button.append(label);
    }
    button.setAttribute('aria-label', 'Iniciar sesión con Discord');
    button.title = 'Iniciar sesión con Discord';
  });
};

const saveDiscordSession = session => {
  discordSession = session;
  if (session) localStorage.setItem(DISCORD_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(DISCORD_SESSION_KEY);
  renderDiscordSession();
  renderProfilePage();
};

async function renderProfilePage() {
  if (document.body.dataset.page !== 'perfil') return;
  const loading = document.querySelector('#profile-loading');
  const gate = document.querySelector('#profile-gate');
  const content = document.querySelector('#profile-content');
  const errorPanel = document.querySelector('#profile-error');
  const requestedId = new URLSearchParams(location.search).get('id');
  if (!requestedId && !discordSession?.user?.id) {
    loading.hidden = true;
    gate.hidden = false;
    content.hidden = true;
    errorPanel.hidden = true;
    return;
  }
  loading.hidden = true;
  gate.hidden = true;
  content.hidden = true;
  errorPanel.hidden = true;
  try {
    const profileId = requestedId || discordSession.user.id;
    const headers = discordSession?.token
      ? {Authorization: `Bearer ${discordSession.token}`}
      : {};
    const response = await fetch(`${CLOUD_API_BASE}/api/profiles/${encodeURIComponent(profileId)}`, {
      headers
    });
    if (response.status === 404) {
      loading.hidden = true;
      errorPanel.hidden = false;
      return;
    }
    if (!response.ok) throw new Error('No se pudo cargar el perfil');
    const result = await response.json();
    const user = result.profile;
    renderedProfile = user;
    const avatar = document.querySelector('#profile-avatar');
    avatar.src = user.avatarUrl || './assets/cloud-app-icon.png';
    avatar.alt = `Avatar de ${user.displayName || user.username}`;
    document.querySelector('#profile-display-name').textContent = user.displayName || user.username;
    document.querySelector('#profile-username').textContent = `@${user.username}`;
    document.querySelector('#profile-biography').textContent = user.biography || 'Este usuario aún no ha añadido una biografía.';
    document.querySelector('#profile-discord-link').href = `https://discord.com/users/${encodeURIComponent(user.id)}`;
    const ownProfile = user.id === discordSession?.user?.id;
    document.querySelector('#profile-edit').hidden = !ownProfile;
    document.querySelector('#profile-my-profile').hidden = !discordSession;
    document.querySelector('#profile-logout').hidden = !discordSession;
    const profileUrl = new URL('./perfil.html', location.href);
    profileUrl.searchParams.set('id', user.id);
    document.querySelector('#profile-share-url').value = profileUrl.href;
    await renderProfileContributions(user.id);
    loading.hidden = true;
    content.hidden = false;
    updateProfileScrollScene();
  } catch {
    loading.hidden = true;
    errorPanel.hidden = false;
    errorPanel.querySelector('p').textContent = 'No se pudo cargar este perfil. Inténtalo nuevamente.';
  }
}

const appleArtworkCache = new Map();
let appleSearchRequestId = 0;

const normalizeCatalogText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const requestAppleSearch = term => new Promise((resolve, reject) => {
  const callbackName = `cloudAppleSearch${Date.now()}${appleSearchRequestId++}`;
  const script = document.createElement('script');
  const cleanup = () => {
    clearTimeout(timeout);
    script.remove();
    delete window[callbackName];
  };
  const timeout = setTimeout(() => {
    cleanup();
    reject(new Error('Apple Search timeout'));
  }, 8000);
  window[callbackName] = result => {
    cleanup();
    resolve(result);
  };
  script.onerror = () => {
    cleanup();
    reject(new Error('Apple Search unavailable'));
  };
  script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=8&callback=${callbackName}`;
  document.head.append(script);
});

const findAppleArtwork = contribution => {
  const title = normalizeCatalogText(contribution.title);
  const artist = normalizeCatalogText(contribution.artist);
  const cacheKey = `${title}|${artist}`;
  if (appleArtworkCache.has(cacheKey)) return appleArtworkCache.get(cacheKey);

  const request = requestAppleSearch(`${contribution.artist || ''} ${contribution.title || ''}`)
    .then(result => {
      const matches = (Array.isArray(result.results) ? result.results : [])
        .map(song => {
          const songTitle = normalizeCatalogText(song.trackName);
          const songArtist = normalizeCatalogText(song.artistName);
          const titleScore = songTitle === title ? 5 : (songTitle.includes(title) || title.includes(songTitle) ? 3 : 0);
          const artistScore = songArtist === artist ? 4 : (songArtist.includes(artist) || artist.includes(songArtist) ? 2 : 0);
          return {song, score: titleScore + artistScore};
        })
        .sort((a, b) => b.score - a.score);
      const artworkUrl = matches[0]?.score >= 7 ? matches[0].song.artworkUrl100 : '';
      return artworkUrl
        ? artworkUrl.replace(/\/\d+x\d+bb\.(jpg|png)(?:\?.*)?$/i, '/600x600bb.$1')
        : '';
    })
    .catch(() => '');
  appleArtworkCache.set(cacheKey, request);
  return request;
};

const createContributionArtwork = contribution => {
  const fallback = document.createElement('span');
  fallback.className = 'profile-contribution-art';
  fallback.ariaLabel = `Portada de reserva para ${contribution.title || 'esta contribución'}`;

  const loadAppleArtwork = async currentNode => {
    const appleUrl = await findAppleArtwork(contribution);
    if (!appleUrl || !currentNode.isConnected) return;
    const appleImage = Object.assign(document.createElement('img'), {src: appleUrl, alt: ''});
    appleImage.addEventListener('error', () => appleImage.replaceWith(fallback), {once: true});
    currentNode.replaceWith(appleImage);
  };

  if (typeof contribution.coverUrl !== 'string' || !/^https:\/\//i.test(contribution.coverUrl)) {
    queueMicrotask(() => loadAppleArtwork(fallback));
    return fallback;
  }

  const image = Object.assign(document.createElement('img'), {src: contribution.coverUrl, alt: ''});
  image.addEventListener('error', () => {
    image.replaceWith(fallback);
    loadAppleArtwork(fallback);
  }, {once: true});
  return image;
};

const renderProfileContributions = async profileId => {
  const list = document.querySelector('#profile-contribution-list');
  const empty = document.querySelector('#profile-contribution-empty');
  const recentList = document.querySelector('#profile-recent-list');
  const recentEmpty = document.querySelector('#profile-recent-empty');
  if (!list || !empty) return;
  list.replaceChildren();
  recentList?.replaceChildren();

  try {
    const response = await fetch(`${CLOUD_API_BASE}/api/profiles/${encodeURIComponent(profileId)}/contributions`);
    if (!response.ok) throw new Error('Contributions unavailable');
    const result = await response.json();
    const contributions = (Array.isArray(result.contributions) ? result.contributions : [])
      .slice()
      .sort((a, b) => {
        const playDifference = (Number(b.plays) || 0) - (Number(a.plays) || 0);
        return playDifference || (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
      });
    const totalPlays = contributions.reduce((total, contribution) => total + (Number(contribution.plays) || 0), 0);
    document.querySelector('#profile-play-total').textContent = totalPlays.toLocaleString('es-MX');
    document.querySelector('#profile-contribution-total').textContent = String(contributions.length);
    document.querySelector('#profile-contribution-badge').textContent = String(contributions.length);
    empty.hidden = contributions.length > 0;

    const recentContributions = contributions
      .slice()
      .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
      .slice(0, 4);
    if (recentEmpty) recentEmpty.hidden = recentContributions.length > 0;
    recentContributions.forEach(contribution => {
      const item = document.createElement('article');
      item.className = 'profile-recent-item';
      const artwork = createContributionArtwork(contribution);
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = contribution.title || 'Contribución de Cloud';
      const artist = document.createElement('span');
      artist.textContent = contribution.artist || 'Artista desconocido';
      copy.append(title, artist);
      const plays = Number(contribution.plays) || 0;
      const counter = document.createElement('small');
      counter.textContent = `${plays.toLocaleString('es-MX')} ${plays === 1 ? 'reproducción' : 'reproducciones'}`;
      item.append(artwork, copy, counter);
      recentList?.append(item);
    });

    contributions.forEach((contribution, index) => {
      const item = document.createElement('article');
      item.className = 'profile-contribution-item';
      item.dataset.search = `${contribution.title || ''} ${contribution.artist || ''}`.toLocaleLowerCase('es');
      item.style.setProperty('--item-delay', `${Math.min(index * 45, 360)}ms`);
      const artwork = createContributionArtwork(contribution);
      const order = document.createElement('span');
      order.className = 'profile-contribution-order';
      order.textContent = String(index + 1).padStart(2, '0');
      const copy = document.createElement('div');
      copy.className = 'profile-contribution-copy';
      const title = document.createElement('strong');
      title.textContent = contribution.title || 'Contribución de Cloud';
      const artist = document.createElement('span');
      artist.textContent = contribution.artist || 'Artista desconocido';
      copy.append(title, artist);
      const type = document.createElement('span');
      type.className = 'profile-contribution-type';
      const plays = Number(contribution.plays) || 0;
      type.textContent = `${plays.toLocaleString('es-MX')} ${plays === 1 ? 'reproducción' : 'reproducciones'}`;
      item.append(order, artwork, copy, type);
      list.append(item);
    });
  } catch {
    document.querySelector('#profile-play-total').textContent = '0';
    document.querySelector('#profile-contribution-total').textContent = '0';
    document.querySelector('#profile-contribution-badge').textContent = '0';
    empty.hidden = false;
    if (recentEmpty) recentEmpty.hidden = false;
  }
};

const updateProfileScrollScene = () => {
  const track = document.querySelector('.profile-scroll-track');
  const stage = document.querySelector('.profile-sticky-stage');
  if (!track || !stage || window.matchMedia('(max-width: 820px)').matches) return;
  const rect = track.getBoundingClientRect();
  const available = Math.max(1, track.offsetHeight - stage.offsetHeight);
  const progress = Math.min(1, Math.max(0, -rect.top / available));
  stage.classList.toggle('is-contributions-view', progress >= .42);
};

const setDiscordBusy = busy => {
  discordAuthButtons.forEach(button => {
    button.disabled = busy;
    button.classList.toggle('is-loading', busy);
  });
};

const pollDiscordSession = async state => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (attempt) await new Promise(resolve => window.setTimeout(resolve, 1000));
    const response = await fetch(`${CLOUD_API_BASE}/api/auth/discord/session/${encodeURIComponent(state)}`);
    if (!response.ok) continue;
    const result = await response.json();
    if (result.status === 'complete' && result.token && result.user) return result;
  }
  throw new Error('El inicio de sesión tardó demasiado. Inténtalo nuevamente.');
};

const startDiscordLogin = async () => {
  if (discordSession) {
    if (window.confirm(`¿Cerrar la sesión de ${discordSession.user.displayName}?`)) saveDiscordSession(null);
    return;
  }

  const popup = window.open('about:blank', 'cloud-discord-auth', 'popup,width=540,height=760');
  if (!popup) {
    window.alert('Permite las ventanas emergentes para iniciar sesión con Discord.');
    return;
  }

  setDiscordBusy(true);
  try {
    popup.document.title = 'Conectando con Discord…';
    const response = await fetch(`${CLOUD_API_BASE}/api/auth/discord/start`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: '{}'
    });
    const result = await response.json();
    if (!response.ok || !result.state || !result.authorizeUrl) {
      throw new Error(result.error || 'Discord no pudo iniciar la conexión.');
    }
    popup.location.replace(result.authorizeUrl);
    const session = await pollDiscordSession(result.state);
    saveDiscordSession({token: session.token, user: session.user});
    if (!popup.closed) popup.close();
  } catch (error) {
    if (!popup.closed) popup.close();
    window.alert(error instanceof Error ? error.message : 'No se pudo iniciar sesión con Discord.');
  } finally {
    setDiscordBusy(false);
  }
};

discordAuthButtons.forEach(button => button.addEventListener('click', () => {
  if (discordSession) {
    window.location.href = `./perfil.html?id=${encodeURIComponent(discordSession.user.id)}`;
    return;
  }
  startDiscordLogin();
}));
renderDiscordSession();

if (document.body.dataset.page === 'perfil') {
  document.querySelector('#profile-logout')?.addEventListener('click', () => saveDiscordSession(null));
  document.querySelector('#profile-my-profile')?.addEventListener('click', () => {
    if (discordSession?.user?.id) location.href = `./perfil.html?id=${encodeURIComponent(discordSession.user.id)}`;
  });
  document.querySelector('#profile-copy-url')?.addEventListener('click', async event => {
    const input = document.querySelector('#profile-share-url');
    try {
      await navigator.clipboard.writeText(input.value);
      const label = event.currentTarget.querySelector('span');
      label.textContent = 'Copiado';
      setTimeout(() => { label.textContent = 'Compartir'; }, 1600);
    } catch {
      input.select();
      document.execCommand('copy');
    }
  });
  window.addEventListener('scroll', updateProfileScrollScene, {passive: true});
  window.addEventListener('resize', updateProfileScrollScene);
  document.querySelector('#profile-contribution-search')?.addEventListener('input', event => {
    const query = event.currentTarget.value.trim().toLocaleLowerCase('es');
    document.querySelectorAll('.profile-contribution-item').forEach(item => {
      item.hidden = Boolean(query) && !item.dataset.search.includes(query);
    });
  });
  const profileEditor = document.querySelector('#profile-editor');
  const biographyInput = document.querySelector('#profile-biography-input');
  const biographyCount = document.querySelector('#profile-biography-count');
  const editorStatus = document.querySelector('#profile-editor-status');
  const closeProfileEditor = () => profileEditor?.close();
  const updateBiographyCount = () => {
    biographyCount.textContent = `${biographyInput.value.length} / 300`;
  };
  document.querySelector('#profile-edit')?.addEventListener('click', () => {
    biographyInput.value = renderedProfile?.biography || '';
    editorStatus.textContent = '';
    updateBiographyCount();
    profileEditor.showModal();
    biographyInput.focus();
  });
  biographyInput?.addEventListener('input', updateBiographyCount);
  document.querySelector('#profile-editor-close')?.addEventListener('click', closeProfileEditor);
  document.querySelector('#profile-editor-cancel')?.addEventListener('click', closeProfileEditor);
  document.querySelector('#profile-editor-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!renderedProfile?.id || renderedProfile.id !== discordSession?.user?.id) return;
    const saveButton = document.querySelector('#profile-editor-save');
    saveButton.disabled = true;
    editorStatus.textContent = 'Guardando…';
    try {
      const response = await fetch(`${CLOUD_API_BASE}/api/profiles/${encodeURIComponent(renderedProfile.id)}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${discordSession.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({biography: biographyInput.value})
      });
      if (!response.ok) throw new Error('No se pudo guardar la biografía');
      const result = await response.json();
      renderedProfile = result.profile;
      document.querySelector('#profile-biography').textContent = renderedProfile.biography || 'Este usuario aún no ha añadido una biografía.';
      closeProfileEditor();
    } catch (error) {
      editorStatus.textContent = error instanceof Error ? error.message : 'No se pudo guardar la biografía.';
    } finally {
      saveButton.disabled = false;
    }
  });
  renderProfilePage();
} else if (discordSession?.token) {
  fetch(`${CLOUD_API_BASE}/api/auth/discord/me`, {
    headers: {Authorization: `Bearer ${discordSession.token}`}
  }).then(response => {
    if (!response.ok) saveDiscordSession(null);
  }).catch(() => {});
}

const recordWebsiteVisit = () => {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID?.() || [...crypto.getRandomValues(new Uint8Array(16))]
      .map(value => value.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  fetch(`${CLOUD_API_BASE}/api/analytics/visit`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({visitorId}),
    keepalive: true
  }).catch(() => {});
};

recordWebsiteVisit();

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
    const logoProgress = clamp(progress / .24);
    const copyProgress = clamp((progress - .28) / .24);
    const detailsProgress = clamp((progress - .52) / .25);
    const arrowProgress = rawProgress > 1.04 ? 0 : clamp((progress - .84) / .12);
    const brand = scrollHero.querySelector('.hero-brand-title');
    const heroViewportHeight = Math.max(1, window.innerHeight - 58);
    const centeredOffset = -(brand?.offsetHeight || 0) / 2;
    const raisedOffset = -heroViewportHeight / 2 - 42;
    const logoOffset = centeredOffset + (raisedOffset - centeredOffset) * logoProgress;
    scrollHero.style.setProperty('--hero-logo-y', `${logoOffset.toFixed(2)}px`);
    scrollHero.style.setProperty('--hero-copy-progress', copyProgress.toFixed(3));
    scrollHero.style.setProperty('--hero-details-progress', detailsProgress.toFixed(3));
    scrollHero.style.setProperty('--hero-arrow-progress', arrowProgress.toFixed(3));
    scrollHero.classList.toggle('hero-sequence-complete', arrowProgress > .98);
    scrollHero.classList.toggle('hero-sequence-past', rawProgress >= 1);
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

const parallaxItems = [...document.querySelectorAll('.player-showcase, .page-header, .content-section, .home-hero, .intro-grid')].filter(element => element !== scrollHero);
// Los recursos de las guías deben conservar su encuadre durante todo el scroll.
// El movimiento vinculado al desplazamiento queda reservado para los heroes.
const scrollMediaItems = [...document.querySelectorAll('.hero-media img')];
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
