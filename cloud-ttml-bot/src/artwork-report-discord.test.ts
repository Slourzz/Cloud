import assert from "node:assert/strict";
import { test } from "node:test";
import { ChannelType } from "discord.js";
import {
  buildArtworkAnnouncementEmbed,
  buildArtworkReportButtons,
  buildArtworkReportEmbed,
  buildCommunityAnnouncementsRoleEmbed,
  isCommunityAnnouncementsReaction,
  isSupportedArtworkChannelType,
  parseArtworkReportCustomId,
} from "./artwork-report-discord.js";
import type {
  ArtworkReport,
  SongArtworkMapping,
} from "./artwork-reports.js";

const report: ArtworkReport = {
  id: "report-1",
  songId: "song-1",
  reporterUserId: "user-1",
  song: { title: "Dark Beach", artist: "Pastel Ghost", album: "Abyss" },
  currentAppleMusicUrl:
    "https://music.apple.com/mx/album/old/100?i=101",
  suggestedAppleUrl:
    "https://music.apple.com/mx/album/dark-beach/123?i=456",
  reason: "wrong_song",
  status: "pending",
  createdAt: "2026-07-29T00:00:00.000Z",
};

const mapping: SongArtworkMapping = {
  songId: "song-1",
  source: "apple",
  appleTrackId: 456,
  artworkUrl: "https://is1-ssl.mzstatic.com/image/1200x1200bb.jpg",
  appleMusicUrl:
    "https://music.apple.com/mx/album/dark-beach/123?i=456",
  confidenceScore: 1_000,
  coverVerified: true,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

test("moderation buttons use the namespaced artwork protocol", () => {
  const row = buildArtworkReportButtons("cloud:test:", report).toJSON();
  assert.equal(row.components[0]?.label, "Aplicar portada");
  assert.equal(row.components[1]?.label, "Enlace incorrecto");
  assert.deepEqual(
    parseArtworkReportCustomId(
      "cloud:test:",
      row.components[0]?.custom_id ?? "",
    ),
    { action: "approve", reportId: "report-1" },
  );
});

test("public cover announcements support Discord announcement channels", () => {
  assert.equal(
    isSupportedArtworkChannelType("reports", ChannelType.GuildText),
    true,
  );
  assert.equal(
    isSupportedArtworkChannelType(
      "public",
      ChannelType.GuildAnnouncement,
    ),
    true,
  );
  assert.equal(
    isSupportedArtworkChannelType("public", ChannelType.GuildForum),
    false,
  );
});

test("community announcements embed exposes the reaction role", () => {
  const json = buildCommunityAnnouncementsRoleEmbed({
    roleId: "role-1",
    emojiId: "emoji-1",
  }).toJSON();
  assert.equal(json.title, "Anuncios comunitarios!");
  assert.match(
    json.description ?? "",
    /Reacciona a este mensaje para obtener novedades de la comunidad/,
  );
  assert.match(json.description ?? "", /<a:a_cat_eating:emoji-1>/);
  assert.match(json.description ?? "", /<@&role-1>/);
});

test("reaction role accepts only the configured message and emoji", () => {
  const expected = {
    channelId: "channel-1",
    messageId: "message-1",
    emojiId: "emoji-1",
  };
  assert.equal(
    isCommunityAnnouncementsReaction(expected, {
      channelId: "channel-1",
      messageId: "message-1",
      emojiId: "emoji-1",
    }),
    true,
  );
  assert.equal(
    isCommunityAnnouncementsReaction(expected, {
      channelId: "channel-1",
      messageId: "message-1",
      emojiId: "another-emoji",
    }),
    false,
  );
});

test("private report embed includes required moderation data", () => {
  const json = buildArtworkReportEmbed(report).toJSON();
  const fields = new Map(json.fields?.map((field) => [field.name, field.value]));
  assert.equal(fields.get("Canción"), "Dark Beach");
  assert.equal(fields.get("Artista"), "Pastel Ghost");
  assert.equal(
    fields.get("Enlace sugerido"),
    report.suggestedAppleUrl,
  );
  assert.equal(fields.get("Estado"), "⏳ Pendiente");
});

test("public announcement links the verified Apple Music track", () => {
  const json = buildArtworkAnnouncementEmbed(report, mapping).toJSON();
  assert.equal(json.title, "🖼️ Portada actualizada");
  assert.match(json.description ?? "", /Ver en Apple Music/);
  assert.equal(json.url, mapping.appleMusicUrl);
  assert.equal(json.thumbnail?.url, mapping.artworkUrl);
});
