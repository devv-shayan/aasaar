// AASAAR blog pages: the landing page's entrance, added only once this script runs.
document.documentElement.classList.add('js');

const seen = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px' });

['.blog-head > *', '.post-link', '.post-head > div > *', '.post-head img', '.toc', '.prose > *', '.tiles img', '.cta > *'].forEach((sel) => {
  document.querySelectorAll(sel).forEach((el, n) => {
    el.classList.add('reveal');
    if (sel !== '.prose > *') el.style.setProperty('--d', `${Math.min(n, 6) * 70}ms`);
    seen.observe(el);
  });
});
document.querySelectorAll('mark').forEach((el) => seen.observe(el));
