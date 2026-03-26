

## Exibir cURL de integração ao ativar webhook Financeiro

### O que será feito
Quando o usuário ativar o webhook "Relatórios Financeiros" em um bot (tanto na criação quanto ao clicar no badge na tabela), o sistema exibirá um bloco com o comando cURL pronto para uso, contendo o `clinicId` correto e campos editáveis de período (`startDate`/`endDate`).

### Alterações

**Arquivo: `src/components/settings/TelegramBotsSection.tsx`**

1. Adicionar estado `showCurlForBotId` para controlar qual bot está exibindo o cURL
2. Quando o badge "Financeiro" for ativado (na tabela), setar esse estado para o bot correspondente
3. Renderizar abaixo da linha do bot (ou em um Dialog) um bloco com:
   - Dois inputs de data: `startDate` e `endDate` (padrão: primeiro e último dia do mês atual)
   - Um bloco `<pre>` com o cURL montado dinamicamente:
     ```
     curl -X POST \
       https://nlpnfkidnixphnlwhrux.supabase.co/functions/v1/telegram-webhook \
       -H "Content-Type: application/json" \
       -d '{
         "action": "financial_report",
         "clinicId": "<clinic_id>",
         "period": {
           "startDate": "2026-03-01",
           "endDate": "2026-03-31"
         }
       }'
     ```
   - Botão "Copiar" que copia o cURL para a clipboard
4. Também mostrar o cURL para o webhook de estoque (`stock_alert`) com exemplo correspondente

### Detalhes técnicos
- A URL da edge function será construída com `import.meta.env.VITE_SUPABASE_PROJECT_ID`
- O `clinicId` vem de `profile.clinic_id`
- Nenhuma alteração no backend necessária

