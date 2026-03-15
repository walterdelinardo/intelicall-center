import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractDigits(str: string): string {
  return (str || "").replace(/\D/g, "");
}

function normalizeJid(jid: string): string {
  return jid.replace(/@.*$/, "");
}

/** Compare two phone numbers by their last 10-11 digits (ignoring country code) */
function phonesMatch(a: string, b: string): boolean {
  const da = extractDigits(a);
  const db = extractDigits(b);
  if (da.length < 10 || db.length < 10) return false;
  const suffixLen = Math.min(11, Math.min(da.length, db.length));
  return da.slice(-suffixLen) === db.slice(-suffixLen);
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
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY")!;

    // Auth client to get user
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    // Service role client for DB operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user's clinic_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("id", user.id)
      .single();

    if (!profile?.clinic_id) {
      return new Response(JSON.stringify({ error: "User has no clinic" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clinicId = profile.clinic_id;

    // Get active inboxes
    const { data: inboxes } = await supabase
      .from("whatsapp_inboxes")
      .select("instance_name")
      .eq("clinic_id", clinicId)
      .eq("is_active", true);

    if (!inboxes || inboxes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active WhatsApp inboxes found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing clients for matching
    const { data: existingClients } = await supabase
      .from("clients")
      .select("id, name, phone, whatsapp, email")
      .eq("clinic_id", clinicId);

    const existing = existingClients || [];

    let totalContacts = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const inbox of inboxes) {
      // Fetch contacts from Evolution API
      let contacts: any[] = [];
      try {
        const res = await fetch(
          `${evolutionApiUrl}/chat/findContacts/${inbox.instance_name}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionApiKey,
            },
            body: JSON.stringify({ where: {} }),
          }
        );

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          console.error(`Non-JSON response from Evolution API for ${inbox.instance_name}: ${res.status}`);
          errors++;
          continue;
        }

        const body = await res.json();
        contacts = Array.isArray(body) ? body : [];
      } catch (e) {
        console.error(`Error fetching contacts for ${inbox.instance_name}:`, e);
        errors++;
        continue;
      }

      totalContacts += contacts.length;

      for (const contact of contacts) {
        try {
          const jid = contact.remoteJid || contact.id || "";
          // Skip groups and status broadcasts
          if (jid.includes("@g.us") || jid.includes("@broadcast") || jid === "status@broadcast") {
            skipped++;
            continue;
          }

          const phone = normalizeJid(jid);
          const pushName = contact.pushName || contact.name || "";

          if (!phone || phone.length < 10) {
            skipped++;
            continue;
          }

          // Find matching client
          const match = existing.find(
            (c) =>
              (c.whatsapp && phonesMatch(c.whatsapp, phone)) ||
              (c.phone && phonesMatch(c.phone, phone))
          );

          if (match) {
            // Update only empty fields
            const updates: Record<string, any> = {};
            if (!match.whatsapp) updates.whatsapp = phone;
            if (!match.name || match.name === phone) {
              if (pushName) updates.name = pushName;
            }

            if (Object.keys(updates).length > 0) {
              const { error } = await supabase
                .from("clients")
                .update(updates)
                .eq("id", match.id);
              if (error) {
                console.error("Update error:", error);
                errors++;
              } else {
                updated++;
              }
            } else {
              skipped++;
            }
          } else {
            // Create new client
            const { error } = await supabase.from("clients").insert({
              clinic_id: clinicId,
              name: pushName || phone,
              whatsapp: phone,
              lead_source: "whatsapp",
            });
            if (error) {
              // Might be a duplicate we missed
              console.error("Insert error:", error);
              errors++;
            } else {
              created++;
              // Add to existing array to prevent duplicates within same batch
              existing.push({ id: "new", name: pushName || phone, whatsapp: phone, phone: null, email: null });
            }
          }
        } catch (e) {
          console.error("Contact processing error:", e);
          errors++;
        }
      }
    }

    const result = { total_contacts: totalContacts, created, updated, skipped, errors };
    console.log("Sync result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Sync error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
