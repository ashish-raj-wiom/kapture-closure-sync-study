# The PRD page is a replica, not a document

`prd/index.html` is generated from `Kapture_Closure_Sync_PRD.md`. **Never edit the HTML.**
Change the markdown, rebuild, and the page follows.

```bash
node build-prd.js && node verify-replica.js
```

`build-prd.js` authors nothing. Every visible string on the page is either lifted from the
markdown or is navigation derived from its own headings — sidebar links and section anchors.
The browser-tab title tracks the markdown's own title and version cell.

`verify-replica.js` proves it, in three directions, and exits non-zero on any finding:

| Check | Fails when |
|---|---|
| **EXTRA** | a word appears on the page that is not in the markdown — authored content |
| **MISSING** | a word in the markdown never reached the page — dropped content |
| **ROWS** | a table row did not survive, cell for cell |

Current state: 995 markdown words, 995 page words, 112 of 112 table rows present.

Two mistakes this setup already caught, both worth remembering:

- A hand-written "Quick Check" block on the page made product claims that existed nowhere in
  the PRD. That is exactly the drift the rule exists to stop, and it is why the builder now
  authors nothing at all.
- The verifier's own normalisation stripped `*` from markdown cells, which broke
  `` `/srs/events/*` `` — an asterisk inside backticks is content. The row check now runs each
  cell through the builder's own transform instead of guessing at syntax.
