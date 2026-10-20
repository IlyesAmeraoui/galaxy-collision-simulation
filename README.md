<p align="center">
  <img src="assets/coloride.png" alt="Coloride" width="420" />
</p>

<p align="center">
  <strong>created by coloride</strong><br />
  <a href="https://github.com/IlyesAmeraoui/galaxy-collision-simulation">github.com/IlyesAmeraoui/galaxy-collision-simulation</a>
</p>

# Event Horizon

A black hole simulator that runs in the browser. It is not a decorative animation. The interface computes and draws general-relativity quantities for the Schwarzschild and Kerr metrics, and shows, in real time, what changes when you move the mass, the spin, the accretion rate, or the viewpoint.

On screen the app is named **Event Horizon**. The window title is `GR-LAB // General Relativistic Black Hole Simulator`. The npm package is `schwarzschild-kerr-blackhole-simulator`.

## What you see when it opens

The default view is **3D Space**, with the **Cygnus X-1** preset (21.2 solar masses, spin 0.95, inclination 46°). A glass bar floats over the canvas in three zones:

- The **Event Horizon** mark and the equatorial Schwarzschild metric: `ds² = -(1 - r_s/r) c² dt² + (1 - r_s/r)⁻¹ dr² + r² dΩ²`.
- The mode switch: **3D Space**, **Split View**, and **2D Geodesics**.
- The preset selector and the **Formulas & V_eff** button.

A control card sits on the left. A telemetry strip sits at the bottom and is recomputed from the analytic formulas whenever a parameter changes.

## The three views

### 3D Space

A fullscreen relativistic raytracer. It traces photons backward in time from the observer camera, integrating the null geodesic with fourth-order Runge-Kutta (the relativistic Binet equation, plus a Kerr frame-dragging term).

What it produces:

- The thin accretion disk, with the Novikov–Thorne / Shakura–Sunyaev temperature profile: `T(r) ∝ r⁻³ᐟ⁴ (1 - √(r_ISCO / r))¹ᐟ⁴`.
- Disk color comes from a Planck blackbody: temperature in kelvin is mapped to RGB.
- The primary disk image, the upper and lower Einstein arcs, and the photon ring.
- The black hole shadow. In Schwarzschild the critical impact parameter is `b_c = 3√3 / 2 r_s ≈ 2.598 r_s`. With spin, the limb is computed from the prograde and retrograde photon orbits (Bardeen, 1973).

Rendering uses **WebGL2** (a fullscreen quad and a fragment shader). If WebGL2 is unavailable, it falls back to **Canvas 2D**.

How to move in this view:

- Dragging changes the azimuth `φ` and the inclination `θ` (clamped between 5° and 89°).
- The scroll wheel moves the observer between `5 r_s` and `22 r_s`.

### Split View

Both views at once: the 3D raytracer and the 2D geodesic lab. The launch controls appear in this view and in the 2D view.

### 2D Geodesics

The equatorial plane, in units of `r_s`. The lab integrates particles with RK4 and marks three possible endings: `orbiting`, `captured`, or `escaped`.

- **Photon** (null geodesic, `ds² = 0`): light bends because of the `1/r⁵` term. That is where the photon sphere and capture show up.
- **Massive** (timelike geodesic): on top of that term, the particle feels the monopole attraction. With enough angular momentum the periapsis precesses (the rosettes).

Spin enters as a Lense–Thirring coupling, proportional to `a* L / r³`.

On the 2D canvas, click and drag to launch a particle. The drag direction is the initial velocity. In photon mode the speed is normalized to `c`. In massive mode the speed scales with the drag length and is clipped below `c`.

## Controls

| Control | What it does | Range |
| --- | --- | --- |
| Mass (M) | Black hole mass, on a logarithmic scale | from `10^0.5` to `10^10` solar masses |
| Kerr Spin (a*) | Dimensionless spin `a* = c J / (G M²)` | 0 to 0.998 |
| Accretion (ṁ) | Accretion rate in Eddington units, `Ṁ / Ṁ_Edd` | 0.01 to 1.00 |
| Inclination (θ) | Observer inclination | 5° to 89° |
| Distance (r_obs) | Camera distance | 5 to 22 Schwarzschild radii |

Raytracer chips:

- **Doppler g⁴**. Turns on the relativistic Doppler shift and Liouville beaming. The approaching side looks brighter and bluer; the receding side looks dimmer and redder. On by default.
- **GR Lensing**. Turns on light bending. Without it, the disk does not wrap behind the horizon. On by default.
- **Shadow b_c**. Draws the critical-impact and shadow marker. Off by default.

2D lab tools (Split View and 2D Geodesics only):

- **Photon Fan**. Launches a fan of photons so you can see which ones are captured, which ones skim the photon sphere, and which ones escape.
- **Rosette**. Launches a massive particle on a precessing orbit.
- **ISCO**. Places a massive particle on the prograde innermost stable circular orbit.
- **Mode: Photon / Massive**. Switches the particle type launched by dragging.
- **Clear**. Removes the trajectories.

On load, the app seeds a photon fan and a rosette so the lab does not start empty.

## Presets

The dropdown loads mass, spin, accretion rate, and inclination for a real object or a limiting case. The descriptions live in `src/physics/relativity.ts`.

| Preset | Type | Mass | a* | ṁ | θ |
| --- | --- | --- | --- | ---: | ---: |
| Cygnus X-1 | Stellar-mass X-ray binary | 21.2 M☉ | 0.95 | 0.15 | 46° |
| Schwarzschild Reference (10 M☉) | Theoretical, non-rotating | 10 M☉ | 0 | 0.10 | 48° |
| GW150914 Remnant | Remnant of the first LIGO merger | 62 M☉ | 0.68 | 0.08 | 44° |
| Sagittarius A* (Sgr A*) | Supermassive black hole at the galactic center | 4.154 × 10⁶ M☉ | 0.90 | 0.01 | 42° |
| M87* (Powehi) | Messier 87 core, with a relativistic jet | 6.5 × 10⁹ M☉ | 0.90 | 0.02 | 50° |
| Extreme Kerr (Thorne Limit) | Near-maximal spin, radiation-limited | 1.0 × 10⁸ M☉ | 0.998 | 0.12 | 40° |

Cygnus X-1 is the startup preset. The initial session state uses ṁ = 0.18 until you select the preset again, which sets it back to 0.15.

## Telemetry strip

All of this is recomputed on the fly. These are not fixed labels.

- **r_s**. Schwarzschild radius, `r_s = 2GM/c²`, shown in meters, kilometers, or AU depending on the size.
- **r₊**. Outer Kerr horizon, `r₊ = ½ r_s (1 + √(1 - a*²))`. At a* = 0 it equals `r_s`. As a* approaches 1, it shrinks toward `0.5 r_s`.
- **r_ph**. Equatorial circular photon orbit, prograde side. With no spin it sits at `1.5 r_s`. At high spin it moves toward the horizon.
- **Shadow b_c**. Critical impact parameter. A photon arriving from infinity with `b < b_c` falls in.
- **r_ISCO**. Innermost stable circular orbit, prograde side. In Schwarzschild it is at `3 r_s`. At the Thorne limit (`a* = 0.998`) it drops to about `0.62 r_s`.
- **T_disk**. Peak accretion-disk temperature, in kelvin. It depends on mass, spin, and ṁ.

## Formula drawer

**Formulas & V_eff** opens a panel on the right with the effective-potential curve `V_eff(r)` and four relations:

- `r_s = 2GM/c²` and `r₊ = r_g (1 + √(1 - a*²))`
- the null geodesic `d²u/dφ² + u = (3/2) r_s u²`
- the disk temperature profile
- Hawking temperature and gravitational redshift at the probe (`r = 2 r_s` by default)

The probe is fixed at `2 r_s` in the session state. At that distance, the time-dilation factor for a static observer is `√(1 - r_s/r)`, and the gravitational redshift is `z = 1/√(1 - r_s/r) - 1`. Inside the static limit, proper time stops relative to infinity.

## Physics that is implemented

Everything lives in TypeScript, with no relativity library. Integrator units are `r_s = 1` and `c = 1`, so `GM/c² = 0.5`.

Horizons, orbits, and shadow:

- gravitational radius `r_g = GM/c²` and the Schwarzschild radius
- Kerr horizons `r₊` and `r₋`
- ergosphere (static limit) as a function of polar angle
- prograde and retrograde photon spheres
- critical shadow impact parameter
- prograde and retrograde ISCO
- exact circular geodesic speed

Disk, light, and observer:

- accretion radiative efficiency (about 5.7% in Schwarzschild, about 32% near the Thorne limit)
- gravitational time dilation and redshift
- escape speed and circular orbital speed, in units of `c`
- disk Doppler factor
- light-deflection angle as a function of impact parameter
- Eddington luminosity and accretion rate
- disk temperature and its peak
- blackbody color
- Hawking thermodynamics (temperature and related scales)
- tidal acceleration gradient

The 2D lab draws the effective potential and advances each particle with `stepGeodesicRK4`.

## What it is made of

```text
index.html                 empty page: mounts #app and loads the module
src/main.ts                interface, state, presets, telemetry, and events
src/style.css              glass HUD over the fullscreen canvas
src/physics/relativity.ts  analytic formulas and the six presets
src/physics/geodesics.ts   particles, effective potential, and the RK4 integrator
src/physics/relativity.test.ts
src/render/raytracer.ts    WebGL2 raytracer and Canvas 2D fallback
src/render/geodesicLab.ts  orbit canvas and V_eff canvas
vite.config.ts             dev server on 127.0.0.1:5173
```

There is no backend, no account, and no database. Everything runs in the browser. The interface fonts (Space Grotesk and JetBrains Mono) are loaded from Google Fonts.

Stack: TypeScript 5.7, Vite 6, and Vitest 2. The code is strict (`strict`, no unused locals or parameters).

## How to run it

Node.js is required. The lockfile in the repo is npm's.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

```bash
npm test          # checks the formulas in relativity.ts
npm run build     # tsc -b && vite build
npm run preview   # serves the build
```

## What it is not

It is not an Event Horizon Telescope photograph, and it is not a full 3+1 integration of the Kerr metric. The raytracer uses the relativistic Binet equation with a spin correction, and the disk is a thin-disk model. It is there so you can watch, with real numbers, how the horizon, the photon sphere, the shadow, the ISCO, and the Doppler brightness move when you change the black hole.

## License

MIT. Copyright (c) 2026 Ilyes Ameraoui. The text is in [LICENSE](LICENSE).

created by coloride
