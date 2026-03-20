

## Plano: Redesign do Módulo de Prontuários

### Resumo
Transformar o módulo de prontuários para abrir inline (na mesma página), substituir aba "Produtos" por "Procedimentos", renomear "Fotos" para "Documentos" com títulos editáveis e análise por IA, e adicionar botão de gerar Receita.

---

### 1. Migração de banco — tabela `record_documents`

```sql
CREATE TABLE public.record_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Documento sem título',
  file_url text NOT NULL,
  file_type text DEFAULT 'image',
  ai_analysis text,
  ai_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.record_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage record documents"
ON public.record_documents FOR ALL
TO public
USING (clinic_id = get_user_clinic_id(auth.uid()))
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
```

Mantém a tabela `record_photos` existente (dados legados), mas novos uploads vão para `record_documents`.

---

### 2. Edge Function `analyze-document` 

Nova edge function que recebe URL do arquivo e usa Lovable AI para analisar:
- Se imagem médica (raio-X, foto clínica): análise técnica profissional
- Se documento textual (declaração, receita, laudo): resumo informativo
- Salva resultado em `record_documents.ai_analysis`

---

### 3. `ProntuariosModule.tsx` — Reescrita completa

**a) Novo fluxo de navegação inline (sem dialogs):**
- Estado `view`: `"list"` | `"create"` | `"edit"` | `"view"`
- Quando `view === "list"`: mostra tabela atual
- Quando `view === "create"` ou `"edit"`: mostra formulário na mesma página com botão "Voltar"
- Quando `view === "view"`: mostra visualização na mesma página

**b) Substituir aba "Produtos" por "Procedimentos":**
- Listar todos os procedimentos do paciente (da tabela `appointments` com join em `procedures`)
- Filtrados pelo `client_id` do prontuário
- Botão para anexar imagens/documentos (abre file picker, salva em `record_documents`)
- Botão "Gerar Receita" que cria texto formatado com dados do prontuário

**c) Aba "Fotos" vira "Documentos":**
- Upload de imagens E documentos (aceitar image/*, application/pdf)
- Cada arquivo tem campo `title` editável
- Botão "Analisar com IA" em cada documento
- Exibe resultado da análise em card expandível
- Armazena em `record_documents` em vez de `record_photos`

---

### 4. Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Criar `record_documents` |
| `supabase/functions/analyze-document/index.ts` | Nova edge function com Lovable AI |
| `supabase/config.toml` | Registrar nova function |
| `src/components/modules/ProntuariosModule.tsx` | Reescrita: inline, aba Procedimentos, aba Documentos com IA |

