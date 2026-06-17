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
const API_URL = process.env.API_URL || "https://tier-api.onrender.com";

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const panelState = new Map();

// =====================
// SAFE FETCH (IMPORTANT FIX)
// =====================

async function fetchAllPlayers() {
    const res = await fetch(`${API_URL}/players`);

    const text = await res.text();

    try {
        return JSON.parse(text);
    } catch (err) {
        console.error("BAD API RESPONSE:", text);
        throw new Error("API did not return JSON (Render might be down)");
    }
}

async function saveTier(player, kit, rank) {
    const res = await fetch(`${API_URL}/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, kit, rank })
    });

    const text = await res.text();

    try {
        const json = JSON.parse(text);
        if (!json.success) throw new Error(json.error || "API rejected update");
        return json;
    } catch (err) {
        console.error("SET ERROR RESPONSE:", text);
        throw new Error("Failed to update API");
    }
}

async function removePlayer(player) {
    const res = await fetch(`${API_URL}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player })
    });

    const text = await res.text();

    try {
        const json = JSON.parse(text);
        if (!json.success) throw new Error(json.error || "API rejected");
        return json;
    } catch (err) {
        console.error("REMOVE ERROR RESPONSE:", text);
        throw new Error("Failed to remove player");
    }
}

// =====================
// HELPERS
// =====================

function getHead(name) {
    return `https://minotar.net/avatar/${name}/128`;
}

// =====================
// PANEL BUILDER (MINIMAL SAFE VERSION)
// =====================

function buildPanel(userId) {
    const state = panelState.get(userId) || {};

    const embed = new EmbedBuilder()
        .setTitle("Tier Panel")
        .setDescription("Select player, kit, and rank.")
        .setColor(0xff6a00);

    const kitMenu = new StringSelectMenuBuilder()
        .setCustomId("kit")
        .setPlaceholder("Choose kit")
        .addOptions([
            { label: "Sword", value: "sword" },
            { label: "Axe", value: "axe" },
            { label: "Spear/Mace", value: "spearMace" },
            { label: "Elytra Mace", value: "elytraMace" },
            { label: "Crystal", value: "crystal" }
        ]);

    const rankMenu = new StringSelectMenuBuilder()
        .setCustomId("rank")
        .setPlaceholder("Choose rank")
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
            .setLabel("Remove")
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId("reset")
            .setLabel("Reset")
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(kitMenu),
            new ActionRowBuilder().addComponents(rankMenu),
            buttons
        ],
        ephemeral: true
    };
}

// =====================
// COMMAND
// =====================

const commands = [
    new SlashCommandBuilder()
        .setName("tierpanel")
        .setDescription("Open tier panel")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered");
})();

// =====================
// EVENTS
// =====================

client.once("ready", () => {
    console.log("Bot ready");
});

client.on("interactionCreate", async (interaction) => {
    try {

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === "tierpanel") {
                panelState.set(interaction.user.id, {});
                return interaction.reply(buildPanel(interaction.user.id));
            }
        }

        if (interaction.isStringSelectMenu()) {
            const state = panelState.get(interaction.user.id) || {};

            if (interaction.customId === "kit") {
                state.kit = interaction.values[0];
            }

            if (interaction.customId === "rank") {
                state.rank = interaction.values[0];
            }

            panelState.set(interaction.user.id, state);
            return interaction.update(buildPanel(interaction.user.id));
        }

        if (interaction.isButton()) {

            const state = panelState.get(interaction.user.id) || {};

            if (interaction.customId === "reset") {
                panelState.set(interaction.user.id, {});
                return interaction.update(buildPanel(interaction.user.id));
            }

            if (interaction.customId === "save") {
                if (!state.player || !state.kit || !state.rank) {
                    return interaction.reply({ content: "Missing fields", ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });

                await saveTier(state.player, state.kit, state.rank);

                return interaction.editReply("Saved!");
            }

            if (interaction.customId === "remove") {
                if (!state.player) {
                    return interaction.reply({ content: "No player selected", ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });

                await removePlayer(state.player);

                panelState.set(interaction.user.id, {});
                return interaction.editReply("Removed!");
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === "player_modal") {
                const player = interaction.fields.getTextInputValue("player");

                const state = panelState.get(interaction.user.id) || {};
                state.player = player;

                panelState.set(interaction.user.id, state);

                return interaction.update(buildPanel(interaction.user.id));
            }
        }

    } catch (err) {
        console.error(err);

        if (interaction.deferred || interaction.replied) {
            return interaction.followUp({ content: "Error occurred", ephemeral: true });
        }

        return interaction.reply({ content: "Error occurred", ephemeral: true });
    }
});

client.login(TOKEN);
