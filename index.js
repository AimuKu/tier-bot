const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    InteractionType
} = require("discord.js");

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
// DATA STORAGE (TEMP)
// =====================
const sessionData = new Map();

// =====================
// SLASH COMMAND
// =====================
const commands = [
    new SlashCommandBuilder()
        .setName("tier")
        .setDescription("Open tier management panel")
].map(cmd => cmd.toJSON());

// =====================
// REGISTER COMMAND
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
        console.error(err);
    }
})();

// =====================
// READY
// =====================
client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {

    // ---------------------
    // /tier -> OPEN MODAL
    // ---------------------
    if (interaction.isChatInputCommand() && interaction.commandName === "tier") {

        const modal = new ModalBuilder()
            .setCustomId("tier_modal")
            .setTitle("Tier Manager");

        const playerInput = new TextInputBuilder()
            .setCustomId("player")
            .setLabel("Player Name")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(playerInput);

        modal.addComponents(row);

        return interaction.showModal(modal);
    }

    // ---------------------
    // MODAL SUBMIT
    // ---------------------
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === "tier_modal") {

        const player = interaction.fields.getTextInputValue("player");

        sessionData.set(interaction.user.id, {
            player,
            kit: null,
            rank: null
        });

        const embed = new EmbedBuilder()
            .setTitle("🏆 Tier Manager")
            .setDescription(`Player: **${player}**`)
            .setColor("Orange");

        const kitMenu = new StringSelectMenuBuilder()
            .setCustomId("kit_select")
            .setPlaceholder("Select Kit")
            .addOptions([
                { label: "Sword", value: "sword" },
                { label: "Axe", value: "axe" },
                { label: "SpearMace", value: "spearMace" },
                { label: "ElytraMace", value: "elytraMace" },
                { label: "Crystal", value: "crystal" }
            ]);

        const rankMenu = new StringSelectMenuBuilder()
            .setCustomId("rank_select")
            .setPlaceholder("Select Tier")
            .addOptions([
                { label: "HT1", value: "HT1" },
                { label: "HT2", value: "HT2" },
                { label: "HT3", value: "HT3" },
                { label: "LT1", value: "LT1" },
                { label: "LT2", value: "LT2" },
                { label: "LT3", value: "LT3" }
            ]);

        const saveButton = new ButtonBuilder()
            .setCustomId("save_tier")
            .setLabel("Save")
            .setStyle(ButtonStyle.Success);

        return interaction.reply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(kitMenu),
                new ActionRowBuilder().addComponents(rankMenu),
                new ActionRowBuilder().addComponents(saveButton)
            ],
            ephemeral: true
        });
    }

    // ---------------------
    // KIT SELECT
    // ---------------------
    if (interaction.isStringSelectMenu() && interaction.customId === "kit_select") {

        const data = sessionData.get(interaction.user.id);
        if (!data) return;

        data.kit = interaction.values[0];
        sessionData.set(interaction.user.id, data);

        return interaction.deferUpdate();
    }

    // ---------------------
    // RANK SELECT
    // ---------------------
    if (interaction.isStringSelectMenu() && interaction.customId === "rank_select") {

        const data = sessionData.get(interaction.user.id);
        if (!data) return;

        data.rank = interaction.values[0];
        sessionData.set(interaction.user.id, data);

        return interaction.deferUpdate();
    }

    // ---------------------
    // SAVE BUTTON
    // ---------------------
    if (interaction.isButton() && interaction.customId === "save_tier") {

        const data = sessionData.get(interaction.user.id);

        if (!data || !data.player || !data.kit || !data.rank) {
            return interaction.reply({
                content: "❌ Missing player, kit, or rank",
                ephemeral: true
            });
        }

        try {
            const res = await fetch(`${API_URL}/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const json = await res.json().catch(() => null);

            if (!json || !json.success) {
                return interaction.reply({
                    content: "❌ API failed",
                    ephemeral: true
                });
            }

            sessionData.delete(interaction.user.id);

            return interaction.reply({
                content: `✅ Updated ${data.player} → ${data.kit} = ${data.rank}`,
                ephemeral: true
            });

        } catch (err) {
            console.error(err);

            return interaction.reply({
                content: "❌ API error",
                ephemeral: true
            });
        }
    }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
