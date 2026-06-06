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
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  type ModalSubmitInteraction,
  type TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  closeSubmissionStore,
  completeDiscordAuthRequest,
  countSubmissions,
  createDiscordAuthRequest,
  getApprovedSubmission,
  getDiscordAuthRequest,
  getDiscordSession,
  getPendingSubmissions,
  getSubmission,
  initializeSubmissionStore,
  isDatabaseEnabled,
  saveSubmission,
  type DiscordIdentity,
  type SongPayload,
  type TTMLSubmission,
} from "./submission-store.js";

const token = process.env.DISCORD_TOKEN;
const reviewChannelId = process.env.DISCORD_REVIEW_CHANNEL_ID;
const port = Number(process.env.PORT ?? 8787);
const discordClientId = process.env.DISCORD_CLIENT_ID;
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
const discordGuildId = process.env.DISCORD_GUILD_ID;
const publicBaseUrl = (
  process.env.PUBLIC_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`)
).replace(/\/+$/, "");
const discordRedirectUri =
  process.env.DISCORD_REDIRECT_URI ||
  `${publicBaseUrl}/api/auth/discord/callback`;
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

function renderOAuthResult(title: string, message: string, success: boolean) {
  const color = success ? "#a7f3d0" : "#fecaca";
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111114; color: white; font: 16px system-ui, sans-serif; }
      main { width: min(460px, calc(100vw - 40px)); text-align: center; }
      h1 { color: ${color}; margin-bottom: 10px; }
      p { color: rgba(255,255,255,.7); line-height: 1.55; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;
}

function createSubmissionId() {
  return `ttml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

client.on("ready", () => {
  console.log(`Cloud TTML bot connected as ${client.user?.tag}`);
  void refreshPendingReviewMessages();
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (
      interaction.isButton() &&
      interaction.customId.startsWith(interactionPrefix)
    ) {
      await handleReviewButton(interaction);
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith(interactionPrefix)
    ) {
      await handleReviewModal(interaction);
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
