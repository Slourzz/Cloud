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
    new SlashCommandBuilder()
      .setName("restore")
      .setDescription("Restaura respaldos de Cloud.")
      .addSubcommandGroup((group) =>
        group
          .setName("ttml")
          .setDescription("Gestiona respaldos TTML comunitarios.")
          .addSubcommand((subcommand) =>
            subcommand
              .setName("backup")
              .setDescription("Restaura globalmente el respaldo TTML mas reciente."),
          ),
      ),
    new SlashCommandBuilder()
      .setName("delete")
      .setDescription("Elimina contenido especifico de Cloud.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("ttml")
          .setDescription("Busca y elimina el TTML de una cancion.")
          .addStringOption((option) =>
            option
              .setName("cancion")
              .setDescription("Titulo exacto de la cancion")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("artista")
              .setDescription("Nombre exacto del artista")
              .setRequired(true),
          ),
      ),
  ].map((command) => command.toJSON());
}
