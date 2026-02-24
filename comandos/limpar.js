const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limpar')
        .setDescription('Limpa mensagens do chat (1-100).')
        .addIntegerOption(option =>
            option.setName('quantidade')
                .setDescription('Número de mensagens para apagar')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)),

    async execute(interaction) {
        // Verifica permissão (Gerenciar Mensagens)
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ 
                content: '❌ Você precisa da permissão **Gerenciar Mensagens**.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const quantidade = interaction.options.getInteger('quantidade');

        try {
            await interaction.channel.bulkDelete(quantidade, true);
            await interaction.reply({ 
                content: `🧹 **${quantidade}** mensagens limpas!`, 
                flags: [MessageFlags.Ephemeral] 
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: '❌ Erro ao limpar mensagens (elas podem ser muito antigas).', 
                flags: [MessageFlags.Ephemeral] 
            });
        }
    },
};