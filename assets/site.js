/* AASAAR — nav that takes the chapter's colour, section entrances, the four-stage slider,
   and the refusal sheets that pile up as the page moves. */
(function () {
  var root = document.documentElement;

  /* ---- 1. the nav takes the ink and ground of the chapter beneath it ---- */
  var nav = document.getElementById('nav');
  var zones = [].slice.call(document.querySelectorAll('[data-bg]'));
  var lastZone = null;

  function paintNav() {
    var probe = nav.offsetHeight + 2;
    var found = zones[0];
    for (var i = 0; i < zones.length; i++) {
      var r = zones[i].getBoundingClientRect();
      if (r.top <= probe) found = zones[i];
      else break;
    }
    if (found !== lastZone) {
      lastZone = found;
      nav.style.setProperty('--nav-bg', found.dataset.bg);
      nav.style.setProperty('--nav-ink', found.dataset.ink);
    }
  }

  /* ---- 2. entrances ---- */
  var reveals = [].slice.call(document.querySelectorAll('[data-reveal]'));

  function runReveals() {
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    reveals.forEach(function (el) {
      var group = el.parentElement ? [].slice.call(el.parentElement.children).filter(function (n) {
        return n.hasAttribute('data-reveal');
      }) : [];
      var i = Math.max(0, group.indexOf(el));
      el.style.setProperty('--d', Math.min(i, 6) * 70 + 'ms');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---- 3. the four stages ---- */
  var range = document.getElementById('range');
  var fill = document.getElementById('track-fill');
  var thumb = document.getElementById('track-thumb');
  var clauses = [].slice.call(document.querySelectorAll('.hiw__clause'));
  var notes = [].slice.call(document.querySelectorAll('.hiw__note'));
  var frags = [].slice.call(document.querySelectorAll('.frag'));
  var names = [].slice.call(document.querySelectorAll('.hiw__names li'));
  var stage = 0;

  var copy = [
    ['First:<br>you tag an ayah.', 'The verse is on the page. Tap a word for its root, then leave a note under it: a sentence, a voice memo, or a page you are trying to understand.'],
    ['Then:<br>someone forks it.', 'A note is a seed, not a verdict. Another student carries it into their own field and branches it, and every branch stays attached to the verse.'],
    ['Next:<br>two reviewers test it.', 'A scholar checks the Arabic and the context. A researcher checks the method, the data and the maths. Both write down what is missing.'],
    ['Last:<br>the paper goes out.', 'The verse is named in the methods, with the root and the reading it rests on. The evidence still has to stand on its own.']
  ];

  function setStage(n) {
    stage = Math.max(0, Math.min(3, n));
    if (range) range.value = String(stage);
    if (fill) fill.style.width = (stage / 3 * 100) + '%';
    if (thumb) thumb.style.left = (stage / 3 * 100) + '%';
    frags.forEach(function (f) { f.classList.toggle('is-on', Number(f.dataset.stage) === stage); });
    names.forEach(function (n, i) { n.classList.toggle('is-on', i === stage); });
    if (clauses[0]) clauses[0].innerHTML = copy[stage][0];
    if (notes[0]) notes[0].textContent = copy[stage][1];
  }

  names.forEach(function (n, i) {
    n.addEventListener('click', function () { setStage(i); });
  });

  if (range) {
    range.addEventListener('input', function () { setStage(Number(range.value)); });
    range.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setStage(stage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setStage(stage + 1);
      }
    });
    setStage(0);
  }

  var hiwSection = document.getElementById('method');
  if (hiwSection) {
    hiwSection.addEventListener('keydown', function (e) {
      if (e.target !== range && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        if (e.key === 'ArrowLeft') setStage(stage - 1);
        if (e.key === 'ArrowRight') setStage(stage + 1);
      }
    });
  }

  /* ---- 4. refusals: the pile — each card stops and the next slides over it ---- */
  var deck = document.getElementById('refusals-deck');
  var cards = deck ? [].slice.call(deck.children) : [];
  var stack = [];
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = window.matchMedia('(max-width: 760px)');

  function placeStack() {
    if (!stack.length) return;
    var y = window.scrollY;
    for (var i = 0; i < stack.length; i++) {
      var p = Math.min(1, Math.max(0, (y - stack[i].y0) / stack[i].span));
      stack[i].el.style.setProperty('--covered', p.toFixed(3));
    }
  }

  function measureStack() {
    stack = [];
    if (!deck || cards.length < 2) return;
    if (narrow.matches || calm.matches) {
      cards.forEach(function (c) { c.style.removeProperty('--covered'); });
      return;
    }
    /* offsetTop is the card's flow position: sticky never moves it */
    var deckTop = deck.getBoundingClientRect().top + window.scrollY;
    var tops = cards.map(function (c) { return parseFloat(getComputedStyle(c).top) || 0; });
    for (var i = 0; i < cards.length - 1; i++) {
      var nextTop = deckTop + cards[i + 1].offsetTop;   /* where the next card starts */
      var span = cards[i].offsetHeight - (tops[i + 1] - tops[i]);
      stack.push({ el: cards[i], y0: nextTop - tops[i] - cards[i].offsetHeight, span: Math.max(1, span) });
    }
    placeStack();
  }

  var resizeTimer = 0;
  function onResize() {
    onScroll();
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(measureStack, 140);
  }

  /* ---- 5. scroll work on one frame loop ---- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      paintNav();
      placeStack();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  [calm, narrow].forEach(function (m) { if (m.addEventListener) m.addEventListener('change', measureStack); });

  root.classList.add('motion-ready');
  paintNav();
  runReveals();
  measureStack();

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureStack);

  if (document.readyState === 'complete') { paintNav(); measureStack(); }
  else window.addEventListener('load', function () { paintNav(); measureStack(); });
})();
