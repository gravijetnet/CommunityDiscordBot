const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ChannelType, PermissionsBitField } = require('discord.js');
const MSG = require('../config/messages');

async function fetchChannel(bot, channelId) {
    if (!channelId) return null;
    try {
        return await bot.client.channels.fetch(channelId);
    } catch {
        return null;
    }
}

// Reply correctly regardless of whether the interaction was already deferred or
// replied to. Slow application actions defer first (the 3s ack window), so the
// final user-facing message must go through editReply/followUp, not reply.
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
        if (e?.code !== 10062) console.error('[safeReply] failed:', e?.message || e);
    }
}

class ApplicationHandler {
    constructor(bot) {
        this.bot = bot;
        this.sessions = new Map();
        this.summarySessions = new Map();
        this.questions = this.initializeQuestions();
    }

    initializeQuestions() {
        return {
            'Helper': [
                "What is your Minecraft in-game name?",
                "How old are you?",
                "What timezone do you live in?",
                "Why do you want to become staff on our server?",
                "What do you think about our server?",
                "How active do you plan to be on the server?",
                "What motivates you to become staff on our server?",
                "Are you staff on other servers? If so, which ones? Please provide details.",
                "What are your goals for the next 2 months on our server?",
                "How would you handle a player who is obviously hacking?",
                "Tell us a bit about yourself.",
                "Do you have any questions for us?"
            ],
            'Builder': [
                "What is your Minecraft in-game name?",
                "How old are you?",
                "What timezone do you live in?",
                "Why do you want to become a Builder on our server?",
                "What do you think about our server?",
                "How active do you plan to be?",
                "What motivates you to become a Builder on our server?",
                "Are you staff on other servers? If so, please provide details.",
                "What are your goals for the next 2 months on our server?",
                "Show us some of your builds. (URLs only, no file uploads.)",
                "Tell us a bit about yourself.",
                "Do you have any questions for us?"
            ],
            'Developer': [
                "What is your Minecraft in-game name?",
                "How old are you?",
                "What timezone do you live in?",
                "Why do you want to become a Developer on our server?",
                "What do you think about our server?",
                "How active do you plan to be?",
                "What motivates you to become a Developer on our server?",
                "Are you staff on other servers? If so, please provide details.",
                "What are your goals for the next 2 months on our server?",
                "Show us some of your work! (No file uploads; please provide links or code snippets.)",
                "Tell us a bit about yourself.",
                "Do you have any questions for us?"
            ],
            'Media': [
                "Your YouTube, Twitch, or TikTok URL",
                "What is your Minecraft in-game name?",
                "Why do you want the Media rank on our server?",
                "How long have you been creating content about our server?",
                "How often do you upload content?",
                "What do you think about our server?",
                "Do you have any questions for us?"
            ],
            'Beta-Tester': [
                "What is your Minecraft in-game name?",
                "Why do you want to become a Beta-Tester?",
                "How often do you usually play Minecraft per week?",
                "Have you participated in early-access or beta programs on other servers? If so, which ones?",
                "Are you willing to provide feedback and report bugs you find?",
                "What are you most excited to try or see on our server?",
                "How would you describe your behavior on multiplayer servers?",
                "Do you have any questions for us?"
            ]
        };
    }

    async setupApplicationPanel() {
        const channel = await fetchChannel(this.bot, this.bot.CONFIG.APPLICATION_PANEL_CHANNEL);
        if (!channel) {
            console.error('Application panel channel not found');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(MSG.APPLICATION_PANEL_TITLE)
            .setDescription(MSG.APPLICATION_PANEL_DESCRIPTION)
            .setColor(0x0000ff)
            .setFooter({ text: MSG.APPLICATION_PANEL_FOOTER });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('application_select')
            .setPlaceholder(MSG.APPLICATION_PANEL_PLACEHOLDER)
            .addOptions([
                { label: 'Helper',      value: 'Helper' },
                { label: 'Builder',     value: 'Builder' },
                { label: 'Developer',   value: 'Developer' },
                { label: 'Media',       value: 'Media' },
                { label: 'Beta-Tester', value: 'Beta-Tester' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        try {
            const messages = await channel.messages.fetch({ limit: 10 });
            const existingPanel = messages.find(msg =>
                msg.author.id === this.bot.client.user.id &&
                msg.embeds.length > 0 &&
                msg.embeds[0].title === MSG.APPLICATION_PANEL_TITLE
            );

            if (existingPanel) {
                await existingPanel.edit({ embeds: [embed], components: [row] });
                console.log('Application panel updated');
                return;
            }

            await channel.bulkDelete(messages);
        } catch (error) {
            console.error('Error clearing channel:', error);
        }

        await channel.send({ embeds: [embed], components: [row] });
        console.log('Application panel created successfully');
    }

    async handleApplicationSelect(interaction) {
        const category = interaction.values[0];

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const existingSession = this.sessions.get(interaction.user.id);
        if (existingSession && (existingSession.status === 'in_progress' || existingSession.status === 'confirmation')) {
            const embed = new EmbedBuilder()
                .setTitle("Application In Progress")
                .setDescription(MSG.APPLICATION_ALREADY_OPEN)
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        this.bot.db.get(
            "SELECT * FROM applications WHERE user_id = ? AND status = 'in_progress'",
            [interaction.user.id],
            async (err, row) => {
                if (err) {
                    console.error('Error checking existing applications:', err);
                    const embed = new EmbedBuilder()
                        .setTitle("Error")
                        .setDescription(MSG.GENERIC_DB_ERROR)
                        .setColor(0xff0000);
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                if (row) {
                    const embed = new EmbedBuilder()
                        .setTitle("Application In Progress")
                        .setDescription(MSG.APPLICATION_ALREADY_OPEN)
                        .setColor(0xff0000);
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                try {
                    const dmMessage = await this.sendApplicationConfirmation(interaction.user, category);

                    const embed = new EmbedBuilder()
                        .setTitle(MSG.APPLICATION_STARTED_TITLE)
                        .setDescription(MSG.APPLICATION_STARTED_BODY)
                        .setColor(0x00ff00);

                    const dmButton = new ButtonBuilder()
                        .setLabel(MSG.APPLICATION_OPEN_DMS_BUTTON)
                        .setURL(dmMessage.url)
                        .setStyle(ButtonStyle.Link);

                    const buttonRow = new ActionRowBuilder().addComponents(dmButton);

                    await interaction.editReply({ embeds: [embed], components: [buttonRow] });
                } catch (error) {
                    console.error('Error sending DM:', error);
                    const errorEmbed = new EmbedBuilder()
                        .setTitle("DMs Disabled")
                        .setDescription(MSG.APPLICATION_DM_BLOCKED)
                        .setColor(0xff0000);
                    await interaction.editReply({ embeds: [errorEmbed] });
                }
            }
        );
    }

    async sendApplicationConfirmation(user, category) {
        const timeoutHours = this.bot.CONFIG.APPLICATION_TIMEOUT_HOURS ?? 3;
        let description = MSG.APPLICATION_CONFIRM_BODY(category, timeoutHours);

        if (category === 'Builder') {
            description += MSG.APPLICATION_CONFIRM_BUILDER_NOTE;
        } else if (category === 'Developer') {
            description += MSG.APPLICATION_CONFIRM_DEV_NOTE;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Application — ${category}`)
            .setDescription(description)
            .setColor(0x0000ff);

        const startButton = new ButtonBuilder()
            .setCustomId(`application_start_${category}`)
            .setLabel('Start Application')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('application_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(startButton, cancelButton);

        const dm = await user.send({ embeds: [embed], components: [row] });

        this.sessions.set(user.id, {
            category: category,
            messageId: dm.id,
            status: 'confirmation',
            createdAt: new Date()
        });

        return dm;
    }

    async startApplication(interaction) {
        const category = interaction.customId.replace('application_start_', '');
        const userId = interaction.user.id;

        const startedAt = new Date();
        const timeoutHours = this.bot.CONFIG.APPLICATION_TIMEOUT_HOURS ?? 3;
        const expiresAt = new Date(startedAt.getTime() + timeoutHours * 60 * 60 * 1000);

        const self = this;
        this.bot.db.run(
            "INSERT INTO applications (user_id, username, category, answers, status, started_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [userId, interaction.user.tag, category, JSON.stringify([]), 'in_progress', startedAt.toISOString(), expiresAt.toISOString()],
            // Non-arrow so `this` is the sqlite statement; `this.lastID` is the
            // row id of THIS insert. A separate "SELECT last_insert_rowid()" is
            // connection-global and races with any concurrent INSERT.
            function (err) {
                if (err) {
                    console.error('Error creating application:', err);
                    interaction.update({ embeds: [
                        new EmbedBuilder()
                            .setTitle('Error')
                            .setDescription(MSG.GENERIC_DB_ERROR)
                            .setColor(0xff0000)
                    ], components: [] }).catch(e => console.error('[startApplication] could not ack failed DB insert:', e.message));
                    return;
                }

                const applicationId = this.lastID;

                (async () => {
                    self.sessions.set(userId, {
                        applicationId: applicationId,
                        category: category,
                        currentQuestion: 0,
                        answers: [],
                        startedAt: startedAt,
                        expiresAt: expiresAt,
                        status: 'in_progress'
                    });

                    const embed = new EmbedBuilder()
                        .setTitle(MSG.APPLICATION_IN_PROGRESS_TITLE)
                        .setDescription(MSG.APPLICATION_IN_PROGRESS_BODY(self.bot.CONFIG.APPLICATION_TIMEOUT_HOURS ?? 3))
                        .setColor(0x00ff00);

                    try {
                        await interaction.update({ embeds: [embed], components: [] });
                    } catch (error) {
                        console.error('Error updating interaction:', error);
                        await interaction.user.send({ embeds: [embed] });
                    }

                    await self.askQuestion(interaction.user, applicationId, 0);
                })();
            }
        );
    }

    async askQuestion(user, applicationId, questionIndex) {
        const session = this.sessions.get(user.id);
        if (!session) return;

        const questions = this.questions[session.category];
        if (!questions) {
            console.error(`Unknown application category in session: "${session.category}"`);
            await user.send({ content: 'Something went wrong with your application (unknown category). Please start a new one.' }).catch(() => {});
            this.sessions.delete(user.id);
            return;
        }
        if (questionIndex >= questions.length) {
            await this.showApplicationSummary(user, applicationId);
            return;
        }

        const question = questions[questionIndex];
        session.currentQuestion = questionIndex;

        const embed = new EmbedBuilder()
            .setTitle(`Question ${questionIndex + 1} of ${questions.length}`)
            .setDescription(question)
            .setColor(0x0000ff)
            .setFooter({ text: `Time remaining: ${this.getTimeRemaining(session.expiresAt)}` });

        const cancelButton = new ButtonBuilder()
            .setCustomId('application_cancel')
            .setLabel('Cancel Application')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(cancelButton);

        try {
            // Edit the existing question message in-place so there is always
            // exactly one message with a Cancel button — no stale buttons.
            if (session.lastQuestionMessage) {
                await session.lastQuestionMessage.edit({ embeds: [embed], components: [row] });
            } else {
                const msg = await user.send({ embeds: [embed], components: [row] });
                session.lastQuestionMessage = msg;
            }
        } catch (error) {
            console.error('Error sending/editing question:', error);
            await this.cancelApplication({ user: { id: user.id } }, 'DM error');
        }
    }

    async handleApplicationAnswer(message) {
        const session = this.sessions.get(message.author.id);
        if (!session || session.status !== 'in_progress') return;

        if (Date.now() > new Date(session.expiresAt).getTime()) {
            await this.timeoutApplication(message.author);
            return;
        }

        // Once every question is answered the summary (with Submit/Edit/Cancel
        // buttons) is shown but the session stays 'in_progress' until the user
        // submits. Without this guard, any further DM appends a junk answer and
        // re-renders a corrupted summary (question text becomes undefined).
        const questions = this.questions[session.category];
        if (!questions || session.answers.length >= questions.length) return;

        session.answers.push(message.content);

        this.bot.db.run(
            "UPDATE applications SET answers = ? WHERE id = ?",
            [JSON.stringify(session.answers), session.applicationId],
            (err) => { if (err) console.error('[handleApplicationAnswer] DB update error:', err); }
        );

        await this.askQuestion(message.author, session.applicationId, session.currentQuestion + 1);
    }

    async showApplicationSummary(user, applicationId) {
        const session = this.sessions.get(user.id);
        if (!session) return;

        const questions = this.questions[session.category];
        const answers = session.answers;

        const embed = new EmbedBuilder()
            .setTitle(MSG.APPLICATION_SUMMARY_TITLE(session.category))
            .setDescription(MSG.APPLICATION_SUMMARY_BODY)
            .setColor(0x0000ff)
            .setFooter({ text: MSG.APPLICATION_SUMMARY_FOOTER });

        answers.forEach((answer, index) => {
            const question = questions[index];
            const truncatedAnswer = answer.length > 500 ? answer.substring(0, 497) + '...' : answer;
            embed.addFields({
                name: `F${index + 1}: ${question}`,
                value: truncatedAnswer,
                inline: false
            });
        });

        const submitButton = new ButtonBuilder()
            .setCustomId('application_submit')
            .setLabel('Submit')
            .setStyle(ButtonStyle.Success);

        const editButton = new ButtonBuilder()
            .setCustomId('application_edit')
            .setLabel('Edit Answer')
            .setStyle(ButtonStyle.Primary);

        const cancelButton = new ButtonBuilder()
            .setCustomId('application_cancel_final')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(submitButton, editButton, cancelButton);

        // Remove the Cancel button from the last question message now that the
        // summary is being shown. Without this the old Cancel button stays
        // clickable and pressing it cancels a fully-answered application.
        if (session.lastQuestionMessage) {
            try {
                await session.lastQuestionMessage.edit({ components: [] });
            } catch { /* ignore — message may already be gone */ }
        }

        try {
            const summaryMessage = await user.send({ embeds: [embed], components: [row] });

            this.summarySessions.set(user.id, {
                applicationId: applicationId,
                messageId: summaryMessage.id,
                category: session.category,
                answers: [...answers],
                questions: questions
            });
        } catch (error) {
            console.error('Error sending summary:', error);
        }
    }

    async handleSummaryAction(interaction) {
        const action = interaction.customId;
        const userId = interaction.user.id;
        const summarySession = this.summarySessions.get(userId);

        if (!summarySession) {
            await interaction.reply({
                content: MSG.APPLICATION_SESSION_EXPIRED,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        try {
            if (action === 'application_submit') {
                await this.completeApplication(interaction, summarySession.applicationId);
            } else if (action === 'application_edit') {
                await this.showEditModal(interaction, summarySession);
            } else if (action === 'application_cancel_final') {
                await this.cancelApplication(interaction, 'user_cancelled_summary');
            }
        } catch (error) {
            console.error('Error handling summary action:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: MSG.GENERIC_ERROR,
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }

    async showEditModal(interaction, summarySession) {
        const modal = new ModalBuilder()
            .setCustomId(`application_edit_modal_${summarySession.applicationId}`)
            .setTitle('Edit Answer');

        const questionInput = new TextInputBuilder()
            .setCustomId('question_number')
            .setLabel(`Question number (1-${this.questions[summarySession.category]?.length ?? 12})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the number of the question to edit')
            .setRequired(true)
            .setMaxLength(2);

        const answerInput = new TextInputBuilder()
            .setCustomId('new_answer')
            .setLabel('New Answer')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter your new answer here...')
            .setRequired(true)
            .setMaxLength(4000);

        const firstActionRow = new ActionRowBuilder().addComponents(questionInput);
        const secondActionRow = new ActionRowBuilder().addComponents(answerInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
    }

    async handleEditModal(interaction) {
        const rawQN = interaction.fields.getTextInputValue('question_number').trim();
        const questionNumber = /^\d+$/.test(rawQN) ? parseInt(rawQN, 10) : NaN;
        const newAnswer = interaction.fields.getTextInputValue('new_answer');
        const userId = interaction.user.id;

        const summarySession = this.summarySessions.get(userId);
        if (!summarySession) {
            await interaction.reply({
                content: MSG.APPLICATION_SESSION_EXPIRED,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (isNaN(questionNumber) || questionNumber < 1 || questionNumber > summarySession.answers.length) {
            await interaction.reply({
                content: MSG.APPLICATION_INVALID_QUESTION(summarySession.answers.length),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        summarySession.answers[questionNumber - 1] = newAnswer;

        this.bot.db.run(
            "UPDATE applications SET answers = ? WHERE id = ?",
            [JSON.stringify(summarySession.answers), summarySession.applicationId],
            (err) => { if (err) console.error('[handleEditModal] DB update error:', err); }
        );

        const mainSession = this.sessions.get(userId);
        if (mainSession) {
            mainSession.answers[questionNumber - 1] = newAnswer;
        }

        const embed = new EmbedBuilder()
            .setTitle(MSG.APPLICATION_SUMMARY_TITLE(summarySession.category))
            .setDescription(MSG.APPLICATION_SUMMARY_BODY)
            .setColor(0x0000ff)
            .setFooter({ text: MSG.APPLICATION_ANSWER_UPDATED(questionNumber) });

        summarySession.answers.forEach((answer, index) => {
            const question = summarySession.questions[index];
            const truncatedAnswer = answer.length > 500 ? answer.substring(0, 497) + '...' : answer;
            embed.addFields({
                name: `F${index + 1}: ${question}`,
                value: truncatedAnswer,
                inline: false
            });
        });

        const submitButton = new ButtonBuilder()
            .setCustomId('application_submit')
            .setLabel('Submit')
            .setStyle(ButtonStyle.Success);

        const editButton = new ButtonBuilder()
            .setCustomId('application_edit')
            .setLabel('Edit Answer')
            .setStyle(ButtonStyle.Primary);

        const cancelButton = new ButtonBuilder()
            .setCustomId('application_cancel_final')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(submitButton, editButton, cancelButton);

        await interaction.reply({
            content: MSG.APPLICATION_ANSWER_UPDATED(questionNumber),
            flags: MessageFlags.Ephemeral
        });

        try {
            const dmChannel = await interaction.user.createDM();
            const summaryMessage = await dmChannel.messages.fetch(summarySession.messageId);
            await summaryMessage.edit({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error updating summary message:', error);
            try {
                await interaction.user.send({
                    content: MSG.APPLICATION_UPDATED_FALLBACK,
                    embeds: [embed],
                    components: [row]
                });
            } catch (sendError) {
                console.error('Could not send updated summary:', sendError);
            }
        }
    }

    async completeApplication(interaction, applicationId) {
        const userId = interaction.user.id;
        const session = this.sessions.get(userId);

        if (!session) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: MSG.APPLICATION_SESSION_EXPIRED,
                    flags: MessageFlags.Ephemeral
                });
            }
            return;
        }

        const submittedAt = new Date();

        this.bot.db.run(
            "UPDATE applications SET status = 'submitted', submitted_at = ? WHERE id = ?",
            [submittedAt.toISOString(), applicationId],
            (err) => { if (err) console.error('[completeApplication] DB update error:', err); }
        );

        this.sessions.delete(userId);
        this.summarySessions.delete(userId);

        const embed = new EmbedBuilder()
            .setTitle(MSG.APPLICATION_SUBMITTED_TITLE)
            .setDescription(MSG.APPLICATION_SUBMITTED_BODY)
            .setColor(0x00ff00);

        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
            await interaction.editReply({ embeds: [embed], components: [] });
        } catch (error) {
            console.error('Error in completeApplication:', error);
            try {
                await interaction.user.send({ embeds: [embed] });
            } catch (sendError) {
                console.error('Could not send completion message:', sendError);
            }
        }

        await this.postApplicationForReview(applicationId);
    }

    async postApplicationForReview(applicationId) {
        this.bot.db.get(
            "SELECT * FROM applications WHERE id = ?",
            [applicationId],
            async (err, application) => {
                if (err || !application) return;

                try {
                    const user = await this.bot.client.users.fetch(application.user_id);
                    const answers = JSON.parse(application.answers);
                    const questions = this.questions[application.category];

                    if (!questions) {
                        console.error(`No questions found for category: ${application.category}`);
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(`${application.category} Application — ${user.tag}`)
                        .setColor(0x0000ff)
                        .setThumbnail(user.displayAvatarURL())
                        .setFooter({ text: `User ID: ${user.id} | Application ID: ${application.id}` });

                    if (application.submitted_at) {
                        try {
                            const timestamp = new Date(application.submitted_at);
                            if (!isNaN(timestamp.getTime())) {
                                embed.setTimestamp(timestamp);
                            }
                        } catch (error) {
                            console.error('Error parsing submitted_at timestamp:', error);
                        }
                    }

                    answers.forEach((answer, index) => {
                        const question = questions[index] ?? `Question ${index + 1}`;
                        const truncatedAnswer = answer.length > 1024 ? answer.substring(0, 1020) + '...' : answer;
                        embed.addFields({
                            name: `F${index + 1}: ${question}`,
                            value: truncatedAnswer,
                            inline: false
                        });
                    });

                    const acceptButton = new ButtonBuilder()
                        .setCustomId(`application_accept_${application.id}`)
                        .setLabel('Accept')
                        .setStyle(ButtonStyle.Success);

                    const denyButton = new ButtonBuilder()
                        .setCustomId(`application_deny_${application.id}`)
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger);

                    const acceptWithReasonButton = new ButtonBuilder()
                        .setCustomId(`application_accept_reason_${application.id}`)
                        .setLabel('Accept with Reason')
                        .setStyle(ButtonStyle.Success);

                    const denyWithReasonButton = new ButtonBuilder()
                        .setCustomId(`application_deny_reason_${application.id}`)
                        .setLabel('Deny with Reason')
                        .setStyle(ButtonStyle.Danger);

                    const ticketButton = new ButtonBuilder()
                        .setCustomId(`application_ticket_${application.id}`)
                        .setLabel('Open Ticket with User')
                        .setStyle(ButtonStyle.Secondary);

                    const row1 = new ActionRowBuilder().addComponents(acceptButton, denyButton);
                    const row2 = new ActionRowBuilder().addComponents(acceptWithReasonButton, denyWithReasonButton);
                    const row3 = new ActionRowBuilder().addComponents(ticketButton);

                    const specificChannelId = this.bot.CONFIG.APPLICATION_CATEGORY_SPECIFIC[application.category];
                    const reviewChannelId = specificChannelId || this.bot.CONFIG.APPLICATION_REVIEW_CHANNEL;
                    const reviewChannel = await fetchChannel(this.bot, reviewChannelId);

                    if (reviewChannel) {
                        await reviewChannel.send({
                            embeds: [embed],
                            components: [row1, row2, row3]
                        });
                    } else {
                        console.error(`Review channel not found for category ${application.category} (ID: ${reviewChannelId})`);
                    }
                } catch (error) {
                    console.error('Error posting application for review:', error);
                }
            }
        );
    }

    async handleManagerAction(interaction) {
        if (!interaction.member.roles.cache.has(this.bot.MANAGEMENT_ROLE)) {
            await interaction.reply({
                content: MSG.APPLICATION_NO_MANAGEMENT,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const customId = interaction.customId;
        let applicationId;
        let action;

        if (customId.startsWith('application_accept_reason_')) {
            applicationId = customId.replace('application_accept_reason_', '');
            action = 'accept_reason';
        } else if (customId.startsWith('application_deny_reason_')) {
            applicationId = customId.replace('application_deny_reason_', '');
            action = 'deny_reason';
        } else if (customId.startsWith('application_accept_')) {
            applicationId = customId.replace('application_accept_', '');
            action = 'accept';
        } else if (customId.startsWith('application_deny_')) {
            applicationId = customId.replace('application_deny_', '');
            action = 'deny';
        } else if (customId.startsWith('application_ticket_')) {
            applicationId = customId.replace('application_ticket_', '');
            action = 'ticket';
        } else {
            await interaction.reply({
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // accept/deny/ticket do slow work (member fetch, role add, DM, channel
        // create) before responding, which blows past Discord's 3s window and
        // throws 10062. Acknowledge first. The *_reason actions must NOT defer —
        // they open a modal, which has to be the initial interaction response.
        if (action === 'accept' || action === 'deny' || action === 'ticket') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        this.bot.db.get(
            "SELECT * FROM applications WHERE id = ?",
            [applicationId],
            async (err, application) => {
                if (err || !application) {
                    await safeReply(interaction, {
                        content: MSG.APPLICATION_NOT_FOUND,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                // Guard against double-processing: accept/deny actions only make
                // sense on a submitted application. Without this check a second
                // click would re-send a DM, re-assign roles, and log a duplicate
                // promotion entry.
                if (['accept', 'deny', 'accept_reason', 'deny_reason'].includes(action) &&
                        application.status !== 'submitted') {
                    await safeReply(interaction, {
                        content: `This application has already been reviewed (status: **${application.status}**).`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                try {
                    const user = await this.bot.client.users.fetch(application.user_id);

                    if (action === 'accept') {
                        await this.acceptApplication(interaction, application, user);
                    } else if (action === 'deny') {
                        await this.denyApplication(interaction, application, user);
                    } else if (action === 'accept_reason') {
                        await this.showReasonModal(interaction, 'accept', applicationId);
                    } else if (action === 'deny_reason') {
                        await this.showReasonModal(interaction, 'deny', applicationId);
                    } else if (action === 'ticket') {
                        await this.openApplicationTicket(interaction, application, user);
                    }
                } catch (error) {
                    console.error('Error handling manager action:', error);
                    await safeReply(interaction, {
                        content: MSG.GENERIC_ERROR,
                        flags: MessageFlags.Ephemeral
                    });
                }
            }
        );
    }

    async acceptApplication(interaction, application, user) {
        try {
            const guild = interaction.guild;

            try {
                const member = await guild.members.fetch(application.user_id);
                const roleId = this.bot.RANK_ROLES[application.category];

                if (roleId) {
                    const rolesToAdd = [roleId];
                    if (this.bot.ROLE_HIERARCHY[application.category]) {
                        for (const additionalRank of this.bot.ROLE_HIERARCHY[application.category]) {
                            if (additionalRank !== application.category) {
                                const additionalRoleId = this.bot.RANK_ROLES[additionalRank];
                                if (additionalRoleId) rolesToAdd.push(additionalRoleId);
                            }
                        }
                    }
                    if (this.bot.STAFF_RANKS.includes(application.category)) {
                        rolesToAdd.push(this.bot.STAFF_ROLE);
                    }
                    await member.roles.add(rolesToAdd);
                    console.log(`Roles assigned to ${user.tag} for ${application.category} application`);
                } else {
                    console.warn(`No role found for category: ${application.category}`);
                }
            } catch (memberError) {
                console.log(`Could not assign role to ${user.tag}:`, memberError.message);
            }

            const embed = new EmbedBuilder()
                .setTitle(MSG.APPLICATION_ACCEPTED_TITLE)
                .setDescription(MSG.APPLICATION_ACCEPTED_BODY(application.category))
                .setColor(0x00ff00);

            try {
                await user.send({ embeds: [embed] });
            } catch (error) {
                console.log(`Could not send acceptance DM to ${user.tag}`);
            }

            this.bot.db.run(
                "UPDATE applications SET status = 'accepted', reviewed_by = ? WHERE id = ?",
                [interaction.user.id, application.id],
                (err) => { if (err) console.error('[acceptApplication] DB update error:', err); }
            );

            await this.logApplicationAction(application.id, 'accepted', interaction.user.id);

            const promotionChannel = await fetchChannel(this.bot, this.bot.CONFIG.PROMOTION_LOG_CHANNEL);
            if (promotionChannel) {
                const promotionEmbed = new EmbedBuilder()
                    .setTitle("Promotion")
                    .setDescription(MSG.APPLICATION_PROMOTION_LOG(user, application.category))
                    .setColor(0x00ff00)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await promotionChannel.send({ embeds: [promotionEmbed] });
            }

            await this.updateApplicationEmbed(interaction, application, 'accepted');

            await safeReply(interaction, {
                content: MSG.APPLICATION_ACCEPT_STAFF_CONFIRM(user.tag),
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error accepting application:', error);
            await safeReply(interaction, {
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async denyApplication(interaction, application, user) {
        try {
            const embed = new EmbedBuilder()
                .setTitle(MSG.APPLICATION_DENIED_TITLE)
                .setDescription(MSG.APPLICATION_DENIED_BODY(application.category))
                .setColor(0xff0000);

            try {
                await user.send({ embeds: [embed] });
            } catch (error) {
                console.log(`Could not send denial DM to ${user.tag}`);
            }

            this.bot.db.run(
                "UPDATE applications SET status = 'denied', reviewed_by = ? WHERE id = ?",
                [interaction.user.id, application.id],
                (err) => { if (err) console.error('[denyApplication] DB update error:', err); }
            );

            await this.logApplicationAction(application.id, 'denied', interaction.user.id);

            await this.updateApplicationEmbed(interaction, application, 'denied');

            await safeReply(interaction, {
                content: MSG.APPLICATION_DENY_STAFF_CONFIRM(user.tag),
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error denying application:', error);
            await safeReply(interaction, {
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async showReasonModal(interaction, action, applicationId) {
        const modal = new ModalBuilder()
            .setCustomId(`application_${action}_modal_${applicationId}`)
            .setTitle(`Application — ${action === 'accept' ? 'Accept' : 'Deny'}`);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    }

    async handleReasonModal(interaction) {
        const customId = interaction.customId;
        let action, applicationId;

        if (customId.startsWith('application_accept_modal_')) {
            action = 'accept';
            applicationId = customId.replace('application_accept_modal_', '');
        } else if (customId.startsWith('application_deny_modal_')) {
            action = 'deny';
            applicationId = customId.replace('application_deny_modal_', '');
        } else {
            await interaction.reply({
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const reason = interaction.fields.getTextInputValue('reason');

        // Role add + DM + log writes follow; acknowledge within the 3s window.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        this.bot.db.get(
            "SELECT * FROM applications WHERE id = ?",
            [applicationId],
            async (err, application) => {
                if (err || !application) {
                    await safeReply(interaction, {
                        content: MSG.APPLICATION_NOT_FOUND,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                if (application.status !== 'submitted') {
                    await safeReply(interaction, {
                        content: `This application has already been reviewed (status: **${application.status}**).`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                try {
                    const user = await this.bot.client.users.fetch(application.user_id);

                    if (action === 'accept') {
                        await this.acceptApplicationWithReason(interaction, application, user, reason);
                    } else {
                        await this.denyApplicationWithReason(interaction, application, user, reason);
                    }
                } catch (error) {
                    console.error('Error handling reason modal:', error);
                    await safeReply(interaction, {
                        content: MSG.GENERIC_ERROR,
                        flags: MessageFlags.Ephemeral
                    });
                }
            }
        );
    }

    async acceptApplicationWithReason(interaction, application, user, reason) {
        try {
            const guild = interaction.guild;

            try {
                const member = await guild.members.fetch(application.user_id);
                const roleId = this.bot.RANK_ROLES[application.category];

                if (roleId) {
                    const rolesToAdd = [roleId];
                    if (this.bot.ROLE_HIERARCHY[application.category]) {
                        for (const additionalRank of this.bot.ROLE_HIERARCHY[application.category]) {
                            if (additionalRank !== application.category) {
                                const additionalRoleId = this.bot.RANK_ROLES[additionalRank];
                                if (additionalRoleId) rolesToAdd.push(additionalRoleId);
                            }
                        }
                    }
                    if (this.bot.STAFF_RANKS.includes(application.category)) {
                        rolesToAdd.push(this.bot.STAFF_ROLE);
                    }
                    await member.roles.add(rolesToAdd);
                    console.log(`Roles assigned to ${user.tag} for ${application.category} application (with reason)`);
                } else {
                    console.warn(`No role found for category: ${application.category}`);
                }
            } catch (memberError) {
                console.log(`Could not assign role to ${user.tag}:`, memberError.message);
            }

            const embed = new EmbedBuilder()
                .setTitle(MSG.APPLICATION_ACCEPTED_TITLE)
                .setDescription(MSG.APPLICATION_ACCEPTED_REASON_BODY(application.category, reason))
                .setColor(0x00ff00);

            try {
                await user.send({ embeds: [embed] });
            } catch (error) {
                console.log(`Could not send acceptance DM to ${user.tag}`);
            }

            this.bot.db.run(
                "UPDATE applications SET status = 'accepted', reviewed_by = ?, review_reason = ? WHERE id = ?",
                [interaction.user.id, reason, application.id],
                (err) => { if (err) console.error('[acceptApplicationWithReason] DB update error:', err); }
            );

            await this.logApplicationAction(application.id, 'accepted_with_reason', interaction.user.id, reason);

            const promotionChannel = await fetchChannel(this.bot, this.bot.CONFIG.PROMOTION_LOG_CHANNEL);
            if (promotionChannel) {
                const promotionEmbed = new EmbedBuilder()
                    .setTitle("Promotion")
                    .setDescription(MSG.APPLICATION_PROMOTION_LOG(user, application.category))
                    .setColor(0x00ff00)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await promotionChannel.send({ embeds: [promotionEmbed] });
            }

            await this.updateApplicationEmbed(interaction, application, 'accepted', reason);

            await safeReply(interaction, {
                content: MSG.APPLICATION_ACCEPT_STAFF_CONFIRM(user.tag),
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error accepting application with reason:', error);
            await safeReply(interaction, {
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async denyApplicationWithReason(interaction, application, user, reason) {
        try {
            const embed = new EmbedBuilder()
                .setTitle(MSG.APPLICATION_DENIED_TITLE)
                .setDescription(MSG.APPLICATION_DENIED_REASON_BODY(application.category, reason))
                .setColor(0xff0000);

            try {
                await user.send({ embeds: [embed] });
            } catch (error) {
                console.log(`Could not send denial DM to ${user.tag}`);
            }

            this.bot.db.run(
                "UPDATE applications SET status = 'denied', reviewed_by = ?, review_reason = ? WHERE id = ?",
                [interaction.user.id, reason, application.id],
                (err) => { if (err) console.error('[denyApplicationWithReason] DB update error:', err); }
            );

            await this.logApplicationAction(application.id, 'denied_with_reason', interaction.user.id, reason);

            await this.updateApplicationEmbed(interaction, application, 'denied', reason);

            await safeReply(interaction, {
                content: MSG.APPLICATION_DENY_STAFF_CONFIRM(user.tag),
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error denying application with reason:', error);
            await safeReply(interaction, {
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async openApplicationTicket(interaction, application, user) {
        const categoryChannel = await fetchChannel(this.bot, this.bot.CONFIG.SUPPORT_CATEGORY);
        const guild = interaction.guild;

        if (!categoryChannel) {
            await safeReply(interaction, { content: MSG.GENERIC_ERROR, flags: MessageFlags.Ephemeral });
            return;
        }

        const safeUsername = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'user';
        const channelName = `application-${application.category.toLowerCase()}-${safeUsername}`.replace(/[^a-z0-9-]/g, '').substring(0, 100);

        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            },
            {
                id: this.bot.MANAGEMENT_ROLE,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }
        ];

        try {
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryChannel.id,
                permissionOverwrites: permissionOverwrites
            });

            const embed = new EmbedBuilder()
                .setTitle(`Application Follow-up — ${application.category}`)
                .setDescription(`This ticket was opened to discuss ${user}'s **${application.category}** application.\n\n**User:** ${user.tag}\n**Application ID:** ${application.id}`)
                .setColor(0x0000ff);

            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            await channel.send({
                content: `${user} ${interaction.user}`,
                embeds: [embed],
                components: [row]
            });

            this.bot.db.run(
                "INSERT INTO tickets (user_id, channel_id, category) VALUES (?, ?, ?)",
                [user.id, channel.id, 'application'],
                (err) => { if (err) console.error('[openApplicationTicket] DB insert error:', err); }
            );

            await safeReply(interaction, {
                content: `Ticket created: ${channel}`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error opening application ticket:', error);
            await safeReply(interaction, {
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async cancelApplication(interaction, reason = 'user_cancelled') {
        const userId = interaction.user?.id;

        if (!userId) {
            console.error('No user ID found for cancellation');
            return;
        }

        const session = this.sessions.get(userId);
        const summarySession = this.summarySessions.get(userId);

        if (session) {
            if (session.lastQuestionMessage && !interaction.update) {
                // Only strip the button if we're NOT responding via interaction.update
                // (interaction.update already removes components on the clicked message)
                try {
                    await session.lastQuestionMessage.edit({ components: [] });
                } catch { /* ignore */ }
            }
            if (session.applicationId) {
                this.bot.db.run(
                    "UPDATE applications SET status = 'cancelled' WHERE id = ?",
                    [session.applicationId],
                    (err) => { if (err) console.error('[cancelApplication] DB update error:', err); }
                );
                await this.logApplicationAction(session.applicationId, 'cancelled', userId);
            }
            this.sessions.delete(userId);
        }

        if (summarySession) {
            this.summarySessions.delete(userId);
        }

        const embed = new EmbedBuilder()
            .setTitle(MSG.APPLICATION_CANCELLED_TITLE)
            .setDescription(MSG.APPLICATION_CANCELLED_BODY)
            .setColor(0xff0000);

        try {
            if (interaction.update) {
                await interaction.update({ embeds: [embed], components: [] });
            } else if (interaction.reply) {
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                const user = this.bot.client.users.cache.get(userId);
                if (user) {
                    await user.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            if (error.code !== 10062) {
                console.error('Error cancelling application:', error);
            }
        }
    }

    async timeoutApplication(user) {
        const session = this.sessions.get(user.id);
        if (!session) return;

        if (session.lastQuestionMessage) {
            try {
                await session.lastQuestionMessage.edit({ components: [] });
            } catch { /* ignore */ }
        }

        this.bot.db.run(
            "UPDATE applications SET status = 'timeout' WHERE id = ?",
            [session.applicationId],
            (err) => { if (err) console.error('[timeoutApplication] DB update error:', err); }
        );

        await this.logApplicationAction(session.applicationId, 'timeout', user.id);

        this.sessions.delete(user.id);
        this.summarySessions.delete(user.id);

        const embed = new EmbedBuilder()
            .setTitle(MSG.APPLICATION_TIMEOUT_TITLE)
            .setDescription(MSG.APPLICATION_TIMEOUT_BODY(this.bot.CONFIG.APPLICATION_TIMEOUT_HOURS ?? 3))
            .setColor(0xff0000);

        try {
            await user.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error sending timeout message:', error);
        }
    }

    getTimeRemaining(expiresAt) {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry - now;

        if (diff <= 0) return 'Expired';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`;
    }

    async logApplicationAction(applicationId, action, userId, details = null) {
        this.bot.db.run(
            "INSERT INTO application_logs (application_id, action, user_id, details) VALUES (?, ?, ?, ?)",
            [applicationId, action, userId, details],
            (err) => { if (err) console.error('[logApplicationAction] DB insert error:', err); }
        );
    }

    async checkSessions() {
        const now = new Date();
        const confirmationMaxMs = (this.bot.CONFIG.APPLICATION_TIMEOUT_HOURS ?? 3) * 60 * 60 * 1000;
        for (const [userId, session] of this.sessions.entries()) {
            if (session.status === 'confirmation') {
                if (session.createdAt && now - new Date(session.createdAt) > confirmationMaxMs) {
                    this.sessions.delete(userId);
                }
                continue;
            }
            if (now > new Date(session.expiresAt)) {
                try {
                    const user = await this.bot.client.users.fetch(userId);
                    await this.timeoutApplication(user);
                } catch (err) {
                    console.error(`[checkSessions] could not fetch user ${userId}:`, err);
                    this.sessions.delete(userId);
                    this.summarySessions.delete(userId);
                }
            }
        }
    }

    async updateApplicationEmbed(interaction, application, status, reason = null) {
        try {
            if (!interaction.message || !interaction.message.editable) {
                return;
            }

            const originalEmbed = interaction.message.embeds[0];
            if (!originalEmbed) {
                return;
            }

            const colorMap = {
                accepted: 0x57F287,
                denied:   0xED4245,
                pending:  0xFEE75C
            };
            const color = colorMap[status] ?? originalEmbed.color ?? 0x0000ff;

            const newEmbed = new EmbedBuilder()
                .setTitle(originalEmbed.title || 'Application Review')
                .setColor(color)
                .setTimestamp();

            if (originalEmbed.footer?.text) {
                newEmbed.setFooter({ text: originalEmbed.footer.text });
            }

            if (originalEmbed.thumbnail?.url) {
                newEmbed.setThumbnail(originalEmbed.thumbnail.url);
            }

            if (originalEmbed.fields && Array.isArray(originalEmbed.fields)) {
                originalEmbed.fields.forEach(field => {
                    if (field?.name && field?.value) {
                        newEmbed.addFields({
                            name: field.name,
                            value: field.value.length > 1024 ? field.value.substring(0, 1020) + '...' : field.value,
                            inline: field.inline || false
                        });
                    }
                });
            }

            if (reason?.trim()) {
                newEmbed.addFields({
                    name: 'Reason',
                    value: reason.length > 1024 ? reason.substring(0, 1020) + '...' : reason,
                    inline: false
                });
            }

            if (interaction.user) {
                newEmbed.addFields({
                    name: 'Decided by',
                    value: `${interaction.user.tag} (${interaction.user.id})`,
                    inline: true
                });
            }

            newEmbed.addFields({
                name: 'Status',
                value: status === 'accepted' ? 'Accepted' : status === 'denied' ? 'Denied' : status,
                inline: true
            });

            await interaction.message.edit({ embeds: [newEmbed], components: [] });
        } catch (error) {
            console.error('Error updating application embed:', error);
        }
    }
}

module.exports = ApplicationHandler;
