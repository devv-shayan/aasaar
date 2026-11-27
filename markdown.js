// Markdown for AI agents: turn one of the site's HTML pages into clean Markdown.
// worker.js serves this when a request sends `Accept: text/markdown`; browsers still get HTML.
// It keeps the page's words and structure (headings, paragraphs, lists, links, quotes, tables)
// and drops what isn't content (navigation, forms, scripts, video, decoration).

const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'video', 'audio', 'object',
  'embed', 'form', 'button', 'select', 'textarea', 'dialog', 'nav']);
const RAW = new Set(['script', 'style', 'textarea', 'title']); // their contents are text, not tags
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const BLOCK = new Set(['p', 'div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'figure', 'figcaption',
  'details', 'dl', 'dt', 'dd', 'address', 'hgroup', 'fieldset', 'legend']);
const MARK = { strong: '**', b: '**', em: '_', i: '_', cite: '_', code: '`', s: '~~', del: '~~' };
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', bull: '•', copy: '©',
  reg: '®', trade: '™', times: '×', rarr: '→', larr: '←', deg: '°', zwj: '‍', zwnj: '‌', shy: '' };

function decode(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] !== '#') return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
    const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
  });
}

function attrs(s = '') {
  const a = {};
  for (const m of s.matchAll(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    a[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return a;
}

const absolute = (href, base) => {
  try { return new URL(href, base).href; } catch { return href; }
};

export function htmlToMarkdown(html, pageUrl) {
  const head = (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1];
  const meta = {};
  let canonical = pageUrl;
  for (const [, at] of head.matchAll(/<meta\b([^>]*)>/gi)) {
    const a = attrs(at), key = (a.name || a.property || '').toLowerCase();
    if (key && a.content) meta[key] = a.content.trim();
  }
  for (const [, at] of head.matchAll(/<link\b([^>]*)>/gi)) {
    const a = attrs(at);
    if ((a.rel || '').toLowerCase() === 'canonical' && a.href) canonical = absolute(a.href, pageUrl);
  }
  const title = decode((head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]).replace(/\s+/g, ' ').trim();
  const jsonld = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim()).filter(Boolean);

  // The page's own content lives in <main>; the site bar and footer around it are left out.
  const body = (html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];
  const main = body.match(/<main\b[^>]*>([\s\S]*)<\/main>/i);
  const text = convert(main ? main[1] : body, canonical, !!main);

  const front = [['title', title || meta['og:title']], ['description', meta.description || meta['og:description']], ['url', canonical]]
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  let md = `---\n${front}\n---\n\n${text}\n`;
  if (jsonld.length) md += `\n\`\`\`json\n${jsonld.join('\n')}\n\`\`\`\n`;
  return md;
}

function convert(html, base, inMain) {
  let out = '';
  let pending = 0; // line break owed before the next text: 1 = new line, 2 = blank line
  let atStart = true; // nothing written since the last break or line prefix
  let skip = 0; // stack depth of the element being dropped (0 = none)
  let pre = 0, quote = 0, heading = 0;
  let glue = false; // a link or bold/italic just closed: a following word needs a space (CSS kept them apart)
  let table = null; // { rows, row, cell } while inside a <table>
  const stack = inMain ? [{ tag: 'main' }] : [];
  const lists = [];

  const has = (...tags) => stack.some((e) => tags.includes(e.tag));
  const inCell = () => table && table.cell != null;

  function flush() {
    if (!pending) return;
    out = out.replace(/[ \t]+$/, '');
    if (inCell()) out += ' ';
    else if (pending === 2) out += quote ? `\n${'>'.repeat(quote)}\n${'> '.repeat(quote)}` : '\n\n';
    else out += `\n${'> '.repeat(quote)}`;
    pending = 0;
  }
  const brk = (n) => { if (out && !atStart) pending = Math.max(pending, n); };
  const emit = (s) => { flush(); out += s; atStart = false; glue = false; };
  // start of a link or bold/italic: keep it off the previous word when the HTML relies on CSS for the gap
  const startInline = () => { flush(); if (/[\p{L}\p{N}]$/u.test(out)) out += ' '; return out.length; };
  const prefix = (s) => { flush(); out += s; atStart = true; };
  function blockBreak() {
    if (has('li') && !heading) { if (out && !atStart && !/\s$/.test(out)) out += ' '; } // keep a list item on one line
    else brk(2);
  }

  function text(raw) {
    if (skip || (table && !inCell())) return;
    let s = decode(raw);
    if (!pre) {
      s = s.replace(/\s+/g, ' ');
      if (pending || atStart || !out || /\s$/.test(out)) s = s.replace(/^ /, '');
      else if (glue && /^[\p{L}\p{N}“‘"(\[]/u.test(s)) s = ` ${s}`;
    }
    if (s) emit(s);
  }

  // Inline wrappers (links, bold, italics) are written first and wrapped when they close.
  function wrap(e) {
    const inner = out.slice(e.start), core = inner.trim();
    let rep = core;
    if (!core) rep = '';
    else if (e.tag === 'a') {
      if (e.href && core.includes('\n')) {
        // a link around a whole card: link the card's heading (or its first line of text)
        const lines = core.split('\n');
        let k = lines.findIndex((l) => /^#{1,6} \S/.test(l));
        if (k < 0) k = lines.findIndex((l) => l.trim() && !l.startsWith('!['));
        if (k < 0) k = 0;
        lines[k] = lines[k].replace(/^(#{1,6} |- |\d+\. )?(.*\S)/, (m, p = '', t) => `${p}[${t}](${e.href})`);
        rep = lines.join('\n');
      } else if (e.href) rep = `[${core}](${e.href})`;
    } else if (!core.includes('\n')) rep = MARK[e.tag] + core + MARK[e.tag];
    const lead = inner.slice(0, inner.length - inner.trimStart().length);
    const trail = inner.slice(inner.trimEnd().length);
    out = out.slice(0, e.start) + (rep ? lead + rep + trail : inner ? ' ' : '');
    if (rep) glue = true;
  }

  function renderTable() {
    const rows = table.rows;
    table = null;
    if (!rows.length) return;
    const w = Math.max(...rows.map((r) => r.length));
    const line = (r) => `| ${Array.from({ length: w }, (_, i) => r[i] ?? '').join(' | ')} |`;
    brk(2);
    emit([line(rows[0]), `|${' --- |'.repeat(w)}`, ...rows.slice(1).map(line)].join('\n'));
    brk(2);
  }

  function open(tag, at, selfClosing) {
    const isVoid = VOID.has(tag) || selfClosing;
    if (skip) { if (!isVoid) stack.push({ tag }); return; }
    const a = attrs(at);
    if (SKIP.has(tag) || 'hidden' in a || a['aria-hidden'] === 'true'
      || ((tag === 'header' || tag === 'footer') && !has('main', 'article'))) {
      if (!isVoid) { stack.push({ tag }); skip = stack.length; }
      return;
    }
    // end tags HTML lets authors leave out
    if (tag === 'li') closeOpen('li', ['ul', 'ol']);
    if (tag === 'p' || /^h[1-6]$/.test(tag) || BLOCK.has(tag) || ['ul', 'ol', 'table', 'blockquote', 'pre'].includes(tag)) {
      closeOpen('p', ['div', 'li', 'td', 'th', 'blockquote', 'section', 'article', 'main']);
    }
    const e = { tag };
    if (/^h[1-6]$/.test(tag)) { brk(2); prefix(`${'#'.repeat(+tag[1])} `); heading++; }
    else if (tag === 'summary') { brk(2); prefix('### '); heading++; }
    else if (tag === 'ul' || tag === 'ol') { brk(lists.length ? 1 : 2); lists.push({ ordered: tag === 'ol', n: (parseInt(a.start, 10) || 1) - 1 }); }
    else if (tag === 'li') {
      const l = lists[lists.length - 1] || { ordered: false, n: 0 };
      brk(1);
      prefix('  '.repeat(Math.max(0, lists.length - 1)) + (l.ordered ? `${++l.n}. ` : '- '));
    }
    else if (tag === 'blockquote') { brk(2); flush(); quote++; prefix('> '); }
    else if (tag === 'pre') { brk(2); emit('```'); brk(1); pre++; }
    else if (tag === 'table') { brk(2); table = { rows: [], row: null, cell: null }; }
    else if (tag === 'tr' && table) table.row = [];
    else if ((tag === 'td' || tag === 'th') && table) table.cell = out.length;
    else if (tag === 'br') { if (heading || inCell()) emit(' '); else brk(1); }
    else if (tag === 'hr') { brk(2); emit('---'); brk(2); }
    else if (tag === 'img') {
      const alt = (a.alt || '').trim();
      if (alt && a.src) { brk(1); emit(`![${alt}](${absolute(a.src, base)})`); brk(1); }
    }
    else if (tag === 'a') { e.start = startInline(); e.href = a.href && !/^javascript:/i.test(a.href) ? absolute(a.href, base) : ''; }
    else if (MARK[tag]) e.start = startInline();
    else if (BLOCK.has(tag)) blockBreak();
    if (!isVoid) stack.push(e);
  }

  function end(e) {
    if (skip) { if (stack.length < skip) skip = 0; return; }
    const tag = e.tag;
    if (/^h[1-6]$/.test(tag) || tag === 'summary') { heading = Math.max(0, heading - 1); brk(2); }
    else if (tag === 'ul' || tag === 'ol') { lists.pop(); brk(lists.length ? 1 : 2); }
    else if (tag === 'li') brk(1);
    else if (tag === 'blockquote') { quote = Math.max(0, quote - 1); brk(2); }
    else if (tag === 'pre') { pre = Math.max(0, pre - 1); brk(1); emit('```'); brk(2); }
    else if ((tag === 'td' || tag === 'th') && inCell()) {
      const cell = out.slice(table.cell).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
      out = out.slice(0, table.cell);
      table.cell = null;
      pending = 0;
      if (table.row) table.row.push(cell);
    }
    else if (tag === 'tr' && table) { if (table.row && table.row.length) table.rows.push(table.row); table.row = null; }
    else if (tag === 'table' && table) renderTable();
    else if (tag === 'a' || MARK[tag]) wrap(e);
    else if (BLOCK.has(tag)) blockBreak();
  }

  function close(tag) {
    let i = stack.length - 1;
    while (i >= 0 && stack[i].tag !== tag) i--;
    if (i < 0) return; // stray end tag
    while (stack.length > i) end(stack.pop());
  }

  function closeOpen(tag, stopAt) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].tag === tag) { while (stack.length > i) end(stack.pop()); return; }
      if (stopAt.includes(stack[i].tag)) return;
    }
  }

  const token = /<!--[\s\S]*?-->|<![^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>|([^<]+)|</g;
  const lower = html.toLowerCase();
  let m;
  while ((m = token.exec(html))) {
    if (m[5] !== undefined) { text(m[5]); continue; }
    if (m[2] === undefined) { if (m[0] === '<') text('<'); continue; } // comments, doctype, a stray "<"
    const tag = m[2].toLowerCase();
    if (m[1]) { close(tag); continue; }
    open(tag, m[3], !!m[4]);
    if (RAW.has(tag) && !m[4]) { // jump to the end tag so script or style text isn't read as HTML
      const endAt = lower.indexOf(`</${tag}`, token.lastIndex);
      token.lastIndex = endAt < 0 ? html.length : endAt;
    }
  }
  while (stack.length) end(stack.pop());
  if (table) renderTable();

  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/(\S)[ \t]{2,}/g, '$1 ')
    .replace(/^#{1,6}[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
