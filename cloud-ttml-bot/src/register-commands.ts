import "dotenv/config";
import { REST, Routes } from "discord.js";
import {
  buildCommandDefinitions,
  publicGlobalCommandNames,
} from "./slash-commands.js";

const discordToken = process.env.DISCORD_TOKEN;
const discordClientId = process.env.DISCORD_CLIENT_ID;
const discordGuildId = process.env.DISCORD_GUILD_ID;

if (!discordToken) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

if (!discordClientId) {
  throw new Error("Missing DISCORD_CLIENT_ID in .env");
}

const rest = new REST({ version: "10" }).setToken(discordToken);
const definitions = buildCommandDefinitions();
const publicGlobalCommands = definitions.filter((command) =>
  publicGlobalCommandNames.has(command.name),
);
const serverCommands = definitions.filter(
  (command) => !publicGlobalCommandNames.has(command.name),
);

if (discordGuildId) {
  await rest.put(Routes.applicationCommands(discordClientId), {
    body: publicGlobalCommands,
  });
  await rest.put(
    Routes.applicationGuildCommands(discordClientId, discordGuildId),
    { body: serverCommands },
  );
  console.log(
    `Registered public global commands: ${publicGlobalCommands
      .map((command) => command.name)
      .join(", ")}`,
  );
  console.log(
    `Registered Cloud slash commands for guild ${discordGuildId}: ${serverCommands
      .map((command) => command.name)
      .join(", ")}`,
  );
} else {
  await rest.put(Routes.applicationCommands(discordClientId), {
    body: definitions,
  });
  console.log(
    `Registered Cloud slash commands globally: ${definitions
      .map((command) => command.name)
      .join(", ")}. Global commands can take up to 1 hour to appear.`,
  );
}
