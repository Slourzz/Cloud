import "dotenv/config";
import { REST, Routes } from "discord.js";
import { buildCommandDefinitions } from "./slash-commands.js";

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
const body = buildCommandDefinitions();
const commandNames = body.map((command) => command.name).join(", ");

if (discordGuildId) {
  await rest.put(
    Routes.applicationGuildCommands(discordClientId, discordGuildId),
    { body },
  );
  console.log(
    `Registered Cloud slash commands for guild ${discordGuildId}: ${commandNames}`,
  );
} else {
  await rest.put(Routes.applicationCommands(discordClientId), { body });
  console.log(
    `Registered Cloud slash commands globally: ${commandNames}. Global commands can take up to 1 hour to appear.`,
  );
}
