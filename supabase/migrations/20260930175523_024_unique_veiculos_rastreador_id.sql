/*
# MovSat OS — Enforce 1:1 relationship between veiculos and rastreadores

## Overview
Adds a partial UNIQUE index on veiculos.rastreador_id so that no two vehicles
can point to the same tracker. This enforces at the database level that a
rastreador can be linked to at most one veiculo. The index is partial
(WHERE rastreador_id IS NOT NULL) so that multiple vehicles without a
tracker are allowed.

## Changes
### Index
- uniq_veiculos_rastreador_id — partial unique index on veiculos(rastreador_id)
  WHERE rastreador_id IS NOT NULL. Prevents duplicate tracker links.

## Security
- No policy changes. No new tables or columns.

## Important notes
1. This is additive — a new index only. No data is lost or transformed.
2. If duplicate links already exist in the database, the index creation
   will fail. In that case, duplicates must be resolved before re-applying.
3. The application frontend also performs pre-save validation to block
   conflicts before they reach the database, but the index is the
   definitive guarantee of integrity.
*/

CREATE UNIQUE INDEX IF NOT EXISTS uniq_veiculos_rastreador_id
  ON public.veiculos(rastreador_id)
  WHERE rastreador_id IS NOT NULL;