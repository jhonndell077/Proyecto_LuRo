(() => {
  const ASISTENCIA_CLAVES_VISIBLES_MS = 5 * 60 * 1000;

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
    if (txt.length <= 2) return '••';
    return `${'•'.repeat(Math.max(1, txt.length - 2))}${txt.slice(-2)}`;
  }

  function clavesDesbloqueadas() {
    return Number(window.__asistenciaClavesVisiblesHasta || 0) > Date.now();
  }

  function colaboradoresAsistencia(owner = getOwnerActivo()) {
    const ownerKey = String(owner || '').trim().toLowerCase();
    if (!ownerKey) return [];
    return getDbArray('usuarios')
      .filter(u => String((u && u.role) || '').trim().toLowerCase() === 'colaborador' && String((u && u.owner) || '').trim().toLowerCase() === ownerKey)
      .map(u => ({
        user: String((u && u.user) || '').trim().toLowerCase(),
        nombre: String((u && u.user) || '').trim().toLowerCase(),
        activo: !!(u && u.activo !== false)
      }))
      .filter(u => !!u.user)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
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
    if (!Array.isArray(config.colaboradores)) config.colaboradores = [];

    return config;
  }

  function syncConfigColaboradores(config, opts = {}) {
    if (!config || typeof config !== 'object') return false;

    const regenerate = opts.forzarRegenerar === true;
    const prevMap = new Map((Array.isArray(config.colaboradores) ? config.colaboradores : []).map(c => [String((c && c.user) || '').trim().toLowerCase(), c]));
    const nowIso = new Date().toISOString();

    const next = colaboradoresAsistencia(config.owner).map(c => {
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
        clave,
        updatedAt: prev.updatedAt || nowIso
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

  function estadoConfigTexto(config) {
    if (!config) return 'Asistencia sin configuracion';
    const estado = config.activo ? 'ACTIVO' : 'INACTIVO';
    const auth = config.requerirClave ? 'ON' : 'OFF';
    const colabs = (config.colaboradores || []).filter(c => c && c.activo !== false).length;
    return `Modulo ${estado} · Autorizacion ${auth} · Corte ${horaLimiteNormalizada(config.horaLimiteSalida)}:00 · Colaboradores ${colabs}`;
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
    const input = prompt(`Ingrese clave para ${String(tipoAccion || '').toUpperCase()} (${colabNombre}). Usa clave del colaborador (5 digitos) o clave maestra.`);
    if (input === null) return { ok: false, logged: false, cancelled: true };

    const clave = String(input || '').trim();
    const master = String(config.masterPassword || (sesionUser && sesionUser.pass) || '').trim();
    const byMaster = !!master && clave === master;
    const byColab = /^\d{5}$/.test(clave) && clave === String((colaboradorCfg && colaboradorCfg.clave) || '').trim();
    const ok = byMaster || byColab;

    logAutorizacion({
      colaboradorUser: colaboradorCfg && colaboradorCfg.user,
      colaboradorNombre: colabNombre,
      tipoAccion,
      claveUsada: clave,
      via: byMaster ? 'maestra' : 'colaborador',
      autorizado: ok,
      motivo: ok ? 'autorizacion-ok' : 'clave-invalida'
    });

    if (!ok) alert('Clave incorrecta. Accion bloqueada.');
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

  function construirFechasTablero(config, days = 12) {
    const fechas = [];
    const base = safeDate(new Date()) || new Date();
    const jornada = fechaOperativaAsistencia(base, config);
    const jornadaDate = safeDate(`${jornada}T12:00:00`) || base;
    for (let i = 0; i < days; i++) {
      const d = new Date(jornadaDate.getTime());
      d.setDate(jornadaDate.getDate() - i);
      fechas.push(ymdLocal(d));
    }
    return fechas;
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
      cfgStatus.textContent = `${estadoConfigTexto(config)} · Clave maestra ${hasMaster ? 'configurada' : 'pendiente'}.`;
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
      return `<button type="button" class="asistencia-colab-btn${active}" onclick="seleccionarColaboradorAsistencia('${user.replace(/'/g, "\\'")}')">
        ${String(c.nombre || user).toUpperCase()}
        <span class="asistencia-colab-meta">Estado: ${estado}</span>
      </button>`;
    }).join('');
  }

  function renderTableroColaboradorAsistencia(config) {
    const tbody = document.getElementById('asistencia-tablero-body');
    const head = document.getElementById('asistencia-tablero-header');
    const fechaLabel = document.getElementById('asistencia-fecha-operativa');
    if (!tbody || !config) return;

    const selected = String(window.__asistenciaColabSeleccionado || '').trim().toLowerCase();
    const colaborador = colaboradoresActivosVisibles(config).find(c => String(c.user || '').trim().toLowerCase() === selected) || null;
    const jornada = fechaOperativaAsistencia(new Date(), config);

    if (fechaLabel) {
      fechaLabel.textContent = `Jornada operativa: ${jornada || '---'} · corte ${horaLimiteNormalizada(config.horaLimiteSalida)}:00`;
    }

    if (!colaborador) {
      if (head) head.textContent = 'Selecciona un colaborador para ver su casilla de asistencia.';
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777;">Selecciona un colaborador.</td></tr>';
      return;
    }

    if (head) head.textContent = `Colaborador: ${String(colaborador.nombre || colaborador.user).toUpperCase()}`;

    const fechas = construirFechasTablero(config, 12);
    tbody.innerHTML = fechas.map(fecha => {
      const registro = getRegistroPorFecha(colaborador.user, fecha);
      const entrada = registro && registro.entradaAt ? horaTexto(registro.entradaAt, true) : '---';
      const salida = registro && registro.salidaAt ? horaTexto(registro.salidaAt, true) : '---';
      const total = registro ? totalHorasTexto(registro) : '---';
      const puedeEntrada = config.activo && fecha === jornada && !(registro && registro.entradaAt);
      const puedeSalida = config.activo && fecha === jornada && !!(registro && registro.entradaAt) && !(registro && registro.salidaAt);
      const classEntrada = registro && registro.entradaAt ? 'asistencia-mark-btn asistencia-mark-ok' : 'asistencia-mark-btn';
      const classSalida = registro && registro.salidaAt ? 'asistencia-mark-btn asistencia-mark-ok' : 'asistencia-mark-btn';
      const fechaVisible = fecha ? fecha.split('-').reverse().join('/') : '---';
      return `<tr>
        <td><strong>${fechaVisible}</strong></td>
        <td><button type="button" class="${classEntrada}" onclick="registrarAsistenciaDesdeTablero('entrada','${fecha}')" ${puedeEntrada ? '' : 'disabled'}>${registro && registro.entradaAt ? '✓' : '•'}</button></td>
        <td>${entrada}</td>
        <td><button type="button" class="${classSalida}" onclick="registrarAsistenciaDesdeTablero('salida','${fecha}')" ${puedeSalida ? '' : 'disabled'}>${registro && registro.salidaAt ? '✓' : '•'}</button></td>
        <td>${salida}</td>
        <td class="${registro && registro.salidaAt ? 'asistencia-total-ok' : ''}">${total}</td>
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

  window.abrirGestionColaboradoresAsistencia = function abrirGestionColaboradoresAsistencia() {
    if (typeof showPage === 'function') {
      showPage('configuracion');
      setTimeout(() => {
        document.getElementById('section-user-colaboradores')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  };
  window.renderAsistenciaRegistros = function renderAsistenciaRegistros() {
    const tbody = document.getElementById('tabla-asistencia-registros');
    if (!tbody) return;

    const q = String((document.getElementById('asistencia-filtro-colaborador') && document.getElementById('asistencia-filtro-colaborador').value) || '').trim().toLowerCase();

    const rows = registrosAsistenciaVisibles()
      .filter(r => {
        const fechaRef = String((r && (r.fechaAsistencia || r.fecha || r.entradaAt)) || '').trim();
        if (typeof fechaDentroRango === 'function' && !fechaDentroRango(fechaRef, 'filtro-asistencia-desde', 'filtro-asistencia-hasta')) return false;
        if (!q) return true;
        const nombre = String((r && (r.colaborador || r.colaboradorNombre || r.colaboradorUser)) || '').trim().toLowerCase();
        return nombre.includes(q);
      })
      .sort((a, b) => timeMs((b && b.entradaAt) || (b && b.createdAt) || (b && b.fechaAsistencia)) - timeMs((a && a.entradaAt) || (a && a.createdAt) || (a && a.fechaAsistencia)));

    tbody.innerHTML = rows.map(r => {
      const fecha = String((r && r.fechaAsistencia) || '').trim() || ymdLocal((r && r.entradaAt) || (r && r.timestamp) || '');
      const entrada = r && r.entradaAt ? horaTexto(r.entradaAt, true) : '---';
      const salida = r && r.salidaAt ? horaTexto(r.salidaAt, true) : '---';
      const estado = estadoRegistroTexto(r);
      const color = estado === 'CERRADO' ? '#1f8f4c' : (estado === 'ABIERTO' ? '#a66a00' : '#c0392b');
      return `<tr>
        <td>${fecha || '---'}</td>
        <td><strong>${String((r && (r.colaborador || r.colaboradorNombre || r.colaboradorUser)) || '---').toUpperCase()}</strong></td>
        <td>${entrada}</td>
        <td>${salida}</td>
        <td>${totalHorasTexto(r)}</td>
        <td style="color:${color}; font-weight:700;">${estado}</td>
        <td>${String((r && r.operador) || '---')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center; color:gray;">Sin registros validos.</td></tr>';
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
        <td>${String((r && r.fecha) || fechaTexto((r && r.timestamp) || '') || '---')}</td>
        <td>${String((r && r.hora) || horaTexto((r && r.timestamp) || '', true) || '---')}</td>
        <td><strong>${String((r && (r.colaboradorNombre || r.colaboradorUser)) || '---').toUpperCase()}</strong></td>
        <td>${String((r && r.tipoAccion) || '---').toUpperCase()}</td>
        <td>${clave}</td>
        <td style="color:${color}; font-weight:700;">${ok ? 'AUTORIZADO' : 'DENEGADO'}</td>
        <td>${String((r && r.operador) || '---')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center; color:gray;">Sin autorizaciones.</td></tr>';
  };

  window.renderAsistenciaModulo = function renderAsistenciaModulo() {
    const config = getAsistenciaConfig({ createIfMissing: true });
    if (!config) return;

    const changed = syncConfigColaboradores(config);
    if (changed && typeof guardarDatos === 'function') guardarDatos();

    renderEstado(config);
    renderListaColaboradoresAsistencia(config);
    renderTableroColaboradorAsistencia(config);
    window.renderAsistenciaRegistros();
    window.renderAsistenciaAutorizaciones();
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
        return `<tr>
          <td><strong>${String((c && (c.nombre || user)) || '---').toUpperCase()}</strong></td>
          <td style="color:${color}; font-weight:700;">${estado}</td>
          <td>${clave}</td>
          <td>${updated}</td>
          <td><button class="btn btn-purple" style="padding:6px 8px;" onclick="regenerarClaveAsistenciaColaborador('${user.replace(/'/g, "\\'")}')">REGENERAR</button></td>
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
    const jornadaActual = fechaOperativaAsistencia(now, config);
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
        entradaHora: horaTexto(nowIso, true),
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
    abierto.salidaHora = horaTexto(nowIso, true);
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
    const jornadaActual = fechaOperativaAsistencia(new Date(), config);

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

    if (!cambios) {
      alert('No se detectaron jornadas anteriores abiertas para actualizar.');
      return;
    }

    if (typeof guardarDatos === 'function') guardarDatos();
    window.renderAsistenciaModulo();
    alert(`Ciclo de asistencia actualizado. Registros ajustados: ${cambios}.`);
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('section-asistencia-config') && typeof window.renderConfigAsistencia === 'function') {
      window.renderConfigAsistencia();
    }
  });
})();
