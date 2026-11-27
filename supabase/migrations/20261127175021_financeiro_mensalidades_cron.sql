-- Schedule recurring monthly billing at midnight in America/Sao_Paulo.
-- Supabase Cron uses UTC; 03:00 UTC is 00:00 in Brazil (UTC-3).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

SELECT cron.schedule(
  'movsat-gerar-mensalidades',
  '0 3 1 * *',
  'SELECT public.gerar_mensalidades_recorrentes();'
);
