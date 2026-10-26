# emergentcomputing.org

Static site of Emergent Computing. Plain HTML, one stylesheet, one script; no build step.
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
style.css                  all styles; colour tokens at the top, dark mode via prefers-color-scheme
script.js                  EM43 space-time diagrams, BibTeX copy, footer year
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
