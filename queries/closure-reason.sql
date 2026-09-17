WITH cohort AS (
  SELECT TICKET_ID FROM PROD_DB.PUBLIC.SERVICE_TICKET_MODEL
  WHERE LAST_TITLE ILIKE 'Internet Issues%' AND IS_PARTNERASSIGNED=1
    AND REGEXP_LIKE(TICKET_ID,'^[0-9]+$')
    AND DATE(DATEADD(MINUTE,330, TICKET_ADDED_TIME::TIMESTAMP_NTZ)) BETWEEN '2026-08-11' AND '2026-09-10'
  QUALIFY ROW_NUMBER() OVER (PARTITION BY TICKET_ID ORDER BY TICKET_ADDED_TIME DESC)=1
),
ev AS (SELECT DISTINCT l.TASK_ID, l.EVENT_NAME, DATEADD(MINUTE,330,l.ADDED_TIME) ts,
              TRY_PARSE_JSON(l.DATA):updated_by::VARCHAR ub,
              TRY_PARSE_JSON(l.DATA):Comment::VARCHAR cmt
       FROM PROD_DB.PUBLIC.TICKET_LOGS l JOIN cohort c ON c.TICKET_ID=l.TASK_ID
       WHERE l.EVENT_NAME IN ('TICKET_RESOLVED','COMMENT_ADDED')
         AND DATE(DATEADD(MINUTE,330,l.ADDED_TIME)) BETWEEN '2026-08-11' AND '2026-09-17'),
pt AS (SELECT TASK_ID, MIN(CASE WHEN EVENT_NAME='TICKET_RESOLVED' AND ub='137439087976' THEN ts END) fka,
                       MIN(CASE WHEN EVENT_NAME='TICKET_RESOLVED' AND ub='1234567890'   THEN ts END) fca
       FROM ev GROUP BY 1),
kf AS (SELECT TASK_ID, fka FROM pt WHERE fka IS NOT NULL AND (fca IS NULL OR fka < fca)),
joined AS (
  SELECT k.TASK_ID, LISTAGG(e.cmt,' || ') WITHIN GROUP (ORDER BY e.ts) AS blob
  FROM kf k JOIN ev e ON e.TASK_ID=k.TASK_ID
  WHERE e.EVENT_NAME='COMMENT_ADDED'
    AND e.ts BETWEEN DATEADD(MINUTE,-30,k.fka) AND DATEADD(MINUTE,5,k.fka) AND e.cmt IS NOT NULL
  GROUP BY 1
)
SELECT
  CASE
    WHEN blob ILIKE '%ping is up%' OR blob ILIKE '%ping up%' OR blob ILIKE '%pinged up%' OR blob ILIKE '%ping delay%'
                                                              THEN 'A_ping_is_up (customer NOT called)'
    WHEN blob ILIKE '%internet working%' OR blob ILIKE '%chal raha%' OR blob ILIKE '%chalne laga%'
      OR blob ILIKE '%working now%' OR blob ILIKE '%sahi chal%' OR blob ILIKE '%net thik%'
                                                              THEN 'B_customer_says_working'
    WHEN blob ILIKE '%[[]System]%' AND NOT blob ILIKE '%VOC%' AND NOT blob ILIKE '%Action taken%'
                                                              THEN 'C_system_text_only (no reason given)'
    ELSE 'D_other_free_text'
  END AS why_the_agent_closed,
  COUNT(*) tickets, ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER (),2) pct
FROM joined GROUP BY 1 ORDER BY tickets DESC
