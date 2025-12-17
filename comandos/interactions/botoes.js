const { 
    ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, 
    EmbedBuilder, ButtonStyle, ButtonBuilder, MessageFlags 
} = require('discord.js');

const camposHandler = require('./campos'); 
const ui = require('./ui_helpers');

module.exports = {
    async execute(interaction, cache, client) { 
        let cacheKey = interaction.message?.id; 
        let userData = cache.get(cacheKey); 
        
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
            if (interaction.customId === 'edit_fields' || interaction.customId.startsWith('btn_field_') || interaction.customId === 'select_field_manage') {
                return await camposHandler.execute(interaction, cache);
            }

            if (interaction.isStringSelectMenu() && interaction.customId === 'select_embed') {
                userData.activeEmbedIndex = parseInt(interaction.values[0]);
                cache.set(cacheKey, userData);
                return await require('./envioformulario').execute(interaction, cache, client);
            }

            if (interaction.customId === 'go_to_home') {
                userData.activeEmbedIndex = -1;
                const row1 = ActionRowBuilder.from(userData.componentRows[0]);
                row1.components[0].options.forEach(o => o.default = false);
                const rows = [row1, ui.createGeneralActionRow(), ...ui.createLinkActionRow(userData.linkButtons)];
                cache.set(cacheKey, userData);
                return await interaction.update({ content: "## 📰 Painel Principal", embeds: [EmbedBuilder.from(userData.embeds[0])], components: rows });
            }

            if (interaction.isButton()) {
                if (interaction.customId === 'publish_webhook_custom') {
                    const modal = new ModalBuilder().setCustomId('modal_send_webhook').setTitle('Personalizar Envio');
                    const nameInput = new TextInputBuilder().setCustomId('webhook_name').setLabel('Nome do Webhook').setStyle(TextInputStyle.Short).setRequired(true).setValue(interaction.guild?.name || 'HabbiSound');
                    const iconInput = new TextInputBuilder().setCustomId('webhook_icon_url').setLabel('Avatar URL').setStyle(TextInputStyle.Short).setRequired(false).setValue(interaction.guild?.iconURL({ forceStatic: true, extension: 'png' }) || '');
                    modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(iconInput));
                    return await interaction.showModal(modal);
                }

                if (interaction.customId === 'add_link_button') {
                    if (userData.linkButtons.length >= 5) return interaction.reply({ content: '❌ Limite de 5 links.', flags: [MessageFlags.Ephemeral] });
                    return await interaction.showModal(ui.createLinkModal('modal_add_link_button'));
                }

                const modalMap = {
                    'edit_title': { id: 'modal_update_title', title: '📝 Editar Título' },
                    'edit_body': { id: 'modal_update_body', title: '📜 Editar Descrição' },
                    'edit_color': { id: 'modal_update_color', title: '🎨 Cor HEX' },
                    'edit_author': { id: 'modal_update_author', title: '👤 Editar Autor' },
                    'edit_images': { id: 'modal_update_images', title: '🖼️ Imagens' },
                    'edit_footer': { id: 'modal_update_footer', title: '🚩 Rodapé' },
                };

                const cfg = modalMap[interaction.customId];
                if (cfg && activeEmbedIndex !== -1) {
                    const currentEmbedData = EmbedBuilder.from(userData.embeds[activeEmbedIndex]).data;
                    const val = (v) => v || '';
                    const modal = new ModalBuilder().setCustomId(cfg.id).setTitle(cfg.title);
                    
                    if (interaction.customId === 'edit_title') {
                        modal.addComponents(
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title_input').setLabel('Título').setStyle(TextInputStyle.Short).setValue(val(currentEmbedData.title)).setRequired(true)),
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url_input').setLabel('URL').setStyle(TextInputStyle.Short).setValue(val(currentEmbedData.url)).setRequired(false))
                        );
                    } else if (interaction.customId === 'edit_body') {
                        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('body_input').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setValue(val(currentEmbedData.description)).setRequired(true)));
                    } else if (interaction.customId === 'edit_color') {
                        // 🛑 Proteção contra cor nula
                        const hex = currentEmbedData.color ? currentEmbedData.color.toString(16).toUpperCase().padStart(6, '0') : '';
                        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color_hex_input').setLabel('Cor HEX').setStyle(TextInputStyle.Short).setValue(hex).setRequired(true)));
                    } else if (interaction.customId === 'edit_author') {
                        modal.addComponents(
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('author_name').setLabel('Nome').setStyle(TextInputStyle.Short).setValue(val(currentEmbedData.author?.name)).setRequired(false)),
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('author_icon_url').setLabel('Avatar URL').setStyle(TextInputStyle.Short).setValue(val(currentEmbedData.author?.icon_url)).setRequired(false)),
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('author_link_url').setLabel('Link URL').setStyle(TextInputStyle.Short).setValue(val(currentEmbedData.author?.url)).setRequired(false))
                        );
                    } else if (interaction.customId === 'edit_images') {
                        modal.addComponents(
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image_url').setLabel('Imagem Grande URL').setStyle(TextInputStyle.Short).setValue(val(currentEmbedData.image?.url)).setRequired(false)),
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail_url').setLabel('Thumbnail URL').setStyle(TextInputStyle.Short).setValue(val(currentEmbedData.thumbnail?.url)).setRequired(false))
                        );
                    } else if (interaction.customId === 'edit_footer') {
                        modal.addComponents(
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer_text').setLabel('Texto Rodapé').setStyle(TextInputStyle.Short).setValue(val(currentEmbedData.footer?.text)).setRequired(false)),
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer_icon_url').setLabel('Ícone Rodapé URL').setStyle(TextInputStyle.Short).setValue(val(currentEmbedData.footer?.icon_url)).setRequired(false))
                        );
                    }
                    return await interaction.showModal(modal);
                }
                return await require('./envioformulario').execute(interaction, cache, client);
            }
        } catch (error) { console.error(`❌ Erro no Botoes.js:`, error); }
    }
};