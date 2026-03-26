

## Compactar cards de notificação com expansão por clique

### Alterações em `src/components/modules/conversas/TelegramNotificationsTab.tsx`

- Adicionar estado `expandedIds` (Set de IDs) para controlar quais notificações estão expandidas
- Cada card mostra apenas: ícone, badges, remetente, data e botões de ação (Ok, labels)
- A mensagem (`notif.message`) fica oculta por padrão
- Adicionar um botão `ChevronDown`/`ChevronUp` que alterna a visibilidade da mensagem
- Ao expandir, mostra o `<p>` com `notif.message` e o campo "De:" abaixo
- Truncar a primeira linha da mensagem (1 linha com `line-clamp-1`) como preview quando fechado

### Resultado visual (compacto)
```text
[ícone] [Enviado pelo Bot] [Mensagem] via Bot1  [etiquetas]  26/03/2026 14:30  [▼] [✓] [🏷]
```

### Resultado visual (expandido)
```text
[ícone] [Enviado pelo Bot] [Mensagem] via Bot1  [etiquetas]  26/03/2026 14:30  [▲] [✓] [🏷]
  *Cliente aguardando resposta*
  Nome: Teste
  Whatsapp: ...
  De: PodoClinicBot
```

