/*
  Enforce the production authorization matrix at the database boundary.

  Operador: read operational data, create operational records, and progress an
  order only through the narrow RPC below. Supervisor: operational management
  including orders and tasks. Diretoria and administrador: full operational
  access; financeiro remains restricted to these two roles. Automations are
  configuration and can be changed only by diretoria or administrador.
*/

-- An operator must never be able to update an order with a generic REST call.
-- That call can alter customer, tracker, provider, priority, description and
-- final solution in addition to the operational fields.
DROP POLICY IF EXISTS "update_ordens_servico" ON public.ordens_servico;
CREATE POLICY "update_ordens_servico"
  ON public.ordens_servico FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

-- The same broad-write problem existed on tasks. Task management belongs to
-- supervisors and above; operators retain read access only.
DROP POLICY IF EXISTS "update_tasks" ON public.tasks;
CREATE POLICY "update_tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

-- Automation rules and their queue are system configuration/execution state,
-- not an operational supervisor permission.
DROP POLICY IF EXISTS "update_automation_rules" ON public.automation_rules;
CREATE POLICY "update_automation_rules"
  ON public.automation_rules FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_queue" ON public.automation_queue;
CREATE POLICY "update_queue"
  ON public.automation_queue FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- The only permitted operator-side order mutation. SECURITY DEFINER is
-- necessary because the broad UPDATE policy above deliberately excludes the
-- operador role. The function exposes no administrative or financial column.
CREATE OR REPLACE FUNCTION public.update_ordem_servico_operacional(
  p_ordem_id uuid,
  p_status text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_data_conclusao date DEFAULT NULL
)
RETURNS public.ordens_servico
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_ordem public.ordens_servico;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role <> 'operador' THEN
    RAISE EXCEPTION 'only operadores may use this operational update';
  END IF;

  IF p_status IS NULL AND p_observacoes IS NULL AND p_data_conclusao IS NULL THEN
    RAISE EXCEPTION 'at least one operational field is required';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('aberta', 'em_andamento', 'concluida', 'cancelada') THEN
    RAISE EXCEPTION 'invalid operational status';
  END IF;

  UPDATE public.ordens_servico
  SET status = COALESCE(p_status, status),
      observacoes = COALESCE(p_observacoes, observacoes),
      data_conclusao = COALESCE(p_data_conclusao, data_conclusao)
  WHERE id = p_ordem_id
  RETURNING * INTO v_ordem;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  RETURN v_ordem;
END;
$$;

REVOKE ALL ON FUNCTION public.update_ordem_servico_operacional(uuid, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_ordem_servico_operacional(uuid, text, text, date) TO authenticated;

-- Role changes are privileged and cannot be achieved by a table policy. This
-- controlled RPC makes the administrator capability explicit while keeping
-- profiles immutable to all other authenticated users.
CREATE OR REPLACE FUNCTION public.set_user_role(
  p_user_id uuid,
  p_role text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_profile public.profiles;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role <> 'administrador' THEN
    RAISE EXCEPTION 'only administrators may change user roles';
  END IF;

  IF p_role NOT IN ('operador', 'supervisor', 'diretoria', 'administrador') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;
