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

    .addStringOption(option =>
        option
            .setName("player")
            .setDescription("Player name")
            .setRequired(true)
    )

    .addStringOption(option =>
        option
            .setName("kit")
            .setDescription("Choose a kit")
            .setRequired(true)
            .addChoices(
                { name: "Sword", value: "sword" },
                { name: "Axe", value: "axe" },
                { name: "SpearMace", value: "spearMace" },
                { name: "ElytraMace", value: "elytraMace" },
                { name: "Crystal", value: "crystal" }
            )
    )

    .addStringOption(option =>
        option
            .setName("rank")
            .setDescription("Choose a tier")
            .setRequired(true)
            .addChoices(
                { name: "HT1", value: "HT1" },
                { name: "HT2", value: "HT2" },
                { name: "HT3", value: "HT3" },
                { name: "LT1", value: "LT1" },
                { name: "LT2", value: "LT2" },
                { name: "LT3", value: "LT3" }
            )
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
console.log("Logged in as ${client.user.tag}");
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
            body: JSON.stringify({
                player,
                kit,
                rank
            })
        });

        const data = await res.json().catch(() => null);

        if (!data || !data.success) {
            return interaction.reply({
                content: "❌ API failed or no response",
                ephemeral: true
            });
        }

        return interaction.reply({
            content: `✅ Updated ${player} → ${kit} = ${rank}`,
            ephemeral: true
        });

    } catch (err) {
        console.error(err);

        return interaction.reply({
            content: "❌ API connection error",
            ephemeral: true
        });
    }
}

});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
