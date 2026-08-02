# Cloud TTML Review Bot

Bot y API local para enviar TTMLs desde Cloud a un canal privado de Discord.

## Flujo

1. Cloud envia `POST /api/ttml/review` con el archivo TTML y datos de la cancion.
2. El bot publica una revision en Discord con botones `Aprobar` y `Rechazar`.
3. El moderador deja un comentario.
4. Cloud consulta `GET /api/ttml/review/:submissionId`.
5. La app muestra la respuesta en el panel de notificaciones.
6. Cuando se aprueba, otras instalaciones de Cloud pueden obtenerlo con
   `GET /api/ttml/approved?artist=...&title=...&duration=...`.

## Configuracion

1. Crea un bot en Discord Developer Portal.
2. Activa el bot y copia su token.
3. Invitalo a tu servidor con permisos para leer y escribir en el canal privado.
4. Copia el ID del canal privado donde llegaran las revisiones.
5. Crea `.env` desde `.env.example`.

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_REVIEW_CHANNEL_ID=your_private_moderator_channel_id
DISCORD_REPORTS_CHANNEL_ID=1531969113071550750
DISCORD_PUBLIC_COVERS_CHANNEL_ID=1531969444069376111
DISCORD_COMMUNITY_ANNOUNCEMENTS_CHANNEL_ID=1531980614151049389
DISCORD_COMMUNITY_ANNOUNCEMENTS_ROLE_ID=1531980785576443954
DISCORD_COMMUNITY_ANNOUNCEMENTS_EMOJI_ID=1527636865824587938
DISCORD_CLIENT_ID=your_discord_application_id
DISCORD_CLIENT_SECRET=your_discord_oauth_client_secret
DISCORD_GUILD_ID=your_cloud_discord_server_id
DISCORD_REDIRECT_URI=https://your-railway-domain.up.railway.app/api/auth/discord/callback
PUBLIC_BASE_URL=https://your-railway-domain.up.railway.app
PORT=8787
CLOUD_APP_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/cloud
DATABASE_SSL=false
```

`DISCORD_REPORTS_CHANNEL_ID` debe apuntar a un canal privado donde
`@everyone` no tenga `ViewChannel` y el rol
`DISCORD_COVER_REVIEWER_ROLE_ID` sí pueda verlo. En
`DISCORD_PUBLIC_COVERS_CHANNEL_ID`, `@everyone` debe poder ver el canal pero
no enviar mensajes. El bot necesita `ViewChannel`, `SendMessages` y
`EmbedLinks` en ambos. El token y estos IDs solo pertenecen al backend; Cloud
para Windows nunca los recibe.

El canal de anuncios comunitarios contiene un mensaje persistente con la
reacción `a_cat_eating`. El bot necesita `AddReactions`, `ReadMessageHistory`
y `ManageRoles`, y su rol más alto debe estar por encima del rol
`DISCORD_COMMUNITY_ANNOUNCEMENTS_ROLE_ID`. Los anuncios de portadas mencionan
ese rol automáticamente.

## Ejecutar

```bash
cd D:\Descargas\cloud-ttml-bot
pnpm install
pnpm dev
```

La API queda en:

```txt
http://localhost:8787/api/ttml/review
```

## Conectar Cloud

Agrega esto en el `.env` de Cloud:

```env
VITE_TTML_REVIEW_ENDPOINT=http://localhost:8787/api/ttml/review
```

Si Tauri bloquea la peticion por CSP, agrega `http://localhost:8787` en `connect-src` dentro de `src-tauri/tauri.conf.json`.

## Subir a GitHub

```bash
git init
git add .
git commit -m "Initial Cloud TTML review bot"
git branch -M main
git remote add origin https://github.com/Slourzz/cloud-ttml-bot.git
git push -u origin main
```

## PostgreSQL en Railway

1. Abre el proyecto donde esta desplegado `CloudBot`.
2. Pulsa `New` y agrega `Database > PostgreSQL`.
3. Abre el servicio `CloudBot` y entra a `Variables`.
4. Agrega una referencia a la variable del servicio PostgreSQL:

```txt
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

El nombre `Postgres` debe coincidir con el nombre real del servicio de base de datos en Railway.

Tambien agrega:

```env
DATABASE_SSL=false
```

Al arrancar, el bot crea automaticamente las tablas de revisiones y sesiones
de Discord. En el Developer Portal registra exactamente el valor de
`DISCORD_REDIRECT_URI` como redirect OAuth2.

Puedes comprobarlo visitando:

```txt
https://tu-bot.up.railway.app/health
```

La respuesta debe incluir:

```json
{
  "ok": true,
  "database": "postgresql"
}
```

## Notas

- Con `DATABASE_URL`, las revisiones sobreviven reinicios y redeploys.
- Sin `DATABASE_URL`, el bot funciona con memoria temporal para desarrollo local.
- Los TTML se guardan inicialmente como texto en PostgreSQL.
- Solo los TTML aprobados se entregan mediante el endpoint publico.
- El limite actual por archivo TTML es de 2 MB.
