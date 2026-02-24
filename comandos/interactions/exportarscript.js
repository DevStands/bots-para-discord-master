const { 
    ContextMenuCommandBuilder, 
    ApplicationCommandType, 
    AttachmentBuilder, 
    MessageFlags,
    ButtonStyle 
} = require('discord.js');

module.exports = {
    // Define como Menu de Contexto (Botão Direito na Mensagem)
    data: new ContextMenuCommandBuilder()
        .setName('Exportar JSON')
        .setType(ApplicationCommandType.Message),

    async execute(interaction, cache) {
        try {
            const targetMessage = interaction.targetMessage;

            // Validação: Tem algo para exportar?
            if ((!targetMessage.embeds || targetMessage.embeds.length === 0) && !targetMessage.content) {
                return interaction.reply({ 
                    content: '❌ Essa mensagem não contém embeds ou conteúdo para exportar.', 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            // 1. Extrair Embeds
            // Convertendo para JSON puro (raw data)
            let exportedEmbeds = targetMessage.embeds.map(e => e.toJSON());

            // Se não tiver embed mas tiver texto, converte o texto em um embed simples
            if (exportedEmbeds.length === 0 && targetMessage.content) {
                exportedEmbeds.push({
                    description: targetMessage.content,
                    color: 0x00A0FF
                });
            }

            // 2. Extrair Botões de Link
            let exportedLinks = [];
            if (targetMessage.components) {
                targetMessage.components.forEach(row => {
                    row.components.forEach(component => {
                        // Tipo 2 = Botão, Style 5 = Link
                        if (component.type === 2 && component.style === 5 && component.url) {
                            exportedLinks.push({
                                label: component.label || 'Link',
                                url: component.url,
                                style: ButtonStyle.Link,
                                type: 2
                            });
                        }
                    });
                });
            }

            // 3. Montar o Objeto de Backup
            const backupObject = {
                version: "2.0",
                created_at: new Date().toISOString(),
                source: "Context Menu Export",
                data: {
                    embeds: exportedEmbeds,
                    linkButtons: exportedLinks.slice(0, 5) // Garante o limite de 5
                }
            };

            // 4. Criar Arquivo
            const jsonString = JSON.stringify(backupObject, null, 4);
            const buffer = Buffer.from(jsonString, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: 'embed_export.json' });

            await interaction.reply({
                content: '📦 **JSON Gerado com Sucesso!**\nUse este arquivo para importar o layout em outro momento.',
                files: [attachment],
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('Erro ao exportar via menu:', error);
            interaction.reply({ content: '❌ Erro ao gerar o arquivo.', flags: [MessageFlags.Ephemeral] });
        }
    }
};