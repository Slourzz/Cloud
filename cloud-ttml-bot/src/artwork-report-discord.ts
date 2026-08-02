import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import type {
  ArtworkReport,
  SongArtworkMapping,
} from "./artwork-reports.js";

const REASON_LABELS: Record<ArtworkReport["reason"], string> = {
  wrong_song: "No corresponde a esta canción",
  wrong_version: "Es otra versión de la canción",
  wrong_artist: "Artista incorrecto",
  outdated: "Portada desactualizada",
  other: "Otro",
};

export function isSupportedArtworkChannelType(
  kind: "reports" | "public",
  channelType: ChannelType,
) {
  return kind === "reports"
    ? channelType === ChannelType.GuildText
    : channelType === ChannelType.GuildText ||
        channelType === ChannelType.GuildAnnouncement;
}

export function buildCommunityAnnouncementsRoleEmbed(input: {
  roleId: string;
  emojiId: string;
}) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Anuncios comunitarios!")
    .setDescription(
      [
        "Reacciona a este mensaje para obtener novedades de la comunidad",
        "",
        `- <a:a_cat_eating:${input.emojiId}> <@&${input.roleId}>`,
      ].join("\n"),
    )
    .setFooter({ text: "Cloud · Rol de anuncios comunitarios" });
}

export function isCommunityAnnouncementsReaction(
  expected: {
    channelId: string;
    messageId: string;
    emojiId: string;
  },
  received: {
    channelId: string;
    messageId: string;
    emojiId?: string | null;
  },
) {
  return (
    received.channelId === expected.channelId &&
    received.messageId === expected.messageId &&
    received.emojiId === expected.emojiId
  );
}

function safeEmbedValue(value: string | undefined, fallback = "No disponible") {
  const cleaned = value?.trim().replaceAll("@", "@\u200b");
  return cleaned ? cleaned.slice(0, 1_000) : fallback;
}

export function buildArtworkReportCustomId(
  interactionPrefix: string,
  action: "approve" | "reject",
  reportId: string,
) {
  return `${interactionPrefix}artwork:${action}:${reportId}`;
}

export function parseArtworkReportCustomId(
  interactionPrefix: string,
  customId: string,
) {
  if (!customId.startsWith(`${interactionPrefix}artwork:`)) return null;
  const [kind, action, reportId, ...extra] = customId
    .slice(interactionPrefix.length)
    .split(":");
  if (
    kind !== "artwork" ||
    (action !== "approve" && action !== "reject") ||
    !reportId ||
    extra.length > 0
  ) {
    return null;
  }
  return { action, reportId } as const;
}

export function buildArtworkReportButtons(
  interactionPrefix: string,
  report: ArtworkReport,
) {
  const disabled = report.status !== "pending";
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        buildArtworkReportCustomId(
          interactionPrefix,
          "approve",
          report.id,
        ),
      )
      .setEmoji("✅")
      .setLabel("Aplicar portada")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(
        buildArtworkReportCustomId(
          interactionPrefix,
          "reject",
          report.id,
        ),
      )
      .setEmoji("❌")
      .setLabel("Enlace incorrecto")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

export function buildArtworkReportEmbed(
  report: ArtworkReport,
  mapping?: SongArtworkMapping | null,
) {
  const statusText =
    report.status === "approved"
      ? `✅ Aprobado por <@${report.reviewedByUserId}>`
      : report.status === "rejected"
        ? `❌ Rechazado por <@${report.reviewedByUserId}>`
        : "⏳ Pendiente";
  const embed = new EmbedBuilder()
    .setColor(
      report.status === "approved"
        ? 0x57f287
        : report.status === "rejected"
          ? 0xed4245
          : 0x9b59b6,
    )
    .setTitle("🖼️ Reporte de portada incorrecta")
    .addFields(
      {
        name: "Canción",
        value: safeEmbedValue(report.song.title),
        inline: true,
      },
      {
        name: "Artista",
        value: safeEmbedValue(report.song.artist),
        inline: true,
      },
      {
        name: "Motivo",
        value: REASON_LABELS[report.reason],
      },
      {
        name: "Enlace actual de Apple Music",
        value: safeEmbedValue(report.currentAppleMusicUrl),
      },
      {
        name: "Enlace sugerido",
        value: safeEmbedValue(report.suggestedAppleUrl),
      },
      {
        name: "Estado",
        value: statusText,
      },
    )
    .setFooter({ text: `Cloud · Reporte ${report.id}` })
    .setTimestamp(new Date(report.createdAt));

  if (report.song.album) {
    embed.addFields({
      name: "Álbum",
      value: safeEmbedValue(report.song.album),
      inline: true,
    });
  }
  if (report.comment) {
    embed.addFields({
      name: "Comentario",
      value: safeEmbedValue(report.comment),
    });
  }
  embed.addFields({
    name: "Reportado por",
    value: `<@${report.reporterUserId}>`,
  });

  const artworkUrl = mapping?.artworkUrl ?? report.currentArtworkUrl;
  if (artworkUrl?.startsWith("https://")) embed.setThumbnail(artworkUrl);
  return embed;
}

export function buildArtworkAnnouncementEmbed(
  report: ArtworkReport,
  mapping: SongArtworkMapping,
) {
  return new EmbedBuilder()
    .setColor(0xfa2d48)
    .setTitle("🖼️ Portada actualizada")
    .addFields(
      {
        name: "Canción",
        value: safeEmbedValue(report.song.title),
        inline: true,
      },
      {
        name: "Artista",
        value: safeEmbedValue(report.song.artist),
        inline: true,
      },
    )
    .setDescription(
      `Ahora utiliza la portada oficial de Apple Music.\n[Ver en Apple Music](${mapping.appleMusicUrl})`,
    )
    .setThumbnail(mapping.artworkUrl)
    .setURL(mapping.appleMusicUrl)
    .setTimestamp();
}
