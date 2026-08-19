/*
# MovSat OS — Confirm operador INSERT on operational tables

## Problem
The app interface (App.tsx) gives the operador access to the Associados,
Rastreadores, Estoque, and Ordens de Servico pages. The page components
gate canEdit to supervisor/diretoria/administrador, so the "Novo" button
is not shown to operador. However, the user's instructions are explicit:
the operador should be able to create records in these tables because
they are an operational profile.

## Change
Ensure 'operador' is in the INSERT policies on:
- associados
- rastreadores
- estoque
- ordens_servico

These policies were already recreated by migration 018 with operador
included. This migration is a safety net: it drops and recreates the
same four INSERT policies to guarantee operador is present even if
migration 018 was applied independently.

## Why only these four tables
- prestadores: App.tsx restricts to supervisor/diretoria/administrador
  -- operador never sees this page
- financeiro: App.tsx restricts to diretoria/administrador
  -- operador never sees this page
- base_tecnica: App.tsx allows operador, but BaseTecnica.tsx gates
  canEdit to supervisor/diretoria/administrador -- operador is read-only
- atividades: operador INSERT was already added in migration 018

## No conflict with migrations 008-016
These are INSERT policies (WITH CHECK), not SELECT policies. The security
migrations 008-016 do not touch INSERT policies on these four tables.
*/

DROP POLICY IF EXISTS "insert_associados" ON public.associados;
CREATE POLICY "insert_associados"
  ON public.associados FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_rastreadores" ON public.rastreadores;
CREATE POLICY "insert_rastreadores"
  ON public.rastreadores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_estoque" ON public.estoque;
CREATE POLICY "insert_estoque"
  ON public.estoque FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_ordens_servico" ON public.ordens_servico;
CREATE POLICY "insert_ordens_servico"
  ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));
