const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    MessageFlags // 🛑 ADICIONADO: Necessário para o padrão de flags 2025
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Comandos para criação e gerenciamento de Embeds.')
        .addSubcommand(subcommand => 
            subcommand
                .setName('criar')
                .setDescription('Inicia o painel de criação de embeds/notícias.')
        ),

    async execute(interaction, cache) {
        
        if (interaction.options.getSubcommand() !== 'criar') return;

        // 1. EMBED INICIAL
        const initialEmbed = new EmbedBuilder()
            .setTitle('Painel de Criação de Embed')
            .setDescription('Selecione um Embed no menu abaixo para liberar as opções de edição.')
            .setColor(0x00A0FF);
            
        const embedsArray = [initialEmbed.toJSON()];

        // 2. BOTÕES DE EDIÇÃO (JSON mantido integralmente)
        const editingButtons = [
            { customId: 'edit_title', label: '📝 Título/URL', style: ButtonStyle.Primary },
            { customId: 'edit_body', label: '📜 Descrição', style: ButtonStyle.Primary },
            { customId: 'edit_fields', label: '✏️ Adicionar Campo', style: ButtonStyle.Primary },
            { customId: 'edit_images', label: '🖼️ Imagens/Miniatura', style: ButtonStyle.Primary },
            { customId: 'edit_color', label: '🎨 Cor', style: ButtonStyle.Secondary },
            { customId: 'edit_author', label: '👤 Autor', style: ButtonStyle.Secondary },
            { customId: 'edit_footer', label: '🚩 Rodapé/Data', style: ButtonStyle.Secondary },
            { customId: 'add_link_button', label: '🔗 Adicionar Botão (Link)', style: ButtonStyle.Success },
        ];
        
        // 3. DEFINIÇÃO DAS LINHAS DE COMPONENTES
        const embedSelector = new StringSelectMenuBuilder() 
            .setCustomId('select_embed')
            .setPlaceholder('Selecione um Embed para editar...')
            .addOptions([ 
                { label: 'Embed 1', value: '0', default: false } 
            ]); 
        const row1_selector = new ActionRowBuilder().addComponents(embedSelector);

        const row2_actions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('add_new_embed').setLabel('+ Adicionar Embed').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('publish_quick').setLabel('⚡ Enviar Rápido').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('publish_webhook_custom').setLabel('🌐 Enviar Personalizado').setStyle(ButtonStyle.Success),
        );

        // 5. ENVIA A INTERFACE PRIVADA
        // 🛑 CORREÇÃO: Usando Flags para garantir que NINGUÉM veja, exceto você.
        await interaction.reply({
            content: "## 📰 Painel de Criação de Embed\n> **Nota:** Este painel é efêmero. Apenas você pode ver e interagir com ele.",
            embeds: [initialEmbed],
            components: [row1_selector, row2_actions], 
            flags: [MessageFlags.Ephemeral] // 🔒 AGORA É PRIVADO
        });

        // 6. CAPTURA A MENSAGEM (Mesmo sendo efêmera, o fetchReply funciona!)
        const replyMessage = await interaction.fetchReply();
        const cacheKey = replyMessage.id; 
        
        // 4. SALVA NO CACHE (Estrutura original mantida)
        cache.set(cacheKey, { 
            embeds: embedsArray, 
            activeEmbedIndex: -1, 
            componentRows: [row1_selector.toJSON(), row2_actions.toJSON()],
            editingButtonsJSON: editingButtons,
            linkButtons: [], 
            MAX_EMBEDS: 5, 
            webhookId: null,
            webhookToken: null,
        });
    }
};