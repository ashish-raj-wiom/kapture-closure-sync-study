# 01 — Verdict: is this worth solving for?

**Cohort:** 42,626 Kapture tickets — `LAST_TITLE ILIKE 'Internet Issues%'`, `IS_PARTNERASSIGNED = 1`,
created 11 Aug – 10 Sep 2026 IST. 42,424 (99.5%) produced an SRS complaint. 969 CSPs.

---

## Answer

**Yes — but not for the reason the study was commissioned.**

The gap is real, it is large, and it is growing fast: **12.96% of tickets (5,526/month) are closed
in Kapture before the CSP closes them**, and on matched windows that share went **9.43%
(1–10 Aug) → 14.24% (1–10 Sep)** — roughly +50% in a month.

But the **Quality/TAT penalty is small and should not be the business case.** Removing every
unfair breach moves the platform within-TAT rate **76.09% → 77.10% (+1.01 pp)** and moves the
**median affected CSP by 0.00 pp**. Only 216 of 969 CSPs suffer a single unfairly-scored breach
in a month; only 3 CSPs see their rate move ≥10 pp.

**The case to build on is operational waste.** Per month, after the ticket was already closed
in Kapture:

| Wasted action | Count/month | Source |
|---|---|---|
| CSP accepted a card for already-closed work | **3,010** | `queries/waste.sql` |
| **Technician dispatched to an already-resolved fault** | **1,078** | `queries/waste.sql` |
| TAS nudge/attention fired on a dead card | **3,729** | `queries/waste.sql` |
| Live, `is_csp_actionable = true` cards for closed work | **1,760** | `queries/tas-card-state.sql` |
| SRS complaints that never close at all ("zombies") | **1,774** | `queries/zombie-complaints.sql` |
| Quality resolution signals never emitted | **1,770** | `queries/zombie-complaints.sql` |
| TAT breaches recorded against a CSP whose ticket was closed in time | **410** | `queries/ledger.sql` |

The 1,078 technician dispatches and the 1,774 zombie complaints are the two numbers to lead with.

---

## The four questions

### Q1 — Kapture-first vs CSP-first?

The CSP→Kapture direction works and is effectively instant: **median propagation +0.02 min
(~1 second)**, P95 +0.03 min. So the direction of a closure is unambiguous in the data.

| Class | Tickets | % | CSPs | Within TAT |
|---|---|---|---|---|
| **A** CSP closed, no agent closure | 36,034 | 84.5% | 883 | 81.1% |
| **B** Kapture closed, **CSP never marked** | 2,059 | 4.8% | 254 | — (96% unadjudicated) |
| **C** Kapture closed **first**, CSP marked later | 3,467 | 8.1% | 640 | **26.9%** |
| **D** CSP closed first, agent closure after (reopen cycles) | 1,050 | 2.5% | 428 | 69.8% |
| **E** no resolution event | 16 | 0.04% | 15 | — |

**Kapture-first = B + C = 5,526 (12.96%).** CSP-first = A + D = 37,084 (87.0%).

**Trend (matched d01–10 windows, % of *resolved* tickets):** Aug 9.43% → Sep 14.24%.
⚠ Cannot be measured before ~mid-Jul 2026 — see F-19. The apparent "0% before July" in
`queries/trend.sql` is an instrumentation artifact, **not** evidence the behaviour is new.

### Q2 — Of Kapture-closed tickets, does the CSP mark them, and when?

- **62.7% (3,467/5,526)** are eventually marked by the CSP. **37.3% (2,059)** never are.
- Lag from Kapture closure → CSP mark: **median 15.2 h, P90 97.7 h (4.1 days)**.
- Before/after TAT, class C with a known SLA (3,464 tickets):
  - Kapture's own closure was **inside** TAT: 1,319 (38.1%)
  - The CSP's mark was inside TAT: 924 (26.7%)
  - **Pure sync loss** — Kapture inside TAT, CSP mark outside: **395**
- Adding class B's 140, total sync loss = **535 tickets/month (1.26% of cohort)**.
- When the CSP does mark late, they overshoot the SLA by a **median 25.1 h**.

**The load-bearing caveat:** **61.9% of class C tickets were already past TAT when the agent
closed them.** For those, the missing sync did not cause the breach — the CSP was late anyway.
Only the 535 are attributable to the gap.

### Q3 — How many CSPs are impacted?

| Measure | Value |
|---|---|
| CSPs with ≥1 Kapture-first ticket | **737 / 969 (76%)** |
| CSPs with ≥1 unfairly-scored breach | **216 / 969 (22%)** |
| …with ≥2 | 79 · …with ≥5 | 11 |
| Median within-TAT swing if fixed (CSPs with ≥20 adjudicated tickets, n=536) | **0.00 pp** |
| P90 swing · max swing | 3.45 pp · 18.2 pp |
| CSPs moving ≥5 pp · ≥10 pp | 27 · 3 |

Verified against the actual scoring input, `COMPLAINT_RESOLUTION_LEDGER`: of the 395 class-C
sync-loss tickets, **393 are recorded `RESOLVED_WITHIN_TAT = FALSE` and 0 are
`EXCLUDED_FROM_SCORING`**. The penalty is real — it is just rare.

**A bigger finding sitting next to this one:** **36 CSPs (of 562 with ≥20 tickets) have ~100% of
their tickets closed by the CC agent** — they never close in the app at all. 67 CSPs are above
25%. The median CSP is at 4.8%. For these CSPs the sync fix is not a rescue: `a0b7a3` (203
tickets) goes from 2.5% → 13.8% within-TAT and is still failing. **That is an app-adoption
problem wearing this problem's clothes, and it needs its own investigation.**

### Q4 — What is the uptick?

**CSP CSAT cannot be estimated today, and that is a finding, not a hedge.** The customer-rating
pipeline (`DYNAMODB_READ.RATING`, 539k historical `ticket` ratings, avg 4.55) **died on
7 Jul 2026**, and the actor id needed to classify a closure only exists **from mid-Jul 2026**.
The windows do not overlap — **0 of 42,626 cohort tickets carry a rating**. Repairing that
connector is a prerequisite for any CSAT claim (F-20).

What is measurable, per month: the waste table above.

**One piece of counter-evidence that strengthens the case:** Kapture-first tickets reopen
**less**, not more — 9.63% (class C) and 2.53% (class B) versus **12.59%** for CSP-closed tickets.
A closure the agent made after confirming with the customer holds better than the CSP's
self-report. So propagating it is not just convenient, it is propagating the *better* signal.

---

## Recommendation

Build it — as the Kapture→SRS closure webhook that F-18 says is missing. Justify it on the
1,078 wasted technician dispatches and 1,774 zombie complaints per month, on a share that is
growing ~50% month-on-month, and on the 1,770 missing Quality signals. Mention the 410 unfair
breaches as a fairness sweetener, **not** as the headline — it is 1 pp.

Two things to spin out rather than fold in:
1. **The 36 never-close-in-app CSPs** — separate diagnosis.
2. **The dead `RATING` / `TICKET_COMMENTS` connectors** — blocks CSAT measurement platform-wide,
   not just here.

---

## Worked examples — the sync-loss population, spot-checked

`queries/spot-check-sync-loss.sql`. Five consecutive sync-loss tickets from 12 Aug 2026. All
times IST.

| Ticket | CSP | Created | TAT deadline | Agent closed in Kapture | CSP marked | Lag | Scored |
|---|---|---|---|---|---|---|---|
| 1786508079949000 | a0b6v6 | 09:17 | 15:00 | **09:20** (3 min after creation) | 16:59 | 7.7 h | breached |
| 1786510713537000 | a0b6p4 | 10:02 | 15:00 | 14:42 | 15:12 | 0.5 h | breached |
| 1786514943031000 | a0b7d5 | 11:37 | 15:37 | **11:38** (1 min after creation) | 15:52 | 4.2 h | breached |
| 1786531289988000 | a0b9e7 | 15:51 | 19:51 | 16:05 | 13 Aug 14:05 | 22.0 h | breached |
| 1786535043353000 | a0b7i8 | 16:59 | 20:59 | 17:24 | 13 Aug 19:17 | 25.9 h | breached |

All five: SRS `STATUS = CLOSED`, `WITHIN_TAT = 0`, ledger `RESOLVED_WITHIN_TAT = false`,
`EXCLUDED_FROM_SCORING = false`.

Row 1 and row 3 are the cases to put in front of anyone who doubts the problem exists: the
customer's issue was confirmed fixed **within three minutes and one minute** of the ticket being
raised, and the CSP is recorded as having breached a four-hour deadline. Row 2 is the near-miss —
the agent closed 18 minutes before the deadline, the CSP marked 12 minutes after it.

Note what these five also show, and why the headline is 535 and not 5,526: the agent's closure is
very often *immediate* (the customer called back to say it was already fine). That is a closure
the CSP legitimately earned and lost on a technicality. It is not the same as the 61.9% of cases
where the agent closed a ticket that had already been late for hours.
