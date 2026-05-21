const { Collection, PermissionsBitField, EmbedBuilder, ApplicationCommandOptionType, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { createTicket, closeTicketChannel } = require('./ticketFunctions');
const { MinecraftServerListPing } = require('minecraft-status');
const ms = require('ms');
const MSG = require('../config/messages');


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
                                required: false,
                                max_length: 512
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
                                required: false,
                                max_length: 1024
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
                                required: false,
                                max_length: 512
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
                                required: false,
                                max_length: 512
                            },
                            {
                                name: 'proof',
                                type: ApplicationCommandOptionType.String,
                                description: 'Proof URL (optional)',
                                required: false,
                                max_length: 1024
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
                                required: false,
                                max_length: 512
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
                                required: false,
                                max_length: 1024
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
                                required: false,
                                max_length: 512
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
            name: 'user',
            type: ApplicationCommandOptionType.User,
            description: 'The Discord user to promote',
            required: true
        },
        {
            name: 'rank',
            type: ApplicationCommandOptionType.String,
            description: 'The rank to promote to',
            required: true,
            choices: [
                { name: 'Creator',       value: 'Creator' },
                { name: 'Media',         value: 'Media' },
                { name: 'Famous',        value: 'Famous' },
                { name: 'Partner',       value: 'Partner' },
                { name: 'Builder',       value: 'Builder' },
                { name: 'Helper',        value: 'Helper' },
                { name: 'Moderator',     value: 'Mod' },
                { name: 'Sr. Moderator', value: 'SrMod' },
                { name: 'Admin',         value: 'Admin' },
                { name: 'Developer',     value: 'Developer' },
                { name: 'Beta-Tester',   value: 'Beta-Tester' }
            ]
        }
    ]
},
            {
                name: 'demote',
                description: 'Demote a user to a specific rank or to member',
                options: [
                    {
                        name: 'user',
                        type: ApplicationCommandOptionType.User,
                        description: 'The Discord user to demote',
                        required: true
                    },
                    {
                        name: 'rank',
                        type: ApplicationCommandOptionType.String,
                        description: 'The rank to demote to (optional, defaults to Member)',
                        required: false,
                        choices: [
                            { name: 'Creator',       value: 'Creator' },
                            { name: 'Media',         value: 'Media' },
                            { name: 'Famous',        value: 'Famous' },
                            { name: 'Partner',       value: 'Partner' },
                            { name: 'Builder',       value: 'Builder' },
                            { name: 'Helper',        value: 'Helper' },
                            { name: 'Moderator',     value: 'Mod' },
                            { name: 'Sr. Moderator', value: 'SrMod' },
                            { name: 'Admin',         value: 'Admin' },
                            { name: 'Developer',     value: 'Developer' },
                            { name: 'Beta-Tester',   value: 'Beta-Tester' }
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
                        required: true,
                        min_value: 0,
                        max_value: 100
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
                description: 'Unlock the channel (resets @everyone SendMessages/AddReactions to inherited)'
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
                name: 'hoster',
                description: 'Show hosting information'
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
            case 'massrole':
                await handleMassRole(interaction, options, bot);
                break;
            case 'embed':
                await handleEmbedCommand(interaction, options, bot);
                break;
            case 'hoster':
                await handleHosterCommand(interaction);
                break;
            default:
                console.warn(`[handleCommand] Unhandled slash command: ${commandName}`);
                await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
        default:
            console.warn(`[handleTicketsCommand] Unhandled subcommand: ${subcommand}`);
            await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}

async function handleCloseRequest(interaction, channel, bot) {
    if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_STAFF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    bot.db.get("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'", [channel.id], async (err, ticket) => {
        if (err || !ticket) {
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.TICKET_NOT_FOUND)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

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

        let ticketCreator = null;
        try {
            ticketCreator = await bot.client.users.fetch(ticket.user_id);
        } catch (e) {
            console.error('[handleCloseRequest] could not fetch ticket creator:', e.message);
        }
        await channel.send({ content: ticketCreator ? `${ticketCreator}` : '', embeds: [embed], components: [row] });

        const successEmbed = new EmbedBuilder()
            .setTitle("Close Request Sent")
            .setDescription(MSG.TICKET_CLOSE_REQUEST_SENT(channel))
            .setColor(0x00ff00);
        await interaction.editReply({ embeds: [successEmbed] });
    });
}

async function handleTicketCloseCommand(interaction, channel, bot) {
    if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
        await interaction.reply({ content: MSG.NO_PERMISSION_STAFF, flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    bot.db.get("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'", [channel.id], async (err, ticket) => {
        if (err) {
            await interaction.editReply({ content: MSG.GENERIC_ERROR });
            return;
        }

        if (!ticket) {
            await interaction.editReply({ content: MSG.TICKET_NOT_FOUND });
            return;
        }

        const categoryConfig = bot.CONFIG.CATEGORY_PERMISSIONS[ticket.category];
        const isStaff = categoryConfig
            ? interaction.member.roles.cache.some(r => categoryConfig.staff_roles.includes(r.id))
            : interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE);

        if (!isStaff) {
            await interaction.editReply({ content: MSG.NO_PERMISSION_STAFF });
            return;
        }

        try {
            await closeTicketChannel(channel, interaction.user, bot);
            // When the command is run inside the ticket itself, the channel
            // (and the ephemeral reply that lived in it) is now gone, so
            // editing the reply 404s — that's expected, not an error.
            await interaction.editReply({ content: MSG.TICKET_CLOSED(channel) }).catch(() => {});
        } catch (error) {
            console.error('Error closing ticket:', error);
            await interaction.editReply({ content: MSG.GENERIC_ERROR }).catch(() => {});
        }
    });
}

async function handleTicketAdd(interaction, options, bot) {
    const user = options.getUser('user');

    if (!interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    bot.db.get("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'", [interaction.channel.id], async (err, ticket) => {
        if (err || !ticket) {
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.TICKET_NOT_FOUND)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        try {
            await interaction.channel.permissionOverwrites.create(user, {
                ViewChannel: true,
                SendMessages: true
            });
        } catch (error) {
            console.error('Error adding user to ticket:', error);
            const errEmbed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.BOT_NO_PERMISSION)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [errEmbed] });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("User Added")
            .setDescription(MSG.TICKET_ADD_SUCCESS(user))
            .setColor(0x00ff00);
        await interaction.editReply({ embeds: [embed] });
    });
}

async function handleTicketRemove(interaction, options, bot) {
    const user = options.getUser('user');

    if (!interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    bot.db.get("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'", [interaction.channel.id], async (err, ticket) => {
        if (err || !ticket) {
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.TICKET_NOT_FOUND)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        try {
            await interaction.channel.permissionOverwrites.delete(user);
        } catch (error) {
            console.error('Error removing user from ticket:', error);
            const errEmbed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.BOT_NO_PERMISSION)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [errEmbed] });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("User Removed")
            .setDescription(MSG.TICKET_REMOVE_SUCCESS(user))
            .setColor(0x00ff00);
        await interaction.editReply({ embeds: [embed] });
    });
}

async function handleTicketBan(interaction, options, bot) {
    const user = options.getUser('user');

    if (!interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    bot.db.get("SELECT * FROM ticket_bans WHERE user_id = ?", [user.id], async (err, existingBan) => {
        if (err) {
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (existingBan) {
            const embed = new EmbedBuilder()
                .setTitle("Already Banned")
                .setDescription(MSG.TICKET_ALREADY_BANNED)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        bot.db.run("INSERT INTO ticket_bans (user_id, banned_by) VALUES (?, ?)", [user.id, interaction.user.id], async (err) => {
            if (err) {
                const embed = new EmbedBuilder()
                    .setTitle("Error")
                    .setDescription(MSG.GENERIC_DB_ERROR)
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("User Banned")
                .setDescription(MSG.TICKET_BAN_SUCCESS(user))
                .setColor(0x00ff00);
            await interaction.editReply({ embeds: [embed] });
        });
    });
}

async function handleTicketUnban(interaction, options, bot) {
    const user = options.getUser('user');

    if (!interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    bot.db.get("SELECT * FROM ticket_bans WHERE user_id = ?", [user.id], async (err, existingBan) => {
        if (err) {
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (!existingBan) {
            const embed = new EmbedBuilder()
                .setTitle("Not Banned")
                .setDescription(MSG.TICKET_NOT_BANNED)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        bot.db.run("DELETE FROM ticket_bans WHERE user_id = ?", [user.id], async (err) => {
            if (err) {
                const embed = new EmbedBuilder()
                    .setTitle("Error")
                    .setDescription(MSG.GENERIC_DB_ERROR)
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("User Unbanned")
                .setDescription(MSG.TICKET_UNBAN_SUCCESS(user))
                .setColor(0x00ff00);
            await interaction.editReply({ embeds: [embed] });
        });
    });
}

async function handleStatusCommand(interaction, bot) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const status = await MinecraftServerListPing.ping(4, bot.CONFIG.MINECRAFT_SERVER, bot.CONFIG.MINECRAFT_PORT, 5000);

        const embed = new EmbedBuilder()
            .setTitle(`${bot.CONFIG.MINECRAFT_SERVER} — Online`)
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
            if (motd) embed.setDescription(`**MOTD:** ${motd}`);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error fetching Minecraft status:', error);
        const embed = new EmbedBuilder()
            .setTitle(`${bot.CONFIG.MINECRAFT_SERVER} — Offline`)
            .setDescription("The server could not be reached. It may be offline or starting up.")
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
    }
}

function cleanMinecraftText(text) {
    if (!text) return "No MOTD";
    return text.replace(/§./g, '');
}

async function handleAboutCommand(interaction, bot) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const query = (sql) => new Promise((resolve, reject) =>
        bot.db.get(sql, (err, row) => err ? reject(err) : resolve(row))
    );

    try {
        const [openTickets, totalTickets, activePunishments, totalPunishments] = await Promise.all([
            query("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'"),
            query("SELECT COUNT(*) as count FROM tickets"),
            query("SELECT COUNT(*) as count FROM punishments WHERE active = TRUE"),
            query("SELECT COUNT(*) as count FROM punishments"),
        ]);

        const uptime = Date.now() - bot.startTime.getTime();
        const d = Math.floor(uptime / 86400000);
        const h = Math.floor((uptime % 86400000) / 3600000);
        const m = Math.floor((uptime % 3600000) / 60000);
        const s = Math.floor((uptime % 60000) / 1000);
        const uptimeStr = `${d}d ${h}h ${m}m ${s}s`;

        const embed = new EmbedBuilder()
            .setTitle("Bot Statistics")
            .setColor(0x0000ff)
            .setTimestamp()
            .addFields(
                { name: "Open Tickets",        value: openTickets.count.toString(),        inline: true },
                { name: "Total Tickets",        value: totalTickets.count.toString(),       inline: true },
                { name: "Active Punishments",   value: activePunishments.count.toString(),  inline: true },
                { name: "Total Punishments",    value: totalPunishments.count.toString(),   inline: true },
                { name: "Uptime",               value: uptimeStr,                           inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('Error fetching bot statistics:', err);
        await interaction.editReply({ content: MSG.GENERIC_DB_ERROR });
    }
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
        default:
            console.warn(`[handleModerateCommand] Unhandled subcommand: ${subcommand}`);
            await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_BAN)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.id === interaction.user.id) {
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.CANNOT_BAN_SELF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.bot) {
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.CANNOT_BAN_BOT)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Prevent acting on members who outrank the executor
        try {
            const targetMember = await interaction.guild.members.fetch(user.id);
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                const embed = new EmbedBuilder()
                    .setTitle("Permission Denied")
                    .setDescription("You cannot ban a member with an equal or higher role than yours.")
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }
        } catch { /* user not in guild — ban proceeds */ }

        let expiresAt = null;
        let durationText = duration;

        if (duration !== 'permanent') {
            const durationMs = ms(duration);
            if (!durationMs) {
                const embed = new EmbedBuilder()
                    .setTitle("Invalid Duration")
                    .setDescription("Invalid duration format. Use formats like `10m`, `2h`, `7d`, or `permanent`.")
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            expiresAt = new Date(Date.now() + durationMs);
            durationText = `until <t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;
        }

        const banOptions = { reason: `${reason} | By: ${interaction.user.username} | Duration: ${duration}` };
        if (delmessages) {
            banOptions.deleteMessageSeconds = 7 * 24 * 60 * 60; // 7 days in seconds
        }

        await interaction.guild.members.ban(user, banOptions);

        try {
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
            await user.send({ embeds: [dmEmbed] });
            console.log(`DM sent to ${user.username} about ban`);
        } catch (error) {
            console.log(`Could not send DM to ${user.username}, they might have DMs disabled`);
        }

        bot.db.run(
            "INSERT INTO punishments (user_id, type, reason, duration, punished_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            [user.id, "ban", reason, duration, interaction.user.id, expiresAt?.toISOString()],
            (err) => { if (err) console.error('[handleBan] DB insert error:', err); }
        );

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.BAN_LOG_TITLE)
                .setColor(0xff0000)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: 'User',            value: `${user} (${user.username})\n\`${user.id}\``,                                   inline: true },
                    { name: 'Moderator',      value: `${interaction.user} (${interaction.user.username})`,                           inline: true },
                    { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,                       inline: true },
                    { name: 'Reason',          value: reason,                                                                    inline: false },
                    { name: 'Duration',        value: durationText,                                                              inline: true },
                    { name: 'Messages Cleared', value: delmessages ? 'Yes (last 7 days)' : 'No',                                 inline: true }
                );

            if (proof) {
                const proofTrunc = proof.length > 1024 ? proof.slice(0, 1021) + '...' : proof;
                logEmbed.addFields({ name: 'Proof', value: proofTrunc, inline: false });
            }

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("User Banned")
            .setDescription(MSG.BAN_SUCCESS_BODY(user, reason, durationText, delmessages))
            .setColor(0x00ff00);

        if (proof) {
            const proofTrunc = proof.length > 1024 ? proof.slice(0, 1021) + '...' : proof;
            embed.addFields({ name: "Proof", value: proofTrunc, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error banning user:', error);
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.BOT_NO_PERMISSION)
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleUnban(interaction, options, bot) {
    const userId = options.getString('user_id');
    const reason = options.getString('reason') || 'No reason provided';

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_BAN)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Unban first — the user's account may be deleted, which would make
        // client.users.fetch() fail with 10013 and prevent the unban entirely
        // if we fetched first. Do the Discord action, then optionally enrich
        // the log/DM with user details if the account still exists.
        await interaction.guild.members.unban(userId, `${reason} | By: ${interaction.user.username}`);

        bot.db.run(
            "UPDATE punishments SET active = FALSE WHERE user_id = ? AND type = 'ban' AND active = TRUE",
            [userId],
            (err) => { if (err) console.error('[handleUnban] DB update error:', err); }
        );

        // Try to resolve the user object for richer log/DM output; gracefully
        // degrade if the account was deleted or is otherwise unfetchable.
        let user = null;
        try {
            user = await bot.client.users.fetch(userId);
        } catch {
            console.log(`[handleUnban] Could not fetch user ${userId} (account may be deleted)`);
        }

        if (user) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle(MSG.UNBAN_DM_TITLE)
                    .setColor(0x00ff00)
                    .setDescription(MSG.UNBAN_DM_BODY(interaction.guild.name))
                    .addFields(
                        { name: "Reason", value: reason, inline: true },
                        { name: "Moderator", value: interaction.user.displayName, inline: true }
                    )
                    .setTimestamp();
                await user.send({ embeds: [dmEmbed] });
                console.log(`DM sent to ${user.username} about unban`);
            } catch {
                console.log(`Could not send DM to ${userId}, they might have DMs disabled`);
            }
        }

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.UNBAN_LOG_TITLE)
                .setColor(0x00cc44)
                .setTimestamp()
                .addFields(
                    { name: 'User',       value: user ? `${user.username}\n\`${userId}\`` : `\`${userId}\``,                  inline: true },
                    { name: 'Moderator', value: `${interaction.user} (${interaction.user.username})`,                          inline: true },
                    { name: 'Reason',     value: reason,                                                                   inline: false }
                );
            if (user) {
                logEmbed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
                logEmbed.addFields({ name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true });
            }
            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("User Unbanned")
            .setDescription(MSG.UNBAN_SUCCESS_BODY(user?.username ?? userId, reason))
            .setColor(0x00ff00);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error unbanning user:', error);
        // 10026 = Unknown Ban (user was not banned); show the "not found" message
        // for that specific case and a generic error for everything else.
        const description = error.code === 10026 ? MSG.UNBAN_INVALID_USER : MSG.BOT_NO_PERMISSION;
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(description)
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleKick(interaction, options, bot) {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';
    const proof = options.getString('proof');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_KICK)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.id === interaction.user.id) {
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.CANNOT_KICK_SELF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.bot) {
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.CANNOT_KICK_BOT)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let kickMember;
    try {
        kickMember = await interaction.guild.members.fetch(user.id);
    } catch {
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription("That user is not in this server.")
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    try {
        const member = kickMember;

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setTitle("Permission Denied")
                .setDescription("You cannot kick a member with an equal or higher role than yours.")
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        await member.kick(`${reason} | By: ${interaction.user.username}`);

        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle(MSG.KICK_DM_TITLE)
                .setColor(0xffa500)
                .setDescription(MSG.KICK_DM_BODY(interaction.guild.name))
                .addFields(
                    { name: "Reason", value: reason, inline: true },
                    { name: "Moderator", value: interaction.user.displayName, inline: true }
                )
                .setTimestamp();
            await user.send({ embeds: [dmEmbed] });
            console.log(`DM sent to ${user.username} about kick`);
        } catch (error) {
            console.log(`Could not send DM to ${user.username}, they might have DMs disabled`);
        }


        bot.db.run(
            "INSERT INTO punishments (user_id, type, reason, duration, punished_by) VALUES (?, ?, ?, ?, ?)",
            [user.id, "kick", reason, null, interaction.user.id],
            (err) => { if (err) console.error('[handleKick] DB insert error:', err); }
        );

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.KICK_LOG_TITLE)
                .setColor(0xff8c00)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: 'User',            value: `${user} (${user.username})\n\`${user.id}\``,                                   inline: true },
                    { name: 'Moderator',      value: `${interaction.user} (${interaction.user.username})`,                           inline: true },
                    { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,                       inline: true },
                    { name: 'Reason',          value: reason,                                                                    inline: false }
                );

            if (proof) {
                const proofTrunc = proof.length > 1024 ? proof.slice(0, 1021) + '...' : proof;
                logEmbed.addFields({ name: 'Proof', value: proofTrunc, inline: false });
            }

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("User Kicked")
            .setDescription(MSG.KICK_SUCCESS_BODY(user, reason))
            .setColor(0x00ff00);

        if (proof) {
            const proofTrunc = proof.length > 1024 ? proof.slice(0, 1021) + '...' : proof;
            embed.addFields({ name: "Proof", value: proofTrunc, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error kicking user:', error);
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.BOT_NO_PERMISSION)
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleMute(interaction, options, bot) {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';
    const duration = options.getString('duration') || '1h';
    const proof = options.getString('proof');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MUTE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.id === interaction.user.id) {
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.CANNOT_MUTE_SELF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.bot) {
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.CANNOT_MUTE_BOT)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const member = await interaction.guild.members.fetch(user.id);

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setTitle("Permission Denied")
                .setDescription("You cannot mute a member with an equal or higher role than yours.")
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        let timeoutDuration = null;
        let durationText = duration;

        const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

        if (duration !== 'permanent') {
            const durationMs = ms(duration);
            if (!durationMs) {
                const embed = new EmbedBuilder()
                    .setTitle("Invalid Duration")
                    .setDescription("Invalid duration format. Use formats like `10m`, `2h`, `7d`, or `permanent`.")
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            if (durationMs > MAX_TIMEOUT_MS) {
                const embed = new EmbedBuilder()
                    .setTitle("Duration Too Long")
                    .setDescription("Discord timeout duration cannot exceed 28 days. Use `permanent` for the maximum (28-day) timeout.")
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            timeoutDuration = durationMs;
            const timeoutUntil = new Date(Date.now() + durationMs);
            durationText = `until <t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`;
        } else {
            timeoutDuration = MAX_TIMEOUT_MS;
            durationText = 'permanent (28 days maximum)';
        }

        await member.timeout(timeoutDuration, `${reason} | By: ${interaction.user.username}`);

        try {
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
            await user.send({ embeds: [dmEmbed] });
            console.log(`DM sent to ${user.username} about mute`);
        } catch (error) {
            console.log(`Could not send DM to ${user.username}, they might have DMs disabled`);
        }

        let expiresAt = null;
        if (timeoutDuration) {
            expiresAt = new Date(Date.now() + timeoutDuration).toISOString();
        }

        bot.db.run(
            "INSERT INTO punishments (user_id, type, reason, duration, punished_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            [user.id, "mute", reason, duration, interaction.user.id, expiresAt],
            (err) => { if (err) console.error('[handleMute] DB insert error:', err); }
        );

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.MUTE_LOG_TITLE)
                .setColor(0x808080)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: 'User',            value: `${user} (${user.username})\n\`${user.id}\``,                                   inline: true },
                    { name: 'Moderator',      value: `${interaction.user} (${interaction.user.username})`,                           inline: true },
                    { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,                       inline: true },
                    { name: 'Reason',          value: reason,                                                                    inline: false },
                    { name: 'Duration',        value: durationText,                                                              inline: true }
                );

            if (proof) {
                const proofTrunc = proof.length > 1024 ? proof.slice(0, 1021) + '...' : proof;
                logEmbed.addFields({ name: 'Proof', value: proofTrunc, inline: false });
            }

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("User Muted")
            .setDescription(MSG.MUTE_SUCCESS_BODY(user, reason, durationText))
            .setColor(0x00ff00);

        if (proof) {
            const proofTrunc = proof.length > 1024 ? proof.slice(0, 1021) + '...' : proof;
            embed.addFields({ name: "Proof", value: proofTrunc, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error muting user:', error);
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.BOT_NO_PERMISSION)
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleUnmute(interaction, options, bot) {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MUTE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let unmuteMember;
    try {
        unmuteMember = await interaction.guild.members.fetch(user.id);
    } catch {
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription("That user is not in this server.")
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    try {
        const member = unmuteMember;

        if (!member.isCommunicationDisabled()) {
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.NOT_MUTED)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        await member.timeout(null, `${reason} | By: ${interaction.user.username}`);

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

        bot.db.run(
            "UPDATE punishments SET active = FALSE WHERE user_id = ? AND type = 'mute' AND active = TRUE",
            [user.id],
            (err) => { if (err) console.error('[handleUnmute] DB update error:', err); }
        );

        const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(MSG.UNMUTE_LOG_TITLE)
                .setColor(0x00cc44)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: 'User',            value: `${user} (${user.username})\n\`${user.id}\``,                                   inline: true },
                    { name: 'Moderator',      value: `${interaction.user} (${interaction.user.username})`,                           inline: true },
                    { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,                       inline: true },
                    { name: 'Reason',          value: reason,                                                                    inline: false }
                );

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("User Unmuted")
            .setDescription(MSG.UNMUTE_SUCCESS_BODY(user))
            .setColor(0x00ff00);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error unmuting user:', error);
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.BOT_NO_PERMISSION)
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handlePromote(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = options.getUser('user');
    const rank = options.getString('rank');

    try {
        const member = await interaction.guild.members.fetch(user.id);

        // Validate target role exists before touching the member's current roles
        const newRoleId = bot.RANK_ROLES[rank];
        if (!newRoleId) {
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(`Role for rank "${rank}" not found.`)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const newRole = interaction.guild.roles.cache.get(newRoleId);
        if (!newRole) {
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(`Role with ID ${newRoleId} not found in guild.`)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // Remove all current rank roles + staff role in one API call
        const allRankRoles = Object.values(bot.RANK_ROLES);
        const rolesToRemove = allRankRoles.filter(roleId => member.roles.cache.has(roleId));
        if (member.roles.cache.has(bot.STAFF_ROLE)) rolesToRemove.push(bot.STAFF_ROLE);
        if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);

        // Build the full set of roles to add, then apply in one API call
        const rolesToAdd = [newRole];
        if (bot.ROLE_HIERARCHY[rank]) {
            for (const additionalRank of bot.ROLE_HIERARCHY[rank]) {
                if (additionalRank !== rank) {
                    const additionalRoleId = bot.RANK_ROLES[additionalRank];
                    if (additionalRoleId) {
                        const additionalRole = interaction.guild.roles.cache.get(additionalRoleId);
                        if (additionalRole) rolesToAdd.push(additionalRole);
                    }
                }
            }
        }
        if (bot.STAFF_RANKS.includes(rank)) {
            const staffRole = interaction.guild.roles.cache.get(bot.STAFF_ROLE);
            if (staffRole) rolesToAdd.push(staffRole);
        }
        await member.roles.add(rolesToAdd);

        const logChannel = await fetchChannel(bot, bot.CONFIG.PROMOTION_LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("Promotion")
                .setColor(0x00ff00)
                .setDescription(MSG.PROMOTE_LOG_DESCRIPTION(user, rank))
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp()
                .setFooter({ text: MSG.PROMOTE_LOG_FOOTER });

            await logChannel.send({ embeds: [logEmbed] });
        }

        const embed = new EmbedBuilder()
            .setTitle("User Promoted")
            .setDescription(MSG.PROMOTE_SUCCESS(user, rank))
            .setColor(0x00ff00);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error promoting user:', error);
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleDemote(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = options.getUser('user');
    const rank = options.getString('rank');

    try {
        const member = await interaction.guild.members.fetch(user.id);

        if (!rank) {
            const allRankRoles = Object.values(bot.RANK_ROLES);
            const rolesToRemove = allRankRoles.filter(roleId => member.roles.cache.has(roleId));
            if (member.roles.cache.has(bot.STAFF_ROLE)) rolesToRemove.push(bot.STAFF_ROLE);
            if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);

            const joinRole = interaction.guild.roles.cache.get(bot.CONFIG.JOIN_ROLE);
            if (joinRole && !member.roles.cache.has(bot.CONFIG.JOIN_ROLE)) {
                await member.roles.add(joinRole);
            }

            const logChannel = await fetchChannel(bot, bot.CONFIG.PROMOTION_LOG_CHANNEL);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("Demotion")
                    .setColor(0xffa500)
                    .setDescription(MSG.DEMOTE_LOG_DESCRIPTION(user, 'Member'))
                    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTimestamp()
                    .setFooter({ text: MSG.DEMOTE_LOG_FOOTER });

                await logChannel.send({ embeds: [logEmbed] });
            }

            const embed = new EmbedBuilder()
                .setTitle("User Demoted")
                .setDescription(MSG.DEMOTE_SUCCESS(user, 'Member'))
                .setColor(0xffa500);
            await interaction.editReply({ embeds: [embed] });

        } else {
            // Validate target role exists before touching the member's current roles
            const newRoleId = bot.RANK_ROLES[rank];
            if (!newRoleId) {
                const embed = new EmbedBuilder()
                    .setTitle("Error")
                    .setDescription(`Role for rank "${rank}" not found.`)
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const newRole = interaction.guild.roles.cache.get(newRoleId);
            if (!newRole) {
                const embed = new EmbedBuilder()
                    .setTitle("Error")
                    .setDescription(`Role with ID ${newRoleId} not found in guild.`)
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // Ensure the target rank is actually lower than the member's current rank.
            // Without this check, /demote could be used to "demote" someone to a
            // higher-positioned role, effectively promoting them.
            const memberHighestRankPos = Math.max(
                -1,
                ...Object.values(bot.RANK_ROLES)
                    .filter(id => member.roles.cache.has(id))
                    .map(id => interaction.guild.roles.cache.get(id)?.position ?? -1)
            );
            if (memberHighestRankPos >= 0 && newRole.position >= memberHighestRankPos) {
                const embed = new EmbedBuilder()
                    .setTitle("Invalid Demotion")
                    .setDescription(`**${rank}** is not below the user's current rank. Use \`/promote\` to move a user to a higher rank.`)
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const allRankRoles = Object.values(bot.RANK_ROLES);
            const rolesToRemove = allRankRoles.filter(roleId => member.roles.cache.has(roleId));
            if (!bot.STAFF_RANKS.includes(rank) && member.roles.cache.has(bot.STAFF_ROLE)) {
                rolesToRemove.push(bot.STAFF_ROLE);
            }
            if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);

            const rolesToAdd = [newRole];
            if (bot.ROLE_HIERARCHY[rank]) {
                for (const additionalRank of bot.ROLE_HIERARCHY[rank]) {
                    if (additionalRank !== rank) {
                        const additionalRoleId = bot.RANK_ROLES[additionalRank];
                        if (additionalRoleId) {
                            const additionalRole = interaction.guild.roles.cache.get(additionalRoleId);
                            if (additionalRole) rolesToAdd.push(additionalRole);
                        }
                    }
                }
            }
            if (bot.STAFF_RANKS.includes(rank)) {
                const staffRole = interaction.guild.roles.cache.get(bot.STAFF_ROLE);
                if (staffRole) rolesToAdd.push(staffRole);
            }
            await member.roles.add(rolesToAdd);

            const logChannel = await fetchChannel(bot, bot.CONFIG.PROMOTION_LOG_CHANNEL);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("Demotion")
                    .setColor(0xffa500)
                    .setDescription(MSG.DEMOTE_LOG_DESCRIPTION(user, rank))
                    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTimestamp()
                    .setFooter({ text: MSG.DEMOTE_LOG_FOOTER });

                await logChannel.send({ embeds: [logEmbed] });
            }

            const embed = new EmbedBuilder()
                .setTitle("User Demoted")
                .setDescription(MSG.DEMOTE_SUCCESS(user, rank))
                .setColor(0xffa500);
            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error demoting user:', error);
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleClearCommand(interaction, options, bot) {
    const amount = options.getInteger('amount');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    // Bulk-deleting up to 100 messages (or looping for amount=0) can easily take
    // longer than Discord's 3s interaction window, so acknowledge first.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

    try {
        let deletedCount = 0;

        if (amount === 0) {
            for (;;) {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const deletable = messages.filter(m => Date.now() - m.createdTimestamp < TWO_WEEKS_MS);
                if (deletable.size === 0) break;
                const deleted = await interaction.channel.bulkDelete(deletable, true);
                deletedCount += deleted.size;
                if (deleted.size === 0) break;
            }
        } else {
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            const deletable = messages.filter(m => Date.now() - m.createdTimestamp < TWO_WEEKS_MS);
            if (deletable.size > 0) {
                const deleted = await interaction.channel.bulkDelete(deletable, true);
                deletedCount = deleted.size;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("Messages Cleared")
            .setDescription(deletedCount > 0
                ? `Deleted **${deletedCount}** message${deletedCount === 1 ? '' : 's'}.`
                : 'No messages could be deleted (they may all be older than 14 days).')
            .setColor(deletedCount > 0 ? 0x00ff00 : 0xffcc00);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error clearing messages:', error);
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
}

async function handleReportCommand(interaction, options, bot) {
    const user = options.getUser('user');
    const proof = options.getString('proof');

    if (user.id === interaction.user.id) {
        const embed = new EmbedBuilder()
            .setTitle("Invalid Report")
            .setDescription("You can't report yourself.")
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (user.bot) {
        const embed = new EmbedBuilder()
            .setTitle("Invalid Report")
            .setDescription("You can't report bots.")
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    bot.db.get("SELECT * FROM report_bans WHERE user_id = ?", [interaction.user.id], async (err, ban) => {
        if (err) {
            console.error('Error checking report bans:', err);
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (ban) {
            const embed = new EmbedBuilder()
                .setTitle("Report Banned")
                .setDescription(MSG.REPORT_BANNED)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const reportChannel = await fetchChannel(bot, bot.CONFIG.REPORT_CHANNEL);
        if (!reportChannel) {
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription("Report channel not found.")
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // Embed field values are capped at 1024 chars by Discord; an over-long
        // proof would otherwise throw on send and leave the report unanswered.
        const proofValue = proof.length > 1024 ? proof.slice(0, 1021) + '...' : proof;

        const embed = new EmbedBuilder()
            .setTitle("User Report")
            .setColor(0xff0000)
            .setTimestamp()
            .addFields(
                { name: "Reported User", value: `${user} (${user.username})`, inline: true },
                { name: "Reported By", value: `${interaction.user} (${interaction.user.username})`, inline: true },
                { name: "Proof", value: proofValue, inline: false }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `User ID: ${user.id}` });

        const cancelButton = new ButtonBuilder()
            .setCustomId(`report_cancel_${user.id}_${interaction.user.id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const banButton = new ButtonBuilder()
            .setCustomId(`report_ban_${user.id}_${interaction.user.id}`)
            .setLabel('Ban')
            .setStyle(ButtonStyle.Danger);

        const muteButton = new ButtonBuilder()
            .setCustomId(`report_mute_${user.id}_${interaction.user.id}`)
            .setLabel('Mute (14 days)')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(cancelButton, muteButton, banButton);

        try {
            await reportChannel.send({ embeds: [embed], components: [row] });

            const successEmbed = new EmbedBuilder()
                .setTitle("Report Submitted")
                .setDescription(`Your report against ${user.username} has been submitted to the staff team.`)
                .setColor(0x00ff00);
            await interaction.editReply({ embeds: [successEmbed] });
        } catch (error) {
            console.error('Error submitting report:', error);
            const errEmbed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.GENERIC_ERROR)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [errEmbed] }).catch(() => {});
        }
    });
}

async function handleReportBan(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_STAFF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const user = options.getUser('user');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    bot.db.get("SELECT * FROM report_bans WHERE user_id = ?", [user.id], async (err, existingBan) => {
        if (err) {
            console.error('Error checking report bans:', err);
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (existingBan) {
            const embed = new EmbedBuilder()
                .setTitle("Already Banned")
                .setDescription("That user is already report-banned.")
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        bot.db.run("INSERT INTO report_bans (user_id, banned_by) VALUES (?, ?)", [user.id, interaction.user.id], async (err) => {
            if (err) {
                console.error('Error banning user from reports:', err);
                const embed = new EmbedBuilder()
                    .setTitle("Error")
                    .setDescription(MSG.GENERIC_DB_ERROR)
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("Report Ban Added")
                .setDescription(MSG.REPORT_BAN_SUCCESS(user))
                .setColor(0x00ff00);
            await interaction.editReply({ embeds: [embed] });
        });
    });
}

async function handleReportUnban(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_STAFF)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const user = options.getUser('user');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    bot.db.get("SELECT * FROM report_bans WHERE user_id = ?", [user.id], async (err, existingBan) => {
        if (err) {
            console.error('Error checking report bans:', err);
            const embed = new EmbedBuilder()
                .setTitle("Error")
                .setDescription(MSG.GENERIC_DB_ERROR)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (!existingBan) {
            const embed = new EmbedBuilder()
                .setTitle("Not Banned")
                .setDescription("That user doesn't have a report ban.")
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        bot.db.run("DELETE FROM report_bans WHERE user_id = ?", [user.id], async (err) => {
            if (err) {
                console.error('Error unbanning user from reports:', err);
                const embed = new EmbedBuilder()
                    .setTitle("Error")
                    .setDescription(MSG.GENERIC_DB_ERROR)
                    .setColor(0xff0000);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("Report Ban Removed")
                .setDescription(MSG.REPORT_UNBAN_SUCCESS(user))
                .setColor(0x00ff00);
            await interaction.editReply({ embeds: [embed] });
        });
    });
}

async function handleProofCommand(interaction, options, bot) {
    if (!interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const messageId = options.getString('message_id');
    const proofUrl = options.getString('proof_url');

    const logChannel = await fetchChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (!logChannel) {
        await interaction.editReply({ content: MSG.GENERIC_ERROR });
        return;
    }

    try {
        const message = await logChannel.messages.fetch(messageId);
        const embed = message.embeds[0];

        if (!embed) {
            await interaction.editReply({ content: "No embed found for that message ID." });
            return;
        }

        if (embed.fields?.some(f => f.name === 'Proof')) {
            await interaction.editReply({ content: "This log entry already has a proof URL." });
            return;
        }

        const safeProofUrl = proofUrl.length > 1024 ? proofUrl.slice(0, 1021) + '...' : proofUrl;
        const newEmbed = EmbedBuilder.from(embed)
            .addFields({ name: "Proof", value: safeProofUrl, inline: true });

        await message.edit({ embeds: [newEmbed] });
        await interaction.editReply({ content: "Proof added." });
    } catch (error) {
        console.error('Error adding proof:', error);
        await interaction.editReply({ content: "Couldn't find that message. Double-check the message ID." });
    }
}

// Lock Command
async function handleLockCommand(interaction, bot) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const channel = interaction.channel;

    try {
        // Lock channel for everyone
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: false,
            AddReactions: false
        });

        const embed = new EmbedBuilder()
            .setTitle("Channel Locked")
            .setDescription("This channel is now locked. Only staff can send messages.")
            .setColor(0xffa500)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Log the lock action
        const logChannel = await fetchChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("Channel Locked")
                .setColor(0xffa500)
                .setTimestamp()
                .addFields(
                    { name: "Channel", value: `${channel} (${channel.name})`, inline: true },
                    { name: "Locked by", value: `${interaction.user} (${interaction.user.username})`, inline: true },
                    { name: "Channel ID", value: channel.id, inline: true }
                );

            await logChannel.send({ embeds: [logEmbed] });
        }

    } catch (error) {
        console.error('Error locking channel:', error);
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}

// Unlock Command
async function handleUnlockCommand(interaction, bot) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const channel = interaction.channel;

    try {
        // /lock denies SendMessages/AddReactions on @everyone. That's the only
        // thing that actually locks the channel, and if @everyone had no prior
        // overwrite it won't be in savedPermissions — so always neutralize it
        // here regardless of saved state (also makes unlock work after a
        // restart, when the in-memory map is empty).
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: null,
            AddReactions: null
        });

        const embed = new EmbedBuilder()
            .setTitle("Channel Unlocked")
            .setDescription("Channel is unlocked. @everyone SendMessages and AddReactions have been reset to inherited (default).")
            .setColor(0x00ff00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Log the unlock action
        const logChannel = await fetchChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("Channel Unlocked")
                .setColor(0x00ff00)
                .setTimestamp()
                .addFields(
                    { name: "Channel", value: `${channel} (${channel.name})`, inline: true },
                    { name: "Unlocked by", value: `${interaction.user} (${interaction.user.username})`, inline: true },
                    { name: "Channel ID", value: channel.id, inline: true }
                );

            await logChannel.send({ embeds: [logEmbed] });
        }

    } catch (error) {
        console.error('Error unlocking channel:', error);
        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}

async function handleSlowdownCommand(interaction, options, bot) {
    const seconds = options.getInteger('seconds');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
            .setDescription(MSG.NO_PERMISSION_MANAGE)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        await interaction.channel.setRateLimitPerUser(seconds);
    } catch (error) {
        console.error('Error setting channel cooldown:', error);
        const errEmbed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        await interaction.reply({ embeds: [errEmbed], flags: MessageFlags.Ephemeral }).catch(() => {});
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle("Channel Cooldown Updated")
        .setDescription(seconds === 0
            ? "Channel cooldown has been reset."
            : `Channel cooldown set to ${seconds} seconds.`
        )
        .setColor(0x00ff00);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function handleMassRole(interaction, options, bot) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
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
            .setTitle("Invalid Role")
            .setDescription("This role cannot be assigned (managed/integration role or @everyone).")
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
        const embed = new EmbedBuilder()
            .setTitle("Role Too High")
            .setDescription("That role is higher than or equal to my highest role. I cannot manage it.")
            .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.reply({ embeds: [
        new EmbedBuilder()
            .setTitle("Mass Role in Progress")
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

        const doneEmbed = new EmbedBuilder()
            .setTitle("Mass Role Complete")
            .setDescription(`**Action:** ${action === 'add' ? 'Added' : 'Removed'} ${role}\n**Success:** ${success}\n**Failed:** ${failed}`)
            .setColor(0x00ff00);
        try {
            await interaction.editReply({ embeds: [doneEmbed] });
        } catch (editErr) {
            // Interaction token expired after >15 min (large server) — post to channel instead.
            if (editErr?.code === 10062) {
                doneEmbed.setDescription(doneEmbed.data.description + '\n\n*(Interaction timed out — result posted here instead.)*');
                await interaction.channel.send({ embeds: [doneEmbed] }).catch(() => {});
            }
        }

    } catch (error) {
        console.error('Error in mass role:', error);
        const errEmbed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription(MSG.GENERIC_ERROR)
            .setColor(0xff0000);
        try {
            await interaction.editReply({ embeds: [errEmbed] });
        } catch (editErr) {
            if (editErr?.code === 10062) {
                await interaction.channel.send({ embeds: [errEmbed] }).catch(() => {});
            }
        }
    }
}

async function handleEmbedCommand(interaction, options, bot) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Denied")
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
        const hex = colorInput.replace(/^#/, '');
        if (/^[0-9a-fA-F]{6}$/.test(hex)) {
            color = parseInt(hex, 16);
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(text)
        .setColor(color);

    const urlWarnings = [];
    if (thumbnail) {
        try { embed.setThumbnail(thumbnail); }
        catch { urlWarnings.push('thumbnail URL was invalid and was not applied'); }
    }
    if (image) {
        try { embed.setImage(image); }
        catch { urlWarnings.push('image URL was invalid and was not applied'); }
    }
    if (footer) {
        embed.setFooter({ text: footer });
    }

    try {
        await targetChannel.send({ embeds: [embed] });
        const sentDescription = urlWarnings.length
            ? `Embed was sent to ${targetChannel}.\n⚠️ Warning: ${urlWarnings.join('; ')}.`
            : `Embed was sent to ${targetChannel}.`;
        await interaction.reply({ embeds: [
            new EmbedBuilder()
                .setTitle("Embed Sent")
                .setDescription(sentDescription)
                .setColor(urlWarnings.length ? 0xffcc00 : 0x00ff00)
        ], flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('Error sending embed:', error);
        await interaction.reply({ embeds: [
            new EmbedBuilder()
                .setTitle("Error")
                .setDescription("Could not send the embed. Check that I have permission to send messages in the target channel.")
                .setColor(0xff0000)
        ], flags: MessageFlags.Ephemeral });
    }
}

async function handleHosterCommand(interaction) {
    const embed = new EmbedBuilder()
        .setTitle("Hosting")
        .setDescription("example.invalid is powered by Index-Hosting.com\nUse Code **GRAVI** for 10% off.")
        .setColor(0x0000ff);

    await interaction.reply({ embeds: [embed] });
}