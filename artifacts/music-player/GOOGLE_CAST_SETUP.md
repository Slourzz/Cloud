# Google Cast en Cloud

El App ID de Google Cast pertenece a Cloud. Los usuarios no deben escribir ni
configurar ningun ID.

## Configuracion del proyecto

1. Publica `public/cast-receiver.html` en una URL HTTPS accesible.
2. Registra esa URL como **Custom Web Receiver** en Google Cast SDK Developer
   Console.
3. Copia el App ID asignado por Google en `.env.local`:

   ```env
   VITE_GOOGLE_CAST_APP_ID=TU_APP_ID_DE_CLOUD
   ```

4. Reinicia el servidor de desarrollo o vuelve a compilar la aplicacion.

El valor se integra en la compilacion. Cuando Cloud se distribuya, todos los
usuarios utilizaran ese mismo receptor y solamente tendran que pulsar el icono
de Cast para abrir el selector de dispositivos.

## Nota sobre Tauri

El emisor web oficial de Google Cast depende de que el motor web exponga el
framework de Cast. La interfaz y el receptor personalizado de Cloud estan
preparados, pero el descubrimiento real de dispositivos debe probarse dentro
del WebView de la compilacion de Tauri en Windows.
