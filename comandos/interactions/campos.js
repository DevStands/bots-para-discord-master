const { 
    ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, 
    EmbedBuilder, ButtonStyle, ButtonBuilder, StringSelectMenuBuilder, MessageFlags 
} = require('discord.js');

module.exports = {
    async execute(interaction, cache) {
        const cacheKey = interaction.message?.id || interaction.customId.split('_').pop(); // Tenta recuperar ID
        let userData = cache.get(cacheKey);
        
        // Recuperação de falha de cache simples
        if (!userData) {
            // Tenta buscar em cache global se o ID estiver no customId
            const parts = interaction.customId.split('_');
            const potentialId = parts[parts.length - 1];
            if (cache.has(potentialId)) userData = cache.get(potentialId);
        }

        if (!userData) {
            return interaction.reply({ 
                content: '❌ Sessão expirada ou não encontrada. Por favor, reinicie o painel.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const activeEmbedIndex = userData.activeEmbedIndex;
        if (activeEmbedIndex === -1) return interaction.reply({ content: '❌ Selecione um embed primeiro.', flags: [MessageFlags.Ephemeral] });

        let currentEmbed = EmbedBuilder.from(userData.embeds[activeEmbedIndex]);

        try {
            // 1. ABRIR MODAL DE ADICIONAR CAMPO
            if (interaction.customId === 'edit_fields' || interaction.customId === 'btn_field_add') {
                // Verifica limite de 25 campos do Discord
                if (currentEmbed.data.fields && currentEmbed.data.fields.length >= 25) {
                    return interaction.reply({ content: '❌ Limite de 25 campos atingido.', flags: [MessageFlags.Ephemeral] });
                }

                const modal = new ModalBuilder().setCustomId(`modal_field_add_${cacheKey}`).setTitle('Adicionar Campo');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_name').setLabel('Título do Campo').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_value').setLabel('Conteúdo').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_inline').setLabel('Inline? (sim/não)').setStyle(TextInputStyle.Short).setPlaceholder('Deixe vazio para não').setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            // 2. RECEBER DADOS DO MODAL (SALVAR CAMPO)
            if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_field_')) {
                const name = interaction.fields.getTextInputValue('field_name');
                const value = interaction.fields.getTextInputValue('field_value');
                const inlineRaw = interaction.fields.getTextInputValue('field_inline').toLowerCase();
                const inline = inlineRaw === 'sim' || inlineRaw === 's' || inlineRaw === 'yes';

                currentEmbed.addFields({ name, value, inline });
                
                // Salvar e Atualizar
                userData.embeds[activeEmbedIndex] = currentEmbed.toJSON();
                cache.set(cacheKey, userData);
                
                // Atualiza o painel principal
                const envioHandler = require('./envioformulario');
                return await envioHandler.execute(interaction, cache, interaction.client);
            }

            // 3. GERENCIAR CAMPOS (REMOVER)
            // Lógica simplificada: Se clicar em gerenciar, mostra um menu ou avisa que foi adicionado
            // Se você tiver lógica de remoção específica, ela viria aqui.
            
        } catch (error) {
            console.error('Erro em campos.js:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Erro ao processar campos.', flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};