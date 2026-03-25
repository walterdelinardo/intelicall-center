

## Corrigir erro 401 na Edge Function send-evolution-message

### Problema
A função usa `supabase.auth.getClaims(token)` que **não existe** no SDK `@supabase/supabase-js@2.39.3`. O método sempre falha, retornando erro, e a função responde 401.

### Solução

**Arquivo: `supabase/functions/send-evolution-message/index.ts`**

Substituir `getClaims` por `supabase.auth.getUser(token)`, que é o método correto do SDK v2 para validar um JWT passando o token como argumento:

```typescript
// ANTES (incorreto - método não existe)
const token = authHeader.replace('Bearer ', '');
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { ... }
const userId = claimsData.claims.sub as string;

// DEPOIS (correto)
const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: userError } = await supabase.auth.getUser(token);
if (userError || !user) {
  console.error('Auth error:', userError);
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
const userId = user.id;
```

A diferença chave: `getUser(token)` aceita o token como parâmetro, validando-o diretamente sem depender da sessão do cliente.

