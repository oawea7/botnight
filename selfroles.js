if (command === 'roles') {
    console.log(`[DEBUG] !roles command triggered by ${message.author.tag}`);

    // Temporarily bypass permission check
    await createRolesPanel(message);
}
