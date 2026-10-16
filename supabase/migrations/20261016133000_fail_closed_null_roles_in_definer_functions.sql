/*
Security hardening: SECURITY DEFINER routines must fail closed when the caller
has no profile or role. In PL/pgSQL, IF NULL THEN does not enter the branch,
so a plain "role <> 'administrator'" check can accidentally pass for NULL.
*/
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
  v_profile public.profiles;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'administrador' THEN
    RAISE EXCEPTION 'only administrators may change user roles';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('operador', 'supervisor', 'diretoria', 'administrador') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.update_ordem_servico_operacional(
  p_ordem_id uuid,
  p_status text DEFAULT NULL::text,
  p_observacoes text DEFAULT NULL::text,
  p_data_conclusao date DEFAULT NULL::date
)
RETURNS public.ordens_servico
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_ordem public.ordens_servico;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'operador' THEN
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
$function$;
