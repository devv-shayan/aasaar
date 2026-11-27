// AASAAR site: send www to the bare domain, serve the static files,
// and give AI agents a Markdown copy of any page when they ask for one (Accept: text/markdown).
import { htmlToMarkdown } from './markdown.js';

// How AI systems may use the site. Keep in step with robots.txt.
const CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=yes';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.aasaar.tech') {
      url.hostname = 'aasaar.tech';
      return Response.redirect(url.toString(), 301);
    }

    const read = request.method === 'GET' || request.method === 'HEAD';
    if (!read || !prefersMarkdown(request.headers.get('Accept'))) {
      const res = await env.ASSETS.fetch(request);
      return isHtml(res) ? withVary(res) : res; // the same URL can also answer in Markdown
    }

    // An agent asked for Markdown: load the page's HTML and convert it.
    const page = await env.ASSETS.fetch(new Request(url, { headers: { Accept: 'text/html' } }));
    if (!page.ok || !isHtml(page)) return page; // redirects, 404s and non-HTML files pass through
    const markdown = htmlToMarkdown(await page.text(), url.href);
    const headers = new Headers({
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept',
      'Cache-Control': page.headers.get('Cache-Control') || 'public, max-age=0, must-revalidate',
      'Content-Signal': CONTENT_SIGNAL,
      'X-Markdown-Tokens': String(Math.ceil(markdown.length / 4)), // estimate: about 4 characters per token
    });
    return new Response(request.method === 'HEAD' ? null : markdown, { headers });
  },
};

const isHtml = (res) => (res.headers.get('Content-Type') || '').includes('text/html');

function withVary(res) {
  const out = new Response(res.body, res);
  out.headers.append('Vary', 'Accept');
  return out;
}

// True when the Accept header ranks text/markdown at least as high as text/html.
function prefersMarkdown(accept) {
  if (!accept) return false;
  let md = 0, html = 0;
  for (const part of accept.split(',')) {
    const [type, ...params] = part.trim().toLowerCase().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const weight = q ? parseFloat(q.slice(2)) : 1;
    if (type === 'text/markdown') md = Math.max(md, weight);
    if (type === 'text/html') html = Math.max(html, weight);
  }
  return md > 0 && md >= html;
}
