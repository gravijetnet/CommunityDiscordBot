const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const MSG = require('../config/messages');

async function fetchChannel(bot, channelId) {
    if (!channelId) return null;
    try {
        return await bot.client.channels.fetch(channelId);
    } catch {
        return null;
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
                "What is your Ingame-Minecraft-Name?",
                "How old are you?",
                "In which time-zone do you live?",
                "Why do you want to become staff on our server?",
                "What are your thoughts about our server?",
                "How active do you plan to be on the server?",
                "What motivates you to become staff on our server?",
                "Are you staff on any other servers? If yes, which ones? Please provide details.",
                "What are your goals for the next 2 months on our server?",
                "How would you handle a player who is clearly hacking?",
                "Tell us something about yourself.",
                "Do you have any questions for us?"
            ],
            'Builder': [
                "What is your Ingame-Minecraft-Name?",
                "How old are you?",
                "In which time-zone do you live?",
                "Why do you want to become staff on our server?",
                "What are your thoughts about our server?",
                "How active do you plan to be?",
                "What motivates you to become staff on our server?",
                "Are you staff on any other servers? If yes, please provide details.",
                "What are your goals for the next 2 months on our server?",
                "Show us some of your builds. (Please provide URLs only, no files.)",
                "Tell us something about yourself.",
                "Do you have any questions for us?"
            ],
            'Developer': [
                "What is your Minecraft in-game name?",
                "How old are you?",
                "In which time zone do you live?",
                "Why do you want to become staff on our server?",
                "What are your thoughts about our server?",
                "How active do you plan to be?",
                "What motivates you to become staff on our server?",
                "Are you staff on any other servers? If yes, please provide details.",
                "What are your goals for the next 2 months on our server?",
                "Show us some of your work! (No files; please provide links or code snippets)",
                "Tell us something about yourself.",
                "Do you have any questions for us?"
            ],
            'Media': [
                "Your YouTube, Twitch, or TikTok URL",
                "What is your Minecraft in-game name?",
                "Why do you want to have a Media rank on our server?",
                "Since when have you been creating content related to our server?",
                "How often do you upload content?",
                "What are your thoughts about our server?",
                "Do you have any questions for us?"
            ],
            'Beta-Tester': [
                "What is your Ingame-Minecraft-Name?",
                "Why do you want to become a Beta-Tester?",
                "How often do you usually play Minecraft per week?",
                "Have you participated in Early Access or Beta programs on other servers before? If yes, which ones?",
                "Are you willing to provide feedback or report any bugs you encounter?",
                "What are you most excited to try or see on our server?",
                "How would you describe your behavior in multiplayer servers (friendly, helpful, team-oriented, etc.)?",
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

        try {
            const messages = await channel.messages.fetch({ limit: 10 });
            const existingPanel = messages.find(msg => 
                msg.author.id === this.bot.client.user.id && 
                msg.embeds.length > 0 && 
                msg.embeds[0].title === "Applications"
            );

            if (existingPanel) {
                console.log('Application panel already exists, skipping creation');
                return;
            }

            await channel.bulkDelete(messages);
        } catch (error) {
            console.error('Error clearing channel:', error);
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
                { label: 'Builders', value: 'Builder' },
                { label: 'Media', value: 'Media' },
                { label: 'Helper', value: 'Helper' },
                { label: 'Beta Testers', value: 'Beta-Tester' },
                { label: 'Developers', value: 'Developer' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await channel.send({ embeds: [embed], components: [row] });
        console.log('Application panel created successfully');
    }

    async handleApplicationSelect(interaction) {
        const category = interaction.values[0];
        
        // Check if user already has an active application
        const existingSession = this.sessions.get(interaction.user.id);
        if (existingSession && existingSession.status === 'in_progress') {
            const embed = new EmbedBuilder()
                .setTitle("❌ Application in Progress")
                .setDescription(MSG.APPLICATION_ALREADY_OPEN)
                .setColor(0xff0000);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // Check database for existing in_progress application
        this.bot.db.get(
            "SELECT * FROM applications WHERE user_id = ? AND status = 'in_progress'",
            [interaction.user.id],
            async (err, row) => {
                if (err) {
                    console.error('Error checking existing applications:', err);
                    const embed = new EmbedBuilder()
                        .setTitle("❌ Error")
                        .setDescription(MSG.GENERIC_DB_ERROR)
                        .setColor(0xff0000);
                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    return;
                }

                if (row) {
                    const embed = new EmbedBuilder()
                        .setTitle("❌ Application in Progress")
                        .setDescription(MSG.APPLICATION_ALREADY_OPEN)
                        .setColor(0xff0000);
                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    return;
                }

                // Continue with application if no existing one
                const forbiddenRoleId = this.bot.FORBIDDEN_ROLES[category];

                // Check if user has forbidden role
                if (forbiddenRoleId && interaction.member.roles.cache.has(forbiddenRoleId)) {
                    const embed = new EmbedBuilder()
                        .setTitle("❌ Not Allowed")
                        .setDescription(MSG.APPLICATION_ROLE_CONFLICT)
                        .setColor(0xff0000);
                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    return;
                }

                // Send ephemeral response with DM link button
                const embed = new EmbedBuilder()
                    .setTitle(MSG.APPLICATION_STARTED_TITLE)
                    .setDescription(MSG.APPLICATION_STARTED_BODY)
                    .setColor(0x00ff00);

                // Try to send DM first to get the message URL
                try {
                    const dmMessage = await this.sendApplicationConfirmation(interaction.user, category);
                    
                    // Create DM link button with the specific message URL
                    const dmButton = new ButtonBuilder()
                        .setLabel(MSG.APPLICATION_OPEN_DMS_BUTTON)
                        .setURL(dmMessage.url)
                        .setStyle(ButtonStyle.Link);

                    const row = new ActionRowBuilder().addComponents(dmButton);

                    await interaction.reply({ 
                        embeds: [embed], 
                        components: [row],
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Error sending DM:', error);
                    const errorEmbed = new EmbedBuilder()
                        .setTitle("❌ DMs Disabled")
                        .setDescription(MSG.APPLICATION_DM_BLOCKED)
                        .setColor(0xff0000);
                    await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                }
            }
        );
    }

    async sendApplicationConfirmation(user, category) {
        let description = MSG.APPLICATION_CONFIRM_BODY(category);

        if (category === 'Builder') {
            description += MSG.APPLICATION_CONFIRM_BUILDER_NOTE;
        } else if (category === 'Developer') {
            description += MSG.APPLICATION_CONFIRM_DEV_NOTE;
        }

        const embed = new EmbedBuilder()
            .setTitle(category)
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
            status: 'confirmation'
        });

        return dm; // Return the message object to get the URL
    }

    async startApplication(interaction) {
        const category = interaction.customId.replace('application_start_', '');
        const userId = interaction.user.id;

        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + 3 * 60 * 60 * 1000); // 3 hours

        this.bot.db.run(
            "INSERT INTO applications (user_id, username, category, answers, status, started_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [userId, interaction.user.tag, category, JSON.stringify([]), 'in_progress', startedAt.toISOString(), expiresAt.toISOString()],
            async (err) => {
                if (err) {
                    console.error('Error creating application:', err);
                    return;
                }

                this.bot.db.get("SELECT last_insert_rowid() as id", async (err, row) => {
                    if (err) return;

                    const applicationId = row.id;
                    this.sessions.set(userId, {
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
                        .setDescription(MSG.APPLICATION_IN_PROGRESS_BODY)
                        .setColor(0x00ff00);

                    try {
                        await interaction.update({ embeds: [embed], components: [] });
                    } catch (error) {
                        console.error('Error updating interaction:', error);
                        // Try to send as new message if update fails
                        await interaction.user.send({ embeds: [embed] });
                    }
                    
                    await this.askQuestion(interaction.user, applicationId, 0);
                });
            }
        );
    }

    async askQuestion(user, applicationId, questionIndex) {
        const session = this.sessions.get(user.id);
        if (!session) return;

        const questions = this.questions[session.category];
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
            await user.send({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error sending question:', error);
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

        session.answers.push(message.content);
        
        this.bot.db.run(
            "UPDATE applications SET answers = ? WHERE id = ?",
            [JSON.stringify(session.answers), session.applicationId]
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

        // Add all questions and answers to the embed
        answers.forEach((answer, index) => {
            const question = questions[index];
            const truncatedAnswer = answer.length > 500 ? answer.substring(0, 497) + '...' : answer;
            embed.addFields({
                name: `Q${index + 1}: ${question}`,
                value: truncatedAnswer,
                inline: false
            });
        });

        // Create action buttons
        const submitButton = new ButtonBuilder()
            .setCustomId('application_submit')
            .setLabel('Submit')
            .setStyle(ButtonStyle.Success);

        const editButton = new ButtonBuilder()
            .setCustomId('application_edit')
            .setLabel('Edit an Answer')
            .setStyle(ButtonStyle.Primary);

        const cancelButton = new ButtonBuilder()
            .setCustomId('application_cancel_final')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(submitButton, editButton, cancelButton);

        try {
            const summaryMessage = await user.send({
                embeds: [embed],
                components: [row]
            });

            // Store summary session
            this.summarySessions.set(user.id, {
                applicationId: applicationId,
                messageId: summaryMessage.id,
                category: session.category,
                answers: [...answers], // Copy answers array
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
            .setTitle('Edit Application Answer');

        const questionInput = new TextInputBuilder()
            .setCustomId('question_number')
            .setLabel('Question Number (1-12)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter question number to edit')
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
        const questionNumber = parseInt(interaction.fields.getTextInputValue('question_number'));
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

        // Validate question number
        if (isNaN(questionNumber) || questionNumber < 1 || questionNumber > summarySession.answers.length) {
            await interaction.reply({ 
                content: MSG.APPLICATION_INVALID_QUESTION(summarySession.answers.length), 
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Update answer
        summarySession.answers[questionNumber - 1] = newAnswer;

        // Update database
        this.bot.db.run(
            "UPDATE applications SET answers = ? WHERE id = ?",
            [JSON.stringify(summarySession.answers), summarySession.applicationId]
        );

        // Update session
        const mainSession = this.sessions.get(userId);
        if (mainSession) {
            mainSession.answers[questionNumber - 1] = newAnswer;
        }

        // Update summary embed
        const embed = new EmbedBuilder()
            .setTitle(MSG.APPLICATION_SUMMARY_TITLE(summarySession.category))
            .setDescription(MSG.APPLICATION_SUMMARY_BODY)
            .setColor(0x0000ff)
            .setFooter({ text: MSG.APPLICATION_ANSWER_UPDATED(questionNumber) });

        summarySession.answers.forEach((answer, index) => {
            const question = summarySession.questions[index];
            const truncatedAnswer = answer.length > 500 ? answer.substring(0, 497) + '...' : answer;
            embed.addFields({
                name: `Q${index + 1}: ${question}`,
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
            .setLabel('Edit an Answer')
            .setStyle(ButtonStyle.Primary);

        const cancelButton = new ButtonBuilder()
            .setCustomId('application_cancel_final')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(submitButton, editButton, cancelButton);

        await interaction.reply({
            content: `✅ ${MSG.APPLICATION_ANSWER_UPDATED(questionNumber)}`,
            flags: MessageFlags.Ephemeral
        });

        // Update the summary message in DM
        try {
            // Get the DM channel and message
            const dmChannel = await interaction.user.createDM();
            const summaryMessage = await dmChannel.messages.fetch(summarySession.messageId);
            await summaryMessage.edit({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error updating summary message:', error);
            // Try alternative method
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
            [submittedAt.toISOString(), applicationId]
        );

        // Clean up sessions
        this.sessions.delete(userId);
        this.summarySessions.delete(userId);

        const embed = new EmbedBuilder()
            .setTitle(MSG.APPLICATION_SUBMITTED_TITLE)
            .setDescription(MSG.APPLICATION_SUBMITTED_BODY)
            .setColor(0x00ff00);

        try {
            // Use deferUpdate first to acknowledge the interaction
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
            
            // Then edit the original message
            await interaction.editReply({ embeds: [embed], components: [] });
        } catch (error) {
            console.error('Error in completeApplication:', error);
            // Fallback: try to send as a new message
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

                const user = await this.bot.client.users.fetch(application.user_id);
                const answers = JSON.parse(application.answers);
                const questions = this.questions[application.category];

                const embed = new EmbedBuilder()
                    .setTitle(`${application.category} Application - ${user.tag}`)
                    .setColor(0x0000ff)
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp(new Date(application.submitted_at))
                    .setFooter({ text: `User ID: ${user.id} | Application ID: ${application.id}` });

                answers.forEach((answer, index) => {
                    const question = questions[index];
                    const truncatedAnswer = answer.length > 1024 ? answer.substring(0, 1020) + '...' : answer;
                    embed.addFields({
                        name: `Q${index + 1}: ${question}`,
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
                    .setLabel('🎫 Open ticket with user')
                    .setStyle(ButtonStyle.Secondary);

                const row1 = new ActionRowBuilder().addComponents(acceptButton, denyButton);
                const row2 = new ActionRowBuilder().addComponents(acceptWithReasonButton, denyWithReasonButton);
                const row3 = new ActionRowBuilder().addComponents(ticketButton);

                const reviewChannelId = this.bot.CONFIG.APPLICATION_CATEGORY_SPECIFIC[application.category] || 
                                      this.bot.CONFIG.APPLICATION_REVIEW_CHANNEL;
                const reviewChannel = await fetchChannel(this.bot, reviewChannelId);

                if (reviewChannel) {
                    await reviewChannel.send({ 
                        embeds: [embed], 
                        components: [row1, row2, row3] 
                    });
                }
            }
        );
    }

    async handleManagerAction(interaction) {
        // Check if user has management role
        if (!interaction.member.roles.cache.has(this.bot.MANAGEMENT_ROLE)) {
            await interaction.reply({
                content: MSG.APPLICATION_NO_MANAGEMENT,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const customId = interaction.customId;
        
        // Extract application ID from different button types
        let applicationId;
        let action;
        
        if (customId.startsWith('application_accept_') && !customId.includes('reason')) {
            applicationId = customId.replace('application_accept_', '');
            action = 'accept';
        } else if (customId.startsWith('application_deny_') && !customId.includes('reason')) {
            applicationId = customId.replace('application_deny_', '');
            action = 'deny';
        } else if (customId.startsWith('application_accept_reason_')) {
            applicationId = customId.replace('application_accept_reason_', '');
            action = 'accept_reason';
        } else if (customId.startsWith('application_deny_reason_')) {
            applicationId = customId.replace('application_deny_reason_', '');
            action = 'deny_reason';
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

        this.bot.db.get(
            "SELECT * FROM applications WHERE id = ?",
            [applicationId],
            async (err, application) => {
                if (err || !application) {
                    await interaction.reply({ 
                        content: MSG.APPLICATION_NOT_FOUND,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const user = await this.bot.client.users.fetch(application.user_id);

                try {
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
                    await interaction.reply({ 
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
            const member = await guild.members.fetch(application.user_id);
            const roleId = this.bot.RANK_ROLES[application.category];
            
            if (roleId) {
                await member.roles.add(roleId);
                
                // Get Minecraft name from first answer
                const answers = JSON.parse(application.answers);
                const minecraftName = answers[0] || user.username;

                // Send grant command
                const grantChannel = await fetchChannel(this.bot, this.bot.CONFIG.GRANT_COMMAND_CHANNEL);
                if (grantChannel) {
                    await grantChannel.send(`ogrant ${minecraftName} ${application.category} perm global Promoted`);
                }
                
                const embed = new EmbedBuilder()
                    .setTitle(MSG.APPLICATION_ACCEPTED_TITLE)
                    .setDescription(MSG.APPLICATION_ACCEPTED_BODY(application.category))
                    .setColor(0x00ff00);

                try {
                    await user.send({ embeds: [embed] });
                } catch (error) {
                    console.log(`Could not send DM to ${user.tag}`);
                }

                this.bot.db.run(
                    "UPDATE applications SET status = 'accepted', reviewed_by = ? WHERE id = ?",
                    [interaction.user.id, application.id]
                );

                await this.logApplicationAction(application.id, 'accepted', interaction.user.id);

                const promotionChannel = await fetchChannel(this.bot, this.bot.CONFIG.PROMOTION_LOG_CHANNEL);
                if (promotionChannel) {
                    const promotionEmbed = new EmbedBuilder()
                        .setTitle("🎉 Promotion")
                        .setDescription(MSG.APPLICATION_PROMOTION_LOG(user, application.category))
                        .setColor(0x00ff00)
                        .setTimestamp();

                    await promotionChannel.send({ embeds: [promotionEmbed] });
                }

                // Remove buttons from the application message
                await interaction.message.edit({ components: [] });

                await interaction.reply({
                    content: MSG.APPLICATION_ACCEPT_STAFF_CONFIRM(user.tag),
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            console.error('Error accepting application:', error);
            await interaction.reply({ 
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
                console.log(`Could not send DM to ${user.tag}`);
            }

            this.bot.db.run(
                "UPDATE applications SET status = 'denied', reviewed_by = ? WHERE id = ?",
                [interaction.user.id, application.id]
            );

            await this.logApplicationAction(application.id, 'denied', interaction.user.id);

            // Remove buttons from the application message
            await interaction.message.edit({ components: [] });
            
            await interaction.reply({
                content: MSG.APPLICATION_DENY_STAFF_CONFIRM(user.tag),
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error denying application:', error);
            await interaction.reply({
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async showReasonModal(interaction, action, applicationId) {
        const modal = new ModalBuilder()
            .setCustomId(`application_${action}_modal_${applicationId}`)
            .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} Application`);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for ' + action)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    }

    async handleReasonModal(interaction) {
        const customId = interaction.customId;
        
        // Extract action and application ID from modal customId
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

        this.bot.db.get(
            "SELECT * FROM applications WHERE id = ?",
            [applicationId],
            async (err, application) => {
                if (err || !application) {
                    await interaction.reply({ 
                        content: MSG.APPLICATION_NOT_FOUND,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const user = await this.bot.client.users.fetch(application.user_id);

                try {
                    if (action === 'accept') {
                        await this.acceptApplicationWithReason(interaction, application, user, reason);
                    } else if (action === 'deny') {
                        await this.denyApplicationWithReason(interaction, application, user, reason);
                    }
                } catch (error) {
                    console.error('Error handling reason modal:', error);
                    await interaction.reply({ 
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
            const member = await guild.members.fetch(application.user_id);
            const roleId = this.bot.RANK_ROLES[application.category];
            
            if (roleId) {
                await member.roles.add(roleId);

                // Get Minecraft name from first answer
                const answers = JSON.parse(application.answers);
                const minecraftName = answers[0] || user.username;

                // Send grant command
                const grantChannel = await fetchChannel(this.bot, this.bot.CONFIG.GRANT_COMMAND_CHANNEL);
                if (grantChannel) {
                    await grantChannel.send(`ogrant ${minecraftName} ${application.category} perm global Promoted`);
                }

                const embed = new EmbedBuilder()
                    .setTitle(MSG.APPLICATION_ACCEPTED_TITLE)
                    .setDescription(MSG.APPLICATION_ACCEPTED_REASON_BODY(application.category, reason))
                    .setColor(0x00ff00);

                try {
                    await user.send({ embeds: [embed] });
                } catch (error) {
                    console.log(`Could not send DM to ${user.tag}`);
                }

                this.bot.db.run(
                    "UPDATE applications SET status = 'accepted', reviewed_by = ?, review_reason = ? WHERE id = ?",
                    [interaction.user.id, reason, application.id]
                );

                await this.logApplicationAction(application.id, 'accepted_with_reason', interaction.user.id, reason);

                // Remove buttons from the application message
                await interaction.message.edit({ components: [] });

                await interaction.reply({
                    content: MSG.APPLICATION_ACCEPT_STAFF_CONFIRM(user.tag),
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            console.error('Error accepting application with reason:', error);
            await interaction.reply({ 
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
                console.log(`Could not send DM to ${user.tag}`);
            }

            this.bot.db.run(
                "UPDATE applications SET status = 'denied', reviewed_by = ?, review_reason = ? WHERE id = ?",
                [interaction.user.id, reason, application.id]
            );

            await this.logApplicationAction(application.id, 'denied_with_reason', interaction.user.id, reason);

            // Remove buttons from the application message
            await interaction.message.edit({ components: [] });
            
            await interaction.reply({
                content: MSG.APPLICATION_DENY_STAFF_CONFIRM(user.tag),
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error denying application with reason:', error);
            await interaction.reply({
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async openApplicationTicket(interaction, application, user) {
        const { ChannelType, PermissionsBitField } = require('discord.js');
        
        const categoryChannel = await fetchChannel(this.bot, this.bot.CONFIG.SUPPORT_CATEGORY);
        const guild = interaction.guild;

        const channelName = `application-${application.category}-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 100);

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
                .setLabel(MSG.CLOSE_BUTTON_LABEL)
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            await channel.send({ 
                content: `${user} ${interaction.user}`, 
                embeds: [embed], 
                components: [row] 
            });

            this.bot.db.run(
                "INSERT INTO tickets (user_id, channel_id, category) VALUES (?, ?, ?)",
                [user.id, channel.id, 'application']
            );

            await interaction.reply({
                content: MSG.TICKET_CREATED(channel),
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error opening application ticket:', error);
            await interaction.reply({
                content: MSG.GENERIC_ERROR,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async cancelApplication(interaction, reason = 'user_cancelled') {
        const userId = interaction.user?.id || interaction.user?.id;
        
        if (!userId) {
            console.error('No user ID found for cancellation');
            return;
        }

        const session = this.sessions.get(userId);
        const summarySession = this.summarySessions.get(userId);

        if (session) {
            if (session.applicationId) {
                this.bot.db.run(
                    "UPDATE applications SET status = 'cancelled' WHERE id = ?",
                    [session.applicationId]
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
                // If it's a message, try to send DM
                const user = this.bot.client.users.cache.get(userId);
                if (user) {
                    await user.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            if (error.code === 10062) { // Unknown interaction - ignore
                console.log('Interaction already acknowledged or expired');
            } else {
                console.error('Error cancelling application:', error);
            }
        }
    }

    async timeoutApplication(user) {
        const session = this.sessions.get(user.id);
        if (!session) return;

        this.bot.db.run(
            "UPDATE applications SET status = 'timeout' WHERE id = ?",
            [session.applicationId]
        );

        await this.logApplicationAction(session.applicationId, 'timeout', user.id);

        this.sessions.delete(user.id);
        this.summarySessions.delete(user.id);

        const embed = new EmbedBuilder()
            .setTitle(MSG.APPLICATION_TIMEOUT_TITLE)
            .setDescription(MSG.APPLICATION_TIMEOUT_BODY)
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
            [applicationId, action, userId, details]
        );
    }

    async checkSessions() {
        const now = new Date();
        for (const [userId, session] of this.sessions.entries()) {
            if (now > new Date(session.expiresAt)) {
                try {
                    const user = await this.bot.client.users.fetch(userId);
                    await this.timeoutApplication(user);
                } catch (err) {
                    console.error(`[checkSessions] Konnte User ${userId} nicht fetchen:`, err);
                    // Clean up session even if we can't notify the user
                    this.sessions.delete(userId);
                    this.summarySessions.delete(userId);
                }
            }
        }
    }
}

module.exports = ApplicationHandler;