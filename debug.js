const moment = require('moment');

module.exports = {
    name: 'interactionCreate',
    
    async execute(interaction) {
        // --- 0. FILTRO DE ATIVAÇÃO ---
        // Só executa se o DEBUG estiver como 'true' no .env
        // Se não houver nada no .env, ele assume 'false' por segurança.
        if (process.env.DEBUG_MODE !== 'true') return;

        // Ignora comandos slash e foca no painel de criação
        if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;

        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        const userTag = interaction.user.tag;
        const customId = interaction.customId;
        const msgId = interaction.message ? interaction.message.id : "N/A (Início)";

        // --- 1. IDENTIFICAÇÃO DE PONTE DE RECUPERAÇÃO ---
        const hasBridge = customId.includes('__') ? "🔗 [PONTE ATIVA]" : "📍 [ID ÚNICO]";

        console.log(`\n--- 🛠️ DEBUG HABBI SOUND [${timestamp}] ---`);
        console.log(`👤 Usuário: ${userTag}`);
        console.log(`🔑 Cache Key (MsgID): ${msgId}`);

        // --- 2. LOGS ESPECÍFICOS POR TIPO ---
        
        if (interaction.isButton()) {
            console.log(`🟢 TIPO: BOTÃO | ID: ${customId} | ${hasBridge}`);
            
            // Debug de ação específica
            if (customId.startsWith('delete_link_index_')) {
                console.log(`🗑️ AÇÃO: Tentativa de excluir link em rascunho.`);
            }
        } 
        
        else if (interaction.isStringSelectMenu()) {
            const selectedValue = interaction.values.join(', ');
            console.log(`🔵 TIPO: MENU | ID: ${customId} | Selecionado: ${selectedValue}`);
            
            if (customId === 'select_embed') {
                console.log(`📊 AÇÃO: Mudança de Embed em edição para o index ${selectedValue}.`);
            }
        }
        
        else if (interaction.isModalSubmit()) {
            console.log(`📝 TIPO: MODAL | ID: ${customId}`);
            
            // Mostra os campos enviados para verificar se algum valor veio nulo
            const fieldsReceived = interaction.fields.fields.map(f => f.customId).join(', ');
            console.log(`📦 Campos Recebidos: [${fieldsReceived}]`);
        }

        console.log(`------------------------------------------\n`);
    }
};