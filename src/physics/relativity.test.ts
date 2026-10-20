/**
 * Unit Tests for the General Relativity & Black Hole Astrophysics Engine
 *
 * Verifies exact analytical and numerical predictions from General Relativity:
 *   1. Schwarzschild radius of 1 M_\odot (~2953.25 meters)
 *   2. Kerr outer/inner horizons r_\pm = (GM/c^2)(1 \pm \sqrt{1 - a_*^2})
 *   3. Photon sphere r_{ph} = 1.5 r_s (Schwarzschild) and spin dependence
 *   4. Critical shadow impact parameter b_c = (3\sqrt{3}/2) r_s \approx 2.598076 r_s
 *   5. Bardeen-Press-Teukolsky ISCO formula (3.0 r_s at a*=0, 0.5 r_s as a*->1)
 *   6. Gravitational time dilation, redshift, and escape velocity at the horizon
 *   7. RK4 geodesic conservation of angular momentum L and critical capture at b < b_c
 */

import { describe, expect, it } from 'vitest';
import {
  accretionDiskTemperatureKelvin,
  accretionRadiativeEfficiency,
  circularOrbitalBeta,
  criticalImpactParameterInRs,
  escapeVelocityBeta,
  gravitationalRedshift,
  gravitationalTimeDilation,
  hawkingThermodynamics,
  iscoRadiiInRs,
  kerrHorizonRadiiInRs,
  photonSphereRadiiInRs,
  schwarzschildRadiusMeters,
  tidalAccelerationGradient,
} from './relativity';
import {
  createGeodesicParticle,
  exactGeodesicCircularSpeed,
  stepGeodesicRK4,
} from './geodesics';

describe('General Relativity Analytical Formulas', () => {
  it('computes the exact Schwarzschild radius r_s = 2GM/c^2 for 1 solar mass', () => {
    const rs1Solar = schwarzschildRadiusMeters(1.0);
    // CODATA 2018 2 * G * M_solar / c^2 = 2953.33938 meters
    expect(rs1Solar).toBeCloseTo(2953.34, 1);
  });

  it('computes Kerr event horizon radii r_+ and r_- across spin values', () => {
    // Non-rotating Schwarzschild (a* = 0): r_+ = 1.0 r_s, r_- = 0
    const staticBh = kerrHorizonRadiiInRs(0);
    expect(staticBh.rPlusRs).toBeCloseTo(1.0, 6);
    expect(staticBh.rMinusRs).toBeCloseTo(0.0, 6);

    // Near-extremal Kerr (a* -> 1): r_+ -> 0.5 r_s = G M / c^2
    const extremalBh = kerrHorizonRadiiInRs(0.9999);
    expect(extremalBh.rPlusRs).toBeCloseTo(0.507, 2);
  });

  it('computes Photon Sphere radius r_ph = 1.5 r_s for Schwarzschild and shifts with Kerr spin', () => {
    const staticPh = photonSphereRadiiInRs(0);
    expect(staticPh.progradeRs).toBeCloseTo(1.5, 6);
    expect(staticPh.retrogradeRs).toBeCloseTo(1.5, 6);

    const spinningPh = photonSphereRadiiInRs(0.9);
    expect(spinningPh.progradeRs).toBeLessThan(1.5);
    expect(spinningPh.retrogradeRs).toBeGreaterThan(1.5);
  });

  it('computes the exact critical impact parameter b_c = (3*sqrt(3)/2) r_s', () => {
    const bCrit = criticalImpactParameterInRs(0);
    expect(bCrit).toBeCloseTo((3.0 * Math.sqrt(3.0)) / 2.0, 6);
  });

  it('computes the Bardeen-Press-Teukolsky ISCO radius and radiative efficiency', () => {
    // Schwarzschild (a* = 0): r_ISCO = 3.0 r_s = 6 GM/c^2, efficiency \eta = 1 - sqrt(8/9) \approx 5.719%
    const staticIsco = iscoRadiiInRs(0);
    expect(staticIsco.progradeRs).toBeCloseTo(3.0, 5);
    expect(staticIsco.retrogradeRs).toBeCloseTo(3.0, 5);
    expect(accretionRadiativeEfficiency(0)).toBeCloseTo(1.0 - Math.sqrt(8.0 / 9.0), 4);

    // High-spin Kerr (a* = 0.998): prograde ISCO shrinks below 0.65 r_s
    const thorneIsco = iscoRadiiInRs(0.998);
    expect(thorneIsco.progradeRs).toBeLessThan(0.65);
    expect(thorneIsco.retrogradeRs).toBeGreaterThan(4.4);
  });

  it('evaluates gravitational time dilation, redshift, escape velocity, and orbital speed', () => {
    // At r = 4 r_s: d\tau/dt = sqrt(1 - 1/4) = sqrt(3)/2
    expect(gravitationalTimeDilation(4.0)).toBeCloseTo(Math.sqrt(0.75), 6);
    expect(gravitationalRedshift(4.0)).toBeCloseTo(1.0 / Math.sqrt(0.75) - 1.0, 6);
    expect(escapeVelocityBeta(4.0)).toBeCloseTo(0.5, 6);

    // At the photon sphere r = 1.5 r_s, local circular orbital speed reaches c (\beta = 1)
    expect(circularOrbitalBeta(1.5)).toBeCloseTo(1.0, 6);
    // At Schwarzschild ISCO r = 3.0 r_s, \beta = sqrt(1 / (2 * 2)) = 0.5 c
    expect(circularOrbitalBeta(3.0)).toBeCloseTo(0.5, 6);
  });

  it('computes Shakura-Sunyaev disk temperature, Hawking temperature, and tidal gradients', () => {
    // Disk temperature vanishes inside r <= r_ISCO and is positive outside r > r_ISCO
    expect(accretionDiskTemperatureKelvin(2.5, 10, 0, 0.1)).toBe(0);
    expect(accretionDiskTemperatureKelvin(4.5, 10, 0, 0.1)).toBeGreaterThan(1e5);

    // Stellar black hole has higher Hawking temperature and stronger horizon tidal gradient than SMBH
    const hawkingStellar = hawkingThermodynamics(10, 0);
    const hawkingSmbh = hawkingThermodynamics(1e6, 0);
    expect(hawkingStellar.hawkingTempKelvin).toBeGreaterThan(hawkingSmbh.hawkingTempKelvin);

    const tidalStellar = tidalAccelerationGradient(1.0, 10);
    const tidalSmbh = tidalAccelerationGradient(1.0, 1e6);
    expect(tidalStellar.tidalG).toBeGreaterThan(tidalSmbh.tidalG);
  });
});

describe('RK4 Relativistic Geodesic Integrator', () => {
  it('captures photons with impact parameter b < b_c and scatters photons with b > b_c', () => {
    const bCrit = criticalImpactParameterInRs(0);

    const capturedPhoton = createGeodesicParticle(1, 'photon', -10, bCrit * 0.96, 1, 0, 0);
    const escapedPhoton = createGeodesicParticle(2, 'photon', -10, bCrit * 1.05, 1, 0, 0);

    for (let i = 0; i < 750; i++) {
      stepGeodesicRK4(capturedPhoton, 0.08, 0);
      stepGeodesicRK4(escapedPhoton, 0.08, 0);
    }

    expect(capturedPhoton.status).toBe('captured');
    expect(escapedPhoton.status).toBe('escaped');
  });

  it('maintains a stable circular orbit at r = 4 r_s and conserves angular momentum L', () => {
    const r0 = 4.0;
    const vCirc = exactGeodesicCircularSpeed(r0, 0);
    const particle = createGeodesicParticle(3, 'massive', r0, 0, 0, vCirc, 0);
    const initialL = particle.angularMomentum;

    for (let i = 0; i < 250; i++) {
      stepGeodesicRK4(particle, 0.05, 0);
    }

    const finalR = Math.hypot(particle.x, particle.y);
    expect(particle.status).toBe('orbiting');
    expect(finalR).toBeCloseTo(r0, 1);
    expect(particle.angularMomentum).toBeCloseTo(initialL, 3);
  });
});
