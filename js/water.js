/* Hero water: draws the villa photo with a live, rippling pool reflection below it (raw WebGL, no library).
   Touch or click to send ripples; phone tilt and mouse position steer the light path.
   Falls back to the plain <img> when WebGL is missing; renders one still frame under reduced motion. */
(function () {
  'use strict';

  var canvas = document.querySelector('.hero__water');
  if (!canvas) return;
  var hero = canvas.closest('.hero');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return;

  var VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes;',
    'uniform vec2 uTexSize;',
    'uniform vec2 uFocus;',
    'uniform float uTime;',
    'uniform float uWater;',
    'uniform vec2 uTilt;',
    'uniform vec4 uRip[8];',

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',

    // Photo drawn "object-fit: cover" into the area above the waterline
    'vec3 photo(vec2 p){',
    '  vec2 box = vec2(uRes.x, uRes.y * (1.0 - uWater));',
    '  float s = max(box.x / uTexSize.x, box.y / uTexSize.y);',
    '  vec2 sz = uTexSize * s;',
    '  vec2 uv = (clamp(p, 0.0, 1.0) * box - (box - sz) * uFocus) / sz;',
    '  return texture2D(uTex, clamp(uv, 0.002, 0.998)).rgb;',
    '}',

    'void main(){',
    '  vec2 st = gl_FragCoord.xy / uRes;',
    '  float aspect = uRes.x / uRes.y;',
    '  float y0 = uWater;',
    '  vec3 col;',
    '  if (st.y >= y0) {',
    '    col = photo(vec2(st.x, (st.y - y0) / (1.0 - y0)));',
    '  } else {',
    '    float d = (y0 - st.y) / y0;',
    '    vec2 off = vec2(0.0);',
    '    float n = noise(vec2(st.x * 6.0 + uTime * 0.15, st.y * 26.0 - uTime * 0.55));',
    '    off.x += (n - 0.5) * 0.02 * (0.25 + d);',
    '    off.y += sin(st.y * 140.0 * (1.0 - 0.45 * d) - uTime * 2.1 + n * 3.0) * 0.004 * (0.3 + d);',
    '    for (int i = 0; i < 8; i++) {',
    '      vec4 r = uRip[i];',
    '      if (r.w > 0.0) {',
    '        float age = uTime - r.z;',
    '        if (age > 0.0 && age < 4.5) {',
    '          vec2 dv = (st - r.xy) * vec2(aspect, 1.0);',
    '          float dist = length(dv);',
    '          float wave = sin(dist * 70.0 - age * 13.0) * exp(-age * 1.15) * exp(-dist * 4.5) * smoothstep(0.0, 0.1, age) * r.w;',
    '          off += normalize(dv + 1e-5) * wave * 0.035;',
    '        }',
    '      }',
    '    }',
    '    off.x += uTilt.x * 0.012;',
    '    float dy = (y0 - st.y) * 1.12;',
    '    vec3 refl = photo(vec2(st.x + off.x, (dy + off.y) / (1.0 - y0)));',
    '    vec3 deep = vec3(0.035, 0.105, 0.115);',
    '    vec3 tint = vec3(0.32, 0.64, 0.68);',
    '    col = mix(refl * tint * 1.2, deep, smoothstep(0.0, 1.0, d) * 0.78);',
    // light path: a column of glints that follows tilt / mouse
    '    float mx = 0.66 + uTilt.x * 0.12;',
    '    float width = 0.05 + d * 0.22;',
    '    float path = exp(-pow((st.x + off.x * 2.0 - mx) / width, 2.0));',
    '    float sp = noise(vec2(st.x * 95.0 + off.x * 220.0, st.y * 280.0 - uTime * 2.2));',
    '    sp = smoothstep(0.7, 0.96, sp);',
    '    col += vec3(1.0, 0.92, 0.76) * path * (0.08 + sp * 0.9) * (0.35 + 0.65 * (1.0 - d));',
    '    col += vec3(0.75, 0.95, 1.0) * smoothstep(0.012, 0.0, abs(st.y - y0 + off.y * 0.6)) * 0.22;',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn('[water]', gl.getShaderInfoLog(sh)); return null; }
    return sh;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[water]', gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ['uTex', 'uRes', 'uTexSize', 'uFocus', 'uTime', 'uWater', 'uTilt', 'uRip'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  var ripples = new Float32Array(8 * 4);
  var ripIndex = 0;
  var tilt = { x: 0, y: 0 };
  var tiltTarget = { x: 0, y: 0 };
  var start = performance.now();
  var now = function () { return (performance.now() - start) / 1000; };
  var waterFrac = function () { return window.innerWidth >= 960 ? 0.3 : 0.4; };
  var visible = true;
  var ready = false;

  function addRipple(clientX, clientY, strength) {
    var rect = canvas.getBoundingClientRect();
    var x = (clientX - rect.left) / rect.width;
    var y = 1 - (clientY - rect.top) / rect.height;
    if (y > waterFrac() + 0.04) return;
    ripples.set([x, y, now(), strength], ripIndex * 4);
    ripIndex = (ripIndex + 1) % 8;
    if (reduceMotion) draw();
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.5);
    var w = Math.round(canvas.clientWidth * dpr);
    var h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  var tex = gl.createTexture();
  var img = new Image();
  img.decoding = 'async';
  img.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U.uTex, 0);
    gl.uniform2f(U.uTexSize, img.naturalWidth, img.naturalHeight);
    gl.uniform2f(U.uFocus, 0.46, 0.5);
    ready = true;
    resize();
    draw();
    canvas.classList.add('is-ready');
    document.dispatchEvent(new CustomEvent('lvm:water-ready'));
    // A first ripple shows the surface is alive.
    if (!reduceMotion) {
      setTimeout(function () {
        var r = canvas.getBoundingClientRect();
        addRipple(r.left + r.width * 0.72, r.bottom - r.height * waterFrac() * 0.55, 1);
      }, 1800);
    }
    if (!reduceMotion) requestAnimationFrame(loop);
  };
  img.onerror = function () { document.dispatchEvent(new CustomEvent('lvm:water-ready')); };
  img.src = canvas.getAttribute('data-src');

  function draw() {
    if (!ready) return;
    resize();
    tilt.x += (tiltTarget.x - tilt.x) * 0.06;
    tilt.y += (tiltTarget.y - tilt.y) * 0.06;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, now());
    gl.uniform1f(U.uWater, waterFrac());
    gl.uniform2f(U.uTilt, tilt.x, tilt.y);
    gl.uniform4fv(U.uRip, ripples);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function loop() {
    if (visible && !document.hidden) draw();
    requestAnimationFrame(loop);
  }

  // Pause rendering when the hero scrolls out of view.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0 }).observe(hero);
  }
  window.addEventListener('resize', function () { if (reduceMotion) draw(); });

  // Touch / click ripples (ignore taps on buttons and links)
  var askedTilt = false;
  hero.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a, button')) return;
    addRipple(e.clientX, e.clientY, 1);
    if (!askedTilt && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      askedTilt = true;
      DeviceOrientationEvent.requestPermission().catch(function () {});
    }
  });

  // Mouse: steer the light and leave a soft wake
  var lastMove = 0;
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    tiltTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    tiltTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
    var t = performance.now();
    if (t - lastMove > 160) { lastMove = t; addRipple(e.clientX, e.clientY, 0.35); }
  });

  // Phone tilt
  window.addEventListener('deviceorientation', function (e) {
    if (e.gamma == null) return;
    tiltTarget.x = Math.max(-1, Math.min(1, e.gamma / 30));
    tiltTarget.y = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30));
  });
})();
