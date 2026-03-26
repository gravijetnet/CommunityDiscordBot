const { Collection, PermissionsBitField, EmbedBuilder, ApplicationCommandOptionType, MessageFlags } = require('discord.js');
const { createTicket, closeTicketChannel } = require('./ticketFunctions');
const MSG = require('../config/messages');

// Map to store original channel permissions for lock/unlock
const channelPermissions = new Map();

async function fetchChannel(bot, channelId) {
    if (!channelId) return null;
    try {
        return await bot.client.channels.fetch(channelId);
    } catch {
        return null;
    }
}

module.exports = {
    async registerCommands(bot) {
        const commands = [
            {
                name: 'tickets',
                description: 'Ticket management commands',
                options: [
                    {
                        name: 'create',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Create a new support ticket',
                        options: [
                            {
                                name: 'category',
                                type: ApplicationCommandOptionType.String,
                                description: 'Select ticket category',
                                required: true,
                                choices: [
                                    { name: 'General Support', value: 'general' },
                                    { name: 'Bug Report', value: 'bug' },
                                    { name: 'Player Report', value: 'player' },
                                    { name: 'Punishment Appeal', value: 'appeal' },
                                    { name: 'Payment Support', value: 'payment' }
                                ]
                            }
                        ]
                    },
                    {
                        name: 'close',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Close a ticket',
                        options: [
                            {
                                name: 'channel',
                                type: ApplicationCommandOptionType.Channel,
                                description: 'The ticket channel to close',
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'closerequest',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Send a close request to a ticket',
                        options: [
                            {
                                name: 'channel',
                                type: ApplicationCommandOptionType.Channel,
                                description: 'The ticket channel to send close request',
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'add',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Add a user to the ticket',
                        options: [
                            {
                                name: 'user',
                                type: ApplicationCommandOptionType.User,
                                description: 'The user to add to the ticket',
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'remove',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Remove a user from the ticket',
                        options: [
                            {
                                name: 'user',
                                type: ApplicationCommandOptionType.User,
                                description: 'The user to remove from the ticket',
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'ban',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Ban a user from creating tickets',
                        options: [
                            {
                                name: 'user',
                                type: ApplicationCommandOptionType.User,
                                description: 'The user to ban from creating tickets',
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'unban',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Unban a user from creating tickets',
                        options: [
                            {
                                name: 'user',
                                type: ApplicationCommandOptionType.User,
                                description: 'The user to unban from creating tickets',
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'slowdown',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Set channel cooldown (0 to reset)',
                        options: [
                            {
                                name: 'seconds',
                                type: ApplicationCommandOptionType.Integer,
                                description: 'Cooldown in seconds (0-21600)',
                                required: true,
                                min_value: 0,
                                max_value: 21600
                            }
                        ]
                    }
                ]
            },
            {
                name: 'status',
                description: 'Check Minecraft server status'
            },
            {
                name: 'about',
                description: 'Show bot statistics'
            },
            {
                name: 'moderate',
                description: 'Moderation commands',
                options: [
                    {
                        name: 'ban',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Ban a user from the server',
                        options: [
                            {
                                name: 'user',
                                type: ApplicationCommandOptionType.User,
                                description: 'The user to ban',
                                required: true
                            },
                            {
                                name: 'reason',
                                type: ApplicationCommandOptionType.String,
                                description: 'Reason for the ban',
                                required: false
                            },
                            {
                                name: 'duration',
                                type: ApplicationCommandOptionType.String,
                                description: 'Duration (e.g., 8h, 7d, 1m, permanent)',
                                required: false
                            },
                            {
                                name: 'delmessages',
                                type: ApplicationCommandOptionType.Boolean,
                                description: 'Delete message history from last 7 days (default: true)',
                                required: false
                            },
                            {
                                name: 'proof',
                                type: ApplicationCommandOptionType.String,
                                description: 'Proof URL (optional)',
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'unban',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Unban a user from the server',
                        options: [
                            {
                                name: 'user_id',
                                type: ApplicationCommandOptionType.String,
                                description: 'The user ID to unban',
                                required: true
                            },
                            {
                                name: 'reason',
                                type: ApplicationCommandOptionType.String,
                                description: 'Reason for unbanning',
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'kick',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Kick a user from the server',
                        options: [
                            {
                                name: 'user',
                                type: ApplicationCommandOptionType.User,
                                description: 'The user to kick',
                                required: true
                            },
                            {
                                name: 'reason',
                                type: ApplicationCommandOptionType.String,
                                description: 'Reason for the kick',
                                required: false
                            },
                            {
                                name: 'proof',
                                type: ApplicationCommandOptionType.String,
                                description: 'Proof URL (optional)',
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'mute',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Mute a user using timeout',
                        options: [
                            {
                                name: 'user',
                                type: ApplicationCommandOptionType.User,
                                description: 'The user to mute',
                                required: true
                            },
                            {
                                name: 'reason',
                                type: ApplicationCommandOptionType.String,
                                description: 'Reason for the mute',
                                required: false
                            },
                            {
                                name: 'duration',
                                type: ApplicationCommandOptionType.String,
                                description: 'Duration (e.g., 8h, 7d, 1m, permanent)',
                                required: false
                            },
                            {
                                name: 'proof',
                                type: ApplicationCommandOptionType.String,
                                description: 'Proof URL (optional)',
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'unmute',
                        type: ApplicationCommandOptionType.Subcommand,
                        description: 'Unmute a user by removing timeout',
                        options: [
                            {
                                name: 'user',
                                type: ApplicationCommandOptionType.User,
                                description: 'The user to unmute',
                                required: true
                            },
                            {
                                name: 'reason',
                                type: ApplicationCommandOptionType.String,
                                description: 'Reason for unmuting',
                                required: false
                            }
                        ]
                    }
                ]
            },
{
    name: 'promote',
    description: 'Promote a user to a specific rank',
    options: [
        {
            name: 'discordname',
            type: ApplicationCommandOptionType.User,
            description: 'The Discord user to promote',
            required: true
        },
        {
            name: 'rang',
            type: ApplicationCommandOptionType.String,
            description: 'The rank to promote to',
            required: true,
            choices: [
                { name: 'Creator', value: 'Creator' },
                { name: 'Media', value: 'Media' },
                { name: 'Famous', value: 'Famous' },
                { name: 'Partner', value: 'Partner' },
                { name: 'Builder', value: 'Builder' },
                { name: 'Trainee', value: 'Trainee' },
                { name: 'Moderator', value: 'Moderator' },
                { name: 'SrModerator', value: 'SrModerator' },
                { name: 'Admin', value: 'Admin' },
                { name: 'Developer', value: 'Developer' },
                { name: 'SrAdmin', value: 'SrAdmin' }
            ]
        }
    ]
},
            {
                name: 'demote',
                description: 'Demote a user to a specific rank or to member',
                options: [
                    {
                        name: 'nutzer',
                        type: ApplicationCommandOptionType.User,
                        description: 'The Discord user to demote',
                        required: true
                    },
                    {
                        name: 'rang',
                        type: ApplicationCommandOptionType.String,
                        description: 'The rank to demote to (optional, defaults to Member)',
                        required: false,
                        choices: [
                            { name: 'Creator', value: 'Creator' },
                            { name: 'Media', value: 'Media' },
                            { name: 'Famous', value: 'Famous' },
                            { name: 'Partner', value: 'Partner' },
                            { name: 'Builder', value: 'Builder' },
                            { name: 'Trainee', value: 'Trainee' },
                            { name: 'Moderator', value: 'Moderator' },
                            { name: 'SrModerator', value: 'SrModerator' },
                            { name: 'Admin', value: 'Admin' },
                            { name: 'Developer', value: 'Developer' },
                            { name: 'SrAdmin', value: 'SrAdmin' }
                        ]
                    }
                ]
            },
            {
                name: 'clear',
                description: 'Clear messages in the channel',
                options: [
                    {
                        name: 'amount',
                        type: ApplicationCommandOptionType.Integer,
                        description: 'Number of messages to clear (use 0 to clear all)',
                        required: true
                    }
                ]
            },
            {
                name: 'report',
                description: 'Report a user to the staff team',
                options: [
                    {
                        name: 'user',
                        type: ApplicationCommandOptionType.User,
                        description: 'The user to report',
                        required: true
                    },
                    {
                        name: 'proof',
                        type: ApplicationCommandOptionType.String,
                        description: 'Proof (image links, message links, etc.)',
                        required: true
                    }
                ]
            },
            {
                name: 'reportban',
                description: 'Ban a user from using the report system',
                options: [
                    {
                        name: 'user',
                        type: ApplicationCommandOptionType.User,
                        description: 'The user to ban from reporting',
                        required: true
                    }
                ]
            },
            {
                name: 'reportunban',
                description: 'Unban a user from using the report system',
                options: [
                    {
                        name: 'user',
                        type: ApplicationCommandOptionType.User,
                        description: 'The user to unban from reporting',
                        required: true
                    }
                ]
            },
            {
                name: 'proof',
                description: 'Add proof to a moderation log entry',
                options: [
                    {
                        name: 'message_id',
                        type: ApplicationCommandOptionType.String,
                        description: 'The message ID of the moderation log entry',
                        required: true
                    },
                    {
                        name: 'proof_url',
                        type: ApplicationCommandOptionType.String,
                        description: 'The proof URL to add',
                        required: true
                    }
                ]
            },
            {
                name: 'lock',
                description: 'Lock the channel for everyone except admins'
            },
            {
                name: 'unlock', 
                description: 'Unlock the channel and restore previous permissions'
            },
            {
                name: 'slowdown',
                description: 'Set channel cooldown (0 to reset)',
                options: [
                    {
                        name: 'seconds',
                        type: ApplicationCommandOptionType.Integer,
                        description: 'Cooldown in seconds (0-21600)',
                        required: true,
                        min_value: 0,
                        max_value: 21600
                    }
                ]
            },
            {
                name: 'massrole',
                description: 'Add or remove a role from all server members',
                options: [
                    {
                        name: 'action',
                        type: ApplicationCommandOptionType.String,
                        description: 'Whether to add or remove the role',
                        required: true,
                        choices: [
                            { name: 'Add', value: 'add' },
                            { name: 'Remove', value: 'remove' }
                        ]
                    },
                    {
                        name: 'role',
                        type: ApplicationCommandOptionType.Role,
                        description: 'The role to add or remove',
                        required: true
                    },
                    {
                        name: 'include_bots',
                        type: ApplicationCommandOptionType.Boolean,
                        description: 'Also apply to bots? (default: false)',
                        required: false
                    }
                ]
            },
            {
                name: 'embed',
                description: 'Send a custom embed message',
                options: [
                    {
                        name: 'title',
                        type: ApplicationCommandOptionType.String,
                        description: 'The embed title',
                        required: true
                    },
                    {
                        name: 'text',
                        type: ApplicationCommandOptionType.String,
                        description: 'The embed description/text',
                        required: true
                    },
                    {
                        name: 'color',
                        type: ApplicationCommandOptionType.String,
                        description: 'Hex color code (e.g. #ff0000). Default: #5865F2',
                        required: false
                    },
                    {
                        name: 'thumbnail',
                        type: ApplicationCommandOptionType.String,
                        description: 'URL for the thumbnail image (top-right)',
                        required: false
                    },
                    {
                        name: 'image',
                        type: ApplicationCommandOptionType.String,
                        description: 'URL for the large image (bottom)',
                        required: false
                    },
                    {
                        name: 'footer',
                        type: ApplicationCommandOptionType.String,
                        description: 'Footer text',
                        required: false
                    },
                    {
                        name: 'channel',
                        type: ApplicationCommandOptionType.Channel,
                        description: 'Channel to send the embed to (default: current channel)',
                        required: false
                    }
                ]
            }
        ];

        try {
            const guild = bot.client.guilds.cache.get(bot.CONFIG.GUILD_ID);
            if (guild) {
                await guild.commands.set(commands);
                console.log('Slash commands registered successfully!');
            }
        } catch (error) {
            console.error('Error registering commands:', error);
        }
    },

    async handleCommand(interaction, bot) {
        const { commandName, options } = interaction;

        switch (commandName) {
            case 'tickets':
                await handleTicketsCommand(interaction, options, bot);
                break;
            case 'status':
                await handleStatusCommand(interaction, bot);
                break;
            case 'about':
                await handleAboutCommand(interaction, bot);
                break;
            case 'moderate':
                await handleModerateCommand(interaction, options, bot);
                break;
            case 'promote':
                await handlePromote(interaction, options, bot);
                break;
            case 'demote':
                await handleDemote(interaction, options, bot);
                break;
            case 'clear':
                await handleClearCommand(interaction, options, bot);
                break;
            case 'report':
                await handleReportCommand(interaction, options, bot);
                break;
            case 'reportban':
                await handleReportBan(interaction, options, bot);
                break;
            case 'reportunban':
                await handleReportUnban(interaction, options, bot);
                break;
            case 'proof':
                await handleProofCommand(interaction, options, bot);
                break;
            case 'lock':
                await handleLockCommand(interaction, bot);
                break;
            case 'unlock':
                await handleUnlockCommand(interaction, bot);
                break;
            case 'slowdown':
                await handleSlowdownCommand(interaction, options, bot);
                break;
            case 'massrole':
                await handleMassRole(interaction, options, bot);
                break;
            case 'embed':
                await handleEmbedCommand(interaction, options, bot);
                break;
        }
    }
};

async function handleTicketsCommand(interaction, options, bot) {
    const subcommand = options.getSubcommand();
    
    switch (subcommand) {
        case 'create':
            const category = options.getString('category');
            await createTicket(interaction, category, bot);
            break;
            
        case 'close':
            const channel = options.getChannel('channel');
            await handleTicketCloseCommand(interaction, channel, bot);
            break;

        case 'closerequest':
            const closeRequestChannel = options.getChannel('channel');
            await handleCloseRequest(interaction, closeRequestChannel, bot);
            break;
            
        case 'add':
            await handleTicketAdd(interaction, options, bot);
            break;
            
        case 'remove':
            await handleTicketRemove(interaction, options, bot);
            break;
            
        case 'ban':
            await handleTicketBan(interaction, options, bot);
            break;
            
        case 'unban':
            await handleTicketUnban(interaction, options, bot);
            break;
            
        case 'slowdown':
            await handleSlowdownCommand(interaction, options, bot);
            break;
    }
}

async function handleCloseRequest(interaction, channel, bot) {
    if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_STAFF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    bot.db.get("SELECT * FROM tickets WHERE channel_id = ?", [channel.id], async (err, ticket) => {
        if (err || !ticket) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.TICKET_NOT_FOUND)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle(MSG.TICKET_CLOSE_REQUEST_TITLE)
            .setDescription(MSG.TICKET_CLOSE_REQUEST_BODY)
            .setColor(0xffa500)
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId('close_request_confirm')
            .setLabel(MSG.CONFIRM_CLOSE_BUTTON_LABEL)
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('close_request_cancel')
            .setLabel(MSG.CANCEL_CLOSE_BUTTON_LABEL)
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const ticketCreator = await bot.client.users.fetch(ticket.user_id);
        await channel.send({ content: `${ticketCreator}`, embeds: [embed], components: [row] });

        const successEmbed = new EmbedBuilder()
            .setTitle("✅ Close Request Sent")
            .setDescription(MSG.TICKET_CLOSE_REQUEST_SENT(channel))
            .setColor(0x00ff00);
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    });
}

async function handleTicketCloseCommand(interaction, channel, bot) {
    await interaction.deferReply({ ephemeral: true });

    bot.db.get("SELECT category FROM tickets WHERE channel_id = ?", [channel.id], async (err, ticket) => {
        if (err) {
            await interaction.editReply({ content: MSG.GENERIC_ERROR });
            return;
        }

        if (!ticket) {
            await interaction.editReply({ content: MSG.TICKET_NOT_FOUND });
            return;
        }

        try {
            await closeTicketChannel(channel, interaction.user, bot);
            await interaction.editReply({ content: MSG.TICKET_CLOSED(channel) });
        } catch (error) {
            console.error('Error closing ticket:', error);
            await interaction.editReply({ content: MSG.GENERIC_ERROR });
        }
    });
}

async function handleTicketAdd(interaction, options, bot) {
    const user = options.getUser('user');
    const managementRole = "000000000000000000";

    if (!interaction.member.roles.cache.has(managementRole)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    bot.db.get("SELECT * FROM tickets WHERE channel_id = ?", [interaction.channel.id], async (err, ticket) => {
        if (err || !ticket) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.TICKET_NOT_FOUND)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.channel.permissionOverwrites.create(user, {
            ViewChannel: true,
            SendMessages: true
        });

        const embed = new EmbedBuilder()
            .setTitle("✅ User Added")
            .setDescription(MSG.TICKET_ADD_SUCCESS(user))
            .setColor(0x00ff00);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    });
}

async function handleTicketRemove(interaction, options, bot) {
    const user = options.getUser('user');
    const managementRole = "000000000000000000";

    if (!interaction.member.roles.cache.has(managementRole)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    bot.db.get("SELECT * FROM tickets WHERE channel_id = ?", [interaction.channel.id], async (err, ticket) => {
        if (err || !ticket) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.TICKET_NOT_FOUND)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.channel.permissionOverwrites.delete(user);

        const embed = new EmbedBuilder()
            .setTitle("✅ User Removed")
            .setDescription(MSG.TICKET_REMOVE_SUCCESS(user))
            .setColor(0x00ff00);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    });
}

async function handleTicketBan(interaction, options, bot) {
    const user = options.getUser('user');
    const managementRole = "000000000000000000";

    if (!interaction.member.roles.cache.has(managementRole)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    bot.db.get("SELECT * FROM ticket_bans WHERE user_id = ?", [user.id], async (err, existingBan) => {
        if (err) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (existingBan) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Already Banned")
                .setDescription(MSG.TICKET_ALREADY_BANNED)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        bot.db.run("INSERT INTO ticket_bans (user_id, banned_by) VALUES (?, ?)", [user.id, interaction.user.id], async (err) => {
            if (err) {
                const embed = new EmbedBuilder()
                    .setTitle("❌ Error")
                    .setDescription(MSG.GENERIC_DB_ERROR)
                    .setColor(0xff0000);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("✅ User Banned")
                .setDescription(MSG.TICKET_BAN_SUCCESS(user))
                .setColor(0x00ff00);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        });
    });
}

async function handleTicketUnban(interaction, options, bot) {
    const user = options.getUser('user');
    const managementRole = "000000000000000000";

    if (!interaction.member.roles.cache.has(managementRole)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    bot.db.get("SELECT * FROM ticket_bans WHERE user_id = ?", [user.id], async (err, existingBan) => {
        if (err) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (!existingBan) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Not Banned")
                .setDescription(MSG.TICKET_NOT_BANNED)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        bot.db.run("DELETE FROM ticket_bans WHERE user_id = ?", [user.id], async (err) => {
            if (err) {
                const embed = new EmbedBuilder()
                    .setTitle("❌ Error")
                    .setDescription(MSG.GENERIC_DB_ERROR)
                    .setColor(0xff0000);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("✅ User Unbanned")
                .setDescription(MSG.TICKET_UNBAN_SUCCESS(user))
                .setColor(0x00ff00);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        });
    });
}

async function handleStatusCommand(interaction, bot) {
    const { MinecraftServerListPing } = require('minecraft-status');

    try {
        const status = await MinecraftServerListPing.ping(4, bot.CONFIG.MINECRAFT_SERVER, bot.CONFIG.MINECRAFT_PORT, 3000);
        
        const embed = new EmbedBuilder()
            .setTitle("🟢 Server Status - example.invalid")
            .setColor(0x00ff00)
            .setTimestamp()
            .addFields(
                { name: "Version", value: cleanMinecraftText(status.version.name), inline: true },
                { name: "Players", value: `${status.players.online}/${status.players.max}`, inline: true }
            );

        if (status.players.sample && status.players.sample.length > 0) {
            const players = status.players.sample.map(player => cleanMinecraftText(player.name));
            embed.addFields({ name: "Online Players", value: players.join(", "), inline: false });
        }

        if (status.description) {
            let motd = '';
            if (typeof status.description === 'string') {
                motd = cleanMinecraftText(status.description);
            } else if (status.description.text) {
                motd = cleanMinecraftText(status.description.text);
            } else if (status.description.extra) {
                motd = status.description.extra.map(extra => cleanMinecraftText(extra.text)).join('');
            }
            embed.setDescription(`**MOTD:** ${motd}`);
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error fetching Minecraft status:', error);
        const embed = new EmbedBuilder()
            .setTitle("🔴 Server Offline")
            .setDescription("The Minecraft server is currently offline or unreachable.")
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

function cleanMinecraftText(text) {
    if (!text) return "No MOTD";
    return text.replace(/§./g, '');
}

async function handleAboutCommand(interaction, bot) {
    return new Promise((resolve, reject) => {
        bot.db.get("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'", (err, openTickets) => {
            if (err) return reject(err);
            
            bot.db.get("SELECT COUNT(*) as count FROM tickets", (err, totalTickets) => {
                if (err) return reject(err);
                
                bot.db.get("SELECT COUNT(*) as count FROM punishments WHERE active = TRUE", (err, activePunishments) => {
                    if (err) return reject(err);
                    
                    bot.db.get("SELECT COUNT(*) as count FROM punishments", (err, totalPunishments) => {
                        if (err) return reject(err);

                        const uptime = Date.now() - bot.startTime;
                        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
                        const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

                        const embed = new EmbedBuilder()
                            .setTitle("🤖 Ticket Bot Statistics")
                            .setColor(0x0000ff)
                            .setTimestamp()
                            .addFields(
                                { name: "Open Tickets", value: openTickets.count.toString(), inline: true },
                                { name: "Total Tickets", value: totalTickets.count.toString(), inline: true },
                                { name: "Active Punishments", value: activePunishments.count.toString(), inline: true },
                                { name: "Total Punishments", value: totalPunishments.count.toString(), inline: true },
                                { name: "Uptime", value: uptimeStr, inline: true }
                            );

                        interaction.reply({ embeds: [embed], ephemeral: true });
                        resolve();
                    });
                });
            });
        });
    });
}

async function handleModerateCommand(interaction, options, bot) {
    const subcommand = options.getSubcommand();
    
    switch (subcommand) {
        case 'ban':
            await handleBan(interaction, options, bot);
            break;
        case 'unban':
            await handleUnban(interaction, options, bot);
            break;
        case 'kick':
            await handleKick(interaction, options, bot);
            break;
        case 'mute':
            await handleMute(interaction, options, bot);
            break;
        case 'unmute':
            await handleUnmute(interaction, options, bot);
            break;
    }
}

async function handleBan(interaction, options, bot) {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';
    const duration = options.getString('duration') || 'permanent';
    const delmessages = options.getBoolean('delmessages') ?? true;
    const proof = options.getString('proof');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_BAN)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.id === interaction.user.id) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.CANNOT_BAN_SELF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.bot) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.CANNOT_BAN_BOT)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        const ms = require('ms');
        let expiresAt = null;
        let durationText = duration;

        if (duration !== 'permanent') {
            const durationMs = ms(duration);
            if (durationMs) {
                expiresAt = new Date(Date.now() + durationMs);
                durationText = `until <t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;
            }
        }

        const dmEmbed = new EmbedBuilder()
            .setTitle(MSG.BAN_DM_TITLE)
            .setColor(0xff0000)
            .setDescription(MSG.BAN_DM_BODY(interaction.guild.name))
            .addFields(
                { name: "Reason", value: reason, inline: true },
                { name: "Duration", value: durationText, inline: true },
                { name: "Moderator", value: interaction.user.displayName, inline: true }
            )
            .setTimestamp();

        try {
            await user.send({ embeds: [dmEmbed] });
            console.log(`DM sent to ${user.username} about ban`);
        } catch (error) {
            console.log(`Could not send DM to ${user.username}, they might have DMs disabled`);
        }

        const banOptions = { reason: `${reason} | By: ${interaction.user.username} | Duration: ${duration}` };
        if (delmessages) {
            banOptions.deleteMessageSeconds = 7 * 24 * 60 * 60; // 7 days in seconds
        }

        await interaction.guild.members.ban(user, banOptions);

        bot.db.run(
            "INSERT INTO punishments (user_id, type, reason, duration, punished_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            [user.id, "ban", reason, duration, interaction.user.id, expiresAt?.toISOString()]
        );

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.BAN_LOG_TITLE)
                .setColor(0xff0000)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: '👤 User',            value: `${user} (${user.tag})\n\`${user.id}\``,                                   inline: true },
                    { name: '🛡️ Moderator',      value: `${interaction.user} (${interaction.user.tag})`,                           inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,                       inline: true },
                    { name: '📝 Reason',          value: reason,                                                                    inline: false },
                    { name: '⏱️ Duration',        value: durationText,                                                              inline: true },
                    { name: '🗑️ Messages Cleared', value: delmessages ? 'Yes (last 7 days)' : 'No',                                 inline: true }
                );

            if (proof) {
                logEmbed.addFields({ name: '🔗 Proof', value: proof, inline: false });
            }

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ User Banned")
            .setDescription(MSG.BAN_SUCCESS_BODY(user, reason, durationText, delmessages))
            .setColor(0x00ff00);
        
        if (proof) {
            embed.addFields({ name: "Proof", value: proof, inline: true });
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error banning user:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.BOT_NO_PERMISSION)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleUnban(interaction, options, bot) {
    const userId = options.getString('user_id');
    const reason = options.getString('reason') || 'No reason provided';

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_BAN)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        const user = await bot.client.users.fetch(userId);

        const dmEmbed = new EmbedBuilder()
            .setTitle(MSG.UNBAN_DM_TITLE)
            .setColor(0x00ff00)
            .setDescription(MSG.UNBAN_DM_BODY(interaction.guild.name))
            .addFields(
                { name: "Reason", value: reason, inline: true },
                { name: "Moderator", value: interaction.user.displayName, inline: true }
            )
            .setTimestamp();

        try {
            await user.send({ embeds: [dmEmbed] });
            console.log(`DM sent to ${user.username} about unban`);
        } catch (error) {
            console.log(`Could not send DM to ${user.username}, they might have DMs disabled or cannot be found`);
        }

        await interaction.guild.members.unban(userId, `${reason} | By: ${interaction.user.username}`);

        bot.db.run(
            "UPDATE punishments SET active = FALSE WHERE user_id = ? AND type = 'ban' AND active = TRUE",
            [userId]
        );

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.UNBAN_LOG_TITLE)
                .setColor(0x00cc44)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: '👤 User',            value: `${user.tag}\n\`${userId}\``,                          inline: true },
                    { name: '🛡️ Moderator',      value: `${interaction.user} (${interaction.user.tag})`,       inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,   inline: true },
                    { name: '📝 Reason',          value: reason,                                                inline: false }
                );

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ User Unbanned")
            .setDescription(MSG.UNBAN_SUCCESS_BODY(user.username, reason))
            .setColor(0x00ff00);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error unbanning user:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.UNBAN_INVALID_USER)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleKick(interaction, options, bot) {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';
    const proof = options.getString('proof');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_KICK)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.id === interaction.user.id) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.CANNOT_KICK_SELF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.bot) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.CANNOT_KICK_BOT)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        const member = await interaction.guild.members.fetch(user.id);

        const dmEmbed = new EmbedBuilder()
            .setTitle(MSG.KICK_DM_TITLE)
            .setColor(0xffa500)
            .setDescription(MSG.KICK_DM_BODY(interaction.guild.name))
            .addFields(
                { name: "Reason", value: reason, inline: true },
                { name: "Moderator", value: interaction.user.displayName, inline: true }
            )
            .setTimestamp();

        try {
            await user.send({ embeds: [dmEmbed] });
            console.log(`DM sent to ${user.username} about kick`);
        } catch (error) {
            console.log(`Could not send DM to ${user.username}, they might have DMs disabled`);
        }

        await member.kick(`${reason} | By: ${interaction.user.username}`);

        bot.db.run(
            "INSERT INTO punishments (user_id, type, reason, duration, punished_by) VALUES (?, ?, ?, ?, ?)",
            [user.id, "kick", reason, "permanent", interaction.user.id]
        );

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.KICK_LOG_TITLE)
                .setColor(0xff8c00)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: '👤 User',            value: `${user} (${user.tag})\n\`${user.id}\``,                                   inline: true },
                    { name: '🛡️ Moderator',      value: `${interaction.user} (${interaction.user.tag})`,                           inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,                       inline: true },
                    { name: '📝 Reason',          value: reason,                                                                    inline: false }
                );

            if (proof) {
                logEmbed.addFields({ name: '🔗 Proof', value: proof, inline: false });
            }

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ User Kicked")
            .setDescription(MSG.KICK_SUCCESS_BODY(user, reason))
            .setColor(0x00ff00);
        
        if (proof) {
            embed.addFields({ name: "Proof", value: proof, inline: true });
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error kicking user:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.BOT_NO_PERMISSION)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleMute(interaction, options, bot) {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';
    const duration = options.getString('duration') || '1h';
    const proof = options.getString('proof');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MUTE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.id === interaction.user.id) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.CANNOT_MUTE_SELF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.bot) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.CANNOT_MUTE_BOT)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        const member = await interaction.guild.members.fetch(user.id);

        const ms = require('ms');
        let timeoutDuration = null;
        let durationText = duration;

        if (duration !== 'permanent') {
            const durationMs = ms(duration);
            if (durationMs) {
                timeoutDuration = durationMs;
                const timeoutUntil = new Date(Date.now() + durationMs);
                durationText = `until <t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`;
            }
        } else {
            timeoutDuration = 28 * 24 * 60 * 60 * 1000;
            durationText = 'permanent (28 days maximum)';
        }

        const dmEmbed = new EmbedBuilder()
            .setTitle(MSG.MUTE_DM_TITLE)
            .setColor(0x808080)
            .setDescription(MSG.MUTE_DM_BODY(interaction.guild.name))
            .addFields(
                { name: "Reason", value: reason, inline: true },
                { name: "Duration", value: durationText, inline: true },
                { name: "Moderator", value: interaction.user.displayName, inline: true }
            )
            .setTimestamp();

        try {
            await user.send({ embeds: [dmEmbed] });
            console.log(`DM sent to ${user.username} about mute`);
        } catch (error) {
            console.log(`Could not send DM to ${user.username}, they might have DMs disabled`);
        }

        await member.timeout(timeoutDuration, `${reason} | By: ${interaction.user.username}`);

        let expiresAt = null;
        if (timeoutDuration) {
            expiresAt = new Date(Date.now() + timeoutDuration).toISOString();
        }

        bot.db.run(
            "INSERT INTO punishments (user_id, type, reason, duration, punished_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            [user.id, "mute", reason, duration, interaction.user.id, expiresAt]
        );

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.MUTE_LOG_TITLE)
                .setColor(0x808080)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: '👤 User',            value: `${user} (${user.tag})\n\`${user.id}\``,                                   inline: true },
                    { name: '🛡️ Moderator',      value: `${interaction.user} (${interaction.user.tag})`,                           inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,                       inline: true },
                    { name: '📝 Reason',          value: reason,                                                                    inline: false },
                    { name: '⏱️ Duration',        value: durationText,                                                              inline: true }
                );

            if (proof) {
                logEmbed.addFields({ name: '🔗 Proof', value: proof, inline: false });
            }

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ User Muted")
            .setDescription(MSG.MUTE_SUCCESS_BODY(user, reason, durationText))
            .setColor(0x00ff00);
        
        if (proof) {
            embed.addFields({ name: "Proof", value: proof, inline: true });
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error muting user:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.BOT_NO_PERMISSION)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleUnmute(interaction, options, bot) {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MUTE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        const member = await interaction.guild.members.fetch(user.id);

        if (!member.isCommunicationDisabled()) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.NOT_MUTED)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const dmEmbed = new EmbedBuilder()
            .setTitle(MSG.UNMUTE_DM_TITLE)
            .setColor(0x00ff00)
            .setDescription(MSG.UNMUTE_DM_BODY(interaction.guild.name))
            .addFields(
                { name: "Reason", value: reason, inline: true },
                { name: "Moderator", value: interaction.user.displayName, inline: true }
            )
            .setTimestamp();

        try {
            await user.send({ embeds: [dmEmbed] });
            console.log(`DM sent to ${user.username} about unmute`);
        } catch (error) {
            console.log(`Could not send DM to ${user.username}, they might have DMs disabled`);
        }

        await member.timeout(null, `${reason} | By: ${interaction.user.username}`);

        bot.db.run(
            "UPDATE punishments SET active = FALSE WHERE user_id = ? AND type = 'mute' AND active = TRUE",
            [user.id]
        );

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.UNMUTE_LOG_TITLE)
                .setColor(0x00cc44)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: '👤 User',            value: `${user} (${user.tag})\n\`${user.id}\``,                                   inline: true },
                    { name: '🛡️ Moderator',      value: `${interaction.user} (${interaction.user.tag})`,                           inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,                       inline: true },
                    { name: '📝 Reason',          value: reason,                                                                    inline: false }
                );

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ User Unmuted")
            .setDescription(MSG.UNMUTE_SUCCESS_BODY(user))
            .setColor(0x00ff00);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error unmuting user:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.BOT_NO_PERMISSION)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handlePromote(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const user = options.getUser('discordname');
    const rank = options.getString('rang');

    try {
        const member = await interaction.guild.members.fetch(user.id);

        const allRankRoles = Object.values(bot.RANK_ROLES);
        for (const roleId of allRankRoles) {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
            }
        }

        if (member.roles.cache.has(bot.STAFF_ROLE)) {
            await member.roles.remove(bot.STAFF_ROLE);
        }

        const newRoleId = bot.RANK_ROLES[rank];
        if (!newRoleId) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(`Role for rank "${rank}" not found.`)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // Role-Objekt abrufen und hinzufügen
        const newRole = interaction.guild.roles.cache.get(newRoleId);
        if (!newRole) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(`Role with ID ${newRoleId} not found in guild.`)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        await member.roles.add(newRole);

        if (bot.ROLE_HIERARCHY[rank]) {
            for (const additionalRank of bot.ROLE_HIERARCHY[rank]) {
                if (additionalRank !== rank) {
                    const additionalRoleId = bot.RANK_ROLES[additionalRank];
                    if (additionalRoleId) {
                        const additionalRole = interaction.guild.roles.cache.get(additionalRoleId);
                        if (additionalRole) {
                            await member.roles.add(additionalRole);
                        }
                    }
                }
            }
        }

        if (bot.STAFF_RANKS.includes(rank)) {
            const staffRole = interaction.guild.roles.cache.get(bot.STAFF_ROLE);
            if (staffRole) {
                await member.roles.add(staffRole);
            }
        }

        const logChannel = await fetchChannel(bot, bot.CONFIG.PROMOTION_LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("🎉 Promotion")
                .setColor(0x00ff00)
                .setDescription(MSG.PROMOTE_LOG_DESCRIPTION(user, rank))
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp()
                .setFooter({ text: MSG.PROMOTE_LOG_FOOTER });

            await logChannel.send({ embeds: [logEmbed] });
        }

        const grantChannel = await fetchChannel(bot, bot.CONFIG.GRANT_COMMAND_CHANNEL);
        if (grantChannel) {
            await grantChannel.send(`ogrant ${user.tag} ${rank} perm global Promoted`);
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ User Promoted")
            .setDescription(MSG.PROMOTE_SUCCESS(user, rank))
            .setColor(0x00ff00);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error promoting user:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleDemote(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const user = options.getUser('nutzer');
    const rank = options.getString('rang');

    try {
        const member = await interaction.guild.members.fetch(user.id);

        if (!rank) {
            const allRankRoles = Object.values(bot.RANK_ROLES);
            for (const roleId of allRankRoles) {
                if (member.roles.cache.has(roleId)) {
                    const role = interaction.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.remove(role);
                    }
                }
            }

            if (member.roles.cache.has(bot.STAFF_ROLE)) {
                const staffRole = interaction.guild.roles.cache.get(bot.STAFF_ROLE);
                if (staffRole) {
                    await member.roles.remove(staffRole);
                }
            }

            const joinRole = interaction.guild.roles.cache.get(bot.CONFIG.JOIN_ROLE);
            if (joinRole && !member.roles.cache.has(bot.CONFIG.JOIN_ROLE)) {
                await member.roles.add(joinRole);
            }

            const logChannel = await fetchChannel(bot, bot.CONFIG.PROMOTION_LOG_CHANNEL);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("📋 Demotion")
                    .setColor(0xffa500)
                    .setDescription(MSG.DEMOTE_LOG_DESCRIPTION(user, 'Member'))
                    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTimestamp()
                    .setFooter({ text: MSG.DEMOTE_LOG_FOOTER });

                await logChannel.send({ embeds: [logEmbed] });
            }

            const grantChannel = await fetchChannel(bot, bot.CONFIG.GRANT_COMMAND_CHANNEL);
            if (grantChannel) {
                await grantChannel.send(`rgrant ${user.tag} Member Demoted`);
            }

            const embed = new EmbedBuilder()
                .setTitle("✅ User Demoted")
                .setDescription(MSG.DEMOTE_SUCCESS(user, 'Member'))
                .setColor(0xffa500);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        } else {
            const allRankRoles = Object.values(bot.RANK_ROLES);
            for (const roleId of allRankRoles) {
                if (member.roles.cache.has(roleId)) {
                    const role = interaction.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.remove(role);
                    }
                }
            }

            if (!bot.STAFF_RANKS.includes(rank) && member.roles.cache.has(bot.STAFF_ROLE)) {
                const staffRole = interaction.guild.roles.cache.get(bot.STAFF_ROLE);
                if (staffRole) {
                    await member.roles.remove(staffRole);
                }
            }

            const newRoleId = bot.RANK_ROLES[rank];
            if (!newRoleId) {
                const embed = new EmbedBuilder()
                    .setTitle("❌ Error")
                    .setDescription(`Role for rank "${rank}" not found.`)
                    .setColor(0xff0000);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            const newRole = interaction.guild.roles.cache.get(newRoleId);
            if (!newRole) {
                const embed = new EmbedBuilder()
                    .setTitle("❌ Error")
                    .setDescription(`Role with ID ${newRoleId} not found in guild.`)
                    .setColor(0xff0000);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            await member.roles.add(newRole);

            if (bot.ROLE_HIERARCHY[rank]) {
                for (const additionalRank of bot.ROLE_HIERARCHY[rank]) {
                    if (additionalRank !== rank) {
                        const additionalRoleId = bot.RANK_ROLES[additionalRank];
                        if (additionalRoleId) {
                            const additionalRole = interaction.guild.roles.cache.get(additionalRoleId);
                            if (additionalRole) {
                                await member.roles.add(additionalRole);
                            }
                        }
                    }
                }
            }

            if (bot.STAFF_RANKS.includes(rank)) {
                const staffRole = interaction.guild.roles.cache.get(bot.STAFF_ROLE);
                if (staffRole) {
                    await member.roles.add(staffRole);
                }
            }

            const logChannel = await fetchChannel(bot, bot.CONFIG.PROMOTION_LOG_CHANNEL);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("📋 Demotion")
                    .setColor(0xffa500)
                    .setDescription(MSG.DEMOTE_LOG_DESCRIPTION(user, rank))
                    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTimestamp()
                    .setFooter({ text: MSG.DEMOTE_LOG_FOOTER });

                await logChannel.send({ embeds: [logEmbed] });
            }

            const grantChannel = await fetchChannel(bot, bot.CONFIG.GRANT_COMMAND_CHANNEL);
            if (grantChannel) {
                await grantChannel.send(`rgrant ${user.tag} ${rank} Demoted`);
            }

            const embed = new EmbedBuilder()
                .setTitle("✅ User Demoted")
                .setDescription(MSG.DEMOTE_SUCCESS(user, rank))
                .setColor(0xffa500);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

    } catch (error) {
        console.error('Error demoting user:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleClearCommand(interaction, options, bot) {
    const amount = options.getInteger('amount');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (amount < 0 || amount > 100) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Invalid Amount")
            .setDescription("Enter a number between 1–100, or 0 to clear everything.")
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        if (amount === 0) {
            let deleted;
            do {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                if (messages.size === 0) break;
                deleted = await interaction.channel.bulkDelete(messages, true);
            } while (deleted.size >= 2);
        } else {
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            await interaction.channel.bulkDelete(messages, true);
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ Messages Cleared")
            .setDescription(MSG.CLEAR_SUCCESS)
            .setColor(0x00ff00);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error clearing messages:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleReportCommand(interaction, options, bot) {
    const user = options.getUser('user');
    const proof = options.getString('proof');

    bot.db.get("SELECT * FROM report_bans WHERE user_id = ?", [interaction.user.id], async (err, ban) => {
        if (err) {
            console.error('Error checking report bans:', err);
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (ban) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Report Banned")
                .setDescription(MSG.REPORT_BANNED)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (user.id === interaction.user.id) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Invalid Report")
                .setDescription("You can't report yourself.")
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (user.bot) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Invalid Report")
                .setDescription("You can't report bots.")
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const reportChannel = await fetchChannel(bot, bot.CONFIG.REPORT_CHANNEL);
        if (!reportChannel) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription("Report channel not found.")
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle("🚨 User Report")
            .setColor(0xff0000)
            .setTimestamp()
            .addFields(
                { name: "Reported User", value: `${user} (${user.tag})`, inline: true },
                { name: "Reported By", value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                { name: "Proof", value: proof, inline: false }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `User ID: ${user.id}` });

        const cancelButton = new ButtonBuilder()
            .setCustomId(`report_cancel_${user.id}_${interaction.user.id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Primary);

        const banButton = new ButtonBuilder()
            .setCustomId(`report_ban_${user.id}_${interaction.user.id}`)
            .setLabel('Ban (30 days)')
            .setStyle(ButtonStyle.Danger);

        const muteButton = new ButtonBuilder()
            .setCustomId(`report_mute_${user.id}_${interaction.user.id}`)
            .setLabel('Mute (14 days)')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(cancelButton, muteButton, banButton);

        await reportChannel.send({ embeds: [embed], components: [row] });

        const successEmbed = new EmbedBuilder()
            .setTitle("✅ Report Submitted")
            .setDescription(`Your report against ${user.tag} has been submitted to the staff team.`)
            .setColor(0x00ff00);
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    });
}

async function handleReportBan(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_STAFF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const user = options.getUser('user');

    bot.db.get("SELECT * FROM report_bans WHERE user_id = ?", [user.id], async (err, existingBan) => {
        if (err) {
            console.error('Error checking report bans:', err);
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (existingBan) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Already Banned")
                .setDescription("That user is already report-banned.")
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        bot.db.run("INSERT INTO report_bans (user_id, banned_by) VALUES (?, ?)", [user.id, interaction.user.id], async (err) => {
            if (err) {
                console.error('Error banning user from reports:', err);
                const embed = new EmbedBuilder()
                    .setTitle("❌ Error")
                    .setDescription(MSG.GENERIC_DB_ERROR)
                    .setColor(0xff0000);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("✅ Report Ban Added")
                .setDescription(MSG.REPORT_BAN_SUCCESS(user))
                .setColor(0x00ff00);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        });
    });
}

async function handleReportUnban(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_STAFF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const user = options.getUser('user');

    bot.db.get("SELECT * FROM report_bans WHERE user_id = ?", [user.id], async (err, existingBan) => {
        if (err) {
            console.error('Error checking report bans:', err);
            const embed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (!existingBan) {
            const embed = new EmbedBuilder()
                .setTitle("❌ Not Banned")
                .setDescription("That user doesn't have a report ban.")
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        bot.db.run("DELETE FROM report_bans WHERE user_id = ?", [user.id], async (err) => {
            if (err) {
                console.error('Error unbanning user from reports:', err);
                const embed = new EmbedBuilder()
                    .setTitle("❌ Error")
                    .setDescription(MSG.GENERIC_DB_ERROR)
                    .setColor(0xff0000);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("✅ Report Ban Removed")
                .setDescription(MSG.REPORT_UNBAN_SUCCESS(user))
                .setColor(0x00ff00);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        });
    });
}

async function handleProofCommand(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_STAFF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const messageId = options.getString('message_id');
    const proofUrl = options.getString('proof_url');

    const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (!logChannel) {
        await interaction.reply({ content: MSG.GENERIC_ERROR, ephemeral: true });
        return;
    }

    try {
        const message = await logChannel.messages.fetch(messageId);
        const embed = message.embeds[0];

        if (!embed) {
            await interaction.reply({ content: "No embed found for that message ID.", ephemeral: true });
            return;
        }

        const newEmbed = EmbedBuilder.from(embed)
            .addFields({ name: "Proof", value: proofUrl, inline: true });

        await message.edit({ embeds: [newEmbed] });
        await interaction.reply({ content: "Proof added.", ephemeral: true });
    } catch (error) {
        console.error('Error adding proof:', error);
        await interaction.reply({ content: "Couldn't find that message. Double-check the message ID.", ephemeral: true });
    }
}

// Lock Command
async function handleLockCommand(interaction, bot) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const channel = interaction.channel;

    try {
        // Store current permissions
        const currentPermissions = channel.permissionOverwrites.cache.map(overwrite => ({
            id: overwrite.id,
            allow: overwrite.allow.bitfield,
            deny: overwrite.deny.bitfield,
            type: overwrite.type
        }));

        channelPermissions.set(channel.id, currentPermissions);

        // Lock channel for everyone
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: false,
            AddReactions: false
        });

        const embed = new EmbedBuilder()
            .setTitle("🔒 Channel Locked")
            .setDescription("This channel is now locked. Only staff can send messages.")
            .setColor(0xffa500)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Log the lock action
        const logChannel = await fetchChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("🔒 Channel Locked")
                .setColor(0xffa500)
                .setTimestamp()
                .addFields(
                    { name: "Channel", value: `${channel} (${channel.name})`, inline: true },
                    { name: "Locked by", value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                    { name: "Channel ID", value: channel.id, inline: true }
                );

            await logChannel.send({ embeds: [logEmbed] });
        }

    } catch (error) {
        console.error('Error locking channel:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

// Unlock Command
async function handleUnlockCommand(interaction, bot) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const channel = interaction.channel;

    try {
        const savedPermissions = channelPermissions.get(channel.id);

        if (!savedPermissions) {
            const embed = new EmbedBuilder()
                .setTitle("❌ No Saved Permissions")
                .setDescription("No previous permissions found for this channel. You may need to set permissions manually.")
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // Restore saved permissions
        for (const perm of savedPermissions) {
            try {
                const target = perm.type === 0 ? 
                    interaction.guild.roles.cache.get(perm.id) : 
                    interaction.guild.members.cache.get(perm.id);
                
                if (target) {
                    await channel.permissionOverwrites.edit(target, {
                        SendMessages: null,
                        AddReactions: null
                    });
                }
            } catch (error) {
                console.error(`Error restoring permissions for ${perm.id}:`, error);
            }
        }

        // Clear saved permissions
        channelPermissions.delete(channel.id);

        const embed = new EmbedBuilder()
            .setTitle("🔓 Channel Unlocked")
            .setDescription("Channel is unlocked. Previous permissions restored.")
            .setColor(0x00ff00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Log the unlock action
        const logChannel = await fetchChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("🔓 Channel Unlocked")
                .setColor(0x00ff00)
                .setTimestamp()
                .addFields(
                    { name: "Channel", value: `${channel} (${channel.name})`, inline: true },
                    { name: "Unlocked by", value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                    { name: "Channel ID", value: channel.id, inline: true }
                );

            await logChannel.send({ embeds: [logEmbed] });
        }

    } catch (error) {
        console.error('Error unlocking channel:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleSlowdownCommand(interaction, options, bot) {
    const seconds = options.getInteger('seconds');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('Error setting channel cooldown:', error);
        const embed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

async function handleMassRole(interaction, options, bot) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const action = options.getString('action');
    const role = options.getRole('role');
    const includeBots = options.getBoolean('include_bots') ?? false;

    if (role.managed || role.id === interaction.guild.id) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Invalid Role")
            .setDescription("This role cannot be assigned (managed/integration role or @everyone).")
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Role Too High")
            .setDescription("That role is higher than or equal to my highest role. I cannot manage it.")
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.reply({ embeds: [
        new EmbedBuilder()
            .setTitle("⏳ Mass Role in Progress")
            .setDescription(`${action === 'add' ? 'Adding' : 'Removing'} ${role} ${includeBots ? 'for all members (including bots)' : 'for all human members'}...\nThis may take a while.`)
            .setColor(0xffa500)
    ], flags: MessageFlags.Ephemeral });

    try {
        const members = await interaction.guild.members.fetch();
        const targets = members.filter(m => includeBots ? true : !m.user.bot);

        let success = 0;
        let failed = 0;

        for (const [, member] of targets) {
            try {
                if (action === 'add') {
                    if (!member.roles.cache.has(role.id)) await member.roles.add(role);
                } else {
                    if (member.roles.cache.has(role.id)) await member.roles.remove(role);
                }
                success++;
            } catch {
                failed++;
            }
        }

        await interaction.editReply({ embeds: [
            new EmbedBuilder()
                .setTitle("✅ Mass Role Complete")
                .setDescription(`**Action:** ${action === 'add' ? 'Added' : 'Removed'} ${role}\n**Success:** ${success}\n**Failed:** ${failed}`)
                .setColor(0x00ff00)
        ] });

    } catch (error) {
        console.error('Error in mass role:', error);
        await interaction.editReply({ embeds: [
            new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription(MSG.GENERIC_ERROR)
                .setColor(0xff0000)
        ] });
    }
}

async function handleEmbedCommand(interaction, options, bot) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const title = options.getString('title');
    const text = options.getString('text');
    const colorInput = options.getString('color');
    const thumbnail = options.getString('thumbnail');
    const image = options.getString('image');
    const footer = options.getString('footer');
    const targetChannel = options.getChannel('channel') ?? interaction.channel;

    let color = 0x5865F2;
    if (colorInput) {
        const hex = colorInput.replace('#', '');
        const parsed = parseInt(hex, 16);
        if (!isNaN(parsed)) color = parsed;
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(text)
        .setColor(color);

    if (thumbnail) {
        try { embed.setThumbnail(thumbnail); } catch {}
    }
    if (image) {
        try { embed.setImage(image); } catch {}
    }
    if (footer) {
        embed.setFooter({ text: footer });
    }

    try {
        await targetChannel.send({ embeds: [embed] });
        await interaction.reply({ embeds: [
            new EmbedBuilder()
                .setTitle("✅ Embed Sent")
                .setDescription(`Embed was sent to ${targetChannel}.`)
                .setColor(0x00ff00)
        ], flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('Error sending embed:', error);
        await interaction.reply({ embeds: [
            new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription("Could not send the embed. Check that I have permission to send messages in the target channel.")
                .setColor(0xff0000)
        ], flags: MessageFlags.Ephemeral });
    }
}