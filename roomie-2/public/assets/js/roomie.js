// roomie-motion.js — GSAP, landing animations, hero carousel, modals, legal, toast
// Auth / Nav / Booking / Shop / Admin → handled by React (AppContext).
// This file: GSAP motion, fullpage landing, hero, inside tabs,
//            modal helpers, legal docs, NFC/code-unlock, toast, confetti.

// ── STATE ──
let toastTimer = null;
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
// Safety check state (used by legacy modal-safety-check)
let accessSafety = {shutter:false, key:false, door:false, power:false};
let roomInside = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHtml(html) {
  if(window.DOMPurify?.sanitize) return window.DOMPurify.sanitize(String(html || ''));
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  template.content.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach(node => node.remove());
  template.content.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';
      if(name.startsWith('on') || value.trim().toLowerCase().startsWith('javascript:')) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML;
}

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

document.addEventListener('DOMContentLoaded', () => {
  initHeroCarousel();
  initAuthBackground();
  initAnimatedFavicon();
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
  document.querySelectorAll('.cart-panel,.access-nav').forEach(el => {
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
  if(!document.getElementById('page-home')?.classList.contains('active') || fullpageInstance || !shouldUseFullpageLanding()) return;
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
  return document.getElementById('page-home')?.classList.contains('active') && document.body.classList.contains('fullpage-enabled') && window.fullpage_api;
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
  if(document.getElementById('page-home')?.classList.contains('active')) {
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
  if(document.getElementById('page-home')?.classList.contains('active') && window.fullpage_api) {
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
    if(!document.getElementById('page-home')?.classList.contains('active') || !document.body.classList.contains('fullpage-enabled')) return;
    if(isClickNavExcluded(e.target)) return;
    const section = getActiveLandingSection();
    if(!section?.dataset?.horizontal) return;
    const direction = e.clientX > window.innerWidth / 2 ? 1 : -1;
    navigateLandingHorizontal(direction);
  }, true);
  document.addEventListener('pointerdown', e => {
    if(!document.getElementById('page-home')?.classList.contains('active') || !document.body.classList.contains('fullpage-enabled')) return;
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
    if(!document.getElementById('page-home')?.classList.contains('active') || !document.body.classList.contains('fullpage-enabled')) return;
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
    if(!document.getElementById('page-home')?.classList.contains('active') || !document.body.classList.contains('fullpage-enabled')) return;
    if(isClickNavExcluded(e.target)) return;
    e.preventDefault();
    if(wheelLocked || Math.abs(e.deltaY) < 12) return;
    wheelLocked = true;
    setLandingSection(landingSectionIndex + (e.deltaY > 0 ? 1 : -1), true);
    window.setTimeout(() => { wheelLocked = false; }, 820);
  }, {passive:false});
  document.addEventListener('pointerdown', e => {
    if(!document.getElementById('page-home')?.classList.contains('active') || !document.body.classList.contains('fullpage-enabled')) return;
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
    if(!document.getElementById('page-home')?.classList.contains('active') || !document.body.classList.contains('fullpage-enabled')) return;
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
  if(document.getElementById('page-home')?.classList.contains('active') && document.body.classList.contains('fullpage-enabled')) {
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
      {autoAlpha:0, y:22},
      {autoAlpha:1, y:0, duration:.72, ease:'expo.out', delay:.02}
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
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if(['POST','PATCH','PUT','DELETE'].includes(method)) headers['X-ROOMIE-CSRF'] = getRoomieCsrfToken();
  const res = await fetch(path, {
    credentials: 'include',
    headers,
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

function getRoomieCsrfToken() {
  const existing = document.cookie.split(';').map(p => p.trim()).find(p => p.startsWith('roomie.csrf='))?.split('=')[1];
  if(existing) return decodeURIComponent(existing);
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  document.cookie = `roomie.csrf=${encodeURIComponent(token)}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  return token;
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
    title.innerHTML = sanitizeHtml(slide.title);
    addr.textContent = slide.addr;
    sub.textContent = slide.sub;
    meta.innerHTML = slide.meta.map(item => `<span>${escapeHtml(item)}</span>`).join('');
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
  if(activeAccess.doorCode && code === activeAccess.doorCode) {
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


// ── PARTNER CODE ──
function copyPartnerCode() {
  navigator.clipboard?.writeText('ROOMIE-MB7724');
  showToast('Codice partner copiato! ✓');
}

async function copyWifiCredentials() {
  try {
    const response = await fetch('/api/room/wifi');
    const data = await response.json();
    if(!response.ok || !data?.wifi?.configured) throw new Error('WIFI_UNAVAILABLE');
    const text = `ROOMIE Wi-Fi\nUsername: ${data.wifi.ssid}\nPassword: ${data.wifi.password}`;
    navigator.clipboard?.writeText(text);
    showToast({title:'Wi-Fi copiato', copy:'Username e password pronti da incollare.'});
  } catch {
    showToast({title:'Wi-Fi disponibile in sessione', copy:'Accedi al profilo durante la sessione live.', type:'warn'});
  }
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
    if(body) body.innerHTML = sanitizeHtml(result.value || doc.fallback) + legalDocDownloadLink(doc);
  } catch (err) {
    if(body) body.innerHTML = sanitizeHtml(doc.fallback) + legalDocDownloadLink(doc);
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
  if(typeof window.__roomie_showToast === 'function') { window.__roomie_showToast(msg); return; }
  const t = document.getElementById('toast');
  if(!t) return;
  const payload = typeof msg === 'string'
    ? {title:msg.replace(/[✓!]/g,'').trim(), copy:'', type:'ok'}
    : {title:msg.title || 'Fatto', copy:msg.copy || '', type:msg.type || 'ok'};
  t.classList.toggle('warn', payload.type === 'warn');
  const icon = payload.type === 'warn' ? 'fa-exclamation-triangle' : 'fa-check';
  t.innerHTML = `<div class="toast-icon"><i class="fas ${icon}"></i></div><div><div class="toast-title">${escapeHtml(payload.title)}</div>${payload.copy ? `<div class="toast-copy">${escapeHtml(payload.copy)}</div>` : ''}</div>`;
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


// ── STUBS (LegacyModals in page.tsx) ──

function generateInviteLink() {
  navigator.clipboard?.writeText(window.location.origin + '/invite/link');
  showToast({title:'Link invito copiato', copy:'Invia il link agli amici.'});
  closeModal('modal-invite');
}

async function buyTokens() {
  const amtText = document.getElementById('token-modal-amount')?.textContent || '';
  const amount = parseInt(amtText.match(/\d+/)?.[0] || '20', 10);
  try {
    const res = await fetch('/api/stripe/topup-checkout', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json','X-ROOMIE-CSRF':getRoomieCsrfToken()},
      body: JSON.stringify({amount})
    });
    const d = await res.json();
    if(d.url) window.location.href = d.url;
    else showToast({title:'Stripe non disponibile', type:'warn'});
  } catch(_) {
    showToast({title:'Errore connessione', type:'warn'});
  }
}

// ── COMPAT STUBS ──
// Functions still referenced in kept legacy blocks but now owned by React.

function showPage(id) {
  // Delegate to React AppContext bridge
  if (typeof window.__roomie_showPage === 'function') {
    window.__roomie_showPage(id);
  }
}

function canViewLiveCamera() {
  // Session access is handled by React — always false from this JS context
  return false;
}

function updateCameraAccessUI() {
  // Camera UI is managed by React SessionPage — no-op here
}

function openCameraAccessAction() {
  showPage('confirm');
}

// ── INIT ──
// Auth, routing, booking, shop, admin → React AppContext.
// roomie.js only handles animations and modal helpers.
