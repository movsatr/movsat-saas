import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Secret",
};

const WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET") || "";

/**
 * Constant-time string comparison so the secret cannot be recovered by
 * measuring how long a rejected request takes.
 */
function secretMatches(candidate: string | null): boolean {
  if (!candidate) return false;
  const a = new TextEncoder().encode(candidate);
  const b = new TextEncoder().encode(WEBHOOK_SECRET);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Fail closed: with no secret configured this function must not serve
    // anything, because it runs with the service role key and bypasses RLS.
    if (!WEBHOOK_SECRET) {
      console.error("n8n-webhook: N8N_WEBHOOK_SECRET is not configured; refusing all requests");
      return new Response(
        JSON.stringify({ error: "Webhook is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Authenticate via header only. The secret is never accepted from the
    // query string, which is recorded in access logs and proxies.
    if (!secretMatches(req.headers.get("X-Webhook-Secret"))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const path = url.pathname.replace("/functions/v1/n8n-webhook", "");

    // GET /events — fetch recent events for n8n to consume
    if (req.method === "GET" && (path === "/events" || path === "" || path === "/")) {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
      const severity = url.searchParams.get("severity");
      const eventType = url.searchParams.get("event_type");

      let query = supabase.from("events").select("*").order("created_at", { ascending: false }).limit(limit);
      if (severity) query = query.eq("severity", severity);
      if (eventType) query = query.eq("event_type", eventType);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ events: data, count: data.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /queue — claim items from the automation queue for processing
    if (req.method === "GET" && path === "/queue") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);
      const processorId = url.searchParams.get("processor_id") || "n8n";

      // Fetch queued items
      const { data: items, error: fetchErr } = await supabase
        .from("automation_queue")
        .select("*")
        .eq("status", "queued")
        .order("scheduled_for", { ascending: true })
        .limit(limit);

      if (fetchErr) throw fetchErr;
      if (!items || items.length === 0) {
        return new Response(JSON.stringify({ items: [], count: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Claim each item by setting status to processing
      const claimed: typeof items = [];
      for (const item of items) {
        const { data: updated, error: updateErr } = await supabase
          .from("automation_queue")
          .update({
            status: "processing",
            locked_by: processorId,
            locked_at: new Date().toISOString(),
            attempts: item.attempts + 1,
          })
          .eq("id", item.id)
          .eq("status", "queued")
          .select()
          .single();

        if (!updateErr && updated) claimed.push(updated);
      }

      return new Response(JSON.stringify({ items: claimed, count: claimed.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /queue/:id/complete — mark a queue item as completed
    if (req.method === "POST" && path.startsWith("/queue/") && path.endsWith("/complete")) {
      const itemId = path.match(/\/queue\/([^/]+)\/complete/)?.[1];
      if (!itemId) return new Response(JSON.stringify({ error: "Invalid item ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const body = await req.json().catch(() => ({}));
      const { output } = body;

      // Log the execution
      const item = await supabase.from("automation_queue").select("rule_id").eq("id", itemId).single();
      if (item.data) {
        await supabase.from("automation_logs").insert({
          rule_id: item.data.rule_id,
          status: "sucesso",
          input: {},
          output: output || {},
          duration_ms: 0,
        });
      }

      const { error } = await supabase
        .from("automation_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", itemId);

      if (error) throw error;

      // Update rule last_execution
      if (item.data?.rule_id) {
        await supabase.from("automation_rules").update({ last_execution: new Date().toISOString() }).eq("id", item.data.rule_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /queue/:id/fail — mark a queue item as failed
    if (req.method === "POST" && path.startsWith("/queue/") && path.endsWith("/fail")) {
      const itemId = path.match(/\/queue\/([^/]+)\/fail/)?.[1];
      if (!itemId) return new Response(JSON.stringify({ error: "Invalid item ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const body = await req.json().catch(() => ({}));
      const { error: errorMsg } = body;

      const { data: item } = await supabase.from("automation_queue").select("*").eq("id", itemId).single();
      if (item) {
        const newAttempts = item.attempts + 1;
        const isDead = newAttempts >= item.max_attempts;
        await supabase.from("automation_queue").update({
          status: isDead ? "dead" : "queued",
          attempts: newAttempts,
          locked_by: null,
          locked_at: null,
          error_message: errorMsg || "Processing failed",
        }).eq("id", itemId);

        if (item.rule_id) {
          await supabase.from("automation_logs").insert({
            rule_id: item.rule_id,
            status: "falha",
            input: {},
            output: {},
            error_message: errorMsg || "Processing failed",
            duration_ms: 0,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, dead: item ? item.attempts + 1 >= item.max_attempts : false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /emit — emit a custom event from n8n
    if (req.method === "POST" && (path === "/emit" || path === "/events")) {
      const body = await req.json().catch(() => ({}));
      const { event_type, entity_type, entity_id, payload, severity, metadata } = body;

      if (!event_type) {
        return new Response(JSON.stringify({ error: "event_type is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: rpcResult, error: rpcErr } = await supabase.rpc("emit_event", {
        p_event_type: event_type,
        p_entity_type: entity_type || null,
        p_entity_id: entity_id || null,
        p_payload: payload || {},
        p_severity: severity || "info",
        p_metadata: metadata || {},
      });

      if (rpcErr) throw rpcErr;

      // Check if any automation rules match this event
      const { data: rules } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("trigger", event_type)
        .eq("status", "ativa");

      // Queue matching rules for processing
      if (rules && rules.length > 0) {
        const queueItems = rules.map((rule) => ({
          rule_id: rule.id,
          event_id: rpcResult,
          payload: { event_type, entity_type, entity_id, payload, severity },
          status: "queued",
          scheduled_for: new Date().toISOString(),
        }));
        await supabase.from("automation_queue").insert(queueItems);
      }

      return new Response(JSON.stringify({ event_id: rpcResult, queued_rules: rules?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /notify — create a notification from n8n
    if (req.method === "POST" && path === "/notify") {
      const body = await req.json().catch(() => ({}));
      const { target_role, user_id, title, message, type, related_entity_type, related_entity_id } = body;

      if (!title || !message) {
        return new Response(JSON.stringify({ error: "title and message are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase.from("notifications").insert({
        target_role: target_role || null,
        user_id: user_id || null,
        title,
        message,
        type: type || "info",
        related_entity_type: related_entity_type || null,
        related_entity_id: related_entity_id || null,
      }).select().single();

      if (error) throw error;

      return new Response(JSON.stringify({ notification: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /task — create a task from n8n
    if (req.method === "POST" && path === "/task") {
      const body = await req.json().catch(() => ({}));
      const { title, description, owner, priority, deadline, related_customer, related_os, related_tracker, financial_impact } = body;

      if (!title) {
        return new Response(JSON.stringify({ error: "title is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase.from("tasks").insert({
        title,
        description: description || null,
        owner: owner || "n8n",
        priority: priority || "normal",
        status: "pendente",
        deadline: deadline || null,
        related_customer: related_customer || null,
        related_os: related_os || null,
        related_tracker: related_tracker || null,
        financial_impact: financial_impact || 0,
      }).select().single();

      if (error) throw error;

      return new Response(JSON.stringify({ task: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /rules — list all active automation rules
    if (req.method === "GET" && path === "/rules") {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("status", "ativa")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ rules: data, count: data.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /scheduled — list scheduled tasks
    if (req.method === "GET" && path === "/scheduled") {
      const { data, error } = await supabase
        .from("scheduled_tasks")
        .select("*")
        .eq("status", "ativa")
        .order("next_run", { ascending: true });

      if (error) throw error;

      return new Response(JSON.stringify({ scheduled: data, count: data.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Health check
    if (req.method === "GET" && path === "/health") {
      return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found", available_endpoints: ["/events", "/queue", "/emit", "/notify", "/task", "/rules", "/scheduled", "/health"] }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Log the detail server-side; never return it. These errors come from
    // service-role queries and carry table, column and constraint names.
    console.error("n8n-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
