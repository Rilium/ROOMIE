/* ROOMIE app logic. Extracted from index.html on 2026-05-30. */
// ── STATE ──
let currentPage = 'home';
let currentUser = null;
let bookingType = 'ore';
let duration = 2;
let currentPreset = 'ranked';
let sessionBaseTotal = 24;
let currentTotal = 24;
let cartItems = [];
let cartTotal = 0;
let appConfig = {hourlyPrice:12, dayPrice:60, guestPassPrice:2, maxPeople:8, lockboxCode:'4729'};
let appAddons = [];
let blockedSlots = [];
let bookedSlots = [];
let activeBookingId = null;
let activeBooking = null;
let activeAccess = {lockboxCode:'4729', doorCode:'4729', validUntil:'22:00'};
let selectedAmt = '20';
let selectedAmtEur = '€20';
let payMethodVal = 'chip';
let pageHistory = [];
let bookingMode = 'now';
let walletBalance = 120;
let guestCount = 0;
let peopleCount = 1;
let bookingStep = 0;
let heroIndex = 0;
let heroTimer = null;
let heroSwipeStartX = null;
let heroSwipeStartY = null;
let lenis = null;
let fullpageInstance = null;
let fullpageClickBound = false;
let landingSectionIndex = 0;
let horizontalSwipeStartX = null;
let horizontalSwipeStartY = null;
let verticalSwipeStartX = null;
let verticalSwipeStartY = null;
let motionInitialized = false;
let motionTriggers = [];
let motionResizeTimer = null;
let accessSafety = {shutter:false,key:false,door:false,power:false};
let roomInside = false;
let accessStepIndex = 0;
let selectedFriends = new Set(['tu']);
let liveMode = false;
let liveActive = false;
let liveConsentReady = false;
let toastTimer = null;
let adminData = null;
let adminBookings = [];
let adminBookingPage = 0;
const adminBookingPageSize = 5;
const accessStepIds = ['step-lockbox','step2-panel','door-panel','power-block-panel','step3-panel'];
const accessStepTitles = ['Cassaforte','Serranda','Porta','Check room','Dentro'];
const bookingStepIds = ['booking-step-session','booking-step-time','booking-step-people','booking-step-extra'];
const bookingStepNames = ['Sessione','Quando','Gruppo','Riepilogo'];
let platformFriends = [];
const heroSlides = [
  {
    image:'/assets/images/roomie-hero-slide-1.webp',
    title:'<span>LA SERATA</span><br><span class="neon-line">INIZIA QUI.</span>',
    addr:'Via Terni, Torino — Prenoti a ore, entri con la tua ROOMIE Chip.',
    sub:'Il tuo clubhouse privato: divani, console, streaming, carte, amici. Zero locale pieno, zero sbatti.',
    meta:['12 chips/ora','fino a 8 persone']
  },
  {
    image:'/assets/images/roomie-hero-slide-2.webp',
    title:'<span>IL TUO HQ.</span><br><span class="neon-line">SOLO VOSTRO.</span>',
    addr:'Gaming, film, partita o cena improvvisata — scegli la sessione.',
    sub:'Non affitti una stanza: blocchi il quartier generale del gruppo, già pronto quando arrivi.',
    meta:['preset da 1h a giornata','split con amici']
  },
  {
    image:'/assets/images/roomie-hero-slide-3.webp',
    title:'<span>CHIP.</span><br><span class="neon-line">CODICE. DENTRO.</span>',
    addr:'Accesso fisico semplice: cassaforte, serranda, porta smart.',
    sub:'Paghi, ricevi i codici, apri e sei dentro. La ROOMIE Chip rende il rituale più veloce e più premium.',
    meta:['accesso guidato','fallback codice']
  }
];

// Set today as default date
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('input-date');
  if(inp) inp.min = formatLocalDate(new Date());
  setBookingMode('now');
  initHeroCarousel();
  initAuthBackground();
  initAnimatedFavicon();
  bindAccessFlow();
  renderFriendSelection();
  updateShopAccessUI();
  loadAppConfig();
  updatePrice();
  updateBookingStep();
  initPremiumMotion();
});

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isTouchLikeDevice() {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

function setupMotionClasses() {
  document.querySelectorAll('.section,.section-sm,.booking-panel,.checkout-card,.confirm-hero,.shop-hero,.session-hero,.dashboard-hero,.token-card,.admin-card,.booking-step-panel,.live-mode-card').forEach(el => {
    el.classList.add('motion-reveal');
  });
  document.querySelectorAll('.shop-hero,.session-hero,.confirm-hero').forEach(el => {
    el.classList.add('motion-parallax');
  });
  document.querySelectorAll('.chip,.inside-item,.addon-chip,.partner-chip,.bk-chip,.preset-chip,.event-chip,.booking-option-card,.friend-chip,.credit-pay-chip,.session-tile,.access-step,.safety-panel,.token-chip,.stat-card,.admin-card').forEach(el => {
    el.classList.add('motion-card','motion-performance');
  });
  document.querySelectorAll('.hero-content,.hero-dots,.booking-sticky,.cart-panel,.access-nav').forEach(el => {
    el.classList.add('motion-soft-blur');
  });
}

function initPremiumMotion() {
  if(motionInitialized) return;
  motionInitialized = true;
  setupMotionClasses();

  if(prefersReducedMotion() || !window.gsap || !window.ScrollTrigger) {
    document.documentElement.classList.add('motion-ready');
    document.querySelectorAll('.motion-reveal,.motion-card,.motion-parallax,.motion-soft-blur').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if(isTouchLikeDevice()) {
    document.documentElement.classList.add('motion-ready','motion-native-scroll');
    stabilizeMobileMotion();
    return;
  }
  document.documentElement.classList.add('motion-ready','motion-native-scroll');

  bindMagneticCards();
  refreshPremiumMotion();
  window.addEventListener('resize', () => {
    window.clearTimeout(motionResizeTimer);
    motionResizeTimer = window.setTimeout(() => refreshPremiumMotion(false), 140);
  }, {passive:true});
}

function shouldUseFullpageLanding() {
  return !prefersReducedMotion() && window.matchMedia('(min-width: 761px) and (pointer: fine)').matches;
}

function initLandingFullpage() {
  if(currentPage !== 'home' || fullpageInstance || !shouldUseFullpageLanding()) return;
  const home = document.getElementById('page-home');
  if(!home) return;
  document.body.classList.add('fullpage-enabled');
  if(lenis?.stop) lenis.stop();
  fullpageInstance = {enabled:true};
  window.fullpage_api = {
    moveTo:index => setLandingSection(Number(index) - 1, true),
    silentMoveTo:index => setLandingSection(Number(index) - 1, false),
    reBuild:updateLandingFullpagePosition,
    destroy:destroyLandingFullpage
  };
  bindLandingFullpageControls();
  setLandingSection(0, false);
}

function destroyLandingFullpage() {
  if(!fullpageInstance) return;
  fullpageInstance = null;
  window.fullpage_api = null;
  document.body.classList.remove('fullpage-enabled');
  document.getElementById('page-home')?.style.removeProperty('transform');
  document.querySelectorAll('#page-home .fp-home-section').forEach(section => section.classList.remove('active'));
  if(lenis?.stop) lenis.stop();
}

function canUseLandingFullpage() {
  return currentPage === 'home' && document.body.classList.contains('fullpage-enabled') && window.fullpage_api;
}

function landingSections() {
  return Array.from(document.querySelectorAll('#page-home .fp-home-section'));
}

function setLandingSection(index, animated=true) {
  const sections = landingSections();
  if(!sections.length) return;
  landingSectionIndex = Math.max(0, Math.min(sections.length - 1, Number.isFinite(index) ? index : 0));
  const home = document.getElementById('page-home');
  if(home) {
    home.style.transitionDuration = animated ? '.78s' : '0s';
    home.style.transform = `translate3d(0,${landingSectionIndex * -100}svh,0)`;
  }
  sections.forEach((section, i) => {
    section.classList.toggle('active', i === landingSectionIndex);
    section.setAttribute('aria-hidden', i === landingSectionIndex ? 'false' : 'true');
  });
}

function updateLandingFullpagePosition() {
  if(!fullpageInstance) return;
  if(!shouldUseFullpageLanding()) {
    destroyLandingFullpage();
    return;
  }
  setLandingSection(landingSectionIndex, false);
}

function refreshLandingFullpage() {
  if(currentPage === 'home') {
    if(!shouldUseFullpageLanding()) {
      destroyLandingFullpage();
      return;
    }
    window.setTimeout(() => {
      initLandingFullpage();
      window.fullpage_api?.reBuild?.();
    }, 120);
  } else {
    destroyLandingFullpage();
  }
}

function goLandingSection(index) {
  if(currentPage === 'home' && window.fullpage_api) {
    window.fullpage_api.moveTo(index + 1);
    return;
  }
  document.getElementById('inside-section')?.scrollIntoView({behavior:'smooth'});
}

function isClickNavExcluded(target) {
  return Boolean(target?.closest?.('button,a,input,textarea,select,form,video,iframe,.modal-overlay,.drawer-panel,.roomie-nav,.mobile-bottom-nav,.page-switcher,.app-subbar'));
}

function getActiveLandingSection() {
  return landingSections()[landingSectionIndex] || document.querySelector('#page-home .fp-home-section');
}

function navigateLandingHorizontal(direction) {
  const section = getActiveLandingSection();
  const type = section?.dataset?.horizontal;
  if(type === 'hero') {
    setHeroSlide((heroIndex + direction + heroSlides.length) % heroSlides.length, true);
    return true;
  }
  if(type === 'inside') {
    moveInsideTab(direction);
    return true;
  }
  return false;
}

function bindLandingHorizontalNavigation() {
  if(fullpageClickBound) return;
  fullpageClickBound = true;
  document.addEventListener('click', e => {
    if(currentPage !== 'home' || !document.body.classList.contains('fullpage-enabled')) return;
    if(isClickNavExcluded(e.target)) return;
    const section = getActiveLandingSection();
    if(!section?.dataset?.horizontal) return;
    const direction = e.clientX > window.innerWidth / 2 ? 1 : -1;
    navigateLandingHorizontal(direction);
  }, true);
  document.addEventListener('pointerdown', e => {
    if(currentPage !== 'home' || !document.body.classList.contains('fullpage-enabled')) return;
    if(isClickNavExcluded(e.target)) return;
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    horizontalSwipeStartX = e.clientX;
    horizontalSwipeStartY = e.clientY;
  }, {passive:true});
  document.addEventListener('pointerup', e => {
    if(horizontalSwipeStartX === null || horizontalSwipeStartY === null) return;
    const dx = e.clientX - horizontalSwipeStartX;
    const dy = e.clientY - horizontalSwipeStartY;
    horizontalSwipeStartX = null;
    horizontalSwipeStartY = null;
    if(currentPage !== 'home' || !document.body.classList.contains('fullpage-enabled')) return;
    if(Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.1) return;
    navigateLandingHorizontal(dx < 0 ? 1 : -1);
  }, {passive:true});
}

function bindLandingFullpageControls() {
  bindLandingHorizontalNavigation();
  if(document.body.dataset.fullpageControlsBound) return;
  document.body.dataset.fullpageControlsBound = 'true';
  let wheelLocked = false;
  document.addEventListener('wheel', e => {
    if(currentPage !== 'home' || !document.body.classList.contains('fullpage-enabled')) return;
    if(isClickNavExcluded(e.target)) return;
    e.preventDefault();
    if(wheelLocked || Math.abs(e.deltaY) < 12) return;
    wheelLocked = true;
    setLandingSection(landingSectionIndex + (e.deltaY > 0 ? 1 : -1), true);
    window.setTimeout(() => { wheelLocked = false; }, 820);
  }, {passive:false});
  document.addEventListener('pointerdown', e => {
    if(currentPage !== 'home' || !document.body.classList.contains('fullpage-enabled')) return;
    if(isClickNavExcluded(e.target)) return;
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    verticalSwipeStartX = e.clientX;
    verticalSwipeStartY = e.clientY;
  }, {passive:true});
  document.addEventListener('pointerup', e => {
    if(verticalSwipeStartX === null || verticalSwipeStartY === null) return;
    const dx = e.clientX - verticalSwipeStartX;
    const dy = e.clientY - verticalSwipeStartY;
    verticalSwipeStartX = null;
    verticalSwipeStartY = null;
    if(currentPage !== 'home' || !document.body.classList.contains('fullpage-enabled')) return;
    if(Math.abs(dy) < 48 || Math.abs(dy) < Math.abs(dx) * 1.12) return;
    setLandingSection(landingSectionIndex + (dy < 0 ? 1 : -1), true);
  }, {passive:true});
  window.addEventListener('resize', updateLandingFullpagePosition, {passive:true});
}

function clearMotionTriggers() {
  motionTriggers.forEach(trigger => trigger.kill());
  motionTriggers = [];
}

function stabilizeMobileMotion() {
  clearMotionTriggers();
  if(window.gsap) {
    const targets = document.querySelectorAll('.motion-reveal,.motion-card,.motion-parallax,.motion-soft-blur,.hero-bg,.hero-content,.hero-dots');
    if(targets.length) {
      gsap.killTweensOf(targets);
      gsap.set(targets, {clearProps:'all', autoAlpha:1});
    }
  }
  document.querySelectorAll('.motion-reveal,.motion-card,.motion-parallax,.motion-soft-blur').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.style.filter = 'none';
    el.style.willChange = 'auto';
  });
}

function trackMotion(animationOrTrigger) {
  const trigger = animationOrTrigger?.scrollTrigger || animationOrTrigger;
  if(trigger?.kill) motionTriggers.push(trigger);
  return animationOrTrigger;
}

function refreshPremiumMotion(resetScroll=true) {
  setupMotionClasses();
  if(prefersReducedMotion() || !window.gsap || !window.ScrollTrigger) return;
  if(currentPage === 'home' && document.body.classList.contains('fullpage-enabled')) {
    clearMotionTriggers();
    const homeMotionTargets = document.querySelectorAll('#page-home .motion-reveal,#page-home .motion-card,#page-home .motion-parallax,#page-home .motion-soft-blur');
    if(homeMotionTargets.length) {
      gsap.killTweensOf(homeMotionTargets);
      gsap.set(homeMotionTargets, {clearProps:'all', autoAlpha:1});
    }
    window.fullpage_api?.reBuild?.();
    return;
  }
  if(isTouchLikeDevice()) {
    stabilizeMobileMotion();
    if(resetScroll) scrollToTopImmediate();
    return;
  }
  clearMotionTriggers();

  const activePage = document.querySelector('.page.active');
  if(!activePage) return;
  const reveals = activePage.querySelectorAll('.motion-reveal');
  if(reveals.length) {
    gsap.killTweensOf(reveals);
    gsap.set(reveals, {autoAlpha:0, y:30, force3D:true});
  }
  reveals.forEach((el, index) => {
    trackMotion(gsap.to(el, {
      autoAlpha:1,
      y:0,
      duration:index < 2 ? 1.05 : .86,
      ease:'power4.out',
      scrollTrigger:{trigger:el, start:'top 86%', once:true}
    }));
  });

  initCinematicHero(activePage);
  if(!isTouchLikeDevice()) {
    initParallax(activePage);
    initPinnedSections(activePage);
  }
  if(resetScroll) scrollToTopImmediate();
  window.setTimeout(() => ScrollTrigger.refresh(), 90);
}

function initCinematicHero(activePage) {
  const hero = activePage.querySelector('.hero');
  if(!hero || !window.gsap) return;
  const content = hero.querySelector('.hero-content');
  const dots = hero.querySelector('.hero-dots');
  const bgs = hero.querySelectorAll('.hero-bg');
  if(content) {
    gsap.killTweensOf(content);
    gsap.fromTo(content,
      {autoAlpha:0, y:44, filter:'blur(10px)'},
      {autoAlpha:1, y:0, filter:'blur(0px)', duration:1.28, ease:'expo.out', delay:.04}
    );
    if(!isTouchLikeDevice()) {
      trackMotion(gsap.to(content, {
        yPercent:-8,
        ease:'none',
        scrollTrigger:{trigger:hero, start:'top top', end:'bottom top', scrub:true}
      }));
    }
  }
  if(dots) {
    gsap.fromTo(dots,
      {autoAlpha:0, x:18},
      {autoAlpha:1, x:0, duration:.9, ease:'power4.out', delay:.28}
    );
  }
  bgs.forEach(bg => gsap.set(bg, {clearProps:'transform'}));
}

function initParallax(activePage) {
  if(!window.gsap) return;
  activePage.querySelectorAll('.motion-parallax:not(.hero-bg)').forEach(el => {
    trackMotion(gsap.fromTo(el,
      {y:18},
      {y:-18, ease:'none', scrollTrigger:{trigger:el, start:'top bottom', end:'bottom top', scrub:true}}
    ));
  });
}

function initPinnedSections(activePage) {
  if(!window.gsap || !window.ScrollTrigger || !window.matchMedia('(min-width: 761px)').matches) return;
  if(activePage?.id === 'page-home') return;
}

function bindMagneticCards() {
  if(prefersReducedMotion() || !window.gsap || !window.matchMedia('(pointer:fine)').matches) return;
  document.querySelectorAll('.motion-card').forEach(card => {
    if(card.dataset.magnetBound) return;
    card.dataset.magnetBound = 'true';
    let rect = null;
    let raf = null;
    card.addEventListener('pointerenter', () => {
      rect = card.getBoundingClientRect();
    }, {passive:true});
    card.addEventListener('pointermove', event => {
      rect = rect || card.getBoundingClientRect();
      if(raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        gsap.to(card, {
          x:x * 7,
          y:y * 7,
          rotateY:x * 6,
          rotateX:y * -5,
          duration:.42,
          ease:'power4.out',
          overwrite:true,
          force3D:true
        });
      });
    }, {passive:true});
    card.addEventListener('pointerleave', () => {
      rect = null;
      if(raf) cancelAnimationFrame(raf);
      gsap.to(card, {x:0,y:0,rotateX:0,rotateY:0,duration:.72,ease:'expo.out',overwrite:true,force3D:true});
    }, {passive:true});
  });
}

function scrollToTopImmediate() {
  if(canUseLandingFullpage()) {
    window.fullpage_api.silentMoveTo(1);
    return;
  }
  window.scrollTo(0,0);
}

function smoothScrollTo(target, offset=0) {
  if(canUseLandingFullpage() && target?.classList?.contains('fp-home-section')) {
    const sections = Array.from(document.querySelectorAll('#page-home .fp-home-section'));
    const index = sections.indexOf(target);
    if(index >= 0) window.fullpage_api.moveTo(index + 1);
    return;
  }
  if(typeof target === 'number') window.scrollTo({top:target + offset, behavior:'smooth'});
  else target?.scrollIntoView({behavior:'smooth', block:'start'});
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatLocalTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function initAnimatedFavicon() {
  const link = document.getElementById('roomie-favicon');
  if(!link) return;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  let frame = 0;
  const draw = () => {
    const t = (frame++ % 72) / 72;
    const spin = t < .72 ? 0 : Math.sin(((t - .72) / .28) * Math.PI);
    const sx = Math.max(.22, Math.abs(Math.cos(spin * Math.PI)));
    ctx.clearRect(0,0,64,64);
    ctx.save();
    ctx.translate(32,32);
    ctx.scale(sx,1);
    const g = ctx.createRadialGradient(-12,-14,4,0,0,31);
    g.addColorStop(0,'#f7ffd8');
    g.addColorStop(.25,'#c8ff00');
    g.addColorStop(.55,'#111');
    g.addColorStop(.72,'#c8ff00');
    g.addColorStop(1,'#050505');
    ctx.beginPath();
    ctx.arc(0,0,28,0,Math.PI*2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d8ff4d';
    ctx.stroke();
    for(let i=0;i<12;i++){
      ctx.save();
      ctx.rotate(i*Math.PI/6);
      ctx.fillStyle = i % 2 ? '#111' : '#fff';
      ctx.fillRect(-2,-28,4,9);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0,0,13,0,Math.PI*2);
    ctx.fillStyle = '#c8ff00';
    ctx.fill();
    ctx.fillStyle = '#101010';
    ctx.font = '900 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R',0,1);
    ctx.restore();
    link.href = canvas.toDataURL('image/png');
  };
  draw();
  window.setInterval(draw, 70);
}

function getRoundedNow() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

function addHoursToTime(time, hours) {
  const [hh, mm] = (time || '20:00').split(':').map(Number);
  const d = new Date();
  d.setHours(hh || 0, mm || 0, 0, 0);
  d.setHours(d.getHours() + hours);
  return formatLocalTime(d);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) {
    const err = new Error(data.error || 'API_ERROR');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function initAuth(initialPage='home') {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get('auth_error');
  const stripeStatus = params.get('stripe');
  const finishBoot = () => {
    window.requestAnimationFrame(() => document.body.classList.remove('app-booting'));
  };
  function cleanQueryParam(name) {
    const clean = new URLSearchParams(window.location.search);
    clean.delete(name);
    const query = clean.toString();
    window.history.replaceState({}, '', window.location.pathname + (query ? '?' + query : ''));
  }
  function showStripeStatus() {
    if(!stripeStatus) return;
    const messages = {
      success:{title:'Chips accreditate', copy:'Saldo aggiornato. Ora puoi completare il pagamento in app.'},
      already:{title:'Ricarica già registrata', copy:'Il saldo era già stato aggiornato per questo pagamento.'},
      pending:{title:'Pagamento in verifica', copy:'Stripe sta ancora confermando la ricarica. Riprova tra qualche secondo.', type:'warn'},
      cancelled:{title:'Pagamento annullato', copy:'Nessun addebito. Puoi ricaricare quando vuoi.', type:'warn'},
      not_configured:{title:'Stripe non attivo', copy:'La ricarica online non è disponibile in questo momento.', type:'warn'},
      error:{title:'Ricarica non completata', copy:'Non siamo riusciti a confermare il pagamento. Riprova.', type:'warn'}
    };
    showToast(messages[stripeStatus] || messages.error);
    cleanQueryParam('stripe');
  }
  if(authError) cleanQueryParam('auth_error');
  if(location.protocol === 'file:') {
    currentUser = null;
    applyAuthState();
    showPage('home', false);
    document.getElementById('auth-offline')?.classList.add('visible');
    if(authError) {
      openAuth('login');
      showAuthError(authErrorMessage(authError));
    }
    finishBoot();
    return;
  }
  try {
    const data = await api('/api/me');
    currentUser = data.user;
    applyAuthState();
    await loadPlatformFriends();
    showPage(initialPage, false);
    if(params.get('auth') === 'social' && currentUser?.role !== 'admin') {
      window.setTimeout(() => showPostAuthWow('login'), 220);
      cleanQueryParam('auth');
    }
    showStripeStatus();
    finishBoot();
  } catch (_err) {
    currentUser = null;
    applyAuthState();
    showPage('home', false);
    if(authError) {
      openAuth('login');
      showAuthError(authErrorMessage(authError));
    }
    if(stripeStatus) {
      openAuth('login');
      showAuthError('Accedi per vedere la ricarica completata.');
    }
    finishBoot();
  }
}

function showAuthTransition(title='ACCESSO IN CORSO', sub='Stiamo preparando saldo, profilo e prossima sessione.') {
  const loader = document.getElementById('auth-transition-loader');
  const titleEl = document.getElementById('auth-loader-title');
  const subEl = document.getElementById('auth-loader-sub');
  if(titleEl) titleEl.textContent = title;
  if(subEl) subEl.textContent = sub;
  loader?.classList.remove('hidden');
}

function hideAuthTransition() {
  document.getElementById('auth-transition-loader')?.classList.add('hidden');
}

function setAuthMode(mode) {
  const isRegister = mode === 'register';
  document.getElementById('auth-tab-login')?.classList.toggle('active', !isRegister);
  document.getElementById('auth-tab-register')?.classList.toggle('active', isRegister);
  document.getElementById('login-form')?.classList.toggle('active', !isRegister);
  document.getElementById('register-form')?.classList.toggle('active', isRegister);
  const title = document.getElementById('auth-panel-title');
  const sub = document.getElementById('auth-panel-sub');
  if(title) title.textContent = isRegister ? 'Crea account' : 'Accedi';
  if(sub) sub.textContent = isRegister ? 'Parti con 24 chips welcome e prenota subito.' : 'Account, chips e prenotazioni in un posto solo.';
  const err = document.getElementById('auth-error');
  err?.classList.remove('visible');
  if(err) err.textContent = '';
}

function authErrorMessage(code) {
  const messages = {
    BAD_CREDENTIALS:'Username/email o password errati.',
    BAD_NAME:'Inserisci un nome valido.',
    BAD_USERNAME:'Username: 3-20 caratteri, solo lettere, numeri e underscore.',
    BAD_EMAIL:'Email non valida.',
    WEAK_PASSWORD:'Password troppo corta: minimo 8 caratteri.',
    USERNAME_TAKEN:'Username già preso.',
    EMAIL_TAKEN:'Email già registrata.',
    USER_SUSPENDED:'Account sospeso: contatta Roomie.',
    GOOGLE_NOT_CONFIGURED:'Google non è ancora attivo. Usa login classico o riprova più tardi.',
    APPLE_NOT_CONFIGURED:'Apple non è ancora attivo. Usa Google o login classico.',
    SOCIAL_NOT_CONFIGURED:'Social login non disponibile al momento.',
    SOCIAL_STATE_ERROR:'Social login scaduto. Riprova.',
    GOOGLE_TOKEN_ERROR:'Google non ha completato il login. Riprova.',
    GOOGLE_SECRET_INVALID:'Google non ha accettato la configurazione OAuth. Riprova o usa login classico.',
    GOOGLE_CODE_EXPIRED:'Il codice Google è scaduto o già usato. Riprova senza ricaricare la pagina.',
    GOOGLE_REDIRECT_MISMATCH:'Redirect URI Google non allineato: usa https://roomie.rilio.it/api/auth/google/callback.',
    GOOGLE_PROFILE_ERROR:'Profilo Google non leggibile. Riprova.',
    SOCIAL_LOGIN_ERROR:'Social login non riuscito. Riprova.',
    API_ERROR:'Qualcosa non ha risposto. Riprova.'
  };
  return messages[code] || messages.API_ERROR;
}

function showAuthError(message) {
  const err = document.getElementById('auth-error');
  if(!err) return;
  err.textContent = message;
  err.classList.add('visible');
}

function openAuth(mode='login') {
  setAuthMode(mode);
  const auth = document.getElementById('auth-screen');
  auth?.classList.remove('hidden');
  window.setTimeout(() => {
    const first = mode === 'register'
      ? document.getElementById('register-name')
      : document.getElementById('login-username');
    first?.focus?.();
  }, 80);
}

function closeAuth() {
  document.getElementById('auth-screen')?.classList.add('hidden');
  document.getElementById('auth-error')?.classList.remove('visible');
}

function isLoggedIn() {
  return !!currentUser && !document.body.classList.contains('auth-logged-out');
}

function requireAuthPage(id) {
  if(!isLoggedIn()) {
    openAuth('login');
    return;
  }
  showPage(id);
}

function socialLogin(provider) {
  const registering = document.getElementById('register-form')?.classList.contains('active');
  if(registering) {
    const ok = document.getElementById('accept-terms')?.checked
      && document.getElementById('accept-privacy')?.checked
      && document.getElementById('accept-cookie')?.checked;
    if(!ok) {
      showAuthError('Prima leggi e conferma Termini, Privacy e Cookie Policy.');
      return;
    }
  }
  if(location.protocol === 'file:') {
    showAuthTransition('ACCESSO GOOGLE', 'Ti portiamo alla versione online per completare il login.');
    window.location.href = 'https://roomie.rilio.it/api/auth/' + provider;
    return;
  }
  showAuthTransition('ACCESSO GOOGLE', 'Google conferma il profilo, poi torni nella tua room.');
  window.location.href = '/api/auth/' + provider;
}

function applyAuthState() {
  const loggedIn = !!currentUser;
  document.body.classList.toggle('auth-logged-out', !loggedIn);
  document.getElementById('auth-screen')?.classList.add('hidden');
  if(currentUser) walletBalance = Number(currentUser.chips || 0);
  const userLabel = document.getElementById('drawer-user-label');
  if(userLabel && currentUser) userLabel.textContent = currentUser.name + ' · ' + currentUser.chips + ' chips';
  const dashName = document.getElementById('dashboard-user-name');
  if(dashName && currentUser) dashName.textContent = currentUser.name;
  document.getElementById('drawer-admin-link')?.classList.toggle('hidden', currentUser?.role !== 'admin');
  updateWalletUI();
  updatePrice();
  updateShopAccessUI();
}

function showPostAuthWow(kind='login') {
  if(currentUser?.role === 'admin') return;
  const modal = document.getElementById('modal-post-auth');
  if(!modal) return;
  document.querySelectorAll('.modal-overlay:not(#modal-post-auth)').forEach(m => m.classList.add('hidden'));
  modal.classList.add('hidden');
  modal.scrollTop = 0;
  const modalBox = modal.querySelector('.post-auth-box');
  if(modalBox) modalBox.scrollTop = 0;
  modalBox?.classList.remove('wow-playing');
  const balance = document.getElementById('post-auth-balance');
  const buying = document.getElementById('post-auth-buying');
  const slot = document.getElementById('post-auth-slot');
  const slotSide = document.getElementById('post-auth-slot-side');
  const slotCopy = document.getElementById('post-auth-slot-copy');
  const chips = Number(currentUser?.chips || walletBalance || 0);
  const primeSlot = nextPrimeSlotLabel();
  if(balance) balance.textContent = chips + ' chips';
  if(buying) buying.textContent = kind === 'register'
    ? 'Welcome chips attive. Puoi bloccare la prima sessione.'
    : chips >= 24 ? 'Hai già abbastanza chips per una Ranked Session.' : 'Ricarica e blocca il prossimo slot.';
  if(slot) slot.textContent = primeSlot;
  if(slotSide) slotSide.textContent = primeSlot;
  if(slotCopy) slotCopy.textContent = chips >= 24
    ? 'Ranked Session · 2h · pronta da bloccare con il tuo saldo.'
    : 'Ricarica rapida e torni qui con lo slot già impostato.';
  openModal('modal-post-auth');
  window.requestAnimationFrame(() => modalBox?.classList.add('wow-playing'));
  burstConfetti(kind === 'register' ? 110 : 84);
}

function nextPrimeSlotLabel() {
  const d = new Date();
  const hour = d.getHours();
  const label = hour >= 18 ? 'Stasera 21:00' : hour >= 12 ? 'Stasera 20:00' : 'Oggi 20:00';
  return label;
}

function updateWalletUI() {
  const chips = Number(currentUser?.chips ?? walletBalance ?? 0);
  walletBalance = chips;
  document.querySelectorAll('.wallet-balance').forEach(el => { el.textContent = chips; });
  document.querySelectorAll('.wallet-pill').forEach(el => { el.dataset.balance = chips; });
  const drawer = document.getElementById('drawer-user-label');
  if(drawer && currentUser) drawer.textContent = currentUser.name + ' · ' + chips + ' chips';
  const tokenSymbol = document.getElementById('token-symbol');
  if(tokenSymbol) tokenSymbol.textContent = chips + ' chips';
  const tokenEur = document.getElementById('token-eur');
  if(tokenEur) tokenEur.textContent = '€' + chips;
  const bookingBalance = document.getElementById('booking-balance');
  if(bookingBalance) bookingBalance.textContent = chips + ' chips';
  const dashBalance = document.querySelector('.dash-bal-val');
  if(dashBalance) dashBalance.textContent = chips + ' chips';
  const dashEur = document.getElementById('dashboard-eur');
  if(dashEur) dashEur.textContent = '= €' + chips;
  const buyingPower = document.getElementById('dashboard-buying-power');
  if(buyingPower) {
    const roomHours = Math.floor(chips / Number(appConfig.hourlyPrice || 12));
    const ranked = Math.floor(chips / 24);
    buyingPower.textContent = roomHours > 0
      ? `Ti bastano per ${roomHours}h room o ${ranked} Ranked Session.`
      : 'Saldo basso: ricarica prima di bloccare la prossima sessione.';
  }
  const checkoutBalance = document.getElementById('checkout-balance');
  if(checkoutBalance) checkoutBalance.textContent = chips;
}

async function login(event) {
  event?.preventDefault();
  const btn = document.getElementById('login-btn');
  document.getElementById('auth-error')?.classList.remove('visible');
  if(location.protocol === 'file:') {
    showAuthError('Apri la versione online per entrare nel tuo account.');
    return;
  }
  if(btn) btn.innerHTML = '<span class="roomie-chip roomie-chip-sm" aria-hidden="true"></span> ENTRO...';
  try {
    const username = document.getElementById('login-username')?.value || '';
    const password = document.getElementById('login-password')?.value || '';
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember: document.getElementById('login-remember')?.checked })
    });
    currentUser = data.user;
    showAuthTransition('ACCESSO COMPLETATO', 'Stiamo preparando dashboard, saldo chips e prossima sessione.');
    applyAuthState();
    await loadPlatformFriends();
    showPage(currentUser.role === 'admin' ? 'admin' : 'home', false);
    window.setTimeout(() => {
      hideAuthTransition();
      if(currentUser.role === 'admin') showToast({title:'Bentornato admin', copy:'Back office operativo pronto.'});
      else showPostAuthWow('login');
    }, 900);
  } catch (err) {
    hideAuthTransition();
    showAuthError(authErrorMessage(err.message));
  } finally {
    if(btn) btn.textContent = 'LOGIN';
  }
}

async function register(event) {
  event?.preventDefault();
  const btn = document.getElementById('register-btn');
  document.getElementById('auth-error')?.classList.remove('visible');
  const acceptedTerms = document.getElementById('accept-terms')?.checked;
  const acceptedPrivacy = document.getElementById('accept-privacy')?.checked;
  const acceptedCookie = document.getElementById('accept-cookie')?.checked;
  if(!acceptedTerms || !acceptedPrivacy || !acceptedCookie) {
    showAuthError('Per creare l’account devi leggere e accettare Termini, Privacy e Cookie Policy.');
    return;
  }
  if(location.protocol === 'file:') {
    showAuthError('Apri la versione online per creare il tuo account.');
    return;
  }
  if(btn) btn.innerHTML = '<span class="roomie-chip roomie-chip-sm" aria-hidden="true"></span> CREO ACCOUNT...';
  try {
    const payload = {
      name: document.getElementById('register-name')?.value || '',
      username: document.getElementById('register-username')?.value || '',
      email: document.getElementById('register-email')?.value || '',
      password: document.getElementById('register-password')?.value || '',
      remember: document.getElementById('register-remember')?.checked
    };
    const data = await api('/api/auth/register', {
      method:'POST',
      body:JSON.stringify(payload)
    });
    currentUser = data.user;
    showAuthTransition('ACCOUNT CREATO', 'Welcome chips attive. Prepariamo la tua prima sessione Roomie.');
    applyAuthState();
    await loadPlatformFriends();
    showPage('home', false);
    window.setTimeout(() => {
      hideAuthTransition();
      showPostAuthWow('register');
    }, 980);
  } catch (err) {
    hideAuthTransition();
    showAuthError(authErrorMessage(err.message));
  } finally {
    if(btn) btn.textContent = 'CREA ACCOUNT';
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method:'POST' }); } catch (_err) {}
  currentUser = null;
  platformFriends = [];
  selectedFriends = new Set(['tu']);
  guestCount = 0;
  activeBookingId = null;
  activeBooking = null;
  roomInside = false;
  renderFriendSelection();
  updateShopAccessUI();
  closeMenu();
  applyAuthState();
  setAuthMode('login');
  showPage('home', false);
}

async function loadAdminSummary() {
  if(currentUser?.role !== 'admin' || location.protocol === 'file:') return;
  try {
    const data = await api('/api/admin/summary');
    adminData = data;
    adminBookings = data.bookings || data.recentBookings || [];
    adminBookingPage = 0;
    const summary = data.summary || {};
    const user = data.user || currentUser;
    const revenue = document.getElementById('admin-revenue');
    if(revenue) revenue.textContent = (summary.revenue || 0) + ' chips';
    const roomRevenue = document.getElementById('admin-revenue-room');
    if(roomRevenue) roomRevenue.textContent = (summary.bookingRevenue || 0) + ' chips';
    const addonRevenue = document.getElementById('admin-revenue-addon');
    if(addonRevenue) addonRevenue.textContent = (summary.addonRevenue || 0) + ' chips';
    document.querySelectorAll('[data-admin-revenue-mini]').forEach(el => { el.textContent = (summary.revenue || 0) + ' chips'; });
    const count = document.getElementById('admin-bookings-count');
    if(count) count.textContent = summary.bookings || 0;
    document.querySelectorAll('[data-admin-bookings-mini]').forEach(el => { el.textContent = summary.bookings || 0; });
    const pending = document.getElementById('admin-pending-count');
    if(pending) pending.textContent = summary.pending || 0;
    document.querySelectorAll('[data-admin-pending-mini]').forEach(el => { el.textContent = summary.pending || 0; });
    const usersCount = document.getElementById('admin-users-count');
    if(usersCount) usersCount.textContent = summary.users || 0;
    const adminName = document.getElementById('admin-user-name');
    if(adminName) adminName.textContent = user.name || 'System Admin';
    const config = data.config || {};
    [['admin-price-hour','hourlyPrice'],['admin-price-day','dayPrice'],['admin-price-guest','guestPassPrice'],['admin-max-people','maxPeople'],['admin-lockbox-code','lockboxCode']].forEach(([id,key]) => {
      const el = document.getElementById(id);
      if(el) el.value = config[key] ?? '';
    });
    renderAdminBookings();
    renderAdminUsers(data.users || []);
    renderAdminOps(data);
  } catch (err) {
    showToast(err.status === 403 ? 'Accesso admin negato' : 'Admin API non disponibile');
  }
}

async function loadDashboardData() {
  if(!currentUser || location.protocol === 'file:') return;
  try {
    const data = await api('/api/dashboard').catch(async () => {
      const fallback = await api('/api/bookings');
      return {bookings:fallback.bookings || [], stats:null, mission:null, recommendedAddons:[]};
    });
    const bookings = data.bookings || [];
    const sorted = [...bookings].sort((a,b) => bookingSortValue(a) - bookingSortValue(b));
    const now = new Date();
    const upcoming = sorted.filter(b => activeStatusesClient().includes(b.status) && bookingIsUpcoming(b));
    const past = [...bookings].sort((a,b) => bookingSortValue(b) - bookingSortValue(a));
    const stats = data.stats || {};
    const totalSpent = Number(stats.totalSpent ?? bookings.reduce((sum, b) => sum + Number(b.totalChips || 0), 0));
    const count = document.getElementById('dashboard-session-count');
    if(count) count.textContent = Number(stats.totalBookings ?? bookings.length);
    const spent = document.getElementById('dashboard-chips-spent');
    if(spent) spent.textContent = totalSpent;
    const next = data.next || upcoming[0] || sorted.find(b => activeStatusesClient().includes(b.status));
    if(next) {
      applyBookingToAccess(next);
    } else {
      activeBookingId = null;
      activeBooking = null;
      roomInside = false;
      updateShopAccessUI();
    }
    const nextBox = document.getElementById('dashboard-next-session');
    if(nextBox) {
      if(next) {
        nextBox.classList.add('session-launchpad');
        const reco = sessionRecommendationNames(next).map(name => `<span class="shop-reco-pill">${name}</span>`).join('');
        const accessLive = bookingIsLive(next);
        const accessLabel = accessLive ? 'APRI ACCESSO' : `VEDI ACCESSO`;
        nextBox.innerHTML = `<div class="session-kicker"><i class="fas fa-bolt"></i> LA TUA ROOM SI PREPARA</div>
          <div class="session-main-title">${bookingDateLabel(next, 'long')}<br>${next.start || '--:--'} → ${next.end || '--:--'}</div>
          <div class="countdown-text" style="margin-top:10px">${sessionCountdownLabel(next)}</div>
          <div class="session-meta-row">
            <span class="session-meta-pill"><i class="fas fa-map-marker-alt"></i> Via Terni · 40 m2</span>
            <span class="session-meta-pill"><i class="fas fa-users"></i> ${peopleText(next.people)}</span>
            <span class="session-meta-pill"><i class="fas fa-coins"></i> ${next.totalChips || 0} chips</span>
          </div>
          <div class="shop-reco-strip">${reco}</div>
          <div class="session-action-grid">
            <button class="${accessLive ? 'btn-neon' : 'quiet-action'}" onclick="openBookingAccess('${next.id}')"><i class="fas fa-route"></i> ${accessLabel}</button>
            <button class="quiet-action" onclick="showPage('shop')"><i class="fas fa-shopping-bag"></i> ${accessLive ? 'ADDON LIVE' : 'SHOP PREVIEW'}</button>
            <button class="quiet-action" onclick="openInviteModal()"><i class="fas fa-user-plus"></i> INVITA</button>
            <button class="quiet-action" onclick="showPage('room')"><i class="fas fa-redo"></i> RIPRENOTA</button>
          </div>`;
      } else {
        const mission = data.mission || {title:'Blocca la prossima serata', copy:'Scegli un preset, invita chi vuoi e arrivi con accesso, codici e addon già pronti.', cta:'PRENOTA ORA', page:'room'};
        const rec = data.recommended || {};
        const addons = (data.recommendedAddons || []).map(a => `<span class="shop-reco-pill">${a.brand || 'ROOMIE'} · ${a.name}</span>`).join('');
        nextBox.classList.add('session-launchpad');
        nextBox.innerHTML = `<div class="session-kicker"><i class="fas fa-bullseye"></i> PROSSIMA MOSSA</div>
          <div class="session-main-title">${mission.title}</div>
          <div style="font-size:.92rem;color:rgba(255,255,255,.72);line-height:1.5;margin-top:10px;max-width:34rem">${mission.copy}</div>
          <div class="dash-reco-card">
            <span>${rec.title || 'Slot consigliato'}</span>
            <strong>${rec.start || '20:00'} · ${rec.durationHours || 2}h</strong>
            <small>${rec.copy || 'Setup bilanciato per partire senza pensarci troppo.'}</small>
          </div>
          ${addons ? `<div class="shop-reco-strip">${addons}</div>` : ''}
          <div class="session-action-grid"><button class="btn-neon" onclick="showPage('${mission.page || 'room'}')"><i class="fas fa-calendar-check"></i> ${mission.cta || 'PRENOTA ORA'}</button><button class="quiet-action" onclick="showPage('shop')"><i class="fas fa-shopping-bag"></i> SHOP PREVIEW</button></div>`;
      }
    }
    const dashInsights = document.getElementById('dashboard-insights');
    if(dashInsights) {
      const monthCount = Number(stats.monthCount ?? bookings.filter(b => {
        if(!b.date) return false;
        const d = new Date(b.date + 'T12:00:00');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length);
      const toNeon = Number(stats.toNeon ?? Math.max(0, 5 - monthCount));
      const chips = Number(stats.chips ?? currentUser?.chips ?? walletBalance ?? 0);
      dashInsights.innerHTML = `<div class="dash-insight-card"><div><i class="fas fa-fire"></i> ${monthCount} sessioni</div><span>questo mese</span></div><div class="dash-insight-card accent"><div>NEON CHIP</div><span>${toNeon ? `mancano ${toNeon} sessioni` : 'sbloccabile ora'}</span></div><div class="dash-insight-card"><div>${chips} chips</div><span>saldo disponibile</span></div>`;
    }
    const nextStaticTitle = document.getElementById('dashboard-next-booking-title');
    const nextStatic = document.getElementById('dashboard-next-booking-card');
    if(nextStaticTitle) nextStaticTitle.style.display = next ? 'block' : 'none';
    if(nextStatic) {
      if(next) {
        nextStatic.style.display = 'flex';
        const d = next.date ? new Date(next.date + 'T12:00:00') : new Date();
        const accessLive = bookingIsLive(next);
        nextStatic.innerHTML = `<div class="bk-date"><div class="bk-day">${String(d.getDate()).padStart(2,'0')}</div><div class="bk-month">${d.toLocaleDateString('it-IT', {month:'short'}).toUpperCase()}</div></div><div class="bk-info"><div class="bk-room">${next.room || 'Room Via Terni'} · Torino</div><div class="bk-time">${bookingTimeLabel(next)} · ${peopleText(next.people)} · ${accessLive ? 'accesso live' : 'accesso dalle ' + (next.start || '--:--')}</div></div><div><div class="bk-price">${next.totalChips || 0} chips</div><div class="status-badge s-paid" style="margin-top:4px">${statusLabel(next.status)}</div></div><button onclick="openBookingAccess('${next.id}')" style="background:${accessLive ? 'var(--neon)' : 'rgba(255,255,255,.12)'};border:none;color:${accessLive ? 'var(--dark)' : 'rgba(255,255,255,.72)'};border-radius:8px;padding:8px 14px;font-weight:900;font-size:.78rem;flex-shrink:0">${accessLive ? 'ENTRA' : 'DETTAGLI'}</button>`;
      } else {
        nextStatic.style.display = 'none';
        nextStatic.innerHTML = '';
      }
    }
    const history = document.getElementById('dashboard-history-list');
    const historyTitle = document.getElementById('dashboard-history-title');
    const historyItems = data.history || past;
    if(historyTitle) historyTitle.style.display = historyItems.length ? 'block' : 'none';
    if(history) {
      history.innerHTML = historyItems.slice(0, 6).map(b => {
        const d = b.date ? new Date(b.date + 'T12:00:00') : new Date();
        const day = String(d.getDate()).padStart(2,'0');
        const month = d.toLocaleDateString('it-IT', {month:'short'}).toUpperCase();
        const statusClass = b.status === 'confirmed' ? 's-paid' : b.status === 'cancelled' ? 's-cancelled' : 's-complete';
        return `<div class="bk-chip"><div class="bk-date"><div class="bk-day">${day}</div><div class="bk-month">${month}</div></div><div class="bk-info"><div class="bk-room">${b.room || 'Room Via Terni'}</div><div class="bk-time">${b.start || '--:--'} → ${b.end || '--:--'} · ${peopleText(b.people)}</div></div><div><div class="bk-price">${b.totalChips || 0} chips</div><div class="status-badge ${statusClass}" style="margin-top:4px">${statusLabel(b.status)}</div></div></div>`;
      }).join('');
    }
    updateShopAccessUI();
  } catch (_err) {}
}

async function loadPlatformFriends() {
  if(!currentUser || location.protocol === 'file:') return;
  try {
    const data = await api('/api/friends/platform');
    platformFriends = Array.isArray(data.friends) ? data.friends : [];
  } catch (_err) {
    platformFriends = [];
  }
  renderFriendSelection();
}

function activeStatusesClient() {
  return ['confirmed','pending'];
}

function setAdminTab(btn, id) {
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
  btn?.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById('admin-panel-' + id)?.classList.add('active');
}

function changeAdminBookingPage(delta) {
  const maxPage = Math.max(0, Math.ceil(adminBookings.length / adminBookingPageSize) - 1);
  adminBookingPage = Math.max(0, Math.min(maxPage, adminBookingPage + delta));
  renderAdminBookings();
}

function statusLabel(status) {
  const labels = {confirmed:'CONFERMATA', pending:'IN ATTESA', completed:'COMPLETATA', cancelled:'ANNULLATA'};
  return labels[status] || String(status || 'OK').toUpperCase();
}

function bookingDateLabel(booking, format='short') {
  if(!booking?.date) return 'Data da definire';
  const opts = format === 'long'
    ? {weekday:'long', day:'numeric', month:'long'}
    : {weekday:'short', day:'numeric', month:'short'};
  return new Date(booking.date + 'T12:00:00').toLocaleDateString('it-IT', opts);
}

function bookingTimeLabel(booking) {
  return (booking?.start || '--:--') + ' → ' + (booking?.end || '--:--');
}

function peopleText(count) {
  const n = Number(count || 1);
  return n + (n === 1 ? ' persona' : ' persone');
}

function bookingStartDate(booking) {
  if(!booking?.date || !booking?.start) return null;
  const d = new Date(booking.date + 'T' + booking.start);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bookingEndDate(booking) {
  if(!booking?.date || !booking?.end) return null;
  const d = new Date(booking.date + 'T' + booking.end);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bookingIsLive(booking) {
  if(!booking || booking.status !== 'confirmed') return false;
  const start = bookingStartDate(booking);
  const end = bookingEndDate(booking);
  if(!start || !end) return false;
  const now = Date.now();
  return now >= start.getTime() && now <= end.getTime();
}

function bookingAccessWindowLabel(booking) {
  if(!booking) return 'Prenota una sessione per aprire l’accesso.';
  const date = bookingDateLabel(booking);
  const time = bookingTimeLabel(booking);
  if(booking.status !== 'confirmed') return `Accesso disponibile dopo conferma pagamento · ${date} · ${time}.`;
  return `Accesso disponibile solo nella fascia pagata: ${date} · ${time}.`;
}

function sessionCountdownLabel(booking) {
  const start = bookingStartDate(booking);
  const end = bookingEndDate(booking);
  if(!start) return 'Accesso pronto';
  if(end && Date.now() > end.getTime()) return 'Sessione conclusa';
  const diff = start.getTime() - Date.now();
  if(diff <= 0) return bookingIsLive(booking) ? 'Accesso attivo ora' : 'Accesso non disponibile';
  const mins = Math.ceil(diff / 60000);
  if(mins < 60) return `Tra ${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `Tra ${hours}h ${rem}m` : `Tra ${hours}h`;
}

function sessionRecommendationNames(booking=activeBooking) {
  const hour = Number(String(booking?.start || document.getElementById('input-start')?.value || '20:00').slice(0,2));
  const names = [];
  if(hour >= 19) names.push('DAZN Partita', 'Snack Box');
  if((booking?.people || peopleCount || 1) >= 3) names.push('Birra ×4', 'Neon Party');
  if(currentPreset === 'movie' || duration >= 3) names.push('Cinema Mode');
  if(currentPreset === 'ranked' || duration <= 2) names.push('Gaming Pro Setup');
  return [...new Set(names)].slice(0, 4);
}

function bookingIsUpcoming(booking) {
  if(!booking?.date || !booking?.end) return false;
  return new Date(booking.date + 'T' + booking.end) >= new Date();
}

function bookingSortValue(booking) {
  return new Date((booking?.date || '1970-01-01') + 'T' + (booking?.start || '00:00')).getTime();
}

function applyBookingToAccess(booking) {
  if(!booking) return;
  const previousBookingId = activeBookingId;
  activeBooking = booking;
  activeBookingId = booking.id || activeBookingId;
  if(previousBookingId && activeBookingId !== previousBookingId) roomInside = false;
  activeAccess = {
    lockboxCode: booking.lockboxCode || appConfig.lockboxCode || '4729',
    doorCode: booking.doorCode || '4729',
    validUntil: booking.accessValidUntil || booking.end || '22:00'
  };
  const keyCode = document.getElementById('key-code');
  if(keyCode) keyCode.dataset.code = activeAccess.lockboxCode;
  const validUntil = document.getElementById('code-valid-until');
  if(validUntil) validUntil.textContent = activeAccess.validUntil;
  const doorValidUntil = document.getElementById('door-code-valid-until');
  if(doorValidUntil) doorValidUntil.textContent = activeAccess.validUntil;
  const confDate = document.getElementById('conf-date');
  if(confDate) confDate.textContent = bookingDateLabel(booking);
  const confTime = document.getElementById('conf-time');
  if(confTime) confTime.textContent = bookingTimeLabel(booking);
  const confPeople = document.getElementById('conf-people');
  if(confPeople) confPeople.textContent = booking.people || peopleCount || 1;
  const confPaid = document.getElementById('conf-paid');
  if(confPaid) confPaid.textContent = (booking.totalChips || currentTotal || 0) + ' chips';
  const arrivalCountdown = document.getElementById('arrival-countdown');
  if(arrivalCountdown) arrivalCountdown.textContent = sessionCountdownLabel(booking);
  const arrivalCopy = document.getElementById('arrival-copy');
  if(arrivalCopy) {
    arrivalCopy.textContent = `${bookingDateLabel(booking)} · ${bookingTimeLabel(booking)}. Prima cassaforte serranda, poi ROOMIE Chip o codice porta.`;
  }
  const sessionPeople = document.getElementById('session-people');
  if(sessionPeople) sessionPeople.textContent = peopleText(booking.people);
  const sessionSplit = document.getElementById('session-split');
  if(sessionSplit) sessionSplit.textContent = `sessione attiva · ${booking.totalChips || 0} chips`;
  ['until-time','session-until'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = booking.end || activeAccess.validUntil;
  });
  revealAccessCode(false);
  updateAccessAvailabilityUI();
  updateShopSessionContext();
  updateShopAccessUI();
}

function updateAccessAvailabilityUI() {
  const page = document.getElementById('page-confirm');
  const live = hasLiveSession();
  const hasBooking = hasActiveSession();
  if(page) page.classList.toggle('access-waiting', hasBooking && !live);
  const heroTitle = document.querySelector('#page-confirm .confirm-title');
  const heroCopy = document.querySelector('#page-confirm .confirm-hero div[style*="line-height:1.6"]');
  const arrivalTitle = document.querySelector('#arrival-card .arrival-title');
  const arrivalCountdown = document.getElementById('arrival-countdown');
  const arrivalCopy = document.getElementById('arrival-copy');
  const waitCopy = document.getElementById('access-wait-copy');
  const startBtn = document.getElementById('arrival-start-btn');
  if(hasBooking && !live) {
    if(heroTitle) heroTitle.innerHTML = 'SESSIONE<br>PROGRAMMATA';
    if(heroCopy) heroCopy.textContent = 'La room è bloccata. I codici si attivano solo nella fascia pagata, così accesso e sicurezza restano coerenti.';
    if(arrivalTitle) arrivalTitle.textContent = 'Accesso non ancora disponibile.';
    if(arrivalCountdown) arrivalCountdown.textContent = sessionCountdownLabel(activeBooking);
    const copy = `${bookingDateLabel(activeBooking)} · ${bookingTimeLabel(activeBooking)}. Quando sei live sblocchi cassaforte, serranda e porta da qui.`;
    if(arrivalCopy) arrivalCopy.textContent = copy;
    if(waitCopy) waitCopy.textContent = copy;
    if(startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = `<i class="fas fa-lock"></i> ACCESSO DALLE ${activeBooking?.start || '--:--'}`;
    }
  } else {
    if(heroTitle) heroTitle.innerHTML = 'PRENOTAZIONE<br>CONFERMATA';
    if(heroCopy) heroCopy.textContent = 'La room è bloccata. Prima alzi la serranda, poi apri la porta con ROOMIE Chip o codice.';
    if(arrivalTitle) arrivalTitle.textContent = 'Quando sei davanti, parti da qui.';
    if(startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = '<i class="fas fa-route"></i> INIZIA ACCESSO';
    }
  }
}

function updateShopSessionContext() {
  const box = document.getElementById('shop-session-context');
  if(!box) return;
  if(activeBooking) {
    const reco = sessionRecommendationNames(activeBooking).map(name => `<span class="shop-reco-pill">${name}</span>`).join('');
    const live = bookingIsLive(activeBooking);
    box.innerHTML = `<div><strong>${live ? 'Shop attivo ora' : 'Shop pronto per la tua sessione'}</strong><span>${bookingDateLabel(activeBooking)} · ${bookingTimeLabel(activeBooking)} · ${peopleText(activeBooking.people)}${live ? '' : ' · acquisti bloccati fino allo start'}</span><div class="shop-reco-strip">${reco}</div></div><button class="admin-page-btn" ${live ? `onclick="openBookingAccess('${activeBooking.id}')"` : `onclick="showPage('dashboard')"`}>${live ? 'ACCESSO' : 'VEDI COUNTDOWN'}</button>`;
  } else {
    box.innerHTML = `<div><strong>Preview shop disponibile</strong><span>Guardi tutto ora. Prenoti una sessione e gli acquisti si attivano quando sei dentro.</span></div><button class="admin-page-btn" onclick="showPage('room')">PRENOTA</button>`;
  }
  renderShopAddons();
}

async function openBookingAccess(id) {
  if(location.protocol !== 'file:' && currentUser) {
    try {
      const data = await api('/api/bookings');
      const booking = (data.bookings || []).find(b => b.id === id) || (data.bookings || [])[0];
      if(booking) applyBookingToAccess(booking);
    } catch (_err) {}
  }
  if(!hasLiveSession()) {
    showToast({title:'Accesso non ancora live', copy:bookingAccessWindowLabel(activeBooking), type:'warn'});
    showPage('confirm');
    return;
  }
  showPage('confirm');
}

async function ensureAccessBooking() {
  if(activeBookingId && activeBooking) {
    applyBookingToAccess(activeBooking);
    return true;
  }
  if(location.protocol === 'file:' || !currentUser) return false;
  try {
    const data = await api('/api/bookings');
    const active = (data.bookings || [])
      .filter(b => activeStatusesClient().includes(b.status))
      .sort((a,b) => bookingSortValue(a) - bookingSortValue(b));
    const next = active.find(bookingIsUpcoming) || active[0];
    if(next) {
      applyBookingToAccess(next);
      if(bookingIsLive(next)) return true;
      showToast({title:'Accesso fuori orario', copy:bookingAccessWindowLabel(next), type:'warn'});
      return false;
    }
  } catch (_err) {}
  showToast({title:'Nessuna sessione attiva', copy:'Prenota la room prima di aprire l’accesso guidato.', type:'warn'});
  showPage('room');
  return false;
}

function renderAdminBookings() {
  const body = document.getElementById('admin-bookings-body');
  if(!body) return;
  const start = adminBookingPage * adminBookingPageSize;
  const page = adminBookings.slice(start, start + adminBookingPageSize);
  const totalPages = Math.max(1, Math.ceil(adminBookings.length / adminBookingPageSize));
  const range = document.getElementById('admin-bookings-range');
  if(range) range.textContent = adminBookings.length ? `${start + 1}-${start + page.length} di ${adminBookings.length}` : '0 di 0';
  const label = document.getElementById('admin-page-label');
  if(label) label.textContent = `Pagina ${adminBookingPage + 1} / ${totalPages}`;
  const prev = document.getElementById('admin-prev');
  const next = document.getElementById('admin-next');
  if(prev) prev.disabled = adminBookingPage === 0;
  if(next) next.disabled = adminBookingPage >= totalPages - 1;
  if(!page.length) {
    body.innerHTML = '<div class="participant-note">Nessuna prenotazione.</div>';
    return;
  }
  body.innerHTML = page.map(b => {
    const statusClass = b.status === 'confirmed' ? 's-paid' : b.status === 'pending' ? 's-pending' : b.status === 'cancelled' ? 's-cancelled' : 's-complete';
    return `<div class="admin-booking-card">
      <div class="admin-booking-main"><strong>${b.userName || b.userId || 'utente'} · ${b.totalChips || 0} chips</strong><span>${b.username || b.userEmail || b.id}</span><span>${bookingDateLabel(b)} · ${bookingTimeLabel(b)} · ${peopleText(b.people)}</span><div class="admin-code-row"><span class="status-badge ${statusClass}">${statusLabel(b.status)}</span><span class="admin-code-pill">Cassaforte ${b.lockboxCode || '----'}</span><span class="admin-code-pill">Porta ${b.doorCode || '----'}</span></div></div>
      <div class="admin-booking-edit"><input class="form-input" id="bk-date-${b.id}" type="date" value="${b.date || ''}"><input class="form-input" id="bk-people-${b.id}" type="number" value="${b.people || 1}"><input class="form-input" id="bk-start-${b.id}" type="time" value="${b.start || ''}"><input class="form-input" id="bk-end-${b.id}" type="time" value="${b.end || ''}"><input class="form-input" id="bk-total-${b.id}" type="number" value="${b.totalChips || 0}"><select class="form-input" id="bk-status-${b.id}"><option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confermata</option><option value="pending" ${b.status === 'pending' ? 'selected' : ''}>In attesa</option><option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Completata</option><option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Annullata</option></select></div>
      <div class="admin-booking-actions"><button class="admin-page-btn" onclick="saveAdminBooking('${b.id}')">SALVA</button><button class="admin-page-btn" onclick="copyAdminAccess('${b.id}')" style="color:var(--neon)">COPIA CODICI</button></div>
    </div>`;
  }).join('');
}

function renderAdminUsers(users) {
  const list = document.getElementById('admin-users-list');
  if(!list) return;
  list.innerHTML = users.map(u => `<div class="admin-mini-item"><input class="form-input" id="user-name-${u.id}" value="${u.name}" style="margin-bottom:8px"><input class="form-input" id="user-email-${u.id}" value="${u.email || ''}" placeholder="email" style="margin-bottom:8px"><span>@${u.username}</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><select class="form-input" id="user-role-${u.id}"><option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select><select class="form-input" id="user-suspended-${u.id}"><option value="false" ${!u.suspended ? 'selected' : ''}>Attivo</option><option value="true" ${u.suspended ? 'selected' : ''}>Sospeso</option></select></div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px"><b style="color:var(--neon)">${u.chips} chips</b><div style="display:flex;gap:6px"><button class="admin-page-btn" onclick="adjustUserChips('${u.id}',10)">+10</button><button class="admin-page-btn" onclick="adjustUserChips('${u.id}',-10)">-10</button></div></div><button class="admin-page-btn" style="width:100%;margin-top:10px" onclick="saveAdminUser('${u.id}')">SALVA UTENTE</button></div>`).join('');
}

function copyAdminAccess(id) {
  const booking = adminBookings.find(b => b.id === id);
  if(!booking) return;
  const text = `ROOMIE ${bookingDateLabel(booking)} ${bookingTimeLabel(booking)} · cassaforte ${booking.lockboxCode || '----'} · porta ${booking.doorCode || '----'}`;
  navigator.clipboard?.writeText(text);
  showToast({title:'Codici copiati', copy:'Cassaforte e porta copiati per questa prenotazione.'});
}

function renderAdminOps(data) {
  const access = data.access || {};
  const accessList = document.getElementById('admin-access-list');
  if(accessList) accessList.innerHTML = [
    ['Cassaforte', 'Codice ' + (access.lockboxCode || '----'), 's-paid'],
    ['Serranda', access.shutter || 'n/d', 's-paid'],
    ['Porta smart', access.door || 'n/d', 's-paid'],
    ['Corrente room', access.power || 'n/d', 's-pending']
  ].map(item => `<div class="admin-mini-item"><strong>${item[0]}</strong><span>${item[1]}</span><span class="status-badge ${item[2]}" style="margin-top:10px">ONLINE</span></div>`).join('') + (data.blockedSlots || []).map(slot => `<div class="admin-mini-item"><strong>Slot bloccato</strong><span>${slot.date || '-'} · ${slot.start || '--'}→${slot.end || '--'} · ${slot.reason || ''}</span><button class="admin-page-btn" style="width:100%;margin-top:10px" onclick="deleteBlockedSlot('${slot.id}')">SBLOCCA</button></div>`).join('');
  const addons = document.getElementById('admin-addons-list');
  if(addons) addons.innerHTML = (data.addons || []).map(a => `<div class="admin-mini-item">
    <input class="form-input" id="addon-name-${a.id}" value="${a.name}" style="margin-bottom:8px">
    <input class="form-input" id="addon-desc-${a.id}" value="${a.description || ''}" style="margin-bottom:8px">
    <div style="display:grid;grid-template-columns:1fr 90px;gap:8px;margin-bottom:8px"><input class="form-input" id="addon-brand-${a.id}" value="${a.brand || 'ROOMIE'}"><input class="form-input" id="addon-price-${a.id}" type="number" value="${a.price}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><select class="form-input" id="addon-category-${a.id}"><option value="featured" ${a.category === 'featured' ? 'selected' : ''}>Top</option><option value="modes" ${a.category === 'modes' ? 'selected' : ''}>Mood</option><option value="snacks" ${a.category === 'snacks' ? 'selected' : ''}>Snack</option></select><select class="form-input" id="addon-status-${a.id}"><option value="active" ${a.status === 'active' ? 'selected' : ''}>Attivo</option><option value="soldout" ${a.status === 'soldout' ? 'selected' : ''}>Esaurito</option><option value="hidden" ${a.status === 'hidden' ? 'selected' : ''}>Nascosto</option></select></div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="admin-page-btn" style="flex:1" onclick="saveAdminAddon('${a.id}')">SALVA</button><button class="admin-page-btn" style="color:var(--orange)" onclick="deleteAdminAddon('${a.id}')">ELIMINA</button></div>
  </div>`).join('');
  const addonOrders = document.getElementById('admin-addon-orders-list');
  if(addonOrders) addonOrders.innerHTML = (data.addonOrders || []).map(order => {
    const items = (order.items || []).map(item => `${item.qty || 1}× ${item.name}`).join(' · ');
    return `<div class="admin-mini-item"><strong>${order.userName || 'Cliente'} · ${order.totalChips || 0} chips</strong><span>${items || 'Addon'} </span><span>${new Date(order.createdAt).toLocaleString('it-IT')} · ${order.status || 'paid'}</span></div>`;
  }).join('') || '<div class="participant-note">Nessun ordine addon ancora.</div>';
  const audit = document.getElementById('admin-audit-list');
  if(audit) audit.innerHTML = (data.auditLog || []).map(e => `<div class="admin-mini-item"><strong>${e.type}</strong><span>${new Date(e.createdAt).toLocaleString('it-IT')} · ${e.userId || 'system'}</span></div>`).join('');
}

async function updateBookingStatus(id, status) {
  if(!status) return;
  await api('/api/admin/bookings/' + id + '/status', {method:'PATCH', body:JSON.stringify({status})});
  showToast({title:'Prenotazione aggiornata', copy:'Stato salvato nel backend.'});
  loadAdminSummary();
}

async function saveAdminBooking(id) {
  const payload = {
    date: document.getElementById('bk-date-' + id)?.value,
    start: document.getElementById('bk-start-' + id)?.value,
    end: document.getElementById('bk-end-' + id)?.value,
    people: Number(document.getElementById('bk-people-' + id)?.value || 1),
    totalChips: Number(document.getElementById('bk-total-' + id)?.value || 0),
    status: document.getElementById('bk-status-' + id)?.value
  };
  try {
    await api('/api/admin/bookings/' + id, {method:'PATCH', body:JSON.stringify(payload)});
    showToast({title:'Prenotazione salvata', copy:'Data, ora, persone, totale e stato aggiornati.'});
    await loadAppConfig();
    loadAdminSummary();
  } catch (err) {
    showToast({title:'Prenotazione non salvata', copy:err.status === 409 ? 'Conflitto con un altro booking o slot bloccato.' : 'Controlla i dati inseriti.', type:'warn'});
  }
}

async function adjustUserChips(id, amount) {
  await api('/api/admin/users/' + id + '/chips', {method:'PATCH', body:JSON.stringify({amount})});
  showToast({title:'Wallet aggiornato', copy:(amount > 0 ? '+' : '') + amount + ' chips applicati.'});
  loadAdminSummary();
}

async function saveAdminUser(id) {
  const payload = {
    name: document.getElementById('user-name-' + id)?.value,
    email: document.getElementById('user-email-' + id)?.value,
    role: document.getElementById('user-role-' + id)?.value,
    suspended: document.getElementById('user-suspended-' + id)?.value === 'true'
  };
  await api('/api/admin/users/' + id, {method:'PATCH', body:JSON.stringify(payload)});
  showToast({title:'Utente salvato', copy:'Profilo, ruolo e stato aggiornati.'});
  loadAdminSummary();
}

async function blockAdminSlot() {
  const payload = {
    date: document.getElementById('admin-block-date')?.value,
    start: document.getElementById('admin-block-start')?.value,
    end: document.getElementById('admin-block-end')?.value,
    reason: document.getElementById('admin-block-reason')?.value || 'Blocco admin'
  };
  await api('/api/admin/blocked-slots', {method:'POST', body:JSON.stringify(payload)});
  showToast({title:'Slot bloccato', copy:'Manutenzione o indisponibilita salvata.'});
  await loadAppConfig();
  loadAdminSummary();
}

async function deleteBlockedSlot(id) {
  await api('/api/admin/blocked-slots/' + id, {method:'DELETE'});
  showToast({title:'Slot sbloccato', copy:'La fascia torna prenotabile lato cliente.'});
  await loadAppConfig();
  loadAdminSummary();
}

async function saveAdminConfig() {
  const payload = {
    hourlyPrice: Number(document.getElementById('admin-price-hour')?.value || 12),
    dayPrice: Number(document.getElementById('admin-price-day')?.value || 60),
    guestPassPrice: Number(document.getElementById('admin-price-guest')?.value || 2),
    maxPeople: Number(document.getElementById('admin-max-people')?.value || 8),
    lockboxCode: document.getElementById('admin-lockbox-code')?.value || '4729'
  };
  const data = await api('/api/admin/config', {method:'PATCH', body:JSON.stringify(payload)});
  appConfig = {...appConfig, ...(data.config || {})};
  applyAppConfig();
  updatePrice();
  showToast({title:'Config salvata', copy:'Prezzi e codice sono collegati al client.'});
  loadAdminSummary();
}

async function createAdminAddon() {
  const payload = {
    name: document.getElementById('addon-name')?.value,
    brand: document.getElementById('addon-brand')?.value || 'ROOMIE',
    price: Number(document.getElementById('addon-price')?.value || 0),
    category: document.getElementById('addon-category')?.value || 'featured',
    description: document.getElementById('addon-desc')?.value || '',
    status: 'active'
  };
  await api('/api/admin/addons', {method:'POST', body:JSON.stringify(payload)});
  ['addon-name','addon-brand','addon-price','addon-desc'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  showToast({title:'Addon creato', copy:'Visibile nello shop se attivo.'});
  await loadAppConfig();
  loadAdminSummary();
}

async function saveAdminAddon(id) {
  const payload = {
    name: document.getElementById('addon-name-' + id)?.value,
    description: document.getElementById('addon-desc-' + id)?.value,
    brand: document.getElementById('addon-brand-' + id)?.value,
    price: Number(document.getElementById('addon-price-' + id)?.value || 0),
    category: document.getElementById('addon-category-' + id)?.value,
    status: document.getElementById('addon-status-' + id)?.value
  };
  await api('/api/admin/addons/' + id, {method:'PATCH', body:JSON.stringify(payload)});
  showToast({title:'Addon aggiornato', copy:'Catalogo cliente sincronizzato.'});
  await loadAppConfig();
  loadAdminSummary();
}

async function deleteAdminAddon(id) {
  await api('/api/admin/addons/' + id, {method:'DELETE'});
  showToast({title:'Addon eliminato', copy:'Rimosso dallo shop cliente.'});
  await loadAppConfig();
  loadAdminSummary();
}

// ── PAGE ──
function showPage(id, push=true) {
  const publicPages = ['home'];
  if(!isLoggedIn() && !publicPages.includes(id)) {
    openAuth('login');
    return;
  }
  if(id === 'session' && !hasLiveSession()) {
    showToast({title:'Sessione non ancora live', copy:hasActiveSession() ? bookingAccessWindowLabel(activeBooking) : 'Prenota prima una sessione.', type:'warn'});
    id = hasActiveSession() ? 'confirm' : 'room';
  }
  if(id === 'session' && hasLiveSession() && !roomInside && !accessSafety.power) {
    showToast({title:'Completa prima l’accesso', copy:'La sessione live si apre dopo cassaforte, serranda, porta e check corrente.', type:'warn'});
    id = 'confirm';
  }
  if(id === 'session' && accessSafety.power) roomInside = true;
  if(id === 'admin' && currentUser?.role !== 'admin') {
    if(currentUser) {
      showToast('Serve account admin');
      showPage('dashboard');
    } else {
      openAuth('login');
    }
    return;
  }
  Array.from(document.body.classList).forEach(cls => {
    if(cls.startsWith('page-')) document.body.classList.remove(cls);
  });
  document.body.classList.add('page-' + id);
  if(push && currentPage && currentPage !== id) pageHistory.push(currentPage);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('.ps-btn').forEach(b => b.classList.remove('active'));
  const labels = {home:'Home',room:'Room',token:'Chips',checkout:'Checkout',confirm:'Conferma',session:'Sessione',dashboard:'Dashboard',shop:'Shop',admin:'Admin'};
  document.querySelectorAll('.ps-btn').forEach(b => {
    if(b.textContent.includes(labels[id]||id)) b.classList.add('active');
  });
  document.querySelectorAll('.mbn-btn').forEach(b => b.classList.remove('active'));
  const mobileMap = {home:'home',room:'room',checkout:'room',confirm:'room',session:'room',shop:'shop',dashboard:'dashboard',token:'dashboard'};
  const mb = document.querySelector(`.mbn-btn[data-mobile-page="${mobileMap[id] || 'home'}"]:not(.hidden)`) || document.querySelector('.mbn-btn:not(.hidden)');
  if(mb) mb.classList.add('active');
  currentPage = id;
  updateSubbar(id);
  updateShopAccessUI();
  refreshLandingFullpage();
  scrollToTopImmediate();
  if(id === 'confirm') burstConfetti();
  if(id === 'confirm') {
    ensureAccessBooking();
    setTimeout(() => {
      updateAccessAvailabilityUI();
      updateAccessNav();
    }, 80);
  }
  if(id === 'dashboard') loadDashboardData();
  if(id === 'shop') {
    if(!activeBookingId && currentUser && location.protocol !== 'file:') loadDashboardData();
    updateShopSessionContext();
  }
  if(id === 'admin') loadAdminSummary();
  window.setTimeout(() => refreshPremiumMotion(false), 80);
  window.setTimeout(() => window.fullpage_api?.reBuild?.(), 180);
}

function hasActiveSession() {
  return Boolean(activeBookingId && activeBooking && activeStatusesClient().includes(activeBooking.status));
}

function hasLiveSession() {
  return Boolean(activeBookingId && activeBooking && bookingIsLive(activeBooking));
}

function hasShopAccess() {
  return hasLiveSession();
}

function canViewLiveCamera() {
  return Boolean(hasLiveSession() && roomInside && accessSafety.power);
}

function openCameraAccessAction() {
  if(hasActiveSession()) {
    openBookingAccess(activeBookingId);
    return;
  }
  showPage('room');
}

function updateCameraAccessUI() {
  const card = document.getElementById('dashboard-camera-card');
  if(!card) return;
  const canView = canViewLiveCamera();
  const hasBooked = hasActiveSession();
  const live = hasLiveSession();
  card.classList.toggle('is-locked', !canView);
  card.classList.toggle('is-live', canView);
  const status = document.getElementById('camera-status');
  if(status) status.textContent = canView ? 'Live' : live ? 'Accesso da completare' : hasBooked ? 'Non ancora live' : 'Bloccata';
  const kicker = document.getElementById('camera-lock-kicker');
  const title = document.getElementById('camera-lock-title');
  const copy = document.getElementById('camera-lock-copy');
  const btn = document.getElementById('camera-lock-btn');
  if(canView) return;
  if(!hasBooked) {
    if(kicker) kicker.textContent = 'Prenotazione richiesta';
    if(title) title.textContent = 'Cam disponibile solo in sessione.';
    if(copy) copy.textContent = 'Prenota la room: la camera resta bloccata finché non completi l’accesso fisico.';
    if(btn) btn.innerHTML = '<i class="fas fa-calendar-check"></i> PRENOTA LA ROOM';
    return;
  }
  if(!live) {
    if(kicker) kicker.textContent = 'Sessione non ancora live';
    if(title) title.textContent = 'Cam bloccata fino allo start.';
    if(copy) copy.textContent = bookingAccessWindowLabel(activeBooking) + '. Prima vedi il countdown, poi apri la procedura accesso.';
    if(btn) btn.innerHTML = '<i class="fas fa-route"></i> VEDI ACCESSO';
    return;
  }
  if(kicker) kicker.textContent = 'Accesso richiesto';
  if(title) title.textContent = 'Completa l’ingresso per vedere la cam.';
  if(copy) copy.textContent = 'Cassaforte, serranda, porta e check corrente: quando sei dentro la live cam si sblocca.';
  if(btn) btn.innerHTML = '<i class="fas fa-route"></i> APRI PROCEDURA ACCESSO';
}

function updateShopAccessUI() {
  const hasBooked = hasActiveSession();
  const live = hasLiveSession();
  const shopUnlocked = hasShopAccess();
  const shopPage = document.getElementById('page-shop');
  if(shopPage) shopPage.classList.toggle('shop-locked', !shopUnlocked);
  document.querySelectorAll('#page-shop .bundle-btn').forEach(btn => {
    if(!btn.dataset.liveLabel) btn.dataset.liveLabel = btn.textContent.trim();
    btn.textContent = shopUnlocked ? btn.dataset.liveLabel : 'PRENOTA PER ATTIVARE';
  });
  document.querySelectorAll('[data-shop-entry]').forEach(el => {
    el.classList.remove('hidden','shop-lock-slot');
    el.classList.toggle('shop-live-glow', shopUnlocked);
    el.setAttribute('aria-disabled', shopUnlocked ? 'false' : 'true');
    if(!shopUnlocked) el.setAttribute('title', 'Shop in anteprima: acquisti attivi durante la sessione live.');
    else el.removeAttribute('title');
  });
  document.querySelectorAll('[data-access-entry]').forEach(el => {
    el.classList.toggle('hidden', !hasBooked);
    el.classList.toggle('is-disabled', hasBooked && !live);
    if(hasBooked && !live) {
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('title', bookingAccessWindowLabel(activeBooking));
    } else {
      el.removeAttribute('aria-disabled');
      el.removeAttribute('title');
    }
  });
  const fab = document.getElementById('live-session-fab');
  if(fab) fab.classList.toggle('hidden', !live);
  updateCameraAccessUI();
}

function updateSubbar(id) {
  const bar = document.getElementById('app-subbar');
  const title = document.getElementById('subbar-title');
  const names = {room:'Prenota',checkout:'Pagamento',confirm:'Accesso',session:'Sessione live',shop:'Shop',dashboard:'Profilo',token:'Chips',admin:'Admin'};
  const show = id !== 'home';
  bar?.classList.toggle('visible', show);
  if(title) title.textContent = names[id] || 'Indietro';
}

function goBack() {
  document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
  const prev = pageHistory.pop() || 'home';
  showPage(prev, false);
}

function openMenu() {
  document.getElementById('side-menu')?.classList.remove('hidden');
}

function closeMenu() {
  document.getElementById('side-menu')?.classList.add('hidden');
}

function menuGo(id) {
  closeMenu();
  showPage(id);
}

function initHeroCarousel() {
  setHeroSlide(0);
  heroTimer = window.setInterval(() => setHeroSlide((heroIndex + 1) % heroSlides.length), 5600);
  bindHeroSwipe();
}

function setHeroSlide(index, manual=false) {
  const slide = heroSlides[index];
  const bgSlides = document.querySelectorAll('.hero-bg');
  const content = document.querySelector('.hero-content');
  const title = document.querySelector('.hero-title');
  const addr = document.querySelector('.hero-addr');
  const sub = document.querySelector('.hero-sub');
  const meta = document.querySelector('.hero-meta');
  if(!slide || !title || !addr || !sub || !meta) return;
  heroIndex = index;
  bgSlides.forEach((bg, i) => bg.classList.toggle('active', i === index));
  content?.classList.add('is-changing');
  window.setTimeout(() => {
    title.innerHTML = slide.title;
    addr.textContent = slide.addr;
    sub.textContent = slide.sub;
    meta.innerHTML = slide.meta.map(item => `<span>${item}</span>`).join('');
    content?.classList.remove('is-changing');
  }, 120);
  document.querySelectorAll('.hero-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
    dot.setAttribute('aria-current', i === index ? 'true' : 'false');
  });
  if(manual && heroTimer) {
    window.clearInterval(heroTimer);
    heroTimer = window.setInterval(() => setHeroSlide((heroIndex + 1) % heroSlides.length), 5600);
  }
}

function initAuthBackground() {
  const auth = document.getElementById('auth-screen');
  if(!auth) return;
  let index = 0;
  const apply = () => {
    const slide = heroSlides[index % heroSlides.length];
    auth.style.setProperty('--auth-bg', `url("${slide.image}")`);
    index += 1;
  };
  apply();
  window.setInterval(apply, 5200);
}

function bindHeroSwipe() {
  const hero = document.querySelector('.hero');
  if(!hero || hero.dataset.swipeBound) return;
  hero.dataset.swipeBound = 'true';
  const startSwipe = (x, y) => {
    heroSwipeStartX = x;
    heroSwipeStartY = y;
  };
  const endSwipe = (x, y) => {
    if(heroSwipeStartX === null || heroSwipeStartY === null) return;
    const dx = x - heroSwipeStartX;
    const dy = y - heroSwipeStartY;
    heroSwipeStartX = null;
    heroSwipeStartY = null;
    if(Math.abs(dx) < 34 || Math.abs(dx) < Math.abs(dy) * 1.05) return;
    const dir = dx < 0 ? 1 : -1;
    setHeroSlide((heroIndex + dir + heroSlides.length) % heroSlides.length, true);
  };
  const cancelSwipe = () => {
    heroSwipeStartX = null;
    heroSwipeStartY = null;
  };
  hero.addEventListener('pointerdown', e => {
    if(document.body.classList.contains('fullpage-enabled')) return;
    if(e.target.closest?.('button,a,input,textarea,select')) return;
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    startSwipe(e.clientX, e.clientY);
  }, {passive:true});
  hero.addEventListener('pointerup', e => {
    if(document.body.classList.contains('fullpage-enabled')) return;
    endSwipe(e.clientX, e.clientY);
  }, {passive:true});
  hero.addEventListener('pointercancel', cancelSwipe, {passive:true});
  if(!window.PointerEvent) {
    hero.addEventListener('touchstart', e => {
      if(e.target.closest?.('button,a,input,textarea,select')) return;
      const t = e.changedTouches?.[0];
      if(t) startSwipe(t.clientX, t.clientY);
    }, {passive:true});
    hero.addEventListener('touchend', e => {
      const t = e.changedTouches?.[0];
      if(t) endSwipe(t.clientX, t.clientY);
    }, {passive:true});
  }
}

function setInsideTab(btn, id) {
  document.querySelectorAll('.inside-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.inside-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('inside-'+id)?.classList.add('active');
  window.setTimeout(() => window.fullpage_api?.reBuild?.(), 60);
}

function moveInsideTab(direction) {
  const tabs = Array.from(document.querySelectorAll('.inside-tab'));
  if(!tabs.length) return;
  const active = Math.max(0, tabs.findIndex(tab => tab.classList.contains('active')));
  const next = (active + direction + tabs.length) % tabs.length;
  tabs[next].click();
}

function scrollShopSection(btn, id) {
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  const target = document.getElementById(id);
  if(target) smoothScrollTo(target, -92);
}

async function loadAppConfig() {
  if(location.protocol === 'file:') return;
  try {
    const [cfg, addons] = await Promise.all([
      api('/api/app/config'),
      api('/api/addons')
    ]);
    appConfig = {...appConfig, ...(cfg.config || {})};
    blockedSlots = cfg.blockedSlots || [];
    bookedSlots = cfg.bookedSlots || [];
    appAddons = addons.addons || [];
    applyAppConfig();
    renderShopAddons();
    updatePrice();
  } catch (_err) {}
}

function applyAppConfig() {
  const quick = appConfig.hourlyPrice;
  const ranked = appConfig.hourlyPrice * 2;
  const movie = appConfig.hourlyPrice * 3;
  const full = appConfig.dayPrice;
  const presetButtons = document.querySelectorAll('.preset-chip');
  const presets = [
    ['quick', 1, quick, '18:00', 'ore'],
    ['ranked', 2, ranked, '20:00', 'ore'],
    ['movie', 3, movie, '20:00', 'ore'],
    ['full', 14, full, '09:00', 'giorno']
  ];
  presetButtons.forEach((btn, index) => {
    const preset = presets[index];
    if(!preset) return;
    btn.onclick = () => setPreset(btn, ...preset);
    const price = btn.querySelector('.preset-price');
    if(price) price.textContent = preset[2] + ' chips';
  });
  const key = document.getElementById('key-code');
  if(key) key.dataset.code = appConfig.lockboxCode || '4729';
  const maxText = document.getElementById('room-max-pill') || document.querySelector('.room-badges .trust-pill:nth-child(2)');
  if(maxText) maxText.textContent = (appConfig.maxPeople || 8) + ' persone max';
  updateSlotAvailability();
}

function isCurrentSlotBlocked() {
  const date = document.getElementById('input-date')?.value;
  const start = document.getElementById('input-start')?.value;
  const end = bookingType === 'giorno' ? '23:00' : addHoursToTime(start, duration);
  const unavailable = [...blockedSlots, ...bookedSlots];
  return unavailable.some(slot => slot.date === date && timeRangesOverlap(start, end, slot.start, slot.end) && slot.id !== activeBookingId);
}

function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  if(!aStart || !aEnd || !bStart || !bEnd) return false;
  const toMinutes = value => {
    const [hh, mm] = String(value).split(':').map(Number);
    return (Number(hh || 0) * 60) + Number(mm || 0);
  };
  const expand = (start, end) => {
    const s = toMinutes(start);
    let e = toMinutes(end);
    if(e <= s) e += 1440;
    return [[s,e],[s + 1440,e + 1440]];
  };
  return expand(aStart,aEnd).some(a => expand(bStart,bEnd).some(b => a[0] < b[1] && a[1] > b[0]));
}

function slotIsBlocked(start) {
  const date = document.getElementById('input-date')?.value;
  const end = bookingType === 'giorno' ? '23:00' : addHoursToTime(start, duration);
  return [...blockedSlots, ...bookedSlots].some(slot => slot.date === date && timeRangesOverlap(start, end, slot.start, slot.end) && slot.id !== activeBookingId);
}

function selectSlotTime(time) {
  const input = document.getElementById('input-start');
  if(input) input.value = time;
  setBookingMode('plan', true);
  updatePrice();
}

function renderTimeSlots() {
  const grid = document.getElementById('slot-grid');
  if(!grid) return;
  const date = document.getElementById('input-date')?.value;
  const selected = document.getElementById('input-start')?.value;
  const baseSlots = ['10:00','12:00','14:00','16:00','18:00','20:00','21:00','22:00'];
  const slots = selected && !baseSlots.includes(selected)
    ? [...baseSlots, selected].sort()
    : baseSlots;
  if(!date) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = slots.map(time => {
    const busy = slotIsBlocked(time);
    const active = selected === time;
    return `<button type="button" class="slot-btn ${busy ? 'busy' : 'free'} ${active ? 'active' : ''}" ${busy ? 'disabled' : `onclick="selectSlotTime('${time}')"`}>${time}</button>`;
  }).join('');
}

function currentSlotLabel() {
  const date = document.getElementById('input-date')?.value;
  const start = document.getElementById('input-start')?.value;
  const end = bookingType === 'giorno' ? '23:00' : addHoursToTime(start, duration);
  if(!date || !start) return 'Scegli data e orario';
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('it-IT', {weekday:'short', day:'numeric', month:'short'});
  return dateLabel + ' · ' + (bookingType === 'giorno' ? '09:00 → 23:00' : start + ' → ' + end);
}

function updateSlotAvailability() {
  const box = document.getElementById('slot-availability');
  const pill = document.getElementById('room-slot-pill');
  const blocked = isCurrentSlotBlocked();
  const label = currentSlotLabel();
  if(box) {
    box.classList.toggle('blocked', blocked);
    box.innerHTML = blocked
      ? `<strong>Slot non disponibile</strong><span>${label}. Questa fascia è già occupata o bloccata.</span>`
      : `<strong>Slot disponibile</strong><span>${label}. Puoi continuare e bloccare la room.</span>`;
  }
  if(pill) {
    pill.innerHTML = blocked
      ? '<span style="color:var(--orange)">●</span> Slot occupato'
      : '<span style="color:var(--neon)">●</span> Slot libero';
  }
  renderTimeSlots();
}

function brandClass(brand='ROOMIE') {
  const b = brand.toLowerCase();
  if(b.includes('dazn')) return 'brand-dazn';
  if(b.includes('netflix')) return 'brand-netflix';
  if(b.includes('spotify')) return 'brand-spotify';
  if(b.includes('ps')) return 'brand-ps';
  if(b.includes('partner') || b.includes('delivery')) return 'brand-glovo';
  return 'brand-roomie';
}

function addonIconClass(addon={}) {
  const text = `${addon.name || ''} ${addon.brand || ''} ${addon.category || ''}`.toLowerCase();
  if(text.includes('dazn') || text.includes('partita')) return 'fas fa-futbol';
  if(text.includes('netflix') || text.includes('cinema') || text.includes('movie')) return 'fas fa-tv';
  if(text.includes('gaming') || text.includes('ps')) return 'fas fa-gamepad';
  if(text.includes('neon') || text.includes('party')) return 'fas fa-lightbulb';
  if(text.includes('pizza')) return 'fas fa-pizza-slice';
  if(text.includes('birra') || text.includes('drink')) return 'fas fa-glass-cheers';
  if(text.includes('snack')) return 'fas fa-cookie-bite';
  if(text.includes('focus') || text.includes('work')) return 'fas fa-headphones-alt';
  return 'fas fa-plus';
}

function addonActivationLabel(addon={}) {
  if(addon.category === 'snacks') return 'ARRIVA IN 15';
  if(addon.category === 'modes') return 'SETUP ROOM';
  const text = `${addon.name || ''} ${addon.brand || ''}`.toLowerCase();
  if(text.includes('dazn') || text.includes('partita')) return 'LIVE EVENT';
  if(text.includes('cinema') || text.includes('netflix')) return 'ATTIVA SUBITO';
  return 'ADDON LIVE';
}

function addonBadge(addon={}, isRecommended=false) {
  if(addon.status === 'soldout') return '<span class="addon-badge soldout">ESAURITO</span>';
  if(isRecommended) return '<span class="addon-badge reco">CONSIGLIATO</span>';
  if(addon.category === 'snacks') return '<span class="addon-badge delivery">DELIVERY</span>';
  if(Number(addon.soldToday || 0) > 2) return '<span class="addon-badge popular">POPOLARE</span>';
  return '<span class="addon-badge">EXTRA</span>';
}

function renderShopAddons() {
  if(!appAddons.length) return;
  const shopUnlocked = hasShopAccess();
  const groups = {featured:[], modes:[], snacks:[]};
  const recommended = new Set(sessionRecommendationNames(activeBooking).map(name => name.toLowerCase()));
  appAddons.filter(a => a.status !== 'hidden' && a.status !== 'deleted').forEach(a => {
    (groups[a.category] || groups.featured).push(a);
  });
  const score = addon => (recommended.has(String(addon.name || '').toLowerCase()) ? 20 : 0) + Number(addon.soldToday || 0);
  const render = addon => {
    const isRecommended = recommended.has(String(addon.name || '').toLowerCase());
    return `<div class="addon-chip ${addon.soldToday > 2 ? 'addon-featured' : ''} ${isRecommended ? 'recommended' : ''} ${addon.status === 'soldout' ? 'soldout' : ''}">
    <div class="addon-visual"><i class="${addonIconClass(addon)}"></i><span>${addonActivationLabel(addon)}</span></div>
    <div class="addon-topline">
      <span class="brand-mark ${brandClass(addon.brand)}">${addon.brand || 'ROOMIE'}</span>
      ${addonBadge(addon, isRecommended)}
    </div>
    <div class="addon-name">${addon.name}</div>
    <div class="addon-desc">${addon.description || ''}</div>
    <div class="addon-footer">
      <div class="addon-price">${addon.price} chips</div>
      <button class="btn-addon" ${addon.status === 'soldout' ? 'disabled style="opacity:.42;cursor:not-allowed"' : `onclick="addToCart(this,'${String(addon.name).replace(/'/g, "\\'")}','${addon.price}','${addon.id}')"`}>${addon.status === 'soldout' ? 'NON DISP.' : shopUnlocked ? 'AGGIUNGI' : 'PRENOTA PER ATTIVARE'}</button>
    </div>
  </div>`;
  };
  const targets = {featured:'shop-grid-featured', modes:'shop-grid-modes', snacks:'shop-grid-snacks'};
  Object.entries(targets).forEach(([key,id]) => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = (groups[key] || []).sort((a,b) => score(b) - score(a)).map(render).join('') || '<div class="participant-note">Nessun addon attivo.</div>';
  });
}

function syncDurationPills() {
  document.querySelectorAll('.dur-pill').forEach(pill => {
    const pillHours = parseInt(pill.textContent, 10);
    pill.classList.toggle('active', bookingType !== 'giorno' && pillHours === Number(duration));
  });
}

function setPreset(btn, preset, hours, total, start, type='ore') {
  currentPreset = preset;
  duration = Number(hours) || 1;
  sessionBaseTotal = Number(total) || 0;
  currentTotal = sessionBaseTotal;
  bookingType = type;
  document.querySelectorAll('.preset-chip').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  syncDurationPills();
  const startEl = document.getElementById('input-start');
  if(bookingMode === 'now') {
    const d = getRoundedNow();
    const dateEl = document.getElementById('input-date');
    if(dateEl) dateEl.value = formatLocalDate(d);
    if(startEl) startEl.value = formatLocalTime(d);
  } else if(startEl) {
    startEl.value = start;
  }
  document.getElementById('ps-day-row').style.display = type==='giorno' ? '' : 'none';
  updatePrice();
}

function setBookingMode(mode, preserve=false) {
  bookingMode = mode;
  document.getElementById('mode-now')?.classList.toggle('active', mode === 'now');
  document.getElementById('mode-plan')?.classList.toggle('active', mode === 'plan');
  if(mode === 'now') {
    const d = getRoundedNow();
    const date = document.getElementById('input-date');
    const start = document.getElementById('input-start');
    if(date) date.value = formatLocalDate(d);
    if(start) start.value = formatLocalTime(d);
  } else if(!preserve) {
    const d = new Date();
    d.setDate(d.getDate()+3);
    const date = document.getElementById('input-date');
    const start = document.getElementById('input-start');
    if(date) date.value = formatLocalDate(d);
    if(start) start.value = '20:00';
  }
  updatePrice();
}

function setBookingStep(index, shouldScroll=true) {
  bookingStep = Math.max(0, Math.min(index, bookingStepIds.length - 1));
  updateBookingStep();
  if(shouldScroll && currentPage === 'room') {
    window.setTimeout(() => {
      const panel = document.querySelector('.booking-panel');
      if(!panel) return;
      const y = panel.getBoundingClientRect().top + window.scrollY - 86;
      smoothScrollTo(Math.max(0, y));
    }, 40);
  }
}

function bookingNext() {
  if(bookingStep >= bookingStepIds.length - 1) {
    goCheckout();
    return;
  }
  setBookingStep(bookingStep + 1);
}

function bookingPrev() {
  setBookingStep(bookingStep - 1);
}

function updateBookingStep() {
  bookingStepIds.forEach((id, index) => {
    document.getElementById(id)?.classList.toggle('active', index === bookingStep);
  });
  document.querySelectorAll('.booking-dot').forEach((dot, index) => {
    dot.classList.toggle('active', index <= bookingStep);
    dot.setAttribute('aria-current', index === bookingStep ? 'step' : 'false');
  });
  const back = document.getElementById('booking-back');
  if(back) back.disabled = bookingStep === 0;
  const label = document.getElementById('booking-sticky-step');
  if(label) label.textContent = bookingStepNames[bookingStep] + ' · Step ' + (bookingStep + 1) + ' di ' + bookingStepIds.length;
  const next = document.getElementById('booking-next');
  const labels = ['SCEGLI ORARIO', 'AGGIUNGI AMICI', 'RIEPILOGO', 'PAGA ' + currentTotal + ' CHIPS'];
  if(next) next.textContent = labels[bookingStep] || 'CONTINUA';
}

function syncPeopleFromSelection() {
  peopleCount = Math.min(Number(appConfig.maxPeople || 8), Math.max(1, selectedFriends.size + guestCount));
  const val = document.getElementById('people-val');
  if(val) val.textContent = peopleCount;
  const guestVal = document.getElementById('guest-val');
  if(guestVal) guestVal.textContent = guestCount;
  const accountCount = selectedFriends.size;
  const breakdown = document.getElementById('participant-breakdown');
  if(breakdown) {
    const accountLabel = accountCount + (accountCount === 1 ? ' account Roomie' : ' account Roomie');
    const guestLabel = guestCount + (guestCount === 1 ? ' guest pass' : ' guest pass');
    breakdown.textContent = accountLabel + ' · ' + guestLabel + '. Max ' + (appConfig.maxPeople || 8) + '.';
  }
}

function getFriendLabel(id) {
  if(id === 'tu') return 'Tu';
  return platformFriends.find(friend => friend.id === id)?.name || id.charAt(0).toUpperCase() + id.slice(1);
}

function getFriendInitials(id) {
  if(id === 'tu') return 'TU';
  return platformFriends.find(friend => friend.id === id)?.initials || id.slice(0,2).toUpperCase();
}

function friendChipTemplate({id, name, initials, meta}, selected=false, mode='selected') {
  const state = id === 'tu' ? 'Sempre' : selected ? 'Selezionato' : mode === 'modal' ? 'Aggiungi' : 'Invita';
  const actionAttr = mode === 'modal' ? `data-add-friend="${id}"` : `data-toggle-friend="${id}"`;
  return `<button class="friend-chip ${selected ? 'active' : ''}" type="button" data-friend="${id}" ${actionAttr}>
    <span class="friend-avatar">${initials}</span>
    <span class="friend-main"><span class="friend-name">${name}</span><span class="friend-meta">${meta}</span></span>
    <span class="friend-state">${state}</span>
  </button>`;
}

function renderBookingFriends() {
  const row = document.getElementById('friend-row');
  if(!row) return;
  const selected = Array.from(selectedFriends).filter(id => id !== 'tu');
  const selectedHtml = selected.map(id => {
    const friend = platformFriends.find(item => item.id === id) || {id, name:getFriendLabel(id), initials:getFriendInitials(id), meta:'Account Roomie'};
    return friendChipTemplate(friend, true);
  }).join('');
  row.innerHTML = `
    <button class="friend-chip active" type="button" data-fixed="true" data-friend="tu">
      <span class="friend-avatar">TU</span>
      <span class="friend-main"><span class="friend-name">Tu</span><span class="friend-meta">Host · paghi ora</span></span>
      <span class="friend-state">Sempre</span>
    </button>
    ${selectedHtml}
    <button class="friend-chip add" data-action="open-invite" type="button">
      <span class="friend-avatar"><i class="fas fa-plus"></i></span>
      <span class="friend-main"><span class="friend-name">Aggiungi amico</span><span class="friend-meta">Account Roomie o link invito</span></span>
    </button>`;
  row.querySelector('[data-action="open-invite"]')?.addEventListener('click', openInviteModal);
  row.querySelectorAll('[data-toggle-friend]').forEach(btn => {
    btn.addEventListener('click', () => toggleFriend(btn, btn.dataset.toggleFriend));
  });
}

function renderPlatformFriendList() {
  const list = document.getElementById('platform-friend-list');
  if(!list) return;
  const q = String(document.getElementById('friend-search')?.value || '').trim().toLowerCase();
  const options = platformFriends
    .filter(friend => !selectedFriends.has(friend.id))
    .filter(friend => !q || friend.name.toLowerCase().includes(q) || friend.meta.toLowerCase().includes(q));
  if(!options.length) {
    list.innerHTML = `<div class="participant-note" style="margin:0">${
      q ? 'Nessun profilo trovato con questa ricerca.' : (platformFriends.length ? 'Hai già aggiunto tutti gli amici disponibili. Usa il link invito per gli altri.' : 'Non ci sono ancora altri account Roomie attivi. Usa invito esterno.')
    }</div>`;
    return;
  }
  list.innerHTML = options.map(friend => friendChipTemplate(friend, false, 'modal')).join('');
  list.querySelectorAll('[data-add-friend]').forEach(btn => {
    btn.addEventListener('click', () => addPlatformFriend(btn.dataset.addFriend));
  });
}

function setInviteTab(tab='platform') {
  const isPlatform = tab === 'platform';
  document.getElementById('invite-tab-platform')?.classList.toggle('active', isPlatform);
  document.getElementById('invite-tab-guest')?.classList.toggle('active', !isPlatform);
  document.getElementById('invite-panel-platform')?.classList.toggle('active', isPlatform);
  document.getElementById('invite-panel-guest')?.classList.toggle('active', !isPlatform);
  if(isPlatform) document.getElementById('friend-search')?.focus?.();
}

function addPlatformFriend(id) {
  if(selectedFriends.size + guestCount >= 8) {
    showToast({title:'Limite raggiunto', copy:'La room supporta massimo 8 persone totali.', type:'warn'});
    return;
  }
  selectedFriends.add(id);
  liveConsentReady = false;
  renderFriendSelection();
  updatePrice();
  closeModal('modal-invite');
  showToast({title:'Amico aggiunto', copy:getFriendLabel(id) + ' riceverà split e consenso Live Mode.'});
}

function setGuests(delta) {
  const maxGuests = Math.max(0, Number(appConfig.maxPeople || 8) - selectedFriends.size);
  guestCount = Math.min(maxGuests, Math.max(0, guestCount + delta));
  syncPeopleFromSelection();
  updatePrice();
}

function toggleFriend(btn, id) {
  if(btn?.dataset.fixed === 'true') return;
  if(selectedFriends.has(id)) selectedFriends.delete(id);
  else selectedFriends.add(id);
  liveConsentReady = false;
  renderFriendSelection();
  updatePrice();
}

function renderFriendSelection() {
  const maxGuests = Math.max(0, Number(appConfig.maxPeople || 8) - selectedFriends.size);
  if(guestCount > maxGuests) guestCount = maxGuests;
  renderBookingFriends();
  renderPlatformFriendList();
  syncPeopleFromSelection();
  renderLiveConsent();
}

function getLiveCashback() {
  return Math.ceil((currentTotal || 0) / 2);
}

function renderLiveConsent() {
  const row = document.getElementById('live-consent-row');
  const modalRow = document.getElementById('live-modal-consent-row');
  const title = document.getElementById('live-mode-title');
  const sub = document.getElementById('live-mode-sub');
  const card = document.getElementById('live-mode-card');
  card?.classList.toggle('active', liveMode);
  if(title) title.textContent = liveMode ? 'Live Mode attivo · cashback dopo review' : 'Paghi normale · 50% torna in chips';
  if(sub) {
    sub.textContent = liveMode
      ? 'Consensi richiesti per tutti gli amici selezionati. La sessione si paga intera, poi il cashback arriva in chips.'
      : 'Attiva solo se vuoi andare live: non sconta adesso, ti restituisce chips dopo consenso e review.';
  }
  if(row) row.classList.toggle('is-off', !liveMode);
  const allNames = Array.from(selectedFriends);
  const consentHtml = allNames.map(id => {
    const label = getFriendLabel(id);
    const ok = id === 'tu' || liveConsentReady;
    return `<div class="live-consent ${ok ? 'ok' : 'pending'}">${label} ${ok ? '✓' : 'deve confermare'}</div>`;
  }).join('');
  const sessionRow = document.getElementById('session-live-consent-row');
  if(sessionRow) sessionRow.innerHTML = consentHtml;
  if(!liveMode) {
    if(row) row.innerHTML = '';
    if(modalRow) modalRow.innerHTML = '';
    return;
  }
  if(row) row.innerHTML = consentHtml;
  if(modalRow) modalRow.innerHTML = consentHtml;
  updateLiveStartState();
}

function toggleLiveMode(force) {
  liveMode = typeof force === 'boolean' ? force : !liveMode;
  if(!liveMode) liveConsentReady = false;
  renderLiveConsent();
  updatePrice();
  showToast(liveMode ? 'Paghi ora · 50% torna in chips' : 'Live Mode disattivato');
}

function updateLiveStartState() {
  const btn = document.getElementById('live-start-btn');
  if(!btn) return;
  const needsConsent = Array.from(selectedFriends).some(id => id !== 'tu') && !liveConsentReady;
  btn.textContent = needsConsent ? 'RICHIEDI CONSENSI AGLI AMICI' : '10 SEC · VAI LIVE';
}

// ── BOOKING TYPE ──
function setType(t) {
  bookingType = t;
  document.getElementById('tab-ore')?.classList.toggle('active', t==='ore');
  document.getElementById('tab-giorno')?.classList.toggle('active', t==='giorno');
  const dayRow = document.getElementById('ps-day-row');
  if(dayRow) dayRow.style.display = t==='giorno' ? '' : 'none';
  if(t === 'giorno') {
    currentPreset = 'full';
    sessionBaseTotal = Number(appConfig.dayPrice || 60);
    currentTotal = sessionBaseTotal;
    document.querySelectorAll('.preset-chip').forEach(p => p.classList.remove('active'));
  } else if(currentPreset === 'full') {
    currentPreset = 'custom';
    sessionBaseTotal = Number(appConfig.hourlyPrice || 12) * Number(duration || 1);
    currentTotal = sessionBaseTotal;
  }
  syncDurationPills();
  updatePrice();
}

// ── DURATION ──
function setDur(el, h) {
  duration = Number(h) || 1;
  currentPreset = 'custom';
  bookingType = 'ore';
  sessionBaseTotal = Number(appConfig.hourlyPrice || 12) * duration;
  currentTotal = sessionBaseTotal;
  document.querySelectorAll('.preset-chip').forEach(p => p.classList.remove('active'));
  syncDurationPills();
  const dayRow = document.getElementById('ps-day-row');
  if(dayRow) dayRow.style.display = 'none';
  document.getElementById('tab-ore')?.classList.add('active');
  document.getElementById('tab-giorno')?.classList.remove('active');
  updatePrice();
}

// ── PRICE ──
function updatePrice() {
  const base = Number(appConfig.hourlyPrice || 12);
  const guestFee = guestCount * Number(appConfig.guestPassPrice || 2);
  let roomTotal, total, label;
  if(bookingType === 'giorno') {
    roomTotal = Number(appConfig.dayPrice || 60); label = 'Full Experience · giornata';
    document.getElementById('ps-base').textContent = label;
  } else {
    roomTotal = currentPreset === 'custom' ? base * Number(duration || 1) : sessionBaseTotal;
    const names = {quick:'Quick Match · 1h', ranked:'Ranked Session · 2h', movie:'Movie Night · 3h'};
    label = names[currentPreset] || 'Custom · ' + Number(duration || 1) + 'h';
    document.getElementById('ps-base').textContent = label;
  }
  total = roomTotal + guestFee;
  currentTotal = total;
  const cashback = Math.ceil(total / 2);
  document.getElementById('ps-total').textContent = total + ' chips';
  document.getElementById('price-display').textContent = total + ' chips';
  const bookingStickyTotal = document.getElementById('booking-sticky-total');
  if(bookingStickyTotal) bookingStickyTotal.textContent = total + ' chips';
  const stickySummary = document.getElementById('booking-sticky-summary');
  if(stickySummary) stickySummary.textContent = currentSlotLabel() + ' · ' + peopleText(peopleCount);
  const eventSummary = document.getElementById('booking-event-summary');
  if(eventSummary) eventSummary.innerHTML = `<strong>${label} · ${currentSlotLabel()}</strong><span>${peopleText(peopleCount)} · ${selectedFriends.size} account Roomie · ${guestCount} amici senza app · totale ${total} chips</span>`;
  const priceEur = document.getElementById('price-eur');
  if(priceEur) priceEur.textContent = '€' + total;
  const psGuestRow = document.getElementById('ps-guest-row');
  const psGuestTotal = document.getElementById('ps-guest-total');
  if(psGuestRow) psGuestRow.classList.toggle('hidden', guestCount === 0);
  if(psGuestTotal) psGuestTotal.textContent = guestCount + ' × ' + Number(appConfig.guestPassPrice || 2) + ' = ' + guestFee + ' chips';
  const psLiveRow = document.getElementById('ps-live-row');
  const psLiveCashback = document.getElementById('ps-live-cashback');
  if(psLiveRow) psLiveRow.classList.toggle('hidden', !liveMode);
  if(psLiveCashback) psLiveCashback.textContent = '+' + cashback + ' chips dopo review';
  // update checkout summary
  const start = document.getElementById('input-start')?.value || '18:00';
  const end = bookingType==='giorno' ? '23:00' : addHoursToTime(start, duration);
  const dateVal = document.getElementById('input-date')?.value || '';
  let dateStr = '';
  if(dateVal){
    const d = new Date(dateVal+'T12:00:00');
    dateStr = d.toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'});
  }
  const coDate = document.getElementById('co-date');
  if(coDate) coDate.textContent = (dateStr||'—') + ' · ' + (bookingType==='giorno'?'09:00→23:00':start+'→'+end);
  const coTotal = document.getElementById('co-total');
  if(coTotal) coTotal.textContent = total + ' chips';
  const coGuestRow = document.getElementById('co-guest-row');
  const coGuestTotal = document.getElementById('co-guest-total');
  if(coGuestRow) coGuestRow.classList.toggle('hidden', guestCount === 0);
  if(coGuestTotal) coGuestTotal.textContent = guestCount + ' × ' + Number(appConfig.guestPassPrice || 2) + ' = ' + guestFee + ' chips';
  const coLiveRow = document.getElementById('co-live-row');
  const coLiveCashback = document.getElementById('co-live-cashback');
  if(coLiveRow) coLiveRow.classList.toggle('hidden', !liveMode);
  if(coLiveCashback) coLiveCashback.textContent = '+' + cashback + ' chips dopo review';
  document.getElementById('checkout-live-card')?.classList.toggle('hidden', !liveMode);
  const coEur = document.getElementById('co-eur');
  if(coEur) coEur.textContent = '€' + total.toFixed(2).replace('.',',');
  const remaining = walletBalance - total;
  const shortage = Math.max(0, total - walletBalance);
  const creditBox = document.getElementById('credit-pay-box');
  creditBox?.classList.toggle('insufficient', shortage > 0);
  const checkoutBalance = document.getElementById('checkout-balance');
  if(checkoutBalance) checkoutBalance.textContent = walletBalance;
  const balanceAfter = document.getElementById('balance-after');
  if(balanceAfter) balanceAfter.textContent = shortage > 0 ? 'ti mancano ' + shortage + ' chips' : remaining + ' chips';
  const balanceAfterLabel = document.getElementById('balance-after-label');
  if(balanceAfterLabel) balanceAfterLabel.textContent = shortage > 0 ? 'Saldo insufficiente' : 'Dopo il pagamento';
  const topupDetails = document.getElementById('topup-details');
  if(topupDetails) topupDetails.open = shortage > 0;
  const topupSummary = document.getElementById('topup-summary');
  if(topupSummary) topupSummary.textContent = shortage > 0 ? 'Ricarica ' + shortage + ' chips per completare' : 'Vuoi ricaricare comunque?';
  const payBtn = document.getElementById('pay-btn-label');
  if(payBtn) payBtn.innerHTML = shortage > 0 ? '<i class="fas fa-credit-card"></i> RICARICA ' + shortage + ' CHIPS' : '<i class="fas fa-lock"></i> PAGA ' + total + ' CHIPS';
  const confPaid = document.getElementById('conf-paid');
  if(confPaid) confPaid.textContent = total + ' chips';
  // conf time
  const confTime = document.getElementById('conf-time');
  if(confTime) confTime.textContent = bookingType==='giorno'?'09:00 → 23:00':start+' → '+end;
  const untilTime = document.getElementById('until-time');
  if(untilTime) untilTime.textContent = bookingType==='giorno'?'23:00':end;
  const sessionUntil = document.getElementById('session-until');
  if(sessionUntil) sessionUntil.textContent = bookingType==='giorno'?'23:00':end;
  const validUntil = document.getElementById('code-valid-until');
  if(validUntil) validUntil.textContent = bookingType==='giorno'?'23:00':end;
  const accountCount = Math.max(selectedFriends.size, 1);
  const split = Math.ceil(total / accountCount);
  const splitText = split + ' chips per account';
  const accountPayLabel = accountCount === 1 ? '1 paga in app' : accountCount + ' pagano in app';
  const peopleLabel = peopleCount + (peopleCount === 1 ? ' partecipante' : ' partecipanti');
  const accountLabel = accountCount + (accountCount === 1 ? ' account Roomie' : ' account Roomie');
  const guestLabel = guestCount ? ' · ' + guestCount + (guestCount === 1 ? ' guest pass' : ' guest pass') : '';
  const coPeople = document.getElementById('co-people');
  if(coPeople) coPeople.textContent = peopleLabel + ' · ' + accountLabel + guestLabel;
  const confPeople = document.getElementById('conf-people');
  if(confPeople) confPeople.textContent = peopleCount;
  const invitePeople = document.getElementById('invite-people');
  if(invitePeople) invitePeople.textContent = accountLabel;
  const sessionPeople = document.getElementById('session-people');
  if(sessionPeople) sessionPeople.textContent = peopleLabel;
  const sessionSplit = document.getElementById('session-split');
  if(sessionSplit) sessionSplit.textContent = accountPayLabel + ' · ' + split + ' chips/account';
  const splitVal = document.getElementById('split-val');
  if(splitVal) splitVal.textContent = accountPayLabel + ' · ' + splitText;
  const inviteSplit = document.getElementById('invite-split');
  if(inviteSplit) inviteSplit.textContent = splitText;
  const inviteTotal = document.getElementById('invite-total');
  if(inviteTotal) inviteTotal.textContent = total + ' chips';
  const liveSessionCashback = document.getElementById('live-session-cashback');
  if(liveSessionCashback) liveSessionCashback.textContent = '+' + cashback;
  renderLiveConsent();
  updateSlotAvailability();
  updateShopSessionContext();
  updateBookingStep();
}

// ── PAYMENT METHOD ──
function selectPM(btn, pm) {
  payMethodVal = pm;
  document.querySelectorAll('#page-checkout .dur-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['chip','paypal','satispay','token'].forEach(m => {
    const el = document.getElementById('pm-'+m);
    if(el) el.classList.toggle('hidden', m!==pm);
  });
}

// ── CHECKOUT ──
function goCheckout() {
  updatePrice();
  if(isCurrentSlotBlocked()) {
    showToast({title:'Slot non disponibile', copy:'Questa fascia è già occupata o bloccata. Scegli un altro orario.', type:'warn'});
    setBookingStep(1);
    return;
  }
  showPage('checkout');
}

function openInviteModal() {
  updatePrice();
  setInviteTab('platform');
  renderPlatformFriendList();
  openModal('modal-invite');
}

function copyInviteLink() {
  navigator.clipboard?.writeText('https://roomie.local/invite/rmi-mb7724');
  closeModal('modal-invite');
  showToast({title:'Link invito copiato', copy:'Chi entra dal link riceve guest pass e dettagli quota.'});
}

function openLiveModal() {
  if(!liveMode) liveMode = true;
  renderLiveConsent();
  updatePrice();
  openModal('modal-live-mode');
}

function handleLiveStart() {
  const needsConsent = Array.from(selectedFriends).some(id => id !== 'tu') && !liveConsentReady;
  if(needsConsent) {
    liveConsentReady = true;
    renderLiveConsent();
    showToast({title:'Consensi confermati', copy:'Gli amici selezionati sono pronti per la Live Mode.'});
    return;
  }
  startLiveMode();
}

function startLiveMode() {
  closeModal('modal-live-mode');
  liveActive = true;
  liveMode = true;
  const card = document.getElementById('session-live-card');
  card?.classList.add('on');
  const title = document.getElementById('live-session-title');
  if(title) title.textContent = 'SEI LIVE SU ROOMIE';
  const copy = document.getElementById('live-session-copy');
  if(copy) copy.textContent = 'Overlay attivo · audio off · cashback in maturazione. Tieni premuto STOP se vuoi chiudere la live.';
  const btn = document.getElementById('live-session-btn');
  if(btn) {
    btn.textContent = 'STOP LIVE';
    btn.style.background = 'var(--orange)';
    btn.onclick = stopLiveMode;
  }
  showToast('LIVE attiva · cashback in maturazione');
}

function stopLiveMode() {
  liveActive = false;
  const card = document.getElementById('session-live-card');
  card?.classList.remove('on');
  const title = document.getElementById('live-session-title');
  if(title) title.textContent = 'Live salvata';
  const copy = document.getElementById('live-session-copy');
  if(copy) copy.textContent = 'Sessione live chiusa. Cashback in chips pronto per approvazione post-sessione.';
  const btn = document.getElementById('live-session-btn');
  if(btn) {
    btn.textContent = 'RIAVVIA LIVE MODE';
    btn.style.background = '';
    btn.onclick = openLiveModal;
  }
  showToast('Live chiusa · cashback in review');
}

async function extendActiveSession() {
  const price = Number(appConfig.hourlyPrice || 12);
  if(location.protocol !== 'file:' && currentUser) {
    if(!activeBookingId) {
      showToast({title:'Prenotazione non trovata', copy:'Apri la sessione dalla dashboard o crea una nuova prenotazione.', type:'warn'});
      return;
    }
    if(walletBalance < price) {
      const shortage = price - walletBalance;
      showToast({title:'Ricarica richiesta', copy:'Ti mancano ' + shortage + ' chips per estendere la sessione.'});
      startStripeTopup(shortage, 'session');
      return;
    }
    try {
      const data = await api('/api/bookings/' + activeBookingId + '/extend', {method:'POST', body:JSON.stringify({hours:1})});
      currentUser = data.user || currentUser;
      updateWalletUI();
      const newEnd = data.booking?.end || addHoursToTime(document.getElementById('session-until')?.textContent || '22:00', 1);
      ['until-time','session-until','code-valid-until'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.textContent = newEnd;
      });
      showToast({title:'Sessione estesa', copy:'+1 ora · ' + price + ' chips scalati.'});
      return;
    } catch (err) {
      showToast({title:'Estensione bloccata', copy:err.status === 409 ? 'Quello slot non è disponibile.' : 'Riprova tra poco.', type:'warn'});
      return;
    }
  }
  if(currentUser) {
    currentUser.chips = Math.max(0, walletBalance - price);
    updateWalletUI();
  }
  showToast({title:'Sessione estesa', copy:'+1 ora · ' + price + ' chips scalati localmente.'});
}

function confirmBookingPayment() {
  if(isCurrentSlotBlocked()) {
    showToast({title:'Slot non disponibile', copy:'Qualcuno ha preso questa fascia. Torna al calendario e scegli un altro orario.', type:'warn'});
    showPage('room');
    setBookingStep(1);
    return;
  }
  const shortage = Math.max(0, currentTotal - walletBalance);
  if(location.protocol !== 'file:' && currentUser && shortage > 0) {
    showToast({title:'Ricarica richiesta', copy:'Ti mancano ' + shortage + ' chips. Paghi su Stripe, poi torni qui e confermi la room.'});
    startStripeTopup(shortage, 'checkout');
    return;
  }
  const loading = document.getElementById('pay-loading');
  loading.classList.remove('hidden');
  loading.style.display = 'flex';
  const loadingText = loading.querySelector('.roomie-loader-copy');
  if(loadingText) loadingText.textContent = 'PAGAMENTO IN CORSO...';
  setTimeout(async () => {
    loading.classList.add('hidden');
    loading.style.display = '';
    // Set confirm details
    const dateVal = document.getElementById('input-date')?.value || '';
    if(dateVal){
      const d = new Date(dateVal+'T12:00:00');
      const ds = d.toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'});
      const cf = document.getElementById('conf-date');
      if(cf) cf.textContent = ds;
    }
    if(location.protocol !== 'file:' && currentUser) {
      try {
        const start = document.getElementById('input-start')?.value || '20:00';
        const created = await api('/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            date: dateVal,
            start,
            end: bookingType === 'giorno' ? '23:00' : addHoursToTime(start, duration),
            people: peopleCount,
            totalChips: currentTotal
          })
        });
        activeBookingId = created.booking?.id || activeBookingId;
        if(created.booking) {
          roomInside = false;
          applyBookingToAccess(created.booking);
        }
        if(created.user) {
          currentUser = created.user;
          updateWalletUI();
          updatePrice();
        }
      } catch (err) {
        loading.classList.add('hidden');
        loading.style.display = '';
        if(err.status === 409) {
          await loadAppConfig();
          showToast({title:'Slot non disponibile', copy:'Questa fascia è stata appena presa o bloccata.', type:'warn'});
          showPage('room');
          setBookingStep(1);
          return;
        }
        showToast({title:'Prenotazione non salvata', copy:err.status === 402 ? 'Saldo insufficiente.' : 'Riprova tra poco.', type:'warn'});
        return;
      }
    } else if(currentUser) {
      currentUser.chips = Math.max(0, walletBalance - currentTotal);
      updateWalletUI();
      updatePrice();
    }
    resetAccessFlow();
    showPage('confirm');
  }, 2200);
}

// ── KEY / ACCESS ──
function copyCode() {
  const code = document.getElementById('key-code')?.dataset.code || '';
  navigator.clipboard?.writeText(code);
  showToast('Codice lucchetto copiato! ✓');
}

function revealAccessCode(show) {
  const el = document.getElementById('key-code');
  if(!el) return;
  const code = el.dataset.code || appConfig.lockboxCode || '4729';
  el.innerHTML = show
    ? code.split('').map(digit => `<span class="code-digit-view">${digit}</span>`).join('')
    : '<span class="code-mask-icon"><i class="fas fa-lock"></i></span><span class="code-mask-icon"><i class="fas fa-lock"></i></span><span class="code-mask-icon"><i class="fas fa-lock"></i></span><span class="code-mask-icon"><i class="fas fa-lock"></i></span>';
  el.classList.toggle('masked', !show);
}

function openKeyConfirm() {
  document.getElementById('modal-key-confirm').classList.remove('hidden');
}

function confirmKey() {
  closeModal('modal-key-confirm');
  const p = document.getElementById('step2-panel');
  p.classList.remove('hidden');
  p.classList.add('active');
  document.getElementById('step-lockbox')?.classList.remove('active');
  showToast({title:'Chiave presa', copy:'Alza la serranda, poi rimetti la chiave nella cassaforte.'});
  scrollToAccessStep('step2-panel');
}

function confirmShutter() {
  document.getElementById('step2-panel')?.classList.remove('active');
  accessSafety.shutter = false;
  accessSafety.key = false;
  accessSafety.door = false;
  accessSafety.power = false;
  renderSafetyState();
  const door = document.getElementById('door-panel');
  door.classList.remove('hidden');
  door.classList.add('active');
  showToast({title:'Vai alla porta', copy:'Prima di entrare: chiave riposta e lucchetto richiuso.'});
  scrollToAccessStep('door-panel');
}

function resetAccessFlow() {
  accessSafety = {shutter:false,key:false,door:false,power:false};
  roomInside = false;
  ['step2-panel','door-panel','step3-panel','power-block-panel'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('step-lockbox')?.classList.add('active');
  document.getElementById('step2-panel')?.classList.remove('active');
  document.getElementById('door-panel')?.classList.remove('active');
  accessStepIndex = 0;
  scrollToAccessStep('step-lockbox', false);
  renderSafetyState();
}

function getVisibleAccessStepIds() {
  return accessStepIds.filter(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
}

function scrollToAccessStep(id, smooth=true) {
  const visible = getVisibleAccessStepIds();
  const idx = Math.max(0, visible.indexOf(id));
  accessStepIndex = idx >= 0 ? idx : 0;
  const target = document.getElementById(visible[accessStepIndex] || id);
  target?.scrollIntoView({behavior:smooth ? 'smooth' : 'auto', inline:'start', block:'nearest'});
  updateAccessNav();
}

function moveAccessStep(dir) {
  if(document.getElementById('page-confirm')?.classList.contains('access-waiting')) {
    showToast({title:'Accesso non ancora attivo', copy:bookingAccessWindowLabel(activeBooking), type:'warn'});
    return;
  }
  const visible = getVisibleAccessStepIds();
  if(!visible.length) return;
  accessStepIndex = Math.min(Math.max(accessStepIndex + dir, 0), visible.length - 1);
  scrollToAccessStep(visible[accessStepIndex]);
}

function updateAccessNav() {
  const visible = getVisibleAccessStepIds();
  const currentId = visible[accessStepIndex] || visible[0] || 'step-lockbox';
  const absoluteIdx = Math.max(0, accessStepIds.indexOf(currentId));
  const title = document.getElementById('access-nav-title');
  if(title) title.textContent = accessStepTitles[absoluteIdx] || 'Accesso';
  const prev = document.getElementById('access-prev');
  const next = document.getElementById('access-next');
  if(prev) prev.disabled = accessStepIndex <= 0;
  if(next) next.disabled = accessStepIndex >= visible.length - 1;
}

function bindAccessFlow() {
  const flow = document.getElementById('access-flow');
  if(!flow || flow.dataset.bound) return;
  flow.dataset.bound = 'true';
  let raf = null;
  flow.addEventListener('scroll', () => {
    if(raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const visible = getVisibleAccessStepIds();
      if(!visible.length) return;
      const flowLeft = flow.getBoundingClientRect().left;
      let best = 0;
      let bestDist = Infinity;
      visible.forEach((id, i) => {
        const el = document.getElementById(id);
        if(!el) return;
        const dist = Math.abs(el.getBoundingClientRect().left - flowLeft);
        if(dist < bestDist) { best = i; bestDist = dist; }
      });
      accessStepIndex = best;
      updateAccessNav();
    });
  }, {passive:true});
}

// ── NFC ──
function openNFC() {
  const m = document.getElementById('modal-nfc');
  m.classList.remove('hidden');
  document.getElementById('nfc-success').classList.add('hidden');
  document.getElementById('nfc-screen').classList.remove('hidden');
  document.getElementById('nfc-btn').textContent = 'HO AVVICINATO LA CHIP';
  document.getElementById('nfc-btn').disabled = false;
  document.getElementById('nfc-btn').onclick = simulateNFC;
}

function simulateNFC() {
  const btn = document.getElementById('nfc-btn');
  btn.textContent = 'LETTURA CHIP...';
  btn.disabled = true;
  setTimeout(() => {
    document.getElementById('nfc-screen').classList.add('hidden');
    document.getElementById('nfc-success').classList.remove('hidden');
    btn.textContent = 'APRI';
    btn.disabled = false;
    btn.onclick = () => { closeModal('modal-nfc'); unlockDoor(); };
  }, 2000);
}

// ── CODE UNLOCK ──
function openCodeUnlock() {
  document.getElementById('modal-code-unlock').classList.remove('hidden');
  document.getElementById('code-error').classList.add('hidden');
  ['cd1','cd2','cd3','cd4'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  setTimeout(() => document.getElementById('cd1')?.focus(), 100);
}

function moveNext(el, nextId) {
  if(el.value.length===1 && nextId) document.getElementById(nextId)?.focus();
}

function verifyCode() {
  const code = ['cd1','cd2','cd3','cd4'].map(id=>document.getElementById(id)?.value||'').join('');
  if(code === (activeAccess.doorCode || '4729')) {
    closeModal('modal-code-unlock');
    unlockDoor();
  } else {
    document.getElementById('code-error').classList.remove('hidden');
    ['cd1','cd2','cd3','cd4'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('cd1')?.focus();
  }
}

function unlockDoor() {
  document.getElementById('door-panel')?.classList.add('hidden');
  document.getElementById('power-block-panel')?.classList.remove('hidden');
  accessSafety.door = false;
  accessSafety.power = false;
  renderSafetyState();
  showToast('Porta sbloccata · check sicurezza');
  scrollToAccessStep('power-block-panel');
  setTimeout(openSafetyCheck, 350);
}

function openSafetyCheck() {
  renderSafetyState();
  document.getElementById('modal-safety-check')?.classList.remove('hidden');
}

function resolveSafety(type) {
  if(type === 'key') {
    accessSafety.key = true;
    showToast({title:'Chiave riposta', copy:'Cassaforte e lucchetto segnati come chiusi.'});
  }
  if(type === 'door') {
    accessSafety.door = true;
    showToast({title:'Porta chiusa', copy:'Ora puoi rifare il check room.'});
  }
  renderSafetyState();
}

function runSafetyCheck() {
  const btn = document.getElementById('safety-check-btn');
  if(btn) {
    btn.textContent = 'CHECK IN CORSO...';
    btn.disabled = true;
  }
  setTimeout(() => {
    if(accessSafety.key && accessSafety.door) {
      accessSafety.shutter = true;
      accessSafety.power = true;
      roomInside = true;
      renderSafetyState();
      updateCameraAccessUI();
      showToast({title:'Check completato', copy:'Serranda OK · porta OK · corrente room attiva.'});
      setTimeout(() => {
        closeModal('modal-safety-check');
        document.getElementById('power-block-panel')?.classList.add('hidden');
        document.getElementById('step3-panel')?.classList.remove('hidden');
        scrollToAccessStep('step3-panel');
        setTimeout(() => showPage('session'), 650);
      }, 650);
    } else {
      renderSafetyState();
      showToast({title:'Manca un check', copy:'Conferma chiave riposta e porta chiusa prima di accendere.', type:'warn'});
    }
    if(btn) {
      btn.textContent = accessSafety.power ? 'TUTTO OK' : 'RIFAI CHECK';
      btn.disabled = false;
    }
  }, 900);
}

function renderSafetyState() {
  const states = {
    shutter: accessSafety.shutter ? ['SERRANDA OK', true] : ['NON OK', false],
    key: accessSafety.key ? ['RIPOSTA', true] : ['NON RIPOSTA', false],
    door: accessSafety.door ? ['PORTA OK', true] : ['APERTA', false],
    power: accessSafety.power ? ['ON', true] : ['OFF', false]
  };
  [
    ['safety-shutter-state', states.shutter],
    ['inline-shutter-state', states.shutter],
    ['inline-key-state', states.key],
    ['inline-door-state', states.door],
    ['safety-power-state', states.power]
  ].forEach(([id, state]) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = state[0];
    el.classList.toggle('ok', state[1]);
  });
  const keyBtn = document.getElementById('safety-key-btn');
  if(keyBtn) {
    keyBtn.textContent = accessSafety.key ? 'RIPOSTA ✓' : 'HO RIPOSTO';
    keyBtn.classList.toggle('ok', accessSafety.key);
  }
  const doorBtn = document.getElementById('safety-door-btn');
  if(doorBtn) {
    doorBtn.textContent = accessSafety.door ? 'CHIUSA ✓' : 'HO CHIUSO';
    doorBtn.classList.toggle('ok', accessSafety.door);
  }
  const sub = document.getElementById('safety-modal-sub');
  if(sub) sub.textContent = accessSafety.power ? 'Tutto ok: corrente attiva, puoi iniziare.' : 'Corrente spenta: risolvi i check fisici prima di iniziare la sessione.';
}

// ── TOKEN BUY ──
function selectAmt(el, amt, eur) {
  selectedAmt = amt; selectedAmtEur = eur;
  document.querySelectorAll('.buy-amt').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('buy-label').textContent = amt + ' chips';
}
function setCustomAmt(v) {
  selectedAmt = v; selectedAmtEur = '€'+v;
  document.getElementById('buy-label').textContent = v + ' chips';
  document.querySelectorAll('.buy-amt').forEach(b=>b.classList.remove('active'));
}
function openTokenModal() {
  document.getElementById('modal-tok-amount').textContent = selectedAmt + ' chips';
  document.getElementById('modal-tok-eur').textContent = selectedAmtEur;
  document.getElementById('token-success').classList.add('hidden');
  document.getElementById('modal-token-buy').classList.remove('hidden');
}

async function startStripeTopup(amount, returnPage='token') {
  if(location.protocol === 'file:' || !currentUser) {
    showToast({title:'Accesso richiesto', copy:'Apri Roomie online e accedi per ricaricare chips.', type:'warn'});
    showPage('auth');
    return;
  }
  const parsed = parseInt(amount || 0, 10);
  if(!Number.isInteger(parsed) || parsed <= 0) {
    showToast({title:'Importo non valido', copy:'Scegli quante chips vuoi ricaricare.', type:'warn'});
    return;
  }
  try {
    const data = await api('/api/stripe/topup-checkout', {
      method: 'POST',
      body: JSON.stringify({ amount: parsed, returnPage })
    });
    if(data.url) {
      window.location.href = data.url;
      return;
    }
    throw new Error('NO_CHECKOUT_URL');
  } catch (err) {
    const copy = err.message === 'STRIPE_NOT_CONFIGURED'
      ? 'Stripe non è ancora configurato per questo ambiente.'
      : 'Non siamo riusciti ad aprire Stripe Checkout. Riprova tra poco.';
    showToast({title:'Ricarica non avviata', copy, type:'warn'});
  }
}

async function buyTokens() {
  const btn = document.querySelector('#modal-token-buy .btn-neon');
  btn.innerHTML = '<span class="roomie-chip roomie-chip-sm" aria-hidden="true"></span> APERTURA STRIPE...';
  btn.disabled = true;
  try {
    const amount = parseInt(selectedAmt || 0, 10);
    if(location.protocol !== 'file:' && currentUser) {
      await startStripeTopup(amount, 'token');
      return;
    } else {
      showToast({title:'Apri la versione online', copy:'La ricarica reale passa da Stripe Checkout.', type:'warn'});
    }
  } catch (_err) {
    btn.textContent = 'ERRORE';
    showToast({title:'Ricarica non riuscita', copy:'Riprova tra poco.', type:'warn'});
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = 'VAI A STRIPE · <span id="modal-tok-eur">' + selectedAmtEur + '</span>';
    }, 1200);
  }
}

// ── ADDON CART ──
function addToCart(btn, name, price, id) {
  if(!hasShopAccess()) {
    showToast({title:'Attivo solo durante la sessione', copy:'Prenota o attendi lo start: quando sei dentro puoi aggiungere questo extra.', type:'warn'});
    showPage(hasActiveSession() ? 'dashboard' : 'room');
    return;
  }
  const parsedPrice = parseInt(price, 10) || 0;
  cartItems.push({id: id || '', name, price: parsedPrice, qty: 1});
  cartTotal += parsedPrice;
  btn.textContent = '✓ AGGIUNTO';
  btn.style.borderColor = 'var(--neon)';
  btn.style.color = 'var(--neon)';
  // Update cart
  const panel = document.getElementById('cart-panel');
  panel.classList.remove('hidden');
  document.getElementById('shop-inner')?.classList.add('has-cart');
  const itemsEl = document.getElementById('cart-items');
  itemsEl.innerHTML = cartItems.map((it,i) =>
    `<div class="cart-chip">${it.name} · <strong style="color:var(--neon)">${it.price}</strong></div>`
  ).join('');
  document.getElementById('cart-count').textContent = cartItems.length + (cartItems.length === 1 ? ' item' : ' item');
  document.getElementById('cart-total').textContent = cartTotal + ' chips';
  showToast('Aggiunto al carrello!');
}

function addBundleToCart(name, price, items=[]) {
  if(!hasShopAccess()) {
    showToast({title:'Pack prenotabile in sessione', copy:'Lo shop resta consultabile: gli acquisti si sbloccano quando la room è live.', type:'warn'});
    showPage(hasActiveSession() ? 'dashboard' : 'room');
    return;
  }
  const parsedPrice = parseInt(price, 10) || 0;
  cartItems.push({id:'bundle-' + name.toLowerCase().replace(/\s+/g,'-'), name, price:parsedPrice, qty:1, bundle:true, items});
  cartTotal += parsedPrice;
  const panel = document.getElementById('cart-panel');
  panel?.classList.remove('hidden');
  document.getElementById('shop-inner')?.classList.add('has-cart');
  const itemsEl = document.getElementById('cart-items');
  if(itemsEl) {
    itemsEl.innerHTML = cartItems.map(it =>
      `<div class="cart-chip">${it.name} · <strong style="color:var(--neon)">${it.price}</strong></div>`
    ).join('');
  }
  const count = document.getElementById('cart-count');
  if(count) count.textContent = cartItems.length + (cartItems.length === 1 ? ' item' : ' item');
  const total = document.getElementById('cart-total');
  if(total) total.textContent = cartTotal + ' chips';
  showToast({title:'Pack aggiunto', copy:`${name} nel carrello · ${parsedPrice} chips.`});
}
async function checkoutAddon() {
  if(!cartItems.length) return;
  if(location.protocol !== 'file:' && currentUser) {
    if(!activeBookingId) {
      showToast({title:'Sessione richiesta', copy:'Gli addon si acquistano solo per una prenotazione attiva.', type:'warn'});
      showPage('dashboard');
      return;
    }
    const items = cartItems.filter(item => item.id).map(item => ({id:item.id, qty:item.qty || 1}));
    if(!items.length) {
      showToast({title:'Shop non sincronizzato', copy:'Ricarica la pagina: gli addon devono arrivare dal backend.', type:'warn'});
      return;
    }
    if(walletBalance < cartTotal) {
      const shortage = cartTotal - walletBalance;
      showToast({title:'Ricarica richiesta', copy:'Ti mancano ' + shortage + ' chips. Ricarichi su Stripe e poi completi lo shop.'});
      startStripeTopup(shortage, 'shop');
      return;
    }
    try {
      const paid = await api('/api/addon-orders', {method:'POST', body:JSON.stringify({items, bookingId:activeBookingId})});
      currentUser = paid.user || currentUser;
      updateWalletUI();
      await loadAppConfig();
      showToast({title:'Addon pagati', copy:cartTotal + ' chips scalati dal saldo.'});
    } catch (err) {
      showToast({title:'Ordine non riuscito', copy:err.status === 402 ? 'Saldo insufficiente.' : err.message === 'ACTIVE_BOOKING_REQUIRED' ? 'Serve una sessione attiva.' : 'Riprova tra poco.', type:'warn'});
      return;
    }
  } else if(currentUser) {
    currentUser.chips = Math.max(0, walletBalance - cartTotal);
    updateWalletUI();
    showToast({title:'Addon confermati', copy:cartTotal + ' chips scalati localmente.'});
  }
  cartItems = []; cartTotal = 0;
  document.getElementById('cart-panel').classList.add('hidden');
  document.getElementById('shop-inner')?.classList.remove('has-cart');
  document.getElementById('cart-items').innerHTML = '';
  document.getElementById('cart-count').textContent = '0 item';
  document.getElementById('cart-total').textContent = '0 chips';
  document.querySelectorAll('.btn-addon').forEach(b => { b.textContent='+ AGGIUNGI'; b.style.borderColor=''; b.style.color=''; });
}

// ── PARTNER CODE ──
function copyPartnerCode() {
  navigator.clipboard?.writeText('ROOMIE-MB7724');
  showToast('Codice partner copiato! ✓');
}

function copyWifiCredentials() {
  const text = 'ROOMIE Wi-Fi\nUsername: $wag_Barca\nPassword: !nexus2018.';
  navigator.clipboard?.writeText(text);
  showToast({title:'Wi-Fi copiato', copy:'Username e password pronti da incollare.'});
}

function updateCameraClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  const date = now.toLocaleDateString('it-IT', {weekday:'short', day:'2-digit', month:'2-digit', year:'numeric'});
  const canView = canViewLiveCamera();
  const clock = document.getElementById('camera-clock');
  const dateEl = document.getElementById('camera-date');
  const ticker = document.getElementById('camera-ticker-text');
  if(clock) clock.textContent = canView ? time : '--:--:--';
  if(dateEl) dateEl.textContent = date;
  if(ticker) {
    ticker.textContent = canView
      ? `LIVE ROOMIE · CAM 01 SALA · ${date} · ${time} · privacy mode pronto · accesso controllato · `
      : 'CAM BLOCCATA · disponibile solo quando sei dentro · completa la procedura accesso · ';
  }
}
window.setInterval(updateCameraClock, 1000);
updateCameraClock();

// ── LEGAL DOCS ──
const legalDocs = {
  terms: {
    title: 'TERMINI E CONDIZIONI',
    meta: 'Condizioni d’uso del servizio Roomie',
    url: '/legal/termini-condizioni-roomie.docx',
    fallback: `
      <h1>Termini e Condizioni Roomie</h1>
      <p><strong>Ultimo aggiornamento:</strong> 25 maggio 2026</p>
      <h2>1. Servizio</h2>
      <p>Roomie consente di prenotare a ore uno spazio privato in Via Terni, Torino, con accesso tramite codice temporaneo, chip fisica NFC o strumenti equivalenti indicati nell'app.</p>
      <h2>2. Account e prenotazioni</h2>
      <p>L'utente deve fornire dati corretti, custodire le credenziali e usare la room solo nella fascia oraria prenotata. La prenotazione è personale, salvo inviti o guest pass generati dalla piattaforma.</p>
      <h2>3. Chips, pagamenti e rimborsi</h2>
      <p>Le chips sono credito prepagato interno: 1 chip equivale a 1 euro di valore di utilizzo nel servizio Roomie. Eventuali rimborsi o storni sono valutati secondo stato della prenotazione, utilizzo e norme applicabili.</p>
      <h2>4. Accesso fisico e responsabilità</h2>
      <p>L'utente deve richiudere cassaforte, riporre la chiave della serranda quando prevista, chiudere la porta e lasciare lo spazio in condizioni corrette. Danni, usi impropri o mancata restituzione degli strumenti di accesso possono generare addebiti.</p>
      <h2>5. Regole della room</h2>
      <p>Non sono consentiti comportamenti pericolosi, attività illegali, danneggiamenti, disturbo al vicinato o accessi fuori prenotazione. Roomie può sospendere account o accessi in caso di abuso.</p>
      <h2>6. Contatti</h2>
      <p>Per supporto o richieste: contatta Roomie dai canali indicati nell'app.</p>`
  },
  privacy: {
    title: 'PRIVACY POLICY',
    meta: 'Informativa sul trattamento dei dati personali',
    url: '/legal/privacy-policy-roomie.docx',
    fallback: `
      <h1>Privacy Policy Roomie</h1>
      <p><strong>Ultimo aggiornamento:</strong> 25 maggio 2026</p>
      <h2>1. Dati trattati</h2>
      <p>Roomie tratta dati di account, contatto, prenotazione, pagamenti, saldo chips, log di accesso, preferenze e interazioni necessarie a erogare il servizio.</p>
      <h2>2. Finalità</h2>
      <p>I dati sono usati per registrazione, autenticazione, gestione prenotazioni, pagamenti, accesso fisico alla room, sicurezza, assistenza, comunicazioni operative e miglioramento del servizio.</p>
      <h2>3. Base giuridica</h2>
      <p>Il trattamento si basa su esecuzione del contratto, obblighi legali, legittimo interesse alla sicurezza e, dove richiesto, consenso dell'utente.</p>
      <h2>4. Conservazione</h2>
      <p>I dati sono conservati per il tempo necessario a fornire il servizio, rispettare obblighi normativi e gestire contestazioni o sicurezza.</p>
      <h2>5. Diritti</h2>
      <p>L'utente può chiedere accesso, rettifica, cancellazione, limitazione, opposizione e portabilità secondo la normativa applicabile.</p>
      <h2>6. Sicurezza</h2>
      <p>Roomie adotta misure tecniche e organizzative ragionevoli per proteggere account, pagamenti e accessi.</p>`
  },
  cookie: {
    title: 'COOKIE POLICY',
    meta: 'Cookie, sessione, pagamenti e preferenze',
    url: '/legal/cookie-policy-roomie.docx',
    fallback: `
      <h1>Cookie Policy Roomie</h1>
      <p><strong>Ultimo aggiornamento:</strong> 25 maggio 2026</p>
      <h2>1. Cookie tecnici</h2>
      <p>Roomie usa cookie tecnici per login, sessione, sicurezza, preferenze e corretto funzionamento dell'app.</p>
      <h2>2. Cookie di pagamento e terze parti</h2>
      <p>Servizi come Stripe, Google o Apple possono usare tecnologie proprie per autenticazione, pagamento, prevenzione frodi e sicurezza.</p>
      <h2>3. Preferenze</h2>
      <p>Alcune impostazioni, come sessione persistente o stato dell'interfaccia, possono essere salvate per migliorare l'esperienza.</p>
      <h2>4. Gestione</h2>
      <p>L'utente può gestire o cancellare i cookie dal browser. La disattivazione dei cookie tecnici può impedire login, prenotazioni o pagamenti.</p>`
  }
};

function legalDocDownloadLink(doc) {
  return `<p style="margin-top:18px"><a href="${doc.url}" target="_blank" rel="noopener" style="color:#111;font-weight:900">Apri il documento originale DOCX</a></p>`;
}

function waitForMammoth(timeout=2600) {
  if(window.mammoth) return Promise.resolve(window.mammoth);
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      if(window.mammoth) {
        window.clearInterval(timer);
        resolve(window.mammoth);
      } else if(Date.now() - start > timeout) {
        window.clearInterval(timer);
        reject(new Error('MAMMOTH_TIMEOUT'));
      }
    }, 120);
  });
}

async function openLegalDoc(type) {
  const doc = legalDocs[type];
  if(!doc) return;
  closeMenu?.();
  const modal = document.getElementById('modal-legal-doc');
  const title = document.getElementById('legal-modal-title');
  const meta = document.getElementById('legal-modal-meta');
  const body = document.getElementById('legal-doc-body');
  if(title) title.textContent = doc.title;
  if(meta) meta.textContent = doc.meta;
  if(body) body.innerHTML = '<div class="legal-loading" style="flex-direction:column;text-align:center;justify-content:center;min-height:220px"><div class="roomie-loader-brand" style="font-size:3.4rem">ROOMIE</div><span class="roomie-chip roomie-chip-loader" aria-hidden="true"></span><span>Caricamento documento...</span></div>';
  if(modal) openModal('modal-legal-doc');
  try {
    await waitForMammoth();
    const response = await fetch(doc.url);
    if(!response.ok) throw new Error('DOC_NOT_FOUND');
    const arrayBuffer = await response.arrayBuffer();
    const result = await window.mammoth.convertToHtml({arrayBuffer});
    if(body) body.innerHTML = (result.value || doc.fallback) + legalDocDownloadLink(doc);
  } catch (err) {
    if(body) body.innerHTML = doc.fallback + legalDocDownloadLink(doc);
    showToast({title:'Documento aperto', copy:'Ti mostro la versione leggibile in app.', type:'info'});
  }
}

// ── MODAL CLOSE ──
function setModalState() {
  const hasOpenModal = Boolean(document.querySelector('.modal-overlay:not(.hidden)'));
  document.body.classList.toggle('modal-open', hasOpenModal);
  if(hasOpenModal) {
    if(lenis?.stop) lenis.stop();
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if(!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('modal-stable');
  setModalState();
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
  setModalState();
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => {
    if(e.target===m) {
      m.classList.add('hidden');
      setModalState();
    }
  });
});
document.addEventListener('click', e => {
  const action = e.target.closest?.('[data-action="open-invite"]');
  if(action) {
    e.preventDefault();
    openInviteModal();
  }
});

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  const payload = typeof msg === 'string'
    ? {title:msg.replace(/[✓!]/g,'').trim(), copy:'', type:'ok'}
    : {title:msg.title || 'Fatto', copy:msg.copy || '', type:msg.type || 'ok'};
  t.classList.toggle('warn', payload.type === 'warn');
  const icon = payload.type === 'warn' ? 'fa-exclamation-triangle' : 'fa-check';
  t.innerHTML = `<div class="toast-icon"><i class="fas ${icon}"></i></div><div><div class="toast-title">${payload.title}</div>${payload.copy ? `<div class="toast-copy">${payload.copy}</div>` : ''}</div>`;
  t.classList.remove('hidden');
  requestAnimationFrame(() => t.classList.add('visible'));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    t.classList.remove('visible');
    window.setTimeout(() => t.classList.add('hidden'), 240);
  }, 3100);
}

function burstConfetti(count=44) {
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#C8FF00','#00FFD1','#ffffff'];
  const total = Math.min(140, Math.max(24, count));
  for(let i=0;i<total;i++){
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.left = Math.random()*100 + 'vw';
    p.style.top = '-20px';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random()*.25 + 's';
    document.body.appendChild(p);
    setTimeout(()=>p.remove(), 1500);
  }
}

// ── INIT ──
const initialPage = new URLSearchParams(window.location.search).get('page') || 'home';
initAuth(initialPage);
window.setInterval(updateShopAccessUI, 30000);
