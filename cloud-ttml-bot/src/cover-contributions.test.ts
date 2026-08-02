import assert from "node:assert/strict";
import test from "node:test";
import {
  CoverContributionError,
  createExplicitCoverSong,
  resolveContributionTitle,
  splitContributionTitle,
  validatePngBuffer,
} from "./cover-contributions.js";
import { createCommunityCoverKey } from "./submission-store.js";

test("mantiene versiones distintas de una misma cancion separadas", () => {
  assert.notEqual(
    createCommunityCoverKey("Artist", "Song (Live)"),
    createCommunityCoverKey("Artist", "Song (Remix)"),
  );
  assert.equal(
    createCommunityCoverKey("Beyonce", "Deja Vu"),
    createCommunityCoverKey("Beyoncé", "Déjà Vu"),
  );
});

test("crea una identidad exacta para la primera portada comunitaria", () => {
  assert.deepEqual(
    createExplicitCoverSong("  KawaiiKittyKore ", " Cyber Thesis  "),
    {
      id: "community-cover:KawaiiKittyKore::Cyber%20Thesis",
      artist: "KawaiiKittyKore",
      title: "Cyber Thesis",
    },
  );
});

test("no crea identidades comunitarias con campos vacios", () => {
  assert.throws(
    () => createExplicitCoverSong("KawaiiKittyKore", "   "),
    (error: unknown) =>
      error instanceof CoverContributionError && error.code === "INVALID_TITLE",
  );
});

test("separa titulos con todos los delimitadores sin asumir el orden", () => {
  assert.deepEqual(splitContributionTitle("Lady Gaga - Die With A Smile")[0], {
    part1: "Lady Gaga",
    part2: "Die With A Smile",
  });
  assert.equal(splitContributionTitle("Song — Artist").length, 1);
  assert.equal(splitContributionTitle("Song | Artist").length, 1);
  assert.equal(splitContributionTitle("AC/DC / Thunderstruck").length, 2);
});

test("prueba artista-cancion y cancion-artista", async () => {
  const result = await resolveContributionTitle(
    "Lady Gaga - Die With A Smile",
    async (artist, title) =>
      artist === "Lady Gaga" && title === "Die With A Smile"
        ? [{ id: "song-1", artist, title }]
        : [],
  );

  assert.equal(result.exactMatches.length, 1);
  assert.equal(result.exactMatches[0].title, "Die With A Smile");
});

test("rechaza titulos sin dos partes", async () => {
  await assert.rejects(
    resolveContributionTitle("Sin delimitador", async () => []),
    (error: unknown) =>
      error instanceof CoverContributionError && error.code === "INVALID_TITLE",
  );
});

test("valida firma y dimensiones PNG", () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png, 0);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(1200, 16);
  png.writeUInt32BE(1200, 20);
  assert.deepEqual(validatePngBuffer(png), {
    width: 1200,
    height: 1200,
    byteLength: 24,
  });
});

test("rechaza PNG de baja resolucion sin escribir nada", () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png, 0);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(300, 16);
  png.writeUInt32BE(300, 20);
  assert.throws(
    () => validatePngBuffer(png),
    (error: unknown) =>
      error instanceof CoverContributionError && error.code === "LOW_RESOLUTION",
  );
});
