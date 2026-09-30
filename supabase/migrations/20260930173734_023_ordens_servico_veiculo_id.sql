/*
# MovSat OS — Add veiculo_id to ordens_servico

## Overview
Adds an optional veiculo_id column to the ordens_servico table so that a service
order of type "instalacao" can identify which vehicle will receive the tracker.
When the installation is concluded, the application links the tracker to the
vehicle via veiculos.rastreador_id and updates the tracker's status/data_instalacao.

## Changes
### ordens_servico (modified)
- veiculo_id (uuid, nullable) — FK to public.veiculos(id), ON DELETE SET NULL.
  Nullable so existing OS rows and non-installation OS types are not affected.

## Security
- No new RLS policies needed — the column is covered by the existing
  ordens_servico policies (SELECT/INSERT/UPDATE/DELETE already scoped
  to the same roles). The FK references veiculos which has its own RLS.

## Index
- idx_ordens_servico_veiculo_id for filtering OS by vehicle.

## Important notes
1. The column is nullable — existing OS rows get NULL automatically.
2. No data migration needed — this is additive only.
3. The actual linking of veiculos.rastreador_id is performed by the
   application frontend when the OS is marked as "concluida". This
   migration only adds the column to store the vehicle reference.
4. The application also updates rastreadores.status to 'ativo' and
   rastreadores.data_instalacao to the OS conclusion date. Those tables
   already have the necessary columns — no schema change needed there.
*/

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ordens_servico_veiculo_id
  ON public.ordens_servico(veiculo_id);