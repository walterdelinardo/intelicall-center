import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instanceName, inboxId, clinicId } = await req.json();
    const evoUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evoKey = Deno.env.get("EVOLUTION_API_KEY")!;

    if (action === "status") {
      const resp = await fetch(`${evoUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: evoKey },
      });
      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return new Response(JSON.stringify({ state: "unknown", error: "Non-JSON response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await resp.json();
      // Evolution API v2 returns { instance: { state: "open" | "close" | "connecting" } }
      const state = data?.instance?.state || data?.state || "unknown";
      return new Response(JSON.stringify({ state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "qrcode") {
      const resp = await fetch(`${evoUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: evoKey },
      });
      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return new Response(JSON.stringify({ error: "Non-JSON response from Evolution API" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await resp.json();
      // Returns base64 QR code or pairingCode
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "log_downtime") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      // Check if there's an open downtime (no up_at)
      const { data: openLog } = await supabase
        .from("instance_downtime_logs")
        .select("*")
        .eq("inbox_id", inboxId)
        .is("up_at", null)
        .order("down_at", { ascending: false })
        .limit(1)
        .single();

      if (openLog) {
        // Instance is back up - close the log
        const upAt = new Date();
        const downAt = new Date(openLog.down_at);
        const durationSeconds = Math.round((upAt.getTime() - downAt.getTime()) / 1000);
        await supabase
          .from("instance_downtime_logs")
          .update({ up_at: upAt.toISOString(), duration_seconds: durationSeconds })
          .eq("id", openLog.id);
        return new Response(JSON.stringify({ action: "closed", id: openLog.id, durationSeconds }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Instance went down - create new log
        const { data: newLog, error } = await supabase
          .from("instance_downtime_logs")
          .insert({ clinic_id: clinicId, inbox_id: inboxId, instance_name: instanceName })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ action: "opened", id: newLog.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
