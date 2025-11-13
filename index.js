const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs-extra");
const http = require("http");
const moment = require("moment-timezone");

// ─── CONSTANTS ─────────────────────────────────────────────
const PREFIX = "!";
const LEADERSHIP_ROLE_ID = "1402400285674049576";
const SPECIAL_USER_ID = "1107787991444881408";
const ROLES_FILE = "roles.json";

let rolesConfig = {};

// ─── BOOST CONSTANTS ───────────────────────────────────────
const COMMUNITY_CHANNEL_ID = "1402405984978341888";
const BOOSTER_LOUNGE_CHANNEL_ID = "1414381377389858908";
const SERVER_BOOSTER_ROLE_ID = "1404242033849270272";

// ─── EMOJIS ────────────────────────────────────────────────
const EMOJI_ADDED = "<a:Zcheck:1437064263570292906>";
const orangeFlower = "<:orangeflower:1436795365172052018>";
const animatedFlower = "<a:animatedflowers:1436795411309395991>";
const robloxEmoji = "<:roblox:1337653461436596264>";
const handbookEmoji = "<:handbook:1406695333135650846>";

// ─── CHANNELS ──────────────────────────────────────────────
const WELCOME_CHANNEL_ID = "1402405984978341888";
const INFORMATION_CHANNEL_ID = "1402405335964057732";
const SUPPORT_CHANNEL_ID = "1402405357812187287";
const MODERATION_ROLE_ID = "1402411949593202800";

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
    if (!Array.isArray(rolesConfig.PRONOUN_ROLES))
      rolesConfig.PRONOUN_ROLES = [];
    const anyExists = rolesConfig.PRONOUN_ROLES.some(
      (r) => r.roleId === "1402704905264697374"
    );
    if (!anyExists) {
      rolesConfig.PRONOUN_ROLES.push({
        label: "Any",
        roleId: "1402704905264697374",
      });
      console.log("[DEBUG] Added pronoun role 'Any' to rolesConfig.");
    }
    console.log("[DEBUG] Roles loaded successfully.");
  } catch (err) {
    console.error("[ERROR] Failed to load roles.json:", err);
    rolesConfig = {};
  }
}

// ─── BOOST FUNCTIONS ───────────────────────────────────────
async function sendBoostThankYou(member, channel = null) {
  const targetChannel =
    channel || member.guild.channels.cache.get(COMMUNITY_CHANNEL_ID);
  if (!targetChannel) return;

  await targetChannel.send(`Thank you, <@${member.id}>!`);

  const embed = new EmbedBuilder()
    .setTitle("Thank you for boosting! <:Booster:1424080874890072205>")
    .setDescription(
      `Thank you, <@${member.id}>! Your support helps our tropical island grow brighter and cozier every day! <:flower:1424840226785988608>`
    )
    .setColor("#FFCC33");

  await targetChannel.send({ embeds: [embed] });
}

async function sendBoosterLoungeWelcome(member, channel = null) {
  const targetChannel =
    channel || member.guild.channels.cache.get(BOOSTER_LOUNGE_CHANNEL_ID);
  if (!targetChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("Welcome to the Booster Lounge!")
    .setDescription(
      `Welcome, <@${member.id}> to the booster lounge. This is one of the many perks you can get as a server booster. Make sure to open a moderation ticket to claim your special role!`
    )
    .setColor("#FFA500");

  await targetChannel.send({ embeds: [embed] });
}

// ─── ROLES PANEL ───────────────────────────────────────────
async function createRolesPanel(message) {
  if (!rolesConfig || Object.keys(rolesConfig).length === 0) {
    return message.channel
      .send("Error: roles.json is empty!")
      .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
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
      .setCustomId("roles_pronouns")
      .setLabel("Pronouns")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({
        id:
          (rolesConfig.BUTTON_EMOJIS &&
            rolesConfig.BUTTON_EMOJIS.pronoun &&
            (rolesConfig.BUTTON_EMOJIS.pronoun.match(/\d+/) || [])[0]) ||
          null,
      }),
    new ButtonBuilder()
      .setCustomId("roles_pings")
      .setLabel("Pings")
      .setStyle(ButtonStyle.Primary)
      .setEmoji({
        id:
          (rolesConfig.BUTTON_EMOJIS &&
            rolesConfig.BUTTON_EMOJIS.pings &&
            (rolesConfig.BUTTON_EMOJIS.pings.match(/\d+/) || [])[0]) ||
          null,
      }),
    new ButtonBuilder()
      .setCustomId("roles_sessions")
      .setLabel("Sessions")
      .setStyle(ButtonStyle.Success)
      .setEmoji({
        id:
          (rolesConfig.BUTTON_EMOJIS &&
            rolesConfig.BUTTON_EMOJIS.shifts &&
            (rolesConfig.BUTTON_EMOJIS.shifts.match(/\d+/) || [])[0]) ||
          null,
      })
  );

  try {
    await message.channel.send({ embeds: [embed], components: [row] });
    console.log("[DEBUG] Roles panel sent successfully.");
  } catch (err) {
    console.error("[ERROR] Failed to send roles panel:", err);
  }
}

// ─── WELCOME MESSAGE ───────────────────────────────────────
async function sendWelcomeMessage(member, channel = null) {
  const targetChannel =
    channel || member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
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
    .setImage(
      "https://cdn.discordapp.com/attachments/1402400197874684027/1406391472714022912/banner.png"
    )
    .setFooter({
      text: `We are now at ${member.guild.memberCount} Discord members | ${timeGMT}`,
    })
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

  await targetChannel.send({ embeds: [embed], components: [row] });
}

// ─── MEMBER UPDATE (BOOST HANDLER) ─────────────────────────
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const oldBoost = oldMember.premiumSince;
  const newBoost = newMember.premiumSince;
  const boosterRole = newMember.guild.roles.cache.get(SERVER_BOOSTER_ROLE_ID);

  if (!boosterRole)
    return console.error("[ERROR] Server Booster Role not found!");

  // BOOST DETECTED
  if (!oldBoost && newBoost) {
    console.log(`[DEBUG] ${newMember.user.tag} started boosting!`);
    if (!newMember.roles.cache.has(SERVER_BOOSTER_ROLE_ID)) {
      try {
        await newMember.roles.add(boosterRole);
        console.log(`[DEBUG] Added Server Booster role to ${newMember.user.tag}.`);
      } catch (e) {
        console.error(`[ERROR] Failed to add booster role to ${newMember.user.tag}:`, e);
      }
    }
    await sendBoostThankYou(newMember);
    await sendBoosterLoungeWelcome(newMember);
  }

  // UNBOOST DETECTED
  else if (oldBoost && !newBoost) {
    console.log(`[DEBUG] ${newMember.user.tag} stopped boosting.`);
    if (newMember.roles.cache.has(SERVER_BOOSTER_ROLE_ID)) {
      try {
        await newMember.roles.remove(boosterRole);
        console.log(`[DEBUG] Removed booster role from ${newMember.user.tag}.`);
      } catch (e) {
        console.error(`[ERROR] Failed to remove booster role from ${newMember.user.tag}:`, e);
      }
    }
  }
});

// ─── COMMANDS ──────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  const hasRole = message.member?.roles.cache.has(LEADERSHIP_ROLE_ID);
  const isSpecial = message.author.id === SPECIAL_USER_ID;
  const isPermitted = hasRole || isSpecial;

  const restrictedCommands = [
    "roles",
    "testwelcome",
    "testboost",
    "restart",
  ];

  if (!isPermitted && restrictedCommands.includes(command)) {
    return message.reply("You do not have permission to use this command.")
      .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
  }
  
  // Attempt to delete the command message immediately
  if (message.channel.permissionsFor(client.user).has("ManageMessages")) {
      await message.delete().catch(() => {});
  } else {
      // If no permission, delete after 5 seconds
      setTimeout(() => message.delete().catch(() => {}), 5000);
  }

  // --- COMMAND HANDLERS ---
  
  if (command === "roles") {
    await createRolesPanel(message);
    return;
  }

  if (command === "testboost") {
    await sendBoostThankYou(message.member, message.channel);
    await sendBoosterLoungeWelcome(message.member, message.channel);
    return message.channel
      .send(`${EMOJI_ADDED} **Boost messages sent here for testing.**`)
      .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
  }
  
  if (command === "testwelcome") {
    await sendWelcomeMessage(message.member, message.channel);
    return message.channel
      .send(`${EMOJI_ADDED} **Welcome message sent here for testing.**`)
      .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000));
  }

  if (command === "restart") {
    // This is the reliable way to restart a bot in a managed hosting environment
    await message.channel.send("Restarting bot...").then(() => process.exit(1)); 
  }
});

// ─── MEMBER JOIN (ALWAYS WELCOMES) ─────────────────────────
client.on("guildMemberAdd", async (member) => {
    // Welcomer is now always on, as the toggle commands were removed
    sendWelcomeMessage(member);
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
