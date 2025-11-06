import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { Skeleton } from "@/components/ui/skeleton";

const CalendarTab = () => {
  const { events, loading, fetchEvents } = useGoogleCalendar();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendário visual */}
      <Card className="lg:col-span-2 shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Agenda de Atendimentos
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchEvents}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button className="gap-2 bg-gradient-primary">
                <Plus className="w-4 h-4" />
                Novo Evento
              </Button>
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
              {Array.from({ length: 35 }, (_, i) => {
                const day = i - 2;
                const isToday = day === 15;
                const hasEvent = [15, 16, 18].includes(day);
                return (
                  <button
                    key={i}
                    className={`aspect-square rounded-lg p-2 text-sm transition-smooth hover:bg-accent ${
                      day < 1 ? "text-muted-foreground" : ""
                    } ${isToday ? "bg-primary text-primary-foreground font-bold" : ""} ${
                      hasEvent && !isToday ? "bg-accent font-medium" : ""
                    }`}
                  >
                    {day > 0 ? day : ""}
                    {hasEvent && !isToday && (
                      <div className="w-1 h-1 bg-primary rounded-full mx-auto mt-1"></div>
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
          <CardTitle className="text-lg">Próximos Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum evento encontrado</p>
              </div>
            ) : (
              events.map((event) => (
              <div
                key={event.id}
                className="p-4 rounded-lg border bg-gradient-card hover:shadow-card transition-smooth"
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
    </div>
  );
};

export default CalendarTab;
