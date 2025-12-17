const { 
    SlashCommandBuilder, EmbedBuilder, PermissionsBitField, 
    ChannelType, AttachmentBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Nome do canal de log para o backup
const LOG_CHANNEL_NAME = 'logs-chat';

module.exports = {
    // 🛑 Definição do Comando Slash: /limpar
    data: new SlashCommandBuilder()
        .setName('limpar')
        .setDescription('Faz backup do histórico e apaga todas as mensagens de um canal de texto.')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('O canal de texto a ser limpo.')
                .addChannelTypes(ChannelType.GuildText) // Garante que seja um canal de texto
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels) // Requer permissão de Gerenciar Canais
        .setDMPermission(false), // Não pode ser usado em DM

    async execute(interaction, cache) {
        // Deferir para dar tempo de processar o backup
        await interaction.deferReply({ ephemeral: true });

        // 1. VERIFICAÇÕES DE PERMISSÃO E ENTRADA
        const targetChannel = interaction.options.getChannel('canal');
        const guild = interaction.guild;
        
        // Verifica se o bot pode deletar mensagens no canal alvo
        const botPermissions = targetChannel.permissionsFor(interaction.client.user);
            if (!botPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.editReply({ 
                content: '❌ ERRO: Eu preciso da permissão **Gerenciar Mensagens** neste canal para realizar a limpeza.' 
            });
        }
        if (!botPermissions.has(PermissionsBitField.Flags.ViewChannel) || !botPermissions.has(PermissionsBitField.Flags.ReadMessageHistory)) {
             return interaction.editReply({ 
                content: '❌ ERRO: Eu preciso da permissão **Ver Canal** e **Ler Histórico de Mensagens** para fazer o backup.' 
            });
        }

        const logFileName = `chat_backup_${guild.id}_${targetChannel.name}_${Date.now()}.txt`;
        
        try {
            // ---------------------------------------------------------
            // 2. FAZER BACKUP (Ler todas as mensagens)
            // ---------------------------------------------------------
            await interaction.editReply(`📥 Iniciando backup do canal #${targetChannel.name}. Por favor, aguarde, isso pode levar um tempo.`);

            let allMessages = [];
            let lastId;
            let messagesRead = 0;

            // Loop para buscar o histórico completo
            while (true) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;

                const messages = await targetChannel.messages.fetch(options);
                if (messages.size === 0) break;

                messages.forEach(msg => {
                    const date = msg.createdAt.toLocaleString('pt-BR');
                    const author = msg.author.tag;
                    const content = msg.content || '[Anexo/Embed]';
                    allMessages.push(`[${date}] ${author}: ${content}`);
                });

                lastId = messages.last().id;
                messagesRead = allMessages.length;
                
                // Atualiza o deferReply (opcional, mas bom para feedback)
                if (messagesRead % 500 === 0 && messagesRead > 0) {
                     await interaction.editReply(`... lidas ${messagesRead} mensagens do histórico.`);
                }
                if (messagesRead > 10000) break; // Limite de segurança para não travar o bot

            }
            
            // Salvar em arquivo local temporário
            const logContent = allMessages.reverse().join('\n');
            fs.writeFileSync(logFileName, logContent || 'Nenhuma mensagem encontrada.');

            // ---------------------------------------------------------
            // 3. ENVIAR PARA CANAL DE LOG
            // ---------------------------------------------------------
            let logChannel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);

            if (!logChannel) {
                // Se não encontrar, tenta criar um canal de log
                logChannel = await guild.channels.create({
                    name: LOG_CHANNEL_NAME,
                    type: ChannelType.GuildText,
                    // Tenta colocar na mesma categoria, ou no topo da lista se não houver categoria
                    parent: targetChannel.parent, 
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel], // Privado para todos (apenas admins conseguem ver se tiver permissão)
                        },
                    ],
                    reason: 'Criação automática para logs de limpeza de chat.'
                });
            }
            
            const attachment = new AttachmentBuilder(logFileName);

            await logChannel.send({
                content: `🗃️ **Backup do chat** **#${targetChannel.name}** realizado por ${interaction.user.tag} em ${new Date().toLocaleString('pt-BR')}`,
                files: [attachment]
            });
            
            // ---------------------------------------------------------
            // 4. LIMPAR O CHAT (Bulk Delete)
            // ---------------------------------------------------------
            
            let deletedCount = 0;
            
            // Loop para deletar em lotes de 100
            while (true) {
                 const fetched = await targetChannel.messages.fetch({ limit: 100 });
                 if (fetched.size === 0) break;

                 // Tenta usar bulkDelete para mensagens recentes (<14 dias)
                 const deleted = await targetChannel.bulkDelete(fetched, true); // true = filtrar mensagens antigas
                 deletedCount += deleted.size;
                 
                 if (deleted.size === 0 && fetched.size > 0) {
                     // Se bulkDelete não deletou nada, mas há mensagens fetched, significa que são todas antigas.
                     
                     // Tentativa de deletar uma por uma (lento, mas apaga as antigas)
                     for (const msg of fetched.values()) {
                         await msg.delete().catch(err => console.error(`❌ Erro ao deletar msg antiga ${msg.id}:`, err.message));
                         deletedCount++;
                         // Pausa para evitar rate limit
                         await new Promise(r => setTimeout(r, 1000));
                     }
                 } else if (deleted.size < fetched.size) {
                    // Se bulkDelete deletou algumas, mas sobraram antigas
                     await new Promise(r => setTimeout(r, 1000));
                     continue; // Recarrega para tentar novamente
                 }
                
                // Pausa entre os lotes
                await new Promise(r => setTimeout(r, 1000)); 

                if (fetched.size < 100) break; // Terminou de limpar
            }

            // ---------------------------------------------------------
            // 5. MENSAGEM FINAL
            // ---------------------------------------------------------
            const finalEmbed = new EmbedBuilder()
                .setColor(0xA020F0)
                .setTitle('✨ Limpeza Concluída!')
                .setDescription(`🗑️ **Mensagens apagadas:** ${deletedCount}\n🗃️ **Log salvo em:** <#${logChannel.id}>`)
                .setFooter({ text: 'RZSISTEMA.com.br' })
                .setTimestamp();

            await targetChannel.send({ embeds: [finalEmbed] });

            // Deletar arquivo local temporário
            fs.unlinkSync(logFileName);

            await interaction.editReply({ 
                content: `✅ Limpeza de **#${targetChannel.name}** concluída! ${deletedCount} mensagens apagadas. Log enviado para <#${logChannel.id}>.` 
            });

        } catch (error) {
            console.error(`❌ Erro durante o comando /limpar:`, error);
            // Tenta deletar o arquivo de backup local em caso de erro
            if (fs.existsSync(logFileName)) {
                fs.unlinkSync(logFileName);
            }
             if (!interaction.replied && !interaction.deferred) {
                 return interaction.reply({ content: `❌ ERRO FATAL: Houve uma falha crítica na execução do comando. Detalhes no console.`, ephemeral: true });
             } else {
                 return interaction.editReply({ content: `❌ ERRO FATAL: Houve uma falha crítica na execução do comando. Detalhes no console.` });
             }
        }
    }
};