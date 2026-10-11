/* Luis Palacios — Portfolio
   Escritorio Debian/Cinnamon (Fase 1). Sin dependencias.
   ------------------------------------------------------------
   El contenido vive en el HTML (SEO y modo sin JS intactos); este
   script solo lo presenta como ventanas arrastrables y agrega el panel,
   el reloj y una terminal mínima.

   DESVIACIÓN DELIBERADA DE CINNAMON: los iconos abren con UN solo clic.
   Cinnamon usa doble clic, pero un reclutador no va a adivinar el doble
   clic y el costo de descubrimiento es el mayor riesgo del escritorio.

   El mecanismo de idioma (data-lang + toggle #langToggle de main.js) se
   reusa tal cual: la bandeja del panel hace click() sobre ese botón. */

(function () {
  'use strict';

  var doc = document.documentElement;
  var shell = document.getElementById('desktopShell');
  if (!shell) return;

  var PANEL_H = 44;          /* debe coincidir con --panel-h en desktop.css */
  var MOBILE_MAX = 767;

  var mainEl = document.querySelector('main');
  var surface = document.getElementById('desktopWindows');
  var iconsWrap = document.getElementById('desktopIcons');
  var tasksWrap = document.getElementById('panelTasks');
  var menuEl = document.getElementById('panelMenu');
  var menuBtn = document.getElementById('panelMenuBtn');
  var clockEl = document.getElementById('trayClock');
  var trayLang = document.getElementById('trayLangToggle');

  var windows = {};
  var order = [];
  var sectionOrder = [];
  var zTop = 10;
  var focused = null;
  var menuOpen = false;
  var introDone = false;   /* el auto-abrir "Sobre mí" ocurre una sola vez */

  /* ============================ helpers ============================ */

  function each(list, fn) {
    for (var i = 0; i < list.length; i++) fn(list[i], i);
  }

  function isMobile() {
    if (window.matchMedia) return window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
    return window.innerWidth <= MOBILE_MAX;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* Texto bilingüe que alterna con el CSS de data-lang ya existente. */
  function dual(es, en) {
    return '<span data-lang="es">' + esc(es) + '</span>' +
           '<span data-lang="en">' + esc(en) + '</span>';
  }

  /* Lee la etiqueta bilingüe de un icono para títulos/aria. */
  function labelText(wrap) {
    if (!wrap) return '';
    var es = '', en = '';
    var spans = wrap.querySelectorAll('[data-lang]');
    for (var i = 0; i < spans.length; i++) {
      var l = spans[i].getAttribute('data-lang');
      if (l === 'es') es = spans[i].textContent;
      else if (l === 'en') en = spans[i].textContent;
    }
    if (es && en && es !== en) return es + ' / ' + en;
    return es || en || wrap.textContent || '';
  }

  function cloneLabel(wrap) {
    var out = document.createElement('span');
    if (!wrap) return out;
    var kids = wrap.childNodes;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].nodeType === 1) out.appendChild(kids[i].cloneNode(true));
    }
    return out;
  }

  function unmaximize(w) {
    w.maximized = false;
    w.el.classList.remove('is-maximized');
    w.el.style.right = '';
    w.el.style.bottom = '';
    w.el.style.left = w.rect.x + 'px';
    w.el.style.top = w.rect.y + 'px';
    w.el.style.width = w.rect.w + 'px';
    w.el.style.height = w.rect.h + 'px';
  }

  function maximize(w) {
    if (w.maximized) return;
    if (!w.placed) { place(w); w.placed = true; }
    w.maximized = true;
    w.el.classList.add('is-maximized');
    w.el.style.left = '0'; w.el.style.top = '0';
    w.el.style.width = 'auto'; w.el.style.height = 'auto';
    w.el.style.right = '0'; w.el.style.bottom = '0';
  }

  /* ============================ ventanas ============================ */

  function ctrlBtn(cls, label, kind) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'wm-btn ' + cls;
    b.setAttribute('aria-label', label);
    if (kind === 'min') b.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8"/></svg>';
    if (kind === 'max') b.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1"/></svg>';
    if (kind === 'close') b.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7"/></svg>';
    return b;
  }

  function buildWindow(w) {
    var win = document.createElement('div');
    win.className = 'wm-window';
    win.setAttribute('data-app', w.id);
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', labelText(w.labelWrap));
    win.style.display = 'none';

    var bar = document.createElement('div');
    bar.className = 'wm-titlebar';

    var title = document.createElement('span');
    title.className = 'wm-title';
    title.appendChild(cloneLabel(w.labelWrap));

    var controls = document.createElement('div');
    controls.className = 'wm-controls';
    var btnMin = ctrlBtn('wm-min', 'Minimizar ventana / Minimize window', 'min');
    var btnMax = ctrlBtn('wm-max', 'Maximizar ventana / Maximize window', 'max');
    var btnClose = ctrlBtn('wm-close', 'Cerrar ventana / Close window', 'close');
    controls.appendChild(btnMin);
    controls.appendChild(btnMax);
    controls.appendChild(btnClose);

    bar.appendChild(title);
    bar.appendChild(controls);

    var body = document.createElement('div');
    body.className = 'wm-body';

    win.appendChild(bar);
    win.appendChild(body);
    surface.appendChild(win);

    w.el = win;
    w.body = body;

    win.addEventListener('mousedown', function () { focusWindow(w); });
    win.addEventListener('animationend', function () { win.classList.remove('wm-appear'); });
    btnMin.addEventListener('click', function (e) { e.stopPropagation(); minimizeWindow(w); });
    btnMax.addEventListener('click', function (e) { e.stopPropagation(); toggleMaximize(w); });
    btnClose.addEventListener('click', function (e) { e.stopPropagation(); closeWindow(w); });
    bar.addEventListener('mousedown', function (e) { startDrag(e, w, controls); });
  }

  /* Construye el contenido UNA sola vez y guarda el nodo en w.contentEl.
     Reutilizar ese mismo nodo es lo que evita la duplicación al reabrir:
     el bug previo volvía a clonar la plantilla y la append-eaba sin quitar
     la anterior, dejando 2 terminales / 2 CV y sus listeners vivos. */
  function buildContent(w) {
    if (w.contentBuilt) return;
    if (w.sectionEl) {
      w.contentEl = w.sectionEl;
    } else if (w.templateEl) {
      var frag = w.templateEl.content ? w.templateEl.content.cloneNode(true) : null;
      if (frag) {
        if (frag.childElementCount === 1) w.contentEl = frag.firstElementChild;
        else {
          w.contentEl = document.createElement('div');
          w.contentEl.appendChild(frag);
        }
      } else {
        w.contentEl = document.createElement('div');
        w.contentEl.innerHTML = w.templateEl.innerHTML;
      }
      if (w.id === 'terminal') w.body.classList.add('wm-body-term');
    }
    w.contentBuilt = true;
  }

  /* Monta dentro de la ventana el contenido que ya existe (sección real o
     plantilla construida). Es idempotente: si ya está montado, no duplica. */
  function ensureContent(w) {
    buildContent(w);
    if (w.contentEl && w.contentEl.parentNode !== w.body) {
      w.body.appendChild(w.contentEl);
    }
    if (w.sectionEl) w.sectionEl.hidden = false;
    /* La terminal se inicializa una sola vez para conservar listeners,
       foco e historial de comandos entre cierres y reaperturas. */
    if (w.id === 'terminal' && !w.termInput) setupTerminal(w);
    w.contentReady = true;
  }

  /* Cierra la ventana devolviendo la sección real a <main> para el modo
     clásico. El contenido de plantilla NO se destruye: queda en w.contentEl
     para reusarse al reabrir (sin re-clonar ni re-escuchar). */
  function detachSection(w) {
    if (w.sectionEl && w.sectionEl.parentNode === w.body) {
      mainEl.appendChild(w.sectionEl);
    }
    w.contentReady = false;
  }

  /* En modo escritorio, las secciones que NO están dentro de una ventana
     abierta quedan tapadas visualmente por el fondo fijo pero seguían en el
     árbol de accesibilidad y en innerText. Se usa `hidden` porque es el único
     de los mecanismos sugeridos que también las excluye de innerText (inert y
     aria-hidden no cambian el render, así que innerText las sigue contando).
     Solo se aplica con JS y en modo escritorio: en clásico y sin JS no hay
     ningún atributo y el contenido se lee completo. */
  function syncSectionA11y() {
    var on = doc.classList.contains('desktop-mode');
    each(order, function (w) {
      if (!w.sectionEl) return;
      var inWindow = w.sectionEl.parentNode !== mainEl;
      w.sectionEl.hidden = !!(on && !inWindow);
    });
  }

  /* ¿Otra ventana ya abierta ocupa exactamente esta posición? */
  function slotTaken(w, x, y) {
    for (var i = 0; i < order.length; i++) {
      var o = order[i];
      if (o === w || !o.open || !o.rect) continue;
      if (o.rect.x === x && o.rect.y === y) return true;
    }
    return false;
  }

  function place(w) {
    var vw = window.innerWidth;
    var vh = window.innerHeight - PANEL_H;
    var ww = Math.min(760, vw - 140);
    var wh = Math.min(560, vh - 80);
    if (ww < 300) ww = Math.max(240, vw - 20);
    if (wh < 220) wh = Math.max(180, vh - 20);

    /* A la derecha de la columna de iconos (96px de ancho + 14px de margen),
       para que los 7 iconos sigan visibles y clicables con la ventana abierta. */
    var left = 124;
    var dx = 26, dy = 26, top = 18;

    /* Cascada por índice de icono: 7 iconos → 7 posiciones distintas.
       Antes era `index % 6`, así que el 7.º (Terminal) caía EXACTAMENTE
       encima del 1.º (Sobre mí). Si el clamp contra los bordes repitiera una
       posición ya ocupada, se corre en diagonal hasta liberar otra. */
    var slot = w.index;
    var x = left, y = top;
    for (var n = 0; n < 60; n++) {
      x = left + slot * dx;
      y = top + slot * dy;
      if (x + ww > vw - 8) x = vw - ww - 8;
      if (x < 8) x = 8;
      if (y + wh > vh - 8) y = vh - wh - 8;
      if (y < 8) y = 8;
      if (n > 0) {
        /* El clamp puede saturar la diagonal en viewports chicos: un paso
           pequeño y variable evita repetir la posición exacta. */
        y = Math.max(8, y - ((n * 13) % 41));
        x = Math.max(8, x - ((n * 7) % 37));
      }
      if (!slotTaken(w, x, y)) break;
      slot++;
    }

    w.rect = { x: x, y: y, w: ww, h: wh };
    w.el.style.left = x + 'px';
    w.el.style.top = y + 'px';
    w.el.style.width = ww + 'px';
    w.el.style.height = wh + 'px';
  }

  function focusWindow(w) {
    if (!w) return;
    if (focused && focused !== w && focused.el) focused.el.classList.remove('is-focused');
    focused = w;
    w.el.classList.add('is-focused');
    w.el.style.zIndex = String(++zTop);
    renderTasks();
  }

  function openApp(id) {
    var w = windows[id];
    if (!w) return;
    var wasOpen = w.open;
    ensureContent(w);
    if (!w.open) {
      w.open = true;
      if (!w.placed) { place(w); w.placed = true; }
    }
    w.minimized = false;
    w.el.style.display = '';
    focusWindow(w);
    if (isMobile()) { w.mobileMax = true; maximize(w); }
    /* Animación de apertura (solo opacidad, para no alterar rects) cuando la
       ventana pasa de cerrada a abierta. Se desactiva con reduced-motion. */
    if (!wasOpen) w.el.classList.add('wm-appear');
    renderTasks();
    updateIconState();
    syncSectionA11y();
    if (id === 'terminal' && w.termInput) {
      try { w.termInput.focus(); } catch (e) {}
    }
  }

  function closeWindow(w) {
    detachSection(w);
    w.open = false;
    w.minimized = false;
    if (w.maximized) unmaximize(w);
    w.el.style.display = 'none';
    w.el.classList.remove('is-focused');
    if (focused === w) focused = null;
    renderTasks();
    updateIconState();
    syncSectionA11y();
  }

  function toggleMaximize(w) {
    /* En mobile la ventana siempre abre maximizada y sin arrastre (regla de
       degradación), así que este botón no aplica: desktop.css lo oculta a
       <768px para no dejar un control visible pero inerte. */
    if (isMobile()) return;
    if (w.maximized) unmaximize(w);
    else maximize(w);
  }

  function onTaskClick(w) {
    if (focused === w && !w.minimized) minimizeWindow(w);
    else openApp(w.id);
  }

  function renderTasks() {
    tasksWrap.innerHTML = '';
    each(order, function (w) {
      if (!w.open) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'panel-task' +
        (focused === w && !w.minimized ? ' is-active' : '') +
        (w.minimized ? ' is-minimized' : '');
      var lbl = cloneLabel(w.labelWrap);
      lbl.className = 'task-label';
      b.appendChild(lbl);
      b.addEventListener('click', function () { onTaskClick(w); });
      tasksWrap.appendChild(b);
    });
  }

  function updateIconState() {
    each(order, function (w) {
      var btn = iconsWrap.querySelector('.di[data-open="' + w.id + '"]');
      if (!btn) return;
      if (w.open && !w.minimized) btn.classList.add('is-open');
      else btn.classList.remove('is-open');
    });
  }

  function startDrag(e, w, controls) {
    if (e.button !== 0) return;
    if (isMobile()) return;
    if (w.maximized) return;
    if (controls && controls.contains(e.target)) return;
    focusWindow(w);
    var sx = e.clientX, sy = e.clientY, ox = w.rect.x, oy = w.rect.y;

    function onMove(ev) {
      var nx = ox + (ev.clientX - sx);
      var ny = oy + (ev.clientY - sy);
      var maxX = window.innerWidth - w.rect.w;
      var maxY = window.innerHeight - PANEL_H - 40;
      if (maxX < 0) maxX = 0;
      if (nx < 0) nx = 0;
      if (nx > maxX) nx = maxX;
      if (ny < 0) ny = 0;
      if (ny > maxY) ny = maxY;
      w.el.style.left = nx + 'px';
      w.el.style.top = ny + 'px';
      w.rect.x = nx;
      w.rect.y = ny;
    }
    function onUp() {
      doc.classList.remove('is-dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    doc.classList.add('is-dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    if (e.preventDefault) e.preventDefault();
  }

  function syncMobile() {
    var m = isMobile();
    each(order, function (w) {
      if (!w.open) return;
      if (m) {
        if (!w.maximized) { w.mobileMax = true; maximize(w); }
      } else if (w.mobileMax) {
        w.mobileMax = false;
        unmaximize(w);
      }
    });
  }

  /* ============================ menú del panel ============================ */

  function buildMenu() {
    each(order, function (w) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'panel-menu-item';
      var iconBtn = iconsWrap.querySelector('.di[data-open="' + w.id + '"] .di-ico');
      if (iconBtn) {
        var ic = iconBtn.cloneNode(true);
        ic.className = 'menu-ico';
        item.appendChild(ic);
      }
      var lbl = cloneLabel(w.labelWrap);
      lbl.className = 'menu-label';
      item.appendChild(lbl);
      item.addEventListener('click', function () { closeMenu(); openApp(w.id); });
      menuEl.appendChild(item);
    });
  }

  function setMenu(open) {
    menuOpen = open;
    menuEl.hidden = !open;
    if (open) menuBtn.classList.add('is-active');
    else menuBtn.classList.remove('is-active');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeMenu() { if (menuOpen) setMenu(false); }

  /* ============================ reloj ============================ */

  function fmtClock(d, lang) {
    var loc = lang === 'es' ? 'es-PE' : 'en-US';
    var time = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    var date = d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' });
    return time + ' · ' + date;
  }

  function updateClock() {
    var now = new Date();
    clockEl.innerHTML =
      '<span data-lang="es">' + esc(fmtClock(now, 'es')) + '</span>' +
      '<span data-lang="en">' + esc(fmtClock(now, 'en')) + '</span>';
  }

  /* ============================ terminal ============================ */

  var TERM_FILES = [
    { name: 'sobre-mi.md', section: 'sobre-mi' },
    { name: 'experiencia.md', section: 'experiencia' },
    { name: 'skills.md', section: 'skills' },
    { name: 'proyectos.md', section: 'proyectos' },
    { name: 'contacto.md', section: 'contacto' },
    { name: 'cv.txt' }
  ];
  var TERM_COMMANDS = ['help', 'whoami', 'ls', 'cat', 'clear', 'cv'];

  /* Texto plano de una sección en un idioma, sin duplicar contenido. */
  function langText(id, lang) {
    var sec = document.getElementById(id);
    if (!sec) return '';
    var clone = sec.cloneNode(true);
    var nodes = clone.querySelectorAll('[data-lang]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-lang') !== lang && nodes[i].parentNode) {
        nodes[i].parentNode.removeChild(nodes[i]);
      }
    }
    var t = clone.textContent || '';
    t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ');
    return t.trim();
  }

  function setupTerminal(w) {
    var screen = w.body.querySelector('.term-screen');
    var form = w.body.querySelector('.term-form');
    var input = w.body.querySelector('.term-input');
    if (!screen || !form || !input) return;
    w.termInput = input;

    var history = [];
    var hIndex = 0;

    function print(html) {
      var line = document.createElement('div');
      line.className = 'term-line';
      line.innerHTML = html;
      screen.appendChild(line);
      screen.scrollTop = screen.scrollHeight;
    }
    function printOut(es, en) {
      print('<span class="term-out">' + dual(es, en) + '</span>');
    }
    function echo(line) {
      return '<span class="term-ps1">luis@debian:~$</span> ' + esc(line);
    }
    function findFile(name) {
      for (var i = 0; i < TERM_FILES.length; i++) {
        if (TERM_FILES[i].name === name) return TERM_FILES[i];
      }
      return null;
    }

    var HELP = {
      es: [
        'Comandos disponibles:',
        '  help             Muestra esta ayuda',
        '  whoami           Quién soy y qué hago',
        '  ls               Lista los archivos del escritorio',
        '  cat <archivo>    Muestra el contenido de un archivo',
        '  clear            Limpia la pantalla',
        '  cv               Abre la ventana del CV'
      ].join('\n'),
      en: [
        'Available commands:',
        '  help             Show this help',
        '  whoami           Who I am and what I do',
        '  ls               List the desktop files',
        '  cat <file>       Show the contents of a file',
        '  clear            Clear the screen',
        '  cv               Open the CV window'
      ].join('\n')
    };
    var WHOAMI = {
      es: 'Luis Javier Palacios Sernaque\nBackend & Full-Stack Developer\nPython · Django · PostgreSQL · REST APIs · Vue 3 · Docker\nDisponible para trabajo remoto.',
      en: 'Luis Javier Palacios Sernaque\nBackend & Full-Stack Developer\nPython · Django · PostgreSQL · REST APIs · Vue 3 · Docker\nAvailable for remote work.'
    };
    var LS = {
      es: 'sobre-mi.md   experiencia.md   skills.md   proyectos.md   contacto.md   cv.txt\n\nAbrí uno con: cat <archivo>',
      en: 'sobre-mi.md   experiencia.md   skills.md   proyectos.md   contacto.md   cv.txt\n\nOpen one with: cat <file>'
    };
    var CV_TEXT = {
      es: 'CV — Luis Palacios\nDescargas:\n  cv/Luis-Palacios-CV-ES.pdf\n  cv/Luis-Palacios-CV-EN.pdf',
      en: 'CV — Luis Palacios\nDownloads:\n  cv/Luis-Palacios-CV-ES.pdf\n  cv/Luis-Palacios-CV-EN.pdf'
    };
    var CV_HINT = {
      es: 'Abriendo la ventana del CV…',
      en: 'Opening the CV window…'
    };

    function run(line) {
      var parts = line.split(/\s+/);
      var cmd = (parts[0] || '').toLowerCase();
      var arg = parts.slice(1).join(' ');

      if (cmd === 'help') { printOut(HELP.es, HELP.en); return; }
      if (cmd === 'whoami') { printOut(WHOAMI.es, WHOAMI.en); return; }
      if (cmd === 'ls') { printOut(LS.es, LS.en); return; }
      if (cmd === 'clear') { screen.innerHTML = ''; return; }
      if (cmd === 'cv') { printOut(CV_HINT.es, CV_HINT.en); openApp('cv'); return; }
      if (cmd === 'cat') {
        if (!arg) {
          printOut('cat: falta el nombre del archivo\nUso: cat <archivo>',
                   'cat: missing file name\nUsage: cat <file>');
          return;
        }
        var f = findFile(arg);
        if (!f) {
          printOut('cat: ' + arg + ': no existe ese archivo',
                   'cat: ' + arg + ': no such file');
          return;
        }
        if (f.section) printOut(langText(f.section, 'es'), langText(f.section, 'en'));
        else printOut(CV_TEXT.es, CV_TEXT.en);
        return;
      }
      printOut('comando no encontrado: ' + cmd + '\nProbá con: help',
               'command not found: ' + cmd + '\nTry: help');
    }

    function autocomplete() {
      var value = input.value;
      if (!value) return;
      var tokens = value.split(' ');
      var last = tokens[tokens.length - 1];
      var pool = tokens.length === 1 ? TERM_COMMANDS.concat(TERM_FILES.map(function (f) { return f.name; }))
                                     : TERM_FILES.map(function (f) { return f.name; });
      var matches = [];
      for (var i = 0; i < pool.length; i++) {
        if (pool[i].indexOf(last) === 0) matches.push(pool[i]);
      }
      if (matches.length === 1) {
        tokens[tokens.length - 1] = matches[0];
        input.value = tokens.join(' ') + ' ';
      } else if (matches.length > 1) {
        printOut(matches.join('   '), matches.join('   '));
      }
    }

    form.addEventListener('submit', function (e) {
      if (e.preventDefault) e.preventDefault();
      var raw = input.value;
      input.value = '';
      var line = raw.replace(/^\s+|\s+$/g, '');
      if (!line) return;
      history.push(line);
      hIndex = history.length;
      print(echo(raw));
      run(line);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') {
        if (e.preventDefault) e.preventDefault();
        if (hIndex > 0) { hIndex--; input.value = history[hIndex] || ''; }
      } else if (e.key === 'ArrowDown') {
        if (e.preventDefault) e.preventDefault();
        if (hIndex < history.length - 1) { hIndex++; input.value = history[hIndex] || ''; }
        else { hIndex = history.length; input.value = ''; }
      } else if (e.key === 'Tab') {
        if (e.preventDefault) e.preventDefault();
        autocomplete();
      }
    });

    /* Banner inicial bilingüe. */
    printOut(
      "Portfolio de Luis Palacios — terminal mínima\nEscribí 'help' para ver los comandos disponibles.",
      "Luis Palacios' portfolio — minimal terminal\nType 'help' to see the available commands."
    );
  }

  /* ============================ inicialización ============================ */

  function init() {
    /* Orden original de las secciones para poder restaurarlo en modo clásico. */
    var kids = mainEl.children;
    for (var k = 0; k < kids.length; k++) {
      if (kids[k].tagName === 'SECTION' && kids[k].id) sectionOrder.push(kids[k]);
    }

    var apps = iconsWrap.querySelectorAll('.di');
    each(apps, function (btn, i) {
      var id = btn.getAttribute('data-open');
      if (!id) return;
      var w = {
        id: id,
        index: i,
        labelWrap: btn.querySelector('.di-name'),
        sectionEl: document.getElementById(id),
        templateEl: document.getElementById('tpl-' + id),
        el: null,
        body: null,
        contentEl: null,      /* nodo reutilizable: sección real o plantilla */
        contentBuilt: false,  /* el contenido se construye una sola vez */
        termInput: null,
        contentReady: false,
        open: false,
        minimized: false,
        maximized: false,
        mobileMax: false,
        placed: false,
        rect: { x: 0, y: 0, w: 0, h: 0 }
      };
      windows[id] = w;
      order.push(w);
      buildWindow(w);
      btn.addEventListener('click', function () { openApp(id); });
    });

    buildMenu();

    menuBtn.addEventListener('click', function () { setMenu(!menuOpen); });
    document.addEventListener('click', function (e) {
      if (!menuOpen) return;
      if (menuEl.contains(e.target) || menuBtn.contains(e.target)) return;
      closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });

    if (trayLang) {
      trayLang.addEventListener('click', function () {
        var t = document.getElementById('langToggle');
        if (t) t.click();
      });
    }
    var classicBtn = document.getElementById('modeToggleDesktop');
    if (classicBtn) classicBtn.addEventListener('click', disableDesktopMode);
    var deskBtn = document.getElementById('modeToggle');
    if (deskBtn) deskBtn.addEventListener('click', enableDesktopMode);

    updateClock();
    setInterval(updateClock, 30000);
    window.addEventListener('resize', syncMobile);

    /* El escritorio es el modo por defecto cuando hay JavaScript. */
    doc.classList.add('desktop-mode');

    /* Primer pantallazo: nombre, rol y disponibilidad sin un clic. */
    autoOpenAbout();
  }

  function disableDesktopMode() {
    closeMenu();
    each(order, function (w) {
      w.wasOpen = w.open;
      detachSection(w);
      w.open = false;
      w.minimized = false;
      if (w.maximized) unmaximize(w);
      w.el.style.display = 'none';
      w.el.classList.remove('is-focused');
    });
    /* Reordenar en el orden original: el modo clásico debe quedar idéntico. */
    each(sectionOrder, function (sec) { mainEl.appendChild(sec); });
    focused = null;
    renderTasks();
    updateIconState();
    doc.classList.remove('desktop-mode');
    /* El modo clásico (y el render sin JS) no oculta nada. */
    syncSectionA11y();
  }

  function enableDesktopMode() {
    doc.classList.add('desktop-mode');
    each(order, function (w) {
      if (w.wasOpen) openApp(w.id);
    });
    /* Lo que no se restauró vuelve a quedar fuera del árbol de accesibilidad. */
    syncSectionA11y();
  }

  /* Identidad en el primer pantallazo: con JS se abre "Sobre mí" una única
     vez, enfocada y a la derecha de la columna de iconos. No se vuelve a
     auto-abrir si el usuario la cierra ni al volver del modo clásico. */
  function autoOpenAbout() {
    if (introDone) return;
    introDone = true;
    openApp('sobre-mi');
  }

  init();
})();
