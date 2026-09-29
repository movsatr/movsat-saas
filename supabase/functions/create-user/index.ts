import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const allowedRoles = [
  "operador",
  "supervisor",
  "diretoria",
  "administrador",
] as const;

type Role = (typeof allowedRoles)[number];

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (req) => {
  // =========================================================
  // CORS
  // =========================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Método não permitido.",
      },
      405,
    );
  }

  try {
    console.log("=== create-user: início ===");

    // =========================================================
    // 1. CONFIGURAÇÃO
    // =========================================================

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error(
        "CONFIGURAÇÃO INCOMPLETA:",
        {
          hasUrl: Boolean(supabaseUrl),
          hasAnonKey: Boolean(anonKey),
          hasServiceRoleKey: Boolean(serviceRoleKey),
        },
      );

      return jsonResponse(
        {
          error:
            "Configuração do Supabase incompleta na Edge Function.",
        },
        500,
      );
    }

    console.log("Configuração do Supabase: OK");

    // =========================================================
    // 2. AUTENTICAÇÃO
    // =========================================================

    const authorization =
      req.headers.get("Authorization");

    if (!authorization) {
      console.error(
        "Nenhum header Authorization recebido.",
      );

      return jsonResponse(
        {
          error: "Usuário não autenticado.",
        },
        401,
      );
    }

    const supabaseUser = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseUser.auth.getUser();

    if (callerError) {
      console.error(
        "ERRO AO VALIDAR SESSÃO:",
        callerError,
      );

      return jsonResponse(
        {
          error:
            "Não foi possível validar sua sessão.",
        },
        401,
      );
    }

    if (!caller) {
      console.error(
        "Sessão válida não encontrou usuário.",
      );

      return jsonResponse(
        {
          error:
            "Sessão inválida ou expirada.",
        },
        401,
      );
    }

    console.log(
      "Usuário solicitante:",
      caller.id,
    );

    console.log(
      "E-mail solicitante:",
      caller.email,
    );

    // =========================================================
    // 3. CLIENTE ADMINISTRATIVO
    // =========================================================
    //
    // IMPORTANTE:
    // O service_role NÃO deve ser exposto ao frontend.
    // Ele existe somente dentro desta Edge Function.
    //

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization:
              `Bearer ${serviceRoleKey}`,
          },
        },
      },
    );

    console.log(
      "Cliente administrativo criado.",
    );

    // =========================================================
    // 4. VALIDAR PERFIL DO ADMINISTRADOR
    // =========================================================

    console.log(
      "Consultando perfil do solicitante...",
    );

    const {
      data: callerProfile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, name, email, role",
      )
      .eq("id", caller.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "ERRO AO CONSULTAR PERFIL:",
        profileError,
      );

      return jsonResponse(
        {
          error:
            "Não foi possível verificar as permissões do administrador.",
          details: profileError.message,
        },
        500,
      );
    }

    if (!callerProfile) {
      console.error(
        "Usuário autenticado não possui perfil:",
        caller.id,
      );

      return jsonResponse(
        {
          error:
            "Seu usuário está autenticado, mas não possui um perfil no sistema.",
        },
        403,
      );
    }

    console.log(
      "Perfil solicitante:",
      callerProfile.role,
    );

    if (
      callerProfile.role !==
      "administrador"
    ) {
      console.error(
        "Usuário sem permissão de administrador:",
        callerProfile.role,
      );

      return jsonResponse(
        {
          error:
            "Apenas administradores podem criar usuários.",
        },
        403,
      );
    }

    console.log(
      "Permissão de administrador: OK",
    );

    // =========================================================
    // 5. LER BODY
    // =========================================================

    console.log(
      "Lendo dados do novo usuário...",
    );

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch (error) {
      console.error(
        "ERRO AO LER JSON:",
        error,
      );

      return jsonResponse(
        {
          error:
            "Dados da solicitação inválidos.",
        },
        400,
      );
    }

    // =========================================================
    // 6. NORMALIZAR DADOS
    // =========================================================

    const name = String(
      body.name ?? "",
    ).trim();

    const email = String(
      body.email ?? "",
    )
      .trim()
      .toLowerCase();

    const password = String(
      body.password ?? "",
    );

    const role = String(
      body.role ?? "operador",
    ) as Role;

    console.log(
      "Dados recebidos:",
      {
        name,
        email,
        passwordLength:
          password.length,
        role,
      },
    );

    // =========================================================
    // 7. VALIDAR NOME
    // =========================================================

    if (
      !name ||
      name.length < 2
    ) {
      console.error(
        "Validação falhou: nome inválido.",
      );

      return jsonResponse(
        {
          error:
            "Informe um nome válido.",
        },
        400,
      );
    }

    // =========================================================
    // 8. VALIDAR E-MAIL
    // =========================================================

    if (
      !email ||
      !email.includes("@") ||
      !email.includes(".")
    ) {
      console.error(
        "Validação falhou: e-mail inválido.",
      );

      return jsonResponse(
        {
          error:
            "Informe um e-mail válido.",
        },
        400,
      );
    }

    // =========================================================
    // 9. VALIDAR SENHA
    // =========================================================

    if (
      password.length < 8
    ) {
      console.error(
        "Validação falhou: senha menor que 8 caracteres.",
      );

      return jsonResponse(
        {
          error:
            "A senha deve possuir pelo menos 8 caracteres.",
        },
        400,
      );
    }

    // =========================================================
    // 10. VALIDAR PERFIL
    // =========================================================

    if (
      !allowedRoles.includes(role)
    ) {
      console.error(
        "Validação falhou: perfil inválido:",
        role,
      );

      return jsonResponse(
        {
          error:
            "Perfil de usuário inválido.",
        },
        400,
      );
    }

    console.log(
      "Validações dos dados: OK",
    );

    // =========================================================
    // 11. VERIFICAR E-MAIL EXISTENTE
    // =========================================================

    console.log(
      "Verificando se o e-mail já existe...",
    );

    const {
      data: existingUsers,
      error: listUsersError,
    } =
      await supabaseAdmin.auth.admin.listUsers(
        {
          page: 1,
          perPage: 1000,
        },
      );

    if (listUsersError) {
      console.error(
        "ERRO AO LISTAR USUÁRIOS:",
        listUsersError,
      );

      return jsonResponse(
        {
          error:
            "Não foi possível verificar se o e-mail já está cadastrado.",
          details:
            listUsersError.message,
        },
        500,
      );
    }

    console.log(
      "Lista de usuários consultada.",
    );

    const emailAlreadyExists =
      existingUsers.users.some(
        (user) =>
          user.email?.toLowerCase() ===
          email,
      );

    if (emailAlreadyExists) {
      console.warn(
        "E-mail já cadastrado:",
        email,
      );

      return jsonResponse(
        {
          error:
            "Este e-mail já está cadastrado no sistema.",
        },
        409,
      );
    }

    console.log(
      "E-mail disponível para cadastro.",
    );

    // =========================================================
    // 12. CRIAR USUÁRIO NO SUPABASE AUTH
    // =========================================================

    console.log(
      "Criando usuário no Auth:",
      email,
      role,
    );

    const {
      data: created,
      error: createError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name,
          },
        },
      );

    if (createError) {
      console.error(
        "ERRO AO CRIAR USUÁRIO NO AUTH:",
        {
          message:
            createError.message,
          name:
            createError.name,
          status:
            createError.status,
        },
      );

      return jsonResponse(
        {
          error:
            createError.message ||
            "Não foi possível criar o usuário.",
        },
        400,
      );
    }

    if (!created.user) {
      console.error(
        "Auth não retornou o usuário criado.",
      );

      return jsonResponse(
        {
          error:
            "O Supabase não retornou o usuário criado.",
        },
        500,
      );
    }

    const userId =
      created.user.id;

    console.log(
      "Usuário Auth criado:",
      userId,
    );

    // =========================================================
    // 13. CRIAR PERFIL NO BANCO
    // =========================================================

    console.log(
      "Criando perfil do usuário:",
      userId,
    );

    const {
      data: createdProfile,
      error: profileUpsertError,
    } =
      await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: userId,
            name,
            email,
            role,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "id",
          },
        )
        .select(
          "id, email, name, role, created_at, updated_at",
        )
        .single();

    if (profileUpsertError) {
      console.error(
        "ERRO AO CRIAR PERFIL:",
        profileUpsertError,
      );

      // =======================================================
      // ROLLBACK
      // =======================================================

      console.log(
        "Executando rollback do usuário Auth...",
      );

      const {
        error: rollbackError,
      } =
        await supabaseAdmin.auth.admin.deleteUser(
          userId,
        );

      if (rollbackError) {
        console.error(
          "ERRO NO ROLLBACK:",
          rollbackError,
        );
      } else {
        console.log(
          "Rollback concluído.",
        );
      }

      return jsonResponse(
        {
          error:
            "O usuário foi criado no Auth, mas não foi possível criar o perfil no sistema.",
          details:
            profileUpsertError.message,
        },
        500,
      );
    }

    console.log(
      "Perfil criado com sucesso:",
      createdProfile,
    );

    // =========================================================
    // 14. AUDITORIA
    // =========================================================

    console.log(
      "Registrando auditoria...",
    );

    const {
      error: auditError,
    } =
      await supabaseAdmin
        .from("atividades")
        .insert({
          tipo: "usuario_criado",
          descricao:
            `Usuário ${name} (${email}) criado com perfil ${role}.`,
          modulo:
            "administrador",
          usuario_id:
            caller.id,
          usuario_name:
            callerProfile.name ||
            caller.email ||
            "Administrador",
        });

    if (auditError) {
      console.error(
        "ERRO AO REGISTRAR AUDITORIA:",
        auditError,
      );

      // Não desfazemos o usuário.
      // A criação principal já foi concluída.
    } else {
      console.log(
        "Auditoria registrada com sucesso.",
      );
    }

    // =========================================================
    // 15. SUCESSO
    // =========================================================

    console.log(
      "=== create-user: SUCESSO ===",
      userId,
    );

    return jsonResponse(
      {
        success: true,
        message:
          "Usuário criado com sucesso.",
        user:
          createdProfile ?? {
            id: userId,
            email,
            name,
            role,
          },
      },
      201,
    );
  } catch (error) {
    console.error(
      "ERRO INESPERADO NA CREATE-USER:",
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao criar usuário.",
      },
      500,
    );
  }
});