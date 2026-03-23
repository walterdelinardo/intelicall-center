

## Melhorias no Módulo Prontuários

### Resumo
8 alterações no módulo Prontuários cobrindo receituário, avaliações, ficha clínica, histórico e regras de imutabilidade.

---

### Pré-requisito: Migrações SQL

**1. Tabela `prescriptions`** — para persistir receituários (imutáveis após salvar):
```sql
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  appointment_id UUID,
  clinic_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  professional_name TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  procedure_name TEXT,
  prescription TEXT,
  orientations TEXT,
  observations TEXT,
  ai_safety_check TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS com clinic_id
```

**2. Tabela `assessment_types`** — tipos de avaliação customizáveis:
```sql
CREATE TABLE public.assessment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  name TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS com clinic_id
```

**3. Tabela `assessments`** — avaliações genéricas (imutáveis):
```sql
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  assessment_type_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS com clinic_id
```

**4. Tabela `record_audit_log`** — histórico de alterações:
```sql
CREATE TABLE public.record_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  tab TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS com clinic_id, somente INSERT e SELECT
```

---

### Alterações em `ProntuariosModule.tsx`

**1. Receituário — nome do podólogo logado**
- No `ViewRecordInline`, obter `profile` do `useAuth()` 
- No campo "Profissional" do receituário, usar `profile?.full_name` (usuário logado) em vez de `record.profiles?.full_name`

**2. Remover botão "Editar" do cabeçalho**
- Remover o `<Button>` com `<Edit>` que aparece na linha ~890 do `ViewRecordInline`
- Remover o prop `onEdit` do componente

**3. Aba "Avaliação Pés" → "Avaliações"**
- Renomear a aba no `TabsTrigger`
- Substituir o conteúdo por: lista de avaliações salvas (da tabela `assessments` com join em `assessment_types`), campo de busca/filtro, select para filtrar por tipo, botão "Nova Avaliação" que abre formulário inline
- Botão "Cadastrar Tipo de Avaliação" que abre dialog para criar novo tipo (nome + campos dinâmicos definidos como JSON)
- Avaliações salvas são read-only (sem editar/excluir), para criar nova basta usar o botão

**4. Receituários imutáveis + imprimir só após salvar**
- Ao salvar, persistir na tabela `prescriptions` e registrar no audit log
- Após salvar, os campos ficam read-only e o botão "Imprimir" é habilitado
- Antes de salvar, botão "Imprimir" fica `disabled`
- Receituários salvos aparecem listados no evento expandido (read-only)

**5. Verificação de IA ao salvar receituário**
- Ao clicar "Salvar", chamar a edge function `analyze-document` (ou criar uma nova `check-prescription-safety`) passando: prescrição, dados da ficha clínica do paciente (alergias, diagnóstico, notas)
- Exibir resultado da IA como alerta antes de confirmar o salvamento
- Persistir o resultado em `prescriptions.ai_safety_check`

**6. Aba "Ficha Clínica" editável**
- Transformar os campos read-only da ficha em um formulário editável inline (com `Textarea`/`Input`)
- Adicionar botão "Salvar Alterações" que faz `update` na `medical_records`
- Registrar no audit log cada edição

**7. Nova aba "Histórico"**
- Adicionar 5a aba no `TabsList` (grid-cols-5)
- Buscar dados de `record_audit_log` filtrado pelo `record_id`
- Exibir lista cronológica: data, usuário, aba, ação, resumo
- Ao clicar num registro, expandir/dialog mostrando `details` (JSON formatado)

---

### Nova Edge Function: `check-prescription-safety`

- Recebe: prescrição, ficha do paciente (alergias, diagnóstico, notas clínicas)
- Usa Lovable AI (Gemini) com system prompt médico para verificar contraindicações
- Retorna: `{ safe: boolean, warnings: string[] }`

---

### Alterações em `RecordFormInline`
- Renomear aba "Avaliação Pés" → "Avaliações" (consistência)
- O formulário de criação/edição do prontuário mantém a aba Avaliações com o formato antigo (pé esquerdo/direito) como template padrão, mas também permite os novos tipos

### Arquivos afetados
- `src/components/modules/ProntuariosModule.tsx` — todas as mudanças de UI
- `supabase/functions/check-prescription-safety/index.ts` — nova edge function
- 4 novas migrações SQL

