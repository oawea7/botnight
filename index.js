Const { 
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
// --- BOOSTER CONFIGURATION ---
const COMMUNITY_CHANNEL_ID = "1402405984978341888"; // Channel for the thank you embed
const SERVER_BOOSTER_ROLE_ID = "1404242033849270272"; // The Server Booster role ID
const SERVER_LOUNGE_CHANNEL_ID = "1414381377389858908"; // Channel for the welcome message
// --- UPDATED LEADERSHIP ROLE ID ---
const LEADERSHIP_ROLE_ID = "1402400285674049576"; // Corrected ID per your request
const SPECIAL_USER_ID = "1107787991444881408"; 
const ROLES_FILE = 'roles.json';
let rolesConfig = {};
let isWelcomerActive = false; // Welcomer starts OFF

// Updated confirmation emojis per your request
const EMOJI_ADDED = "<a:Zcheck:1437064263570292906>";        // new check for added
const EMOJI_REMOVED = "<a:Zx_:1437064220876472370>";       // X-ish emoji used for removed/errors (per your instruction)

// Welcome emojis (unchanged)
const orangeFlower = "<:orangeflower:1436795365172052018>";
const animatedFlower = "<a:animatedflowers:1436795411309395991>";
const robloxEmoji = "<:roblox:1337653461436596264>";
const handbookEmoji = "<:handbook:1406695333135650846>";

// Welcome channels (you set these)
const WELCOME_CHANNEL_ID = "1402405984978341888"; 
const INFORMATION_CHANNEL_ID = "1402405335964057732"; 
const SUPPORT_CHANNEL_ID = "1402405357812187287"; 

// Moderation ping role (unchanged)
const MODERATION_ROLE_ID = "1402411949593202800";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- LOAD roles.json ---
async function loadRolesConfig() {
    try {
        rolesConfig = await fs.readJson(ROLES_FILE);
        // Append "Any" pronoun role if it's not present already
        if (!Array.isArray(rolesConfig.PRONOUN_ROLES)) rolesConfig.PRONOUN_ROLES = [];
        const anyExists = rolesConfig.PRONOUN_ROLES.some(r => r.roleId === "1402704905264697374");
        if (!anyExists) {
            rolesConfig.PRONOUN_ROLES.push({ label: "Any", roleId: "1402704905264697374" });
            console.log("[DEBUG] Added pronoun role 'Any' to rolesConfig (automatic).");
        }
        console.log("[DEBUG] Roles loaded successfully.");
    } catch (err) {
        console.error("[ERROR] Failed to load roles.json:", err);
        rolesConfig = {};
    }
}

// --- BOOSTER LOGIC FUNCTIONS ---

// The embed for the thank-you message (based on the video content)
function createBoosterThankYouEmbed(member) {
    return new EmbedBuilder()
        .setTitle(`Thank you for boosting Adalea, ${member.user.tag}!`)
        .setDescription(
            `Have it when the code i'm abt to send... \n\n` +
            `This embed each time someone's boosts ,first pinging the user in plain text then sending this title: Thank you for boosting Adalea, @user! body text: Your support helps our tropical island grow brighter and cozier every day! ${orangeFlower}`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor("#FFCC33"); // Adjusted to the embed color in the video
}

async function handleBoosterStatusChange(oldMember, newMember) {
    const boosterRole = newMember.guild.roles.cache.get(SERVER_BOOSTER_ROLE_ID);
    const communityChannel = newMember.guild.channels.cache.get(COMMUNITY_CHANNEL_ID);
    const loungeChannel = newMember.guild.channels.cache.get(SERVER_LOUNGE_CHANNEL_ID);

    if (!boosterRole || !communityChannel || !loungeChannel) {
        console.error("[ERROR] Booster config missing (role/channels).");
        return;
    }

    const wasBoosting = oldMember.premiumSince;
    const isBoosting = newMember.premiumSince;
    const hasRole = newMember.roles.cache.has(SERVER_BOOSTER_ROLE_ID);

    // --- CASE 1: Member started boosting (or re-boosting) ---
    // premiumSince will change from null/undefined to a Date object, OR it's a new member who boosts immediately
    if (isBoosting && !hasRole) {
        try {
            await newMember.roles.add(boosterRole, "Server Booster: Started/Re-started boosting.");
            
            // 1. Send thank you embed in community channel
            await communityChannel.send({ 
                content: `${newMember},`, // Ping the user first
                embeds: [createBoosterThankYouEmbed(newMember)] 
            });

            // 2. Send welcome message in server lounge
            await loungeChannel.send(`Welcome, ${newMember} to the booster-lounge.`).catch(console.error);
            console.log(`[BOOSTER] ${newMember.user.tag} started boosting. Role assigned and messages sent.`);
        } catch (error) {
            console.error(`[BOOSTER] Failed to assign role or send messages for ${newMember.user.tag}:`, error);
        }
    }

    // --- CASE 2: Member stopped boosting AND has 0 total boosts (Role removal) ---
    // The role should only be removed if the member is no longer boosting (premiumSince is null) AND they currently have the role.
    // Discord handles multiple boosts/unboosts; we just check if they are *currently* boosting.
    if (!isBoosting && hasRole) {
        try {
            await newMember.roles.remove(boosterRole, "Server Booster: Stopped boosting (0 total boosts).");
            
            // Optionally, send a message about losing perks
            await communityChannel.send(`Sadly, ${newMember} is no longer boosting and has lost the booster role and perks.`).catch(console.error);
            console.log(`[BOOSTER] ${newMember.user.tag} stopped boosting. Role removed.`);
        } catch (error) {
            // Note: If the member has multiple boosts, `isBoosting` will still be non-null 
            // until their total effective boosts drops to zero. 
            // The logic here correctly relies on Discord setting `premiumSince` to null when the member has 0 effective boosts.
            console.error(`[BOOSTER] Failed to remove role for ${newMember.user.tag}:`, error);
        }
    }
}

// --- ROLES PANEL ---
// (createRolesPanel function remains the same)
async function createRolesPanel(message) {
    if (!rolesConfig || Object.keys(rolesConfig).length === 0) {
        return message.channel.send("Error: roles.json is empty!").then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    }

    const embed = new EmbedBuilder()
        .setTitle(`${rolesConfig.EMBED_TITLE_EMOJI} **Adalea Roles**`)
        .setDescription(
            `Welcome to Adalea's Role Selection channel! This is the channel where you can obtain your pronouns, ping roles, and shift/session notifications. Simply click one of the buttons below (Pronouns, Pings, or Sessions), open the dropdown, and choose the roles you want. If you wish to remove a role, simply click the button again to unselect! If you have any issues, contact a member of the <@&${MODERATION_ROLE_ID}>.`
        )
        .setImage(rolesConfig.EMBED_IMAGE)
        .setColor(rolesConfig.EMBED_COLOR);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('roles_pronouns')
            .setLabel('Pronouns')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ id: (rolesConfig.BUTTON_EMOJIS && rolesConfig.BUTTON_EMOJIS.pronoun && (rolesConfig.BUTTON_EMOJIS.pronoun.match(/\d+/) || [])[0]) || null }),
        new ButtonBuilder()
            .setCustomId('roles_pings')
            .setLabel('Pings')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ id: (rolesConfig.BUTTON_EMOJIS && rolesConfig.BUTTON_EMOJIS.pings && (rolesConfig.BUTTON_EMOJIS.pings.match(/\d+/) || [])[0]) || null }),
        // Button renamed to "Sessions" (uses same SHIFTS_ROLES data)
        new ButtonBuilder()
            .setCustomId('roles_sessions')
            .setLabel('Sessions')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ id: (rolesConfig.BUTTON_EMOJIS && rolesConfig.BUTTON_EMOJIS.shifts && (rolesConfig.BUTTON_EMOJIS.shifts.match(/\d+/) || [])[0]) || null })
    );

    try {
        const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });
        console.log("[DEBUG] Roles panel sent successfully.");
        // auto-delete the user's command message after 5 seconds if possible
        if (message.channel.permissionsFor(client.user).has('ManageMessages')) {
            setTimeout(() => message.delete().catch(() => {}), 5000);
        }
        // Keep the embed (do not delete it)
    } catch (err) {
        console.error("[ERROR] Failed to send roles panel:", err);
    }
}

// --- WELCOME MESSAGE (restored original format) ---
// (sendWelcomeMessage function remains the same)
async function sendWelcomeMessage(member, channel = null) {
    const targetChannel = channel || member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!targetChannel) return;

    const timeGMT = moment().tz("GMT").format("YYYY-MM-DD HH:mm:ss") + " GMT";

    // Text mention first (unchanged original)
    await targetChannel.send(`Welcome, ${member}!`);

    // Embed following the original format (kept wording & emojis)
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

// --- INTERACTIONS ---
// (client.on('interactionCreate') remains the same)
client.on('interactionCreate', async interaction => {
    if (!interaction.inGuild()) return;
    const member = interaction.member;
    if (!member) return;

    if (interaction.isButton()) {
        let category, name, emoji;
        const id = interaction.customId;

        if (id === "roles_pronouns") { category = rolesConfig.PRONOUN_ROLES; name = "Pronouns"; emoji = "<:bluelotus:1436877456446459974>"; }
        if (id === "roles_pings") { category = rolesConfig.PINGS_ROLES; name = "Pings"; emoji = "<:lotus:1424840252945600632>"; }
        // Sessions button maps to SHIFTS_ROLES data (no change to your data file)
        if (id === "roles_sessions") { category = rolesConfig.SHIFTS_ROLES; name = "Sessions"; emoji = "<:whitelotus:1436877184781258882>"; }
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
        if (selectId.includes("sessions") || selectId.includes("shifts")) allRoles = rolesConfig.SHIFTS_ROLES.map(r => r.roleId);

        const newRoles = interaction.values || [];
        const currentRoles = interaction.member.roles.cache.map(r => r.id);
        const added = [], removed = [];

        for (const roleId of allRoles) {
            const hasRole = currentRoles.includes(roleId);
            const selected = newRoles.includes(roleId);
            if (selected && !hasRole) { 
                try { 
                    await interaction.member.roles.add(roleId); 
                    added.push(`${EMOJI_ADDED} <@&${roleId}>`); 
                } catch(e){ 
                    console.error(e); 
                } 
            }
            if (!selected && hasRole) { 
                try { 
                    await interaction.member.roles.remove(roleId); 
                    // per your instruction, use the X-style emoji for removals
                    removed.push(`${EMOJI_REMOVED} <@&${roleId}>`); 
                } catch(e){ 
                    console.error(e); 
                } 
            }
        }

        let response = "Your roles have been updated!";
        if (added.length) response += `\nAdded: ${added.join(' ')}`;
        if (removed.length) response += `\nRemoved: ${removed.join(' ')}`;
        if (!added.length && !removed.length) response = "No changes made.";

        await interaction.update({ content: response, components: [], ephemeral: true });
    }
});

// --- COMMANDS (FIXED PERMISSION LOGIC) ---
// (client.on('messageCreate') remains the same)
client.on('messageCreate', async message => {
    // 1. Basic checks (Ensure member object exists)
    if (message.author.bot || !message.content.startsWith(PREFIX) || !message.member) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // 2. Permission Check Preparation
    const hasRole = message.member.roles.cache.has(LEADERSHIP_ROLE_ID);
    const isSpecial = message.author.id === SPECIAL_USER_ID;
    const isAuthorized = hasRole || isSpecial;

    // 3. Define commands that require authorization
    const authorizedCommands = ["roles", "welcomeadalea", "stopwelcomeadalea", "testwelcome", "restart"];

    // 4. Permission Check & Handle Unauthorized Access (Crucial Fix)
    if (authorizedCommands.includes(command) && !isAuthorized) {
        // Send the permission error message
        const reply = await message.reply("You do not have permission to use this command.");
        // Delete the error message after 5 seconds
        setTimeout(() => reply.delete().catch(() => {}), 5000);
        return; // Stop execution immediately for unauthorized users
    }

    // 5. Delete the User's Command Message (Only runs if authorized or command doesn't require auth)
    try {
        if (message.channel.permissionsFor(client.user).has('ManageMessages')) {
            // Delete the user's command message immediately 
            await message.delete().catch(() => {});
        } else {
            // Fallback for timed delete if bot lacks ManageMessages permission
            setTimeout(() => message.delete().catch(() => {}), 5000);
        }
    } catch (e) {
        // ignore deletion errors
    }

    // --- Command Execution ---

    if (command === 'roles') {
        await createRolesPanel(message);
        return;
    }

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
        // send the welcome message into the current channel (works even if welcomer is off)
        await sendWelcomeMessage(message.member, message.channel);
        return;
    }

    if (command === "restart") {
        const sentMsg = await message.channel.send("Restarting... please stay on stand by");
        setTimeout(() => sentMsg.delete().catch(() => {}), 5000); 
        process.exit(1);
    }
});

// --- MEMBER JOIN ---
client.on("guildMemberAdd", async member => {
    if (isWelcomerActive) sendWelcomeMessage(member);
});

// --- MEMBER UPDATE (BOOSTER LOGIC) ---
client.on("guildMemberUpdate", async (oldMember, newMember) => {
    // Check if the boost status *might* have changed
    if (oldMember.premiumSince !== newMember.premiumSince || 
        !oldMember.roles.cache.has(SERVER_BOOSTER_ROLE_ID) !== !newMember.roles.cache.has(SERVER_BOOSTER_ROLE_ID)) 
    {
        await handleBoosterStatusChange(oldMember, newMember);
    }
});

// --- READY ---
client.once('ready', async () => {
    console.log(`Bot online as ${client.user.tag}`);
    await loadRolesConfig();
});

// --- KEEP-ALIVE ---
http.createServer((req,res)=>{res.writeHead(200);res.end('Alive');}).listen(process.env.PORT||3000);

// --- LOGIN ---
client.login(process.env.BOT_TOKEN);
