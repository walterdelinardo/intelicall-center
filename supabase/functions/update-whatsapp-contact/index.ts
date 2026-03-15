import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractDigits(str: string): string {
  return (str || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id } = await req.json();
    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get client data
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, whatsapp, phone, clinic_id")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientPhone = extractDigits(client.whatsapp || client.phone || "");
    if (clientPhone.length < 10) {
      return new Response(JSON.stringify({ updated_conversations: 0, reason: "No valid phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find matching conversations by phone suffix
    const suffix = clientPhone.slice(-11);

    const { data: conversations } = await supabase
      .from("whatsapp_conversations")
      .select("id, remote_jid")
      .eq("clinic_id", client.clinic_id);

    if (!conversations || conversations.length === 0) {
      return new Response(JSON.stringify({ updated_conversations: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Match by suffix
    const matching = conversations.filter((c) => {
      const jidDigits = extractDigits(c.remote_jid.replace(/@.*$/, ""));
      return jidDigits.length >= 10 && jidDigits.slice(-11) === suffix;
    });

    let updatedCount = 0;
    for (const conv of matching) {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({
          contact_name: client.name,
          contact_phone: clientPhone,
        })
        .eq("id", conv.id);

      if (!error) updatedCount++;
    }

    console.log(`Updated ${updatedCount} conversations for client ${client_id}`);

    return new Response(JSON.stringify({ updated_conversations: updatedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
