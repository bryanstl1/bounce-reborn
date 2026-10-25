# Problemas pendientes

## Pruebas que solo se pueden hacer en un iPhone real

Todavía **no se ha probado en un iPhone físico**. Las pruebas automáticas usan Chromium con un viewport de iPhone emulado (874×402, DPR 3, táctil), que no es Safari.

| Prueba | Qué revisar |
|---|---|
| Arranque en Safari iOS | El juego carga, WebGL activo, sin errores (Ajustes → Safari → Avanzado → Inspector web). |
| Audio | Suena después del primer toque. Con el interruptor de silencio activado, iOS silencia Web Audio: es el comportamiento normal. |
| Controles táctiles | Rodar y saltar al mismo tiempo. Deslizar el pulgar entre ◀ y ▶. Que no aparezca la lupa ni la selección de texto. |
| Gestos del sistema | Deslizar desde el borde inferior (barra de inicio) mientras se juega. Si molesta, agregar el juego a la pantalla de inicio. |
| Pantalla de inicio (PWA) | Compartir → Agregar a inicio → se abre a pantalla completa en horizontal. |
| Rendimiento | Activar «Mostrar FPS» en Ajustes. Lo esperado es 60 FPS (o 120 en ProMotion). Si baja, probar la calidad «Ahorro de batería». |
| Área segura | El HUD y los botones no quedan bajo la Dynamic Island ni en las esquinas redondeadas. |
| Rotación | En vertical aparece «Gira tu iPhone»; al volver a horizontal, todo se reacomoda. |
| Guardado | Terminar el nivel, cerrar Safari y abrirlo: el nivel aparece con ✓. En navegación privada puede no guardarse (se avisa en Ajustes). |
| Sensación | Comparar en el Laboratorio con tu recuerdo del original: salto, inercia y rebote. Ajustar y usar «Copiar valores» para pasármelos. |

## Limitaciones conocidas

- **Fuente:** Baloo 2 se carga desde Google Fonts. Sin conexión se usa la fuente redondeada del sistema.
- **Sin modo sin conexión:** todavía no hay *service worker*.
- **Rebote en esquinas:** la colisión es exacta contra los segmentos, pero los vértices muy agudos (< 30°) pueden empujar la pelota de lado. Los niveles actuales no tienen ángulos así.
- **Plataformas móviles:** no chocan con el terreno. Si una atrapa a la pelota contra una pared, se aplica la muerte por aplastamiento. El nivel 1 no tiene ese caso.
- **Formas pesada y ligera:** existen en el motor y en el Laboratorio, pero el nivel 1 no las usa. Llegan en el nivel 1-2.
- **Agua, paredes rompibles, cañones y plataformas que caen:** todavía no están implementados (ver el plan).
- **Huevos del arco del resorte:** si llegas al resorte despacio, no se recogen todos. Es intencional, porque premia llegar con impulso.
- **Nombre:** «BOUNCE REBORN» es provisional. Antes de una publicación seria conviene usar un nombre propio.

## Deuda técnica

- No hay `package-lock.json`, porque se generó en un entorno sin acceso al registro de npm. Conviene ejecutar `npm install` una vez en local o en CI y subir el lockfile.
- Las acciones de GitHub usan versiones que avisan de la migración a Node 24. Por ahora funcionan; hay que actualizarlas cuando salgan sus versiones nuevas.
- El paquete JS es casi todo Phaser (≈ 1,2 MB, ≈ 320 KB con gzip). Si la carga inicial importa más adelante, se puede usar una compilación personalizada de Phaser.
