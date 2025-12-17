require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// ID do canal onde ocorrerá a marcação
const TARGET_CHANNEL_ID = '1449595922370793492';

// aqui em cima é o id do canal 

client.once('ready', async () => {
    console.log(`✅ Logado como ${client.user.tag}!`);
    console.log('🚀 Iniciando sequência de marcação automática...');

    try {
        const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
        if (!channel) {
            console.error(`❌ Canal ${TARGET_CHANNEL_ID} não encontrado!`);
            return;
        }

        console.log(`✅ Canal encontrado: ${channel.name}`);

        // 1. Buscar Membros
        const guildMembers = await channel.guild.members.fetch();
        const membersToTag = guildMembers.filter(member => !member.user.bot); // Remove bots da marcação
        
        console.log(`👥 Encontrados ${membersToTag.size} membros humanos.`);

        if (membersToTag.size === 0) {
            console.log('⚠️ Nenhum membro para marcar.');
            return;
        }

        const startTime = Date.now();

        // 2. Marcar Todos (Chunks de 1900 chars)
        const chunks = [];
        let currentChunk = [];
        let currentLength = 0;

        membersToTag.forEach(member => {
            const mention = member.toString() + ' ';
            if (currentLength + mention.length > 1900) {
                chunks.push(currentChunk);
                currentChunk = [];
                currentLength = 0;
            }
            currentChunk.push(mention);
            currentLength += mention.length;
        });
        if (currentChunk.length > 0) chunks.push(currentChunk);

        console.log(`📢 Enviando ${chunks.length} mensagens de marcação...`);

        for (const chunk of chunks) {
            await channel.send({ content: chunk.join('') });
            // Pequena pausa para evitar rate limit agressivo
            await new Promise(resolve => setTimeout(resolve, 500)); 
        }

        // 3. Embed Final Personalizado
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        const finalEmbed = new EmbedBuilder()
            .setColor(0x00FF00) // Verde Matrix
            .setTitle('🚀 SISTEMA DE MARCAÇÃO RZSISTEMA')
            .setDescription(`✅ **Operação Concluída com Sucesso!**\n\n👥 **Usuários Marcados:** ${membersToTag.size}\n⏱ **Tempo Decorrido:** ${duration}s`)
            .addFields(
                { name: 'Serviço', value: 'Divulgação Automatizada', inline: true },
                { name: 'Status', value: 'Online', inline: true }
            )
            .setImage('https://media.discordapp.net/attachments/1141151534399377450/1184646734346535032/BANNER_LOJA.gif') // Opcional: Pode remover se não quiser imagem
            .setTimestamp()
            .setFooter({ text: 'RZSISTEMA | rzsistema.com.br', iconURL: client.user.displayAvatarURL() });

        await channel.send({ embeds: [finalEmbed] });
        console.log('✅ Tudo terminado com sucesso! Encerrando processo em 5 segundos...');
        
        // Opcional: Desligar o bot após terminar para não ficar rodando a toa
        setTimeout(() => {
            console.log('👋 Desligando...');
            process.exit(0);
        }, 5000);

    } catch (error) {
        console.error('❌ Erro Fatal:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);
