const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment-timezone');
const http = require('http'); 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMessages   
    ]
});

// --- CONFIGURATION ---
const PREFIX = '!';
const LEADERSHIP_ROLE_ID = "1402400285674049576"; 
const SPECIAL_USER_ID = "1107787991444881408"; 
let isWelcomerActive = true; 

// EMOJI IDs (Corrected IDs)
const orangeFlower = "<:orangeflower:1436795365172052018>";
const animatedFlower = "<a:animatedflowers:1436795411309395991>";
const robloxEmoji = "<:roblox:1337653461436596264>";
const handbookEmoji = "<:handbook:1406695333135650846>";

// ALL CHANNEL IDS
const WELCOME_CHANNEL_ID = "1436747102897049714"; 
const INFORMATION_CHANNEL_ID = "1402405335964057732"; 
const SUPPORT_CHANNEL_ID = "1402405357812187287"; 

// --- WELCOME MESSAGE FUNCTION ---
async function sendWelcomeMessage(member) {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const timeGMT = moment().tz("GMT").format("YYYY-MM-DD HH:mm:ss") + " GMT";

    const embed = new EmbedBuilder()
        .setTitle(`${orangeFlower} **Welcome to Adalea!**`) 
        .setDescription(
            `Welcome, ${member}! We're so happy to have you here!\n\n` +
            `Adalea is a tropical-inspired restaurant experience on the Roblox platform that strives to create memorable and unique interactions for our guests.\n\n` +
            `Please make sure to review the <#${INFORMATION_CHANNEL_ID}> so you're aware of our server guidelines. If you have any questions or concerns, feel free to open a ticket in <#${SUPPORT_CHANNEL_ID}>. We hope you enjoy your stay! ${animatedFlower}`
        )
        .setImage("https://cdn.discordapp.com/attachments/1402400197874684027/1406391472714022912/banner.png?ex=691060e0&is=690f0f60&hm=50489a1967a090539ad600113390ed0bede095df7ba58eb28ac4c9e4a718edfa")
        .setFooter({
            text: `We are now at ${member.guild.memberCount} Discord members | ${timeGMT}`
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

    channel.send({
        content: `Welcome, ${member}!`,
        embeds: [embed],
        components: [row]
    });
}

// --- CORE BOT LOGIC ---
client.on("guildMemberAdd", async (member) => {
    if (isWelcomerActive) {
        sendWelcomeMessage(member);
    }
});

// --- COMMAND HANDLER ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // Permission Check: User has role OR is the special user
    const hasLeadershipRole = message.member?.roles?.cache.has(LEADERSHIP_ROLE_ID); 
    const isSpecialUser = message.author.id === SPECIAL_USER_ID;
    
    const requiresPermission = (command === 'welcomeadalea' || command === 'stopwelcomeadalea' || command === 'restart');

    if (requiresPermission && !hasLeadershipRole && !isSpecialUser) {
         return message.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    }

    // 1. Delete command message immediately
    if (message.channel.permissionsFor(client.user).has('ManageMessages')) {
        await message.delete().catch(() => {});
    }

    if (command === 'welcomeadalea') {
        if (isWelcomerActive) {
            // Updated response to delete after 5s
            return message.channel.send({ content: `${orangeFlower} **Welcomer is already active.** (This is the default state.)` })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }
        
        isWelcomerActive = true; 
        // Updated response to delete after 5s
        message.channel.send({ content: `${orangeFlower} **Starting... Welcomer activated.**` })
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

    } else if (command === 'stopwelcomeadalea') {
        if (!isWelcomerActive) {
            // Updated response to delete after 5s
            return message.channel.send({ content: `${orangeFlower} **Welcomer is already inactive.**` })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }
        
        isWelcomerActive = false;
        // Updated response to delete after 5s
        message.channel.send({ content: `${orangeFlower} **Stopping... Welcomer deactivated.**` })
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    
    } else if (command === 'restart') {
        // Updated restart message to delete after 5s
        await message.channel.send('Restarting... please stay on stand by')
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000))
            .catch(() => {}); 
            
        process.exit(1); 
    }
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

// --- END KEEP-ALIVE SERVER ---

// ✅ SAFE TOKEN HANDLING 
client.login(process.env.BOT_TOKEN);
