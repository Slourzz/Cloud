import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

export const publicGlobalCommandNames = new Set(["say"]);

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
      .setName("cover")
      .setDescription("Gestiona contribuciones de portadas de Cloud.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("upload")
          .setDescription("Aprueba la portada PNG mas reciente de este hilo.")
          .addStringOption((option) =>
            option
              .setName("artista")
              .setDescription("Artista exacto de la cancion")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("cancion")
              .setDescription("Titulo exacto de la cancion")
              .setRequired(true),
          ),
      ),
    new SlashCommandBuilder()
      .setName("app")
      .setDescription("Gestiona fotos de perfil de artistas en Cloud.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("upload")
          .setDescription("Aprueba la foto de artista mas reciente del hilo.")
          .addStringOption((option) =>
            option
              .setName("artista")
              .setDescription("Nombre del artista que quieres buscar")
              .setRequired(true),
          ),
      ),
    new SlashCommandBuilder()
      .setName("abp")
      .setDescription("Gestiona banners de artistas en Cloud.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("upload")
          .setDescription("Aprueba el banner de artista mas reciente del hilo.")
          .addStringOption((option) =>
            option
              .setName("artista")
              .setDescription("Nombre del artista que quieres buscar")
              .setRequired(true),
          ),
      ),
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
    new SlashCommandBuilder()
      .setName("daily")
      .setDescription("Muestra estadisticas privadas de la web de Cloud.")
      .setDefaultMemberPermissions(0)
      .addSubcommand((subcommand) =>
        subcommand
          .setName("stats")
          .setDescription("Muestra visitantes diarios de la web."),
      ),
    new SlashCommandBuilder()
      .setName("say")
      .setDescription("Cloud te saluda en un idioma al azar.")
      .setContexts(
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
      )
      .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
      .addSubcommand((subcommand) =>
        subcommand
          .setName("hi")
          .setDescription("Recibe un saludo en un idioma al azar."),
      ),
  ].map((command) => command.toJSON());
}
