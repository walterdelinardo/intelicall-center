import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useGoogleOAuth } from "@/hooks/useGoogleOAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateEventDialog } from "./CreateEventDialog";
import { EventDetailsDialog } from "./EventDetailsDialog";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  status: "confirmed" | "pending";
  description?: string;
}

const CalendarTab = () => {
  const { events, loading, fetchEvents, createEvent, updateEvent, deleteEvent } = useGoogleCalendar();
  const { isConnected, loading: authLoading } = useGoogleOAuth();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(new Date(event.date), day));
  };

  // Get filtered events based on selected date
  const filteredEvents = selectedDate 
    ? getEventsForDay(selectedDate)
    : events;

  return (
    <div className="space-y-6">
      {/* Auth Status Card */}
      {!authLoading && !isConnected && (
        <Card className="shadow-card border-accent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Conectar Google Calendar</h3>
                <p className="text-sm text-muted-foreground">
                  Conecte sua conta do Google para gerenciar seus eventos
                </p>
              </div>
              <GoogleAuthButton />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendário visual */}
      <Card className="lg:col-span-2 shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Agenda de Atendimentos
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handlePreviousMonth}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-[140px] text-center">
                  {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleNextMonth}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              {isConnected && <GoogleAuthButton />}
              <Button
                variant="outline" 
                size="sm"
                onClick={() => fetchEvents()}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <CreateEventDialog onCreateEvent={createEvent} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium mb-4">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <div key={day} className="text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, i) => {
                const dayEvents = getEventsForDay(day);
                const hasEvents = dayEvents.length > 0;
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isDayToday = isToday(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                
                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square rounded-lg p-2 text-sm transition-smooth hover:bg-accent relative ${
                      !isCurrentMonth ? "text-muted-foreground opacity-40" : ""
                    } ${isDayToday ? "bg-primary text-primary-foreground font-bold" : ""} ${
                      isSelected && !isDayToday ? "bg-accent ring-2 ring-primary" : ""
                    } ${hasEvents && !isDayToday && !isSelected ? "bg-accent/50 font-medium" : ""}`}
                  >
                    <span className="block">{format(day, "d")}</span>
                    {hasEvents && !isDayToday && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((_, idx) => (
                          <div key={idx} className="w-1 h-1 bg-primary rounded-full"></div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de eventos */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: ptBR }) : "Próximos Eventos"}
            </CardTitle>
            {selectedDate && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedDate(null)}
                className="h-8 text-xs"
              >
                Ver todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{selectedDate ? "Nenhum evento neste dia" : "Nenhum evento encontrado"}</p>
              </div>
            ) : (
              filteredEvents.map((event) => (
              <div
                key={event.id}
                className="p-4 rounded-lg border bg-gradient-card hover:shadow-card transition-smooth cursor-pointer"
                onClick={() => handleEventClick(event)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm">{event.title}</h4>
                  <Badge
                    variant={event.status === "confirmed" ? "default" : "secondary"}
                    className={event.status === "confirmed" ? "bg-success" : ""}
                  >
                    {event.status === "confirmed" ? "Confirmado" : "Pendente"}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-3 h-3" />
                    {new Date(event.date).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {event.time} - {event.duration}
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <EventDetailsDialog
        event={selectedEvent}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onUpdateEvent={updateEvent}
        onDeleteEvent={deleteEvent}
      />
    </div>
    </div>
  );
};

export default CalendarTab;
