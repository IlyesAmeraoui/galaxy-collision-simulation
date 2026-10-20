/**
 * Main Application Entry Point — Minimalist General Relativistic Black Hole Simulator
 *
 * Connects the analytical General Relativity engine (Schwarzschild & Kerr metrics,
 * Novikov-Thorne accretion disk thermodynamics, Hawking radiation, tidal forces)
 * with the full-bleed 3D WebGL2 Null-Geodesic Raytracer and 2D RK4 Geodesic Lab.
 */

import './style.css';
import {
  BLACK_HOLE_PRESETS,
  criticalImpactParameterInRs,
  formatScientific,
  gravitationalRedshift,
  gravitationalTimeDilation,
  hawkingThermodynamics,
  iscoRadiiInRs,
  kerrHorizonRadiiInRs,
  peakAccretionDiskTemperatureKelvin,
  photonSphereRadiiInRs,
  schwarzschildRadiusMeters,
} from './physics/relativity';
import {
  createGeodesicParticle,
  exactGeodesicCircularSpeed,
  GeodesicParticle,
  GeodesicParticleType,
  stepGeodesicRK4,
} from './physics/geodesics';
import { RelativisticRaytracer } from './render/raytracer';
import { DragLaunchVector, GeodesicLabRenderer } from './render/geodesicLab';

type ViewMode = 'raytracer' | 'split' | 'geodesic';

interface SimulatorState {
  viewMode: ViewMode;
  presetId: string;
  /** Mass in solar masses M / M_solar */
  massSolar: number;
  /** Dimensionless Kerr spin parameter a* = c J / (G M^2) in [0, 0.998] */
  spin: number;
  /** Eddington accretion rate ratio m_dot = M_dot / M_dot_Edd */
  accretionRateEdd: number;
  /** Observer inclination angle theta_obs in degrees */
  inclinationDeg: number;
  /** Camera azimuthal angle phi_obs in radians */
  azimuthRad: number;
  /** Observer distance in units of r_s */
  cameraDistanceRs: number;
  /** Outer disk radius in units of r_s */
  diskOuterRadiusRs: number;
  /** Radial probe distance in units of r_s for local spacetime telemetry */
  probeRadiusRs: number;
  /** Toggle relativistic Doppler shift & Liouville g^4 beaming */
  enableDopplerBeaming: boolean;
  /** Toggle General Relativistic light bending */
  enableGravitationalLensing: boolean;
  /** Toggle critical shadow / horizon overlay markers */
  showRelativisticMarkers: boolean;
  /** Toggle collapsible equations & V_eff drawer */
  showDrawer: boolean;
  /** Particle type launched when clicking/dragging in the Geodesic Lab */
  launchParticleType: GeodesicParticleType;
}

const state: SimulatorState = {
  viewMode: 'raytracer',
  presetId: 'cygnus-x1',
  massSolar: 21.2,
  spin: 0.95,
  accretionRateEdd: 0.18,
  inclinationDeg: 46,
  azimuthRad: -0.55,
  cameraDistanceRs: 8.2,
  diskOuterRadiusRs: 18.5,
  probeRadiusRs: 2.0,
  enableDopplerBeaming: true,
  enableGravitationalLensing: true,
  showRelativisticMarkers: false,
  showDrawer: false,
  launchParticleType: 'photon',
};

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app container element');
}

appRoot.innerHTML = `
  <!-- Fullscreen Interactive Canvas Viewport -->
  <main class="viewport mode-raytracer" id="viewport-area">
    <div class="canvas-pane" id="pane-raytracer">
      <canvas class="sim-canvas" id="raytracer-canvas"></canvas>
    </div>
    <div class="canvas-pane hidden" id="pane-geodesic">
      <canvas class="sim-canvas" id="orbit-canvas"></canvas>
    </div>
  </main>

  <!-- Minimalist Floating Top Header -->
  <header class="hud-top">
    <div class="glass-pill">
      <span class="brand-dot"></span>
      <span class="brand-name">Event Horizon</span>
      <span class="brand-eq">ds² = -(1 - r_s/r)c²dt² + (1 - r_s/r)⁻¹dr² + r²dΩ²</span>
    </div>

    <div class="glass-pill mode-switch" role="tablist">
      <button class="mode-btn active" data-mode="raytracer">3D Space</button>
      <button class="mode-btn" data-mode="split">Split View</button>
      <button class="mode-btn" data-mode="geodesic">2D Geodesics</button>
    </div>

    <div class="glass-pill">
      <select class="preset-select" id="preset-select" aria-label="Black Hole Preset">
        ${BLACK_HOLE_PRESETS.map(
          (p) => `<option value="${p.id}" ${p.id === state.presetId ? 'selected' : ''}>${p.name} (${p.spin} a*)</option>`
        ).join('')}
      </select>
      <button class="mode-btn" id="btn-toggle-drawer">Formulas &amp; V_eff</button>
    </div>
  </header>

  <!-- Minimalist Floating Left Control Card -->
  <aside class="hud-controls">
    <div class="control-row">
      <div class="control-header">
        <span class="control-label">Mass (M)</span>
        <span class="control-value" id="val-mass">21.2 M☉</span>
      </div>
      <input type="range" id="slider-mass" min="0.5" max="10" step="0.01" value="${Math.log10(state.massSolar).toFixed(2)}" />
    </div>

    <div class="control-row">
      <div class="control-header">
        <span class="control-label">Kerr Spin (a*)</span>
        <span class="control-value" id="val-spin">0.95</span>
      </div>
      <input type="range" id="slider-spin" min="0" max="0.998" step="0.002" value="${state.spin}" />
    </div>

    <div class="control-row">
      <div class="control-header">
        <span class="control-label">Accretion (ṁ)</span>
        <span class="control-value" id="val-mdot">0.18</span>
      </div>
      <input type="range" id="slider-mdot" min="0.01" max="1.0" step="0.01" value="${state.accretionRateEdd}" />
    </div>

    <div class="control-row">
      <div class="control-header">
        <span class="control-label">Inclination (θ)</span>
        <span class="control-value" id="val-inclination">${state.inclinationDeg}°</span>
      </div>
      <input type="range" id="slider-inclination" min="5" max="89" step="0.5" value="${state.inclinationDeg}" />
    </div>

    <div class="control-row">
      <div class="control-header">
        <span class="control-label">Distance (r_obs)</span>
        <span class="control-value" id="val-camdist">11.2 r_s</span>
      </div>
      <input type="range" id="slider-camdist" min="5.0" max="22.0" step="0.2" value="${state.cameraDistanceRs}" />
    </div>

    <div class="chip-row">
      <button class="chip-btn active" id="btn-doppler">Doppler g⁴</button>
      <button class="chip-btn active" id="btn-lensing">GR Lensing</button>
      <button class="chip-btn" id="btn-markers">Shadow b_c</button>
    </div>

    <!-- Compact Geodesic Launch Tools (shown in Split / 2D modes) -->
    <div class="geodesic-tools hidden" id="geodesic-tools">
      <span class="mini-label">RK4 Geodesic Lab (Click &amp; Drag)</span>
      <div class="chip-row">
        <button class="chip-btn" id="btn-exp-photon-fan">Photon Fan</button>
        <button class="chip-btn" id="btn-exp-rosette">Rosette</button>
        <button class="chip-btn" id="btn-exp-isco">ISCO</button>
      </div>
      <div class="chip-row">
        <button class="chip-btn active" id="btn-toggle-launch-type">Mode: Photon</button>
        <button class="chip-btn" id="btn-clear-orbits">Clear</button>
      </div>
    </div>
  </aside>

  <!-- Collapsible Right Drawer: Effective Potential V_eff(r) & Relativistic Formulas -->
  <aside class="hud-drawer hidden" id="hud-drawer">
    <span class="mini-label">Effective Potential V_eff(r)</span>
    <div class="potential-wrap">
      <canvas id="potential-canvas"></canvas>
    </div>
    <div class="eq-list">
      <div class="eq-item">r_s = 2GM/c² | r_+ = r_g(1 + √(1 - a*²))</div>
      <div class="eq-item">d²u/dφ² + u = (3/2) r_s u² (Null Geodesic)</div>
      <div class="eq-item">T(r) ∝ r⁻³/⁴ (1 - √(r_ISCO/r))¹/⁴</div>
      <div class="eq-item" id="drawer-extra-stats">T_H = 1.4e-9 K | z(2r_s) = 0.414</div>
    </div>
  </aside>

  <!-- Minimalist Floating Bottom Telemetry Strip -->
  <footer class="hud-bottom">
    <div class="stat-item">
      <span class="stat-key">r_s</span>
      <span class="stat-val" id="metric-rs">62.6 km</span>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-item">
      <span class="stat-key">r_+</span>
      <span class="stat-val" id="metric-rplus">0.66 r_s</span>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-item">
      <span class="stat-key">r_ph</span>
      <span class="stat-val" id="metric-rph">0.72 r_s</span>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-item">
      <span class="stat-key">Shadow b_c</span>
      <span class="stat-val" id="metric-bc">2.60 r_s</span>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-item">
      <span class="stat-key">r_ISCO</span>
      <span class="stat-val" id="metric-isco">0.97 r_s</span>
    </div>
    <div class="stat-sep"></div>
    <div class="stat-item">
      <span class="stat-key">T_disk</span>
      <span class="stat-val" id="metric-disk-temp">1.1 × 10⁷ K</span>
    </div>
  </footer>
`;

const raytracerCanvas = document.querySelector<HTMLCanvasElement>('#raytracer-canvas')!;
const orbitCanvas = document.querySelector<HTMLCanvasElement>('#orbit-canvas')!;
const potentialCanvas = document.querySelector<HTMLCanvasElement>('#potential-canvas')!;

const raytracer = new RelativisticRaytracer(raytracerCanvas);
const geodesicLab = new GeodesicLabRenderer(orbitCanvas, potentialCanvas);

let particles: GeodesicParticle[] = [];
let nextParticleId = 1;
let selectedParticle: GeodesicParticle | null = null;
let dragVector: DragLaunchVector | null = null;

/**
 * Formats a distance in meters into concise astronomical/SI units (m, km, AU).
 */
function formatLengthMeters(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(1)} m`;
  const km = meters / 1000;
  if (km < 1e6) return `${km < 100 ? km.toFixed(1) : formatScientific(km, 2)} km`;
  const au = meters / 1.495978707e11;
  return `${formatScientific(au, 2)} AU`;
}

/**
 * Launches a parallel bundle of photons across the critical impact parameter b_c = (3*sqrt(3)/2) r_s.
 */
function launchPhotonBeamFan(): void {
  particles = [];
  const bCrit = criticalImpactParameterInRs(state.spin);
  const impactParams = [
    0.8,
    1.5,
    2.1,
    bCrit - 0.04,
    bCrit,
    bCrit + 0.03,
    bCrit + 0.16,
    3.2,
    4.0,
    5.0,
  ];

  for (const b of impactParams) {
    const isCritical = Math.abs(b - bCrit) < 0.06;
    const isCaptured = b < bCrit;
    const color = isCritical ? '#fbbf24' : isCaptured ? '#f97316' : '#38bdf8';
    particles.push(
      createGeodesicParticle(nextParticleId++, 'photon', -12.5, b, 1.0, 0.0, state.spin, color)
    );
  }
  selectedParticle = particles[4] ?? particles[0] ?? null;
}

/**
 * Launches a massive test body into an eccentric orbit showing General Relativistic periapsis precession.
 */
function launchPrecessingRosetteOrbit(): void {
  const r0 = 7.2;
  const vCirc = exactGeodesicCircularSpeed(r0, state.spin);
  const p = createGeodesicParticle(
    nextParticleId++,
    'massive',
    0.0,
    r0,
    -vCirc * 0.84,
    0.0,
    state.spin,
    '#fbbf24'
  );
  particles.push(p);
  selectedParticle = p;
}

/**
 * Launches a massive particle at the prograde Innermost Stable Circular Orbit (r = r_ISCO).
 */
function launchIscoCircularOrbit(): void {
  const { progradeRs } = iscoRadiiInRs(state.spin);
  const rOrbit = Math.max(1.65, progradeRs);
  const vCirc = exactGeodesicCircularSpeed(rOrbit, state.spin);
  const p = createGeodesicParticle(
    nextParticleId++,
    'massive',
    rOrbit,
    0.0,
    0.0,
    vCirc,
    state.spin,
    '#34d399'
  );
  particles.push(p);
  selectedParticle = p;
}

/**
 * Updates all minimalist HUD telemetry readouts using analytical General Relativity formulas.
 */
function updatePhysicsTelemetryUI(): void {
  const rsMeters = schwarzschildRadiusMeters(state.massSolar);
  const { rPlusRs } = kerrHorizonRadiiInRs(state.spin);
  const { progradeRs: rPhotonRs } = photonSphereRadiiInRs(state.spin);
  const bCritRs = criticalImpactParameterInRs(state.spin);
  const { progradeRs: rIscoRs } = iscoRadiiInRs(state.spin);

  document.getElementById('val-mass')!.textContent = `${formatScientific(state.massSolar, 2)} M☉`;
  document.getElementById('val-spin')!.textContent = state.spin.toFixed(2);
  document.getElementById('val-mdot')!.textContent = state.accretionRateEdd.toFixed(2);
  document.getElementById('val-inclination')!.textContent = `${state.inclinationDeg.toFixed(0)}°`;
  document.getElementById('val-camdist')!.textContent = `${state.cameraDistanceRs.toFixed(1)} r_s`;

  document.getElementById('metric-rs')!.textContent = formatLengthMeters(rsMeters);
  document.getElementById('metric-rplus')!.textContent = `${rPlusRs.toFixed(2)} r_s`;
  document.getElementById('metric-rph')!.textContent = `${rPhotonRs.toFixed(2)} r_s`;
  document.getElementById('metric-bc')!.textContent = `${bCritRs.toFixed(2)} r_s`;
  document.getElementById('metric-isco')!.textContent = `${rIscoRs.toFixed(2)} r_s`;

  const tPeak = peakAccretionDiskTemperatureKelvin(
    state.massSolar,
    state.spin,
    state.accretionRateEdd
  );
  document.getElementById('metric-disk-temp')!.textContent = `${formatScientific(tPeak, 2)} K`;

  const hawking = hawkingThermodynamics(state.massSolar, state.spin);
  const dilation = gravitationalTimeDilation(state.probeRadiusRs);
  const redshift = gravitationalRedshift(state.probeRadiusRs);
  document.getElementById('drawer-extra-stats')!.textContent =
    `T_H = ${formatScientific(hawking.hawkingTempKelvin, 2)} K | dτ/dt(2r_s) = ${dilation.toFixed(3)} | z = ${redshift.toFixed(3)}`;
}

// Switch between 3D Space, Split View, and 2D Geodesics
function setViewMode(mode: ViewMode): void {
  state.viewMode = mode;
  const viewport = document.getElementById('viewport-area')!;
  const paneRaytracer = document.getElementById('pane-raytracer')!;
  const paneGeodesic = document.getElementById('pane-geodesic')!;
  const geodesicTools = document.getElementById('geodesic-tools')!;

  viewport.className = `viewport mode-${mode}`;
  paneRaytracer.classList.toggle('hidden', mode === 'geodesic');
  paneGeodesic.classList.toggle('hidden', mode === 'raytracer');
  geodesicTools.classList.toggle('hidden', mode === 'raytracer');

  document.querySelectorAll('.mode-switch .mode-btn').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLButtonElement).dataset.mode === mode);
  });
}

document.querySelectorAll<HTMLButtonElement>('.mode-switch .mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode as ViewMode;
    if (mode) setViewMode(mode);
  });
});

// Toggle right collapsible drawer (Effective Potential & Formulas)
const btnToggleDrawer = document.getElementById('btn-toggle-drawer')!;
btnToggleDrawer.addEventListener('click', () => {
  state.showDrawer = !state.showDrawer;
  document.getElementById('hud-drawer')!.classList.toggle('hidden', !state.showDrawer);
  btnToggleDrawer.classList.toggle('active', state.showDrawer);
});

// Preset selector
const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
presetSelect.addEventListener('change', () => {
  const preset = BLACK_HOLE_PRESETS.find((p) => p.id === presetSelect.value);
  if (!preset) return;
  state.presetId = preset.id;
  state.massSolar = preset.massSolar;
  state.spin = preset.spin;
  state.accretionRateEdd = preset.accretionRateEdd;
  state.inclinationDeg = preset.inclinationDeg;

  (document.getElementById('slider-mass') as HTMLInputElement).value = Math.log10(
    state.massSolar
  ).toFixed(2);
  (document.getElementById('slider-spin') as HTMLInputElement).value = String(state.spin);
  (document.getElementById('slider-mdot') as HTMLInputElement).value = String(
    state.accretionRateEdd
  );
  (document.getElementById('slider-inclination') as HTMLInputElement).value = String(
    state.inclinationDeg
  );

  updatePhysicsTelemetryUI();
});

// Sliders
document.getElementById('slider-mass')!.addEventListener('input', (e) => {
  state.massSolar = Math.pow(10, parseFloat((e.target as HTMLInputElement).value));
  updatePhysicsTelemetryUI();
});

document.getElementById('slider-spin')!.addEventListener('input', (e) => {
  state.spin = parseFloat((e.target as HTMLInputElement).value);
  updatePhysicsTelemetryUI();
});

document.getElementById('slider-mdot')!.addEventListener('input', (e) => {
  state.accretionRateEdd = parseFloat((e.target as HTMLInputElement).value);
  updatePhysicsTelemetryUI();
});

document.getElementById('slider-inclination')!.addEventListener('input', (e) => {
  state.inclinationDeg = parseFloat((e.target as HTMLInputElement).value);
  updatePhysicsTelemetryUI();
});

document.getElementById('slider-camdist')!.addEventListener('input', (e) => {
  state.cameraDistanceRs = parseFloat((e.target as HTMLInputElement).value);
  updatePhysicsTelemetryUI();
});

// Minimalist toggle chips
const btnDoppler = document.getElementById('btn-doppler')!;
btnDoppler.addEventListener('click', () => {
  state.enableDopplerBeaming = !state.enableDopplerBeaming;
  btnDoppler.classList.toggle('active', state.enableDopplerBeaming);
});

const btnLensing = document.getElementById('btn-lensing')!;
btnLensing.addEventListener('click', () => {
  state.enableGravitationalLensing = !state.enableGravitationalLensing;
  btnLensing.classList.toggle('active', state.enableGravitationalLensing);
});

const btnMarkers = document.getElementById('btn-markers')!;
btnMarkers.addEventListener('click', () => {
  state.showRelativisticMarkers = !state.showRelativisticMarkers;
  btnMarkers.classList.toggle('active', state.showRelativisticMarkers);
});

// Geodesic lab buttons
document.getElementById('btn-exp-photon-fan')!.addEventListener('click', launchPhotonBeamFan);
document.getElementById('btn-exp-rosette')!.addEventListener('click', launchPrecessingRosetteOrbit);
document.getElementById('btn-exp-isco')!.addEventListener('click', launchIscoCircularOrbit);
document.getElementById('btn-clear-orbits')!.addEventListener('click', () => {
  particles = [];
  selectedParticle = null;
});

const btnToggleLaunchType = document.getElementById('btn-toggle-launch-type')!;
btnToggleLaunchType.addEventListener('click', () => {
  state.launchParticleType = state.launchParticleType === 'photon' ? 'massive' : 'photon';
  btnToggleLaunchType.textContent = `Mode: ${state.launchParticleType === 'photon' ? 'Photon' : 'Massive'}`;
});

// 3D Raytracer interactive camera orbit & scroll zoom
let isOrbitingCamera = false;
let lastMouseX = 0;
let lastMouseY = 0;

raytracerCanvas.addEventListener('mousedown', (e) => {
  isOrbitingCamera = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
  if (!isOrbitingCamera) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  state.azimuthRad += dx * 0.008;
  state.inclinationDeg = Math.max(5, Math.min(89, state.inclinationDeg - dy * 0.25));
  (document.getElementById('slider-inclination') as HTMLInputElement).value = String(
    state.inclinationDeg
  );
  updatePhysicsTelemetryUI();
});

window.addEventListener('mouseup', () => {
  isOrbitingCamera = false;
});

raytracerCanvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    state.cameraDistanceRs = Math.max(
      5.0,
      Math.min(22.0, state.cameraDistanceRs + e.deltaY * 0.01)
    );
    (document.getElementById('slider-camdist') as HTMLInputElement).value = String(
      state.cameraDistanceRs
    );
    updatePhysicsTelemetryUI();
  },
  { passive: false }
);

// 2D Geodesic Lab click-and-drag launcher
orbitCanvas.addEventListener('mousedown', (e) => {
  const { xRs, yRs } = geodesicLab.screenToRs(e.clientX, e.clientY);
  dragVector = {
    startXRs: xRs,
    startYRs: yRs,
    vx: 0,
    vy: 0.45,
    type: state.launchParticleType,
  };
});

window.addEventListener('mousemove', (e) => {
  if (!dragVector) return;
  const { xRs, yRs } = geodesicLab.screenToRs(e.clientX, e.clientY);
  const dx = xRs - dragVector.startXRs;
  const dy = yRs - dragVector.startYRs;
  const len = Math.hypot(dx, dy);

  if (dragVector.type === 'photon') {
    const norm = len > 0.05 ? len : 1.0;
    dragVector.vx = len > 0.05 ? dx / norm : 1.0;
    dragVector.vy = len > 0.05 ? dy / norm : 0.0;
  } else {
    dragVector.vx = Math.max(-0.95, Math.min(0.95, dx * 0.22));
    dragVector.vy = Math.max(-0.95, Math.min(0.95, dy * 0.22));
  }
});

window.addEventListener('mouseup', () => {
  if (!dragVector) return;
  const speed = Math.hypot(dragVector.vx, dragVector.vy);
  const vx = speed < 0.05 ? 0.55 : dragVector.vx;
  const vy = speed < 0.05 ? 0.0 : dragVector.vy;
  const p = createGeodesicParticle(
    nextParticleId++,
    dragVector.type,
    dragVector.startXRs,
    dragVector.startYRs,
    vx,
    vy,
    state.spin
  );
  particles.push(p);
  selectedParticle = p;
  dragVector = null;
});

// Initialize default trajectories and telemetry
launchPhotonBeamFan();
launchPrecessingRosetteOrbit();
updatePhysicsTelemetryUI();

const startTime = performance.now();

function animate(now: number): void {
  const elapsedSec = (now - startTime) * 0.001;

  // Step active geodesic trajectories when visible
  if (state.viewMode !== 'raytracer' || state.showDrawer) {
    for (const p of particles) {
      stepGeodesicRK4(p, 0.085, state.spin);
    }
  }

  // Render 3D Null-Geodesic Raytracer
  if (state.viewMode === 'raytracer' || state.viewMode === 'split') {
    raytracer.render({
      spin: state.spin,
      accretionRateEdd: state.accretionRateEdd,
      inclinationRad: (state.inclinationDeg * Math.PI) / 180.0,
      azimuthRad: state.azimuthRad,
      cameraDistanceRs: state.cameraDistanceRs,
      diskOuterRadiusRs: state.diskOuterRadiusRs,
      enableDopplerBeaming: state.enableDopplerBeaming,
      enableGravitationalLensing: state.enableGravitationalLensing,
      showRelativisticMarkers: state.showRelativisticMarkers,
      timeSec: elapsedSec,
    });
  }

  // Render 2D Equatorial Geodesic Lab
  if (state.viewMode === 'geodesic' || state.viewMode === 'split') {
    geodesicLab.renderOrbitView(
      particles,
      state.spin,
      state.probeRadiusRs,
      selectedParticle,
      dragVector
    );
  }

  if (state.showDrawer) {
    geodesicLab.renderEffectivePotentialPlot(selectedParticle, state.spin);
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
