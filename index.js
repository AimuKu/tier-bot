const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const fetch = require("node-fetch");

// Use ENV variables (IMPORTANT for Render)
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_URL = "https://tier-api.onrender.com";

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Slash command
const commands = [
    new SlashCommandBuilder()
        .setName("tier")
        .setDescription("Set player tier")
        .addStringOption(o => o.setName("player").setRequired(true))
        .addStringOption(o => o.setName("kit").setRequired(true))
        .addStringOption(o => o.setName("rank").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
    );
    console.log("Slash command registered");
})();

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "tier") {
        const player = interaction.options.getString("player");
        const kit = interaction.options.getString("kit");
        const rank = interaction.options.getString("rank");

        try {
            const res = await fetch(`${API_URL}/set`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ player, kit, rank })
            });

            const data = await res.json();

            if (!data.success) {
                return interaction.reply("❌ Error: " + data.error);
            }

            return interaction.reply(
                `✅ Updated ${player} → ${kit} = ${rank}`
            );

        } catch (err) {
            console.error(err);
            return interaction.reply("❌ API error");
        }
    }
});

client.login(TOKEN);
