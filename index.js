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

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_URL = "https://tier-api.onrender.com";

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// =====================
// GLOBAL PANEL STATE
// =====================
const panelState = new Map();

// =====================
// COMMAND
// =====================
const commands = [
    new SlashCommandBuilder()
        .setName("tierpanel")
        .setDescription("Open Tier Control Panel")
].map(cmd => cmd.toJSON());

// =====================
// REGISTER
// =====================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
    );
    console.log("Panel command registered");
})();

// =====================
// READY
// =====================
client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// =====================
// BUILD PANEL
// =====================
function buildPanel(userId) {
    const state = panelState.get(userId) || {};

    const embed = new EmbedBuilder()
        .setTitle("🏆 SonarMC Tier Panel")
        .setColor("Orange")
        .setDescription(
            `Player: **${state.player || "None"}**\n` +
            `Kit: **${state.kit || "None"}**\n` +
            `Tier: **${state.rank || "None"}**`
        );

    const kitMenu = new StringSelectMenuBuilder()
        .setCustomId("kit")
        .setPlaceholder("Select Kit")
        .addOptions([
            { label: "Sword", value: "sword" },
            { label: "Axe", value: "axe" },
            { label: "SpearMace", value: "spearMace" },
            { label: "ElytraMace", value: "elytraMace" },
            { label: "Crystal", value: "crystal" }
        ]);

    const rankMenu = new StringSelectMenuBuilder()
        .setCustomId("rank")
        .setPlaceholder("Select Tier")
        .addOptions([
            { label: "HT1", value: "HT1" },
            { label: "HT2", value: "HT2" },
            { label: "HT3", value: "HT3" },
            { label: "LT1", value: "LT1" },
            { label: "LT2", value: "LT2" },
            { label: "LT3", value: "LT3" }
        ]);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("set_player")
            .setLabel("Set Player")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("save")
            .setLabel("Save")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("remove")
            .setLabel("Remove Player")
            .setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(kitMenu),
            new ActionRowBuilder().addComponents(rankMenu),
            buttons
        ]
    };
}

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {

    // OPEN PANEL
    if (interaction.isChatInputCommand() && interaction.commandName === "tierpanel") {

        panelState.set(interaction.user.id, {});

        return interaction.reply({
            ...buildPanel(interaction.user.id),
            ephemeral: true
        });
    }

    // SET PLAYER MODAL OPEN
    if (interaction.isButton() && interaction.customId === "set_player") {

        const modal = new ModalBuilder()
            .setCustomId("player_modal")
            .setTitle("Set Player");

        const input = new TextInputBuilder()
            .setCustomId("player")
            .setLabel("Player Name")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
    }

    // PLAYER MODAL SUBMIT
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === "player_modal") {

        const player = interaction.fields.getTextInputValue("player");

        const state = panelState.get(interaction.user.id) || {};
        state.player = player;
        panelState.set(interaction.user.id, state);

        return interaction.reply({
            ...buildPanel(interaction.user.id),
            ephemeral: true
        });
    }

    // KIT SELECT
    if (interaction.isStringSelectMenu() && interaction.customId === "kit") {

        const state = panelState.get(interaction.user.id) || {};
        state.kit = interaction.values[0];
        panelState.set(interaction.user.id, state);

        return interaction.update(buildPanel(interaction.user.id));
    }

    // RANK SELECT
    if (interaction.isStringSelectMenu() && interaction.customId === "rank") {

        const state = panelState.get(interaction.user.id) || {};
        state.rank = interaction.values[0];
        panelState.set(interaction.user.id, state);

        return interaction.update(buildPanel(interaction.user.id));
    }

    // SAVE
    if (interaction.isButton() && interaction.customId === "save") {

        const state = panelState.get(interaction.user.id);

        if (!state?.player || !state?.kit || !state?.rank) {
            return interaction.reply({
                content: "❌ Missing data",
                ephemeral: true
            });
        }

        try {
            const res = await fetch(`${API_URL}/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(state)
            });

            const json = await res.json().catch(() => null);

            if (!json?.success) {
                return interaction.reply({
                    content: "❌ API error",
                    ephemeral: true
                });
            }

            return interaction.reply({
                content: `✅ Saved ${state.player} → ${state.kit} = ${state.rank}`,
                ephemeral: true
            });

        } catch (err) {
            console.error(err);
            return interaction.reply({
                content: "❌ Server error",
                ephemeral: true
            });
        }
    }

    // REMOVE PLAYER
    if (interaction.isButton() && interaction.customId === "remove") {

        const state = panelState.get(interaction.user.id);

        if (!state?.player) {
            return interaction.reply({
                content: "❌ No player selected",
                ephemeral: true
            });
        }

        try {
            await fetch(`${API_URL}/remove`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ player: state.player })
            });

            return interaction.reply({
                content: `🗑 Removed ${state.player}`,
                ephemeral: true
            });

        } catch (err) {
            console.error(err);
            return interaction.reply({
                content: "❌ Failed to remove",
                ephemeral: true
            });
        }
    }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
