const { 
    ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, 
    StringSelectMenuBuilder, WebhookClient, MessageFlags 
} = require('discord.js');

const ui = require('./ui_helpers'); 

function cleanUrl(url) {
    if (!url) return null;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return 'https://' + url;
    return url;
}

module.exports = {
    async execute(interaction, cache, client) { 
        try { 
            let cacheKey = interaction.message ? interaction.message.id : interaction.messageId;
            let userData = cache.get(cacheKey);

            if (!userData && interaction.customId?.includes('__')) {
                const recoveredKey = interaction.customId.split('__').pop(); 
                userData = cache.get(recoveredKey);
                if (userData) cacheKey = recoveredKey; 
            }

            if (!userData) return interaction.reply({ content: '❌ Rascunho expirado.', flags: [MessageFlags.Ephemeral] });

            const activeEmbedIndex = userData.activeEmbedIndex;
            let currentEmbed = activeEmbedIndex !== -1 ? EmbedBuilder.from(userData.embeds[activeEmbedIndex]) : null;
            let successMessage = 'Painel atualizado.';
            
            let viewMode = (interaction.customId === 'enter_link_delete_mode' || (interaction.customId.startsWith('delete_link_index_') && userData.linkButtons.length > 0)) ? 'delete_links' : 'editor';

            // --- 1. MODALS ---
            if (interaction.isModalSubmit()) {
                const val = (id) => interaction.fields.getTextInputValue(id);

                if (interaction.customId === 'modal_add_link_button') {
                    userData.linkButtons.push({ label: val('link_label'), url: cleanUrl(val('link_url')), style: ButtonStyle.Link, type: 2 });
                    successMessage = `✅ Link adicionado!`;
                } 
                else if (interaction.customId === 'modal_send_webhook') {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    const webhooks = await interaction.channel.fetchWebhooks();
                    let targetWebhook = webhooks.find(wh => wh.ownerId === client.user.id && wh.name === 'embed-bot-publisher');
                    if (!targetWebhook) targetWebhook = await interaction.channel.createWebhook({ name: 'embed-bot-publisher' });
                    
                    const webhookClient = new WebhookClient({ url: targetWebhook.url });
                    await webhookClient.send({ 
                        username: val('webhook_name'), 
                        avatarURL: cleanUrl(val('webhook_icon_url')) || client.user.displayAvatarURL(), 
                        embeds: activeEmbedIndex === -1 ? userData.embeds.map(e => EmbedBuilder.from(e)) : [currentEmbed], 
                        components: ui.createLinkActionRow(userData.linkButtons) 
                    });
                    cache.delete(cacheKey);
                    return interaction.editReply({ content: `✅ Enviado!` });
                }
                else if (interaction.customId.startsWith('modal_update_')) {
                    if (interaction.customId === 'modal_update_title') currentEmbed.setTitle(val('title_input')).setURL(cleanUrl(val('url_input')));
                    else if (interaction.customId === 'modal_update_body') currentEmbed.setDescription(val('body_input'));
                    else if (interaction.customId === 'modal_update_color') {
                        const hex = val('color_hex_input').replace('#', '');
                        if (hex && !isNaN(parseInt(hex, 16))) currentEmbed.setColor(parseInt(hex, 16));
                    }
                    else if (interaction.customId === 'modal_update_author') currentEmbed.setAuthor({ name: val('author_name'), iconURL: cleanUrl(val('author_icon_url')), url: cleanUrl(val('author_link_url')) });
                    else if (interaction.customId === 'modal_update_images') currentEmbed.setImage(cleanUrl(val('image_url'))).setThumbnail(cleanUrl(val('thumbnail_url')));
                    else if (interaction.customId === 'modal_update_footer') currentEmbed.setFooter({ text: val('footer_text'), iconURL: cleanUrl(val('footer_icon_url')) }).setTimestamp(new Date());
                    successMessage = '📝 Embed atualizado.';
                }
            }

            // --- 2. BOTÕES ---
            if (interaction.isButton()) {
                if (interaction.customId === 'publish_quick') {
                    await interaction.channel.send({ 
                        embeds: activeEmbedIndex === -1 ? userData.embeds.map(e => EmbedBuilder.from(e)) : [currentEmbed], 
                        components: ui.createLinkActionRow(userData.linkButtons) 
                    });
                    await interaction.update({ content: '✅ Enviado!', embeds: [], components: [] });
                    return cache.delete(cacheKey);
                }

                if (interaction.customId.startsWith('delete_link_index_')) {
                    const idx = parseInt(interaction.customId.split('__')[0].split('_').pop());
                    userData.linkButtons.splice(idx, 1);
                    successMessage = '🗑️ Link removido.';
                }
            }

            // --- 3. UI RECONSTRUCTION ---
            const row1 = ActionRowBuilder.from(userData.componentRows[0]);
            row1.components[0].options.forEach(opt => opt.default = (opt.value === String(activeEmbedIndex)));

            if (viewMode === 'delete_links' && userData.linkButtons.length > 0) {
                const deleteRows = ui.createDeleteModeRows(userData.linkButtons, cacheKey);
                await interaction.update({ content: `## 🗑️ Modo de Exclusão\n${successMessage}`, embeds: [currentEmbed], components: [row1, ...deleteRows] });
            } else if (activeEmbedIndex !== -1 && currentEmbed) {
                userData.embeds[activeEmbedIndex] = currentEmbed.toJSON();
                let allButtons = userData.editingButtonsJSON.map(b => ButtonBuilder.from(b))
                    .filter(btn => !['add_link_button', 'enter_link_delete_mode', 'delete_embed'].includes(btn.data.custom_id));

                ui.createLinkManagementButtons(userData.linkButtons).forEach(config => {
                    allButtons.push(new ButtonBuilder().setCustomId(config.customId).setLabel(config.label).setStyle(config.style));
                });

                if (activeEmbedIndex > 0) allButtons.push(new ButtonBuilder().setCustomId('delete_embed').setLabel(`🗑️ Deletar Embed ${activeEmbedIndex + 1}`).setStyle(ButtonStyle.Danger));

                const rows = [row1, ui.createHomeButtonRow()];
                let current_row = new ActionRowBuilder();
                allButtons.forEach(btn => {
                    if (current_row.components.length === 5) { rows.push(current_row); current_row = new ActionRowBuilder(); }
                    current_row.addComponents(btn);
                });
                if (current_row.components.length > 0) rows.push(current_row);
                
                userData.componentRows = rows.map(r => r.toJSON());
                cache.set(cacheKey, userData);
                await interaction.update({ content: `## 📰 Painel de Criação\n**Status:** ${successMessage}`, embeds: [currentEmbed], components: rows });
            }
        } catch (error) { console.error(`❌ Erro no EnvioFormulario:`, error); }
    } 
};