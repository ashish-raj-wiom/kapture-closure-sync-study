# 02 — Method: every choice that moves a number

Warehouse is Snowflake via the Metabase native-query API (`DATABASE_ID = 113`). All house rules
from `srs-tas-restore-study/notes/06-data-extraction-context.md` apply. Runner: `queries/q.js`.

## Cohort

```
LAST_TITLE ILIKE 'Internet Issues%'          -- covers both the '|' and ' |' variants
AND IS_PARTNERASSIGNED = 1                   -- TSJ only calls SRS for partner-queue tickets
AND REGEXP_LIKE(TICKET_ID,'^[0-9]+$')        -- production junk guard
AND ticket created 11 Aug – 10 Sep 2026 IST
QUALIFY ROW_NUMBER() OVER (PARTITION BY TICKET_ID ORDER BY TICKET_ADDED_TIME DESC) = 1
```

**Unit = Kapture ticket.** 42,626 tickets. Chosen because the question is asked in tickets and
because the CSP card is per ticket. Complaint-level counts differ — 4,129 tickets (9.7%) carry
more than one complaint via reopens.

**Window choice:** 31 days ending 10 Sep, i.e. a week of maturity before "today" (17 Sep). Ending
later would understate class C, because a ticket the CSP has not marked *yet* counts as class B.

## The actor discriminator

`PROD_DB.PUBLIC.TICKET_LOGS`, `EVENT_NAME = 'TICKET_RESOLVED'`, `TRY_PARSE_JSON(DATA):updated_by`.
Two sentinel ids, both code-verified:

- `1234567890` → `POST /Ticket/ResolveTicket`, the SRS→TSJ hook the CSP's mark travels through
  (`ticket-service-java/.../controller/TicketController.java:1596,1615`). Comment written with
  `creatorName = "csp"`.
- `137439087976` → the Kapture disposed webhook, i.e. a CC agent set substatus
  Completed / Resolved / Resolved on Call
  (`.../controller/KaptureTicketController.java:842` sets `systemUser`, `:892` resolves with it).

Per ticket: `fka = MIN(ts WHERE ub='137439087976')`, `fca = MIN(ts WHERE ub='1234567890')`.
Classification is then the order of those two, nothing else — no time threshold is needed.

**Why not the obvious alternatives:**

| Rejected source | Why |
|---|---|
| `SERVICE_TICKET_MODEL.CLOSED_BY` | 100% NULL (63,118/63,118). F-21 |
| `…FIRST_RESOLVED_ROLE` / `FINAL_RESOLVED_ROLE` | constant string `'rohit'` on every row. F-21 |
| `…FIRST_RESOLVED_BY_ACCOUNT_ID` | always equals `CURRENT_PARTNER_ACCOUNT_ID` — the ETL attributes every closure to the partner. F-21 |
| `DYNAMODB_READ.TICKETS.UPDATED_BY` | correct values, but last-writer-wins: a Kapture close followed by a CSP mark shows only the CSP. Undercounts the exact population of interest |
| `DYNAMODB.TICKET_COMMENTS.CREATOR_NAME` | ideal signal (`'csp'` vs `'Partner'`), connector dead since 7 Jul 2026. F-20 |

`TICKET_LOGS` rows are duplicated ~180× by replication fanout (1,062,422 `TICKET_RESOLVED` rows
over 5,858 tickets on one day). Rows are byte-identical, so `SELECT DISTINCT` on
`(TASK_ID, EVENT_NAME, ADDED_TIME, updated_by)` collapses them exactly.

**Join key:** `TICKET_LOGS.TASK_ID` = `SERVICE_TICKET_MODEL.TICKET_ID` (both 16-digit).
`KAPTURE_TICKET_ID` is a different, 12-digit id — do not join on it.

## Timezone

`SERVICE_TICKET_MODEL` and `TICKET_LOGS` are `TIMESTAMP_NTZ` in UTC → `DATEADD(MINUTE,330, ts::TIMESTAMP_NTZ)`.
SRS/TAS/Quality are `TIMESTAMP_TZ` → `CONVERT_TIMEZONE('Asia/Kolkata', ts)::TIMESTAMP_NTZ`.

**Validated, not assumed** (`queries/tz-alignment-check.sql`): across 10,130 matched tickets, the
gap between Kapture ticket creation and SRS complaint creation is **P05 0.00 min, P50 0.00 min,
P95 7.23 min**. Both clocks agree.

## TAT / SLA

`COMPLAINTS.SLA_AT` (SRS is the TAT authority; A-05 notes a second, independent breach timer in
TSJ — not used here). Per ticket the complaint is picked
`ORDER BY CREATED_AT ASC, VERSION ASC, COMPLAINT_ID ASC`.

⚠ **`COMPLAINT_ID` in that tiebreak is load-bearing.** Without it, ties shifted ~879 tickets
between classes between two runs of the same query. Any reopen-touching query here must keep it.

`WITHIN_TAT` on `COMPLAINTS` is tri-state (NULL ≠ 0) and is never used as "breached". The scoring
truth is `COMPLAINT_RESOLUTION_LEDGER.RESOLVED_WITHIN_TAT` + `EXCLUDED_FROM_SCORING`.

**Sync loss** is defined as `fka <= SLA_AT AND (fca > SLA_AT OR fca IS NULL)` — the ticket was
closed in Kapture inside the deadline, and the CSP's mark was not. That is the only population
whose breach the missing sync caused.

## Known limits

1. **No actor before ~mid-Jul 2026.** July is half-instrumented (15,762 of 15,885 tickets created
   1–10 Jul have no sentinel-id resolve event). Only Aug onward is complete. F-19.
2. **Single ticket family.** Internet Issues only. Shifting and installation-defect classes are
   not measured and, per F-05, shifting emits no Quality signal at all.
3. **Reopens.** For the 9.7% multi-complaint tickets the SLA used is the first complaint's.
   `queries/cf.sql` reports single- and multi-complaint rows separately; the split does not change
   the conclusion (sync loss 357 single / 38 multi in class C).
4. **No CSAT.** F-20.
5. **`IN_PROGRESS` never appears** in TAS state history, so "started work after closure" is
   structurally 0, not a real zero. The dispatch measure used instead is `ASSIGNED_TECHNICIAN`.
