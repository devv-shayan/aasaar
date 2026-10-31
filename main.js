// AASAAR landing page: pixel edges, the live first note, and sign-up through Formspree.
const WAITLIST_ENDPOINT = 'https://formspree.io/f/mdeelbjo';

const AYAT = [
  { ref: '51:47', name: 'Adh-Dhariyat 51:47', ar: 'وَالسَّمَاءَ بَنَيْنَاهَا بِأَيْدٍ وَإِنَّا لَمُوسِعُونَ', tr: '“We built the heaven with might, and We are expanding it.”' },
  { ref: '46:4', name: 'Al-Ahqaf 46:4', ar: 'أَوْ أَثَارَةٍ مِّنْ عِلْمٍ إِن كُنتُمْ صَادِقِينَ', tr: '“…or some trace of knowledge, if you are truthful.”' },
  { ref: '12:105', name: 'Yusuf 12:105', ar: 'وَكَأَيِّن مِّنْ آيَةٍ فِي السَّمَاوَاتِ وَالْأَرْضِ يَمُرُّونَ عَلَيْهَا وَهُمْ عَنْهَا مُعْرِضُونَ', tr: '“How many signs in the heavens and the earth they pass by, turning away from them.”' },
  { ref: '29:20', name: 'Al-Ankabut 29:20', ar: 'قُلْ سِيرُوا فِي الْأَرْضِ فَانظُرُوا كَيْفَ بَدَأَ الْخَلْقَ', tr: '“Say: travel through the earth and see how He began creation.”' },
];

// The stepped edge into and out of the dark section: a fixed pattern, so every visit matches.
document.querySelectorAll('.pixels').forEach((el) => {
  const cols = 32;
  const rows = 3;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = (c * 7 + r * 13 + (c * c) % 11) % 10 < (r + 1) * 3;
      const row = el.dataset.dir === 'down' ? r : rows - 1 - r;
      const t = ((c * 37 + r * 91) % 23) * 18;
      cells[row * cols + c] = `<i style="background:${on ? '#0b0d0c' : 'transparent'};--t:${t}ms"></i>`;
    }
  }
  el.innerHTML = cells.join('');
});

// The waitlist is the first note: the card fills in as you choose.
const form = document.querySelector('.joinform');
const empty = document.getElementById('c-q').textContent;
document.getElementById('ayahs').innerHTML = AYAT.map((a, n) => `<label class="chip"><input type="radio" name="ayah" value="${a.ref}"${n ? '' : ' checked'}><span>${a.ref}</span></label>`).join('');
const render = () => {
  const a = AYAT.find((x) => x.ref === form.elements.ayah.value);
  document.getElementById('c-ref').textContent = a.name;
  document.getElementById('c-ar').textContent = a.ar;
  document.getElementById('c-tr').textContent = a.tr;
  document.getElementById('c-q').textContent = form.elements.question.value.trim() || empty;
};
form.addEventListener('input', render);
render();

document.querySelectorAll('[data-waitlist]').forEach((f) => {
  const status = f.querySelector('.status') || f.parentElement.querySelector('.status');
  const button = f.querySelector('button[type=submit]');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(f);
    const entry = { email: d.get('email'), ayah: d.get('ayah') || '', question: d.get('question') || '', source: f.dataset.source };
    button.disabled = true;
    status.textContent = 'Saving your place…';
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...entry, _subject: 'AASAAR waitlist' }),
      });
      if (!res.ok) throw new Error(res.status);
      status.textContent = entry.ayah ? `You are on the list. Your note on ${entry.ayah} will be waiting on day one.` : 'You are on the list. We will write when early access opens.';
      f.reset();
      f.dispatchEvent(new Event('input'));
    } catch {
      status.textContent = "That didn't go through. Check your connection and try again.";
    } finally {
      button.disabled = false;
    }
  });
});

// Motion. Everything below only adds to a page that is complete without it.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Parts of each section arrive in turn as the section enters.
const GROUPS = ['.hero > div:first-child > :not(.status)', '.names span', '.center > *', '.feature__head', '.points li', '.dark__head', '.dark video', '.three p', '.tiles img', '.record > div:last-child', '.refuse h2', '.grid3 p', '.faq h2', '.faq details', '.cta__text > *', '.cta__card'];
const seen = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px' });
GROUPS.forEach((sel) => document.querySelectorAll(sel).forEach((el, n) => {
  el.classList.add('reveal');
  el.style.setProperty('--d', `${Math.min(n, 6) * 70}ms`);
  seen.observe(el);
}));
document.querySelectorAll('mark, .pixels, .stagebox').forEach((el) => seen.observe(el));

if (!reduced) {
  // The hero note writes itself, then the thread gains a branch.
  const q = document.getElementById('hero-q');
  const count = document.getElementById('hero-count');
  const text = q.textContent;
  count.textContent = '6';
  q.textContent = '';
  const caret = document.createElement('span');
  caret.className = 'caret';
  q.append(document.createTextNode(''), caret);
  let i = 0;
  setTimeout(function type() {
    q.firstChild.textContent = text.slice(0, ++i);
    if (i < text.length) { setTimeout(type, 34); return; }
    setTimeout(() => { caret.remove(); count.textContent = '7'; count.classList.add('pop'); }, 500);
  }, 1100);

  // The two review gates resolve one after the other when they come into view.
  document.querySelectorAll('.stagebox .ok, .stagebox .no').forEach((gate, n) => {
    const result = gate.textContent;
    gate.textContent = 'Waiting';
    gate.classList.add('waiting');
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setTimeout(() => { gate.textContent = result; gate.classList.remove('waiting'); gate.classList.add('pop'); }, 900 + n * 900);
    }, { threshold: 1 }).observe(gate);
  });

  // The hero panels spread apart and the manuscripts drift as the page scrolls.
  const panels = [...document.querySelectorAll('.stack .panel')];
  const boxes = [...document.querySelectorAll('.stagebox')];
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    if (y < 900) panels.forEach((p, n) => { p.style.translate = `0 ${-y * (0.05 + n * 0.035)}px`; });
    boxes.forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) b.style.setProperty('--y', `${((r.top + r.height / 2 - innerHeight / 2) / innerHeight * -28).toFixed(1)}px`);
    });
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // The reel plays muted while it is on screen.
  const reel = document.getElementById('reel');
  new IntersectionObserver(([e]) => { if (e.isIntersecting) reel.play().catch(() => {}); else reel.pause(); }, { threshold: 0.4 }).observe(reel);
}
