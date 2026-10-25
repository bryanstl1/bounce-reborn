# Análisis de referencias — Bounce Tales

Este documento resume lo que se midió y observó en los dos videos de referencia que entregó el autor (clips de TikTok con gameplay del juego original de 2008, de Rovio y Nokia). Los videos se usan **solo como referencia de diseño**. No se extrajo ni se redistribuye ningún recurso del juego original: sprites, música, niveles o logotipos. Todo el arte, el sonido y los niveles de BOUNCE REBORN son originales.

## Material analizado

| | Video A | Video B |
|---|---|---|
| Duración | 74,1 s | 26,8 s |
| Formato | 576×1024, 30 fps (vertical, recortado) | 576×1024, 30 fps (vertical, recortado) |
| Área de juego en el video | ≈ 576×420 px | ≈ 576×758 px (proporción 3:4 → versión 240×320) |
| Contenido | Bosque turquesa, desierto y mundo nocturno morado; 3 formas de pelota | Nivel inicial del cielo e inicio de una cueva; HUD visible |
| Nota | Grabación borrosa (reescalada) | **Acelerado ≈ 2×**: el reloj del HUD avanza ~48 s del juego en ~24 s de video |

### Método

- **Seguimiento de la pelota.** Se segmentó por color (rojo saturado, HSV) en cada cuadro, obteniendo la posición y el diámetro en píxeles.
- **Movimiento de cámara.** Se estimó con flujo óptico (Lucas-Kanade) sobre el fondo, con la pelota enmascarada. Así se reconstruye la posición de la pelota en el mundo.
- **Gravedad.** Se ajustaron parábolas (ventanas de ±6 cuadros) alrededor de cada punto más alto de los saltos.
- **Unidad de medida.** Todas las medidas se expresan en **diámetros de pelota (D)**, porque es lo único que no depende del escalado del video.

> Las medidas son estimaciones con ruido (compresión de TikTok, recortes, velocidad alterada). Por eso **todo valor físico del juego es un parámetro ajustable** en `src/physics/params.ts` y en el Laboratorio de físicas.

## 1. Movimiento horizontal y aceleración

- **Velocidad típica rodando** (video B corregido ×½): ≈ 3,5–6 D/s. Percentil 90: ≈ 7 D/s.
- La pelota **no arranca a velocidad máxima**: acelera de forma gradual y conserva inercia al soltar. Rueda un poco antes de detenerse.
- Cambiar de dirección frena más rápido que la fricción normal.

**Valores elegidos** (D = 48 px):

| Parámetro | Valor |
|---|---|
| Velocidad máxima | 310 px/s ≈ 6,5 D/s |
| Tiempo para llegar a la máxima | ≈ 0,34 s |
| Fricción al soltar | 650 px/s² → se desliza ≈ 74 px ≈ 1,5 D |

## 2. Altura y duración de los saltos

- Las alturas medidas forman un grupo claro en **≈ 2,5–3,1 D**: salto completo desde el suelo. Los valores mayores corresponden a caídas o resortes.
- El ajuste parabólico da ≈ 31–44 D/s² en tiempo de video. Con el video B acelerado ~2×, eso sería ≈ 8–11 D/s² reales, lo cual es demasiado flotante. Las dos hipótesis (video a velocidad real o acelerado) se resolvieron con un punto medio: una subida de ≈ 0,45 s.

**Valores elegidos:**

| Parámetro | Valor |
|---|---|
| Gravedad | 1500 px/s² ≈ 31 D/s² |
| Impulso de salto | 700 px/s |
| Altura máxima | **163 px ≈ 3,4 D** |
| Tiempo de subida | 0,47 s |
| Tiempo en el aire (plano) | 0,93 s |
| Alcance horizontal a velocidad máxima | ≈ 290 px ≈ 6 D |

- **Salto variable:** al soltar el botón mientras sube, la velocidad vertical se multiplica por 0,5.
- **Rebote continuo:** mantener el botón de salto hace que la pelota siga rebotando, como en el clásico.

## 3. Comportamiento de los rebotes

- Al caer desde altura la pelota da uno o dos rebotes cortos que se amortiguan. Es parte central de la identidad del juego.
- **Restitución en suelo:** 0,38, solo si el impacto supera 260 px/s. Los toques suaves no rebotan, para que no haya vibración en reposo.
- **Paredes:** 0,30.
- **Esquinas redondeadas:** se suaviza el rebote (×0,35) para que no funcionen como impulsores.

## 4. Colisiones y respuesta a obstáculos

- La pelota es un **círculo**; el terreno son **polígonos**, lo que permite pendientes y colinas suaves.
- En pendientes suaves (< ~25°) la pelota se queda quieta si no hay control; en las fuertes rueda hacia abajo.
- **Picos y enemigos:** al tocarlos la pelota explota en partículas y reaparece en el último punto de control.
- **Enemigos que caminan:** se pueden aplastar cayendo encima, lo que da un rebote extra.
- **Resortes (hongos):** lanzan la pelota muy alto.

## 5. Proporciones personaje / escenario

- En el video B el área visible mide ≈ 8,3 D de ancho × 11 D de alto (vertical, 240×320). En el video A, ≈ 10 D × 7,5 D.
- BOUNCE REBORN es **horizontal**: la vista mide **10 D de alto** (480 unidades), y el ancho depende de la pantalla. En un iPhone 16 Pro horizontal se ven ≈ 21 D de ancho, lo que da más anticipación que el original sin cambiar el tamaño relativo de la pelota.

## 6. Cámara

- La cámara sigue a la pelota con una **zona muerta**: la pelota se mueve entre el 30 % y el 75 % del ancho visible (mediana ≈ 49 %).
- La cámara se desplaza a la velocidad de la pelota (≈ 7 D/s en el video B). No hay saltos bruscos.
- **En BOUNCE REBORN:**
  - Seguimiento suavizado con un adelanto (*lookahead*) en la dirección del movimiento.
  - Zona muerta vertical.
  - Límites del nivel.

## 7. Estructura de niveles

Lo que se ve en los videos:

- Cada nivel es un recorrido mayormente **horizontal** con desvíos verticales: plataformas flotantes, cuevas y subidas con resorte.
- Los coleccionables están en **arcos** que enseñan la trayectoria del salto.
- Los peligros (picos) se anuncian con **letreros de advertencia** (triángulo amarillo).
- Cada nivel tiene una **puerta o portal de salida**.
- Hay mundos con paletas muy distintas: turquesa y verde (bosque), beige (desierto o cueva) y morado (noche).

El nivel 1 de BOUNCE REBORN usa esa **estructura general** con una distribución original: pradera, tronco, foso, picos, resorte, cornisa, pendiente, enemigo, abismo con plataforma móvil, islas flotantes, ascensor a una isla bonus y meta.

## 8. Interfaz

En el video B:

- **Arriba a la izquierda:** icono de coleccionable y contador `actual/total` (x/30).
- **Arriba a la derecha:** tiempo del nivel con icono de reloj.
- **Sin botones en pantalla:** el original usaba el teclado del teléfono.

BOUNCE REBORN mantiene la misma lectura (contador a la izquierda, tiempo a la derecha) y agrega vidas, pausa y botones táctiles.

## 9. Animaciones y efectos visuales

- **Destello de estrellas** al cambiar de forma o al perder.
- **Brillo especular** fijo en la pelota (luz desde arriba a la izquierda).
- **Plantas y hongos** que reaccionan al rebote.
- **Paralaje** suave en el fondo.

En BOUNCE REBORN se agregan, como mejoras permitidas:

- Estiramiento y aplastamiento de la pelota.
- Partículas de polvo al aterrizar.
- Brillo al recoger.
- Transiciones suaves.

## 10. Elementos que hacen reconocible la experiencia

1. Una pelota roja brillante, simple y expresiva, como protagonista.
2. El rebote elástico al aterrizar y el salto con inercia.
3. Coleccionables dorados con forma de huevo, contados en el HUD.
4. Picos y letreros de advertencia.
5. Hongos o resortes y plataformas flotantes con césped.
6. Las formas de la pelota (pesada y ligera) como mecánica de acertijo.
7. Colores saturados y vegetación fantástica en capas.

## Parámetros y dónde ajustarlos

- **Código:** `src/physics/params.ts` (`DEFAULT_PARAMS`, `FORM_MODIFIERS`).
- **En el juego:** menú → **Laboratorio de físicas**. Tiene controles deslizantes en vivo, lectura de velocidad y altura del salto, y botones para copiar o restaurar los valores.
- **Formas:**
  - Pesada: gravedad ×1,35, salto ×0,86, rebote ×0,25.
  - Ligera: gravedad ×0,55 y rebote mayor.
