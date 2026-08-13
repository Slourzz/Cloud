import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommandDefinitions,
  publicGlobalCommandNames,
} from "./slash-commands.js";

test("cover upload exige artista y cancion", () => {
  const cover = buildCommandDefinitions().find(
    (command) => command.name === "cover",
  );
  assert.ok(cover);

  const upload = cover.options?.find(
    (option) => option.type === 1 && option.name === "upload",
  );
  assert.ok(upload && "options" in upload);

  const inputs = upload.options ?? [];
  assert.deepEqual(
    inputs.map((option) => ({
      name: option.name,
      required: "required" in option ? option.required : false,
    })),
    [
      { name: "artista", required: true },
      { name: "cancion", required: true },
    ],
  );
});

for (const commandName of ["app", "abp"] as const) {
  test(`${commandName} upload exige artista`, () => {
    const command = buildCommandDefinitions().find(
      (candidate) => candidate.name === commandName,
    );
    assert.ok(command);

    const upload = command.options?.find(
      (option) => option.type === 1 && option.name === "upload",
    );
    assert.ok(upload && "options" in upload);
    assert.deepEqual(
      (upload.options ?? []).map((option) => ({
        name: option.name,
        required: "required" in option ? option.required : false,
      })),
      [{ name: "artista", required: true }],
    );
  });
}

test("say hi es publico y funciona en servidores y MD del bot", () => {
  const say = buildCommandDefinitions().find(
    (command) => command.name === "say",
  );

  assert.ok(say);
  assert.ok(publicGlobalCommandNames.has("say"));
  assert.deepEqual(say.contexts, [0, 1]);
  assert.deepEqual(say.integration_types, [0]);
  assert.equal(say.default_member_permissions, undefined);
  assert.deepEqual(
    say.options?.map((option) => ({
      name: option.name,
      type: option.type,
    })),
    [{ name: "hi", type: 1 }],
  );
});

test("daily stats queda deshabilitado por defecto para los miembros", () => {
  const daily = buildCommandDefinitions().find(
    (command) => command.name === "daily",
  );

  assert.ok(daily);
  assert.equal(daily.default_member_permissions, "0");
  assert.deepEqual(
    daily.options?.map((option) => ({
      name: option.name,
      type: option.type,
    })),
    [{ name: "stats", type: 1 }],
  );
});
