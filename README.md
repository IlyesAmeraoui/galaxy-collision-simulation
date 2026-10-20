<p align="center">
  <img src="assets/coloride.png" alt="Coloride" width="420" />
</p>

<p align="center">
  <strong>created by coloride</strong><br />
  <a href="https://github.com/IlyesAmeraoui/galaxy-collision-simulation">github.com/IlyesAmeraoui/galaxy-collision-simulation</a>
</p>

# Event Horizon

Simulador de agujeros negros en el navegador. No es una animación decorativa: la interfaz calcula y dibuja métricas de relatividad general (Schwarzschild y Kerr) y deja ver, en tiempo real, qué cambia cuando mueves la masa, el espín, la acreción o el punto de vista.

La app se llama **Event Horizon** en pantalla. El título de la ventana es `GR-LAB // General Relativistic Black Hole Simulator`. El paquete npm es `schwarzschild-kerr-blackhole-simulator`.

## Qué ves al abrirla

La vista por defecto es **3D Space**, con el preset **Cygnus X-1** (21.2 masas solares, espín 0.95, inclinación 46°). Encima del canvas flota una barra de cristal con tres zonas:

- La marca **Event Horizon** y la métrica de Schwarzschild en el plano ecuatorial: `ds² = -(1 - r_s/r) c² dt² + (1 - r_s/r)⁻¹ dr² + r² dΩ²`.
- El cambio de modo: **3D Space**, **Split View** y **2D Geodesics**.
- El selector de preset y el botón **Formulas & V_eff**.

A la izquierda hay una tarjeta de controles. Abajo, una tira de telemetría que se recalcula con las fórmulas analíticas cada vez que cambias un parámetro.

## Las tres vistas

### 3D Space

Un raytracer relativista a pantalla completa. Traza fotones hacia atrás en el tiempo, desde la cámara del observador, integrando la geodésica nula con Runge-Kutta de orden 4 (la ecuación de Binet relativista, más un término de arrastre de marco de Kerr).

Lo que produce:

- El disco de acreción delgado, con el perfil de temperatura de Novikov–Thorne / Shakura–Sunyaev: `T(r) ∝ r⁻³ᐟ⁴ (1 - √(r_ISCO / r))¹ᐟ⁴`.
- El color del disco sale de un cuerpo negro de Planck: la temperatura en kelvin se convierte a RGB.
- La imagen primaria del disco, los arcos de Einstein de arriba y de abajo, y el anillo de fotones.
- La sombra del agujero negro. En Schwarzschild el impacto crítico es `b_c = 3√3 / 2 r_s ≈ 2.598 r_s`. Con espín, el limbo se calcula a partir de las órbitas de fotones prógrada y retrógrada (Bardeen, 1973).

El render va en **WebGL2** (un quad a pantalla completa y un fragment shader). Si WebGL2 no está disponible, cae a **Canvas 2D**.

Cómo moverte en esta vista:

- Arrastrar con el ratón cambia el azimut `φ` y la inclinación `θ` (limitada entre 5° y 89°).
- La rueda acerca o aleja al observador entre `5 r_s` y `22 r_s`.

### Split View

Las dos vistas a la vez: el raytracer 3D y el laboratorio 2D de geodésicas. Los controles de lanzamiento aparecen en esta vista y en la vista 2D.

### 2D Geodesics

El plano ecuatorial, en unidades de `r_s`. El laboratorio integra partículas con RK4 y marca tres finales posibles: `orbiting`, `captured` o `escaped`.

- **Photon** (geodésica nula, `ds² = 0`): la luz se dobla por el término `1/r⁵`. Ahí aparecen la esfera de fotones y la captura.
- **Massive** (geodésica temporal): además de ese término, la partícula siente la atracción monopolar. Con momento angular suficiente precesa el periastro (las rosetas).

El espín entra como un acoplo de Lense–Thirring, proporcional a `a* L / r³`.

En el canvas 2D, clic y arrastre lanza una partícula. La dirección del arrastre es la velocidad inicial. En modo fotón la rapidez se normaliza a `c`. En modo masivo, la rapidez escala con la longitud del arrastre y se recorta por debajo de `c`.

## Controles

| Control | Qué hace | Rango |
| --- | --- | --- |
| Mass (M) | Masa del agujero negro, en escala logarítmica | de `10^0.5` a `10^10` masas solares |
| Kerr Spin (a*) | Espín adimensional `a* = c J / (G M²)` | 0 a 0.998 |
| Accretion (ṁ) | Tasa de acreción en unidades de Eddington, `Ṁ / Ṁ_Edd` | 0.01 a 1.00 |
| Inclination (θ) | Inclinación del observador | 5° a 89° |
| Distance (r_obs) | Distancia de la cámara | 5 a 22 radios de Schwarzschild |

Chips del raytracer:

- **Doppler g⁴**. Enciende el desplazamiento Doppler relativista y el beaming de Liouville. El lado que se acerca se ve más brillante y más azul; el que se aleja, más tenue y más rojo. Arranca activo.
- **GR Lensing**. Enciende la curvatura de la luz. Sin esto, el disco no se dobla por detrás del horizonte. Arranca activo.
- **Shadow b_c**. Dibuja el marcador del impacto crítico y de la sombra. Arranca apagado.

Herramientas del laboratorio 2D (solo en Split y en 2D Geodesics):

- **Photon Fan**. Lanza un abanico de fotones para ver cuáles se capturan, cuáles orbitan cerca de la esfera de fotones y cuáles escapan.
- **Rosette**. Lanza una partícula masiva en una órbita que precesa.
- **ISCO**. Coloca una partícula masiva en la órbita circular estable más interna, del lado prógrado.
- **Mode: Photon / Massive**. Cambia el tipo de partícula que lanzas al arrastrar.
- **Clear**. Borra las trayectorias.

Al cargar, la app siembra sola un abanico de fotones y una roseta para que el laboratorio no empiece vacío.

## Presets

El desplegable carga masa, espín, tasa de acreción e inclinación de un objeto real o de un caso límite. La descripción vive en `src/physics/relativity.ts`.

| Preset | Tipo | Masa | a* | ṁ | θ |
| --- | --- | --- | --- | ---: | ---: |
| Cygnus X-1 | Binaria de rayos X, masa estelar | 21.2 M☉ | 0.95 | 0.15 | 46° |
| Schwarzschild Reference (10 M☉) | Teórico, sin rotación | 10 M☉ | 0 | 0.10 | 48° |
| GW150914 Remnant | Remanente de la primera fusión de LIGO | 62 M☉ | 0.68 | 0.08 | 44° |
| Sagittarius A* (Sgr A*) | Agujero negro supermasivo del centro galáctico | 4.154 × 10⁶ M☉ | 0.90 | 0.01 | 42° |
| M87* (Powehi) | Núcleo de Messier 87, con chorro relativista | 6.5 × 10⁹ M☉ | 0.90 | 0.02 | 50° |
| Extreme Kerr (Thorne Limit) | Espín casi máximo, limitado por radiación | 1.0 × 10⁸ M☉ | 0.998 | 0.12 | 40° |

Cygnus X-1 es el preset de arranque. El estado inicial de la sesión usa ṁ = 0.18 hasta que vuelves a elegir el preset, que lo deja en 0.15.

## La tira de telemetría

Todo esto se recalcula al vuelo. No son etiquetas fijas.

- **r_s**. Radio de Schwarzschild, `r_s = 2GM/c²`, en metros, kilómetros o UA según el tamaño.
- **r₊**. Horizonte externo de Kerr, `r₊ = ½ r_s (1 + √(1 - a*²))`. Con a* = 0 vale `r_s`. Al acercarse a 1, se encoge hacia `0.5 r_s`.
- **r_ph**. Órbita circular de fotones en el ecuador, lado prógrado. Sin espín está en `1.5 r_s`. Con espín alto se acerca al horizonte.
- **Shadow b_c**. Parámetro de impacto crítico. Un fotón que llega desde el infinito con `b < b_c` cae dentro.
- **r_ISCO**. Órbita circular estable más interna, lado prógrado. En Schwarzschild está en `3 r_s`. En el límite de Thorne (`a* = 0.998`) baja hasta unos `0.62 r_s`.
- **T_disk**. Temperatura máxima del disco de acreción, en kelvin. Depende de la masa, del espín y de ṁ.

## Cajón de fórmulas

**Formulas & V_eff** abre un panel a la derecha con la curva del potencial efectivo `V_eff(r)` y cuatro relaciones:

- `r_s = 2GM/c²` y `r₊ = r_g (1 + √(1 - a*²))`
- la geodésica nula `d²u/dφ² + u = (3/2) r_s u²`
- el perfil de temperatura del disco
- temperatura de Hawking y corrimiento al rojo gravitatorio en la sonda (`r = 2 r_s` por defecto)

La sonda está fija a `2 r_s` en el estado de la sesión. A esa distancia, el factor de dilatación temporal de un observador estático es `√(1 - r_s/r)` y el redshift gravitatorio es `z = 1/√(1 - r_s/r) - 1`. Dentro del horizonte estático el reloj propio se detiene respecto del infinito.

## Física que está implementada

Todo vive en TypeScript, sin una librería de relatividad. Las unidades del integrador son `r_s = 1` y `c = 1`, así que `GM/c² = 0.5`.

Horizontes, órbitas y sombra:

- radio gravitatorio `r_g = GM/c²` y radio de Schwarzschild
- horizontes de Kerr `r₊` y `r₋`
- ergosfera (límite estático) en función del ángulo polar
- esferas de fotones prógrada y retrógrada
- impacto crítico de la sombra
- ISCO prógrado y retrógrado
- velocidad circular exacta de una geodésica

Disco, luz y observador:

- eficiencia radiativa de la acreción (≈ 5.7 % en Schwarzschild, ≈ 32 % cerca del límite de Thorne)
- dilatación temporal y redshift gravitatorio
- velocidad de escape y velocidad orbital circular, en unidades de `c`
- factor Doppler del disco
- ángulo de deflexión de la luz en función del parámetro de impacto
- luminosidad y tasa de Eddington
- temperatura del disco y su máximo
- color de cuerpo negro
- termodinámica de Hawking (temperatura y escalas asociadas)
- gradiente de aceleración de marea

El laboratorio 2D dibuja el potencial efectivo y avanza cada partícula con `stepGeodesicRK4`.

## De qué está hecha

```text
index.html                 página vacía: monta #app y carga el módulo
src/main.ts                interfaz, estado, presets, telemetría y eventos
src/style.css              HUD de cristal sobre el canvas a pantalla completa
src/physics/relativity.ts  fórmulas analíticas y los seis presets
src/physics/geodesics.ts   partículas, potencial efectivo e integrador RK4
src/physics/relativity.test.ts
src/render/raytracer.ts    raytracer WebGL2 y reserva en Canvas 2D
src/render/geodesicLab.ts  canvas de órbitas y canvas de V_eff
vite.config.ts             servidor de desarrollo en 127.0.0.1:5173
```

No hay backend, ni cuenta, ni base de datos. Todo corre en el navegador. La tipografía de la interfaz (Space Grotesk y JetBrains Mono) se carga desde Google Fonts.

Stack: TypeScript 5.7, Vite 6 y Vitest 2. El código es estricto (`strict`, sin variables ni parámetros sin usar).

## Cómo ejecutarlo

Hace falta Node.js. El lockfile del repo es el de npm.

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:5173](http://127.0.0.1:5173).

```bash
npm test          # comprueba las fórmulas de relativity.ts
npm run build     # tsc -b && vite build
npm run preview   # sirve el build
```

## Qué no es

No es una foto del Event Horizon Telescope ni una integración completa de la métrica de Kerr en 3+1. El raytracer usa la ecuación de Binet relativista con una corrección de espín, y el disco es un modelo delgado. Sirve para ver, con números reales, cómo se mueven el horizonte, la esfera de fotones, la sombra, el ISCO y el brillo Doppler cuando cambias el agujero negro.

## Licencia

MIT. Copyright (c) 2026 Ilyes Ameraoui. El texto está en [LICENSE](LICENSE).

created by coloride
