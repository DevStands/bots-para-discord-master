const { 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, 
    TextInputStyle, MessageFlags // 🛑 Importado para consistência
} = require('discord.js');

function createHomeButtonRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('go_to_home')
            .setLabel('⬅️ Voltar ao Início/Concluir Edição')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createGeneralActionRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('add_new_embed').setLabel('+ Adicionar Embed').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('publish_quick').setLabel('⚡ Enviar Rápido').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('publish_webhook_custom').setLabel('🌐 Enviar Personalizado').setStyle(ButtonStyle.Success)
    );
}

function createLinkManagementButtons(linkButtons) {
    const linkComponents = [];
    linkComponents.push({ customId: 'add_link_button', label: '🔗 Adicionar Link', style: ButtonStyle.Success });
    
    if (linkButtons && linkButtons.length > 0) {
        linkComponents.push({ 
            customId: 'enter_link_delete_mode', 
            label: `🗑️ Excluir Links (${linkButtons.length})`, 
            style: ButtonStyle.Danger 
        });
    }
    return linkComponents;
}

function createDeleteModeRows(linkButtons, cacheKey) {
    const rows = [];
    let current_row = new ActionRowBuilder();
    
    linkButtons.forEach((link, index) => {
        const label = link.label ? (link.label.length > 20 ? link.label.substring(0, 20) + '...' : link.label) : `Link ${index+1}`;
        // O cacheKey garante que a interação saiba qual rascunho editar
        const customId = cacheKey ? `delete_link_index_${index}__${cacheKey}` : `delete_link_index_${index}`;
        
        const btn = new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(`🗑️ Excluir: ${label}`)
            .setStyle(ButtonStyle.Danger);
            
        if (current_row.components.length === 5) { 
            rows.push(current_row); 
            current_row = new ActionRowBuilder(); 
        }
        current_row.addComponents(btn);
    });
    
    if (current_row.components.length > 0) rows.push(current_row);
    
    const backId = cacheKey ? `back_from_delete_mode__${cacheKey}` : 'back_from_delete_mode';
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(backId).setLabel('⬅️ Cancelar / Voltar').setStyle(ButtonStyle.Secondary)
    ));
    return rows;
}

function createLinkActionRow(linkButtons) {
    if (!linkButtons || linkButtons.length === 0) return [];
    
    // Converte os botões salvos em JSON de volta para componentes ButtonBuilder
    const linkButtonsComponents = linkButtons.map(b => {
        // Garante que o tipo seja botão de link (Style 5)
        return new ButtonBuilder()
            .setLabel(b.label)
            .setURL(b.url)
            .setStyle(ButtonStyle.Link);
    });

    const rows = [];
    let current_row = new ActionRowBuilder();
    
    linkButtonsComponents.forEach((component) => {
        if (current_row.components.length === 5) { 
            rows.push(current_row); 
            current_row = new ActionRowBuilder(); 
        }
        current_row.addComponents(component);
    });
    
    if (current_row.components.length > 0) rows.push(current_row);
    return rows;
}

function createLinkModal(customId, label = '', url = '', isEdit = false) {
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(isEdit ? `✏️ Editar Botão` : `🔗 Adicionar Botão`);

    const labelInput = new TextInputBuilder()
        .setCustomId('link_label')
        .setLabel('Texto')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(80);
    if (label) labelInput.setValue(label);

    const urlInput = new TextInputBuilder()
        .setCustomId('link_url')
        .setLabel('URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    if (url) urlInput.setValue(url);

    if (isEdit) {
        const deleteInput = new TextInputBuilder()
            .setCustomId('link_delete_check')
            .setLabel('Para EXCLUIR, digite: DELETAR')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);
            
        modal.addComponents(
            new ActionRowBuilder().addComponents(labelInput), 
            new ActionRowBuilder().addComponents(urlInput), 
            new ActionRowBuilder().addComponents(deleteInput)
        );
    } else {
        modal.addComponents(
            new ActionRowBuilder().addComponents(labelInput), 
            new ActionRowBuilder().addComponents(urlInput)
        );
    }
    return modal;
}

module.exports = {
    createHomeButtonRow,
    createGeneralActionRow,
    createLinkManagementButtons,
    createDeleteModeRows,
    createLinkActionRow,
    createLinkModal
};