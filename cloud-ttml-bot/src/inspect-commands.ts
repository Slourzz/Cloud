import "dotenv/config";
import { REST, Routes } from "discord.js";

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

const globalCommands = (await rest.get(
  Routes.applicationCommands(discordClientId),
)) as Array<{ id: string; name: string; description?: string }>;

console.log("Global commands:");
if (globalCommands.length === 0) {
  console.log("  none");
} else {
  for (const command of globalCommands) {
    console.log(`  /${command.name} (${command.id})`);
  }
}

if (discordGuildId) {
  const guildCommands = (await rest.get(
    Routes.applicationGuildCommands(discordClientId, discordGuildId),
  )) as Array<{ id: string; name: string; description?: string }>;

  console.log(`Guild commands for ${discordGuildId}:`);
  if (guildCommands.length === 0) {
    console.log("  none");
  } else {
    for (const command of guildCommands) {
      console.log(`  /${command.name} (${command.id})`);
    }
  }
}
