/*
# MovSat OS — Core Business Tables (Part 1)

## Overview
Creates the four core business tables: associados (clients), rastreadores (tracking
devices), prestadores (service providers), and estoque (inventory items). Each table
has RLS enabled with role-based policies using the get_user_role() helper.

## New Tables

### associados (clients/subscribers)
- id (uuid PK)
- nome (text, not null) — client name
- cpf_cnpj (text) — CPF or CNPJ
- telefone (text) — phone number
- email (text) — email
- endereco (text) — address
- plano (text) — plan name (Basico, Profissional, Premium)
- valor_mensalidade (numeric, default 0) — monthly fee
- status_pagamento (text, default 'em_dia') — em_dia, atrasado, inadimplente
- status_equipamento (text, default 'ok') — ok, com_problema, sem_equipamento
- data_cadastro (date) — registration date
- observacoes (text) — notes
- created_at, updated_at (timestamptz)

### rastreadores (tracking devices)
- id (uuid PK)
- imei (text, unique, not null) — device IMEI
- modelo (text) — device model
- associado_id (uuid FK -> associados.id) — linked client
- veiculo_placa (text) — vehicle plate
- veiculo_modelo (text) — vehicle model
- veiculo_cor (text) — vehicle color
- status (text, default 'ativo') — ativo, inativo, com_problema, manutencao
- data_instalacao (date) — installation date
- observacoes (text)
- created_at, updated_at

### prestadores (service providers)
- id (uuid PK)
- nome (text, not null) — provider name
- especialidade (text) — specialty (instalacao, manutencao, remocao, geral)
- telefone (text)
- email (text)
- area_cobertura (text) — coverage area
- status (text, default 'ativo') — ativo, inativo
- observacoes (text)
- created_at, updated_at

### estoque (inventory items)
- id (uuid PK)
- nome (text, not null) — item name
- categoria (text) — rastreador, acessorio, simcard, ferramenta
- quantidade (int, default 0) — stock quantity
- quantidade_minima (int, default 0) — low-stock threshold
- preco_unitario (numeric, default 0) — unit price
- fornecedor (text) — supplier
- observacoes (text)
- created_at, updated_at

## RLS Policy Design (role-based)
- SELECT: All authenticated users can read (operador, supervisor, diretoria).
- INSERT: Only supervisor and diretoria.
- UPDATE: Only supervisor and diretoria.
- DELETE: Only diretoria.

## Important Notes
1. All policies use get_user_role() to check the authenticated user role.
2. Operador gets read-only access to these tables.
3. Supervisor can create and update but cannot delete.
4. Diretoria has full CRUD.
5. RLS is enabled on every table — no exceptions.
*/

-- === ASSOCIADOS ===
CREATE TABLE IF NOT EXISTS public.associados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf_cnpj text,
  telefone text,
  email text,
  endereco text,
  plano text DEFAULT 'Basico',
  valor_mensalidade numeric(10,2) DEFAULT 0,
  status_pagamento text NOT NULL DEFAULT 'em_dia'
    CHECK (status_pagamento IN ('em_dia', 'atrasado', 'inadimplente')),
  status_equipamento text NOT NULL DEFAULT 'ok'
    CHECK (status_equipamento IN ('ok', 'com_problema', 'sem_equipamento')),
  data_cadastro date DEFAULT CURRENT_DATE,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.associados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_associados" ON public.associados;
CREATE POLICY "select_associados"
  ON public.associados FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'));

DROP POLICY IF EXISTS "insert_associados" ON public.associados;
CREATE POLICY "insert_associados"
  ON public.associados FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "update_associados" ON public.associados;
CREATE POLICY "update_associados"
  ON public.associados FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('supervisor', 'diretoria'))
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "delete_associados" ON public.associados;
CREATE POLICY "delete_associados"
  ON public.associados FOR DELETE TO authenticated
  USING (public.get_user_role() = 'diretoria');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.associados TO authenticated;

-- === RASTREADORES ===
CREATE TABLE IF NOT EXISTS public.rastreadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imei text UNIQUE NOT NULL,
  modelo text,
  associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  veiculo_placa text,
  veiculo_modelo text,
  veiculo_cor text,
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'inativo', 'com_problema', 'manutencao')),
  data_instalacao date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rastreadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_rastreadores" ON public.rastreadores;
CREATE POLICY "select_rastreadores"
  ON public.rastreadores FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'));

DROP POLICY IF EXISTS "insert_rastreadores" ON public.rastreadores;
CREATE POLICY "insert_rastreadores"
  ON public.rastreadores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "update_rastreadores" ON public.rastreadores;
CREATE POLICY "update_rastreadores"
  ON public.rastreadores FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('supervisor', 'diretoria'))
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "delete_rastreadores" ON public.rastreadores;
CREATE POLICY "delete_rastreadores"
  ON public.rastreadores FOR DELETE TO authenticated
  USING (public.get_user_role() = 'diretoria');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rastreadores TO authenticated;

-- === PRESTADORES ===
CREATE TABLE IF NOT EXISTS public.prestadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  especialidade text DEFAULT 'geral'
    CHECK (especialidade IN ('instalacao', 'manutencao', 'remocao', 'geral')),
  telefone text,
  email text,
  area_cobertura text,
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'inativo')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_prestadores" ON public.prestadores;
CREATE POLICY "select_prestadores"
  ON public.prestadores FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'));

DROP POLICY IF EXISTS "insert_prestadores" ON public.prestadores;
CREATE POLICY "insert_prestadores"
  ON public.prestadores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "update_prestadores" ON public.prestadores;
CREATE POLICY "update_prestadores"
  ON public.prestadores FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('supervisor', 'diretoria'))
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "delete_prestadores" ON public.prestadores;
CREATE POLICY "delete_prestadores"
  ON public.prestadores FOR DELETE TO authenticated
  USING (public.get_user_role() = 'diretoria');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestadores TO authenticated;

-- === ESTOQUE ===
CREATE TABLE IF NOT EXISTS public.estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text DEFAULT 'rastreador'
    CHECK (categoria IN ('rastreador', 'acessorio', 'simcard', 'ferramenta')),
  quantidade int NOT NULL DEFAULT 0,
  quantidade_minima int NOT NULL DEFAULT 0,
  preco_unitario numeric(10,2) DEFAULT 0,
  fornecedor text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_estoque" ON public.estoque;
CREATE POLICY "select_estoque"
  ON public.estoque FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('operador', 'supervisor', 'diretoria'));

DROP POLICY IF EXISTS "insert_estoque" ON public.estoque;
CREATE POLICY "insert_estoque"
  ON public.estoque FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "update_estoque" ON public.estoque;
CREATE POLICY "update_estoque"
  ON public.estoque FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('supervisor', 'diretoria'))
  WITH CHECK (public.get_user_role() IN ('supervisor', 'diretoria'));

DROP POLICY IF EXISTS "delete_estoque" ON public.estoque;
CREATE POLICY "delete_estoque"
  ON public.estoque FOR DELETE TO authenticated
  USING (public.get_user_role() = 'diretoria');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque TO authenticated;

-- === INDEXES for performance ===
CREATE INDEX IF NOT EXISTS idx_associados_status_pagamento ON public.associados(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_associados_status_equipamento ON public.associados(status_equipamento);
CREATE INDEX IF NOT EXISTS idx_rastreadores_associado_id ON public.rastreadores(associado_id);
CREATE INDEX IF NOT EXISTS idx_rastreadores_status ON public.rastreadores(status);
CREATE INDEX IF NOT EXISTS idx_estoque_categoria ON public.estoque(categoria);
