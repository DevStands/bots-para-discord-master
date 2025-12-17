require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// ID do canal onde ocorrerá a marcação
const TARGET_CHANNEL_ID = '1440801931126636767';

client.once('ready', async () => {
    console.log(`✅ Logado como ${client.user.tag}!`);
    console.log('🚀 Iniciando sequência de marcação de CARGOS...');

    try {
        const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
        if (!channel) {
            console.error(`❌ Canal ${TARGET_CHANNEL_ID} não encontrado!`);
            process.exit(1);
        }

        console.log(`✅ Canal encontrado: ${channel.name}`);

        // 1. Buscar Cargos
        const roles = await channel.guild.roles.fetch();
        // Filtra o cargo @everyone se desejar, mas o usuário pediu "todos". 
        // @everyone geralmente é o role com ID igual ao ID da guild.
        // Vamos manter todos, mas ordenar por posição (opcional, mas fica mais bonito)
        const sortedRoles = roles.sort((a, b) => b.position - a.position);
        
        console.log(`🛡️ Encontrados ${sortedRoles.size} cargos.`);

        if (sortedRoles.size === 0) {
            console.log('⚠️ Nenhum cargo para marcar.');
            return;
        }

        const startTime = Date.now();

        // 2. Marcar Todos (Chunks de 1900 chars)
        const chunks = [];
        let currentChunk = [];
        let currentLength = 0;

        sortedRoles.forEach(role => {
            const mention = role.toString() + ' ';
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
            // Pequena pausa para evitar rate limit
            await new Promise(resolve => setTimeout(resolve, 500)); 
        }

        // 3. Embed Final Personalizado
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        const finalEmbed = new EmbedBuilder()
            .setColor(0xFFA500) // Laranja para diferenciar de Usuários
            .setTitle('🚀 SISTEMA DE CARGOS RZSISTEMA')
            .setDescription(`✅ **Marcação de Cargos Concluída!**\n\n🛡️ **Cargos Marcados:** ${sortedRoles.size}\n⏱ **Tempo Decorrido:** ${duration}s`)
            .addFields(
                { name: 'Serviço', value: 'Divulgação Automatizada', inline: true },
                { name: 'Status', value: 'Online', inline: true }
            )
            .setImage('https://media.discordapp.net/attachments/1141151534399377450/1184646734346535032/BANNER_LOJA.gif')
            .setTimestamp()
            .setFooter({ text: 'RZSISTEMA | rzsistema.com.br', iconURL: client.user.displayAvatarURL() });

        await channel.send({ embeds: [finalEmbed] });
        console.log('✅ Tudo terminado com sucesso! Encerrando processo em 5 segundos...');
        
        setTimeout(() => {
            console.log('👋 Desligando...');
            process.exit(0);
        }, 5000);

    } catch (error) {
        console.error('❌ Erro Fatal:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);
