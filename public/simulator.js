/**
 * Physics Mechanics Simulator Engine (Algerian Baccalaureate Curriculum - Unit 5)
 * Covers:
 * 1. Vertical Falling (Free fall vs Real fall with Stokes/Newton drag + Archimedes)
 * 2. Projectile Motion (Trajectory, Apex S, Range P, Energy transfer)
 * 3. Satellite & Planet Orbits (Kepler, Frenet Frame, Orbital Velocity, Geosynchronous orbit)
 * 4. Inclined & Horizontal Plane (Newton's 2nd Law, Normal force, Friction, Tension)
 */

(function () {
  'use strict';

  // Available phenomena models
  var currentPhenomenon = 'falling'; // 'falling' | 'projectile' | 'satellites' | 'plane'
  var isRunning = false;
  var simSpeed = 1.0;
  var showVectors = true;
  var showTrajectory = true;
  var slowMotion = false;

  // Simulation State & Time
  var simTime = 0; // seconds
  var animFrameId = null;
  var lastTimestamp = null;

  // Canvas context
  var canvas = document.getElementById('physics-canvas');
  var ctx = canvas.getContext('2d');

  var chartV = document.getElementById('chart-v-canvas');
  var ctxV = chartV.getContext('2d');
  var chartE = document.getElementById('chart-e-canvas');
  var ctxE = chartE.getContext('2d');

  // History buffers for plotting (t, v, x, z, Ec, Epp, Em)
  var telemetryData = [];
  var trajectoryPoints = [];

  // ================= Physics Parameters =================
  var params = {
    // Shared
    g: 9.8,
    mass: 0.5,       // kg
    // Vertical Fall
    fallHeight: 15,  // m
    fallType: 'real', // 'real' | 'free'
    fluidType: 'air', // 'air' | 'water' | 'oil'
    dragLaw: 'v2',   // 'v' | 'v2'
    kDrag: 0.08,     // Drag coefficient
    fluidDensity: 1.29, // kg/m^3
    solidDensity: 2700, // kg/m^3 (Aluminum)
    archimedesOn: true,
    // Projectile
    v0: 15,          // m/s
    angleDeg: 45,    // degrees
    projH0: 2,       // initial height m
    projAirRes: false,
    // Satellites
    orbitAltitude: 1200, // km (scaled for display)
    bodyCentral: 'earth', // 'earth' | 'sun'
    satMass: 500, // kg
    // Inclined Plane
    planeAngle: 30, // deg
    planeFrictionMu: 0.15, // friction coeff
    pullForce: 4, // N
    planeLength: 12 // m
  };

  // State of the moving body
  var body = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    ax: 0,
    ay: 0,
    forces: {} // { P: {x, y}, f: {x, y}, pi: {x, y}, R: {x, y}, F: {x, y} }
  };

  // Resize canvas high DPI
  function setupCanvases() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = (rect.height || 480) * dpr;
    ctx.scale(dpr, dpr);

    var rV = chartV.getBoundingClientRect();
    chartV.width = rV.width * dpr;
    chartV.height = (rV.height || 170) * dpr;
    ctxV.scale(dpr, dpr);

    var rE = chartE.getBoundingClientRect();
    chartE.width = rE.width * dpr;
    chartE.height = (rE.height || 170) * dpr;
    ctxE.scale(dpr, dpr);
  }

  window.addEventListener('resize', function () {
    setupCanvases();
    drawScene();
    drawCharts();
  });

  // ================= Initialize State per Phenomenon =================
  function resetSimulation() {
    isRunning = false;
    simTime = 0;
    telemetryData = [];
    trajectoryPoints = [];

    var btnPlay = document.getElementById('btn-play');
    if (btnPlay) {
      btnPlay.innerHTML = '<span>▶️</span> بدء المحاكاة';
      btnPlay.classList.remove('paused');
    }

    if (currentPhenomenon === 'falling') {
      body.x = 0;
      body.y = params.fallHeight; // z axis pointing up for math, 0 is ground
      body.vx = 0;
      body.vy = 0;
      body.ax = 0;
      body.ay = -params.g;
    } else if (currentPhenomenon === 'projectile') {
      var rad = (params.angleDeg * Math.PI) / 180;
      body.x = 0;
      body.y = params.projH0;
      body.vx = params.v0 * Math.cos(rad);
      body.vy = params.v0 * Math.sin(rad);
      body.ax = 0;
      body.ay = -params.g;
    } else if (currentPhenomenon === 'satellites') {
      // Celestial orbit: circular approximation
      var rScaled = 150 + (params.orbitAltitude / 36000) * 120;
      body.x = rScaled;
      body.y = 0;
      var orbV = Math.sqrt((params.g * 8000) / rScaled) * 1.6;
      body.vx = 0;
      body.vy = orbV;
      body.ax = 0;
      body.ay = 0;
    } else if (currentPhenomenon === 'plane') {
      body.x = 0;
      body.y = 0;
      body.vx = 0;
      body.vy = 0;
      body.ax = 0;
      body.ay = 0;
    }

    updateFormulasAndMetrics();
    updateTelemetryUI();
    drawScene();
    drawCharts();
  }

  // ================= Physics Physics Step Update =================
  function physicsStep(dt) {
    if (dt > 0.05) dt = 0.05; // Prevent physics explosions on lag
    var m = params.mass;
    var g = params.g;

    body.forces = {};

    if (currentPhenomenon === 'falling') {
      // Vertical motion along z: y is altitude above ground
      var vy = body.vy; // downward is negative
      var speed = Math.abs(vy);

      // 1. Gravity P (downward)
      var P = -m * g;
      body.forces.P = { x: 0, y: P, label: 'P (الثقل)' };

      var F_total = P;

      if (params.fallType === 'real') {
        // 2. Archimedes Pi (upward)
        if (params.archimedesOn) {
          var V = m / params.solidDensity;
          var Pi = params.fluidDensity * V * g;
          F_total += Pi;
          body.forces.pi = { x: 0, y: Pi, label: 'Π (دافعة أرخميدس)' };
        }

        // 3. Drag f (opposes motion)
        var fMag = 0;
        if (params.dragLaw === 'v') {
          fMag = params.kDrag * speed;
        } else {
          fMag = params.kDrag * speed * speed;
        }
        var fSign = vy > 0 ? -1 : 1;
        var fy = fSign * fMag;
        F_total += fy;
        body.forces.f = { x: 0, y: fy, label: 'f (الاحتكاك)' };
      }

      body.ay = F_total / m;
      body.ax = 0;

      // Integrate
      body.vy += body.ay * dt;
      body.y += body.vy * dt;

      // Impact with ground
      if (body.y <= 0) {
        body.y = 0;
        body.vy = 0;
        body.ay = 0;
        isRunning = false;
        var b = document.getElementById('btn-play');
        if (b) { b.innerHTML = '<span>🔄</span> إعادة التجربة'; b.classList.remove('paused'); }
      }

      trajectoryPoints.push({ x: body.x, y: body.y });

    } else if (currentPhenomenon === 'projectile') {
      // 2D Projectile
      var vx = body.vx;
      var vy = body.vy;
      var speed = Math.sqrt(vx * vx + vy * vy);

      var Fx = 0;
      var Fy = -m * g;
      body.forces.P = { x: 0, y: Fy, label: 'P (الثقل)' };

      if (params.projAirRes && speed > 0.001) {
        var f = 0.03 * speed * speed;
        var fx = -f * (vx / speed);
        var fy = -f * (vy / speed);
        Fx += fx;
        Fy += fy;
        body.forces.f = { x: fx, y: fy, label: 'f (الهواء)' };
      }

      body.ax = Fx / m;
      body.ay = Fy / m;

      body.vx += body.ax * dt;
      body.vy += body.ay * dt;
      body.x += body.vx * dt;
      body.y += body.vy * dt;

      if (body.y <= 0 && simTime > 0.05) {
        body.y = 0;
        body.vx = 0;
        body.vy = 0;
        isRunning = false;
        var b2 = document.getElementById('btn-play');
        if (b2) { b2.innerHTML = '<span>🔄</span> إعادة القذف'; b2.classList.remove('paused'); }
      }

      trajectoryPoints.push({ x: body.x, y: body.y });

    } else if (currentPhenomenon === 'satellites') {
      // Orbit around center (0,0)
      var dist = Math.sqrt(body.x * body.x + body.y * body.y);
      if (dist < 30) dist = 30;

      // Gravitational pull towards center: F = G*M*m / r^2 -> a = GM / r^2
      // Scaled GM = g * 8000
      var GM = g * 8000;
      var aMag = GM / (dist * dist);
      var ux = -body.x / dist;
      var uy = -body.y / dist;

      body.ax = aMag * ux;
      body.ay = aMag * uy;

      body.forces.P = { x: body.ax * m, y: body.ay * m, label: 'F (قوة الجذب)' };

      body.vx += body.ax * dt;
      body.vy += body.ay * dt;
      body.x += body.vx * dt;
      body.y += body.vy * dt;

      trajectoryPoints.push({ x: body.x, y: body.y });
      if (trajectoryPoints.length > 300) trajectoryPoints.shift();

    } else if (currentPhenomenon === 'plane') {
      // Motion along incline: angle theta
      var theta = (params.planeAngle * Math.PI) / 180;
      var sinT = Math.sin(theta);
      var cosT = Math.cos(theta);

      // Gravity along incline: P_x = m*g*sinT (downhill), P_y = -m*g*cosT
      // Normal Reaction R = m*g*cosT
      var R = m * g * cosT;
      var fMax = params.planeFrictionMu * R;

      // Applied pull force F (uphill)
      var F_pull = params.pullForce;

      // Net driving force along plane
      var driving = F_pull - m * g * sinT;
      var f_actual = 0;
      var a_plane = 0;

      if (Math.abs(driving) <= fMax && Math.abs(body.vx) < 0.01) {
        // Static equilibrium
        f_actual = -driving;
        a_plane = 0;
        body.vx = 0;
      } else {
        var dir = body.vx !== 0 ? (body.vx > 0 ? 1 : -1) : (driving > 0 ? 1 : -1);
        f_actual = -dir * fMax;
        a_plane = (driving + f_actual) / m;
      }

      body.ax = a_plane;
      body.vx += body.ax * dt;
      body.x += body.vx * dt;

      if (body.x < 0) {
        body.x = 0;
        if (body.vx < 0) body.vx = 0;
      }
      if (body.x > params.planeLength) {
        body.x = params.planeLength;
        isRunning = false;
        var b3 = document.getElementById('btn-play');
        if (b3) { b3.innerHTML = '<span>🔄</span> إعادة الحركة'; b3.classList.remove('paused'); }
      }

      body.forces.P = { x: 0, y: -m * g, label: 'P (الثقل)' };
      body.forces.R = { x: -R * sinT, y: R * cosT, label: 'R (رد الفعل)' };
      body.forces.f = { x: f_actual * cosT, y: f_actual * sinT, label: 'f (الاحتكاك)' };
      body.forces.F = { x: F_pull * cosT, y: F_pull * sinT, label: 'F (قوة الجر)' };
    }

    // Energies calculation
    var currentSpeed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
    if (currentPhenomenon === 'plane') currentSpeed = Math.abs(body.vx);
    var Ec = 0.5 * m * currentSpeed * currentSpeed;

    var Epp = 0;
    if (currentPhenomenon === 'falling' || currentPhenomenon === 'projectile') {
      Epp = m * g * Math.max(0, body.y);
    } else if (currentPhenomenon === 'plane') {
      var hPlane = body.x * Math.sin((params.planeAngle * Math.PI) / 180);
      Epp = m * g * hPlane;
    }
    var Em = Ec + Epp;

    simTime += dt;

    telemetryData.push({
      t: simTime,
      v: currentSpeed,
      y: currentPhenomenon === 'plane' ? body.x : body.y,
      Ec: Ec,
      Epp: Epp,
      Em: Em
    });

    if (telemetryData.length > 500) {
      telemetryData.shift();
    }
  }

  // ================= Animation Loop =================
  function loop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    var dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (isRunning) {
      var effectiveDt = dt * simSpeed * (slowMotion ? 0.25 : 1.0);
      // Sub-stepping for numerical stability
      var subSteps = 4;
      for (var i = 0; i < subSteps; i++) {
        physicsStep(effectiveDt / subSteps);
      }
      updateTelemetryUI();
      drawCharts();
    }

    drawScene();
    animFrameId = requestAnimationFrame(loop);
  }

  // ================= Canvas Rendering =================
  function drawScene() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // Background Sky/Space
    if (currentPhenomenon === 'satellites') {
      drawSpaceBackground(w, h);
    } else {
      drawLabBackground(w, h);
    }

    if (currentPhenomenon === 'falling') {
      drawFallingPhenomenon(w, h);
    } else if (currentPhenomenon === 'projectile') {
      drawProjectilePhenomenon(w, h);
    } else if (currentPhenomenon === 'satellites') {
      drawSatellitesPhenomenon(w, h);
    } else if (currentPhenomenon === 'plane') {
      drawPlanePhenomenon(w, h);
    }
  }

  function drawLabBackground(w, h) {
    // Elegant grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    var gridSize = 40;
    for (var x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (var y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function drawSpaceBackground(w, h) {
    var grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h));
    grad.addColorStop(0, '#0c1527');
    grad.addColorStop(1, '#05070d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    var starPositions = [
      [w * 0.15, h * 0.2], [w * 0.8, h * 0.15], [w * 0.3, h * 0.75],
      [w * 0.7, h * 0.8], [w * 0.5, h * 0.1], [w * 0.85, h * 0.6]
    ];
    starPositions.forEach(function (pt) {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 1.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Draw Vector Arrow Helper
  function drawVector(x, y, vx, vy, color, label) {
    if (!showVectors) return;
    var mag = Math.sqrt(vx * vx + vy * vy);
    if (mag < 0.001) return;

    var scale = 4.5;
    var maxLen = 85;
    var len = Math.min(mag * scale, maxLen);
    var ux = (vx / mag) * len;
    var uy = -(vy / mag) * len; // canvas y is inverted

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ux, y + uy);
    ctx.stroke();

    // Arrowhead
    var angle = Math.atan2(uy, ux);
    var headLen = 9;
    ctx.beginPath();
    ctx.moveTo(x + ux, y + uy);
    ctx.lineTo(x + ux - headLen * Math.cos(angle - Math.PI / 7), y + uy - headLen * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(x + ux - headLen * Math.cos(angle + Math.PI / 7), y + uy - headLen * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();

    // Label
    if (label) {
      ctx.font = 'bold 12px Cairo, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(label, x + ux + 6, y + uy - 4);
    }
    ctx.restore();
  }

  // 1. Vertical Falling Drawer
  function drawFallingPhenomenon(w, h) {
    var groundY = h - 60;
    var tubeX = w * 0.45;
    var tubeW = 90;
    var maxH = params.fallHeight;
    var pxPerM = (groundY - 60) / maxH;

    // Tube or fluid container if real
    if (params.fallType === 'real') {
      ctx.fillStyle = params.fluidType === 'water' ? 'rgba(56, 189, 248, 0.15)' :
                      params.fluidType === 'oil' ? 'rgba(234, 179, 8, 0.18)' :
                      'rgba(148, 163, 184, 0.08)';
      ctx.fillRect(tubeX - tubeW / 2, 40, tubeW, groundY - 40);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(tubeX - tubeW / 2, 40, tubeW, groundY - 40);

      // Fluid label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '12px Cairo';
      ctx.fillText('مائع: ' + (params.fluidType === 'water' ? 'ماء' : params.fluidType === 'oil' ? 'زيت' : 'هواء'), tubeX - tubeW / 2 + 10, 56);
    }

    // Ground platform
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, groundY, w - 80, 20);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, groundY);
    ctx.lineTo(w - 40, groundY);
    ctx.stroke();

    // Altitude ruler on the right
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    var rulerX = tubeX + tubeW / 2 + 30;
    ctx.beginPath();
    ctx.moveTo(rulerX, 60);
    ctx.lineTo(rulerX, groundY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px JetBrains Mono';
    for (var mStep = 0; mStep <= maxH; mStep += Math.ceil(maxH / 5)) {
      var markY = groundY - mStep * pxPerM;
      ctx.beginPath();
      ctx.moveTo(rulerX - 5, markY);
      ctx.lineTo(rulerX + 5, markY);
      ctx.stroke();
      ctx.fillText(mStep + 'm', rulerX + 10, markY + 4);
    }

    // Moving Sphere
    var sphereY = groundY - body.y * pxPerM;
    var radius = 18;

    // Glowing shadow
    var grad = ctx.createRadialGradient(tubeX, sphereY, radius * 0.2, tubeX, sphereY, radius);
    grad.addColorStop(0, '#67e8f9');
    grad.addColorStop(0.7, '#0284c7');
    grad.addColorStop(1, '#0369a1');

    ctx.beginPath();
    ctx.arc(tubeX, sphereY, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center of gravity dot
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(tubeX, sphereY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw active forces
    if (body.forces.P) {
      drawVector(tubeX, sphereY, 0, body.forces.P.y / params.mass, '#f43f5e', 'P');
    }
    if (body.forces.pi) {
      drawVector(tubeX, sphereY, 0, body.forces.pi.y / params.mass, '#38bdf8', 'Π');
    }
    if (body.forces.f) {
      drawVector(tubeX, sphereY, 0, body.forces.f.y / params.mass, '#f59e0b', 'f');
    }
    // Velocity vector
    if (Math.abs(body.vy) > 0.01) {
      drawVector(tubeX + 30, sphereY, 0, body.vy, '#10b981', 'v');
    }
  }

  // 2. Projectile Drawer
  function drawProjectilePhenomenon(w, h) {
    var groundY = h - 50;
    var startX = 70;
    var scaleM = Math.min((w - 120) / 45, (groundY - 80) / 20);

    // Ground line
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(30, groundY, w - 60, 25);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, groundY);
    ctx.lineTo(w - 30, groundY);
    ctx.stroke();

    // Launch tower / initial height
    if (params.projH0 > 0) {
      var towerH = params.projH0 * scaleM;
      ctx.fillStyle = '#334155';
      ctx.fillRect(startX - 15, groundY - towerH, 30, towerH);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(startX - 15, groundY - towerH, 30, towerH);
    }

    // Trajectory curve
    if (showTrajectory && trajectoryPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      trajectoryPoints.forEach(function (pt, idx) {
        var cx = startX + pt.x * scaleM;
        var cy = groundY - pt.y * scaleM;
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Ball Position
    var curX = startX + body.x * scaleM;
    var curY = groundY - body.y * scaleM;
    var rad = 14;

    var grad = ctx.createRadialGradient(curX, curY, rad * 0.2, curX, curY, rad);
    grad.addColorStop(0, '#fde047');
    grad.addColorStop(1, '#ea580c');

    ctx.beginPath();
    ctx.arc(curX, curY, rad, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Forces
    if (body.forces.P) {
      drawVector(curX, curY, 0, body.forces.P.y / params.mass, '#f43f5e', 'P');
    }
    if (body.forces.f) {
      drawVector(curX, curY, body.forces.f.x / params.mass, body.forces.f.y / params.mass, '#f59e0b', 'f');
    }
    // Velocity vectors: components vx, vy and combined v
    drawVector(curX, curY, body.vx, body.vy, '#10b981', 'v');
  }

  // 3. Satellites Drawer
  function drawSatellitesPhenomenon(w, h) {
    var cx = w / 2;
    var cy = h / 2;

    // Central Body (Earth or Sun)
    var earthR = 48;
    var earthGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, earthR);
    if (params.bodyCentral === 'sun') {
      earthGrad.addColorStop(0, '#fef08a');
      earthGrad.addColorStop(0.7, '#f59e0b');
      earthGrad.addColorStop(1, '#b45309');
    } else {
      earthGrad.addColorStop(0, '#93c5fd');
      earthGrad.addColorStop(0.6, '#2563eb');
      earthGrad.addColorStop(1, '#1e3a8a');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Central label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Cairo';
    ctx.textAlign = 'center';
    ctx.fillText(params.bodyCentral === 'sun' ? 'الشمس (M_s)' : 'الأرض (M_T)', cx, cy + 5);

    // Orbit trail
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    var orbRadius = Math.sqrt(body.x * body.x + body.y * body.y);
    ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Satellite position
    var satX = cx + body.x;
    var satY = cy + body.y;

    // Satellite body (solar panels)
    ctx.save();
    ctx.translate(satX, satY);
    var satAngle = Math.atan2(body.vy, body.vx);
    ctx.rotate(satAngle);

    // Panels
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-16, -6, 32, 12);
    // Core
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();

    // Frenet Frame vectors (t: tangent, n: normal)
    var dist = Math.sqrt(body.x * body.x + body.y * body.y);
    var nx = -body.x / dist;
    var ny = -body.y / dist;
    var tx = -ny;
    var ty = nx;

    // Normal acceleration an & Tangential acceleration at
    drawVector(satX, satY, nx * 20, -ny * 20, '#a855f7', 'a_n (ناظمي)');
    drawVector(satX, satY, tx * 20, -ty * 20, '#10b981', 'v (مماسي)');
  }

  // 4. Inclined Plane Drawer
  function drawPlanePhenomenon(w, h) {
    var theta = (params.planeAngle * Math.PI) / 180;
    var startX = 80;
    var groundY = h - 60;
    var planeLenPx = Math.min(w - 180, 500);

    var endX = startX + planeLenPx * Math.cos(theta);
    var endY = groundY - planeLenPx * Math.sin(theta);

    // Incline wedge
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.beginPath();
    ctx.moveTo(startX, groundY);
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX, groundY);
    ctx.closePath();
    ctx.fill();

    // Incline track line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, groundY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Angle arc
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(startX, groundY, 45, -theta, 0, false);
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 13px JetBrains Mono';
    ctx.fillText('α = ' + params.planeAngle + '°', startX + 55, groundY - 10);

    // Box position on incline
    var progressRatio = Math.min(1, Math.max(0, body.x / params.planeLength));
    var boxTrackX = startX + progressRatio * planeLenPx * Math.cos(theta);
    var boxTrackY = groundY - progressRatio * planeLenPx * Math.sin(theta);

    var boxW = 44;
    var boxH = 26;

    ctx.save();
    ctx.translate(boxTrackX, boxTrackY);
    ctx.rotate(-theta);

    // Draw box centered on track
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(-boxW / 2, -boxH, boxW, boxH);
    ctx.strokeStyle = '#e0e7ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-boxW / 2, -boxH, boxW, boxH);

    // Center of mass dot
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -boxH / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Draw vectors originating from center of mass
    var comX = boxTrackX + (boxH / 2) * Math.sin(theta);
    var comY = boxTrackY - (boxH / 2) * Math.cos(theta);

    if (body.forces.P) drawVector(comX, comY, 0, -params.mass * params.g, '#f43f5e', 'P');
    if (body.forces.R) drawVector(comX, comY, body.forces.R.x, body.forces.R.y, '#60a5fa', 'R');
    if (body.forces.f) drawVector(comX, comY, body.forces.f.x, body.forces.f.y, '#f59e0b', 'f');
    if (body.forces.F && params.pullForce > 0) drawVector(comX, comY, body.forces.F.x, body.forces.F.y, '#10b981', 'F');
  }

  // ================= Real-time Charts =================
  function drawCharts() {
    var vW = chartV.clientWidth;
    var vH = chartV.clientHeight;
    var eW = chartE.clientWidth;
    var eH = chartE.clientHeight;

    ctxV.clearRect(0, 0, vW, vH);
    ctxE.clearRect(0, 0, eW, eH);

    if (telemetryData.length < 2) {
      drawEmptyChartGrid(ctxV, vW, vH, 'السرعة v (m/s)');
      drawEmptyChartGrid(ctxE, eW, eH, 'الطاقات (Joules)');
      return;
    }

    // Chart 1: Velocity v(t)
    drawSingleSeriesChart(ctxV, vW, vH, telemetryData, 'v', '#10b981', 'السرعة v(t)');

    // Chart 2: Energies Ec, Epp, Em
    drawEnergyChart(ctxE, eW, eH, telemetryData);
  }

  function drawEmptyChartGrid(c, w, h, label) {
    c.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    c.lineWidth = 1;
    for (var x = 0; x < w; x += 40) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
    }
    for (var y = 0; y < h; y += 30) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }
    c.fillStyle = 'rgba(255, 255, 255, 0.3)';
    c.font = '11px Cairo';
    c.fillText(label, 10, 18);
  }

  function drawSingleSeriesChart(c, w, h, data, key, color, label) {
    c.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    c.lineWidth = 1;
    for (var y = 20; y < h; y += 30) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }

    var maxVal = 1;
    data.forEach(function (d) { if (d[key] > maxVal) maxVal = d[key]; });
    maxVal *= 1.15;

    c.strokeStyle = color;
    c.lineWidth = 2.5;
    c.beginPath();
    data.forEach(function (d, i) {
      var px = (i / (data.length - 1)) * (w - 20) + 10;
      var py = h - 20 - (d[key] / maxVal) * (h - 40);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    });
    c.stroke();

    // Axis & Labels
    c.fillStyle = color;
    c.font = 'bold 11px JetBrains Mono';
    var latest = data[data.length - 1][key].toFixed(2);
    c.fillText(label + ': ' + latest, 10, 18);
  }

  function drawEnergyChart(c, w, h, data) {
    var maxVal = 1;
    data.forEach(function (d) {
      if (d.Em > maxVal) maxVal = d.Em;
    });
    maxVal *= 1.2;

    function plotSeries(key, color) {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      data.forEach(function (d, i) {
        var px = (i / (data.length - 1)) * (w - 20) + 10;
        var py = h - 20 - (d[key] / maxVal) * (h - 40);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      c.stroke();
    }

    plotSeries('Ec', '#10b981');  // Kinetic green
    plotSeries('Epp', '#38bdf8'); // Potential blue
    plotSeries('Em', '#f43f5e');  // Total red

    // Legend
    c.font = 'bold 10px Cairo';
    c.fillStyle = '#10b981'; c.fillText('Ec (حركية)', 10, 15);
    c.fillStyle = '#38bdf8'; c.fillText('Epp (كامنة)', 85, 15);
    c.fillStyle = '#f43f5e'; c.fillText('Em (ميكانيكية)', 160, 15);
  }

  // ================= Updating Telemetry UI & Formulas =================
  function updateTelemetryUI() {
    var curV = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
    if (currentPhenomenon === 'plane') curV = Math.abs(body.vx);
    var curA = Math.sqrt(body.ax * body.ax + body.ay * body.ay);

    var elT = document.getElementById('tele-time');
    var elV = document.getElementById('tele-v');
    var elA = document.getElementById('tele-a');
    var elPos = document.getElementById('tele-pos');

    if (elT) elT.textContent = simTime.toFixed(2) + ' s';
    if (elV) elV.textContent = curV.toFixed(2) + ' m/s';
    if (elA) elA.textContent = curA.toFixed(2) + ' m/s²';
    if (elPos) {
      if (currentPhenomenon === 'projectile') {
        elPos.textContent = '(' + body.x.toFixed(1) + ', ' + body.y.toFixed(1) + ') m';
      } else if (currentPhenomenon === 'falling') {
        elPos.textContent = body.y.toFixed(2) + ' m';
      } else if (currentPhenomenon === 'plane') {
        elPos.textContent = body.x.toFixed(2) + ' m';
      } else {
        elPos.textContent = Math.sqrt(body.x * body.x + body.y * body.y).toFixed(0) + ' km';
      }
    }
  }

  function updateFormulasAndMetrics() {
    var formulaBox = document.getElementById('formula-details');
    var metric1Label = document.getElementById('metric-1-label');
    var metric1Val = document.getElementById('metric-1-val');
    var metric2Label = document.getElementById('metric-2-label');
    var metric2Val = document.getElementById('metric-2-val');

    if (currentPhenomenon === 'falling') {
      var vL = 0;
      var tau = params.mass / params.kDrag;
      var archTerm = params.archimedesOn ? (1 - params.fluidDensity / params.solidDensity) : 1;

      if (params.dragLaw === 'v') {
        vL = (params.mass * params.g / params.kDrag) * archTerm;
      } else {
        vL = Math.sqrt((params.mass * params.g / params.kDrag) * archTerm);
      }

      formulaBox.innerHTML = 
        '<strong>المعادلة التفاضلية لتطور السرعة:</strong>' +
        '$$\\frac{dv}{dt} + \\frac{k}{m} v^n = g \\left(1 - \\frac{\\rho_f}{\\rho_s}\\right)$$' +
        '<div>عند النظام الدائم (t → ∞): التسارع معدوم $\\frac{dv}{dt} = 0$ وتثبت السرعة عند السرعة الحدية $v_L$.</div>';

      metric1Label.textContent = 'السرعة الحدية النظرية vL';
      metric1Val.textContent = Math.max(0, vL).toFixed(2) + ' m/s';

      metric2Label.textContent = 'ثابت الزمن المميز τ';
      metric2Val.textContent = tau.toFixed(2) + ' s';

    } else if (currentPhenomenon === 'projectile') {
      var rad = (params.angleDeg * Math.PI) / 180;
      var v0 = params.v0;
      var g = params.g;
      var h0 = params.projH0;

      var ts = (v0 * Math.sin(rad)) / g;
      var zs = h0 + (v0 * v0 * Math.sin(rad) * Math.sin(rad)) / (2 * g);
      var rangeP = (v0 * Math.cos(rad) / g) * (v0 * Math.sin(rad) + Math.sqrt(v0 * v0 * Math.sin(rad) * Math.sin(rad) + 2 * g * h0));

      formulaBox.innerHTML =
        '<strong>معادلة المسار في حقل الجاذبية:</strong>' +
        '$$z(x) = -\\frac{g}{2 v_0^2 \\cos^2\\alpha} x^2 + (\\tan\\alpha) x + h_0$$' +
        '<div>الحركة على $Ox$ مستقيمة منتظمة ($a_x=0$)، وعلى $Oz$ مستقيمة متغيرة بانتظام ($a_z=-g$).</div>';

      metric1Label.textContent = 'أقصى ارتفاع (الذروة Zs)';
      metric1Val.textContent = zs.toFixed(2) + ' m';

      metric2Label.textContent = 'المدى الأفقي الأقصى (P)';
      metric2Val.textContent = rangeP.toFixed(2) + ' m';

    } else if (currentPhenomenon === 'satellites') {
      formulaBox.innerHTML =
        '<strong>القانون الثاني لنيوتن ومعلم فريني:</strong>' +
        '$$\\sum \\vec{F}_{ext} = m \\vec{a} \\implies G\\frac{M \\cdot m}{r^2} \\vec{n} = m (a_T \\vec{t} + a_N \\vec{n})$$' +
        '<div>بما أن التسارع ممركزي ناظمي ($a_T = 0$) فإن الحركة دائرية منتظمة بسرعة $v = \\sqrt{\\frac{GM}{r}}$.</div>';

      metric1Label.textContent = 'قانون كبلر الثالث';
      metric1Val.textContent = 'T² / r³ = K';

      metric2Label.textContent = 'شرط الجيومستقر';
      metric2Val.textContent = 'h ≈ 36,000 km';

    } else if (currentPhenomenon === 'plane') {
      var theta = (params.planeAngle * Math.PI) / 180;
      var sinT = Math.sin(theta);
      var cosT = Math.cos(theta);
      var aTheo = (params.pullForce - params.mass * params.g * sinT - params.planeFrictionMu * params.mass * params.g * cosT) / params.mass;

      formulaBox.innerHTML =
        '<strong>إسقاط القوى على محور الحركة (x\'x):</strong>' +
        '$$F - P\\sin\\alpha - f = m \\cdot a \\implies a = \\frac{F}{m} - g\\sin\\alpha - \\frac{f}{m}$$' +
        '<div>وعلى المحور العمودي (y\'y): $R = P\\cos\\alpha = m g \\cos\\alpha$.</div>';

      metric1Label.textContent = 'التسارع النظري (a)';
      metric1Val.textContent = aTheo.toFixed(2) + ' m/s²';

      metric2Label.textContent = 'رد الفعل الناظمي (R)';
      metric2Val.textContent = (params.mass * params.g * cosT).toFixed(2) + ' N';
    }

    // Trigger KaTeX render
    if (window.katex && window.renderMathInElement) {
      window.renderMathInElement(formulaBox, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ]
      });
    }
  }

  // ================= UI Event Binding =================
  function setupUI() {
    // Phenomenon Tabs
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentPhenomenon = btn.dataset.phenomenon;

        // Toggle specific parameter control sections
        document.querySelectorAll('.phenomenon-params').forEach(function (el) {
          el.classList.add('hidden');
        });
        var targetParams = document.getElementById('params-' + currentPhenomenon);
        if (targetParams) targetParams.classList.remove('hidden');

        resetSimulation();
      });
    });

    // Play/Pause Button
    var btnPlay = document.getElementById('btn-play');
    if (btnPlay) {
      btnPlay.addEventListener('click', function () {
        isRunning = !isRunning;
        if (isRunning) {
          btnPlay.innerHTML = '<span>⏸️</span> إيقاف مؤقت';
          btnPlay.classList.add('paused');
          lastTimestamp = null;
        } else {
          btnPlay.innerHTML = '<span>▶️</span> استئناف';
          btnPlay.classList.remove('paused');
        }
      });
    }

    // Reset Button
    var btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        resetSimulation();
      });
    }

    // Step Button
    var btnStep = document.getElementById('btn-step');
    if (btnStep) {
      btnStep.addEventListener('click', function () {
        isRunning = false;
        if (btnPlay) { btnPlay.innerHTML = '<span>▶️</span> استئناف'; btnPlay.classList.remove('paused'); }
        physicsStep(0.02);
        updateTelemetryUI();
        drawScene();
        drawCharts();
      });
    }

    // Slow motion toggle
    var slowMoCheck = document.getElementById('chk-slow-motion');
    if (slowMoCheck) {
      slowMoCheck.addEventListener('change', function (e) {
        slowMotion = e.target.checked;
      });
    }

    // Show vectors toggle
    var vectorsCheck = document.getElementById('chk-show-vectors');
    if (vectorsCheck) {
      vectorsCheck.addEventListener('change', function (e) {
        showVectors = e.target.checked;
        drawScene();
      });
    }

    // Show trajectory toggle
    var trajCheck = document.getElementById('chk-show-trajectory');
    if (trajCheck) {
      trajCheck.addEventListener('change', function (e) {
        showTrajectory = e.target.checked;
        drawScene();
      });
    }

    // Clear trajectory button
    var clearTrajBtn = document.getElementById('btn-clear-traj');
    if (clearTrajBtn) {
      clearTrajBtn.addEventListener('click', function () {
        trajectoryPoints = [];
        drawScene();
      });
    }

    // Parameter Sliders & Inputs Binding Helper
    function bindSlider(id, targetKey, displayId, unit, isFloat) {
      var slider = document.getElementById(id);
      var disp = document.getElementById(displayId);
      if (slider && disp) {
        slider.addEventListener('input', function (e) {
          var val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
          params[targetKey] = val;
          disp.textContent = val + ' ' + (unit || '');
          updateFormulasAndMetrics();
        });
      }
    }

    bindSlider('range-mass', 'mass', 'val-mass', 'kg', true);
    bindSlider('range-g', 'g', 'val-g', 'm/s²', true);
    bindSlider('range-fall-height', 'fallHeight', 'val-fall-height', 'm', false);
    bindSlider('range-k-drag', 'kDrag', 'val-k-drag', '', true);
    bindSlider('range-v0', 'v0', 'val-v0', 'm/s', false);
    bindSlider('range-angle', 'angleDeg', 'val-angle', '°', false);
    bindSlider('range-h0', 'projH0', 'val-h0', 'm', false);
    bindSlider('range-plane-angle', 'planeAngle', 'val-plane-angle', '°', false);
    bindSlider('range-pull-force', 'pullForce', 'val-pull-force', 'N', true);
    bindSlider('range-friction-mu', 'planeFrictionMu', 'val-friction-mu', '', true);

    // Dropdown selects
    var selectFallType = document.getElementById('select-fall-type');
    if (selectFallType) {
      selectFallType.addEventListener('change', function (e) {
        params.fallType = e.target.value;
        updateFormulasAndMetrics();
      });
    }

    var selectFluid = document.getElementById('select-fluid');
    if (selectFluid) {
      selectFluid.addEventListener('change', function (e) {
        params.fluidType = e.target.value;
        if (params.fluidType === 'water') params.fluidDensity = 1000;
        else if (params.fluidType === 'oil') params.fluidDensity = 850;
        else params.fluidDensity = 1.29;
        updateFormulasAndMetrics();
      });
    }

    var selectDragLaw = document.getElementById('select-drag-law');
    if (selectDragLaw) {
      selectDragLaw.addEventListener('change', function (e) {
        params.dragLaw = e.target.value;
        updateFormulasAndMetrics();
      });
    }

    var chkArchimedes = document.getElementById('chk-archimedes');
    if (chkArchimedes) {
      chkArchimedes.addEventListener('change', function (e) {
        params.archimedesOn = e.target.checked;
        updateFormulasAndMetrics();
      });
    }

    var chkProjAir = document.getElementById('chk-proj-air');
    if (chkProjAir) {
      chkProjAir.addEventListener('change', function (e) {
        params.projAirRes = e.target.checked;
        updateFormulasAndMetrics();
      });
    }

    var selectBodyCentral = document.getElementById('select-central-body');
    if (selectBodyCentral) {
      selectBodyCentral.addEventListener('change', function (e) {
        params.bodyCentral = e.target.value;
        resetSimulation();
      });
    }
  }

  // ================= Boot =================
  window.addEventListener('DOMContentLoaded', function () {
    setupCanvases();
    setupUI();
    resetSimulation();
    requestAnimationFrame(loop);
  });

})();
