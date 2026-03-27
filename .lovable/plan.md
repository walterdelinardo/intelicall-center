

## Relatório de Estoque — enviar apenas itens com status Baixo

### Alteração em `supabase/functions/telegram-webhook/index.ts`

Na ação `stock_alert`:

- Remover exigência de `itemName`, `currentQty`, `minQty` — basta `clinicId`
- Consultar `stock_items` filtrado por `clinic_id` e `is_active = true`
- Filtrar apenas itens com **estoque baixo**: `quantity <= min_quantity`
- Montar mensagem Markdown com cabeçalho "⚠️ Relatório de Estoque Baixo" listando cada item com: Nome, Categoria, Quantidade, Custo Unit. (R$), Vl. Venda (R$), Fornecedor e Status
- Se não houver itens com estoque baixo, enviar mensagem informando "✅ Nenhum produto com estoque baixo"
- Dividir em múltiplas mensagens se ultrapassar 4096 caracteres (limite do Telegram)
- Enviar para bots com `webhook_stock_alerts = true`
- Registrar na `telegram_notifications` com `notification_type: "stock_report"`

### Payload do n8n
```json
{
  "action": "stock_alert",
  "clinicId": "UUID"
}
```

### Formato da mensagem
```text
⚠️ *Relatório de Estoque Baixo*

1. *Produto X*
   📁 Categoria: Geral
   📊 Qtd: 2 | Mín: 5
   💰 Custo: R$ 10,00 | Venda: R$ 25,00
   🏭 Fornecedor: ABC Ltda

2. *Produto Y*
   📁 Categoria: Produto
   📊 Qtd: 0 | Mín: 3
   💰 Custo: R$ 5,00 | Venda: R$ 12,00
   🏭 Fornecedor: —

📦 Total: 2 produtos com estoque baixo
```

