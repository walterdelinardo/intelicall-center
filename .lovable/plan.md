

## Plano: Simplificar fluxo Google Calendar (apenas OAuth)

### Problema atual
1. Existe opção iCal que deve ser removida
2. Ao clicar "Conectar Conta", aparece um formulário com Label + dois botões (OAuth/iCal) -- confuso
3. O fluxo ideal: clicar "Conectar Conta Google" → redireciona direto para OAuth → após retorno, lista calendários disponíveis → ao selecionar um, pede o Label → salva

### Novo fluxo proposto

1. Botão "Conectar Conta Google" → inicia OAuth imediatamente (sem formulário intermediário)
2. Após OAuth callback, a conta aparece na tabela com `calendar_id: 'primary'` e label padrão "Conta Google"
3. Na tabela, coluna "Agenda" com dropdown para selecionar o calendário desejado
4. Ao selecionar um calendário, abre um input inline para definir o Label (ex: "Dr. João - Pessoal")
5. Salva `calendar_id` e `label` juntos

### Mudanças

#### 1. `ConfiguracoesModule.tsx`
- Remover botões OAuth/iCal e campo Label do formulário de adicionar
- Botão "Conectar Conta Google" chama `initiateOAuth()` direto
- Remover estados: `showAddGoogle`, `addGoogleMode`, `newGoogleLabel`, `newICalUrl`
- Na tabela, tornar a coluna "Label" editável (input inline com botão salvar)
- Quando o usuário selecionar um calendário no dropdown, abrir campo para informar o Label
- Remover coluna "Tipo" (já que só teremos OAuth)

#### 2. `useGoogleOAuth.ts`
- Remover método `addICalAccount`
- Adicionar método `updateLabel(accountId, label)` para atualizar o label
- `initiateOAuth` não precisa mais receber label (usar padrão "Conta Google")

#### 3. Fluxo visual na tabela
```
| Label (editável)     | Agenda (dropdown)    | Status | Ações        |
| [Conta Google ✏️]    | [Selecionar ▾]       | Ativo  | ⚡ 🗑️       |
```
- Ao selecionar agenda no dropdown, se label ainda é o padrão, mostra prompt para renomear
- Label editável com ícone de lápis

