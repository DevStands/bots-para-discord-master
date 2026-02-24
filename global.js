require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, PermissionsBitField, MessageFlags, EmbedBuilder } = require('discord.js');
const moment = require('moment'); 

// Cache Global de Embeds (Sessões de Edição)
const embedCache = new Map();

try {
    // Helper para importar módulos sem crashar o bot se o arquivo faltar
    const safeRequire = (p) => {
        try { return require(p); } catch (err) {
            console.warn(`⚠️ Módulo não encontrado: ${p}`);
            return null;
        }
    };

    // ============================================================
    // 1. IMPORTAÇÃO DE COMANDOS E DEBUG
    // ============================================================
    
    const embedCriarCommand = safeRequire('./comandos/embed_criar'); 
    const falarCommand = safeRequire('./comandos/falarcomando');
    const limparCommand = safeRequire('./comandos/limpar'); 
    const radioCommand = safeRequire('./comandos/radio'); 
    const painelAdminCommand = safeRequire('./comandos/paineladmin'); 
    const setModLogCommand = safeRequire('./comandos/modlog'); 
    const setAdminRoleCommand = safeRequire('./comandos/setadminrole'); 

    const editarEmbedCommand = safeRequire('./comandos/editarembed'); 
    const importarCommand = safeRequire('./comandos/interactions/importarscript');
    const exportarCommand = safeRequire('./comandos/interactions/exportarscript');

    const buttonHandler = safeRequire('./comandos/interactions/botoes');
    const modalHandler = safeRequire('./comandos/interactions/envioformulario');
    const camposHandler = safeRequire('./comandos/interactions/campos'); 
    const contadorModule = safeRequire('./comandos/interactions/contador');
    const updateMemberCounter = contadorModule?.updateMemberCounter;

    const TOKEN = process.env.DISCORD_TOKEN;
    const CLIENT_ID = process.env.CLIENT_ID; 

    // ============================================================
    // 2. REGISTRO DE COMANDOS (API)
    // ============================================================
    const commandsToRegister = [];

    if (embedCriarCommand?.data) commandsToRegister.push(embedCriarCommand.data);
    if (falarCommand?.data) commandsToRegister.push(falarCommand.data);
    if (limparCommand?.data) commandsToRegister.push(limparCommand.data);
    if (radioCommand?.data) commandsToRegister.push(radioCommand.data);
    if (painelAdminCommand?.data) commandsToRegister.push(painelAdminCommand.data); 
    if (setModLogCommand?.data) commandsToRegister.push(setModLogCommand.data);
    if (setAdminRoleCommand?.data) commandsToRegister.push(setAdminRoleCommand.data);

    if (editarEmbedCommand?.data) commandsToRegister.push(editarEmbedCommand.data);
    if (importarCommand?.data) commandsToRegister.push(importarCommand.data);
    if (exportarCommand?.data) commandsToRegister.push(exportarCommand.data);

    // ============================================================
    // 3. INICIALIZAÇÃO E LIMPEZA DE DUPLICADOS
    // ============================================================
    const client = new Client({ 
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers, 
            GatewayIntentBits.MessageContent, 
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildPresences 
        ] 
    });

    client.on('clientReady', async (readyClient) => { 
        console.log(`✅ Logado como ${readyClient.user.tag}!`);
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        
        try {
            console.log('⏳ Sincronizando comandos (Limpando duplicados por servidor)...');
            
            // Registra Globalmente (Aparece em todos os servers sem duplicar)
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsToRegister });
            
            // Limpa o registro local de cada servidor (onde os duplicados moram)
            for (const guild of readyClient.guilds.cache.values()) {
                await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guild.id), { body: [] });
                if (updateMemberCounter) await updateMemberCounter(readyClient, guild);
            }

            console.log('✅ Comandos sincronizados com sucesso.');
        } catch (error) { 
            console.error(`❌ Erro no registro do Servidor:`, error.message); 
        }
    });

    // ============================================================
    // 4. ROTEAMENTO DE INTERAÇÕES + DEBUG COMPLETO
    // ============================================================
    client.on('interactionCreate', async (interaction) => {
        
        // --- INÍCIO DO BLOCO DE DEBUG (RESTAURADO SEM OMISSÕES) ---
        if (process.env.DEBUG_MODE === 'true') {
            if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
                const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
                const hasBridge = (interaction.customId || '').includes('__') ? "🔗 [PONTE ATIVA]" : "📍 [ID ÚNICO]";
                
                console.log(`\n--- 🛠️ DEBUG HABBI SOUND [${timestamp}] ---`);
                console.log(`👤 Usuário: ${interaction.user.tag}`);
                console.log(`🔑 Cache Key (MsgID): ${interaction.message?.id || "N/A (Início)"}`);

                if (interaction.isButton()) {
                    console.log(`🟢 TIPO: BOTÃO | ID: ${interaction.customId} | ${hasBridge}`);
                    if (interaction.customId.startsWith('delete_link_index_')) console.log(`🗑️ AÇÃO: Tentativa de excluir link em rascunho.`);
                } 
                else if (interaction.isStringSelectMenu()) {
                    console.log(`🔵 TIPO: MENU | ID: ${interaction.customId} | Selecionado: ${interaction.values.join(', ')}`);
                    if (interaction.customId === 'select_embed') console.log(`📊 AÇÃO: Mudança de Embed em edição.`);
                }
                else if (interaction.isModalSubmit()) {
                    console.log(`📝 TIPO: MODAL | ID: ${interaction.customId}`);
                    const fieldsReceived = interaction.fields.fields.map(f => f.customId).join(', ');
                    console.log(`📦 Campos Recebidos: [${fieldsReceived}]`);
                }
                console.log(`------------------------------------------\n`);
            }
        }
        // --- FIM DO BLOCO DE DEBUG ---

        const isAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isOwner = interaction.guild?.ownerId === interaction.user.id;
        const customId = interaction.customId || '';

        // --- A. COMANDOS DE BARRA (/) ---
        if (interaction.isChatInputCommand()) {
            const cmd = interaction.commandName;

            if (cmd === 'setmodlog') return await setModLogCommand?.execute(interaction);
            if (cmd === 'setadminrole') return await setAdminRoleCommand?.execute(interaction);
            if (cmd === 'painel') return await painelAdminCommand?.execute(interaction, client);
            if (cmd === 'falar') return await falarCommand?.execute(interaction);
            else if (cmd === 'embed') return await embedCriarCommand?.execute(interaction, embedCache);
            else if (cmd === 'limpar') return await limparCommand?.execute(interaction, embedCache);
            else if (cmd === 'radio') return await radioCommand?.execute(interaction, embedCache);
            return;
        }

        // --- B. COMANDOS DE CONTEXTO ---
        if (interaction.isContextMenuCommand()) {
            const menuName = interaction.commandName;
            if (menuName === 'Editar Embed') await editarEmbedCommand?.execute(interaction, embedCache);
            else if (menuName === 'Importar JSON') await importarCommand?.execute(interaction, embedCache);
            else if (menuName === 'Exportar JSON') await exportarCommand?.execute(interaction, embedCache);
            return;
        }

        // --- C. MODAIS ---
        if (interaction.isModalSubmit()) {
            if (customId.startsWith('admin_')) return await painelAdminCommand?.execute(interaction, client);
            if (customId.startsWith('modal_field_')) {
                await camposHandler?.execute(interaction, embedCache);
            } else {
                await modalHandler?.execute(interaction, embedCache, client);
            }
            return;
        }

        // --- D. BOTÕES E MENUS ---
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            if (customId.startsWith('admin_')) {
                if (!isAdmin && !isOwner) {
                    return interaction.reply({ content: '❌ Sem permissão administrativa.', flags: [MessageFlags.Ephemeral] });
                }
                return await painelAdminCommand?.execute(interaction, client);
            }

            if (customId.startsWith('btn_field_') || customId === 'select_field_manage') {
                await camposHandler?.execute(interaction, embedCache);
            } else {
                await buttonHandler?.execute(interaction, embedCache, client);
            }
        }
    });

    // ============================================================
    // 5. SISTEMA DE MODLOG (Eventos)
    // ============================================================
    const fs = require('fs');
    const path = require('path');
    const modlogConfigPath = path.join(__dirname, './modlog_config.json');

    const getModLogChannel = async (guild) => {
        if (!fs.existsSync(modlogConfigPath)) return null;
        try {
            const config = JSON.parse(fs.readFileSync(modlogConfigPath, 'utf8'));
            const channelId = config[guild.id];
            if (!channelId) return null;
            return guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
        } catch { return null; }
    };

    client.on('messageDelete', async (message) => {
        if (!message.guild || message.author?.bot) return;
        const logChannel = await getModLogChannel(message.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setAuthor({ name: '🗑️ Mensagem Excluída', iconURL: message.author.displayAvatarURL() })
            .setDescription(`**Autor:** ${message.author} (${message.author.id})\n**Canal:** ${message.channel}\n\n**Conteúdo:**\n${message.content || '*Mídia/Embed*'}`)
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('userUpdate', async (oldUser, newUser) => {
        if (oldUser.displayAvatarURL() === newUser.displayAvatarURL()) return;
        client.guilds.cache.forEach(async (guild) => {
            if (guild.members.cache.has(newUser.id)) {
                const logChannel = await getModLogChannel(guild);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#00BFFF')
                        .setAuthor({ name: '🖼️ Avatar Atualizado', iconURL: newUser.displayAvatarURL() })
                        .setDescription(`${newUser} atualizou sua foto de perfil.`)
                        .setThumbnail(newUser.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }
        });
    });

    client.login(TOKEN);

} catch (e) {
    console.error(`❌ ERRO FATAL NA INICIALIZAÇÃO:`, e);
}

process.on('unhandledRejection', error => console.error(`[FATAL] Erro não tratado (Promise):`, error));
process.on('uncaughtException', error => console.error(`[CRÍTICO] Exceção não tratada:`, error));