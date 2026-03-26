const { EmbedBuilder } = require('discord.js');
const MSG = require('../config/messages');

module.exports = {
    createSuccessEmbed(description) {
        return new EmbedBuilder()
            .setTitle('✅ Success')
            .setDescription(description)
            .setColor(0x00ff00)
            .setTimestamp();
    },

    createErrorEmbed(description) {
        return new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(description)
            .setColor(0xff0000)
            .setTimestamp();
    },

    createInfoEmbed(title, description, color = 0x0000ff) {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();
    },

    createWelcomeEmbed(member) {
        return new EmbedBuilder()
            .setTitle('👋 Welcome!')
            .setDescription(`Hey ${member.user.toString()}, welcome to **${member.guild.name}**!\n\nCheck out the rules and make yourself at home.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setColor(0x00ff00)
            .setTimestamp()
            .setFooter({ text: `Member #${member.guild.memberCount}` });
    },

    createApplicationEmbed(application, user) {
        const embed = new EmbedBuilder()
            .setTitle(`${application.category} Application - ${user.tag}`)
            .setColor(0x0000ff)
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();

        const answers = JSON.parse(application.answers);
        answers.forEach((answer, index) => {
            embed.addFields({
                name: `Question ${index + 1}`,
                value: answer.length > 1024 ? answer.substring(0, 1020) + '...' : answer,
                inline: false
            });
        });

        return embed;
    },

    createTicketEmbed(ticket, user) {
        const categoryConfig = {
            general: { name: "ℹ️ General Support", color: 0x00ff00 },
            bug: { name: "🐛 Bug Report", color: 0xff0000 },
            player: { name: "⚠️ Player Report", color: 0xff0000 },
            appeal: { name: "🔓 Punishment Appeal", color: 0x0000ff },
            payment: { name: "💰 Payment Support", color: 0x0000ff }
        };

        const config = categoryConfig[ticket.category] || { name: 'Unknown', color: 0x808080 };

        return new EmbedBuilder()
            .setTitle(config.name)
            .setDescription(MSG.TICKET_WELCOME(user, ''))
            .setColor(config.color)
            .setTimestamp();
    }
};