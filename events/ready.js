const { registerCommands } = require('../handlers/commandHandler');
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const MSG = require('../config/messages');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client, bot) {
        console.log(`${client.user.tag} is ready!`);
        
        await registerCommands(bot);
        await this.updateStatus(client);
        setInterval(() => this.updateStatus(client), 5 * 60 * 1000);
        await this.setupTicketChannel(client, bot);
        
        client.user.setActivity('applications', { type: 'WATCHING' });
        
        console.log('Bot is fully operational');
    },

    async updateStatus(client) {
        try {
            const { MINECRAFT_SERVER } = require('../config/config');
            const activity = `on ${MINECRAFT_SERVER}`;
            client.user.setActivity(activity, { type: 0 });
        } catch (error) {
            console.error('Error updating status:', error);
            client.user.setActivity('applications', { type: 'WATCHING' });
        }
    },

    async setupTicketChannel(client, bot) {
        const channel = client.channels.cache.get(bot.CONFIG.TICKET_CHANNEL);
        if (!channel) {
            console.error('Ticket channel not found');
            return;
        }

        try {
            const messages = await channel.messages.fetch({ limit: 10 });
            const existingPanel = messages.find(msg => 
                msg.author.id === client.user.id && 
                msg.embeds.length > 0 && 
                msg.embeds[0].title === "🎫 Support Tickets"
            );

            if (existingPanel) {
                console.log('Ticket panel already exists');
                return;
            }

            await channel.bulkDelete(messages);
        } catch (error) {
            console.error('Error clearing channel:', error);
        }

        const embed = new EmbedBuilder()
            .setTitle(MSG.TICKET_PANEL_TITLE)
            .setDescription(MSG.TICKET_PANEL_DESCRIPTION)
            .setColor(0x0000ff);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder(MSG.TICKET_PANEL_PLACEHOLDER)
            .addOptions([
                { label: "General Support", value: "general", emoji: "ℹ️" },
                { label: "Bug Report", value: "bug", emoji: "🐛" },
                { label: "Player Report", value: "player", emoji: "⚠️" },
                { label: "Punishment Appeal", value: "appeal", emoji: "🔓" },
                { label: "Payment Support", value: "payment", emoji: "💰" }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await channel.send({ embeds: [embed], components: [row] });
        console.log('Ticket panel created successfully');
    }
};