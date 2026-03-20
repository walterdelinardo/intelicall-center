import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Globe, Plus } from "lucide-react";
import { format, isToday as isTodayFn } from "date-fns";
import { ptBR } from "date-fns/locale";

function useCurrentMinutes() {
  const [now, setNow] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

interface MergedEvent {
  type: 'local' | 'google';
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  status: string;
  description?: string;
  accountLabel?: string;
  accountId?: string;
  accountColor?: string;
  appointment?: any;
  startDateTime?: string;
  endDateTime?: string;
}

const statusColors: Record<string, string> = {
  agendado: "bg-primary/10 text-primary border-primary/30",
  confirmado: "bg-blue-100 text-blue-700 border-blue-300",
  compareceu: "bg-green-100 text-green-700 border-green-300",
  faltou: "bg-red-100 text-red-700 border-red-300",
  cancelado: "bg-muted text-muted-foreground border-border",
  confirmed: "bg-blue-100 text-blue-700 border-blue-300",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
};

const START_HOUR = 0;
const END_HOUR = 24;
const SLOT_HEIGHT = 32;

function generateTimeSlots() {
  const slots: string[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function parseDuration(duration: string): number {
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1]) : 60;
}

const DEFAULT_COLOR = '#039BE5';

function getEventStyles(evt: MergedEvent) {
  if (evt.type === 'google') {
    const color = evt.accountColor || DEFAULT_COLOR;
    return {
      backgroundColor: `${color}20`,
      borderLeft: `3px solid ${color}`,
      color: color,
    };
  }
  return {};
}

interface TimeGridProps {
  events: MergedEvent[];
  onSlotClick: (time: string) => void;
  onEventClick: (event: MergedEvent) => void;
  onStatusChange?: (id: string, status: string) => void;
}

const statusLabels: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  compareceu: "Compareceu",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

export const TimeGrid = ({ events, onSlotClick, onEventClick, onStatusChange }: TimeGridProps) => {
  const slots = generateTimeSlots();
  const gridStartMin = START_HOUR * 60;
  const totalMinutes = (END_HOUR - START_HOUR) * 60;

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="relative" style={{ height: `${(totalMinutes / 30) * SLOT_HEIGHT}px` }}>
        {/* Time labels and grid lines */}
        {slots.map((time, i) => {
          const isHour = time.endsWith(':00');
          return (
            <div
              key={time}
              className={`absolute left-0 right-0 flex border-t ${isHour ? 'border-border' : 'border-border/30'}`}
              style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
            >
              <div className="w-16 shrink-0 px-2 py-1 text-xs text-muted-foreground bg-muted/30 border-r border-border/50">
                {isHour && <span className="font-medium">{time}</span>}
              </div>
              <button
                className="flex-1 hover:bg-accent/40 transition-colors group relative"
                onClick={() => onSlotClick(time)}
              >
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </span>
              </button>
            </div>
          );
        })}

        {/* Events overlay */}
        {events.map((evt) => {
          const evtMinutes = timeToMinutes(evt.time);
          const durationMin = parseDuration(evt.duration);
          const top = ((evtMinutes - gridStartMin) / 30) * SLOT_HEIGHT;
          const height = Math.max((durationMin / 30) * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);

          if (evtMinutes < gridStartMin || evtMinutes >= END_HOUR * 60 || top < 0) return null;

          const styles = getEventStyles(evt);

          return (
            <div
              key={`${evt.type}-${evt.id}`}
              className="absolute left-16 right-1 z-10 cursor-pointer"
              style={{ top: `${top + 1}px`, height: `${height}px` }}
              onClick={() => onEventClick(evt)}
            >
              {evt.type === 'google' ? (
                <div
                  className="h-full rounded-md px-2 py-1 overflow-hidden hover:shadow-md transition-shadow"
                  style={styles}
                >
                  <p className="font-medium text-xs truncate" style={{ color: styles.color }}>{evt.title}</p>
                  <p className="text-[10px]" style={{ color: styles.color, opacity: 0.7 }}>{evt.time} · {evt.duration}</p>
                  {evt.accountLabel && (
                    <p className="text-[10px] truncate" style={{ color: styles.color, opacity: 0.5 }}>{evt.accountLabel}</p>
                  )}
                </div>
              ) : (
                <div className={`h-full rounded-md border px-2 py-1 overflow-hidden hover:shadow-md transition-shadow ${statusColors[evt.status] || 'bg-card'}`}>
                  <p className="font-medium text-xs truncate">{evt.title}</p>
                  <p className="text-[10px] opacity-75">{evt.time} · {evt.duration}</p>
                  {onStatusChange && (
                    <div className="flex gap-0.5 flex-wrap mt-0.5">
                      {Object.keys(statusLabels).map((s) => (
                        <button
                          key={s}
                          onClick={(e) => { e.stopPropagation(); onStatusChange(evt.id, s); }}
                          className={`text-[9px] px-1 py-0 rounded-full border ${
                            evt.status === s ? statusColors[s] + " font-semibold" : "bg-background/80 text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {statusLabels[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface WeekTimeGridProps {
  days: Date[];
  getEventsForDay: (day: Date) => MergedEvent[];
  onSlotClick: (date: Date, time: string) => void;
  onEventClick: (event: MergedEvent) => void;
  isToday: (day: Date) => boolean;
}

export const WeekTimeGrid = ({ days, getEventsForDay, onSlotClick, onEventClick, isToday }: WeekTimeGridProps) => {
  const slots = generateTimeSlots();
  const gridStartMin = START_HOUR * 60;

  return (
    <div className="border rounded-lg bg-card overflow-auto">
      {/* Day headers */}
      <div className="flex border-b sticky top-0 z-20 bg-card">
        <div className="w-14 shrink-0 border-r border-border/50" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`flex-1 text-center py-2 border-r border-border/30 last:border-r-0 ${
              isToday(day) ? 'bg-primary text-primary-foreground' : 'bg-muted/30'
            }`}
          >
            <div className="text-[10px] uppercase">{format(day, 'EEE', { locale: ptBR })}</div>
            <div className="text-sm font-semibold">{format(day, 'dd')}</div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="relative">
        {slots.map((time, i) => {
          const isHour = time.endsWith(':00');
          return (
            <div
              key={time}
              className={`flex border-t ${isHour ? 'border-border' : 'border-border/20'}`}
              style={{ height: `${SLOT_HEIGHT}px` }}
            >
              <div className="w-14 shrink-0 px-1 py-1 text-[10px] text-muted-foreground bg-muted/20 border-r border-border/50">
                {isHour && <span className="font-medium">{time}</span>}
              </div>
              {days.map((day) => (
                <button
                  key={day.toISOString()}
                  className="flex-1 border-r border-border/10 last:border-r-0 hover:bg-accent/30 transition-colors relative group"
                  onClick={() => onSlotClick(day, time)}
                >
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-3 h-3 text-muted-foreground" />
                  </span>
                </button>
              ))}
            </div>
          );
        })}

        {/* Events overlay per column */}
        {days.map((day, dayIndex) => {
          const dayEvts = getEventsForDay(day);
          const colWidth = `calc((100% - 3.5rem) / ${days.length})`;
          const colLeft = `calc(3.5rem + (${dayIndex} * (100% - 3.5rem) / ${days.length}))`;

          return dayEvts.map((evt) => {
            const evtMinutes = timeToMinutes(evt.time);
            const durationMin = parseDuration(evt.duration);
            const slotIndex = (evtMinutes - gridStartMin) / 30;
            const top = slotIndex * SLOT_HEIGHT;
            const height = Math.max((durationMin / 30) * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);

            if (evtMinutes < gridStartMin || evtMinutes >= END_HOUR * 60 || top < 0) return null;

            const styles = evt.type === 'google' ? getEventStyles(evt) : {};

            return (
              <div
                key={`${evt.type}-${evt.id}`}
                className="absolute z-10 px-0.5 cursor-pointer"
                style={{
                  top: `${top + 1}px`,
                  height: `${height}px`,
                  left: colLeft,
                  width: colWidth,
                }}
                onClick={() => onEventClick(evt)}
              >
                {evt.type === 'google' ? (
                  <div
                    className="h-full rounded text-[10px] px-1 py-0.5 overflow-hidden hover:shadow-md transition-shadow"
                    style={styles}
                  >
                    <p className="font-medium truncate" style={{ color: styles.color }}>{evt.title}</p>
                    <p style={{ color: styles.color, opacity: 0.7 }}>{evt.time}</p>
                  </div>
                ) : (
                  <div className={`h-full rounded border text-[10px] px-1 py-0.5 overflow-hidden hover:shadow-md transition-shadow ${statusColors[evt.status] || 'bg-card'}`}>
                    <p className="font-medium truncate">{evt.title}</p>
                    <p className="opacity-75">{evt.time}</p>
                  </div>
                )}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
};
