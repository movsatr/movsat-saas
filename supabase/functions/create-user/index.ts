import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRoles = [
  "operador",
  "supervisor",
  "diretoria",
  "administrador",
] as const;

type Role = (typeof allowedRoles)[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Configuração do Supabase incompleta.");
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return Response.json(
        { error: "Não autenticado." },
        { status: 401, headers: corsHeaders },
      );
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseUser.auth.getUser();

    if (callerError || !caller) {
      return Response.json(
        { error: "Sessão inválida." },
        { status: 401, headers: corsHeaders },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role")
      .eq("id", caller.id)
      .single();

    if (profileError || callerProfile?.role !== "administrador") {
      return Response.json(
        { error: "Apenas administradores podem criar usuários." },
        { status: 403, headers: corsHeaders },
      );
    }

    const body = await req.json();

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "operador") as Role;

    if (!name || name.length < 2) {
      return Response.json(
        { error: "Informe um nome válido." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!email || !email.includes("@")) {
      return Response.json(
        { error: "Informe um e-mail válido." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: "A senha deve possuir pelo menos 8 caracteres." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!allowedRoles.includes(role)) {
      return Response.json(
        { error: "Perfil inválido." },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      });

    if (createError || !created.user) {
      return Response.json(
        {
          error:
            createError?.message || "Não foi possível criar o usuário.",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const userId = created.user.id;

    const { error: roleError } = await supabaseAdmin
      .from("profiles")
      .update({
        name,
        email,
        role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return Response.json(
        { error: "Usuário criado, mas não foi possível definir o perfil." },
        { status: 500, headers: corsHeaders },
      );
    }

    await supabaseAdmin.from("atividades").insert({
      tipo: "usuario_criado",
      descricao: `Usuário ${name} (${email}) criado com perfil ${role}.`,
      modulo: "administrador",
      usuario_id: caller.id,
      usuario_name: callerProfile.name,
    });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, role, created_at, updated_at")
      .eq("id", userId)
      .single();

    return Response.json(
      {
        success: true,
        user: profile,
      },
      { status: 201, headers: corsHeaders },
    );
  } catch (error) {
    console.error("create-user error:", error);

    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500, headers: corsHeaders },
    );
  }
});
