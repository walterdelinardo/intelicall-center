

## Plano: Vinculação Automática de Procedimentos a Prontuários

### Problema Identificado

1. **Procedimentos não aparecem no prontuário**: A aba "Procedimentos" do prontuário busca dados da tabela `appointments` filtrando por `client_id`. Porém, quando os agendamentos são feitos via Google Calendar (tipo `google`), nenhum registro é criado na tabela `appointments` — os dados ficam apenas no Google Calendar com `extendedProperties`. Logo, ao criar um prontuário manualmente, a aba fica vazia.

2. **Faturamento não cria prontuário**: O `BillingDialog` cria transações financeiras mas não cria/atualiza `medical_records` nem `appointments`.

3. **Evento Google não tem `client_id`**: Os eventos Google armazenam `clientName` e `clientWhatsapp` em `extendedProperties`, mas não têm referência direta ao `client_id` da tabela `clients`.

---

### Correções

#### 1. `BillingDialog` — Criar appointment + medical record ao faturar

No `saveMutation` do `BillingDialog` (AgendaModule.tsx):

- Buscar o `client_id` na tabela `clients` pelo nome (`extendedProperties.clientName`) e/ou WhatsApp (`extendedProperties.clientWhatsapp`)
- Buscar o `procedure_id` na tabela `procedures` pelo nome (`extendedProperties.procedureName`)
- Criar um registro em `appointments` com os dados do evento (data, horário, client_id, procedure_id, status: "compareceu")
- Verificar se já existe um `medical_record` para esse `client_id`:
  - Se sim: usar o existente (não duplicar)
  - Se não: criar um novo `medical_record` com `client_id`, `clinic_id`, `date`
- Vincular o `appointment_id` ao `medical_record`

#### 2. `RecordFormInline` — Ao criar prontuário manual, buscar appointments existentes

No `saveMutation` do `RecordFormInline` (ProntuariosModule.tsx):

- Após criar o `medical_record`, buscar todos os `appointments` do `client_id` que não estejam vinculados a nenhum `medical_record` (onde `appointment_id IS NULL` nos records, ou que não tenham referência)
- A aba Procedimentos já busca por `client_id` na tabela `appointments`, então basta garantir que existam registros lá

Na verdade, a aba Procedimentos já funciona se houver `appointments`. O problema real é que eventos Google não geram `appointments`. A correção principal é no faturamento.

#### 3. Ajuste na query de procedimentos

A query atual já funciona corretamente (`appointments` filtrada por `client_id`). O problema é que não existem registros em `appointments` para clientes agendados via Google Calendar. A correção no BillingDialog resolve isso.

---

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/modules/AgendaModule.tsx` | BillingDialog: criar `appointment` + `medical_record` (ou vincular ao existente) ao faturar |
| `src/components/modules/ProntuariosModule.tsx` | Nenhuma mudança estrutural necessária — a query de procedimentos já busca por `client_id` |

### Fluxo resultante

```text
Faturar evento Google
  ├─ Buscar client_id pelo nome/whatsapp
  ├─ Buscar procedure_id pelo nome
  ├─ Criar appointment (status: compareceu)
  ├─ Verificar medical_record existente para client_id
  │   ├─ Existe → não duplicar
  │   └─ Não existe → criar novo
  └─ Criar transações financeiras (já existente)

Criar prontuário manual
  └─ Aba Procedimentos busca appointments por client_id
      └─ Agora terá dados porque o faturamento criou appointments
```

