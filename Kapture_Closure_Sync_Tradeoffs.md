# Kapture Closure Sync — tradeoffs register

Decisions taken during the 17 Sep 2026 interview, with what was rejected and why. This is the
PM's record, not part of the PRD. When someone asks "why does it fire on every closure?", this
answers it without archaeology.

| # | Decision point | Chosen | Rejected options | Why (PM's stated reason) | Date |
|---|---|---|---|---|---|
| 1 | What fires the feature | **Every Kapture-side closure of a partner-assigned Internet Issues ticket** — 5,526/month. App copy kept exactly as designed. | (a) Only closures meaning "customer says internet is working" — 138/month, 2.5%, matches the copy but leaves 97.5% of the gap unfixed and needs free-text parsing. (b) Every closure with copy varying by reason — needs a closure-reason field Kapture does not have (`RESOLUTION_TYPE` NULL on 100%). | Full coverage of the gap chosen over per-case copy accuracy, after being shown that 59% of closures are "ping is up, customer not called" and only 2.5% are a customer actually saying it works. Recorded as an Override in the PRD. | 17 Sep 2026 |
| 2 | What happens to the complaint | **Complaint and restore execution candidate both resolve at the agent's closure**, exactly as a CSP's own resolve would. The card stays visible; only ठीक है archives it. | (a) Clock stops but complaint stays open until the CSP confirms — leaves ~1,774 complaints/month open forever. (b) Auto-close after a window. (c) Close immediately with no acknowledgement step at all. | PM revised the design mid-interview to this shape. It closes the complaint (killing the zombies) while keeping the CSP's acknowledgement as a deliberate, separate step. | 17 Sep 2026 |
| 3 | Quality attribution | **Agent's closure time is the resolution timestamp; the complaint stays on the CSP's scorecard.** | (a) Agent's time but the whole complaint attributed to Wiom. (b) Exclude these complaints from scoring entirely. | The CSP should be judged on when the fault was actually fixed. This is what converts the 410 wrongly-recorded breaches to on-time. | 17 Sep 2026 |
| 3b | Who is recorded as having resolved it | **The CC agent, carrying that agent's own Kapture employee id.** Distinct from decision 3: the agent performed the resolution, the CSP still owns the TAT outcome. | (a) Record the CSP, as a CSP-initiated resolve does. (b) Record the shared system identity, as the ticket relay does today. | "We should be knowing that this ticket was resolved by CC agent instead of the CSP. Very important." The id already arrives as `ticketCloseEmpId` and is discarded, so this costs a field, not an integration. Answered 18 Sep: Quality still counts it and does not differentiate on who resolved it. It could not do otherwise — `ComplaintResolutionSignalEvent` carries no actor field at all, so the agent is recorded on the TAS candidate only. | 18 Sep 2026 |
| 4 | If the CSP never taps ठीक है | **The card stays until tapped.** | (a) Auto-archive after a window. (b) Auto-archive at end of day. | Acknowledgement is the CSP's to give. ⚠️ **Unresolved conflict:** the platform's existing windows (7-day inline feed, 30-day retention) mean a card cannot in fact stay indefinitely. Open as AC-R4-4, T6 and AC-BV-1…3. | 17 Sep 2026 |
| 5 | Feed ordering | **The card floats to the top.** | (a) Must never outrank a live fault — needs a TAS sort change. (b) A band beneath all live tickets. | Different from escalation: the trigger is the fault being fixed, not customer persistence, and the fastest action clears the card entirely. Checked deliberately against the principle that killed the Repeat Contact PRD. | 17 Sep 2026 |
| 6 | The deadline block on a resolved card | **Whatever the app does today on a resolved restore** — countdown suppressed, block reads "आपकी तरफ से काम पूरा हो गया" / "Your work is complete". | (a) Keep the countdown as the mock showed. (b) Design a new completed state. | "Look what happens today when the ticket is resolved, do the same." The behaviour already exists (`RestoreDrilldownContent.kt:298-307`, `ScheduleSection.kt:57`), so the mock's live countdown is a mock artifact, not a requirement. | 17 Sep 2026 |
| 7 | Telling the CSP outside the app | **Push notification on closure; the notification and a direct open land on the same screen carrying ठीक है.** | Not offered — PM supplied this directly. | — | 17 Sep 2026 |
| 8 | Simultaneous CSP resolve and Kapture closure | **First to arrive wins; the second is discarded.** | (a) The CSP's own resolve always wins — needs a hold-and-compare window. (b) The Kapture closure always wins. | Simplest, and it matches how TAS already dedupes on event id. Accepts that a CSP may briefly see a ठीक है card for work they just resolved themselves. | 17 Sep 2026 |
| 9 | Reopen within 48 h | **New complaint, fresh card, as today.** | (a) Revive the same card with its original deadline. (b) Say nothing and leave it undefined. | Consistent with how reopens work now; the restarting clock is roadmap item 02's problem, not this one's. | 17 Sep 2026 |
| 10 | Scope | **RESTORE only.** | (a) RESTORE and SHIFTING. (b) RESTORE now, SHIFTING later. | Shifting has its own SLA and emits no Quality signal by design, so the fairness half would not apply to it. | 17 Sep 2026 |
| 11 | Who may tap ठीक है | **The CSP who owns the card, or the technician assigned to it.** | (a) CSP only. (b) Anyone with the card open. | Matches the fact that an assigned technician can already mark a ticket resolved today. | 17 Sep 2026 |

## Measurements these decisions rest on

All from `kapture-closure-sync-study`, cohort 42,626 partner-assigned Internet Issues tickets
raised 11 Aug – 10 Sep 2026.

| Fact | Value | Source |
|---|---|---|
| Tickets closed in Kapture before the CSP | 5,526 — 12.97% of resolved | `queries/tree-all-nodes.sql` |
| …of which the CSP never marked at all | 2,059 | same |
| Complaints left permanently open | 1,774, mean age 21 days | `queries/zombie-complaints.sql` |
| Technicians dispatched to a resolved fault | 1,078 | `queries/waste.sql` |
| Live actionable cards for closed work | 1,760 | `queries/tas-card-state.sql` |
| Breaches recorded against a CSP who was on time | 410 of 535 mistreated | `queries/ledger.sql` |
| Movement in the platform within-TAT rate | +1.01 pp (76.09% → 77.10%) | `data/per-csp-impact.tsv` |
| Closures where the agent said "ping is up, customer not called" | 3,260 — 59.0% | `queries/closure-reason.sql` |
| Closures where a customer actually said it works | 138 — 2.5% | same |
| Agent comment present within 30 min of closure | 5,525 of 5,526 — 99.98% | same |

## The one thing to settle before this goes to engineering

**Decision 4 contradicts the platform.** "Stays until tapped, forever" cannot hold while
`TasParameters.terminalRetention` is 30 days and the gateway's v2 inline feed window is 7 days:
an unacknowledged card leaves the feed for the archive on age alone at day 7, and disappears at
day 30. Either the windows change for this card type, or "forever" becomes "until C-01".
Carried in the PRD as T6, AC-R4-4 and AC-BV-1…3, all OPEN.
