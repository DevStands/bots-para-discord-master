# Marcar Bot Suite (RZSISTEMA)

Bem-vindo à suíte de automação do Discord **Marcar Bot**. Este projeto contém três ferramentas poderosas para gerenciamento e divulgação em servidores Discord, desenvolvidas com foco em eficiência e visual profissional.

![Bot Interface Mockup](./assets/mockup.png)

## 🚀 Ferramentas Incluídas

### 1. Marcador de Pessoas (`index.js`)

Este script é focado em **atacar** a visibilidade. Ao ser iniciado, ele imediatamente:

- Identifica todos os usuários do canal alvo.
- Marca todos eles em blocos otimizados.
- Envia um painel (Embed) visual no início e no fim.

**Comando:**

```bash
node index.js
```

### 2. Marcador de Cargos (`cargos.js`)

Similar ao anterior, mas focado em **Cargos (Roles)**. Ideal para avisos globais que precisam pingar roles específicas ou todas elas.

- Lista e marca todos os cargos do servidor.
- Painel visual laranja personalizado.

**Comando:**

```bash
node cargos.js
```

### 3. RZLIMPEZA (`limpar.js`)

O script de faxina definitiva.

- **Backup Seguro**: Antes de apagar, ele salva todo o histórico do chat num arquivo `.txt`.
- **Canal de Log**: Cria automaticamente um canal `#logs-chat` (se não existir) e envia o backup lá.
- **Limpeza Total**: Apaga todas as mensagens do canal alvo.
- **Assinatura**: Deixa um rastro visual ("A RRZLIMPEZA passou por aqui") com banner animado.

**Comando:**

```bash
node limpar.js
```

## 🛠️ Configuração

1.  **Instalação**:
    - Tenha o Node.js instalado.
    - Rode `npm install` na pasta do projeto.
2.  **Configuração**:
    - Crie um arquivo `.env` com seu Token: `DISCORD_TOKEN=SEU_TOKEN_AQUI`.
    - No arquivo de cada script, configure o `TARGET_CHANNEL_ID` desejado.
3.  **Intents**:
    - Garanta que no Discord Developer Portal as opções **Presence**, **Server Members** e **Message Content** estejam ativadas.

## 📞 Suporte

Desenvolvido por **RZSISTEMA**.
Acesse: [rzsistema.com.br](https://rzsistema.com.br)
