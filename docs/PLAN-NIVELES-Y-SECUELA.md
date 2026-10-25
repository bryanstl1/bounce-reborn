# Plan de niveles y secuela

## Etapa A — Reconstrucción (sensación clásica)

| # | Nivel | Mecánica nueva | Estado |
|---|---|---|---|
| 1-1 | **Bosque Brillante** | Rodar, saltar, rebote continuo, picos, resorte, escarabajo, plataforma móvil, ascensor, islas flotantes | ✅ Jugable |
| 1-2 | Raíces Profundas | **Forma pesada** (piedra): romper paredes agrietadas, hundirse en agua, bajadas rápidas | Siguiente |
| 1-3 | Lago de Burbujas | **Agua** y **forma ligera** (burbuja): flotar, saltos largos, corrientes | Planeado |
| 2-1 | Cuevas Murmullo | Oscuridad con luciérnagas, **plataformas que caen**, trampas de plataforma | Planeado |
| 2-2 | Fábrica de Engranes | **Cañones** que lanzan la pelota, **puertas con interruptor**, aplastadores | Planeado |
| 2-3 | Carrera del Cubo | Persecución: escapar de un jefe que avanza solo; la cámara empuja | Planeado |

Notas:

- Las mecánicas de plataforma que cae, trampa de plataforma, cañón, puerta e interruptor, y la carrera final, son las mismas **categorías** que tenía el clásico. Esa lista salió de los nombres de clases que compartió el autor.
- Todas se implementan desde cero y con diseños de nivel originales.

**Criterio de terminado para cada nivel:**

- Pasa `tests/unit/levels.test.ts`: tiene todos los elementos, nada queda dentro del terreno y el solucionador encuentra una ruta completa.
- Cuenta con un tiempo objetivo para la medalla.
- Se probó en un iPhone real.

### Orden de trabajo sugerido

1. Validar la sensación en un iPhone real con el Laboratorio y fijar valores definitivos.
2. Implementar en la simulación la pared rompible, el agua y la plataforma que cae, con sus pruebas unitarias.
3. Construir el nivel 1-2 y después el 1-3.
4. Agregar una pantalla de mundo (mapa) cuando haya más de 3 niveles.

## Etapa B — Secuela (historia original)

> Personaje y mundo **propios**. No se usan el protagonista, los villanos ni los escenarios del juego original.

**Premisa provisional:** una pelota roja que todos daban por desaparecida vuelve a su valle después de años. Encuentra el lugar dormido: un cristal antiguo dejó de latir y la música del bosque se apagó. Para despertarlo tiene que recorrer los mundos y recuperar los ecos del cristal.

**Mundos:**

1. Bosque.
2. Raíces y lago.
3. Cuevas de cristal.
4. Fábrica abandonada.
5. Cielo de nubes.
6. Corazón del valle.

**Jefes:** uno al final de cada mundo, con patrones basados en las físicas del juego:

- un escarabajo gigante que se aplasta tres veces;
- una máquina de engranes que solo se vence con la forma pesada;
- una persecución en el cielo con la forma ligera.

**Habilidades nuevas, que se desbloquean por mundo:**

- **Dash corto:** un impulso horizontal en el aire.
- **Ancla:** cambio rápido a la forma pesada en el aire, para caer en picada.
- **Burbuja doble:** un salto extra con la forma ligera.

**Secretos:**

- huevos ocultos y salas bonus;
- **llaves de cristal** que abren un mundo extra;
- tres medallas por nivel: terminarlo, todos los huevos y tiempo récord.

**Escenas narrativas:**

- viñetas entre mundos, hechas con el mismo motor (sprites procedurales y texto);
- diálogos cortos disparados por zonas (`DialogTrigger`) sin pausar el juego.

**Técnico:**

- capa `story/` con datos de escenas;
- eventos de nivel (`onEnter`, `onEgg`, `onBoss`);
- la secuela comparte `physics/` y `sim/`; solo agrega entidades y datos.

## Antes de publicar en grande

- Elegir un **nombre propio** para el juego y para el personaje, sin "Bounce".
- Agregar créditos y licencia.
- Opcional: modo sin conexión (*service worker*) y un dominio propio.
