import "dotenv/config";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import cors from "cors";
import express from "express";
import multer from "multer";
import sharp from "sharp";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  GatewayIntentBits,
  type Message,
  ModalBuilder,
  type ModalSubmitInteraction,
  type NewsChannel,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  type TextChannel,
  type ThreadChannel,
  TextInputBuilder,
  TextInputStyle,
  type User,
} from "discord.js";
import {
  buildArtworkAnnouncementEmbed,
  buildArtworkReportButtons,
  buildArtworkReportEmbed,
  buildCommunityAnnouncementsRoleEmbed,
  isCommunityAnnouncementsReaction,
  isSupportedArtworkChannelType,
  parseArtworkReportCustomId,
} from "./artwork-report-discord.js";
import {
  buildCommandDefinitions,
  publicGlobalCommandNames,
} from "./slash-commands.js";
import {
  greetingEmojiNames,
  pickRandomGreeting,
  pickRandomGreetingEmoji,
} from "./greetings.js";
import {
  CoverContributionError,
  createExplicitCoverSong,
  DEFAULT_COVER_MAX_BYTES,
  DEFAULT_COVER_MIN_DIMENSION,
  isPngAttachment,
  normalizeCatalogValue,
  validatePngBuffer,
} from "./cover-contributions.js";
import {
  CommunityArtistMediaAlreadyApprovedError,
  CommunityCoverAlreadyApprovedError,
  closeSubmissionStore,
  completeDiscordAuthRequest,
  createDiscordAuthRequest,
  createMaintenanceEvent,
  deleteAllCommunityTtmlsWithBackup,
  deleteCommunityTtmlsWithBackup,
  endMaintenanceEvent,
  findCommunityTtmls,
  findCatalogSongsExact,
  getCommunityCover,
  getCommunityCoverImage,
  getCommunityCoversBatch,
  getCommunityArtistMedia,
  getCommunityArtistMediaImage,
  getMaintenanceSnapshot,
  getApprovedSubmission,
  getApprovedSubmissionsBySubmitter,
  getTtmlPlayCounts,
  getDiscordAuthRequest,
  getDiscordProfile,
  getDiscordSession,
  getDailyWebStats,
  getPendingSubmissions,
  getSubmission,
  initializeSubmissionStore,
  isDatabaseEnabled,
  isCoverThreadApproved,
  isArtistMediaThreadApproved,
  saveSubmission,
  recordDailyWebVisit,
  recordTtmlPlay,
  saveCommunityCover,
  saveCommunityArtistMedia,
  restoreLatestCommunityTtmlBackup,
  acknowledgeMaintenanceNotice,
  type DiscordIdentity,
  type CommunityCover,
  type CommunityArtistMedia,
  type ArtistMediaKind,
  type ArtistReference,
  type MaintenanceType,
  type SongPayload,
  type TTMLSubmission,
  updateDiscordBiography,
} from "./submission-store.js";
import {
  ArtworkReportAlreadyReviewedError,
  ArtworkReportDuplicateError,
  ArtworkReportNotFoundError,
  ArtworkReportPermissionError,
  ArtworkReportRateLimitError,
  ArtworkReportValidationError,
  closeArtworkReportStore,
  createArtworkReport,
  getArtworkReport,
  getArtworkReportStatus,
  getSongArtworkMapping,
  initializeArtworkReportStore,
  listArtworkReports,
  listArtworkReportsForDiscordRecovery,
  lookupAppleTrack,
  reviewArtworkReport,
  setArtworkReportDiscordMessage,
  setArtworkReportPublicMessage,
  type ArtworkReport,
  type ArtworkReportStatus,
  type SongArtworkMapping,
} from "./artwork-reports.js";

const token = process.env.DISCORD_TOKEN;
const reviewChannelId = process.env.DISCORD_REVIEW_CHANNEL_ID;
const reportsChannelId = process.env.DISCORD_REPORTS_CHANNEL_ID;
const publicCoversChannelId =
  process.env.DISCORD_PUBLIC_COVERS_CHANNEL_ID;
const communityAnnouncementsChannelId =
  process.env.DISCORD_COMMUNITY_ANNOUNCEMENTS_CHANNEL_ID;
const communityAnnouncementsRoleId =
  process.env.DISCORD_COMMUNITY_ANNOUNCEMENTS_ROLE_ID;
const communityAnnouncementsEmojiId =
  process.env.DISCORD_COMMUNITY_ANNOUNCEMENTS_EMOJI_ID;
const port = Number(process.env.PORT ?? 8787);
const discordClientId = process.env.DISCORD_CLIENT_ID;
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
const discordGuildId = process.env.DISCORD_GUILD_ID;
const discordOwnerUserId = process.env.DISCORD_OWNER_USER_ID;
const discordStatsOwnerUserId =
  process.env.DISCORD_STATS_OWNER_USER_ID ||
  discordOwnerUserId ||
  "1122741122511421471";
const discordCreatorRoleId = process.env.DISCORD_CREATOR_ROLE_ID;
const coverReviewerRoleId =
  process.env.DISCORD_COVER_REVIEWER_ROLE_ID || "1528273148687159380";
const coverCreatorRoleId =
  process.env.DISCORD_COVER_CREATOR_ROLE_ID || "1518914345583771768";
const coverForumId =
  process.env.DISCORD_COVER_FORUM_ID || "1528281546807840778";
const artistMediaForumId =
  process.env.DISCORD_ARTIST_MEDIA_FORUM_ID || "1530744217893339316";
const coverMinDimension = Math.max(
  1,
  Number(process.env.CLOUD_COVER_MIN_DIMENSION) ||
    DEFAULT_COVER_MIN_DIMENSION,
);
const coverMaxBytes = Math.max(
  1024,
  Number(process.env.CLOUD_COVER_MAX_BYTES) || DEFAULT_COVER_MAX_BYTES,
);
const publicBaseUrl = (
  process.env.PUBLIC_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`)
).replace(/\/+$/, "");
const discordRedirectUri =
  process.env.DISCORD_REDIRECT_URI ||
  `${publicBaseUrl}/api/auth/discord/callback`;
const analyticsTimeZone =
  process.env.ANALYTICS_TIME_ZONE || "America/Mexico_City";
const analyticsHashSecret =
  process.env.ANALYTICS_HASH_SECRET || token || "local-development";
let slashCommandsRegistered = false;
let backendBootstrapReady = false;
let backendBootstrapError: string | null = null;
let backendBootstrapTimer: NodeJS.Timeout | undefined;
let backendBootstrapRunning = false;
let previousGreetingIndex: number | undefined;
let previousGreetingEmojiName: string | undefined;
const configuredOrigins = (
  process.env.CLOUD_APP_ORIGINS ??
  process.env.CLOUD_APP_ORIGIN ??
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:1420",
  "http://127.0.0.1",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:1420",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
  "https://slourzz.github.io",
  ...configuredOrigins,
]);

function isAllowedOrigin(origin: string | undefined) {
  if (!origin || allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

if (!token) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

if (!reviewChannelId) {
  throw new Error("Missing DISCORD_REVIEW_CHANNEL_ID in .env");
}

if (!reportsChannelId) {
  throw new Error("Missing DISCORD_REPORTS_CHANNEL_ID in .env");
}

if (!publicCoversChannelId) {
  throw new Error("Missing DISCORD_PUBLIC_COVERS_CHANNEL_ID in .env");
}

if (!communityAnnouncementsChannelId) {
  throw new Error(
    "Missing DISCORD_COMMUNITY_ANNOUNCEMENTS_CHANNEL_ID in .env",
  );
}

if (!communityAnnouncementsRoleId) {
  throw new Error(
    "Missing DISCORD_COMMUNITY_ANNOUNCEMENTS_ROLE_ID in .env",
  );
}

if (!communityAnnouncementsEmojiId) {
  throw new Error(
    "Missing DISCORD_COMMUNITY_ANNOUNCEMENTS_EMOJI_ID in .env",
  );
}

const discordToken = token;
const discordReviewChannelId = reviewChannelId;
const discordReportsChannelId = reportsChannelId;
const discordPublicCoversChannelId = publicCoversChannelId;
const discordCommunityAnnouncementsChannelId =
  communityAnnouncementsChannelId;
const discordCommunityAnnouncementsRoleId =
  communityAnnouncementsRoleId;
const discordCommunityAnnouncementsEmojiId =
  communityAnnouncementsEmojiId;
const interactionNamespace = (
  process.env.DISCORD_INTERACTION_NAMESPACE ??
  process.env.RAILWAY_SERVICE_ID ??
  process.env.RAILWAY_PROJECT_ID ??
  "local"
)
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(-20);
const interactionPrefix = `railwayreview:${interactionNamespace}:`;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
  ],
});

const pendingDeleteConfirmations = new Map<
  string,
  {
    actor: DiscordIdentity;
    expiresAt: number;
  }
>();
const pendingSpecificDeleteConfirmations = new Map<
  string,
  {
    actor: DiscordIdentity;
    artist: string;
    title: string;
    expiresAt: number;
  }
>();
const pendingCoverSelections = new Map<
  string,
  {
    moderatorId: string;
    threadId: string;
    songs: SongPayload[];
    expiresAt: number;
  }
>();
const pendingArtistMediaSelections = new Map<
  string,
  {
    moderatorId: string;
    threadId: string;
    kind: ArtistMediaKind;
    artists: ArtistReference[];
    expiresAt: number;
  }
>();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  }),
);
app.use(express.json());

function hashSessionToken(tokenValue: string) {
  return createHash("sha256").update(tokenValue).digest("hex");
}

function getAnalyticsDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: analyticsTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function hashDailyVisitor(day: string, visitorId: string) {
  return createHmac("sha256", analyticsHashSecret)
    .update(`${day}:${visitorId}`)
    .digest("hex");
}

function getBearerToken(authorization: string | undefined) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

async function getAuthenticatedDiscordUser(
  authorization: string | undefined,
) {
  const sessionToken = getBearerToken(authorization);
  if (!sessionToken) return undefined;
  return getDiscordSession(hashSessionToken(sessionToken));
}

async function canModerateArtwork(userId: string) {
  if (discordOwnerUserId && userId === discordOwnerUserId) return true;
  if (!client.isReady()) return false;
  const guild =
    (discordGuildId
      ? client.guilds.cache.get(discordGuildId)
      : undefined) ?? client.guilds.cache.first();
  if (!guild) return false;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  return (
    member.roles.cache.has(coverReviewerRoleId) ||
    member.roles.cache.has(coverCreatorRoleId)
  );
}

function getDiscordAvatarUrl(user: {
  id: string;
  avatar?: string | null;
}) {
  if (!user.avatar) return undefined;
  const extension = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderOAuthResult(title: string, message: string, success: boolean) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const deepLink = "cloud://discord-connected";
  const action = success
    ? `<a class="open-cloud" href="${deepLink}">Abrir Cloud</a>
      <p class="hint">Si Cloud no se abre automaticamente, usa el boton.</p>`
    : `<p class="hint">Puedes cerrar esta ventana e intentarlo de nuevo desde Cloud.</p>`;
  const autoOpen = success
    ? `<script>
      window.addEventListener("load", () => {
        if (window.opener) {
          window.opener.postMessage({ type: "cloud-discord-auth-complete" }, "*");
          window.close();
          return;
        }
        window.setTimeout(() => {
          window.location.href = "${deepLink}";
        }, 250);
      });
    </script>`
    : "";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${safeTitle}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #101014;
        color: #fff;
        font: 16px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(480px, calc(100vw - 40px));
        text-align: center;
        animation: appear .45s ease-out both;
      }
      h1 {
        margin: 0 0 10px;
        color: #fff;
        font-size: clamp(1.9rem, 5vw, 2.45rem);
        letter-spacing: 0;
      }
      p {
        margin: 0;
        color: rgba(255,255,255,.82);
      }
      .open-cloud {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 150px;
        min-height: 46px;
        margin-top: 28px;
        padding: 0 22px;
        border-radius: 8px;
        background: #fff;
        color: #111114;
        font-weight: 750;
        text-decoration: none;
        transition: transform .18s ease, opacity .18s ease;
      }
      .open-cloud:hover { transform: translateY(-2px); }
      .open-cloud:active { transform: translateY(0); opacity: .86; }
      .hint {
        margin-top: 14px;
        color: rgba(255,255,255,.58);
        font-size: .86rem;
      }
      @keyframes appear {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        main { animation: none; }
        .open-cloud { transition: none; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      ${action}
    </main>
    ${autoOpen}
  </body>
</html>`;
}

function createSubmissionId() {
  return `ttml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createMaintenanceId(type: MaintenanceType) {
  return `maintenance_${type}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createDeleteConfirmationId() {
  return `delete_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

function discordIdentityFromInteraction(
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction
    | StringSelectMenuInteraction,
): DiscordIdentity {
  return {
    id: interaction.user.id,
    username: interaction.user.username,
    displayName: interaction.user.globalName ?? interaction.user.username,
    avatarUrl: getDiscordAvatarUrl({
      id: interaction.user.id,
      avatar: interaction.user.avatar,
    }),
  };
}

function discordIdentityFromUser(user: User): DiscordIdentity {
  return {
    id: user.id,
    username: user.username,
    displayName: user.globalName ?? user.username,
    avatarUrl: getDiscordAvatarUrl({ id: user.id, avatar: user.avatar }),
  };
}

function interactionRoleIds(
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction
    | StringSelectMenuInteraction,
) {
  const roles = interaction.member?.roles;
  if (!roles) return [];
  if (Array.isArray(roles)) return roles;
  if ("cache" in roles) return [...roles.cache.keys()];
  return [];
}

function canManageMaintenance(
  interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
) {
  if (discordOwnerUserId && interaction.user.id === discordOwnerUserId) {
    return true;
  }

  if (discordCreatorRoleId) {
    return interactionRoleIds(interaction).includes(discordCreatorRoleId);
  }

  return false;
}

function canManageCover(
  interaction:
    | ChatInputCommandInteraction
    | StringSelectMenuInteraction,
) {
  const roles = interactionRoleIds(interaction);
  return (
    roles.includes(coverReviewerRoleId) || roles.includes(coverCreatorRoleId)
  );
}

async function getContributionThread(
  interaction:
    | ChatInputCommandInteraction
    | StringSelectMenuInteraction,
) {
  const channel =
    interaction.channel ??
    (await client.channels.fetch(interaction.channelId).catch(() => null));
  if (!channel?.isThread() || channel.parentId !== coverForumId) return undefined;
  return channel as ThreadChannel;
}

async function getArtistMediaContributionThread(
  interaction:
    | ChatInputCommandInteraction
    | StringSelectMenuInteraction,
) {
  const channel =
    interaction.channel ??
    (await client.channels.fetch(interaction.channelId).catch(() => null));
  if (!channel?.isThread() || channel.parentId !== artistMediaForumId) {
    return undefined;
  }
  return channel as ThreadChannel;
}

function formatMaintenanceEvent(event: {
  id: string;
  status: string;
  startsAtUtc: string;
  endsAtUtc: string;
  reason?: string;
}) {
  return [
    `ID: ${event.id}`,
    `Estado: ${event.status}`,
    `Inicio UTC: ${event.startsAtUtc}`,
    `Fin UTC: ${event.endsAtUtc}`,
    `Razon: ${event.reason || "Sin razon"}`,
  ].join("\n");
}

async function handleDailyStatsCommand(
  interaction: ChatInputCommandInteraction,
) {
  if (interaction.user.id !== discordStatsOwnerUserId) {
    await interaction.reply({
      content: "Este comando es privado.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const stats = await getDailyWebStats(14);
  const today = getAnalyticsDay();
  const todayStats = stats.find((entry) => entry.day === today);
  const rows = stats.length
    ? stats.map(
        (entry) =>
          `${entry.day}  ${String(entry.visitors).padStart(8)}  ${String(entry.pageViews).padStart(7)}`,
      )
    : ["Aun no hay visitas registradas."];

  await interaction.editReply([
    "**Estadisticas privadas de Cloud**",
    `Hoy (${today}, ${analyticsTimeZone}): **${todayStats?.visitors ?? 0}** visitantes unicos y **${todayStats?.pageViews ?? 0}** vistas.`,
    "",
    "```text",
    "Fecha       Visitantes   Vistas",
    ...rows,
    "```",
    "Los visitantes son navegadores unicos aproximados; no se guardan IP ni datos personales.",
  ].join("\n"));
}

function parseMaintenanceTiming(interaction: ChatInputCommandInteraction) {
  const startsInHours = interaction.options.getNumber("starts_in_hours") ?? 0;
  const startsInMinutes = interaction.options.getNumber("starts_in_minutes") ?? 0;
  const durationDays = interaction.options.getNumber("duration_days") ?? 0;
  const durationHours = interaction.options.getNumber("duration_hours") ?? 0;
  const durationMinutes = interaction.options.getNumber("duration_minutes") ?? 0;
  const hasExplicitDuration =
    interaction.options.getNumber("duration_days") !== null ||
    interaction.options.getNumber("duration_hours") !== null ||
    interaction.options.getNumber("duration_minutes") !== null;

  const startDelayMs =
    startsInHours * 60 * 60 * 1000 + startsInMinutes * 60 * 1000;
  const durationMs = hasExplicitDuration
    ? durationDays * 24 * 60 * 60 * 1000 +
      durationHours * 60 * 60 * 1000 +
      durationMinutes * 60 * 1000
    : 60 * 60 * 1000;

  if (startDelayMs < 0) {
    throw new Error("El inicio no puede estar en negativo.");
  }

  if (durationMs <= 0) {
    throw new Error(
      "La duracion debe ser mayor a 0. Si solo quieres programarlo, puedes poner starts_in_minutes sin duration.",
    );
  }

  const startsAt = new Date(Date.now() + startDelayMs);
  const endsAt = new Date(startsAt.getTime() + durationMs);

  return {
    startsAtUtc: startsAt.toISOString(),
    endsAtUtc: endsAt.toISOString(),
  };
}

async function registerSlashCommands() {
  if (slashCommandsRegistered) return;

  const resolvedGuildId =
    discordGuildId ||
    (client.isReady()
      ? client.guilds.cache.find(
          (guild) =>
            guild.channels.cache.has(coverForumId) ||
            guild.channels.cache.has(artistMediaForumId),
        )?.id
      : undefined);

  console.log(
    `Cloud slash command bootstrap: clientId=${discordClientId ? "yes" : "no"} guildId=${resolvedGuildId || (client.isReady() ? "global" : "pending-ready")}`,
  );

  if (!discordClientId) {
    console.warn("DISCORD_CLIENT_ID is not configured. Slash commands skipped.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(discordToken);
  // Song cover uploads were retired. Artist avatar/banner contributions remain.
  const definitions = buildCommandDefinitions().filter(
    (command) => command.name !== "cover",
  );
  const publicGlobalCommands = definitions.filter((command) =>
    publicGlobalCommandNames.has(command.name),
  );
  const serverCommands = definitions.filter(
    (command) => !publicGlobalCommandNames.has(command.name),
  );
  console.log(
    `Cloud slash commands registering: ${definitions
      .map((command) => command.name)
      .join(", ")}`,
  );
  if (!resolvedGuildId && !client.isReady()) {
    console.log(
      "Slash command registration deferred until Discord is ready so the contribution forum guild can be detected.",
    );
    return;
  }

  if (resolvedGuildId) {
    await rest.put(Routes.applicationCommands(discordClientId), {
      body: publicGlobalCommands,
    });
    const registeredCommands = (await rest.put(
      Routes.applicationGuildCommands(discordClientId, resolvedGuildId),
      { body: serverCommands },
    )) as Array<{ id: string; name: string }>;
    for (const commandName of ["app", "abp"]) {
      const restrictedCommand = registeredCommands.find(
        (command) => command.name === commandName,
      );
      if (!restrictedCommand) {
        throw new Error(
          `Discord did not return the /${commandName} command registration.`,
        );
      }
      await rest
        .put(
          Routes.applicationCommandPermissions(
            discordClientId,
            resolvedGuildId,
            restrictedCommand.id,
          ),
          {
            body: {
              permissions: [
                { id: coverReviewerRoleId, type: 1, permission: true },
                { id: coverCreatorRoleId, type: 1, permission: true },
              ],
            },
          },
        )
        .catch((error) => {
          // Discord may reject role permission updates made with a bot token.
          // The handlers still enforce the exact role IDs and forum at runtime,
          // so command registration must not be rolled back or left invisible.
          console.warn(
            `Could not restrict /${commandName} visibility by role; runtime permissions remain active:`,
            error,
          );
        });
    }
    const dailyCommand = registeredCommands.find(
      (command) => command.name === "daily",
    );
    if (!dailyCommand) {
      throw new Error("Discord did not return the /daily command registration.");
    }
    await rest
      .put(
        Routes.applicationCommandPermissions(
          discordClientId,
          resolvedGuildId,
          dailyCommand.id,
        ),
        {
          body: {
            permissions: [
              { id: resolvedGuildId, type: 1, permission: false },
              { id: discordStatsOwnerUserId, type: 2, permission: true },
            ],
          },
        },
      )
      .catch((error) => {
        console.warn(
          "Could not apply Discord visibility permissions for /daily; default and runtime owner checks remain active:",
          error,
        );
      });
    console.log(
      `Cloud public global slash commands registered: ${publicGlobalCommands
        .map((command) => command.name)
        .join(", ")}`,
    );
    console.log(
      `Cloud slash commands registered for guild ${resolvedGuildId}: ${serverCommands
        .map((command) => command.name)
        .join(", ")}`,
    );
  } else {
    await rest.put(Routes.applicationCommands(discordClientId), {
      body: definitions,
    });
    console.log(
      `Cloud slash commands registered globally: ${definitions
        .map((command) => command.name)
        .join(", ")}. Runtime role and forum checks remain active for /app and /abp.`,
    );
  }

  slashCommandsRegistered = true;
}

function formatDuration(duration?: number) {
  if (!duration || Number.isNaN(duration)) return "Desconocida";
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseSongPayload(raw: unknown): SongPayload {
  if (typeof raw !== "string") {
    throw new Error("Missing song payload");
  }

  const parsed = JSON.parse(raw) as Partial<SongPayload>;

  if (!parsed.id || !parsed.title || !parsed.artist) {
    throw new Error("Song payload requires id, title and artist");
  }

  return {
    id: parsed.id,
    title: parsed.title,
    artist: parsed.artist,
    album: parsed.album,
    duration: parsed.duration,
    coverUrl: parsed.coverUrl,
    audioUrl: parsed.audioUrl,
    submittedAt: parsed.submittedAt,
  };
}

type CoverAttachmentCandidate = {
  id: string;
  url: string;
  name: string;
  contentType?: string | null;
  size: number;
  message: Message;
};

type ItunesSongResult = {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  trackViewUrl?: string;
  releaseDate?: string;
  trackExplicitness?: string;
  isrc?: string;
  previewUrl?: string;
  kind?: string;
  wrapperType?: string;
};

const itunesCatalogCache = new Map<
  string,
  { expiresAt: number; songs: SongPayload[] }
>();
const appleArtworkCache = new Map<
  string,
  { expiresAt: number; results: ItunesSongResult[] }
>();

async function searchAppleArtworkCatalog(title: string, artist: string) {
  const cacheKey = normalizeCatalogValue(`${title}\u0000${artist}`);
  const cached = appleArtworkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", `${title} ${artist}`.trim());
  url.searchParams.set("country", "MX");
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "10");
  url.searchParams.set("explicit", "Yes");

  const request = () =>
    fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        "User-Agent": "Cloud/2.5.9 AppleArtworkCatalog",
      },
    });
  let response = await request();
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    response = await request();
  }
  if (!response.ok) {
    throw new Error(`itunes_artwork_http_${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: ItunesSongResult[];
  };
  const results = (payload.results ?? [])
    .filter(
      (item) =>
        typeof item.trackId === "number" &&
        typeof item.trackName === "string" &&
        typeof item.artistName === "string" &&
        typeof item.collectionName === "string" &&
        typeof item.artworkUrl100 === "string" &&
        typeof item.trackViewUrl === "string" &&
        (item.kind === undefined || item.kind === "song"),
    )
    .slice(0, 10);

  appleArtworkCache.set(cacheKey, {
    expiresAt: Date.now() + 30 * 60 * 1000,
    results,
  });
  return results;
}

function dedupeCatalogSongs(songs: SongPayload[]) {
  const unique: SongPayload[] = [];
  for (const song of songs) {
    const duplicate = unique.find(
      (candidate) =>
        normalizeCatalogValue(candidate.artist) ===
          normalizeCatalogValue(song.artist) &&
        normalizeCatalogValue(candidate.title) ===
          normalizeCatalogValue(song.title) &&
        (!candidate.album ||
          !song.album ||
          normalizeCatalogValue(candidate.album) ===
            normalizeCatalogValue(song.album)) &&
        (!candidate.duration ||
          !song.duration ||
          Math.abs(candidate.duration - song.duration) <= 5),
    );
    if (!duplicate) unique.push(song);
  }
  return unique;
}

async function searchItunesCatalog(query: string) {
  const normalizedQuery = normalizeCatalogValue(query);
  const cached = itunesCatalogCache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) return cached.songs;

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("entity", "song");
  url.searchParams.set("media", "music");
  url.searchParams.set("limit", "25");
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return [];

  const data = (await response.json()) as { results?: ItunesSongResult[] };
  const songs = (data.results ?? [])
    .filter(
      (item) =>
        typeof item.trackName === "string" &&
        typeof item.artistName === "string" &&
        (item.kind === undefined || item.kind === "song"),
    )
    .map<SongPayload>((item) => ({
      id: `itunes:${item.trackId ?? `${item.artistName}:${item.trackName}`}`,
      title: item.trackName!,
      artist: item.artistName!,
      album: item.collectionName,
      duration: item.trackTimeMillis
        ? Math.round(item.trackTimeMillis / 1000)
        : undefined,
      coverUrl: item.artworkUrl100?.replace("100x100bb", "1200x1200bb"),
      audioUrl: item.previewUrl,
    }));
  itunesCatalogCache.set(normalizedQuery, {
    expiresAt: Date.now() + 10 * 60 * 1000,
    songs,
  });
  return songs;
}

type ItunesArtistResult = {
  artistId?: number;
  artistName?: string;
  artistLinkUrl?: string;
  primaryGenreName?: string;
  wrapperType?: string;
  artistType?: string;
};

const itunesArtistCache = new Map<
  string,
  { expiresAt: number; artists: ArtistReference[] }
>();

async function searchArtistProfiles(query: string) {
  const normalizedQuery = normalizeCatalogValue(query);
  const cached = itunesArtistCache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) return cached.artists;

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("entity", "musicArtist");
  url.searchParams.set("attribute", "artistTerm");
  url.searchParams.set("limit", "25");
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return [];

  const data = (await response.json()) as { results?: ItunesArtistResult[] };
  const unique = new Map<string, ArtistReference>();
  for (const item of data.results ?? []) {
    if (!item.artistId || !item.artistName) continue;
    const artist: ArtistReference = {
      id: `itunes:${item.artistId}`,
      name: item.artistName,
      referenceUrl:
        item.artistLinkUrl ||
        `https://music.apple.com/search?term=${encodeURIComponent(item.artistName)}`,
      provider: "Apple Music",
      genre: item.primaryGenreName,
    };
    unique.set(artist.id, artist);
  }

  const artists = [...unique.values()].sort((left, right) => {
    const leftExact = normalizeCatalogValue(left.name) === normalizedQuery ? 0 : 1;
    const rightExact = normalizeCatalogValue(right.name) === normalizedQuery ? 0 : 1;
    return leftExact - rightExact || left.name.localeCompare(right.name);
  });
  itunesArtistCache.set(normalizedQuery, {
    expiresAt: Date.now() + 10 * 60 * 1000,
    artists,
  });
  return artists;
}

async function findExactCatalogSongs(artist: string, title: string) {
  const databaseMatches = await findCatalogSongsExact(artist, title);
  const internetMatches = (await searchItunesCatalog(`${title} ${artist}`)).filter(
    (song) =>
      normalizeCatalogValue(song.artist) === normalizeCatalogValue(artist) &&
      normalizeCatalogValue(song.title) === normalizeCatalogValue(title),
  );
  return dedupeCatalogSongs([...databaseMatches, ...internetMatches]);
}

function isImageAttachment(candidate: {
  name?: string | null;
  contentType?: string | null;
}) {
  return (
    candidate.contentType?.toLocaleLowerCase().startsWith("image/") === true ||
    /\.(?:png|jpe?g|webp|gif|avif)$/i.test(candidate.name ?? "")
  );
}

async function findLatestCoverAttachment(thread: ThreadChannel) {
  const starterMessage = await thread.fetchStarterMessage().catch(() => null);
  const originalAuthorId = thread.ownerId ?? starterMessage?.author.id;
  const candidates: CoverAttachmentCandidate[] = [];
  let before: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const messages = await thread.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });
    if (messages.size === 0) break;

    for (const message of messages.values()) {
      for (const attachment of message.attachments.values()) {
        if (!isImageAttachment(attachment)) continue;
        candidates.push({
          id: attachment.id,
          url: attachment.url,
          name: attachment.name || `${attachment.id}.png`,
          contentType: attachment.contentType,
          size: attachment.size,
          message,
        });
      }
    }

    const oldest = [...messages.values()].sort(
      (left, right) => left.createdTimestamp - right.createdTimestamp,
    )[0];
    before = oldest?.id;
    if (messages.size < 100 || !before) break;
  }

  candidates.sort(
    (left, right) => right.message.createdTimestamp - left.message.createdTimestamp,
  );
  return (
    candidates.find(
      (candidate) => candidate.message.author.id === originalAuthorId,
    ) ?? candidates[0]
  );
}

async function downloadAndValidateCover(attachment: CoverAttachmentCandidate) {
  if (!isPngAttachment(attachment)) {
    throw new CoverContributionError(
      "INVALID_IMAGE_TYPE",
      "La imagen mas reciente no es PNG. Adjunta un archivo .png y vuelve a intentarlo.",
    );
  }
  if (attachment.size > coverMaxBytes) {
    throw new CoverContributionError(
      "IMAGE_TOO_LARGE",
      `La imagen supera el limite de ${Math.floor(coverMaxBytes / 1024 / 1024)} MB.`,
    );
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cloud-cover-"));
  const temporaryPath = join(temporaryDirectory, "cover.png");
  try {
    const response = await fetch(attachment.url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new CoverContributionError(
        "CLOUD_REJECTED",
        "Discord no permitio descargar la imagen. No se actualizo ninguna portada.",
      );
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > coverMaxBytes) {
      throw new CoverContributionError(
        "IMAGE_TOO_LARGE",
        `La imagen supera el limite de ${Math.floor(coverMaxBytes / 1024 / 1024)} MB.`,
      );
    }

    const downloaded = Buffer.from(await response.arrayBuffer());
    await writeFile(temporaryPath, downloaded);
    const pngData = await readFile(temporaryPath);
    const dimensions = validatePngBuffer(pngData, {
      minDimension: coverMinDimension,
      maxBytes: coverMaxBytes,
    });
    return {
      pngData,
      ...dimensions,
      sha256: createHash("sha256").update(pngData).digest("hex"),
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

async function processCoverUpload(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  thread: ThreadChannel,
  song: SongPayload,
) {
  if (await isCoverThreadApproved(thread.id)) {
    throw new CommunityCoverAlreadyApprovedError();
  }

  const attachment = await findLatestCoverAttachment(thread);
  if (!attachment) {
    throw new CoverContributionError(
      "NO_IMAGE",
      "No se encontro ninguna imagen adjunta dentro del hilo.",
    );
  }

  const validated = await downloadAndValidateCover(attachment);
  const moderator = discordIdentityFromInteraction(interaction);
  const starterMessage = await thread.fetchStarterMessage().catch(() => null);
  const submitter = discordIdentityFromUser(
    starterMessage?.author ?? attachment.message.author,
  );
  const cover = await saveCommunityCover({
    id: `cover_${Date.now()}_${randomBytes(4).toString("hex")}`,
    song,
    pngData: validated.pngData,
    width: validated.width,
    height: validated.height,
    sha256: validated.sha256,
    originalFileName: attachment.name,
    discordAttachmentId: attachment.id,
    threadId: thread.id,
    forumId: coverForumId,
    submitter,
    moderator,
  });

  await interaction.editReply({
    content: `Portada aprobada: **${song.title}** de **${song.artist}** (${cover.width}x${cover.height}).`,
    components: [],
  });
  await thread
    .send(
      `<@${submitter.id}>, tu portada fue aceptada por <@${moderator.id}>, quien subio la portada a Cloud.`,
    )
    .catch((error) => {
      console.error("Cover saved but confirmation message failed:", error);
    });
}

async function promptCoverSelection(
  interaction: ChatInputCommandInteraction,
  thread: ThreadChannel,
  songs: SongPayload[],
  exact: boolean,
) {
  const token = randomBytes(8).toString("hex");
  pendingCoverSelections.set(token, {
    moderatorId: interaction.user.id,
    threadId: thread.id,
    songs: songs.slice(0, 25),
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${interactionPrefix}cover-select:${token}`)
    .setPlaceholder("Selecciona la cancion correcta")
    .addOptions(
      songs.slice(0, 25).map((song, index) => ({
        label: song.title.slice(0, 100),
        description: `${song.artist}${song.album ? ` - ${song.album}` : ""}`.slice(
          0,
          100,
        ),
        value: String(index),
      })),
    );

  await interaction.editReply({
    content: exact
      ? "Hay varias canciones coincidentes. Selecciona la correcta; no se actualizo ninguna portada."
      : "No hubo una coincidencia exacta. Selecciona la cancion correcta o corrige artista y cancion en el comando; no se actualizo ninguna portada.",
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    ],
  });
}

async function sendCoverError(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  error: unknown,
) {
  let content: string;
  if (error instanceof CommunityCoverAlreadyApprovedError) {
    content = "Esta contribucion ya fue aprobada. No se actualizo ninguna portada.";
  } else if (error instanceof CoverContributionError) {
    content = error.message;
  } else {
    console.error("Cover contribution failed:", error);
    content =
      "El servidor de Cloud rechazo la subida. No se actualizo ninguna portada.";
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content, components: [] });
  } else {
    await interaction.reply({ content, ephemeral: true });
  }
}

async function handleCoverUploadCommand(
  interaction: ChatInputCommandInteraction,
) {
  if (!canManageCover(interaction)) {
    await interaction.reply({
      content: "No tienes permisos para aprobar portadas.",
      ephemeral: true,
    });
    return;
  }

  const thread = await getContributionThread(interaction);
  if (!thread) {
    await interaction.reply({
      content:
        "Este comando solo funciona dentro de un hilo del foro de contribuciones.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    if (await isCoverThreadApproved(thread.id)) {
      throw new CommunityCoverAlreadyApprovedError();
    }
    const artist = interaction.options.getString("artista", true).trim();
    const title = interaction.options.getString("cancion", true).trim();
    const exactMatches = await findExactCatalogSongs(artist, title);
    if (exactMatches.length === 1) {
      await processCoverUpload(interaction, thread, exactMatches[0]);
      return;
    }
    if (exactMatches.length > 1) {
      await promptCoverSelection(
        interaction,
        thread,
        exactMatches,
        true,
      );
      return;
    }

    await processCoverUpload(
      interaction,
      thread,
      createExplicitCoverSong(artist, title),
    );
  } catch (error) {
    await sendCoverError(interaction, error);
  }
}

async function handleCoverSelection(
  interaction: StringSelectMenuInteraction,
) {
  const token = interaction.customId.split(":").at(-1) ?? "";
  const pending = pendingCoverSelections.get(token);
  if (
    !pending ||
    pending.expiresAt <= Date.now() ||
    pending.moderatorId !== interaction.user.id
  ) {
    pendingCoverSelections.delete(token);
    await interaction.reply({
      content: "La seleccion vencio o pertenece a otro moderador.",
      ephemeral: true,
    });
    return;
  }
  if (!canManageCover(interaction)) {
    await interaction.reply({
      content: "No tienes permisos para aprobar portadas.",
      ephemeral: true,
    });
    return;
  }

  const thread = await getContributionThread(interaction);
  if (!thread || thread.id !== pending.threadId) {
    await interaction.reply({
      content: "La seleccion solo funciona en el hilo original.",
      ephemeral: true,
    });
    return;
  }

  const selectedIndex = Number(interaction.values[0]);
  const song = pending.songs[selectedIndex];
  if (!song) {
    await interaction.reply({
      content: "La cancion seleccionada ya no esta disponible.",
      ephemeral: true,
    });
    return;
  }

  pendingCoverSelections.delete(token);
  await interaction.deferUpdate();
  try {
    await processCoverUpload(interaction, thread, song);
  } catch (error) {
    await sendCoverError(interaction, error);
  }
}

async function downloadAndValidateArtistMedia(
  attachment: CoverAttachmentCandidate,
  kind: ArtistMediaKind,
) {
  if (extname(attachment.name).toLocaleLowerCase() === ".jpeg") {
    throw new CoverContributionError(
      "INVALID_IMAGE_TYPE",
      "El formato .jpeg no esta permitido. Usa PNG, JPG, WebP u otro formato de imagen compatible.",
    );
  }
  if (attachment.size > coverMaxBytes) {
    throw new CoverContributionError(
      "IMAGE_TOO_LARGE",
      `La imagen supera el limite de ${Math.floor(coverMaxBytes / 1024 / 1024)} MB.`,
    );
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cloud-artist-media-"));
  const temporaryPath = join(temporaryDirectory, `${kind}-source`);
  try {
    const response = await fetch(attachment.url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new CoverContributionError(
        "CLOUD_REJECTED",
        "Discord no permitio descargar la imagen. No se actualizo el perfil del artista.",
      );
    }
    const downloaded = Buffer.from(await response.arrayBuffer());
    await writeFile(temporaryPath, downloaded);
    const converted = await sharp(await readFile(temporaryPath), {
      animated: false,
    })
      .rotate()
      .png()
      .toBuffer({ resolveWithObject: true });
    const pngData = converted.data;
    const dimensions = {
      width: converted.info.width,
      height: converted.info.height,
    };

    if (kind === "avatar") {
      const ratio = dimensions.width / dimensions.height;
      if (
        dimensions.width < 200 ||
        dimensions.height < 200 ||
        ratio < 0.75 ||
        ratio > 1.33
      ) {
        throw new CoverContributionError(
          "LOW_RESOLUTION",
          `La foto de artista debe ser casi cuadrada y de al menos 200x200 (300x300 recomendado). Imagen recibida: ${dimensions.width}x${dimensions.height}.`,
        );
      }
    } else if (
      dimensions.width < 1000 ||
      dimensions.height < 400 ||
      dimensions.width / dimensions.height < 1.6
    ) {
      throw new CoverContributionError(
        "LOW_RESOLUTION",
        `El banner debe ser horizontal y de al menos 1000x400 (2660x1140 recomendado). Imagen recibida: ${dimensions.width}x${dimensions.height}.`,
      );
    }

    return {
      pngData,
      ...dimensions,
      sha256: createHash("sha256").update(pngData).digest("hex"),
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

async function processArtistMediaUpload(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  thread: ThreadChannel,
  artist: ArtistReference,
  kind: ArtistMediaKind,
) {
  if (await isArtistMediaThreadApproved(thread.id, kind)) {
    throw new CommunityArtistMediaAlreadyApprovedError();
  }
  const attachment = await findLatestCoverAttachment(thread);
  if (!attachment) {
    throw new CoverContributionError(
      "NO_IMAGE",
      "No se encontro ninguna imagen adjunta dentro del hilo.",
    );
  }
  const validated = await downloadAndValidateArtistMedia(attachment, kind);
  const moderator = discordIdentityFromInteraction(interaction);
  const starterMessage = await thread.fetchStarterMessage().catch(() => null);
  const submitter = discordIdentityFromUser(
    starterMessage?.author ?? attachment.message.author,
  );
  const media = await saveCommunityArtistMedia({
    id: `artist_${kind}_${Date.now()}_${randomBytes(4).toString("hex")}`,
    artist,
    kind,
    pngData: validated.pngData,
    width: validated.width,
    height: validated.height,
    sha256: validated.sha256,
    originalFileName: attachment.name,
    discordAttachmentId: attachment.id,
    threadId: thread.id,
    forumId: artistMediaForumId,
    submitter,
    moderator,
  });
  const assetLabel = kind === "avatar" ? "Foto de artista" : "Banner";
  await interaction.editReply({
    content: `${assetLabel} aprobado para **${artist.name}** (${media.width}x${media.height}). Referencia: ${artist.referenceUrl}`,
    components: [],
  });
  await thread
    .send(
      `<@${submitter.id}>, tu ${assetLabel.toLocaleLowerCase("es")} de **${artist.name}** fue aceptado por <@${moderator.id}> y subido a Cloud.`,
    )
    .catch((error) => {
      console.error("Artist media saved but confirmation message failed:", error);
    });
}

async function promptArtistMediaSelection(
  interaction: ChatInputCommandInteraction,
  thread: ThreadChannel,
  kind: ArtistMediaKind,
  artists: ArtistReference[],
) {
  const token = randomBytes(8).toString("hex");
  const availableArtists = artists.slice(0, 25);
  pendingArtistMediaSelections.set(token, {
    moderatorId: interaction.user.id,
    threadId: thread.id,
    kind,
    artists: availableArtists,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${interactionPrefix}artist-media-select:${token}`)
    .setPlaceholder("Selecciona el perfil exacto del artista")
    .addOptions(
      availableArtists.map((artist, index) => ({
        label: artist.name.slice(0, 100),
        description: `${artist.provider}${artist.genre ? ` - ${artist.genre}` : ""}`.slice(0, 100),
        value: String(index),
      })),
    );
  const references = availableArtists
    .slice(0, 10)
    .map(
      (artist, index) =>
        `${index + 1}. [${artist.name}${artist.genre ? ` - ${artist.genre}` : ""}](${artist.referenceUrl})`,
    )
    .join("\n");
  await interaction.editReply({
    content: [
      "Selecciona el perfil exacto. No se subira ninguna imagen hasta confirmar.",
      "Referencias externas:",
      references,
    ].join("\n"),
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    ],
  });
}

async function sendArtistMediaError(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  error: unknown,
) {
  let content: string;
  if (error instanceof CommunityArtistMediaAlreadyApprovedError) {
    content = "Esta contribucion ya fue aprobada. No se actualizo el artista.";
  } else if (error instanceof CoverContributionError) {
    content = error.message;
  } else {
    console.error("Artist media contribution failed:", error);
    content = "El servidor de Cloud rechazo la subida. No se actualizo el artista.";
  }
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content, components: [] });
  } else {
    await interaction.reply({ content, ephemeral: true });
  }
}

async function handleArtistMediaUploadCommand(
  interaction: ChatInputCommandInteraction,
  kind: ArtistMediaKind,
) {
  if (!canManageCover(interaction)) {
    await interaction.reply({
      content: "No tienes permisos para aprobar contribuciones de artistas.",
      ephemeral: true,
    });
    return;
  }
  const thread = await getArtistMediaContributionThread(interaction);
  if (!thread) {
    await interaction.reply({
      content:
        "Este comando solo funciona dentro de un hilo del foro de contribuciones de artistas.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    if (await isArtistMediaThreadApproved(thread.id, kind)) {
      throw new CommunityArtistMediaAlreadyApprovedError();
    }
    const query = interaction.options.getString("artista", true).trim();
    const artists = await searchArtistProfiles(query);
    if (artists.length === 0) {
      throw new CoverContributionError(
        "NO_SONG_MATCH",
        "No se encontro ningun perfil de artista. Corrige el nombre y vuelve a intentarlo.",
      );
    }
    await promptArtistMediaSelection(interaction, thread, kind, artists);
  } catch (error) {
    await sendArtistMediaError(interaction, error);
  }
}

async function handleArtistMediaSelection(
  interaction: StringSelectMenuInteraction,
) {
  const token = interaction.customId.split(":").at(-1) ?? "";
  const pending = pendingArtistMediaSelections.get(token);
  if (
    !pending ||
    pending.expiresAt <= Date.now() ||
    pending.moderatorId !== interaction.user.id
  ) {
    pendingArtistMediaSelections.delete(token);
    await interaction.reply({
      content: "La seleccion vencio o pertenece a otro moderador.",
      ephemeral: true,
    });
    return;
  }
  if (!canManageCover(interaction)) {
    await interaction.reply({
      content: "No tienes permisos para aprobar contribuciones de artistas.",
      ephemeral: true,
    });
    return;
  }
  const thread = await getArtistMediaContributionThread(interaction);
  if (!thread || thread.id !== pending.threadId) {
    await interaction.reply({
      content: "La seleccion solo funciona en el hilo original.",
      ephemeral: true,
    });
    return;
  }
  const selectedIndex = Number(interaction.values[0]);
  const artist = pending.artists[selectedIndex];
  if (!artist) {
    await interaction.reply({
      content: "El perfil seleccionado ya no esta disponible.",
      ephemeral: true,
    });
    return;
  }
  pendingArtistMediaSelections.delete(token);
  await interaction.deferUpdate();
  try {
    await processArtistMediaUpload(interaction, thread, artist, pending.kind);
  } catch (error) {
    await sendArtistMediaError(interaction, error);
  }
}

function buildResultText(submission: TTMLSubmission) {
  if (submission.status === "approved") {
    return {
      title: "TTML aprobado",
      message: `${submission.song.artist} - ${submission.song.title} fue aprobado por el equipo.`,
    };
  }

  if (submission.status === "rejected") {
    return {
      title: "TTML necesita ajustes",
      message: `${submission.song.artist} - ${submission.song.title} necesita correcciones.`,
    };
  }

  return {
    title: "TTML en revision",
    message: `${submission.song.artist} - ${submission.song.title} esta esperando revision.`,
  };
}

function buildReviewEmbed(submission: TTMLSubmission) {
  const resultText = buildResultText(submission);
  const embed = new EmbedBuilder()
    .setColor(0x8adcf7)
    .setTitle("Nueva revision TTML")
    .setDescription(
      [
        `**Cancion:** ${submission.song.artist} - ${submission.song.title}`,
        `**Album:** ${submission.song.album || "Desconocido"}`,
        `**Duracion:** ${formatDuration(submission.song.duration)}`,
        `**Archivo:** ${submission.fileName}`,
        `**Enviado por:** ${submission.submitter ? `@${submission.submitter.displayName}` : "Usuario sin identificar"}`,
        `**Estado:** ${resultText.title}`,
      ].join("\n"),
    )
    .setFooter({ text: `Cloud TTML Review - ${submission.id}` })
    .setTimestamp(submission.createdAt);

  if (submission.song.coverUrl?.startsWith("http")) {
    embed.setThumbnail(submission.song.coverUrl);
  }

  if (submission.status !== "pending" && submission.moderator) {
    embed.addFields({
      name:
        submission.status === "approved"
          ? "Aprobado"
          : "Rechazado / necesita ajustes",
      value: `"${submission.moderator.comment}"\n- ${submission.moderator.name}`,
    });
    embed.setColor(submission.status === "approved" ? 0x57f287 : 0xfee75c);
  }

  return embed;
}

function buildReviewButtons(submissionId: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${interactionPrefix}approve:${submissionId}`)
      .setLabel("Aprobar")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${interactionPrefix}reject:${submissionId}`)
      .setLabel("Rechazar")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

async function getReviewChannel() {
  const channel = await client.channels.fetch(discordReviewChannelId);

  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("DISCORD_REVIEW_CHANNEL_ID must be a text channel");
  }

  return channel as TextChannel;
}

const validatedArtworkChannelIds = new Set<string>();
type ArtworkDiscordChannel = TextChannel | NewsChannel;

async function validateArtworkChannelPermissions(
  channel: ArtworkDiscordChannel,
  kind: "reports" | "public",
) {
  if (validatedArtworkChannelIds.has(channel.id)) return;

  const everyonePermissions = channel.permissionsFor(
    channel.guild.roles.everyone,
  );
  const botMember =
    channel.guild.members.me ?? (await channel.guild.members.fetchMe());
  const botPermissions = channel.permissionsFor(botMember);
  if (
    !botPermissions?.has(PermissionFlagsBits.ViewChannel) ||
    !botPermissions.has(PermissionFlagsBits.SendMessages) ||
    !botPermissions.has(PermissionFlagsBits.EmbedLinks)
  ) {
    throw new Error(
      `El bot necesita ViewChannel, SendMessages y EmbedLinks en #${channel.name}.`,
    );
  }

  if (kind === "reports") {
    if (everyonePermissions?.has(PermissionFlagsBits.ViewChannel)) {
      throw new Error(
        `El canal privado #${channel.name} permite que @everyone lo vea.`,
      );
    }
    const moderatorRole = channel.guild.roles.cache.get(coverReviewerRoleId);
    if (
      !moderatorRole ||
      !channel
        .permissionsFor(moderatorRole)
        ?.has(PermissionFlagsBits.ViewChannel)
    ) {
      throw new Error(
        `El rol moderador no puede ver el canal privado #${channel.name}.`,
      );
    }
  } else {
    if (!everyonePermissions?.has(PermissionFlagsBits.ViewChannel)) {
      throw new Error(
        `El canal público #${channel.name} no es visible para @everyone.`,
      );
    }
    if (everyonePermissions.has(PermissionFlagsBits.SendMessages)) {
      throw new Error(
        `El canal público #${channel.name} permite publicar a @everyone; debe publicar solo el bot.`,
      );
    }
  }

  validatedArtworkChannelIds.add(channel.id);
}

async function getArtworkTextChannel(
  channelId: string,
  kind: "reports" | "public",
) {
  const channel = await client.channels.fetch(channelId);
  if (
    !channel ||
    !isSupportedArtworkChannelType(kind, channel.type)
  ) {
    throw new Error(
      kind === "reports"
        ? "DISCORD_REPORTS_CHANNEL_ID must be a text channel"
        : "DISCORD_PUBLIC_COVERS_CHANNEL_ID must be a text channel",
    );
  }
  const textChannel = channel as ArtworkDiscordChannel;
  await validateArtworkChannelPermissions(textChannel, kind);
  return textChannel;
}

let communityAnnouncementsMessageId: string | undefined;

async function ensureCommunityAnnouncementsRoleMessage() {
  const channel = await client.channels.fetch(
    discordCommunityAnnouncementsChannelId,
  );
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(
      "DISCORD_COMMUNITY_ANNOUNCEMENTS_CHANNEL_ID must be a text channel",
    );
  }

  const botMember =
    channel.guild.members.me ?? (await channel.guild.members.fetchMe());
  const botPermissions = channel.permissionsFor(botMember);
  const requiredPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageRoles,
  ];
  if (
    requiredPermissions.some(
      (permission) => !botPermissions?.has(permission),
    )
  ) {
    throw new Error(
      `El bot no tiene todos los permisos necesarios en #${channel.name}.`,
    );
  }

  const role = await channel.guild.roles.fetch(
    discordCommunityAnnouncementsRoleId,
  );
  if (!role || role.managed || role.position >= botMember.roles.highest.position) {
    throw new Error(
      "El rol de anuncios debe estar debajo del rol más alto del bot.",
    );
  }

  const recentMessages = await channel.messages.fetch({ limit: 50 });
  const existing = recentMessages.find(
    (message) =>
      message.author.id === client.user?.id &&
      message.embeds.some(
        (embed) =>
          embed.footer?.text ===
          "Cloud · Rol de anuncios comunitarios",
      ),
  );
  const payload = {
    embeds: [
      buildCommunityAnnouncementsRoleEmbed({
        roleId: discordCommunityAnnouncementsRoleId,
        emojiId: discordCommunityAnnouncementsEmojiId,
      }),
    ],
    allowedMentions: { parse: [] as never[] },
  };
  const message = existing
    ? await existing.edit(payload)
    : await channel.send(payload);

  await message.react(discordCommunityAnnouncementsEmojiId);
  communityAnnouncementsMessageId = message.id;
  console.log(
    `Community announcements reaction role ready in #${channel.name}: ${message.id}`,
  );
  return message;
}

async function syncArtworkReportPrivateMessage(
  report: ArtworkReport,
  mapping?: SongArtworkMapping | null,
) {
  const channel = await getArtworkTextChannel(
    discordReportsChannelId,
    "reports",
  );
  const payload = {
    embeds: [buildArtworkReportEmbed(report, mapping)],
    components: [buildArtworkReportButtons(interactionPrefix, report)],
    allowedMentions: { parse: [] as never[] },
  };

  if (
    report.discordReportsChannelId === channel.id &&
    report.discordReportMessageId
  ) {
    const existing = await channel.messages
      .fetch(report.discordReportMessageId)
      .catch(() => null);
    if (existing) {
      await existing.edit(payload);
      return report;
    }
  }

  const message = await channel.send(payload);
  return setArtworkReportDiscordMessage({
    reportId: report.id,
    channelId: channel.id,
    messageId: message.id,
  });
}

async function syncArtworkPublicAnnouncement(
  report: ArtworkReport,
  mapping: SongArtworkMapping,
) {
  const channel = await getArtworkTextChannel(
    discordPublicCoversChannelId,
    "public",
  );
  const payload = {
    content: `<@&${discordCommunityAnnouncementsRoleId}>`,
    embeds: [buildArtworkAnnouncementEmbed(report, mapping)],
    allowedMentions: {
      parse: [] as never[],
      roles: [discordCommunityAnnouncementsRoleId],
    },
  };

  if (
    report.discordPublicChannelId === channel.id &&
    report.discordPublicMessageId
  ) {
    const existing = await channel.messages
      .fetch(report.discordPublicMessageId)
      .catch(() => null);
    if (existing) {
      await existing.edit(payload);
      return report;
    }
  }

  const message = await channel.send(payload);
  return setArtworkReportPublicMessage({
    reportId: report.id,
    channelId: channel.id,
    messageId: message.id,
  });
}

async function moderateArtworkReport(
  report: ArtworkReport,
  reviewerUserId: string,
  status: "approved" | "rejected",
) {
  const resolvedTrack =
    status === "approved"
      ? await lookupAppleTrack(report.suggestedAppleUrl ?? "")
      : undefined;
  const result = await reviewArtworkReport({
    reportId: report.id,
    reviewerUserId,
    status,
    resolvedTrack,
    allowSelfReview:
      Boolean(discordOwnerUserId) &&
      reviewerUserId === discordOwnerUserId,
  });

  const deliveryErrors: string[] = [];
  let synchronizedReport = result.report;
  try {
    synchronizedReport = await syncArtworkReportPrivateMessage(
      synchronizedReport,
      result.mapping,
    );
  } catch (error) {
    console.error("Could not update private artwork report message:", error);
    deliveryErrors.push("private");
  }
  if (status === "approved" && result.mapping) {
    try {
      synchronizedReport = await syncArtworkPublicAnnouncement(
        synchronizedReport,
        result.mapping,
      );
    } catch (error) {
      console.error("Could not publish artwork announcement:", error);
      deliveryErrors.push("public");
    }
  }

  return {
    report: synchronizedReport,
    mapping: result.mapping,
    discordDelivery:
      deliveryErrors.length === 0 ? ("sent" as const) : ("queued" as const),
  };
}

let artworkDiscordRecoveryRunning = false;
let artworkDiscordRecoveryTimer:
  | ReturnType<typeof setInterval>
  | undefined;

async function refreshArtworkReportDiscordMessages() {
  if (artworkDiscordRecoveryRunning || !client.isReady()) return;
  artworkDiscordRecoveryRunning = true;
  try {
    const reports = await listArtworkReportsForDiscordRecovery();
    for (const report of reports) {
      try {
        const mapping =
          report.status === "approved"
            ? await getSongArtworkMapping(report.songId)
            : null;
        const synchronized = await syncArtworkReportPrivateMessage(
          report,
          mapping,
        );
        if (report.status === "approved" && mapping) {
          await syncArtworkPublicAnnouncement(synchronized, mapping);
        }
      } catch (error) {
        console.error(
          `Could not recover artwork report ${report.id} in Discord:`,
          error,
        );
      }
    }
  } finally {
    artworkDiscordRecoveryRunning = false;
  }
}

function startArtworkReportDiscordRecovery() {
  if (artworkDiscordRecoveryTimer) return;
  artworkDiscordRecoveryTimer = setInterval(() => {
    void refreshArtworkReportDiscordMessages();
  }, 60_000);
  artworkDiscordRecoveryTimer.unref();
}

async function handleArtworkReportButton(interaction: ButtonInteraction) {
  const parsed = parseArtworkReportCustomId(
    interactionPrefix,
    interaction.customId,
  );
  if (!parsed) return;

  if (interaction.channelId !== discordReportsChannelId) {
    await interaction.reply({
      content: "Este botón solo funciona en el canal privado de reportes.",
      ephemeral: true,
    });
    return;
  }
  if (!(await canModerateArtwork(interaction.user.id))) {
    await interaction.reply({
      content: "Solo el rol de moderador puede revisar portadas.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const report = await getArtworkReport(parsed.reportId);
    if (!report) {
      throw new ArtworkReportNotFoundError("Reporte no encontrado.");
    }
    const result = await moderateArtworkReport(
      report,
      interaction.user.id,
      parsed.action === "approve" ? "approved" : "rejected",
    );
    const actionText =
      result.report.status === "approved"
        ? "Portada aplicada y reporte aprobado."
        : "Enlace marcado como incorrecto y reporte rechazado.";
    await interaction.editReply({
      content:
        result.discordDelivery === "sent"
          ? actionText
          : `${actionText} Discord reintentará sincronizar el mensaje pendiente.`,
    });
  } catch (error) {
    const response = artworkErrorResponse(error);
    await interaction.editReply({ content: response.error });
  }
}

async function publishSubmission(submission: TTMLSubmission) {
  const channel = await getReviewChannel();
  const attachment = new AttachmentBuilder(
    Buffer.from(submission.ttmlContent, "utf8"),
    {
      name: submission.fileName,
    },
  );

  const message = await channel.send({
    embeds: [buildReviewEmbed(submission)],
    components: [buildReviewButtons(submission.id)],
    files: [attachment],
  });

  submission.channelId = channel.id;
  submission.messageId = message.id;
  await saveSubmission(submission);
}

function buildReviewModal(
  submission: TTMLSubmission,
  action: "approve" | "reject",
) {
  const modal = new ModalBuilder()
    .setCustomId(`${interactionPrefix}${action}:modal:${submission.id}`)
    .setTitle(action === "approve" ? "Aprobar TTML" : "Rechazar TTML");

  const commentInput = new TextInputBuilder()
    .setCustomId("comment")
    .setLabel(
      action === "approve"
        ? "Comentario para el usuario"
        : "Que necesita corregir?",
    )
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(800)
    .setPlaceholder(
      action === "approve"
        ? "Excelente sincronizacion y tiempos muy precisos."
        : "Las lineas 34-42 aparecen adelantadas aproximadamente 1 segundo.",
    );

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput),
  );

  return modal;
}

async function handleReviewButton(interaction: ButtonInteraction) {
  const [, namespace, action, submissionId] = interaction.customId.split(":");

  if (namespace !== interactionNamespace) return;

  const submission = await getSubmission(submissionId);

  if (!submission) {
    await interaction.reply({
      content: "No encontre esta revision.",
      ephemeral: true,
    });
    return;
  }

  if (submission.status !== "pending") {
    await interaction.reply({
      content: "Esta revision ya fue atendida.",
      ephemeral: true,
    });
    return;
  }

  if (action !== "approve" && action !== "reject") {
    await interaction.reply({
      content: "Accion no reconocida.",
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(buildReviewModal(submission, action));
}

async function updateReviewMessage(submission: TTMLSubmission) {
  if (!submission.channelId || !submission.messageId) return;

  const channel = await client.channels.fetch(submission.channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const message = await channel.messages.fetch(submission.messageId);
  await message.edit({
    embeds: [buildReviewEmbed(submission)],
    components: [buildReviewButtons(submission.id, true)],
  });
}

async function refreshPendingReviewMessages() {
  const pendingSubmissions = await getPendingSubmissions();

  for (const submission of pendingSubmissions) {
    try {
      await updateReviewMessage(submission);
    } catch (error) {
      console.error(
        `Could not refresh review buttons for ${submission.id}:`,
        error,
      );
    }
  }

  console.log(
    `Refreshed ${pendingSubmissions.length} pending TTML review message(s)`,
  );
}

async function handleReviewModal(interaction: ModalSubmitInteraction) {
  const [, namespace, action, , submissionId] = interaction.customId.split(":");

  if (namespace !== interactionNamespace) return;

  const submission = await getSubmission(submissionId);

  if (!submission) {
    await interaction.reply({
      content: "No encontre esta revision.",
      ephemeral: true,
    });
    return;
  }

  const comment = interaction.fields.getTextInputValue("comment").trim();
  submission.status = action === "approve" ? "approved" : "rejected";
  submission.moderator = {
    id: interaction.user.id,
    name: interaction.user.globalName ?? interaction.user.username,
    avatarUrl: getDiscordAvatarUrl({
      id: interaction.user.id,
      avatar: interaction.user.avatar,
    }),
    comment,
  };
  await saveSubmission(submission);

  await updateReviewMessage(submission);

  await interaction.reply({
    content:
      submission.status === "approved"
        ? "TTML aprobado. Cloud ya puede mostrar la respuesta al usuario."
        : "TTML marcado como necesita ajustes. Cloud ya puede mostrar la respuesta al usuario.",
    ephemeral: true,
  });
}

async function handleDeleteAllCommand(interaction: ChatInputCommandInteraction) {
  if (!canManageMaintenance(interaction)) {
    await interaction.reply({
      content: "No tienes permiso para ejecutar este comando.",
      ephemeral: true,
    });
    return;
  }

  const confirmationId = createDeleteConfirmationId();
  pendingDeleteConfirmations.set(confirmationId, {
    actor: discordIdentityFromInteraction(interaction),
    expiresAt: Date.now() + 60_000,
  });

  await interaction.reply({
    content:
      "Esto eliminara solo TTML comunitarios de PostgreSQL y creara backup antes de borrar. La confirmacion vence en 60 segundos.",
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${interactionPrefix}delete-confirm:${confirmationId}`)
          .setLabel("Continuar")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
    ephemeral: true,
  });
}

async function handleDeleteConfirmationButton(interaction: ButtonInteraction) {
  const [, namespace, action, confirmationId] = interaction.customId.split(":");
  if (namespace !== interactionNamespace || action !== "delete-confirm") return;

  const confirmation = pendingDeleteConfirmations.get(confirmationId);
  if (
    !confirmation ||
    confirmation.actor.id !== interaction.user.id ||
    confirmation.expiresAt <= Date.now()
  ) {
    pendingDeleteConfirmations.delete(confirmationId);
    await interaction.reply({
      content: "La confirmacion vencio o no pertenece a tu usuario.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${interactionPrefix}delete-modal:${confirmationId}`)
    .setTitle("Confirmar borrado TTML");
  const input = new TextInputBuilder()
    .setCustomId("confirmation")
    .setLabel("Escribe DELETE ALL COMMUNITY TTMLS")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );
  await interaction.showModal(modal);
}

async function handleDeleteConfirmationModal(
  interaction: ModalSubmitInteraction,
) {
  const [, namespace, action, confirmationId] = interaction.customId.split(":");
  if (namespace !== interactionNamespace || action !== "delete-modal") return;

  const confirmation = pendingDeleteConfirmations.get(confirmationId);
  pendingDeleteConfirmations.delete(confirmationId);

  if (
    !confirmation ||
    confirmation.actor.id !== interaction.user.id ||
    confirmation.expiresAt <= Date.now()
  ) {
    await interaction.reply({
      content: "La confirmacion vencio o no pertenece a tu usuario.",
      ephemeral: true,
    });
    return;
  }

  const text = interaction.fields.getTextInputValue("confirmation").trim();
  if (text !== "DELETE ALL COMMUNITY TTMLS") {
    await interaction.reply({
      content: "Texto incorrecto. No se borro nada.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const result = await deleteAllCommunityTtmlsWithBackup({
    batchId: `ttml_delete_${Date.now()}_${randomBytes(4).toString("hex")}`,
    actor: confirmation.actor,
  });
  await interaction.editReply(
    `Listo. TTML comunitarios eliminados: ${result.deletedCount}. Backup: ${result.backupBatchId}.`,
  );
}

async function handleDeleteTtmlCommand(interaction: ChatInputCommandInteraction) {
  if (!canManageMaintenance(interaction)) {
    await interaction.reply({
      content: "No tienes permiso para ejecutar este comando.",
      ephemeral: true,
    });
    return;
  }

  const title = interaction.options.getString("cancion", true).trim();
  const artist = interaction.options.getString("artista", true).trim();
  const matches = await findCommunityTtmls(artist, title);
  if (matches.length === 0) {
    await interaction.reply({
      content: "No se encontro algun TTML con esa cancion y artista.",
      ephemeral: true,
    });
    return;
  }

  const confirmationId = createDeleteConfirmationId();
  pendingSpecificDeleteConfirmations.set(confirmationId, {
    actor: discordIdentityFromInteraction(interaction),
    artist,
    title,
    expiresAt: Date.now() + 60_000,
  });
  const latest = matches[0];
  await interaction.reply({
    content: [
      `Se encontro **${latest.song.title}** de **${latest.song.artist}**.`,
      `Coincidencias comunitarias: ${matches.length}.`,
      "Quieres eliminar este TTML? Se creara un respaldo antes de borrarlo.",
    ].join("\n"),
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${interactionPrefix}delete-ttml-confirm:${confirmationId}`)
          .setLabel("Eliminar")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`${interactionPrefix}delete-ttml-cancel:${confirmationId}`)
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    ephemeral: true,
  });
}

async function handleDeleteTtmlButton(interaction: ButtonInteraction) {
  const [, namespace, action, confirmationId] = interaction.customId.split(":");
  if (namespace !== interactionNamespace) return;
  const confirmation = pendingSpecificDeleteConfirmations.get(confirmationId);
  pendingSpecificDeleteConfirmations.delete(confirmationId);

  if (action === "delete-ttml-cancel") {
    await interaction.update({ content: "Eliminacion cancelada.", components: [] });
    return;
  }
  if (action !== "delete-ttml-confirm") return;
  if (
    !confirmation ||
    confirmation.actor.id !== interaction.user.id ||
    confirmation.expiresAt <= Date.now()
  ) {
    await interaction.update({
      content: "La confirmacion vencio o no pertenece a tu usuario.",
      components: [],
    });
    return;
  }

  await interaction.deferUpdate();
  const result = await deleteCommunityTtmlsWithBackup({
    batchId: `ttml_delete_song_${Date.now()}_${randomBytes(4).toString("hex")}`,
    actor: confirmation.actor,
    artist: confirmation.artist,
    title: confirmation.title,
  });
  await interaction.editReply({
    content: `TTML eliminados: ${result.deletedCount}. Backup: ${result.backupBatchId}.`,
    components: [],
  });
}

async function handleRestoreTtmlBackupCommand(
  interaction: ChatInputCommandInteraction,
) {
  if (!canManageMaintenance(interaction)) {
    await interaction.reply({
      content: "No tienes permiso para ejecutar este comando.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const result = await restoreLatestCommunityTtmlBackup({
    actor: discordIdentityFromInteraction(interaction),
  });
  await interaction.editReply(
    result.backupBatchId
      ? `Respaldo restaurado globalmente. TTML restaurados: ${result.restoredCount}. Backup: ${result.backupBatchId}.`
      : "No se encontro algun respaldo TTML para restaurar.",
  );
}

async function handleMaintenanceCommand(
  interaction: ChatInputCommandInteraction,
  type: MaintenanceType,
) {
  if (!canManageMaintenance(interaction)) {
    await interaction.reply({
      content: "No tienes permiso para ejecutar este comando.",
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const actor = discordIdentityFromInteraction(interaction);

  if (subcommand === "start") {
    try {
      const timing = parseMaintenanceTiming(interaction);
      const reason = interaction.options.getString("reason")?.trim();
      const event = await createMaintenanceEvent({
        id: createMaintenanceId(type),
        type,
        startsAtUtc: timing.startsAtUtc,
        endsAtUtc: timing.endsAtUtc,
        reason: reason || undefined,
        createdBy: actor,
      });

      await interaction.reply({
        content: `Mantenimiento ${type === "lyrics" ? "de letras" : "global"} programado.\n${formatMaintenanceEvent(event)}`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content:
          error instanceof Error
            ? error.message
            : "No se pudo programar el mantenimiento.",
        ephemeral: true,
      });
    }
    return;
  }

  if (subcommand === "end") {
    const event = await endMaintenanceEvent(type, actor);
    await interaction.reply({
      content: event
        ? `Mantenimiento finalizado.\n${formatMaintenanceEvent(event)}`
        : "No hay mantenimiento activo o programado.",
      ephemeral: true,
    });
    return;
  }

  const snapshot = await getMaintenanceSnapshot();
  const status = snapshot[type];
  await interaction.reply({
    content: [
      `Estado de mantenimiento ${type === "lyrics" ? "de letras" : "global"}:`,
      status.active
        ? `Activo:\n${formatMaintenanceEvent(status.active)}`
        : "Activo: ninguno",
      status.scheduled
        ? `Programado:\n${formatMaintenanceEvent(status.scheduled)}`
        : "Programado: ninguno",
    ].join("\n\n"),
    ephemeral: true,
  });
}

function toReviewResponse(submission: TTMLSubmission) {
  const resultText = buildResultText(submission);

  return {
    id: submission.id,
    status: submission.status,
    song: submission.song,
    moderator: submission.moderator,
    title: resultText.title,
    message: resultText.message,
    detail: submission.moderator?.comment,
    author: submission.moderator
      ? `${submission.moderator.name}, Moderador Cloud`
      : "Cloud",
    createdAt: submission.createdAt,
  };
}

function toCommunityCoverResponse(cover: CommunityCover) {
  return {
    id: cover.id,
    songKey: cover.requestedSongKey ?? cover.songKey,
    artist: cover.song.artist,
    title: cover.song.title,
    album: cover.song.album,
    width: cover.width,
    height: cover.height,
    coverUrl: `${publicBaseUrl}/api/covers/${encodeURIComponent(cover.songKey)}.png?v=${cover.sha256.slice(0, 12)}`,
    submitter: cover.submitter,
    moderator: cover.moderator,
    updatedAt: cover.updatedAt,
  };
}

function toCommunityArtistMediaResponse(media: CommunityArtistMedia) {
  return {
    id: media.id,
    artistKey: media.artistKey,
    artist: media.artist,
    kind: media.kind,
    width: media.width,
    height: media.height,
    mediaUrl: `${publicBaseUrl}/api/artists/media/${encodeURIComponent(media.artistKey)}.png?v=${media.sha256.slice(0, 12)}`,
    submitter: media.submitter,
    moderator: media.moderator,
    updatedAt: media.updatedAt,
  };
}

app.get("/health", async (_req, res) => {
  // No consultes PostgreSQL aqui: Railway usa esta ruta mientras la base de
  // datos tambien puede estar despertando. La API debe poder responder desde
  // el primer instante para evitar un 502 del proxy.
  res.json({
    ok: true,
    bootstrapReady: backendBootstrapReady,
    bootstrapError: backendBootstrapError,
    botReady: client.isReady(),
    database: isDatabaseEnabled()
      ? backendBootstrapReady
        ? "postgresql"
        : "initializing"
      : "memory",
    interactionProtocol: "railwayreview-v6-artwork-reports",
    interactionNamespace,
    discordOAuth: Boolean(discordClientId && discordClientSecret),
    communityAnnouncementsRoleReady: Boolean(
      communityAnnouncementsMessageId,
    ),
  });
});

app.post("/api/analytics/visit", async (req, res) => {
  const visitorId =
    typeof req.body?.visitorId === "string" ? req.body.visitorId.trim() : "";
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(visitorId)) {
    res.status(400).json({ error: "visitorId is invalid" });
    return;
  }

  try {
    const day = getAnalyticsDay();
    await recordDailyWebVisit({
      day,
      visitorHash: hashDailyVisitor(day, visitorId),
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(204).end();
  } catch (error) {
    console.error("Could not record website visit:", error);
    res
      .status(503)
      .json({ error: "Website analytics are temporarily unavailable" });
  }
});

app.get("/api/catalog/apple/artwork", async (req, res) => {
  const title =
    typeof req.query.title === "string" ? req.query.title.trim() : "";
  const artist =
    typeof req.query.artist === "string" ? req.query.artist.trim() : "";
  if (!title || !artist || title.length > 200 || artist.length > 200) {
    res.status(400).json({ error: "Title and artist are required" });
    return;
  }

  try {
    const results = await searchAppleArtworkCatalog(title, artist);
    res.setHeader(
      "Cache-Control",
      "public, max-age=600, stale-while-revalidate=86400",
    );
    res.json({ results });
  } catch (error) {
    console.error("Apple artwork catalog error:", error);
    res.status(502).json({
      error: "Apple Music catalog is temporarily unavailable",
    });
  }
});

function artworkErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "No se pudo procesar el reporte.";
  if (error instanceof ArtworkReportValidationError) {
    return { status: 400, error: message };
  }
  if (error instanceof ArtworkReportDuplicateError) {
    return { status: 409, error: message };
  }
  if (error instanceof ArtworkReportRateLimitError) {
    return { status: 429, error: message };
  }
  if (error instanceof ArtworkReportNotFoundError) {
    return { status: 404, error: message };
  }
  if (error instanceof ArtworkReportPermissionError) {
    return { status: 403, error: message };
  }
  if (error instanceof ArtworkReportAlreadyReviewedError) {
    return { status: 409, error: message };
  }
  console.error("Artwork report error:", error);
  return { status: 500, error: "No se pudo procesar el reporte." };
}

app.post("/api/songs/:songId/artwork-reports", async (req, res) => {
  const reporter = await getAuthenticatedDiscordUser(req.headers.authorization);
  if (!reporter) {
    res.status(401).json({
      error: "Inicia sesión con Discord para reportar una portada.",
    });
    return;
  }
  try {
    const report = await createArtworkReport({
      songId: req.params.songId,
      reporterUserId: reporter.id,
      title: typeof req.body?.title === "string" ? req.body.title : "",
      artist: typeof req.body?.artist === "string" ? req.body.artist : "",
      album: typeof req.body?.album === "string" ? req.body.album : undefined,
      currentAppleTrackId:
        typeof req.body?.currentAppleTrackId === "number"
          ? req.body.currentAppleTrackId
          : undefined,
      currentArtworkUrl:
        typeof req.body?.currentArtworkUrl === "string"
          ? req.body.currentArtworkUrl
          : undefined,
      currentAppleMusicUrl:
        typeof req.body?.currentAppleMusicUrl === "string"
          ? req.body.currentAppleMusicUrl
          : undefined,
      suggestedAppleUrl:
        typeof req.body?.suggestedAppleUrl === "string"
          ? req.body.suggestedAppleUrl
          : "",
      reason: req.body?.reason,
      comment:
        typeof req.body?.comment === "string" ? req.body.comment : undefined,
    });
    try {
      const synchronized = await syncArtworkReportPrivateMessage(report);
      res.status(201).json({
        report: synchronized,
        discordDelivery: "sent",
      });
    } catch (discordError) {
      console.error(
        `Artwork report ${report.id} was saved but Discord delivery is pending:`,
        discordError,
      );
      res.status(202).json({
        report,
        discordDelivery: "queued",
      });
    }
  } catch (error) {
    const response = artworkErrorResponse(error);
    res.status(response.status).json({ error: response.error });
  }
});

app.get("/api/songs/:songId/artwork-report-status", async (req, res) => {
  const reporter = await getAuthenticatedDiscordUser(req.headers.authorization);
  if (!reporter) {
    res.status(401).json({ error: "Discord session is not valid" });
    return;
  }
  const [report, mapping] = await Promise.all([
    getArtworkReportStatus(req.params.songId, reporter.id),
    getSongArtworkMapping(req.params.songId, {
      title: typeof req.query.title === "string" ? req.query.title : undefined,
      artist: typeof req.query.artist === "string" ? req.query.artist : undefined,
    }),
  ]);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    report,
    mapping: mapping ? { ...mapping, songId: req.params.songId } : null,
  });
});

app.get("/api/songs/:songId/artwork-mapping", async (req, res) => {
  const mapping = await getSongArtworkMapping(req.params.songId, {
    title: typeof req.query.title === "string" ? req.query.title : undefined,
    artist: typeof req.query.artist === "string" ? req.query.artist : undefined,
  });
  if (!mapping) {
    res.status(404).json({ error: "Apple artwork mapping not found" });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  // Return the requesting client's ID even when the persistent mapping was
  // recovered through title + artist. Local IDs are installation-specific.
  res.json({ mapping: { ...mapping, songId: req.params.songId } });
});

app.get("/api/admin/artwork-reports", async (req, res) => {
  const reviewer = await getAuthenticatedDiscordUser(req.headers.authorization);
  if (!reviewer || !(await canModerateArtwork(reviewer.id))) {
    res.status(403).json({ error: "No tienes permisos de moderación." });
    return;
  }
  const requestedStatus =
    typeof req.query.status === "string" ? req.query.status : "pending";
  if (!["pending", "approved", "rejected"].includes(requestedStatus)) {
    res.status(400).json({ error: "El estado solicitado no es válido." });
    return;
  }
  const reports = await listArtworkReports(
    requestedStatus as ArtworkReportStatus,
  );
  res.setHeader("Cache-Control", "no-store");
  res.json({ reports });
});

app.patch("/api/admin/artwork-reports/:reportId", async (req, res) => {
  const reviewer = await getAuthenticatedDiscordUser(req.headers.authorization);
  if (!reviewer || !(await canModerateArtwork(reviewer.id))) {
    res.status(403).json({ error: "No tienes permisos de moderación." });
    return;
  }
  const status = req.body?.status;
  if (status !== "approved" && status !== "rejected") {
    res.status(400).json({ error: "Usa approved o rejected." });
    return;
  }
  try {
    const report = await getArtworkReport(req.params.reportId);
    if (!report) {
      throw new ArtworkReportNotFoundError("Reporte no encontrado.");
    }
    const result = await moderateArtworkReport(
      report,
      reviewer.id,
      status,
    );
    res.json(result);
  } catch (error) {
    const response = artworkErrorResponse(error);
    res.status(response.status).json({ error: response.error });
  }
});

// Song cover uploads and downloads were retired. Keep the historical tables
// untouched, but make the old public surface explicitly unavailable.
app.use("/api/covers", (_req, res) => {
  res.status(410).json({
    error: "Las portadas comunitarias fueron sustituidas por Apple Music.",
  });
});

app.get("/api/covers/approved", async (req, res) => {
  const artist =
    typeof req.query.artist === "string" ? req.query.artist.trim() : "";
  const title =
    typeof req.query.title === "string" ? req.query.title.trim() : "";
  if (!artist || !title) {
    res.status(400).json({ error: "Artist and title are required" });
    return;
  }

  const cover = await getCommunityCover(artist, title);
  if (!cover) {
    res.status(404).json({ error: "Approved community cover not found" });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(toCommunityCoverResponse(cover));
});

app.post("/api/covers/approved/batch", async (req, res) => {
  const songs = Array.isArray(req.body?.songs) ? req.body.songs : [];
  const validSongs = songs
    .slice(0, 500)
    .filter(
      (song: unknown): song is { artist: string; title: string } =>
        typeof song === "object" &&
        song !== null &&
        "artist" in song &&
        "title" in song &&
        typeof song.artist === "string" &&
        typeof song.title === "string" &&
        Boolean(song.artist.trim() && song.title.trim()),
    );
  if (validSongs.length === 0) {
    res.status(400).json({ error: "At least one valid song is required" });
    return;
  }

  const covers = await getCommunityCoversBatch(validSongs);
  res.setHeader("Cache-Control", "no-store");
  res.json({ covers: covers.map(toCommunityCoverResponse) });
});

app.get("/api/covers/:songKey.png", async (req, res) => {
  const image = await getCommunityCoverImage(req.params.songKey);
  if (!image) {
    res.status(404).json({ error: "Community cover not found" });
    return;
  }

  const etag = `"${image.sha256}"`;
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Length", String(image.pngData.byteLength));
  res.setHeader("ETag", etag);
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  res.send(image.pngData);
});

app.get("/api/artists/media", async (req, res) => {
  const artist =
    typeof req.query.artist === "string" ? req.query.artist.trim() : "";
  const kind =
    req.query.kind === "avatar" || req.query.kind === "banner"
      ? req.query.kind
      : undefined;
  if (!artist || !kind) {
    res.status(400).json({
      error: "artist y kind (avatar o banner) son requeridos",
    });
    return;
  }

  const media = await getCommunityArtistMedia(artist, kind);
  if (media.length === 0) {
    res.status(404).json({ error: "Community artist media not found" });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json({ media: media.map(toCommunityArtistMediaResponse) });
});

app.get("/api/artists/media/:artistKey.png", async (req, res) => {
  const image = await getCommunityArtistMediaImage(req.params.artistKey);
  if (!image) {
    res.status(404).json({ error: "Community artist media not found" });
    return;
  }

  const etag = `"${image.sha256}"`;
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Length", String(image.pngData.byteLength));
  res.setHeader("ETag", etag);
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  res.send(image.pngData);
});

app.get("/api/maintenance/status", async (_req, res) => {
  try {
    res.setHeader(
      "Cache-Control",
      "public, max-age=15, s-maxage=15, stale-if-error=60",
    );
    res.json({
      ok: true,
      ...(await getMaintenanceSnapshot()),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo consultar mantenimiento.",
    });
  }
});

app.post("/api/maintenance/ack", async (req, res) => {
  const eventId = typeof req.body?.eventId === "string" ? req.body.eventId : "";
  const clientId = typeof req.body?.clientId === "string" ? req.body.clientId : "";
  const noticeType =
    typeof req.body?.noticeType === "string" ? req.body.noticeType : "";

  if (!eventId || !clientId || !noticeType) {
    res.status(400).json({
      ok: false,
      error: "eventId, clientId y noticeType son requeridos.",
    });
    return;
  }

  await acknowledgeMaintenanceNotice({ eventId, clientId, noticeType });
  res.json({ ok: true });
});

app.post("/api/auth/discord/start", async (_req, res) => {
  if (!discordClientId || !discordClientSecret) {
    res.status(503).json({
      error:
        "Discord OAuth is not configured. Add DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.",
    });
    return;
  }

  const state = randomBytes(24).toString("hex");
  await createDiscordAuthRequest(state);

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", discordClientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", discordRedirectUri);
  authorizeUrl.searchParams.set(
    "scope",
    discordGuildId ? "identify guilds.join" : "identify",
  );
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "consent");

  res.json({
    state,
    authorizeUrl: authorizeUrl.toString(),
  });
});

app.get("/api/auth/discord/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  try {
    if (!discordClientId || !discordClientSecret || !code || !state) {
      throw new Error("La autorizacion de Discord esta incompleta.");
    }

    const authRequest = await getDiscordAuthRequest(state);
    if (!authRequest || authRequest.status !== "pending") {
      throw new Error("Esta solicitud de inicio de sesion vencio.");
    }

    const tokenBody = new URLSearchParams({
      client_id: discordClientId,
      client_secret: discordClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: discordRedirectUri,
    });
    const tokenResponse = await fetch(
      "https://discord.com/api/v10/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenBody,
      },
    );
    if (!tokenResponse.ok) {
      throw new Error("Discord no pudo completar el inicio de sesion.");
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
    };
    if (!tokenData.access_token) {
      throw new Error("Discord no devolvio un token de acceso.");
    }

    const userResponse = await fetch(
      "https://discord.com/api/v10/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );
    if (!userResponse.ok) {
      throw new Error("No fue posible obtener tu perfil de Discord.");
    }

    const discordUser = (await userResponse.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };
    const user: DiscordIdentity = {
      id: discordUser.id,
      username: discordUser.username,
      displayName: discordUser.global_name || discordUser.username,
      avatarUrl: getDiscordAvatarUrl(discordUser),
    };

    if (discordGuildId) {
      const joinResponse = await fetch(
        `https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordUser.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${discordToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: tokenData.access_token,
          }),
        },
      );
      if (!joinResponse.ok && joinResponse.status !== 204) {
        console.warn(
          `Could not add Discord user ${discordUser.id} to guild: ${joinResponse.status}`,
        );
      }
    }

    const sessionToken = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
    await completeDiscordAuthRequest(
      state,
      sessionToken,
      hashSessionToken(sessionToken),
      user,
      expiresAt,
    );

    res
      .status(200)
      .type("html")
      .send(
        renderOAuthResult(
          "Discord conectado",
          `Ya puedes volver a Cloud. Tus TTML se enviaran como ${user.displayName}.`,
          true,
        ),
      );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo conectar Discord.";
    res
      .status(400)
      .type("html")
      .send(renderOAuthResult("No se pudo conectar Discord", message, false));
  }
});

app.get("/api/auth/discord/session/:state", async (req, res) => {
  const authRequest = await getDiscordAuthRequest(req.params.state);
  if (!authRequest) {
    res.status(404).json({ error: "Discord login request not found" });
    return;
  }

  if (
    authRequest.status !== "complete" ||
    !authRequest.sessionToken ||
    !authRequest.user
  ) {
    res.json({ status: "pending" });
    return;
  }

  res.json({
    status: "complete",
    token: authRequest.sessionToken,
    user: authRequest.user,
  });
});

app.get("/api/auth/discord/me", async (req, res) => {
  const user = await getAuthenticatedDiscordUser(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: "Discord session is not valid" });
    return;
  }

  res.json({ user });
});

app.get("/api/profiles/:discordId", async (req, res) => {
  const discordId = req.params.discordId;
  if (!/^\d{15,22}$/.test(discordId)) {
    res.status(400).json({ error: "Discord profile id is invalid" });
    return;
  }

  const viewer = await getAuthenticatedDiscordUser(req.headers.authorization);
  const storedProfile = await getDiscordProfile(discordId);
  const profile = discordId === viewer?.id
    ? {...viewer, biography: storedProfile?.biography ?? ""}
    : storedProfile;
  if (!profile) {
    res.status(404).json({ error: "Cloud profile was not found" });
    return;
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ profile });
});

app.get("/api/community/emojis", async (req, res) => {
  if (!client.isReady() || !discordGuildId) {
    res.status(503).json({error: "Discord community emojis are not available yet"});
    return;
  }

  try {
    const viewer = await getAuthenticatedDiscordUser(req.headers.authorization);
    if (!viewer) {
      res.status(401).json({error: "Sign in with Discord to use community emojis"});
      return;
    }
    const guild = client.guilds.cache.get(discordGuildId) ?? await client.guilds.fetch(discordGuildId);
    const member = await guild.members.fetch(viewer.id).catch(() => null);
    if (!member) {
      res.status(403).json({error: "Join the Cloud Discord server to use community emojis"});
      return;
    }
    const collection = await guild.emojis.fetch();
    const emojis = collection
      .filter((emoji) => Boolean(emoji.name) && emoji.available !== false)
      .map((emoji) => ({
        id: emoji.id,
        name: emoji.name!,
        animated: Boolean(emoji.animated),
        url: `https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=64${emoji.animated ? "&animated=true" : ""}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({emojis});
  } catch (error) {
    console.error("Could not load Discord community emojis", error);
    res.status(503).json({error: "Discord community emojis are not available"});
  }
});

app.put("/api/profiles/:discordId", async (req, res) => {
  const discordId = req.params.discordId;
  if (!/^\d{15,22}$/.test(discordId)) {
    res.status(400).json({ error: "Discord profile id is invalid" });
    return;
  }

  const viewer = await getAuthenticatedDiscordUser(req.headers.authorization);
  if (!viewer || viewer.id !== discordId) {
    res.status(403).json({ error: "Only the profile owner can edit this biography" });
    return;
  }

  if (typeof req.body?.biography !== "string") {
    res.status(400).json({ error: "Biography must be text" });
    return;
  }

  const biography = req.body.biography.replace(/\r\n?/g, "\n").trim();
  const visibleBiography = biography.replace(/<(?:a?):[A-Za-z0-9_]{1,32}:\d{15,22}>/g, "\uFFFC");
  const biographyLength = Array.from(
    new Intl.Segmenter("es", {granularity: "grapheme"}).segment(visibleBiography),
  ).length;
  if (biographyLength > 100) {
    res.status(400).json({ error: "Biography cannot exceed 100 characters" });
    return;
  }

  await updateDiscordBiography(discordId, biography);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({profile: {...viewer, biography}});
});

app.get("/api/profiles/:discordId/contributions", async (req, res) => {
  const discordId = req.params.discordId;
  if (!/^\d{15,22}$/.test(discordId)) {
    res.status(400).json({ error: "Discord profile id is invalid" });
    return;
  }

  const profile = await getDiscordProfile(discordId);
  if (!profile) {
    res.status(404).json({ error: "Cloud profile was not found" });
    return;
  }

  const submissions = await getApprovedSubmissionsBySubmitter(discordId);
  const playCounts = await getTtmlPlayCounts(
    submissions.map((submission) => submission.id),
  );
  const contributions = submissions.map((submission) => ({
    id: submission.id,
    title: submission.song.title,
    artist: submission.song.artist,
    coverUrl: submission.song.coverUrl,
    createdAt: submission.createdAt,
    plays: playCounts.get(submission.id) ?? 0,
  }));

  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ count: contributions.length, contributions });
});

app.post("/api/ttml/:submissionId/play", async (req, res) => {
  const submissionId = req.params.submissionId;
  const playId = typeof req.body?.playId === "string" ? req.body.playId : "";
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(playId)) {
    res.status(400).json({ error: "Anonymous play id is invalid" });
    return;
  }

  const plays = await recordTtmlPlay(submissionId, playId);
  if (plays === null) {
    res.status(404).json({ error: "Approved TTML was not found" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({ recorded: true, plays });
});

app.post("/api/ttml/review", upload.single("ttml"), async (req, res) => {
  try {
    if (!client.isReady()) {
      res.status(503).json({ error: "Discord bot is not ready yet" });
      return;
    }

    const maintenance = await getMaintenanceSnapshot();
    if (maintenance.lyrics.active) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.status(503).json({
        error: "Community TTML is under maintenance",
        code: "COMMUNITY_TTML_MAINTENANCE",
        maintenance: maintenance.lyrics.active,
      });
      return;
    }

    const submitter = await getAuthenticatedDiscordUser(
      req.headers.authorization,
    );
    if (!submitter) {
      res.status(401).json({
        error: "Inicia sesion con Discord antes de enviar un TTML.",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Missing TTML file" });
      return;
    }

    const song = parseSongPayload(req.body.song);
    const ttmlContent =
      typeof req.body.ttmlContent === "string"
        ? req.body.ttmlContent
        : req.file.buffer.toString("utf8");

    const submission: TTMLSubmission = {
      id: createSubmissionId(),
      song,
      fileName: req.file.originalname || `${song.artist}-${song.title}.ttml`,
      ttmlContent,
      status: "pending",
      createdAt: Date.now(),
      submitter,
    };

    await saveSubmission(submission);
    await publishSubmission(submission);

    res.status(201).json(toReviewResponse(submission));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.get("/api/ttml/approved", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const artist =
    typeof req.query.artist === "string" ? req.query.artist.trim() : "";
  const title =
    typeof req.query.title === "string" ? req.query.title.trim() : "";
  const durationValue =
    typeof req.query.duration === "string"
      ? Number(req.query.duration)
      : undefined;
  const duration =
    durationValue !== undefined && Number.isFinite(durationValue)
      ? durationValue
      : undefined;

  if (!artist || !title) {
    res.status(400).json({ error: "Artist and title are required" });
    return;
  }

  const maintenance = await getMaintenanceSnapshot();
  if (maintenance.lyrics.active) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.status(503).json({
      error: "Community TTML is under maintenance",
      code: "COMMUNITY_TTML_MAINTENANCE",
      maintenance: maintenance.lyrics.active,
    });
    return;
  }

  const submission = await getApprovedSubmission(artist, title, duration);

  if (!submission) {
    res.status(404).json({ error: "Approved TTML not found" });
    return;
  }

  const [moderator, synchronizer] = await Promise.all([
    resolveCurrentCreditIdentity(
      submission.moderator
        ? {
            id: submission.moderator.id,
            name: submission.moderator.name,
            avatarUrl: submission.moderator.avatarUrl,
          }
        : undefined,
    ),
    submission.submitter
      ? resolveCurrentDiscordIdentity(submission.submitter).then((identity) => ({
          id: identity.id,
          name: identity.displayName,
          avatarUrl: identity.avatarUrl,
        }))
      : undefined,
  ]);

  res.json({
    id: submission.id,
    artist: submission.song.artist,
    title: submission.song.title,
    duration: submission.song.duration,
    fileName: submission.fileName,
    ttmlContent: submission.ttmlContent,
    approvedAt: submission.createdAt,
    moderator,
    synchronizer,
  });
});

app.get("/api/discord/identities", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const ids = (typeof req.query.ids === "string" ? req.query.ids : "")
    .split(",")
    .map((id) => id.trim())
    .filter((id, index, all) => /^\d{15,24}$/.test(id) && all.indexOf(id) === index)
    .slice(0, 20);

  if (ids.length === 0) {
    res.status(400).json({ error: "At least one valid Discord user id is required" });
    return;
  }

  const identities = await Promise.all(
    ids.map(async (id) => {
      const identity = await resolveCurrentDiscordIdentity({
        id,
        username: id,
        displayName: id,
      });
      return identity.displayName === id
        ? null
        : {
            id: identity.id,
            name: identity.displayName,
            avatarUrl: identity.avatarUrl,
          };
    }),
  );

  res.json({ identities: identities.filter(Boolean) });
});

app.get("/api/ttml/review/:submissionId", async (req, res) => {
  const submission = await getSubmission(req.params.submissionId);

  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  res.json(toReviewResponse(submission));
});

client.on("clientReady", () => {
  console.log(`Cloud TTML bot connected as ${client.user?.tag}`);
  void registerSlashCommands().catch((error) => {
    console.error("Could not register slash commands:", error);
  });
  void refreshPendingReviewMessages();
  void ensureCommunityAnnouncementsRoleMessage().catch((error) => {
    console.error(
      "Could not prepare community announcements reaction role:",
      error,
    );
  });
  void refreshArtworkReportDiscordMessages();
  startArtworkReportDiscordRecovery();
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot || !communityAnnouncementsMessageId) return;

  try {
    const completeReaction = reaction.partial
      ? await reaction.fetch()
      : reaction;
    const message = completeReaction.message.partial
      ? await completeReaction.message.fetch()
      : completeReaction.message;
    if (
      !isCommunityAnnouncementsReaction(
        {
          channelId: discordCommunityAnnouncementsChannelId,
          messageId: communityAnnouncementsMessageId,
          emojiId: discordCommunityAnnouncementsEmojiId,
        },
        {
          channelId: message.channelId,
          messageId: message.id,
          emojiId: completeReaction.emoji.id,
        },
      )
    ) {
      return;
    }

    const guild = message.guild;
    if (!guild) return;
    const member = await guild.members.fetch(user.id);
    if (!member.roles.cache.has(discordCommunityAnnouncementsRoleId)) {
      await member.roles.add(
        discordCommunityAnnouncementsRoleId,
        "Reaccionó al mensaje de anuncios comunitarios de Cloud",
      );
      console.log(
        `Community announcements role assigned to Discord user ${user.id}`,
      );
    }
  } catch (error) {
    console.error("Could not assign community announcements role:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (
        interaction.commandName === "daily" &&
        interaction.options.getSubcommand() === "stats"
      ) {
        await handleDailyStatsCommand(interaction);
        return;
      }

      if (
        interaction.commandName === "say" &&
        interaction.options.getSubcommand() === "hi"
      ) {
        const selection = pickRandomGreeting(previousGreetingIndex);
        previousGreetingIndex = selection.index;
        const availableEmojis = client.emojis.cache
          .filter(
            (emoji) =>
              Boolean(emoji.name) &&
              greetingEmojiNames.includes(
                emoji.name as (typeof greetingEmojiNames)[number],
              ),
          )
          .map((emoji) => ({
            name: emoji.name!,
            markup: emoji.toString(),
          }));
        const emoji = pickRandomGreetingEmoji(
          availableEmojis,
          previousGreetingEmojiName,
        );
        previousGreetingEmojiName = emoji?.name;
        await interaction.reply(
          `${selection.greeting.text}${emoji ? ` ${emoji.markup}` : ""}`,
        );
        console.log(
          `/say hi used by Discord user ${interaction.user.id}: ${selection.greeting.language}, emoji=${emoji?.name ?? "none"}`,
        );
        return;
      }

      if (
        interaction.commandName === "cover" &&
        interaction.options.getSubcommand() === "upload"
      ) {
        await handleCoverUploadCommand(interaction);
        return;
      }

      if (
        (interaction.commandName === "app" ||
          interaction.commandName === "abp") &&
        interaction.options.getSubcommand() === "upload"
      ) {
        await handleArtistMediaUploadCommand(
          interaction,
          interaction.commandName === "app" ? "avatar" : "banner",
        );
        return;
      }

      if (interaction.commandName === "delete-all-ttmls") {
        await handleDeleteAllCommand(interaction);
        return;
      }

      if (interaction.commandName === "maintenance") {
        await handleMaintenanceCommand(interaction, "lyrics");
        return;
      }

      if (interaction.commandName === "maintenance-global") {
        await handleMaintenanceCommand(interaction, "global");
        return;
      }

      if (
        interaction.commandName === "restore" &&
        interaction.options.getSubcommandGroup(false) === "ttml" &&
        interaction.options.getSubcommand() === "backup"
      ) {
        await handleRestoreTtmlBackupCommand(interaction);
        return;
      }

      if (
        interaction.commandName === "delete" &&
        interaction.options.getSubcommand() === "ttml"
      ) {
        await handleDeleteTtmlCommand(interaction);
        return;
      }
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith(`${interactionPrefix}cover-select:`)
    ) {
      await handleCoverSelection(interaction);
      return;
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith(
        `${interactionPrefix}artist-media-select:`,
      )
    ) {
      await handleArtistMediaSelection(interaction);
      return;
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(`${interactionPrefix}artwork:`)
    ) {
      await handleArtworkReportButton(interaction);
      return;
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(interactionPrefix)
    ) {
      if (interaction.customId.includes(":delete-confirm:")) {
        await handleDeleteConfirmationButton(interaction);
      } else if (interaction.customId.includes(":delete-ttml-")) {
        await handleDeleteTtmlButton(interaction);
      } else {
        await handleReviewButton(interaction);
      }
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith(interactionPrefix)
    ) {
      if (interaction.customId.includes(":delete-modal:")) {
        await handleDeleteConfirmationModal(interaction);
      } else {
        await handleReviewModal(interaction);
      }
    }
  } catch (error) {
    console.error(error);

    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({
        content: "Ocurrio un error procesando esta revision.",
        ephemeral: true,
      });
    }
  }
});

const server = app.listen(port, () => {
  console.log(`Cloud TTML review API listening on http://localhost:${port}`);
});

async function bootstrapBackendDependencies() {
  if (backendBootstrapRunning || backendBootstrapReady) return;
  backendBootstrapRunning = true;
  backendBootstrapError = null;
  try {
    await initializeSubmissionStore();
    await initializeArtworkReportStore();
    await registerSlashCommands().catch((error) => {
      console.error("Could not register slash commands before login:", error);
    });
    if (!client.isReady()) await client.login(discordToken);
    backendBootstrapReady = true;
    console.log("Cloud backend dependencies are ready");
  } catch (error) {
    backendBootstrapError =
      error instanceof Error ? error.message : "Unknown bootstrap error";
    console.error(
      "Cloud backend dependencies failed to initialize; retrying in 15 seconds:",
      error,
    );
    backendBootstrapTimer = setTimeout(() => {
      backendBootstrapTimer = undefined;
      void bootstrapBackendDependencies();
    }, 15_000);
  } finally {
    backendBootstrapRunning = false;
  }
}

const discordIdentityCache = new Map<
  string,
  { identity: DiscordIdentity; expiresAt: number }
>();
const DISCORD_IDENTITY_CACHE_MS = 5 * 60 * 1000;

async function resolveCurrentDiscordIdentity(
  snapshot: DiscordIdentity,
): Promise<DiscordIdentity> {
  const cached = discordIdentityCache.get(snapshot.id);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;
  if (!client.isReady()) return snapshot;

  try {
    const user = await client.users.fetch(snapshot.id, { force: true });
    const identity = discordIdentityFromUser(user);
    discordIdentityCache.set(snapshot.id, {
      identity,
      expiresAt: Date.now() + DISCORD_IDENTITY_CACHE_MS,
    });
    return identity;
  } catch {
    // The saved identity is intentionally retained as an offline/deleted-user
    // fallback so a contribution can never lose its attribution.
    return snapshot;
  }
}

async function resolveCurrentCreditIdentity(
  snapshot:
    | { id: string; name: string; avatarUrl?: string }
    | undefined,
) {
  if (!snapshot) return undefined;
  const current = await resolveCurrentDiscordIdentity({
    id: snapshot.id,
    username: snapshot.name,
    displayName: snapshot.name,
    avatarUrl: snapshot.avatarUrl,
  });
  return {
    id: current.id,
    name: current.displayName,
    avatarUrl: current.avatarUrl ?? snapshot.avatarUrl,
  };
}

void bootstrapBackendDependencies();

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Closing Cloud TTML bot.`);
  if (artworkDiscordRecoveryTimer) {
    clearInterval(artworkDiscordRecoveryTimer);
  }
  if (backendBootstrapTimer) clearTimeout(backendBootstrapTimer);
  server.close();
  client.destroy();
  await Promise.all([
    closeSubmissionStore(),
    closeArtworkReportStore(),
  ]);
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
