(() => {
  const ASISTENCIA_CLAVES_VISIBLES_MS = 5 * 60 * 1000;
  const ASISTENCIA_CICLO_DIAS = 12;
  const ASISTENCIA_CICLO_TIMER_MS = 60 * 1000;
  const ASISTENCIA_ROLES = Object.freeze({
    GERENTE: 'gerente',
    SUBGERENTE: 'subgerente',
    CAJERA: 'cajer@',
    COCINERO: 'cocinero',
    OTROS: 'otros'
  });

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

  function normalizarRolAsistencia(value = '', fallback = ASISTENCIA_ROLES.OTROS) {
    const txt = String(value || '').trim().toLowerCase();
    if (!txt) return fallback;
    if (txt === 'gerente') return ASISTENCIA_ROLES.GERENTE;
    if (txt === 'subgerente') return ASISTENCIA_ROLES.SUBGERENTE;
    if (txt === 'cajera' || txt === 'cajer@' || txt === 'cajero') return ASISTENCIA_ROLES.CAJERA;
    if (txt === 'cocinero' || txt === 'cocinera') return ASISTENCIA_ROLES.COCINERO;
    return ASISTENCIA_ROLES.OTROS;
  }

  function etiquetaRolAsistencia(rol = '') {
    const key = normalizarRolAsistencia(rol);
    if (key === ASISTENCIA_ROLES.GERENTE) return 'GERENTE';
    if (key === ASISTENCIA_ROLES.SUBGERENTE) return 'SUBGERENTE';
    if (key === ASISTENCIA_ROLES.CAJERA) return 'CAJER@';
    if (key === ASISTENCIA_ROLES.COCINERO) return 'COCINERO';
    return 'OTROS';
  }

  function esRolGerenteAsistencia(rol = '') {
    return normalizarRolAsistencia(rol) === ASISTENCIA_ROLES.GERENTE;
  }

  function normalizarIdSucursalAsistencia(value = '') {
    const clean = String(value || '').trim().toLowerCase();
    if (!clean) return '';
    return clean
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '');
  }

  function normalizarNombreSucursalAsistencia(value = '', fallback = 'sucursal principal') {
    const txt = String(value || '').trim().toLowerCase();
    if (txt) return txt;
    return String(fallback || 'sucursal principal').trim().toLowerCase();
  }

  function generarIdSucursalAsistencia(seed = '') {
    const base = normalizarIdSucursalAsistencia(seed);
    if (base) return `suc-${base}`;
    return `suc-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  function accesoAsistenciaActual() {
    const access = window.__asistenciaAccesoActual;
    if (!access || typeof access !== 'object') return null;
    const owner = String(access.owner || '').trim().toLowerCase();
    const modulo = String(access.modulo || '').trim().toUpperCase();
    if (!owner || !modulo) return null;
    if (owner !== getOwnerActivo() || modulo !== getModuloActivo()) return null;
    const sucursalId = normalizarIdSucursalAsistencia(access.sucursalId || '');
    if (!sucursalId) return null;
    return {
      owner,
      modulo,
      user: normalizarUsuarioColaborador(access.user || ''),
      nombre: normalizarNombreColaborador(access.nombre || access.user || '', access.user || ''),
      rol: normalizarRolAsistencia(access.rol, ASISTENCIA_ROLES.OTROS),
      sucursalId,
      scopeAll: access.scopeAll === true,
      source: String(access.source || '').trim().toLowerCase() || 'asistencia'
    };
  }

  function puedeGestionarColaboradoresPorRolAsistencia() {
    const access = accesoAsistenciaActual();
    if (!access) return false;
    return esRolGerenteAsistencia(access.rol);
  }

  function puedeGestionarSucursalesAsistencia() {
    const access = accesoAsistenciaActual();
    if (!access) return false;
    return access.scopeAll === true || esRolGerenteAsistencia(access.rol);
  }

  function puedeOperarSucursalAsistencia(sucursalId = '') {
    const access = accesoAsistenciaActual();
    if (!access) return false;
    const targetId = normalizarIdSucursalAsistencia(sucursalId);
    if (!targetId) return false;
    return access.scopeAll === true || esRolGerenteAsistencia(access.rol) || access.sucursalId === targetId;
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
          rol: normalizarRolAsistencia((u && (u.rolAsistencia || u.asistenciaRole)) || '', ASISTENCIA_ROLES.OTROS),
          sucursalId: normalizarIdSucursalAsistencia((u && (u.sucursalAsistenciaId || u.asistenciaSucursalId)) || ''),
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
      rol: normalizarRolAsistencia(obj.rol || obj.rolAsistencia || '', ASISTENCIA_ROLES.OTROS),
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

  function normalizarUsuariosAsistencia(values = []) {
    const list = Array.isArray(values) ? values : [];
    const map = new Map();
    list.forEach(value => {
      const user = normalizarUsuarioColaborador(value);
      if (!user) return;
      map.set(user, user);
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }

  function normalizarSucursalAsistencia(raw = {}, index = 0) {
    const obj = raw && typeof raw === 'object' ? raw : {};
    const fallbackNombre = index === 0 ? 'sucursal principal' : `sucursal ${index + 1}`;
    const nombre = normalizarNombreSucursalAsistencia(obj.nombre, fallbackNombre);
    const id = normalizarIdSucursalAsistencia(obj.id || '') || generarIdSucursalAsistencia(nombre);
    return {
      id,
      nombre,
      activo: obj.activo !== false,
      manualColaboradores: manualColaboradoresAsistencia(obj),
      sistemaColaboradoresExcluidos: normalizarUsuariosAsistencia(obj.sistemaColaboradoresExcluidos),
      colaboradores: Array.isArray(obj.colaboradores) ? obj.colaboradores : [],
      createdAt: String(obj.createdAt || '').trim() || new Date().toISOString(),
      updatedAt: String(obj.updatedAt || '').trim() || new Date().toISOString()
    };
  }

  function asegurarSucursalesAsistenciaConfig(config) {
    if (!config || typeof config !== 'object') return false;
    let changed = false;

    if (!Array.isArray(config.sucursales) || !config.sucursales.length) {
      const legacy = normalizarSucursalAsistencia({
        id: config.defaultSucursalId || 'sucursal-principal',
        nombre: 'sucursal principal',
        manualColaboradores: config.manualColaboradores,
        sistemaColaboradoresExcluidos: config.sistemaColaboradoresExcluidos,
        colaboradores: config.colaboradores
      }, 0);
      config.sucursales = [legacy];
      config.defaultSucursalId = legacy.id;
      changed = true;
    }

    const seen = new Set();
    config.sucursales = (config.sucursales || []).map((sucursal, index) => {
      const normalized = normalizarSucursalAsistencia(sucursal, index);
      if (seen.has(normalized.id)) {
        normalized.id = generarIdSucursalAsistencia(`${normalized.nombre}-${index + 1}`);
        changed = true;
      }
      seen.add(normalized.id);
      return normalized;
    });

    if (!config.sucursales.length) {
      const fallback = normalizarSucursalAsistencia({}, 0);
      config.sucursales.push(fallback);
      changed = true;
    }

    const defaultId = normalizarIdSucursalAsistencia(config.defaultSucursalId || '');
    if (!defaultId || !config.sucursales.some(s => s.id === defaultId)) {
      config.defaultSucursalId = config.sucursales[0].id;
      changed = true;
    } else {
      config.defaultSucursalId = defaultId;
    }

    if (!window.__asistenciaSucursalSeleccionada) {
      window.__asistenciaSucursalSeleccionada = config.defaultSucursalId;
    }

    return changed;
  }

  function obtenerSucursalActivaAsistencia(config, opts = {}) {
    if (!config || typeof config !== 'object') return null;
    asegurarSucursalesAsistenciaConfig(config);

    const access = accesoAsistenciaActual();
    const requestId = normalizarIdSucursalAsistencia(opts.sucursalId || '');
    const selectedId = normalizarIdSucursalAsistencia(window.__asistenciaSucursalSeleccionada || '');
    const baseId = requestId || selectedId || (access && access.sucursalId) || normalizarIdSucursalAsistencia(config.defaultSucursalId || '');

    let sucursal = (config.sucursales || []).find(s => s.id === baseId) || null;
    if (!sucursal) {
      sucursal = (config.sucursales || []).find(s => (access && s.id === access.sucursalId)) || null;
    }
    if (!sucursal) sucursal = (config.sucursales || [])[0] || null;
    if (!sucursal) return null;

    if (access && !access.scopeAll && sucursal.id !== access.sucursalId) {
      sucursal = (config.sucursales || []).find(s => s.id === access.sucursalId) || sucursal;
    }

    window.__asistenciaSucursalSeleccionada = sucursal.id;
    config.defaultSucursalId = config.defaultSucursalId || sucursal.id;
    return sucursal;
  }

  function sincronizarVistaSucursalActiva(config) {
    const sucursal = obtenerSucursalActivaAsistencia(config);
    if (!config || !sucursal) return null;
    config.manualColaboradores = sucursal.manualColaboradores;
    config.sistemaColaboradoresExcluidos = sucursal.sistemaColaboradoresExcluidos;
    config.colaboradores = sucursal.colaboradores;
    config.sucursalActivaId = sucursal.id;
    return sucursal;
  }

  function sucursalResumenColaboradores(sucursal) {
    const total = (Array.isArray(sucursal && sucursal.colaboradores) ? sucursal.colaboradores : []).filter(c => c && c.activo !== false).length;
    const totalGerentes = (Array.isArray(sucursal && sucursal.colaboradores) ? sucursal.colaboradores : [])
      .filter(c => c && c.activo !== false && esRolGerenteAsistencia(c.rol)).length;
    return { total, totalGerentes };
  }

  function catalogoColaboradoresRegistrados(owner = getOwnerActivo()) {
    return colaboradoresSistemaAsistencia(owner).map(c => ({
      user: String(c.user || '').trim().toLowerCase(),
      nombre: String(c.nombre || c.user || '').trim().toLowerCase(),
      pass: String(c.pass || '').trim(),
      activo: c.activo !== false,
      rol: normalizarRolAsistencia(c.rol, ASISTENCIA_ROLES.OTROS),
      sucursalId: normalizarIdSucursalAsistencia(c.sucursalId || '')
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
        defaultSucursalId: '',
        sucursales: [],
        manualColaboradores: [],
        sistemaColaboradoresExcluidos: [],
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
    if (!Array.isArray(config.sucursales)) config.sucursales = [];
    asegurarSucursalesAsistenciaConfig(config);
    if (!Array.isArray(config.manualColaboradores)) config.manualColaboradores = [];
    config.manualColaboradores = manualColaboradoresAsistencia(config);
    if (!Array.isArray(config.sistemaColaboradoresExcluidos)) config.sistemaColaboradoresExcluidos = [];
    config.sistemaColaboradoresExcluidos = normalizarUsuariosAsistencia(config.sistemaColaboradoresExcluidos);
    if (!Array.isArray(config.colaboradores)) config.colaboradores = [];
    sincronizarVistaSucursalActiva(config);
    sincronizarVentanaCicloAsistencia(config);

    return config;
  }

  function syncConfigColaboradores(config, opts = {}) {
    if (!config || typeof config !== 'object') return false;

    const regenerate = opts.forzarRegenerar === true;
    const sistemaCols = colaboradoresSistemaAsistencia(config.owner);
    const sistemaPorSucursal = new Map();
    const defaultSucursal = normalizarIdSucursalAsistencia(config.defaultSucursalId || '');
    sistemaCols.forEach(c => {
      const sucursalId = normalizarIdSucursalAsistencia(c.sucursalId || '') || defaultSucursal;
      if (!sucursalId) return;
      if (!sistemaPorSucursal.has(sucursalId)) sistemaPorSucursal.set(sucursalId, []);
      sistemaPorSucursal.get(sucursalId).push(c);
    });

    asegurarSucursalesAsistenciaConfig(config);
    const nowIso = new Date().toISOString();
    let changed = false;

    config.sucursales.forEach((sucursal) => {
      const prevMap = new Map((Array.isArray(sucursal.colaboradores) ? sucursal.colaboradores : []).map(c => [String((c && c.user) || '').trim().toLowerCase(), c]));
      const manualList = manualColaboradoresAsistencia(sucursal);
      sucursal.manualColaboradores = manualList;
      sucursal.sistemaColaboradoresExcluidos = normalizarUsuariosAsistencia(sucursal.sistemaColaboradoresExcluidos);

      const sistemaList = Array.isArray(sistemaPorSucursal.get(sucursal.id)) ? sistemaPorSucursal.get(sucursal.id) : [];
      const sistemaUsers = new Set(sistemaList.map(c => String((c && c.user) || '').trim().toLowerCase()).filter(Boolean));
      sucursal.sistemaColaboradoresExcluidos = sucursal.sistemaColaboradoresExcluidos
        .filter(user => sistemaUsers.has(String(user || '').trim().toLowerCase()));
      const excluidosSistema = new Set(sucursal.sistemaColaboradoresExcluidos);

      const sources = new Map();
      sistemaList.forEach(c => {
        const user = String((c && c.user) || '').trim().toLowerCase();
        if (!user || excluidosSistema.has(user)) return;
        sources.set(c.user, { ...c, sucursalId: sucursal.id });
      });

      manualList.forEach(c => {
        const prevSource = sources.get(c.user) || null;
        if (prevSource) {
          sources.set(c.user, {
            ...prevSource,
            nombre: c.nombre || prevSource.nombre,
            activo: c.activo !== false,
            pass: c.pass || prevSource.pass || '',
            rol: normalizarRolAsistencia(c.rol || prevSource.rol || '', ASISTENCIA_ROLES.OTROS),
            source: 'mixto',
            esIndependiente: false
          });
          return;
        }
        sources.set(c.user, { ...c, rol: normalizarRolAsistencia(c.rol || '', ASISTENCIA_ROLES.OTROS), source: 'manual', esIndependiente: true, sucursalId: sucursal.id });
      });

      const next = [...sources.values()]
        .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')))
        .map(c => {
          const user = String(c.user || '').trim().toLowerCase();
          const prev = prevMap.get(user) || {};
          let clave = String(prev.clave || '').trim();
          if (regenerate || !/^\d{5}$/.test(clave)) {
            clave = generarClave(`${config.owner}|${config.modulo}|${sucursal.id}|${user}`);
          }
          return {
            user,
            nombre: String(c.nombre || user).trim().toLowerCase(),
            activo: c.activo !== false,
            pass: String(c.pass || prev.pass || '').trim(),
            rol: normalizarRolAsistencia(c.rol || prev.rol || '', ASISTENCIA_ROLES.OTROS),
            sucursalId: sucursal.id,
            source: String(c.source || prev.source || '').trim() || 'manual',
            esIndependiente: c.esIndependiente === true,
            clave,
            updatedAt: String(prev.updatedAt || c.updatedAt || nowIso)
          };
        });

      const sucursalChanged = JSON.stringify(sucursal.colaboradores || []) !== JSON.stringify(next)
        || JSON.stringify(sucursal.manualColaboradores || []) !== JSON.stringify(manualList)
        || JSON.stringify(sucursal.sistemaColaboradoresExcluidos || []) !== JSON.stringify(normalizarUsuariosAsistencia(sucursal.sistemaColaboradoresExcluidos));
      if (sucursalChanged) {
        sucursal.colaboradores = next;
        sucursal.updatedAt = nowIso;
        changed = true;
      }
    });

    const active = sincronizarVistaSucursalActiva(config);
    if (active && (!String(config.defaultSucursalId || '').trim() || !(config.sucursales || []).some(s => s.id === config.defaultSucursalId))) {
      config.defaultSucursalId = active.id;
      changed = true;
    }
    if (changed) config.updatedAt = nowIso;
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
    const sucursal = obtenerSucursalActivaAsistencia(config);
    const resumen = sucursalResumenColaboradores(sucursal);
    const estado = config.activo ? 'ACTIVO' : 'INACTIVO';
    const auth = config.requerirClave ? 'ON' : 'OFF';
    const colabs = resumen.total;
    const inicio = String(config.cicloInicio || '').trim();
    const fin = String(config.cicloFin || '').trim();
    const sucursalTxt = sucursal ? ` - Sucursal ${String(sucursal.nombre || sucursal.id).toUpperCase()}` : '';
    const cicloTxt = inicio && fin ? ` - Ciclo ${ymdToDisplay(fin)} a ${ymdToDisplay(inicio)}` : '';
    return `Modulo ${estado} - Autorizacion ${auth} - Corte ${horaLimiteNormalizada(config.horaLimiteSalida)}:00 - Colaboradores ${colabs}${sucursalTxt}${cicloTxt}`;
  }
  function setRegistroEstado(msg, color = '#57606f') {
    const el = document.getElementById('asistencia-registro-estado');
    if (!el) return;
    el.textContent = String(msg || '');
    el.style.color = color;
  }

  function sucursalIdDeRegistroAsistencia(record, config = null) {
    const fromRecord = normalizarIdSucursalAsistencia((record && (record.sucursalId || record.asistenciaSucursalId)) || '');
    if (fromRecord) return fromRecord;
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    if (!cfg) return '';
    return normalizarIdSucursalAsistencia(cfg.defaultSucursalId || '');
  }

  function sucursalIdActivaAsistencia(config = null) {
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    if (!cfg) return '';
    const sucursal = obtenerSucursalActivaAsistencia(cfg);
    return normalizarIdSucursalAsistencia((sucursal && sucursal.id) || '');
  }

  function normalizarRegistrosConSucursal(config) {
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    if (!cfg) return false;
    const defaultSucursalId = normalizarIdSucursalAsistencia(cfg.defaultSucursalId || '');
    if (!defaultSucursalId) return false;
    let changed = false;
    getDbArray('asistenciaRegistros').forEach((r) => {
      if (String((r && r.owner) || '').trim().toLowerCase() !== cfg.owner) return;
      if (String((r && r.modulo) || '').trim().toUpperCase() !== cfg.modulo) return;
      if (!normalizarIdSucursalAsistencia((r && (r.sucursalId || r.asistenciaSucursalId)) || '')) {
        r.sucursalId = defaultSucursalId;
        changed = true;
      }
    });
    getDbArray('asistenciaAutorizaciones').forEach((r) => {
      if (String((r && r.owner) || '').trim().toLowerCase() !== cfg.owner) return;
      if (String((r && r.modulo) || '').trim().toUpperCase() !== cfg.modulo) return;
      if (!normalizarIdSucursalAsistencia((r && (r.sucursalId || r.asistenciaSucursalId)) || '')) {
        r.sucursalId = defaultSucursalId;
        changed = true;
      }
    });
    return changed;
  }

  function puedeVerRegistro(r, config = null) {
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    if (!cfg) return false;
    const ownerOk = String((r && r.owner) || '').trim().toLowerCase() === getOwnerActivo();
    const moduloRaw = String((r && r.modulo) || '').trim();
    const moduloOk = typeof moduloPerteneceVista === 'function'
      ? moduloPerteneceVista(moduloRaw)
      : (moduloRaw.toUpperCase() === getModuloActivo());
    if (!(ownerOk && moduloOk)) return false;
    const sucursalTarget = sucursalIdActivaAsistencia(cfg);
    if (!sucursalTarget) return true;
    return sucursalIdDeRegistroAsistencia(r, cfg) === sucursalTarget;
  }

  function registrosAsistenciaVisibles(config = null) {
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    return getDbArray('asistenciaRegistros').filter(r => puedeVerRegistro(r, cfg) && (!!(r && r.entradaAt) || !!(r && r.salidaAt)));
  }

  function autorizacionesAsistenciaVisibles(config = null) {
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    return getDbArray('asistenciaAutorizaciones').filter(r => puedeVerRegistro(r, cfg));
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

  function buscarRegistroAbierto(colaboradorUser, fechaOperativa = '', config = null) {
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    if (!cfg) return null;
    const owner = getOwnerActivo();
    const modulo = getModuloActivo();
    const sucursalId = sucursalIdActivaAsistencia(cfg);
    const user = String(colaboradorUser || '').trim().toLowerCase();

    const abiertos = getDbArray('asistenciaRegistros').filter(r =>
      String((r && r.owner) || '').trim().toLowerCase() === owner &&
      String((r && r.modulo) || '').trim().toUpperCase() === modulo &&
      sucursalIdDeRegistroAsistencia(r, cfg) === sucursalId &&
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
    const config = getAsistenciaConfig({ createIfMissing: true });
    const sucursalId = sucursalIdActivaAsistencia(config);
    const now = new Date();
    getDbArray('asistenciaAutorizaciones').push({
      id: `ASAUTH-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      owner: getOwnerActivo(),
      modulo: getModuloActivo(),
      sucursalId,
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
    const config = getAsistenciaConfig({ createIfMissing: true });
    const sucursalId = sucursalIdActivaAsistencia(config);
    const owner = getOwnerActivo();
    const modulo = getModuloActivo();
    const user = String(colaboradorUser || '').trim().toLowerCase();
    const fecha = String(fechaAsistencia || '').trim();
    return getDbArray('asistenciaRegistros').find(r =>
      String((r && r.owner) || '').trim().toLowerCase() === owner &&
      String((r && r.modulo) || '').trim().toUpperCase() === modulo &&
      sucursalIdDeRegistroAsistencia(r, config) === sucursalId &&
      String((r && r.colaboradorUser) || '').trim().toLowerCase() === user &&
      String((r && r.fechaAsistencia) || '').trim() === fecha
    ) || null;
  }

  function colaboradoresActivosVisibles(config) {
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    if (!cfg) return [];
    const sucursal = obtenerSucursalActivaAsistencia(cfg);
    let cols = (sucursal && Array.isArray(sucursal.colaboradores) ? sucursal.colaboradores : []).filter(c => c && c.activo !== false);
    const access = accesoAsistenciaActual();
    if (access && !access.scopeAll && !esRolGerenteAsistencia(access.rol)) {
      cols = cols.filter(c => String(c.user || '').trim().toLowerCase() === access.user);
    } else if (typeof esColaboradorSesion !== 'undefined' && esColaboradorSesion) {
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

  function colaboradoresRemoviblesAsistencia(config) {
    const sucursal = obtenerSucursalActivaAsistencia(config);
    const list = Array.isArray(sucursal && sucursal.colaboradores) ? sucursal.colaboradores : [];
    return list
      .map(c => ({
        user: String((c && c.user) || '').trim().toLowerCase(),
        nombre: String((c && (c.nombre || c.user)) || '').trim().toLowerCase(),
        source: String((c && c.source) || '').trim().toLowerCase(),
        rol: normalizarRolAsistencia(c && c.rol, ASISTENCIA_ROLES.OTROS),
        activo: c && c.activo !== false
      }))
      .filter(c => !!c.user)
      .sort((a, b) => String(a.nombre || a.user).localeCompare(String(b.nombre || b.user)));
  }

  function aplicarRestriccionesVisuales() {
    const puedeGestionarColabs = puedeGestionarColaboradoresPorRolAsistencia();
    const puedeGestionarSucursales = puedeGestionarSucursalesAsistencia();
    document.querySelectorAll('#asistencia button[onclick*="limpiarRegistrosAsistencia"], #asistencia button[onclick*="limpiarAutorizacionesAsistencia"], #asistencia button[onclick*="actualizarCicloAsistencia"]').forEach(btn => {
      btn.style.display = puedeGestionarColabs ? '' : 'none';
    });
    const cardAuth = document.getElementById('asistencia-autorizaciones-card');
    if (cardAuth) cardAuth.style.display = puedeGestionarColabs ? '' : 'none';
    const addSucursalBtn = document.getElementById('btn-asistencia-add-colab');
    if (addSucursalBtn) addSucursalBtn.style.display = puedeGestionarSucursales ? '' : 'none';
    const removeSucursalBtn = document.getElementById('btn-asistencia-remove-sucursal');
    if (removeSucursalBtn) removeSucursalBtn.style.display = puedeGestionarSucursales ? '' : 'none';
    const addColabBtn = document.getElementById('btn-asistencia-add-colab-sucursal');
    if (addColabBtn) addColabBtn.style.display = puedeGestionarColabs ? '' : 'none';
    const removeColabBtn = document.getElementById('btn-asistencia-remove-colab');
    if (removeColabBtn) removeColabBtn.style.display = puedeGestionarColabs ? '' : 'none';
  }

  function actualizarEstadoBotonEliminarAsistencia(config) {
    const removeBtn = document.getElementById('btn-asistencia-remove-colab');
    if (!removeBtn) return;

    const removibles = colaboradoresRemoviblesAsistencia(config);
    const selected = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    const colab = removibles.find(c => c.user === selected) || null;

    removeBtn.disabled = removibles.length === 0;
    if (!removibles.length) {
      removeBtn.title = 'No hay colaboradores en asistencia para eliminar.';
      return;
    }

    removeBtn.title = colab
      ? `Eliminar colaborador de asistencia: ${String(colab.nombre || colab.user || selected).toUpperCase()}`
      : 'Selecciona un colaborador para eliminarlo de asistencia';
  }

  function renderEstado(config) {
    const status = document.getElementById('asistencia-status-modulo');
    const sucursal = obtenerSucursalActivaAsistencia(config);
    const sucursalLabel = document.getElementById('asistencia-sucursal-actual-label');
    const tableroSucursal = document.getElementById('asistencia-tablero-sucursal');
    const sucursalTexto = sucursal ? String(sucursal.nombre || sucursal.id).toUpperCase() : '---';
    if (sucursalLabel) sucursalLabel.textContent = `Sucursal: ${sucursalTexto}`;
    if (tableroSucursal) tableroSucursal.textContent = `Sucursal: ${sucursalTexto}`;
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

  function renderListaSucursalesAsistencia(config) {
    const box = document.getElementById('asistencia-sucursales-lista');
    if (!box) return;
    const sucursales = Array.isArray(config && config.sucursales) ? config.sucursales : [];
    const access = accesoAsistenciaActual();

    let visibles = sucursales;
    if (access && !access.scopeAll && !esRolGerenteAsistencia(access.rol)) {
      visibles = sucursales.filter(s => s.id === access.sucursalId);
    }

    if (!visibles.length) {
      box.innerHTML = '<div style="font-size:12px; color:#777;">Sin sucursales registradas.</div>';
      return;
    }

    const sucursalActiva = obtenerSucursalActivaAsistencia(config);
    box.innerHTML = visibles.map((s) => {
      const active = (sucursalActiva && sucursalActiva.id === s.id) ? ' active' : '';
      const resumen = sucursalResumenColaboradores(s);
      const nombre = String(s.nombre || s.id).toUpperCase();
      const meta = `${resumen.total} colaborador(es) - ${resumen.totalGerentes} gerente(s)`;
      const sid = String(s.id || '').replace(/'/g, "\\'");
      return `<button type="button" class="asistencia-colab-btn${active}" onclick="seleccionarSucursalAsistencia('${sid}')">
        ${nombre}
        <span class="asistencia-colab-meta">${meta}</span>
      </button>`;
    }).join('');
  }

  function renderListaColaboradoresAsistencia(config) {
    const box = document.getElementById('asistencia-colaboradores-lista');
    if (!box) return;

    const cols = colaboradoresActivosVisibles(config);
    const current = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();

    if (cols.length === 0) {
      box.innerHTML = '<div style="font-size:12px; color:#777;">Sin colaboradores activos para asistencia.</div>';
      window.__asistenciaColabSeleccionado = '';
      actualizarEstadoBotonEliminarAsistencia(config);
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
        .filter(r => String((r && r.colaboradorUser) || '').trim().toLowerCase() === user && puedeVerRegistro(r, config))
        .sort((a, b) => timeMs((b && b.updatedAt) || (b && b.entradaAt)) - timeMs((a && a.updatedAt) || (a && a.entradaAt)))[0];
      const estado = ultima ? estadoRegistroTexto(ultima) : 'SIN REGISTROS';
      const tipo = c && c.esIndependiente ? 'INDEPENDIENTE' : 'VINCULADO';
      const rol = etiquetaRolAsistencia(c && c.rol);
      return `<button type="button" class="asistencia-colab-btn${active}" onclick="seleccionarColaboradorAsistencia('${user.replace(/'/g, "\\'")}')">
        ${String(c.nombre || user).toUpperCase()}
        <span class="asistencia-colab-meta">Rol: ${rol} - Estado: ${estado} - ${tipo}</span>
      </button>`;
    }).join('');
    actualizarEstadoBotonEliminarAsistencia(config);
  }

  function renderTableroColaboradorAsistencia(config) {
    const tbody = document.getElementById('asistencia-tablero-body');
    const head = document.getElementById('asistencia-tablero-header');
    const fechaLabel = document.getElementById('asistencia-fecha-operativa');
    if (!tbody || !config) return;
    sincronizarVentanaCicloAsistencia(config);
    const access = accesoAsistenciaActual();
    const sucursal = obtenerSucursalActivaAsistencia(config);

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

    if (head) {
      const sucursalTxt = sucursal ? ` - Sucursal ${String(sucursal.nombre || sucursal.id).toUpperCase()}` : '';
      head.textContent = `Colaborador: ${String(colaborador.nombre || colaborador.user).toUpperCase()}${sucursalTxt}`;
    }

    const fechas = construirFechasTablero(config);
    tbody.innerHTML = fechas.map(fecha => {
      const registro = getRegistroPorFecha(colaborador.user, fecha);
      const entrada = horaRegistroTexto(registro, 'entradaAt', 'entradaHora');
      const salida = horaRegistroTexto(registro, 'salidaAt', 'salidaHora');
      const total = registro ? totalHorasTexto(registro) : '---';
      const permitidoPorRol = !access || access.scopeAll || esRolGerenteAsistencia(access.rol) || String(access.user || '').trim().toLowerCase() === String(colaborador.user || '').trim().toLowerCase();
      const puedeEntrada = permitidoPorRol && config.activo && fecha === jornada && !(registro && registro.entradaAt);
      const puedeSalida = permitidoPorRol && config.activo && fecha === jornada && !!(registro && registro.entradaAt) && !(registro && registro.salidaAt);
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

  window.seleccionarSucursalAsistencia = function seleccionarSucursalAsistencia(sucursalId = '') {
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;
    const targetId = normalizarIdSucursalAsistencia(sucursalId || '');
    if (!targetId) return;
    if (!puedeOperarSucursalAsistencia(targetId)) {
      alert('No tienes acceso a esta sucursal.');
      return;
    }
    window.__asistenciaSucursalSeleccionada = targetId;
    syncConfigColaboradores(config);
    const cols = colaboradoresActivosVisibles(config);
    const selected = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    if (!cols.some(c => String(c.user || '').trim().toLowerCase() === selected)) {
      window.__asistenciaColabSeleccionado = cols.length ? String(cols[0].user || '').trim().toLowerCase() : '';
    }
    window.renderAsistenciaModulo();
  };

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

  window.cerrarModalEliminarColaboradorAsistencia = function cerrarModalEliminarColaboradorAsistencia() {
    const modal = document.getElementById('modal-asistencia-colaborador-remove');
    if (!modal) return;
    modal.style.display = 'none';
  };

  window.cerrarModalSucursalAsistencia = function cerrarModalSucursalAsistencia() {
    const modal = document.getElementById('modal-asistencia-sucursal');
    if (!modal) return;
    modal.style.display = 'none';
  };

  window.abrirGestionSucursalesAsistencia = function abrirGestionSucursalesAsistencia() {
    if (!puedeGestionarSucursalesAsistencia()) {
      alert('Solo el rol Gerente puede crear sucursales.');
      return;
    }
    const modal = document.getElementById('modal-asistencia-sucursal');
    const input = document.getElementById('asistencia-sucursal-nombre');
    if (!modal || !input) return;
    input.value = '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 20);
  };

  window.guardarSucursalAsistencia = function guardarSucursalAsistencia() {
    if (!puedeGestionarSucursalesAsistencia()) {
      alert('No tienes permisos para crear sucursales.');
      return false;
    }
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return false;
    const input = document.getElementById('asistencia-sucursal-nombre');
    const nombre = normalizarNombreSucursalAsistencia((input && input.value) || '', '');
    if (!nombre) {
      alert('Ingresa el nombre de la sucursal.');
      return false;
    }
    const existe = (config.sucursales || []).some(s => String((s && s.nombre) || '').trim().toLowerCase() === nombre);
    if (existe) {
      alert('Ya existe una sucursal con ese nombre.');
      return false;
    }
    const nueva = normalizarSucursalAsistencia({
      id: generarIdSucursalAsistencia(nombre),
      nombre,
      manualColaboradores: [],
      sistemaColaboradoresExcluidos: [],
      colaboradores: []
    }, (config.sucursales || []).length);
    if (!Array.isArray(config.sucursales)) config.sucursales = [];
    config.sucursales.push(nueva);
    config.defaultSucursalId = config.defaultSucursalId || nueva.id;
    window.__asistenciaSucursalSeleccionada = nueva.id;
    syncConfigColaboradores(config);
    config.updatedAt = new Date().toISOString();
    if (typeof guardarDatos === 'function') guardarDatos();
    window.cerrarModalSucursalAsistencia();
    window.renderAsistenciaModulo();
    if (typeof window.renderConfigAsistencia === 'function') window.renderConfigAsistencia();
    return true;
  };

  window.eliminarSucursalAsistenciaSeleccionada = function eliminarSucursalAsistenciaSeleccionada() {
    if (!puedeGestionarSucursalesAsistencia()) {
      alert('No tienes permisos para eliminar sucursales.');
      return false;
    }
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config || !Array.isArray(config.sucursales)) return false;
    const actual = obtenerSucursalActivaAsistencia(config);
    if (!actual) return false;
    if (config.sucursales.length <= 1) {
      alert('Debe existir al menos una sucursal de asistencia.');
      return false;
    }
    const nombre = String(actual.nombre || actual.id).toUpperCase();
    if (!confirm(`Eliminar la sucursal ${nombre}?\n\nSe eliminarán sus colaboradores y registros de asistencia de esa sucursal.`)) return false;

    const targetId = String(actual.id || '').trim().toLowerCase();
    config.sucursales = config.sucursales.filter(s => String((s && s.id) || '').trim().toLowerCase() !== targetId);
    if (!config.sucursales.length) {
      config.sucursales = [normalizarSucursalAsistencia({}, 0)];
    }
    if (!config.sucursales.some(s => s.id === config.defaultSucursalId)) {
      config.defaultSucursalId = config.sucursales[0].id;
    }
    const sucursalFallbackId = config.sucursales[0].id;
    window.__asistenciaSucursalSeleccionada = sucursalFallbackId;

    // Reasigna referencias de usuarios vinculados a la sucursal eliminada para evitar IDs colgados.
    getDbArray('usuarios').forEach((u) => {
      if (!u || String((u && u.role) || '').trim().toLowerCase() !== 'colaborador') return;
      if (String((u && u.owner) || '').trim().toLowerCase() !== String(config.owner || '').trim().toLowerCase()) return;
      const sid = normalizarIdSucursalAsistencia((u && (u.sucursalAsistenciaId || u.asistenciaSucursalId)) || '');
      if (sid !== targetId) return;
      u.sucursalAsistenciaId = sucursalFallbackId;
      if (Object.prototype.hasOwnProperty.call(u, 'asistenciaSucursalId')) u.asistenciaSucursalId = sucursalFallbackId;
      u.updatedAt = new Date().toISOString();
    });

    db.asistenciaRegistros = getDbArray('asistenciaRegistros').filter(r =>
      !(String((r && r.owner) || '').trim().toLowerCase() === config.owner &&
        String((r && r.modulo) || '').trim().toUpperCase() === config.modulo &&
        sucursalIdDeRegistroAsistencia(r, config) === targetId)
    );
    db.asistenciaAutorizaciones = getDbArray('asistenciaAutorizaciones').filter(r =>
      !(String((r && r.owner) || '').trim().toLowerCase() === config.owner &&
        String((r && r.modulo) || '').trim().toUpperCase() === config.modulo &&
        sucursalIdDeRegistroAsistencia(r, config) === targetId)
    );

    if (window.__asistenciaAccesoActual && String((window.__asistenciaAccesoActual && window.__asistenciaAccesoActual.sucursalId) || '').trim().toLowerCase() === targetId) {
      window.__asistenciaAccesoActual = null;
      window.__asistenciaRequiereLogin = true;
    }

    syncConfigColaboradores(config);
    config.updatedAt = new Date().toISOString();
    if (typeof guardarDatos === 'function') guardarDatos();
    window.renderAsistenciaModulo();
    if (typeof window.renderConfigAsistencia === 'function') window.renderConfigAsistencia();
    return true;
  };

  function usuariosSeleccionadosEliminarAsistenciaModal() {
    return [...document.querySelectorAll('#asistencia-colab-remove-lista input[name="asistencia-colab-remove-item"]:checked')]
      .map(input => String((input && input.value) || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function actualizarEstadoSeleccionEliminarAsistenciaModal() {
    const checkAll = document.getElementById('asistencia-colab-remove-select-all');
    const hint = document.getElementById('asistencia-colab-remove-hint');
    const btnConfirm = document.getElementById('btn-asistencia-colab-remove-confirm');
    const checks = [...document.querySelectorAll('#asistencia-colab-remove-lista input[name="asistencia-colab-remove-item"]')];
    const selected = checks.filter(input => !!(input && input.checked));

    if (checkAll) {
      checkAll.disabled = checks.length === 0;
      checkAll.checked = checks.length > 0 && selected.length === checks.length;
      checkAll.indeterminate = selected.length > 0 && selected.length < checks.length;
    }
    if (btnConfirm) btnConfirm.disabled = selected.length === 0;
    if (hint) {
      if (!checks.length) {
        hint.textContent = 'No hay colaboradores en asistencia para eliminar.';
      } else if (!selected.length) {
        hint.textContent = 'Seleccione al menos un colaborador para eliminar.';
      } else {
        hint.textContent = `${selected.length} colaborador(es) seleccionado(s) para eliminar.`;
      }
    }
  }

  function renderListaEliminarAsistenciaModal(removibles = [], preselectedUser = '') {
    const box = document.getElementById('asistencia-colab-remove-lista');
    if (!box) return;

    if (!Array.isArray(removibles) || !removibles.length) {
      box.innerHTML = '<div style="font-size:12px; color:#777;">Sin colaboradores en asistencia.</div>';
      actualizarEstadoSeleccionEliminarAsistenciaModal();
      return;
    }

    const pre = String(preselectedUser || '').trim().toLowerCase();
    box.innerHTML = removibles.map(c => {
      const user = String((c && c.user) || '').trim().toLowerCase();
      const nombre = String((c && (c.nombre || c.user)) || user).toUpperCase();
      const source = String((c && c.source) || '').trim().toLowerCase();
      const tipo = source === 'mixto' ? 'VINCULADO + ANADIDO' : (source === 'manual' ? 'ANADIDO' : 'VINCULADO');
      const estado = c && c.activo !== false ? 'ACTIVO' : 'INACTIVO';
      const rol = etiquetaRolAsistencia(c && c.rol);
      const checked = user === pre ? ' checked' : '';
      const userAttr = user.replace(/"/g, '&quot;');
      return `<label class="asistencia-colab-remove-item">
        <input type="checkbox" name="asistencia-colab-remove-item" value="${userAttr}"${checked} onchange="actualizarSeleccionColaboradoresAsistencia()">
        <span class="asistencia-colab-remove-item-text"><strong>${nombre}</strong><span class="asistencia-colab-remove-item-meta">${rol} - ${tipo} - ${estado}</span></span>
      </label>`;
    }).join('');
    actualizarEstadoSeleccionEliminarAsistenciaModal();
  }

  window.actualizarSeleccionColaboradoresAsistencia = function actualizarSeleccionColaboradoresAsistencia() {
    actualizarEstadoSeleccionEliminarAsistenciaModal();
  };

  window.toggleSeleccionMasivaColaboradoresAsistencia = function toggleSeleccionMasivaColaboradoresAsistencia(toggle = false) {
    const mark = !!toggle;
    document.querySelectorAll('#asistencia-colab-remove-lista input[name="asistencia-colab-remove-item"]').forEach(input => {
      input.checked = mark;
    });
    actualizarEstadoSeleccionEliminarAsistenciaModal();
  };

  window.abrirModalEliminarColaboradorAsistencia = function abrirModalEliminarColaboradorAsistencia() {
    if (!puedeGestionarColaboradoresPorRolAsistencia()) {
      return alert('Solo el rol Gerente puede eliminar colaboradores de asistencia.');
    }

    const modal = document.getElementById('modal-asistencia-colaborador-remove');
    const checkAll = document.getElementById('asistencia-colab-remove-select-all');
    const hint = document.getElementById('asistencia-colab-remove-hint');
    const btnConfirm = document.getElementById('btn-asistencia-colab-remove-confirm');
    if (!modal || !checkAll || !hint || !btnConfirm) return;

    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return alert('No se pudo cargar la configuracion de asistencia.');

    const removibles = colaboradoresRemoviblesAsistencia(config);
    const selected = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    const preselected = removibles.find(c => c.user === selected) || removibles[0] || null;
    renderListaEliminarAsistenciaModal(removibles, String((preselected && preselected.user) || '').trim().toLowerCase());
    if (!removibles.length) hint.textContent = 'No hay colaboradores en asistencia para eliminar.';
    if (!removibles.length) btnConfirm.disabled = true;

    modal.style.display = 'flex';
    setTimeout(() => {
      const first = document.querySelector('#asistencia-colab-remove-lista input[name="asistencia-colab-remove-item"]');
      if (first) first.focus();
      else btnConfirm.focus();
    }, 20);
  };

  window.eliminarColaboradoresAsistenciaMasivo = function eliminarColaboradoresAsistenciaMasivo(colaboradores = []) {
    if (!puedeGestionarColaboradoresPorRolAsistencia()) {
      return { ok: false, reason: 'forbidden' };
    }

    const usuarios = [...new Set((Array.isArray(colaboradores) ? colaboradores : [colaboradores])
      .map(user => String(user || '').trim().toLowerCase())
      .filter(Boolean))];
    if (!usuarios.length) return { ok: false, reason: 'empty' };

    const config = getAsistenciaConfig({ createIfMissing: true });
    const sucursal = obtenerSucursalActivaAsistencia(config);
    if (!config || !sucursal || !Array.isArray(sucursal.manualColaboradores)) {
      return { ok: false, reason: 'config' };
    }

    const prevCols = new Map((sucursal.colaboradores || [])
      .map(c => [String((c && c.user) || '').trim().toLowerCase(), c || {}]));
    const presentes = usuarios.filter(user => prevCols.has(user));
    if (!presentes.length) return { ok: false, reason: 'none-present' };

    const manualUsers = new Set((sucursal.manualColaboradores || [])
      .map(c => String((c && c.user) || '').trim().toLowerCase())
      .filter(Boolean));

    const excluidosPrevios = new Set(normalizarUsuariosAsistencia(sucursal.sistemaColaboradoresExcluidos));
    const nextExcluidos = new Set(excluidosPrevios);
    const targetManualRemove = new Set();

    let removedManual = 0;
    let ocultadosVinculados = 0;

    presentes.forEach(user => {
      const source = String((prevCols.get(user) && prevCols.get(user).source) || '').trim().toLowerCase();
      if (source === 'manual') {
        if (manualUsers.has(user)) {
          targetManualRemove.add(user);
          removedManual++;
        }
        return;
      }
      if (source === 'mixto') {
        if (manualUsers.has(user)) {
          targetManualRemove.add(user);
          removedManual++;
        }
        if (!nextExcluidos.has(user)) nextExcluidos.add(user);
        ocultadosVinculados++;
        return;
      }
      if (source === 'sistema') {
        if (!nextExcluidos.has(user)) nextExcluidos.add(user);
        ocultadosVinculados++;
      }
    });

    const huboCambioManual = targetManualRemove.size > 0;
    if (huboCambioManual) {
      sucursal.manualColaboradores = sucursal.manualColaboradores.filter(c => {
        const user = String((c && c.user) || '').trim().toLowerCase();
        return !targetManualRemove.has(user);
      });
    }

    const excluidosPrevList = normalizarUsuariosAsistencia(sucursal.sistemaColaboradoresExcluidos);
    const excluidosNextList = normalizarUsuariosAsistencia([...nextExcluidos.values()]);
    const huboCambioExclusion = JSON.stringify(excluidosPrevList) !== JSON.stringify(excluidosNextList);
    if (huboCambioExclusion) sucursal.sistemaColaboradoresExcluidos = excluidosNextList;

    if (!huboCambioManual && !huboCambioExclusion) {
      return { ok: false, reason: 'none-changed' };
    }

    // Limpieza de datos de asistencia para evitar referencias enganchadas al colaborador removido.
    const ownerKey = String(config.owner || '').trim().toLowerCase();
    const moduloKey = String(config.modulo || '').trim().toUpperCase();
    const sucursalId = String((sucursal && sucursal.id) || '').trim().toLowerCase();
    const removidosSet = new Set(presentes.map(user => String(user || '').trim().toLowerCase()));
    db.asistenciaRegistros = getDbArray('asistenciaRegistros').filter((r) => {
      if (String((r && r.owner) || '').trim().toLowerCase() !== ownerKey) return true;
      if (String((r && r.modulo) || '').trim().toUpperCase() !== moduloKey) return true;
      if (sucursalIdDeRegistroAsistencia(r, config) !== sucursalId) return true;
      const userReg = String((r && r.colaboradorUser) || '').trim().toLowerCase();
      return !removidosSet.has(userReg);
    });
    db.asistenciaAutorizaciones = getDbArray('asistenciaAutorizaciones').filter((r) => {
      if (String((r && r.owner) || '').trim().toLowerCase() !== ownerKey) return true;
      if (String((r && r.modulo) || '').trim().toUpperCase() !== moduloKey) return true;
      if (sucursalIdDeRegistroAsistencia(r, config) !== sucursalId) return true;
      const userReg = String((r && r.colaboradorUser) || '').trim().toLowerCase();
      return !removidosSet.has(userReg);
    });

    syncConfigColaboradores(config);
    config.updatedAt = new Date().toISOString();
    if (typeof guardarDatos === 'function') guardarDatos();

    const selected = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    const removidosAsistencia = new Set(presentes);
    if (selected && removidosAsistencia.has(selected)) {
      const stillExists = (sucursal.colaboradores || []).some(c => String((c && c.user) || '').trim().toLowerCase() === selected);
      if (!stillExists) window.__asistenciaColabSeleccionado = '';
    }

    window.renderAsistenciaModulo();
    if (typeof window.renderConfigAsistencia === 'function') window.renderConfigAsistencia();

    return {
      ok: true,
      removidos: presentes.length,
      removidosManual: removedManual,
      ocultadosVinculados,
      solicitados: usuarios.length
    };
  };

  window.eliminarColaboradorAsistenciaDesdeModal = function eliminarColaboradorAsistenciaDesdeModal() {
    const seleccionados = usuariosSeleccionadosEliminarAsistenciaModal();
    if (!seleccionados.length) {
      alert('Selecciona al menos un colaborador para eliminar.');
      return false;
    }

    const config = getAsistenciaConfig({ createIfMissing: true });
    const nombres = seleccionados.map(user => {
      const colab = (config && Array.isArray(config.colaboradores))
        ? config.colaboradores.find(c => String((c && c.user) || '').trim().toLowerCase() === user)
        : null;
      return String((colab && (colab.nombre || colab.user)) || user).toUpperCase();
    });
    const preview = nombres.slice(0, 6).join(', ');
    const extra = nombres.length > 6 ? ` y ${nombres.length - 6} mas` : '';
    const msg = seleccionados.length === 1
      ? `Eliminar al colaborador ${preview} de asistencia?`
      : `Eliminar ${seleccionados.length} colaboradores de asistencia?\n\n${preview}${extra}`;
    if (!confirm(msg)) return false;

    const result = window.eliminarColaboradoresAsistenciaMasivo(seleccionados);
    if (!result || !result.ok) {
      alert('No se pudo completar la eliminacion masiva.');
      return false;
    }

    const detalleVinculados = result.ocultadosVinculados > 0
      ? ` ${result.ocultadosVinculados} colaborador(es) vinculados fueron desacoplados de asistencia.`
      : '';
    alert(`Eliminacion completada. Removidos de asistencia: ${result.removidos}.${detalleVinculados}`);
    window.cerrarModalEliminarColaboradorAsistencia();
    return true;
  };

  window.autocompletarAsistenciaColaboradorDesdeSelect = function autocompletarAsistenciaColaboradorDesdeSelect() {
    const select = document.getElementById('asistencia-colab-existente');
    const inNombre = document.getElementById('asistencia-colab-nombre');
    const inPass = document.getElementById('asistencia-colab-pass');
    const inActivo = document.getElementById('asistencia-colab-activo');
    const inRol = document.getElementById('asistencia-colab-rol');
    if (!select || !inNombre || !inPass || !inActivo) return;

    const user = String(select.value || '').trim().toLowerCase();
    if (!user) {
      inNombre.value = '';
      inPass.value = '';
      inActivo.checked = true;
      if (inRol) inRol.value = ASISTENCIA_ROLES.OTROS;
      return;
    }

    const list = Array.isArray(window.__asistenciaCatalogoColaboradores) ? window.__asistenciaCatalogoColaboradores : [];
    const found = list.find(c => String((c && c.user) || '').trim().toLowerCase() === user) || null;
    if (!found) return;

    inNombre.value = String(found.nombre || user).trim().toLowerCase();
    inPass.value = String(found.pass || '').trim();
    inActivo.checked = found.activo !== false;
    if (inRol) inRol.value = normalizarRolAsistencia(found.rol, ASISTENCIA_ROLES.OTROS);
  };

  window.abrirGestionColaboradoresSucursalAsistencia = function abrirGestionColaboradoresSucursalAsistencia() {
    if (!puedeGestionarColaboradoresPorRolAsistencia()) {
      return alert('Solo el rol Gerente puede añadir colaboradores en la sucursal.');
    }

    const config = getAsistenciaConfig({ createIfMissing: true });
    const sucursal = obtenerSucursalActivaAsistencia(config);
    if (!config || !sucursal) return alert('No se pudo cargar la sucursal activa.');

    const modal = document.getElementById('modal-asistencia-colaborador');
    if (!modal) return;

    const select = document.getElementById('asistencia-colab-existente');
    const inNombre = document.getElementById('asistencia-colab-nombre');
    const inPass = document.getElementById('asistencia-colab-pass');
    const inActivo = document.getElementById('asistencia-colab-activo');
    const inRol = document.getElementById('asistencia-colab-rol');
    const sucursalInfo = document.getElementById('asistencia-colab-sucursal-info');

    const list = catalogoColaboradoresRegistrados(getOwnerActivo())
      .filter(c => {
        if (!c) return false;
        const sid = normalizarIdSucursalAsistencia(c.sucursalId || '');
        return !sid || sid === sucursal.id;
      });
    window.__asistenciaCatalogoColaboradores = list;

    if (select) {
      const options = ['<option value="">Manual / sin rol</option>']
        .concat(list.map(c => {
          const user = String(c.user || '').replace(/"/g, '&quot;');
          const estado = c.activo !== false ? 'Activo' : 'Bloqueado';
          const rol = etiquetaRolAsistencia(c.rol);
          return `<option value="${user}">${String(c.nombre || c.user).toUpperCase()} - ${rol} - ${estado}</option>`;
        }));
      select.innerHTML = options.join('');
      select.value = '';
    }

    if (inNombre) inNombre.value = '';
    if (inPass) inPass.value = '';
    if (inActivo) inActivo.checked = true;
    if (inRol) inRol.value = ASISTENCIA_ROLES.OTROS;
    if (sucursalInfo) sucursalInfo.textContent = `Sucursal: ${String(sucursal.nombre || sucursal.id).toUpperCase()}`;

    modal.style.display = 'flex';
    setTimeout(() => { inNombre?.focus(); }, 20);
  };

  window.abrirGestionColaboradoresAsistencia = window.abrirGestionColaboradoresSucursalAsistencia;

  window.guardarColaboradorAsistenciaIndependiente = function guardarColaboradorAsistenciaIndependiente() {
    if (!puedeGestionarColaboradoresPorRolAsistencia()) {
      return alert('Solo el rol Gerente puede guardar colaboradores de asistencia.');
    }

    const config = getAsistenciaConfig({ createIfMissing: true });
    const sucursal = obtenerSucursalActivaAsistencia(config);
    if (!config || !sucursal) return alert('No se pudo cargar la configuracion de asistencia.');

    const select = document.getElementById('asistencia-colab-existente');
    const inNombre = document.getElementById('asistencia-colab-nombre');
    const inPass = document.getElementById('asistencia-colab-pass');
    const inActivo = document.getElementById('asistencia-colab-activo');
    const inRol = document.getElementById('asistencia-colab-rol');

    const fromSelect = String((select && select.value) || '').trim().toLowerCase();
    const nombreRaw = String((inNombre && inNombre.value) || '').trim();
    const passRaw = String((inPass && inPass.value) || '').trim();
    const activo = !!(inActivo && inActivo.checked);
    const rol = normalizarRolAsistencia((inRol && inRol.value) || '', ASISTENCIA_ROLES.OTROS);

    const nombre = normalizarNombreColaborador(nombreRaw, fromSelect || 'colaborador');
    let user = normalizarUsuarioColaborador(fromSelect || nombre);
    if (!user) user = `colaborador-${Date.now()}`;

    if (!nombre) return alert('Ingresa el nombre del colaborador.');
    if (!passRaw) return alert('Ingresa la contrasena del colaborador.');

    if (!Array.isArray(sucursal.manualColaboradores)) sucursal.manualColaboradores = [];
    const nowIso = new Date().toISOString();
    const idx = sucursal.manualColaboradores.findIndex(c => String((c && c.user) || '').trim().toLowerCase() === user);
    const payload = {
      user,
      nombre,
      pass: passRaw,
      activo,
      rol,
      updatedAt: nowIso
    };

    if (idx >= 0) {
      sucursal.manualColaboradores[idx] = {
        ...(sucursal.manualColaboradores[idx] || {}),
        ...payload
      };
    } else {
      sucursal.manualColaboradores.push(payload);
    }

    const owner = String(config.owner || '').trim().toLowerCase();
    const userSystem = getDbArray('usuarios').find(u =>
      String((u && u.role) || '').trim().toLowerCase() === 'colaborador' &&
      String((u && u.user) || '').trim().toLowerCase() === user &&
      String((u && u.owner) || '').trim().toLowerCase() === owner
    );
    if (userSystem) {
      userSystem.sucursalAsistenciaId = sucursal.id;
      userSystem.rolAsistencia = rol;
      if (passRaw) userSystem.pass = passRaw;
      userSystem.updatedAt = nowIso;
    }

    syncConfigColaboradores(config);
    config.updatedAt = nowIso;

    if (typeof guardarDatos === 'function') guardarDatos();

    window.cerrarModalAsistenciaColaborador();
    window.__asistenciaColabSeleccionado = user;
    window.renderAsistenciaModulo();
    if (typeof window.renderConfigAsistencia === 'function') window.renderConfigAsistencia();
    alert(`Colaborador ${nombre.toUpperCase()} agregado a ${String(sucursal.nombre || sucursal.id).toUpperCase()}.`);
  };

  window.eliminarColaboradorAsistenciaSeleccionado = function eliminarColaboradorAsistenciaSeleccionado(colaboradorUser = '') {
    if (!puedeGestionarColaboradoresPorRolAsistencia()) {
      alert('Solo el rol Gerente puede eliminar colaboradores de asistencia.');
      return false;
    }

    const user = String(colaboradorUser || window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    if (!user) {
      alert('Selecciona un colaborador de la lista para eliminarlo.');
      return false;
    }

    const config = getAsistenciaConfig({ createIfMissing: true });
    const sucursal = obtenerSucursalActivaAsistencia(config);
    if (!config) {
      alert('No se pudo cargar la configuracion de asistencia.');
      return false;
    }

    const colab = (sucursal && Array.isArray(sucursal.colaboradores) ? sucursal.colaboradores : []).find(c => String((c && c.user) || '').trim().toLowerCase() === user) || null;
    if (!colab) {
      alert('Selecciona un colaborador valido de asistencia.');
      return false;
    }

    const source = String((colab && colab.source) || '').trim().toLowerCase();
    const nombre = String((colab && (colab.nombre || colab.user)) || user).trim().toUpperCase();
    const msg = source === 'sistema'
      ? `Este colaborador esta vinculado al sistema.\n\nSe ocultara de asistencia, sin borrar su usuario general.\n\nDeseas continuar con ${nombre}?`
      : (source === 'mixto'
        ? `Este colaborador esta vinculado y tambien anadido manualmente.\n\nSe eliminara de asistencia (manual + vinculado) para ${nombre}.\n\nDeseas continuar?`
        : `Eliminar al colaborador ${nombre} de asistencia?`);
    if (!confirm(msg)) return false;

    const result = window.eliminarColaboradoresAsistenciaMasivo([user]);
    if (!result || !result.ok) {
      alert('No se pudo completar la eliminacion.');
      return false;
    }

    const detalleVinculados = result.ocultadosVinculados > 0
      ? ' Colaborador vinculado desacoplado de asistencia.'
      : '';
    alert(`Colaborador removido de asistencia.${detalleVinculados}`);
    return true;
  };

  window.eliminarColaboradorAsistenciaIndependiente = function eliminarColaboradorAsistenciaIndependiente(colaboradorUser) {
    if (!puedeGestionarColaboradoresPorRolAsistencia()) return false;
    const user = String(colaboradorUser || '').trim().toLowerCase();
    if (!user) return false;

    const config = getAsistenciaConfig({ createIfMissing: true });
    const sucursal = obtenerSucursalActivaAsistencia(config);
    if (!config || !sucursal || !Array.isArray(sucursal.manualColaboradores)) return false;

    const previo = (sucursal.colaboradores || []).find(c => String((c && c.user) || '').trim().toLowerCase() === user) || null;
    const sourcePrevio = String((previo && previo.source) || '').trim().toLowerCase();

    const before = sucursal.manualColaboradores.length;
    sucursal.manualColaboradores = sucursal.manualColaboradores.filter(c => String((c && c.user) || '').trim().toLowerCase() !== user);
    if (sucursal.manualColaboradores.length === before) return false;

    syncConfigColaboradores(config);
    config.updatedAt = new Date().toISOString();
    if (typeof guardarDatos === 'function') guardarDatos();

    if (String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase() === user) {
      window.__asistenciaColabSeleccionado = '';
    }

    window.renderAsistenciaModulo();
    if (typeof window.renderConfigAsistencia === 'function') window.renderConfigAsistencia();
    const sigueVinculado = (sucursal.colaboradores || []).some(c => String((c && c.user) || '').trim().toLowerCase() === user);
    if (sourcePrevio === 'mixto' && sigueVinculado) {
      alert('Se removio solo el agregado manual. El colaborador sigue vinculado al sistema.');
    } else {
      alert('Colaborador de asistencia removido.');
    }
    return true;
  };

  window.addEventListener('click', (ev) => {
    const modal = document.getElementById('modal-asistencia-colaborador');
    if (modal && modal.style.display !== 'none' && ev.target === modal) {
      window.cerrarModalAsistenciaColaborador();
    }
    const modalSucursal = document.getElementById('modal-asistencia-sucursal');
    if (modalSucursal && modalSucursal.style.display !== 'none' && ev.target === modalSucursal) {
      window.cerrarModalSucursalAsistencia();
    }
    const modalRemove = document.getElementById('modal-asistencia-colaborador-remove');
    if (modalRemove && modalRemove.style.display !== 'none' && ev.target === modalRemove) {
      window.cerrarModalEliminarColaboradorAsistencia();
    }
    const modalAccess = document.getElementById('modal-asistencia-acceso');
    if (modalAccess && modalAccess.style.display !== 'none' && ev.target === modalAccess) {
      window.cancelarAccesoAsistenciaPorContrasena();
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

  function bloquearVistaAsistenciaPorAcceso(msg = 'Acceso protegido. Ingrese contraseña para continuar.') {
    const status = document.getElementById('asistencia-status-modulo');
    if (status) {
      status.textContent = msg;
      status.style.color = '#a66a00';
    }
    const sucursales = document.getElementById('asistencia-sucursales-lista');
    if (sucursales) sucursales.innerHTML = '<div style="font-size:12px; color:#777;">Acceso bloqueado.</div>';
    const colabs = document.getElementById('asistencia-colaboradores-lista');
    if (colabs) colabs.innerHTML = '<div style="font-size:12px; color:#777;">Acceso bloqueado.</div>';
    const tbody = document.getElementById('asistencia-tablero-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777;">Ingrese su contraseña para continuar.</td></tr>';
    const head = document.getElementById('asistencia-tablero-header');
    if (head) head.textContent = 'Acceso restringido por contraseña.';
    const registro = document.getElementById('asistencia-registro-estado');
    if (registro) registro.textContent = 'Ingrese su contraseña para habilitar el tablero de asistencia.';
  }

  function abrirModalAccesoAsistenciaPorContrasena() {
    const modal = document.getElementById('modal-asistencia-acceso');
    const input = document.getElementById('asistencia-access-pass');
    const hint = document.getElementById('asistencia-access-hint');
    if (!modal || !input) return;
    input.value = '';
    if (hint) {
      hint.textContent = 'Ingrese su contraseña para detectar automáticamente su usuario y sucursal.';
      hint.style.color = '#666';
    }
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 20);
  }

  function cerrarModalAccesoAsistenciaPorContrasena() {
    const modal = document.getElementById('modal-asistencia-acceso');
    if (!modal) return;
    modal.style.display = 'none';
  }

  function resolverAccesoAsistenciaPorContrasena(clave = '', config = null) {
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    if (!cfg) return null;
    const password = String(clave || '').trim();
    if (!password) return null;
    syncConfigColaboradores(cfg);
    asegurarSucursalesAsistenciaConfig(cfg);

    for (const sucursal of (cfg.sucursales || [])) {
      const matchColab = (sucursal.colaboradores || []).find(c =>
        c && c.activo !== false && String((c.pass || '')).trim() === password
      );
      if (matchColab) {
        return {
          owner: cfg.owner,
          modulo: cfg.modulo,
          user: String(matchColab.user || '').trim().toLowerCase(),
          nombre: String(matchColab.nombre || matchColab.user || '').trim().toLowerCase(),
          rol: normalizarRolAsistencia(matchColab.rol, ASISTENCIA_ROLES.OTROS),
          sucursalId: sucursal.id,
          scopeAll: false,
          source: 'asistencia-colaborador'
        };
      }
    }

    const ownerKey = String(cfg.owner || '').trim().toLowerCase();
    const usuariosOwner = getDbArray('usuarios').filter(u => {
      if (!u || u.activo === false) return false;
      const role = String((u && u.role) || '').trim().toLowerCase();
      if (!['colaborador', 'admin', 'super-master'].includes(role)) return false;
      const ownerRef = role === 'colaborador'
        ? String((u && u.owner) || '').trim().toLowerCase()
        : String((u && (u.user || u.owner)) || '').trim().toLowerCase();
      return ownerRef === ownerKey;
    });
    const usuario = usuariosOwner.find(u => String((u && u.pass) || '').trim() === password) || null;
    if (!usuario) return null;

    const role = String((usuario && usuario.role) || '').trim().toLowerCase();
    if (role === 'admin' || role === 'super-master') {
      const sucursalId = normalizarIdSucursalAsistencia((usuario && (usuario.sucursalAsistenciaId || usuario.asistenciaSucursalId)) || '')
        || normalizarIdSucursalAsistencia(cfg.defaultSucursalId || '')
        || String(((cfg.sucursales || [])[0] && (cfg.sucursales[0].id)) || '').trim().toLowerCase();
      return {
        owner: cfg.owner,
        modulo: cfg.modulo,
        user: normalizarUsuarioColaborador((usuario && usuario.user) || ''),
        nombre: normalizarNombreColaborador((usuario && usuario.user) || ''),
        rol: ASISTENCIA_ROLES.GERENTE,
        sucursalId,
        scopeAll: true,
        source: 'usuario-admin'
      };
    }

    const userColab = normalizarUsuarioColaborador((usuario && usuario.user) || '');
    const sucursalByUser = (cfg.sucursales || []).find(s =>
      (s.colaboradores || []).some(c => String((c && c.user) || '').trim().toLowerCase() === userColab)
    ) || null;
    const sucursalId = (sucursalByUser && sucursalByUser.id)
      || normalizarIdSucursalAsistencia((usuario && (usuario.sucursalAsistenciaId || usuario.asistenciaSucursalId)) || '')
      || normalizarIdSucursalAsistencia(cfg.defaultSucursalId || '');
    return {
      owner: cfg.owner,
      modulo: cfg.modulo,
      user: userColab,
      nombre: normalizarNombreColaborador((usuario && usuario.user) || '', userColab),
      rol: normalizarRolAsistencia((usuario && (usuario.rolAsistencia || usuario.asistenciaRole)) || '', ASISTENCIA_ROLES.OTROS),
      sucursalId,
      scopeAll: false,
      source: 'usuario-colaborador'
    };
  }

  function accesoAsistenciaValido(config = null) {
    const cfg = config || getAsistenciaConfig({ createIfMissing: true });
    if (!cfg) return false;
    const access = accesoAsistenciaActual();
    if (!access) return false;
    if (window.__asistenciaRequiereLogin === true) return false;
    if (!(cfg.sucursales || []).some(s => s.id === access.sucursalId)) return false;
    return true;
  }

  window.cancelarAccesoAsistenciaPorContrasena = function cancelarAccesoAsistenciaPorContrasena() {
    window.__asistenciaAccesoActual = null;
    window.__asistenciaRequiereLogin = true;
    cerrarModalAccesoAsistenciaPorContrasena();
    if (typeof window.showPage === 'function') window.showPage('home');
  };

  window.validarAccesoAsistenciaPorContrasena = function validarAccesoAsistenciaPorContrasena() {
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return false;
    const input = document.getElementById('asistencia-access-pass');
    const hint = document.getElementById('asistencia-access-hint');
    const pass = String((input && input.value) || '').trim();
    if (!pass) {
      if (hint) {
        hint.textContent = 'Ingrese su contraseña para continuar.';
        hint.style.color = '#c0392b';
      }
      return false;
    }
    const access = resolverAccesoAsistenciaPorContrasena(pass, config);
    if (!access) {
      if (hint) {
        hint.textContent = 'Contraseña inválida o sin sucursal asignada.';
        hint.style.color = '#c0392b';
      }
      return false;
    }
    window.__asistenciaAccesoActual = access;
    window.__asistenciaRequiereLogin = false;
    window.__asistenciaSucursalSeleccionada = access.sucursalId;
    if (!access.scopeAll || !esRolGerenteAsistencia(access.rol)) {
      window.__asistenciaColabSeleccionado = String(access.user || '').trim().toLowerCase();
    }
    cerrarModalAccesoAsistenciaPorContrasena();
    window.renderAsistenciaModulo();
    return true;
  };

  function instalarGuardiaAccesoAsistencia() {
    if (window.__asistenciaShowPageGuardInstalled) return;
    if (typeof window.showPage !== 'function') return;
    const previous = window.showPage;
    window.showPage = function(pageId) {
      const target = String(pageId || '').trim().toLowerCase();
      if (target === 'asistencia') {
        window.__asistenciaRequiereLogin = true;
        window.__asistenciaAccesoActual = null;
      } else if (document.getElementById('asistencia')?.classList.contains('active')) {
        window.__asistenciaRequiereLogin = true;
        window.__asistenciaAccesoActual = null;
      }
      return previous.apply(this, arguments);
    };
    window.__asistenciaShowPageGuardInstalled = true;
  }

  window.renderAsistenciaModulo = function renderAsistenciaModulo() {
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;

    const changed = syncConfigColaboradores(config);
    const sucursalChanged = normalizarRegistrosConSucursal(config);
    const cicloChanged = sincronizarVentanaCicloAsistencia(config);
    const mustSave = changed || cicloChanged || sucursalChanged;
    if (mustSave && typeof guardarDatos === 'function') guardarDatos();

    if (!accesoAsistenciaValido(config)) {
      bloquearVistaAsistenciaPorAcceso();
      abrirModalAccesoAsistenciaPorContrasena();
      return;
    }

    renderEstado(config);
    renderListaSucursalesAsistencia(config);
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
    const sucursal = obtenerSucursalActivaAsistencia(config);
    const access = accesoAsistenciaActual();
    if (!config) return alert('No se pudo cargar la configuracion de asistencia.');
    if (!sucursal) return alert('No se pudo cargar la sucursal de asistencia.');
    if (!access) return alert('Debes autenticarte para registrar asistencia.');
    if (!config.activo) return alert('El modulo de asistencia esta desactivado.');

    syncConfigColaboradores(config);

    const selectedUser = String(options.colaboradorUser || window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    if (!selectedUser) return alert('Selecciona un colaborador para registrar asistencia.');

    if (!access.scopeAll && !esRolGerenteAsistencia(access.rol) && selectedUser !== String(access.user || '').trim().toLowerCase()) {
      return alert('Tu rol solo puede marcar entrada/salida de su propio usuario.');
    }

    const colab = (sucursal.colaboradores || []).find(c => String((c && c.user) || '').trim().toLowerCase() === selectedUser && c && c.activo !== false);
    if (!colab) return alert('El colaborador seleccionado no esta habilitado en asistencia.');

    const now = new Date();
    const jornadaActual = fechaNominaActual();
    const jornadaObjetivo = String(options.fechaAsistencia || jornadaActual).trim();
    const sucursalId = normalizarIdSucursalAsistencia(sucursal.id || '');

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
        sucursalIdDeRegistroAsistencia(r, config) === sucursalId &&
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
        sucursalId,
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

    let abierto = buscarRegistroAbierto(selectedUser, jornadaObjetivo, config);
    if (!abierto && toNumber(now.getHours(), 0) < horaLimiteNormalizada(config.horaLimiteSalida)) {
      abierto = buscarRegistroAbierto(selectedUser, '', config);
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
    if (!puedeGestionarColaboradoresPorRolAsistencia()) return alert('Solo el rol Gerente puede limpiar registros.');
    if (typeof validarPermiso === 'function' && !validarPermiso()) return;
    if (!confirm('Eliminar todos los registros de asistencia de la sucursal activa?')) return;

    const config = getAsistenciaConfig({ createIfMissing: true });
    const owner = getOwnerActivo();
    const modulo = getModuloActivo();
    const sucursalId = sucursalIdActivaAsistencia(config);

    db.asistenciaRegistros = getDbArray('asistenciaRegistros').filter(r =>
      !(String((r && r.owner) || '').trim().toLowerCase() === owner &&
        String((r && r.modulo) || '').trim().toUpperCase() === modulo &&
        sucursalIdDeRegistroAsistencia(r, config) === sucursalId)
    );

    if (typeof guardarDatos === 'function') guardarDatos();
    window.renderAsistenciaModulo();
  };

  window.limpiarAutorizacionesAsistencia = function limpiarAutorizacionesAsistencia() {
    if (!puedeGestionarColaboradoresPorRolAsistencia()) return alert('Solo el rol Gerente puede limpiar autorizaciones.');
    if (typeof validarPermiso === 'function' && !validarPermiso()) return;
    if (!confirm('Eliminar historial de autorizaciones de la sucursal activa?')) return;

    const config = getAsistenciaConfig({ createIfMissing: true });
    const owner = getOwnerActivo();
    const modulo = getModuloActivo();
    const sucursalId = sucursalIdActivaAsistencia(config);

    db.asistenciaAutorizaciones = getDbArray('asistenciaAutorizaciones').filter(r =>
      !(String((r && r.owner) || '').trim().toLowerCase() === owner &&
        String((r && r.modulo) || '').trim().toUpperCase() === modulo &&
        sucursalIdDeRegistroAsistencia(r, config) === sucursalId)
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
    if (!puedeGestionarColaboradoresPorRolAsistencia()) return alert('Solo el rol Gerente puede actualizar el ciclo.');

    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;

    const owner = getOwnerActivo();
    const modulo = getModuloActivo();
    const sucursalId = sucursalIdActivaAsistencia(config);
    const jornadaActual = fechaNominaActual();
    const inicioAntes = String(config.cicloInicio || '').trim();
    const finAntes = String(config.cicloFin || '').trim();
    const cicloChanged = sincronizarVentanaCicloAsistencia(config);

    let cambios = 0;

    getDbArray('asistenciaRegistros').forEach(r => {
      if (String((r && r.owner) || '').trim().toLowerCase() !== owner) return;
      if (String((r && r.modulo) || '').trim().toUpperCase() !== modulo) return;
      if (sucursalIdDeRegistroAsistencia(r, config) !== sucursalId) return;
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
    instalarGuardiaAccesoAsistencia();
    if (typeof window.__asistenciaRequiereLogin === 'undefined') {
      window.__asistenciaRequiereLogin = true;
    }
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

