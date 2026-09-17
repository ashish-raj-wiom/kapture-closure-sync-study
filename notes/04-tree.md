# 04 — The whole thing as one tree

Every node below comes from **one query** — `queries/tree-all-nodes.sql` — so the leaves sum
exactly to the cohort. Earlier notes quoted numbers from queries with slightly different joins;
where they disagree by ±1 ticket, **this file wins**.

Cohort: 42,626 partner-assigned Internet Issues tickets, created 11 Aug – 10 Sep 2026 IST.

## Tree 1 — who closed it, and did it cost the CSP anything

```
42,626  tickets in scope
│
├─ 37,085  (87.0%)   CSP CLOSED FIRST — syncs to Kapture in ~1 second. Working as designed.
│   ├─ 36,035          CSP closed it, no agent involvement
│   └─  1,050          CSP closed it, agent closure later (reopen cycles)
│
├─  5,526  (13.0%)   KAPTURE CLOSED FIRST  ←  the problem
│   │
│   ├─  3,467          C · the CSP did mark it, but later
│   │   │                  median 15.2 h later · P90 97.7 h (4.1 days)
│   │   ├─     3          no SLA stamped — not adjudicable
│   │   ├─ 2,145          agent closed it AFTER the TAT had already passed
│   │   │                  → the CSP was late anyway. NOT caused by the sync gap.
│   │   └─ 1,319          agent closed it INSIDE the TAT
│   │       ├─   924        CSP also marked inside the TAT → no harm done
│   │       └─   395        CSP marked LATE  ★ UNFAIR BREACH  (393 scored as breached)
│   │
│   └─  2,059          B · the CSP never marked it at all
│       ├─   202          never reached SRS — no CSP card ever existed (separate gap, A-01)
│       ├─     4          no SLA stamped
│       ├─ 1,713          agent closed it AFTER the TAT → already breached
│       └─   140          agent closed it INSIDE the TAT  ★ UNFAIR  (17 scored so far)
│
└─     15            no resolution event at all
```

**Read the two ★ leaves together: 535 tickets/month where the issue was fixed and confirmed
inside the deadline and the CSP is on the hook anyway. 410 of those are already scored as
breached in `COMPLAINT_RESOLUTION_LEDGER`, none excluded.**

**And read the two 'AFTER the TAT' branches together: 3,858 tickets — 70% of the whole
Kapture-first population — were already late when the agent closed them.** Fixing the sync does
not save these. This is the single most important line in the study, because it is what separates
12.96% (the size of the gap) from 1.26% (the size of the injustice).

## Tree 2 — what the gap leaves behind

Same 5,526 Kapture-first tickets, cut by consequence instead of by blame.

```
5,526  tickets closed in Kapture before the CSP
│
├─ where the SRS complaint ended up
│   ├─ 3,521          eventually CLOSED — nearly all because the CSP marked it late
│   ├─ 1,803          STILL OPEN  ←  mean age 506 h (21 days), clock running
│   │   └─ 1,774        of these are class B: nobody is ever going to close them
│   └─   202          never existed
│
├─ what the CSP did after the job was already finished
│   ├─ 3,010          accepted a card for work that was already closed
│   ├─ 1,078          dispatched a technician to an already-resolved fault   ← the money number
│   └─ 3,729          received a TAS nudge on a dead card
│
├─ what the card looks like right now (class B, 1,853 with a card)
│   ├─ 1,628          PENDING_ACCEPTANCE · is_csp_actionable = true
│   ├─   111          ASSIGNED_TECHNICIAN · actionable
│   ├─    21          ACCEPTED · actionable
│   └─    93          COMPLETED or CANCELLED
│       └─ 1,760 live actionable cards for work that no longer exists
│
└─ what Quality received
    ├─ 1,770          no COMPLAINT_RESOLUTION_SIGNAL emitted at all
    ├─ 1,373          SLA-breach facts emitted into a void (no producer/consumer — F-03)
    └─   410          TAT breaches scored against a CSP who was in fact on time
```

## Tree 3 — the CSP population

```
969  CSPs in the cohort
│
├─ 737  (76%)  hit the gap at least once
│   ├─ 216       carry ≥1 unfairly-scored breach
│   │   ├─ 137     exactly 1
│   │   ├─  43     exactly 2
│   │   ├─  25     3 or 4
│   │   └─  11     5 or more
│   └─ 521       hit the gap but were never unfairly scored for it
│
└─ 232  never hit it

536  CSPs with ≥20 adjudicated tickets — how much fixing this moves their score
├─ 509       move less than 5 pp   (median CSP moves 0.00 pp)
├─  24       move 5–10 pp
└─   3       move 10 pp or more    (max 18.2 pp)

562  CSPs with ≥20 tickets — how much of their closing the CC agent is doing
├─ 495       under 25% agent-closed  (median CSP: 4.8%)
├─  31       25–50%
└─  36       over 50% — and ~100% for the worst of them
    └─ these CSPs never close in the app at all. Separate problem; the sync fix
       does not rescue them (worst case: 2.5% → 13.8% within-TAT, still failing).
```
