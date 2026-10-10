/* Luis Palacios — Portfolio
   Sin dependencias. Idioma, header sticky y revelado al scroll. */

(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.add('js');

  /* ---------------- Idioma ---------------- */
  var KEY = 'lp-lang';
  var toggle = document.getElementById('langToggle');
  var revealedAll = false;

  function revealAll() {
    if (revealedAll) return;
    revealedAll = true;
    var items = document.querySelectorAll('[data-reveal]');
    for (var i = 0; i < items.length; i++) items[i].classList.add('is-visible');
  }

  function applyLang(lang, userAction) {
    doc.setAttribute('lang', lang);
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    // Los elementos ocultos por idioma no reciben el observer de scroll:
    // al cambiar de idioma los revelamos para que no queden invisibles.
    if (userAction) revealAll();
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var browserLang = (navigator.language || 'es').toLowerCase();
  var initial = saved || (browserLang.indexOf('es') === 0 ? 'es' : 'en');
  applyLang(initial, false);

  if (toggle) {
    toggle.addEventListener('click', function () {
      applyLang(doc.getAttribute('lang') === 'es' ? 'en' : 'es', true);
    });
  }

  /* ---------------- Header al hacer scroll ---------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 12) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------- Revelado al scroll ---------------- */
  var items = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      var delay = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        setTimeout(function () { el.classList.add('is-visible'); }, Math.min(delay, 220));
        delay += 55;
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    for (var i = 0; i < items.length; i++) io.observe(items[i]);
  } else {
    revealAll();
  }

  /* ---------------- Año del footer ---------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
