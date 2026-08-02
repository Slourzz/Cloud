import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  ArtworkReportAlreadyReviewedError,
  ArtworkReportDuplicateError,
  ArtworkReportPermissionError,
  ArtworkReportValidationError,
  createArtworkReport,
  extractAppleTrackId,
  getSongArtworkMapping,
  isOfficialAppleUrl,
  lookupAppleTrack,
  resetArtworkReportMemoryForTests,
  reviewArtworkReport,
  setArtworkReportDiscordMessage,
  setArtworkReportPublicMessage,
  validateCreateArtworkReport,
} from "./artwork-reports.js";

const baseInput = {
  songId: "song-1",
  reporterUserId: "user-1",
  title: "Dark Beach",
  artist: "Pastel Ghost",
  suggestedAppleUrl:
    "https://music.apple.com/mx/album/dark-beach/123?i=456",
  reason: "wrong_song" as const,
};

beforeEach(() => resetArtworkReportMemoryForTests());

test("only exact official HTTPS Apple hosts are accepted", () => {
  assert.equal(
    isOfficialAppleUrl(
      "https://music.apple.com/mx/album/dark-beach/123?i=456",
    ),
    true,
  );
  assert.equal(isOfficialAppleUrl("https://itunes.apple.com/mx/id456"), true);
  assert.equal(
    isOfficialAppleUrl("https://music.apple.com.ejemplo.com/mx/id456"),
    false,
  );
  assert.equal(isOfficialAppleUrl("http://music.apple.com/mx/id456"), false);
});

test("extracts trackId from canonical Apple Music song links", () => {
  assert.equal(
    extractAppleTrackId(
      "https://music.apple.com/es/song/doyalike/1817377461",
    ),
    1817377461,
  );
  assert.equal(
    extractAppleTrackId(
      "https://music.apple.com/mx/album/doyalike/1817377460",
    ),
    undefined,
  );
});

test("approval lookup obtains the official trackId and high resolution artwork", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        results: [
          {
            trackId: 456,
            collectionId: 123,
            artworkUrl100:
              "https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg",
            trackViewUrl:
              "https://music.apple.com/mx/album/dark-beach/123?i=456",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  try {
    const resolved = await lookupAppleTrack(baseInput.suggestedAppleUrl);
    assert.match(requestedUrl, /itunes\.apple\.com\/lookup/);
    assert.match(requestedUrl, /id=456/);
    assert.equal(resolved.appleTrackId, 456);
    assert.equal(resolved.appleCollectionId, 123);
    assert.match(resolved.artworkUrl, /1200x1200bb/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("comments are limited to 500 characters", () => {
  assert.equal(
    validateCreateArtworkReport({
      ...baseInput,
      comment: "a".repeat(500),
    }).comment?.length,
    500,
  );
  assert.throws(
    () =>
      validateCreateArtworkReport({
        ...baseInput,
        comment: "a".repeat(501),
      }),
    ArtworkReportValidationError,
  );
});

test("a suggested official Apple Music link is required", () => {
  assert.throws(
    () =>
      validateCreateArtworkReport({
        ...baseInput,
        suggestedAppleUrl: "",
      }),
    ArtworkReportValidationError,
  );
  assert.throws(
    () =>
      validateCreateArtworkReport({
        ...baseInput,
        suggestedAppleUrl: "https://example.com/cover.png",
      }),
    ArtworkReportValidationError,
  );
});

test("a user cannot create two pending reports for the same song", async () => {
  await createArtworkReport(baseInput);
  await assert.rejects(
    () => createArtworkReport(baseInput),
    ArtworkReportDuplicateError,
  );
});

test("a reviewer cannot approve their own report", async () => {
  const report = await createArtworkReport(baseInput);
  await assert.rejects(
    () =>
      reviewArtworkReport({
        reportId: report.id,
        reviewerUserId: baseInput.reporterUserId,
        status: "approved",
        resolvedTrack: {
          appleTrackId: 456,
          artworkUrl: "https://is1-ssl.mzstatic.com/image/1200x1200bb.jpg",
          appleMusicUrl:
            "https://music.apple.com/mx/album/dark-beach/123?i=456",
        },
      }),
    ArtworkReportPermissionError,
  );
});

test("the configured owner can explicitly review their own report", async () => {
  const report = await createArtworkReport(baseInput);
  const result = await reviewArtworkReport({
    reportId: report.id,
    reviewerUserId: baseInput.reporterUserId,
    status: "approved",
    allowSelfReview: true,
    resolvedTrack: {
      appleTrackId: 456,
      artworkUrl: "https://is1-ssl.mzstatic.com/image/1200x1200bb.jpg",
      appleMusicUrl:
        "https://music.apple.com/mx/album/dark-beach/123?i=456",
    },
  });
  assert.equal(result.report.status, "approved");
  assert.equal(result.mapping?.verifiedByUserId, baseInput.reporterUserId);
});

test("approval creates a verified Apple mapping atomically in the store", async () => {
  const report = await createArtworkReport(baseInput);
  const result = await reviewArtworkReport({
    reportId: report.id,
    reviewerUserId: "moderator-1",
    status: "approved",
    resolvedTrack: {
      appleTrackId: 456,
      appleCollectionId: 123,
      artworkUrl: "https://is1-ssl.mzstatic.com/image/1200x1200bb.jpg",
      appleMusicUrl:
        "https://music.apple.com/mx/album/dark-beach/123?i=456",
    },
  });
  assert.equal(result.report.status, "approved");
  const mapping = await getSongArtworkMapping(baseInput.songId);
  assert.equal(mapping?.appleTrackId, 456);
  assert.equal(mapping?.coverVerified, true);
  assert.equal(mapping?.verifiedByUserId, "moderator-1");
});

test("an approved mapping survives a different local song id", async () => {
  const report = await createArtworkReport(baseInput);
  await reviewArtworkReport({
    reportId: report.id,
    reviewerUserId: "moderator-1",
    status: "approved",
    resolvedTrack: {
      appleTrackId: 456,
      appleCollectionId: 123,
      artworkUrl: "https://is1-ssl.mzstatic.com/image/1200x1200bb.jpg",
      appleMusicUrl:
        "https://music.apple.com/mx/album/dark-beach/123?i=456",
    },
  });

  const mapping = await getSongArtworkMapping("new-install-song-id", {
    title: "  DARK BEACH ",
    artist: "Pastel Ghost",
  });
  assert.equal(mapping?.songId, baseInput.songId);
  assert.equal(mapping?.appleTrackId, 456);
  assert.equal(mapping?.coverVerified, true);
});

test("a report cannot be reviewed twice", async () => {
  const report = await createArtworkReport(baseInput);
  await reviewArtworkReport({
    reportId: report.id,
    reviewerUserId: "moderator-1",
    status: "rejected",
  });
  await assert.rejects(
    () =>
      reviewArtworkReport({
        reportId: report.id,
        reviewerUserId: "moderator-2",
        status: "rejected",
      }),
    ArtworkReportAlreadyReviewedError,
  );
});

test("Discord private and public message IDs remain attached to the report", async () => {
  const report = await createArtworkReport(baseInput);
  const privateMessage = await setArtworkReportDiscordMessage({
    reportId: report.id,
    channelId: "private-channel",
    messageId: "private-message",
  });
  assert.equal(privateMessage.discordReportMessageId, "private-message");

  const publicMessage = await setArtworkReportPublicMessage({
    reportId: report.id,
    channelId: "public-channel",
    messageId: "public-message",
  });
  assert.equal(publicMessage.discordPublicChannelId, "public-channel");
  assert.equal(publicMessage.discordPublicMessageId, "public-message");
});
