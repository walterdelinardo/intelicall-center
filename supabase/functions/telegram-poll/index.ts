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

    // Fetch all active bots
    const { data: bots, error: botsError } = await supabase
      .from("telegram_bots")
      .select("id, bot_token, chat_id, clinic_id, last_update_offset")
      .eq("is_active", true);

    if (botsError || !bots || bots.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, message: "No active bots" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSynced = 0;

    for (const bot of bots) {
      try {
        const offset = bot.last_update_offset || 0;

        // Delete webhook first (getUpdates and webhooks are mutually exclusive)
        await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, { method: "POST" });

        // Short poll (timeout=0 for cron-based polling)
        const tgRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getUpdates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offset: offset > 0 ? offset : undefined,
            limit: 100,
            timeout: 0,
            allowed_updates: ["message"],
          }),
        });

        const tgData = await tgRes.json();
        if (!tgData.ok || !tgData.result?.length) continue;

        const updates = tgData.result;
        const chatId = String(bot.chat_id);
        const relevantUpdates = updates.filter(
          (u: any) => u.message && String(u.message.chat.id) === chatId
        );

        for (const update of relevantUpdates) {
          const msg = update.message;
          const text = msg.text || msg.caption || "";
          const fromUser = msg.from;

          // Check for duplicate by update_id
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

          if (!insertError) totalSynced++;
        }

        // Update offset
        const maxUpdateId = Math.max(...updates.map((u: any) => u.update_id));
        await supabase
          .from("telegram_bots")
          .update({ last_update_offset: maxUpdateId + 1 })
          .eq("id", bot.id);
      } catch (err) {
        console.error(`Error polling bot ${bot.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, synced: totalSynced }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in telegram-poll:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
