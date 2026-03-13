import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function findOrCreateConversation(
  supabase: any,
  clinicId: string,
  inboxId: string | null,
  remoteJid: string,
  updateData: Record<string, any>,
) {
  let query = supabase
    .from("whatsapp_conversations")
    .select("id, unread_count")
    .eq("clinic_id", clinicId)
    .eq("remote_jid", remoteJid);

  if (inboxId) {
    query = query.eq("inbox_id", inboxId);
  } else {
    query = query.is("inbox_id", null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("whatsapp_conversations")
      .update(updateData)
      .eq("id", existing.id)
      .select("id, unread_count")
      .single();
    if (error) throw error;
    return updated;
  }

  const { data: created, error } = await supabase
    .from("whatsapp_conversations")
    .insert({ clinic_id: clinicId, inbox_id: inboxId, remote_jid: remoteJid, ...updateData })
    .select("id, unread_count")
    .single();
  if (error) throw error;
  return created;
}

async function upsertMessage(supabase: any, messageData: Record<string, any>) {
  const { data: existing } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("message_id", messageData.message_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("whatsapp_messages").update(messageData).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("whatsapp_messages").insert(messageData);
  if (error) throw error;
}

interface NormalizedPayload {
  clinicId: string | null;
  instanceName: string;
  event: string;
  remoteJid: string;
  isFromMe: boolean;
  messageId: string;
  content: string;
  messageType: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mimeType: string | null;
  caption: string | null;
  fileName: string | null;
  mediaSeconds: number | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  thumbnailBase64: string | null;
  base64: string | null;
  contactName: string;
  messageTimestamp: number | null;
}

function normalizePayload(payload: any): NormalizedPayload | null {
  const source = payload?.raw || payload;
  const data = source?.data || source;
  const message = data?.message || data?.data?.message || {};

  const p = (snake: string, camel?: string): any => {
    if (source?.[snake] !== undefined) return source[snake];
    if (camel && source?.[camel] !== undefined) return source[camel];
    if (data?.[snake] !== undefined) return data[snake];
    if (camel && data?.[camel] !== undefined) return data[camel];
    return undefined;
  };

  const firstNonEmpty = (...values: any[]) => values.find((v) => v !== undefined && v !== null && v !== "");

  const instanceName = p("instance_name", "instanceName") || source?.instance || data?.instance || "";
  const event = p("event") || source?.event || data?.event || "";
  const clinicId = p("clinic_id", "clinicId") || null;

  const remoteJid = firstNonEmpty(
    p("remote_jid", "remoteJid"),
    data?.key?.remoteJid,
    data?.key?.remoteJidAlt,
    data?.data?.key?.remoteJid,
    source?.sender,
    "",
  );

  const rawFromMe = firstNonEmpty(p("from_me", "fromMe"), data?.key?.fromMe, data?.data?.key?.fromMe, false);
  const isFromMe = typeof rawFromMe === "string" ? rawFromMe === "true" : !!rawFromMe;

  const messageId = firstNonEmpty(p("message_id", "messageId"), data?.key?.id, data?.id, crypto.randomUUID());

  let content = p("content") || "";
  let messageType = p("message_type", "messageType") || "text";
  let mediaUrl: string | null = firstNonEmpty(p("media_url", "mediaUrl"), data?.mediaUrl, data?.url, null);
  let mediaType: string | null = p("media_type", "mediaType") || null;
  let mimeType: string | null = firstNonEmpty(p("mime_type", "mimeType"), data?.mimetype, null);
  let caption: string | null = p("caption") || null;
  let fileName: string | null = p("file_name", "fileName") || null;
  let mediaSeconds: number | null =
    p("media_seconds", "mediaSeconds") != null ? Number(p("media_seconds", "mediaSeconds")) : null;
  let mediaWidth: number | null =
    p("media_width", "mediaWidth") != null ? Number(p("media_width", "mediaWidth")) : null;
  let mediaHeight: number | null =
    p("media_height", "mediaHeight") != null ? Number(p("media_height", "mediaHeight")) : null;
  let thumbnailBase64: string | null = p("thumbnail_base64", "thumbnailBase64") || null;
  let base64: string | null = firstNonEmpty(p("base64"), source?.base64, data?.base64, data?.data?.base64, null);

  const attachment = Array.isArray(data?.attachments) && data.attachments.length > 0 ? data.attachments[0] : null;

  if (message?.conversation) {
    content = content || message.conversation;
    messageType = messageType === "text" ? "text" : messageType;
  } else if (message?.extendedTextMessage?.text) {
    content = content || message.extendedTextMessage.text;
    messageType = messageType === "text" ? "text" : messageType;
  } else if (message?.imageMessage) {
    messageType = "image";
    content = content || message.imageMessage.caption || "[Imagem]";
    caption = caption || message.imageMessage.caption || null;
    mimeType = mimeType || message.imageMessage.mimetype || null;
    mediaUrl = mediaUrl || message.imageMessage.url || null;
    mediaType = "image";
    mediaWidth = mediaWidth ?? (message.imageMessage.width ? Number(message.imageMessage.width) : null);
    mediaHeight = mediaHeight ?? (message.imageMessage.height ? Number(message.imageMessage.height) : null);
    thumbnailBase64 = thumbnailBase64 || message.imageMessage.jpegThumbnail || null;
  } else if (message?.audioMessage) {
    messageType = "audio";
    content = content || "[Áudio]";
    mimeType = mimeType || message.audioMessage.mimetype || null;
    mediaUrl = mediaUrl || message.audioMessage.url || null;
    mediaType = "audio";
    mediaSeconds = mediaSeconds ?? (message.audioMessage.seconds ? Number(message.audioMessage.seconds) : null);
  } else if (message?.videoMessage) {
    messageType = "video";
    content = content || message.videoMessage.caption || "[Vídeo]";
    caption = caption || message.videoMessage.caption || null;
    mimeType = mimeType || message.videoMessage.mimetype || null;
    mediaUrl = mediaUrl || message.videoMessage.url || null;
    mediaType = "video";
    mediaSeconds = mediaSeconds ?? (message.videoMessage.seconds ? Number(message.videoMessage.seconds) : null);
    mediaWidth = mediaWidth ?? (message.videoMessage.width ? Number(message.videoMessage.width) : null);
    mediaHeight = mediaHeight ?? (message.videoMessage.height ? Number(message.videoMessage.height) : null);
    thumbnailBase64 = thumbnailBase64 || message.videoMessage.jpegThumbnail || null;
  } else if (message?.documentMessage) {
    messageType = "document";
    fileName = fileName || message.documentMessage.fileName || null;
    content = content || fileName || "[Documento]";
    mimeType = mimeType || message.documentMessage.mimetype || null;
    mediaUrl = mediaUrl || message.documentMessage.url || null;
    mediaType = "document";
  } else if (message?.stickerMessage) {
    messageType = "sticker";
    content = content || "[Sticker]";
    mimeType = mimeType || message.stickerMessage.mimetype || null;
    mediaUrl = mediaUrl || message.stickerMessage.url || null;
    mediaType = "sticker";
  }

  if (attachment) {
    mediaUrl = mediaUrl || attachment.data_url || attachment.url || attachment.external_url || null;
    mimeType = mimeType || attachment.content_type || null;
    fileName = fileName || attachment.file_name || null;
    if (!mediaType && attachment.file_type) mediaType = attachment.file_type;
    if ((messageType === "text" || !messageType) && attachment.file_type) messageType = attachment.file_type;
    if (!content) content = fileName || "[Arquivo]";
  }

  if (!content) {
    content = data?.body || source?.body || "";
  }

  if (!mediaType && messageType !== "text") {
    mediaType = messageType;
  }

  const contactName = firstNonEmpty(
    p("push_name", "pushName"),
    data?.pushName,
    data?.senderName,
    data?.sender?.pushName,
    data?.sender?.name,
    "",
  );

  const ts = firstNonEmpty(
    p("timestamp", "messageTimestamp"),
    data?.messageTimestamp,
    data?.message_timestamp,
    source?.date_time ? Math.floor(new Date(source.date_time).getTime() / 1000) : null,
    null,
  );
  const messageTimestamp = ts != null ? Number(ts) : null;

  return {
    clinicId,
    instanceName,
    event,
    remoteJid,
    isFromMe,
    messageId,
    content,
    messageType,
    mediaUrl,
    mediaType,
    mimeType,
    caption,
    fileName,
    mediaSeconds,
    mediaWidth,
    mediaHeight,
    thumbnailBase64,
    base64,
    contactName,
    messageTimestamp,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.text();
    if (!body) {
      return new Response(JSON.stringify({ success: true, message: "No body provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log("Webhook received — top-level keys:", Object.keys(payload));
    if (payload.data && typeof payload.data === "object") {
      console.log("payload.data keys:", Object.keys(payload.data));
    }
    if (payload.raw && typeof payload.raw === "object") {
      console.log("payload.raw keys:", Object.keys(payload.raw));
    }

    const normalized = normalizePayload(payload);
    if (!normalized) {
      return new Response(JSON.stringify({ error: "Could not normalize payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(
      "Normalized:",
      JSON.stringify({
        event: normalized.event,
        instanceName: normalized.instanceName,
        remoteJid: normalized.remoteJid,
        content: normalized.content?.substring(0, 80),
        messageType: normalized.messageType,
        mediaType: normalized.mediaType,
        clinicId: normalized.clinicId,
        isFromMe: normalized.isFromMe,
        hasBase64: !!normalized.base64,
        hasMediaUrl: !!normalized.mediaUrl,
        mediaUrl: normalized.mediaUrl?.substring(0, 80) || null,
        mimeType: normalized.mimeType,
        caption: normalized.caption?.substring(0, 40) || null,
        mediaSeconds: normalized.mediaSeconds,
      }),
    );

    let inboxId: string | null = null;
    let clinicId = normalized.clinicId;

    if (normalized.instanceName) {
      const { data: inbox } = await supabase
        .from("whatsapp_inboxes")
        .select("id, clinic_id")
        .eq("instance_name", normalized.instanceName)
        .eq("is_active", true)
        .maybeSingle();

      if (inbox) {
        inboxId = inbox.id;
        if (!clinicId) clinicId = inbox.clinic_id;
      } else if (clinicId) {
        const { data: newInbox } = await supabase
          .from("whatsapp_inboxes")
          .insert({
            clinic_id: clinicId,
            instance_name: normalized.instanceName,
            label: normalized.instanceName,
          })
          .select("id")
          .single();
        inboxId = newInbox?.id || null;
      }
    }

    if (!clinicId) {
      return new Response(
        JSON.stringify({ error: "clinic_id could not be resolved. Provide clinic_id or a registered instance_name." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const event = normalized.event;

    if (event === "messages.upsert" || event === "message" || !event) {
      const {
        remoteJid,
        content,
        messageId,
        isFromMe,
        messageType,
        mediaUrl,
        mediaType,
        mimeType,
        caption,
        fileName,
        mediaSeconds,
        mediaWidth,
        mediaHeight,
        thumbnailBase64,
        base64,
        contactName,
        messageTimestamp,
      } = normalized;

      if (!remoteJid) {
        return new Response(JSON.stringify({ error: "remoteJid could not be extracted from payload" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const contactPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const displayName = contactName || contactPhone;
      const isGroup = remoteJid.includes("@g.us");

      const lastMessagePreview =
        messageType === "text"
          ? content
          : messageType === "image"
            ? caption || "📷 Imagem"
            : messageType === "audio"
              ? "🎵 Áudio"
              : messageType === "video"
                ? caption || "🎥 Vídeo"
                : messageType === "document"
                  ? fileName || "📄 Documento"
                  : messageType === "sticker"
                    ? "🏷️ Sticker"
                    : content || "[Sem conteúdo]";

      const conv = await findOrCreateConversation(supabase, clinicId, inboxId, remoteJid, {
        contact_name: displayName,
        contact_phone: contactPhone,
        is_group: isGroup,
        last_message: lastMessagePreview,
        last_message_at: new Date().toISOString(),
        status: "active",
      });

      const timestamp = messageTimestamp ? new Date(messageTimestamp * 1000).toISOString() : new Date().toISOString();

      await upsertMessage(supabase, {
        conversation_id: conv.id,
        message_id: messageId,
        content: content || null,
        message_type: messageType,
        is_from_me: isFromMe,
        sender_name: displayName,
        media_url: mediaUrl,
        media_type: mediaType,
        mime_type: mimeType,
        caption: caption,
        file_name: fileName,
        media_seconds: mediaSeconds,
        media_width: mediaWidth,
        media_height: mediaHeight,
        thumbnail_base64: thumbnailBase64,
        base64: base64,
        status: isFromMe ? "sent" : "received",
        timestamp,
      });

      if (!isFromMe) {
        await supabase
          .from("whatsapp_conversations")
          .update({ unread_count: (conv.unread_count ?? 0) + 1 })
          .eq("id", conv.id);
      }

      console.log("Message processed — conv:", conv.id, "type:", messageType, "inbox:", inboxId);
    }

    if (event === "messages.update" || event === "message.update") {
      const source = payload?.raw || payload;
      const data = source?.data || source;
      const messageId = data?.key?.id || data?.messageId || source?.message_id;
      const status = data?.update?.status || data?.status || source?.status;

      if (messageId && status !== undefined) {
        const statusMap: Record<number, string> = {
          0: "error",
          1: "pending",
          2: "sent",
          3: "delivered",
          4: "read",
        };

        await supabase
          .from("whatsapp_messages")
          .update({ status: statusMap[status] || String(status) })
          .eq("message_id", messageId);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
