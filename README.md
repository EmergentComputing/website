# emergentcomputing.org

Static site of Emergent Computing. Plain HTML, one stylesheet, two scripts; no build step.
Light and dark modes follow the system setting; the header button overrides it (remembered per browser).

Branches: `main` is the published site, `dev` keeps the two earlier design references (A editorial /
B instrument, switchable in the header), `old` is the site before the redesign.
Pushing to the deployed branch publishes the site (currently Netlify).

## Structure

```text
index.html                 home: approach, research lines, publications, code, writing, people, contact
emergent-models.html       framework, theory, experiments, machines, neural CA, hardware directions
reasoning-models.html      hypotheses (no results yet)
applied-research.html      collaborations
blog/index.html            list of notes
blog/<slug>.html           one file per note
blog/_template.html        starting point for a new note (noindex)
style.css                  all styles; colour tokens at the top (light), dark overrides below them
viz.js                     model engine: EM43, LUTM-6, CEM1D, elementary CA (all figures are computed)
script.js                  light/dark toggle, interactive EM43 hero, figures (<canvas data-viz=...>), explorer, BibTeX copy
images/team/               320×320 team photos
sitemap.xml, robots.txt, llms.txt, 404.html, _redirects (Netlify only), .nojekyll (GitHub Pages)
```

## Adding a note

1. Copy `blog/_template.html` to `blog/<short-slug>.html`.
2. Fill in every `TODO` (title, description, slug, dates, author, body) and delete the `noindex` line.
3. Add an entry at the top of the list in `blog/index.html` and to its JSON-LD `blogPost` list.
4. Update the "Writing" section in `index.html` (latest notes).
5. Add a `<url>` entry to `sitemap.xml`.
6. Commit and push.

Figures: inline SVG, HTML/CSS or a small script. Put any image files in `images/blog/`.

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
Research lines: `--c-em`, `--c-lutm`, `--c-nca`, `--c-reason`, `--c-hw`, used for accents on the home page
and in figures. All tokens are defined twice in `style.css` (light, then `html[data-mode="dark"]`).
