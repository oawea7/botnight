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
const fs = require('fs-extra');
const moment = require('moment-timezone');
const http = require('http');

// ------------------ CONFIG ------------------
const PREFIX = '!';
const LEADERSHIP_ROLE_ID = "1402400285674049714";
const SPECIAL_USER_ID = "1107787991444881408";
const ROLES_FILE = 'roles.json';
let rolesConfig = {};
let isWelcomerActive = true;

// Emojis for role feedback
const EMOJI_ADDED = "<a:verify_checkpink:1428986926878163024>";
const EMOJI_REMOVED = "<a:Zx_:746055996362719244>";

// Welcome channel IDs
const WELCOME_CHANNEL_ID = "1436747102897049714";
const INFORMATION_CHANNEL_ID = "1402405335964057732";
const SUPPORT_CHANNEL_ID = "1402405357812187287";

// Welcome button emojis
const orangeFlower = "<:orangeflower:1436795365172052018>";
const animatedFlower = "<a:animatedflowers:1436795411309395991>";
const robloxEmoji = "<:roblox:1337653461436596264>";
const handbookEmoji = "<:handbook:1406695333135650846>";

// ------------------ CLIENT ------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ------------------ LOAD ROLES ------------------
async function loadRolesConfig() {
    try {
        rolesConfig = await fs.readJson(ROLES_FILE);
        console.log("[DEBUG] Roles loaded successfully");
    } catch (err) {
        console.error("[ERROR] Failed to load roles.json:", err);
        rolesConfig = {};
    }
}

// ------------------ WELCOME MESSAGE ------------------
async function sendWelcomeMessage(member) {
    if (!isWelcomerActive) return;
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const timeGMT = moment().tz("GMT").format("YYYY-MM-DD HH:mm:ss") + " GMT";

    const embed = new EmbedBuilder()
        .setTitle(`${orangeFlower} **Welcome to Adalea!**`) 
        .setDescription(
            `Welcome, ${member}! We're so happy to have you here!\n\n` +
            `Adalea is a tropical-inspired restaurant experience on Roblox.\n\n` +
            `Check <#${INFORMATION_CHANNEL_ID}> for server guidelines. Open a ticket in <#${SUPPORT_CHANNEL_ID}> if you have questions. ${animatedFlower}`
        )
        .setImage("https://cdn.discordapp.com/attachments/1402400197874684027/1406391472714022912/banner.png")
        .setFooter({ text: `We are now at ${member.guild.memberCount} Discord members | ${timeGMT}` })
        .setColor("#FFCC33");

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Roblox Group")
            .setStyle(ButtonStyle.Link)
            .setURL("https://www.roblox.com/communities/250548768/Adalea#!/about")
            .setEmoji(robloxEmoji), 
        new ButtonBuilder()
            .setLabel("Public Handbook")
            .setStyle(ButtonStyle.Link)
            .setURL("https://devforum.roblox.com/t/adalea-handbook/3925323")
            .setEmoji(handbookEmoji) 
    );

    channel.send({ content: `Welcome, ${member}!`, embeds: [embed], components: [row] });
}

// ------------------ SELF-ROLES PANEL ------------------
async function createRolesPanel(message) {
    if (!rolesConfig || Object.keys(rolesConfig).length === 0) {
        return message.channel.send("Error: roles.json is empty! Check console logs.");
    }

    const embed = new EmbedBuilder()
        .setTitle(`${rolesConfig.EMBED_TITLE_EMOJI} **Adalea Roles**`)
        .setDescription("Pick your Pronouns, Pings, or Shifts by clicking the buttons below and selecting roles from the dropdown. Unselect to remove. Contact @Moderation Team if issues.")
        .setImage(rolesConfig.EMBED_IMAGE)
        .setColor(rolesConfig.EMBED_COLOR);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('roles_pronouns')
            .setLabel('Pronouns')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ id: rolesConfig.BUTTON_EMOJIS.pronoun.match(/\d+/)[0] }),
        new ButtonBuilder()
            .setCustomId('roles_pings')
            .setLabel('Pings')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ id: rolesConfig.BUTTON_EMOJIS.pings.match(/\d+/)[0] }),
        new ButtonBuilder()
            .setCustomId('roles_shifts')
            .setLabel('Shifts')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ id: rolesConfig.BUTTON_EMOJIS.shifts.match(/\d+/)[0] })
    );

    await message.channel.send({ embeds: [embed], components: [row] });
}

// ------------------ EVENTS ------------------
client.on("guildMemberAdd", sendWelcomeMessage);

client.on('interactionCreate', async interaction => {
    if (!interaction.inGuild()) return;
    const member = interaction.member;
    if (!member) return;

    // ---- BUTTONS ----
    if (interaction.isButton()) {
        let category, name, emoji;
        if (interaction.customId === "roles_pronouns") { category = rolesConfig.PRONOUN_ROLES; name="Pronouns"; emoji=rolesConfig.DROPDOWN_EMOJIS.pronoun; }
        if (interaction.customId === "roles_pings") { category = rolesConfig.PINGS_ROLES; name="Pings"; emoji=rolesConfig.DROPDOWN_EMOJIS.pings; }
        if (interaction.customId === "roles_shifts") { category = rolesConfig.SHIFTS_ROLES; name="Shifts"; emoji=rolesConfig.DROPDOWN_EMOJIS.shifts; }
        if (!category) return;

        const options = category.map(role => new StringSelectMenuOptionBuilder()
            .setLabel(role.label)
            .setValue(role.roleId)
            .setDefault(member.roles.cache.has(role.roleId))
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_${name.toLowerCase()}`)
            .setPlaceholder(`Select ${name} roles...`)
            .setMinValues(0)
            .setMaxValues(options.length)
            .addOptions(options);

        await interaction.reply({ content: `${emoji} **${name} Selection**`, components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
    }

    // ---- DROPDOWN ----
    if (interaction.isStringSelectMenu()) {
        let allRoles = [];
        if (interaction.customId.includes("pronouns")) allRoles = rolesConfig.PRONOUN_ROLES.map(r=>r.roleId);
        if (interaction.customId.includes("pings")) allRoles = rolesConfig.PINGS_ROLES.map(r=>r.roleId);
        if (interaction.customId.includes("shifts")) allRoles = rolesConfig.SHIFTS_ROLES.map(r=>r.roleId);

        const newRoles = interaction.values;
        const currentRoles = member.roles.cache.map(r => r.id);

        const added=[], removed=[];
        for (const roleId of allRoles) {
            const hasRole = currentRoles.includes(roleId);
            const selected = newRoles.includes(roleId);
            if (selected && !hasRole) { try{ await member.roles.add(roleId); added.push(`${EMOJI_ADDED} <@&${roleId}>`);} catch(e){console.error(e);} }
            if (!selected && hasRole) { try{ await member.roles.remove(roleId); removed.push(`${EMOJI_REMOVED} <@&${roleId}>`);} catch(e){console.error(e);} }
        }

        let response="Your roles have been updated!";
        if (added.length) response+=`\nAdded: ${added.join(' ')}`;
        if (removed.length) response+=`\nRemoved: ${removed.join(' ')}`;
        if (!added.length && !removed.length) response="No changes made.";

        await interaction.update({ content: response, components: [], ephemeral: true });
    }
});

// ------------------ COMMANDS ------------------
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    const hasRole = message.member?.roles.cache.has(LEADERSHIP_ROLE_ID);
    const isSpecial = message.author.id === SPECIAL_USER_ID;

    if (command === 'roles') {
        if (!hasRole && !isSpecial) return message.reply("You do not have permission to use this command.");
        await createRolesPanel(message);
    }
});

// ------------------ READY ------------------
client.once('ready', async () => {
    console.log(`[BOT] Logged in as ${client.user.tag}`);
    await loadRolesConfig();
});

// ------------------ KEEP ALIVE ------------------
http.createServer((req,res)=>{res.writeHead(200);res.end('Alive');}).listen(process.env.PORT||3000);

// ------------------ LOGIN ------------------
client.login(process.env.BOT_TOKEN);

