const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, MessageFlags
} = require('discord.js');

// Configuração do Cargo de Admin (Backup caso o usuário não tenha permissão nativa)
const ADMIN_ROLE_ID = '1437609235943919636';

module.exports = {
    // Dados para registro no global.js
    data: {
        name: 'painel',
        description: 'Abre o Painel de Moderação (Ban, Kick, Limpeza).',
    },

    async execute(interaction, client) {
        // --- 1. VERIFICAÇÃO DE SEGURANÇA ---
        const isAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isOwner = interaction.guild?.ownerId === interaction.user.id;
        const hasRole = interaction.member.roles.cache.has(ADMIN_ROLE_ID);

        // Se não for Admin, nem Dono, nem tiver o cargo: Bloqueia.
        if (!isAdmin && !isOwner && !hasRole) {
            return interaction.reply({ 
                content: '⛔ **Acesso Negado.** Você não possui credenciais de Administrador.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // --- 2. COMANDO SLASH (ABRIR PAINEL) ---
        if (interaction.isChatInputCommand()) {
            return await interaction.reply({ ...getMainMenu(), flags: [MessageFlags.Ephemeral] });
        }

        // --- 3. GERENCIADOR DE CLIQUES E MODAIS ---
        try {
            const id = interaction.customId;

            // ===========================
            //      BOTÕES DO MENU
            // ===========================
            
            // Botão: Sair (Com correção de erro)
            if (id === 'admin_mod_close') {
                try {
                    // Tenta apagar a mensagem efêmera
                    await interaction.deleteReply();
                } catch (e) {
                    // Se não der para apagar (ex: timeout), apenas edita removendo tudo
                    await interaction.update({ content: '🔒 **Painel Administrativo Fechado.**', embeds: [], components: [] });
                }
                return;
            }

            // Botão: Limpar Chat (Abre Modal)
            if (id === 'admin_mod_clear') {
                const modal = new ModalBuilder().setCustomId('admin_modal_mod_clear').setTitle('🧹 Limpeza de Chat');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('in_amount').setLabel('Quantidade (1-100)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 20').setRequired(true)
                ));
                return await interaction.showModal(modal);
            }

            // Botão: Banir (Abre Modal)
            if (id === 'admin_mod_ban') {
                const modal = new ModalBuilder().setCustomId('admin_modal_mod_ban').setTitle('🔨 Banir Usuário');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_uid').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_reason').setLabel('Motivo do Banimento').setStyle(TextInputStyle.Paragraph).setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            // Botão: Expulsar (Abre Modal)
            if (id === 'admin_mod_kick') {
                const modal = new ModalBuilder().setCustomId('admin_modal_mod_kick').setTitle('🦶 Expulsar Usuário');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_uid').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_reason').setLabel('Motivo da Expulsão').setStyle(TextInputStyle.Paragraph).setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            // ===========================
            //      SUBMISSÃO DE MODAIS
            // ===========================
            if (interaction.isModalSubmit()) {
                
                // Ação: Limpar Chat
                if (id === 'admin_modal_mod_clear') {
                    const amount = parseInt(interaction.fields.getTextInputValue('in_amount'));
                    
                    if (isNaN(amount) || amount < 1 || amount > 100) {
                        return interaction.reply({ content: '❌ A quantidade deve ser um número entre **1 e 100**.', flags: [MessageFlags.Ephemeral] });
                    }
                    
                    // Bulk Delete
                    await interaction.channel.bulkDelete(amount, true);
                    return await interaction.reply({ content: `✅ **Sucesso:** Foram apagadas ${amount} mensagens recentes.`, flags: [MessageFlags.Ephemeral] });
                }

                // Ação: Banir
                if (id === 'admin_modal_mod_ban') {
                    const uid = interaction.fields.getTextInputValue('in_uid');
                    const reason = interaction.fields.getTextInputValue('in_reason') || 'Sem motivo especificado.';
                    
                    try {
                        // Tenta banir
                        await interaction.guild.members.ban(uid, { reason: `Painel Admin: ${reason}` });
                        return await interaction.reply({ content: `🚨 **BANIDO:** O usuário <@${uid}> (${uid}) foi banido.\n📝 **Motivo:** ${reason}`, flags: [MessageFlags.Ephemeral] });
                    } catch (e) {
                        return await interaction.reply({ content: `❌ **Erro ao Banir:** Verifique se o ID está correto e se o bot tem permissão superior ao usuário alvo.`, flags: [MessageFlags.Ephemeral] });
                    }
                }

                // Ação: Expulsar
                if (id === 'admin_modal_mod_kick') {
                    const uid = interaction.fields.getTextInputValue('in_uid');
                    const reason = interaction.fields.getTextInputValue('in_reason') || 'Sem motivo especificado.';
                    
                    try {
                        const member = await interaction.guild.members.fetch(uid);
                        if (member) {
                            if (!member.kickable) return interaction.reply({ content: '❌ Eu não tenho permissão para expulsar este usuário (cargo dele pode ser maior que o meu).', flags: [MessageFlags.Ephemeral] });
                            
                            await member.kick(`Painel Admin: ${reason}`);
                            return await interaction.reply({ content: `🦶 **KICK:** O usuário <@${uid}> foi expulso.\n📝 **Motivo:** ${reason}`, flags: [MessageFlags.Ephemeral] });
                        } else {
                            return await interaction.reply({ content: '❌ Usuário não encontrado no servidor.', flags: [MessageFlags.Ephemeral] });
                        }
                    } catch (e) {
                        return await interaction.reply({ content: `❌ **Erro ao Expulsar:** ${e.message}`, flags: [MessageFlags.Ephemeral] });
                    }
                }
            }

        } catch (error) {
            console.error('❌ Erro no Painel Admin:', error);
            // Evita crash se a interação já tiver sido respondida
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao processar sua solicitação.', flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};

// --- INTERFACE (MENU PRINCIPAL) ---
function getMainMenu() {
    const embed = new EmbedBuilder()
        .setColor(0x2F3136) // Dark theme color
        .setTitle('🛡️ PAINEL DE MODERAÇÃO')
        .setDescription('Ferramenta administrativa segura.\nEscolha uma ação abaixo:')
        .addFields(
            { name: '🧹 Limpeza', value: 'Remove até 100 mensagens.', inline: true },
            { name: '🔨 Banimento', value: 'Banir usuário por ID.', inline: true },
            { name: '🦶 Expulsão', value: 'Expulsar usuário por ID.', inline: true }
        )
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/906/906343.png')
        .setFooter({ text: 'RZSISTEMA • Acesso Restrito' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_mod_clear').setLabel('Limpar Chat').setStyle(ButtonStyle.Primary).setEmoji('🧹'),
        new ButtonBuilder().setCustomId('admin_mod_ban').setLabel('Banir').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
        new ButtonBuilder().setCustomId('admin_mod_kick').setLabel('Expulsar').setStyle(ButtonStyle.Secondary).setEmoji('🦶'),
        new ButtonBuilder().setCustomId('admin_mod_close').setLabel('Fechar Painel').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
    );

    return { embeds: [embed], components: [row] };
}