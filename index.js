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

const fetch = require("node-fetch"); // ✅ FIX

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_URL = process.env.API_URL || "https://tier-api.onrender.com";

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

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

const panelState = new Map();

// =====================
// HELPERS
// =====================
function getHead(name) {
    return `https://minotar.net/avatar/${encodeURIComponent(name)}/128`;
}

async function fetchPlayers() {
    const res = await fetch(`${API_URL}/players`);
    if (!res.ok) throw new Error("API failed");
    return res.json();
}

async function saveTier(player, kit, rank) {
    const res = await fetch(`${API_URL}/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, kit, rank })
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.error);
}

async function removePlayer(player) {
    const res = await fetch(`${API_URL}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player })
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.error);
}

// =====================
// PANEL BUILDER (simplified)
// =====================
function buildPanel(userId, players = {}, status = null) {

    const state = panelState.get(userId) || {};

    const embed = new EmbedBuilder()
        .setTitle("SonarMC Tier Panel")
        .setColor(BRAND.color)
        .setDescription(status ? status : "Manage player tiers");

    const kitMenu = new StringSelectMenuBuilder()
        .setCustomId("kit")
        .setPlaceholder("Select kit")
        .addOptions(Object.entries(KIT_META).map(([v, k]) => ({
            label: k.label,
            value: v,
            emoji: k.emoji
        })));

    const rankMenu = new StringSelectMenuBuilder()
        .setCustomId("rank")
        .setPlaceholder("Select tier")
        .addOptions(Object.entries(TIER_META).map(([v, t]) => ({
            label: v,
            value: v,
            emoji: t.emoji
        })));

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("set_player")
            .setLabel("Player")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("save")
            .setLabel("Save")
            .setStyle(ButtonStyle.Success)
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
    console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (i) => {
    try {

        if (i.isChatInputCommand()) {
            if (i.commandName === "tierpanel") {
                panelState.set(i.user.id, {});
                return i.reply({ ...(buildPanel(i.user.id)), ephemeral: true });
            }
        }

    } catch (err) {
        console.error(err);
    }
});

client.login(TOKEN);
