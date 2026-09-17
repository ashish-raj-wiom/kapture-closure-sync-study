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
-- full Fivetran version history of each candidate: first entry into each state
cand AS (
  SELECT TICKET_ID, EXECUTION_CANDIDATE_ID, CSP_ID, STATE,
         MIN(CONVERT_TIMEZONE('Asia/Kolkata', _FIVETRAN_START)::TIMESTAMP_NTZ) state_entered,
         MAX(CONVERT_TIMEZONE('Asia/Kolkata', LATEST_ATTENTION_AT)::TIMESTAMP_NTZ) last_attention
  FROM PROD_DB.CSP_TAS_SERVICE_CSP_TAS_SERVICE.RESTORE_EXECUTION_CANDIDATES
  WHERE TICKET_ID IS NOT NULL AND REGEXP_LIKE(TICKET_ID,'^[0-9]+$')
  GROUP BY 1,2,3,4
),
agg AS (
  SELECT TICKET_ID,
         MIN(CASE WHEN STATE='ACCEPTED' THEN state_entered END) first_accepted,
         MIN(CASE WHEN STATE='ASSIGNED_TECHNICIAN' THEN state_entered END) first_tech_assigned,
         MIN(CASE WHEN STATE='IN_PROGRESS' THEN state_entered END) first_in_progress,
         MAX(last_attention) last_attention
  FROM cand GROUP BY 1
)
SELECT
  CASE WHEN p.fka IS NOT NULL AND p.fca IS NULL THEN 'B_kapture_only'
       WHEN p.fka IS NOT NULL AND p.fka<p.fca   THEN 'C_kapture_first' END cls,
  COUNT(*) tickets,
  SUM(CASE WHEN a.first_accepted > p.fka THEN 1 ELSE 0 END)      accepted_after_kapture_close,
  SUM(CASE WHEN a.first_tech_assigned > p.fka THEN 1 ELSE 0 END) tech_assigned_after_close,
  SUM(CASE WHEN a.first_in_progress > p.fka THEN 1 ELSE 0 END)   started_work_after_close,
  SUM(CASE WHEN a.last_attention > p.fka THEN 1 ELSE 0 END)      nudged_after_close
FROM cohort c JOIN pt p ON p.TASK_ID=c.TICKET_ID
LEFT JOIN agg a ON a.TICKET_ID=c.TICKET_ID
WHERE p.fka IS NOT NULL AND (p.fca IS NULL OR p.fka < p.fca)
GROUP BY 1 ORDER BY 1
