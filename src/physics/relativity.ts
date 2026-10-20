/**
 * General Relativity & Black Hole Astrophysics Formula Engine
 *
 * Implements analytical formulas derived from Einstein's Field Equations:
 *   G_{\mu\nu} + \Lambda g_{\mu\nu} = \frac{8\pi G}{c^4} T_{\mu\nu}
 *
 * Covers both the Schwarzschild metric (non-rotating, J = 0) and the Kerr metric
 * (rotating, Boyer-Lindquist coordinates) in SI units and normalized geometric
 * units (r / r_s).
 */

/**
 * CODATA 2018 / IAU exact physical constants in SI units.
 */
export const PHYSICAL_CONSTANTS = {
  /** Newtonian gravitational constant G [m^3 kg^-1 s^-2] */
  G: 6.67430e-11,
  /** Speed of light in vacuum c [m s^-1] */
  c: 299792458,
  /** Reduced Planck constant \hbar = h / (2\pi) [J s] */
  hbar: 1.054571817e-34,
  /** Planck constant h [J s] */
  h: 6.62607015e-34,
  /** Boltzmann constant k_B [J K^-1] */
  kB: 1.380649e-23,
  /** Stefan-Boltzmann constant \sigma_{SB} [W m^-2 K^-4] */
  sigmaSB: 5.670374419e-8,
  /** IAU nominal solar mass M_\odot [kg] */
  solarMass: 1.98847e30,
  /** Proton mass m_p [kg] (used for Eddington luminosity) */
  protonMass: 1.67262192369e-27,
  /** Thomson scattering cross-section \sigma_T [m^2] */
  thomsonCrossSection: 6.6524587321e-29,
  /**Julian year in seconds [s] */
  secondsPerYear: 31557600,
} as const;

/**
 * Preset astrophysical black holes with real observational parameters.
 */
export interface BlackHolePreset {
  id: string;
  name: string;
  category: string;
  /** Mass in solar masses (M / M_\odot) */
  massSolar: number;
  /** Dimensionless Kerr spin parameter a_* = c J / (G M^2) in [0, 0.998] */
  spin: number;
  /** Eddington-normalized mass accretion rate \dot{m} = \dot{M} / \dot{M}_{Edd} */
  accretionRateEdd: number;
  /** Observer viewing inclination angle \theta_obs [degrees] */
  inclinationDeg: number;
  description: string;
}

export const BLACK_HOLE_PRESETS: BlackHolePreset[] = [
  {
    id: 'cygnus-x1',
    name: 'Cygnus X-1',
    category: 'Stellar-Mass X-Ray Binary',
    massSolar: 21.2,
    spin: 0.95,
    accretionRateEdd: 0.15,
    inclinationDeg: 46,
    description: 'High-spin stellar black hole in Cygnus (M = 21.2 M☉, a* ≈ 0.95).'
  },
  {
    id: 'schwarzschild-10',
    name: 'Schwarzschild Reference (10 M☉)',
    category: 'Non-Rotating Theoretical',
    massSolar: 10.0,
    spin: 0.0,
    accretionRateEdd: 0.10,
    inclinationDeg: 48,
    description: 'Pure static spherically symmetric Schwarzschild metric (a* = 0, r_ISCO = 3 r_s).'
  },
  {
    id: 'gw150914',
    name: 'GW150914 Remnant',
    category: 'LIGO Binary Merger Remnant',
    massSolar: 62.0,
    spin: 0.68,
    accretionRateEdd: 0.08,
    inclinationDeg: 44,
    description: 'First gravitational-wave merger remnant detected by LIGO (M = 62 M☉, a* = 0.68).'
  },
  {
    id: 'sgr-a',
    name: 'Sagittarius A* (Sgr A*)',
    category: 'Galactic Center SMBH',
    massSolar: 4.154e6,
    spin: 0.90,
    accretionRateEdd: 0.01,
    inclinationDeg: 42,
    description: 'Supermassive black hole at the Milky Way center imaged by the Event Horizon Telescope.'
  },
  {
    id: 'm87',
    name: 'M87* (Powehi)',
    category: 'Relativistic Jet SMBH',
    massSolar: 6.5e9,
    spin: 0.90,
    accretionRateEdd: 0.02,
    inclinationDeg: 50,
    description: 'Messier 87 core supermassive black hole (6.5 billion M☉, r_s ≈ 129 AU).'
  },
  {
    id: 'gargantua',
    name: 'Extreme Kerr (Thorne Limit)',
    category: 'Near-Maximal Spin (a* = 0.998)',
    massSolar: 1.0e8,
    spin: 0.998,
    accretionRateEdd: 0.12,
    inclinationDeg: 40,
    description: 'Kip Thorne radiation-limited Kerr spin (a* = 0.998); prograde ISCO shrinks to 0.62 r_s.'
  }
];

/**
 * Computes the gravitational radius r_g = G M / c^2 [meters].
 */
export function gravitationalRadiusMeters(massSolar: number): number {
  const { G, c, solarMass } = PHYSICAL_CONSTANTS;
  const massKg = massSolar * solarMass;
  return (G * massKg) / (c * c);
}

/**
 * Computes the Schwarzschild radius (event horizon of a non-rotating black hole):
 *   r_s = \frac{2 G M}{c^2} = 2 r_g  [meters]
 */
export function schwarzschildRadiusMeters(massSolar: number): number {
  return 2.0 * gravitationalRadiusMeters(massSolar);
}

/**
 * Computes the outer and inner Kerr event horizon radii in units of r_s:
 *   r_\pm = \frac{G M}{c^2} (1 \pm \sqrt{1 - a_*^2}) = 0.5 r_s (1 \pm \sqrt{1 - a_*^2})
 *
 * For a_* = 0 (Schwarzschild): r_+ = 1.0 r_s, r_- = 0.
 * For a_* -> 1 (Extremal Kerr): r_+ = 0.5 r_s, r_- = 0.5 r_s.
 */
export function kerrHorizonRadiiInRs(spin: number): { rPlusRs: number; rMinusRs: number } {
  const clampedSpin = Math.max(-0.9999, Math.min(0.9999, spin));
  const root = Math.sqrt(1.0 - clampedSpin * clampedSpin);
  return {
    rPlusRs: 0.5 * (1.0 + root),
    rMinusRs: 0.5 * (1.0 - root),
  };
}

/**
 * Computes the Kerr static limit (ergosphere outer boundary) in units of r_s
 * at polar angle \theta (where \theta = \pi/2 is the equatorial plane):
 *   r_{ergo}(\theta) = 0.5 r_s (1 + \sqrt{1 - a_*^2 \cos^2\theta})
 *
 * In the equatorial plane (\theta = \pi/2), r_{ergo} = 1.0 r_s = 2 G M / c^2
 * regardless of spin.
 */
export function ergosphereRadiusInRs(spin: number, thetaRad = Math.PI / 2): number {
  const clampedSpin = Math.max(-0.9999, Math.min(0.9999, spin));
  const cosTheta = Math.cos(thetaRad);
  return 0.5 * (1.0 + Math.sqrt(1.0 - clampedSpin * clampedSpin * cosTheta * cosTheta));
}

/**
 * Computes the equatorial circular photon orbit radius (Photon Sphere) in units of r_s:
 *   r_{ph}^\pm = r_g \left[ 2 + 2 \cos\left( \frac{2}{3} \arccos(\mp a_*) \right) \right]
 *              = r_s \left[ 1 + \cos\left( \frac{2}{3} \arccos(\mp a_*) \right) \right]
 *
 * For a_* = 0: r_{ph} = 1.5 r_s = 3 G M / c^2.
 * For a_* -> 1: r_{ph}^+ -> 0.5 r_s (prograde), r_{ph}^- -> 2.0 r_s (retrograde).
 */
export function photonSphereRadiiInRs(spin: number): { progradeRs: number; retrogradeRs: number } {
  const a = Math.max(0.0, Math.min(0.9999, Math.abs(spin)));
  const progradeRs = 1.0 + Math.cos((2.0 / 3.0) * Math.acos(-a));
  const retrogradeRs = 1.0 + Math.cos((2.0 / 3.0) * Math.acos(a));
  return { progradeRs, retrogradeRs };
}

/**
 * Computes the Critical Impact Parameter b_c (apparent Black Hole Shadow radius)
 * in units of r_s.
 *
 * For a Schwarzschild black hole:
 *   b_c = \frac{3\sqrt{3}}{2} r_s \approx 2.59807621135 r_s = 3\sqrt{3} \frac{GM}{c^2}
 *
 * Any photon approaching from infinity with impact parameter b < b_c crosses
 * the photon sphere and plunges into the event horizon.
 */
export function criticalImpactParameterInRs(spin = 0): number {
  const { progradeRs, retrogradeRs } = photonSphereRadiiInRs(spin);
  // Effective equatorial shadow radius averaged over prograde and retrograde photon limbs
  // Exact Schwarzschild value at spin = 0 is 3 * sqrt(3) / 2 = 2.59807621135
  if (Math.abs(spin) < 1e-6) {
    return (3.0 * Math.sqrt(3.0)) / 2.0;
  }
  const a = Math.abs(spin);
  // For an equatorial Kerr photon orbit at r_ph (in units of r_g = 0.5 r_s),
  // impact parameter b/r_g = -a + 6 * r_g_ph / (r_g_ph - 1) ... or via Bardeen (1973):
  // \xi(r_0) = (r_0^2 (r_0 - 3) + a^2 (r_0 + 1)) / (a (r_0 - 1))
  const rProRg = progradeRs * 2.0;
  const rRetRg = retrogradeRs * 2.0;
  const bProRg = Math.abs((rProRg * rProRg * (rProRg - 3.0) + a * a * (rProRg + 1.0)) / (a * (rProRg - 1.0)));
  const bRetRg = Math.abs((rRetRg * rRetRg * (rRetRg - 3.0) + a * a * (rRetRg + 1.0)) / (a * (rRetRg - 1.0)));
  return 0.25 * (bProRg + bRetRg);
}

/**
 * Computes the Innermost Stable Circular Orbit (ISCO) radius in units of r_s
 * using the exact Bardeen, Press & Teukolsky (1972) analytical solution:
 *
 *   Z_1 = 1 + (1 - a_*^2)^{1/3} [ (1 + a_*)^{1/3} + (1 - a_*)^{1/3} ]
 *   Z_2 = \sqrt{3 a_*^2 + Z_1^2}
 *   r_{ISCO} / r_g = 3 + Z_2 \mp \sqrt{(3 - Z_1)(3 + Z_1 + 2 Z_2)}
 *   r_{ISCO} / r_s = 0.5 * (r_{ISCO} / r_g)
 *
 * For a_* = 0 (Schwarzschild): r_{ISCO} = 3.0 r_s = 6 G M / c^2.
 * For a_* -> 1 (Prograde Kerr): r_{ISCO}^+ -> 0.5 r_s = 1 G M / c^2.
 * For a_* -> 1 (Retrograde Kerr): r_{ISCO}^- -> 4.5 r_s = 9 G M / c^2.
 */
export function iscoRadiiInRs(spin: number): { progradeRs: number; retrogradeRs: number } {
  const a = Math.max(0.0, Math.min(0.9999, Math.abs(spin)));
  const oneMinusA2 = Math.max(0.0, 1.0 - a * a);
  const z1 =
    1.0 +
    Math.cbrt(oneMinusA2) * (Math.cbrt(1.0 + a) + Math.cbrt(1.0 - a));
  const z2 = Math.sqrt(3.0 * a * a + z1 * z1);
  const rootTerm = Math.sqrt(Math.max(0.0, (3.0 - z1) * (3.0 + z1 + 2.0 * z2)));

  const progradeRg = 3.0 + z2 - rootTerm;
  const retrogradeRg = 3.0 + z2 + rootTerm;

  return {
    progradeRs: 0.5 * progradeRg,
    retrogradeRs: 0.5 * retrogradeRg,
  };
}

/**
 * Computes the radiative efficiency \eta = 1 - \mathcal{E}_{ISCO} of a thin accretion disk,
 * where \mathcal{E}_{ISCO} is the specific energy per unit rest mass at the prograde ISCO:
 *   \mathcal{E}(r) = \frac{1 - 2/r_* + a_* / r_*^{3/2}}{\sqrt{1 - 3/r_* + 2 a_* / r_*^{3/2}}}
 * with r_* = r / r_g = 2 (r / r_s).
 *
 * For Schwarzschild (a_* = 0, r_* = 6): \mathcal{E}_{ISCO} = \sqrt{8/9} \approx 0.9428,
 * yielding \eta \approx 5.72%.
 * For maximal Kerr (a_* = 0.998): \eta \approx 32.4%.
 */
export function accretionRadiativeEfficiency(spin: number): number {
  const a = Math.max(0.0, Math.min(0.999, spin));
  const { progradeRs } = iscoRadiiInRs(a);
  const rRg = 2.0 * progradeRs;
  const r32 = Math.pow(rRg, 1.5);
  const numerator = 1.0 - 2.0 / rRg + a / r32;
  const denomArg = Math.max(1e-9, 1.0 - 3.0 / rRg + (2.0 * a) / r32);
  const specificEnergyIsco = numerator / Math.sqrt(denomArg);
  return Math.max(0.0, Math.min(0.423, 1.0 - specificEnergyIsco));
}

/**
 * Gravitational time dilation factor d\tau / dt for a stationary observer at radius r (in units of r_s)
 * in the equatorial plane of a Kerr/Schwarzschild metric:
 *   \frac{d\tau}{dt} = \sqrt{-g_{tt}} = \sqrt{1 - \frac{r_s}{r}}
 *
 * Returns 0 inside the static limit r <= r_s.
 */
export function gravitationalTimeDilation(rInRs: number): number {
  if (rInRs <= 1.0) return 0.0;
  return Math.sqrt(1.0 - 1.0 / rInRs);
}

/**
 * Gravitational redshift z for photons emitted by a stationary source at radius r (in r_s)
 * and observed at infinity:
 *   1 + z = \frac{\lambda_{obs}}{\lambda_{emit}} = \frac{1}{\sqrt{1 - r_s / r}}
 */
export function gravitationalRedshift(rInRs: number): number {
  if (rInRs <= 1.000001) return Number.POSITIVE_INFINITY;
  return 1.0 / Math.sqrt(1.0 - 1.0 / rInRs) - 1.0;
}

/**
 * Local escape velocity as a fraction of the speed of light (v_{esc} / c)
 * measured by a static shell observer at radius r (in r_s):
 *   \frac{v_{esc}}{c} = \sqrt{\frac{r_s}{r}}
 *
 * At r = r_s (Event Horizon), v_{esc} = c.
 */
export function escapeVelocityBeta(rInRs: number): number {
  if (rInRs <= 1.0) return 1.0;
  return Math.sqrt(1.0 / rInRs);
}

/**
 * Local circular orbital velocity \beta = v_\phi / c measured in the local Zero Angular
 * Momentum Observer (ZAMO) / static shell frame at radius r (in r_s):
 *   \beta_{orb}(r) = \sqrt{\frac{r_s}{2(r - r_s)}}  (Schwarzschild exact for r > 1.5 r_s)
 *
 * Notice that at the photon sphere r = 1.5 r_s, \beta_{orb} = 1 (orbital speed equals c).
 * At the Schwarzschild ISCO r = 3.0 r_s, \beta_{orb} = \sqrt{1/4} = 0.5 c.
 */
export function circularOrbitalBeta(rInRs: number): number {
  if (rInRs <= 1.5) return 1.0;
  return Math.sqrt(1.0 / (2.0 * (rInRs - 1.0)));
}

/**
 * Relativistic frequency shift factor g = \nu_{obs} / \nu_{emit} combining both
 * transverse/longitudinal Special Relativistic Doppler shift and General Relativistic
 * gravitational redshift for an accretion disk element orbiting at radius r (in r_s),
 * azimuthal angle \phi (where \sin\phi = -1 is approaching the observer and +1 is receding),
 * and observer inclination \theta_{obs} [radians]:
 *
 *   g(r, \phi) = \frac{\sqrt{1 - \frac{3 r_s}{2 r}}}{1 + \sqrt{\frac{r_s}{2 r}} \sin\theta_{obs} \sin\phi}
 *
 * By Liouville's theorem (invariance of I_\nu / \nu^3 along null geodesics),
 * the bolometric specific intensity scales as:
 *   I_{obs} = g^4 I_{emit}
 */
export function relativisticDiskDopplerFactor(
  rInRs: number,
  sinPhi: number,
  inclinationRad: number
): number {
  if (rInRs <= 1.5001) return 0.01;
  const numerator = Math.sqrt(Math.max(0.0, 1.0 - 1.5 / rInRs));
  const keplerBeta = Math.sqrt(0.5 / rInRs);
  const denominator = 1.0 + keplerBeta * Math.sin(inclinationRad) * sinPhi;
  return numerator / Math.max(0.05, denominator);
}

/**
 * Weak-field & strong-field gravitational light deflection angle \Delta\phi [radians]
 * for a photon with impact parameter b (in units of r_s):
 *   Weak-field Einstein formula (1915):
 *     \Delta\phi_{Einstein} = \frac{4 G M}{c^2 b} = \frac{2 r_s}{b}
 *   Second-order Post-Newtonian expansion (Epstein & Shapiro 1980):
 *     \Delta\phi \approx \frac{2 r_s}{b} + \frac{15 \pi}{16} \left(\frac{r_s}{b}\right)^2
 */
export function lightDeflectionAngleRad(impactParameterInRs: number): number {
  const bCrit = criticalImpactParameterInRs(0);
  if (impactParameterInRs <= bCrit) {
    return Number.POSITIVE_INFINITY; // Captured by the photon sphere
  }
  const u = 1.0 / impactParameterInRs;
  return 2.0 * u + ((15.0 * Math.PI) / 16.0) * u * u;
}

/**
 * Computes the Eddington Luminosity L_{Edd} [W] and Eddington Mass Accretion Rate \dot{M}_{Edd} [kg/s]:
 *   L_{Edd} = \frac{4 \pi G M m_p c}{\sigma_T}
 *   \dot{M}_{Edd} = \frac{L_{Edd}}{\eta c^2}
 */
export function eddingtonParameters(massSolar: number, spin = 0): {
  luminosityWatts: number;
  massAccretionKgPerSec: number;
} {
  const { G, solarMass, protonMass, c, thomsonCrossSection } = PHYSICAL_CONSTANTS;
  const massKg = massSolar * solarMass;
  const luminosityWatts = (4.0 * Math.PI * G * massKg * protonMass * c) / thomsonCrossSection;
  const eta = Math.max(0.0572, accretionRadiativeEfficiency(spin));
  const massAccretionKgPerSec = luminosityWatts / (eta * c * c);
  return { luminosityWatts, massAccretionKgPerSec };
}

/**
 * Shakura-Sunyaev / Novikov-Thorne thin accretion disk effective surface temperature T(r) [Kelvin]:
 *
 *   T(r) = \left( \frac{3 G M \dot{M}}{8 \pi \sigma_{SB} r^3} \left[ 1 - \sqrt{\frac{r_{ISCO}}{r}} \right] \right)^{1/4}
 *
 * The zero-torque boundary condition at r = r_{ISCO} causes T(r_{ISCO}) = 0,
 * and the maximum temperature occurs analytically at:
 *   r_{peak} = \frac{49}{36} r_{ISCO} \approx 1.3611 r_{ISCO}
 */
export function accretionDiskTemperatureKelvin(
  rInRs: number,
  massSolar: number,
  spin: number,
  accretionRateEdd: number
): number {
  const { G, sigmaSB, solarMass } = PHYSICAL_CONSTANTS;
  const { progradeRs: rIscoRs } = iscoRadiiInRs(spin);
  if (rInRs <= rIscoRs || accretionRateEdd <= 0) {
    return 0.0;
  }
  const rsMeters = schwarzschildRadiusMeters(massSolar);
  const rMeters = rInRs * rsMeters;
  const massKg = massSolar * solarMass;
  const { massAccretionKgPerSec } = eddingtonParameters(massSolar, spin);
  const mDot = accretionRateEdd * massAccretionKgPerSec;

  const boundaryFactor = Math.max(0.0, 1.0 - Math.sqrt(rIscoRs / rInRs));
  const flux =
    ((3.0 * G * massKg * mDot) / (8.0 * Math.PI * Math.pow(rMeters, 3))) * boundaryFactor;
  return Math.pow(flux / sigmaSB, 0.25);
}

/**
 * Peak temperature of the Shakura-Sunyaev accretion disk at r_{peak} = (49/36) r_{ISCO} [Kelvin].
 */
export function peakAccretionDiskTemperatureKelvin(
  massSolar: number,
  spin: number,
  accretionRateEdd: number
): number {
  const { progradeRs } = iscoRadiiInRs(spin);
  const rPeakRs = (49.0 / 36.0) * progradeRs;
  return accretionDiskTemperatureKelvin(rPeakRs, massSolar, spin, accretionRateEdd);
}

/**
 * Converts a blackbody temperature T [Kelvin] into linear sRGB [0..1]
 * by integrating Planck's spectral radiance law:
 *   B_\lambda(\lambda, T) = \frac{2 h c^2}{\lambda^5} \frac{1}{\exp\left(\frac{h c}{\lambda k_B T}\right) - 1}
 * at the primary CIE/sRGB chromaticity wavelengths (R = 615 nm, G = 540 nm, B = 455 nm).
 */
export function planckBlackbodyToRgb(temperatureKelvin: number): [number, number, number] {
  if (temperatureKelvin <= 100) return [0, 0, 0];
  const { h, c, kB } = PHYSICAL_CONSTANTS;
  const hcOverKb = (h * c) / kB; // ~ 0.01438776877 m K

  const spectralRadiance = (wavelengthMeters: number, tempK: number): number => {
    const exponent = Math.min(700.0, hcOverKb / (wavelengthMeters * tempK));
    const denom = Math.expm1(exponent);
    if (denom <= 0) return 0;
    return 1.0 / (Math.pow(wavelengthMeters, 5.0) * denom);
  };

  const rRaw = spectralRadiance(615e-9, temperatureKelvin);
  const gRaw = spectralRadiance(540e-9, temperatureKelvin);
  const bRaw = spectralRadiance(455e-9, temperatureKelvin);

  const maxChannel = Math.max(1e-30, rRaw, gRaw, bRaw);
  // Apply gamma 1/2.2 for perceptual display encoding
  return [
    Math.pow(rRaw / maxChannel, 1.0 / 2.2),
    Math.pow(gRaw / maxChannel, 1.0 / 2.2),
    Math.pow(bRaw / maxChannel, 1.0 / 2.2),
  ];
}

/**
 * Quantum Black Hole Thermodynamics (Hawking 1974, Bekenstein 1973):
 *
 * 1. Event Horizon Area (Kerr metric):
 *    A = 4 \pi (r_+^2 + a^2) = 8 \pi r_g^2 (1 + \sqrt{1 - a_*^2})
 *
 * 2. Surface Gravity \kappa [m s^-2]:
 *    \kappa = \frac{c^4}{4 G M} \frac{\sqrt{1 - a_*^2}}{\frac{1}{2}(1 + \sqrt{1 - a_*^2})}
 *
 * 3. Hawking Temperature T_H [K]:
 *    T_H = \frac{\hbar \kappa}{2 \pi c k_B} = \frac{\hbar c^3}{8 \pi G M k_B} \frac{2\sqrt{1 - a_*^2}}{1 + \sqrt{1 - a_*^2}}
 *
 * 4. Bekenstein-Hawking Dimensionless Entropy S / k_B:
 *    \frac{S_{BH}}{k_B} = \frac{A}{4 \ell_P^2} = \frac{c^3 A}{4 G \hbar}
 *
 * 5. Hawking Luminosity P_H [W] (Stefan-Boltzmann greybody baseline):
 *    P_H = \frac{\hbar c^6}{15360 \pi G^2 M^2}
 *
 * 6. Hawking Evaporation Lifetime t_{evap} [years]:
 *    t_{evap} = \frac{5120 \pi G^2 M^3}{\hbar c^4}
 */
export function hawkingThermodynamics(massSolar: number, spin = 0): {
  horizonAreaM2: number;
  surfaceGravityMs2: number;
  hawkingTempKelvin: number;
  bekensteinEntropyDimensionless: number;
  hawkingPowerWatts: number;
  evaporationYears: number;
} {
  const { G, c, hbar, kB, solarMass, secondsPerYear } = PHYSICAL_CONSTANTS;
  const massKg = massSolar * solarMass;
  const rg = gravitationalRadiusMeters(massSolar);
  const a = Math.max(0.0, Math.min(0.9999, Math.abs(spin)));
  const root = Math.sqrt(1.0 - a * a);

  const horizonAreaM2 = 8.0 * Math.PI * rg * rg * (1.0 + root);
  const spinFactor = (2.0 * root) / (1.0 + root);
  const surfaceGravityMs2 = ((c * c * c * c) / (4.0 * G * massKg)) * spinFactor;
  const hawkingTempKelvin =
    ((hbar * Math.pow(c, 3)) / (8.0 * Math.PI * G * massKg * kB)) * spinFactor;
  const bekensteinEntropyDimensionless = (Math.pow(c, 3) * horizonAreaM2) / (4.0 * G * hbar);
  const hawkingPowerWatts =
    (hbar * Math.pow(c, 6)) / (15360.0 * Math.PI * G * G * massKg * massKg);
  const evaporationSeconds =
    (5120.0 * Math.PI * G * G * Math.pow(massKg, 3)) / (hbar * Math.pow(c, 4));

  return {
    horizonAreaM2,
    surfaceGravityMs2,
    hawkingTempKelvin,
    bekensteinEntropyDimensionless,
    hawkingPowerWatts,
    evaporationYears: evaporationSeconds / secondsPerYear,
  };
}

/**
 * Radial tidal acceleration gradient (Spaghettification) across a test body
 * of length \Delta r [meters] at distance r (in units of r_s):
 *   \Delta a_{tidal} = \left| \frac{\partial^2 \Phi_{eff}}{\partial r^2} \right| \Delta r = \frac{2 G M}{r^3} \Delta r
 *
 * Returns acceleration in m/s^2 and in Earth g's (g_0 = 9.80665 m/s^2).
 */
export function tidalAccelerationGradient(
  rInRs: number,
  massSolar: number,
  bodyLengthMeters = 1.75
): { tidalAccelMs2: number; tidalG: number } {
  const { G, solarMass } = PHYSICAL_CONSTANTS;
  const massKg = massSolar * solarMass;
  const rsMeters = schwarzschildRadiusMeters(massSolar);
  const rMeters = Math.max(0.1 * rsMeters, rInRs * rsMeters);
  const tidalAccelMs2 = ((2.0 * G * massKg) / Math.pow(rMeters, 3)) * bodyLengthMeters;
  return {
    tidalAccelMs2,
    tidalG: tidalAccelMs2 / 9.80665,
  };
}

/**
 * Formats large or small scientific numbers into readable scientific notation (e.g. 1.24 × 10³⁸).
 */
export function formatScientific(value: number, significantDigits = 3): string {
  if (!Number.isFinite(value)) return '∞';
  if (value === 0) return '0';
  const absVal = Math.abs(value);
  if (absVal >= 1e-2 && absVal < 1e4) {
    return value.toFixed(significantDigits);
  }
  const exp = Math.floor(Math.log10(absVal));
  const mantissa = value / Math.pow(10, exp);
  const superscriptMap: Record<string, string> = {
    '-': '⁻',
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };
  const expStr = String(exp)
    .split('')
    .map((ch) => superscriptMap[ch] ?? ch)
    .join('');
  return `${mantissa.toFixed(significantDigits - 1)} × 10${expStr}`;
}
