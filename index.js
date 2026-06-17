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

// =====================
// CONFIG
// =====================

const BRAND = {
    name: "SonarMC",
    color: 0xff6a00,
    website: "https://your-tierlist-site.com"
};

const TIER_META = {
    HT1: { label: "HT1", emoji: "🔴", color: 0xff3b30, desc: "Highest Tier 1" },
    HT2: { label: "HT2", emoji: "🟠", color: 0xff6a00, desc: "High Tier 2" },
    HT3: { label: "HT3", emoji: "🟡", color: 0xffb300, desc: "High Tier 3" },
    LT1: { label: "LT1", emoji: "🟢", color: 0xcddc39, desc: "Low Tier 1" },
    LT2: { label: "LT2", emoji: "🔵", color: 0x00acc1, desc: "Low Tier 2" },
    LT3: { label: "LT3", emoji: "⚫", color: 0x555555, desc: "Low Tier 3" }
};

const KIT_META = {
    sword: { label: "Sword", emoji: "⚔️" },
    axe: { label: "Axe", emoji: "🪓" },
    spearMace: { label: "Spear / Mace", emoji: "🔱" },
    elytraMace: { label: "Elytra Mace", emoji: "🪽" },
    crystal: { label: "Crystal", emoji: "💎" }
};

const panelState = new Map();

// =====================
// HELPERS
// =====================

function getHead(name) {
    return `https://minotar.net/avatar/${encodeURIComponent(name)}/128`;
}

function tierLine(rank) {
    if (!rank) return "`UNTESTED`";
    const meta = TIER_META[rank];
    return meta ? `${meta.emoji} **${rank}**` : `\`${rank}\``;
}

async function fetchAllPlayers() {
    const res = await fetch(`${API_URL}/players`);
    if (!res.ok) throw new Error("Failed to fetch players");
    return res.json();
}

async function saveTier(player, kit, rank) {
    const res = await fetch(`${API_URL}/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player, kit, rank })
    });

    const json = await res.json().catch(() => null);
    if (!json?.success) {
        throw new Error(json?.error || "API rejected the update");
    }

    return json;
}

async function removePlayer(player) {
    const res = await fetch(`${API_URL}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player })
    });

    const json = await res.json().catch(() => null);
    if (!json?.success) {
        throw new Error(json?.error || "Failed to remove player");
    }

    return json;
}

function getPanelColor(state, status) {
    if (status?.type === "success") return 0x43a047;
    if (status?.type === "error") return 0xe53935;
    if (state?.rank && TIER_META[state.rank]) return TIER_META[state.rank].color;
    return BRAND.color;
}

function buildStatusBlock(status) {
    if (!status?.message) return null;

    const icons = { success: "✅", error: "❌", info: "ℹ️" };
    return `${icons[status.type] || "ℹ️"} ${status.message}`;
}

function buildCurrentRanksBlock(playerData) {
    if (!playerData) return null;

    const lines = Object.entries(KIT_META).map(([key, kit]) => {
        return `${kit.emoji} **${kit.label}** — ${tierLine(playerData[key])}`;
    });

    return lines.join("\n");
}

function buildPanel(userId, options = {}) {
    const state = panelState.get(userId) || {};
    const { status, playerData } = options;

    const playerName = state.player || null;
    const kit = state.kit ? KIT_META[state.kit] : null;
    const rank = state.rank ? TIER_META[state.rank] : null;

    const ready = Boolean(playerName && state.kit && state.rank);

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${BRAND.name} Tier Control`,
            iconURL: "https://minotar.net/avatar/MHF_Question/64"
        })
        .setTitle("Rank Management Panel")
        .setDescription(
            [
                "Set kit tiers for ranked players. Changes sync to the website instantly.",
                buildStatusBlock(status)
            ].filter(Boolean).join("\n\n")
        )
        .setColor(getPanelColor(state, status))
        .addFields(
            {
                name: "👤 Player",
                value: playerName ? `\`${playerName}\`` : "*No player selected*",
                inline: true
            },
            {
                name: "🎒 Kit",
                value: kit ? `${kit.emoji} ${kit.label}` : "*Select a kit*",
                inline: true
            },
            {
                name: "🏅 Tier",
                value: rank ? `${rank.emoji} **${rank.label}**` : "*Select a tier*",
                inline: true
            }
        )
        .setFooter({
            text: `${BRAND.name} Tier List • ${ready ? "Ready to save" : "Complete all fields to save"}`
        })
        .setTimestamp();

    if (playerName) {
        embed.setThumbnail(getHead(playerName));
    }

    const currentRanks = buildCurrentRanksBlock(playerData);
    if (currentRanks) {
        embed.addFields({
            name: "📋 Current Rankings",
            value: currentRanks
        });
    }

    const kitMenu = new StringSelectMenuBuilder()
        .setCustomId("kit")
        .setPlaceholder(state.kit ? `${KIT_META[state.kit].emoji} ${KIT_META[state.kit].label}` : "Choose a kit")
        .addOptions(
            Object.entries(KIT_META).map(([value, kit]) => ({
                label: kit.label,
                value,
                emoji: kit.emoji,
                default: state.kit === value
            }))
        );

    const rankMenu = new StringSelectMenuBuilder()
        .setCustomId("rank")
        .setPlaceholder(state.rank ? `${TIER_META[state.rank].emoji} ${state.rank}` : "Choose a tier")
        .addOptions(
            Object.entries(TIER_META).map(([value, tier]) => ({
                label: tier.label,
                description: tier.desc,
                value,
                emoji: tier.emoji,
                default: state.rank === value
            }))
        );

    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("set_player")
            .setLabel("Player")
            .setEmoji("👤")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("save")
            .setLabel("Save Tier")
            .setEmoji("💾")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!ready),

        new ButtonBuilder()
            .setCustomId("remove")
            .setLabel("Remove")
            .setEmoji("🗑️")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!playerName),

        new ButtonBuilder()
            .setCustomId("reset")
            .setLabel("Reset")
            .setEmoji("↩️")
            .setStyle(ButtonStyle.Secondary)
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

async function refreshPlayerData(userId) {
    const state = panelState.get(userId);
    if (!state?.player) return null;

    const players = await fetchAllPlayers();
    return players[state.player] || null;
}

async function renderPanel(userId, status = null) {
    let playerData = null;

    try {
        playerData = await refreshPlayerData(userId);
    } catch {
        // Keep panel usable even if API is slow/down
    }

    return buildPanel(userId, { status, playerData });
}

// =====================
// COMMANDS
// =====================

const commands = [
    new SlashCommandBuilder()
        .setName("tierpanel")
        .setDescription("Open the SonarMC tier management panel")
].map(cmd => cmd.toJSON());

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

client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isChatInputCommand() && interaction.commandName === "tierpanel") {
            panelState.set(interaction.user.id, {});

            return interaction.reply({
                ...(await renderPanel(interaction.user.id)),
                ephemeral: true
            });
        }

        if (interaction.isButton() && interaction.customId === "set_player") {
            const modal = new ModalBuilder()
                .setCustomId("player_modal")
                .setTitle("Set Player");

            const input = new TextInputBuilder()
                .setCustomId("player")
                .setLabel("Minecraft Username")
                .setPlaceholder("e.g. Notch")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(16);

            const state = panelState.get(interaction.user.id);
            if (state?.player) {
                input.setValue(state.player);
            }

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        if (interaction.type === InteractionType.ModalSubmit && interaction.customId === "player_modal") {
            const player = interaction.fields.getTextInputValue("player").trim();

            if (!player) {
                return interaction.update(
                    await renderPanel(interaction.user.id, {
                        type: "error",
                        message: "Player name cannot be empty."
                    })
                );
            }

            const state = panelState.get(interaction.user.id) || {};
            state.player = player;
            panelState.set(interaction.user.id, state);

            return interaction.update(
                await renderPanel(interaction.user.id, {
                    type: "info",
                    message: `Selected player **${player}**. Choose a kit and tier, then save.`
                })
            );
        }

        if (interaction.isStringSelectMenu() && interaction.customId === "kit") {
            const state = panelState.get(interaction.user.id) || {};
            state.kit = interaction.values[0];
            panelState.set(interaction.user.id, state);

            return interaction.update(await renderPanel(interaction.user.id));
        }

        if (interaction.isStringSelectMenu() && interaction.customId === "rank") {
            const state = panelState.get(interaction.user.id) || {};
            state.rank = interaction.values[0];
            panelState.set(interaction.user.id, state);

            return interaction.update(await renderPanel(interaction.user.id));
        }

        if (interaction.isButton() && interaction.customId === "reset") {
            panelState.set(interaction.user.id, {});

            return interaction.update(
                await renderPanel(interaction.user.id, {
                    type: "info",
                    message: "Panel reset."
                })
            );
        }

        if (interaction.isButton() && interaction.customId === "save") {
            const state = panelState.get(interaction.user.id);

            if (!state?.player || !state?.kit || !state?.rank) {
                return interaction.update(
                    await renderPanel(interaction.user.id, {
                        type: "error",
                        message: "Select a player, kit, and tier before saving."
                    })
                );
            }

            await interaction.deferUpdate();

            try {
                await saveTier(state.player, state.kit, state.rank);

                return interaction.editReply(
                    await renderPanel(interaction.user.id, {
                        type: "success",
                        message: `Saved **${state.player}** → ${KIT_META[state.kit].label} = **${state.rank}**`
                    })
                );
            } catch (err) {
                console.error(err);

                return interaction.editReply(
                    await renderPanel(interaction.user.id, {
                        type: "error",
                        message: err.message || "Could not save to the API."
                    })
                );
            }
        }

        if (interaction.isButton() && interaction.customId === "remove") {
            const state = panelState.get(interaction.user.id);

            if (!state?.player) {
                return interaction.update(
                    await renderPanel(interaction.user.id, {
                        type: "error",
                        message: "Select a player before removing."
                    })
                );
            }

            await interaction.deferUpdate();

            try {
                await removePlayer(state.player);
                panelState.set(interaction.user.id, {});

                return interaction.editReply(
                    await renderPanel(interaction.user.id, {
                        type: "success",
                        message: `Removed **${state.player}** from the tier list.`
                    })
                );
            } catch (err) {
                console.error(err);

                return interaction.editReply(
                    await renderPanel(interaction.user.id, {
                        type: "error",
                        message: err.message || "Could not remove player."
                    })
                );
            }
        }
    } catch (err) {
        console.error("Interaction error:", err);

        const payload = {
            content: "❌ Something went wrong. Run `/tierpanel` again.",
            ephemeral: true
        };

        if (interaction.deferred || interaction.replied) {
            return interaction.followUp(payload);
        }

        return interaction.reply(payload);
    }
});

client.login(TOKEN);
