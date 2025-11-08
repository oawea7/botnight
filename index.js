const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment-timezone');
const http = require('http'); // ⬅️ NEW: Required for the Keep-Alive server

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// CUSTOM EMOJIS
const orangeFlower = "<:orangeflower:1406646129122086933>";
const animatedFlower = "<a:animatedflowers:1416717492050722927>";
const robloxEmoji = "<:roblox:1337653461436596264>";
const handbookEmoji = "<:handbook:1406695333135650846>";

// CHANNEL TO SEND WELCOME MESSAGE IN
const WELCOME_CHANNEL_ID = "YOUR_CHANNEL_ID"; // put the welcome channel id here

client.on("guildMemberAdd", async (member) => {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    // Time in GMT
    const timeGMT = moment().tz("GMT").format("YYYY-MM-DD HH:mm:ss") + " GMT";

    // Embed
    const embed = new EmbedBuilder()
        .setTitle(`${orangeFlower} **Welcome to Adalea!**`)
        .setDescription(
            `Welcome, ${member}! We're so happy to have you here!\n\n` +
            `Adalea is a tropical-inspired restaurant experience on the Roblox platform that strives to create memorable and unique interactions for our guests.\n\n` +
            `Please make sure to review the **#information** channel so you're aware of our server guidelines. If you have any questions or concerns, feel free to open a ticket in **#support**.We hope you enjoy your stay! ${animatedFlower}`
        )
        .setImage("https://cdn.discordapp.com/attachments/1402400197874684027/1406391472714022912/banner.png?ex=691060e0&is=690f0f60&hm=50489a1967a090539ad600113390ed0bede095df7ba58eb28ac4c9e4a718edfa")
        .setFooter({
            text: `We are now at ${member.guild.memberCount} Discord members | ${timeGMT}`
        })
        .setColor("#FFCC33"); // yellowish-orange, more yellow

    // Buttons
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

    // Send message
    channel.send({
        content: `Welcome, ${member}!`,
        embeds: [embed],
        components: [row]
    });
});

// --- KEEP-ALIVE SERVER FOR RENDER (Starts a tiny web server) ---
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is alive!');
});

// Render automatically sets the PORT environment variable
server.listen(process.env.PORT || 3000, () => {
  console.log(`Keep-alive server is listening on port ${process.env.PORT || 3000}`);
});

// --- END KEEP-ALIVE SERVER ---

// ✅ SAFE TOKEN HANDLING — The bot starts connecting to Discord AFTER the web server starts
client.login(process.env.BOT_TOKEN);
