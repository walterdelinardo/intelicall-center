

## Plano: 5 melhorias na Agenda, Prontuários, Procedimentos e Lista de Espera

Este plano abrange 5 solicitações distintas. Segue o detalhamento de cada uma.

---

### 1. Email do cliente não importado ao selecionar cliente na Agenda

**Problema identificado**: Na busca de clientes ao criar evento Google Calendar, apenas clientes externos (do banco externo via `get-clients`) são pesquisados. Clientes locais (tabela `clients` do sistema) não aparecem na busca. Além disso, a query de clientes locais (`clients-list`) só seleciona `id, name` — sem email, whatsapp, etc.

**Solução**: Incluir clientes locais na busca do formulário de criação de evento. Alterar a query `clients-list` para incluir `email, whatsapp, phone`. Mesclar clientes locais e externos na lista de busca, priorizando clientes locais (que têm dados completos).

**Arquivos**: `src/components/modules/AgendaModule.tsx`

---

### 2. Prontuário criado automaticamente ao criar evento no Google Calendar

**Problema**: Atualmente, prontuários só são criados via faturamento. Eventos criados pelo sistema ou externamente não geram prontuário.

**Solução em duas frentes**:

- **Eventos criados pelo sistema**: Após criar evento com sucesso no `handleCreate`, resolver/criar o `client_id` local e inserir um `medical_records` automaticamente (se não existir para aquele cliente+data).

- **Eventos externos (automações)**: Criar uma edge function `sync-calendar-records` que, ao ser chamada (ou via cron/webhook), verifica eventos do Google Calendar que não têm prontuário associado e cria automaticamente. Alternativamente, durante o `fetchEvents` do hook, verificar eventos sem prontuário e criá-los.

A abordagem mais prática: no `AgendaModule`, ao fazer `fetchEvents`, para cada evento com `extendedProperties.clientName`, verificar se já existe prontuário para aquele cliente+data e criá-lo se não existir. Isso cobre tanto eventos internos quanto externos.

**Arquivos**: `src/components/modules/AgendaModule.tsx`, possivelmente `src/hooks/useGoogleCalendar.ts`

---

### 3. Evento abre inline (não pop-up) + redirect para Prontuário após criar

**Solução**:
- Substituir o `Dialog` de criação de evento por um formulário inline (similar ao padrão já usado em `ProntuariosModule` com `viewMode`).
- Substituir o `Dialog` de edição/visualização de evento por uma view inline.
- Após criar evento com sucesso, navegar para o módulo Prontuários com o `client_id` pré-selecionado na aba "Ficha". Usar o `DashboardContext` para adicionar uma função `openProntuario(clientId)`.

**Arquivos**: `src/components/modules/AgendaModule.tsx`, `src/contexts/DashboardContext.tsx`, `src/components/modules/ProntuariosModule.tsx`

---

### 4. Procedimentos: formulário inline + seção de materiais do estoque

**Solução**:
- **Migração**: Criar tabela `procedure_materials` com colunas: `id`, `procedure_id` (FK), `stock_item_id` (FK), `quantity` (numeric), `clinic_id`.
- **UI**: Substituir o `Dialog` de criar/editar procedimento por um formulário inline (viewMode pattern). Adicionar seção "Materiais Utilizados" com busca de itens do estoque e campo de quantidade.

**Arquivos**: `src/components/modules/ProcedimentosModule.tsx`, migração SQL

---

### 5. Lista de Espera: contador de dias, distância, tempos de transporte

**Solução**:
- **Contador de dias**: Calcular `Math.floor((Date.now() - new Date(item.created_at)) / 86400000)` e exibir na tabela.
- **Distância e tempos de transporte**: Usar a API do Google Maps Distance Matrix (via edge function) para calcular distância, tempo de carro e tempo de transporte público entre o endereço do cliente e o endereço da clínica. Armazenar os resultados em cache na tabela `waiting_list` (novas colunas: `distance_km`, `transit_time_min`, `driving_time_min`).
- **Ordenação**: Alterar a ordenação para: status ativo primeiro, prioridade, dias na fila, distância, tempo.

**Nota**: A API Distance Matrix requer uma chave do Google Maps. Será necessário configurar esse secret.

**Arquivos**: `src/components/modules/ListaEsperaModule.tsx`, migração SQL, nova edge function `calculate-distance`

---

### Resumo de migrações SQL

```sql
-- 1. Tabela de materiais por procedimento
CREATE TABLE public.procedure_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.procedure_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage procedure materials in their clinic"
  ON public.procedure_materials FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

-- 2. Colunas de distância na lista de espera
ALTER TABLE public.waiting_list
  ADD COLUMN distance_km numeric,
  ADD COLUMN transit_time_min integer,
  ADD COLUMN driving_time_min integer;
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | `procedure_materials` + colunas de distância em `waiting_list` |
| `src/components/modules/AgendaModule.tsx` | Email fix, formulários inline, auto-criação de prontuário, redirect |
| `src/contexts/DashboardContext.tsx` | Adicionar `openProntuario(clientId)` |
| `src/components/modules/ProntuariosModule.tsx` | Aceitar navegação externa com clientId pré-selecionado |
| `src/components/modules/ProcedimentosModule.tsx` | Formulário inline + seção de materiais |
| `src/components/modules/ListaEsperaModule.tsx` | Contador de dias, distância, tempos, nova ordenação |
| Nova edge function `calculate-distance` | Calcular distância via Google Maps API |

