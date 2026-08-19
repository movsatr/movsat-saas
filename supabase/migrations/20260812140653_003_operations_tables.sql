/*
# MovSat OS — Operations Tables (Part 2)

## Overview
Creates the remaining business tables: ordens_servico (service orders), financeiro
(financial records), base_tecnica (technical knowledge base), and atividades
(activity log). Each has RLS with role-based policies.

## New Tables

### ordens_servico (service orders)
- id (uuid PK)
- numero (text, unique) — human-readable OS number like OS-2025-0001
- associado_id (uuid FK -> associados.id) — linked client
- rastreador_id (uuid FK -> rastreadores.id) — linked device
- prestador_id (uuid FK -> prestadores.id) — assigned provider
- tipo (text) — instalacao, manutencao, remocao, consultoria
- status (text, default aberta) — aberta, em_andamento, concluida, cancelada
- prioridade (text, default normal) — baixa, normal, alta, urgente
- descricao (text) — problem description
- solucao (text) — solution applied
- data_abertura (date) — opening date
- data_conclusao (date) — completion date
- observacoes (text)
- created_at, updated_at

### financeiro (financial records / cobrancas)
- id (uuid PK)
- associado_id (uuid FK -> associados.id) — linked client
- tipo (text) — mensalidade, instalacao, manutencao, outro
- descricao (text)
- valor (numeric, not null) — amount
- status (text, default pendente) — pago, pendente, atrasado, cancelado
- data_vencimento (date) — due date
- data_pagamento (date) — payment date
- forma_pagamento (text) — pix, boleto, cartao, dinheiro
- observacoes (text)
- created_at, updated_at

### base_tecnica (technical knowledge base)
- id (uuid PK)
- titulo (text, not null) — document title
- categoria (text) — instalacao, configuracao, troubleshooting, especificacao, manual
- conteudo (text) — full content
- tags (text) — comma-separated tags
- status (text, default ativo) — ativo, arquivado
- created_at, updated_at

### atividades (activity log)
- id (uuid PK)
- tipo (text) — os_criada, os_status, associado_criado, pagamento, etc.
- descricao (text) — human-readable description
- modulo (text) — which module generated the activity
- usuario_id (uuid) — the user who performed the action
- usuario_name (text) — user name at time of action
- created_at (timestamptz)

## RLS Policy Design

### ordens_servico
- SELECT: all authenticated roles (operador, supervisor, diretoria)
- INSERT: supervisor, diretoria
- UPDATE: all roles can update (operador updates status only — enforced in app UI)
- DELETE: diretoria only

### financeiro
- SELECT: diretoria only (operador and supervisor cannot see financial data)
- INSERT: diretoria only
- UPDATE: diretoria only
- DELETE: diretoria only

### base_tecnica
- SELECT: all authenticated roles
- INSERT: supervisor, diretoria
- UPDATE: supervisor, diretoria
- DELETE: diretoria only

### atividades
- SELECT: all authenticated roles
- INSERT: all authenticated roles (any user can generate activity log entries)
- No UPDATE or DELETE — activity log is append-only

## Important Notes
1. Financeiro is the most restricted table — only diretoria can read or write.
2. Operador can UPDATE ordens_servico (to change status) but the app UI limits
   them to status-only changes. RLS allows the update; column-level restriction
   is a UI concern at this phase.
3. Atividades is append-only — no update or delete policies.
*/

-- === ORDENS_SERVICO ===
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE NOT NULL,
  associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  rastreador_id uuid REFERENCES public.rastreadores(id) ON DELETE SET NULL,
  prestador_id uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'manutencao'
    CHECK (tipo IN ('instalacao', 'manutencao', 'remocao', 'consultoria')),
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  prioridade text NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  descricao text,
  solucao text,
  data_abertura date DEFAULT CURRENT_DATE,
  data_conclusao date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ordens_servico" ON public.ordens_servico;
CREATE POLICY "select_ordens_servico"
  ON public.ordens_servico FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'));

DROP POLICY IF EXISTS "insert_ordens_servico" ON public.ordens_servico;
CREATE POLICY "insert_ordens_servico"
  ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "update_ordens_servico" ON public.ordens_servico;
CREATE POLICY "update_ordens_servico"
  ON public.ordens_servico FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'))
  WITH CHECK (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'));

DROP POLICY IF EXISTS "delete_ordens_servico" ON public.ordens_servico;
CREATE POLICY "delete_ordens_servico"
  ON public.ordens_servico FOR DELETE TO authenticated
  USING (public.get_user_role() = 'diretoria');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;

-- === FINANCEIRO ===
CREATE TABLE IF NOT EXISTS public.financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'mensalidade'
    CHECK (tipo IN ('mensalidade', 'instalacao', 'manutencao', 'outro')),
  descricao text,
  valor numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pago', 'pendente', 'atrasado', 'cancelado')),
  data_vencimento date,
  data_pagamento date,
  forma_pagamento text
    CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('pix', 'boleto', 'cartao', 'dinheiro')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_financeiro" ON public.financeiro;
CREATE POLICY "select_financeiro"
  ON public.financeiro FOR SELECT TO authenticated
  USING (public.get_user_role() = 'diretoria');

DROP POLICY IF EXISTS "insert_financeiro" ON public.financeiro;
CREATE POLICY "insert_financeiro"
  ON public.financeiro FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'diretoria');

DROP POLICY IF EXISTS "update_financeiro" ON public.financeiro;
CREATE POLICY "update_financeiro"
  ON public.financeiro FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'diretoria')
  WITH CHECK (public.get_user_role() = 'diretoria');

DROP POLICY IF EXISTS "delete_financeiro" ON public.financeiro;
CREATE POLICY "delete_financeiro"
  ON public.financeiro FOR DELETE TO authenticated
  USING (public.get_user_role() = 'diretoria');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro TO authenticated;

-- === BASE_TECNICA ===
CREATE TABLE IF NOT EXISTS public.base_tecnica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  categoria text NOT NULL DEFAULT 'manual'
    CHECK (categoria IN ('instalacao', 'configuracao', 'troubleshooting', 'especificacao', 'manual')),
  conteudo text,
  tags text,
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'arquivado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.base_tecnica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_base_tecnica" ON public.base_tecnica;
CREATE POLICY "select_base_tecnica"
  ON public.base_tecnica FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'));

DROP POLICY IF EXISTS "insert_base_tecnica" ON public.base_tecnica;
CREATE POLICY "insert_base_tecnica"
  ON public.base_tecnica FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "update_base_tecnica" ON public.base_tecnica;
CREATE POLICY "update_base_tecnica"
  ON public.base_tecnica FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('supervisor', 'diretoria'))
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "delete_base_tecnica" ON public.base_tecnica;
CREATE POLICY "delete_base_tecnica"
  ON public.base_tecnica FOR DELETE TO authenticated
  USING (public.get_user_role() = 'diretoria');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_tecnica TO authenticated;

-- === ATIVIDADES (activity log — append-only) ===
CREATE TABLE IF NOT EXISTS public.atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  descricao text NOT NULL,
  modulo text NOT NULL,
  usuario_id uuid,
  usuario_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_atividades" ON public.atividades;
CREATE POLICY "select_atividades"
  ON public.atividades FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'));

DROP POLICY IF EXISTS "insert_atividades" ON public.atividades;
CREATE POLICY "insert_atividades"
  ON public.atividades FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'));

-- No UPDATE or DELETE policies — atividades is append-only

GRANT SELECT, INSERT ON public.atividades TO authenticated;

-- === INDEXES ===
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON public.ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_associado_id ON public.ordens_servico(associado_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_prestador_id ON public.ordens_servico(prestador_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_associado_id ON public.financeiro(associado_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_status ON public.financeiro(status);
CREATE INDEX IF NOT EXISTS idx_base_tecnica_categoria ON public.base_tecnica(categoria);
CREATE INDEX IF NOT EXISTS idx_atividades_created_at ON public.atividades(created_at DESC);
