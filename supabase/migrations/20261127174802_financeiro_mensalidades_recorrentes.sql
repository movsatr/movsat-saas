-- Snapshot recurring monthly charges from the associate's current monthly fee.
-- The competence key makes generation idempotent; past amounts are never rewritten.
ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS competencia date;

UPDATE public.financeiro
SET competencia = date_trunc('month', data_vencimento)::date
WHERE tipo = 'mensalidade'
  AND competencia IS NULL
  AND data_vencimento IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_financeiro_mensalidade_competencia
  ON public.financeiro (associado_id, competencia)
  WHERE tipo = 'mensalidade'
    AND associado_id IS NOT NULL
    AND competencia IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gerar_mensalidades_recorrentes()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_inseridas integer := 0;
BEGIN
  INSERT INTO public.financeiro (
    associado_id,
    tipo,
    descricao,
    valor,
    status,
    data_vencimento,
    competencia
  )
  SELECT
    a.id,
    'mensalidade',
    'Mensalidade ' || to_char(m.competencia, 'MM/YYYY'),
    a.valor_mensalidade,
    CASE WHEN vencimento.data_vencimento < v_hoje THEN 'atrasado' ELSE 'pendente' END,
    vencimento.data_vencimento,
    m.competencia
  FROM public.associados AS a
  CROSS JOIN LATERAL generate_series(
    date_trunc('month', COALESCE(a.data_cadastro, (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date))::date,
    date_trunc('month', v_hoje)::date,
    interval '1 month'
  ) AS serie(mes)
  CROSS JOIN LATERAL (
    SELECT serie.mes::date AS competencia
  ) AS m
  CROSS JOIN LATERAL (
    SELECT (
      m.competencia
      + LEAST(
          EXTRACT(DAY FROM COALESCE(a.data_cadastro, (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date))::integer,
          EXTRACT(DAY FROM (m.competencia + interval '1 month - 1 day'))::integer
        ) - 1
    )::date AS data_vencimento
  ) AS vencimento
  WHERE COALESCE(a.valor_mensalidade, 0) > 0
    AND COALESCE(a.data_cadastro, (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date) <= v_hoje
  ON CONFLICT (associado_id, competencia)
    WHERE tipo = 'mensalidade'
      AND associado_id IS NOT NULL
      AND competencia IS NOT NULL
  DO NOTHING;

  GET DIAGNOSTICS v_inseridas = ROW_COUNT;
  RETURN v_inseridas;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_mensalidades_recorrentes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_mensalidades_recorrentes() TO authenticated;
