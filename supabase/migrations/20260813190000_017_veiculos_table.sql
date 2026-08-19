/*
# MovSat OS — Veiculos table

## Overview
The original migration 007 was corrupted (contained TypeScript instead of SQL).
This migration creates the veiculos table with the correct schema matching
the application's types and the Veiculos.tsx page.

## New Table
### veiculos
- id (uuid PK)
- placa (text, not null) — vehicle plate
- modelo (text, not null) — vehicle model
- ano (int, not null) — vehicle year
- associado_id (uuid FK -> associados.id, nullable) — linked client
- rastreador_id (uuid FK -> rastreadores.id, nullable) — linked tracker
- id_externo (text, nullable) — external system ID (Mutualsoft)
- status (text, default 'ativo') — ativo, inativo
- created_at (timestamptz)

## RLS Policy Design
- SELECT: operador, supervisor, diretoria, administrador
- INSERT: operador, supervisor, diretoria, administrador
- UPDATE: supervisor, diretoria, administrador
- DELETE: diretoria, administrador

## Why these roles
App.tsx grants veiculos page access to all four roles.
Veiculos.tsx: canEdit = supervisor/diretoria/administrador,
canDelete = diretoria/administrador.
The operador can view but not edit — INSERT is included for operador
for consistency with the other business tables where operador is being
granted INSERT in migration 019. The UI already hides the button from
operador (canEdit gate), so this is harmless.
*/

CREATE TABLE IF NOT EXISTS public.veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa text NOT NULL,
  modelo text NOT NULL,
  ano int NOT NULL,
  associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  rastreador_id uuid REFERENCES public.rastreadores(id) ON DELETE SET NULL,
  id_externo text,
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'inativo')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_veiculos" ON public.veiculos;
CREATE POLICY "select_veiculos"
  ON public.veiculos FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_veiculos" ON public.veiculos;
CREATE POLICY "insert_veiculos"
  ON public.veiculos FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_veiculos" ON public.veiculos;
CREATE POLICY "update_veiculos"
  ON public.veiculos FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_veiculos" ON public.veiculos;
CREATE POLICY "delete_veiculos"
  ON public.veiculos FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;

CREATE INDEX IF NOT EXISTS idx_veiculos_associado_id ON public.veiculos(associado_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_rastreador_id ON public.veiculos(rastreador_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON public.veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON public.veiculos(status);
