# 04 — The whole thing as trees

Every node comes from **one query** — `queries/tree-all-nodes.sql` — so the leaves of each tree
sum to its own 100%. Earlier notes quoted numbers from queries with slightly different joins;
where they disagree by ±1 ticket, **this file wins**.

**Convention: every tree starts at 100% and every node is a percentage of its tree's base, with
the absolute count in brackets.** The percentages are the point; the counts are there to be
checked.

Cohort: 42,626 partner-assigned Internet Issues tickets, created 11 Aug – 10 Sep 2026 IST.

---

## Tree 1 — who closed it first, was it inside TAT, and what did the CSP do

Base = the **42,611** tickets that were resolved at all (42,626 cohort − 15 with no resolution
event).

```
100%     (42,611)   RESOLVED
│
├─ 87.03%  (37,085)   CSP FIRST
│                       the CSP closed it; it reached Kapture in ~1 second. Working as designed.
│
├─ 12.97%   (5,526)   KAPTURE FIRST  ←  the problem
│   │
│   ├─  3.42%  (1,459)   agent closed it WITHIN the TAT
│   │   │                  the issue was fixed and confirmed before the deadline
│   │   ├─  3.10%  (1,319)   CSP did resolve it, later
│   │   │   ├─  2.17%   (924)    …within the TAT     → no harm done
│   │   │   └─  0.93%   (395)    …outside the TAT    ★ UNFAIR BREACH   (393 scored)
│   │   └─  0.33%    (140)   CSP never resolved it   ★ UNFAIR          (17 scored so far)
│   │
│   ├─  9.05%  (3,858)   agent closed it OUTSIDE the TAT
│   │   │                  already breached before the agent touched it — the sync gap did
│   │   │                  not cause these, the CSP was late regardless
│   │   ├─  5.03%  (2,145)   CSP did resolve it, later (necessarily outside TAT too)
│   │   └─  4.02%  (1,713)   CSP never resolved it
│   │
│   └─  0.49%    (209)   no TAT to judge against
│       ├─  0.47%    (202)   never reached SRS — no CSP card ever existed (separate gap)
│       └─  0.02%      (7)   reached SRS but no SLA was stamped
│
└─ (15 tickets had no resolution event at all; excluded from the base)
```

**The two ★ leaves are the whole injustice: 1.26% (535) of everything resolved.** 410 of them are
already scored as breached in `COMPLAINT_RESOLUTION_LEDGER`, none excluded from scoring.

### What "the uptick" actually is — three numbers that all look like 1.2%

These get conflated. They are not the same thing:

| | Count | Base | Value |
|---|---|---|---|
| Tickets **wrongly treated** | 535 | 42,611 resolved | **1.26%** |
| Of those, **actually scored** as a breach | 410 | 42,611 resolved | **0.96%** |
| **Uptick in the within-TAT metric** | — | 40,586 *adjudicated* | **+1.01 pp** (76.09% → 77.10%) |

The metric uptick is not 1.26% for two reasons: only 410 of the 535 carry a ledger verdict at all
(the other 125 sit unadjudicated — neither passed nor failed), and the within-TAT denominator is
the 40,586 adjudicated tickets, not all 42,611 resolved.

Use **+1.01 pp** when talking about the Quality metric. Use **1.26%** when making the fairness
argument, because it counts the 125 the scoring never reached. Never quote either as the benefit
of the fix — it is the whole Quality benefit and excludes the 1,078 technician dispatches, the
1,760 live dead cards and the 1,774 never-closing complaints, none of which appear in a TAT
number.

**The 9.05% branch is what kills the naive business case.** 3,858 tickets — **70% of the entire
Kapture-first population** — were already past their deadline when the agent closed them.
Propagating the closure would not have saved one of them. This is what separates the *size of the
gap* (12.97%) from the *size of the injustice* (1.26%).

Note the asymmetry between the two TAT branches. Under "agent WITHIN TAT" the CSP's mark can land
either side of the line, so it splits. Under "agent OUTSIDE TAT" it cannot — the CSP always marks
after the agent, so all 2,145 are outside the TAT by construction.

---

## Tree 2 — what the gap leaves behind

Base = the **5,526** Kapture-first tickets. The three groups are different views of the same
tickets; only the first is a partition.

```
100%      (5,526)   TICKETS CLOSED IN KAPTURE BEFORE THE CSP
│
├─ where the SRS complaint ended up   (partition — sums to 100%)
│   ├─ 63.72%  (3,521)   eventually CLOSED — nearly all because the CSP marked it late
│   ├─ 32.63%  (1,803)   STILL OPEN ← mean age 506 h (21 days), clock running
│   │   └─ 32.10%  (1,774)   of these, nobody is ever going to close them
│   └─  3.66%    (202)   never existed
│
├─ what the CSP did after the job was already finished
│   ├─ 67.48%  (3,729)   received a TAS nudge on a dead card
│   ├─ 54.47%  (3,010)   accepted a card for work already closed
│   └─ 19.51%  (1,078)   dispatched a technician to an already-resolved fault ← the money number
│
└─ what Quality received
    ├─ 32.03%  (1,770)   no COMPLAINT_RESOLUTION_SIGNAL emitted at all
    ├─ 24.85%  (1,373)   SLA-breach facts emitted into a void (no producer/consumer — F-03)
    └─  7.42%    (410)   TAT breaches scored against a CSP who was in fact on time
```

Base = the **1,853** cards on the "CSP never marked it" branch that have a TAS candidate:

```
100%      (1,853)   CARDS ON THE "CSP NEVER MARKED IT" BRANCH
├─ 87.86%  (1,628)   PENDING_ACCEPTANCE · is_csp_actionable = true
├─  5.99%    (111)   ASSIGNED_TECHNICIAN · actionable
├─  1.13%     (21)   ACCEPTED · actionable
└─  5.02%     (93)   COMPLETED or CANCELLED

   → 94.98% (1,760) are LIVE AND ACTIONABLE for work that no longer exists
```

---

## Tree 3 — the CSP population

Base = the **969** CSPs in the cohort.

```
100%       (969)   CSPs IN THE COHORT
│
├─ 76.06%   (737)   hit the gap at least once
│   ├─ 22.29%  (216)   carry ≥1 unfairly-scored breach
│   │   ├─ 14.14%  (137)   exactly 1
│   │   ├─  4.44%   (43)   exactly 2
│   │   ├─  2.58%   (25)   3 or 4
│   │   └─  1.14%   (11)   5 or more
│   └─ 53.77%  (521)   hit the gap but were never unfairly scored for it
│
└─ 23.94%   (232)   never hit it
```

Base = the **536** CSPs with ≥20 adjudicated tickets — how much fixing this moves their score:

```
100%       (536)   CSPs WITH ≥20 ADJUDICATED TICKETS
├─ 94.96%   (509)   move less than 5 pp     ← the median CSP moves 0.00 pp
├─  4.48%    (24)   move 5–10 pp
└─  0.56%     (3)   move 10 pp or more      (max 18.2 pp)
```

Base = the **562** CSPs with ≥20 tickets — how much of their closing the CC agent is doing:

```
100%       (562)   CSPs WITH ≥20 TICKETS
├─ 88.08%   (495)   under 25% agent-closed  ← the median CSP sits at 4.8%
├─  5.52%    (31)   25–50%
└─  6.41%    (36)   over 50% — and ~100% for the worst of them
                      these CSPs never close in the app at all. Separate problem; the sync
                      fix does not rescue them (2.5% → 13.8% within-TAT, still failing).
```
