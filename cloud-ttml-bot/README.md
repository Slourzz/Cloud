# Cloud TTML Review Bot

Bot y API local para enviar TTMLs desde Cloud a un canal privado de Discord.

## Flujo

1. Cloud envia `POST /api/ttml/review` con el archivo TTML y datos de la cancion.
2. El bot publica una revision en Discord con botones `Aprobar` y `Rechazar`.
3. El moderador deja un comentario.
4. Cloud consulta `GET /api/ttml/review/:submissionId`.
5. La app muestra la respuesta en el panel de notificaciones.

## Configuracion

1. Crea un bot en Discord Developer Portal.
2. Activa el bot y copia su token.
3. Invitalo a tu servidor con permisos para leer y escribir en el canal privado.
4. Copia el ID del canal privado donde llegaran las revisiones.
5. Crea `.env` desde `.env.example`.

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_REVIEW_CHANNEL_ID=your_private_moderator_channel_id
PORT=8787
CLOUD_APP_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/cloud
DATABASE_SSL=false
```

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

Al arrancar, el bot crea automaticamente la tabla `ttml_submissions` y sus indices.

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
- El limite actual por archivo TTML es de 2 MB.
