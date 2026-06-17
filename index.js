const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_URL = "https://tier-api.onrender.com";

// =====================
// CLIENT
// =====================
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// =====================
// SLASH COMMAND
// =====================
const commands = [
    new SlashCommandBuilder()
        .setName("tier")
        .setDescription("Set player tier")
        .addStringOption(o =>
            o.setName("player")
                .setDescription("Player name")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("kit")
                .setDescription("Kit name")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("rank")
                .setDescription("Rank (HT1-LT3)")
                .setRequired(true)
        )
].map(cmd => cmd.toJSON());

// =====================
// REGISTER COMMANDS
// =====================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log("Slash command registered");
    } catch (err) {
        console.error("Command register error:", err);
    }
})();

// =====================
// READY EVENT
// =====================
client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// =====================
// COMMAND HANDLER
// =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "tier") {
        const player = interaction.options.getString("player");
        const kit = interaction.options.getString("kit");
        const rank = interaction.options.getString("rank");

        try {
            const res = await fetch(`${API_URL}/update`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ player, kit, rank })
            });

            const data = await res.json().catch(() => null);

            if (!data || !data.success) {
                return interaction.reply("❌ API failed or no response");
            }

            return interaction.reply(
                `✅ Updated ${player} → ${kit} = ${rank}`
            );

        } catch (err) {
            console.error(err);
            return interaction.reply("❌ API connection error");
        }
    }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
