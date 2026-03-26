const { handleCommand } = require('../handlers/commandHandler');
const { EmbedBuilder } = require('discord.js');
const MSG = require('../config/messages');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, bot) {
        if (interaction.isCommand()) {
            await handleCommand(interaction, bot);
        }

        if (interaction.isButton()) {
            await this.handleButtons(interaction, bot);
        }

        if (interaction.isStringSelectMenu()) {
            await this.handleSelectMenus(interaction, bot);
        }
    },

    async handleButtons(interaction, bot) {
        const buttonId = interaction.customId;

        try {
            // Ticket close button
            if (buttonId === 'close_ticket') {
                await this.handleCloseTicket(interaction, bot);
            }
            // Report system buttons
            else if (buttonId.startsWith('report_')) {
                await this.handleReportButtons(interaction, bot);
            }
            // Close request buttons
            else if (buttonId === 'close_request_confirm') {
                await this.handleCloseRequestConfirm(interaction, bot);
            }
            else if (buttonId === 'close_request_cancel') {
                await this.handleCloseRequestCancel(interaction, bot);
            }
            // Application system buttons are handled in applicationHandler
        } catch (error) {
            console.error('Error handling button interaction:', error);
            await interaction.reply({ 
                content: 'An error occurred while processing this button.', 
                ephemeral: true 
            });
        }
    },

    async handleSelectMenus(interaction, bot) {
        const menuId = interaction.customId;

        try {
            // Ticket category selection
            if (menuId === 'ticket_select') {
                await this.handleTicketSelect(interaction, bot);
            }
            // Application category selection is handled in applicationHandler
        } catch (error) {
            console.error('Error handling select menu interaction:', error);
            await interaction.reply({ 
                content: 'An error occurred while processing this selection.', 
                ephemeral: true 
            });
        }
    },

    async handleCloseTicket(interaction, bot) {
        await interaction.deferUpdate();

        bot.db.get("SELECT category FROM tickets WHERE channel_id = ?", [interaction.channel.id], async (err, ticket) => {
            if (err) {
                await interaction.followUp({ content: MSG.GENERIC_ERROR, ephemeral: true });
                return;
            }

            if (!ticket) {
                await interaction.followUp({ content: MSG.TICKET_NOT_FOUND, ephemeral: true });
                return;
            }

            const categoryConfig = bot.CONFIG.CATEGORY_PERMISSIONS[ticket.category];
            const hasPermission = interaction.member.roles.cache.some(role =>
                categoryConfig.staff_roles.includes(role.id)
            );

            if (!hasPermission) {
                await interaction.followUp({ content: MSG.NO_PERMISSION_STAFF, ephemeral: true });
                return;
            }

            try {
                const { closeTicketChannel } = require('../handlers/eventHandler');
                await closeTicketChannel(interaction.channel, interaction.user, bot);
            } catch (error) {
                console.error('Error closing ticket:', error);
                await interaction.followUp({ content: MSG.GENERIC_ERROR, ephemeral: true });
            }
        });
    },

    async handleReportButtons(interaction, bot) {
        const [action, reportedUserId, reporterId] = interaction.customId.split('_').slice(1);
        
        if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
            await interaction.reply({
                content: MSG.REPORT_NO_STAFF,
                ephemeral: true
            });
            return;
        }

        try {
            const reportedUser = await bot.client.users.fetch(reportedUserId);
            
            if (action === 'cancel') {
                const embed = new EmbedBuilder()
                    .setTitle(MSG.REPORT_CANCELLED_TITLE)
                    .setDescription(MSG.REPORT_CANCELLED_BODY(reportedUser.tag))
                    .setColor(0x00ff00);

                await interaction.update({ embeds: [embed], components: [] });
            }
        } catch (error) {
            console.error('Error handling report button:', error);
            await interaction.reply({ 
                content: MSG.GENERIC_ERROR,
                ephemeral: true 
            });
        }
    },

    async handleCloseRequestConfirm(interaction, bot) {
        await interaction.deferUpdate();

        bot.db.get("SELECT * FROM tickets WHERE channel_id = ?", [interaction.channel.id], async (err, ticket) => {
            if (err || !ticket) {
                await interaction.followUp({ content: MSG.TICKET_NOT_FOUND, ephemeral: true });
                return;
            }

            const categoryConfig = bot.CONFIG.CATEGORY_PERMISSIONS[ticket.category];
            const isStaff = interaction.member.roles.cache.some(role =>
                categoryConfig.staff_roles.includes(role.id)
            );

            if (interaction.user.id !== ticket.user_id && !isStaff) {
                await interaction.followUp({ content: MSG.NO_PERMISSION_STAFF, ephemeral: true });
                return;
            }

            try {
                const { closeTicketChannel } = require('../handlers/eventHandler');
                await closeTicketChannel(interaction.channel, interaction.user, bot);
            } catch (error) {
                console.error('Error closing ticket:', error);
                await interaction.followUp({ content: MSG.GENERIC_ERROR, ephemeral: true });
            }
        });
    },

    async handleCloseRequestCancel(interaction, bot) {
        await interaction.deferUpdate();

        const embed = new EmbedBuilder()
            .setTitle(MSG.TICKET_CLOSE_REQUEST_CANCELLED_TITLE)
            .setDescription(MSG.TICKET_CLOSE_REQUEST_CANCELLED_BODY)
            .setColor(0xff0000);

        await interaction.update({ embeds: [embed], components: [] });
    },

    async handleTicketSelect(interaction, bot) {
        const category = interaction.values[0];
        
        try {
            const { createTicket } = require('../handlers/eventHandler');
            await createTicket(interaction, category, bot);
        } catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.reply({ 
                content: 'Error creating ticket. Please try again.', 
                ephemeral: true 
            });
        }
    }
};