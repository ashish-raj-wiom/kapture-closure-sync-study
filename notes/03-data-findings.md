# 03 — Findings

Continues the numbering in `srs-tas-restore-study/notes/03-findings.md`. 🔴 = silently wrong in
production data or a CSP-facing flow; 🟠 = misleading; 🟡 = worth knowing.

---

## 🔴 F-19 — closure actor is unrecoverable before mid-July 2026

`queries/actor-id-availability.sql`

`TICKET_LOGS.DATA:updated_by` on `TICKET_RESOLVED`, by month, distinct tickets:

| Month | `137439087976` | `1234567890` | real account id |
|---|---|---|---|
| Apr 2026 | 0 | 0 | 45,091 |
| May 2026 | 0 | 0 | 41,370 |
| Jun 2026 | 0 | 0 | 24,876 |
| Jul 2026 | 5,625 | 13,590 | 0 |
| Aug 2026 | 16,316 | 43,092 | 0 |
| Sep 2026 (1–10) | 4,517 | 14,553 | 0 |

The two sentinel ids appear **only from July 2026** — the .NET → Java rewrite of ticket-service
replaced real account ids with hardcoded constants on both resolve paths. Before July, every
closure carries a real account id and the CC-agent path is indistinguishable from the CSP path.

**Consequence:** any month-over-month series of this problem that starts before July 2026 shows a
jump from 0% that is **pure instrumentation**, not behaviour. The first trustworthy month is
August. `queries/trend.sql` deliberately keeps the pre-July rows so the artifact stays visible.

**Also worth fixing on its own merits:** stamping `1234567890` as a user id discards *which* CSP
or SRS actor closed the ticket. The information exists at the call site (`csp_id` is a required
field on `ResolveTicketRequest`, `TicketController.java:1565`) and is thrown away into a comment
string rather than persisted.

---

## 🔴 F-20 — the ticket CSAT and ticket-comment pipelines have been dead since 7 Jul 2026

`DYNAMODB_READ.RATING` — last row `2026-07-07T12:27:49`. 539,246 historical `ticket` ratings,
mean 4.546, 530,266 distinct tickets. `DYNAMODB.TICKET_COMMENTS` — last row
`2026-07-07T18:22:02`, 13,994,169 rows. Both stop on the same day; `DYNAMODB_READ.TICKETS` is
unaffected and current, so this is a per-table connector failure, not a whole-source outage.

**Consequence:** customer satisfaction on a service ticket is not measurable for any period after
7 Jul 2026. Combined with F-19 — actor known only from mid-July, rating known only until 7 July —
**the two windows do not overlap**, so no cohort exists in which "does a Kapture-first closure
hurt CSAT?" can be answered at all. 0 of 42,626 cohort tickets carry a rating.

This is larger than this study: any Quality or CX question resting on ticket CSAT, and any
analysis of agent/partner ticket comments, is currently unanswerable.

---

## 🟠 F-21 — `SERVICE_TICKET_MODEL`'s resolver-identity block is broken

Cohort 11 Aug – 10 Sep, 63,118 partner-assigned Internet Issues tickets:

| Column | Reality |
|---|---|
| `CLOSED_BY` | NULL on **63,118 / 63,118** |
| `FIRST_RESOLVED_ROLE` | the literal string `'rohit'` on 63,076 rows; NULL on 42 |
| `FINAL_RESOLVED_ROLE` | identical — `'rohit'` on 63,076 |
| `FIRST_RESOLVED_USER_ID` | 0 distinct values |
| `FIRST_RESOLVED_BY_ACCOUNT_ID` | equals `CURRENT_PARTNER_ACCOUNT_ID` on 14,589 of 14,593 |
| `FIRST_RESOLVED_NAME` | the partner's business name, never a person |
| `RATING_SCORE_BY_CUSTOMER` | populated on 0 rows |
| `NO_TIMES_CUSTOMER_CALLED` / `NO_TIMES_PARTNER_CALLED` | NULL |
| `TIMES_REOPENED` | mean 7–14 per ticket — implausible per-ticket; looks connection-scoped |

`'rohit'` in a `_ROLE` column is a developer's name left in a mapping. The net effect is that T1
**attributes every closure to the assigned partner**, which is precisely the attribution this
study needed and the reason it had to be rebuilt from `TICKET_LOGS`.

`TICKET_SOURCE` is the one column in this block that does work — 16,225 / 63,118 (25.7%) are
`CUSTOMER_CHAT`. Note this is the chat tag from F-17 surfacing on the Kapture side, where SRS
cannot see it. **T1 can distinguish chat-origin tickets; SRS cannot.**

---

## 🔴 F-22 — 1,774 complaints a month never close, and nothing downstream notices

`queries/zombie-complaints.sql` · `queries/tas-card-state.sql`

Class B (Kapture closed, CSP never marked), 1,857 tickets with an SLA:

- SRS `STATUS = 'CLOSED'`: **83 (4.5%)**. Still open: **1,774 (95.5%)**
- Mean age of the still-open complaints: **506 hours (21 days)** and counting
- `SIGNAL_EMITTED`: true on **87** → **1,770 emit no `COMPLAINT_RESOLUTION_SIGNAL` at all**
- `BREACH_EMITTED_AT` set on **1,373** → the breach fact was generated and, per F-03, has no
  registered producer or consumer, so it went nowhere

And the CSP card is still live:

| TAS state | Count | `is_csp_actionable` |
|---|---|---|
| `PENDING_ACCEPTANCE` | **1,628** | true |
| `ASSIGNED_TECHNICIAN` | 111 | true |
| `ACCEPTED` | 21 | true |
| `COMPLETED` | 83 | false |
| `CANCELLED` | 4 | false |

**1,760 live, actionable cards per month for work that is already closed in Kapture**, 1,628 of
them never even accepted. This is the roadmap's "travels to a job that no longer exists," and it
is the largest concrete harm in the study.

Corroborates F-03 from the other direction: `STILL_OPEN_AT_48H` is FALSE on **all** 40,000+
`COMPLAINT_RESOLUTION_LEDGER` rows in the cohort, including 1,774 complaints open for three
weeks. The M3 long-open metric is not merely unregistered — it is reading false on the exact
population it exists to catch.

---

## 🟡 F-23 — `EXCLUDED_FROM_SCORING` is effectively unused, so nothing shields a CSP

`COMPLAINT_RESOLUTION_LEDGER.EXCLUDED_FROM_SCORING` is TRUE on **3 of 42,401** cohort rows
(sole reason seen: `PARTNER_CATEGORY_TICKET_TYPE`). Of the 395 class-C sync-loss tickets — where
Kapture recorded a closure inside the TAT and the CSP's mark landed outside it — **393 are scored
`RESOLVED_WITHIN_TAT = FALSE` and 0 are excluded**.

The mechanism to withhold a breach from scoring exists and is wired; it is simply never invoked.
Whatever fix lands for the sync gap, there is no retro-remediation path for CSPs already scored
this way unless this flag starts being used.

---

## 🟡 F-24 — a Kapture-agent closure is a *better* resolution signal than the CSP's own

`queries/reopen-and-rating.sql` — reopen rate by closure class:

| Class | Tickets | Reopened | Rate |
|---|---|---|---|
| A CSP closed | 36,034 | 4,536 | **12.59%** |
| C Kapture first, CSP later | 3,467 | 334 | **9.63%** |
| B Kapture only | 2,059 | 52 | **2.53%** |
| D CSP first, agent later | 1,050 | 654 | 62.29% (reopen cycles by construction) |

Tickets the CC agent closed reopen **less** than tickets the CSP closed. The agent closes after
confirming with the customer; the CSP closes on their own assertion, which F-01 shows no
validation can block.

**Implication for the fix:** propagating a Kapture closure into SRS is not a convenience that
trades accuracy for speed. On the only outcome measure available — does the customer come back —
it is propagating the **more reliable** of the two signals. It also gives the roadmap's item 03
("CSP said resolved vs actually resolved") a ready-made control group.
