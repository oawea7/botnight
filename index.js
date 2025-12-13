const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require("discord.js");
const fs = require("fs-extra");
const http = require("http");
const moment = require("moment-timezone");

// ─── CONSTANTS ─────────────────────────────────────────────

const PREFIX = "\!";
const LEADERSHIP_ROLE_ID = "1402400285674049576";
const SPECIAL_USER_ID = "1107787991444881408";
const ROLES_FILE = "roles.json";
let rolesConfig = {};
let isWelcomerActive = true; // Welcomer is set to ACTIVE by default

// Channels & Roles IDs
const COMMUNITY_CHANNEL_ID = "1402405984978341888"; // Also WELCOME_CHANNEL_ID
const BOOSTER_LOUNGE_CHANNEL_ID = "1414381377389858908";
const SERVER_BOOSTER_ROLE_ID = "1404242033849270272";
const INFORMATION_CHANNEL_ID = "1402405335964057732";
const SUPPORT_CHANNEL_ID = "1402405357812187287";
// Using the correct MODERATION_ROLE_ID from your linked document
const MODERATION_ROLE_ID = "1402411949593202800"; 

// Emojis
const EMOJI_ADDED = "\<a:Zcheck:1437064263570292906\>";
const EMOJI_REMOVED = "\<a:Zx_:1437064220876472370\>";
const orangeFlower = "\<:orangeflower:1436795365172052018\>";
const animatedFlower = "\<a:animatedflowers:1436795411309395991\>";
const robloxEmoji = "\<:roblox:1337653461436596264\>";
const handbookEmoji = "\<:handbook:1406695333135650846\>";

// Welcome Embed Image URL (Restored to its original value)
const welcomeEmbedImage = "https://cdn.discordapp.com/attachments/1402400197874684027/1406391472714022912/banner.png";

// Button Emoji IDs from your JSON
const PRONOUNS_EMOJI_ID = '1438666085737041981'; // Red Flower
const PINGS_EMOJI_ID = '1438666045203284102'; // White Flower
const SESSIONS_EMOJI_ID = '1438665987145728051'; // Yellow Flower

// ─── NEW MR ROLES CONSTANTS ─────────────────────────────

const STAFF_BIRTHDAYS_ROLE_ID = "1402729685527429182";
const ALLIANCE_VISITS_ROLE_ID = "1442988716313411594";

// Map of Timezone Role IDs to their GMT labels
const TIMEZONE_ROLES = {
    '1418228585004531794': 'GMT 0',
    '1429399823857221702': 'GMT +1',
    '1418229096378269867': 'GMT +2',
    '1439580363419553903': 'GMT +3',
    '1439013856310460506': 'GMT +4',
    '1447381524164116660': 'GMT +5:30',
    '1438557821896491008': 'GMT +8',
    '1447303642607779922': 'GMT -1',
    '1441209637889376488': 'GMT -3',
    '1438560845620838471': 'GMT -3:30',
    '1418260535476097094': 'GMT -5',
    '1418241166159380551': 'GMT -6',
    '1418662112389234708': 'GMT -8',
};

// Array of all Timezone Role IDs for easy removal
const TIMEZONE_ROLE_IDS = Object.keys(TIMEZONE_ROLES);

// ─── CLIENT ────────────────────────────────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// ─── LOAD ROLES CONFIG ─────────────────────────────────────

async function loadRolesConfig() {
    try {
        rolesConfig = await fs.readJson(ROLES_FILE);
        // Fix: Ensure all three role arrays exist in the config to prevent crashes
        if (!Array.isArray(rolesConfig.PRONOUN_ROLES)) rolesConfig.PRONOUN_ROLES = [];
        if (!Array.isArray(rolesConfig.PINGS_ROLES)) rolesConfig.PINGS_ROLES = [];
        if (!Array.isArray(rolesConfig.SHIFTS_ROLES)) rolesConfig.SHIFTS_ROLES = [];
        if (!Array.isArray(rolesConfig.MANAGEMENT_ROLES)) rolesConfig.MANAGEMENT_ROLES = [];
        if (!Array.isArray(rolesConfig.TIMEZONE_ROLES)) rolesConfig.TIMEZONE_ROLES = [];
        
        // Auto-add "Any" pronoun role for stability
        const anyExists = rolesConfig.PRONOUN_ROLES.some(
            (r) => r.roleId === "1402704905264697374"
        );
        if (!anyExists) {
            rolesConfig.PRONOUN_ROLES.push({
                label: "Any",
                roleId: "1402704905264697374",
            });
            console.log("\[DEBUG\] Added pronoun role 'Any' to rolesConfig.");
        }
        console.log("\[DEBUG\] Roles config loaded successfully.");
    } catch (err) {
        // This catches the 'Error: No roles config loaded.'
        console.error(`\[ERROR\] Failed to load ${ROLES_FILE}. Check file existence and JSON format:`, err.message);
        rolesConfig = {};
    }
}

// ─── BOOST FUNCTIONS (NO CHANGES) ───────────────────────────────────────

async function sendBoostThankYou(member, channel = null) {
    try {
        const targetChannel = channel || member.guild.channels.cache.get(COMMUNITY_CHANNEL_ID);
        if (!targetChannel) return console.error(`\[ERROR\] Boost Thank You Channel ${COMMUNITY_CHANNEL_ID} not found.`);

        await targetChannel.send(`Thank you, <@${member.id}>!`);
        const embed = new EmbedBuilder()
            .setTitle("Thank you for boosting! \<:Booster:1424080874890072205\>")
            .setDescription(
                `Thank you, <@${member.id}>! Your support helps our tropical island grow brighter and cozier every day! \<:flower:1424840226785988608\>`
            )
            .setColor("\#FFCC33");
        await targetChannel.send({ embeds: [embed] });

    } catch (e) {
        console.error(`\[ERROR\] Failed to send boost thank you message for ${member.user.tag}:`, e);
    }
}

async function sendBoosterLoungeWelcome(member, channel = null) {
    try {
        const targetChannel = channel || member.guild.channels.cache.get(BOOSTER_LOUNGE_CHANNEL_ID);
        if (!targetChannel) return console.error(`\[ERROR\] Booster Lounge Channel ${BOOSTER_LOUNGE_CHANNEL_ID} not found.`);

        const embed = new EmbedBuilder()
            .setTitle("Welcome to the Booster Lounge!")
            .setDescription(
                `Welcome, <@${member.id}> to the booster lounge. This is one of the many perks you can get as a server booster. Make sure to open a moderation ticket to claim your special role!`
            )
            .setColor("\#FFA500");
        await targetChannel.send({ embeds: [embed] });

    } catch (e) {
        console.error(`\[ERROR\] Failed to send booster lounge message for ${member.user.tag}:`, e);
    }
}

// ─── ROLES PANEL (Original !roles) ─────────────────────────

async function createRolesPanel(message) {
    try {
        if (!rolesConfig || Object.keys(rolesConfig).length === 0 || !rolesConfig.EMBED_TITLE_EMOJI || !rolesConfig.ROLES_PANEL_IMAGE) {
            return message.channel
                .send(`Error: No roles config loaded or required fields (EMBED_TITLE_EMOJI, ROLES_PANEL_IMAGE) are missing in roles.json.`)
                .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }

        const embed = new EmbedBuilder()
            .setTitle(`${rolesConfig.EMBED_TITLE_EMOJI} **Adalea Roles**`)
            .setDescription(
                `Welcome to Adalea's Role Selection channel! This is the channel where you can obtain your pronouns, ping roles, and shift/session notifications. Simply click one of the buttons below (Pronouns, Pings, or Sessions), open the dropdown, and choose the roles you want. If you wish to remove a role, simply click the button again to unselect! If you have any issues, contact a member of the <@&${MODERATION_ROLE_ID}>.`
            )
            .setImage(rolesConfig.ROLES_PANEL_IMAGE)
            .setColor(rolesConfig.EMBED_COLOR || "\#FFCC33");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("roles_pronouns")
                .setLabel("Pronouns")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji({ id: PRONOUNS_EMOJI_ID }), // Red Flower
            new ButtonBuilder()
                .setCustomId("roles_pings")
                .setLabel("Pings")
                .setStyle(ButtonStyle.Primary)
                .setEmoji({ id: PINGS_EMOJI_ID }), // White Flower
            new ButtonBuilder()
                .setCustomId("roles_sessions")
                .setLabel("Sessions")
                .setStyle(ButtonStyle.Success)
                .setEmoji({ id: SESSIONS_EMOJI_ID }) // Yellow Flower
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        console.log("\[DEBUG\] Roles panel sent successfully.");

    } catch (err) {
        console.error("\[ERROR\] Failed to send roles panel message or components:", err);
        await message.channel.send("A critical error occurred while creating the roles panel. Check bot logs.").catch(() => {});
    }
}

// ─── MR ROLES PANEL (NEW !mrroles command - VISUALLY IDENTICAL) ─────────

async function createMRRolesPanel(message) {
    try {
        if (!rolesConfig || Object.keys(rolesConfig).length === 0 || !rolesConfig.EMBED_TITLE_EMOJI || !rolesConfig.ROLES_PANEL_IMAGE) {
            return message.channel
                .send(`Error: No roles config loaded or required fields are missing.`)
                .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }

        // --- EMBED IS NOW A COPY OF !ROLES ---
        const embed = new EmbedBuilder()
            .setTitle(`${rolesConfig.EMBED_TITLE_EMOJI} **Adalea Roles**`) // COPY TITLE
            .setDescription( // COPY DESCRIPTION (Only the text describing the process is changed)
                `Welcome to Adalea's **Management Role Selection** channel! This is the channel where you can obtain your **management roles** and **timezone**. Simply click one of the buttons below (Staff Birthdays, Alliance Visits, or Timezone), open the dropdown, and choose the roles you want. If you wish to remove a role, simply click the button again to unselect! If you have any issues, contact a member of the <@&${MODERATION_ROLE_ID}>.`
            )
            .setImage(rolesConfig.ROLES_PANEL_IMAGE)
            .setColor(rolesConfig.EMBED_COLOR || "\#FFCC33");
        // ------------------------------------

        const row = new ActionRowBuilder().addComponents(
            // Button 1: Staff Birthdays (Uses Pronoun Button's old Style/Emoji)
            new ButtonBuilder()
                .setCustomId("roles_staff_birthdays")
                .setLabel("Staff Birthdays")
                .setStyle(ButtonStyle.Secondary) // Same as original Pronouns
                .setEmoji({ id: PRONOUNS_EMOJI_ID }), // Same as original Pronouns

            // Button 2: Alliance Visits (Uses Pings Button's old Style/Emoji)
            new ButtonBuilder()
                .setCustomId("roles_alliance_visits")
                .setLabel("Alliance Visits")
                .setStyle(ButtonStyle.Primary) // Same as original Pings
                .setEmoji({ id: PINGS_EMOJI_ID }), // Same as original Pings

            // Button 3: Timezone (Uses Sessions Button's old Style/Emoji)
            new ButtonBuilder()
                .setCustomId("roles_timezone")
                .setLabel("Timezone")
                .setStyle(ButtonStyle.Success) // Same as original Sessions
                .setEmoji({ id: SESSIONS_EMOJI_ID }) // Same as original Sessions
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        console.log("\[DEBUG\] MR Roles panel sent successfully.");

    } catch (err) {
        console.error("\[ERROR\] Failed to send MR roles panel message or components:", err);
        await message.channel.send("A critical error occurred while creating the MR roles panel. Check bot logs.").catch(() => {});
    }
}

// ─── WELCOME MESSAGE (NO CHANGES) ───────────────────────────────────────

async function sendWelcomeMessage(member, channel = null) {
    try {
        const targetChannel = member.guild.channels.cache.get(COMMUNITY_CHANNEL_ID);
        if (!targetChannel) return console.error(`\[ERROR\] Welcome Channel ${COMMUNITY_CHANNEL_ID} not found.`);

        const timeGMT = moment().tz("GMT").format("YYYY-MM-DD HH:mm:ss") + " GMT";

        await targetChannel.send(`Welcome, ${member}!`);

        const embed = new EmbedBuilder()
            .setTitle(`<:flowers:1424840226785988608> **Welcome to Adalea!**`)
            .setDescription(
                `Welcome, ${member}! We're so happy to have you here!\\
\
Adalea is a tropical-inspired restaurant experience on the Roblox platform that strives to create memorable and unique interactions for our guests.\\
\
Please make sure to review the <\#${INFORMATION_CHANNEL_ID}> so you're aware of our server guidelines. If you have any questions or concerns, feel free to open a ticket in <\#${SUPPORT_CHANNEL_ID}>. We hope you enjoy your stay! ${animatedFlower}`
            )
            .setImage(welcomeEmbedImage)
            .setFooter({
                text: `We are now at ${member.guild.memberCount} Discord members | ${timeGMT}`,
            })
            .setColor("\#FFCC33");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Roblox Group")
                .setStyle(ButtonStyle.Link)
                .setURL("https://www.roblox.com/communities/250548768/Adalea#\!/about")
                .setEmoji(robloxEmoji),
            new ButtonBuilder()
                .setLabel("Public Handbook")
                .setStyle(ButtonStyle.Link)
                .setURL("https://devforum.roblox.com/t/adalea-handbook/3925323")
                .setEmoji(handbookEmoji)
        );

        await targetChannel.send({ embeds: [embed], components: [row] });

    } catch (e) {
        console.error(`\[ERROR\] Failed to send welcome message for ${member.user.tag}:`, e);
    }
}

// ─── MEMBER UPDATE (BOOST HANDLER - NO CHANGES) ─────────────────────────

client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
        const oldBoost = oldMember.premiumSince;
        const newBoost = newMember.premiumSince;
        const boosterRole = newMember.guild.roles.cache.get(SERVER_BOOSTER_ROLE_ID);

        if (!boosterRole)
            return console.error("\[ERROR\] Server Booster Role not found!");

        // BOOST DETECTED
        if (!oldBoost && newBoost) {
            console.log(`\[DEBUG\] ${newMember.user.tag} started boosting!`);
            if (!newMember.roles.cache.has(SERVER_BOOSTER_ROLE_ID)) {
                try {
                    await newMember.roles.add(boosterRole);
                    console.log(`\[DEBUG\] Added Server Booster role to ${newMember.user.tag}.`);
                } catch (e) {
                    console.error(`\[ERROR\] Failed to add booster role to ${newMember.user.tag}:`, e);
                }
            }
            await sendBoostThankYou(newMember);
            await sendBoosterLoungeWelcome(newMember);
        }
        // UNBOOST DETECTED
        else if (oldBoost && !newBoost) {
            console.log(`\[DEBUG\] ${newMember.user.tag} stopped boosting.`);
            if (newMember.roles.cache.has(SERVER_BOOSTER_ROLE_ID)) {
                try {
                    await newMember.roles.remove(boosterRole);
                    console.log(`\[DEBUG\] Removed booster role from ${newMember.user.tag}.`);
                } catch (e) {
                    console.error(`\[ERROR\] Failed to remove booster role from ${newMember.user.tag}:`, e);
                }
            }
        }
    } catch (e) {
        console.error("\[ERROR\] Error in guildMemberUpdate event:", e);
    }
});

// ─── COMMANDS ──────────────────────────────────────────────

client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    try {
        const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
        const command = args.shift().toLowerCase();

        const hasRole = message.member?.roles.cache.has(LEADERSHIP_ROLE_ID);
        const isSpecial = message.author.id === SPECIAL_USER_ID;
        const isPermitted = hasRole || isSpecial;

        // Only include the four needed commands
        const restrictedCommands = [
            "roles",
            "mrroles", 
            "testwelcome",
            "testboost"
        ];

        // Check permissions only for the required commands
        if (restrictedCommands.includes(command) && !isPermitted) {
            // Permission denied message
            return message.reply("u dont have access")
                .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }

        // Delete the command message
        if (restrictedCommands.includes(command) && message.channel.permissionsFor(client.user).has("ManageMessages")) {
            await message.delete().catch(() => {});
        }

        // --- COMMAND HANDLERS ---

        if (command === "roles") {
            await createRolesPanel(message);
            return;
        }

        if (command === "mrroles") { 
            await createMRRolesPanel(message);
            return;
        }

        if (command === "testboost") {
            await sendBoostThankYou(message.member, message.channel);
            await sendBoosterLoungeWelcome(message.member, message.channel);
            return message.channel
                .send(`\${EMOJI_ADDED} **Boost messages sent here for testing.**`)
                .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }

        if (command === "testwelcome") {
            await sendWelcomeMessage(message.member, message.channel);
            return message.channel
                .send(`\${EMOJI_ADDED} **Welcome message sent here for testing.**`)
                .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }

    } catch (e) {
        console.error(`\[ERROR\] Error processing messageCreate event for command ${message.content}:`, e);
    }
});

// ─── INTERACTION HANDLER ──────────────────────────────────

client.on("interactionCreate", async (interaction) => {

    // Defer the reply for buttons and select menus to prevent "Interaction Failed" errors
    if ((interaction.isButton() || interaction.isStringSelectMenu()) && !interaction.deferred && !interaction.replied) {
        // Defer ephemeral ensures the invisible message is used for all responses
        await interaction.deferReply({ ephemeral: true }).catch(console.error);
    }

    try {
        if (interaction.isButton()) {
            // --- NEW DIRECT ROLE TOGGLE LOGIC (Staff Birthdays & Alliance Visits) ---
            let directRoleId = null;
            
            switch (interaction.customId) {
                case "roles_staff_birthdays":
                    directRoleId = STAFF_BIRTHDAYS_ROLE_ID;
                    break;
                case "roles_alliance_visits":
                    directRoleId = ALLIANCE_VISITS_ROLE_ID;
                    break;
            }

            if (directRoleId) {
                const member = interaction.member;
                const hasRole = member.roles.cache.has(directRoleId);
                let response = '';

                try {
                    if (hasRole) {
                        await member.roles.remove(directRoleId);
                        response = `${EMOJI_REMOVED} Role removed.`;
                    } else {
                        await member.roles.add(directRoleId);
                        // User requested "invisible message saying role added"
                        response = "role added";
                    }

                    // Must use editReply because it was deferred earlier
                    return interaction.editReply({
                        content: response,
                        ephemeral: true
                    });

                } catch (e) {
                    console.error(`\[ERROR\] Failed to toggle role ${directRoleId} for ${member.user.tag}:`, e);
                    return interaction.editReply({
                        content: "Failed to update your role. Check bot's permissions and role hierarchy.",
                        ephemeral: true
                    });
                }
            }

            // --- NEW TIMEZONE DROPDOWN TRIGGER LOGIC ---
            if (interaction.customId === "roles_timezone") {
                const memberRoles = interaction.member.roles.cache;

                // Build options for the Timezone dropdown
                const options = TIMEZONE_ROLE_IDS.map(roleId => {
                    const label = TIMEZONE_ROLES[roleId];
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(label)
                        .setValue(roleId)
                        .setDefault(memberRoles.has(roleId));
                });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("select_timezone") // New custom ID for submission
                    .setPlaceholder("Select your GMT Timezone")
                    .setMinValues(0)
                    .setMaxValues(1) // Only one timezone role should be selectable
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.editReply({
                    content: "Please select your timezone role:",
                    components: [row],
                    ephemeral: true
                });
            }

            // --- ORIGINAL ROLES LOGIC (PRONOUNS, PINGS, SESSIONS) ---
            let roleList, menuPlaceholder, menuCustomId;

            switch (interaction.customId) {
                case "roles_pronouns":
                    roleList = rolesConfig.PRONOUN_ROLES;
                    menuPlaceholder = "Select your pronouns";
                    menuCustomId = "select_pronouns";
                    break;
                case "roles_pings":
                    roleList = rolesConfig.PINGS_ROLES; 
                    menuPlaceholder = "Select your ping roles";
                    menuCustomId = "select_pings";
                    break;
                case "roles_sessions":
                    roleList = rolesConfig.SHIFTS_ROLES; 
                    menuPlaceholder = "Select your session roles";
                    menuCustomId = "select_sessions";
                    break;
                default:
                    return;
            }

            if (!roleList || roleList.length === 0) {
                return interaction.editReply({
                    content: "Error: No roles are configured for this category in \`roles.json\`. Please contact a moderator.",
                }).catch(console.error);
            }

            const memberRoles = interaction.member.roles.cache;

            const options = roleList.map((role) => {
                if (!role.roleId) return null;
                let option = new StringSelectMenuOptionBuilder()
                    .setLabel(role.label || "No Label")
                    .setValue(role.roleId)
                    .setDefault(memberRoles.has(role.roleId));

                if (role.emoji) {
                    option.setEmoji(role.emoji);
                }
                return option;
            }).filter(o => o !== null);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(menuCustomId)
                .setPlaceholder(menuPlaceholder)
                .setMinValues(0)
                .setMaxValues(options.length)
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.editReply({
                content: "Please select the roles you'd like to have:",
                components: [row],
            });

        } else if (interaction.isStringSelectMenu()) {
            
            // --- NEW TIMEZONE SELECT MENU SUBMISSION ---
            if (interaction.customId === "select_timezone") {
                const member = interaction.member;
                const selectedRoleIds = interaction.values; // Will contain 0 or 1 ID
                const memberRoles = member.roles;
                let addedRole = null;
                let removedRolesCount = 0;

                // 1. Remove ALL existing timezone roles to ensure only one is active
                for (const roleId of TIMEZONE_ROLE_IDS) {
                    if (memberRoles.cache.has(roleId)) {
                        await memberRoles.remove(roleId).catch(e => {
                            console.error(`\[ERROR\] Failed to remove old timezone role ${roleId}:`, e);
                        });
                        removedRolesCount++;
                    }
                }

                // 2. Add the newly selected role (if any)
                if (selectedRoleIds.length > 0) {
                    const newRoleId = selectedRoleIds[0];
                    await memberRoles.add(newRoleId).then(() => {
                        addedRole = TIMEZONE_ROLES[newRoleId] || `Role ID: ${newRoleId}`;
                    }).catch(e => {
                        console.error(`\[ERROR\] Failed to add new timezone role ${newRoleId}:`, e);
                    });
                }

                // 3. Build response
                let response = "Your timezone role has been updated!";
                if (addedRole) {
                    response += `\n${EMOJI_ADDED} **Set Timezone:** ${addedRole}`;
                } else if (removedRolesCount > 0 && selectedRoleIds.length === 0) {
                    response += `\n${EMOJI_REMOVED} **Timezone removed.**`;
                } else {
                    response = "No changes were made to your timezone role.";
                }

                return interaction.editReply({
                    content: response,
                    ephemeral: true
                });
            }

            // --- ORIGINAL SELECT MENU SUBMISSION (Pronouns, Pings, Sessions) ---
            let roleList;

            switch (interaction.customId) {
                case "select_pronouns":
                    roleList = rolesConfig.PRONOUN_ROLES;
                    break;
                case "select_pings":
                    roleList = rolesConfig.PINGS_ROLES;
                    break;
                case "select_sessions":
                    roleList = rolesConfig.SHIFTS_ROLES;
                    break;
                default:
                    return;
            }

            const member = interaction.member;
            const selectedRoleIds = interaction.values;
            const memberRoles = member.roles;
            let addedRoles = [];
            let removedRoles = [];

            // Loop through all roles in this category
            for (const role of roleList) {
                const roleId = role.roleId;
                if (!roleId) continue;
                const hasRole = memberRoles.cache.has(roleId);
                const wantsRole = selectedRoleIds.includes(roleId);

                if (wantsRole && !hasRole) {
                    // ADD ROLE
                    await memberRoles.add(roleId).then(() => {
                        addedRoles.push(`\<\@&${roleId}\>`);
                    }).catch(e => console.error(`\[ERROR\] Failed to add role ${roleId} to ${member.user.tag}. Check bot's MANAGE ROLES permission and role hierarchy.`, e));
                } else if (!wantsRole && hasRole) {
                    // REMOVE ROLE
                    await memberRoles.remove(roleId).then(() => {
                        removedRoles.push(`\<\@&${roleId}\>`);
                    }).catch(e => console.error(`\[ERROR\] Failed to remove role ${roleId} from ${member.user.tag}. Check bot's MANAGE ROLES permission and role hierarchy.`, e));
                }
            }

            // Build confirmation message
            let response = "Your roles have been updated!";
            if (addedRoles.length > 0) {
                response += `\n${EMOJI_ADDED} **Added:** ${addedRoles.join(", ")}`;
            }
            if (removedRoles.length > 0) {
                response += `\n${EMOJI_REMOVED} **Removed:** ${removedRoles.join(", ")}`;
            }

            if (addedRoles.length === 0 && removedRoles.length === 0) {
                response = "No changes were made to your roles.";
            }

            await interaction.editReply({
                content: response,
            });

        }

    } catch (e) {
        console.error("\[ERROR\] Critical error processing interactionCreate event:", e);
        if (interaction.deferred) {
            interaction.editReply({ content: "A critical and unexpected error occurred while processing your request. Please check the bot logs for details." }).catch(() => {});
        } else if (!interaction.replied) {
            // Fallback reply if the initial defer failed somehow
            interaction.reply({ content: "A critical and unexpected error occurred.", ephemeral: true }).catch(() => {});
        }
    }
});

// ─── MEMBER JOIN (Automated Welcome - NO CHANGES) ───────────────────────

client.on("guildMemberAdd", async (member) => {
    try {
        // The welcome logic runs automatically because isWelcomerActive is true by default
        if (isWelcomerActive) sendWelcomeMessage(member);
    } catch (e) {
        console.error(`\[ERROR\] Error in guildMemberAdd event for ${member.user.tag}:`, e);
    }
});

// ─── READY ─────────────────────────────────────────────────

client.once("ready", async () => {
    console.log(`Bot online as ${client.user.tag}`);
    await loadRolesConfig();
});

// ─── KEEP-ALIVE & LOGIN ────────────────────────────────────

http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Alive");
}).listen(process.env.PORT || 3000);

client.login(process.env.BOT_TOKEN);
