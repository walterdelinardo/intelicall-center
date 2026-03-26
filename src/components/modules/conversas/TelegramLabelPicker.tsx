import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Label {
  id: string;
  name: string;
  color: string;
}

interface TelegramLabelPickerProps {
  notificationId: string;
  assignedLabelIds: string[];
  allLabels: Label[];
  onLabelsChanged: () => void;
}

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
];

const TelegramLabelPicker = ({
  notificationId,
  assignedLabelIds,
  allLabels,
  onLabelsChanged,
}: TelegramLabelPickerProps) => {
  const { profile } = useAuth();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[4]);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  const toggleLabel = async (labelId: string) => {
    const isAssigned = assignedLabelIds.includes(labelId);
    try {
      if (isAssigned) {
        await supabase
          .from("telegram_notification_labels" as any)
          .delete()
          .eq("notification_id", notificationId)
          .eq("label_id", labelId);
      } else {
        await supabase
          .from("telegram_notification_labels" as any)
          .insert({ notification_id: notificationId, label_id: labelId } as any);
      }
      onLabelsChanged();
    } catch {
      toast.error("Erro ao atualizar etiqueta");
    }
  };

  const createLabel = async () => {
    if (!newName.trim() || !profile?.clinic_id) return;
    setCreating(true);
    try {
      await supabase
        .from("telegram_labels" as any)
        .insert({ clinic_id: profile.clinic_id, name: newName.trim(), color: newColor } as any);
      setNewName("");
      onLabelsChanged();
    } catch {
      toast.error("Erro ao criar etiqueta");
    } finally {
      setCreating(false);
    }
  };

  const deleteLabel = async (labelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.from("telegram_labels" as any).delete().eq("id", labelId);
      onLabelsChanged();
    } catch {
      toast.error("Erro ao excluir etiqueta");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Etiquetas">
          <Tag className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold mb-2">Etiquetas</p>

        {allLabels.length > 0 && (
          <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
            {allLabels.map((label) => (
              <div
                key={label.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-1.5 py-1"
                onClick={() => toggleLabel(label.id)}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0 border"
                  style={{ backgroundColor: label.color }}
                />
                <span className="text-xs flex-1 truncate">{label.name}</span>
                {assignedLabelIds.includes(label.id) && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">✓</Badge>
                )}
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => deleteLabel(label.id, e)}
                  title="Excluir etiqueta"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-2 space-y-2">
          <Input
            placeholder="Nova etiqueta..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === "Enter" && createLabel()}
          />
          <div className="flex items-center gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`w-5 h-5 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <Button size="sm" className="w-full h-7 text-xs" disabled={!newName.trim() || creating} onClick={createLabel}>
            <Plus className="w-3 h-3 mr-1" />
            Criar etiqueta
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TelegramLabelPicker;
