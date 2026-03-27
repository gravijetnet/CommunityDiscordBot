const { registerCommands, handleCommand } = require('./commandHandler');
const { EmbedBuilder, ChannelType, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, AuditLogEvent } = require('discord.js');
const ApplicationHandler = require('./applicationHandler');
const MSG = require('../config/messages');

// Ticket-Funktionen
async function createTicket(interaction, category, bot) {
    return new Promise((resolve, reject) => {
        bot.db.get("SELECT * FROM ticket_bans WHERE user_id = ?", [interaction.user.id], async (err, ban) => {
            if (err) {
                await interaction.reply({ content: MSG.GENERIC_DB_ERROR, ephemeral: true });
                return reject(err);
            }

            if (ban) {
                const embed = new EmbedBuilder()
                    .setTitle("❌ Ticket Creation Blocked")
                    .setDescription(MSG.TICKET_BANNED)
                    .setColor(0xff0000);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return resolve();
            }

            bot.db.get("SELECT COUNT(*) as count FROM tickets WHERE user_id = ?", [interaction.user.id], async (err, row) => {
                if (err) {
                    await interaction.reply({ content: MSG.GENERIC_DB_ERROR, ephemeral: true });
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
    const categoryChannel = await getLogChannel(bot, bot.CONFIG.SUPPORT_CATEGORY);
    const guild = interaction.guild;

    if (!categoryChannel) {
        await interaction.reply({ content: MSG.GENERIC_ERROR, ephemeral: true });
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
        .setDescription(`Hello ${interaction.user}! Support staff will be with you shortly.\n\nPlease describe your issue in detail.`)
        .setColor(catConfig.color)
        .setFooter({ text: `Ticket ID: ${ticketCount.toString().padStart(4, '0')}` });

    const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

    await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });

    const confirmEmbed = new EmbedBuilder()
        .setTitle("✅ Ticket Created")
        .setDescription(`Your ticket has been created: ${channel}`)
        .setColor(0x00ff00);

    await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
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
                        messages.reverse().forEach(message => {
                            const attachments = message.attachments.size > 0 
                                ? ` [${message.attachments.size} attachment(s)]` 
                                : '';
                            transcript += `${message.author.username} (${message.author.id}) - ${message.createdAt}: ${message.content}${attachments}\n`;
                        });
                    } catch (error) {
                        console.error('Error fetching messages for transcript:', error);
                    }

                    try {
                        const transcriptChannel = await getLogChannel(bot, bot.CONFIG.TRANSCRIPT_CHANNEL);
                        if (transcriptChannel) {
                            const embed = new EmbedBuilder()
                                .setTitle("📄 Ticket Transcript")
                                .setColor(0x0000ff)
                                .setTimestamp()
                                .addFields(
                                    { name: "Topic", value: bot.CONFIG.CATEGORY_PERMISSIONS[ticket.category]?.name || 'Unknown', inline: true },
                                    { name: "User", value: `<@${ticket.user_id}>`, inline: true },
                                    { name: "Closed by", value: closer.toString(), inline: true },
                                    { name: "Ticket ID", value: `#${ticket.id}`, inline: true }
                                );

                            const files = [];
                            if (transcript.trim()) {
                                files.push({
                                    attachment: Buffer.from(transcript),
                                    name: `transcript-${ticket.id}.txt`
                                });
                            }

                            await transcriptChannel.send({ 
                                embeds: [embed],
                                files: files
                            });
                        }
                    } catch (error) {
                        console.error('Error sending transcript:', error);
                    }

                    try {
                        const user = await bot.client.users.fetch(ticket.user_id);
                        const dmEmbed = new EmbedBuilder()
                            .setTitle("📄 Ticket Closed")
                            .setDescription(`Your ticket in **${channel.guild.name}** has been closed.`)
                            .setColor(0x0000ff)
                            .setTimestamp()
                            .addFields(
                                { name: "Topic", value: bot.CONFIG.CATEGORY_PERMISSIONS[ticket.category]?.name || 'Unknown', inline: true },
                                { name: "Closed by", value: closer.toString(), inline: true }
                            );

                        const dmFiles = [];
                        if (transcript.trim()) {
                            dmFiles.push({
                                attachment: Buffer.from(transcript),
                                name: `transcript-${ticket.id}.txt`
                            });
                        }

                        await user.send({ 
                            embeds: [dmEmbed],
                            files: dmFiles
                        });
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

// Status und Setup Funktionen
async function updateStatus(bot) {
    try {
        const activity = `on ${bot.CONFIG.MINECRAFT_SERVER}`;
        bot.client.user.setActivity(activity, { type: 0 });
    } catch (error) {
        console.error('Error updating status:', error);
        bot.client.user.setActivity(`on ${bot.CONFIG.MINECRAFT_SERVER} | Server offline`, { type: 0 });
    }
}

async function setupTicketChannel(bot) {
    const channel = await getLogChannel(bot, bot.CONFIG.TICKET_CHANNEL);
    if (!channel) {
        console.log('Ticket channel not found');
        return;
    }

    try {
        const messages = await channel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(msg => 
            msg.author.id === bot.client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title === "🎫 Support Tickets"
        );

        if (existingPanel) {
            console.log('Ticket panel already exists, skipping creation');
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
            { label: "General Support", value: "general" },
            { label: "Bug Report", value: "bug" },
            { label: "Player Report", value: "player" },
            { label: "Punishment Appeal", value: "appeal" },
            { label: "Payment Support", value: "payment" }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await channel.send({ embeds: [embed], components: [row] });
    console.log('Ticket panel created successfully');
}

// Event Handler Funktionen
async function handleCloseTicket(interaction, bot) {
    await interaction.deferUpdate();

    bot.db.get("SELECT category FROM tickets WHERE channel_id = ?", [interaction.channel.id], async (err, ticket) => {
        if (err) {
            await interaction.followUp({ content: MSG.GENERIC_ERROR, ephemeral: true }).catch(() => {});
            return;
        }
        if (!ticket) {
            await interaction.followUp({ content: MSG.TICKET_NOT_FOUND, ephemeral: true }).catch(() => {});
            return;
        }

        const categoryConfig = bot.CONFIG.CATEGORY_PERMISSIONS[ticket.category];
        // For unknown categories (e.g. 'application' tickets), fall back to management-role check
        const hasPermission = categoryConfig
            ? interaction.member.roles.cache.some(r => categoryConfig.staff_roles.includes(r.id))
            : interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE);

        if (!hasPermission) {
            await interaction.followUp({ content: MSG.NO_PERMISSION_STAFF, ephemeral: true }).catch(() => {});
            return;
        }

        try {
            const { closeTicketChannel: closeFn } = require('./ticketFunctions');
            await closeFn(interaction.channel, interaction.user, bot);
        } catch (error) {
            console.error('[handleCloseTicket] Fehler:', error);
            await interaction.followUp({ content: MSG.GENERIC_ERROR, ephemeral: true }).catch(() => {});
        }
    });
}

async function handleTicketSelect(interaction, bot) {
    const category = interaction.values[0];
    const { createTicket: createFn } = require('./ticketFunctions');
    await createFn(interaction, category, bot);
}

// ── Logging helpers ───────────────────────────────────────────────────────────

async function getLogChannel(bot, channelId) {
    if (!channelId) return null;
    try {
        return await bot.client.channels.fetch(channelId);
    } catch (err) {
        console.error(`[getLogChannel] Could not fetch channel ${channelId}:`, err.message);
        return null;
    }
}

async function fetchAuditExecutor(guild, actionType, targetId = null, maxAgeMs = 5000) {
    try {
        const logs = await guild.fetchAuditLogs({ limit: 3, type: actionType });
        const entry = logs.entries.find(e => {
            if (Date.now() - e.createdTimestamp > maxAgeMs) return false;
            if (targetId && e.target?.id !== targetId) return false;
            return true;
        });
        return entry?.executor ?? null;
    } catch {
        return null;
    }
}

function fmtExecutor(executor) {
    if (!executor) return 'Unbekannt';
    return `${executor} (${executor.tag})\n\`${executor.id}\``;
}

function channelTypeName(type) {
    const names = {
        0: 'Text', 2: 'Voice', 4: 'Category', 5: 'Announcement',
        10: 'Announcement Thread', 11: 'Public Thread', 12: 'Private Thread',
        13: 'Stage', 15: 'Forum', 16: 'Media'
    };
    return names[type] ?? `Unknown (${type})`;
}

function formatDuration(ms) {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// ── Message logs ──────────────────────────────────────────────────────────────

async function logMessageDelete(message, bot) {
    // Partial (uncached) messages don't have author/content — skip silently
    if (message.partial || !message.author) return;
    if (message.author.bot) return;

    const isMonitored = message.channel.parentId === bot.CONFIG.MONITORED_CATEGORY;

    // Try to find who deleted the message via audit log (only appears if a mod deleted it)
    const executor = await fetchAuditExecutor(message.guild, AuditLogEvent.MessageDelete, message.author.id);
    const deletedByValue = executor
        ? `${executor} (${executor.tag})\n\`${executor.id}\``
        : `${message.author} (selbst)\n\`${message.author.id}\``;

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .setColor(isMonitored ? 0xff4500 : 0xff0000)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .addFields(
            { name: '👤 Author',      value: `${message.author} (${message.author.tag})\n\`${message.author.id}\``, inline: true },
            { name: '📌 Channel',     value: `${message.channel}\n\`${message.channel.name}\``,                      inline: true },
            { name: '🕐 Sent',        value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`,                 inline: true },
            { name: '🗑️ Deleted by', value: deletedByValue,                                                          inline: true }
        )
        .setFooter({ text: `Message ID: ${message.id}${isMonitored ? '  •  ⚠️ Monitored category' : ''}` });

    if (message.content) {
        const preview = message.content.length > 1024
            ? message.content.substring(0, 1020) + '…'
            : message.content;
        embed.addFields({ name: `📝 Content (${message.content.length} chars)`, value: preview, inline: false });
    }

    if (message.attachments.size > 0) {
        const list = message.attachments.map(a => `[${a.name}](${a.url})`).join('\n');
        embed.addFields({ name: `📎 Attachments (${message.attachments.size})`, value: list.substring(0, 1024), inline: false });
    }

    const logChannel = await getLogChannel(bot, bot.CONFIG.MESSAGE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });

    // Extra DM alert for monitored category
    if (isMonitored) {
        try {
            const dmUser = await bot.client.users.fetch(bot.CONFIG.DM_USER_ID);
            const dmEmbed = new EmbedBuilder()
                .setTitle('🚨 Message Deleted in Monitored Category')
                .setColor(0xff4500)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .addFields(
                    { name: '👤 Author',     value: `${message.author.tag}\n\`${message.author.id}\``,            inline: true },
                    { name: '📌 Channel',    value: `#${message.channel.name}`,                                    inline: true },
                    { name: '🏠 Server',     value: message.guild.name,                                            inline: true },
                    { name: '🕐 Sent',       value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`,        inline: true },
                    { name: '🗑️ Deleted',   value: `<t:${Math.floor(Date.now() / 1000)}:F>`,                      inline: true },
                    { name: '🆔 Message ID', value: message.id,                                                    inline: true }
                );

            if (message.content) {
                dmEmbed.addFields({
                    name: `📝 Content (${message.content.length} chars)`,
                    value: message.content.length > 2000 ? message.content.substring(0, 1996) + '…' : message.content,
                    inline: false
                });
            }

            if (message.attachments.size > 0) {
                const list = message.attachments.map(a => `**${a.name}**: ${a.url}`).join('\n');
                dmEmbed.addFields({ name: `📎 Attachments (${message.attachments.size})`, value: list.substring(0, 1024), inline: false });
            }

            await dmUser.send({ embeds: [dmEmbed] });
        } catch (err) {
            console.error('Could not send monitored-category DM:', err);
        }
    }
}

async function logMessageUpdate(oldMessage, newMessage, bot) {
    // Fetch partials so we always have full content
    if (oldMessage.partial) {
        try { oldMessage = await oldMessage.fetch(); } catch { return; }
    }
    if (newMessage.partial) {
        try { newMessage = await newMessage.fetch(); } catch { return; }
    }
    if (!oldMessage.author || oldMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
        .setTitle('✏️ Message Edited')
        .setColor(0xffcc00)
        .setThumbnail(newMessage.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .addFields(
            { name: '👤 Author',          value: `${newMessage.author} (${newMessage.author.tag})\n\`${newMessage.author.id}\``, inline: true },
            { name: '📌 Channel',         value: `${newMessage.channel}\n\`${newMessage.channel.name}\``,                       inline: true },
            { name: '🔗 Jump to message', value: `[Click here](${newMessage.url})`,                                              inline: true }
        )
        .setFooter({ text: `Message ID: ${newMessage.id}` });

    if (oldMessage.content) {
        embed.addFields({
            name: `📝 Before (${oldMessage.content.length} chars)`,
            value: oldMessage.content.length > 1024 ? oldMessage.content.substring(0, 1020) + '…' : oldMessage.content,
            inline: false
        });
    }

    if (newMessage.content) {
        embed.addFields({
            name: `📝 After (${newMessage.content.length} chars)`,
            value: newMessage.content.length > 1024 ? newMessage.content.substring(0, 1020) + '…' : newMessage.content,
            inline: false
        });
    }

    const logChannel = await getLogChannel(bot, bot.CONFIG.MESSAGE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Channel logs ──────────────────────────────────────────────────────────────

async function logChannelCreate(channel, bot) {
    const executor = await fetchAuditExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);

    const embed = new EmbedBuilder()
        .setTitle('📁 Channel Created')
        .setColor(0x00cc44)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',       value: channel.name,                    inline: true },
            { name: '🏷️ Type',      value: channelTypeName(channel.type),   inline: true },
            { name: '🆔 ID',         value: `\`${channel.id}\``,             inline: true },
            { name: '👤 Erstellt von', value: fmtExecutor(executor),          inline: true }
        )
        .setFooter({ text: 'Channel created' });

    if (channel.parent) {
        embed.addFields({ name: '📂 Category', value: channel.parent.name, inline: true });
    }
    if (channel.nsfw !== undefined && channel.nsfw) {
        embed.addFields({ name: '🔞 NSFW', value: 'Yes', inline: true });
    }
    if (channel.topic) {
        embed.addFields({ name: '📋 Topic', value: channel.topic.substring(0, 1024), inline: false });
    }

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logChannelDelete(channel, bot) {
    const executor = await fetchAuditExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Channel Deleted')
        .setColor(0xff0000)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',        value: channel.name,                    inline: true },
            { name: '🏷️ Type',       value: channelTypeName(channel.type),   inline: true },
            { name: '🆔 ID',          value: `\`${channel.id}\``,             inline: true },
            { name: '👤 Gelöscht von', value: fmtExecutor(executor),           inline: true }
        )
        .setFooter({ text: 'Channel deleted' });

    if (channel.parent) {
        embed.addFields({ name: '📂 Category', value: channel.parent.name, inline: true });
    }
    if (channel.topic) {
        embed.addFields({ name: '📋 Topic', value: channel.topic.substring(0, 1024), inline: false });
    }

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logChannelUpdate(oldChannel, newChannel, bot) {
    const changes = [];

    if (oldChannel.name !== newChannel.name)
        changes.push(`**Name:** \`${oldChannel.name}\` → \`${newChannel.name}\``);

    if (oldChannel.parent?.id !== newChannel.parent?.id)
        changes.push(`**Category:** ${oldChannel.parent?.name ?? 'None'} → ${newChannel.parent?.name ?? 'None'}`);

    if (oldChannel.topic !== newChannel.topic) {
        const oldT = oldChannel.topic ? `\`${oldChannel.topic.substring(0, 80)}\`` : 'None';
        const newT = newChannel.topic ? `\`${newChannel.topic.substring(0, 80)}\`` : 'None';
        changes.push(`**Topic:** ${oldT} → ${newT}`);
    }

    if (oldChannel.nsfw !== newChannel.nsfw)
        changes.push(`**NSFW:** ${oldChannel.nsfw ? 'Yes' : 'No'} → ${newChannel.nsfw ? 'Yes' : 'No'}`);

    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser)
        changes.push(`**Slowmode:** ${oldChannel.rateLimitPerUser}s → ${newChannel.rateLimitPerUser}s`);

    if (oldChannel.type !== newChannel.type)
        changes.push(`**Type:** ${channelTypeName(oldChannel.type)} → ${channelTypeName(newChannel.type)}`);

    if (changes.length === 0) return;

    const executor = await fetchAuditExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Channel Updated')
        .setColor(0xffcc00)
        .setTimestamp()
        .addFields(
            { name: '📌 Channel',                    value: `${newChannel} \`${newChannel.name}\``, inline: true },
            { name: '🆔 ID',                         value: `\`${newChannel.id}\``,                 inline: true },
            { name: '👤 Geändert von',               value: fmtExecutor(executor),                  inline: true },
            { name: `📝 Changes (${changes.length})`, value: changes.join('\n'),                     inline: false }
        )
        .setFooter({ text: `Channel ID: ${newChannel.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Role logs ─────────────────────────────────────────────────────────────────

async function logRoleCreate(role, bot) {
    const executor = await fetchAuditExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);

    const embed = new EmbedBuilder()
        .setTitle('🆕 Role Created')
        .setColor(role.color || 0x00cc44)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',          value: `${role} \`${role.name}\``,     inline: true },
            { name: '🆔 ID',            value: `\`${role.id}\``,               inline: true },
            { name: '👤 Erstellt von',  value: fmtExecutor(executor),          inline: true },
            { name: '🎨 Color',         value: role.hexColor,                  inline: true },
            { name: '📊 Position',      value: `${role.position}`,             inline: true },
            { name: '🔔 Mentionable',   value: role.mentionable ? 'Yes' : 'No', inline: true },
            { name: '📌 Hoisted',       value: role.hoist       ? 'Yes' : 'No', inline: true }
        )
        .setFooter({ text: `Role ID: ${role.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.ROLE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logRoleDelete(role, bot) {
    const executor = await fetchAuditExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Role Deleted')
        .setColor(0xff0000)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',         value: `\`${role.name}\``,              inline: true },
            { name: '🆔 ID',           value: `\`${role.id}\``,               inline: true },
            { name: '👤 Gelöscht von', value: fmtExecutor(executor),          inline: true },
            { name: '🎨 Color',        value: role.hexColor,                  inline: true },
            { name: '📊 Position',     value: `${role.position}`,             inline: true },
            { name: '🔔 Mentionable',  value: role.mentionable ? 'Yes' : 'No', inline: true },
            { name: '📌 Hoisted',      value: role.hoist       ? 'Yes' : 'No', inline: true }
        )
        .setFooter({ text: `Role ID: ${role.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.ROLE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logRoleUpdate(oldRole, newRole, bot) {
    const changes = [];

    if (oldRole.name !== newRole.name)
        changes.push(`**Name:** \`${oldRole.name}\` → \`${newRole.name}\``);

    if (oldRole.hexColor !== newRole.hexColor)
        changes.push(`**Color:** \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);

    if (oldRole.mentionable !== newRole.mentionable)
        changes.push(`**Mentionable:** ${oldRole.mentionable ? 'Yes' : 'No'} → ${newRole.mentionable ? 'Yes' : 'No'}`);

    if (oldRole.hoist !== newRole.hoist)
        changes.push(`**Hoisted:** ${oldRole.hoist ? 'Yes' : 'No'} → ${newRole.hoist ? 'Yes' : 'No'}`);

    if (oldRole.position !== newRole.position)
        changes.push(`**Position:** ${oldRole.position} → ${newRole.position}`);

    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        const oldPerms = oldRole.permissions.toArray();
        const newPerms = newRole.permissions.toArray();
        const added   = newPerms.filter(p => !oldPerms.includes(p));
        const removed = oldPerms.filter(p => !newPerms.includes(p));
        if (added.length)   changes.push(`**Permissions Added:** ${added.map(p => `\`${p}\``).join(', ')}`);
        if (removed.length) changes.push(`**Permissions Removed:** ${removed.map(p => `\`${p}\``).join(', ')}`);
    }

    if (changes.length === 0) return;

    const executor = await fetchAuditExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Role Updated')
        .setColor(newRole.color || 0xffcc00)
        .setTimestamp()
        .addFields(
            { name: '📛 Role',                        value: `${newRole} \`${newRole.name}\``,           inline: true },
            { name: '🆔 ID',                          value: `\`${newRole.id}\``,                        inline: true },
            { name: '👤 Geändert von',                value: fmtExecutor(executor),                      inline: true },
            { name: `📝 Changes (${changes.length})`, value: changes.join('\n').substring(0, 1024),       inline: false }
        )
        .setFooter({ text: `Role ID: ${newRole.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.ROLE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Member logs ───────────────────────────────────────────────────────────────

async function logMemberJoin(member, bot) {
    const accountAgeMs   = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAgeMs / 86400000);
    const isNewAccount   = accountAgeDays < 7;

    const embed = new EmbedBuilder()
        .setTitle('📥 Member Joined')
        .setColor(isNewAccount ? 0xff8c00 : 0x00cc44)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .addFields(
            { name: '👤 User',           value: `${member.user} (${member.user.tag})\n\`${member.user.id}\``,             inline: true },
            { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`,               inline: true },
            { name: '📆 Account Age',     value: isNewAccount
                ? `⚠️ **${accountAgeDays} day(s) — New account!**`
                : `${accountAgeDays} days`,                                                                                 inline: true }
        )
        .setFooter({ text: `Member #${member.guild.memberCount}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MEMBER_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logMemberLeave(member, bot) {
    const durationStr = member.joinedAt
        ? formatDuration(Date.now() - member.joinedAt.getTime())
        : 'Unknown';

    const roleList = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .map(r => r.name)
        .join(', ') || 'None';

    const embed = new EmbedBuilder()
        .setTitle('📤 Member Left')
        .setColor(0xff0000)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .addFields(
            { name: '👤 User',            value: `${member.user.tag}\n\`${member.user.id}\``,                                                    inline: true },
            { name: '📅 Joined',          value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>` : 'Unknown',          inline: true },
            { name: '⏱️ Time in server', value: durationStr,                                                                                     inline: true },
            { name: '🎭 Roles',           value: roleList.length > 1024 ? roleList.substring(0, 1020) + '…' : roleList,                          inline: false }
        )
        .setFooter({ text: `Server now has ${member.guild.memberCount} members` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MEMBER_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── User logs ─────────────────────────────────────────────────────────────────

async function logUserUpdate(oldUser, newUser, bot) {
    const changes = [];

    if (oldUser.username !== newUser.username)
        changes.push(`**Username:** \`${oldUser.username}\` → \`${newUser.username}\``);

    if (oldUser.discriminator !== newUser.discriminator)
        changes.push(`**Discriminator:** \`#${oldUser.discriminator}\` → \`#${newUser.discriminator}\``);

    if (oldUser.avatar !== newUser.avatar)
        changes.push('**Avatar:** Updated');

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('👤 User Updated')
        .setColor(0xffcc00)
        .setThumbnail(newUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .addFields(
            { name: '👤 User',                       value: `${newUser} (${newUser.tag})\n\`${newUser.id}\``, inline: true },
            { name: `📝 Changes (${changes.length})`, value: changes.join('\n'),                              inline: false }
        )
        .setFooter({ text: `User ID: ${newUser.id}` });

    if (oldUser.avatar !== newUser.avatar && oldUser.avatar) {
        embed.addFields({
            name: '🖼️ Previous avatar',
            value: `[Click to view](${oldUser.displayAvatarURL({ dynamic: true, size: 256 })})`,
            inline: true
        });
    }

    const logChannel = await getLogChannel(bot, bot.CONFIG.USER_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Close-request Button Handler ──────────────────────────────────────────────

async function handleCloseRequestConfirm(interaction, bot) {
    await interaction.deferUpdate();

    bot.db.get("SELECT * FROM tickets WHERE channel_id = ?", [interaction.channel.id], async (err, ticket) => {
        if (err || !ticket) {
            await interaction.followUp({ content: MSG.TICKET_NOT_FOUND, ephemeral: true }).catch(() => {});
            return;
        }

        const categoryConfig = bot.CONFIG.CATEGORY_PERMISSIONS[ticket.category];
        const isStaff = categoryConfig
            ? interaction.member.roles.cache.some(r => categoryConfig.staff_roles.includes(r.id))
            : interaction.member.roles.cache.has(bot.MANAGEMENT_ROLE);

        if (interaction.user.id !== ticket.user_id && !isStaff) {
            await interaction.followUp({ content: MSG.NO_PERMISSION_STAFF, ephemeral: true }).catch(() => {});
            return;
        }

        try {
            const { closeTicketChannel: closeFn } = require('./ticketFunctions');
            await closeFn(interaction.channel, interaction.user, bot);
        } catch (e) {
            console.error('[close_request_confirm] Fehler:', e);
            await interaction.followUp({ content: MSG.GENERIC_ERROR, ephemeral: true }).catch(() => {});
        }
    });
}

async function handleCloseRequestCancel(interaction, bot) {
    await interaction.deferUpdate();

    const embed = new EmbedBuilder()
        .setTitle(MSG.TICKET_CLOSE_REQUEST_CANCELLED_TITLE)
        .setDescription(MSG.TICKET_CLOSE_REQUEST_CANCELLED_BODY)
        .setColor(0xff0000);

    await interaction.editReply({ embeds: [embed], components: [] });
}

// ── Report Button Handler ──────────────────────────────────────────────────────

async function handleReportButton(interaction, bot) {
    const parts = interaction.customId.split('_'); // ['report', action, userId, reporterId]
    const action = parts[1];
    const reportedUserId = parts[2];

    if (!interaction.member.roles.cache.has(bot.STAFF_ROLE)) {
        await interaction.reply({ content: MSG.REPORT_NO_STAFF, ephemeral: true });
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
            return;
        }

        const guild = interaction.guild;
        const member = await guild.members.fetch(reportedUserId).catch(() => null);

        if (action === 'ban') {
            if (!member) {
                await interaction.reply({ content: 'Nutzer nicht gefunden.', ephemeral: true });
                return;
            }
            await guild.bans.create(reportedUserId, { reason: `Gebannt via Report durch ${interaction.user.tag}`, deleteMessageSeconds: 0 });
            const embed = new EmbedBuilder()
                .setTitle('🔨 Nutzer gebannt')
                .setDescription(`${reportedUser.tag} wurde via Report gebannt.`)
                .setColor(0xff0000)
                .setTimestamp();
            await interaction.update({ embeds: [embed], components: [] });

        } else if (action === 'mute') {
            if (!member) {
                await interaction.reply({ content: 'Nutzer nicht gefunden.', ephemeral: true });
                return;
            }
            // 14 days timeout (as labeled on button)
            await member.timeout(14 * 24 * 60 * 60 * 1000, `Gemutet via Report durch ${interaction.user.tag}`);
            const embed = new EmbedBuilder()
                .setTitle('🔇 Nutzer gemutet')
                .setDescription(`${reportedUser.tag} wurde für 14 Tage gemutet.`)
                .setColor(0x808080)
                .setTimestamp();
            await interaction.update({ embeds: [embed], components: [] });
        }
    } catch (err) {
        console.error('[handleReportButton] Fehler:', err);
        try {
            await interaction.reply({ content: MSG.GENERIC_ERROR, ephemeral: true });
        } catch { /* already replied */ }
    }
}

// ── Guild (Server) logs ───────────────────────────────────────────────────────

async function logGuildUpdate(oldGuild, newGuild, bot) {
    const changes = [];

    if (oldGuild.name !== newGuild.name)
        changes.push(`**Servername:** \`${oldGuild.name}\` → \`${newGuild.name}\``);
    if (oldGuild.description !== newGuild.description)
        changes.push(`**Beschreibung:** ${oldGuild.description ?? 'Keine'} → ${newGuild.description ?? 'Keine'}`);
    if (oldGuild.icon !== newGuild.icon)
        changes.push(`**Server-Icon:** Geändert`);
    if (oldGuild.banner !== newGuild.banner)
        changes.push(`**Banner:** Geändert`);
    if (oldGuild.splash !== newGuild.splash)
        changes.push(`**Einladungs-Hintergrund:** Geändert`);
    if (oldGuild.verificationLevel !== newGuild.verificationLevel)
        changes.push(`**Verifizierungslevel:** ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`);
    if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter)
        changes.push(`**Explicit Content Filter:** ${oldGuild.explicitContentFilter} → ${newGuild.explicitContentFilter}`);
    if (oldGuild.afkChannelId !== newGuild.afkChannelId)
        changes.push(`**AFK-Kanal:** <#${oldGuild.afkChannelId ?? 0}> → <#${newGuild.afkChannelId ?? 0}>`);
    if (oldGuild.systemChannelId !== newGuild.systemChannelId)
        changes.push(`**System-Kanal:** <#${oldGuild.systemChannelId ?? 0}> → <#${newGuild.systemChannelId ?? 0}>`);
    if (oldGuild.premiumTier !== newGuild.premiumTier)
        changes.push(`**Boost-Level:** ${oldGuild.premiumTier} → ${newGuild.premiumTier}`);
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode)
        changes.push(`**Vanity-URL:** \`${oldGuild.vanityURLCode ?? 'Keine'}\` → \`${newGuild.vanityURLCode ?? 'Keine'}\``);

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Server aktualisiert')
        .setColor(0xffa500)
        .setTimestamp()
        .addFields({ name: `📝 Änderungen (${changes.length})`, value: changes.join('\n').substring(0, 1024), inline: false })
        .setFooter({ text: `Server ID: ${newGuild.id}` });

    if (newGuild.iconURL()) embed.setThumbnail(newGuild.iconURL({ dynamic: true }));

    const logChannel = await getLogChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Member nickname & role change logs ────────────────────────────────────────

async function logMemberNicknameChange(oldMember, newMember, bot) {
    const executor = await fetchAuditExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
    const changedBy = executor && executor.id !== newMember.id
        ? fmtExecutor(executor)
        : `${newMember.user} (selbst)\n\`${newMember.user.id}\``;

    const embed = new EmbedBuilder()
        .setTitle('✏️ Nickname geändert')
        .setColor(0xffcc00)
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .addFields(
            { name: '👤 Nutzer',       value: `${newMember.user} (${newMember.user.tag})\n\`${newMember.user.id}\``, inline: true },
            { name: '✏️ Geändert von', value: changedBy,                                                              inline: true },
            { name: '📝 Alt',          value: oldMember.nickname ?? `\`${oldMember.user.username}\``,                 inline: true },
            { name: '📝 Neu',          value: newMember.nickname ?? `\`${newMember.user.username}\` (zurückgesetzt)`,  inline: true }
        )
        .setFooter({ text: `User ID: ${newMember.user.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MEMBER_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logMemberRoleChange(oldMember, newMember, bot) {
    const addedRoles   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id) && r.id !== newMember.guild.id);
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id) && r.id !== oldMember.guild.id);

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const executor = await fetchAuditExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);

    const embed = new EmbedBuilder()
        .setTitle('🎭 Rollen aktualisiert')
        .setColor(addedRoles.size > 0 ? 0x57F287 : 0xED4245)
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .addFields(
            { name: '👤 Nutzer',         value: `${newMember.user} (${newMember.user.tag})\n\`${newMember.user.id}\``, inline: true },
            { name: '✏️ Geändert von',   value: fmtExecutor(executor),                                                 inline: true }
        );

    if (addedRoles.size > 0)
        embed.addFields({ name: `✅ Hinzugefügt (${addedRoles.size})`, value: addedRoles.map(r => `${r} \`${r.name}\``).join('\n').substring(0, 1024), inline: false });
    if (removedRoles.size > 0)
        embed.addFields({ name: `❌ Entfernt (${removedRoles.size})`, value: removedRoles.map(r => `${r} \`${r.name}\``).join('\n').substring(0, 1024), inline: false });

    embed.setFooter({ text: `User ID: ${newMember.user.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MEMBER_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Voice State logs ──────────────────────────────────────────────────────────

async function logVoiceUpdate(oldState, newState, bot) {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const changes = [];
    let title = '🔊 Voice-Aktivität';
    let color = 0x5865F2;

    if (!oldState.channelId && newState.channelId) {
        title = '🎙️ Voice beigetreten';
        color = 0x57F287;
        changes.push(`**Kanal:** ${newState.channel}`);
    } else if (oldState.channelId && !newState.channelId) {
        title = '🚪 Voice verlassen';
        color = 0xED4245;
        changes.push(`**Kanal:** ${oldState.channel}`);
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        title = '🔀 Voice gewechselt';
        color = 0xffa500;
        changes.push(`**Von:** ${oldState.channel}`);
        changes.push(`**Zu:** ${newState.channel}`);
    } else {
        // State changes within same channel
        if (oldState.selfMute !== newState.selfMute)
            changes.push(`**Mikro:** ${newState.selfMute ? '🔇 Stummgeschaltet' : '🎙️ Aktiv'}`);
        if (oldState.selfDeaf !== newState.selfDeaf)
            changes.push(`**Audio:** ${newState.selfDeaf ? '🔕 Taubgestellt' : '🔔 Aktiv'}`);
        if (oldState.serverMute !== newState.serverMute)
            changes.push(`**Server-Mute:** ${newState.serverMute ? '🔇 An' : '🎙️ Aus'}`);
        if (oldState.serverDeaf !== newState.serverDeaf)
            changes.push(`**Server-Deaf:** ${newState.serverDeaf ? '🔕 An' : '🔔 Aus'}`);
        if (oldState.streaming !== newState.streaming)
            changes.push(`**Stream:** ${newState.streaming ? '📺 Gestartet' : '⏹️ Gestoppt'}`);
        if (oldState.selfVideo !== newState.selfVideo)
            changes.push(`**Kamera:** ${newState.selfVideo ? '📷 An' : '📷 Aus'}`);
        if (changes.length === 0) return;
        title = '⚙️ Voice-Status geändert';
        color = 0xffcc00;
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .addFields(
            { name: '👤 Nutzer', value: `${member.user} (${member.user.tag})\n\`${member.user.id}\``, inline: true },
            { name: '📝 Details', value: changes.join('\n') || '—', inline: true }
        )
        .setFooter({ text: `User ID: ${member.user.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MEMBER_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Bulk-Message-Delete log ────────────────────────────────────────────────────

async function logBulkDelete(messages, channel, bot) {
    const executor = await fetchAuditExecutor(channel.guild, AuditLogEvent.MessageBulkDelete, channel.id);

    // Collect unique authors
    const authorCounts = new Map();
    messages.forEach(m => {
        if (m.author) {
            const key = `${m.author.tag} \`${m.author.id}\``;
            authorCounts.set(key, (authorCounts.get(key) ?? 0) + 1);
        }
    });
    const authorList = [...authorCounts.entries()]
        .map(([tag, count]) => `${tag} — ${count} Nachrichten`)
        .join('\n')
        .substring(0, 1024) || 'Unbekannt (nicht gecacht)';

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Massenlöschung')
        .setColor(0xff4500)
        .setTimestamp()
        .addFields(
            { name: '📌 Kanal',        value: `${channel} \`${channel.name}\``,   inline: true },
            { name: '🔢 Anzahl',       value: `${messages.size} Nachrichten`,      inline: true },
            { name: '👤 Gelöscht von', value: fmtExecutor(executor),               inline: true },
            { name: '👥 Betroffene Autoren', value: authorList,                    inline: false }
        )
        .setFooter({ text: `Channel ID: ${channel.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MESSAGE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Emoji logs ────────────────────────────────────────────────────────────────

async function logEmojiCreate(emoji, bot) {
    const executor = await fetchAuditExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);

    const embed = new EmbedBuilder()
        .setTitle('😄 Emoji hinzugefügt')
        .setColor(0x57F287)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',          value: `:${emoji.name}:`,                      inline: true },
            { name: '🆔 ID',            value: `\`${emoji.id}\``,                      inline: true },
            { name: '🎭 Typ',           value: emoji.animated ? 'Animiert' : 'Statisch', inline: true },
            { name: '👤 Hinzugefügt von', value: fmtExecutor(executor),                inline: true }
        )
        .setFooter({ text: `Emoji ID: ${emoji.id}` });

    if (emoji.url) embed.setThumbnail(emoji.url);

    const logChannel = await getLogChannel(bot, bot.CONFIG.ROLE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logEmojiDelete(emoji, bot) {
    const executor = await fetchAuditExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);

    const embed = new EmbedBuilder()
        .setTitle('😶 Emoji entfernt')
        .setColor(0xED4245)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',         value: `:${emoji.name}:`,    inline: true },
            { name: '🆔 ID',           value: `\`${emoji.id}\``,    inline: true },
            { name: '👤 Entfernt von', value: fmtExecutor(executor), inline: true }
        )
        .setFooter({ text: `Emoji ID: ${emoji.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.ROLE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logEmojiUpdate(oldEmoji, newEmoji, bot) {
    if (oldEmoji.name === newEmoji.name) return;

    const embed = new EmbedBuilder()
        .setTitle('✏️ Emoji umbenannt')
        .setColor(0xffcc00)
        .setTimestamp()
        .addFields(
            { name: '📝 Alt', value: `:${oldEmoji.name}:`, inline: true },
            { name: '📝 Neu', value: `:${newEmoji.name}:`, inline: true }
        )
        .setFooter({ text: `Emoji ID: ${newEmoji.id}` });

    if (newEmoji.url) embed.setThumbnail(newEmoji.url);

    const logChannel = await getLogChannel(bot, bot.CONFIG.ROLE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Sticker logs ──────────────────────────────────────────────────────────────

async function logStickerCreate(sticker, bot) {
    const guild = sticker.guild ?? bot.client.guilds.cache.get(sticker.guildId);
    const executor = guild ? await fetchAuditExecutor(guild, AuditLogEvent.StickerCreate, sticker.id) : null;

    const embed = new EmbedBuilder()
        .setTitle('🏷️ Sticker hinzugefügt')
        .setColor(0x57F287)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',            value: sticker.name,                    inline: true },
            { name: '🆔 ID',              value: `\`${sticker.id}\``,             inline: true },
            { name: '👤 Hinzugefügt von', value: fmtExecutor(executor),           inline: true },
            { name: '📝 Beschreibung',    value: sticker.description || 'Keine',  inline: false }
        )
        .setFooter({ text: `Sticker ID: ${sticker.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.ROLE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logStickerDelete(sticker, bot) {
    const guild = sticker.guild ?? bot.client.guilds.cache.get(sticker.guildId);
    const executor = guild ? await fetchAuditExecutor(guild, AuditLogEvent.StickerDelete, sticker.id) : null;

    const embed = new EmbedBuilder()
        .setTitle('🏷️ Sticker entfernt')
        .setColor(0xED4245)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',         value: sticker.name,        inline: true },
            { name: '🆔 ID',           value: `\`${sticker.id}\``, inline: true },
            { name: '👤 Entfernt von', value: fmtExecutor(executor), inline: true }
        )
        .setFooter({ text: `Sticker ID: ${sticker.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.ROLE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logStickerUpdate(oldSticker, newSticker, bot) {
    const changes = [];
    if (oldSticker.name !== newSticker.name)
        changes.push(`**Name:** \`${oldSticker.name}\` → \`${newSticker.name}\``);
    if (oldSticker.description !== newSticker.description)
        changes.push(`**Beschreibung:** ${oldSticker.description || 'Keine'} → ${newSticker.description || 'Keine'}`);
    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('✏️ Sticker aktualisiert')
        .setColor(0xffcc00)
        .setTimestamp()
        .addFields({ name: '📝 Änderungen', value: changes.join('\n'), inline: false })
        .setFooter({ text: `Sticker ID: ${newSticker.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.ROLE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Invite logs ───────────────────────────────────────────────────────────────

async function logInviteCreate(invite, bot) {
    const embed = new EmbedBuilder()
        .setTitle('🔗 Einladung erstellt')
        .setColor(0x57F287)
        .setTimestamp()
        .addFields(
            { name: '🔑 Code',     value: `\`${invite.code}\``,                                              inline: true },
            { name: '👤 Erstellt', value: invite.inviter?.toString() ?? 'Unbekannt',                          inline: true },
            { name: '📌 Kanal',    value: invite.channel?.toString() ?? 'Unbekannt',                          inline: true },
            { name: '⏱️ Läuft ab', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:F>` : 'Nie', inline: true },
            { name: '🔢 Max. Nutzungen', value: invite.maxUses ? `${invite.maxUses}` : '∞',                  inline: true }
        )
        .setFooter({ text: `Invite Code: ${invite.code}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MEMBER_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logInviteDelete(invite, bot) {
    const embed = new EmbedBuilder()
        .setTitle('🔗 Einladung gelöscht')
        .setColor(0xED4245)
        .setTimestamp()
        .addFields(
            { name: '🔑 Code',  value: `\`${invite.code}\``,                 inline: true },
            { name: '📌 Kanal', value: invite.channel?.toString() ?? 'Unbekannt', inline: true }
        )
        .setFooter({ text: `Invite Code: ${invite.code}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MEMBER_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Thread logs ───────────────────────────────────────────────────────────────

async function logThreadCreate(thread, bot) {
    const executor = await fetchAuditExecutor(thread.guild, AuditLogEvent.ThreadCreate, thread.id);

    const embed = new EmbedBuilder()
        .setTitle('🧵 Thread erstellt')
        .setColor(0x57F287)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',          value: thread.name,                              inline: true },
            { name: '🆔 ID',            value: `\`${thread.id}\``,                       inline: true },
            { name: '📌 In',            value: thread.parent?.toString() ?? 'Unbekannt',  inline: true },
            { name: '👤 Erstellt von',  value: fmtExecutor(executor),                    inline: true }
        )
        .setFooter({ text: `Thread ID: ${thread.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logThreadDelete(thread, bot) {
    const executor = await fetchAuditExecutor(thread.guild, AuditLogEvent.ThreadDelete, thread.id);

    const embed = new EmbedBuilder()
        .setTitle('🧵 Thread gelöscht')
        .setColor(0xED4245)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',         value: thread.name,         inline: true },
            { name: '🆔 ID',           value: `\`${thread.id}\``,  inline: true },
            { name: '👤 Gelöscht von', value: fmtExecutor(executor), inline: true }
        )
        .setFooter({ text: `Thread ID: ${thread.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logThreadUpdate(oldThread, newThread, bot) {
    const changes = [];
    if (oldThread.name !== newThread.name)
        changes.push(`**Name:** \`${oldThread.name}\` → \`${newThread.name}\``);
    if (oldThread.archived !== newThread.archived)
        changes.push(`**Archiviert:** ${oldThread.archived ? 'Ja' : 'Nein'} → ${newThread.archived ? 'Ja' : 'Nein'}`);
    if (oldThread.locked !== newThread.locked)
        changes.push(`**Gesperrt:** ${oldThread.locked ? 'Ja' : 'Nein'} → ${newThread.locked ? 'Ja' : 'Nein'}`);
    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('✏️ Thread aktualisiert')
        .setColor(0xffcc00)
        .setTimestamp()
        .addFields(
            { name: '📛 Thread', value: `${newThread} \`${newThread.name}\``, inline: true },
            { name: '📝 Änderungen', value: changes.join('\n'), inline: false }
        )
        .setFooter({ text: `Thread ID: ${newThread.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Reaction logs ─────────────────────────────────────────────────────────────

async function logReactionAdd(reaction, user, bot) {
    if (user.bot) return;
    if (reaction.partial) {
        try { reaction = await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }
    if (!reaction.message.guild || reaction.message.guild.id !== bot.CONFIG.GUILD_ID) return;

    const emoji = reaction.emoji.id
        ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name;

    const embed = new EmbedBuilder()
        .setTitle('👍 Reaktion hinzugefügt')
        .setColor(0x57F287)
        .setTimestamp()
        .addFields(
            { name: '👤 Nutzer',    value: `${user} (${user.tag})\n\`${user.id}\``,           inline: true },
            { name: '😀 Emoji',     value: emoji,                                               inline: true },
            { name: '📌 Kanal',     value: `${reaction.message.channel}`,                       inline: true },
            { name: '🔗 Nachricht', value: `[Zur Nachricht](${reaction.message.url})`,          inline: true }
        )
        .setFooter({ text: `Message ID: ${reaction.message.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MESSAGE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logReactionRemove(reaction, user, bot) {
    if (user.bot) return;
    if (reaction.partial) {
        try { reaction = await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }
    if (!reaction.message.guild || reaction.message.guild.id !== bot.CONFIG.GUILD_ID) return;

    const emoji = reaction.emoji.id
        ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name;

    const embed = new EmbedBuilder()
        .setTitle('👎 Reaktion entfernt')
        .setColor(0xED4245)
        .setTimestamp()
        .addFields(
            { name: '👤 Nutzer',    value: `${user} (${user.tag})\n\`${user.id}\``,           inline: true },
            { name: '😀 Emoji',     value: emoji,                                               inline: true },
            { name: '📌 Kanal',     value: `${reaction.message.channel}`,                       inline: true },
            { name: '🔗 Nachricht', value: `[Zur Nachricht](${reaction.message.url})`,          inline: true }
        )
        .setFooter({ text: `Message ID: ${reaction.message.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.MESSAGE_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Scheduled Event logs ──────────────────────────────────────────────────────

function scheduledEventStatusName(status) {
    const map = { 1: 'Geplant', 2: 'Aktiv', 3: 'Abgeschlossen', 4: 'Abgebrochen' };
    return map[status] ?? `Unbekannt (${status})`;
}

async function logScheduledEventCreate(event, bot) {
    const embed = new EmbedBuilder()
        .setTitle('📅 Server-Event erstellt')
        .setColor(0x57F287)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',      value: event.name,                                                                                          inline: true },
            { name: '🆔 ID',        value: `\`${event.id}\``,                                                                                   inline: true },
            { name: '👤 Ersteller', value: event.creator?.toString() ?? 'Unbekannt',                                                            inline: true },
            { name: '⏰ Start',     value: event.scheduledStartTimestamp ? `<t:${Math.floor(event.scheduledStartTimestamp / 1000)}:F>` : 'Unbekannt', inline: true },
            { name: '⏱️ Ende',     value: event.scheduledEndTimestamp   ? `<t:${Math.floor(event.scheduledEndTimestamp / 1000)}:F>`   : 'Kein Ende',  inline: true }
        )
        .setFooter({ text: `Event ID: ${event.id}` });

    if (event.description) embed.addFields({ name: '📝 Beschreibung', value: event.description.substring(0, 1024), inline: false });
    if (event.coverImageURL()) embed.setThumbnail(event.coverImageURL());

    const logChannel = await getLogChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logScheduledEventUpdate(oldEvent, newEvent, bot) {
    const changes = [];
    if (oldEvent.name !== newEvent.name)
        changes.push(`**Name:** \`${oldEvent.name}\` → \`${newEvent.name}\``);
    if (oldEvent.description !== newEvent.description)
        changes.push(`**Beschreibung:** Geändert`);
    if (oldEvent.status !== newEvent.status)
        changes.push(`**Status:** ${scheduledEventStatusName(oldEvent.status)} → ${scheduledEventStatusName(newEvent.status)}`);
    if (oldEvent.scheduledStartTimestamp !== newEvent.scheduledStartTimestamp)
        changes.push(`**Start:** <t:${Math.floor(newEvent.scheduledStartTimestamp / 1000)}:F>`);
    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('📅 Server-Event aktualisiert')
        .setColor(0xffcc00)
        .setTimestamp()
        .addFields(
            { name: '📛 Event',                         value: `\`${newEvent.name}\``,                   inline: true },
            { name: '🆔 ID',                            value: `\`${newEvent.id}\``,                     inline: true },
            { name: `📝 Änderungen (${changes.length})`, value: changes.join('\n').substring(0, 1024),   inline: false }
        )
        .setFooter({ text: `Event ID: ${newEvent.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logScheduledEventDelete(event, bot) {
    const embed = new EmbedBuilder()
        .setTitle('📅 Server-Event gelöscht')
        .setColor(0xED4245)
        .setTimestamp()
        .addFields(
            { name: '📛 Name', value: event.name,        inline: true },
            { name: '🆔 ID',   value: `\`${event.id}\``, inline: true }
        )
        .setFooter({ text: `Event ID: ${event.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Webhook logs ──────────────────────────────────────────────────────────────

async function logWebhookUpdate(channel, bot) {
    const embed = new EmbedBuilder()
        .setTitle('🔗 Webhook geändert')
        .setColor(0xffcc00)
        .setTimestamp()
        .addFields(
            { name: '📌 Kanal', value: `${channel} \`${channel.name}\``, inline: true },
            { name: '🆔 ID',    value: `\`${channel.id}\``,               inline: true }
        )
        .setFooter({ text: `Channel ID: ${channel.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Stage Instance logs ───────────────────────────────────────────────────────

async function logStageCreate(stageInstance, bot) {
    const embed = new EmbedBuilder()
        .setTitle('🎭 Stage gestartet')
        .setColor(0x57F287)
        .setTimestamp()
        .addFields(
            { name: '📋 Thema', value: stageInstance.topic || 'Kein Thema', inline: true },
            { name: '🆔 ID',    value: `\`${stageInstance.id}\``,            inline: true }
        )
        .setFooter({ text: `Stage ID: ${stageInstance.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logStageUpdate(oldStage, newStage, bot) {
    if (oldStage.topic === newStage.topic) return;

    const embed = new EmbedBuilder()
        .setTitle('🎭 Stage aktualisiert')
        .setColor(0xffcc00)
        .setTimestamp()
        .addFields(
            { name: '📋 Alt', value: oldStage.topic || 'Kein Thema', inline: true },
            { name: '📋 Neu', value: newStage.topic || 'Kein Thema', inline: true }
        )
        .setFooter({ text: `Stage ID: ${newStage.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logStageDelete(stageInstance, bot) {
    const embed = new EmbedBuilder()
        .setTitle('🎭 Stage beendet')
        .setColor(0xED4245)
        .setTimestamp()
        .addFields(
            { name: '📋 Thema', value: stageInstance.topic || 'Kein Thema', inline: true },
            { name: '🆔 ID',    value: `\`${stageInstance.id}\``,            inline: true }
        )
        .setFooter({ text: `Stage ID: ${stageInstance.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.CHANNEL_LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// ── Auto Moderation logs ──────────────────────────────────────────────────────

async function logAutoModRuleCreate(rule, bot) {
    const embed = new EmbedBuilder()
        .setTitle('🛡️ Auto-Mod Regel erstellt')
        .setColor(0x57F287)
        .setTimestamp()
        .addFields(
            { name: '📛 Name',   value: rule.name,                        inline: true },
            { name: '🆔 ID',    value: `\`${rule.id}\``,                  inline: true },
            { name: '✅ Aktiv', value: rule.enabled ? 'Ja' : 'Nein',     inline: true }
        )
        .setFooter({ text: `Rule ID: ${rule.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logAutoModRuleDelete(rule, bot) {
    const embed = new EmbedBuilder()
        .setTitle('🛡️ Auto-Mod Regel gelöscht')
        .setColor(0xED4245)
        .setTimestamp()
        .addFields(
            { name: '📛 Name', value: rule.name,        inline: true },
            { name: '🆔 ID',   value: `\`${rule.id}\``, inline: true }
        )
        .setFooter({ text: `Rule ID: ${rule.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logAutoModRuleUpdate(oldRule, newRule, bot) {
    const changes = [];
    if (oldRule.name !== newRule.name)
        changes.push(`**Name:** \`${oldRule.name}\` → \`${newRule.name}\``);
    if (oldRule.enabled !== newRule.enabled)
        changes.push(`**Aktiv:** ${oldRule.enabled ? 'Ja' : 'Nein'} → ${newRule.enabled ? 'Ja' : 'Nein'}`);
    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Auto-Mod Regel aktualisiert')
        .setColor(0xffcc00)
        .setTimestamp()
        .addFields(
            { name: '📛 Regel',       value: `\`${newRule.name}\``,    inline: true },
            { name: '🆔 ID',          value: `\`${newRule.id}\``,      inline: true },
            { name: '📝 Änderungen',  value: changes.join('\n'),       inline: false }
        )
        .setFooter({ text: `Rule ID: ${newRule.id}` });

    const logChannel = await getLogChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

async function logAutoModActionExecution(execution, bot) {
    if (execution.guild?.id !== bot.CONFIG.GUILD_ID) return;

    const actionTypeNames = { 1: 'Nachricht blockiert', 2: 'Alert gesendet', 3: 'Timeout' };
    const actionType = actionTypeNames[execution.action?.type] ?? `Unbekannt (${execution.action?.type})`;

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Auto-Mod ausgelöst')
        .setColor(0xff8c00)
        .setTimestamp()
        .addFields(
            { name: '👤 Nutzer',  value: `<@${execution.userId}> \`${execution.userId}\``,               inline: true },
            { name: '⚡ Aktion', value: actionType,                                                        inline: true },
            { name: '📌 Kanal',  value: execution.channelId ? `<#${execution.channelId}>` : 'Unbekannt', inline: true }
        )
        .setFooter({ text: `Rule ID: ${execution.ruleId}` });

    if (execution.content) {
        embed.addFields({
            name: '📝 Inhalt',
            value: execution.content.length > 1024 ? execution.content.substring(0, 1020) + '…' : execution.content,
            inline: false
        });
    }
    if (execution.matchedContent) {
        embed.addFields({ name: '🚨 Erkannter Inhalt', value: `\`${execution.matchedContent.substring(0, 200)}\``, inline: false });
    }

    const logChannel = await getLogChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (logChannel) await logChannel.send({ embeds: [embed] });
}

// Haupt-Event-Handler Registrierung
function registerEventHandlers(bot) {
    bot.applicationHandler = new ApplicationHandler(bot);

    // Nur EINEN ready Event-Listener verwenden
    bot.client.once('ready', async () => {
        console.log(`${bot.client.user.tag} is ready!`);
        
        await registerCommands(bot);
        await updateStatus(bot);
        setInterval(() => updateStatus(bot), 5 * 60 * 1000);
        await setupTicketChannel(bot);
        await bot.applicationHandler.setupApplicationPanel();
        
        setInterval(() => bot.applicationHandler.checkSessions(), 60 * 1000);
        
        bot.client.user.setActivity('applications', { type: 'WATCHING' });
        
        console.log('All systems initialized successfully');

        // Verify all log channels are accessible
        const channelChecks = [
            ['LOG_CHANNEL (Moderation)',    bot.CONFIG.LOG_CHANNEL],
            ['MESSAGE_LOG_CHANNEL',         bot.CONFIG.MESSAGE_LOG_CHANNEL],
            ['CHANNEL_LOG_CHANNEL',         bot.CONFIG.CHANNEL_LOG_CHANNEL],
            ['ROLE_LOG_CHANNEL',            bot.CONFIG.ROLE_LOG_CHANNEL],
            ['MEMBER_LOG_CHANNEL',          bot.CONFIG.MEMBER_LOG_CHANNEL],
            ['USER_LOG_CHANNEL',            bot.CONFIG.USER_LOG_CHANNEL],
            ['WELCOME_CHANNEL',             bot.CONFIG.WELCOME_CHANNEL],
            ['TRANSCRIPT_CHANNEL',          bot.CONFIG.TRANSCRIPT_CHANNEL],
        ];

        console.log('\n=== Kanal-Status-Check ===');
        for (const [name, id] of channelChecks) {
            const ch = await getLogChannel(bot, id);
            if (ch) {
                console.log(`  ✅ ${name}: #${ch.name} (${id})`);
            } else {
                console.error(`  ❌ ${name}: NICHT GEFUNDEN oder kein Zugriff (ID: ${id})`);
            }
        }
        console.log('=========================\n');
    });

    bot.client.on('interactionCreate', async (interaction) => {
      try {
        // Application system interactions
        if (interaction.isStringSelectMenu() && interaction.customId === 'application_select') {
            await bot.applicationHandler.handleApplicationSelect(interaction);
        }

        if (interaction.isButton() && interaction.customId.startsWith('application_start_')) {
            await bot.applicationHandler.startApplication(interaction);
        }

        if (interaction.isButton() && interaction.customId === 'application_cancel') {
            await bot.applicationHandler.cancelApplication(interaction, 'user_cancelled');
        }

        // Summary actions
        if (interaction.isButton() && (
            interaction.customId === 'application_submit' ||
            interaction.customId === 'application_edit' ||
            interaction.customId === 'application_cancel_final'
        )) {
            await bot.applicationHandler.handleSummaryAction(interaction);
        }

        // Edit modal
        if (interaction.isModalSubmit() && interaction.customId.startsWith('application_edit_modal_')) {
            await bot.applicationHandler.handleEditModal(interaction);
        }

        // Manager actions
        if (interaction.isButton()) {
            const customId = interaction.customId;
            if (customId.startsWith('application_accept_') || 
                customId.startsWith('application_deny_') ||
                customId.startsWith('application_accept_reason_') ||
                customId.startsWith('application_deny_reason_') ||
                customId.startsWith('application_ticket_')) {
                await bot.applicationHandler.handleManagerAction(interaction);
            }
        }

        // Reason modals for manager actions
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            if (customId.startsWith('application_accept_modal_') || 
                customId.startsWith('application_deny_modal_')) {
                await bot.applicationHandler.handleReasonModal(interaction);
            }
        }

        // Ticket system interactions
        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            await handleCloseTicket(interaction, bot);
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            await handleTicketSelect(interaction, bot);
        }

        // Close-request confirm/cancel buttons (sent by /tickets close command)
        if (interaction.isButton() && interaction.customId === 'close_request_confirm') {
            await handleCloseRequestConfirm(interaction, bot);
        }

        if (interaction.isButton() && interaction.customId === 'close_request_cancel') {
            await handleCloseRequestCancel(interaction, bot);
        }

        // Report action buttons (sent by /report command)
        if (interaction.isButton() && interaction.customId.startsWith('report_')) {
            await handleReportButton(interaction, bot);
        }

        if (interaction.isCommand()) {
            await handleCommand(interaction, bot);
        }
      } catch (err) {
          console.error('[interactionCreate] Unbehandelter Fehler:', err);
          try {
              const reply = { content: MSG.GENERIC_ERROR, ephemeral: true };
              if (interaction.deferred || interaction.replied) {
                  await interaction.followUp(reply);
              } else {
                  await interaction.reply(reply);
              }
          } catch { /* ignore */ }
      }
    });

    bot.client.on('messageCreate', async (message) => {
        if (message.channel.type === 1 && !message.author.bot) {
            await bot.applicationHandler.handleApplicationAnswer(message);
        }
    });

    bot.client.on('guildMemberAdd', async (member) => {
        if (member.guild.id !== bot.CONFIG.GUILD_ID) return;

        try {
            if (member.user.bot) {
                const botRole = member.guild.roles.cache.get(bot.CONFIG.BOT_ROLE);
                if (botRole) await member.roles.add(botRole);
            } else {
                const joinRole = member.guild.roles.cache.get(bot.CONFIG.JOIN_ROLE);
                if (joinRole) await member.roles.add(joinRole);
            }
        } catch (err) {
            console.error('[guildMemberAdd] Role assignment failed:', err);
        }

        // Send welcome message
        if (!member.user.bot) {
            try {
                const welcomeChannel = await getLogChannel(bot, bot.CONFIG.WELCOME_CHANNEL);
                if (welcomeChannel) {
                    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle('👋 Willkommen!')
                        .setDescription(`Hey ${member.user}! Willkommen auf **${member.guild.name}**!\n\nSchau dir die Regeln an und fühl dich wie zu Hause. ✨`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .setColor(0x57F287)
                        .setTimestamp()
                        .addFields(
                            { name: '👤 Nutzer', value: `${member.user.tag}`, inline: true },
                            { name: '📅 Account erstellt', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                            { name: '👥 Mitglied Nr.', value: `#${member.guild.memberCount}`, inline: true }
                        );
                    await welcomeChannel.send({ embeds: [welcomeEmbed] });
                } else {
                    console.error('[guildMemberAdd] WELCOME_CHANNEL nicht gefunden:', bot.CONFIG.WELCOME_CHANNEL);
                }
            } catch (err) {
                console.error('[guildMemberAdd] Willkommensnachricht fehlgeschlagen:', err);
            }
        }

        try {
            await logMemberJoin(member, bot);
        } catch (err) {
            console.error('[guildMemberAdd] logMemberJoin fehlgeschlagen:', err);
        }
    });

    bot.client.on('guildMemberRemove', async (member) => {
        if (member.guild.id !== bot.CONFIG.GUILD_ID) return;

        try {
            await logMemberLeave(member, bot);
        } catch (err) {
            console.error('[guildMemberRemove] logMemberLeave fehlgeschlagen:', err);
        }

        // Check if it was a kick (not a ban or leave)
        try {
            const auditLogs = await member.guild.fetchAuditLogs({ type: 20, limit: 1 });
            const kickLog = auditLogs.entries.first();
            if (kickLog && kickLog.target.id === member.id) {
                if (kickLog.executor?.id === bot.client.user.id) return;
                await logManualModeration({
                    guild: member.guild,
                    user: member.user,
                    executor: kickLog.executor,
                    reason: kickLog.reason || 'No reason provided'
                }, 'kick', bot);
            }
        } catch (error) {
            console.error('[guildMemberRemove] Kick audit log Fehler:', error);
        }
    });

    bot.client.on('guildMemberUpdate', async (oldMember, newMember) => {
        // Check for timeout (mute)
        if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
            try {
                const auditLogs = await newMember.guild.fetchAuditLogs({
                    type: 24, // MEMBER_UPDATE
                    limit: 1
                });
                
                const muteLog = auditLogs.entries.first();
                if (muteLog && muteLog.target.id === newMember.id && muteLog.executor?.id !== bot.client.user.id) {
                    await logManualModeration({
                        guild: newMember.guild,
                        user: newMember.user,
                        executor: muteLog.executor,
                        reason: muteLog.reason || 'No reason provided'
                    }, 'mute', bot);
                }
            } catch (error) {
                console.error('Error checking mute audit log:', error);
            }
        }
        
        // Check for timeout removal (unmute)
        if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
            try {
                const auditLogs = await newMember.guild.fetchAuditLogs({
                    type: 24, // MEMBER_UPDATE
                    limit: 1
                });

                const unmuteLog = auditLogs.entries.first();
                if (unmuteLog && unmuteLog.target.id === newMember.id && unmuteLog.executor?.id !== bot.client.user.id) {
                    await logManualModeration({
                        guild: newMember.guild,
                        user: newMember.user,
                        executor: unmuteLog.executor,
                        reason: unmuteLog.reason || 'No reason provided'
                    }, 'unmute', bot);
                }
            } catch (error) {
                console.error('Error checking unmute audit log:', error);
            }
        }

        // Nickname change
        if (oldMember.nickname !== newMember.nickname) {
            try { await logMemberNicknameChange(oldMember, newMember, bot); }
            catch (err) { console.error('[guildMemberUpdate] logMemberNicknameChange Fehler:', err); }
        }

        // Role change
        const oldRoleIds = oldMember.roles.cache.map(r => r.id).sort().join(',');
        const newRoleIds = newMember.roles.cache.map(r => r.id).sort().join(',');
        if (oldRoleIds !== newRoleIds) {
            try { await logMemberRoleChange(oldMember, newMember, bot); }
            catch (err) { console.error('[guildMemberUpdate] logMemberRoleChange Fehler:', err); }
        }
    });

    bot.client.on('guildBanAdd', async (ban) => {
        try {
            const auditLogs = await ban.guild.fetchAuditLogs({ type: 22, limit: 1 }); // MemberBanAdd
            const entry = auditLogs.entries.first();
            if (entry?.executor?.id === bot.client.user.id) return;
            await logManualModeration({
                guild: ban.guild,
                user: ban.user,
                executor: entry?.executor,
                reason: entry?.reason || ban.reason || 'No reason provided'
            }, 'ban', bot);
        } catch (error) {
            console.error('Error checking ban audit log:', error);
        }
    });

    bot.client.on('guildBanRemove', async (ban) => {
        try {
            const auditLogs = await ban.guild.fetchAuditLogs({ type: 23, limit: 1 }); // MemberBanRemove
            const entry = auditLogs.entries.first();
            if (entry?.executor?.id === bot.client.user.id) return;
            await logManualModeration({
                guild: ban.guild,
                user: ban.user,
                executor: entry?.executor,
                reason: entry?.reason || 'No reason provided'
            }, 'unban', bot);
        } catch (error) {
            console.error('Error checking unban audit log:', error);
        }
    });

    // Message logging events
    bot.client.on('messageDelete', async (message) => {
        if (message.guild && message.guild.id === bot.CONFIG.GUILD_ID) {
            try { await logMessageDelete(message, bot); }
            catch (err) { console.error('[messageDelete] Fehler:', err); }
        }
    });

    bot.client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (newMessage.guild && newMessage.guild.id === bot.CONFIG.GUILD_ID) {
            try { await logMessageUpdate(oldMessage, newMessage, bot); }
            catch (err) { console.error('[messageUpdate] Fehler:', err); }
        }
    });

    // Channel logging events
    bot.client.on('channelCreate', async (channel) => {
        if (channel.guild && channel.guild.id === bot.CONFIG.GUILD_ID) {
            try { await logChannelCreate(channel, bot); }
            catch (err) { console.error('[channelCreate] Fehler:', err); }
        }
    });

    bot.client.on('channelDelete', async (channel) => {
        if (channel.guild && channel.guild.id === bot.CONFIG.GUILD_ID) {
            try { await logChannelDelete(channel, bot); }
            catch (err) { console.error('[channelDelete] Fehler:', err); }
        }
    });

    bot.client.on('channelUpdate', async (oldChannel, newChannel) => {
        if (newChannel.guild && newChannel.guild.id === bot.CONFIG.GUILD_ID) {
            try { await logChannelUpdate(oldChannel, newChannel, bot); }
            catch (err) { console.error('[channelUpdate] Fehler:', err); }
        }
    });

    // Role logging events
    bot.client.on('roleCreate', async (role) => {
        if (role.guild.id === bot.CONFIG.GUILD_ID) {
            try { await logRoleCreate(role, bot); }
            catch (err) { console.error('[roleCreate] Fehler:', err); }
        }
    });

    bot.client.on('roleDelete', async (role) => {
        if (role.guild.id === bot.CONFIG.GUILD_ID) {
            try { await logRoleDelete(role, bot); }
            catch (err) { console.error('[roleDelete] Fehler:', err); }
        }
    });

    bot.client.on('roleUpdate', async (oldRole, newRole) => {
        if (newRole.guild.id === bot.CONFIG.GUILD_ID) {
            try { await logRoleUpdate(oldRole, newRole, bot); }
            catch (err) { console.error('[roleUpdate] Fehler:', err); }
        }
    });

    // User logging events
    bot.client.on('userUpdate', async (oldUser, newUser) => {
        try { await logUserUpdate(oldUser, newUser, bot); }
        catch (err) { console.error('[userUpdate] Fehler:', err); }
    });

    // Guild (server) update
    bot.client.on('guildUpdate', async (oldGuild, newGuild) => {
        if (newGuild.id !== bot.CONFIG.GUILD_ID) return;
        try { await logGuildUpdate(oldGuild, newGuild, bot); }
        catch (err) { console.error('[guildUpdate] Fehler:', err); }
    });

    // Voice state logging
    bot.client.on('voiceStateUpdate', async (oldState, newState) => {
        if ((newState.guild ?? oldState.guild)?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logVoiceUpdate(oldState, newState, bot); }
        catch (err) { console.error('[voiceStateUpdate] Fehler:', err); }
    });

    // Bulk message delete
    bot.client.on('messageDeleteBulk', async (messages, channel) => {
        if (channel.guild && channel.guild.id === bot.CONFIG.GUILD_ID) {
            try { await logBulkDelete(messages, channel, bot); }
            catch (err) { console.error('[messageDeleteBulk] Fehler:', err); }
        }
    });

    // Emoji events
    bot.client.on('emojiCreate', async (emoji) => {
        if (emoji.guild.id !== bot.CONFIG.GUILD_ID) return;
        try { await logEmojiCreate(emoji, bot); }
        catch (err) { console.error('[emojiCreate] Fehler:', err); }
    });

    bot.client.on('emojiDelete', async (emoji) => {
        if (emoji.guild.id !== bot.CONFIG.GUILD_ID) return;
        try { await logEmojiDelete(emoji, bot); }
        catch (err) { console.error('[emojiDelete] Fehler:', err); }
    });

    bot.client.on('emojiUpdate', async (oldEmoji, newEmoji) => {
        if (newEmoji.guild.id !== bot.CONFIG.GUILD_ID) return;
        try { await logEmojiUpdate(oldEmoji, newEmoji, bot); }
        catch (err) { console.error('[emojiUpdate] Fehler:', err); }
    });

    // Sticker events
    bot.client.on('stickerCreate', async (sticker) => {
        if (sticker.guildId !== bot.CONFIG.GUILD_ID) return;
        try { await logStickerCreate(sticker, bot); }
        catch (err) { console.error('[stickerCreate] Fehler:', err); }
    });

    bot.client.on('stickerDelete', async (sticker) => {
        if (sticker.guildId !== bot.CONFIG.GUILD_ID) return;
        try { await logStickerDelete(sticker, bot); }
        catch (err) { console.error('[stickerDelete] Fehler:', err); }
    });

    bot.client.on('stickerUpdate', async (oldSticker, newSticker) => {
        if (newSticker.guildId !== bot.CONFIG.GUILD_ID) return;
        try { await logStickerUpdate(oldSticker, newSticker, bot); }
        catch (err) { console.error('[stickerUpdate] Fehler:', err); }
    });

    // Invite events
    bot.client.on('inviteCreate', async (invite) => {
        if (invite.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logInviteCreate(invite, bot); }
        catch (err) { console.error('[inviteCreate] Fehler:', err); }
    });

    bot.client.on('inviteDelete', async (invite) => {
        if (invite.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logInviteDelete(invite, bot); }
        catch (err) { console.error('[inviteDelete] Fehler:', err); }
    });

    // Thread events
    bot.client.on('threadCreate', async (thread) => {
        if (thread.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logThreadCreate(thread, bot); }
        catch (err) { console.error('[threadCreate] Fehler:', err); }
    });

    bot.client.on('threadDelete', async (thread) => {
        if (thread.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logThreadDelete(thread, bot); }
        catch (err) { console.error('[threadDelete] Fehler:', err); }
    });

    bot.client.on('threadUpdate', async (oldThread, newThread) => {
        if (newThread.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logThreadUpdate(oldThread, newThread, bot); }
        catch (err) { console.error('[threadUpdate] Fehler:', err); }
    });

    // Reaction events
    bot.client.on('messageReactionAdd', async (reaction, user) => {
        try { await logReactionAdd(reaction, user, bot); }
        catch (err) { console.error('[messageReactionAdd] Fehler:', err); }
    });

    bot.client.on('messageReactionRemove', async (reaction, user) => {
        try { await logReactionRemove(reaction, user, bot); }
        catch (err) { console.error('[messageReactionRemove] Fehler:', err); }
    });

    // Scheduled event events
    bot.client.on('guildScheduledEventCreate', async (event) => {
        if (event.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logScheduledEventCreate(event, bot); }
        catch (err) { console.error('[guildScheduledEventCreate] Fehler:', err); }
    });

    bot.client.on('guildScheduledEventUpdate', async (oldEvent, newEvent) => {
        if (newEvent.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logScheduledEventUpdate(oldEvent, newEvent, bot); }
        catch (err) { console.error('[guildScheduledEventUpdate] Fehler:', err); }
    });

    bot.client.on('guildScheduledEventDelete', async (event) => {
        if (event.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logScheduledEventDelete(event, bot); }
        catch (err) { console.error('[guildScheduledEventDelete] Fehler:', err); }
    });

    // Webhook events
    bot.client.on('webhooksUpdate', async (channel) => {
        if (channel.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logWebhookUpdate(channel, bot); }
        catch (err) { console.error('[webhooksUpdate] Fehler:', err); }
    });

    // Stage instance events
    bot.client.on('stageInstanceCreate', async (stageInstance) => {
        if (stageInstance.guildId !== bot.CONFIG.GUILD_ID) return;
        try { await logStageCreate(stageInstance, bot); }
        catch (err) { console.error('[stageInstanceCreate] Fehler:', err); }
    });

    bot.client.on('stageInstanceUpdate', async (oldStage, newStage) => {
        if (newStage.guildId !== bot.CONFIG.GUILD_ID) return;
        try { await logStageUpdate(oldStage, newStage, bot); }
        catch (err) { console.error('[stageInstanceUpdate] Fehler:', err); }
    });

    bot.client.on('stageInstanceDelete', async (stageInstance) => {
        if (stageInstance.guildId !== bot.CONFIG.GUILD_ID) return;
        try { await logStageDelete(stageInstance, bot); }
        catch (err) { console.error('[stageInstanceDelete] Fehler:', err); }
    });

    // Auto moderation events
    bot.client.on('autoModerationRuleCreate', async (rule) => {
        if (rule.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logAutoModRuleCreate(rule, bot); }
        catch (err) { console.error('[autoModerationRuleCreate] Fehler:', err); }
    });

    bot.client.on('autoModerationRuleDelete', async (rule) => {
        if (rule.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logAutoModRuleDelete(rule, bot); }
        catch (err) { console.error('[autoModerationRuleDelete] Fehler:', err); }
    });

    bot.client.on('autoModerationRuleUpdate', async (oldRule, newRule) => {
        if (newRule.guild?.id !== bot.CONFIG.GUILD_ID) return;
        try { await logAutoModRuleUpdate(oldRule, newRule, bot); }
        catch (err) { console.error('[autoModerationRuleUpdate] Fehler:', err); }
    });

    bot.client.on('autoModerationActionExecution', async (execution) => {
        try { await logAutoModActionExecution(execution, bot); }
        catch (err) { console.error('[autoModerationActionExecution] Fehler:', err); }
    });

    console.log('All event handlers registered successfully');
}

async function logManualModeration(data, action, bot) {
    const logChannel = await getLogChannel(bot, bot.CONFIG.LOG_CHANNEL);
    if (!logChannel) return;

    const cfgMap = {
        ban:    { title: '🔨 User Banned (Manual)',    color: 0xff0000 },
        kick:   { title: '👢 User Kicked (Manual)',    color: 0xff8c00 },
        mute:   { title: '🔇 User Muted (Manual)',     color: 0x808080 },
        unmute: { title: '🔊 User Unmuted (Manual)',   color: 0x00cc44 },
        unban:  { title: '🔓 User Unbanned (Manual)',  color: 0x00cc44 }
    };

    const cfg = cfgMap[action];
    if (!cfg) return;

    const accountCreated = data.user?.createdTimestamp
        ? `<t:${Math.floor(data.user.createdTimestamp / 1000)}:F>`
        : 'Unknown';

    const embed = new EmbedBuilder()
        .setTitle(cfg.title)
        .setColor(cfg.color)
        .setThumbnail(data.user?.displayAvatarURL({ dynamic: true }) ?? null)
        .setTimestamp()
        .addFields(
            { name: '👤 User',            value: `${data.user} \`${data.user?.id ?? 'Unknown'}\``, inline: true },
            { name: '🛡️ Moderator',      value: data.executor?.toString() ?? 'Unknown',           inline: true },
            { name: '📅 Account Created', value: accountCreated,                                   inline: true },
            { name: '📝 Reason',          value: data.reason ?? 'No reason provided',              inline: false }
        )
        .setFooter({ text: 'Manual action via Discord' });

    if (action === 'ban') {
        embed.addFields({ name: '⏱️ Duration', value: 'Permanent', inline: true });
    }

    if (action === 'mute') {
        let muteDuration = 'Unknown';
        const reason = data.reason ?? '';
        const match  = reason.match(/(\d+)\s*(h|d|m|hours?|days?|minutes?)/i);
        if (match) {
            const u = match[2].toLowerCase();
            muteDuration = u.startsWith('h') ? `${match[1]} hours`
                : u.startsWith('d') ? `${match[1]} days`
                : `${match[1]} minutes`;
        } else if (/perm/i.test(reason)) {
            muteDuration = 'Permanent';
        }
        embed.addFields({ name: '⏱️ Duration', value: muteDuration, inline: true });
    }

    await logChannel.send({ embeds: [embed] });
}

// Exporte
module.exports = {
    registerEventHandlers,
    createTicket,
    createTicketChannel,
    closeTicketChannel,
    getLogChannel
};