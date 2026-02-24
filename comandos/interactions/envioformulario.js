const { 
    ActionRowBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    WebhookClient, 
    MessageFlags 
} = require('discord.js');

const ui = require('../../ui_helpers');

// Helper para garantir URLs válidas
function cleanUrl(url) {
    if (!url || url.trim() === '') return null;
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        return 'https://' + clean;
    }
    return clean;
}

module.exports = {
    async execute(interaction, cache, client) {
        try {
            // 1. Recuperação de Sessão
            let cacheKey = interaction.message ? interaction.message.id : interaction.messageId;
            let userData = cache.get(cacheKey);

            if (!userData && interaction.customId?.includes('__')) {
                const recoveredKey = interaction.customId.split('__').pop();
                userData = cache.get(recoveredKey);
                if (userData) cacheKey = recoveredKey;
            }

            if (!userData) {
                return interaction.reply({ 
                    content: '❌ Sessão expirada ou dados perdidos.', 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            const activeEmbedIndex = userData.activeEmbedIndex;
            let currentEmbed = activeEmbedIndex !== -1 
                ? EmbedBuilder.from(userData.embeds[activeEmbedIndex]) 
                : null;
            
            let successMessage = "✅ Painel atualizado.";

            // =================================================================
            // 2. PROCESSAMENTO DE MODAIS
            // =================================================================
            if (interaction.isModalSubmit()) {
                const val = (id) => interaction.fields.getTextInputValue(id);

                // --- ADICIONAR LINK ---
                if (interaction.customId === 'modal_add_link_button') {
                    userData.linkButtons.push({
                        label: val('link_label'),
                        url: cleanUrl(val('link_url')),
                        style: ButtonStyle.Link,
                        type: 2
                    });
                    successMessage = `🔗 Link adicionado!`;
                
                // --- ENVIAR VIA WEBHOOK ---
                } else if (interaction.customId === 'modal_send_webhook') {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    
                    const webhooks = await interaction.channel.fetchWebhooks();
                    let targetWebhook = webhooks.find(wh => wh.ownerId === client.user.id && wh.name === 'HabbiSound-Publisher');
                    
                    if (!targetWebhook) {
                        try {
                            targetWebhook = await interaction.channel.createWebhook({ 
                                name: 'HabbiSound-Publisher',
                                avatar: client.user.displayAvatarURL()
                            });
                        } catch (err) {
                            return interaction.editReply("❌ Erro: Sem permissão para criar Webhooks.");
                        }
                    }

                    const webhookClient = new WebhookClient({ url: targetWebhook.url });
                    
                    // 🟢 CORREÇÃO: Sempre envia TODOS os embeds, não importa onde você esteja
                    const allEmbedsToSend = userData.embeds.map(e => EmbedBuilder.from(e));

                    await webhookClient.send({
                        username: val('webhook_name'),
                        avatarURL: cleanUrl(val('webhook_icon_url')) || client.user.displayAvatarURL(),
                        embeds: allEmbedsToSend, // Manda o pacote completo
                        components: ui.createLinkActionRow(userData.linkButtons)
                    });

                    return interaction.editReply({ content: `✅ Enviado com sucesso via Webhook!` });

                // --- ATUALIZAÇÕES DO EMBED ---
                } else if (interaction.customId.startsWith('modal_update_') && currentEmbed) {
                    
                    if (interaction.customId === 'modal_update_title') {
                        const t = val('title_input');
                        if(t) currentEmbed.setTitle(t);
                        currentEmbed.setURL(cleanUrl(val('url_input')));
                    
                    } else if (interaction.customId === 'modal_update_body') {
                        currentEmbed.setDescription(val('body_input'));
                    
                    } else if (interaction.customId === 'modal_update_color') {
                        const hex = val('color_hex_input').replace('#', '');
                        if (hex && /^[0-9A-F]{6}$/i.test(hex)) {
                            currentEmbed.setColor(parseInt(hex, 16));
                        }
                    
                    } else if (interaction.customId === 'modal_update_author') {
                        const name = val('author_name');
                        if (name) {
                            currentEmbed.setAuthor({
                                name: name,
                                iconURL: cleanUrl(val('author_icon_url')),
                                url: cleanUrl(val('author_link_url'))
                            });
                        } else {
                            currentEmbed.setAuthor(null);
                        }
                    
                    } else if (interaction.customId === 'modal_update_images') {
                        currentEmbed.setImage(cleanUrl(val('image_url')));
                        currentEmbed.setThumbnail(cleanUrl(val('thumbnail_url')));
                    
                    } else if (interaction.customId === 'modal_update_footer') {
                        const text = val('footer_text');
                        if (text) {
                            currentEmbed.setFooter({
                                text: text,
                                iconURL: cleanUrl(val('footer_icon_url'))
                            });
                        } else {
                            currentEmbed.setFooter(null);
                        }
                    }
                    
                    // Salva alterações
                    userData.embeds[activeEmbedIndex] = currentEmbed.toJSON();
                    successMessage = "📝 Alterações salvas.";
                }
            }

            // =================================================================
            // 3. PROCESSAMENTO DE BOTÕES (AÇÕES)
            // =================================================================
            if (interaction.isButton()) {
                if (interaction.customId === 'publish_quick') {
                    
                    // 🟢 CORREÇÃO: Sempre envia TODOS os embeds
                    const allEmbedsToSend = userData.embeds.map(e => EmbedBuilder.from(e));

                    await interaction.channel.send({
                        embeds: allEmbedsToSend, // Manda o pacote completo
                        components: ui.createLinkActionRow(userData.linkButtons)
                    });

                    // Finaliza sessão
                    await interaction.update({ content: "✅ Publicado com sucesso!", embeds: [], components: [] });
                    return cache.delete(cacheKey); 
                }
            }

            // =================================================================
            // 4. RECONSTRUÇÃO DA INTERFACE
            // =================================================================
            
            cache.set(cacheKey, userData);

            const row1 = ActionRowBuilder.from(userData.componentRows[0]);
            const editingButtons = userData.editingButtonsJSON.map(btnData => ButtonBuilder.from(btnData));

            // Botões dinâmicos
            if (activeEmbedIndex > 0) {
                editingButtons.push(
                    new ButtonBuilder().setCustomId('delete_current_embed').setLabel('🗑️ Apagar Embed').setStyle(ButtonStyle.Danger)
                );
            }
            if (userData.linkButtons.length > 0) {
                editingButtons.push(
                    new ButtonBuilder().setCustomId('remove_link_button').setLabel('🗑️ Remover Link').setStyle(ButtonStyle.Danger)
                );
            }
            const homeBtn = new ButtonBuilder().setCustomId('go_to_home').setLabel('🏠 Voltar / Home').setStyle(ButtonStyle.Success);

            // Organiza layout
            const actionRows = [row1];
            let currentRow = new ActionRowBuilder();
            for (const btn of editingButtons) {
                if (currentRow.components.length >= 5) {
                    actionRows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
                currentRow.addComponents(btn);
            }
            if (currentRow.components.length > 0) actionRows.push(currentRow);
            actionRows.push(new ActionRowBuilder().addComponents(homeBtn));

            const previewEmbed = activeEmbedIndex === -1 
                ? EmbedBuilder.from(userData.embeds[0]) 
                : currentEmbed;

            const title = activeEmbedIndex === -1 ? "## 📰 Painel Principal" : `## ✏️ Editor - Embed ${activeEmbedIndex + 1}`;

            await interaction.update({
                content: `${title}\n> ${successMessage}`,
                embeds: [previewEmbed],
                components: actionRows
            });

        } catch (error) {
            console.error(`❌ Erro no EnvioFormulario:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Erro interno.', flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};