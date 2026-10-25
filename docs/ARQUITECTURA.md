# Arquitectura

## Elección técnica

| Pieza | Elección | Por qué |
|---|---|---|
| Lenguaje | TypeScript estricto | Código mantenible y tipado de punta a punta (niveles, eventos, guardado). |
| Render, escenas y cámara | **Phaser 3.90** (WebGL, con Canvas de respaldo) | Escenas, cámara con zoom, partículas, *tweens* y un renderizado por lotes fluido en Safari iOS. |
| Físicas | **Motor propio** (`src/physics`) | Phaser Arcade no maneja pendientes ni círculos contra polígonos. Matter.js se siente "flotante" y es difícil de calibrar contra el original. Un motor pequeño y determinista da control total y se puede probar sin navegador. |
| Empaquetado | esbuild (`scripts/build.mjs`) | Compila en < 1 s y produce un solo JS con *hash*. Es el mismo motor que usa Vite por dentro, sin dependencias extra. |
| Pruebas | `node:test` + tsx (unitarias), Playwright (navegador) | Sin frameworks pesados. |
| Hosting | GitHub Pages con GitHub Actions | Gratis y sin servidores. |

El bundle mide ≈ 1,25 MB sin comprimir (≈ 320 KB con gzip), y casi todo es Phaser. No hay imágenes ni audios que descargar: **todo el arte se dibuja por código** y **todo el audio se sintetiza**.

## Capas

```
          ┌──────────────── main.ts (orquestador) ─────────────────┐
          │ pantallas DOM · HUD · guardado · audio · ajustes · API   │
          └───────┬───────────────────────────┬────────────────────┘
                  │ GameBridge                │
        ┌─────────▼─────────┐        ┌────────▼────────┐
        │ render/GameScene  │        │ input/          │
        │ (Phaser: dibuja,  │◄───────┤ teclado + toque │
        │  cámara, FX)      │ sample │ por zonas       │
        └─────────┬─────────┘        └─────────────────┘
                  │ step(input) a 120 Hz fijos
        ┌─────────▼─────────┐
        │ sim/LevelSim      │  reglas del nivel: huevos, picos, enemigos,
        │ (determinista,    │  resortes, puntos de control, meta, vidas,
        │  sin Phaser)      │  plataformas por tiempo → eventos
        └─────────┬─────────┘
        ┌─────────▼─────────┐
        │ physics/          │  círculo vs. segmentos, rejilla espacial,
        │ ball · world      │  sólidos móviles, parámetros por forma
        └───────────────────┘
```

- **`physics/`** — matemática pura. `stepBall()` avanza la pelota un paso fijo en este orden: control → salto → gravedad → integración → colisiones (hasta 5 iteraciones, siempre contra la penetración más profunda) → detección de suelo.
- **`sim/LevelSim`** — estado del nivel clonable (`snapshot` / `restore`). El estado se puede clonar, así que:
  - el **solucionador** (`sim/solver.ts`) hace una búsqueda por haz sobre la simulación real y demuestra que el nivel se puede terminar;
  - las pruebas en el navegador reproducen esa solución paso a paso dentro del juego real (`__BOUNCE.replay`).
- **`render/`** — solo lee el estado y consume los eventos:
  - el terreno son polígonos vectoriales (nítidos con cualquier zoom);
  - las texturas se generan con Canvas 2D a 3× (`textures.ts`);
  - las capas de fondo tienen paralaje y hay recorte manual de lo que queda fuera de la cámara.
- **`level/`** — los niveles son datos TypeScript (`LevelData`): polígonos de terreno, plataformas con trayectoria, picos, huevos, enemigos, resortes, puntos de control, meta, decoración y textos de ayuda. `shapes.ts` trae utilidades: suelo con superficie suavizada, isla flotante, rectángulos redondeados.

## Bucle de juego

- **Paso fijo** de 1/120 s, con acumulador y reloj propio (`performance.now()`). La física es idéntica a 60, 90 o 120 Hz y en cualquier dispositivo.
- La entrada se muestrea **una vez por paso**. Un salto presionado entre fotogramas se guarda (*latch*) y no se pierde.
- Los eventos de la simulación (`jump`, `land`, `egg`, `death`…) controlan los sonidos, las partículas, el aplastamiento y estiramiento de la pelota y el HUD.

## Compatibilidad con iPhone y Safari

- **Lienzo a resolución nativa:** el lienzo interno mide CSS × devicePixelRatio (con tope según la calidad elegida) y se escala con `zoom = 1/dpr`. La cámara usa ≈ 10 diámetros de pelota de alto en cualquier pantalla.
- **Pantalla:** `viewport-fit=cover`, márgenes con `env(safe-area-inset-*)`, `touch-action: none`, bloqueo de `gesturestart` y del doble toque, sin selección ni menú de pulsación larga.
- **Controles táctiles:** eventos *pointer* con captura y zonas grandes. Toda la mitad izquierda es ◀ ▶ (se desliza entre los dos sin levantar el dedo) y la mitad derecha es saltar. Es multitáctil real: se puede rodar y saltar al mismo tiempo.
- **Audio:** el `AudioContext` se crea y reanuda dentro de un gesto del usuario (con un búfer silencioso de desbloqueo). Se suspende al ocultar la pestaña.
- **Pantalla completa:** manifiesto con `display: fullscreen` y `orientation: landscape`, más las etiquetas de Apple. Al agregarlo a la pantalla de inicio se abre a pantalla completa. Safari en iPhone no permite la API de pantalla completa en páginas normales.
- **Orientación:** en vertical aparece el aviso "Gira tu iPhone". Al ocultar la pestaña, el juego se pausa solo.

## Guardado

`localStorage` con clave `bounce-reborn/save/v1` y todos los accesos protegidos con try/catch (en modo privado sigue funcionando solo en memoria). Guarda:

- niveles desbloqueados;
- huevos recogidos por nivel (la unión de todas las partidas);
- mejor tiempo y medallas;
- ajustes;
- físicas personalizadas del laboratorio (opcional).

## Extensión para la secuela

- **Nuevos niveles:** agregar un archivo en `src/level/levels/` y registrarlo en `CAMPAIGN`. Las pruebas validan automáticamente sus elementos y que se pueda terminar.
- **Nuevas entidades:** sumar su definición en `LevelData`, su regla en `LevelSim.checkTriggers` y su evento y dibujo en `GameScene`.
- **Formas de la pelota:** `FORM_MODIFIERS`. Las almohadillas `formPads` ya cambian de forma dentro de los niveles.
- **Narrativa:** pensada como una capa nueva (`story/`) con escenas entre niveles y diálogos disparados por zonas. Ver [PLAN-NIVELES-Y-SECUELA.md](PLAN-NIVELES-Y-SECUELA.md).
