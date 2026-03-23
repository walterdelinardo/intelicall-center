

## Prontuários: documentos com download, materiais do faturamento, receita inline

### Resumo
Quatro alterações no módulo Prontuários (`ViewRecordInline`):
1. Na aba **Procedimentos**, exibir documentos anexos ao procedimento com botão de download e nome editável
2. Na aba **Procedimentos**, mostrar materiais efetivamente usados no faturamento (não do cadastro)
3. Na aba **Documentos**, adicionar botão de download para cada documento/arquivo
4. Botão **Gerar Receita** abre um formulário inline (não faz download) com campos editáveis, botão Imprimir e Salvar

### Pré-requisito: nova tabela `appointment_materials`
Atualmente o faturamento desconta estoque mas não persiste quais materiais foram usados por agendamento. Precisamos criar uma tabela para registrar isso.

**Migração SQL:**
```sql
CREATE TABLE public.appointment_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL,
  stock_item_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'un',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage appointment materials in their clinic"
  ON public.appointment_materials FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
```

### Alterações em `AgendaModule.tsx` (BillingDialog saveMutation)
Ao descontar estoque dos materiais, também inserir registros em `appointment_materials` para cada material usado, vinculando ao `appointment_id` principal do evento.

### Alterações em `ProntuariosModule.tsx` (ViewRecordInline)

**1. Query: buscar `appointment_materials` por appointment IDs**
- Carregar materiais usados para todos os appointments do paciente
- Agrupar por `appointment_id` para exibir dentro de cada evento expandido

**2. Aba Procedimentos — documentos anexos por procedimento**
- Filtrar `docs` pelo `appointment_id` correspondente (usar campo existente em `record_documents` se houver, ou pelo timing)
- Exibir lista com nome editável + botão de download (`<a href={url} download>`)

**3. Aba Procedimentos — materiais usados**
- Nova seção "Materiais Utilizados" dentro do evento expandido
- Listar nome, quantidade e unidade vindos de `appointment_materials`
- Substituir a exibição atual que não mostra materiais

**4. Aba Documentos — botão de download**
- Adicionar botão/ícone de download ao lado de cada documento existente
- Usar `<a href={doc.file_url} download={doc.title} target="_blank">`

**5. Gerar Receita — formulário inline**
- Substituir `generatePrescription()` (que faz download de .txt) por um estado `prescriptionForAppt`
- Quando clicado, exibir um formulário inline com:
  - Cabeçalho pré-preenchido (paciente, data, profissional, procedimento)
  - Campos editáveis: prescrição (textarea), orientações (textarea), observações (textarea)
  - Botão **Imprimir** (`window.print()` com CSS `@media print`)
  - Botão **Salvar** (salva como `record_document` ou simplesmente fecha)
- Não faz download nenhum

### Arquivos afetados
- `src/components/modules/AgendaModule.tsx` — persistir materiais em `appointment_materials`
- `src/components/modules/ProntuariosModule.tsx` — todas as mudanças de UI do prontuário
- Nova migração SQL para `appointment_materials`

