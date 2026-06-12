import "dotenv/config";
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

type SubmissionStatus = "pending" | "approved" | "rejected";

type SongPayload = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  audioUrl?: string;
  submittedAt?: string;
};

type TTMLSubmission = {
  id: string;
  song: SongPayload;
  fileName: string;
  ttmlContent: string;
  status: SubmissionStatus;
  createdAt: number;
  messageId?: string;
  channelId?: string;
  moderator?: {
    id: string;
    name: string;
    comment: string;
  };
};

const token = process.env.DISCORD_TOKEN;
const reviewChannelId = process.env.DISCORD_REVIEW_CHANNEL_ID;
const port = Number(process.env.PORT ?? 8787);
const cloudAppOrigin = process.env.CLOUD_APP_ORIGIN ?? "http://localhost:3000";

if (!token) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

if (!reviewChannelId) {
  throw new Error("Missing DISCORD_REVIEW_CHANNEL_ID in .env");
}

const discordToken = token;
const discordReviewChannelId = reviewChannelId;

const submissions = new Map<string, TTMLSubmission>();

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
    origin: cloudAppOrigin,
  }),
);
app.use(express.json());

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
      .setCustomId(`ttml:approve:${submissionId}`)
      .setLabel("Aprobar")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`ttml:reject:${submissionId}`)
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
  submissions.set(submission.id, submission);
}

function buildReviewModal(
  submission: TTMLSubmission,
  action: "approve" | "reject",
) {
  const modal = new ModalBuilder()
    .setCustomId(`ttml:${action}:modal:${submission.id}`)
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
  const [, action, submissionId] = interaction.customId.split(":");
  const submission = submissions.get(submissionId);

  if (!submission) {
    await interaction.reply({
      content: "No encontre esta revision en memoria.",
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

async function handleReviewModal(interaction: ModalSubmitInteraction) {
  const [, action, , submissionId] = interaction.customId.split(":");
  const submission = submissions.get(submissionId);

  if (!submission) {
    await interaction.reply({
      content: "No encontre esta revision en memoria.",
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
  submissions.set(submission.id, submission);

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

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    botReady: client.isReady(),
    submissions: submissions.size,
  });
});

app.post("/api/ttml/review", upload.single("ttml"), async (req, res) => {
  try {
    if (!client.isReady()) {
      res.status(503).json({ error: "Discord bot is not ready yet" });
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
    };

    submissions.set(submission.id, submission);
    await publishSubmission(submission);

    res.status(201).json(toReviewResponse(submission));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.get("/api/ttml/review/:submissionId", (req, res) => {
  const submission = submissions.get(req.params.submissionId);

  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  res.json(toReviewResponse(submission));
});

client.on("ready", () => {
  console.log(`Cloud TTML bot connected as ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId.startsWith("ttml:")) {
      await handleReviewButton(interaction);
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("ttml:")
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

await client.login(discordToken);

app.listen(port, () => {
  console.log(`Cloud TTML review API listening on http://localhost:${port}`);
});
