# Instruções para agentes de codificação (Copilot)

Resumo rápido
- Projeto: Bot Node.js para Discord (discord.js v14).
- Arquivo de inicialização e roteamento: [global.js](global.js#L1-L200).
- Padrão: cada comando em `comandos/` exporta `data` (SlashCommandBuilder) e `execute()`.

Arquitetura e fluxo principal
- `global.js` instancia o `Client`, registra comandos via REST e roteia `interactionCreate`.
- Mensagens de interface (painel de criação de embed) são mantidas em cache do tipo `Map` (chave = id da mensagem). Veja como o painel é criado em [comandos/embed_criar.js](comandos/embed_criar.js#L1-L200) e consumido por [comandos/interactions/envioformulario.js](comandos/interactions/envioformulario.js#L1-L200).
- Handlers de componentes (buttons, modals, selects) ficam em `comandos/interactions/` e seguem convenções de `customId` (prefixos comuns: `modal_field_`, `btn_field_`, `select_field_manage`, `publish_quick`, `publish_webhook_custom`). Consulte [envioformulario.js](comandos/interactions/envioformulario.js#L1-L200) para exemplos de roteamento.

Padrões e convenções do código
- Comandos: exportar `{ data: SlashCommandBuilder, async execute(interaction, cache, ... ) }`.
 - Cache: usar `cache.set(messageId, { embeds, activeEmbedIndex, componentRows, linkButtons })`. O `messageId` vem de `replyMessage.id` (ver [comandos/embed_criar.js](comandos/embed_criar.js#L1-L200)).
- Handlers de interação: muitos `execute` aceitam `(interaction, cache, client)` — lembre-se de passar `client` quando requerido (correções no `global.js` demonstram isso).
 - Replies: preferir `deferReply`/`deferUpdate` e respostas efêmeras (ex.: `interaction.reply({ flags: 64 })`) para ações administrativas de UI quando apropriado.
- Limites do Discord: respeitar máximo de 10 embeds por mensagem e ~1900 chars por mensagem ao criar chunks (implementado em `marcapessoa.js` / `marcacargo.js`).

Permissões e dependências externas
- Variáveis de ambiente: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (usar `.env`).
- Intents necessários: `Guilds`, `GuildMembers`, `MessageContent`, `GuildVoiceStates` (ver [global.js](global.js#L1-L200)).
- Permissões runtime usadas explicitamente: `MANAGE_WEBHOOKS` (criação/envio de webhooks em `envioformulario.js`), `MANAGE_MESSAGES`, `ViewChannel`, `ReadMessageHistory` (em `comandos/limpar.js`).

Exemplos práticos (onde olhar)
- Criar painel e armazenar cache: [comandos/embed_criar.js](comandos/embed_criar.js#L1-L200).
- Manipular modals e webhooks: [comandos/interactions/envioformulario.js](comandos/interactions/envioformulario.js#L1-L200).
- Backup + bulk delete (limpeza): [comandos/limpar.js](comandos/limpar.js#L1-L200).
- Exemplos de marcação em massa (chunking + pausa): [marcapessoa.js](marcapessoa.js#L1-L200) e [marcacargo.js](marcacargo.js#L1-L200).

Fluxos de desenvolvimento e comandos úteis
- Instalar dependências: `npm install`.
- Rodar localmente: `npm start` (executa `node index.js`, veja [package.json](package.json#L1-L80)).
- Requisitos: criar `.env` com `DISCORD_TOKEN` e definir intents/escopos no Developer Portal.

Boas práticas específicas deste repo
- Ao adicionar um novo comando Slash: criar em `comandos/` com `data` e `execute`, exportar padrão, e o `global.js` tentará registrar automaticamente se `require()` retornar `data`.
- Para UI baseada em mensagens (painel de embed): sempre capture a mensagem de resposta (`await interaction.reply(...); const replyMessage = await interaction.fetchReply()` ou `fetch()` como feito em `embed_criar.js`) e use o ID como chave do cache.
- Ao modificar handlers que usam `customId` prefixados, preserve os prefixos existentes para manter roteamento compatível. Para fluxos efêmeros que precisam referenciar o painel público, incorpore o `messageId` no `customId` (ex.: `delete_link_index_0__{messageId}`) para que o handler consiga localizar o painel original.

Erros e mensagens de log
- Estratégia corrente: usar `try/catch`, `console.error()` e, em scripts de run único, `process.exit(1)` quando falhas são fatais (ver `global.js`).

O que evitar / observar
- Não enviar mais de 10 embeds por mensagem (o código já limita). Evitar alteração que remova essa verificação.
- Webhooks: criação exige permissão `MANAGE_WEBHOOKS`; cheque permissões antes de criar/usar.

Como pedir alterações ao agente
- Ao solicitar mudanças, referencie o arquivo e a região com links de arquivo (ex.: alterar comportamento em [comandos/interactions/envioformulario.js](comandos/interactions/envioformulario.js#L1-L200)).
- Se for alterar cache/formatos, especifique a nova shape do objeto e atualize todos os handlers que o acessam (`embed_criar.js`, `envioformulario.js`, `botoes.js`, `campos.js`).

Feedback solicitado
- O que está confuso ou faltando aqui? Quer exemplos de patch prático (p.ex. adicionar `ownerId` checks) ou validações automáticas de permissões?

----
Gerado automaticamente — revisável e iterável.
