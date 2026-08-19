/*
# Fix associados trigger + add estado column + administrador role

1. Bug fix: fn_associados_events() used `to_jsonb(NEW) - to_jsonb(OLD)` which fails
   because jsonb subtraction of two jsonb objects is not supported. Changed to
   use a simpler payload that doesn't require jsonb subtraction.

2. Modified Tables
   - associados: added estado (text, nullable). Backfilled to 'BA'.
   - profiles: role check constraint updated to include 'administrador'.
*/

-- Fix the trigger function
CREATE OR REPLACE FUNCTION fn_associados_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_event('customer_created', 'associado', NEW.id,
      jsonb_build_object('nome', NEW.nome, 'plano', NEW.plano, 'cidade', NEW.cidade), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM emit_event('customer_updated', 'associado', NEW.id,
      jsonb_build_object('nome', NEW.nome, 'plano', NEW.plano), 'info');
    IF OLD.status_pagamento <> NEW.status_pagamento AND NEW.status_pagamento = 'inadimplente' THEN
      PERFORM emit_event('customer_at_risk', 'associado', NEW.id,
        jsonb_build_object('nome', NEW.nome, 'status_pagamento', NEW.status_pagamento), 'critical');
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Add estado column
ALTER TABLE associados ADD COLUMN IF NOT EXISTS estado text;
UPDATE associados SET estado = 'BA' WHERE estado IS NULL;

-- Update role constraint to include administrador
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['operador'::text, 'supervisor'::text, 'diretoria'::text, 'administrador'::text]));
