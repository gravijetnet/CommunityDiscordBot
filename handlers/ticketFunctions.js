const { ChannelType, PermissionsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const MSG = require('../config/messages');

async function fetchChannel(bot, channelId) {
    if (!channelId) return null;
    try {
        return await bot.client.channels.fetch(channelId);
    } catch {
        return null;
    }
}

async function createTicket(interaction, category, bot) {
    return new Promise((resolve, reject) => {
        bot.db.get("SELECT * FROM ticket_bans WHERE user_id = ?", [interaction.user.id], async (err, ban) => {
            if (err) {
                await interaction.reply({ content: MSG.GENERIC_DB_ERROR, flags: MessageFlags.Ephemeral });
                return reject(err);
            }

            if (ban) {
                const embed = new EmbedBuilder()
                    .setTitle("Ticket Blocked")
                    .setDescription(MSG.TICKET_BANNED)
                    .setColor(0xff0000);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return resolve();
            }

            bot.db.get("SELECT COUNT(*) as count FROM tickets WHERE user_id = ?", [interaction.user.id], async (err, row) => {
                if (err) {
                    await interaction.reply({ content: MSG.GENERIC_DB_ERROR, flags: MessageFlags.Ephemeral });
                    return reject(err);
                }

                const ticketCount = row.count + 1;
                await createTicketChannel(interaction, category, ticketCount, bot);
                resolve();
            });
        });
    });
}

async function createTicketChannel(interaction, category, ticketCount, bot) {
    const categoryChannel = await fetchChannel(bot, bot.CONFIG.SUPPORT_CATEGORY);
    const guild = interaction.guild;

    if (!categoryChannel) {
        await interaction.reply({ content: MSG.GENERIC_ERROR, flags: MessageFlags.Ephemeral });
        return;
    }

    const channelName = `${category}-${interaction.user.username}-${ticketCount.toString().padStart(4, '0')}`;
    const catConfig = bot.CONFIG.CATEGORY_PERMISSIONS[category];

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
        [interaction.user.id, channel.id, category]
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

    await interaction.reply({ embeds: [confirmEmbed], flags: MessageFlags.Ephemeral });
}

async function closeTicketChannel(channel, closer, bot) {
    return new Promise((resolve, reject) => {
        bot.db.get("SELECT * FROM tickets WHERE channel_id = ?", [channel.id], async (err, ticket) => {
            if (err) return reject(err);
            if (!ticket) return resolve();

            bot.db.run(
                "UPDATE tickets SET status = 'closed', closed_at = ? WHERE channel_id = ?",
                [new Date().toISOString(), channel.id],
                async (dbErr) => {
                    if (dbErr) {
                        console.error('Database error:', dbErr);
                        return reject(dbErr);
                    }

                    let transcript = "";
                    try {
                        const messages = await channel.messages.fetch({ limit: 100 });
                        const lines = [];
                        messages.reverse().forEach(message => {
                            const attachments = message.attachments.size > 0
                                ? ` [${message.attachments.size} attachment(s)]`
                                : '';
                            lines.push(`${message.author.username} (${message.author.id}) - ${message.createdAt}: ${message.content}${attachments}`);
                        });
                        transcript = lines.join('\n');
                    } catch (error) {
                        console.error('Error fetching messages for transcript:', error);
                    }

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

                            const files = [];
                            if (transcript.trim()) {
                                files.push({
                                    attachment: Buffer.from(transcript),
                                    name: `transcript-${ticket.id}.txt`
                                });
                            }

                            await transcriptChannel.send({ embeds: [embed], files: files });
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
                        if (transcript.trim()) {
                            dmFiles.push({
                                attachment: Buffer.from(transcript),
                                name: `transcript-${ticket.id}.txt`
                            });
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
