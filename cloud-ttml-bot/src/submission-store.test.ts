import assert from "node:assert/strict";
import test from "node:test";
import {
  isTransientDatabaseError,
  scoreSongIdentity,
} from "./submission-store.js";

test("detecta errores transitorios directos de PostgreSQL", () => {
  assert.equal(isTransientDatabaseError({ code: "57P03" }), true);
  assert.equal(isTransientDatabaseError({ code: "ETIMEDOUT" }), true);
  assert.equal(isTransientDatabaseError({ code: "23505" }), false);
});

test("detecta errores transitorios dentro de AggregateError", () => {
  const error = new AggregateError([
    Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }),
  ]);
  assert.equal(isTransientDatabaseError(error), true);
});

test("resuelve colaboradores aunque esten en el titulo de Lyrically", () => {
  const score = scoreSongIdentity(
    {
      title: "STAY",
      artist: "The Kid LAROI, Justin Bieber",
      duration: 141,
    },
    {
      title: "STAY (with Justin Bieber)",
      artist: "The Kid LAROI",
      duration: 141,
    },
  );
  assert.ok(score >= 185);
});

test("no confunde la version original con un remix", () => {
  const score = scoreSongIdentity(
    { title: "STAY", artist: "The Kid LAROI", duration: 141 },
    { title: "STAY (Remix)", artist: "The Kid LAROI", duration: 141 },
  );
  assert.equal(score, Number.NEGATIVE_INFINITY);
});
