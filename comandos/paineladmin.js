const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../adminrole_config.json');

module.exports = {
    data: {
        name: 'painel',
        description: 'Abre o Centro de Controle Administrativo.',
    },

    async execute(interaction, client) {
        // --- 1. LÓGICA DINÂMICA DE PERMISSÕES ---
        const guildId = interaction.guild?.id;
        let configuredRoleId = null;

        // Tenta ler o JSON para ver se há um cargo configurado para este servidor
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                configuredRoleId = config[guildId];
            } catch (e) {}
        }

        const isOwner = interaction.guild?.ownerId === interaction.user.id;
        const hasNativeAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasConfiguredRole = configuredRoleId ? interaction.member?.roles.cache.has(configuredRoleId) : false;

        // Se não for dono, não tiver perm nativa e não tiver o cargo configurado -> Bloqueio
        if (!isOwner && !hasNativeAdmin && !hasConfiguredRole) {
            return interaction.reply({ 
                content: 'Acesso negado. Você não possui as credenciais necessárias.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // --- 2. COMANDO SLASH (ABRIR PAINEL) ---
        if (interaction.isChatInputCommand()) {
            return await interaction.reply({ ...getMainMenu(interaction.user), flags: [MessageFlags.Ephemeral] });
        }

        // --- 3. GERENCIADOR DE CLIQUES E MODAIS ---
        try {
            const id = interaction.customId;

            // Fechar Painel
            if (id === 'admin_mod_close') {
                return await interaction.update({ content: 'Sessão encerrada.', embeds: [], components: [] });
            }

            // Botão: Limpar Chat
            if (id === 'admin_mod_clear') {
                const modal = new ModalBuilder().setCustomId('admin_modal_mod_clear').setTitle('Controle de Mensagens');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('in_amount').setLabel('Quantidade a excluir (1-100)').setStyle(TextInputStyle.Short).setPlaceholder('10').setRequired(true)
                ));
                return await interaction.showModal(modal);
            }

            // Botão: Banir
            if (id === 'admin_mod_ban') {
                const modal = new ModalBuilder().setCustomId('admin_modal_mod_ban').setTitle('Gerenciamento de Acesso (Banir)');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_uid').setLabel('ID do Alvo').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_reason').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            // Botão: Expulsar
            if (id === 'admin_mod_kick') {
                const modal = new ModalBuilder().setCustomId('admin_modal_mod_kick').setTitle('Gerenciamento de Acesso (Expulsar)');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_uid').setLabel('ID do Alvo').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_reason').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(false))
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
                        return interaction.reply({ content: 'Valor inválido. Insira um número entre 1 e 100.', flags: [MessageFlags.Ephemeral] });
                    }
                    await interaction.channel.bulkDelete(amount, true);
                    return await interaction.reply({ content: `Operação concluída. ${amount} mensagens removidas.`, flags: [MessageFlags.Ephemeral] });
                }

                // Ação: Banir
                if (id === 'admin_modal_mod_ban') {
                    const uid = interaction.fields.getTextInputValue('in_uid').trim();
                    const reason = interaction.fields.getTextInputValue('in_reason') || 'Não especificado.';
                    try {
                        await interaction.guild.members.ban(uid, { reason: `Operador: ${interaction.user.tag} | Motivo: ${reason}` });
                        return await interaction.reply({ content: `Usuário <@${uid}> banido permanentemente.\nMotivo registrado: ${reason}`, flags: [MessageFlags.Ephemeral] });
                    } catch (e) {
                        return await interaction.reply({ content: `Falha na operação. Verifique o ID ou a hierarquia de cargos do bot.`, flags: [MessageFlags.Ephemeral] });
                    }
                }

                // Ação: Expulsar
                if (id === 'admin_modal_mod_kick') {
                    const uid = interaction.fields.getTextInputValue('in_uid').trim();
                    const reason = interaction.fields.getTextInputValue('in_reason') || 'Não especificado.';
                    try {
                        const member = await interaction.guild.members.fetch(uid);
                        if (!member.kickable && !isOwner) {
                            return interaction.reply({ content: 'Operação negada. Alvo possui imunidade hierárquica.', flags: [MessageFlags.Ephemeral] });
                        }
                        await member.kick(`Operador: ${interaction.user.tag} | Motivo: ${reason}`);
                        return await interaction.reply({ content: `Usuário <@${uid}> removido do servidor.\nMotivo registrado: ${reason}`, flags: [MessageFlags.Ephemeral] });
                    } catch (e) {
                        return await interaction.reply({ content: `Falha na operação. Alvo não encontrado.`, flags: [MessageFlags.Ephemeral] });
                    }
                }
            }

        } catch (error) {
            console.error('Erro no Painel Admin:', error);
        }
    }
};

// --- INTERFACE ---
function getMainMenu(user) {
    const embed = new EmbedBuilder()
        .setColor('#2b2d31') // Cor escura/moderna
        .setTitle('Centro de Controle')
        .setDescription('Painel de ações restritas do servidor. Todas as interações são auditáveis.')
        .addFields(
            { name: 'Operador Credenciado', value: `${user.tag}`, inline: false }
        )
        .setFooter({ text: 'Sistema de Moderação' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_mod_clear').setLabel('Excluir Mensagens').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('admin_mod_ban').setLabel('Aplicar Banimento').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin_mod_kick').setLabel('Remover Membro').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_mod_close').setLabel('Encerrar Sessão').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
}