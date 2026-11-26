-- Expandir as classificações financeiras sem alterar os registros existentes.
ALTER TABLE public.financeiro
  DROP CONSTRAINT IF EXISTS financeiro_tipo_check;

ALTER TABLE public.financeiro
  ADD CONSTRAINT financeiro_tipo_check
  CHECK (tipo IN (
    'mensalidade',
    'instalacao',
    'manutencao',
    'rastreamento',
    'assistencia',
    'servico',
    'outro'
  ));

CREATE INDEX IF NOT EXISTS idx_financeiro_data_vencimento
  ON public.financeiro (data_vencimento);

CREATE INDEX IF NOT EXISTS idx_financeiro_data_pagamento
  ON public.financeiro (data_pagamento);
