(() => {
  const ASISTENCIA_CLAVES_VISIBLES_MS = 5 * 60 * 1000;
  const ASISTENCIA_CICLO_DIAS = 12;
  const ASISTENCIA_CICLO_TIMER_MS = 60 * 1000;

  function getDbArray(key) {
    if (!db || typeof db !== 'object') return [];
    if (!Array.isArray(db[key])) db[key] = [];
    return db[key];
  }

  function getOwnerActivo() {
    if (typeof ownerDatosActivo === 'function') return String(ownerDatosActivo() || '').trim().toLowerCase();
    return String((sesionUser && (sesionUser.owner || sesionUser.user)) || '').trim().toLowerCase();
  }

  function getModuloActivo() {
    return String(typeof moduloActual === 'string' ? moduloActual : '').trim().toUpperCase();
  }

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function pad2(value) {
    return String(Math.max(0, toNumber(value, 0))).padStart(2, '0');
  }

  function safeDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
    if (typeof parseFechaRegistro === 'function') {
      const parsed = parseFechaRegistro(value);
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  function ymdLocal(value) {
    const d = safeDate(value);
    if (!d) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function normalizarYmd(value) {
    const txt = String(value || '').trim();
    if (!txt) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
    const parsed = safeDate(txt);
    if (parsed) return ymdLocal(parsed);
    return '';
  }

  function diasEntreYmd(inicioYmd, finYmd) {
    const ini = safeDate(`${String(inicioYmd || '').trim()}T12:00:00`);
    const fin = safeDate(`${String(finYmd || '').trim()}T12:00:00`);
    if (!ini || !fin) return NaN;
    return Math.round((fin.getTime() - ini.getTime()) / (24 * 60 * 60 * 1000));
  }

  function ymdAddDays(ymd, days) {
    const base = safeDate(`${String(ymd || '').trim()}T12:00:00`);
    if (!base) return '';
    const copy = new Date(base.getTime());
    copy.setDate(copy.getDate() + toNumber(days, 0));
    return ymdLocal(copy);
  }

  function ymdToDisplay(ymd) {
    const txt = String(ymd || '').trim();
    if (!txt) return '---';
    const p = txt.split('-');
    if (p.length !== 3) return txt;
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  function minutosTotalesDesdeRegistro(record) {
    const ini = timeMs(record && record.entradaAt);
    const fin = timeMs(record && record.salidaAt);
    if (!(ini > 0 && fin > 0 && fin >= ini)) return 0;
    return Math.round((fin - ini) / 60000);
  }

  function minutosAHorasTexto(minsValue) {
    const mins = Math.max(0, Math.round(toNumber(minsValue, 0)));
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    return `${hh}:${String(mm).padStart(2, '0')}`;
  }

  function fechaTexto(value) {
    const d = safeDate(value);
    if (!d) return '---';
    return d.toLocaleDateString();
  }

  function horaTexto(value, withSeconds = true) {
    const d = safeDate(value);
    if (!d) return '---';
    const base = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return withSeconds ? `${base}:${pad2(d.getSeconds())}` : base;
  }

  function horaMinutoRedondeada(value) {
    const d = safeDate(value);
    if (!d) return '';
    const copy = new Date(d.getTime() + 30000);
    return `${pad2(copy.getHours())}:${pad2(copy.getMinutes())}`;
  }

  function hora24DesdeTexto(value = '') {
    const txt = String(value || '').trim();
    if (!txt) return '';
    const d = safeDate(txt);
    if (d) return horaTexto(d, true);

    const m12 = txt.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
    if (m12) {
      let hh = toNumber(m12[1], 0);
      const mm = pad2(m12[2]);
      const ss = pad2(m12[3] || '00');
      const ap = String(m12[4] || '').toUpperCase();
      if (ap === 'PM' && hh < 12) hh += 12;
      if (ap === 'AM' && hh === 12) hh = 0;
      return `${pad2(hh)}:${mm}:${ss}`;
    }

    const m24 = txt.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m24) {
      return `${pad2(m24[1])}:${pad2(m24[2])}:${pad2(m24[3] || '00')}`;
    }
    return txt;
  }

  function hora24SoloMinutos(value = '') {
    const txt = String(value || '').trim();
    if (!txt) return '';

    const rounded = horaMinutoRedondeada(txt);
    if (rounded) return rounded;

    const m12 = txt.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
    if (m12) {
      let hh = toNumber(m12[1], 0);
      let mm = toNumber(m12[2], 0);
      const ss = toNumber(m12[3] || '00', 0);
      const ap = String(m12[4] || '').toUpperCase();
      if (ap === 'PM' && hh < 12) hh += 12;
      if (ap === 'AM' && hh === 12) hh = 0;
      if (ss >= 30) mm += 1;
      if (mm >= 60) {
        hh += Math.floor(mm / 60);
        mm = mm % 60;
      }
      hh = hh % 24;
      return `${pad2(hh)}:${pad2(mm)}`;
    }

    const m24 = txt.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m24) {
      let hh = toNumber(m24[1], 0);
      let mm = toNumber(m24[2], 0);
      const ss = toNumber(m24[3] || '00', 0);
      if (ss >= 30) mm += 1;
      if (mm >= 60) {
        hh += Math.floor(mm / 60);
        mm = mm % 60;
      }
      hh = ((hh % 24) + 24) % 24;
      return `${pad2(hh)}:${pad2(mm)}`;
    }

    const hms = hora24DesdeTexto(txt);
    const m = hms.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (m) return `${m[1]}:${m[2]}`;
    return '';
  }

  function horaRegistroTexto(record, atField, horaField) {
    if (record && record[atField]) {
      const roundedAt = horaMinutoRedondeada(record[atField]);
      if (roundedAt) return roundedAt;
    }
    const fromHora = hora24SoloMinutos(record && record[horaField]);
    return fromHora || '---';
  }

  function timeMs(value) {
    const d = safeDate(value);
    return d ? d.getTime() : 0;
  }

  function horaLimiteNormalizada(value) {
    const n = Math.round(toNumber(value, 4));
    if (n < 0) return 0;
    if (n > 12) return 12;
    return n;
  }

  function generarClave(seed = '') {
    const base = `${seed}|${Date.now()}|${Math.random().toString(36).slice(2, 8)}`;
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      hash = ((hash << 5) - hash) + base.charCodeAt(i);
      hash |= 0;
    }
    const number = (Math.abs(hash) % 90000) + 10000;
    return String(number).padStart(5, '0');
  }

  function maskClave(value) {
    const txt = String(value || '').trim();
    if (!txt) return '---';
    if (txt.length <= 2) return '**';
    return `${'*'.repeat(Math.max(1, txt.length - 2))}${txt.slice(-2)}`;
  }

  function clavesDesbloqueadas() {
    return Number(window.__asistenciaClavesVisiblesHasta || 0) > Date.now();
  }

  function normalizarUsuarioColaborador(value = '') {
    const clean = String(value || '').trim().toLowerCase();
    if (!clean) return '';
    return clean
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '');
  }

  function normalizarNombreColaborador(value = '', fallback = '') {
    const txt = String(value || '').trim().toLowerCase();
    if (txt) return txt;
    return String(fallback || '').trim().toLowerCase();
  }

  function colaboradoresSistemaAsistencia(owner = getOwnerActivo()) {
    const ownerKey = String(owner || '').trim().toLowerCase();
    if (!ownerKey) return [];
    return getDbArray('usuarios')
      .filter(u => String((u && u.role) || '').trim().toLowerCase() === 'colaborador' && String((u && u.owner) || '').trim().toLowerCase() === ownerKey)
      .map(u => {
        const user = normalizarUsuarioColaborador((u && u.user) || '');
        if (!user) return null;
        return {
          user,
          nombre: normalizarNombreColaborador((u && u.user) || '', user),
          activo: !!(u && u.activo !== false),
          pass: String((u && u.pass) || '').trim(),
          source: 'sistema',
          esIndependiente: false
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  function normalizarManualColaborador(raw = {}) {
    const obj = raw && typeof raw === 'object' ? raw : {};
    let user = normalizarUsuarioColaborador(obj.user || '');
    const nombre = normalizarNombreColaborador(obj.nombre || '', user || 'colaborador');
    if (!user && nombre) user = normalizarUsuarioColaborador(nombre);
    if (!user) return null;
    return {
      user,
      nombre,
      pass: String(obj.pass || '').trim(),
      activo: obj.activo !== false,
      updatedAt: String(obj.updatedAt || '').trim() || new Date().toISOString(),
      source: 'manual',
      esIndependiente: true
    };
  }

  function manualColaboradoresAsistencia(config) {
    const list = Array.isArray(config && config.manualColaboradores) ? config.manualColaboradores : [];
    const map = new Map();
    list.forEach(item => {
      const n = normalizarManualColaborador(item);
      if (!n) return;
      map.set(n.user, n);
    });
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  function catalogoColaboradoresRegistrados(owner = getOwnerActivo()) {
    return colaboradoresSistemaAsistencia(owner).map(c => ({
      user: String(c.user || '').trim().toLowerCase(),
      nombre: String(c.nombre || c.user || '').trim().toLowerCase(),
      pass: String(c.pass || '').trim(),
      activo: c.activo !== false
    }));
  }

  function getAsistenciaConfig(opts = {}) {
    const createIfMissing = opts.createIfMissing !== false;
    const owner = String(opts.owner || getOwnerActivo()).trim().toLowerCase();
    const modulo = String(opts.modulo || getModuloActivo()).trim().toUpperCase();
    if (!owner || !modulo) return null;

    const list = getDbArray('asistenciaConfig');
    let config = list.find(c => String((c && c.owner) || '').trim().toLowerCase() === owner && String((c && c.modulo) || '').trim().toUpperCase() === modulo);

    if (!config && createIfMissing) {
      config = {
        id: `ASCFG-${owner}-${modulo}`,
        owner,
        modulo,
        activo: true,
        requerirClave: true,
        masterPassword: String((sesionUser && sesionUser.pass) || '').trim(),
        horaLimiteSalida: 4,
        cicloInicio: '',
        cicloFin: '',
        manualColaboradores: [],
        colaboradores: [],
        updatedAt: new Date().toISOString()
      };
      list.push(config);
    }

    if (!config) return null;

    config.owner = owner;
    config.modulo = modulo;
    config.activo = config.activo !== false;
    config.requerirClave = config.requerirClave !== false;
    config.horaLimiteSalida = horaLimiteNormalizada(config.horaLimiteSalida);
    config.masterPassword = String(config.masterPassword || '').trim();
    config.cicloInicio = normalizarYmd(config.cicloInicio);
    config.cicloFin = normalizarYmd(config.cicloFin);
    if (!Array.isArray(config.manualColaboradores)) config.manualColaboradores = [];
    config.manualColaboradores = manualColaboradoresAsistencia(config);
    if (!Array.isArray(config.colaboradores)) config.colaboradores = [];
    sincronizarVentanaCicloAsistencia(config);

    return config;
  }

  function syncConfigColaboradores(config, opts = {}) {
    if (!config || typeof config !== 'object') return false;

    const regenerate = opts.forzarRegenerar === true;
    const prevMap = new Map((Array.isArray(config.colaboradores) ? config.colaboradores : []).map(c => [String((c && c.user) || '').trim().toLowerCase(), c]));
    const manualList = manualColaboradoresAsistencia(config);
    config.manualColaboradores = manualList;
    const nowIso = new Date().toISOString();

    const sources = new Map();
    colaboradoresSistemaAsistencia(config.owner).forEach(c => {
      sources.set(c.user, { ...c });
    });
    manualList.forEach(c => {
      const prevSource = sources.get(c.user) || null;
      if (prevSource) {
        sources.set(c.user, {
          ...prevSource,
          nombre: c.nombre || prevSource.nombre,
          activo: c.activo !== false,
          pass: c.pass || prevSource.pass || '',
          source: 'mixto',
          esIndependiente: false
        });
        return;
      }
      sources.set(c.user, { ...c, source: 'manual', esIndependiente: true });
    });

    const next = [...sources.values()]
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')))
      .map(c => {
        const user = String(c.user || '').trim().toLowerCase();
        const prev = prevMap.get(user) || {};
        let clave = String(prev.clave || '').trim();
        if (regenerate || !/^\d{5}$/.test(clave)) {
          clave = generarClave(`${config.owner}|${config.modulo}|${user}`);
        }
        return {
          user,
          nombre: String(c.nombre || user).trim().toLowerCase(),
          activo: c.activo !== false,
          pass: String(c.pass || prev.pass || '').trim(),
          source: String(c.source || prev.source || '').trim() || 'manual',
          esIndependiente: c.esIndependiente === true,
          clave,
          updatedAt: String(prev.updatedAt || c.updatedAt || nowIso)
        };
      });

    const changed = JSON.stringify(config.colaboradores || []) !== JSON.stringify(next);
    if (changed) {
      config.colaboradores = next;
      config.updatedAt = nowIso;
    }
    return changed;
  }

  function fechaOperativaAsistencia(date = new Date(), config = null) {
    const d = safeDate(date);
    if (!d) return '';
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    const limit = horaLimiteNormalizada(cfg && cfg.horaLimiteSalida);
    const copy = new Date(d.getTime());
    if (copy.getHours() < limit) copy.setDate(copy.getDate() - 1);
    return ymdLocal(copy);
  }

  function fechaNominaActual() {
    return ymdLocal(new Date());
  }

  function sincronizarVentanaCicloAsistencia(config, opts = {}) {
    if (!config || typeof config !== 'object') return false;
    const forceAdvance = opts.forceAdvance === true;
    const jornadaActual = fechaNominaActual();
    if (!jornadaActual) return false;

    let changed = false;
    let inicio = normalizarYmd(config.cicloInicio);
    let fin = normalizarYmd(config.cicloFin);

    if (!inicio || !fin) {
      fin = ymdAddDays(jornadaActual, -1);
      inicio = ymdAddDays(fin, -(ASISTENCIA_CICLO_DIAS - 1));
      changed = true;
    }

    if (!inicio || !fin) return false;

    const span = diasEntreYmd(inicio, fin);
    if (!Number.isFinite(span) || span < 0) {
      inicio = ymdAddDays(fin, -(ASISTENCIA_CICLO_DIAS - 1));
      changed = true;
    } else if (span !== (ASISTENCIA_CICLO_DIAS - 1)) {
      fin = ymdAddDays(inicio, ASISTENCIA_CICLO_DIAS - 1);
      changed = true;
    }

    const legacyInicio = ymdAddDays(jornadaActual, -(ASISTENCIA_CICLO_DIAS - 1));
    const legacySpan = diasEntreYmd(inicio, fin);
    const esLegacyDeslizante = !forceAdvance &&
      inicio === legacyInicio &&
      fin === jornadaActual &&
      legacySpan === (ASISTENCIA_CICLO_DIAS - 1);

    if (esLegacyDeslizante) {
      inicio = ymdAddDays(inicio, ASISTENCIA_CICLO_DIAS - 1);
      fin = ymdAddDays(fin, ASISTENCIA_CICLO_DIAS - 1);
      changed = true;
    }

    if (!fin) return false;

    if (forceAdvance) {
      inicio = ymdAddDays(inicio, ASISTENCIA_CICLO_DIAS);
      fin = ymdAddDays(fin, ASISTENCIA_CICLO_DIAS);
      changed = true;
    } else {
      let guard = 0;
      while (jornadaActual > fin && guard < 120) {
        inicio = ymdAddDays(inicio, ASISTENCIA_CICLO_DIAS);
        fin = ymdAddDays(fin, ASISTENCIA_CICLO_DIAS);
        changed = true;
        guard++;
      }
      guard = 0;
      while (jornadaActual < inicio && guard < 120) {
        inicio = ymdAddDays(inicio, -ASISTENCIA_CICLO_DIAS);
        fin = ymdAddDays(fin, -ASISTENCIA_CICLO_DIAS);
        changed = true;
        guard++;
      }
    }

    if (String(config.cicloInicio || '').trim() !== inicio) changed = true;
    if (String(config.cicloFin || '').trim() !== fin) changed = true;
    config.cicloInicio = inicio;
    config.cicloFin = fin;
    if (changed) config.updatedAt = new Date().toISOString();
    return changed;
  }

  function estadoConfigTexto(config) {
    if (!config) return 'Asistencia sin configuracion';
    const estado = config.activo ? 'ACTIVO' : 'INACTIVO';
    const auth = config.requerirClave ? 'ON' : 'OFF';
    const colabs = (config.colaboradores || []).filter(c => c && c.activo !== false).length;
    const inicio = String(config.cicloInicio || '').trim();
    const fin = String(config.cicloFin || '').trim();
    const cicloTxt = inicio && fin ? ` - Ciclo ${ymdToDisplay(fin)} a ${ymdToDisplay(inicio)}` : '';
    return `Modulo ${estado} - Autorizacion ${auth} - Corte ${horaLimiteNormalizada(config.horaLimiteSalida)}:00 - Colaboradores ${colabs}${cicloTxt}`;
  }
  function setRegistroEstado(msg, color = '#57606f') {
    const el = document.getElementById('asistencia-registro-estado');
    if (!el) return;
    el.textContent = String(msg || '');
    el.style.color = color;
  }

  function puedeVerRegistro(r) {
    const ownerOk = String((r && r.owner) || '').trim().toLowerCase() === getOwnerActivo();
    const moduloRaw = String((r && r.modulo) || '').trim();
    const moduloOk = typeof moduloPerteneceVista === 'function'
      ? moduloPerteneceVista(moduloRaw)
      : (moduloRaw.toUpperCase() === getModuloActivo());
    return ownerOk && moduloOk;
  }

  function registrosAsistenciaVisibles() {
    return getDbArray('asistenciaRegistros').filter(r => puedeVerRegistro(r) && (!!(r && r.entradaAt) || !!(r && r.salidaAt)));
  }

  function autorizacionesAsistenciaVisibles() {
    return getDbArray('asistenciaAutorizaciones').filter(r => puedeVerRegistro(r));
  }

  function estadoRegistroTexto(record) {
    if (record && record.estado) return String(record.estado).toUpperCase();
    if (record && record.salidaAt) return 'CERRADO';
    if (record && record.entradaAt) return 'ABIERTO';
    return 'INVALIDO';
  }

  function totalHorasTexto(record) {
    const ini = timeMs(record && record.entradaAt);
    const fin = timeMs(record && record.salidaAt);
    if (!(ini > 0 && fin > 0 && fin >= ini)) return '---';
    const mins = Math.round((fin - ini) / 60000);
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    return `${hh}:${String(mm).padStart(2, '0')}`;
  }

  function buscarRegistroAbierto(colaboradorUser, fechaOperativa = '') {
    const owner = getOwnerActivo();
    const modulo = getModuloActivo();
    const user = String(colaboradorUser || '').trim().toLowerCase();

    const abiertos = getDbArray('asistenciaRegistros').filter(r =>
      String((r && r.owner) || '').trim().toLowerCase() === owner &&
      String((r && r.modulo) || '').trim().toUpperCase() === modulo &&
      String((r && r.colaboradorUser) || '').trim().toLowerCase() === user &&
      !String((r && r.salidaAt) || '').trim() &&
      (!r.estado || String(r.estado).toLowerCase() === 'abierto')
    );

    if (!abiertos.length) return null;

    if (fechaOperativa) {
      const exact = abiertos.find(r => String((r && r.fechaAsistencia) || '').trim() === String(fechaOperativa).trim());
      if (exact) return exact;
    }

    return [...abiertos].sort((a, b) => timeMs((b && b.entradaAt)) - timeMs((a && a.entradaAt)))[0] || null;
  }

  function logAutorizacion(payload = {}) {
    const now = new Date();
    getDbArray('asistenciaAutorizaciones').push({
      id: `ASAUTH-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      owner: getOwnerActivo(),
      modulo: getModuloActivo(),
      fecha: fechaTexto(now),
      hora: horaTexto(now, true),
      timestamp: now.toISOString(),
      colaboradorUser: String(payload.colaboradorUser || '').trim().toLowerCase(),
      colaboradorNombre: String(payload.colaboradorNombre || payload.colaboradorUser || '').trim().toLowerCase(),
      tipoAccion: String(payload.tipoAccion || '').trim().toLowerCase(),
      claveUsada: String(payload.claveUsada || '').trim(),
      via: String(payload.via || 'colaborador').trim().toLowerCase(),
      resultado: payload.autorizado ? 'autorizado' : 'denegado',
      motivo: String(payload.motivo || '').trim(),
      operador: (typeof operadorActual === 'string' && operadorActual) || String((sesionUser && sesionUser.user) || '---')
    });
  }
  function pedirAutorizacion(tipoAccion, colaboradorCfg, config) {
    if (!config || config.requerirClave === false) return { ok: true, logged: false };

    const colabNombre = String((colaboradorCfg && (colaboradorCfg.nombre || colaboradorCfg.user)) || 'colaborador').trim().toLowerCase();
    const input = prompt(`Ingrese la clave del colaborador para ${String(tipoAccion || '').toUpperCase()} (${colabNombre}).`);
    if (input === null) return { ok: false, logged: false, cancelled: true };

    const clave = String(input || '').trim();
    const passColab = String((colaboradorCfg && colaboradorCfg.pass) || '').trim();
    const claveColab = String((colaboradorCfg && colaboradorCfg.clave) || '').trim();
    const byPass = !!passColab && clave === passColab;
    const byClaveAsistencia = !!claveColab && clave === claveColab;
    const ok = byPass || byClaveAsistencia;

    if (!passColab && !claveColab) {
      logAutorizacion({
        colaboradorUser: colaboradorCfg && colaboradorCfg.user,
        colaboradorNombre: colabNombre,
        tipoAccion,
        claveUsada: clave,
        via: 'sin-clave-configurada',
        autorizado: false,
        motivo: 'colaborador-sin-clave'
      });
      alert('Este colaborador no tiene clave configurada en asistencia.');
      return { ok: false, logged: true };
    }

    logAutorizacion({
      colaboradorUser: colaboradorCfg && colaboradorCfg.user,
      colaboradorNombre: colabNombre,
      tipoAccion,
      claveUsada: clave,
      via: byPass ? 'colaborador-pass' : (byClaveAsistencia ? 'colaborador-asistencia' : 'colaborador'),
      autorizado: ok,
      motivo: ok ? 'autorizacion-ok' : 'clave-invalida'
    });

    if (!ok) alert('Clave del colaborador incorrecta. Accion bloqueada.');
    return { ok, logged: true };
  }

  function getRegistroPorFecha(colaboradorUser, fechaAsistencia) {
    const owner = getOwnerActivo();
    const modulo = getModuloActivo();
    const user = String(colaboradorUser || '').trim().toLowerCase();
    const fecha = String(fechaAsistencia || '').trim();
    return getDbArray('asistenciaRegistros').find(r =>
      String((r && r.owner) || '').trim().toLowerCase() === owner &&
      String((r && r.modulo) || '').trim().toUpperCase() === modulo &&
      String((r && r.colaboradorUser) || '').trim().toLowerCase() === user &&
      String((r && r.fechaAsistencia) || '').trim() === fecha
    ) || null;
  }

  function colaboradoresActivosVisibles(config) {
    let cols = (config && Array.isArray(config.colaboradores) ? config.colaboradores : []).filter(c => c && c.activo !== false);
    if (typeof esColaboradorSesion !== 'undefined' && esColaboradorSesion) {
      const me = String((sesionUser && sesionUser.user) || '').trim().toLowerCase();
      cols = cols.filter(c => String(c.user || '').trim().toLowerCase() === me);
    }
    return cols;
  }

  function construirFechasTablero(config) {
    if (!config) return [];
    sincronizarVentanaCicloAsistencia(config);
    const inicio = String(config.cicloInicio || '').trim();
    if (!inicio) return [];
    const fechas = [];
    for (let i = ASISTENCIA_CICLO_DIAS - 1; i >= 0; i--) {
      fechas.push(ymdAddDays(inicio, i));
    }
    return fechas.filter(Boolean);
  }

  function aplicarRestriccionesVisuales() {
    const esBasico = typeof esModoBasicoColaborador === 'function' ? esModoBasicoColaborador() : false;
    document.querySelectorAll('#asistencia button[onclick*="limpiarRegistrosAsistencia"], #asistencia button[onclick*="limpiarAutorizacionesAsistencia"], #asistencia button[onclick*="actualizarCicloAsistencia"]').forEach(btn => {
      btn.style.display = esBasico ? 'none' : '';
    });
    const cardAuth = document.getElementById('asistencia-autorizaciones-card');
    if (cardAuth) cardAuth.style.display = esBasico ? 'none' : '';
    const addColabBtn = document.getElementById('btn-asistencia-add-colab');
    if (addColabBtn) addColabBtn.style.display = esBasico ? 'none' : '';
  }

  function renderEstado(config) {
    const status = document.getElementById('asistencia-status-modulo');
    if (status) {
      status.textContent = estadoConfigTexto(config);
      status.style.color = config && config.activo ? '#1f8f4c' : '#a66a00';
    }

    const cfgStatus = document.getElementById('config-asistencia-status');
    if (cfgStatus && config) {
      const hasMaster = !!String(config.masterPassword || '').trim();
      cfgStatus.textContent = `${estadoConfigTexto(config)} - Clave maestra ${hasMaster ? 'configurada' : 'pendiente'}.`;
      cfgStatus.style.color = config.activo ? '#1f8f4c' : '#a66a00';
    }
  }

  function renderListaColaboradoresAsistencia(config) {
    const box = document.getElementById('asistencia-colaboradores-lista');
    if (!box) return;

    const cols = colaboradoresActivosVisibles(config);
    const current = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();

    if (cols.length === 0) {
      box.innerHTML = '<div style="font-size:12px; color:#777;">Sin colaboradores activos para asistencia.</div>';
      window.__asistenciaColabSeleccionado = '';
      return;
    }

    const hasCurrent = cols.some(c => String(c.user || '').trim().toLowerCase() === current);
    if (!hasCurrent) {
      const prefer = (typeof esColaboradorSesion !== 'undefined' && esColaboradorSesion)
        ? String((sesionUser && sesionUser.user) || '').trim().toLowerCase()
        : String(cols[0].user || '').trim().toLowerCase();
      window.__asistenciaColabSeleccionado = prefer;
    }

    const selected = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();

    box.innerHTML = cols.map(c => {
      const user = String(c.user || '').trim().toLowerCase();
      const active = user === selected ? ' active' : '';
      const ultima = getDbArray('asistenciaRegistros')
        .filter(r => String((r && r.colaboradorUser) || '').trim().toLowerCase() === user && puedeVerRegistro(r))
        .sort((a, b) => timeMs((b && b.updatedAt) || (b && b.entradaAt)) - timeMs((a && a.updatedAt) || (a && a.entradaAt)))[0];
      const estado = ultima ? estadoRegistroTexto(ultima) : 'SIN REGISTROS';
      const tipo = c && c.esIndependiente ? 'INDEPENDIENTE' : 'VINCULADO';
      return `<button type="button" class="asistencia-colab-btn${active}" onclick="seleccionarColaboradorAsistencia('${user.replace(/'/g, "\\'")}')">
        ${String(c.nombre || user).toUpperCase()}
        <span class="asistencia-colab-meta">Estado: ${estado} - ${tipo}</span>
      </button>`;
    }).join('');
  }

  function renderTableroColaboradorAsistencia(config) {
    const tbody = document.getElementById('asistencia-tablero-body');
    const head = document.getElementById('asistencia-tablero-header');
    const fechaLabel = document.getElementById('asistencia-fecha-operativa');
    if (!tbody || !config) return;
    sincronizarVentanaCicloAsistencia(config);

    const selected = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    const colaborador = colaboradoresActivosVisibles(config).find(c => String(c.user || '').trim().toLowerCase() === selected) || null;
    const jornada = fechaNominaActual();
    const cicloInicio = String(config.cicloInicio || '').trim();
    const cicloFin = String(config.cicloFin || '').trim();

    if (fechaLabel) {
      const ciclo = cicloInicio && cicloFin ? `${ymdToDisplay(cicloFin)} a ${ymdToDisplay(cicloInicio)}` : '---';
      fechaLabel.textContent = `Jornada operativa: ${ymdToDisplay(jornada)} - Ciclo: ${ciclo} - corte ${horaLimiteNormalizada(config.horaLimiteSalida)}:00`;
    }

    if (!colaborador) {
      if (head) head.textContent = 'Selecciona un colaborador para ver su casilla de asistencia.';
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777;">Selecciona un colaborador.</td></tr>';
      return;
    }

    if (head) head.textContent = `Colaborador: ${String(colaborador.nombre || colaborador.user).toUpperCase()}`;

    const fechas = construirFechasTablero(config);
    tbody.innerHTML = fechas.map(fecha => {
      const registro = getRegistroPorFecha(colaborador.user, fecha);
      const entrada = horaRegistroTexto(registro, 'entradaAt', 'entradaHora');
      const salida = horaRegistroTexto(registro, 'salidaAt', 'salidaHora');
      const total = registro ? totalHorasTexto(registro) : '---';
      const puedeEntrada = config.activo && fecha === jornada && !(registro && registro.entradaAt);
      const puedeSalida = config.activo && fecha === jornada && !!(registro && registro.entradaAt) && !(registro && registro.salidaAt);
      const classEntrada = registro && registro.entradaAt ? 'asistencia-mark-btn asistencia-mark-ok' : 'asistencia-mark-btn';
      const classSalida = registro && registro.salidaAt ? 'asistencia-mark-btn asistencia-mark-ok' : 'asistencia-mark-btn';
      const fechaVisible = fecha ? fecha.split('-').reverse().join('/') : '---';
      return `<tr>
        <td data-label="FECHA"><strong>${fechaVisible}</strong></td>
        <td data-label="MARCAR ENTRADA"><button type="button" class="${classEntrada}" onclick="registrarAsistenciaDesdeTablero('entrada','${fecha}')" ${puedeEntrada ? '' : 'disabled'}>${registro && registro.entradaAt ? '&#10003;' : '&bull;'}</button></td>
        <td data-label="ENTRADA">${entrada}</td>
        <td data-label="MARCAR SALIDA"><button type="button" class="${classSalida}" onclick="registrarAsistenciaDesdeTablero('salida','${fecha}')" ${puedeSalida ? '' : 'disabled'}>${registro && registro.salidaAt ? '&#10003;' : '&bull;'}</button></td>
        <td data-label="SALIDA">${salida}</td>
        <td data-label="TOTAL" class="${registro && registro.salidaAt ? 'asistencia-total-ok' : ''}">${total}</td>
      </tr>`;
    }).join('');
  }

  window.seleccionarColaboradorAsistencia = function seleccionarColaboradorAsistencia(colaboradorUser) {
    window.__asistenciaColabSeleccionado = String(colaboradorUser || '').trim().toLowerCase();
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;
    renderListaColaboradoresAsistencia(config);
    renderTableroColaboradorAsistencia(config);
  };

  window.registrarAsistenciaDesdeTablero = function registrarAsistenciaDesdeTablero(tipo, fechaAsistencia) {
    const user = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    if (!user) return alert('Selecciona un colaborador para registrar asistencia.');
    return window.registrarAsistencia(tipo, { colaboradorUser: user, fechaAsistencia: String(fechaAsistencia || '').trim() });
  };

  window.cerrarModalAsistenciaColaborador = function cerrarModalAsistenciaColaborador() {
    const modal = document.getElementById('modal-asistencia-colaborador');
    if (!modal) return;
    modal.style.display = 'none';
  };

  window.autocompletarAsistenciaColaboradorDesdeSelect = function autocompletarAsistenciaColaboradorDesdeSelect() {
    const select = document.getElementById('asistencia-colab-existente');
    const inNombre = document.getElementById('asistencia-colab-nombre');
    const inPass = document.getElementById('asistencia-colab-pass');
    const inActivo = document.getElementById('asistencia-colab-activo');
    if (!select || !inNombre || !inPass || !inActivo) return;

    const user = String(select.value || '').trim().toLowerCase();
    if (!user) {
      inNombre.value = '';
      inPass.value = '';
      inActivo.checked = true;
      return;
    }

    const list = Array.isArray(window.__asistenciaCatalogoColaboradores) ? window.__asistenciaCatalogoColaboradores : [];
    const found = list.find(c => String((c && c.user) || '').trim().toLowerCase() === user) || null;
    if (!found) return;

    inNombre.value = String(found.nombre || user).trim().toLowerCase();
    inPass.value = String(found.pass || '').trim();
    inActivo.checked = found.activo !== false;
  };

  window.abrirGestionColaboradoresAsistencia = function abrirGestionColaboradoresAsistencia() {
    if (typeof esColaboradorSesion !== 'undefined' && esColaboradorSesion) {
      return alert('Solo un administrador puede anadir colaboradores a asistencia.');
    }

    const modal = document.getElementById('modal-asistencia-colaborador');
    if (!modal) return;

    const select = document.getElementById('asistencia-colab-existente');
    const inNombre = document.getElementById('asistencia-colab-nombre');
    const inPass = document.getElementById('asistencia-colab-pass');
    const inActivo = document.getElementById('asistencia-colab-activo');

    const list = catalogoColaboradoresRegistrados(getOwnerActivo());
    window.__asistenciaCatalogoColaboradores = list;

    if (select) {
      const options = ['<option value="">Manual / sin rol</option>']
        .concat(list.map(c => {
          const user = String(c.user || '').replace(/"/g, '&quot;');
          const estado = c.activo !== false ? 'Activo' : 'Bloqueado';
          return `<option value="${user}">${String(c.nombre || c.user).toUpperCase()} - ${estado}</option>`;
        }));
      select.innerHTML = options.join('');
      select.value = '';
    }

    if (inNombre) inNombre.value = '';
    if (inPass) inPass.value = '';
    if (inActivo) inActivo.checked = true;

    modal.style.display = 'flex';
    setTimeout(() => { inNombre?.focus(); }, 20);
  };

  window.guardarColaboradorAsistenciaIndependiente = function guardarColaboradorAsistenciaIndependiente() {
    if (typeof esColaboradorSesion !== 'undefined' && esColaboradorSesion) {
      return alert('Solo un administrador puede guardar colaboradores de asistencia.');
    }

    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return alert('No se pudo cargar la configuracion de asistencia.');

    const select = document.getElementById('asistencia-colab-existente');
    const inNombre = document.getElementById('asistencia-colab-nombre');
    const inPass = document.getElementById('asistencia-colab-pass');
    const inActivo = document.getElementById('asistencia-colab-activo');

    const fromSelect = String((select && select.value) || '').trim().toLowerCase();
    const nombreRaw = String((inNombre && inNombre.value) || '').trim();
    const passRaw = String((inPass && inPass.value) || '').trim();
    const activo = !!(inActivo && inActivo.checked);

    const nombre = normalizarNombreColaborador(nombreRaw, fromSelect || 'colaborador');
    let user = normalizarUsuarioColaborador(fromSelect || nombre);
    if (!user) user = `colaborador-${Date.now()}`;

    if (!nombre) return alert('Ingresa el nombre del colaborador.');
    if (!passRaw) return alert('Ingresa la contrasena del colaborador.');

    if (!Array.isArray(config.manualColaboradores)) config.manualColaboradores = [];
    const nowIso = new Date().toISOString();
    const idx = config.manualColaboradores.findIndex(c => String((c && c.user) || '').trim().toLowerCase() === user);
    const payload = {
      user,
      nombre,
      pass: passRaw,
      activo,
      updatedAt: nowIso
    };

    if (idx >= 0) {
      config.manualColaboradores[idx] = {
        ...(config.manualColaboradores[idx] || {}),
        ...payload
      };
    } else {
      config.manualColaboradores.push(payload);
    }

    syncConfigColaboradores(config);
    config.updatedAt = nowIso;

    if (typeof guardarDatos === 'function') guardarDatos();

    window.cerrarModalAsistenciaColaborador();
    window.__asistenciaColabSeleccionado = user;
    window.renderAsistenciaModulo();
    if (typeof window.renderConfigAsistencia === 'function') window.renderConfigAsistencia();
    alert(`Colaborador ${nombre.toUpperCase()} agregado a asistencia.`);
  };

  window.eliminarColaboradorAsistenciaIndependiente = function eliminarColaboradorAsistenciaIndependiente(colaboradorUser) {
    if (typeof esColaboradorSesion !== 'undefined' && esColaboradorSesion) return;
    const user = String(colaboradorUser || '').trim().toLowerCase();
    if (!user) return;

    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config || !Array.isArray(config.manualColaboradores)) return;

    const before = config.manualColaboradores.length;
    config.manualColaboradores = config.manualColaboradores.filter(c => String((c && c.user) || '').trim().toLowerCase() !== user);
    if (config.manualColaboradores.length === before) return;

    syncConfigColaboradores(config);
    config.updatedAt = new Date().toISOString();
    if (typeof guardarDatos === 'function') guardarDatos();

    if (String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase() === user) {
      window.__asistenciaColabSeleccionado = '';
    }

    window.renderAsistenciaModulo();
    if (typeof window.renderConfigAsistencia === 'function') window.renderConfigAsistencia();
    alert('Colaborador de asistencia removido.');
  };

  window.addEventListener('click', (ev) => {
    const modal = document.getElementById('modal-asistencia-colaborador');
    if (modal && modal.style.display !== 'none' && ev.target === modal) {
      window.cerrarModalAsistenciaColaborador();
    }
    const panel = document.getElementById('asistencia-reporte-panel');
    if (panel && panel.classList.contains('is-open') && ev.target === panel) {
      window.toggleAsistenciaReporte(false);
    }
  });
  window.renderAsistenciaRegistros = function renderAsistenciaRegistros() {
    const box = document.getElementById('asistencia-reporte-consolidado-lista');
    if (!box) return;

    const q = String((document.getElementById('asistencia-filtro-colaborador') && document.getElementById('asistencia-filtro-colaborador').value) || '').trim().toLowerCase();

    const resumen = new Map();
    registrosAsistenciaVisibles().forEach(r => {
      const user = String((r && r.colaboradorUser) || '').trim().toLowerCase();
      const nombre = String((r && (r.colaboradorNombre || r.colaborador || r.colaboradorUser)) || '').trim().toLowerCase();
      const key = user || nombre;
      if (!key) return;
      if (!resumen.has(key)) {
        resumen.set(key, {
          user: key,
          nombre: nombre || key,
          totalMins: 0,
          registros: 0,
          ultima: ''
        });
      }
      const row = resumen.get(key);
      row.totalMins += minutosTotalesDesdeRegistro(r);
      row.registros += 1;
      const ref = String((r && (r.updatedAt || r.salidaAt || r.entradaAt || r.createdAt)) || '').trim();
      if (ref && timeMs(ref) > timeMs(row.ultima)) row.ultima = ref;
    });

    let list = [...resumen.values()];
    if (q) {
      list = list.filter(r => String(r.nombre || '').includes(q) || String(r.user || '').includes(q));
    }
    list.sort((a, b) => timeMs(b.ultima) - timeMs(a.ultima));

    box.innerHTML = list.map(item => {
      const nombre = String(item.nombre || item.user || '---').toUpperCase();
      const user = String(item.user || '').replace(/'/g, "\\'");
      return `<button type="button" class="asistencia-reporte-colab-btn" onclick="abrirReporteConsolidadoAsistencia('${user}')">
        <strong>${nombre}</strong>
        <span>${item.registros} registro(s) - Total ${minutosAHorasTexto(item.totalMins)}</span>
      </button>`;
    }).join('') || '<div style="font-size:12px; color:#777;">Sin colaboradores con registros.</div>';
  };

  function registrosPorColaborador(colaboradorUser) {
    const user = String(colaboradorUser || '').trim().toLowerCase();
    if (!user) return [];
    return registrosAsistenciaVisibles()
      .filter(r => String((r && r.colaboradorUser) || '').trim().toLowerCase() === user)
      .sort((a, b) => timeMs((b && b.entradaAt) || (b && b.createdAt)) - timeMs((a && a.entradaAt) || (a && a.createdAt)));
  }

  function formatMonthKey(value) {
    const txt = String(value || '').trim();
    if (/^\d{4}-\d{2}$/.test(txt)) return txt;
    if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt.slice(0, 7);
    const d = safeDate(value);
    if (!d) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }

  function mesLabel(monthKey) {
    const m = String(monthKey || '').trim();
    if (!/^\d{4}-\d{2}$/.test(m)) return m || 'Mes';
    const d = safeDate(`${m}-01T12:00:00`);
    if (!d) return m;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  }

  window.toggleAsistenciaReporte = function toggleAsistenciaReporte(abrir = true) {
    const panel = document.getElementById('asistencia-reporte-panel');
    if (!panel) return;
    const shouldOpen = abrir !== false;
    panel.classList.toggle('is-open', shouldOpen);
    panel.classList.remove('is-minimized');
    panel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
  };

  window.toggleAsistenciaReporteMinimize = function toggleAsistenciaReporteMinimize() {
    const panel = document.getElementById('asistencia-reporte-panel');
    if (!panel || !panel.classList.contains('is-open')) return;
    panel.classList.toggle('is-minimized');
  };

  window.abrirReporteConsolidadoAsistencia = function abrirReporteConsolidadoAsistencia(colaboradorUser) {
    const user = String(colaboradorUser || '').trim().toLowerCase();
    if (!user) return;
    const rows = registrosPorColaborador(user);
    if (!rows.length) return alert('Este colaborador no tiene registros de asistencia.');

    window.__asistenciaReporteColaborador = user;
    const nombre = String((rows[0] && (rows[0].colaboradorNombre || rows[0].colaborador || rows[0].colaboradorUser)) || user).trim().toUpperCase();
    const title = document.getElementById('asistencia-reporte-titulo');
    const subtitle = document.getElementById('asistencia-reporte-subtitulo');
    if (title) title.textContent = `Reporte de ${nombre}`;
    if (subtitle) subtitle.textContent = 'Seleccione un mes para ver detalle diario y total.';

    const select = document.getElementById('asistencia-reporte-mes');
    if (select) {
      const monthSet = new Set(rows.map(r => formatMonthKey((r && (r.fechaAsistencia || r.entradaAt || r.createdAt)) || '')).filter(Boolean));
      monthSet.add(formatMonthKey(new Date()));
      const months = [...monthSet].sort((a, b) => b.localeCompare(a));
      select.innerHTML = months.map(m => `<option value="${m}">${mesLabel(m)}</option>`).join('');
      select.value = months[0] || '';
    }

    window.toggleAsistenciaReporte(true);
    window.renderAsistenciaReporteDetalle();
  };

  window.renderAsistenciaReporteDetalle = function renderAsistenciaReporteDetalle() {
    const body = document.getElementById('asistencia-reporte-detalle-body');
    const totalMesEl = document.getElementById('asistencia-reporte-total-mes');
    const totalAcumEl = document.getElementById('asistencia-reporte-total-acum');
    const select = document.getElementById('asistencia-reporte-mes');
    if (!body || !select) return;

    const user = String(window.__asistenciaReporteColaborador || '').trim().toLowerCase();
    if (!user) {
      body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777;">Seleccione un colaborador.</td></tr>';
      if (totalMesEl) totalMesEl.textContent = '0:00';
      if (totalAcumEl) totalAcumEl.textContent = '0:00';
      return;
    }

    const month = String(select.value || '').trim();
    const rows = registrosPorColaborador(user);
    const filtered = rows
      .filter(r => formatMonthKey((r && (r.fechaAsistencia || r.entradaAt || r.createdAt)) || '') === month)
      .sort((a, b) => timeMs((a && (a.entradaAt || a.createdAt || a.fechaAsistencia)) || 0) - timeMs((b && (b.entradaAt || b.createdAt || b.fechaAsistencia)) || 0));

    const totalMes = filtered.reduce((acc, r) => acc + minutosTotalesDesdeRegistro(r), 0);
    const totalAcum = rows.reduce((acc, r) => acc + minutosTotalesDesdeRegistro(r), 0);
    if (totalMesEl) totalMesEl.textContent = minutosAHorasTexto(totalMes);
    if (totalAcumEl) totalAcumEl.textContent = minutosAHorasTexto(totalAcum);

    body.innerHTML = filtered.map(r => {
      const fecha = ymdToDisplay(String((r && r.fechaAsistencia) || ymdLocal((r && (r.entradaAt || r.createdAt)) || '') || '').trim());
      const entrada = horaRegistroTexto(r, 'entradaAt', 'entradaHora');
      const salida = horaRegistroTexto(r, 'salidaAt', 'salidaHora');
      const total = totalHorasTexto(r);
      return `<tr>
        <td>${fecha}</td>
        <td>${entrada}</td>
        <td>${salida}</td>
        <td>${total}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" style="text-align:center; color:#777;">Sin registros para el mes seleccionado.</td></tr>';
  };

  window.renderAsistenciaAutorizaciones = function renderAsistenciaAutorizaciones() {
    const tbody = document.getElementById('tabla-asistencia-autorizaciones');
    if (!tbody) return;

    const showKeys = clavesDesbloqueadas();

    const rows = autorizacionesAsistenciaVisibles()
      .filter(r => {
        const fechaRef = String((r && (r.fecha || r.timestamp)) || '').trim();
        if (typeof fechaDentroRango === 'function' && !fechaDentroRango(fechaRef, 'filtro-asistencia-auth-desde', 'filtro-asistencia-auth-hasta')) return false;
        return true;
      })
      .sort((a, b) => timeMs(b && b.timestamp) - timeMs(a && a.timestamp));

    tbody.innerHTML = rows.map(r => {
      const ok = String((r && r.resultado) || '').trim().toLowerCase() === 'autorizado';
      const color = ok ? '#1f8f4c' : '#c0392b';
      const clave = showKeys ? (String((r && r.claveUsada) || '').trim() || '---') : maskClave((r && r.claveUsada) || '');
      return `<tr>
        <td data-label="Fecha">${String((r && r.fecha) || fechaTexto((r && r.timestamp) || '') || '---')}</td>
        <td data-label="Hora">${String((r && r.hora) || horaTexto((r && r.timestamp) || '', true) || '---')}</td>
        <td data-label="Colaborador"><strong>${String((r && (r.colaboradorNombre || r.colaboradorUser)) || '---').toUpperCase()}</strong></td>
        <td data-label="Accion">${String((r && r.tipoAccion) || '---').toUpperCase()}</td>
        <td data-label="Clave usada">${clave}</td>
        <td data-label="Resultado" style="color:${color}; font-weight:700;">${ok ? 'AUTORIZADO' : 'DENEGADO'}</td>
        <td data-label="Operador">${String((r && r.operador) || '---')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center; color:gray;">Sin autorizaciones.</td></tr>';
  };

  window.renderAsistenciaModulo = function renderAsistenciaModulo() {
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;

    const changed = syncConfigColaboradores(config);
    const cicloChanged = sincronizarVentanaCicloAsistencia(config);
    const mustSave = changed || cicloChanged;
    if (mustSave && typeof guardarDatos === 'function') guardarDatos();

    renderEstado(config);
    renderListaColaboradoresAsistencia(config);
    renderTableroColaboradorAsistencia(config);
    window.renderAsistenciaRegistros();
    window.renderAsistenciaAutorizaciones();
    if (document.getElementById('asistencia-reporte-panel')?.classList.contains('is-open')) {
      window.renderAsistenciaReporteDetalle();
    }
    aplicarRestriccionesVisuales();

    if (!config.activo) {
      setRegistroEstado('El modulo de asistencia esta desactivado en configuracion.', '#a66a00');
    }
  };

  window.guardarConfigAsistenciaDesdeUI = function guardarConfigAsistenciaDesdeUI() {
    if (typeof bloquearAccionAdministrativaColaborador === 'function' && bloquearAccionAdministrativaColaborador('Solo un administrador puede cambiar la configuracion de asistencia.')) return;

    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return alert('No se pudo cargar la configuracion de asistencia.');

    const activo = !!(document.getElementById('cfg-asistencia-activa') && document.getElementById('cfg-asistencia-activa').checked);
    const requerirClave = !!(document.getElementById('cfg-asistencia-requiere-clave') && document.getElementById('cfg-asistencia-requiere-clave').checked);
    const horaLimite = horaLimiteNormalizada(document.getElementById('cfg-asistencia-hora-limite') && document.getElementById('cfg-asistencia-hora-limite').value);
    const passInput = String((document.getElementById('cfg-asistencia-master-pass') && document.getElementById('cfg-asistencia-master-pass').value) || '').trim();

    if (passInput) config.masterPassword = passInput;
    if (!String(config.masterPassword || '').trim()) {
      config.masterPassword = String((sesionUser && sesionUser.pass) || '').trim();
    }

    if (requerirClave && !String(config.masterPassword || '').trim()) {
      return alert('Define una clave maestra antes de activar autorizacion por clave.');
    }

    config.activo = activo;
    config.requerirClave = requerirClave;
    config.horaLimiteSalida = horaLimite;
    syncConfigColaboradores(config);
    config.updatedAt = new Date().toISOString();

    if (typeof guardarDatos === 'function') guardarDatos();

    window.renderConfigAsistencia();
    if (document.getElementById('asistencia') && document.getElementById('asistencia').classList.contains('active')) {
      window.renderAsistenciaModulo();
    }

    alert('Configuracion de asistencia guardada.');
  };

  window.regenerarClaveAsistenciaColaborador = function regenerarClaveAsistenciaColaborador(colaboradorUser) {
    if (typeof bloquearAccionAdministrativaColaborador === 'function' && bloquearAccionAdministrativaColaborador('Solo un administrador puede regenerar claves.')) return;

    const user = String(colaboradorUser || '').trim().toLowerCase();
    if (!user) return;

    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;

    const colab = (config.colaboradores || []).find(c => String((c && c.user) || '').trim().toLowerCase() === user);
    if (!colab) return alert('No se encontro el colaborador en asistencia.');

    colab.clave = generarClave(`${config.owner}|${config.modulo}|${user}`);
    colab.updatedAt = new Date().toISOString();
    config.updatedAt = colab.updatedAt;

    if (typeof guardarDatos === 'function') guardarDatos();

    window.renderConfigAsistencia();
    window.renderAsistenciaAutorizaciones();
    alert(`Clave regenerada para ${user}.`);
  };

  window.generarClavesAsistenciaColaboradores = function generarClavesAsistenciaColaboradores() {
    if (typeof bloquearAccionAdministrativaColaborador === 'function' && bloquearAccionAdministrativaColaborador('Solo un administrador puede generar claves.')) return;

    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;

    if (!confirm('Generar nuevas claves de 5 digitos para todos los colaboradores activos?')) return;

    const changed = syncConfigColaboradores(config, { forzarRegenerar: true });
    if (changed) {
      config.updatedAt = new Date().toISOString();
      if (typeof guardarDatos === 'function') guardarDatos();
    }

    window.renderConfigAsistencia();
    window.renderAsistenciaAutorizaciones();
    alert('Claves de asistencia actualizadas.');
  };
  window.desbloquearClavesAsistencia = function desbloquearClavesAsistencia() {
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return false;

    const master = String(config.masterPassword || (sesionUser && sesionUser.pass) || '').trim();
    if (!master) return alert('Define primero la clave maestra en configuracion.');

    const input = prompt('Ingresa la clave maestra de asistencia para ver las claves:');
    if (input === null) return false;

    if (String(input || '').trim() !== master) {
      alert('Clave maestra incorrecta.');
      return false;
    }

    window.__asistenciaClavesVisiblesHasta = Date.now() + ASISTENCIA_CLAVES_VISIBLES_MS;
    window.renderConfigAsistencia();
    window.renderAsistenciaAutorizaciones();
    alert('Claves desbloqueadas por 5 minutos.');
    return true;
  };

  window.renderConfigAsistencia = function renderConfigAsistencia() {
    const section = document.getElementById('section-asistencia-config');
    if (!section) return;

    if (typeof esColaboradorSesion !== 'undefined' && esColaboradorSesion) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;

    const changed = syncConfigColaboradores(config);
    if (changed && typeof guardarDatos === 'function') guardarDatos();

    const chkActivo = document.getElementById('cfg-asistencia-activa');
    const chkRequiere = document.getElementById('cfg-asistencia-requiere-clave');
    const horaInput = document.getElementById('cfg-asistencia-hora-limite');
    const passInput = document.getElementById('cfg-asistencia-master-pass');

    if (chkActivo) chkActivo.checked = config.activo !== false;
    if (chkRequiere) chkRequiere.checked = config.requerirClave !== false;
    if (horaInput) horaInput.value = horaLimiteNormalizada(config.horaLimiteSalida);
    if (passInput) passInput.value = '';

    const tbody = document.getElementById('config-asistencia-colaboradores-body');
    if (tbody) {
      const showKeys = clavesDesbloqueadas();
      tbody.innerHTML = (config.colaboradores || []).map(c => {
        const user = String((c && c.user) || '').trim().toLowerCase();
        const estado = c && c.activo !== false ? 'Activo' : 'Inactivo';
        const color = c && c.activo !== false ? '#1f8f4c' : '#a66a00';
        const clave = showKeys ? (String((c && c.clave) || '').trim() || '---') : maskClave((c && c.clave) || '');
        const updated = c && c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '---';
        const source = String((c && c.source) || '').trim().toLowerCase();
        const etiquetaFuente = source === 'manual' ? 'Independiente' : (source === 'mixto' ? 'Vinculado + Independiente' : 'Vinculado');
        const puedeRemover = source === 'manual' || source === 'mixto';
        const removeBtn = puedeRemover
          ? `<button class="btn btn-danger" style="padding:6px 8px;" onclick="eliminarColaboradorAsistenciaIndependiente('${user.replace(/'/g, "\\'")}')">REMOVER</button>`
          : '';
        return `<tr>
          <td><strong>${String((c && (c.nombre || user)) || '---').toUpperCase()}</strong><div style="font-size:11px; color:#777; margin-top:2px;">${etiquetaFuente}</div></td>
          <td style="color:${color}; font-weight:700;">${estado}</td>
          <td>${clave}</td>
          <td>${updated}</td>
          <td style="display:flex; gap:6px; flex-wrap:wrap;"><button class="btn btn-purple" style="padding:6px 8px;" onclick="regenerarClaveAsistenciaColaborador('${user.replace(/'/g, "\\'")}')">REGENERAR</button>${removeBtn}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="5" style="text-align:center; color:#777;">Sin colaboradores vinculados.</td></tr>';
    }

    renderEstado(config);
  };

  window.registrarAsistencia = function registrarAsistencia(tipo = 'entrada', opts = {}) {
    const accion = String(tipo || '').trim().toLowerCase();
    if (!['entrada', 'salida'].includes(accion)) return;

    const options = (opts && typeof opts === 'object') ? opts : {};
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return alert('No se pudo cargar la configuracion de asistencia.');
    if (!config.activo) return alert('El modulo de asistencia esta desactivado.');

    syncConfigColaboradores(config);

    const selectedUser = String(options.colaboradorUser || window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    if (!selectedUser) return alert('Selecciona un colaborador para registrar asistencia.');

    if (typeof esColaboradorSesion !== 'undefined' && esColaboradorSesion) {
      const me = String((sesionUser && sesionUser.user) || '').trim().toLowerCase();
      if (selectedUser !== me) return alert('Solo puedes registrar tu propia asistencia.');
    }

    const colab = (config.colaboradores || []).find(c => String((c && c.user) || '').trim().toLowerCase() === selectedUser && c && c.activo !== false);
    if (!colab) return alert('El colaborador seleccionado no esta habilitado en asistencia.');

    const now = new Date();
    const jornadaActual = fechaNominaActual();
    const jornadaObjetivo = String(options.fechaAsistencia || jornadaActual).trim();

    if (jornadaObjetivo !== jornadaActual) {
      return alert('Solo se permite marcar la jornada operativa actual.');
    }

    const auth = pedirAutorizacion(accion, colab, config);
    if (!auth.ok) {
      if (auth.logged && typeof guardarDatos === 'function') {
        guardarDatos();
        window.renderAsistenciaAutorizaciones();
      }
      return;
    }

    const owner = getOwnerActivo();
    const modulo = getModuloActivo();
    const nowIso = now.toISOString();

    if (accion === 'entrada') {
      const existeJornada = getDbArray('asistenciaRegistros').find(r =>
        String((r && r.owner) || '').trim().toLowerCase() === owner &&
        String((r && r.modulo) || '').trim().toUpperCase() === modulo &&
        String((r && r.colaboradorUser) || '').trim().toLowerCase() === selectedUser &&
        String((r && r.fechaAsistencia) || '').trim() === jornadaObjetivo
      );

      if (existeJornada && existeJornada.entradaAt && !existeJornada.salidaAt) {
        return alert('Este colaborador ya tiene una entrada abierta en esta jornada.');
      }
      if (existeJornada && existeJornada.entradaAt && existeJornada.salidaAt) {
        return alert('Este colaborador ya registro entrada y salida en esta jornada.');
      }

      getDbArray('asistenciaRegistros').push({
        id: `ASREG-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        owner,
        modulo,
        fechaAsistencia: jornadaObjetivo,
        colaboradorUser: selectedUser,
        colaborador: String(colab.nombre || selectedUser).trim().toLowerCase(),
        colaboradorNombre: String(colab.nombre || selectedUser).trim().toLowerCase(),
        entradaAt: nowIso,
        entradaHora: hora24SoloMinutos(nowIso),
        salidaAt: '',
        salidaHora: '',
        estado: 'abierto',
        locked: true,
        operador: (typeof operadorActual === 'string' && operadorActual) || String((sesionUser && sesionUser.user) || '---'),
        createdAt: nowIso,
        updatedAt: nowIso
      });

      if (typeof guardarDatos === 'function') guardarDatos();
      window.renderAsistenciaModulo();
      setRegistroEstado(`Entrada registrada para ${String(colab.nombre || selectedUser).toUpperCase()} (${jornadaObjetivo}).`, '#1f8f4c');
      return;
    }

    let abierto = buscarRegistroAbierto(selectedUser, jornadaObjetivo);
    if (!abierto && toNumber(now.getHours(), 0) < horaLimiteNormalizada(config.horaLimiteSalida)) {
      abierto = buscarRegistroAbierto(selectedUser, '');
    }

    if (!abierto) return alert('No existe una entrada abierta para registrar salida.');
    if (abierto.salidaAt) return alert('Este registro ya tiene salida confirmada.');

    abierto.salidaAt = nowIso;
    abierto.salidaHora = hora24SoloMinutos(nowIso);
    abierto.estado = 'cerrado';
    abierto.locked = true;
    abierto.updatedAt = nowIso;
    abierto.operador = (typeof operadorActual === 'string' && operadorActual) || String((sesionUser && sesionUser.user) || '---');

    if (typeof guardarDatos === 'function') guardarDatos();
    window.renderAsistenciaModulo();
    setRegistroEstado(`Salida registrada para ${String(colab.nombre || selectedUser).toUpperCase()} (${String(abierto.fechaAsistencia || jornadaObjetivo)}).`, '#1f8f4c');
  };

  window.limpiarRegistrosAsistencia = function limpiarRegistrosAsistencia() {
    if (typeof bloquearAccionAdministrativaColaborador === 'function' && bloquearAccionAdministrativaColaborador()) return;
    if (typeof validarPermiso === 'function' && !validarPermiso()) return;
    if (!confirm('Eliminar todos los registros de asistencia del modulo actual?')) return;

    const owner = getOwnerActivo();
    const modulo = getModuloActivo();

    db.asistenciaRegistros = getDbArray('asistenciaRegistros').filter(r =>
      !(String((r && r.owner) || '').trim().toLowerCase() === owner && String((r && r.modulo) || '').trim().toUpperCase() === modulo)
    );

    if (typeof guardarDatos === 'function') guardarDatos();
    window.renderAsistenciaModulo();
  };

  window.limpiarAutorizacionesAsistencia = function limpiarAutorizacionesAsistencia() {
    if (typeof bloquearAccionAdministrativaColaborador === 'function' && bloquearAccionAdministrativaColaborador()) return;
    if (typeof validarPermiso === 'function' && !validarPermiso()) return;
    if (!confirm('Eliminar historial de autorizaciones de asistencia del modulo actual?')) return;

    const owner = getOwnerActivo();
    const modulo = getModuloActivo();

    db.asistenciaAutorizaciones = getDbArray('asistenciaAutorizaciones').filter(r =>
      !(String((r && r.owner) || '').trim().toLowerCase() === owner && String((r && r.modulo) || '').trim().toUpperCase() === modulo)
    );

    if (typeof guardarDatos === 'function') guardarDatos();
    window.renderAsistenciaAutorizaciones();
  };

  window.limpiarFiltrosAsistencia = function limpiarFiltrosAsistencia() {
    ['filtro-asistencia-desde', 'filtro-asistencia-hasta', 'filtro-asistencia-auth-desde', 'filtro-asistencia-auth-hasta'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const q = document.getElementById('asistencia-filtro-colaborador');
    if (q) q.value = '';

    window.renderAsistenciaRegistros();
    window.renderAsistenciaAutorizaciones();
  };

  window.actualizarCicloAsistencia = function actualizarCicloAsistencia() {
    if (typeof bloquearAccionAdministrativaColaborador === 'function' && bloquearAccionAdministrativaColaborador()) return;

    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;

    const owner = getOwnerActivo();
    const modulo = getModuloActivo();
    const jornadaActual = fechaNominaActual();
    const inicioAntes = String(config.cicloInicio || '').trim();
    const finAntes = String(config.cicloFin || '').trim();
    const cicloChanged = sincronizarVentanaCicloAsistencia(config);

    let cambios = 0;

    getDbArray('asistenciaRegistros').forEach(r => {
      if (String((r && r.owner) || '').trim().toLowerCase() !== owner) return;
      if (String((r && r.modulo) || '').trim().toUpperCase() !== modulo) return;
      if (r && r.salidaAt) return;
      if (!(r && r.entradaAt)) return;
      const fechaReg = String((r && r.fechaAsistencia) || '').trim();
      if (!fechaReg || fechaReg >= jornadaActual) return;

      r.estado = 'incompleto';
      r.locked = true;
      r.cicloActualizadoAt = new Date().toISOString();
      r.updatedAt = r.cicloActualizadoAt;
      cambios++;
    });

    if (cambios || cicloChanged) {
      if (typeof guardarDatos === 'function') guardarDatos();
      window.renderAsistenciaModulo();
      const inicioNuevo = String(config.cicloInicio || '').trim();
      const finNuevo = String(config.cicloFin || '').trim();
      const cicloTxt = (inicioNuevo && finNuevo) ? ` ${ymdToDisplay(finNuevo)} a ${ymdToDisplay(inicioNuevo)}.` : '';
      alert(`Ciclo de asistencia sincronizado.${cicloTxt} Registros ajustados: ${cambios}.`);
      return;
    }

    if (inicioAntes && finAntes) {
      alert(`El ciclo ya esta al dia (${ymdToDisplay(finAntes)} a ${ymdToDisplay(inicioAntes)}).`);
      return;
    }

    alert('No se detectaron cambios para actualizar el ciclo.');
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('section-asistencia-config') && typeof window.renderConfigAsistencia === 'function') {
      window.renderConfigAsistencia();
    }

    if (!window.__asistenciaCicloTimerId) {
      window.__asistenciaCicloTimerId = setInterval(() => {
        const config = getAsistenciaConfig({ createIfMissing: true });
        if (!config) return;
        const changed = sincronizarVentanaCicloAsistencia(config);
        if (!changed) return;
        if (typeof guardarDatos === 'function') guardarDatos();
        if (document.getElementById('asistencia')?.classList.contains('active')) {
          window.renderAsistenciaModulo();
        }
      }, ASISTENCIA_CICLO_TIMER_MS);
    }
  });
})();

