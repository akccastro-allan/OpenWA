# OpenWA Gateway - Codex Handoff

## Regra

Voce e executor.

As decisoes arquiteturais e de produto estao nos MDs do Connect e nos documentos deste repositório.

Nao trocar provider.

Nao abrir nova fase.

Fase atual efetiva:

FASE 1 - WHATSAPP + CRM

Prioridade absoluta:

WHATSAPP FUNCIONANDO.

## Repositórios

- Gateway: `akccastro-allan/OpenWA`
- Connect: `akccastro-allan/Shamar-Connect`

Leia tambem:

- `../Shamar-Connect/docs/CODEX-HANDOFF.md` no repositório Connect
- `docs/README.md`

## Fonte da verdade operacional

- domínio gateway: `https://gateway.shamarconnect.com.br`
- runtime/provider atual: `whatsapp-web.js`
- sessão de teste atual: `viciados-01`
- UUID técnico conhecido: `e2888423-4680-49ce-88b2-1a357bd60a4e`

## Estado atual

PASS comprovados live:

- gateway online
- session recovery básico
- identity
- phone
- webhook registration/test

FAIL / UNDER INVESTIGATION:

- provider runtime stability
- inbound real consistente

## Commits importantes

- `4cc354f` `fix(session): expose session identity endpoint`
- `7766be5` `fix(runtime): align session data path defaults`
- `9218de8` `fix(storage): persist gateway sqlite data on mounted volume`
- `f53ca2f` `fix(webhook): include session alias in gateway events`
- `3487ea0` `fix(webhook): send session alias as compatibility sessionId`
- `6f28d28` `fix(runtime): add session runtime probe and self-heal`

## Problema atual

O runtime `whatsapp-web.js` permanece instável.

Já houve evidência de mensagens reais do mesmo remetente entrarem no gateway:

- `Olá, testando o Connect!!`
- `Testa`

Mas outras mensagens reais desapareceram antes mesmo do gateway observar.

Portanto:

`PROVIDER RUNTIME STABILITY = FAIL / UNDER INVESTIGATION`

## Próximo experimento oficial

P0-G2 - estabilização do runtime `whatsapp-web.js`

Objetivos:

1. pinar versão exata
2. usar `client.getState()`
3. usar `client.getWWebVersion()`
4. validar runtime probe por sessão
5. detectar `GHOST CONNECTION`
6. validar self-heal controlado
7. executar mensagens reais sequenciais
8. se necessário, A/B controlado com `1.34.6`

## O que NÃO fazer

- não trocar provider por conta própria
- não migrar para WAHA, WPPConnect ou Meta sem decisão externa
- não mexer no Connect quando ficar provado que o evento nem chegou ao gateway
- não marcar PASS porque existe código, endpoint ou teste unitário

## Critério de sucesso do gateway

Mensagem real
-> runtime/provider
-> gateway
-> webhook session-scoped

deve ser observável e estável.

Somente depois disso o Connect volta a ser o próximo ponto de trabalho.
