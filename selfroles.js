client.on('messageCreate', message => {
    console.log(`[DEBUG] Message received from ${message.author.tag} in ${message.channel.name}: ${message.content}`);
});
