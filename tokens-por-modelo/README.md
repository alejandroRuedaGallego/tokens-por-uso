# tokens-por-modelo

Mod de Claude Code que cuenta, en cada petición al modelo (evento `turn.step`), los tokens de entrada, salida, lectura de caché y escritura de caché, y los acumula por modelo (Opus, Sonnet, Haiku, Fable u otro id). Las peticiones de los subagentes también cuentan.

- `/tokens` abre un panel con una tabla en tiempo real: una fila por modelo, sus totales y el porcentaje del total de la sesión.
- Encima del prompt aparece una línea compacta, por ejemplo `Tokens: Opus 1.2M · Haiku 48k`.

Los datos viven solo en memoria (`$.state` de la sesión): no se guardan en disco y se pierden al cerrar la sesión.

## Instalar

    claude --plugin-dir /ruta/a/tokens-por-modelo
