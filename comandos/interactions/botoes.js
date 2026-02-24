const { 
    ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, 
    EmbedBuilder, ButtonStyle, ButtonBuilder, MessageFlags, StringSelectMenuBuilder
} = require('discord.js');

const camposHandler = require('./campos'); 
const ui = require('../../ui_helpers');

// Helper para reconstruir o Dropdown de Embeds
function rebuildEmbedSelector(embeds) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_embed')
        .setPlaceholder('Selecione um Embed para editar...');
    
    embeds.forEach((_, index) => {
        selectMenu.addOptions({
            label: `Embed ${index + 1}`,
            value: index.toString()
        });
    });

    return new ActionRowBuilder().addComponents(selectMenu);
}

// Helper para recarregar a interface principal (Home/Editor)
async function reloadMainInterface(interaction, userData, cacheKey, cache) {
    // Garante que o menu de seleção de embeds esteja limpo
    const row1 = ActionRowBuilder.from(userData.componentRows[0]);
    row1.components[0].options.forEach(o => o.default = false);
    
    // Reconstrói as linhas padrão
    const rows = [row1, ui.createGeneralActionRow(), ...ui.createLinkActionRow(userData.linkButtons)];
    
    cache.set(cacheKey, userData);
    
    // Define qual embed mostrar (Home = Embed 1, Editor = Embed Ativo)
    const activeIndex = userData.activeEmbedIndex === -1 ? 0 : userData.activeEmbedIndex;
    const previewEmbed = EmbedBuilder.from(userData.embeds[activeIndex]);
    
    // Define o título
    const title = userData.activeEmbedIndex === -1 ? "## 📰 Painel Principal" : `## ✏️ Editando Embed ${activeIndex + 1}`;

    return await interaction.update({ 
        content: title,
        embeds: [previewEmbed], 
        components: rows 
    });
}

module.exports = {
    async execute(interaction, cache, client) { 
        let cacheKey = interaction.message?.id; 
        let userData = cache.get(cacheKey); 
        
        // Recuperação de sessão para modais (que as vezes perdem o contexto)
        if (!userData && interaction.customId?.includes('__')) {
            const recoveredKey = interaction.customId.split('__').pop(); 
            userData = cache.get(recoveredKey);
            if (userData) cacheKey = recoveredKey; 
        }

        if (!userData) {
            return interaction.reply({ 
                content: '❌ Sessão expirada. Use `/embed criar` novamente.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }
        
        const activeEmbedIndex = userData.activeEmbedIndex;

        try {
            // 1. GERENCIAMENTO DE CAMPOS
            if (interaction.customId === 'edit_fields' || interaction.customId.startsWith('btn_field_') || interaction.customId === 'select_field_manage') {
                return await camposHandler.execute(interaction, cache);
            }

            // 2. NAVEGAÇÃO ENTRE EMBEDS
            if (interaction.isStringSelectMenu() && interaction.customId === 'select_embed') {
                userData.activeEmbedIndex = parseInt(interaction.values[0]);
                cache.set(cacheKey, userData);
                return await require('./envioformulario').execute(interaction, cache, client);
            }

            // 3. CONFIRMAÇÃO DE REMOÇÃO DE LINK (Ação do Menu)
            if (interaction.isStringSelectMenu() && interaction.customId === 'select_remove_link') {
                const indexToRemove = parseInt(interaction.values[0]);
                
                if (indexToRemove >= 0 && indexToRemove < userData.linkButtons.length) {
                    // Remove o link
                    userData.linkButtons.splice(indexToRemove, 1);
                    cache.set(cacheKey, userData);
                    
                    // Retorna para a interface principal imediatamente
                    return await reloadMainInterface(interaction, userData, cacheKey, cache);
                }
            }

            // 4. VOLTAR PARA HOME / CANCELAR
            if (interaction.customId === 'go_to_home') {
                userData.activeEmbedIndex = -1;
                return await reloadMainInterface(interaction, userData, cacheKey, cache);
            }

            // 5. PROCESSAMENTO DE BOTÕES
            if (interaction.isButton()) {
                
                // === ADICIONAR NOVO EMBED ===
                if (interaction.customId === 'add_new_embed') {
                    if (userData.embeds.length >= userData.MAX_EMBEDS) {
                        return interaction.reply({ content: `❌ Limite de ${userData.MAX_EMBEDS} embeds atingido.`, flags: [MessageFlags.Ephemeral] });
                    }

                    userData.embeds.push(new EmbedBuilder().setTitle(`Embed ${userData.embeds.length + 1}`).setDescription('Nova descrição...').setColor(0x00A0FF).toJSON());

                    // Reconstrói o menu e atualiza
                    userData.componentRows[0] = rebuildEmbedSelector(userData.embeds).toJSON();
                    cache.set(cacheKey, userData);
                    
                    const row1 = ActionRowBuilder.from(userData.componentRows[0]);
                    const row2 = ActionRowBuilder.from(userData.componentRows[1]);
                    return interaction.update({ components: [row1, row2] });
                }

                // === EXCLUIR EMBED ATUAL ===
                if (interaction.customId === 'delete_current_embed') {
                    if (userData.embeds.length <= 1) return interaction.reply({ content: '❌ Você precisa ter pelo menos 1 embed.', flags: [MessageFlags.Ephemeral] });
                    if (activeEmbedIndex === 0) return interaction.reply({ content: '❌ O **Embed 1** é o principal e não pode ser apagado.', flags: [MessageFlags.Ephemeral] });
                    if (activeEmbedIndex === -1) return interaction.reply({ content: '❌ Selecione um embed para apagar.', flags: [MessageFlags.Ephemeral] });

                    userData.embeds.splice(activeEmbedIndex, 1);
                    userData.componentRows[0] = rebuildEmbedSelector(userData.embeds).toJSON();
                    userData.activeEmbedIndex = -1; 
                    
                    cache.set(cacheKey, userData);
                    return await reloadMainInterface(interaction, userData, cacheKey, cache);
                }

                // === WEBHOOK ===
                if (interaction.customId === 'publish_webhook_custom') {
                    const modal = new ModalBuilder().setCustomId('modal_send_webhook').setTitle('Personalizar Envio');
                    const nameInput = new TextInputBuilder().setCustomId('webhook_name').setLabel('Nome do Webhook').setStyle(TextInputStyle.Short).setRequired(true).setValue(interaction.guild?.name || 'HabbiSound');
                    const iconInput = new TextInputBuilder().setCustomId('webhook_icon_url').setLabel('Avatar URL').setStyle(TextInputStyle.Short).setRequired(false).setValue(interaction.guild?.iconURL({ forceStatic: true, extension: 'png' }) || '');
                    modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(iconInput));
                    return await interaction.showModal(modal);
                }

                // === ADICIONAR LINK ===
                if (interaction.customId === 'add_link_button') {
                    if (userData.linkButtons.length >= 5) return interaction.reply({ content: '❌ Limite de 5 links.', flags: [MessageFlags.Ephemeral] });
                    return await interaction.showModal(ui.createLinkModal('modal_add_link_button'));
                }

                // === 🟢 REMOVER LINK (MODO LAYER/CAMADA) ===
                if (interaction.customId === 'remove_link_button') {
                    if (userData.linkButtons.length === 0) return interaction.reply({ content: '⚠️ Nenhum link para remover.', flags: [MessageFlags.Ephemeral] });

                    // Cria o menu de exclusão
                    const removeMenu = new StringSelectMenuBuilder()
                        .setCustomId('select_remove_link')
                        .setPlaceholder('Selecione o link para remover');

                    userData.linkButtons.forEach((btn, index) => {
                        removeMenu.addOptions({ label: btn.label, value: index.toString(), description: btn.url.substring(0, 50) });
                    });

                    // Cria botão de Voltar/Cancelar
                    const cancelBtn = new ButtonBuilder()
                        .setCustomId('go_to_home') // Reaproveita a lógica de recarregar a home
                        .setLabel('Cancelar / Voltar')
                        .setStyle(ButtonStyle.Secondary);

                    const rowMenu = new ActionRowBuilder().addComponents(removeMenu);
                    const rowCancel = new ActionRowBuilder().addComponents(cancelBtn);

                    // 🛑 O SEGREDO: Usamos update() para substituir o painel atual por este menu
                    // Mantemos o mesmo ID de mensagem, logo o cache continua funcionando!
                    return interaction.update({
                        content: '## 🗑️ Modo de Exclusão\nSelecione abaixo qual link deseja remover:',
                        embeds: [], // Esconde os embeds para focar na exclusão
                        components: [rowMenu, rowCancel]
                    });
                }

                // === MODAIS GERAIS DE EDIÇÃO ===
                const modalMap = {
                    'edit_title': { id: 'modal_update_title', title: '📝 Editar Título', components: [{ id: 'title_input', label: 'Título', style: TextInputStyle.Short, req: true, key: 'title' }, { id: 'url_input', label: 'URL', style: TextInputStyle.Short, req: false, key: 'url' }] },
                    'edit_body': { id: 'modal_update_body', title: '📜 Editar Descrição', components: [{ id: 'body_input', label: 'Descrição', style: TextInputStyle.Paragraph, req: true, key: 'description' }] },
                    'edit_color': { id: 'modal_update_color', title: '🎨 Cor HEX', components: [{ id: 'color_hex_input', label: 'Cor HEX', style: TextInputStyle.Short, req: true, valTransform: (d) => d.color ? d.color.toString(16).toUpperCase().padStart(6, '0') : '' }] },
                    'edit_author': { id: 'modal_update_author', title: '👤 Editar Autor', components: [{ id: 'author_name', label: 'Nome', style: TextInputStyle.Short, req: false, key: 'author.name' }, { id: 'author_icon_url', label: 'Avatar URL', style: TextInputStyle.Short, req: false, key: 'author.icon_url' }, { id: 'author_link_url', label: 'Link URL', style: TextInputStyle.Short, req: false, key: 'author.url' }] },
                    'edit_images': { id: 'modal_update_images', title: '🖼️ Imagens', components: [{ id: 'image_url', label: 'Imagem Grande URL', style: TextInputStyle.Short, req: false, key: 'image.url' }, { id: 'thumbnail_url', label: 'Thumbnail URL', style: TextInputStyle.Short, req: false, key: 'thumbnail.url' }] },
                    'edit_footer': { id: 'modal_update_footer', title: '🚩 Rodapé', components: [{ id: 'footer_text', label: 'Texto Rodapé', style: TextInputStyle.Short, req: false, key: 'footer.text' }, { id: 'footer_icon_url', label: 'Ícone Rodapé URL', style: TextInputStyle.Short, req: false, key: 'footer.icon_url' }] },
                };

                const cfg = modalMap[interaction.customId];
                if (cfg && activeEmbedIndex !== -1) {
                    const currentEmbedData = EmbedBuilder.from(userData.embeds[activeEmbedIndex]).data;
                    const val = (path) => path.split('.').reduce((o, i) => o ? o[i] : null, currentEmbedData) || '';
                    const modal = new ModalBuilder().setCustomId(cfg.id).setTitle(cfg.title);
                    cfg.components.forEach(c => {
                        let value = c.valTransform ? c.valTransform(currentEmbedData) : val(c.key || '');
                        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(c.id).setLabel(c.label).setStyle(c.style).setValue(value).setRequired(c.req)));
                    });
                    return await interaction.showModal(modal);
                }
                
                return await require('./envioformulario').execute(interaction, cache, client);
            }
        } catch (error) { console.error(`❌ Erro no Botoes.js:`, error); }
    }
};