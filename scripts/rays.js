// Background light river — a twisting ribbon of lime filaments painted down the
// whole page. It scrolls with the content, winding left and right, pinching to
// bright points where it turns edge-on, with light and dust flowing down it.
(function () {
  const canvas = document.querySelector(".rays");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", {
    alpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false, desynchronized: true, powerPreference: "high-performance",
  });
  if (!gl) { canvas.remove(); return; }

  const vert = `
    attribute vec2 a;
    void main() { gl_Position = vec4(a, 0.0, 1.0); }
  `;

  const frag = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_scroll;
    uniform float u_mobile;
    uniform float u_energy;  // 0..1, surges while you scroll
    uniform float u_end;     // page depth of the bottom of the page, in viewport heights

    const int N = 34;
    const vec3 BG     = vec3(0.039, 0.039, 0.047);
    const vec3 LIME   = vec3(0.784, 0.961, 0.286);
    const vec3 HOT    = vec3(0.960, 1.000, 0.780);
    const vec3 TEAL   = vec3(0.330, 0.720, 1.000);
    const vec3 VIOLET = vec3(0.486, 0.424, 1.000);

    float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    // how far the river has opened up into a wide fan at depth Y (0..1)
    float expansion(float Y, float t) {
      return pow(0.5 + 0.5 * sin(Y * 1.25 - 1.2 + 0.15 * sin(t * 0.1)), 2.5);
    }

    // the river's course down the page: x of its centre at page depth Y
    // (Y in viewport heights from the top of the page)
    float course(float Y, float aspect, float t) {
      float m = mix(0.27, 0.16, u_mobile);
      float x = 0.62 + m * sin(Y * 1.1 + 0.9) + 0.06 * sin(Y * 2.3 + 1.7 + t * 0.15)
              + 0.05 * sin(t * 0.22 + Y * 0.8);          // gentle floating sway
      // drift toward the middle where the river opens up, so the fan stays on screen
      x = mix(x, 0.52, 0.65 * expansion(Y, t));
      return aspect * x;
    }

    void main() {
      float aspect = u_res.x / u_res.y;
      vec2 p = gl_FragCoord.xy / u_res.y;          // y up, 0..1 vertically
      float t = u_time;
      // depth along the river; it scrolls a little slower than the page so it
      // floats behind the content instead of being painted on it
      const float PARALLAX = 0.8;
      float Y = u_scroll * PARALLAX + (1.0 - p.y);
      float Yend = (u_end - 1.0) * PARALLAX + 1.0;

      float xc = course(Y, aspect, t);
      float slope = (course(Y + 0.01, aspect, t) - xc) / 0.01;
      float norm = 1.0 / sqrt(1.0 + slope * slope);

      // a ribbon that twists as it travels: where it turns edge-on the strands
      // cross in a bright pinch, then fan out again
      float twist = cos(Y * 1.6 + 0.35);
      // now and then the river opens up into a wide fan, and it breathes slowly
      float expand = expansion(Y, t);
      float W = (0.15 + 0.05 * sin(Y * 0.7 + 2.0) + 0.55 * expand)
              * (1.0 + 0.12 * sin(t * 0.35 + Y))
              * mix(1.0, 0.55, u_mobile);
      // crisp and bright in the hero and again at the very bottom of the page;
      // in between it drifts in and out of focus
      float hero = max(1.0 - smoothstep(0.7, 1.5, Y), smoothstep(Yend - 1.7, Yend - 0.7, Y));
      float soft = (1.0 - hero) * (0.55 + 0.45 * sin(Y * 0.8 + 1.0));

      vec3 col = vec3(0.0);
      // most of the screen is nowhere near the river: skip the strands there.
      // strands reach at most ~1.85 W from the centre, glow ~25 strand-widths
      float reach = 25.0 * (0.0009 + 0.0022 * W) * (1.0 + 5.0 * soft);
      bool nearRiver = (abs(p.x - xc) - 1.85 * W) * norm < reach;
      if (nearRiver)
      for (int i = 0; i < N; i++) {
        float fi = float(i);
        float h = hash(fi + 1.0);
        float h2 = hash(fi + 31.0);
        float o = (fi / float(N - 1)) * 2.0 - 1.0 + (h2 - 0.5) * 0.10;

        float wave = 0.30 * sin(Y * (2.0 + 2.5 * h) - t * (0.25 + 0.25 * h) + h * 6.283)
                   + 0.08 * sin(Y * (8.0 + 6.0 * h) + t * (0.5 + 0.4 * h2) + h * 17.0);
        // every strand fans at its own rate and drifts on its own, so they
        // separate into distinct threads instead of one tight bundle
        float fanK = 0.65 + 0.7 * hash(fi + 57.0);
        float xi = xc + W * (o * twist * fanK + wave * (0.30 + 0.70 * abs(twist)) * 0.95);
        float d = abs(p.x - xi) * norm;

        float w = (0.0009 + 0.0022 * W * abs(twist)) * (1.0 + 5.0 * soft);
        float core = exp(-(d * d) / (w * w));
        float glow = exp(-(d * d) / (w * w * 70.0)) * 0.08;

        // light flowing down the river
        // fast, tight bursts of light racing down each strand
        float pulse = 0.40 + 0.85 * pow(0.5 + 0.5 * sin(Y * (7.0 + 7.0 * h) - t * (1.9 + 1.5 * h) + h * 40.0), 3.0);
        float gain = 0.30 + 0.70 * h2;
        vec3 c = mix(LIME, TEAL, step(0.80, h) * 0.85);
        col += c * (core * mix(0.5, 1.05, hero) + glow) * pulse * gain * (1.0 + 0.7 * u_energy);
      }

      // hot pinch where the ribbon turns edge-on
      float dx = (p.x - xc) * norm;
      float pinch = exp(-twist * twist * 60.0);
      col += HOT * pinch * exp(-abs(dx) / 0.02) * mix(0.35, 0.9, hero);
      col += LIME * pinch * exp(-abs(dx) / 0.12) * 0.12;

      // haze around the river
      float dc = dx / (W * abs(twist) + 0.07);
      float near = exp(-dc * dc * 0.35);
      col += LIME * exp(-dc * dc) * (0.035 + 0.04 * soft);
      col += VIOLET * exp(-dc * dc * 0.25) * 0.022 * (0.5 + 0.5 * sin(t * 0.2));

      // sparkles carried down the river — dense near it, sparse elsewhere
      vec2 pg = vec2(p.x, -Y);
      vec2 g = (pg + vec2(0.004, -0.02) * t) * 90.0;
      vec2 cell = floor(g);
      float rnd = hash2(cell);
      vec2 jit = 0.2 + 0.6 * vec2(hash2(cell + 7.1), hash2(cell + 3.3));
      float dd = length(fract(g) - jit);
      float tw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * (0.8 + rnd * 1.6) + rnd * 60.0), 4.0);
      float show = step(mix(0.985, 0.74, near), rnd);
      col += mix(LIME, vec3(1.0), 0.55) * show * smoothstep(0.16, 0.0, dd) * tw * (0.18 + 0.9 * near);

      // soft out-of-focus bokeh
      vec2 gb = (pg + vec2(-0.004, -0.008) * t) * 8.0;
      vec2 cb = floor(gb);
      float rb = hash2(cb + 19.0);
      vec2 jb = 0.3 + 0.4 * vec2(hash2(cb + 2.7), hash2(cb + 5.9));
      float db = length(fract(gb) - jb);
      float rad = 0.06 + 0.10 * hash2(cb + 9.4);
      col += mix(LIME, TEAL, step(0.7, rb)) * step(0.55, rb) * smoothstep(rad, rad * 0.45, db) * (0.025 + 0.11 * near);

      // faint dot grid, fixed to the page
      vec2 gd = fract(pg * 32.0) - 0.5;
      col += vec3(0.62, 0.66, 0.56) * smoothstep(0.075, 0.0, length(gd)) * (0.02 + 0.07 * near);

      col *= mix(mix(0.50, 0.38, u_mobile), 1.0, hero);
      col = 1.0 - exp(-col * 1.25);
      // tiny dither keeps the dark gradients from banding
      col += (hash2(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
      gl_FragColor = vec4(BG + col * (1.0 - BG), 1.0);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    canvas.remove();
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uScroll = gl.getUniformLocation(prog, "u_scroll");
  const uMobile = gl.getUniformLocation(prog, "u_mobile");
  const uEnd = gl.getUniformLocation(prog, "u_end");
  const uEnergy = gl.getUniformLocation(prog, "u_energy");

  const TIME_SCALE = 1.6;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0;
  // the river runs on its own clock so scrolling can speed it up
  let simTime = 0;
  let lastNow = performance.now();
  let lastY = scrollY;
  let energy = 0;            // 0 at rest, rises with scroll speed

  function size() {
    // render below device resolution — the light is soft, and it keeps the GPU cool
    const w = innerWidth, h = innerHeight;
    let q = Math.min(window.devicePixelRatio || 1, 2) * 0.6;
    q = Math.min(q, Math.sqrt(1200000 / (w * h)));
    canvas.width = Math.max(1, Math.round(w * q));
    canvas.height = Math.max(1, Math.round(h * q));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uMobile, w < 760 ? 1 : 0);
  }

  function draw(now) {
    const dt = Math.min(Math.max((now - lastNow) / 1000, 0), 0.05);
    lastNow = now;
    // scroll speed in viewport heights per second -> energy: it surges as you
    // scroll and settles back over a second or so when you stop
    const y = scrollY;
    const speed = dt > 0 ? Math.abs(y - lastY) / innerHeight / dt : 0;
    lastY = y;
    const want = Math.min(speed * 2.5, 6);
    energy += (want - energy) * (want > energy ? 0.35 : 0.05);
    simTime += dt * (TIME_SCALE + energy * 1.8);

    // read scroll every frame so the river stays locked to the page
    gl.uniform1f(uTime, reduce.matches ? 12.0 : simTime);
    gl.uniform1f(uEnergy, reduce.matches ? 0 : Math.min(energy / 6, 1));
    gl.uniform1f(uScroll, scrollY / innerHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // page height only changes on resize or when content loads
  function measure() { gl.uniform1f(uEnd, document.documentElement.scrollHeight / innerHeight); }
  if (window.ResizeObserver) new ResizeObserver(measure).observe(document.body);

  function loop(now) {
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function run() {
    cancelAnimationFrame(raf);
    if (reduce.matches) {
      draw(0);                      // still river, redrawn only when you scroll
    } else {
      raf = requestAnimationFrame(loop);
    }
  }

  addEventListener("scroll", () => {
    if (reduce.matches) draw(0);
  }, { passive: true });
  addEventListener("resize", () => { size(); measure(); if (reduce.matches) draw(0); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else run();
  });
  if (reduce.addEventListener) reduce.addEventListener("change", run);

  size();
  measure();
  run();
  canvas.classList.add("is-ready");
})();
