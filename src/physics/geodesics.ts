/**
 * General Relativistic Geodesic Integrator (RK4)
 *
 * Integrates the geodesic equation in curved spacetime:
 *   \frac{d^2 x^\mu}{d\lambda^2} + \Gamma^\mu_{\alpha\beta} \frac{dx^\alpha}{d\lambda} \frac{dx^\beta}{d\lambda} = 0
 *
 * Normalized units:
 *   - Distance r is measured in Schwarzschild radii r_s = 2 G M / c^2 (so r_s = 1, G M / c^2 = 0.5).
 *   - Speed of light c = 1.
 *
 * In the equatorial plane (\theta = \pi/2), the geodesic equations in Cartesian-like
 * Boyer-Lindquist / isotropic projection coordinates \mathbf{x} = (x, y) reduce to the
 * exact relativistic Binet acceleration law:
 *
 *   1. For Photons (Null Geodesics, ds^2 = 0):
 *      \frac{d^2 u}{d\phi^2} + u = \frac{3}{2} r_s u^2   (where u = 1/r)
 *      In 2D/3D vector form with conserved specific angular momentum h = |\mathbf{x} \times \mathbf{v}|:
 *      \frac{d^2 \mathbf{x}}{d\lambda^2} = -\frac{3}{2} r_s \frac{h^2}{r^5} \mathbf{x} + \mathbf{a}_{Kerr}
 *
 *   2. For Massive Particles (Timelike Geodesics, ds^2 = -d\tau^2):
 *      \frac{d^2 u}{d\phi^2} + u = \frac{r_s}{2 h^2} + \frac{3}{2} r_s u^2
 *      In vector form parameterized by proper time \tau:
 *      \frac{d^2 \mathbf{x}}{d\tau^2} = -\frac{r_s}{2 r^3} \mathbf{x} - \frac{3}{2} r_s \frac{h^2}{r^5} \mathbf{x} + \mathbf{a}_{Kerr}
 */

import { kerrHorizonRadiiInRs } from './relativity';

export type GeodesicParticleType = 'photon' | 'massive';

export type GeodesicStatus = 'orbiting' | 'captured' | 'escaped';

export interface GeodesicParticle {
  id: number;
  type: GeodesicParticleType;
  /** Position in equatorial plane (x, y) in units of r_s */
  x: number;
  y: number;
  /** 4-velocity spatial components (dx/d\lambda, dy/d\lambda) */
  vx: number;
  vy: number;
  /** Conserved specific angular momentum L = x v_y - y v_x [in units of r_s c] */
  angularMomentum: number;
  /** Conserved specific energy parameter E (or impact parameter b = |L|/E for photons) */
  specificEnergy: number;
  /** Impact parameter b = |L| / E in units of r_s */
  impactParameter: number;
  /** Elapsed proper time \tau (or affine parameter \lambda for photons) */
  properTime: number;
  /** Elapsed coordinate time t measured by an observer at infinity */
  coordinateTime: number;
  /** Trajectory trail history [(x, y), ...] in units of r_s */
  trail: Array<{ x: number; y: number }>;
  /** Status of the geodesic trajectory */
  status: GeodesicStatus;
  /** Display color hex */
  color: string;
}

/**
 * Computes the effective potential V_{eff}(r) in units where r is in r_s:
 *
 * - For Photons (Null Geodesic):
 *   V_{eff}^{photon}(r) = \left(1 - \frac{1}{r}\right) \frac{b^2}{r^2}
 *   Peak occurs at the photon sphere r = 1.5 r_s, where V_{eff}(1.5) = b^2 / (6.75).
 *   Capture condition E^2 = 1 > V_{eff}(1.5) \iff b < \frac{3\sqrt{3}}{2} r_s \approx 2.598 r_s.
 *
 * - For Massive Particles (Timelike Geodesic):
 *   V_{eff}^{massive}(r) = \sqrt{ \left(1 - \frac{1}{r}\right) \left(1 + \frac{L^2}{r^2}\right) }
 *   For L = \sqrt{3} r_s c (ISCO threshold), an inflection point exists at r = 3.0 r_s.
 */
export function computeEffectivePotential(
  rInRs: number,
  angularMomentumInRs: number,
  type: GeodesicParticleType,
  spin = 0
): number {
  const { rPlusRs } = kerrHorizonRadiiInRs(spin);
  if (rInRs <= rPlusRs) return 0.0;
  const f = Math.max(0.0, 1.0 - 1.0 / rInRs);
  const l2 = angularMomentumInRs * angularMomentumInRs;
  // Include frame-dragging spin-orbit coupling correction -a_* L / r^3
  const kerrCoupling = (-spin * angularMomentumInRs) / Math.pow(rInRs, 3.0);

  if (type === 'photon') {
    return Math.max(0.0, f * (l2 / (rInRs * rInRs)) + kerrCoupling);
  }
  const effectiveSquare = f * (1.0 + l2 / (rInRs * rInRs)) + kerrCoupling;
  return Math.sqrt(Math.max(0.0, effectiveSquare));
}

/**
 * Computes the instant geodesic acceleration vector (ax, ay) at state (x, y, vx, vy)
 * derived directly from the Schwarzschild/Kerr geodesic equation:
 *
 *   \mathbf{a}_{photon} = -\frac{3}{2} \frac{L^2}{r^5} \mathbf{r} + \mathbf{a}_{Lense-Thirring}
 *   \mathbf{a}_{massive} = -\frac{1}{2 r^3} \mathbf{r} - \frac{3}{2} \frac{L^2}{r^5} \mathbf{r} + \mathbf{a}_{Lense-Thirring}
 */
function geodesicAcceleration(
  x: number,
  y: number,
  vx: number,
  vy: number,
  type: GeodesicParticleType,
  spin: number
): { ax: number; ay: number } {
  const r2 = x * x + y * y;
  const r = Math.sqrt(r2);
  if (r < 0.2) {
    return { ax: 0, ay: 0 };
  }
  const r3 = r2 * r;
  const r5 = r3 * r2;
  const L = x * vy - y * vx;
  const L2 = L * L;

  // General Relativistic 1/r^5 curvature term (responsible for light bending, photon sphere at 1.5 r_s, and perihelion precession)
  let radialCoeff = (-1.5 * L2) / r5;

  if (type === 'massive') {
    // Newtonian + Post-Newtonian monopole attraction -G M / r^3 (with G M = 0.5 r_s c^2)
    radialCoeff += -0.5 / r3;
  }

  // Kerr frame-dragging (Lense-Thirring gravitomagnetic force) in the equatorial plane
  // Shifts circular orbits inward for prograde (L * spin > 0) and outward for retrograde
  if (Math.abs(spin) > 1e-5) {
    radialCoeff += (1.5 * spin * L) / (r3 * r);
  }

  return {
    ax: radialCoeff * x,
    ay: radialCoeff * y,
  };
}

/**
 * Advances a geodesic particle by one step d\lambda using the classical
 * 4th-Order Runge-Kutta (RK4) numerical integrator.
 */
export function stepGeodesicRK4(
  particle: GeodesicParticle,
  dt: number,
  spin = 0,
  maxTrailLength = 340
): void {
  if (particle.status !== 'orbiting') return;

  const { rPlusRs } = kerrHorizonRadiiInRs(spin);
  const rCurrent = Math.hypot(particle.x, particle.y);

  // Adaptive step refinement near the horizon/photon sphere to preserve symplectic accuracy
  const subSteps = rCurrent < 3.5 ? 6 : 2;
  const h = dt / subSteps;

  let x = particle.x;
  let y = particle.y;
  let vx = particle.vx;
  let vy = particle.vy;

  for (let s = 0; s < subSteps; s++) {
    const r = Math.hypot(x, y);
    if (r <= rPlusRs * 1.01) {
      particle.status = 'captured';
      break;
    }
    if (r > 32.0) {
      particle.status = 'escaped';
      break;
    }

    // RK4 Stage 1
    const k1v = geodesicAcceleration(x, y, vx, vy, particle.type, spin);
    const k1x = vx;
    const k1y = vy;

    // RK4 Stage 2
    const x2 = x + 0.5 * h * k1x;
    const y2 = y + 0.5 * h * k1y;
    const vx2 = vx + 0.5 * h * k1v.ax;
    const vy2 = vy + 0.5 * h * k1v.ay;
    const k2v = geodesicAcceleration(x2, y2, vx2, vy2, particle.type, spin);

    // RK4 Stage 3
    const x3 = x + 0.5 * h * vx2;
    const y3 = y + 0.5 * h * vy2;
    const vx3 = vx + 0.5 * h * k2v.ax;
    const vy3 = vy + 0.5 * h * k2v.ay;
    const k3v = geodesicAcceleration(x3, y3, vx3, vy3, particle.type, spin);

    // RK4 Stage 4
    const x4 = x + h * vx3;
    const y4 = y + h * vy3;
    const vx4 = vx + h * k3v.ax;
    const vy4 = vy + h * k3v.ay;
    const k4v = geodesicAcceleration(x4, y4, vx4, vy4, particle.type, spin);

    // Combine stages with 1/6 weights
    x += (h / 6.0) * (k1x + 2.0 * vx2 + 2.0 * vx3 + vx4);
    y += (h / 6.0) * (k1y + 2.0 * vy2 + 2.0 * vy3 + vy4);
    vx += (h / 6.0) * (k1v.ax + 2.0 * k2v.ax + 2.0 * k3v.ax + k4v.ax);
    vy += (h / 6.0) * (k1v.ay + 2.0 * k2v.ay + 2.0 * k3v.ay + k4v.ay);

    // Advance proper time \tau and coordinate time t = \int (1 - r_s/r)^{-1} d\tau
    particle.properTime += h;
    const metricLapse = Math.max(0.02, 1.0 - rPlusRs / Math.max(rPlusRs * 1.001, r));
    particle.coordinateTime += h / metricLapse;
  }

  particle.x = x;
  particle.y = y;
  particle.vx = vx;
  particle.vy = vy;
  particle.angularMomentum = x * vy - y * vx;

  particle.trail.push({ x, y });
  if (particle.trail.length > maxTrailLength) {
    particle.trail.shift();
  }
}

/**
 * Factory helper to create a new geodesic test particle or photon with exact conserved quantities.
 */
export function createGeodesicParticle(
  id: number,
  type: GeodesicParticleType,
  x: number,
  y: number,
  vx: number,
  vy: number,
  spin = 0,
  color?: string
): GeodesicParticle {
  // Normalize photon speed so |v| = c = 1 in asymptotically flat space
  let normVx = vx;
  let normVy = vy;
  if (type === 'photon') {
    const speed = Math.hypot(vx, vy) || 1.0;
    normVx = vx / speed;
    normVy = vy / speed;
  }

  const r = Math.max(1.01, Math.hypot(x, y));
  const L = x * normVy - y * normVx;
  const vRad = (x * normVx + y * normVy) / r;

  // Conserved specific energy from radial geodesic first integral:
  //   E^2 = (dr/d\tau)^2 + V_{eff}^2(r)
  const vEff = computeEffectivePotential(r, L, type, spin);
  const specificEnergy =
    type === 'photon' ? 1.0 : Math.sqrt(vRad * vRad + vEff * vEff);
  const impactParameter = Math.abs(L) / Math.max(1e-6, specificEnergy);

  const defaultColor = type === 'photon' ? '#38bdf8' : '#fbbf24';

  return {
    id,
    type,
    x,
    y,
    vx: normVx,
    vy: normVy,
    angularMomentum: L,
    specificEnergy,
    impactParameter,
    properTime: 0,
    coordinateTime: 0,
    trail: [{ x, y }],
    status: 'orbiting',
    color: color ?? defaultColor,
  };
}

/**
 * Computes the exact relativistic circular orbital tangential speed in our Binet geodesic
 * coordinate system at radius r (in units of r_s):
 *   \frac{v_\phi^2}{r} = \frac{1}{2 r^2} + \frac{3}{2} \frac{L^2}{r^4}
 *   With L = r v_\phi, this yields:
 *   v_\phi^2 \left(1 - \frac{3}{2 r}\right) = \frac{1}{2 r}
 *   \implies v_\phi(r) = \sqrt{\frac{1}{2 r - 3}}   (valid for all r > 1.5 r_s, stable for r >= 3.0 r_s)
 */
export function exactGeodesicCircularSpeed(rInRs: number, spin = 0): number {
  if (rInRs <= 1.51) return 1.0;
  // Include Kerr spin correction
  const denom = Math.max(0.05, 2.0 * rInRs - 3.0 + 1.5 * spin / Math.sqrt(rInRs));
  return Math.sqrt(1.0 / denom);
}
