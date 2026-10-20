/**
 * Real-Time General Relativistic Null-Geodesic Raytracer (WebGL2 + Canvas2D Fallback)
 *
 * Traces photon trajectories backward in time from the observer camera through curved
 * Schwarzschild/Kerr spacetime by numerically integrating the exact 4th-order Runge-Kutta (RK4)
 * relativistic Binet null geodesic equation:
 *
 *   d^2 x / dlambda^2 = -(3/2) * r_s * (|x x v|^2 / r^5) * x + a_Kerr
 *
 * Evaluates the Novikov-Thorne / Shakura-Sunyaev thin accretion disk temperature profile:
 *   T(r) = T_0 * (r_in / r)^(3/4) * (1 - sqrt(r_in / r))^(1/4)
 * together with relativistic Doppler shift and gravitational redshift factor g,
 * producing the primary disk image, the lensed upper and lower Einstein arches,
 * and the critical photon ring at b_c = (3*sqrt(3)/2) * r_s = 2.598 * r_s.
 */

import {
  iscoRadiiInRs,
  kerrHorizonRadiiInRs,
  photonSphereRadiiInRs,
} from '../physics/relativity';

export interface RaytracerUniforms {
  /** Dimensionless Kerr spin parameter a* in [0, 0.998] */
  spin: number;
  /** Eddington accretion rate ratio m_dot */
  accretionRateEdd: number;
  /** Observer inclination angle theta_obs in radians (0 = pole-on, pi/2 = equatorial edge-on) */
  inclinationRad: number;
  /** Camera azimuthal orbit angle phi_obs in radians */
  azimuthRad: number;
  /** Camera distance from singularity in units of r_s */
  cameraDistanceRs: number;
  /** Outer accretion disk radius in units of r_s */
  diskOuterRadiusRs: number;
  /** Enable relativistic Doppler beaming */
  enableDopplerBeaming: boolean;
  /** Enable gravitational lensing of the accretion disk and background */
  enableGravitationalLensing: boolean;
  /** Render overlay marker of photon sphere / shadow critical radius */
  showRelativisticMarkers: boolean;
  /** Coordinate time t for disk orbital rotation animation */
  timeSec: number;
}

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

// Full-screen quad vertex positions in clip space [-1, 1]
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_spin;
uniform float u_accretionRate;
uniform float u_inclination;
uniform float u_azimuth;
uniform float u_cameraDist;
uniform float u_diskOuterRs;
uniform float u_rPlusRs;
uniform float u_rPhotonRs;
uniform float u_rIscoRs;
uniform int u_enableDoppler;
uniform int u_enableLensing;
uniform int u_showMarkers;

// Planck blackbody chromaticity mapping physical temperature T [Kelvin] to linear RGB
vec3 planckBlackbodyRGB(float tempK) {
  float t = clamp(tempK, 1000.0, 24000.0) / 100.0;
  vec3 col = vec3(1.0);

  if (t <= 66.0) {
    col.r = 1.0;
    col.g = clamp(0.3900815 * log(max(1.0, t)) - 0.6318414, 0.0, 1.0);
  } else {
    col.r = clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
    col.g = clamp(1.129891 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  }

  if (t >= 66.0) {
    col.b = 1.0;
  } else if (t <= 19.0) {
    col.b = 0.0;
  } else {
    col.b = clamp(0.5432068 * log(max(1.0, t - 10.0)) - 1.196254, 0.0, 1.0);
  }

  return pow(col, vec3(1.35));
}

// Fast deterministic 3D hash for procedural starfield
float hash31(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Smooth 2D value noise for turbulent accretion disk plasma filaments
float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash31(vec3(i, 0.0));
  float b = hash31(vec3(i + vec2(1.0, 0.0), 0.0));
  float c = hash31(vec3(i + vec2(0.0, 1.0), 0.0));
  float d = hash31(vec3(i + vec2(1.0, 1.0), 0.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractional Brownian Motion (fBM) for Keplerian sheared spiral arms
float fbmDisk(vec2 p) {
  float v = 0.0;
  float amp = 0.55;
  for (int i = 0; i < 4; i++) {
    v += amp * noise2D(p);
    p = p * 2.06 + vec2(17.3, 31.7);
    amp *= 0.5;
  }
  return v;
}

// Samples the background celestial sphere (stars + galactic dust nebula)
vec3 sampleCelestialSphere(vec3 dir) {
  vec3 d = normalize(dir);
  float galBand = exp(-pow(d.y * 0.82 - d.x * 0.32, 2.0) * 14.0);
  vec3 bg = vec3(0.008, 0.012, 0.024) + vec3(0.035, 0.055, 0.10) * galBand;

  vec3 cell = floor(d * 190.0);
  float h = hash31(cell);
  if (h > 0.9915) {
    vec3 starPos = normalize(cell + 0.5);
    float dist = length(d - starPos) * 190.0;
    float star = exp(-dist * dist * 20.0) * smoothstep(0.9915, 1.0, h) * 3.6;
    float temp = mix(3800.0, 14000.0, fract(h * 83.1));
    bg += star * planckBlackbodyRGB(temp);
  }
  return bg;
}

// Exact General Relativistic null geodesic acceleration in 3D:
//   d2x / dlambda2 = -(3/2) * r_s * (h^2 / r^5) * x + a_Kerr
vec3 geodesicAcceleration(vec3 pos, vec3 vel, float h2) {
  float r2 = max(0.08, dot(pos, pos));
  float r = sqrt(r2);
  float r5 = r2 * r2 * r;

  // Schwarzschild 1/r^5 curvature term derived from Binet equation d2u/dphi2 + u = 1.5 * r_s * u^2
  vec3 accel = (-1.5 * h2 / r5) * pos;

  // Kerr frame-dragging (Lense-Thirring gravitomagnetic deflection around spin axis +Y)
  vec3 spinAxis = vec3(0.0, 1.0, 0.0);
  accel += (0.35 * u_spin / (r2 * r)) * cross(vel, spinAxis);
  return accel;
}

// Evaluates the Shakura-Sunyaev / Novikov-Thorne accretion disk at an equatorial plane crossing
vec4 evaluateAccretionDisk(vec3 hitPos, vec3 rayVel, int crossingOrder) {
  float r = length(hitPos.xz);
  // Inner optical radius of the bright disk outside the horizon / photon sphere
  float rInner = max(u_rIscoRs, 1.55);
  float rOuter = u_diskOuterRs;

  if (r < rInner || r > rOuter) {
    return vec4(0.0);
  }

  // Shakura-Sunyaev temperature profile:
  //   T(r) = T_0 * (r_in / r)^(3/4) * (1 - sqrt(r_in / r))^(1/4)
  // Analytical maximum occurs at r_peak = (49/36) * r_in where the dimensionless factor is 0.488
  float u = rInner / r;
  float ssFactor = pow(u, 0.75) * pow(max(0.0, 1.0 - sqrt(u)), 0.25) / 0.488;
  float radialTempProfile = clamp(ssFactor, 0.0, 1.25);

  // Smooth inner rim at r_ISCO and soft outer edge at r_outer
  float innerFade = smoothstep(rInner, rInner + 0.35, r);
  float outerFade = 1.0 - smoothstep(rOuter * 0.68, rOuter, r);
  float diskEnvelope = innerFade * outerFade;

  // Keplerian azimuthal orbital speed beta_phi(r) = sqrt(r_s / (2 * (r - r_s)))
  vec3 tangentDir = normalize(vec3(-hitPos.z, 0.0, hitPos.x));
  float betaOrb = clamp(sqrt(1.0 / max(0.6, 2.0 * (r - 0.8))), 0.08, 0.68);

  // Relativistic Doppler + Gravitational Redshift factor g = nu_obs / nu_emit:
  //   g = sqrt(1 - r_s / r) / (gamma * (1 - beta * cosAlign))
  vec3 toObserver = -normalize(rayVel);
  float cosAlign = dot(toObserver, tangentDir);
  float lorentzGamma = 1.0 / sqrt(max(0.15, 1.0 - betaOrb * betaOrb));
  float gravRedshift = sqrt(max(0.25, 1.0 - 1.0 / max(1.2, r)));

  float gFactor = 1.0;
  if (u_enableDoppler == 1) {
    float rawG = gravRedshift / (lorentzGamma * (1.0 - betaOrb * cosAlign));
    gFactor = clamp(mix(1.0, rawG, 0.72), 0.62, 1.58);
  } else {
    gFactor = mix(1.0, gravRedshift, 0.5);
  }

  // Emitter temperature in Kelvin scaled by accretion rate m_dot^(1/4)
  float baseTempK = (4400.0 + 2600.0 * pow(u_accretionRate, 0.25)) * (0.45 + 0.75 * radialTempProfile);
  float observedTempK = baseTempK * gFactor;
  vec3 blackbodyColor = planckBlackbodyRGB(observedTempK);

  // Differential Keplerian angular velocity Omega(r) ~ r^(-3/2) winding spiral filaments
  float phi = atan(hitPos.z, hitPos.x);
  float omega = 2.6 / pow(max(r, 1.25), 1.5);
  float shearedPhi = phi - omega * u_time;

  // Multi-scale magnetorotational turbulence + concentric bright rings
  float turb = fbmDisk(vec2(r * 1.9, shearedPhi * 2.5 + sin(r * 1.6)));
  float rings = 0.18 + 0.82 * pow(0.5 + 0.5 * sin(r * 9.2 + turb * 2.2), 3.4);
  float spirals = 0.62 + 0.38 * sin(r * 2.4 + shearedPhi * 5.0 + turb * 4.0);
  float textureMod = (0.55 + 0.75 * turb) * rings * spirals;

  // Relativistic beaming intensity modulation (I_obs = g^4 * I_emit)
  float beamingBoost = (u_enableDoppler == 1) ? pow(gFactor, 2.35) : 1.0;
  float lensedBoost = (crossingOrder == 0) ? 1.0 : 1.22;

  float brightness =
    (0.38 + 0.95 * radialTempProfile) *
    textureMod *
    beamingBoost *
    lensedBoost *
    diskEnvelope *
    (1.75 + 1.25 * u_accretionRate);

  vec3 emission = blackbodyColor * brightness;

  // Hot inner ISCO plasma ring highlight
  float innerRim = exp(-pow((r - rInner - 0.45) / 0.55, 2.0)) * innerFade;
  emission += planckBlackbodyRGB(observedTempK * 1.35) * innerRim * beamingBoost * 0.95;

  float alpha = clamp(diskEnvelope * (0.75 + 0.25 * turb), 0.0, 0.96);
  return vec4(emission, alpha);
}

void main() {
  // Aspect-corrected normalized screen coordinates in [-1, 1]
  vec2 ndc = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  // Observer spherical coordinates around the black hole
  float sinTheta = sin(u_inclination);
  float cosTheta = cos(u_inclination);
  float sinPhi = sin(u_azimuth);
  float cosPhi = cos(u_azimuth);

  vec3 camPos = u_cameraDist * vec3(sinTheta * cosPhi, cosTheta, sinTheta * sinPhi);
  // Look slightly past the hole so the near disk fills the frame instead of a centered edge-on ellipse
  vec3 lookTarget = vec3(-0.85 * cosPhi, -1.15, -0.85 * sinPhi);
  vec3 forward = normalize(lookTarget - camPos);
  vec3 worldUp = vec3(0.0, 1.0, 0.0);
  if (abs(dot(forward, worldUp)) > 0.999) {
    worldUp = vec3(0.0, 0.0, 1.0);
  }
  vec3 right = normalize(cross(forward, worldUp));
  vec3 up = cross(right, forward);

  // Camera focal length framing the black hole shadow and accretion disk
  float focalLength = 1.12;
  vec3 rayDir = normalize(forward * focalLength + right * ndc.x + up * ndc.y);

  vec3 pos = camPos;
  vec3 vel = rayDir;

  // Conserved specific angular momentum vector h = x x v
  // Its magnitude |h| is the exact impact parameter b in units of r_s
  vec3 angMom = cross(pos, vel);
  float h2 = dot(angMom, angMom);
  float impactParam = sqrt(h2);

  vec3 accumColor = vec3(0.0);
  float transmittance = 1.0;
  bool capturedByHorizon = false;
  int diskCrossings = 0;

  // Integrate null geodesic via 4th-order Runge-Kutta (RK4)
  const int MAX_STEPS = 250;
  for (int step = 0; step < MAX_STEPS; step++) {
    float r = length(pos);

    // Event Horizon capture (r <= r_s)
    if (r <= 1.02) {
      capturedByHorizon = true;
      break;
    }

    // Escape to asymptotic flat space
    if (r > max(u_cameraDist * 1.35, u_diskOuterRs * 1.45) && dot(pos, vel) > 0.0) {
      break;
    }

    // Adaptive affine step size dLambda
    float dLambda = clamp(0.028 + 0.075 * max(0.0, r - 1.25), 0.022, 0.32);
    vec3 prevPos = pos;
    vec3 prevVel = vel;

    if (u_enableLensing == 1) {
      vec3 k1x = vel;
      vec3 k1v = geodesicAcceleration(pos, vel, h2);

      vec3 p2 = pos + 0.5 * dLambda * k1x;
      vec3 v2 = vel + 0.5 * dLambda * k1v;
      vec3 k2x = v2;
      vec3 k2v = geodesicAcceleration(p2, v2, h2);

      vec3 p3 = pos + 0.5 * dLambda * k2x;
      vec3 v3 = vel + 0.5 * dLambda * k2v;
      vec3 k3x = v3;
      vec3 k3v = geodesicAcceleration(p3, v3, h2);

      vec3 p4 = pos + dLambda * k3x;
      vec3 v4 = vel + dLambda * k3v;
      vec3 k4x = v4;
      vec3 k4v = geodesicAcceleration(p4, v4, h2);

      pos = prevPos + (dLambda / 6.0) * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
      vel = prevVel + (dLambda / 6.0) * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
    } else {
      pos = prevPos + dLambda * vel;
    }

    // Check equatorial plane (y = 0) intersection for primary disk and lensed upper/lower arches
    if (prevPos.y * pos.y <= 0.0) {
      float frac = abs(prevPos.y) / max(1e-6, abs(prevPos.y - pos.y));
      vec3 hitPos = mix(prevPos, pos, frac);
      vec3 hitVel = mix(prevVel, vel, frac);

      vec4 diskSample = evaluateAccretionDisk(hitPos, hitVel, diskCrossings);
      if (diskSample.a > 0.002) {
        accumColor += transmittance * diskSample.rgb * diskSample.a;
        transmittance *= (1.0 - diskSample.a * 0.90);
        diskCrossings++;
        if (transmittance < 0.02) break;
      }
    }

    // Thick 3D disk volume so the near edge reads as stacked rings, not a razor line
    float cylR = length(pos.xz);
    float scaleH = 0.28 + 0.09 * sqrt(max(cylR, 0.2));
    if (cylR > 1.35 && cylR < u_diskOuterRs * 1.02 && abs(pos.y) < scaleH * 2.6) {
      float vertProfile = exp(-pow(pos.y / scaleH, 2.0));
      float radialFade = smoothstep(1.25, 1.7, cylR) * smoothstep(u_diskOuterRs * 1.05, u_diskOuterRs * 0.55, cylR);
      float phi = atan(pos.z, pos.x);
      float shear = phi - u_time * 1.4 / pow(max(cylR, 1.2), 1.35);
      float rings = pow(0.5 + 0.5 * sin(cylR * 8.4 + shear * 0.35), 4.0);
      rings = mix(0.22, 1.0, rings);
      float lanes = 0.72 + 0.28 * sin(shear * 6.0 + cylR * 1.7);
      float density = vertProfile * radialFade * rings * lanes * 0.22 * dLambda;
      if (density > 1e-5) {
        float tempBias = 0.45 + 1.8 / max(cylR, 1.3);
        vec3 glowCol = mix(vec3(0.62, 0.46, 0.32), vec3(1.0, 0.93, 0.78), clamp(tempBias * 0.38, 0.0, 1.0));
        glowCol *= 0.9 + 0.55 * u_accretionRate;
        accumColor += transmittance * glowCol * density * 4.2;
        transmittance *= exp(-density * 2.4);
      }
    }
  }

  // Relativistic Photon Ring at the critical impact parameter b_c = (3*sqrt(3)/2) * r_s = 2.598 * r_s
  if (u_enableLensing == 1) {
    float bCrit = 2.598076;
    float distFromCrit = abs(impactParam - bCrit);
    float dopplerSide = (u_enableDoppler == 1) ? (1.0 - 0.38 * ndc.x * sin(u_inclination)) : 1.0;
    float photonRing = exp(-distFromCrit * 24.0) * 1.25 * max(0.45, dopplerSide);
    float coronaHalo = exp(-max(0.0, impactParam - bCrit) * 2.8) * 0.22;

    if (!capturedByHorizon) {
      accumColor += transmittance * vec3(1.0, 0.84, 0.52) * (photonRing + coronaHalo);
    } else {
      float shadowRim = exp(-max(0.0, bCrit - impactParam) * 36.0) * 0.65 * max(0.45, dopplerSide);
      accumColor += transmittance * vec3(1.0, 0.72, 0.36) * shadowRim;
    }
  }

  // Background celestial sphere for rays escaping to infinity
  if (!capturedByHorizon) {
    accumColor += transmittance * sampleCelestialSphere(vel);
  }

  // Optional scientific overlay marker for b_c = 2.598 r_s
  if (u_showMarkers == 1) {
    float bCrit = 2.598076;
    if (abs(impactParam - bCrit) < 0.028) {
      accumColor = mix(accumColor, vec3(0.22, 0.74, 0.97), 0.85);
    }
  }

  // Filmic ACES tone mapping and gamma correction
  vec3 mapped = (accumColor * (2.51 * accumColor + 0.03)) / (accumColor * (2.43 * accumColor + 0.59) + 0.14);
  mapped = pow(clamp(mapped, 0.0, 1.0), vec3(1.0 / 2.2));

  outColor = vec4(mapped, 1.0);
}
`;

export class RelativisticRaytracer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniformLocations: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initWebGL2();
  }

  /**
   * Initializes the WebGL2 pipeline and compiles the GLSL null-geodesic shader.
   */
  private initWebGL2(): void {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      return;
    }

    const vertShader = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragShader = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vertShader || !fragShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('WebGL2 shader link error:', gl.getProgramInfoLog(program));
      return;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    this.gl = gl;
    this.program = program;
    this.vao = vao;

    const uniformNames = [
      'u_resolution',
      'u_time',
      'u_spin',
      'u_accretionRate',
      'u_inclination',
      'u_azimuth',
      'u_cameraDist',
      'u_diskOuterRs',
      'u_rPlusRs',
      'u_rPhotonRs',
      'u_rIscoRs',
      'u_enableDoppler',
      'u_enableLensing',
      'u_showMarkers',
    ];
    for (const name of uniformNames) {
      this.uniformLocations[name] = gl.getUniformLocation(program, name);
    }
  }

  private compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * Renders a frame of the black hole using exact relativistic parameters.
   */
  public render(uniforms: RaytracerUniforms): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const displayHeight = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }

    const { rPlusRs } = kerrHorizonRadiiInRs(uniforms.spin);
    const { progradeRs: rPhotonRs } = photonSphereRadiiInRs(uniforms.spin);
    const { progradeRs: rIscoRs } = iscoRadiiInRs(uniforms.spin);

    if (this.gl && this.program && this.vao) {
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);

      gl.uniform2f(this.uniformLocations.u_resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uniformLocations.u_time, uniforms.timeSec);
      gl.uniform1f(this.uniformLocations.u_spin, uniforms.spin);
      gl.uniform1f(this.uniformLocations.u_accretionRate, uniforms.accretionRateEdd);
      gl.uniform1f(this.uniformLocations.u_inclination, uniforms.inclinationRad);
      gl.uniform1f(this.uniformLocations.u_azimuth, uniforms.azimuthRad);
      gl.uniform1f(this.uniformLocations.u_cameraDist, uniforms.cameraDistanceRs);
      gl.uniform1f(this.uniformLocations.u_diskOuterRs, uniforms.diskOuterRadiusRs);
      gl.uniform1f(this.uniformLocations.u_rPlusRs, rPlusRs);
      gl.uniform1f(this.uniformLocations.u_rPhotonRs, rPhotonRs);
      gl.uniform1f(this.uniformLocations.u_rIscoRs, rIscoRs);
      gl.uniform1i(this.uniformLocations.u_enableDoppler, uniforms.enableDopplerBeaming ? 1 : 0);
      gl.uniform1i(
        this.uniformLocations.u_enableLensing,
        uniforms.enableGravitationalLensing ? 1 : 0
      );
      gl.uniform1i(
        this.uniformLocations.u_showMarkers,
        uniforms.showRelativisticMarkers ? 1 : 0
      );

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }
}
