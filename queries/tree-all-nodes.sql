-- ONE consistent base -> every node of the tree. Leaves must sum to 42,626.
WITH cohort AS (
  SELECT TICKET_ID FROM PROD_DB.PUBLIC.SERVICE_TICKET_MODEL
  WHERE LAST_TITLE ILIKE 'Internet Issues%' AND IS_PARTNERASSIGNED=1
    AND REGEXP_LIKE(TICKET_ID,'^[0-9]+$')
    AND DATE(DATEADD(MINUTE,330, TICKET_ADDED_TIME::TIMESTAMP_NTZ)) BETWEEN '2026-08-11' AND '2026-09-10'
  QUALIFY ROW_NUMBER() OVER (PARTITION BY TICKET_ID ORDER BY TICKET_ADDED_TIME DESC)=1
),
ev AS (SELECT DISTINCT l.TASK_ID, DATEADD(MINUTE,330,l.ADDED_TIME) ts,
              TRY_PARSE_JSON(l.DATA):updated_by::VARCHAR ub
       FROM PROD_DB.PUBLIC.TICKET_LOGS l JOIN cohort c ON c.TICKET_ID=l.TASK_ID
       WHERE l.EVENT_NAME='TICKET_RESOLVED'
         AND DATE(DATEADD(MINUTE,330,l.ADDED_TIME)) BETWEEN '2026-08-11' AND '2026-09-17'),
pt AS (SELECT TASK_ID, MIN(CASE WHEN ub='137439087976' THEN ts END) fka,
                       MIN(CASE WHEN ub='1234567890'   THEN ts END) fca FROM ev GROUP BY 1),
srs AS (
  SELECT TICKET_ID, COMPLAINT_ID, CSP_ID, STATUS srs_status,
         CONVERT_TIMEZONE('Asia/Kolkata',SLA_AT)::TIMESTAMP_NTZ sla
  FROM PROD_DB.CSP_SUPPORT_RESOLUTION_SERVICE_CSP_SUPPORT_RESOLUTION_SERVICE.COMPLAINTS
  WHERE _FIVETRAN_ACTIVE AND TICKET_ID IS NOT NULL AND REGEXP_LIKE(TICKET_ID,'^[0-9]+$')
  QUALIFY ROW_NUMBER() OVER (PARTITION BY TICKET_ID ORDER BY CREATED_AT ASC, VERSION ASC, COMPLAINT_ID ASC)=1
),
led AS (SELECT COMPLAINT_ID, RESOLVED_WITHIN_TAT FROM PROD_DB.CSP_QUALITY_SERVICE_CSP_QUALITY_SERVICE.COMPLAINT_RESOLUTION_LEDGER
        WHERE _FIVETRAN_ACTIVE QUALIFY ROW_NUMBER() OVER (PARTITION BY COMPLAINT_ID ORDER BY VERSION DESC)=1),
j AS (
  SELECT c.TICKET_ID, s.COMPLAINT_ID, s.CSP_ID, s.srs_status, s.sla, p.fka, p.fca,
         l.RESOLVED_WITHIN_TAT,
         CASE WHEN p.fka IS NULL AND p.fca IS NULL          THEN 'E_no_resolve_event'
              WHEN p.fka IS NULL                            THEN 'A_csp_only'
              WHEN p.fca IS NULL                            THEN 'B_kapture_only'
              WHEN p.fka < p.fca                            THEN 'C_kapture_first'
              ELSE 'D_csp_first' END cls
  FROM cohort c LEFT JOIN pt p ON p.TASK_ID=c.TICKET_ID
  LEFT JOIN srs s ON s.TICKET_ID=c.TICKET_ID
  LEFT JOIN led l ON l.COMPLAINT_ID=s.COMPLAINT_ID
)
SELECT cls,
  CASE WHEN COMPLAINT_ID IS NULL THEN '0_never_reached_srs'
       WHEN sla IS NULL           THEN '1_no_sla_stamped'
       WHEN fka IS NULL           THEN '2_n/a_no_agent_close'
       WHEN fka >  sla            THEN '3_agent_closed_AFTER_tat'
       WHEN fca IS NULL           THEN '4_agent_in_tat__csp_never_marked'
       WHEN fca <= sla            THEN '5_agent_in_tat__csp_also_in_tat'
       ELSE                            '6_agent_in_tat__csp_marked_LATE' END tat_branch,
  COUNT(*) tickets,
  COUNT(DISTINCT CSP_ID) csps,
  SUM(CASE WHEN srs_status='CLOSED' THEN 1 ELSE 0 END) srs_closed,
  SUM(CASE WHEN srs_status IS NOT NULL AND srs_status<>'CLOSED' THEN 1 ELSE 0 END) srs_still_open,
  SUM(CASE WHEN RESOLVED_WITHIN_TAT=FALSE THEN 1 ELSE 0 END) ledger_breached
FROM j GROUP BY 1,2 ORDER BY 1,2
