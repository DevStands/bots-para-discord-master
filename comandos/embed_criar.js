const { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, 
    ButtonStyle, ButtonBuilder, StringSelectMenuBuilder, MessageFlags 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Comandos para criação e gerenciamento de embeds.')
        .addSubcommand(subcommand => 
            subcommand
                .setName('criar')
                .setDescription('Inicia um NOVO painel de criação.')
        ),

    async execute(interaction, cache) {
        if (interaction.options.getSubcommand() !== 'criar') return;

        // 1. DADOS INICIAIS LIMPOS
        const initialEmbed = new EmbedBuilder()
            .setTitle('Embed 1')
            .setDescription('Selecione este embed no menu abaixo para editar.')
            .setColor(0x00A0FF);
            
        const embedsArray = [initialEmbed.toJSON()];

        // 2. CONFIGURAÇÃO DE BOTÕES
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
        
        // 3. UI INICIAL
        const embedSelector = new StringSelectMenuBuilder() 
            .setCustomId('select_embed')
            .setPlaceholder('Selecione um Embed para editar...')
            .addOptions([{ label: 'Embed 1', value: '0', default: false }]); 
        
        const row1_selector = new ActionRowBuilder().addComponents(embedSelector);

        const row2_actions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('add_new_embed').setLabel('+ Adicionar Embed').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('publish_quick').setLabel('⚡ Enviar Rápido').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('publish_webhook_custom').setLabel('🌐 Enviar Personalizado').setStyle(ButtonStyle.Success),
        );

        // 4. ENVIA PAINEL NOVO (Sem checar cache antigo)
        await interaction.reply({
            content: "## 📰 Painel de Criação de Embed",
            embeds: [initialEmbed],
            components: [row1_selector, row2_actions], 
            flags: [MessageFlags.Ephemeral]
        });

        // 5. REGISTRA NO CACHE (Nova Chave = Nova Sessão)
        const replyMessage = await interaction.fetchReply();
        const cacheKey = replyMessage.id; 
        
        cache.set(cacheKey, { 
            embeds: embedsArray, 
            activeEmbedIndex: -1, 
            componentRows: [row1_selector.toJSON(), row2_actions.toJSON()],
            editingButtonsJSON: editingButtons,
            linkButtons: [], 
            MAX_EMBEDS: 5, 
        });
    }
};