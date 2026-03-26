import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: get the first clinic_id from telegram_bots (single-clinic system)
async function getClinicId(supabase: any, chatId?: string) {
  const query = supabase.from("telegram_bots").select("clinic_id").eq("is_active", true).limit(1);
  if (chatId) query.eq("chat_id", chatId);
  const { data } = await query.single();
  return data?.clinic_id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();

    // --- Native Telegram update format (sent by Telegram webhook) ---
    if (body.update_id && body.message?.chat?.id) {
      const chatId = String(body.message.chat.id);
      const text = body.message.text || "";
      const fromUser = body.message.from;

      const { data: bot } = await supabase
        .from("telegram_bots")
        .select("id, clinic_id")
        .eq("chat_id", chatId)
        .eq("webhook_receive_messages", true)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (bot) {
        await supabase.from("telegram_notifications").insert({
          clinic_id: bot.clinic_id,
          bot_id: bot.id,
          message: text,
          direction: "incoming",
          notification_type: "message",
          metadata: {
            from: fromUser,
            update_id: body.update_id,
            chat_id: chatId,
          },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Action-based requests (clinicId is optional — auto-resolved) ---
    const { action, botId, period } = body;

    // --- Set Webhook ---
    if (action === "set_webhook") {
      if (!botId) {
        return new Response(JSON.stringify({ error: "Missing botId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: bot } = await supabase
        .from("telegram_bots")
        .select("bot_token, label")
        .eq("id", botId)
        .single();

      if (!bot) {
        return new Response(JSON.stringify({ error: "Bot not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
      const res = await fetch(`https://api.telegram.org/bot${bot.bot_token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const result = await res.json();

      return new Response(JSON.stringify({ ok: result.ok, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Remove Webhook ---
    if (action === "remove_webhook") {
      if (!botId) {
        return new Response(JSON.stringify({ error: "Missing botId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: bot } = await supabase
        .from("telegram_bots")
        .select("bot_token")
        .eq("id", botId)
        .single();

      if (!bot) {
        return new Response(JSON.stringify({ error: "Bot not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, { method: "POST" });
      const result = await res.json();

      return new Response(JSON.stringify({ ok: result.ok, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Send message (for n8n / external integrations) ---
    if (action === "send_message") {
      const { message, chatId, notificationType } = body;
      if (!message) {
        return new Response(JSON.stringify({ error: "Missing message" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const query = supabase
        .from("telegram_bots")
        .select("id, bot_token, chat_id, label, clinic_id")
        .eq("is_active", true);

      if (chatId) query.eq("chat_id", String(chatId));

      const { data: bots } = await query;

      if (!bots || bots.length === 0) {
        return new Response(JSON.stringify({ error: "No active bot found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let sent = 0;
      for (const bot of bots) {
        try {
          const targetChatId = chatId || bot.chat_id;
          const res = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetChatId, text: message, parse_mode: "Markdown" }),
          });

          if (res.ok) {
            sent++;
            await supabase.from("telegram_notifications").insert({
              clinic_id: bot.clinic_id,
              bot_id: bot.id,
              message,
              direction: "outgoing",
              notification_type: notificationType || "message",
              metadata: body.metadata || null,
            });
          }
        } catch (err) {
          console.error(`Error sending to bot ${bot.label}:`, err);
        }
      }

      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Receive message (manual call) ---
    if (action === "receive_message") {
      const { message, chatId } = body;
      if (!message) {
        return new Response(JSON.stringify({ error: "Missing message" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: bot } = await supabase
        .from("telegram_bots")
        .select("id, clinic_id")
        .eq("chat_id", String(chatId))
        .eq("webhook_receive_messages", true)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!bot) {
        return new Response(JSON.stringify({ error: "No active bot found for this chat" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("telegram_notifications").insert({
        clinic_id: bot.clinic_id,
        bot_id: bot.id,
        message,
        direction: "incoming",
        notification_type: "message",
        metadata: body.metadata || null,
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Stock alert ---
    if (action === "stock_alert") {
      const { itemName, currentQty, minQty } = body;
      if (!itemName) {
        return new Response(JSON.stringify({ error: "Missing itemName" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: bots } = await supabase
        .from("telegram_bots")
        .select("id, bot_token, chat_id, label, clinic_id")
        .eq("webhook_stock_alerts", true)
        .eq("is_active", true);

      if (!bots || bots.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const alertMsg = `⚠️ *Alerta de Estoque Baixo*\n\n📦 Produto: ${itemName}\n📊 Qtd Atual: ${currentQty}\n📉 Qtd Mínima: ${minQty}\n\n_Reponha o estoque o mais rápido possível._`;

      let sent = 0;
      for (const bot of bots) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: bot.chat_id, text: alertMsg, parse_mode: "Markdown" }),
          });

          if (res.ok) {
            sent++;
            await supabase.from("telegram_notifications").insert({
              clinic_id: bot.clinic_id,
              bot_id: bot.id,
              message: `Alerta de estoque baixo: ${itemName} (Atual: ${currentQty}, Mínimo: ${minQty})`,
              direction: "outgoing",
              notification_type: "stock_alert",
              metadata: { itemName, currentQty, minQty },
            });
          }
        } catch (err) {
          console.error(`Error sending to bot ${bot.label}:`, err);
        }
      }

      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Financial report ---
    if (action === "financial_report") {
      const { startDate, endDate } = period || {};
      if (!startDate || !endDate) {
        return new Response(JSON.stringify({ error: "Missing period (startDate/endDate)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get clinic_id from any active bot
      const resolvedClinicId = await getClinicId(supabase);
      if (!resolvedClinicId) {
        return new Response(JSON.stringify({ error: "No active bot/clinic found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: transactions } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("clinic_id", resolvedClinicId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      const txs = transactions || [];
      const receitas = txs.filter((t: any) => t.type === "receita");
      const despesas = txs.filter((t: any) => t.type === "despesa");
      const totalReceitas = receitas.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const totalDespesas = despesas.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const saldo = totalReceitas - totalDespesas;

      let reportMsg = `📊 *Relatório Financeiro*\n📅 ${startDate} a ${endDate}\n\n`;
      reportMsg += `💰 *Receitas:* ${receitas.length} transações — R$ ${totalReceitas.toFixed(2)}\n`;
      reportMsg += `💸 *Despesas:* ${despesas.length} transações — R$ ${totalDespesas.toFixed(2)}\n`;
      reportMsg += `📈 *Saldo:* R$ ${saldo.toFixed(2)}\n\n`;

      if (txs.length > 0) {
        reportMsg += `*Detalhamento:*\n`;
        for (const tx of txs.slice(0, 30)) {
          const emoji = (tx as any).type === "receita" ? "🟢" : "🔴";
          reportMsg += `${emoji} ${(tx as any).date} | ${(tx as any).description} | R$ ${Number((tx as any).amount).toFixed(2)} | ${(tx as any).status}\n`;
        }
        if (txs.length > 30) {
          reportMsg += `\n_...e mais ${txs.length - 30} transações_`;
        }
      }

      const { data: bots } = await supabase
        .from("telegram_bots")
        .select("id, bot_token, chat_id, label, clinic_id")
        .eq("clinic_id", resolvedClinicId)
        .eq("webhook_financial_reports", true)
        .eq("is_active", true);

      let sent = 0;
      if (bots && bots.length > 0) {
        for (const bot of bots) {
          try {
            const res = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: bot.chat_id, text: reportMsg, parse_mode: "Markdown" }),
            });
            if (res.ok) {
              sent++;
              await supabase.from("telegram_notifications").insert({
                clinic_id: bot.clinic_id,
                bot_id: bot.id,
                message: `Relatório financeiro de ${startDate} a ${endDate}: Receitas R$ ${totalReceitas.toFixed(2)}, Despesas R$ ${totalDespesas.toFixed(2)}, Saldo R$ ${saldo.toFixed(2)}`,
                direction: "outgoing",
                notification_type: "financial_report",
                metadata: { startDate, endDate, totalReceitas, totalDespesas, saldo, transactionCount: txs.length },
              });
            }
          } catch (err) {
            console.error(`Error sending report to bot ${bot.label}:`, err);
          }
        }
      }

      return new Response(JSON.stringify({
        ok: true, sent,
        summary: { totalReceitas, totalDespesas, saldo, count: txs.length },
        transactions: txs,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in telegram-webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
