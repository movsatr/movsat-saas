import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://movsat-saas.vercel.app",
  "https://movsat-saas-6v5hmpbk9-mov4.vercel.app",
  "http://localhost:5173",
]);

const RESOURCE_PATHS: Record<string, (id: string) => string> = {
  vehicles: () => "/vehicles/",
  devices: () => "/devices/",
  users: () => "/users/",
  tracking: (id) => "/vehicles/" + encodeURIComponent(id) + "/tracking/",
  trajectories: (id) => "/vehicles/" + encodeURIComponent(id) + "/trajectories/",
  vehicle_devices: (id) => "/vehicles/" + encodeURIComponent(id) + "/associations/devices",
  vehicle_users: (id) => "/vehicles/" + encodeURIComponent(id) + "/associations/users",
};

function corsHeaders(req: Request): Headers {
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
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
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(req) });
}

function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "GET") return jsonResponse(req, 405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const softruckToken = Deno.env.get("SOFTRUCK_API_TOKEN") ?? Deno.env.get("SOFTRUCK_V5_API_TOKEN");
  const softruckPublicKey = Deno.env.get("SOFTRUCK_API_PUBLIC_KEY");
  const softruckBaseUrl = (Deno.env.get("SOFTRUCK_API_BASE_URL") ?? "https://api.softruck.com/v2").replace(/\/$/, "");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(req, 500, { error: "server_configuration_missing" });
  }
  if (!softruckToken) {
    return jsonResponse(req, 503, {
      error: "softruck_api_token_not_configured",
      required_secret: "SOFTRUCK_API_TOKEN",
    });
  }

  const bearer = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return jsonResponse(req, 401, { error: "session_required" });

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser(bearer);
    if (authError || !user) return jsonResponse(req, 401, { error: "invalid_or_expired_session" });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await adminClient
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) {
      console.error("Softruck role check failed:", profileError.message);
      return jsonResponse(req, 500, { error: "profile_check_failed" });
    }
    if (profile?.role !== "administrador" && profile?.role !== "diretoria") {
      return jsonResponse(req, 403, { error: "administrator_required" });
    }

    const incoming = new URL(req.url);
    const resource = incoming.searchParams.get("resource") ?? "trajectories";
    const pathBuilder = RESOURCE_PATHS[resource];
    if (!pathBuilder) {
      return jsonResponse(req, 400, {
        error: "unsupported_resource",
        allowed: Object.keys(RESOURCE_PATHS),
      });
    }

    const id = incoming.searchParams.get("id") ?? "";
    if ((resource === "vehicle_devices" || resource === "vehicle_users" || resource === "tracking" || resource === "trajectories") &&
        (!id || !/^[a-zA-Z0-9]{15}$/.test(id))) {
      return jsonResponse(req, 400, { error: "valid_vehicle_id_required" });
    }

    const page = Number(incoming.searchParams.get("page") ?? "1");
    const limit = Number(incoming.searchParams.get("limit") ?? "100");
    if (!Number.isInteger(page) || page < 1) return jsonResponse(req, 400, { error: "invalid_page" });
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return jsonResponse(req, 400, { error: "invalid_limit", min: 1, max: 100 });
    }

    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("limit", String(limit));

    if (resource === "vehicles") {
      query.set("attributes", "batch,plate,code,vin,type,brand,model,year,description,registration_number,color,deactivated_at");
      query.set("includes[devices]", "*");
      query.set("includes[users]", "*");
    } else if (resource === "devices") {
      query.set("attributes", "name,imei,batch,created_at,updated_at,code");
    } else if (resource === "users") {
      query.set("attributes", "username,email,name,phone1,phone2,document_number,cpf,created_at,updated_at,deactivated_at");
    } else if (resource === "vehicle_devices") {
      query.set("attributes", "created_at,deleted_at,is_main_device");
      query.set("includes[device]", "*");
    } else if (resource === "vehicle_users") {
      query.set("attributes", "created_at,deleted_at,nature");
      query.set("includes[user]", "*");
    } else if (resource === "tracking") {
      const deviceId = incoming.searchParams.get("device_id") ?? "";
      if (!/^[a-zA-Z0-9]{15}$/.test(deviceId)) {
        return jsonResponse(req, 400, { error: "valid_device_id_required" });
      }
      query.set("format", "JSON");
      const trackingUrl = new URL(softruckBaseUrl + "/vehicles/" + encodeURIComponent(id) + "/tracking/" + encodeURIComponent(deviceId));
      for (const [key, value] of query) trackingUrl.searchParams.set(key, value);
    } else if (resource === "trajectories") {
      const start = incoming.searchParams.get("from");
      const end = incoming.searchParams.get("to");
      if (!validDate(start) || !validDate(end) || start > end) {
        return jsonResponse(req, 400, {
          error: "invalid_date_range",
          required: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" },
        });
      }
      const days = (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000;
      if (days > 31) return jsonResponse(req, 400, { error: "date_range_too_large", max_days: 32 });
      query.set("includes[device]", "*");
      query.set("filters[date][gte]", start.replaceAll("-", ""));
      query.set("filters[date][lte]", end.replaceAll("-", ""));
    }

    const upstreamUrl = new URL(softruckBaseUrl + pathBuilder(id));
    for (const [key, value] of query) upstreamUrl.searchParams.set(key, value);

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          Authorization: "Bearer " + softruckToken,
          Accept: "application/json",
          ...(softruckPublicKey ? { "public-key": softruckPublicKey } : {}),
        },
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown upstream error");
      console.error("Softruck API connection failed", JSON.stringify({ name: err.name, message: err.message }));
      return jsonResponse(req, 502, { error: "softruck_connection_failed" });
    }

    if (!upstream.ok) {
      console.error("Softruck API returned non-2xx", JSON.stringify({ resource, status: upstream.status }));
      return jsonResponse(req, 502, {
        error: "softruck_request_failed",
        resource,
        upstream_status: upstream.status,
        hint: upstream.status === 401 || upstream.status === 403
          ? "Verifique o token Softruck, o SOFTRUCK_API_PUBLIC_KEY (se exigido pela conta) e a URL de produção configurada."
          : undefined,
      });
    }
    if (!(upstream.headers.get("content-type") ?? "").includes("application/json")) {
      return jsonResponse(req, 502, { error: "softruck_unexpected_content_type", resource });
    }

    let data: unknown;
    try {
      data = await upstream.json();
    } catch {
      return jsonResponse(req, 502, { error: "softruck_invalid_json", resource });
    }

    return jsonResponse(req, 200, {
      ok: true,
      source: "softruck_api_v2",
      resource,
      endpoint: pathBuilder(id),
      query: { page, limit },
      data,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown error");
    console.error("Unexpected Softruck function error", JSON.stringify({ name: err.name, message: err.message }));
    return jsonResponse(req, 500, { error: "softruck_proxy_unavailable" });
  }
});