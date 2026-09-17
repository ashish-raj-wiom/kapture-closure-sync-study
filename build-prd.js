// Renders Kapture_Closure_Sync_PRD.md into the house spec HTML skeleton.
// CSS reused verbatim from call-logs-prd via site/_head.html.
//
// CONTRACT: the page is an exact replica of the markdown.
// Nothing is authored here. Every visible string is either lifted from the .md or is
// navigation derived from its own headings (sidebar links, section anchors). If a claim
// should appear on the page, it goes in the markdown first and arrives here by rebuild.
// Verify with: node verify-replica.js
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
        // Presentation only — derived from the row's own Status cell, adds no text.
        const open = /^OPEN$/.test((r[r.length - 1] || '').trim()) ? ' class="open-row"' : '';
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
const mdVersion = (preamble.match(/\*\*Version\*\*\s*—\s*(v[0-9.]+)/) || [, ''])[1];

// Browser-tab title tracks the markdown's own title and version cell.
head = head.replace(/<title>[\s\S]*?<\/title>/,
  `<title>${esc(mdTitle.split('—')[0].trim())} — PRD ${mdVersion}</title>`);

const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tocItem = (href, ix, label) =>
  `    <li><a href="#${href}"><span class="ix">${ix}</span>${esc(label)}</a></li>`;

// Sidebar: links only. Every label is a heading lifted from the markdown.
const toc = `
<nav class="toc" aria-label="Table of contents">
  <ol>
${numbered.map(s => {
    const n = parseInt(s.title, 10);
    return tocItem(`s${n}`, `§${n}.`, s.title.replace(/^[0-9]+\.\s*/, ''));
  }).join('\n')}
${closeout.map(s => tocItem(slug(s.title), '—', s.title.replace(/\s*\*\(.*/, ''))).join('\n')}
  </ol>
</nav>`;

// Title and header table, both lifted from the markdown preamble.
const docHeader = `
<header class="doc">
  <h1>${esc(mdTitle)}</h1>
${block(mdHeaderTable)}
</header>`;

let out = `</head>\n<body>\n<div class="layout">\n${toc}\n\n<main>\n${docHeader}\n`;

numbered.forEach(s => {
  const n = parseInt(s.title, 10);
  const label = s.title.replace(/^[0-9]+\.\s*/, '');
  out += `\n<section class="spec" id="s${n}">\n  <h2><span class="num">§${n}.</span> ${esc(label)}</h2>\n${block(s.body)}\n  <hr class="sect-end">\n</section>\n`;
});

closeout.forEach(s => {
  const clean = s.title.replace(/\s*\*\(.*/, '');
  out += `\n<section class="spec" id="${slug(s.title)}">\n  <h2>${esc(clean)}</h2>\n${block(s.body)}\n  <hr class="sect-end">\n</section>\n`;
});

out += `
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
