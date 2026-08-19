/*
# Security fix F8 — remove client INSERT on the atividades history

## Problem
Policy "insert_atividades" allowed any signed-in user with any role to write
rows into `atividades`, the activity history. Nothing bound the row to
auth.uid(), so a caller could plant misleading entries attributing actions to
other people.

## Change
Drop the client INSERT policy on atividades.

## Why this is safe
A grep of src/ finds no insert into atividades from the frontend; the app only
reads this table. Server-side writers (triggers and the service-role edge
function) are not subject to row level security policies.
*/

DROP POLICY IF EXISTS "insert_atividades" ON public.atividades;
