

## Plano: Adicionar aba WhatsApp nas permissões do módulo Configurações

### Problema
A aba "WhatsApp" foi adicionada ao módulo Configurações mas não foi registrada no `MODULE_TABS` em `RolesTab.tsx`, por isso não aparece como opção selecionável ao editar permissões de um papel.

### Alteração

**Arquivo:** `src/components/modules/usuarios/RolesTab.tsx`

Adicionar `{ key: "whatsapp", label: "WhatsApp" }` ao array `MODULE_TABS.configuracoes`, ficando:

```typescript
configuracoes: [
  { key: "general", label: "Dados Gerais" },
  { key: "hours", label: "Horários" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "integrations", label: "Integrações" },
],
```

Apenas uma linha adicionada em um arquivo.

