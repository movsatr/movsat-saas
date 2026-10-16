import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://movsat-saas.vercel.app",
  "https://movsat-saas-6v5hmpbk9-mov4.vercel.app",
  "http://localhost:5173",
]);

const RESOURCES: Record<string, { path: string; params: string[] }> = {
  person: {
    path: "/person/",
    params: ["id", "cpf_cnpj", "person_type", "gender"],
  },
  contract_object_product: {
    path: "/contract/contract_object_product/",
    params: ["object_id", "product_id", "created_at", "page", "page_size", "quotation_token", "contract_id", "contract_object_id", "quotation_object_id"],
  },
  contract_object: {
    path: "/contract/contract_object/",
    params: ["id", "contract_id", "vehicle_id", "object_type", "status", "created_at", "updated_at", "contract_status", "implemento_id", "vehicle_chassi", "vehicle_renavam", "vehicle_plate", "person_id", "person_cpf_cnpj", "page", "page_size"],
  },
  contract_object_nested: {
    path: "/contract/contract_object/nested/",
    params: ["id", "contract_id", "vehicle_id", "object_type", "status", "created_at__gte", "created_at__lte", "updated_at__gte", "updated_at__lte", "contract_status", "implemento_id", "vehicle_chassi", "vehicle_renavam", "vehicle_plate", "person_id", "person_cpf_cnpj", "page", "page_size"],
  },
  contract_object_vehicle: {
    path: "/contract/contract_object_vehicle/",
    params: ["id", "contract_id", "vehicle_id", "object_type", "status", "created_at__gte", "created_at__lte", "updated_at__gte", "updated_at__lte", "contract_status", "implemento_id", "vehicle_chassi", "vehicle_renavam", "vehicle_plate", "person_id", "person_cpf_cnpj", "page", "page_size"],
  },
  integrations_contract_objects: {
    path: "/integrations/contract_objects/",
    params: ["id", "contract_id", "vehicle_id", "object_type", "contract_status", "implemento_id", "vehicle_chassi", "vehicle_renavam", "vehicle_plate", "person_id", "person_cpf_cnpj", "page", "page_size", "supplier_id"],
  },
  softruck_contract_objects: {
    path: "/softruck/contract_objects/",
    params: ["id", "contract_id", "vehicle_id", "object_type", "contract_status", "implemento_id", "vehicle_chassi", "vehicle_renavam", "vehicle_plate", "person_id", "person_cpf_cnpj", "page", "page_size"],
  },
  contracts: {
    path: "/contract/",
    params: [
      "id", "contract_status", "contract_origin",
      "created_at__gte", "created_at__lte",
      "updated_at__gte", "updated_at__lte",
      "page", "page_size",
    ],
  },
  invoices: {
    path: "/invoice/",
    params: [
      "id", "transaction_id", "contract_id", "reference_id",
      "invoice_type", "invoice_status", "invoice_status__in",
      "payment_type", "payment_date__gte", "payment_date__lte",
      "created_at__gte", "created_at__lte",
      "updated_at__gte", "updated_at__lte",
      "expiration_date__gte", "expiration_date__lte",
      "credit_date__gte", "credit_date__lte",
      "cpf_cnpj", "plate", "page", "page_size",
    ],
  },
  billets: {
    path: "/invoice/invoice_billet/",
    params: [
      "id", "numero_documento", "nosso_numero",
      "created_at__gte", "created_at__lte",
      "updated_at__gte", "updated_at__lte",
      "contract_id", "cpf_cnpj", "page", "page_size",
    ],
  },
  pix: {
    path: "/invoice/invoice_pix/",
    params: [
      "id", "created_at__gte", "created_at__lte",
      "updated_at__gte", "updated_at__lte", "page", "page_size",
    ],
  },
};

function corsHeaders(req: Request): Headers {
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
  });

  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function jsonResponse(req: Request, status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(req),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "GET") {
    return jsonResponse(req, 405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const atlasToken = Deno.env.get("ATLAS_API_TOKEN");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !atlasToken) {
    return jsonResponse(req, 500, { error: "server_configuration_missing" });
  }

  const match = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return jsonResponse(req, 401, { error: "session_required" });
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authError } =
      await userClient.auth.getUser(match[1]);

    if (authError || !user) {
      return jsonResponse(req, 401, { error: "invalid_or_expired_session" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Falha ao verificar perfil:", profileError.message);
      return jsonResponse(req, 500, { error: "profile_check_failed" });
    }

    if (profile?.role !== "administrador") {
      return jsonResponse(req, 403, { error: "administrator_required" });
    }

    const incomingUrl = new URL(req.url);
    const resourceName = incomingUrl.searchParams.get("resource") ?? "person";
    const resource = RESOURCES[resourceName];

    if (!resource) {
      return jsonResponse(req, 400, {
        error: "invalid_resource",
        allowed: Object.keys(RESOURCES),
      });
    }

    const upstreamUrl = new URL(
      `https://atlas-api.mutualignit.com.br/public_api/v2${resource.path}`,
    );

    for (const param of resource.params) {
      for (const value of incomingUrl.searchParams.getAll(param)) {
        upstreamUrl.searchParams.append(param, value);
      }
    }

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${atlasToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown upstream error");
      const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
      console.error("Atlas upstream fetch failed", JSON.stringify({
        resource: resourceName,
        path: resource.path,
        errorName: err.name,
        errorMessage: err.message,
        isTimeout,
      }));
      return jsonResponse(req, 502, {
        error: isTimeout ? "atlas_timeout" : "atlas_connection_failed",
        resource: resourceName,
      });
    }

    if (!upstream.ok) {
      const upstreamErrorBody = (await upstream.clone().text()).slice(0, 800);
      console.error("Falha na API Atlas", JSON.stringify({
        resource: resourceName,
        path: resource.path,
        status: upstream.status,
        responseBody: upstreamErrorBody,
      }));
      return jsonResponse(req, 502, {
        error: `atlas_request_failed (HTTP ${upstream.status}): ${upstreamErrorBody || "sem detalhe retornado"}`,
        atlas_status: upstream.status,
      });
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return jsonResponse(req, 502, { error: "atlas_unexpected_content_type" });
    }

    const body = await upstream.text();

    try {
      const data = JSON.parse(body);
      if (resourceName === "softruck_contract_objects") {
        const obj = data && typeof data === "object" ? data as Record<string, unknown> : null;
        const nested = obj?.data && typeof obj.data === "object" ? obj.data as Record<string, unknown> : null;
        const rows = Array.isArray(data) ? data : Array.isArray(obj?.results) ? obj.results : Array.isArray(nested?.results) ? nested.results : Array.isArray(nested?.data) ? nested.data : [];
        console.log("Atlas Softruck diagnostic", JSON.stringify({
          topLevelType: Array.isArray(data) ? "array" : typeof data,
          topLevelKeys: obj ? Object.keys(obj) : [],
          nestedKeys: nested ? Object.keys(nested) : [],
          count: obj?.count ?? nested?.count ?? obj?.total ?? nested?.total ?? null,
          rowCount: rows.length,
          firstRowKeys: rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0] as Record<string, unknown>) : [],
        }));
      }
      return jsonResponse(req, 200, { ok: true, resource: resourceName, data });
    } catch {
      return jsonResponse(req, 502, { error: "atlas_invalid_json" });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Erro desconhecido");
    console.error("Falha inesperada na função Atlas", JSON.stringify({
      name: err.name,
      message: err.message,
      stack: err.stack,
    }));
    return jsonResponse(req, 502, { error: "atlas_unavailable" });
  }
});
