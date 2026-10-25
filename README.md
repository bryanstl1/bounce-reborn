# BOUNCE REBORN

Plataformas en HTML5 protagonizado por una pelota roja rebotadora, inspirado en los clásicos de los teléfonos Nokia. Se juega en **Safari para iPhone** (horizontal) y en cualquier navegador moderno, directamente desde una URL.

**Jugar:** https://bryanstl1.github.io/bounce-reborn/

> Nombre provisional. El arte, el audio y los niveles son 100 % originales; ver [Aviso legal](#aviso-legal).

## Estado actual (v0.1)

- Motor de físicas propio: círculo contra polígonos, con aceleración, inercia, fricción, gravedad, salto variable, rebote, pendientes, plataformas móviles y detección de suelo.
- Calibrado con las constantes del clásico (ver [docs/ANALISIS-BOUNCE-TALES.md](docs/ANALISIS-BOUNCE-TALES.md)).
- **Nivel 1 «Bosque Brillante»** completo:
  - 32 huevos.
  - Picos.
  - Resorte.
  - Escarabajos que se pueden aplastar.
  - Plataforma móvil y ascensor.
  - 3 puntos de control.
  - Islas flotantes.
  - Portal de salida.
- **Laboratorio de físicas:**
  - Pista de pruebas medida en diámetros de pelota.
  - Deslizadores en vivo y lectura de velocidad y altura.
  - Formas normal, pesada y ligera.
- **Interfaz:**
  - Inicio, selección de nivel, pausa, victoria con medallas, derrota y ajustes.
  - Volumen de música y efectos, y calidad gráfica.
- **Audio:** música y efectos sintetizados con Web Audio, sin archivos. El audio se activa con el primer toque (requisito de Safari).
- **Guardado local:** niveles desbloqueados, huevos, mejores tiempos y ajustes.
- **Controles táctiles:**
  - Multitáctil, por zonas: la mitad izquierda es ◀ ▶ y se puede deslizar entre ambos; la mitad derecha es saltar.
  - Respeta el área segura del iPhone.
  - Sin desplazamiento ni zoom accidental.
- **Instalable:** se puede agregar a la pantalla de inicio y abre a pantalla completa.

## Controles

| Acción | Teclado | iPhone |
|---|---|---|
| Rodar | ← → / A D | Botones ◀ ▶ (mitad izquierda) |
| Saltar (mantén para seguir rebotando) | ↑ / Espacio / W | Botón rojo (mitad derecha) |
| Pausa | P / Esc | Botón ❚❚ |
| Reiniciar | R | Pausa → Reiniciar |

## Desarrollo

Requisitos: Node 20+.

```bash
npm install
npm run dev          # servidor con recarga en http://localhost:5173
npm run build        # compila a dist/
npm run typecheck    # TypeScript estricto
npm run test:unit    # pruebas de físicas + el nivel se puede terminar (búsqueda sobre la simulación real)
npm run test:e2e     # pruebas en Chromium (escritorio y iPhone horizontal emulado)
npm run check        # todo lo anterior
```

Cada push a `main` ejecuta las pruebas en GitHub Actions y publica `dist/` en GitHub Pages.

## Estructura

```
src/
  physics/   motor: geometría, mundo de colisiones, pelota, parámetros
  sim/       simulación determinista del nivel (reglas, entidades, eventos) + solucionador
  level/     formato de nivel, utilidades de formas, niveles
  render/    escena de Phaser, terreno vectorial, texturas procedurales
  input/     teclado y controles táctiles
  audio/     efectos y música sintetizados
  ui/ lab/   interfaz DOM y laboratorio
  save/      guardado local
tests/unit   pruebas de físicas y niveles (node:test)
tests/e2e    pruebas en navegador (Playwright)
docs/        análisis, arquitectura, pruebas, pendientes y plan
```

## Documentación

- [Análisis de referencias](docs/ANALISIS-BOUNCE-TALES.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Registro de pruebas](docs/REGISTRO-DE-PRUEBAS.md)
- [Problemas pendientes](docs/PENDIENTES.md)
- [Plan de niveles y secuela](docs/PLAN-NIVELES-Y-SECUELA.md)

## Aviso legal

Proyecto de fans, sin relación con Nokia, HMD ni Rovio. No contiene ni redistribuye sprites, música, niveles, logotipos, código ni otros recursos del juego original. Los videos de referencia y la descompilación comunitaria [HelloOO7/BounceTales](https://github.com/HelloOO7/BounceTales) se usaron solo para medir la sensación del movimiento (valores numéricos). El personaje, el arte, el sonido y los niveles de este repositorio son creaciones originales. Antes de una publicación comercial conviene adoptar un nombre propio.
