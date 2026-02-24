const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../adminrole_config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setadminrole')
        .setDescription('Define qual cargo terá acesso ao painel administrativo do bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('cargo')
                .setDescription('O cargo que terá permissão de usar o /painel')
                .setRequired(true)
        ),

    async execute(interaction) {
        const cargoAdmin = interaction.options.getRole('cargo');
        const guildId = interaction.guild.id;

        try {
            let config = {};
            if (fs.existsSync(configPath)) {
                const fileData = fs.readFileSync(configPath, 'utf8');
                config = fileData ? JSON.parse(fileData) : {};
            }

            config[guildId] = cargoAdmin.id;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

            const embed = new EmbedBuilder()
                .setColor('#2F3136') // Cor neutra e moderna do Discord
                .setTitle('⚙️ Configuração de Segurança Atualizada')
                .setDescription(`Membros com o cargo ${cargoAdmin} agora têm acesso aos comandos administrativos do bot.`)
                .setTimestamp();

            await interaction.reply({ 
                embeds: [embed], 
                flags: [MessageFlags.Ephemeral] 
            });

        } catch (error) {
            console.error('Erro ao salvar cargo admin:', error);
            await interaction.reply({ 
                content: 'Ocorreu um erro ao salvar a configuração.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }
    }
};