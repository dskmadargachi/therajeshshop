# v15 – slim HTML
* Inline <style>/<script> moved to /<page>.css, /<page>-2.css (only where a later sheet must stay after wizard.css) and /<page>.js, linked with ?v=<hash>.
* Cascade order and script order are unchanged. index.html: module bundle also contains the two small IIFEs that used to sit before/after it.
* Third-party CDN <script>s are now `defer`. First-party sync scripts (site-ui, wizard, p2p, voice-alerts, scan-wizard) are untouched on purpose: they use readyState/DOMContentLoaded ordering.
* Repeated inline icons -> <symbol> in the existing sprite (counter.html gets a small new sprite). Padded SVG numbers (5.100 -> 5.1).
* HTML comments and inter-tag whitespace removed. sw.js / _routes.json / _worker.js unchanged. New: _headers.
* Deploy: upload everything; the HTML references hashed URLs so no SW VERSION bump is needed for these files.
