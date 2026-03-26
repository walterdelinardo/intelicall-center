import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { botId } = await req.json();

    if (!botId) {
      return new Response(JSON.stringify({ error: "Missing botId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch bot info
    const { data: bot, error: botError } = await supabase
      .from("telegram_bots")
      .select("id, bot_token, chat_id, clinic_id, last_update_offset")
      .eq("id", botId)
      .eq("is_active", true)
      .single();

    if (botError || !bot) {
      return new Response(JSON.stringify({ error: "Bot not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const offset = bot.last_update_offset || 0;

    // Delete any active webhook first (getUpdates and webhooks are mutually exclusive)
    await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, { method: "POST" });

    // Call Telegram getUpdates
    const tgRes = await fetch(
      `https://api.telegram.org/bot${bot.bot_token}/getUpdates`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset: offset > 0 ? offset : undefined,
          limit: 100,
          allowed_updates: ["message"],
        }),
      }
    );

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return new Response(JSON.stringify({ error: "Telegram API error", details: tgData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates = tgData.result || [];

    if (updates.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter messages for the configured chat_id
    const chatId = String(bot.chat_id);
    const relevantUpdates = updates.filter(
      (u: any) => u.message && String(u.message.chat.id) === chatId
    );

    let inserted = 0;

    for (const update of relevantUpdates) {
      const msg = update.message;
      const text = msg.text || msg.caption || "";
      const fromUser = msg.from;

      // Check for duplicate by update_id in metadata
      const { data: existing } = await supabase
        .from("telegram_notifications")
        .select("id")
        .eq("bot_id", bot.id)
        .contains("metadata", { update_id: update.update_id })
        .limit(1);

      if (existing && existing.length > 0) continue;

      const { error: insertError } = await supabase
        .from("telegram_notifications")
        .insert({
          clinic_id: bot.clinic_id,
          bot_id: bot.id,
          message: text || "(sem texto)",
          direction: "incoming",
          notification_type: "message",
          metadata: {
            update_id: update.update_id,
            from: fromUser,
            chat_id: chatId,
            date: msg.date,
          },
        });

      if (!insertError) inserted++;
    }

    // Update offset to latest update_id + 1
    const maxUpdateId = Math.max(...updates.map((u: any) => u.update_id));
    await supabase
      .from("telegram_bots")
      .update({ last_update_offset: maxUpdateId + 1 })
      .eq("id", bot.id);

    return new Response(
      JSON.stringify({ ok: true, synced: inserted, total_updates: updates.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in telegram-sync:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
