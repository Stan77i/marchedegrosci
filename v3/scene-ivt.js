/* ═════════ Accueil — la roue devient une scène (ORDRE-DE-MISSION § V, VII, X, XI, XIV, XVI) ═════════
   Une seule scène, DOM + WebGL :
   · profondeur : brume lointaine et brume proche qui dérivent à deux vitesses, brume au sol ;
   · lumière : un faisceau part du nom actif sur l'anneau et tombe sur le sac (la lumière isole le produit choisi) ;
   · poussière : visible seulement là où il y a de la lumière (faisceau, halo du sac, lanterne du curseur) ;
   · curseur = force : il éclaire la brume, écarte la poussière, rapproche les libellés voisins, déplace les plans
     selon leur profondeur (sac lourd, anneau moyen, sacs lointains presque immobiles) ;
   · états : IDLE (la scène respire) → APPROACH (curseur près de la roue : la lumière s'intensifie)
     → FOCUS (nouveau produit : le faisceau glisse, le sac sort du flou (l'onde lumineuse a été retirée le 9 oct.)) → REST.
   Aucune donnée inventée : la scène n'affiche ni offre, ni demande, ni connexion. Elle met en scène le produit choisi.
   Sans WebGL : la profondeur DOM (plans, libellés) reste. prefers-reduced-motion : image fixe, aucun mouvement. */
(function () {
  'use strict';
  const V3 = window.MDGV3 = window.MDGV3 || {};

  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = `precision mediump float;
uniform vec2 uRes;uniform float uT,uS;
uniform vec2 uMouse;uniform float uMouseOn;
uniform vec2 uFocus;uniform float uFocusR;
uniform vec2 uLight;uniform float uNear,uPulse;
uniform vec3 uAcc,uGlow;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+17.;a*=.5;}return v;}
void main(){
  vec2 px=gl_FragCoord.xy;float S=min(uRes.x,uRes.y);vec2 uv=px/S;
  float far=fbm(uv*1.8+vec2(uT*.010,uT*.004));
  float mid=fbm(uv*4.2-vec2(uT*.022,-uT*.008)+far*1.3);
  float fog=smoothstep(.38,.92,far*.62+mid*.5);
  float ground=smoothstep(.62,0.,px.y/uRes.y);
  fog*=.45+ground*.9;
  vec2 L=uLight,F=uFocus,dl=F-L;float len=max(length(dl),1.);vec2 ax=dl/len;
  vec2 d=px-L;float along=dot(d,ax),perp=abs(dot(d,vec2(-ax.y,ax.x)));
  float t=clamp(along/len,0.,1.5);
  float w=mix(.035*S,uFocusR*.95,t);
  float beam=smoothstep(w,w*.15,perp)*smoothstep(-.01*S,.06*S,along)*smoothstep(len*1.45,len*.55,along);
  float fd=length(px-F)/uFocusR;float halo=exp(-fd*fd*1.5);
  float src=exp(-pow(length(px-L)/(.05*S),2.));
  float md=length(px-uMouse)/(.30*S);float lan=exp(-md*md*2.)*uMouseOn;
  float pr=length(px-L)/(1.1*S);float wave=smoothstep(.035,0.,abs(pr-uPulse))*(1.-uPulse)*step(.002,uPulse);
  vec2 aw=px-uMouse;float al=length(aw);
  vec2 q0=px-aw/max(al,1.)*uMouseOn*(70.*uS)*exp(-al*al/(170.*170.*uS*uS));
  float dust=0.;
  for(int k=0;k<2;k++){
    float sc=(k==0?84.:44.)*uS,sp=(k==0?9.:17.)*uS;
    vec2 q=(q0+vec2(0.,-uT*sp))/sc;vec2 id=floor(q),f=fract(q);
    float r=h(id);vec2 c=.2+.6*vec2(h(id+3.1),h(id+7.7))+.12*vec2(sin(uT*.5+r*6.),cos(uT*.4+r*5.));
    float sz=(k==0?.022:.05)*(.6+r);
    dust+=smoothstep(sz,0.,length(f-c))*step(.5,r)*(k==0?.7:1.);
  }
  float lit=beam*1.3+halo*.55+lan*1.1+src*.8;
  vec3 warm=mix(uAcc,vec3(1.,.95,.86),.6);
  vec3 col=uGlow*fog*.30+uAcc*fog*(lan*.55+beam*.25);
  col+=warm*beam*(.09+.22*fog)*(.75+.45*uNear);
  col+=uAcc*halo*.16+warm*src*.35;
  col+=vec3(1.,.95,.85)*dust*clamp(lit,0.,1.)*.85;
  col+=warm*wave*.28;
  float a=clamp(max(max(col.r,col.g),col.b),0.,1.);
  gl_FragColor=vec4(col,a);
}`;

  // couleur CSS quelconque (oklch, color-mix…) → [r,g,b] 0..1
  const cnv2 = document.createElement('canvas'); cnv2.width = cnv2.height = 1; const c2 = cnv2.getContext('2d', { willReadFrequently: true });
  function rgbOf(el, varName, fb) {
    const probe = document.createElement('i'); probe.style.cssText = 'position:absolute;width:0;height:0;color:var(' + varName + ')'; el.appendChild(probe);
    const s = getComputedStyle(probe).color; probe.remove();
    try { c2.clearRect(0, 0, 1, 1); c2.fillStyle = fb; c2.fillStyle = s; c2.fillRect(0, 0, 1, 1); const d = c2.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255]; } catch (_) { return [.88, .48, .25]; }
  }

  V3.scene = function (root) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(hover: none)').matches;
    const orbit = root.querySelector('.hero__orbit'); if (!orbit) return () => {};
    const cv = document.createElement('canvas'); cv.className = 'ivh-scene'; cv.setAttribute('aria-hidden', 'true'); root.prepend(cv);

    // ——— WebGL (facultatif) ———
    let gl = null, prog = null, U = {};
    try {
      gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (gl) {
        const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
        prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
        gl.useProgram(prog);
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        ['uRes', 'uT', 'uS', 'uMouse', 'uMouseOn', 'uFocus', 'uFocusR', 'uLight', 'uNear', 'uPulse', 'uAcc', 'uGlow'].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });
      }
    } catch (e) { console.warn('scène accueil : WebGL indisponible', e); gl = null; }
    if (!gl) cv.remove(); else root.classList.add('has-scene');

    // ——— état ———
    const S = coarse ? .6 : .8;            // résolution interne (brume douce : pas besoin de plein DPR)
    const st = { mx: -1e4, my: -1e4, tmx: -1e4, tmy: -1e4, on: 0, ton: 0, near: 0, tnear: 0, pulse: 0, pulseT0: -1,
      until: 0, lx: 0, ly: 0, fx: 0, fy: 0, fr: 100, init: false, acc: [.88, .48, .25], tacc: [.88, .48, .25], glow: [.72, .36, .22], tglow: [.72, .36, .22] };
    const P = { s1x: 0, s1y: 0, s2x: 0, s2y: 0, s3x: 0, s3y: 0 };   // plans : sac (lourd), anneau (moyen), sacs lointains
    let W = 0, H = 0, vis = true, raf = 0, t0 = performance.now(), labels = [], lastLab = 0;

    const readColors = () => { st.tacc = rgbOf(root, '--hero-accent', '#E07A3F'); st.tglow = rgbOf(root, '--hero-glow', '#B85C38'); };
    readColors(); st.acc = st.tacc.slice(); st.glow = st.tglow.slice();

    function resize() {
      if (!gl) return; const r = cv.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width * S)); H = Math.max(1, Math.round(r.height * S));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; gl.viewport(0, 0, W, H); }
    }
    const cacheLabels = () => { labels = [...orbit.querySelectorAll('.hero__arc-label')].map(t => { const r = t.getBoundingClientRect(); return { t, x: r.left + r.width / 2, y: r.top + r.height / 2, v: -1 }; }); lastLab = performance.now(); };

    // ——— curseur : une force ———
    const onMove = e => {
      if (e.pointerType === 'touch' && !(e.buttons || e.type === 'pointerdown')) return;
      st.tmx = e.clientX; st.tmy = e.clientY; st.ton = 1;
      const r = orbit.getBoundingClientRect(), pad = r.width * .18;
      st.tnear = (e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad) ? 1 : 0;
      wake();
    };
    const onLeave = () => { st.ton = 0; st.tnear = 0; wake(); };
    const onFocus = () => { st.until = performance.now() + 900; setTimeout(readColors, 60); setTimeout(readColors, 420); setTimeout(cacheLabels, 80); wake(); };
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerdown', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointerup', e => { if (e.pointerType === 'touch') onLeave(); });
    root.addEventListener('ivh:focus', onFocus);
    const onR = () => { resize(); cacheLabels(); wake(); }; addEventListener('resize', onR);
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) wake(); }) : null; io && io.observe(root);
    const onVis = () => { if (!document.hidden) wake(); }; document.addEventListener('visibilitychange', onVis);

    const lerp = (a, b, k) => a + (b - a) * k;
    function frame(now) {
      raf = 0; if (!root.isConnected) return destroy();
      const t = reduced ? 8 : (now - t0) / 1000;
      // vitesses : la lumière réagit vite, le sac suit lourdement, le fond presque immobile (§ IX)
      st.mx = st.mx < -1e3 ? st.tmx : lerp(st.mx, st.tmx, .22); st.my = st.my < -1e3 ? st.tmy : lerp(st.my, st.tmy, .22);
      st.on = lerp(st.on, st.ton, .06); st.near = lerp(st.near, st.tnear, .05);
      for (let i = 0; i < 3; i++) { st.acc[i] = lerp(st.acc[i], st.tacc[i], .06); st.glow[i] = lerp(st.glow[i], st.tglow[i], .06); }
      if (st.pulseT0 > 0) { const k = (now - st.pulseT0) / 1500; st.pulse = k >= 1 ? 0 : 1 - Math.pow(1 - k, 3); if (k >= 1) st.pulseT0 = -1; }

      // plans DOM (profondeur), seulement avec une souris
      const or = orbit.getBoundingClientRect(), ocx = or.left + or.width / 2, ocy = or.top + or.height / 2;
      if (!coarse && !reduced) {
        const dx = st.ton ? (st.tmx - ocx) / Math.max(innerWidth, 1) : 0, dy = st.ton ? (st.tmy - ocy) / Math.max(innerHeight, 1) : 0;
        P.s1x = lerp(P.s1x, -dx * 26, .05); P.s1y = lerp(P.s1y, -dy * 18, .05);
        P.s2x = lerp(P.s2x, -dx * 10, .1); P.s2y = lerp(P.s2y, -dy * 8, .1);
        P.s3x = lerp(P.s3x, dx * 6, .03); P.s3y = lerp(P.s3y, dy * 5, .03);
        orbit.style.setProperty('--p1x', P.s1x.toFixed(2) + 'px'); orbit.style.setProperty('--p1y', P.s1y.toFixed(2) + 'px');
        orbit.style.setProperty('--p2x', P.s2x.toFixed(2) + 'px'); orbit.style.setProperty('--p2y', P.s2y.toFixed(2) + 'px');
        orbit.style.setProperty('--p3x', P.s3x.toFixed(2) + 'px'); orbit.style.setProperty('--p3y', P.s3y.toFixed(2) + 'px');
        // libellés : ceux que le curseur approche se rapprochent de la lumière
        if (now - lastLab > 600) cacheLabels();
        labels.forEach(L => { const d = Math.hypot(st.mx - L.x, st.my - L.y), v = st.on > .02 ? Math.exp(-(d / 110) * (d / 110)) * st.on : 0, q = Math.round(v * 50) / 50; if (q !== L.v) { L.v = q; L.t.style.setProperty('--near', q); } });
      }

      if (gl && vis && !document.hidden) {
        resize();
        const cr = cv.getBoundingClientRect(), X = x => (x - cr.left) * S, Y = y => (cr.bottom - y) * S;
        const act = orbit.querySelector('.hero__arc-label.is-active'), med = orbit.querySelector('.hero__media');
        let lx = ocx, ly = or.top + or.height * .12;
        if (act) { const r = act.getBoundingClientRect(); if (r.width) { lx = r.left + r.width / 2; ly = r.top + r.height / 2; } }
        let fx = ocx, fy = ocy, fr = or.width * .3;
        if (med) { const r = med.getBoundingClientRect(); fx = r.left + r.width / 2; fy = r.top + r.height * .42; fr = r.width * .42; }
        if (!st.init) { st.lx = lx; st.ly = ly; st.fx = fx; st.fy = fy; st.fr = fr; st.init = true; }
        st.lx = lerp(st.lx, lx, .14); st.ly = lerp(st.ly, ly, .14); st.fx = lerp(st.fx, fx, .1); st.fy = lerp(st.fy, fy, .1); st.fr = lerp(st.fr, fr, .1);
        gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uT, t); gl.uniform1f(U.uS, S);
        gl.uniform2f(U.uMouse, X(st.mx), Y(st.my)); gl.uniform1f(U.uMouseOn, st.on);
        gl.uniform2f(U.uFocus, X(st.fx), Y(st.fy)); gl.uniform1f(U.uFocusR, st.fr * S);
        gl.uniform2f(U.uLight, X(st.lx), Y(st.ly)); gl.uniform1f(U.uNear, st.near); gl.uniform1f(U.uPulse, st.pulse);
        gl.uniform3fv(U.uAcc, st.acc); gl.uniform3fv(U.uGlow, st.glow);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      // la scène respire en continu tant qu'elle est visible ; en mouvement réduit, on ne redessine que sur changement
      const settling = now < st.until || st.pulseT0 > 0;
      if (vis && !document.hidden && (!reduced || settling) && !raf) raf = requestAnimationFrame(frame);
    }
    function wake() { st.until = performance.now() + 1500; if (!raf) raf = requestAnimationFrame(frame); }
    let dead = false;
    function destroy() {
      if (dead) return; dead = true; cancelAnimationFrame(raf);
      removeEventListener('resize', onR); document.removeEventListener('visibilitychange', onVis); io && io.disconnect();
      root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerdown', onMove); root.removeEventListener('pointerleave', onLeave); root.removeEventListener('ivh:focus', onFocus);
      if (gl) { const ext = gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); }
      cv.remove(); root.classList.remove('has-scene');
    }
    resize(); cacheLabels(); wake();
    if (reduced) { setTimeout(wake, 450); }
    return destroy;
  };
})();
