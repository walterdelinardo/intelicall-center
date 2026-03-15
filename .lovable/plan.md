

## Plano: Corrigir fluxo OAuth e erro 403

### Causa raiz do 403
O erro 403 vem do Google OAuth. Possíveis causas:
1. O app OAuth no Google Cloud Console está em modo "Testing" e o email do usuário não foi adicionado como "Test user"
2. A Redirect URI configurada no Google Cloud Console não bate exatamente com a usada pelo sistema
3. A origem JavaScript autorizada não inclui o domínio do preview Lovable

Além disso, a edge function `google-calendar-events` usa `Deno.env.get('GOOGLE_CLIENT_ID')` para refresh de tokens em vez de buscar credenciais per-clinic na tabela `google_oauth_config`.

### Mudanças

#### 1. `ConfiguracoesModule.tsx` - Botão "Conectar Conta Google" abre dialog de credenciais
- O botão "Conectar Conta Google" sempre abre o `GoogleOAuthConfigDialog` primeiro
- Após salvar credenciais no dialog, adicionar botão "Conectar" que chama `initiateOAuth()`
- Remover o botão separado "Configurar Credenciais" (já que o fluxo será unificado)

#### 2. `GoogleOAuthConfigDialog.tsx` - Adicionar instruções e botão conectar
- Após salvar credenciais com sucesso, mostrar botão "Conectar Conta Google" no próprio dialog
- Adicionar instruções claras sobre:
  - Adicionar a **Origem JavaScript autorizada**: `https://id-preview--c60d1b58-c36a-4470-8a43-03e327dda9dd.lovable.app`
  - Adicionar o email como **Usuário de teste** se o app estiver em modo Testing
  - Habilitar a **Google Calendar API** no Google Cloud Console
- Manter o campo Redirect URI com botão copiar

#### 3. `google-calendar-events/index.ts` - Usar credenciais per-clinic
- Na função `getValidAccessToken`, buscar `client_id` e `client_secret` da tabela `google_oauth_config` via `clinic_id` da conta (mesmo padrão já usado em `google-list-calendars` e `google-oauth-callback`)
- Remover dependência de `Deno.env.get('GOOGLE_CLIENT_ID')` e `GOOGLE_CLIENT_SECRET` como fallback

#### 4. Fluxo visual resultante
```text
Configurações > Integrações > Google Calendar:
  [Conectar Conta Google] → Abre dialog com campos Client ID, Secret, Redirect URI
                          → Após salvar, botão "Conectar ao Google" no dialog
                          → Redireciona para Google OAuth
                          → Retorna e lista conta na tabela
                          → Usuário seleciona agenda e edita label
```

