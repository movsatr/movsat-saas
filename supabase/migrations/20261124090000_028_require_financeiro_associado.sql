-- Require a customer/associate for every new or reassigned financial entry.
-- Existing legacy rows with NULL associado_id are intentionally preserved.
CREATE OR REPLACE FUNCTION public.require_financeiro_associado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.associado_id IS NULL THEN
    RAISE EXCEPTION 'Selecione um cliente/associado para o lançamento financeiro.'
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.require_financeiro_associado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_require_financeiro_associado ON public.financeiro;
CREATE TRIGGER trg_require_financeiro_associado
BEFORE INSERT OR UPDATE OF associado_id ON public.financeiro
FOR EACH ROW
EXECUTE FUNCTION public.require_financeiro_associado();
