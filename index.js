const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    ChannelType 
} = require('discord.js');
const fs = require('fs-extra');
const http = require('http');
const moment = require('moment-timezone');

// --- FIREBASE IMPORTS ---
// NOTE: You must have 'firebase' installed: npm install firebase
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithCustomToken, signInAnonymously } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');
// --- END FIREBASE IMPORTS ---

const PREFIX = '!';

// --- CONFIGURATION ---
const COMMUNITY_CHANNEL_ID = "1402405984978341888"; // Channel for the thank you embed and announcement
const SERVER_BOOSTER_ROLE_ID = "1404242033849270272"; // The Server Booster role ID
const SERVER_LOUNGE_CHANNEL_ID = "1414381377389858908"; // Channel for the welcome message

// --- LEADERSHIP/CONTROL CONFIG ---
const LEADERSHIP_ROLE_ID = "1402400285674049576"; 
const SPECIAL_USER_ID = "1107787991444881408"; 

// --- BOOST DETECTOR CONFIGURATION ---
const BOOST_OUTPUT_CHANNEL_ID = COMMUNITY_CHANNEL_ID; 
// TTS functionality has been removed.
// --- END BOOST DETECTOR CONFIGURATION ---

const ROLES_FILE = 'roles.json';
let rolesConfig = {};
let isWelcomerActive = false; // Welcomer starts OFF

// --- FIREBASE/PERSISTENCE GLOBALS (FIXED FOR RENDER/STANDARD HOSTING) ---
let firebaseConfig = {};
try {
    // Read the full config from the environment variable set in Render
    if (process.env.FIREBASE_CONFIG) {
        firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG); 
    } else {
        console.warn("FIREBASE_CONFIG environment variable is not set. Boost state persistence will fail.");
    }
} catch(e) {
    console.error("FIREBASE_CONFIG environment variable is malformed JSON:", e.message);
}
const initialAuthToken = process.env.FIREBASE_AUTH_TOKEN; 

let db, auth;
let boostDetectorIsRunning = false; // Local in-memory state for persistence
// CRITICAL FIX: Simplified path to ensure consistent reads/writes in Firestore
const PUBLIC_DATA_PATH = 'bot_boost_state'; 
// --- END FIREBASE/PERSISTENCE GLOBALS ---

// --- PROVIDED EMJOIS (ONLY THESE ARE USED FOR BOOST/COMMAND FEEDBACK) ---
const EMOJI_ADDED = "<a:Zcheck:1437064263570292906>";        // new check for added (used for success/running)
const EMOJI_REMOVED = "<a:Zx_:1437064220876472370>";       // X-ish emoji used for removed/errors (used for stopped/failure)

// Welcome emojis (unchanged)
const orangeFlower = "<:orangeflower:1436795365172052018>";
const animatedFlower = "<a:animatedflowers:1436795411309395991>";
const robloxEmoji = "<:roblox:1337653461436596264>";
const handbookEmoji = "<:handbook:1406695333135650846>";
// Custom flower emoji requested for boost thank you
const customFlower = "<:flower:1424840226785988608>";

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

// --- FIREBASE/PERSISTENCE UTILITY FUNCTIONS ---

/** Gets the document reference for the boost detection status. */
const getStatusDocRef = () => {
    // Use a fixed document ID within the stable collection path
    return doc(db, PUBLIC_DATA_PATH, 'status_doc');
};

/** Fetches the current boost detection state from Firestore. */
async function getBoostState() {
    if (!db) return false;
    try {
        const docRef = getStatusDocRef();
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().isRunning;
        } else {
            // Document doesn't exist, initialize it and return false
            await setDoc(docRef, { isRunning: false });
            return false;
        }
    } catch (error) {
        console.error("Error fetching boost state from Firestore:", error);
        return false; 
    }
}

/** Updates the boost detection state in Firestore. */
async function setBoostState(status) {
    if (!db) return;
    try {
        const docRef = getStatusDocRef();
        await setDoc(docRef, { isRunning: status }, { merge: true });
        // NOTE: We rely on the command handler to update the local global state 
        // immediately after a successful write to prevent race conditions.
    } catch (error) {
        console.error("Error setting boost state in Firestore:", error);
        throw error; // Re-throw the error so the command handler can catch it
    }
}

/** Announces the boost using a standard text message (TTS removed). */
async function announceBoost(textToSpeak, client) {
    console.log(`Boost Text Announcement: ${textToSpeak}`);
    const channel = client.channels.cache.get(BOOST_OUTPUT_CHANNEL_ID);
    if (channel && channel.type === ChannelType.GuildText) {
        await channel.send(`📢 **BOOST ANNOUNCEMENT:** ${textToSpeak}`).catch(console.error);
    }
}
// --- END FIREBASE/TTS UTILITY FUNCTIONS ---

// --- LOAD roles.json ---
async function loadRolesConfig() {
    try {
        rolesConfig = await fs.readJson(ROLES_FILE);
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

// MODIFIED: Embed now uses specific title, description, and color
function createBoosterThankYouEmbed(member) {
    return new EmbedBuilder()
        .setTitle(`Thank you for boosting Adalea, ${member.user.tag}!`)
        .setDescription(
            `Your support helps our tropical island grow brighter and cozier every day! ${customFlower}` // Uses the specific custom flower emoji
        )
        // Set the color to yellowish orange (#FFCC33 is a good fit)
        .setColor("#FFCC33"); 
}

async function handleBoosterStatusChange(oldMember, newMember) {
    const boosterRole = newMember.guild.roles.cache.get(SERVER_BOOSTER_ROLE_ID);
    const communityChannel = newMember.guild.channels.cache.get(COMMUNITY_CHANNEL_ID);
    const loungeChannel = newMember.guild.channels.cache.get(SERVER_LOUNGE_CHANNEL_ID);

    if (!boosterRole || !communityChannel || !loungeChannel) {
        console.error("[ERROR] Booster config missing (role/channels).");
    }

    const isBoosting = newMember.premiumSince;
    const hasRole = newMember.roles.cache.has(SERVER_BOOSTER_ROLE_ID);
    
    // --- New Booster / Re-Booster Logic ---
    if (isBoosting && !hasRole) {
        try {
            if (boosterRole) await newMember.roles.add(boosterRole, "Server Booster: Started/Re-started boosting.");
            
            // 1. ANNOUNCE VIA TEXT IF DETECTOR IS RUNNING
            if (boostDetectorIsRunning) {
                const boostCount = newMember.guild.premiumSubscriptionCount;
                const text = `${newMember.user.username} just boosted the server! That brings us to ${boostCount} total boosts! Thank you, ${newMember.user.username}!`;
                
                await announceBoost(text, client); 
            }

            // 2. Send thank you message in COMMUNITY CHANNEL (Now two messages)
            if (communityChannel) {
                // Send the plain text part first
                await communityChannel.send(`Thank you, ${newMember}!`).catch(console.error);

                // Send the embed part
                await communityChannel.send({ 
                    embeds: [createBoosterThankYouEmbed(newMember)] 
                }).catch(console.error);
            }

            // 3. Send welcome message in SERVER LOUNGE (Specific requested text)
            if (loungeChannel) {
                await loungeChannel.send(`Welcome to the booster lounge ${newMember}!`).catch(console.error);
            }
            console.log(`[BOOSTER] ${newMember.user.tag} started boosting. Role assigned and messages sent.`);
        } catch (error) {
            console.error(`[BOOSTER] Failed to assign role or send messages for ${newMember.user.tag}:`, error);
        }
    }

    // --- Booster Stopped Logic ---
    if (!isBoosting && hasRole) {
        try {
            if (boosterRole) await newMember.roles.remove(boosterRole, "Server Booster: Stopped boosting (0 total boosts).");
            
            // Send a message about losing perks
            if (communityChannel) {
                await communityChannel.send(`Sadly, ${newMember} is no longer boosting and has lost the booster role and perks.`).catch(console.error);
            }
            console.log(`[BOOSTER] ${newMember.user.tag} stopped boosting. Role removed.`);
        } catch (error) {
            console.error(`[BOOSTER] Failed to remove role for ${newMember.user.tag}:`, error);
        }
    }
}

client.on('interactionCreate', async interaction => {
    // ... Roles Panel and Interaction logic remains unchanged ...
    if (!interaction.inGuild()) return;
    const member = interaction.member;
    if (!member) return;

    if (interaction.isButton()) {
        let category, name, emoji;
        const id = interaction.customId;

        if (id === "roles_pronouns") { category = rolesConfig.PRONOUN_ROLES; name = "Pronouns"; emoji = "<:bluelotus:1436877456446459974>"; }
        if (id === "roles_pings") { category = rolesConfig.PINGS_ROLES; name = "Pings"; emoji = "<:lotus:1424840252945600632>"; }
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

    const sentMsg = await targetChannel.send({
        embeds: [embed],
        components: [row]
    });
    return sentMsg;
}

// --- HELPER FUNCTION FOR COMMAND CLEANUP ---
const cleanupAndExit = async (botMessage, userMessage) => {
    await new Promise(r => setTimeout(r, 5000));
    if (botMessage && !botMessage.deleted) {
        await botMessage.delete().catch(() => {});
    }
    if (userMessage && !userMessage.deleted) {
        await userMessage.delete().catch(() => {});
    }
};

// --- COMMANDS ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX) || !message.member) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    const hasRole = message.member.roles.cache.has(LEADERSHIP_ROLE_ID);
    const isSpecial = message.author.id === SPECIAL_USER_ID;
    const isAuthorized = hasRole || isSpecial;

    // NOTE: All boost commands are singular: startboost, stopboost, testboost
    const authorizedCommands = [
        "roles", "welcomeadalea", "stopwelcomeadalea", "testwelcome", "restart",
        "startboost", "stopboost", "checkbooststate", "testboost" 
    ];

    if (authorizedCommands.includes(command) && !isAuthorized) {
        const reply = await message.reply("You do not have permission to use this command.");
        cleanupAndExit(reply, message);
        return; 
    }

    // --- Command Execution ---

    if (command === 'roles') {
        const sentMsg = await createRolesPanel(message);
        cleanupAndExit(sentMsg, message);
        return;
    }

    if (command === "welcomeadalea") {
        let replyMsg;
        if (isWelcomerActive) {
            replyMsg = await message.channel.send(`${orangeFlower} **Welcomer is already active.**`);
        } else {
            isWelcomerActive = true;
            replyMsg = await message.channel.send(`${orangeFlower} **Starting... Welcomer activated.**`);
        }
        cleanupAndExit(replyMsg, message);
        return;
    }

    if (command === "stopwelcomeadalea") {
        let replyMsg;
        if (!isWelcomerActive) {
            replyMsg = await message.channel.send(`${orangeFlower} **Welcomer is already inactive.**`);
        } else {
            isWelcomerActive = false;
            replyMsg = await message.channel.send(`${orangeFlower} **Stopping... Welcomer deactivated.**`);
        }
        cleanupAndExit(replyMsg, message);
        return;
    }

    if (command === "testwelcome") {
        await sendWelcomeMessage(message.member, message.channel);
        await message.delete().catch(() => {});
        return;
    }

    if (command === "restart") {
        const sentMsg = await message.channel.send("Restarting... please stay on stand by");
        await message.delete().catch(() => {});
        setTimeout(() => sentMsg.delete().catch(() => {}), 5000); 
        process.exit(1);
    }
    
    // --- BOOST DETECTOR COMMANDS ---
    if (command === 'startboost') { 
        let replyMsg;
        if (boostDetectorIsRunning) {
            replyMsg = await message.channel.send(`${EMOJI_ADDED} The persistent boost detector is already running.`);
        } else {
            try {
                await setBoostState(true); 
                boostDetectorIsRunning = true; // IMMEDIATE LOCAL UPDATE FIX
                replyMsg = await message.channel.send(`${EMOJI_ADDED} Boost detection has been **STARTED** and is now persistent across restarts.`);
            } catch (e) {
                console.error("Error setting boost state in !startboost:", e);
                replyMsg = await message.channel.send(`${EMOJI_REMOVED} **ERROR:** Failed to start boost detection (Firebase/Database issue).`);
            }
        }
        cleanupAndExit(replyMsg, message);
        return;
    }

    if (command === 'stopboost') { 
        let replyMsg;
        if (!boostDetectorIsRunning) { 
            replyMsg = await message.channel.send(`${EMOJI_REMOVED} The persistent boost detector is already stopped.`);
        } else {
            try {
                await setBoostState(false); 
                boostDetectorIsRunning = false; // IMMEDIATE LOCAL UPDATE FIX
                replyMsg = await message.channel.send(`${EMOJI_REMOVED} Boost detection has been **STOPPED** and is now persistent across restarts.`);
            } catch (e) {
                console.error("Error setting boost state in !stopboost:", e);
                replyMsg = await message.channel.send(`${EMOJI_REMOVED} **ERROR:** Failed to stop boost detection (Firebase/Database issue).`);
            }
        }
        cleanupAndExit(replyMsg, message);
        return;
    }

    if (command === 'checkbooststate') { 
        // Read directly from Firebase for the most reliable status check
        const firebaseStatus = await getBoostState(); 
        boostDetectorIsRunning = firebaseStatus; // Sync the local state after the check
        
        const statusEmoji = firebaseStatus ? EMOJI_ADDED : EMOJI_REMOVED;
        const statusText = firebaseStatus ? 'RUNNING' : 'STOPPED';
        const replyMsg = await message.channel.send(`${statusEmoji} The persistent boost detector (read directly from Firebase) is currently **${statusText}**.`);
        cleanupAndExit(replyMsg, message);
        return;
    }

    // --- Test Boost Command ---
    if (command === 'testboost') {
        let replyMsg;
        if (boostDetectorIsRunning) { 
            const boostCount = message.guild.premiumSubscriptionCount || 0; 
            const text = `TEST: ${message.member.user.username} just boosted the server! That brings us to ${boostCount} total boosts! Thank you, ${message.member.user.username}! (This is a test announcement)`;
            
            await announceBoost(text, client); 
            
            // Manually run the user facing messages for the test:
            const communityChannel = message.guild.channels.cache.get(COMMUNITY_CHANNEL_ID);
            const loungeChannel = message.guild.channels.cache.get(SERVER_LOUNGE_CHANNEL_ID);
            
            if (communityChannel) {
                await communityChannel.send(`Thank you, ${message.member}! (Test)`).catch(console.error);
                await communityChannel.send({ 
                    embeds: [createBoosterThankYouEmbed(message.member)], 
                }).catch(console.error);
            }
            if (loungeChannel) {
                await loungeChannel.send(`Welcome to the booster lounge ${message.member}! (Test)`).catch(console.error);
            }

            replyMsg = await message.channel.send(`${EMOJI_ADDED} Boost announcement test sent to <#${BOOST_OUTPUT_CHANNEL_ID}> and relevant channels.`);
        } else {
            replyMsg = await message.channel.send(`${EMOJI_REMOVED} Test failed: Boost detector is currently **STOPPED**. Use \`!startboost\` first.`);
        }
        cleanupAndExit(replyMsg, message);
        return;
    }
});

// --- MEMBER JOIN ---
client.on("guildMemberAdd", async member => {
    if (isWelcomerActive) sendWelcomeMessage(member);
});

// --- MEMBER UPDATE (BOOSTER LOGIC) ---
client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (oldMember.premiumSince !== newMember.premiumSince) 
    {
        await handleBoosterStatusChange(oldMember, newMember);
    }
});

// --- READY (Initialization - Status Fixed Here) ---
client.once('ready', async () => {
    console.log(`Bot online as ${client.user.tag}`);
    
    // --- FIREBASE INITIALIZATION ---
    if (Object.keys(firebaseConfig).length > 0) {
        try {
            const app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);

            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                await signInAnonymously(auth);
            }
            console.log("Firebase authentication successful.");

            // Load the persistent state from Firestore
            boostDetectorIsRunning = await getBoostState();
            console.log(`Boost detector starting state: ${boostDetectorIsRunning ? 'RUNNING' : 'STOPPED'}`);

        } catch (error) {
            console.error("Failed to initialize Firebase or load state:", error);
            boostDetectorIsRunning = false; // Disable boost detection if startup fails
        }
    } else {
        console.error("Firebase config missing. Boost detection is DISABLED.");
        boostDetectorIsRunning = false;
    }
    // --- END FIREBASE INITIALIZATION ---

    await loadRolesConfig();
    
    // --- STATUS FIX: Set constant dual status on startup ---
    client.user.setPresence({
        activities: [
            { 
                name: 'Watching over Adalea', 
                type: 3, // 3 = Watching (Appears as "Watching over Adalea")
            },
            {
                name: '.gg/adalea',
                type: 4, // 4 = Custom Status (Appears as thought bubble ".gg/adalea")
            }
        ],
        status: 'online', // Keep the bot online
    });
    console.log("Status set to dual custom activity.");
    // --- END STATUS FIX ---
});

// --- KEEP-ALIVE ---
http.createServer((req,res)=>{res.writeHead(200);res.end('Alive');}).listen(process.env.PORT||3000);

// --- LOGIN ---
client.login(process.env.BOT_TOKEN);
