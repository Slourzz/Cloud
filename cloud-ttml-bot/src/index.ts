import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import cors from "cors";
import express from "express";
import multer from "multer";
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
  ModalBuilder,
  type ModalSubmitInteraction,
  REST,
  Routes,
  type TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { buildCommandDefinitions } from "./slash-commands.js";
import {
  closeSubmissionStore,
  completeDiscordAuthRequest,
  countSubmissions,
  createDiscordAuthRequest,
  createMaintenanceEvent,
  deleteAllCommunityTtmlsWithBackup,
  endMaintenanceEvent,
  getMaintenanceSnapshot,
  getApprovedSubmission,
  getDiscordAuthRequest,
  getDiscordSession,
  getPendingSubmissions,
  getSubmission,
  initializeSubmissionStore,
  isDatabaseEnabled,
  saveSubmission,
  acknowledgeMaintenanceNotice,
  type DiscordIdentity,
  type MaintenanceType,
  type SongPayload,
  type TTMLSubmission,
} from "./submission-store.js";

const token = process.env.DISCORD_TOKEN;
const reviewChannelId = process.env.DISCORD_REVIEW_CHANNEL_ID;
const port = Number(process.env.PORT ?? 8787);
const discordClientId = process.env.DISCORD_CLIENT_ID;
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
const discordGuildId = process.env.DISCORD_GUILD_ID;
const discordOwnerUserId = process.env.DISCORD_OWNER_USER_ID;
const discordCreatorRoleId = process.env.DISCORD_CREATOR_ROLE_ID;
const publicBaseUrl = (
  process.env.PUBLIC_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`)
).replace(/\/+$/, "");
const discordRedirectUri =
  process.env.DISCORD_REDIRECT_URI ||
  `${publicBaseUrl}/api/auth/discord/callback`;
let slashCommandsRegistered = false;
const configuredOrigins = (
  process.env.CLOUD_APP_ORIGINS ??
  process.env.CLOUD_APP_ORIGIN ??
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
  ...configuredOrigins,
]);

if (!token) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

if (!reviewChannelId) {
  throw new Error("Missing DISCORD_REVIEW_CHANNEL_ID in .env");
}

const discordToken = token;
const discordReviewChannelId = reviewChannelId;
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
  intents: [GatewayIntentBits.Guilds],
});

const pendingDeleteConfirmations = new Map<
  string,
  {
    actor: DiscordIdentity;
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
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  }),
);
app.use(express.json());

function hashSessionToken(tokenValue: string) {
  return createHash("sha256").update(tokenValue).digest("hex");
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
  interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
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

function interactionRoleIds(
  interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
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

  console.log(
    `Cloud slash command bootstrap: clientId=${discordClientId ? "yes" : "no"} guildId=${discordGuildId || "global"}`,
  );

  if (!discordClientId) {
    console.warn("DISCORD_CLIENT_ID is not configured. Slash commands skipped.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(discordToken);
  const body = buildCommandDefinitions();
  console.log(
    `Cloud slash commands registering: ${body
      .map((command) => command.name)
      .join(", ")}`,
  );
  if (discordGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(discordClientId, discordGuildId),
      { body },
    );
    console.log(
      `Cloud slash commands registered for guild ${discordGuildId}: ${body
        .map((command) => command.name)
        .join(", ")}`,
    );
  } else {
    await rest.put(Routes.applicationCommands(discordClientId), { body });
    console.log(
      `Cloud slash commands registered globally: ${body
        .map((command) => command.name)
        .join(", ")}`,
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

app.get("/health", async (_req, res) => {
  try {
    res.json({
      ok: true,
      botReady: client.isReady(),
      database: isDatabaseEnabled() ? "postgresql" : "memory",
      submissions: await countSubmissions(),
      interactionProtocol: "railwayreview-v3",
      interactionNamespace,
      discordOAuth: Boolean(discordClientId && discordClientSecret),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(503).json({
      ok: false,
      botReady: client.isReady(),
      database: "unavailable",
      error: message,
    });
  }
});

app.get("/api/maintenance/status", async (_req, res) => {
  try {
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

app.post("/api/ttml/review", upload.single("ttml"), async (req, res) => {
  try {
    if (!client.isReady()) {
      res.status(503).json({ error: "Discord bot is not ready yet" });
      return;
    }

    const maintenance = await getMaintenanceSnapshot();
    if (maintenance.lyrics.active) {
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

  res.json({
    id: submission.id,
    artist: submission.song.artist,
    title: submission.song.title,
    duration: submission.song.duration,
    fileName: submission.fileName,
    ttmlContent: submission.ttmlContent,
    approvedAt: submission.createdAt,
    moderator: submission.moderator?.name,
    synchronizer: submission.submitter
      ? {
          id: submission.submitter.id,
          name: submission.submitter.displayName,
          avatarUrl: submission.submitter.avatarUrl,
        }
      : undefined,
  });
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
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
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
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(interactionPrefix)
    ) {
      if (interaction.customId.includes(":delete-confirm:")) {
        await handleDeleteConfirmationButton(interaction);
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

await initializeSubmissionStore();
await registerSlashCommands().catch((error) => {
  console.error("Could not register slash commands before login:", error);
});
await client.login(discordToken);

const server = app.listen(port, () => {
  console.log(`Cloud TTML review API listening on http://localhost:${port}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Closing Cloud TTML bot.`);
  server.close();
  client.destroy();
  await closeSubmissionStore();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
