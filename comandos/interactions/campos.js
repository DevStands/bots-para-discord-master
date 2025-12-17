const { 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, 
    TextInputBuilder, TextInputStyle, EmbedBuilder, StringSelectMenuBuilder,
    MessageFlags // 🛑 ADICIONADO: Necessário para o padrão 2025
} = require('discord.js');

module.exports = {
    async execute(interaction, cache) {
        const cacheKey = interaction.message ? interaction.message.id : interaction.messageId;
        const userData = cache.get(cacheKey);

        // 🛑 ATUALIZADO: flags
        if (!userData) return interaction.reply({ content: '❌ Sessão expirada.', flags: [MessageFlags.Ephemeral] });

        const activeEmbedIndex = userData.activeEmbedIndex;
        // 🛑 ATUALIZADO: flags
        if (activeEmbedIndex === -1) return interaction.reply({ content: '❌ Erro: Selecione um embed antes de gerenciar campos.', flags: [MessageFlags.Ephemeral] });

        const currentEmbed = EmbedBuilder.from(userData.embeds[activeEmbedIndex]);
        let fields = currentEmbed.data.fields || [];

        // Verificação de segurança: A interação deve ser atualizável
        const checkUpdate = async (payload) => {
            if (!interaction.replied) {
                await interaction.update(payload);
            } else if (interaction.deferred) {
                await interaction.editReply(payload);
            }
        };

        // --- LÓGICA DE INTERAÇÃO ---
        
        // 🛑 TRATAMENTO DE SUBMISSÃO DE MODAIS
        if (interaction.isModalSubmit()) {
            const name = interaction.fields.getTextInputValue('f_name');
            const value = interaction.fields.getTextInputValue('f_value');
            const inlineRaw = interaction.fields.getTextInputValue('f_inline');
            const inline = ['sim', 's', 'yes', 'y', 'verdadeiro', 'v'].includes(inlineRaw.toLowerCase().trim());

            fields = currentEmbed.data.fields || [];

            // Adição de Campo
            if (interaction.customId === 'modal_field_add') {
                // 🛑 ATUALIZADO: flags
                if (!name || !value) {
                    return interaction.reply({ content: '❌ Título e texto do campo são obrigatórios.', flags: [MessageFlags.Ephemeral] });
                }
                
                if (fields.length >= 25) {
                    return interaction.reply({ content: '❌ Limite de 25 campos atingido.', flags: [MessageFlags.Ephemeral] });
                }
                
                if (inline && fields.filter(f => f.inline).length >= 2) {
                    return interaction.reply({ content: '❌ Você só pode ter 2 campos com Inline "Sim".', flags: [MessageFlags.Ephemeral] });
                }

                currentEmbed.addFields({ name, value, inline });
                userData.embeds[activeEmbedIndex] = currentEmbed.toJSON();
                cache.set(cacheKey, userData);

                await renderFieldManager(interaction, currentEmbed, currentEmbed.data.fields.length - 1, checkUpdate, `✅ Campo "${name}" adicionado.`);
                return;
            } 
            
            // Edição de Campo
            else if (interaction.customId.startsWith('modal_field_edit_')) {
                const index = parseInt(interaction.customId.split('_').pop());
                
                // 🛑 ATUALIZADO: flags
                if (!fields[index]) {
                    return interaction.reply({ content: '❌ Campo para edição não encontrado.', flags: [MessageFlags.Ephemeral] });
                }
                
                const isCurrentlyInline = fields[index].inline;
                const inlineCount = fields.filter((field, i) => i !== index && field.inline).length;
                
                if (inline && !isCurrentlyInline && inlineCount >= 2) {
                    return interaction.reply({ content: '❌ Não é possível editar para "Sim". O limite de 2 campos Inline já foi atingido.', flags: [MessageFlags.Ephemeral] });
                }
                
                fields[index] = { name, value, inline };
                currentEmbed.setFields(fields);

                userData.embeds[activeEmbedIndex] = currentEmbed.toJSON();
                cache.set(cacheKey, userData);
                
                await renderFieldManager(interaction, currentEmbed, index, checkUpdate, `✅ Campo #${index + 1} editado.`);
                return;
            }
        }

        // 1. SELEÇÃO DO MENU
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_field_manage') {
            const selectedIndex = parseInt(interaction.values[0]);
            await renderFieldManager(interaction, currentEmbed, selectedIndex, checkUpdate);
            return;
        }

        if (interaction.isButton()) {
            
            // 2. BOTÃO: NOVO CAMPO
            if (interaction.customId === 'btn_field_add') {
                if (fields.length >= 25) {
                    return interaction.reply({ content: '❌ Limite máximo do Discord (25 campos) atingido.', flags: [MessageFlags.Ephemeral] });
                }

                const modal = new ModalBuilder().setCustomId('modal_field_add').setTitle('Novo Campo');
                const nameInput = new TextInputBuilder().setCustomId('f_name').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true);
                const valueInput = new TextInputBuilder().setCustomId('f_value').setLabel('Texto').setStyle(TextInputStyle.Paragraph).setRequired(true);
                const inlineInput = new TextInputBuilder().setCustomId('f_inline').setLabel('Inline (Sim/Não)').setPlaceholder('Ex: Sim').setStyle(TextInputStyle.Short).setRequired(true); 

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput), 
                    new ActionRowBuilder().addComponents(valueInput),
                    new ActionRowBuilder().addComponents(inlineInput)
                );

                await interaction.showModal(modal);
                return;
            }

            // 3. BOTÃO: EDITAR CAMPO SELECIONADO
            if (interaction.customId.startsWith('btn_field_edit_')) {
                const index = parseInt(interaction.customId.split('_').pop());
                const field = fields[index];

                if (!field) return interaction.reply({ content: '❌ Campo não encontrado.', flags: [MessageFlags.Ephemeral] });

                const modal = new ModalBuilder().setCustomId(`modal_field_edit_${index}`).setTitle(`Editar Campo #${index + 1}`);
                const nameInput = new TextInputBuilder().setCustomId('f_name').setLabel('Título').setStyle(TextInputStyle.Short).setValue(field.name).setRequired(true);
                const valueInput = new TextInputBuilder().setCustomId('f_value').setLabel('Texto').setStyle(TextInputStyle.Paragraph).setValue(field.value).setRequired(true);
                const inlineInput = new TextInputBuilder().setCustomId('f_inline').setLabel('Inline (Sim/Não)').setValue(field.inline ? 'Sim' : 'Não').setStyle(TextInputStyle.Short).setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(valueInput),
                    new ActionRowBuilder().addComponents(inlineInput)
                );

                await interaction.showModal(modal);
                return;
            }

            // 4. BOTÃO: APAGAR CAMPO SELECIONADO
            if (interaction.customId.startsWith('btn_field_del_')) {
                const index = parseInt(interaction.customId.split('_').pop());
                
                if (fields[index]) {
                    const removedName = fields[index].name;
                    fields.splice(index, 1); 
                    currentEmbed.setFields(fields);
                    userData.embeds[activeEmbedIndex] = currentEmbed.toJSON();
                    cache.set(cacheKey, userData);

                    await renderFieldManager(interaction, currentEmbed, null, checkUpdate, `✅ Campo "${removedName}" apagado.`);
                } else {
                    await renderFieldManager(interaction, currentEmbed, null, checkUpdate);
                }
                return;
            }
            
            // 5. BOTÃO: VOLTAR
            if (interaction.customId === 'btn_field_back') {
                const selectorRow = ActionRowBuilder.from(userData.componentRows[0]);
                const homeButtonsRow = ActionRowBuilder.from(userData.componentRows[1]);
                const finalComponents = [selectorRow, homeButtonsRow];

                if (userData.componentRows.length > 2) {
                    finalComponents.push(...userData.componentRows.slice(2).map(row => ActionRowBuilder.from(row)));
                }

                await interaction.update({
                    content: `## 📰 Painel de Criação de Embed\n**Editando:** Retornando à edição do Embed ${activeEmbedIndex + 1}`,
                    embeds: [currentEmbed],
                    components: finalComponents
                });
                return;
            }
        }

        if (!interaction.isModalSubmit()) {
            await renderFieldManager(interaction, currentEmbed, null, checkUpdate);
        }
    }
};

// --- FUNÇÃO AUXILIAR DE UI (MANTIDA INTEGRALMENTE) ---
async function renderFieldManager(interaction, currentEmbed, selectedIndex, checkUpdate, extraMsg = '') {
    const fields = currentEmbed.data.fields || [];
    const components = [];

    if (fields.length > 0) {
        const menuOptions = fields.map((f, i) => ({
            label: `${i + 1}. ${f.name.slice(0, 95)}`,
            description: f.value.slice(0, 50) || 'Sem texto',
            value: i.toString(),
            default: i === selectedIndex 
        }));

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_field_manage')
                .setPlaceholder('Selecione um campo para configurar')
                .setOptions(menuOptions)
        );
        components.push(menuRow);
    }

    const buttonsRow = new ActionRowBuilder();
    buttonsRow.addComponents(new ButtonBuilder().setCustomId('btn_field_back').setEmoji('⬅️').setStyle(ButtonStyle.Secondary));
    buttonsRow.addComponents(new ButtonBuilder().setCustomId('btn_field_add').setLabel('Novo Campo').setEmoji('➕').setStyle(ButtonStyle.Success).setDisabled(fields.length >= 25));

    if (selectedIndex !== null && fields[selectedIndex]) {
        const selectedField = fields[selectedIndex].name.slice(0, 15) + (fields[selectedIndex].name.length > 15 ? '...' : '');
        buttonsRow.addComponents(
            new ButtonBuilder().setCustomId(`btn_field_edit_${selectedIndex}`).setLabel(`Editar: ${selectedField}`).setEmoji('✏️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`btn_field_del_${selectedIndex}`).setLabel(`Apagar`).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        );
    }

    components.push(buttonsRow);
    const msgContent = `## 📝 Edição de Campos do Embed\n${extraMsg}\nCampos Atuais: **${fields.length}/25**`;

    await checkUpdate({
        content: msgContent,
        embeds: [currentEmbed], 
        components: components
    });
}