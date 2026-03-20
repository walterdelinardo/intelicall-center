

## Plano: Separadores de Data no Chat (estilo WhatsApp)

### O que muda

Adicionar separadores de data entre as mensagens no chat, exatamente como o WhatsApp faz — um badge centralizado com o texto "Hoje", "Ontem", ou a data formatada (ex: "15/03/2026").

### Implementação

**Arquivo: `src/components/dashboard/chat/ChatArea.tsx`**

Na seção de renderização das mensagens (linhas 150-155), agrupar mensagens por dia e inserir um separador de data antes do primeiro item de cada grupo:

- Comparar a data de cada mensagem com a anterior
- Quando o dia muda, renderizar um `DateSeparator` antes da mensagem
- Lógica de label: se é hoje → "Hoje", se é ontem → "Ontem", senão → `dd/MM/yyyy`

O separador será um `div` centralizado com uma linha horizontal e um `span` com fundo, similar ao WhatsApp:

```text
──────── Ontem ────────
```

Estilizado com Tailwind: `flex items-center gap-3` + linhas `flex-1 h-px bg-border` + texto `text-xs text-muted-foreground bg-background px-2`.

Nenhum novo arquivo necessário — tudo fica inline no `ChatArea.tsx` (componente `DateSeparator` local + lógica de agrupamento no map).

