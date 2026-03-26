import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
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

    // Delete webhooks for all bots upfront
    for (const bot of bots) {
      try {
        await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, { method: "POST" });
      } catch (e) {
        console.error(`Failed to delete webhook for bot ${bot.id}:`, e);
      }
    }

    // Long-polling loop
    while (true) {
      const elapsed = Date.now() - startTime;
      const remainingMs = MAX_RUNTIME_MS - elapsed;

      if (remainingMs < MIN_REMAINING_MS) break;

      // Dynamic timeout: up to 50s, but never exceed remaining time minus buffer
      const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
      if (timeout < 1) break;

      let anyUpdates = false;

      for (const bot of bots) {
        try {
          const offset = bot.last_update_offset || 0;

          const tgRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getUpdates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              offset: offset > 0 ? offset : undefined,
              limit: 100,
              timeout: bots.length === 1 ? timeout : 0, // Only long-poll if single bot
              allowed_updates: ["message"],
            }),
          });

          const tgData = await tgRes.json();
          if (!tgData.ok || !tgData.result?.length) continue;

          anyUpdates = true;
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

          // Update in-memory offset for next iteration
          bot.last_update_offset = maxUpdateId + 1;
        } catch (err) {
          console.error(`Error polling bot ${bot.id}:`, err);
        }
      }

      // For multiple bots (short poll), only loop if we got updates
      if (bots.length > 1 && !anyUpdates) {
        // Wait 2s before next round for multi-bot short poll
        await new Promise((r) => setTimeout(r, 2000));
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
