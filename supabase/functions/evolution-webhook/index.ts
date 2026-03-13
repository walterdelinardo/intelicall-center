import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Payload format detection ────────────────────────────────────────

type PayloadFormat = "raw" | "flat" | "chatwoot" | "unknown";

function detectPayloadFormat(payload: any): PayloadFormat {
  // Chatwoot events
  if (
    payload?.event &&
    typeof payload.event === "string" &&
    ["message_created", "message_updated", "conversation_created", "conversation_updated", "conversation_status_changed"].includes(payload.event)
  ) {
    return "chatwoot";
  }
  // New format: { raw: { data: { key: ... } } }
  if (payload?.raw?.data?.key || payload?.raw?.event) {
    return "raw";
  }
  // Flat format from N8N: top-level remote_jid / message_id
  if (payload?.remote_jid || payload?.message_id || payload?.remoteJid || payload?.messageId) {
    return "flat";
  }
  // Also check for nested data without raw wrapper
  if (payload?.data?.key) {
    return "raw";
  }
  return "unknown";
}

function shouldIgnoreWebhook(payload: any, format: PayloadFormat): { ignore: boolean; reason: string } {
  if (format === "chatwoot") {
    return { ignore: true, reason: "chatwoot_payload_use_dedicated_endpoint" };
  }
  if (format === "unknown") {
    return { ignore: true, reason: "unrecognized_payload_format" };
  }
  return { ignore: false, reason: "" };
}

// ── Message type mapping ────────────────────────────────────────────

const MESSAGE_TYPE_MAP: Record<string, string> = {
  audioMessage: "audio",
  imageMessage: "image",
  videoMessage: "video",
  documentMessage: "document",
  documentWithCaptionMessage: "document",
  stickerMessage: "sticker",
  conversation: "text",
  extendedTextMessage: "text",
};

function resolveMessageType(rawType: string | undefined, message: any): string {
  if (rawType && MESSAGE_TYPE_MAP[rawType]) return MESSAGE_TYPE_MAP[rawType];
  if (!message || typeof message !== "object") return "text";
  for (const key of Object.keys(message)) {
    if (MESSAGE_TYPE_MAP[key]) return MESSAGE_TYPE_MAP[key];
  }
  return "text";
}

function getMediaObjectKey(messageType: string): string | null {
  const map: Record<string, string> = {
    audio: "audioMessage",
    image: "imageMessage",
    video: "videoMessage",
    document: "documentMessage",
    sticker: "stickerMessage",
  };
  return map[messageType] || null;
}

// ── Robust media extraction ─────────────────────────────────────────

interface ResolvedMedia {
  base64: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  duration: number | null;
  caption: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  thumbnailBase64: string | null;
  sourceUsed: string;
}

function firstValid(...values: any[]): any {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function resolveMediaFields(payload: any, messageType: string): ResolvedMedia {
  const raw = payload?.raw || {};
  const data = raw?.data || payload?.data || {};
  const message = data?.message || {};
  const mediaKey = getMediaObjectKey(messageType);
  const mediaObj = mediaKey ? (message[mediaKey] || {}) : {};

  // Also check documentWithCaptionMessage wrapper
  const docWithCaption = message?.documentWithCaptionMessage?.message?.documentMessage;

  let base64: string | null = null;
  let sourceUsed = "none";

  // Search base64 in priority order
  const b64Candidates: [any, string][] = [
    [data?.base64, "raw.data.base64"],
    [mediaObj?.base64, `raw.data.message.${mediaKey}.base64`],
    [docWithCaption?.base64, "raw.data.message.documentWithCaptionMessage.base64"],
    [payload?.base64, "root.base64"],
    [payload?.media_base64, "root.media_base64"],
    [payload?.audio_base64, "root.audio_base64"],
  ];

  for (const [val, src] of b64Candidates) {
    if (val && typeof val === "string" && val.length > 50) {
      base64 = val;
      sourceUsed = src;
      break;
    }
  }

  // Search mediaUrl
  const mediaUrl = firstValid(
    mediaObj?.url,
    docWithCaption?.url,
    data?.mediaUrl,
    data?.media_url,
    raw?.mediaUrl,
    payload?.media_url,
    payload?.mediaUrl,
    payload?.audio_url,
  );

  if (!base64 && mediaUrl) sourceUsed = "mediaUrl";

  const mimeType = firstValid(
    mediaObj?.mimetype,
    docWithCaption?.mimetype,
    data?.mimetype,
    data?.mime_type,
    payload?.mime_type,
    payload?.mimeType,
  );

  const fileName = firstValid(
    mediaObj?.fileName,
    docWithCaption?.fileName,
    data?.fileName,
    data?.file_name,
    payload?.file_name,
    payload?.fileName,
  );

  const duration = firstValid(
    mediaObj?.seconds != null ? Number(mediaObj.seconds) : null,
    data?.media_seconds != null ? Number(data.media_seconds) : null,
    payload?.media_seconds != null ? Number(payload.media_seconds) : null,
  );

  const caption = firstValid(
    mediaObj?.caption,
    docWithCaption?.caption,
    data?.caption,
    payload?.caption,
  );

  const mediaWidth = firstValid(
    mediaObj?.width != null ? Number(mediaObj.width) : null,
    data?.media_width != null ? Number(data.media_width) : null,
  );

  const mediaHeight = firstValid(
    mediaObj?.height != null ? Number(mediaObj.height) : null,
    data?.media_height != null ? Number(data.media_height) : null,
  );

  const thumbnailBase64 = firstValid(
    mediaObj?.jpegThumbnail,
    data?.thumbnail_base64,
    payload?.thumbnail_base64,
  );

  // Aggressive fallback: iterate all message keys for base64
  if (!base64 && message && typeof message === "object") {
    for (const key of Object.keys(message)) {
      const obj = message[key];
      if (obj && typeof obj === "object" && obj.base64 && typeof obj.base64 === "string" && obj.base64.length > 50) {
        base64 = obj.base64;
        sourceUsed = `raw.data.message.${key}.base64`;
        break;
      }
    }
  }

  return { base64, mediaUrl, mimeType, fileName, duration, caption, mediaWidth, mediaHeight, thumbnailBase64, sourceUsed };
}

// ── Normalize incoming message ──────────────────────────────────────

interface NormalizedPayload {
  payloadFormat: PayloadFormat;
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
  sourceUsed: string;
}

function normalizeIncomingMessage(payload: any): NormalizedPayload | null {
  const format = detectPayloadFormat(payload);

  if (format === "raw") {
    return normalizeRawFormat(payload, format);
  }
  if (format === "flat") {
    return normalizeFlatFormat(payload, format);
  }
  return null;
}

function normalizeRawFormat(payload: any, format: PayloadFormat): NormalizedPayload {
  const raw = payload.raw || payload;
  const data = raw.data || raw;
  const message = data.message || {};

  const event = raw.event || data.event || "";
  const instanceName = raw.instance || data.instance || raw.instance_name || "";
  const clinicId = raw.clinic_id || payload.clinic_id || null;

  const remoteJid = data.key?.remoteJid || "";
  const isFromMe = !!data.key?.fromMe;
  const messageId = data.key?.id || data.id || crypto.randomUUID();
  const contactName = data.pushName || data.senderName || "";

  const ts = data.messageTimestamp || data.message_timestamp;
  const messageTimestamp = ts != null ? Number(ts) : null;

  const rawMessageType = data.messageType;
  const messageType = resolveMessageType(rawMessageType, message);

  const media = resolveMediaFields(payload, messageType);

  let content = "";
  if (messageType === "text") {
    content = message?.conversation || message?.extendedTextMessage?.text || data.body || "";
  } else {
    const placeholders: Record<string, string> = {
      audio: "[Áudio]", image: "[Imagem]", video: "[Vídeo]",
      document: "[Documento]", sticker: "[Sticker]",
    };
    content = media.caption || placeholders[messageType] || "[Mídia]";
  }

  return {
    payloadFormat: format,
    clinicId,
    instanceName,
    event,
    remoteJid,
    isFromMe,
    messageId,
    content,
    messageType,
    mediaUrl: media.mediaUrl,
    mediaType: messageType !== "text" ? messageType : null,
    mimeType: media.mimeType,
    caption: media.caption,
    fileName: media.fileName,
    mediaSeconds: media.duration,
    mediaWidth: media.mediaWidth,
    mediaHeight: media.mediaHeight,
    thumbnailBase64: media.thumbnailBase64,
    base64: media.base64,
    contactName,
    messageTimestamp,
    sourceUsed: media.sourceUsed,
  };
}

function normalizeFlatFormat(payload: any, format: PayloadFormat): NormalizedPayload {
  const p = (snake: string, camel?: string): any => {
    if (payload?.[snake] !== undefined) return payload[snake];
    if (camel && payload?.[camel] !== undefined) return payload[camel];
    return undefined;
  };

  const remoteJid = p("remote_jid", "remoteJid") || "";
  const rawFromMe = p("from_me", "fromMe");
  const isFromMe = typeof rawFromMe === "string" ? rawFromMe === "true" : !!rawFromMe;
  const messageId = p("message_id", "messageId") || crypto.randomUUID();
  const event = p("event") || "";
  const instanceName = p("instance_name", "instanceName") || "";
  const clinicId = p("clinic_id", "clinicId") || null;
  const contactName = p("push_name", "pushName") || "";
  const messageType = p("message_type", "messageType") || "text";

  const ts = p("timestamp", "messageTimestamp");
  const messageTimestamp = ts != null ? Number(ts) : null;

  const media = resolveMediaFields(payload, messageType);
  const content = p("content") || p("body") || media.caption || "";

  return {
    payloadFormat: format,
    clinicId,
    instanceName,
    event,
    remoteJid,
    isFromMe,
    messageId,
    content: content || (messageType !== "text" ? `[${messageType}]` : ""),
    messageType,
    mediaUrl: media.mediaUrl || p("media_url", "mediaUrl") || null,
    mediaType: messageType !== "text" ? messageType : null,
    mimeType: media.mimeType || p("mime_type", "mimeType") || null,
    caption: media.caption || p("caption") || null,
    fileName: media.fileName || p("file_name", "fileName") || null,
    mediaSeconds: media.duration,
    mediaWidth: media.mediaWidth,
    mediaHeight: media.mediaHeight,
    thumbnailBase64: media.thumbnailBase64 || p("thumbnail_base64", "thumbnailBase64") || null,
    base64: media.base64 || null,
    contactName,
    messageTimestamp,
    sourceUsed: media.sourceUsed,
  };
}

// ── DB helpers ──────────────────────────────────────────────────────

const MEDIA_FIELDS = ["base64", "media_url", "mime_type", "media_type", "caption", "file_name",
  "media_seconds", "media_width", "media_height", "thumbnail_base64"] as const;

async function findOrCreateConversation(
  supabase: any, clinicId: string, inboxId: string | null,
  remoteJid: string, updateData: Record<string, any>,
) {
  let query = supabase.from("whatsapp_conversations").select("id, unread_count")
    .eq("clinic_id", clinicId).eq("remote_jid", remoteJid);
  if (inboxId) query = query.eq("inbox_id", inboxId);
  else query = query.is("inbox_id", null);

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase.from("whatsapp_conversations")
      .update(updateData).eq("id", existing.id).select("id, unread_count").single();
    if (error) throw error;
    return updated;
  }

  const { data: created, error } = await supabase.from("whatsapp_conversations")
    .insert({ clinic_id: clinicId, inbox_id: inboxId, remote_jid: remoteJid, ...updateData })
    .select("id, unread_count").single();
  if (error) throw error;
  return created;
}

async function upsertMessage(supabase: any, messageData: Record<string, any>): Promise<{ isDuplicate: boolean }> {
  const { data: existing } = await supabase.from("whatsapp_messages")
    .select("id").eq("message_id", messageData.message_id).maybeSingle();

  if (existing) {
    // Merge: only overwrite media fields if new value is non-null
    const mergedUpdate: Record<string, any> = {};
    for (const [key, val] of Object.entries(messageData)) {
      if (key === "message_id") continue;
      if ((MEDIA_FIELDS as readonly string[]).includes(key)) {
        if (val != null) mergedUpdate[key] = val;
      } else {
        mergedUpdate[key] = val;
      }
    }
    const { error } = await supabase.from("whatsapp_messages").update(mergedUpdate).eq("id", existing.id);
    if (error) throw error;
    return { isDuplicate: true };
  }

  const { error } = await supabase.from("whatsapp_messages").insert(messageData);
  if (error) throw error;
  return { isDuplicate: false };
}

// ── Main handler ────────────────────────────────────────────────────

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
      return new Response(JSON.stringify({ success: true, message: "No body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: any;
    try { payload = JSON.parse(body); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    // ── Step 1: Detect format & filter ──
    const format = detectPayloadFormat(payload);
    const ignore = shouldIgnoreWebhook(payload, format);

    if (ignore.ignore) {
      console.log(JSON.stringify({ action: "webhook_ignored", reason: ignore.reason, format }));
      return new Response(JSON.stringify({ ignored: true, reason: ignore.reason }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 2: Normalize ──
    const normalized = normalizeIncomingMessage(payload);
    if (!normalized) {
      console.log(JSON.stringify({ action: "normalize_failed", format, keys: Object.keys(payload) }));
      return new Response(JSON.stringify({ error: "Could not normalize payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    // ── Step 3: Structured log ──
    console.log(JSON.stringify({
      action: "normalized",
      payloadFormat: normalized.payloadFormat,
      event: normalized.event,
      messageId: normalized.messageId,
      messageType: normalized.messageType,
      hasBase64: !!normalized.base64,
      base64Length: normalized.base64?.length || 0,
      hasMediaUrl: !!normalized.mediaUrl,
      mediaUrl: normalized.mediaUrl?.substring(0, 80) || null,
      mimeType: normalized.mimeType,
      sourceUsed: normalized.sourceUsed,
      mediaSeconds: normalized.mediaSeconds,
      instanceName: normalized.instanceName,
      remoteJid: normalized.remoteJid?.substring(0, 20),
      isFromMe: normalized.isFromMe,
      content: normalized.content?.substring(0, 60),
    }));

    // ── Step 4: Resolve inbox + clinic ──
    let inboxId: string | null = null;
    let clinicId = normalized.clinicId;

    if (normalized.instanceName) {
      const { data: inbox } = await supabase.from("whatsapp_inboxes")
        .select("id, clinic_id").eq("instance_name", normalized.instanceName)
        .eq("is_active", true).maybeSingle();

      if (inbox) {
        inboxId = inbox.id;
        if (!clinicId) clinicId = inbox.clinic_id;
      } else if (clinicId) {
        const { data: newInbox } = await supabase.from("whatsapp_inboxes")
          .insert({ clinic_id: clinicId, instance_name: normalized.instanceName, label: normalized.instanceName })
          .select("id").single();
        inboxId = newInbox?.id || null;
      }
    }

    if (!clinicId) {
      return new Response(
        JSON.stringify({ error: "clinic_id could not be resolved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // ── Step 5: Process message events ──
    const event = normalized.event;

    if (event === "messages.upsert" || event === "message" || !event) {
      const { remoteJid, content, messageId, isFromMe, messageType, contactName, messageTimestamp,
        mediaUrl, mediaType, mimeType, caption, fileName, mediaSeconds, mediaWidth, mediaHeight,
        thumbnailBase64, base64 } = normalized;

      if (!remoteJid) {
        return new Response(JSON.stringify({ error: "remoteJid missing" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
        });
      }

      const contactPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const displayName = contactName || contactPhone;
      const isGroup = remoteJid.includes("@g.us");

      const previewMap: Record<string, string> = {
        image: caption || "📷 Imagem", audio: "🎵 Áudio", video: caption || "🎥 Vídeo",
        document: fileName || "📄 Documento", sticker: "🏷️ Sticker",
      };
      const lastMessagePreview = messageType === "text" ? content : (previewMap[messageType] || content || "[Sem conteúdo]");

      const conv = await findOrCreateConversation(supabase, clinicId, inboxId, remoteJid, {
        contact_name: displayName, contact_phone: contactPhone, is_group: isGroup,
        last_message: lastMessagePreview, last_message_at: new Date().toISOString(), status: "active",
      });

      const timestamp = messageTimestamp ? new Date(messageTimestamp * 1000).toISOString() : new Date().toISOString();

      const { isDuplicate } = await upsertMessage(supabase, {
        conversation_id: conv.id, message_id: messageId, content: content || null,
        message_type: messageType, is_from_me: isFromMe, sender_name: displayName,
        media_url: mediaUrl, media_type: mediaType, mime_type: mimeType,
        caption, file_name: fileName, media_seconds: mediaSeconds,
        media_width: mediaWidth, media_height: mediaHeight,
        thumbnail_base64: thumbnailBase64, base64,
        status: isFromMe ? "sent" : "received", timestamp,
      });

      if (isDuplicate) {
        console.log(JSON.stringify({ action: "duplicate_merged", messageId, format: normalized.payloadFormat }));
      }

      if (!isFromMe && !isDuplicate) {
        await supabase.from("whatsapp_conversations")
          .update({ unread_count: (conv.unread_count ?? 0) + 1 }).eq("id", conv.id);
      }

      console.log(JSON.stringify({ action: "message_processed", convId: conv.id, messageType, isDuplicate, inbox: inboxId }));
    }

    // ── Step 6: Status updates ──
    if (event === "messages.update" || event === "message.update") {
      const raw = payload?.raw || payload;
      const data = raw?.data || raw;
      const msgId = data?.key?.id || data?.messageId || payload?.message_id;
      const status = data?.update?.status || data?.status || payload?.status;

      if (msgId && status !== undefined) {
        const statusMap: Record<number, string> = { 0: "error", 1: "pending", 2: "sent", 3: "delivered", 4: "read" };
        await supabase.from("whatsapp_messages")
          .update({ status: statusMap[status] || String(status) }).eq("message_id", msgId);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
