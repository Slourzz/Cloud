import assert from "node:assert/strict";
import test from "node:test";
import {
  greetingEmojiNames,
  greetings,
  pickRandomGreeting,
  pickRandomGreetingEmoji,
} from "./greetings.js";

test("incluye saludos en los idiomas solicitados", () => {
  const languages = new Set(greetings.map((greeting) => greeting.language));

  for (const language of [
    "Español",
    "English",
    "Türkçe",
    "Polski",
    "Русский",
  ]) {
    assert.ok(languages.has(language));
  }

  assert.ok(greetings.length >= 90);
});

test("elige un saludo determinista para poder probar el azar", () => {
  assert.equal(pickRandomGreeting(undefined, 0).index, 0);
  assert.equal(
    pickRandomGreeting(undefined, 0.9999999999999999).index,
    greetings.length - 1,
  );
});

test("no repite inmediatamente el mismo idioma", () => {
  assert.notEqual(pickRandomGreeting(0, 0).index, 0);
  assert.notEqual(pickRandomGreeting(10, 0.5).index, 10);
});

test("configura los nueve emojis divertidos", () => {
  assert.deepEqual(greetingEmojiNames, [
    "boykisser_meowing",
    "hyper_kore",
    "dancing_boykisser",
    "tac_sus",
    "a_cat_eating",
    "dancing_cat",
    "idk_what_its_ts",
    "sus_cat",
    "skull67",
  ]);
});

test("elige un emoji disponible al azar sin repetirlo inmediatamente", () => {
  const available = [
    { name: "boykisser_meowing", markup: "<a:boykisser_meowing:1>" },
    { name: "dancing_boykisser", markup: "<a:dancing_boykisser:2>" },
    { name: "tac_sus", markup: "<a:tac_sus:3>" },
  ];

  assert.deepEqual(
    pickRandomGreetingEmoji(available, "boykisser_meowing", 0),
    available[1],
  );
  assert.deepEqual(
    pickRandomGreetingEmoji(available, undefined, 0.9999999999999999),
    available[2],
  );
  assert.equal(pickRandomGreetingEmoji([], undefined), undefined);
});
