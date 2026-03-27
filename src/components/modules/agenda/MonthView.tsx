import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

interface MonthViewProps {
  currentMonth: Date;
  events: MergedEvent[];
  onDayClick: (day: Date) => void;
}

const statusDotColors: Record<string, string> = {
  agendado: "bg-primary",
  confirmado: "bg-blue-500",
  compareceu: "bg-green-500",
  faltou: "bg-red-500",
  cancelado: "bg-muted-foreground",
  confirmed: "bg-blue-500",
  pending: "bg-yellow-500",
};

const DEFAULT_COLOR = '#039BE5';

export const MonthView = ({ currentMonth, events, onDayClick }: MonthViewProps) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.date), day));

  return (
    <div className="border rounded-lg bg-card overflow-auto">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30 sticky top-0 z-10">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 border-r last:border-r-0 border-border/30">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const today = isToday(day);

          return (
            <button
              key={i}
              onClick={() => onDayClick(day)}
              className={`min-h-[80px] p-1.5 border-r border-b border-border/20 last:border-r-0 text-left hover:bg-accent/40 transition-colors ${
                !isCurrentMonth ? 'opacity-40' : ''
              } ${today ? 'bg-primary/5' : ''}`}
            >
              <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                today ? 'bg-primary text-primary-foreground' : ''
              }`}>
                {format(day, 'd')}
              </div>

              {/* Event previews */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((evt) => {
                  if (evt.type === 'google') {
                    const color = evt.accountColor || DEFAULT_COLOR;
                    return (
                      <div
                        key={`${evt.type}-${evt.id}`}
                        className="text-[10px] px-1 py-0.5 rounded truncate"
                        style={{
                          backgroundColor: `${color}20`,
                          borderLeft: `2px solid ${color}`,
                          color: color,
                        }}
                      >
                        <span className="font-medium">{evt.time}</span>{' '}
                        {evt.title}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${evt.type}-${evt.id}`}
                      className={`text-[10px] px-1 py-0.5 rounded truncate ${
                        `${statusDotColors[evt.status]?.replace('bg-', 'bg-opacity-10 bg-') || 'bg-muted'} text-foreground`
                      }`}
                    >
                      <span className="font-medium">{evt.time}</span>{' '}
                      {evt.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{dayEvents.length - 3} mais
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
