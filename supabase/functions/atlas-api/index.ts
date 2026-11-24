import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://movsat-saas.vercel.app",
  "https://movsat-saas-6v5hmpbk9-mov4.vercel.app",
  "https://movsat-saas-fa17s2r8b-mov4.vercel.app",
  "https://movsat-saas-git-movsatr-integrar-associados-rastrea-25a551-mov4.vercel.app",
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
    params: ["id", "contract_id", "vehicle_id", "object_type", "contract_status", "implemento_id", "vehicle_chassi", "vehicle_renavam", "vehicle_plate", "person_id", "person_cpf_cnpj", "page", "page_size"],
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
  const isMovSatPreviewOrigin = origin !== null &&
    /^https:\/\/movsat-saas-[a-z0-9-]+-mov4\.vercel\.app$/i.test(origin);
  if (origin && (ALLOWED_ORIGINS.has(origin) || isMovSatPreviewOrigin)) {
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

    if (profile?.role !== "administrador" && profile?.role !== "diretoria") {
      return jsonResponse(req, 403, { error: "administrator_required" });
    }

    const incomingUrl = new URL(req.url);
    const resourceName = incomingUrl.searchParams.get("resource") ?? "person";

    if (resourceName === "diagnostics") {
      const targets = [
        { name: "softruck_contract_objects", path: "/softruck/contract_objects/" },
        { name: "contract_object_nested", path: "/contract/contract_object/nested/" },
        { name: "contract_object", path: "/contract/contract_object/" },
        { name: "contract_object_product", path: "/contract/contract_object_product/" },
        { name: "contract_object_vehicle", path: "/contract/contract_object_vehicle/" },
        { name: "contracts", path: "/contract/" },
      ];
      const summarize = async (name: string, path: string, params: Record<string, string> = {}) => {
        const url = new URL(`https://atlas-api.mutualignit.com.br/public_api/v2${path}`);
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
        url.searchParams.set("page", "1");
        url.searchParams.set("page_size", "100");
        try {
          const response = await fetch(url, {
            method: "GET",
            headers: { Authorization: `Bearer ${atlasToken}`, Accept: "application/json" },
            signal: AbortSignal.timeout(30000),
          });
          const body = await response.text();
          let payload: unknown = null;
          try { payload = JSON.parse(body); } catch { /* no JSON body */ }
          const root = payload && typeof payload === "object" && !Array.isArray(payload)
            ? payload as Record<string, unknown> : null;
          const nested = root?.data && typeof root.data === "object" && !Array.isArray(root.data)
            ? root.data as Record<string, unknown> : null;
          const rows = Array.isArray(payload) ? payload
            : Array.isArray(root?.results) ? root.results
            : Array.isArray(root?.data) ? root.data
            : Array.isArray(nested?.results) ? nested.results
            : Array.isArray(nested?.data) ? nested.data : [];
          const rawCount = root?.count ?? root?.total ?? nested?.count ?? nested?.total;
          const first = rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0])
            ? rows[0] as Record<string, unknown> : null;
          const errorHint = !response.ok && root
            ? [root.detail, root.error, root.message].find((value) => typeof value === "string") as string | undefined
            : undefined;
          return {
            resource: name,
            httpStatus: response.status,
            count: rawCount == null ? null : Number(rawCount),
            pageRows: rows.length,
            topLevelKeys: root ? Object.keys(root).sort() : [],
            dataKeys: nested ? Object.keys(nested).sort() : [],
            sampleFields: first ? Object.keys(first).sort() : [],
            ...(errorHint ? { errorHint: errorHint.slice(0, 240) } : {}),
          };
        } catch (error) {
          return { resource: name, httpStatus: 0, count: null, pageRows: null, topLevelKeys: [], dataKeys: [], sampleFields: [], errorHint: error instanceof Error ? error.name : "unknown" };
        }
      };

      const diagnostics = await Promise.all(targets.map((target) =>
        summarize(target.name, target.path)
      ));

      const sampleUrl = new URL("https://atlas-api.mutualignit.com.br/public_api/v2/contract/contract_object/nested/");
      sampleUrl.searchParams.set("page", "1");
      sampleUrl.searchParams.set("page_size", "1");
      let sampleObject: Record<string, unknown> | null = null;
      try {
        const sampleResponse = await fetch(sampleUrl, {
          headers: { Authorization: `Bearer ${atlasToken}`, Accept: "application/json" },
          signal: AbortSignal.timeout(30000),
        });
        const samplePayload = await sampleResponse.json();
        const root = samplePayload && typeof samplePayload === "object" && !Array.isArray(samplePayload)
          ? samplePayload as Record<string, unknown> : null;
        const nested = root?.data && typeof root.data === "object" && !Array.isArray(root.data)
          ? root.data as Record<string, unknown> : null;
        const rows = Array.isArray(root?.results) ? root.results
          : Array.isArray(root?.data) ? root.data
          : Array.isArray(nested?.results) ? nested.results
          : Array.isArray(nested?.data) ? nested.data : [];
        sampleObject = rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0])
          ? rows[0] as Record<string, unknown> : null;
      } catch { /* base route diagnostic already reports transport status */ }

      if (sampleObject) {
        const objectId = typeof sampleObject.id === "string" || typeof sampleObject.id === "number"
          ? String(sampleObject.id) : "";
        const contractId = typeof sampleObject.contract_id === "string" || typeof sampleObject.contract_id === "number"
          ? String(sampleObject.contract_id) : "";
        const probes = [
          ...(objectId ? [{ key: "object_id", value: objectId }] : []),
          ...(objectId ? [{ key: "contract_object_id", value: objectId }] : []),
          ...(contractId ? [{ key: "contract_id", value: contractId }] : []),
        ];
        const productProbes = await Promise.all(probes.map((probe) =>
          summarize(`contract_object_product?filter=${probe.key}`, "/contract/contract_object_product/", { [probe.key]: probe.value })
        ));
        diagnostics.push(...productProbes);
        const implementos = sampleObject.implementos_data;
        diagnostics.push({
          resource: "nested_object_product_shape",
          httpStatus: 200,
          count: null,
          pageRows: null,
          topLevelKeys: [],
          dataKeys: [],
          sampleFields: [
            `implementos_data_type=${Array.isArray(implementos) ? "array" : implementos === null ? "null" : typeof implementos}`,
            ...(Array.isArray(implementos) ? [`implementos_data_length=${implementos.length}`] : []),
            ...(implementos && typeof implementos === "object" && !Array.isArray(implementos)
              ? Object.keys(implementos as Record<string, unknown>).map((key) => `implementos_data.${key}`) : []),
            `implementos_ids_type=${Array.isArray(sampleObject.implementos_ids) ? "array" : typeof sampleObject.implementos_ids}`,
            ...(Array.isArray(sampleObject.implementos_ids) ? [`implementos_ids_length=${sampleObject.implementos_ids.length}`] : []),
          ],
        });
      }
      return jsonResponse(req, 200, { ok: true, resource: "diagnostics", data: { diagnostics } });
    }

    const resource = RESOURCES[resourceName];

    if (!resource) {
      return jsonResponse(req, 400, {
        error: "invalid_resource",
        allowed: Object.keys(RESOURCES),
      });
    }

    const integrationSupplierId = resourceName === "integrations_contract_objects"
      ? Deno.env.get("ATLAS_INTEGRATION_SUPPLIER_ID")
      : null;
    if (resourceName === "integrations_contract_objects" && !integrationSupplierId) {
      return jsonResponse(req, 500, { error: "integration_supplier_not_configured" });
    }

    const upstreamUrl = new URL(
      `https://atlas-api.mutualignit.com.br/public_api/v2${resource.path}`,
    );

    for (const param of resource.params) {
      for (const value of incomingUrl.searchParams.getAll(param)) {
        upstreamUrl.searchParams.append(param, value);
      }
    }
    if (integrationSupplierId) {
      upstreamUrl.searchParams.set("supplier_id", integrationSupplierId);
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
        errorName: err.name,
        isTimeout,
      }));
      return jsonResponse(req, 502, {
        error: isTimeout ? "atlas_timeout" : "atlas_connection_failed",
        resource: resourceName,
      });
    }

    if (!upstream.ok) {
      console.error("Falha na API Atlas", JSON.stringify({
        resource: resourceName,
        status: upstream.status,
      }));
      return jsonResponse(req, 502, {
        error: "atlas_request_failed",
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
      return jsonResponse(req, 200, { ok: true, resource: resourceName, data });
    } catch {
      return jsonResponse(req, 502, { error: "atlas_invalid_json" });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Erro desconhecido");
    console.error("Falha inesperada na função Atlas", err.name);
    return jsonResponse(req, 502, { error: "atlas_unavailable" });
  }
});
