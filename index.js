const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment-timezone');
const http = require('http'); 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ✅ FINAL EMOJI IDs (Using the latest IDs you provided)
const orangeFlower = "<:orangeflower:1436795365172052018>";
const animatedFlower = "<a:animatedflowers:1436795411309395991>";
const robloxEmoji = "<:roblox:1337653461436596264>";
const handbookEmoji = "<:handbook:1406695333135650846>";

// ALL CHANNEL IDS
const WELCOME_CHANNEL_ID = "1436747102897049714"; 
const INFORMATION_CHANNEL_ID = "1402405335964057732"; 
const SUPPORT_CHANNEL_ID = "1402405357812187287"; 


client.on("guildMemberAdd", async (member) => {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    // Time in GMT
    const timeGMT = moment().tz("GMT").format("YYYY-MM-DD HH:mm:ss") + " GMT";

    // Embed
    const embed = new EmbedBuilder()
        // FIX: Using the correct, updated orange flower ID
        .setTitle(`${orangeFlower} **Welcome to Adalea!**`) 
        .setDescription(
            `Welcome, ${member}! We're so happy to have you here!\n\n` +
            `Adalea is a tropical-inspired restaurant experience on the Roblox platform that strives to create memorable and unique interactions for our guests.\n\n` +
            // Clickable channel links are here
            `Please make sure to review the <#${INFORMATION_CHANNEL_ID}> so you're aware of our server guidelines. If you have any questions or concerns, feel free to open a ticket in <#${SUPPORT_CHANNEL_ID}>. We hope you enjoy your stay! ${animatedFlower}`
        )
        .setImage("https://cdn.discordapp.com/attachments/1402400197874684027/1406391472714022912/banner.png?ex=691060e0&is=690f0f60&hm=50489a1967a090539ad600113390ed0bede095df7ba58eb28ac4c9e4a718edfa")
        .setFooter({
            text: `We are now at ${member.guild.memberCount} Discord members | ${timeGMT}`
        })
        .setColor("#FFCC33"); 

    // Buttons (These emojis should also be using the correct IDs)
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

// ✅ SAFE TOKEN HANDLING 
client.login(process.env.BOT_TOKEN);
