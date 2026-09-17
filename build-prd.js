// Renders Kapture_Closure_Sync_PRD.md into the house spec HTML skeleton.
// Adapted from call-logs-prd/build.js; CSS reused verbatim via site/_head.html.
// The markdown is the source of truth — everything on the page is derived from it,
// so the page cannot drift from the PRD.
const fs = require('fs');

const MD = 'Kapture_Closure_Sync_PRD.md';
const md = fs.readFileSync(MD, 'utf8');
let head = fs.readFileSync('site/_head.html', 'utf8');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function block(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const L = lines[i];

    if (/^```mermaid/.test(L)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<div class="mermaid">\n${esc(buf.join('\n'))}\n</div>`);
      continue;
    }
    if (/^```/.test(L)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\|/.test(L)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
      const hasSep = rows[1] && /^\|[\s:|-]+\|?$/.test(rows[1]);
      const header = hasSep ? cells(rows[0]) : null;
      const body = (hasSep ? rows.slice(2) : rows).map(cells);
      let t = '<table>';
      if (header && header.some(h => h !== '')) {
        t += '<tr>' + header.map(h => `<th>${inline(h)}</th>`).join('') + '</tr>';
      }
      body.forEach(r => {
        const open = /OPEN/.test(r[r.length - 1] || '') ? ' class="open-row"' : '';
        t += `<tr${open}>` + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
      });
      out.push(t + '</table>');
      continue;
    }
    if (/^####\s+/.test(L)) { out.push(`<h4>${inline(L.replace(/^####\s+/, ''))}</h4>`); i++; continue; }
    if (/^###\s+/.test(L)) { out.push(`<h3>${inline(L.replace(/^###\s+/, ''))}</h3>`); i++; continue; }
    if (/^[-*]\s+/.test(L)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ''));
      out.push('<ul>' + items.map(x => `<li>${inline(x)}</li>`).join('') + '</ul>');
      continue;
    }
    if (/^---+$/.test(L) || L.trim() === '') { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^[|#-]|^```/.test(lines[i])) para.push(lines[i++]);
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

// ── split on ## headings ─────────────────────────────────────────────
const parts = md.split(/^## /m);
const preamble = parts.shift();
const sections = parts.map(p => {
  const nl = p.indexOf('\n');
  return { title: p.slice(0, nl).trim(), body: p.slice(nl + 1) };
});

const numbered = sections.filter(s => /^[0-9]+\./.test(s.title));
const closeout = sections.filter(s => !/^[0-9]+\./.test(s.title));

const mdTitle = (preamble.match(/^#\s+(.+)$/m) || [, 'Untitled'])[1].trim();
const mdHeaderTable = preamble.split('\n').filter(l => /^\|/.test(l)).join('\n');
const objective = ((numbered.find(s => /^1\./.test(s.title)) || { body: '' })
  .body.match(/\*\*Objective\.\*\*\s*([^\n]+)/) || [, ''])[1].trim();
const mdVersion = (preamble.match(/\*\*Version\*\*\s*—\s*(v[0-9.]+)/) || [, ''])[1];
const mdStatus = (preamble.match(/\*\*Status\*\*\s*—\s*([^|]+)/) || [, ''])[1].trim();

// Browser-tab title tracks the markdown's version cell, so a bump cannot leave it stale.
head = head.replace(/<title>[\s\S]*?<\/title>/,
  `<title>${esc(mdTitle.split('—')[0].trim())} — PRD ${mdVersion}</title>`);

// Counts read off the document, not typed in — they cannot go stale.
const acCount = (md.match(/^\| AC-[A-Z0-9-]+/gm) || []).length;
const openCount = (md.match(/\| OPEN \|/g) || []).length;
const tCount = (md.match(/^\| T\d+/gm) || []).length;
const cCount = (md.match(/^\| C-\d+/gm) || []).length;

const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tierOf = n => (n <= 2 ? 'what' : 'how');

const toc = `
<nav class="toc" aria-label="Table of contents">
  <h2 class="what">Requirements — what &amp; why</h2>
  <ol>
${numbered.filter(s => parseInt(s.title, 10) <= 2)
    .map(s => `    <li><a href="#s${parseInt(s.title, 10)}"><span class="ix">§${parseInt(s.title, 10)}.</span>${esc(s.title.replace(/^[0-9]+\.\s*/, ''))}</a></li>`).join('\n')}
  </ol>
  <h2 class="how">Behaviour &amp; detail</h2>
  <ol>
${numbered.filter(s => parseInt(s.title, 10) > 2)
    .map(s => `    <li><a href="#s${parseInt(s.title, 10)}"><span class="ix">§${parseInt(s.title, 10)}.</span>${esc(s.title.replace(/^[0-9]+\.\s*/, ''))}</a></li>`).join('\n')}
  </ol>
  <h2 class="close">Closeout</h2>
  <ol>
${closeout.map(s => `    <li><a href="#${slug(s.title)}"><span class="ix">—</span>${esc(s.title.replace(/\s*\*\(.*/, ''))}</a></li>`).join('\n')}
  </ol>
</nav>`;

const docHeader = `
<header class="doc">
  <div class="eyebrow">Wiom · Product Requirements Document · PM deliverable</div>
  <h1>${esc(mdTitle)}</h1>
  <p class="lede">${inline(objective)}</p>
${block(mdHeaderTable)}
</header>

<aside class="quickcheck" id="quickcheck" aria-label="Quick check summary">
  <h2>Quick Check</h2>
  <p><strong>${esc(mdStatus)}</strong> — ${acCount} acceptance criteria, of which <strong>${openCount} are OPEN</strong>;
  ${tCount} transitions; ${cCount} parameters.</p>
  <p>Every OPEN item turns on one conflict: the card is meant to stay in the feed until the CSP
  acknowledges it, but the platform already moves a resolved card to the archive on age alone at
  C-01 (7 days) and drops it at C-02 (30 days). Settle that and the document closes.</p>
  <p>Sizing, method and the queries behind every number:
  <a href="../">the closure-sync study</a>. Decisions and what was rejected:
  <a href="../Kapture_Closure_Sync_Tradeoffs.md">the tradeoffs register</a>.</p>
</aside>`;

let out = `</head>\n<body>\n<div class="layout">\n${toc}\n\n<main>\n${docHeader}\n`;

out += `<div class="part-divider what">\n  <div class="label">Requirements</div>\n  <h2>WHAT &amp; WHY — the decisions</h2>\n</div>\n`;

numbered.forEach(s => {
  const n = parseInt(s.title, 10);
  if (n === 3) {
    out += `<div class="part-divider how">\n  <div class="label">Behaviour &amp; detail</div>\n  <h2>HOW — behaviour, screens, criteria</h2>\n</div>\n`;
  }
  const label = s.title.replace(/^[0-9]+\.\s*/, '');
  out += `\n<section class="spec" id="s${n}">\n  <h2><span class="num">§${n}.</span> ${esc(label)} <span class="tier ${tierOf(n)}">${tierOf(n) === 'what' ? 'WHAT' : 'HOW'}</span></h2>\n${block(s.body)}\n  <hr class="sect-end">\n</section>\n`;
});

out += `<div class="part-divider">\n  <div class="label">Closeout</div>\n  <h2>REVIEW — what the PM still owes</h2>\n</div>\n`;

closeout.forEach(s => {
  const clean = s.title.replace(/\s*\*\(.*/, '');
  out += `\n<section class="spec" id="${slug(s.title)}" style="margin-top:40px;">\n  <h2>${esc(clean)}</h2>\n${block(s.body)}\n  <hr class="sect-end">\n</section>\n`;
});

out += `
<p style="margin-top:30px;font-size:12px;color:var(--muted);text-align:center;">
  Rendered from ${MD} — the markdown is the source of truth
</p>

</main>
</div>

<script>
  mermaid.initialize({ startOnLoad: true, theme: 'default', flowchart: { curve: 'basis' } });
</script>
</body>
</html>
`;

fs.mkdirSync('prd', { recursive: true });
fs.writeFileSync('prd/index.html', head + out);
console.log('wrote prd/index.html', fs.statSync('prd/index.html').size, 'bytes');
console.log('sections:', numbered.map(s => s.title.split('.')[0]).join(','), '| closeout:', closeout.length);
console.log('ACs:', acCount, '| OPEN:', openCount, '| T:', tCount, '| C:', cCount);
