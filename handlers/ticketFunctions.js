const { ChannelType, PermissionsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const MSG = require('../config/messages');

// Per-user in-progress lock for ticket creation — prevents a race where two
// simultaneous select-menu clicks both pass the open_count > 0 guard before
// either INSERT has committed (B-12).
const creatingTickets = new Set();

async function fetchChannel(bot, channelId) {
    if (!channelId) return null;
    try {
        return await bot.client.channels.fetch(channelId);
    } catch {
        return null;
    }
}

// Reply correctly whether or not the interaction was already deferred/replied.
// createTicket defers up front (channel creation can blow past the 3s window),
// so everything downstream must use editReply/followUp instead of reply.
async function safeReply(interaction, payload) {
    try {
        if (interaction.deferred && !interaction.replied) {
            return await interaction.editReply(payload);
        }
        if (interaction.replied) {
            return await interaction.followUp(payload);
        }
        return await interaction.reply(payload);
    } catch (e) {
        if (e?.code !== 10062) console.error('[ticket safeReply] failed:', e?.message || e);
    }
}

async function createTicket(interaction, category, bot) {
    // Creating a channel + sending the opening message can exceed Discord's 3s
    // interaction window — acknowledge immediately so reply() can't 10062.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

    // In-process lock so two simultaneous select-menu clicks from the same user
    // can't both pass the open_count check before either INSERT commits.
    if (creatingTickets.has(interaction.user.id)) {
        const embed = new EmbedBuilder()
            .setTitle("Ticket Already Open")
            .setDescription("You already have an open ticket. Please use it or ask staff to close it before opening a new one.")
            .setColor(0xff0000);
        await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }
    creatingTickets.add(interaction.user.id);

    return new Promise((resolve) => {
        bot.db.get("SELECT * FROM ticket_bans WHERE user_id = ?", [interaction.user.id], async (err, ban) => {
            if (err) {
                await safeReply(interaction, { content: MSG.GENERIC_DB_ERROR, flags: MessageFlags.Ephemeral });
                return resolve();
            }

            if (ban) {
                creatingTickets.delete(interaction.user.id);
                const embed = new EmbedBuilder()
                    .setTitle("Ticket Blocked")
                    .setDescription(MSG.TICKET_BANNED)
                    .setColor(0xff0000);
                await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
                return resolve();
            }

            bot.db.get(
                "SELECT COUNT(*) as total, COALESCE(SUM(status = 'open'), 0) as open_count FROM tickets WHERE user_id = ?",
                [interaction.user.id],
                async (err, row) => {
                    if (err) {
                        creatingTickets.delete(interaction.user.id);
                        await safeReply(interaction, { content: MSG.GENERIC_DB_ERROR, flags: MessageFlags.Ephemeral });
                        return resolve();
                    }

                    if ((row?.open_count ?? 0) > 0) {
                        creatingTickets.delete(interaction.user.id);
                        const embed = new EmbedBuilder()
                            .setTitle("Ticket Already Open")
                            .setDescription("You already have an open ticket. Please use it or ask staff to close it before opening a new one.")
                            .setColor(0xff0000);
                        await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
                        return resolve();
                    }

                    const ticketCount = (row?.total ?? 0) + 1;
                    try {
                        await createTicketChannel(interaction, category, ticketCount, bot);
                    } catch (e) {
                        console.error('Error creating ticket channel:', e);
                        await safeReply(interaction, { content: MSG.GENERIC_ERROR, flags: MessageFlags.Ephemeral });
                    }
                    creatingTickets.delete(interaction.user.id);
                    resolve();
                }
            );
        });
    });
}

async function createTicketChannel(interaction, category, ticketCount, bot) {
    const categoryChannel = await fetchChannel(bot, bot.CONFIG.SUPPORT_CATEGORY);
    const guild = interaction.guild;

    if (!categoryChannel) {
        await safeReply(interaction, { content: MSG.GENERIC_ERROR, flags: MessageFlags.Ephemeral });
        return;
    }

    // Discord rejects channel names with characters outside [a-z0-9-]; sanitize
    // the username so unusual names don't make channels.create() fail.
    const safeUser = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'user';
    const channelName = `${category}-${safeUser}-${ticketCount.toString().padStart(4, '0')}`.substring(0, 100);
    const catConfig = bot.CONFIG.CATEGORY_PERMISSIONS[category];

    if (!catConfig) {
        await safeReply(interaction, { content: MSG.GENERIC_ERROR, flags: MessageFlags.Ephemeral });
        return;
    }

    const permissionOverwrites = [
        {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
    ];

    for (const roleId of catConfig.staff_roles) {
        permissionOverwrites.push({
            id: roleId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        });
    }

    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryChannel.id,
        permissionOverwrites: permissionOverwrites
    });

    bot.db.run(
        "INSERT INTO tickets (user_id, channel_id, category) VALUES (?, ?, ?)",
        [interaction.user.id, channel.id, category],
        (err) => { if (err) console.error('[createTicketChannel] DB insert error:', err); }
    );

    const embed = new EmbedBuilder()
        .setTitle(catConfig.name)
        .setDescription(MSG.TICKET_WELCOME(interaction.user, ticketCount.toString().padStart(4, '0')))
        .setColor(catConfig.color);

    const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel(MSG.CLOSE_BUTTON_LABEL)
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

    await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });

    const confirmEmbed = new EmbedBuilder()
        .setTitle("Ticket Created")
        .setDescription(MSG.TICKET_CREATED(channel))
        .setColor(0x00ff00);

    await safeReply(interaction, { embeds: [confirmEmbed], flags: MessageFlags.Ephemeral });
}

async function closeTicketChannel(channel, closer, bot) {
    return new Promise((resolve, reject) => {
        bot.db.get("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'", [channel.id], async (err, ticket) => {
            if (err) return reject(err);
            if (!ticket) return resolve(); // already closed or not a ticket channel

            bot.db.run(
                "UPDATE tickets SET status = 'closed', closed_at = ? WHERE channel_id = ? AND status = 'open'",
                [new Date().toISOString(), channel.id],
                async function (dbErr) {
                    if (dbErr) {
                        console.error('Database error:', dbErr);
                        return reject(dbErr);
                    }
                    // Another concurrent close already won the race — bail out.
                    if (this.changes === 0) return resolve();

                    let transcript = "";
                    try {
                        const allMessages = [];
                        let before;
                        for (;;) {
                            const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
                            if (batch.size === 0) break;
                            batch.forEach(m => allMessages.push(m));
                            before = batch.last()?.id;
                            if (batch.size < 100) break;
                        }
                        allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                        const lines = allMessages
                            .filter(m => {
                                // Skip bot messages with no text content — they produce
                                // meaningless blank lines (embed-only welcome/close embeds).
                                if (m.author?.bot && !m.content && m.attachments.size === 0) return false;
                                return true;
                            })
                            .map(message => {
                                const attachments = message.attachments.size > 0
                                    ? ` [${message.attachments.size} attachment(s)]`
                                    : '';
                                return `${message.author?.username ?? 'Unknown'} (${message.author?.id ?? 'N/A'}) - ${message.createdAt}: ${message.content || ''}${attachments}`;
                            });
                        transcript = lines.join('\n');
                    } catch (error) {
                        console.error('Error fetching messages for transcript:', error);
                    }

                    // Discord upload limit for non-boosted servers is 8 MB.
                    // If the transcript is larger, send just the embed and note the oversize.
                    const DISCORD_UPLOAD_LIMIT = 8 * 1024 * 1024;
                    const transcriptBuffer = transcript.trim() ? Buffer.from(transcript, 'utf-8') : null;
                    const transcriptTooBig = transcriptBuffer && transcriptBuffer.length > DISCORD_UPLOAD_LIMIT;

                    try {
                        const transcriptChannel = await fetchChannel(bot, bot.CONFIG.TRANSCRIPT_CHANNEL);
                        if (transcriptChannel) {
                            const embed = new EmbedBuilder()
                                .setTitle(MSG.TICKET_TRANSCRIPT_TITLE)
                                .setColor(0x0000ff)
                                .setTimestamp()
                                .addFields(
                                    { name: "Category",    value: bot.CONFIG.CATEGORY_PERMISSIONS[ticket.category]?.name || ticket.category, inline: true },
                                    { name: "User",        value: `<@${ticket.user_id}>`, inline: true },
                                    { name: "Closed by",   value: closer.toString(), inline: true },
                                    { name: "Ticket ID",   value: `#${ticket.id}`, inline: true }
                                );

                            if (transcriptTooBig) {
                                embed.addFields({ name: "Transcript", value: "Transcript exceeded 8 MB upload limit and was not attached.", inline: false });
                            }

                            const files = [];
                            if (transcriptBuffer && !transcriptTooBig) {
                                files.push({ attachment: transcriptBuffer, name: `transcript-${ticket.id}.txt` });
                            }

                            await transcriptChannel.send({ embeds: [embed], files });
                        }
                    } catch (error) {
                        console.error('Error sending transcript:', error);
                    }

                    try {
                        const user = await bot.client.users.fetch(ticket.user_id);
                        const dmEmbed = new EmbedBuilder()
                            .setTitle(MSG.TICKET_TRANSCRIPT_DM_TITLE)
                            .setDescription(MSG.TICKET_TRANSCRIPT_DM_BODY(channel.guild.name))
                            .setColor(0x0000ff)
                            .setTimestamp()
                            .addFields(
                                { name: "Category",  value: bot.CONFIG.CATEGORY_PERMISSIONS[ticket.category]?.name || ticket.category, inline: true },
                                { name: "Closed by", value: closer.toString(), inline: true }
                            );

                        const dmFiles = [];
                        if (transcriptBuffer && !transcriptTooBig) {
                            dmFiles.push({ attachment: transcriptBuffer, name: `transcript-${ticket.id}.txt` });
                        }

                        await user.send({ embeds: [dmEmbed], files: dmFiles });
                    } catch (error) {
                        console.log(`Could not send transcript to user ${ticket.user_id}`);
                    }

                    try {
                        await channel.delete();
                        console.log(`Successfully closed ticket #${ticket.id} in channel ${channel.name}`);
                    } catch (error) {
                        console.error('Error deleting channel:', error);
                    }

                    resolve();
                }
            );
        });
    });
}

module.exports = {
    createTicket,
    createTicketChannel,
    closeTicketChannel
};
