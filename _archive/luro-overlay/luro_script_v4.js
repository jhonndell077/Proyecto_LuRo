<!-- ===== LURO ASISTENTE INTELIGENTE v4 ===== -->
<script>
(function() {
  const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL = 'llama-3.3-70b-versatile';
  const GROQ_KEY   = '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';
  const WAKE_WORD  = 'hola luro';
  const UNKNOWN    = 'Comando no reconocido.';

  let historial  = [];
  let micActivo  = false;
  let recognition= null;
  let wakeRec    = null;
  let wakeActivo = false;
  const synth    = window.speechSynthesis;

  if (!localStorage.getItem('LURO_ASISTENTE_KEY')) localStorage.setItem('LURO_ASISTENTE_KEY', GROQ_KEY);
  const getKey = () => localStorage.getItem('LURO_ASISTENTE_KEY') || GROQ_KEY;

  /* ── Datos reales del sistema ──────────────────────────── */
  function contextoDB() {
    try {
      const db = JSON.parse(localStorage.getItem('LURO_CONTROL_DB') || 'null');
      if (!db) return '';
      const L = [];
      if (Array.isArray(db.ventas) && db.ventas.length) {
        const tv = db.ventas.reduce((s,v)=>s+(Number(v.total)||0),0);
        const tg = db.ventas.reduce((s,v)=>s+(Number(v.ganancia)||0),0);
        const hoyStr = new Date().toDateString();
        const vh = db.ventas.filter(v=>new Date(v.fecha).toDateString()===hoyStr);
        L.push('Ventas totales: '+db.ventas.length+', RD$'+tv.toFixed(2)+', ganancia RD$'+tg.toFixed(2)+'.');
        if(vh.length) L.push('Ventas hoy: '+vh.length+', total RD$'+vh.reduce((s,v)=>s+(Number(v.total)||0),0).toFixed(2)+'.');
        const freq = {};
        db.ventas.forEach(v=>{ const n=v.nombre||v.item||''; if(n) freq[n]=(freq[n]||0)+1; });
        const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]).join(', ');
        if(top) L.push('Platos mas vendidos: '+top+'.');
      }
      if (Array.isArray(db.almacen) && db.almacen.length) {
        const bajos = db.almacen.filter(p=>Number(p.disponible)<Number(p.ideal));
        L.push('Almacen: '+db.almacen.length+' productos. Bajos ('+bajos.length+'): '+bajos.slice(0,5).map(p=>p.nombre+' '+p.disponible+' '+p.unidad).join(', ')+'.');
      }
      if (Array.isArray(db.platos) && db.platos.length)
        L.push('Menu: '+db.platos.length+' platos: '+db.platos.slice(0,8).map(p=>p.nombre).join(', ')+'.');
      if (Array.isArray(db.distribuidores) && db.distribuidores.length)
        L.push('Distribuidores: '+db.distribuidores.length+': '+db.distribuidores.slice(0,5).map(d=>d.nombre).join(', ')+'.');
      if (Array.isArray(db.decomisos) && db.decomisos.length) {
        const tp = db.decomisos.reduce((s,d)=>s+(Number(d.perdida)||0),0);
        L.push('Decomisos: '+db.decomisos.length+', perdida RD$'+tp.toFixed(2)+'.');
      }
      if (Array.isArray(db.clientes) && db.clientes.length)
        L.push('Clientes: '+db.clientes.length+': '+db.clientes.slice(0,4).map(c=>c.nombre).join(', ')+'.');
      return L.length ? '\n\nESTADO DEL SISTEMA:\n'+L.join('\n') : '';
    } catch(e) { return ''; }
  }

  /* ── System prompt ────────────────────────────────────── */
  function buildPrompt() {
    const pagina = document.querySelector('.content-section.active')?.id || '?';
    return 'Eres Luro, asistente de LuRo Control (gestion de restaurantes). Espanol natural, directo, sin markdown ni asteriscos — tu respuesta se lee en voz alta.\n\n'
      + 'ACCIONES QUE PUEDES EJECUTAR — pon el tag al FINAL de tu respuesta:\n'
      + '- Navegar seccion interna: [NAV:id]  Ids validos: home, inventario, distribuidores, produccion-interna, disponibilidad, salida, ventas, comandas, clientes-puntos, asistencia, autorizaciones, historial-decomiso, decomiso, rnc-dgii, entradas-almacen, historial-produccion, agregar, produccion, configuracion\n'
      + '- Abrir modulo principal: [MODULO:NOMBRE:clave]  Ejemplos: [MODULO:ADMINISTRADOR:160623] o [MODULO:COCINA]\n\n'
      + 'REGLAS:\n'
      + '- Si el usuario quiere ir a alguna parte, SIEMPRE ejecuta la accion aunque ya este ahi.\n'
      + '- Si el usuario da una clave/contrasena en su mensaje, usala en el tag MODULO.\n'
      + '- Responde en max 2 oraciones + tag de accion si aplica.\n'
      + '- Pagina activa: ' + pagina + '.\n'
      + contextoDB();
  }

  /* ── TTS ──────────────────────────────────────────────── */
  function luroHablar(texto) {
    if (!synth) return;
    synth.cancel();
    const clean = texto
      .replace(/\[NAV:[^\]]*\]/g,'')
      .replace(/\[MODULO:[^\]]*\]/g,'')
      .replace(/[*_#`>]/g,'')
      .replace(/\n+/g,' ')
      .trim();
    if (!clean) return;
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = 'es-ES'; utt.rate = 1.05;
    const voces = synth.getVoices();
    const voz = voces.find(v=>v.lang.startsWith('es')&&v.name.toLowerCase().includes('google'))
              || voces.find(v=>v.lang.startsWith('es')) || null;
    if (voz) utt.voice = voz;
    synth.speak(utt);
  }

  /* ── Burbuja de chat ──────────────────────────────────── */
  function burbuja(role, texto) {
    const cont = document.getElementById('luro-assistant-messages');
    if (!cont) return null;
    const wrap = document.createElement('div');
    wrap.className = 'luro-assistant-msg ' + (role==='user' ? 'is-user' : 'is-assistant');
    const meta = document.createElement('span');
    meta.className = 'luro-assistant-msg-meta';
    meta.textContent = role==='user' ? 'Tu' : 'Luro';
    const bub = document.createElement('div');
    bub.className = 'luro-assistant-bubble';
    bub.textContent = texto.replace(/\[NAV:[^\]]*\]/g,'').replace(/\[MODULO:[^\]]*\]/g,'').trim();
    wrap.appendChild(meta); wrap.appendChild(bub);
    cont.appendChild(wrap); cont.scrollTop = cont.scrollHeight;
    if (typeof window.actualizarEstadoModuloComandos === 'function') window.actualizarEstadoModuloComandos(bub.textContent);
    return bub;
  }

  /* ── Ejecutar acciones ────────────────────────────────── */
  function ejecutar(resp) {
    const nav = resp.match(/\[NAV:([^\]]+)\]/);
    if (nav && typeof window.showPage === 'function') {
      setTimeout(() => window.showPage(nav[1].trim()), 350);
      return;
    }
    const mod = resp.match(/\[MODULO:([^:\]]+)(?::([^\]]*))?\]/);
    if (mod) {
      const nombre = mod[1].trim().toUpperCase();
      const clave  = (mod[2] || '').trim();
      const _prompt = window.prompt;
      window.prompt = () => clave || null;
      try {
        if (typeof window.seleccionarModulo === 'function') {
          window.seleccionarModulo(nombre);
        } else {
          // Fallback: buscar tarjeta clickeable
          document.querySelectorAll('[onclick*="seleccionarModulo"]').forEach(el => {
            if (el.textContent.toUpperCase().includes(nombre)) el.click();
          });
        }
      } finally {
        window.prompt = _prompt;
      }
    }
  }

  /* ── Groq AI ──────────────────────────────────────────── */
  async function groq(userMsg) {
    historial.push({ role: 'user', content: userMsg });
    if (historial.length > 20) historial = historial.slice(-20);
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: buildPrompt() }, ...historial],
        temperature: 0.75,
        max_tokens: 350
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const r = data.choices[0].message.content.trim();
    historial.push({ role: 'assistant', content: r });
    return r;
  }

  /* ── Motor principal ──────────────────────────────────── */
  window.addEventListener('load', function() {
    const _orig = window.enviarMensajeAsistente;

    window.enviarMensajeAsistente = async function() {
      const inp = document.getElementById('luro-assistant-input');
      if (!inp) return;
      const texto = inp.value.trim();
      if (!texto) return;

      await _orig();
      await new Promise(r => setTimeout(r, 120));

      const todos = document.querySelectorAll('#luro-assistant-messages .luro-assistant-msg:not(.is-user)');
      const ult   = todos[todos.length - 1];
      const bub   = ult && ult.querySelector('.luro-assistant-bubble');
      const txt   = bub ? bub.textContent.trim() : '';
      const desconocido = txt === UNKNOWN || txt === 'Escribe un comando.';
      const sistemaCumplio = ult && (
        ult.classList.contains('is-system') ||
        (ult.classList.contains('is-assistant') && !desconocido)
      );

      if (sistemaCumplio) { luroHablar(txt); return; }

      if (ult && desconocido) ult.remove();
      const ph = burbuja('assistant', 'Pensando...');
      try {
        const resp = await groq(texto);
        if (ph) ph.textContent = resp.replace(/\[NAV:[^\]]*\]/g,'').replace(/\[MODULO:[^\]]*\]/g,'').trim();
        ejecutar(resp);
        luroHablar(resp);
      } catch(e) {
        const m = 'No pude conectarme a la IA. Intenta de nuevo.';
        if (ph) ph.textContent = m; else burbuja('assistant', m);
      }
    };
  });

  /* ── Mic manual ───────────────────────────────────────── */
  window.luroVozToggle = function() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    if (micActivo) { detenerMic(); return; }
    iniciarMic();
  };

  function iniciarMic() {
    if (wakeActivo) { try { wakeRec.stop(); } catch(e){} wakeActivo = false; }
    micActivo = true;
    const btn = document.getElementById('luro-mic-btn-pub');
    if (btn) { btn.textContent = 'REC'; btn.style.background = '#e84118'; btn.style.fontSize = '11px'; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'es-ES'; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = e => {
      const t = e.results[0][0].transcript.trim();
      detenerMic();
      const inp = document.getElementById('luro-assistant-input');
      if (inp) { inp.value = t; window.enviarMensajeAsistente(); }
    };
    recognition.onerror = () => detenerMic();
    recognition.onend   = () => { if (micActivo) detenerMic(); };
    try { recognition.start(); } catch(e) {}
  }

  function detenerMic() {
    micActivo = false;
    const btn = document.getElementById('luro-mic-btn-pub');
    if (btn) { btn.textContent = String.fromCodePoint(0x1F399); btn.style.background = '#2d3436'; btn.style.fontSize = '16px'; }
    if (recognition) { try { recognition.stop(); } catch(e){} recognition = null; }
    setTimeout(iniciarWake, 600);
  }

  /* ── Wake word ────────────────────────────────────────── */
  // IMPORTANTE: NO se llama getUserMedia — SpeechRecognition reutiliza
  // el permiso de mic concedido por el usuario en la primera interaccion.
  // Esto elimina el dialogo repetitivo de permiso.
  function iniciarWake() {
    if (wakeActivo || micActivo) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    wakeActivo = true;
    wakeRec = new SR();
    wakeRec.lang = 'es-ES'; wakeRec.continuous = true; wakeRec.interimResults = true;
    wakeRec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim();
        if (t.includes(WAKE_WORD)) {
          if (typeof window.toggleLuroAssistant === 'function') window.toggleLuroAssistant(true);
          burbuja('assistant', 'Hola! En que te puedo ayudar?');
          luroHablar('Hola, en que te puedo ayudar?');
          setTimeout(iniciarMic, 1200);
          return;
        }
      }
    };
    wakeRec.onerror = () => { wakeActivo = false; };
    wakeRec.onend   = () => { wakeActivo = false; if (!micActivo) setTimeout(iniciarWake, 800); };
    try { wakeRec.start(); } catch(e) { wakeActivo = false; }
  }

  // Iniciar wake word SOLO cuando el usuario abre el panel por primera vez
  window.addEventListener('load', function() {
    const fab    = document.getElementById('luro-assistant-fab');
    const sbLink = document.getElementById('sidebar-assistant-launch');
    if (fab)    fab.addEventListener('click',    iniciarWake, { once: true });
    if (sbLink) sbLink.addEventListener('click', iniciarWake, { once: true });
    // Si el panel ya viene abierto desde el estado previo
    const panel = document.getElementById('luro-assistant-panel');
    if (panel && panel.classList.contains('is-open')) setTimeout(iniciarWake, 1000);
  });

})();
</script>
<!-- ===== FIN LURO ASISTENTE INTELIGENTE v4 ===== -->
