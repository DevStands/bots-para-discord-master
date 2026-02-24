const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js'); // Adicionado MessageFlags aqui
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../modlog_config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setmodlog')
        .setDescription('Define o canal onde os logs de moderação serão enviados.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Mencione o #canal ou cole o ID numérico dele')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        const canalLog = interaction.options.getChannel('canal');
        const guildId = interaction.guild.id;

        try {
            let config = {};
            if (fs.existsSync(configPath)) {
                const fileData = fs.readFileSync(configPath, 'utf8');
                config = fileData ? JSON.parse(fileData) : {};
            }

            config[guildId] = canalLog.id;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ ModLog Configurado!')
                .setDescription(`Os registros de eventos agora serão enviados em ${canalLog}.`)
                .setFooter({ text: `ID do Canal: ${canalLog.id}` })
                .setTimestamp();

            // ALTERAÇÃO AQUI: Trocamos ephemeral: true por flags: [MessageFlags.Ephemeral]
            await interaction.reply({ 
                embeds: [embed], 
                flags: [MessageFlags.Ephemeral] 
            });

        } catch (error) {
            console.error('❌ Erro ao salvar configuração de ModLog:', error);
            await interaction.reply({ 
                content: '❌ Houve um erro ao salvar a configuração.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }
    }
};