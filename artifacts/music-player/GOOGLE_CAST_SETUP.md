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

## Probar un receiver sin publicar

Mientras el Custom Receiver siga sin publicar, Google solamente permite abrirlo
en dispositivos Cast registrados para desarrollo.

1. Abre Google Cast SDK Developer Console.
2. En `Cast Receiver Devices`, pulsa `Add New Device`.
3. Registra el numero de serie **Cast** de la TV. En Android TV no uses el
   numero de serie del hardware: abre `Ajustes > Sistema > Cast` o
   `Ajustes > Preferencias del dispositivo > Google Cast` y copia el numero de
   serie de software.
4. Espera hasta que el dispositivo indique `Ready for Testing` (Google
   recomienda esperar unos 15 minutos).
5. Reinicia completamente la TV o el dispositivo Cast.
6. Abre de nuevo Cloud e intenta transmitir.

El error `Unable to launch app: NOT_FOUND` significa que el dispositivo encontro
Cloud en la red, pero Google Cast todavia no reconoce el App ID para esa TV.
Cuando el receiver se publique, ya no sera necesario registrar cada dispositivo.

4. Reinicia el servidor de desarrollo o vuelve a compilar la aplicacion.

El valor se integra en la compilacion. Cuando Cloud se distribuya, todos los
usuarios utilizaran ese mismo receptor y solamente tendran que pulsar el icono
de Cast para abrir el selector de dispositivos.

## Nota sobre Tauri

El emisor web oficial de Google Cast depende de que el motor web exponga el
framework de Cast. La interfaz y el receptor personalizado de Cloud estan
preparados, pero el descubrimiento real de dispositivos debe probarse dentro
del WebView de la compilacion de Tauri en Windows.
