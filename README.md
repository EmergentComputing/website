# emergentcomputing.org

Static site of Emergent Computing. Plain HTML, one stylesheet, two scripts; no build step.
Light and dark modes follow the system setting; the header button overrides it (remembered per browser).

Branches: `main` is the published site, `dev` keeps the two earlier design references (A editorial /
B instrument, switchable in the header), `old` is the site before the redesign.
Pushing to the deployed branch publishes the site (currently Netlify).

## Structure

```text
index.html                          home: the lab, Emergent Models (live figures), research, publications, code, people, contact
research/index.html                 research: pinned posts, then dated posts (newest first)
research/emergent-models.html       pinned: framework, theory, experiments (EM43, Game of Life, CEM1D, CEM2D)
research/lu-machines.html           pinned: LUTM-1, LUTM-6, LU-A
research/ncpu-em.html               pinned: NCPU-EM (loads research/ncpu-model.js, the trained weights)
research/<slug>.html                one file per post
research/_template.html             starting point for a new post (noindex)
style.css                           all styles; colour tokens at the top (light), dark overrides below them
viz.js                              model engine: EM43, LUTM-6, CEM1D, CEM2D data, GoL-EM, LU-A, NCPU-EM-1D, sine MLP
script.js                           light/dark toggle, EM43 hero, figures (<canvas data-viz=...>), explorer, BibTeX copy
images/team/                        320×320 team photos
sitemap.xml, robots.txt, llms.txt, 404.html, _redirects (Netlify only), .nojekyll (GitHub Pages)
```

Old URLs (`/emergent-models.html`, `/reasoning-models.html`, `/applied-research.html`, `/blog/...`) redirect to
`/research/` through `_redirects` on Netlify. On GitHub Pages these redirects do not exist.

## Adding a research post

1. Copy `research/_template.html` to `research/<short-slug>.html`.
2. Fill in every `TODO` (title, description, slug, dates, author, body) and delete the `noindex` line.
3. Add an entry at the top of the "Posts" list in `research/index.html` and to its JSON-LD `blogPost` list.
4. Optionally list it under "Research" in `index.html`, and add a `<url>` entry to `sitemap.xml`.
5. Commit and push.

Figures: inline SVG, HTML/CSS, or `<canvas data-viz="name">` using a figure defined in `script.js`
(static figures in `FIGS`, animated ones in `ANIM`). Put image files in `images/research/`.

## Local preview (Windows, PowerShell)

```powershell
Set-Location path\to\website
python -m http.server 8000
```

Then open http://localhost:8000.

## Writing style

State what was done and what was found; give numbers with their conditions; keep limitations visible;
label untested ideas as hypotheses. No marketing language.

## Colours

Brand: the logo's violet and sky blue. Data: EM43 cell colours (ink, red marker, blue halting, green origin).
Research lines: `--c-em`, `--c-lutm`, `--c-nca`, `--c-reason`, `--c-hw`, used for accents on pinned posts
and in figures. All tokens are defined twice in `style.css` (light, then `html[data-mode="dark"]`).
