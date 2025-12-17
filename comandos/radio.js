const { 
    SlashCommandBuilder, PermissionsBitField, MessageFlags 
} = require('discord.js');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, StreamType 
} = require('@discordjs/voice');

// 🛑 URL da sua stream SSL de rádio
const RADIO_STREAM_URL = 'https://painel.dedicado.stream/8010/stream';

// Armazena as conexões ativas por ID da Guild
let activeConnections = {}; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('radio')
        .setDescription('Conecta o bot e inicia ou para a rádio no canal de voz.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.SendMessages)
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('ação')
                .setDescription('O que você quer fazer com a rádio.')
                .setRequired(true)
                .addChoices(
                    { name: 'Iniciar', value: 'play' },
                    { name: 'Parar', value: 'stop' }
                )), 

    async execute(interaction) {
        const action = interaction.options.getString('ação');
        const guildId = interaction.guildId;
        const currentConnection = activeConnections[guildId];

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); 

        // ===================================
        // AÇÃO: PARAR (STOP)
        // ===================================
        if (action === 'stop') {
            if (currentConnection) {
                try {
                    currentConnection.connection.destroy();
                } catch (e) { /* Já destruído */ }
                delete activeConnections[guildId];
                return interaction.editReply({ content: '⏹️ Rádio parada e bot desconectado!' });
            }
            return interaction.editReply({ content: '⚠️ O bot não está tocando rádio no momento.' });
        }

        // ===================================
        // AÇÃO: INICIAR (PLAY)
        // ===================================
        if (currentConnection) {
             return interaction.editReply({ content: `⚠️ O bot já está tocando em <#${currentConnection.channelId}>.` });
        }
        
        const memberChannel = interaction.member.voice.channel;
        if (!memberChannel) {
            return interaction.editReply({ content: '❌ Você precisa estar em um canal de voz!' });
        }
        
        const permissions = memberChannel.permissionsFor(interaction.client.user);
        if (!permissions.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak)) {
            return interaction.editReply({ content: '❌ Preciso de permissão para **Conectar** e **Falar** neste canal.' });
        }
        
        try {
            const connection = joinVoiceChannel({
                channelId: memberChannel.id,
                guildId: guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: true,
            });

            // 🟢 CORREÇÃO 1: Adicionada tolerância de frames (maxMissedFrames)
            // Isso permite que o player ignore pequenos atrasos na rede sem tentar recalcular o tempo.
            const player = createAudioPlayer({
                behaviors: {
                    noReplaceStrategy: 'pause',
                    maxMissedFrames: 250 // Tolera até 5 segundos de instabilidade sem erro
                }
            });
            
            // 🟢 CORREÇÃO 2: Removido o silencePaddingFrames
            // Em streams de rádio 24/7, o padding causa o erro de timeout negativo (-9).
            const resource = createAudioResource(RADIO_STREAM_URL, {
                inputType: StreamType.Arbitrary,
                inlineVolume: false, 
            });

            player.play(resource);
            connection.subscribe(player);
            
            activeConnections[guildId] = { connection, player, channelId: memberChannel.id };

            // Gerenciamento automático de estado
            connection.on('stateChange', (oldState, newState) => {
                if (newState.status === 'disconnected') {
                    delete activeConnections[guildId];
                }
            });

            player.on('error', error => {
                console.error(`Erro na Rádio (${guildId}):`, error.message);
                delete activeConnections[guildId];
                try { connection.destroy(); } catch(e) {}
            });

            await interaction.editReply({ content: `✅ Rádio iniciada em **${memberChannel.name}**!` });
            
        } catch (error) {
            console.error('Erro ao conectar rádio:', error);
            await interaction.editReply({ content: '❌ Erro ao conectar ao canal de voz.' });
        }
    }
};