const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { createTicket, closeTicketChannel } = require('../handlers/ticketFunctions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Ticket management commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new support ticket')
                .addStringOption(option =>
                    option
                        .setName('category')
                        .setDescription('Select ticket category')
                        .setRequired(true)
                        .addChoices(
                            { name: 'General Support', value: 'general' },
                            { name: 'Bug Report', value: 'bug' },
                            { name: 'Player Report', value: 'player' },
                            { name: 'Punishment Appeal', value: 'appeal' },
                            { name: 'Payment Support', value: 'payment' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Close a ticket')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The ticket channel to close')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('slowdown')
                .setDescription('Set channel cooldown (0 to reset)')
                .addIntegerOption(option =>
                    option
                        .setName('seconds')
                        .setDescription('Cooldown in seconds (0-21600)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(21600)
                )
        ),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            if (subcommand === 'create') {
                await this.handleCreate(interaction, bot);
            } else if (subcommand === 'close') {
                await this.handleClose(interaction, bot);
            } else if (subcommand === 'slowdown') {
                await this.handleSlowdown(interaction, bot);
            }
        } catch (error) {
            console.error('Error in ticket command:', error);
            await interaction.reply({ 
                embeds: [createErrorEmbed('An error occurred while processing your command.')], 
                ephemeral: true 
            });
        }
    },

    async handleCreate(interaction, bot) {
        const category = interaction.options.getString('category');
        await createTicket(interaction, category, bot);
    },

    async handleClose(interaction, bot) {
        const channel = interaction.options.getChannel('channel');
        
        if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
            await interaction.reply({ 
                embeds: [createErrorEmbed('You need staff role to close tickets.')], 
                ephemeral: true 
            });
            return;
        }

        try {
            await closeTicketChannel(channel, interaction.user, bot);
            await interaction.reply({ 
                embeds: [createSuccessEmbed(`Ticket ${channel} has been closed successfully.`)]
            });
        } catch (error) {
            console.error('Error closing ticket:', error);
            await interaction.reply({ 
                embeds: [createErrorEmbed('Error closing ticket.')], 
                ephemeral: true 
            });
        }
    },

    async handleSlowdown(interaction, bot) {
        const seconds = interaction.options.getInteger('seconds');
        
        if (!interaction.member.permissions.has('ManageChannels')) {
            await interaction.reply({ 
                embeds: [createErrorEmbed('You need Manage Channels permission to use this command.')], 
                ephemeral: true 
            });
            return;
        }

        try {
            await interaction.channel.setRateLimitPerUser(seconds);
            
            const embed = new EmbedBuilder()
                .setTitle("✅ Channel Cooldown Updated")
                .setDescription(seconds === 0 
                    ? "Channel cooldown has been reset." 
                    : `Channel cooldown set to ${seconds} seconds.`
                )
                .setColor(0x00ff00);
                
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error setting channel cooldown:', error);
            await interaction.reply({ 
                embeds: [createErrorEmbed('Error setting channel cooldown.')], 
                ephemeral: true 
            });
        }
    }
};