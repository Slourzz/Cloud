import {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

export function buildCommandDefinitions() {
  const maintenanceOptions = (builder: SlashCommandSubcommandBuilder) =>
    builder
      .addNumberOption((option) =>
        option
          .setName("starts_in_hours")
          .setDescription("Horas antes de iniciar")
          .setMinValue(0),
      )
      .addNumberOption((option) =>
        option
          .setName("starts_in_minutes")
          .setDescription("Minutos antes de iniciar")
          .setMinValue(0),
      )
      .addNumberOption((option) =>
        option
          .setName("duration_days")
          .setDescription("Dias de duracion")
          .setMinValue(0),
      )
      .addNumberOption((option) =>
        option
          .setName("duration_hours")
          .setDescription("Horas de duracion")
          .setMinValue(0),
      )
      .addNumberOption((option) =>
        option
          .setName("duration_minutes")
          .setDescription("Minutos de duracion")
          .setMinValue(0),
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Razon visible para Cloud")
          .setMaxLength(500),
      );

  return [
    new SlashCommandBuilder()
      .setName("delete-all-ttmls")
      .setDescription("Elimina todos los TTML comunitarios con backup previo."),
    new SlashCommandBuilder()
      .setName("maintenance")
      .setDescription("Controla mantenimiento de letras comunitarias.")
      .addSubcommand((subcommand) =>
        maintenanceOptions(
          subcommand
            .setName("start")
            .setDescription("Programa mantenimiento de letras comunitarias."),
        ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("end")
          .setDescription("Finaliza el mantenimiento de letras."),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("status")
          .setDescription("Muestra el estado del mantenimiento de letras."),
      ),
    new SlashCommandBuilder()
      .setName("maintenance-global")
      .setDescription("Controla avisos informativos globales de mantenimiento.")
      .addSubcommand((subcommand) =>
        maintenanceOptions(
          subcommand
            .setName("start")
            .setDescription("Programa aviso global informativo."),
        ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("end")
          .setDescription("Finaliza el aviso global informativo."),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("status")
          .setDescription("Muestra el estado del aviso global."),
      ),
  ].map((command) => command.toJSON());
}
