# Registro de pruebas

Fecha: 24 de octubre de 2026 · versión 0.1.0

Estas pruebas se ejecutan en cada push (GitHub Actions) y en local con `npm run check`.

## Resumen

| Conjunto | Resultado |
|---|---|
| TypeScript estricto (`npm run typecheck`) | ✅ sin errores |
| Unitarias: físicas y niveles (`npm run test:unit`) | ✅ 16/16 |
| Navegador: Chromium de escritorio, 1280×720 (`npm run test:e2e`) | ✅ 9/9 (1 omitida: táctil) |
| Navegador: iPhone horizontal emulado, 874×402, DPR 3, táctil | ✅ 8/8 (2 omitidas: teclado) |
| Compilación de producción (`npm run build`) | ✅ `dist/` ≈ 1,25 MB de JS |
| GitHub Actions (job `test-build`) | ✅ pasó en el primer push (2 min 47 s) |
| Despliegue a GitHub Pages | ⏳ en espera de que se active Pages en la configuración del repositorio |
| iPhone físico con Safari | ⏳ pendiente (ver [PENDIENTES.md](PENDIENTES.md)) |

## Pruebas unitarias (simulación real, sin navegador)

| Prueba | Verifica |
|---|---|
| La pelota cae y descansa en el suelo | gravedad, colisión y detección de suelo |
| Al caer de altura rebota y luego se asienta | rebote con umbral |
| Aceleración gradual con tope en la velocidad máxima | aceleración e inercia |
| Al soltar sigue rodando y la fricción la detiene | distancia de frenado = v²/2a (±15 px) |
| Altura del salto = v²/2g | ±4 % |
| Salto variable: un toque salta menos que mantener | corte de salto |
| Búfer de salto | un salto presionado justo antes de aterrizar sí se ejecuta |
| Las paredes detienen la pelota a velocidad máxima | sin atravesar paredes |
| Una plataforma delgada no deja pasar una caída a velocidad terminal | sin atravesar plataformas |
| En 15° la pelota se queda quieta; en 40° rueda | fricción estática y pendientes |
| Se puede subir una pendiente de 30° | control en pendientes |
| La plataforma móvil transporta la pelota | plataformas cinemáticas |
| Las formas pesada y ligera cambian la altura del salto | sistema de formas |
| El nivel 1 tiene todos los elementos | 32 huevos, picos, enemigos, plataformas, puntos de control, meta |
| Nada queda dentro del terreno | posición inicial, huevos, puntos de control y meta |
| **El nivel 1 se completa de principio a fin sin morir** | búsqueda por haz sobre la simulación real: completado en 18,8 s de juego (ruta rápida, 25/32 huevos en el camino) |

## Pruebas en navegador (Playwright)

| Prueba | Escritorio | iPhone emulado |
|---|---|---|
| Arranca en la pantalla de inicio y «Jugar» abre el nivel 1 (HUD, lienzo) | ✅ | ✅ |
| Teclado: reposo, aceleración, inercia al soltar y salto | ✅ | — |
| Teclado: la pared del borde detiene la pelota | ✅ | — |
| Táctil: ▶ mueve, un segundo dedo salta al mismo tiempo (multitáctil) | — | ✅ |
| Picos: muerte → se pierde una vida → reaparece en el punto de control | ✅ | ✅ |
| **Nivel completo en el juego real**: la solución se reproduce paso a paso → pantalla de victoria → progreso guardado → al recargar aparece ✓ en Niveles | ✅ | ✅ |
| Pausa: el tiempo se detiene y «Continuar» lo reanuda | ✅ | ✅ |
| Laboratorio: panel visible y el deslizador cambia el valor | ✅ | ✅ |
| Diseño: sin desplazamiento de página; el lienzo ocupa toda la ventana | ✅ | ✅ |
| Derrota: al perder 3 vidas aparece «¡Sin vidas!» y «Reintentar» reinicia | ✅ | ✅ |
| Sin errores de JavaScript en ninguna prueba | ✅ | ✅ |

> Nota: la emulación de iPhone usa Chromium, no WebKit/Safari. Todas las pruebas en un iPhone físico están listadas como pendientes; aquí no se afirma haberlas hecho.

## Revisión visual

Se hicieron capturas en el viewport de iPhone (874×402 a DPR 2) de: inicio, inicio del nivel, tronco, resorte, cornisa, escarabajo, plataforma móvil, islas, meta, controles táctiles, laboratorio y pausa. Problemas corregidos a partir de ellas:

- Aplastamiento y estiramiento de la pelota demasiado exagerados.
- Barras sueltas en el fondo con paralaje.
- El panel del laboratorio quedaba demasiado bajo en pantallas horizontales.
- Etiquetas de regla encimadas.
- El borde derecho del nivel se veía sin textura.
