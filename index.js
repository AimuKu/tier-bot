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
    InteractionType,
    MessageFlags
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_URL = process.env.API_URL || "https://tier-api.onrender.com";

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const panelState = new Map();

// =====================
// CONFIG
// =====================

const BRAND = {
    name: "SonarMC",
    color: 0xff6a00
};

const TIER_META = {
    HT1: { emoji: "🔴", color: 0xff3b30 },
    HT2: { emoji: "🟠", color: 0xff6a00 },
    HT3: { emoji: "🟡", color: 0xffb300 },
    LT1: { emoji: "🟢", color: 0xcddc39 },
    LT2: { emoji: "🔵", color: 0x00acc1 },
    LT3: { emoji: "⚫", color: 0x555555 }
};

const KIT_META = {
    sword: { label: "Sword", emoji: "⚔️" },
    axe: { label: "Axe", emoji: "🪓" },
    spearMace: { label: "Spear/Mace", emoji: "🔱" },
    elytraMace: { label: "Elytra", emoji: "🪽" },
    crystal: { label: "Crystal", emoji: "💎" }
};

// =====================
// API
// =====================

async function fetchPlayers() {
    const res = await fetch(`${API_URL}/players`);
    if (!res.ok) return {};
    return res.json();
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
// PANEL
// =====================

function buildPanel(userId, status) {
    const state = panelState.get(userId) || {};

    const ready = state.player && state.kit && state.rank;

    const embed = new EmbedBuilder()
        .setTitle("Tier Panel")
        .setColor(BRAND.color)
        .setDescription(status?.message || "Select a player, kit, and rank.");

    const row = new ActionRowBuilder().addComponents(
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
    );

    return { embeds: [embed], components: [row] };
}

// =====================
// COMMAND
// =====================

const commands = [
    new SlashCommandBuilder()
        .setName("tierpanel")
        .setDescription("Open panel")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered");
})();

// =====================
// READY FIX
// =====================

client.once("clientReady", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// =====================
// INTERACTIONS
// =====================

client.on("interactionCreate", async (i) => {

    if (i.isChatInputCommand() && i.commandName === "tierpanel") {
        panelState.set(i.user.id, {});
        return i.reply({
            ...buildPanel(i.user.id),
            flags: MessageFlags.Ephemeral
        });
    }

    if (i.isButton() && i.customId === "set_player") {
        const modal = new ModalBuilder()
            .setCustomId("player_modal")
            .setTitle("Player");

        const input = new TextInputBuilder()
            .setCustomId("player")
            .setLabel("Minecraft Name")
            .setStyle(TextInputStyle.Short);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return i.showModal(modal);
    }

    if (i.isModalSubmit()) {
        const player = i.fields.getTextInputValue("player");

        const state = panelState.get(i.user.id) || {};
        state.player = player;
        panelState.set(i.user.id, state);

        return i.update({
            ...buildPanel(i.user.id, { message: `Selected ${player}` })
        });
    }

    if (i.isButton() && i.customId === "save") {
        const state = panelState.get(i.user.id);

        await setTier(state.player, state.kit, state.rank);

        return i.update({
            ...buildPanel(i.user.id, { message: "Saved!" })
        });
    }

    if (i.isButton() && i.customId === "remove") {
        const state = panelState.get(i.user.id);

        await removePlayer(state.player);

        panelState.set(i.user.id, {});

        return i.update({
            ...buildPanel(i.user.id, { message: "Removed!" })
        });
    }
});

client.login(TOKEN);
