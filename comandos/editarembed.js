const { 
    ContextMenuCommandBuilder, 
    ApplicationCommandType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    ButtonBuilder, 
    StringSelectMenuBuilder, 
    MessageFlags 
} = require('discord.js');

// Função auxiliar para recriar o seletor de embeds baseado na quantidade importada
function createEmbedSelector(embeds) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_embed')
        .setPlaceholder('Selecione um Embed para editar...');
    
    embeds.forEach((_, index) => {
        selectMenu.addOptions({
            label: `Embed ${index + 1}`,
            value: index.toString(),
            default: index === 0 // O primeiro já vem selecionado visualmente se quiser, ou deixe false
        });
    });

    return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = {
    // 1. DEFINIÇÃO DO COMANDO (TIPO: MENSAGEM)
    // Isso faz aparecer quando clica com botão direito na mensagem -> Apps
    data: new ContextMenuCommandBuilder()
        .setName('Editar Embed') // O nome que aparece no menu
        .setType(ApplicationCommandType.Message),

    async execute(interaction, cache) {
        // Pega a mensagem onde o clique ocorreu
        const targetMessage = interaction.targetMessage;

        // VALIDAÇÃO: A mensagem tem algo útil?
        if ((!targetMessage.embeds || targetMessage.embeds.length === 0) && !targetMessage.content) {
            return interaction.reply({ 
                content: '❌ Essa mensagem não possui conteúdo ou embeds para editar.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // 2. PARSER: TRANSFORMAR DADOS DA MENSAGEM EM DADOS DO EDITOR
        let loadedEmbeds = [];

        // A. Importar Embeds Existentes
        if (targetMessage.embeds.length > 0) {
            loadedEmbeds = targetMessage.embeds.map(e => {
                // EmbedBuilder.from converte o formato da API para o formato editável
                const builder = EmbedBuilder.from(e);
                return builder.toJSON(); 
            });
        } 
        // B. Se não tiver embed, mas tiver texto, cria um embed com o texto
        else if (targetMessage.content) {
            loadedEmbeds.push(
                new EmbedBuilder()
                    .setDescription(targetMessage.content)
                    .setColor(0x00A0FF)
                    .toJSON()
            );
        }

        // C. Importar Botões de Link (Se houver)
        // Botões interativos não podem ser clonados, mas links sim!
        let loadedLinkButtons = [];
        if (targetMessage.components) {
            targetMessage.components.forEach(row => {
                row.components.forEach(component => {
                    // Tipo 2 é Botão. Style 5 é Link.
                    if (component.type === 2 && component.style === 5 && component.url) {
                        loadedLinkButtons.push({
                            label: component.label || 'Link Importado',
                            url: component.url,
                            style: ButtonStyle.Link,
                            type: 2
                        });
                    }
                });
            });
        }

        // Limita a 5 links (regra do seu bot)
        if (loadedLinkButtons.length > 5) loadedLinkButtons = loadedLinkButtons.slice(0, 5);

        // 3. PREPARAR A UI (Igual ao embed_criar.js)
        
        // Definição dos botões de edição (padrão do seu sistema)
        const editingButtons = [
            { customId: 'edit_title', label: '📝 Título/URL', style: ButtonStyle.Primary },
            { customId: 'edit_body', label: '📜 Descrição', style: ButtonStyle.Primary },
            { customId: 'edit_fields', label: '✏️ Adicionar Campo', style: ButtonStyle.Primary },
            { customId: 'edit_images', label: '🖼️ Imagens/Miniatura', style: ButtonStyle.Primary },
            { customId: 'edit_color', label: '🎨 Cor', style: ButtonStyle.Secondary },
            { customId: 'edit_author', label: '👤 Autor', style: ButtonStyle.Secondary },
            { customId: 'edit_footer', label: '🚩 Rodapé', style: ButtonStyle.Secondary },
            { customId: 'add_link_button', label: '🔗 Adicionar Botão (Link)', style: ButtonStyle.Success },
        ];

        // Monta as linhas iniciais
        const row1_selector = createEmbedSelector(loadedEmbeds);

        const row2_actions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('add_new_embed').setLabel('+ Adicionar Embed').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('publish_quick').setLabel('⚡ Enviar Rápido').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('publish_webhook_custom').setLabel('🌐 Enviar Personalizado').setStyle(ButtonStyle.Success),
        );

        // 4. RESPOSTA INICIAL
        // Mostramos o painel já preenchido com o primeiro embed importado
        const previewEmbed = EmbedBuilder.from(loadedEmbeds[0]);

        await interaction.reply({
            content: `## ✏️ Editando Mensagem Importada\n> **${loadedEmbeds.length} embeds** e **${loadedLinkButtons.length} links** recuperados.`,
            embeds: [previewEmbed],
            components: [row1_selector, row2_actions], 
            flags: [MessageFlags.Ephemeral]
        });

        // 5. SALVAR NO CACHE (A Mágica acontece aqui)
        // Usamos a estrutura exata que o botoes.js e envioformulario.js esperam
        const replyMessage = await interaction.fetchReply();
        const cacheKey = replyMessage.id; 
        
        cache.set(cacheKey, { 
            embeds: loadedEmbeds, 
            activeEmbedIndex: -1, // Começa na Home
            componentRows: [row1_selector.toJSON(), row2_actions.toJSON()],
            editingButtonsJSON: editingButtons,
            linkButtons: loadedLinkButtons, // Links importados
            MAX_EMBEDS: 5, 
        });
    }
};