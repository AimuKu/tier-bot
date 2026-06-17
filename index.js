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
    MessageFlags
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_URL = process.env.API_URL || "https://tier-api.onrender.com";

// =====================
// CLIENT
// =====================

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// =====================
// STATE
// =====================

const panelState = new Map();

// =====================
// CONFIG
// =====================

const BRAND = {
    name: "SonarMC",
    color: 0xff6a00
};

const KIT_META = {
    sword: { label: "Sword", emoji: "⚔️" },
    axe: { label: "Axe", emoji: "🪓" },
    spearMace: { label: "Spear/Mace", emoji: "🔱" },
    elytraMace: { label: "Elytra", emoji: "🪽" },
    crystal: { label: "Crystal", emoji: "💎" }
};

const TIER_META = {
    HT1: { emoji: "🔴" },
    HT2: { emoji: "🟠" },
    HT3: { emoji: "🟡" },
    LT1: { emoji: "🟢" },
    LT2: { emoji: "🔵" },
    LT3: { emoji: "⚫" }
};

// =====================
// API
// =====================

async function fetchPlayers() {
    try {
        const res = await fetch(`${API_URL}/players`);
        return await res.json();
    } catch {
        return {};
    }
}

async function setTier(player, kit, rank) {
    const res = await fetch(`${API_URL}/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, kit, rank })
    });

    return res.json();
}

async function removePlayer(player) {
    const res = await fetch(`${API_URL}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player })
    });

    return res.json();
}

// =====================
// PANEL BUILDER
// =====================

function buildPanel(userId, status = null) {
    const state = panelState.get(userId) || {};

    const ready = state.player && state.kit && state.rank;

    const embed = new EmbedBuilder()
        .setTitle("SonarMC Tier Panel")
        .setColor(BRAND.color)
        .setDescription(status?.message || "Select player, kit, and tier.");

    // PLAYER BUTTON
    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("set_player")
            .setLabel("Player")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("save")
            .setLabel("Save")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!ready),

        new ButtonBuilder()
            .setCustomId("remove")
            .setLabel("Remove")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!state.player),

        new ButtonBuilder()
            .setCustomId("reset")
            .setLabel("Reset")
            .setStyle(ButtonStyle.Secondary)
    );

    // KIT MENU
    const kitMenu = new StringSelectMenuBuilder()
        .setCustomId("kit")
        .setPlaceholder(state.kit ? `Kit: ${state.kit}` : "Select Kit")
        .addOptions(
            Object.entries(KIT_META).map(([value, kit]) => ({
                label: kit.label,
                value,
                emoji: kit.emoji
            }))
        );

    // RANK MENU
    const rankMenu = new StringSelectMenuBuilder()
        .setCustomId("rank")
        .setPlaceholder(state.rank ? `Tier: ${state.rank}` : "Select Tier")
        .addOptions(
            Object.entries(TIER_META).map(([value, tier]) => ({
                label: value,
                value,
                emoji: tier.emoji
            }))
        );

    embed.addFields(
        {
            name: "Player",
            value: state.player ? `\`${state.player}\`` : "None",
            inline: true
        },
        {
            name: "Kit",
            value: state.kit || "None",
            inline: true
        },
        {
            name: "Tier",
            value: state.rank || "None",
            inline: true
        }
    );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(kitMenu),
            new ActionRowBuilder().addComponents(rankMenu),
            controls
        ]
    };
}

// =====================
// COMMAND REGISTER
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
// READY
// =====================

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// =====================
// INTERACTIONS
// =====================

client.on("interactionCreate", async (i) => {

    // OPEN PANEL
    if (i.isChatInputCommand() && i.commandName === "tierpanel") {
        panelState.set(i.user.id, {});
        return i.reply({
            ...buildPanel(i.user.id),
            flags: MessageFlags.Ephemeral
        });
    }

    // PLAYER MODAL
    if (i.isButton() && i.customId === "set_player") {
        const modal = new ModalBuilder()
            .setCustomId("player_modal")
            .setTitle("Set Player");

        const input = new TextInputBuilder()
            .setCustomId("player")
            .setLabel("Minecraft Username")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );

        return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === "player_modal") {
        const player = i.fields.getTextInputValue("player");

        const state = panelState.get(i.user.id) || {};
        state.player = player;
        panelState.set(i.user.id, state);

        return i.update(buildPanel(i.user.id, {
            message: `Selected player: ${player}`
        }));
    }

    // KIT SELECT
    if (i.isStringSelectMenu() && i.customId === "kit") {
        const state = panelState.get(i.user.id) || {};
        state.kit = i.values[0];
        panelState.set(i.user.id, state);

        return i.update(buildPanel(i.user.id));
    }

    // RANK SELECT
    if (i.isStringSelectMenu() && i.customId === "rank") {
        const state = panelState.get(i.user.id) || {};
        state.rank = i.values[0];
        panelState.set(i.user.id, state);

        return i.update(buildPanel(i.user.id));
    }

    // RESET
    if (i.isButton() && i.customId === "reset") {
        panelState.set(i.user.id, {});
        return i.update(buildPanel(i.user.id, {
            message: "Reset complete."
        }));
    }

    // SAVE
    if (i.isButton() && i.customId === "save") {
        const state = panelState.get(i.user.id);

        if (!state?.player || !state?.kit || !state?.rank) {
            return i.reply({
                content: "Fill all fields first.",
                flags: MessageFlags.Ephemeral
            });
        }

        await i.deferUpdate();

        await setTier(state.player, state.kit, state.rank);

        return i.editReply(buildPanel(i.user.id, {
            message: `Saved ${state.player} → ${state.kit} = ${state.rank}`
        }));
    }

    // REMOVE
    if (i.isButton() && i.customId === "remove") {
        const state = panelState.get(i.user.id);

        if (!state?.player) {
            return i.reply({
                content: "Select a player first.",
                flags: MessageFlags.Ephemeral
            });
        }

        await i.deferUpdate();

        await removePlayer(state.player);

        panelState.set(i.user.id, {});

        return i.editReply(buildPanel(i.user.id, {
            message: `Removed ${state.player}`
        }));
    }
});

// =====================
// LOGIN
// =====================

client.login(TOKEN);
