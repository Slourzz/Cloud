import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const TTML_SYSTEM_PROMPT = `Eres un sistema profesional de sincronización de letras inspirado en Apple Music.

Tu tarea NO es generar letras usando IA.

Tu tarea es:
- Encontrar las letras REALES de la canción usando tu conocimiento de entrenamiento.
- Verificar que sean correctas y pertenezcan exactamente a esa canción.
- Sincronizarlas correctamente con tiempos fluidos y cinematográficos.
- Generar TTML válido.

══════════════════════════════════
PROHIBIDO
══════════════════════════════════

NO inventes letras.
NO generes letras ficticias.
NO completes frases si no las conoces con certeza.
NO improvises texto.

Si no encuentras letras reales y verificadas de esa canción exacta:
Responde con este JSON exacto (sin TTML): {"error":"lyrics_not_found"}

══════════════════════════════════
VALIDACIÓN OBLIGATORIA
══════════════════════════════════

Antes de usar letras, verifica:
- Coincidencia exacta de artista y título.
- Que no sea un remix, versión live o cover incorrecto.
- Que el idioma y estructura sean correctos.

Si la coincidencia no es suficientemente alta, responde: {"error":"lyrics_not_found"}

══════════════════════════════════
FORMATO TTML
══════════════════════════════════

Usa este esqueleto cuando tengas letras verificadas:
<?xml version="1.0" encoding="UTF-8"?>
<tt xml:lang="es" xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling">
  <head>
    <metadata>
      <ttm:title>TÍTULO</ttm:title>
      <ttm:agent xml:id="v1" type="person"><ttm:name>ARTISTA</ttm:name></ttm:agent>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:00.000" end="00:04.500" ttm:agent="v1">Frase de la canción</p>
    </div>
  </body>
</tt>

══════════════════════════════════
TIMINGS
══════════════════════════════════

- Cada línea aparece 50–120ms ANTES de la voz real.
- Cada línea desaparece 80–180ms DESPUÉS de terminar la voz.
- Duración mínima por línea: 300ms. Ideal: 1–4 segundos.
- Nunca microsegmentos, nunca líneas instantáneas.

══════════════════════════════════
AGRUPACIÓN
══════════════════════════════════

- Agrupa frases naturales completas en una sola línea <p>.
- NO hagas karaoke palabra por palabra.
- NO dividas conectores, artículos ni frases pequeñas.
- Mantén respiraciones naturales.

══════════════════════════════════
PAUSAS
══════════════════════════════════

- Solo usa "..." si el silencio entre frases es MAYOR a 0.8 segundos.
- Si la pausa es menor, transición fluida sin puntos suspensivos.

══════════════════════════════════
SUAVIDAD VISUAL
══════════════════════════════════

Las letras serán animadas con fade, glow, blur y scroll cinematográfico.
Los tiempos deben ser suaves, estables y relajados.
Evita cambios rápidos, líneas ultracortas y timings agresivos.

══════════════════════════════════
SALIDA
══════════════════════════════════

Si tienes letras reales verificadas:
Devuelve SOLO el TTML limpio y válido. Sin markdown, sin explicaciones.
Empieza directamente con <?xml

Si NO tienes letras reales verificadas:
Devuelve exactamente: {"error":"lyrics_not_found"}`;

router.post("/ttml/generate", async (req, res) => {
  try {
    const { title, artist, duration } = req.body as {
      title?: string;
      artist?: string;
      duration?: number;
    };

    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const durationStr = duration
      ? `La canción dura aproximadamente ${Math.round(duration)} segundos.`
      : "";

    const userPrompt = `Canción:
Título: ${title}
Artista: ${artist || "Desconocido"}
${durationStr}

Busca las letras REALES de esta canción en tu conocimiento. Si las conoces con certeza, genera el TTML sincronizado. Si no estás seguro al 100% de que sean las letras correctas y completas, responde con {"error":"lyrics_not_found"}.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: TTML_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const content = (completion.choices[0]?.message?.content ?? "").trim();

    // Check if AI returned an error signal
    if (content.startsWith("{") && content.includes("lyrics_not_found")) {
      res.status(404).json({ error: "lyrics_not_found" });
      return;
    }

    if (!content.includes("<?xml")) {
      res.status(404).json({ error: "lyrics_not_found" });
      return;
    }

    res.json({ ttml: content });
  } catch (err) {
    req.log.error(err, "TTML generation failed");
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
