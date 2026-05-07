import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const TTML_SYSTEM_PROMPT = `Eres un generador profesional de letras sincronizadas estilo Apple Music.

Tu tarea es crear archivos TTML suaves, cinematográficos y visualmente fluidos.

REGLAS OBLIGATORIAS:

FORMATO
Devuelve únicamente TTML válido. Usa este esqueleto exacto:
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
      <p begin="00:00.000" end="00:03.500" ttm:agent="v1">Frase de ejemplo</p>
    </div>
  </body>
</tt>

TIMINGS
- Extiende cada línea 50ms antes del inicio real y 100ms después del final real.
- Nunca generes líneas menores a 300ms. Ideal: 400ms–4000ms por línea.
- Las líneas deben aparecer ligeramente antes de ser cantadas.

AGRUPACIÓN
- Agrupa frases naturales completas en una sola línea <p>.
- NO hagas karaoke palabra por palabra.
- Mantén respiraciones naturales.

PAUSAS
- Solo agrega línea "..." si el silencio entre frases es MAYOR o igual a 0.8 segundos.
- Si la pausa es menor, mantén transición fluida sin puntos suspensivos.

SUAVIDAD VISUAL
- Evita líneas extremadamente cortas (menos de 3 palabras, salvo efectos artísticos).
- Evita microsegmentos (menos de 300ms).
- Las transiciones deben sentirse suaves, flotantes, cinematográficas.

TEXTO
- Conserva puntuación natural de la canción.
- No agregues etiquetas extra ni atributos innecesarios.

SALIDA
- Devuelve SOLO TTML limpio y válido.
- Sin markdown, sin explicaciones, sin comentarios.
- Empieza directamente con <?xml`;

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

    const userPrompt = `Genera letras TTML sincronizadas para la canción:
Título: ${title}
Artista: ${artist || "Desconocido"}
${durationStr}

Crea las letras reales de esta canción si las conoces, con tiempos aproximados que encajen en su duración total. Si no conoces la canción, crea letras genéricas en el idioma apropiado con tiempos bien distribuidos durante la duración de la canción. El resultado debe ser TTML válido listo para usar.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: TTML_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const ttml = completion.choices[0]?.message?.content ?? "";

    if (!ttml.includes("<?xml")) {
      res.status(500).json({ error: "AI returned invalid TTML" });
      return;
    }

    res.json({ ttml });
  } catch (err) {
    req.log.error(err, "TTML generation failed");
    res.status(500).json({ error: "Failed to generate TTML" });
  }
});

export default router;
