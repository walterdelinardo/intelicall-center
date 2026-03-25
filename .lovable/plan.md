

## Migrar funcionalidades WhatsApp para ConfiguracoesModule

### Problema
As funcionalidades de QR Code, status online/offline e monitor de quedas foram adicionadas ao `SettingsTab.tsx`, mas o dashboard usa `ConfiguracoesModule.tsx` na aba Integrações. Os recursos nunca aparecem para o usuário.

### Solução

**Arquivo: `src/components/modules/ConfiguracoesModule.tsx`**

1. **Adicionar imports**: `QrCode`, `Wifi`, `WifiOff`, `Activity` icons + `Dialog/DialogContent/DialogHeader/DialogTitle`

2. **Adicionar estados**: `qrDialogOpen`, `qrData`, `qrLoading`, `qrInstanceLabel`, `statuses` (Record de status por inbox), `downtimeLogs`, `loadingLogs`

3. **Adicionar lógica**: `checkInstanceStatus`, `fetchDowntimeLogs`, `handleGenerateQR` — mesma lógica já presente no `SettingsTab.tsx`

4. **Na tabela de instâncias** (linhas ~509-603):
   - Adicionar coluna "Conexão" com badge Online/Offline baseado no status da Evolution API
   - Adicionar botão de QR Code e botão de verificar status nas ações de cada instância

5. **Após o card de instâncias** (após linha ~690):
   - Adicionar card "Monitor de Disponibilidade" com tabela de downtime logs (instância, início da queda, retorno, tempo fora)

6. **Adicionar Dialog de QR Code** ao final do componente

7. **Polling**: verificar status a cada 30s e ao montar o componente

### Observação
O `SettingsTab.tsx` pode ser mantido como está ou limpo posteriormente — a prioridade é que as funcionalidades apareçam no módulo correto.

