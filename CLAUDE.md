# CLAUDE.md — Kapture Closure Sync Study

## What this project is

A sizing study for **roadmap item 01, problem 6** on the Service Tickets roadmap
(https://ashish-raj-wiom.github.io/service-tickets-roadmap/):

> *"A closure made in Kapture never reaches the CSP's card. The CSP travels to a job that no
> longer exists, with the clock still running."*

Owner: Ashish Raj (PM). Started 17 Sep 2026. Split out of `srs-tas-restore-study`.

**The verdict is in `notes/01-verdict.md`. Read that first.** The short version: the gap is real
and growing (9.4% → 14.2% of resolved tickets in one month), but **the harm is operational waste,
not the Quality penalty.** The TAT-penalty framing that motivated the study is worth ~1pp
platform-wide and 0.00pp for the median CSP. Do not build the business case on it.

## Read order

1. `notes/01-verdict.md` — the answer, the four questions, and what to build the case on
2. `notes/02-method.md` — cohort, the actor discriminator, and every threshold choice
3. `notes/03-data-findings.md` — F-19…F-23, new findings that belong back in the parent study
4. `queries/` — every number in the notes is reproducible from these files

## The actor discriminator (the core method)

`PROD_DB.PUBLIC.TICKET_LOGS` (110M rows, `TASK_ID` = `SERVICE_TICKET_MODEL.TICKET_ID`) carries a
`TICKET_RESOLVED` event per closure, and its `DATA` JSON holds `updated_by`. Two sentinel ids
separate the paths, both code-verified in `ticket-service-java`:

| `updated_by` | Path | Code |
|---|---|---|
| `1234567890` | CSP/SRS → `POST /Ticket/ResolveTicket` | `TicketController.java:1596,1615` |
| `137439087976` | CC agent marks Completed in Kapture → disposed webhook | `KaptureTicketController.java:842,892` |

⚠ **These sentinels only exist from ~mid-July 2026** — the .NET→Java rewrite introduced them.
Before that `updated_by` was a real account id on every path, so **closure actor is not
recoverable before Jul 2026**. Any trend starting earlier is an instrumentation artifact, not
behaviour. See F-19.

## Conventions

Inherited from the parent study — `file:line` for every behavioural claim, numerator/denominator
on every percentage, parameter names over values, and agent-reported PASS is not trusted.
