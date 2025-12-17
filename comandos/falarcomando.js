// comandos/falarcomando.js (Código Otimizado)

const { SlashCommandBuilder, ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    // Usa SlashCommandBuilder para melhor compatibilidade, se global.js estiver usando
    data: new SlashCommandBuilder() 
        .setName('falar')
        .setDescription('Faz o bot dizer a mensagem que você escrever.')
        .addStringOption(option => 
            option.setName('mensagem')
                .setDescription('A mensagem que o bot deve enviar.')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        
        const mensagemDoUsuario = interaction.options.getString('mensagem');
        
        // Confirma o recebimento de forma privada (ephemeral)
		await interaction.reply({ 
			content: `✅ Mensagem enviada: "${mensagemDoUsuario}"`, 
			ephemeral: true 
		});

        // Faz o bot enviar a mensagem no canal onde o comando foi usado
        await interaction.channel.send(mensagemDoUsuario);
    },
};