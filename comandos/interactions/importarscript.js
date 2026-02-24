const { 
    ContextMenuCommandBuilder, 
    ApplicationCommandType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    MessageFlags 
} = require('discord.js');

// Botões padrão do Editor
const EDITING_BUTTONS_DEF = [
    { customId: 'edit_title', label: '📝 Título/URL', style: ButtonStyle.Primary },
    { customId: 'edit_body', label: '📜 Descrição', style: ButtonStyle.Primary },
    { customId: 'edit_fields', label: '✏️ Adicionar Campo', style: ButtonStyle.Primary },
    { customId: 'edit_images', label: '🖼️ Imagens/Miniatura', style: ButtonStyle.Primary },
    { customId: 'edit_color', label: '🎨 Cor', style: ButtonStyle.Secondary },
    { customId: 'edit_author', label: '👤 Autor', style: ButtonStyle.Secondary },
    { customId: 'edit_footer', label: '🚩 Rodapé/Data', style: ButtonStyle.Secondary },
    { customId: 'add_link_button', label: '🔗 Adicionar Botão (Link)', style: ButtonStyle.Success },
];

function createEmbedSelector(embeds) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_embed')
        .setPlaceholder('Selecione um Embed...')
        .addOptions(embeds.map((_, i) => ({
            label: `Embed ${i + 1}`,
            value: i.toString(),
            default: i === 0
        })));
    return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Importar JSON')
        .setType(ApplicationCommandType.Message),

    async execute(interaction, cache) {
        try {
            const targetMessage = interaction.targetMessage;
            let jsonContent = null;
            let source = "Desconhecido";

            // ---------------------------------------------------------
            // 1. TENTATIVA VIA ANEXO (.JSON)
            // ---------------------------------------------------------
            const attachment = targetMessage.attachments.first();
            
            if (attachment) {
                // 🟢 CORREÇÃO: Verificação estrita de extensão.
                // Removemos o check de 'text' genérico para evitar ler arquivos .js
                if (attachment.name.toLowerCase().endsWith('.json')) {
                    try {
                        const response = await fetch(attachment.url);
                        if (!response.ok) throw new Error('Falha no download');
                        
                        const textData = await response.text();
                        const cleanData = textData.trim();

                        // 🟢 BLINDAGEM: Só tenta parsear se começar com estrutura de JSON ({ ou [)
                        if (cleanData.startsWith('{') || cleanData.startsWith('[')) {
                            jsonContent = JSON.parse(cleanData);
                            source = "Anexo (.json)";
                        }
                    } catch (e) {
                        // Se falhar no anexo, apenas loga e deixa o código tentar ler o texto da mensagem
                        console.warn("Aviso: Falha ao ler anexo JSON:", e.message);
                    }
                }
            } 

            // ---------------------------------------------------------
            // 2. TENTATIVA VIA TEXTO (BLOCO DE CÓDIGO)
            // ---------------------------------------------------------
            if (!jsonContent && targetMessage.content) {
                try {
                    // Tenta o parse direto (caso o usuário tenha colado só o JSON)
                    jsonContent = JSON.parse(targetMessage.content);
                    source = "Texto Puro";
                } catch (e) {
                    // Se falhar, tenta limpar Markdown (```json ... ```)
                    const cleanContent = targetMessage.content
                        .replace(/```json/gi, '') // Remove ```json (case insensitive)
                        .replace(/```/g, '')      // Remove crases restantes
                        .trim();                  // Remove espaços extras

                    try {
                        if (cleanContent.startsWith('{') || cleanContent.startsWith('[')) {
                            jsonContent = JSON.parse(cleanContent);
                            source = "Bloco de Código";
                        }
                    } catch (err2) {
                        // Tenta encontrar o primeiro '{' e o último '}' (Extração Cirúrgica)
                        // Útil se tiver texto antes ou depois do código
                        const firstBrace = targetMessage.content.indexOf('{');
                        const lastBrace = targetMessage.content.lastIndexOf('}');
                        
                        if (firstBrace !== -1 && lastBrace !== -1) {
                            const extracted = targetMessage.content.substring(firstBrace, lastBrace + 1);
                            try {
                                jsonContent = JSON.parse(extracted);
                                source = "Extração Forçada";
                            } catch (err3) {
                                // Realmente não é um JSON válido
                            }
                        }
                    }
                }
            }

            // ---------------------------------------------------------
            // 3. VALIDAÇÃO
            // ---------------------------------------------------------
            if (!jsonContent) {
                return interaction.reply({ 
                    content: '❌ **Erro de Leitura:** Não encontrei um JSON válido nesta mensagem.\nVerifique se o arquivo termina em `.json` ou se o código está formatado corretamente.', 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            // Normaliza a estrutura (aceita { data: ... } ou direto { embeds: ... })
            const payload = jsonContent.data || jsonContent;

            if (!payload.embeds || !Array.isArray(payload.embeds)) {
                return interaction.reply({ 
                    content: '❌ **JSON Inválido:** O arquivo não contém uma lista de `embeds`.', 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            // ---------------------------------------------------------
            // 4. CARREGAMENTO E UI
            // ---------------------------------------------------------
            const loadedEmbeds = payload.embeds.slice(0, 5).map(e => EmbedBuilder.from(e).toJSON());
            const loadedLinks = Array.isArray(payload.linkButtons) ? payload.linkButtons.slice(0, 5) : [];

            const row1_selector = createEmbedSelector(loadedEmbeds);
            
            const row2_actions = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_new_embed').setLabel('+ Adicionar Embed').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('publish_quick').setLabel('⚡ Enviar Rápido').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('publish_webhook_custom').setLabel('🌐 Enviar Personalizado').setStyle(ButtonStyle.Success),
            );

            // Importante: Precisamos garantir que existe pelo menos 1 embed para o preview
            if (loadedEmbeds.length === 0) {
                 return interaction.reply({ content: '❌ O arquivo JSON importado está vazio (0 embeds).', flags: [MessageFlags.Ephemeral] });
            }

            const previewEmbed = EmbedBuilder.from(loadedEmbeds[0]);

            await interaction.reply({
                content: `## 📥 Importado via ${source}!\n> Carregados: **${loadedEmbeds.length} embeds** e **${loadedLinks.length} links**.`,
                embeds: [previewEmbed],
                components: [row1_selector, row2_actions],
                flags: [MessageFlags.Ephemeral]
            });

            // 5. Salva no Cache
            const replyMessage = await interaction.fetchReply();
            const cacheKey = replyMessage.id;

            cache.set(cacheKey, { 
                embeds: loadedEmbeds, 
                activeEmbedIndex: -1, 
                componentRows: [row1_selector.toJSON(), row2_actions.toJSON()],
                editingButtonsJSON: EDITING_BUTTONS_DEF,
                linkButtons: loadedLinks, 
                MAX_EMBEDS: 5, 
            });

        } catch (error) {
            console.error('Erro na importação via menu:', error);
            if (!interaction.replied) {
                interaction.reply({ content: `❌ Erro crítico: ${error.message}`, flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};