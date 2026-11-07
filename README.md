# AASAAR

Research infrastructure for the Quran. Start from an ayah, branch it with other students, and take it through a scholar and a scientist to a published research paper.

**Website:** https://devv-shayan.github.io/aasaar/

AASAAR is named for *athāratin min ʿilm*, "a trace of knowledge," in Al-Ahqaf 46:4.

## What's in this repo

The site is plain HTML, CSS and JavaScript, published with GitHub Pages from `main`.

| Path | What it is |
| --- | --- |
| `index.html`, `style.css`, `main.js` | The landing page and waitlist sign-up |
| `blog/` | The blog, one folder per post |
| `blog.js` | The entrance motion on blog pages |
| `media/` | Manuscripts, blog images and the launch teaser |
| `sitemap.xml` | Pages for search engines |

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publishing

Merging into `main` publishes the site. Blog posts are reviewed by a scholar of classical Arabic before they're merged.

## Credits

Manuscript images are public domain, via Wikimedia Commons. Blog images come from The Metropolitan Museum of Art (public domain) and NASA. Each post lists its own credits.
