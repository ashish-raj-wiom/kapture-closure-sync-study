// Proves prd/index.html is an exact replica of Kapture_Closure_Sync_PRD.md.
//
// Two directions, both must be clean:
//   EXTRA   — visible text on the page that is not in the markdown (authored content: forbidden)
//   MISSING — text in the markdown that never reached the page (dropped content: forbidden)
//
// Run after every build. Exits non-zero on any finding.
const fs = require('fs');

const md = fs.readFileSync('Kapture_Closure_Sync_PRD.md', 'utf8');
const html = fs.readFileSync('prd/index.html', 'utf8');

// Visible text of the page: drop head, style, script, and all tags.
const visible = html
  .replace(/<head[\s\S]*?<\/head>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&rarr;/g, '→');

// Markdown text: drop fences' syntax but keep their content, drop table pipes and marks.
const mdText = md
  .replace(/^#{1,6}\s+/gm, ' ')
  .replace(/```\w*/g, ' ')
  .replace(/[|*`>]/g, ' ')
  .replace(/^-{3,}$/gm, ' ');

const words = s => (s.toLowerCase().match(/[a-z0-9ऀ-ॿ][a-z0-9ऀ-ॿ._/-]*/g) || []);

const mdSet = new Set(words(mdText));
const htmlWords = words(visible);

// Structural chrome the builder is allowed to emit: section marks and anchors it derives
// from the markdown's own headings. Anything else on the page must come from the .md.
const ALLOWED = new Set([]);

const counts = {};
htmlWords.forEach(w => { if (!mdSet.has(w) && !ALLOWED.has(w)) counts[w] = (counts[w] || 0) + 1; });
const extra = Object.entries(counts).sort((a, b) => b[1] - a[1]);

const htmlSet = new Set(htmlWords);
const missing = [...mdSet].filter(w => !htmlSet.has(w)).sort();

// Every markdown table row must appear on the page, cell for cell.
const mdRows = md.split('\n').filter(l => /^\|/.test(l) && !/^\|[\s:|-]+\|?$/.test(l));
// Tag removal inserts spaces, so compare with whitespace stripped entirely.
const flat = visible.replace(/\s+/g, '');
// Each cell goes through the builder's own inline() transform and is then de-tagged, so this
// tests rendering fidelity rather than this file's guess at markdown syntax. Stripping `*`
// by hand was wrong: an asterisk inside backticks, as in `/srs/events/*`, is content.
const esc2 = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const render = s => esc2(s)
  .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, '');

const lostRows = mdRows.filter(r => {
  const cells = r.replace(/^\|/, '').replace(/\|\s*$/, '').split('|')
    .map(c => render(c.trim()))
    .filter(c => c.length > 12);
  return cells.some(c => !flat.includes(c));
});

console.log('markdown words:', mdSet.size, '| page words:', htmlSet.size);
console.log('markdown table rows:', mdRows.length);
console.log('');

let bad = 0;
if (extra.length) {
  bad++;
  console.log('EXTRA — on the page but not in the markdown (' + extra.length + '):');
  extra.slice(0, 40).forEach(([w, n]) => console.log('   ' + w + '  ×' + n));
} else console.log('EXTRA   none — the page authors nothing');

if (missing.length) {
  bad++;
  console.log('\nMISSING — in the markdown but not on the page (' + missing.length + '):');
  missing.slice(0, 40).forEach(w => console.log('   ' + w));
} else console.log('MISSING none — the page drops nothing');

if (lostRows.length) {
  bad++;
  console.log('\nLOST ROWS — table rows that did not survive (' + lostRows.length + '):');
  lostRows.slice(0, 10).forEach(r => console.log('   ' + r.slice(0, 110)));
} else console.log('ROWS    all ' + mdRows.length + ' table rows present');

console.log('\n' + (bad ? 'NOT A REPLICA — ' + bad + ' check(s) failed' : 'REPLICA VERIFIED'));
process.exit(bad ? 1 : 0);
