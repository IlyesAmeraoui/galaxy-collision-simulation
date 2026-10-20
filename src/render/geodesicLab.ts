/**
 * Interactive Equatorial Geodesic & Effective Potential Laboratory Renderer
 *
 * Visualizes:
 *   1. 2D Equatorial Plane (Boyer-Lindquist coordinates x/r_s, y/r_s) showing:
 *      - Event Horizon r_+(a_*)
 *      - Static Limit / Ergosphere boundary (r_{ergo} = 1.0 r_s)
 *      - Photon Sphere (r_{ph})
 *      - Critical Shadow Impact Parameter cylinder (b_c = 3\sqrt{3}/2 r_s)
 *      - Innermost Stable Circular Orbit (r_{ISCO})
 *      - Real-time RK4 trajectories of null (photon) and timelike (massive) geodesics
 *   2. Real-time Effective Potential V_{eff}(r) curve for the active particle.
 */

import {
  computeEffectivePotential,
  GeodesicParticle,
  GeodesicParticleType,
} from '../physics/geodesics';
import {
  criticalImpactParameterInRs,
  iscoRadiiInRs,
  kerrHorizonRadiiInRs,
  photonSphereRadiiInRs,
} from '../physics/relativity';

export interface DragLaunchVector {
  startXRs: number;
  startYRs: number;
  vx: number;
  vy: number;
  type: GeodesicParticleType;
}

export class GeodesicLabRenderer {
  private orbitCanvas: HTMLCanvasElement;
  private potentialCanvas: HTMLCanvasElement;
  /** Visible radius range in units of r_s from center */
  public viewRadiusRs = 13.5;

  constructor(orbitCanvas: HTMLCanvasElement, potentialCanvas: HTMLCanvasElement) {
    this.orbitCanvas = orbitCanvas;
    this.potentialCanvas = potentialCanvas;
  }

  /**
   * Converts canvas pixel coordinates (px, py) to equatorial coordinates (x, y) in units of r_s.
   */
  public screenToRs(clientX: number, clientY: number): { xRs: number; yRs: number } {
    const rect = this.orbitCanvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const ny = (clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    const aspect = rect.width / Math.max(1, rect.height);
    const scaleX = aspect >= 1 ? this.viewRadiusRs * 2 * aspect : this.viewRadiusRs * 2;
    const scaleY = aspect >= 1 ? this.viewRadiusRs * 2 : (this.viewRadiusRs * 2) / aspect;
    return {
      xRs: nx * scaleX,
      yRs: -ny * scaleY,
    };
  }

  /**
   * Renders the 2D equatorial geodesic trajectories and relativistic characteristic radii.
   */
  public renderOrbitView(
    particles: GeodesicParticle[],
    spin: number,
    probeRadiusRs: number,
    selectedParticle: GeodesicParticle | null,
    dragVector: DragLaunchVector | null
  ): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.orbitCanvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.orbitCanvas.clientHeight * dpr));
    if (this.orbitCanvas.width !== w || this.orbitCanvas.height !== h) {
      this.orbitCanvas.width = w;
      this.orbitCanvas.height = h;
    }

    const ctx = this.orbitCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const pxPerRs = Math.min(w, h) / (this.viewRadiusRs * 2.0);

    const toPx = (xRs: number, yRs: number): [number, number] => [
      cx + xRs * pxPerRs,
      cy - yRs * pxPerRs,
    ];

    // Draw coordinate grid in units of r_s
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    const maxGrid = Math.ceil(this.viewRadiusRs * 1.6);
    for (let g = -maxGrid; g <= maxGrid; g += 2) {
      const [gx] = toPx(g, 0);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();

      const [, gy] = toPx(0, g);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Draw principal axes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    const { rPlusRs } = kerrHorizonRadiiInRs(spin);
    const { progradeRs: rPhotonRs } = photonSphereRadiiInRs(spin);
    const { progradeRs: rIscoRs } = iscoRadiiInRs(spin);
    const bCritRs = criticalImpactParameterInRs(spin);

    // Accretion disk band (between r_{ISCO} and 9.5 r_s)
    const diskGrad = ctx.createRadialGradient(
      cx,
      cy,
      rIscoRs * pxPerRs,
      cx,
      cy,
      9.5 * pxPerRs
    );
    diskGrad.addColorStop(0, 'rgba(251, 146, 60, 0.16)');
    diskGrad.addColorStop(0.4, 'rgba(234, 88, 12, 0.08)');
    diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = diskGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 9.5 * pxPerRs, 0, Math.PI * 2);
    ctx.arc(cx, cy, rIscoRs * pxPerRs, 0, Math.PI * 2, true);
    ctx.fill();

    // Helper to draw labeled relativistic radius circles
    const drawRadiusCircle = (
      radiusRs: number,
      color: string,
      dash: number[],
      label: string,
      angleRad: number
    ) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4 * dpr;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.arc(cx, cy, radiusRs * pxPerRs, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const lx = cx + Math.cos(angleRad) * radiusRs * pxPerRs;
      const ly = cy - Math.sin(angleRad) * radiusRs * pxPerRs;
      ctx.fillStyle = color;
      ctx.font = `${Math.round(10.5 * dpr)}px "JetBrains Mono", monospace`;
      ctx.fillText(label, lx + 6 * dpr, ly - 4 * dpr);
      ctx.restore();
    };

    // 1. ISCO circle (r = r_{ISCO})
    drawRadiusCircle(
      rIscoRs,
      'rgba(52, 211, 153, 0.72)',
      [6 * dpr, 4 * dpr],
      `r_ISCO = ${rIscoRs.toFixed(2)} r_s`,
      0.55
    );

    // 2. Critical impact parameter b_c = 3\sqrt{3}/2 r_s (Black Hole Shadow boundary)
    drawRadiusCircle(
      bCritRs,
      'rgba(56, 189, 248, 0.65)',
      [3 * dpr, 3 * dpr],
      `b_c = ${bCritRs.toFixed(2)} r_s`,
      2.35
    );

    // 3. Photon Sphere (r = r_{ph})
    drawRadiusCircle(
      rPhotonRs,
      'rgba(251, 191, 36, 0.85)',
      [2 * dpr, 2 * dpr],
      `r_ph = ${rPhotonRs.toFixed(2)} r_s`,
      -0.65
    );

    // 4. Radial Probe marker circle
    drawRadiusCircle(
      probeRadiusRs,
      'rgba(192, 132, 252, 0.55)',
      [8 * dpr, 4 * dpr],
      `Probe r = ${probeRadiusRs.toFixed(2)} r_s`,
      -2.4
    );

    // 5. Ergosphere boundary (r_{ergo} = 1.0 r_s in equatorial plane) when spin > 0
    if (spin > 0.05) {
      ctx.save();
      ctx.fillStyle = 'rgba(99, 102, 241, 0.16)';
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.65)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.0 * pxPerRs, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 6. Event Horizon filled disk (r <= r_+(a_*))
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.0 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, rPlusRs * pxPerRs, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Draw geodesic particle trajectories
    for (const p of particles) {
      if (p.trail.length < 2) continue;
      const isSelected = selectedParticle?.id === p.id;

      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = (isSelected ? 2.6 : 1.7) * dpr;
      ctx.globalAlpha = p.status === 'orbiting' ? 0.92 : 0.48;
      ctx.beginPath();
      for (let i = 0; i < p.trail.length; i++) {
        const [px, py] = toPx(p.trail[i].x, p.trail[i].y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Particle head
      const [hx, hy] = toPx(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(hx, hy, (isSelected ? 4.8 : 3.4) * dpr, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.arc(hx, hy, 7.5 * dpr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw interactive slingshot launch vector if user is dragging
    if (dragVector) {
      const [sx, sy] = toPx(dragVector.startXRs, dragVector.startYRs);
      const [ex, ey] = toPx(
        dragVector.startXRs + dragVector.vx * 2.5,
        dragVector.startYRs + dragVector.vy * 2.5
      );
      ctx.save();
      ctx.strokeStyle = dragVector.type === 'photon' ? '#38bdf8' : '#fbbf24';
      ctx.lineWidth = 2.2 * dpr;
      ctx.setLineDash([4 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = dragVector.type === 'photon' ? '#38bdf8' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5 * dpr, 0, Math.PI * 2);
      ctx.fill();

      const L = dragVector.startXRs * dragVector.vy - dragVector.startYRs * dragVector.vx;
      ctx.font = `${Math.round(11 * dpr)}px "JetBrains Mono", monospace`;
      ctx.fillText(
        `Launch ${dragVector.type.toUpperCase()} | L = ${L.toFixed(2)} r_s c`,
        sx + 10 * dpr,
        sy - 10 * dpr
      );
      ctx.restore();
    }
  }

  /**
   * Renders the General Relativistic Effective Potential V_{eff}(r) curve
   * for the active/selected geodesic particle.
   */
  public renderEffectivePotentialPlot(
    particle: GeodesicParticle | null,
    spin: number
  ): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.potentialCanvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.potentialCanvas.clientHeight * dpr));
    if (this.potentialCanvas.width !== w || this.potentialCanvas.height !== h) {
      this.potentialCanvas.width = w;
      this.potentialCanvas.height = h;
    }

    const ctx = this.potentialCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#080c18';
    ctx.fillRect(0, 0, w, h);

    const padL = 42 * dpr;
    const padR = 16 * dpr;
    const padT = 22 * dpr;
    const padB = 28 * dpr;
    const plotW = Math.max(10, w - padL - padR);
    const plotH = Math.max(10, h - padT - padB);

    const { rPlusRs } = kerrHorizonRadiiInRs(spin);
    const { progradeRs: rPhotonRs } = photonSphereRadiiInRs(spin);
    const { progradeRs: rIscoRs } = iscoRadiiInRs(spin);

    const type: GeodesicParticleType = particle?.type ?? 'massive';
    const L = particle?.angularMomentum ?? 2.1;

    // Sample V_{eff}(r) across r in [rPlusRs, 12 r_s]
    const rMax = 12.0;
    const samples: Array<{ r: number; v: number }> = [];
    let vMax = type === 'photon' ? 1.4 : 1.15;
    let vMin = type === 'photon' ? 0.0 : 0.7;

    for (let i = 0; i <= 140; i++) {
      const r = rPlusRs + (i / 140) * (rMax - rPlusRs);
      const v = computeEffectivePotential(r, L, type, spin);
      samples.push({ r, v });
      if (v > vMax && v < 4.0) vMax = v * 1.08;
    }

    const rToX = (r: number) => padL + ((r - 0) / rMax) * plotW;
    const vToY = (v: number) =>
      padT + (1.0 - (v - vMin) / Math.max(0.05, vMax - vMin)) * plotH;

    // Axes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Vertical reference lines for r_+, r_{ph}, and r_{ISCO}
    const drawVertRef = (rVal: number, color: string, label: string) => {
      const x = rToX(rVal);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = `${Math.round(9.5 * dpr)}px "JetBrains Mono", monospace`;
      ctx.fillText(label, x + 3 * dpr, padT + 11 * dpr);
      ctx.restore();
    };

    drawVertRef(rPlusRs, '#f97316', 'r+');
    drawVertRef(rPhotonRs, '#fbbf24', 'r_ph');
    drawVertRef(rIscoRs, '#34d399', 'ISCO');

    // Draw V_{eff}(r) curve
    ctx.save();
    ctx.strokeStyle = type === 'photon' ? '#38bdf8' : '#fbbf24';
    ctx.lineWidth = 2.0 * dpr;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = rToX(samples[i].r);
      const y = Math.max(padT, Math.min(padT + plotH, vToY(samples[i].v)));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Draw current particle radial state (r, E) on the potential diagram
    if (particle) {
      const rCurr = Math.min(rMax, Math.hypot(particle.x, particle.y));
      const eLevel = particle.specificEnergy;
      const yE = Math.max(padT, Math.min(padT + plotH, vToY(eLevel)));
      const xR = rToX(rCurr);

      // Constant total energy line E
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(padL, yE);
      ctx.lineTo(padL + plotW, yE);
      ctx.stroke();
      ctx.setLineDash([]);

      // Current particle state dot
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(xR, yE, 4.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = `${Math.round(10 * dpr)}px "JetBrains Mono", monospace`;
    ctx.fillText(
      `V_eff(r) [${type.toUpperCase()}, L = ${L.toFixed(2)} r_s c]`,
      padL + 6 * dpr,
      padT - 6 * dpr
    );
    ctx.fillText('r / r_s →', padL + plotW - 52 * dpr, padT + plotH + 20 * dpr);
  }
}
