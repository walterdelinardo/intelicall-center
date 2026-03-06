

## Plano: Atualizar Secrets e Criar Gestão de Instâncias WhatsApp

### 1. Atualizar Secrets

Os três secrets já existem no projeto. Vou solicitar a atualização dos valores:

- `EVOLUTION_API_URL` → `https://evo-v3-nw.nicwalsolutions.com.br`
- `EVOLUTION_API_KEY` → `KILeEHinKZt5sGZzaDgfSBGznnK91y73`
- `EVOLUTION_INSTANCE_NAME` → `demo-nw-1` (fallback)

### 2. Criar Seção de Gestão de Inboxes no SettingsTab

Adicionar um card "Instâncias WhatsApp" no `SettingsTab.tsx` que permita:

- Listar as inboxes cadastradas na tabela `whatsapp_inboxes`
- Adicionar nova inbox (instance_name, label, phone_number)
- Editar/desativar inbox existente
- Cada inbox representa um número WhatsApp conectado via Evolution API

O formulário de nova inbox terá:
- **Label** (ex: "Recepção", "Financeiro")
- **Instance Name** (nome da instância na Evolution API)
- **Telefone** (número do WhatsApp)

A tabela `whatsapp_inboxes` já existe com RLS por `clinic_id` — só admins podem gerenciar.

### Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/components/dashboard/SettingsTab.tsx` | Adicionar card de gestão de inboxes com CRUD |
| `src/hooks/useWhatsApp.ts` | Adicionar mutations para criar/editar/desativar inboxes |

