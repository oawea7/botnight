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

// --- NEW IMPORTS FOR FIREBASE/PERSISTENCE ---
// NOTE: You must have 'firebase' installed: npm install firebase
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithCustomToken, signInAnonymously } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');
// --- END NEW IMPORTS ---

const PREFIX = '!';

// --- CONFIGURATION ---
const COMMUNITY_CHANNEL_ID = "1402405984978341888"; // Channel for the thank you embed and TTS announcement fallback
const SERVER_BOOSTER_ROLE_ID = "1404242033849270272"; // The Server Booster role ID
const SERVER_LOUNGE_CHANNEL_ID = "1414381377389858908"; // Channel for the welcome message

// --- LEADERSHIP/CONTROL CONFIG ---
const LEADERSHIP_ROLE_ID = "1402400285674049576"; 
const SPECIAL_USER_ID = "1107787991444881408"; 

// --- BOOST DETECTOR CONFIGURATION ---
const BOOST_OUTPUT_CHANNEL_ID = COMMUNITY_CHANNEL_ID; 
const TTS_VOICE_NAME = 'Fenrir'; // Excitable voice for the announcement
// Gemini API Configuration (used for TTS)
const API_KEY = ""; // Placeholder, key is provided by Canvas environment at runtime
const TTS_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`;
// --- END BOOST DETECTOR CONFIGURATION ---

const ROLES_FILE = 'roles.json';
let rolesConfig = {};
let isWelcomerActive = false; // Welcomer starts OFF

// --- FIREBASE/PERSISTENCE GLOBALS ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

let db, auth;
let boostDetectorIsRunning = false; // Local in-memory state for persistence
const PUBLIC_DATA_PATH = `/artifacts/${appId}/public/data/boost_state`; 

// --- PROVIDED EMJOIS (ONLY THESE ARE USED FOR BOOST/COMMAND FEEDBACK) ---
const EMOJI_ADDED = "<a:Zcheck:1437064263570292906>";        // new check for added (used for success/running)
const EMOJI_REMOVED = "<a:Zx_:1437064220876472370>";       // X-ish emoji used for removed/errors (used for stopped/failure)

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

// --- FIREBASE/PERSISTENCE UTILITY FUNCTIONS ---

/** Gets the document reference for the boost detection status. */
const getStatusDocRef = () => {
    return doc(db, PUBLIC_DATA_PATH, 'status');
};

/** Fetches the current boost detection state from Firestore. */
async function getBoostState() {
    try {
        const docRef = getStatusDocRef();
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().isRunning;
        } else {
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
    try {
        const docRef = getStatusDocRef();
        await setDoc(docRef, { isRunning: status }, { merge: true });
        boostDetectorIsRunning = status; 
        console.log(`Boost detection state updated to: ${status}`);
    } catch (error) {
        console.error("Error setting boost state in Firestore:", error);
    }
}

// --- TTS Utility Functions ---

/** Converts a base64 string to an ArrayBuffer. */
function base64ToArrayBuffer(base64) {
    const binaryString = Buffer.from(base64, 'base64').toString('binary');
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/** Converts PCM 16-bit audio data to a WAV Buffer. */
function pcmToWav(pcm16, sampleRate) {
    const numChannels = 1;
    const numSamples = pcm16.length;
    const byteRate = sampleRate * numChannels * 2; 

    const buffer = Buffer.alloc(44 + numSamples * 2);
    const view = new DataView(buffer.buffer);

    // Write WAV header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + numSamples * 2, true); // Chunk size
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Sub-chunk 1 size (16 for PCM)
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, numChannels, true); // Number of channels
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, byteRate, true); // Byte rate
    view.setUint16(32, numChannels * 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, numSamples * 2, true); // Sub-chunk 2 size

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        view.setInt16(offset, pcm16[i], true); // Write little-endian
        offset += 2;
    }

    return buffer; // Return Node.js Buffer
}

/** Calls the Gemini TTS API and sends the resulting audio as a file. */
async function announceBoost(textToSpeak, client) {
    console.log(`TTS Request: ${textToSpeak}`);
    const payload = {
        contents: [{
            parts: [{ text: textToSpeak }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: TTS_VOICE_NAME }
                }
            }
        },
        model: "gemini-2.5-flash-preview-tts"
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await fetch(TTS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            const result = await response.json();
            const part = result?.candidates?.[0]?.content?.parts?.[0];
            const audioData = part?.inlineData?.data;
            const mimeType = part?.inlineData?.mimeType;

            if (audioData && mimeType && mimeType.startsWith("audio/")) {
                const sampleRateMatch = mimeType.match(/rate=(\d+)/);
                const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 16000; 

                const pcmData = base64ToArrayBuffer(audioData);
                const pcm16 = new Int16Array(pcmData);
                const wavBuffer = pcmToWav(pcm16, sampleRate);

                // Send the audio file to the Discord channel
                const channel = client.channels.cache.get(BOOST_OUTPUT_CHANNEL_ID);
                if (channel && channel.type === ChannelType.GuildText) {
                    await channel.send({
                        content: `**TTS Announcement:** ${orangeFlower}`,
                        files: [{ attachment: wavBuffer, name: 'boost_announcement.wav' }]
                    });
                }
                return; // Success, exit the retry loop
            } else {
                throw new Error("TTS API response missing audio data.");
            }
        } catch (error) {
            console.warn(`TTS API call attempt ${attempt} failed: ${error.message}`);
            if (attempt < 3) {
                const delay = Math.pow(2, attempt) * 1000; 
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error("All TTS API attempts failed. Skipping audio announcement.");
                const channel = client.channels.cache.get(BOOST_OUTPUT_CHANNEL_ID);
                if (channel && channel.type === ChannelType.GuildText) {
                    // Using EMOJI_REMOVED for failure fallback
                    channel.send(`${EMOJI_REMOVED} **Boost Announcement Failed** (Text fallback used).`);
                }
            }
        }
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

// The embed for the thank-you message
function createBoosterThankYouEmbed(member) {
    return new EmbedBuilder()
        .setTitle(`Thank you for boosting Adalea, ${member.user.tag}!`)
        .setDescription(
            `Your support helps our tropical island grow brighter and cozier every day! ${orangeFlower}`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor("#FFCC33"); 
}

async function handleBoosterStatusChange(oldMember, newMember) {
    const boosterRole = newMember.guild.roles.cache.get(SERVER_BOOSTER_ROLE_ID);
    const communityChannel = newMember.guild.channels.cache.get(COMMUNITY_CHANNEL_ID);
    const loungeChannel = newMember.guild.channels.cache.get(SERVER_LOUNGE_CHANNEL_ID);

    if (!boosterRole || !communityChannel || !loungeChannel) {
        console.error("[ERROR] Booster config missing (role/channels).");
        // We still continue to handle the status change even if some channels/roles are missing
    }

    const isBoosting = newMember.premiumSince;
    const hasRole = newMember.roles.cache.has(SERVER_BOOSTER_ROLE_ID);
    
    // --- New Booster / Re-Booster Logic ---
    if (isBoosting && !hasRole) {
        try {
            if (boosterRole) await newMember.roles.add(boosterRole, "Server Booster: Started/Re-started boosting.");
            
            // 1. ANNOUNCE VIA TTS/TEXT IF DETECTOR IS RUNNING
            if (boostDetectorIsRunning) {
                const boostCount = newMember.guild.premiumSubscriptionCount;
                const text = `Attention, ${newMember.user.username} just boosted the server! That brings us to ${boostCount} total boosts! Thank you, ${newMember.user.username}!`;
                
                await announceBoost(text, client); 
            }

            // 2. Send thank you embed 
            if (communityChannel) {
                await communityChannel.send({ 
                    content: `${newMember},`, // Ping the user first
                    embeds: [createBoosterThankYouEmbed(newMember)] 
                });
            }

            // 3. Send welcome message in server lounge
            if (loungeChannel) {
                await loungeChannel.send(`Welcome, ${newMember} to the booster-lounge.`).catch(console.error);
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

// --- ROLES PANEL & INTERACTIONS (Unchanged) ---
async function createRolesPanel(message) {
    if (!rolesConfig || Object.keys(rolesConfig).length === 0) {
        const msg = await message.channel.send("Error: roles.json is empty!");
        return msg; // Return for cleanup
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
        new ButtonBuilder()
            .setCustomId('roles_sessions')
            .setLabel('Sessions')
            .setStyle(ButtonStyle.Success)
            .setEmoji({ id: (rolesConfig.BUTTON_EMOJIS && rolesConfig.BUTTON_EMOJIS.shifts && (rolesConfig.BUTTON_EMOJIS.shifts.match(/\d+/) || [])[0]) || null })
    );

    try {
        const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });
        console.log("[DEBUG] Roles panel sent successfully.");
        return sentMessage; // Return for cleanup
    } catch (err) {
        console.error("[ERROR] Failed to send roles panel:", err);
        return null;
    }
}

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

client.on('interactionCreate', async interaction => {
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

// --- HELPER FUNCTION FOR COMMAND CLEANUP ---
/**
 * Deletes the bot's response and the user's command message after a delay.
 * @param {import('discord.js').Message} botMessage The bot's reply message.
 * @param {import('discord.js').Message} userMessage The user's command message.
 */
const cleanupAndExit = async (botMessage, userMessage) => {
    // Wait 5 seconds
    await new Promise(r => setTimeout(r, 5000));
    // Attempt to delete the bot's message
    if (botMessage && !botMessage.deleted) {
        await botMessage.delete().catch(() => {});
    }
    // Attempt to delete the user's command message
    if (userMessage && !userMessage.deleted) {
        await userMessage.delete().catch(() => {});
    }
};

// --- COMMANDS ---
client.on('messageCreate', async message => {
    // 1. Basic checks
    if (message.author.bot || !message.content.startsWith(PREFIX) || !message.member) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // 2. Permission Check Preparation
    const hasRole = message.member.roles.cache.has(LEADERSHIP_ROLE_ID);
    const isSpecial = message.author.id === SPECIAL_USER_ID;
    const isAuthorized = hasRole || isSpecial;

    // 3. Define commands that require authorization
    const authorizedCommands = [
        "roles", "welcomeadalea", "stopwelcomeadalea", "testwelcome", "restart",
        "startboosts", "stopboost", "checkbooststate"
    ];

    // 4. Permission Check & Handle Unauthorized Access
    if (authorizedCommands.includes(command) && !isAuthorized) {
        const reply = await message.reply("You do not have permission to use this command.");
        // We still use cleanup here, but only for the reply/command message.
        cleanupAndExit(reply, message);
        return; 
    }

    // NOTE: The message deletion block (Step 5) was removed here to fix command execution.
    // Cleanup is now handled at the end of each authorized command's successful execution.

    // --- Command Execution ---

    // Standard commands
    if (command === 'roles') {
        const sentMsg = await createRolesPanel(message);
        cleanupAndExit(sentMsg, message); // Cleanup the user's command
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
        // testwelcome sends multiple messages, so we only clean up the initial command message.
        await sendWelcomeMessage(message.member, message.channel);
        await message.delete().catch(() => {});
        return;
    }

    if (command === "restart") {
        const sentMsg = await message.channel.send("Restarting... please stay on stand by");
        // Don't wait 5s for cleanup, just delete the command immediately and exit
        await message.delete().catch(() => {});
        // The bot's message is left up for the 5s, as originally intended.
        setTimeout(() => sentMsg.delete().catch(() => {}), 5000); 
        process.exit(1);
    }
    
    // --- BOOST DETECTOR COMMANDS (FIXED) ---
    if (command === 'startboosts') {
        let replyMsg;
        if (boostDetectorIsRunning) {
            replyMsg = await message.channel.send(`${EMOJI_ADDED} The persistent boost detector is already running.`);
        } else {
            await setBoostState(true);
            client.user.setActivity('Watching for Boosts', { type: 4 });
            replyMsg = await message.channel.send(`${EMOJI_ADDED} Boost detection has been **STARTED** and is now persistent across restarts.`);
        }
        cleanupAndExit(replyMsg, message);
        return;
    }

    if (command === 'stopboost') {
        let replyMsg;
        if (!boostDetectorIsRunning) {
            replyMsg = await message.channel.send(`${EMOJI_REMOVED} The persistent boost detector is already stopped.`);
        } else {
            await setBoostState(false);
            client.user.setActivity('Boost Detector Off', { type: 4 });
            replyMsg = await message.channel.send(`${EMOJI_REMOVED} Boost detection has been **STOPPED** and is now persistent across restarts.`);
        }
        cleanupAndExit(replyMsg, message);
        return;
    }

    if (command === 'checkbooststate') { 
        const statusEmoji = boostDetectorIsRunning ? EMOJI_ADDED : EMOJI_REMOVED;
        const statusText = boostDetectorIsRunning ? 'RUNNING' : 'STOPPED';
        const replyMsg = await message.channel.send(`${statusEmoji} The persistent boost detector is currently **${statusText}**.`);
        cleanupAndExit(replyMsg, message);
        return;
    }
});

// --- MEMBER JOIN ---
client.on("guildMemberAdd", async member => {
    if (isWelcomerActive) sendWelcomeMessage(member);
});

// --- MEMBER UPDATE (BOOSTER LOGIC - FIXED CHECK) ---
client.on("guildMemberUpdate", async (oldMember, newMember) => {
    // Check only for a change in premiumSince, which correctly signals a boost start/end.
    if (oldMember.premiumSince !== newMember.premiumSince) 
    {
        await handleBoosterStatusChange(oldMember, newMember);
    }
});

// --- READY (Updated with Firebase/Persistence Initialization) ---
client.once('ready', async () => {
    console.log(`Bot online as ${client.user.tag}`);
    
    // --- FIREBASE INITIALIZATION ---
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
    }
    // --- END FIREBASE INITIALIZATION ---

    await loadRolesConfig();
    client.user.setActivity(boostDetectorIsRunning ? 'Watching for Boosts' : 'Boost Detector Off', { type: 4 });
});

// --- KEEP-ALIVE ---
http.createServer((req,res)=>{res.writeHead(200);res.end('Alive');}).listen(process.env.PORT||3000);

// --- LOGIN ---
client.login(process.env.BOT_TOKEN);
