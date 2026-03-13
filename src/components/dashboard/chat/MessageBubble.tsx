import { Check, CheckCheck, Clock, FileText, Download, X } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { WhatsAppMessage } from "@/hooks/useWhatsApp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const MessageStatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'read': return <CheckCheck className="w-3 h-3 text-blue-500" />;
    case 'delivered': return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
    case 'sent': return <Check className="w-3 h-3 text-muted-foreground" />;
    default: return <Clock className="w-3 h-3 text-muted-foreground" />;
  }
};

/** Resolve the best source URL for media — base64 data URI or media_url */
function getMediaSrc(msg: WhatsAppMessage): string | null {
  if (msg.base64) {
    // Use audio/ogg as safe fallback for audio to avoid unplayable application/octet-stream
    const fallbackMime = msg.message_type === 'audio' ? 'audio/ogg' : 'application/octet-stream';
    const mime = msg.mime_type || fallbackMime;
    return `data:${mime};base64,${msg.base64}`;
  }
  return msg.media_url || null;
}

function getThumbnailSrc(msg: WhatsAppMessage): string | null {
  if (msg.thumbnail_base64) {
    return `data:image/jpeg;base64,${msg.thumbnail_base64}`;
  }
  return null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Media renderers ─────────────────────────────────────────────────

const ImageContent = ({ msg }: { msg: WhatsAppMessage }) => {
  const [open, setOpen] = useState(false);
  const src = getMediaSrc(msg);
  if (!src) return null;
  return (
    <>
      <div>
        <img
          src={src}
          alt={msg.caption || 'Imagem'}
          className="max-w-full rounded-lg mb-1 max-h-60 object-cover cursor-pointer"
          onClick={() => setOpen(true)}
          loading="lazy"
        />
        {msg.caption && <p className="text-sm whitespace-pre-wrap break-words">{msg.caption}</p>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center bg-background/95 backdrop-blur-sm border-border">
          <img
            src={src}
            alt={msg.caption || 'Imagem'}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

const AudioContent = ({ msg }: { msg: WhatsAppMessage }) => {
  const src = getMediaSrc(msg);
  if (!src) return <p className="text-sm opacity-70">🎵 Áudio indisponível</p>;
  return (
    <div className="space-y-1">
      <audio controls src={src} className="max-w-full" />
      {msg.media_seconds != null && (
        <span className="text-[10px] opacity-60">{formatDuration(msg.media_seconds)}</span>
      )}
    </div>
  );
};

const VideoContent = ({ msg }: { msg: WhatsAppMessage }) => {
  const src = getMediaSrc(msg);
  const poster = getThumbnailSrc(msg);
  if (!src) return <p className="text-sm opacity-70">🎥 Vídeo indisponível</p>;
  return (
    <div>
      <video
        controls
        src={src}
        poster={poster || undefined}
        className="max-w-full rounded-lg mb-1 max-h-60"
      />
      {msg.caption && <p className="text-sm whitespace-pre-wrap break-words">{msg.caption}</p>}
    </div>
  );
};

const DocumentContent = ({ msg }: { msg: WhatsAppMessage }) => {
  const src = getMediaSrc(msg);
  const name = msg.file_name || 'Documento';
  return (
    <div className="flex items-center gap-2 bg-background/20 rounded-lg p-2 mb-1">
      <FileText className="w-8 h-8 shrink-0 opacity-70" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {msg.mime_type && <p className="text-[10px] opacity-60">{msg.mime_type}</p>}
      </div>
      {src && (
        <a href={src} target="_blank" rel="noopener noreferrer" download={name}>
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
            <Download className="w-4 h-4" />
          </Button>
        </a>
      )}
    </div>
  );
};

const StickerContent = ({ msg }: { msg: WhatsAppMessage }) => {
  const src = getMediaSrc(msg);
  if (!src) return <p className="text-sm opacity-70">🏷️ Sticker</p>;
  return (
    <img
      src={src}
      alt="Sticker"
      className="max-w-[150px] max-h-[150px] object-contain"
      loading="lazy"
    />
  );
};

// ── Main bubble ─────────────────────────────────────────────────────

const MessageBubble = ({ msg }: { msg: WhatsAppMessage }) => {
  const renderContent = () => {
    switch (msg.message_type) {
      case 'image':
        return <ImageContent msg={msg} />;
      case 'audio':
        return <AudioContent msg={msg} />;
      case 'video':
        return <VideoContent msg={msg} />;
      case 'document':
        return <DocumentContent msg={msg} />;
      case 'sticker':
        return <StickerContent msg={msg} />;
      case 'text':
      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>;
    }
  };

  return (
    <div className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
        msg.message_type === 'sticker'
          ? 'bg-transparent'
          : msg.is_from_me
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted rounded-bl-sm'
      }`}>
        {renderContent()}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[10px] opacity-60">
            {format(new Date(msg.timestamp), 'HH:mm')}
          </span>
          {msg.is_from_me && <MessageStatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
