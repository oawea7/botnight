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
const http = require('http'); 
const fs = require('fs-extra'); 

// --- CONFIGURATION ---
const PREFIX = '!';
const LEADERSHIP_ROLE_ID = "1402400285674049714"; // LT+ Role ID for command permissions
const SPECIAL_USER_ID = "1107787991444881408";     // Specific User ID for command permissions
const ROLES_FILE = 'roles.json';
let rolesConfig = {};

// Custom Confirmation Emojis (MAPPED CORRECTLY)
const EMOJI_ADDED = "<a:verify_checkpink:1428986926878163024>";  // Pink Check for ADDED roles
const EMOJI_REMOVED = "<a:Zx_:746055996362719244>";     // Zx_ for REMOVED roles

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildIntegrations 
    ]
});


// --- STATE MANAGEMENT FUNCTIONS ---

async function loadRolesConfig() {
    try {
        rolesConfig = await fs.readJson(ROLES_FILE);
        console.log("Roles configuration loaded successfully.");
    } catch (error) {
        console.error("CRITICAL ERROR: Could not load roles.json. Self-roles disabled.", error.message);
    }
}


// --- ROLE COMMAND FUNCTION ---

async function createRolesPanel(message) {
    if (!rolesConfig.ROLE_CHANNEL_ID) {
        return message.channel.send("Error: Role channel ID not set in roles.json. Cannot create panel.")
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    }
    
    // 1. Create the Embed with the final, fixed custom text
    const roleEmbed = new EmbedBuilder()
        .setTitle(`${rolesConfig.EMBED_TITLE_EMOJI} **Adalea Roles**`)
        .setDescription(
            "Welcome to Adalea's Role Selection channel! This is the channel where you can obtain your pronouns, ping roles, and shift/session notifications. Simply click one of the buttons below (**Pronouns**, **Pings**, or **Shifts**), open the dropdown, and choose the roles you want. If you wish to remove a role, simply click the button again to unselect! If you have any issues, contact a member of the **@Moderation Team**."
        )
        .setImage(rolesConfig.EMBED_IMAGE)
        .setColor(rolesConfig.EMBED_COLOR);

    // 2. Create the Buttons with your specific custom emojis
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('roles_pronoun_btn')
            .setLabel('Pronouns')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(rolesConfig.BUTTON_EMOJIS.pronoun),
        new ButtonBuilder()
            .setCustomId('roles_pings_btn')
            .setLabel('Pings')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(rolesConfig.BUTTON_EMOJIS.pings),
        new ButtonBuilder()
            .setCustomId('roles_shifts_btn')
            .setLabel('Shifts')
            .setStyle(ButtonStyle.Success)
            .setEmoji(rolesConfig.BUTTON_EMOJIS.shifts)
    );
    
    // 3. Send the message to the designated channel
    const channel = message.guild.channels.cache.get(rolesConfig.ROLE_CHANNEL_ID);
    if (channel && channel.type === ChannelType.GuildText) {
        await channel.send({ embeds: [roleEmbed], components: [row] });
        message.channel.send(`Role panel successfully sent to <#${rolesConfig.ROLE_CHANNEL_ID}>.`)
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    } else {
        message.channel.send("Error: Designated role channel not found or is not a text channel.")
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    }
}

// --- INTERACTION HANDLER (Buttons and Select Menus) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    if (!interaction.inGuild()) return;

    const member = interaction.member;
    let rolesCategory = null;
    let categoryName = '';
    let emoji = '';
    let customId = interaction.customId;

    // --- 1. BUTTON CLICK (Present the dropdown) ---
    if (interaction.isButton()) {
        if (!customId.startsWith('roles_')) return;

        if (customId === 'roles_pronoun_btn') {
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
            return interaction.reply({ content: `Error: No roles configured for ${categoryName}.`, ephemeral: true });
        }

        const options = rolesCategory.map(role => {
            const isSelected = member.roles.cache.has(role.roleId);
            return new StringSelectMenuOptionBuilder()
                .setLabel(role.label)
                .setValue(role.roleId)
                .setDefault(isSelected); 
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`role_select_${categoryName.toLowerCase()}`)
            .setPlaceholder(`Select roles for the ${categoryName} category...`)
            .setMinValues(0)
            .setMaxValues(options.length)
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const ephemeralMessage = `${emoji} **${categoryName} Selection**\nSelect the roles you would like to have under this dropdown. Unselect a role to remove it.`;

        await interaction.reply({
            content: ephemeralMessage,
            components: [row],
            ephemeral: true 
        });
    } 
    
    // --- 2. SELECT MENU INTERACTION (Apply the roles) ---
    else if (interaction.isStringSelectMenu()) {
        if (!customId.startsWith('role_select_')) return;

        // Determine the array of all possible Role IDs for this category
        let allCategoryRoles = [];
        if (customId.includes('pronouns')) {
            allCategoryRoles = rolesConfig.PRONOUN_ROLES.map(r => r.roleId);
        } else if (customId.includes('pings')) {
            allCategoryRoles = rolesConfig.PINGS_ROLES.map(r => r.roleId);
        } else if (customId.includes('shifts')) {
            allCategoryRoles = rolesConfig.SHIFTS_ROLES.map(r => r.roleId);
        }

        const newRoleIds = interaction.values;
        const currentMemberRoleIds = member.roles.cache.map(r => r.id);
        const addedRoles = [];
        const removedRoles = [];
        
        // Loop through all possible roles in the category to add/remove
        for (const roleId of allCategoryRoles) {
            const hasRole = currentMemberRoleIds.includes(roleId);
            const selected = newRoleIds.includes(roleId);

            if (selected && !hasRole) {
                // ADD ROLE (Pink Check)
                try {
                    await member.roles.add(roleId);
                    addedRoles.push(`${EMOJI_ADDED} <@&${roleId}>`); 
                } catch (e) {
                    console.error(`Failed to add role ${roleId}:`, e);
                }
            } else if (!selected && hasRole) {
                // REMOVE ROLE (Zx_)
                try {
                    await member.roles.remove(roleId);
                    removedRoles.push(`${EMOJI_REMOVED} <@&${roleId}>`); 
                } catch (e) {
                    console.error(`Failed to remove role ${roleId}:`, e);
                }
            }
        }
        
        let response = `Your roles have been updated!`;
        if (addedRoles.length > 0) {
            response += `\nAdded: ${addedRoles.join(' ')}`;
        }
        if (removedRoles.length > 0) {
            response += `\nRemoved: ${removedRoles.join(' ')}`;
        }
        if (addedRoles.length === 0 && removedRoles.length === 0) {
            response = "No changes were made to your roles in this category.";
        }

        await interaction.update({ content: response, components: [], ephemeral: true });
    }
});


// --- COMMAND HANDLER (Only !roles command) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // Permission Check: User has Leadership Role OR is the Special User
    const hasLeadershipRole = message.member?.roles?.cache.has(LEADERSHIP_ROLE_ID); 
    const isSpecialUser = message.author.id === SPECIAL_USER_ID;
    
    if (command === 'roles') {
        if (!hasLeadershipRole && !isSpecialUser) {
             return message.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }

        // 1. Delete command message after 2 seconds
        if (message.channel.permissionsFor(client.user).has('ManageMessages')) {
            await new Promise(resolve => setTimeout(resolve, 2000)); 
            await message.delete().catch(() => {});
        }
        
        await createRolesPanel(message);
    }
});


// --- BOT STARTUP ---
client.once('ready', async () => {
    console.log(`Self-Roles Bot logged in as ${client.user.tag}`);
    await loadRolesConfig(); 
});


// --- KEEP-ALIVE SERVER FOR RENDER ---
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is alive!');
});

// Render automatically sets the PORT environment variable
server.listen(process.env.PORT || 3000, () => {
  console.log(`Keep-alive server is listening on port ${process.env.PORT || 3000}`);
});

// ✅ SAFE TOKEN HANDLING 
client.login(process.env.BOT_TOKEN);
