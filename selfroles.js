const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const http = require('http');
const fs = require('fs-extra');

const PREFIX = '!';
const LEADERSHIP_ROLE_ID = "1402400285674049714"; // LT+ Role
const SPECIAL_USER_ID = "1107787991444881408";     // Specific user
const ROLES_FILE = 'roles.json';

let rolesConfig = {};

const EMOJI_ADDED = "<a:verify_checkpink:1428986926878163024>";
const EMOJI_REMOVED = "<a:Zx_:746055996362719244>";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- Load roles.json ---
async function loadRolesConfig() {
    try {
        rolesConfig = await fs.readJson(ROLES_FILE);
        console.log("Roles configuration loaded successfully.");
    } catch (error) {
        console.error("CRITICAL ERROR: Could not load roles.json:", error.message);
        rolesConfig = {};
    }
}

// --- Create the roles panel ---
async function createRolesPanel(message) {
    if (!rolesConfig || Object.keys(rolesConfig).length === 0) {
        return message.channel.send("Error: Role configuration is empty.").then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    }

    // Embed
    const roleEmbed = new EmbedBuilder()
        .setTitle(`${rolesConfig.EMBED_TITLE_EMOJI} **Adalea Roles**`)
        .setDescription(
            "Welcome to Adalea's Role Selection channel! You can pick your pronouns, ping roles, and shift/session notifications. Click a button below (**Pronouns**, **Pings**, **Shifts**) to open the dropdown and select roles. Unselect to remove. For issues, contact a member of the **@Moderation Team**."
        )
        .setImage(rolesConfig.EMBED_IMAGE)
        .setColor(rolesConfig.EMBED_COLOR);

    // Buttons (fix emoji format for Discord.js)
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('roles_pronouns_btn')
            .setLabel('Pronouns')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ id: rolesConfig.BUTTON_EMOJIS.pronoun.match(/\d+/)[0] }),
        new ButtonBuilder()
            .setCustomId('roles_pings_btn')
            .setLabel('Pings')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ id: rolesConfig.BUTTON_EMOJIS.pings.match(/\d+/)[0] }),
        new ButtonBuilder()
            .setCustomId('roles_shifts_btn')
            .setLabel('Shifts')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ id: rolesConfig.BUTTON_EMOJIS.shifts.match(/\d+/)[0] })
    );

    try {
        await message.channel.send({ embeds: [roleEmbed], components: [row] });
        console.log(`Successfully posted roles panel to channel ${message.channel.id}`);
    } catch (error) {
        console.error("ERROR sending roles panel:", error);
    }
}

// --- Handle interactions ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    if (!interaction.inGuild()) return;

    const member = interaction.member;
    const customId = interaction.customId;

    // --- BUTTON CLICK ---
    if (interaction.isButton() && customId.startsWith('roles_')) {
        let rolesCategory, categoryName, emoji;
        if (customId === 'roles_pronouns_btn') {
            rolesCategory = rolesConfig.PRONOUN_ROLES;
            categoryName = "Pronouns";
            emoji = rolesConfig.DROPDOWN_EMOJIS.pronoun;
        } else if (customId === 'roles_pings_btn') {
            rolesCategory = rolesConfig.PINGS_ROLES;
            categoryName = "Pings";
            emoji = rolesConfig.DROPDOWN_EMOJIS.pings;
        } else if (customId === 'roles_shifts_btn') {
            rolesCategory = rolesConfig.SHIFTS_ROLES;
            categoryName = "Shifts";
            emoji = rolesConfig.DROPDOWN_EMOJIS.shifts;
        }

        if (!rolesCategory || rolesCategory.length === 0) {
            return interaction.reply({ content: `No roles configured for ${categoryName}.`, ephemeral: true });
        }

        const options = rolesCategory.map(role => new StringSelectMenuOptionBuilder()
            .setLabel(role.label)
            .setValue(role.roleId)
            .setDefault(member.roles.cache.has(role.roleId))
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`role_select_${categoryName.toLowerCase()}`)
            .setPlaceholder(`Select ${categoryName} roles...`)
            .setMinValues(0)
            .setMaxValues(options.length)
            .addOptions(options);

        await interaction.reply({
            content: `${emoji} **${categoryName} Selection**\nSelect roles or unselect to remove.`,
            components: [new ActionRowBuilder().addComponents(selectMenu)],
            ephemeral: true
        });
        return;
    }

    // --- DROPDOWN SELECTION ---
    if (interaction.isStringSelectMenu() && customId.startsWith('role_select_')) {
        let allCategoryRoles = [];
        if (customId.includes('pronouns')) allCategoryRoles = rolesConfig.PRONOUN_ROLES.map(r => r.roleId);
        if (customId.includes('pings')) allCategoryRoles = rolesConfig.PINGS_ROLES.map(r => r.roleId);
        if (customId.includes('shifts')) allCategoryRoles = rolesConfig.SHIFTS_ROLES.map(r => r.roleId);

        const newRoleIds = interaction.values;
        const currentMemberRoleIds = member.roles.cache.map(r => r.id);

        const addedRoles = [];
        const removedRoles = [];

        for (const roleId of allCategoryRoles) {
            const hasRole = currentMemberRoleIds.includes(roleId);
            const selected = newRoleIds.includes(roleId);

            if (selected && !hasRole) {
                try { await member.roles.add(roleId); addedRoles.push(`${EMOJI_ADDED} <@&${roleId}>`); } 
                catch (e) { console.error(`Failed to add role ${roleId}:`, e); }
            }
            if (!selected && hasRole) {
                try { await member.roles.remove(roleId); removedRoles.push(`${EMOJI_REMOVED} <@&${roleId}>`); } 
                catch (e) { console.error(`Failed to remove role ${roleId}:`, e); }
            }
        }

        let response = "Your roles have been updated!";
        if (addedRoles.length) response += `\nAdded: ${addedRoles.join(' ')}`;
        if (removedRoles.length) response += `\nRemoved: ${removedRoles.join(' ')}`;
        if (!addedRoles.length && !removedRoles.length) response = "No changes made.";

        await interaction.update({ content: response, components: [], ephemeral: true });
    }
});

// --- MESSAGE COMMAND ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    const hasLeadershipRole = message.member?.roles?.cache.has(LEADERSHIP_ROLE_ID);
    const isSpecialUser = message.author.id === SPECIAL_USER_ID;

    if (command === 'roles') {
        if (!hasLeadershipRole && !isSpecialUser) return message.reply("You do not have permission to use this command.");

        // Delete after 2 seconds
        if (message.channel.permissionsFor(client.user).has('ManageMessages')) {
            setTimeout(() => message.delete().catch(() => {}), 2000);
        }

        await createRolesPanel(message);
    }
});

// --- READY ---
client.once('ready', async () => {
    console.log(`Self-Roles Bot logged in as ${client.user.tag}`);
    await loadRolesConfig();
});

// --- KEEP-ALIVE SERVER ---
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive!');
});
server.listen(process.env.PORT || 3000, () => console.log(`Server listening on port ${process.env.PORT || 3000}`));

client.login(process.env.BOT_TOKEN);
