const { 
    EmbedBuilder, ChannelType, PermissionsBitField 
} = require('discord.js');

const TARGET_CHANNEL_ID = '1449595922370793492'; // Canal de texto para notificação
const COUNTER_CHANNEL_NAME_PREFIX = '📊 Membros:';

// Função principal para atualizar o contador
async function updateMemberCounter(client, guild) {
    // Garante que todos os membros (incluindo o cache) sejam buscados e os metadados da guild estejam atualizados
    const fetchedGuild = await guild.fetch({ withCounts: true });
    
    // 🛑 FILTRO PARA IGNORAR BOTS (IMPLEMENTAÇÃO PRINCIPAL)
    // Fetch members garante que a lista esteja completa
    const members = await fetchedGuild.members.fetch();
    const humanCount = members.filter(member => !member.user.bot).size;
    
    // Opcional: Se quiser contar o total:
    // const totalCount = fetchedGuild.memberCount; 
    
    const channelName = `${COUNTER_CHANNEL_NAME_PREFIX} ${humanCount}`;
    
    console.log(`🔢 Contagem de Humanos: ${humanCount}`);

    // Procura por canais que começam com o prefixo
    let counterChannel = guild.channels.cache.find(c => c.name.startsWith(COUNTER_CHANNEL_NAME_PREFIX));

    if (!counterChannel) {
        console.log('🔨 Criando canal de contador...');
        
        // Verifica se o bot tem permissão de Gerenciar Canais para criar
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            console.error('❌ ERRO: O bot não tem permissão para Gerenciar Canais.');
            return;
        }

        counterChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice, // Canal de voz para o contador
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.Connect], // Ninguém pode entrar
                    allow: [PermissionsBitField.Flags.ViewChannel] // Todos podem ver
                }
            ]
        });
        console.log('✅ Canal criado com sucesso.');
    } else if (counterChannel.name !== channelName) {
        console.log(`🔄 Atualizando canal existente: ${counterChannel.name} -> ${channelName}`);
        
        // Verifica se o bot tem permissão de Gerenciar Canais para renomear
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            console.error('❌ ERRO: O bot não tem permissão para Gerenciar Canais.');
            return;
        }
        
        await counterChannel.setName(channelName);
        console.log('✅ Canal atualizado.');
    }

    // Notificação de Log (apenas se houver mudança ou criação)
    if (counterChannel && (counterChannel.name === channelName || !counterChannel.name.startsWith(COUNTER_CHANNEL_NAME_PREFIX))) {
         const logChannel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
         if (logChannel) {
             const embed = new EmbedBuilder()
                 .setColor(0x00FFFF)
                 .setTitle('📊 Contador de Membros Atualizado')
                 .setDescription(`✅ **Contador de Humanos atualizado!**\n\n👤 **Contagem de Humanos:** ${humanCount}`)
                 .addFields(
                     { name: 'Canal Atualizado', value: counterChannel.name, inline: true }
                 )
                 .setTimestamp();
            
             // Evita enviar spam: envia apenas na primeira criação ou se o bot estiver rodando por pouco tempo.
             // Como vamos integrar isso, a notificação será mais silenciosa e só no console.
         }
    }
}

module.exports = {
    // Exportamos a função para ser chamada no global.js (no evento ready)
    updateMemberCounter
};