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
const http = require('http');
const moment = require('moment-timezone');

const PREFIX = '!';
const LEADERSHIP_ROLE_ID = "1402400285674049714"; 
const SPECIAL_USER_ID = "1107787991444881408"; 
const ROLES_FILE = 'roles.json';
let rolesConfig = {};
let isWelcomerActive = false; // Will start only with command

// Confirmation Emojis
const EMOJI_ADDED = "<a:verify_checkpink:1428986926878163024>";
const EMOJI_REMOVED = "<a:Zx_:746055996362719244>";

// Welcome emojis
const orangeFlower = "<:orangeflower:1436795365172052018>";
const animatedFlower = "<a:animatedflowers:1436795411309395991>";
const robloxEmoji = "<:roblox:1337653461436596264>";
const handbookEmoji = "<:handbook:1406695333135650846>";

// Welcome channels
const WELCOME_CHANNEL_ID = "1402405984978341888"; 
const INFORMATION_CHANNEL_ID = "1402405335964057732"; 
const SUPPORT_CHANNEL_ID = "1402405357812187287"; 

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
        console.log("[DEBUG] Roles loaded successfully.");
    } catch (err) {
        console.error("[ERROR] Failed to load roles.json:", err);
        rolesConfig = {};
    }
}

// --- Roles panel ---
async function createRolesPanel(message) {
    if (!rolesConfig || Object.keys(rolesConfig).length === 0) {
        return message.channel.send("Error: roles.json is empty!").then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    }

    const embed = new EmbedBuilder()
        .setTitle(`${rolesConfig.EMBED_TITLE_EMOJI} **Adalea Roles**`)
        .setDescription(
            `Welcome to Adalea's Role Selection channel! This is the channel where you can obtain your pronouns, ping roles, and shift/session notifications. Simply click one of the buttons below (Pronouns, Pings, or Shifts), open the dropdown, and choose the roles you want. If you wish to remove a role, simply click the button again to unselect! If you have any issues, contact a member of the <@&1402411949593202800>.`
        )
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

    try {
        await message.channel.send({ embeds: [embed], components: [row] });
        console.log("[DEBUG] Roles panel sent successfully.");
    } catch (err) {
        console.error("[ERROR] Failed to send roles panel:", err);
    }
}

// --- Welcome message ---
async function sendWelcomeMessage(member, channel = null) {
    const targetChannel = channel || member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!targetChannel) return;

    const timeGMT = moment().tz("GMT").format("YYYY-MM-DD HH:mm:ss") + " GMT";

    await targetChannel.send(`Welcome, ${member}!`);

    const embed = new EmbedBuilder()
        .setTitle(`${orangeFlower} **Welcome to Adalea!**`)
        .setDescription(
            `Welcome, ${member}! We're so happy to have you here!\n\n` +
            `Adalea is a tropical-inspired restaurant experience on the Roblox platform that strives to create memorable and unique interactions for our guests.\n\n` +
            `Please make sure to review the <#${INFORMATION_CHANNEL_ID}> so you're aware of our server guidelines. If you have any questions or concerns, feel free to open a ticket in <#${SUPPORT_CHANNEL_ID}>. We hope you enjoy your stay! ${animatedFlower}`
        )
        .setImage("https://cdn.discordapp.com/attachments/1402400197874684027/1406391472714022912/banner.png?ex=691060e0&is=690f0f60&hm=50489a1967a090539ad600113390ed0bede095df7ba58eb28ac4c9e4a718edfa")
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

    await targetChannel.send({
        embeds: [embed],
        components: [row]
    });
}

// --- Interactions ---
client.on('interactionCreate', async interaction => {
    if (!interaction.inGuild()) return;
    const member = interaction.member;
    if (!member) return;

    if (interaction.isButton()) {
        let category, name, emoji;
        const id = interaction.customId;

        if (id === "roles_pronouns") { category = rolesConfig.PRONOUN_ROLES; name = "Pronouns"; emoji = "<:bluelotus:1436877456446459974>"; }
        if (id === "roles_pings") { category = rolesConfig.PINGS_ROLES; name = "Pings"; emoji = "<:lotus:1424840252945600632>"; }
        if (id === "roles_shifts") { category = rolesConfig.SHIFTS_ROLES; name = "Shifts"; emoji = "<:whitelotus:1436877184781258882>"; }
        if (!category) return;

        const options = category.map(role => 
            new StringSelectMenuOptionBuilder()
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

        await interaction.reply({
            content: `${emoji} **${name} Selection**`,
            components: [new ActionRowBuilder().addComponents(selectMenu)],
            ephemeral: true
        });
    }

    if (interaction.isStringSelectMenu()) {
        const selectId = interaction.customId;
        let allRoles = [];
        if (selectId.includes("pronouns")) allRoles = rolesConfig.PRONOUN_ROLES.map(r => r.roleId);
        if (selectId.includes("pings")) allRoles = rolesConfig.PINGS_ROLES.map(r => r.roleId);
        if (selectId.includes("shifts")) allRoles = rolesConfig.SHIFTS_ROLES.map(r => r.roleId);

        const newRoles = interaction.values;
        const currentRoles = member.roles.cache.map(r => r.id);
        const added = [], removed = [];

        for (const roleId of allRoles) {
            const hasRole = currentRoles.includes(roleId);
            const selected = newRoles.includes(roleId);
            if (selected && !hasRole) { try { await member.roles.add(roleId); added.push(`${EMOJI_ADDED} <@&${roleId}>`); } catch(e){console.error(e);} }
            if (!selected && hasRole) { try { await member.roles.remove(roleId); removed.push(`${EMOJI_REMOVED} <@&${roleId}>`); } catch(e){console.error(e);} }
        }

        let response = "Your roles have been updated!";
        if (added.length) response += `\nAdded: ${added.join(' ')}`;
        if (removed.length) response += `\nRemoved: ${removed.join(' ')}`;
        if (!added.length && !removed.length) response = "No changes made.";

        await interaction.update({ content: response, components: [], ephemeral: true });
    }
});

// --- Commands ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    const hasRole = message.member?.roles.cache.has(LEADERSHIP_ROLE_ID);
    const isSpecial = message.author.id === SPECIAL_USER_ID;

    if (!hasRole && !isSpecial && ["roles","welcomeadalea","stopwelcomeadalea","testwelcome","restart"].includes(command)) {
        return message.reply("You do not have permission to use this command.").then(msg => setTimeout(() => msg.delete().catch(() => {}),5000));
    }

    // Auto-delete user command message after 5 seconds
    message.delete().catch(() => {});

    if (command === 'roles') await createRolesPanel(message);

    if (command === "welcomeadalea") {
        if (isWelcomerActive) return message.channel.send(`${orangeFlower} **Welcomer is already active.**`).then(msg => setTimeout(() => msg.delete().catch(() => {}),5000));
        isWelcomerActive = true;
        return message.channel.send(`${orangeFlower} **Starting... Welcomer activated.**`).then(msg => setTimeout(() => msg.delete().catch(() => {}),5000));
    }

    if (command === "stopwelcomeadalea") {
        if (!isWelcomerActive) return message.channel.send(`${orangeFlower} **Welcomer is already inactive.**`).then(msg => setTimeout(() => msg.delete().catch(() => {}),5000));
        isWelcomerActive = false;
        return message.channel.send(`${orangeFlower} **Stopping... Welcomer deactivated.**`).then(msg => setTimeout(() => msg.delete().catch(() => {}),5000));
    }

    if (command === "testwelcome") {
        return sendWelcomeMessage(message.member, message.channel);
    }

    if (command === "restart") {
        await message.channel.send("Restarting... please stay on stand by").then(msg => setTimeout(() => msg.delete().catch(() => {}),5000));
        process.exit(1);
    }
});

// --- Member join ---
client.on("guildMemberAdd", async member => {
    if (isWelcomerActive) sendWelcomeMessage(member);
});

// --- Ready ---
client.once('ready', async () => {
    console.log(`Bot online as ${client.user.tag}`);
    await loadRolesConfig();
});

// --- Keep-alive ---
http.createServer((req,res)=>{res.writeHead(200);res.end('Alive');}).listen(process.env.PORT||3000);

// --- Login ---
client.login(process.env.BOT_TOKEN);