const { SlashCommandBuilder, PermissionsBitField, ChannelType, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('falar')
        .setDescription('Faz o bot falar em um canal específico.')
        .addStringOption(option => 
            option.setName('mensagem')
                .setDescription('A mensagem a ser enviada')
                .setRequired(true))
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('O canal onde a mensagem será enviada')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)),

    async execute(interaction) {
        // Verifica permissão de Administrador
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ 
                content: '❌ Você não tem permissão para usar este comando.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const mensagem = interaction.options.getString('mensagem');
        const canal = interaction.options.getChannel('canal') || interaction.channel;

        try {
            await canal.send(mensagem);
            await interaction.reply({ 
                content: `✅ Mensagem enviada em ${canal}!`, 
                flags: [MessageFlags.Ephemeral] 
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: '❌ Erro ao enviar mensagem. Verifique minhas permissões no canal.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }
    },
};