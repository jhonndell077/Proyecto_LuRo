
function borrarTodoElAlmacen() {
    if (bloquearAccionAdministrativaColaborador()) return;

    // 1. Confirmación visual fuerte
    if (!confirm("⚠️ ADVERTENCIA: Se eliminarán TODOS los productos del almacén activo.\nEsta acción NO se puede deshacer.\n\n¿Desea continuar?")) {
        return;
    }

    // 2. Solicitud de contraseña
    let passwordIngresada = prompt("🔒 SEGURIDAD: Ingrese su contraseña para vaciar completamente el almacén:");

    if (passwordIngresada === null) return;

    // 3. Validación
    if (passwordIngresada !== sesionUser.pass) {
        alert("❌ Contraseña incorrecta. Operación cancelada.");
        return;
    }

    // 4. BORRADO MASIVO SOLO DE LA HOJA DE ALMACÉN ACTIVA
    db.almacen = db.almacen.filter(item =>
        !(item.owner === sesionUser.user && item.modulo === moduloActual)
    );

    // 5. Guardar cambios
    guardarDatos();

    // 6. Refrescar vista
    if (typeof cargarDatos === "function") {
        cargarDatos();
    }

    // 7. Confirmación final
    renderAlmacen();
    alert("🗑️ Se eliminó todo lo registrado en esta hoja de almacén.");
}

  function borrarTodoElMenu() {
    if (bloquearAccionAdministrativaColaborador()) return;
    if (!confirm("⚠️ ¿ESTÁS SEGURO? Esta acción eliminará todos los platos de tu disponibilidad permanentemente.")) {
        return;
    }

    // Pedimos la contraseña de 5 números
    let passwordIngresada = prompt("🔒 SEGURIDAD: Ingrese su contraseña de 5 números para ejecutar el borrado masivo:");

    if (passwordIngresada === null) return;

    if (passwordIngresada === sesionUser.pass) {
        // 1. Eliminamos los datos de la base de datos (db)
        db.platos = db.platos.filter(p => p.owner !== sesionUser.user || p.modulo !== moduloActual);
        
        // 2. Guardamos en LocalStorage inmediatamente
        guardarDatos();
        
        // 3. LIMPIEZA VISUAL INMEDIATA:
        // Forzamos el vaciado del cuerpo de la tabla en el HTML
        const tabla = document.getElementById('tabla-disponibilidad-full');
        if (tabla) {
            tabla.innerHTML = ""; 
        }

        // 4. Opcional: Si tienes un contador de platos o totales, refrescamos todo
        if (typeof cargarDatos === "function") {
            cargarDatos();
        }
        
        alert("✅ El menú ha sido vaciado correctamente.");
    } else {
        alert("❌ Contraseña incorrecta. Acción cancelada.");
    }
}

  function convertirUnidad(cantidad, unidadOrigen, unidadDestino) {
    const normalizar = (u) => {
        if (u === 'Lt') return 'Litros';
        if (u === 'Unid') return 'Unidad';
        return u;
    };
    unidadOrigen = normalizar(unidadOrigen);
    unidadDestino = normalizar(unidadDestino);

    if (unidadOrigen === unidadDestino) return cantidad;

    const unidades = {
        'g': 1,
        'Lb': 453.59,
        'Oz': 28.35,
        'mL': 1,
        'Litros': 1000,
        'Unidad': 1
    };

    const esPeso = ['g', 'Lb', 'Oz'].includes(unidadOrigen) && ['g', 'Lb', 'Oz'].includes(unidadDestino);
    const esVolumen = ['mL', 'Litros'].includes(unidadOrigen) && ['mL', 'Litros'].includes(unidadDestino);
    
    if (!esPeso && !esVolumen && unidadOrigen !== unidadDestino) {
        return cantidad; // No se puede convertir (ej: Lb a mL)
    }

    const valorEnBase = cantidad * unidades[unidadOrigen];
    return valorEnBase / unidades[unidadDestino];
}

  // --- FUNCIONES DE CONFIGURACIÓN Y SEGURIDAD ---

/**
 * Cambia la contraseña del usuario que tiene la sesión iniciada actualmente.
 */
async function cambiarMiPassword() {
    const oldPass = document.getElementById('my_old_pass').value;
    const newPass = document.getElementById('my_new_pass').value;
    const confirmPass = document.getElementById('my_new_pass_confirm').value;

    // 1. Validar que la contraseña actual sea correcta
    if (oldPass !== sesionUser.pass) {
        return alert("❌ La contraseña actual es incorrecta.");
    }

    // 2. Validar que las nuevas coincidan
    if (newPass === "" || newPass !== confirmPass) {
        return alert("⚠️ Las nuevas contraseñas no coinciden o están vacías.");
    }

    if (typeof window.actualizarPasswordCloud === 'function') {
        const okCloud = await window.actualizarPasswordCloud(oldPass, newPass);
        if (!okCloud) return;
    }

    // 3. Actualizar en la base de datos (db.usuarios)
    const userIndex = db.usuarios.findIndex(u => u.user === sesionUser.user);
    if (userIndex !== -1) {
        db.usuarios[userIndex].pass = newPass;
    } else {
        db.usuarios.push({
            user: sesionUser.user,
            pass: newPass,
            role: String(sesionUser.role || 'admin'),
            owner: String(sesionUser.owner || sesionUser.user || '').toLowerCase(),
            activo: true
        });
    }
    sesionUser.pass = newPass; // Actualizar sesión actual
    if (typeof window.loginClave !== 'undefined') window.loginClave = newPass;
    guardarDatos();
    alert("✅ Contraseña actualizada correctamente.");
    
    // Limpiar campos
    document.getElementById('my_old_pass').value = "";
    document.getElementById('my_new_pass').value = "";
    document.getElementById('my_new_pass_confirm').value = "";
}

/**
 * Crea un nuevo usuario administrador (Maestro).
 */
function crearUsuario() {
    const nombreInput = document.getElementById('new_u_name');
    const passInput = document.getElementById('new_u_pass');
    const nombre = nombreInput.value.trim().toLowerCase();
    const pass = passInput.value;
    const payData = window.__nuevoUsuarioPagoTemp || null;

    if (!nombre || !pass) return alert("⚠️ Complete usuario y clave.");
    if (!payData) return alert("💳 Debe registrar método de pago antes de añadir el usuario.");

    if (db.usuarios.find(u => u.user === nombre)) {
        return alert("⚠️ El usuario ya existe.");
    }

    db.usuarios.push({
        user: nombre,
        pass: pass,
        role: 'admin',
        activo: true,
        owner: nombre,
        requiereRegistroInicial: false,
        billing: { ...payData, createdAt: new Date().toISOString() }
    });
    guardarDatos();
    actualizarTablaUsuarios();
    
    nombreInput.value = "";
    passInput.value = "";
    window.__nuevoUsuarioPagoTemp = null;
    actualizarEstadoPagoNuevoUsuario();
    alert("✅ Usuario maestro creado con éxito.");
}

function actualizarEstadoPagoNuevoUsuario() {
    const box = document.getElementById('new_u_payment_status');
    if (!box) return;
    const p = window.__nuevoUsuarioPagoTemp || null;
    if (!p) {
        box.textContent = 'Debe registrar método de pago antes de añadir el usuario.';
        box.style.color = '#666';
        return;
    }
    box.textContent = `Pago registrado: ${p.paymentMethod} · ****${p.cardLast4} · Próximo cobro ${new Date(p.nextChargeAt).toLocaleDateString()} (día ${p.billingDay}).`;
    box.style.color = '#2f3542';
}

function abrirModalPagoUsuarioMaestro() {
    const m = document.getElementById('modal-pago-usuario-maestro');
    if (!m) return;
    const p = window.__nuevoUsuarioPagoTemp || null;
    const hoy = new Date();
    const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
    const inClient = document.getElementById('new_u_client_name');
    const inPay = document.getElementById('new_u_payment_method');
    const inCard = document.getElementById('new_u_card');
    const inExp = document.getElementById('new_u_card_exp');
    const inCvv = document.getElementById('new_u_card_cvv');
    const inNext = document.getElementById('new_u_next_charge');
    if (inClient) inClient.value = p?.clientName || '';
    if (inPay) inPay.value = p?.paymentMethod || 'TRANSFERENCIA';
    if (inCard) inCard.value = '';
    if (inExp) inExp.value = p?.cardExp || '';
    if (inCvv) inCvv.value = '';
    if (inNext) inNext.value = p?.nextChargeAt ? String(p.nextChargeAt).slice(0,10) : hoyIso;
    m.style.display = 'flex';
}

function cerrarModalPagoUsuarioMaestro() {
    const m = document.getElementById('modal-pago-usuario-maestro');
    if (m) m.style.display = 'none';
}

function guardarPagoUsuarioMaestro() {
    const clientName = (document.getElementById('new_u_client_name')?.value || '').trim().toUpperCase();
    const paymentMethod = (document.getElementById('new_u_payment_method')?.value || 'TRANSFERENCIA').trim().toUpperCase();
    const card = (document.getElementById('new_u_card')?.value || '').replace(/[^\d]/g, '');
    const cardExp = (document.getElementById('new_u_card_exp')?.value || '').trim().toUpperCase();
    const cardCvv = (document.getElementById('new_u_card_cvv')?.value || '').replace(/[^\d]/g, '');
    const nextChargeRaw = (document.getElementById('new_u_next_charge')?.value || '').trim();
    if (!clientName || !paymentMethod || !card || !cardExp || !cardCvv || !nextChargeRaw) return alert("⚠️ Complete todos los campos de pago.");
    if (card.length < 12) return alert("❌ Número de tarjeta inválido.");
    if (!/^\d{2}\/\d{2,4}$/.test(cardExp)) return alert("❌ Formato de vencimiento inválido. Use MM/AA.");
    if (cardCvv.length < 3 || cardCvv.length > 4) return alert("❌ CVV inválido.");
    const dt = new Date(nextChargeRaw + 'T00:00:00');
    if (isNaN(dt.getTime())) return alert("❌ Fecha de próximo cobro inválida.");
    window.__nuevoUsuarioPagoTemp = {
        clientName,
        paymentMethod,
        cardLast4: card.slice(-4),
        cardExp,
        cvvMasked: '*'.repeat(cardCvv.length),
        nextChargeAt: dt.toISOString(),
        billingDay: dt.getDate()
    };
    actualizarEstadoPagoNuevoUsuario();
    cerrarModalPagoUsuarioMaestro();
}

function textoCobroUsuario(u) {
    const b = u?.billing || null;
    if (!b || !b.nextChargeAt) return 'Sin temporizador';
    const next = new Date(b.nextChargeAt);
    const ms = next.getTime() - Date.now();
    const dias = Math.ceil(ms / (24 * 60 * 60 * 1000));
    const fechaTxt = isNaN(next.getTime()) ? '-' : next.toLocaleDateString();
    const diaCorte = Number(b.billingDay || 0);
    const sufijo = diaCorte > 0 ? ` · día ${diaCorte} de cada mes` : '';
    if (dias < 0) return `Vencido (${fechaTxt})${sufijo}`;
    return `${dias} día(s) (${fechaTxt})${sufijo}`;
}

function resumenMetodoPagoUsuario(u) {
    const b = u?.billing || null;
    if (!b) return '<span style="color:#777;">Sin datos de pago</span>';
    const metodo = (b.paymentMethod || 'TRANSFERENCIA').toUpperCase();
    const tarjeta = b.cardLast4 ? `**** **** **** ${b.cardLast4}` : '**** **** **** ****';
    const vence = b.cardExp || '--/--';
    const cliente = b.clientName || 'CLIENTE';
    return `
      <div style="font-size:11px; line-height:1.35; background:#f8f9fa; border:1px dashed #ccd; border-radius:8px; padding:6px 8px;">
        <div style="font-weight:800; color:#2f3542;">${metodo}</div>
        <div style="color:#555;">Tarjeta: ${tarjeta} | Vence: ${vence}</div>
        <div style="color:#777;">Titular: ${cliente}</div>
      </div>`;
}

/**
 * Crea un colaborador vinculado al usuario actual.
 */
let colaboradorEditandoUser = "";

function sincronizarTodosGruposColaborador() {
    ['admin', 'costos', 'historial'].forEach(grupo => sincronizarSeleccionGrupo(grupo));
}

function textoMembresiaUsuario(u) {
    const plan = String(u?.plan || 'basico').trim().toLowerCase();
    const planNombre = plan === 'empresarial'
        ? 'Empresarial'
        : (plan === 'profesional' ? 'Profesional' : 'Básico');
    const subEstado = String(u?.estado || u?.suscripcion?.estado || '').trim().toLowerCase();
    const estadoTxt = (subEstado === 'activo' || subEstado === 'activa') ? 'Activa' : 'Pendiente';
    const color = (subEstado === 'activo' || subEstado === 'activa') ? '#1f8f4c' : '#a66a00';
    return `<div style="font-size:11px; line-height:1.35;"><strong>${planNombre}</strong><br><span style="color:${color};">${estadoTxt}</span></div>`;
}

function limpiarFormularioColaborador(cancelarEdicion = true) {
    const nombreInput = document.getElementById('colab_name');
    const passInput = document.getElementById('colab_pass');
    const btnGuardar = document.getElementById('btn-colab-guardar');
    const btnCancelar = document.getElementById('btn-colab-cancelar');

    if (nombreInput) {
        nombreInput.value = "";
        nombreInput.disabled = false;
    }
    if (passInput) {
        passInput.value = "";
        passInput.placeholder = "Clave Acceso";
    }
    document.querySelectorAll('.colab-perm').forEach(c => c.checked = false);
    document.querySelectorAll('.colab-perm-group').forEach(c => c.checked = false);
    document.querySelectorAll('.colab-entry').forEach(c => c.checked = false);

    if (btnGuardar) {
        btnGuardar.textContent = "AÑADIR";
        btnGuardar.style.background = "";
    }
    if (btnCancelar) btnCancelar.style.display = "none";
    if (cancelarEdicion) colaboradorEditandoUser = "";
}

function editarRenglonesColaborador(nombreColab) {
    const userKey = String(nombreColab || '').trim().toLowerCase();
    if (!userKey) return;
    const colab = (db.usuarios || []).find(u => {
        if (String(u?.user || '').trim().toLowerCase() !== userKey) return false;
        if (String(u?.role || '').toLowerCase() !== 'colaborador') return false;
        if (esMasterEnSesion()) return true;
        return u.owner === sesionUser.user;
    });
    if (!colab) return alert("No se encontró el colaborador.");

    limpiarFormularioColaborador(false);
    colaboradorEditandoUser = userKey;

    const nombreInput = document.getElementById('colab_name');
    const passInput = document.getElementById('colab_pass');
    const btnGuardar = document.getElementById('btn-colab-guardar');
    const btnCancelar = document.getElementById('btn-colab-cancelar');
    if (nombreInput) {
        nombreInput.value = colab.user;
        nombreInput.disabled = true;
    }
    if (passInput) {
        passInput.value = "";
        passInput.placeholder = "Clave Acceso (dejar vacío para conservar)";
    }
    (normalizarPermisos(colab.permisos || []) || []).forEach(p => {
        const chk = document.querySelector(`.colab-perm[value="${p}"]`);
        if (chk) chk.checked = true;
    });
    (normalizarAsignacionesEntradas(colab.asignacionesEntradas || []) || []).forEach(x => {
        const chk = document.querySelector(`.colab-entry[value="${x}"]`);
        if (chk) chk.checked = true;
    });
    sincronizarTodosGruposColaborador();

    if (btnGuardar) {
        btnGuardar.textContent = "GUARDAR CAMBIOS";
        btnGuardar.style.background = "#ff9f43";
    }
    if (btnCancelar) btnCancelar.style.display = "";
    document.getElementById('section-user-colaboradores')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelarEdicionColaborador() {
    limpiarFormularioColaborador(true);
}

window.__uiActionLocks = window.__uiActionLocks || new Set();
function tryBeginUiActionLock(lockKey) {
    const key = String(lockKey || '').trim();
    if (!key) return true;
    if (window.__uiActionLocks.has(key)) return false;
    window.__uiActionLocks.add(key);
    return true;
}
function endUiActionLock(lockKey) {
    const key = String(lockKey || '').trim();
    if (!key) return;
    window.__uiActionLocks.delete(key);
}

function ownerDatosActivo() {
    return String(window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || '').trim().toLowerCase();
}

async function crearColaborador() {
    const nombreInput = document.getElementById('colab_name');
    const passInput = document.getElementById('colab_pass');
    const isEditing = !!colaboradorEditandoUser;
    const nombre = (isEditing ? colaboradorEditandoUser : nombreInput.value).trim().toLowerCase();
    const pass = passInput.value;
    const permisosChecks = document.querySelectorAll('.colab-perm:checked');
    let permisos = normalizarPermisos(Array.from(permisosChecks).map(c => c.value));
    const entradasChecks = document.querySelectorAll('.colab-entry:checked');
    const asignacionesEntradas = normalizarAsignacionesEntradas(Array.from(entradasChecks).map(c => c.value));

    if (!nombre) return alert("⚠️ Complete los datos del colaborador.");
    if (!isEditing && !pass) return alert("⚠️ Complete los datos del colaborador.");
    if (!isEditing && db.usuarios.find(u => u.user === nombre)) {
        return alert("⚠️ Ese usuario ya existe.");
    }
    if (permisos.length <= 1) {
        return alert("⚠️ Seleccione al menos una casilla de acceso para el colaborador.");
    }

    const ownerSesion = String(window.obtenerOwnerSesionActual?.() || sesionUser?.user || '').trim().toLowerCase();
    if (!ownerSesion || esColaboradorSesion) return alert("⛔ Solo un usuario maestro activo puede crear colaboradores.");
    permisos = filtrarPermisosRestringidos(permisos, ownerSesion);
    const claveAdmin = prompt("🔐 Ingrese su clave de Usuario Maestro para autorizar este colaborador:");
    if (claveAdmin === null) return;
    const adminAutorizador = (db.usuarios || []).find(u =>
        (u.role === 'admin' || u.role === 'super-master') &&
        u.activo !== false &&
        String(u.user || '').trim().toLowerCase() === ownerSesion &&
        u.pass === String(claveAdmin || '')
    );
    if (!adminAutorizador) return alert("❌ Clave inválida del Usuario Maestro en sesión.");
    const ownerAsignado = ownerSesion;

    const nuevoColaborador = {
        user: nombre,
        pass: pass,
        role: 'colaborador',
        owner: ownerAsignado,
        permisos: permisos,
        asignacionesEntradas: asignacionesEntradas,
        activo: true
    };
    if (isEditing) {
        const existente = (db.usuarios || []).find(u =>
            String(u?.user || '').trim().toLowerCase() === nombre &&
            String(u?.role || '').toLowerCase() === 'colaborador' &&
            (esMasterEnSesion() || u.owner === sesionUser.user)
        );
        if (!existente) return alert("No se encontró el colaborador a editar.");
        nuevoColaborador.pass = pass ? pass : String(existente.pass || '');
        nuevoColaborador.owner = existente.owner || ownerAsignado;
        nuevoColaborador.activo = existente.activo !== false;
    }

    if (typeof window.sincronizarColaboradorNube !== 'function') {
        return alert("☁️ Backend cloud no está disponible.");
    }
    const okCloud = await window.sincronizarColaboradorNube(nuevoColaborador, { silent: true });
    if (okCloud === false) {
        return alert("❌ No se pudo crear el colaborador en la nube.");
    }

    if (isEditing) {
        const idx = db.usuarios.findIndex(u =>
            String(u?.user || '').trim().toLowerCase() === nombre &&
            String(u?.role || '').toLowerCase() === 'colaborador' &&
            (esMasterEnSesion() || u.owner === sesionUser.user)
        );
        if (idx >= 0) db.usuarios[idx] = { ...db.usuarios[idx], ...nuevoColaborador };
    } else {
        db.usuarios.push(nuevoColaborador);
    }

    guardarDatos();
    if (typeof window.autoSubirCloudUrgente === 'function') window.autoSubirCloudUrgente();
    actualizarTablaColaboradores();
    
    limpiarFormularioColaborador(true);
    alert(isEditing ? "✅ Renglones del colaborador actualizados." : "✅ Miembro de equipo añadido.");
}

function actualizarTablaUsuarios() {
    const tabla = document.getElementById('lista-usuarios-tabla');
    if (!tabla) return;
    tabla.innerHTML = "";

    const vistosUsuarios = new Set();
    const usuariosUnicos = (db.usuarios || []).filter(u => {
        if (!u || u.role === 'colaborador') return false;
        const key = String(u.user || '').trim().toLowerCase();
        if (!key || vistosUsuarios.has(key)) return false;
        vistosUsuarios.add(key);
        return true;
    });

    usuariosUnicos.forEach(u => {
        const row = document.createElement('tr');
        const esSistema = (u.user === 'admin' || u.user === MASTER_USER);
        const estadoTxt = u.activo === false ? 'Suspendido' : 'Activo';
        const estadoColor = u.activo === false ? 'var(--danger)' : 'green';
        const cobroTxt = textoCobroUsuario(u);
        const pagoHtml = resumenMetodoPagoUsuario(u);
        row.innerHTML = `
            <td style="padding:10px 0;"><strong>${u.user.toUpperCase()}</strong></td>
            <td><span style="color:${estadoColor}">✅ ${estadoTxt}</span></td>
            <td>${textoMembresiaUsuario(u)}</td>
            <td>${pagoHtml}</td>
            <td style="font-size:12px; color: var(--secondary);">${cobroTxt}</td>
            <td>
                ${!esSistema ? 
                `<button class="btn-warning" onclick="toggleAccesoUsuarioMaestro('${u.user}')" style="background:#ffa801; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-right:6px;">${u.activo === false ? 'Reactivar' : 'Suspender'}</button><button class="btn-danger" onclick="eliminarUsuario('${u.user}')" style="background:#ff4444; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Eliminar</button>` 
                : '<em style="color:#999">Sistema</em>'}
            </td>
        `;
        tabla.appendChild(row);
    });
}

async function toggleAccesoUsuarioMaestro(username) {
    const u = (db.usuarios || []).find(x => x.user === username && x.role !== 'colaborador');
    if (!u) return;
    if ((u.user || '').toLowerCase() === MASTER_USER) return alert("🔒 El usuario maestro no se puede suspender.");
    const estadoPrevio = u.activo !== false;
    u.activo = u.activo === false ? true : false;
    if (typeof window.sincronizarEstadoUsuarioMaestroNube === 'function') {
        const okSync = await window.sincronizarEstadoUsuarioMaestroNube(u.user, u.activo !== false);
        if (okSync === false) {
            u.activo = estadoPrevio;
            return;
        }
    }
    aplicarEstadoUsuariosVinculados(u.user, u.activo !== false);
    guardarDatos();
    actualizarTablaUsuarios();
    actualizarTablaColaboradores();
}

function actualizarTablaColaboradores() {
    const tabla = document.getElementById('lista-colab-tabla');
    if (!tabla) return;
    tabla.innerHTML = "";

    const misColabs = (db.usuarios || []).filter(u => {
        if (u.role !== 'colaborador') return false;
        if (esMasterEnSesion()) return true;
        return u.owner === sesionUser.user;
    });

    misColabs.forEach((c) => {
        const permisosTxt = normalizarPermisos(c.permisos || [])
            .filter(p => p !== 'home')
            .map(etiquetaPermisoRenglon)
            .join(', ') || 'Solo inicio';
        const entradasTxt = normalizarAsignacionesEntradas(c.asignacionesEntradas || [])
            .map(x => x === 'manual' ? 'Manual' : x === 'automatica' ? 'Automática' : 'Historial')
            .join(', ') || 'Sin asignar';
        const estado = c.activo === false ? 'Bloqueado' : 'Activo';
        const colorEstado = c.activo === false ? 'var(--danger)' : 'green';
        const txtAcceso = c.activo === false ? 'Habilitar acceso' : 'Quitar acceso';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding:10px 0;">${c.user}</td>
            <td style="font-size:12px; color: var(--secondary);">${(c.owner || '---').toUpperCase()}</td>
            <td style="color:${colorEstado}; font-weight:bold;">${estado}</td>
            <td style="font-size:12px; color: var(--secondary);">${permisosTxt}</td>
            <td style="font-size:12px; color: var(--secondary);">${entradasTxt}</td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                    <button class="btn btn-warning" onclick="editarRenglonesColaborador('${String(c.user || '').replace(/'/g, "\\'")}')" style="min-width:34px; padding:5px 8px;">✏️</button>
                    <button class="btn-warning" onclick="toggleAccesoColaborador('${c.user}')" style="background:#ffa801; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">${txtAcceso}</button>
                    <button class="btn-danger" onclick="eliminarColaborador('${c.user}')" style="background:#ff4444; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Remover</button>
                </div>
            </td>
        `;
        tabla.appendChild(row);
    });
}

async function eliminarUsuario(username) {
    const lockKey = `eliminar-usuario:${String(username || '').trim().toLowerCase()}`;
    if (!tryBeginUiActionLock(lockKey)) return;
    try {
    if ((username || "").trim().toLowerCase() === MASTER_USER) {
        return alert("🔒 El usuario maestro no puede eliminarse.");
    }
    if (confirm(`¿Está seguro de eliminar al administrador "${username}"?`)) {
        if (typeof window.eliminarUsuarioMaestroNube === 'function') {
            const okDeleteCloud = await window.eliminarUsuarioMaestroNube(username);
            if (okDeleteCloud === false) return;
        }
        const target = String(username || "").trim().toLowerCase();
        db.usuarios = db.usuarios.filter(u => {
            if (!u || !u.user) return true;
            const user = String(u.user || "").trim().toLowerCase();
            const owner = String(u.owner || "").trim().toLowerCase();
            if (user === target) return false;
            if (String(u.role || '').toLowerCase() === 'colaborador' && owner === target) return false;
            return true;
        });
        guardarDatos();
        actualizarTablaUsuarios();
        actualizarTablaColaboradores();
    }
    } finally {
        endUiActionLock(lockKey);
    }
}

async function eliminarColaborador(nombreColab) {
    const lockKey = `eliminar-colaborador:${String(nombreColab || '').trim().toLowerCase()}`;
    if (!tryBeginUiActionLock(lockKey)) return;
    try {
    if (confirm(`¿Remover a ${nombreColab} del equipo?`)) {
        const colab = db.usuarios.find(u => {
            if (u.user !== nombreColab || u.role !== 'colaborador') return false;
            if (esMasterEnSesion()) return true;
            return u.owner === sesionUser.user;
        });
        if (!colab) return;
        if (typeof window.eliminarColaboradorNube !== 'function') {
            return alert("☁️ Backend cloud no está disponible.");
        }
        const okCloud = await window.eliminarColaboradorNube(colab.owner, colab.user, { silent: true });
        if (okCloud === false) {
            return alert("❌ No se pudo remover el colaborador en la nube.");
        }
        db.usuarios = db.usuarios.filter(u => {
            if (u.user !== nombreColab || u.role !== 'colaborador') return true;
            if (esMasterEnSesion()) return false;
            return u.owner !== sesionUser.user;
        });
        guardarDatos();
        if (typeof window.autoSubirCloudUrgente === 'function') window.autoSubirCloudUrgente();
        actualizarTablaColaboradores();
    }
    } finally {
        endUiActionLock(lockKey);
    }
}

async function toggleAccesoColaborador(nombreColab) {
    const colab = db.usuarios.find(u => {
        if (u.user !== nombreColab || u.role !== 'colaborador') return false;
        if (esMasterEnSesion()) return true;
        return u.owner === sesionUser.user;
    });
    if (!colab) return;
    const activoPrevio = colab.activo !== false;
    colab.activo = !activoPrevio;
    if (typeof window.sincronizarColaboradorNube !== 'function') {
        colab.activo = activoPrevio;
        return alert("☁️ Backend cloud no está disponible.");
    }
    const okCloud = await window.sincronizarColaboradorNube(colab, { silent: true });
    if (okCloud === false) {
        colab.activo = activoPrevio;
        return alert("❌ No se pudo actualizar el acceso del colaborador en la nube.");
    }
    guardarDatos();
    if (typeof window.autoSubirCloudUrgente === 'function') window.autoSubirCloudUrgente();
    actualizarTablaColaboradores();
}

let masterVaultOwnerSelected = '';
let masterVaultRefreshTimer = null;

function formatoTiempoSistema(createdAtIso) {
    const txt = String(createdAtIso || '').trim();
    if (!txt) return 'Sin fecha';
    const dt = new Date(txt);
    if (isNaN(dt.getTime())) return 'Sin fecha';
    const dias = Math.max(0, Math.floor((Date.now() - dt.getTime()) / (24 * 60 * 60 * 1000)));
    return `${dias} día(s) · desde ${dt.toLocaleDateString()}`;
}

function detenerAutoRefreshBovedaMaster() {
    if (masterVaultRefreshTimer) clearInterval(masterVaultRefreshTimer);
    masterVaultRefreshTimer = null;
}

function iniciarAutoRefreshBovedaMaster() {
    detenerAutoRefreshBovedaMaster();
    if (String(sesionUser?.role || '').toLowerCase() !== 'super-master') return;
    masterVaultRefreshTimer = setInterval(() => {
        const box = document.getElementById('section-servidor-master');
        if (!box || box.style.display === 'none') return;
        cargarBovedaMaster();
    }, 15000);
}

function pintarResumenControlMaster(stats) {
    const s = stats && typeof stats === 'object' ? stats : {};
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(Number(val || 0));
    };
    set('master-stat-owners', s.totalOwners);
    set('master-stat-colabs', s.totalCollaborators);
    set('master-stat-clients', s.totalClientsRegistered);
    set('master-stat-clients-fid', s.totalClientsFidelizacion);
    set('master-stat-subs-active', s.totalActiveSubscriptions);
    set('master-stat-pay-done', s.totalPaymentsDone);
    set('master-stat-pay-pending', s.totalPaymentsPending);
    set('master-stat-pay-failed', s.totalPaymentsFailed);
}

async function cargarResumenControlMaster() {
    if (typeof window.obtenerResumenControlMasterCloud !== 'function') return;
    try {
        const stats = await window.obtenerResumenControlMasterCloud();
        pintarResumenControlMaster(stats || {});
    } catch (_e) {
        pintarResumenControlMaster({});
    }
}

async function cargarNotificacionesPagoMaster() {
    const body = document.getElementById('master-vault-payments-body');
    if (!body) return;
    if (typeof window.listarNotificacionesPagosMasterCloud !== 'function') {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777;">Backend no disponible.</td></tr>';
        return;
    }
    try {
        const list = await window.listarNotificacionesPagosMasterCloud(80);
        if (!Array.isArray(list) || !list.length) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777;">Sin notificaciones.</td></tr>';
            return;
        }
        body.innerHTML = list.map((n) => {
            const fecha = n?.createdAt ? new Date(n.createdAt).toLocaleString() : '---';
            const estado = String(n?.paymentStatus || '---').toUpperCase();
            const color = estado.includes('PAID') ? '#1f8f4c' : '#a66a00';
            const monto = Number(n?.amountUSD || 0).toFixed(2);
            const owner = String(n?.owner || '---').toUpperCase();
            return `<tr>
              <td>${owner}</td>
              <td>${fecha}</td>
              <td style="color:${color}; font-weight:700;">${estado}</td>
              <td>USD$${monto}</td>
            </tr>`;
        }).join('');
    } catch (_e) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#c0392b;">Error al cargar notificaciones.</td></tr>';
    }
}

async function verColaboradoresBoveda(owner) {
    const ownerKey = String(owner || '').trim().toLowerCase();
    if (!ownerKey) return;
    masterVaultOwnerSelected = ownerKey;
    const title = document.getElementById('master-vault-collab-title');
    const body = document.getElementById('master-vault-collab-body');
    if (title) title.textContent = `Colaboradores de ${ownerKey.toUpperCase()}`;
    if (!body) return;
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777;">Cargando...</td></tr>';
    if (typeof window.refrescarColaboradoresCloud !== 'function') {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777;">Backend no disponible.</td></tr>';
        return;
    }
    try {
        const list = await window.refrescarColaboradoresCloud({ owner: ownerKey, silent: true });
        if (!Array.isArray(list) || !list.length) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777;">Sin colaboradores.</td></tr>';
            return;
        }
        body.innerHTML = list.map((c) => {
            const user = String(c?.username || c?.user || '').trim().toLowerCase();
            const activo = c?.activo !== false;
            const color = activo ? '#1f8f4c' : '#c0392b';
            const txt = activo ? 'Activo' : 'Suspendido';
            const createdTxt = c?.createdAt ? new Date(c.createdAt).toLocaleDateString() : '---';
            return `<tr>
              <td>${user}</td>
              <td style="color:${color}; font-weight:700;">${txt}</td>
              <td>${createdTxt}</td>
              <td><button class="btn btn-danger" onclick="eliminarColaboradorDesdeBoveda('${ownerKey}','${user}')">Eliminar total</button></td>
            </tr>`;
        }).join('');
    } catch (_e) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#c0392b;">Error cargando colaboradores.</td></tr>';
    }
}

async function eliminarColaboradorDesdeBoveda(owner, username) {
    const ownerKey = String(owner || '').trim().toLowerCase();
    const userKey = String(username || '').trim().toLowerCase();
    if (!ownerKey || !userKey) return;
    if (!confirm(`Eliminar totalmente al colaborador "${userKey}" del maestro "${ownerKey}"?\n\nSe borrará de Firestore y de referencias relacionadas.`)) return;
    if (typeof window.eliminarColaboradorBovedaCloud !== 'function') return alert('Backend cloud no disponible.');
    const ok = await window.eliminarColaboradorBovedaCloud(ownerKey, userKey);
    if (!ok) return alert('No se pudo eliminar en Firestore.');
    if (typeof window.autoSubirCloudUrgente === 'function') window.autoSubirCloudUrgente();
    await verColaboradoresBoveda(ownerKey);
    await cargarBovedaMaster();
}

async function eliminarMaestroDesdeBoveda(owner) {
    const ownerKey = String(owner || '').trim().toLowerCase();
    if (!ownerKey || ownerKey === MASTER_USER) return;
    if (!confirm(`Eliminar totalmente al usuario maestro "${ownerKey}"?\n\nEsta acción elimina owner, negocio, colaboradores y accesos en Firestore.`)) return;
    if (typeof window.eliminarUsuarioMaestroBovedaCloud !== 'function') return alert('Backend cloud no disponible.');
    const ok = await window.eliminarUsuarioMaestroBovedaCloud(ownerKey);
    if (!ok) return alert('No se pudo eliminar en Firestore.');
    window.eliminarUsuarioMaestroLocal?.(ownerKey);
    masterVaultOwnerSelected = '';
    await cargarBovedaMaster();
}

async function cargarBovedaMaster() {
    const statusEl = document.getElementById('master-vault-status');
    const body = document.getElementById('master-vault-body');
    if (!statusEl || !body) return;
    statusEl.textContent = 'Cargando bóveda...';
    statusEl.style.color = '#666';
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777;">Cargando...</td></tr>';
    if (typeof window.obtenerBovedaMasterCloud !== 'function') {
        statusEl.textContent = 'Backend cloud no disponible.';
        statusEl.style.color = '#c0392b';
        return;
    }
    try {
        const rs = await window.obtenerBovedaMasterCloud();
        const owners = Array.isArray(rs?.owners) ? rs.owners : [];
        if (!owners.length) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777;">Sin usuarios maestros.</td></tr>';
            statusEl.textContent = 'Sin registros.';
            return;
        }
        body.innerHTML = owners.map((o) => {
            const owner = String(o?.username || '').trim().toLowerCase();
            const withColabs = Number(o?.collaboratorsCount || 0) > 0;
            const isOnline = o?.online === true;
            const rowClass = [withColabs ? 'master-owner-highlight' : '', isOnline ? 'master-owner-online' : ''].filter(Boolean).join(' ');
            const estadoActivo = o?.activo !== false;
            const estadoTxt = estadoActivo ? 'Activo' : 'Suspendido';
            const estadoColor = estadoActivo ? '#1f8f4c' : '#c0392b';
            const colabsTxt = `${Number(o?.collaboratorsCount || 0)} colaborador(es)`;
            const marca = withColabs ? '<span class="master-owner-indicator"></span>' : '';
            const onlineBadge = isOnline ? '<span class="master-owner-online-badge">EN LINEA</span>' : '';
            const noDelete = owner === MASTER_USER;
            return `<tr class="${rowClass}">
              <td>${marca}<strong>${owner.toUpperCase()}</strong>${onlineBadge}</td>
              <td>${String(o?.empresa || '---')}</td>
              <td>${formatoTiempoSistema(o?.createdAt)}</td>
              <td style="color:${estadoColor}; font-weight:700;">${estadoTxt}</td>
              <td>${colabsTxt}</td>
              <td style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn btn-blue" onclick="verColaboradoresBoveda('${owner}')">Ver colaboradores</button>
                ${noDelete ? '<em style="color:#777;">Sistema</em>' : `<button class="btn btn-danger" onclick="eliminarMaestroDesdeBoveda('${owner}')">Eliminar total</button>`}
              </td>
            </tr>`;
        }).join('');
        const onlineCount = owners.filter((o) => o?.online === true).length;
        statusEl.textContent = `Bóveda cargada (${owners.length} maestro(s), ${onlineCount} en línea).`;
        statusEl.style.color = '#1f8f4c';
        if (masterVaultOwnerSelected) await verColaboradoresBoveda(masterVaultOwnerSelected);
    } catch (e) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#c0392b;">Error cargando bóveda.</td></tr>';
        statusEl.textContent = `Error: ${String(e?.message || e || 'interno')}`;
        statusEl.style.color = '#c0392b';
    }
    await Promise.all([cargarNotificacionesPagoMaster(), cargarResumenControlMaster()]);
}

const MASTER_DETAIL_LABELS = {
    owners: 'Maestros',
    collaborators: 'Colaboradores',
    clients_saas: 'Clientes (SaaS)',
    clients_fidelizacion: 'Clientes (fidelización)',
    subs_active: 'Suscripciones activas',
    pay_done: 'Pagos realizados',
    pay_pending: 'Pagos pendientes',
    pay_failed: 'Pagos fallidos'
};

let masterDetailCurrentType = '';
let masterDetailItemsCache = [];

function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

window.cerrarDetalleControlMaster = function () {
    const modal = document.getElementById('master-detail-modal');
    if (modal) modal.style.display = 'none';
    masterDetailCurrentType = '';
    masterDetailItemsCache = [];
};

function renderMasterDetailTable(type, items = []) {
    const head = document.getElementById('master-detail-head');
    const body = document.getElementById('master-detail-body');
    if (!head || !body) return;
    if (!Array.isArray(items) || !items.length) {
        head.innerHTML = '<tr><th>Detalle</th></tr>';
        body.innerHTML = '<tr><td style="text-align:center; color:#777;">Sin registros.</td></tr>';
        return;
    }
    if (type === 'owners') {
        head.innerHTML = '<tr><th>Usuario</th><th>Empresa</th><th>Estado</th><th>Plan</th><th>Creación</th><th>Acción</th></tr>';
        body.innerHTML = items.map((it) => `<tr>
            <td>${escapeHtml(it.username || '')}</td>
            <td>${escapeHtml(it.empresa || '---')}</td>
            <td>${it.activo === false ? 'Suspendido' : 'Activo'}</td>
            <td>${escapeHtml(it.plan || '---')}</td>
            <td>${escapeHtml(formatoTiempoSistema(it.createdAt))}</td>
            <td><button class="btn btn-danger" onclick="eliminarDetalleControlMaster('${type}','${escapeHtml(it.id || '')}')">Borrar</button></td>
        </tr>`).join('');
        return;
    }
    if (type === 'collaborators') {
        head.innerHTML = '<tr><th>Owner</th><th>Usuario</th><th>Estado</th><th>Creación</th><th>Acción</th></tr>';
        body.innerHTML = items.map((it) => `<tr>
            <td>${escapeHtml(it.owner || '')}</td>
            <td>${escapeHtml(it.username || '')}</td>
            <td>${it.activo === false ? 'Suspendido' : 'Activo'}</td>
            <td>${escapeHtml(formatoTiempoSistema(it.createdAt))}</td>
            <td><button class="btn btn-danger" onclick="eliminarDetalleControlMaster('${type}','${escapeHtml(it.id || '')}')">Borrar</button></td>
        </tr>`).join('');
        return;
    }
    if (type === 'clients_saas') {
        head.innerHTML = '<tr><th>Owner</th><th>Negocio</th><th>Admin</th><th>Email</th><th>Teléfono</th><th>Acción</th></tr>';
        body.innerHTML = items.map((it) => `<tr>
            <td>${escapeHtml(it.owner || '')}</td>
            <td>${escapeHtml(it.negocio || '---')}</td>
            <td>${escapeHtml(it.admin || '---')}</td>
            <td>${escapeHtml(it.email || '---')}</td>
            <td>${escapeHtml(it.phone || '---')}</td>
            <td><button class="btn btn-danger" onclick="eliminarDetalleControlMaster('${type}','${escapeHtml(it.id || '')}')">Borrar</button></td>
        </tr>`).join('');
        return;
    }
    if (type === 'clients_fidelizacion') {
        head.innerHTML = '<tr><th>Owner</th><th>Nombre</th><th>Cédula/RNC</th><th>Teléfono</th><th>Código</th><th>Acción</th></tr>';
        body.innerHTML = items.map((it) => `<tr>
            <td>${escapeHtml(it.owner || '')}</td>
            <td>${escapeHtml(it.nombre || '')}</td>
            <td>${escapeHtml(it.cedula || it.rnc || '---')}</td>
            <td>${escapeHtml(it.telefono || '---')}</td>
            <td>${escapeHtml(it.codigo || '---')}</td>
            <td><button class="btn btn-danger" onclick="eliminarDetalleControlMaster('${type}','${escapeHtml(it.id || '')}')">Borrar</button></td>
        </tr>`).join('');
        return;
    }
    if (type === 'subs_active') {
        head.innerHTML = '<tr><th>Owner</th><th>Plan</th><th>Estado</th><th>Próx. cobro</th><th>Acción</th></tr>';
        body.innerHTML = items.map((it) => `<tr>
            <td>${escapeHtml(it.owner || '')}</td>
            <td>${escapeHtml(it.plan || '---')}</td>
            <td>${escapeHtml(it.estado || '---')}</td>
            <td>${escapeHtml(formatoTiempoSistema(it.nextChargeAt))}</td>
            <td><button class="btn btn-danger" onclick="eliminarDetalleControlMaster('${type}','${escapeHtml(it.id || '')}')">Borrar</button></td>
        </tr>`).join('');
        return;
    }
    head.innerHTML = '<tr><th>Usuario</th><th>Plan</th><th>Estado</th><th>Monto USD</th><th>Fecha</th><th>Acción</th></tr>';
    body.innerHTML = items.map((it) => `<tr>
        <td>${escapeHtml(it.owner || '')}</td>
        <td>${escapeHtml(it.plan || '---')}</td>
        <td>${escapeHtml(it.paymentStatus || '---')}</td>
        <td>${Number(it.amountUSD || 0).toFixed(2)}</td>
        <td>${escapeHtml(formatoTiempoSistema(it.createdAt))}</td>
        <td><button class="btn btn-danger" onclick="eliminarDetalleControlMaster('${type}','${escapeHtml(it.id || '')}')">Borrar</button></td>
    </tr>`).join('');
}

window.abrirDetalleControlMaster = async function (type) {
    const t = String(type || '').trim();
    if (!t) return;
    if (typeof window.obtenerDetalleControlMasterCloud !== 'function') return alert('Backend cloud no disponible.');
    const modal = document.getElementById('master-detail-modal');
    const title = document.getElementById('master-detail-title');
    const status = document.getElementById('master-detail-status');
    if (!modal || !title || !status) return;
    masterDetailCurrentType = t;
    modal.style.display = 'flex';
    title.textContent = `Detalle: ${MASTER_DETAIL_LABELS[t] || t}`;
    status.textContent = 'Cargando registros...';
    status.style.color = '#666';
    try {
        const items = await window.obtenerDetalleControlMasterCloud(t);
        masterDetailItemsCache = Array.isArray(items) ? items : [];
        renderMasterDetailTable(t, masterDetailItemsCache);
        status.textContent = `Total: ${masterDetailItemsCache.length}`;
        status.style.color = '#1f8f4c';
    } catch (e) {
        status.textContent = `Error: ${String(e?.message || e || 'interno')}`;
        status.style.color = '#c0392b';
        renderMasterDetailTable(t, []);
    }
};

window.eliminarDetalleControlMaster = async function (type, id) {
    const t = String(type || masterDetailCurrentType || '').trim();
    const itemId = String(id || '').trim();
    if (!t || !itemId) return;
    const item = (masterDetailItemsCache || []).find((x) => String(x?.id || '') === itemId) || null;
    if (!confirm(`¿Eliminar este registro de "${MASTER_DETAIL_LABELS[t] || t}"?`)) return;
    if (typeof window.eliminarDetalleControlMasterCloud !== 'function') return alert('Backend cloud no disponible.');
    const payload = { type: t, id: itemId };
    if (item?.owner) payload.owner = String(item.owner).toLowerCase();
    if (item?.username) payload.username = String(item.username).toLowerCase();
    const ok = await window.eliminarDetalleControlMasterCloud(payload);
    if (!ok) return alert('No se pudo eliminar.');
    await window.abrirDetalleControlMaster(t);
    await cargarBovedaMaster();
    if (typeof window.autoSubirCloudUrgente === 'function') window.autoSubirCloudUrgente();
};

// Inicializar tablas al cargar la sección de configuración
// Debes llamar a estas funciones dentro de tu función showPage('configuracion')

function entradaAutomaticaMasiva() {
    if (bloquearAccionAdministrativaColaborador()) return;
    if (!tieneAsignacionEntrada('automatica')) {
        return alert("🚫 No tiene asignación para entrada automática masiva.");
    }
    // 1. Verificar si hay productos faltantes
    let productosFaltantes = db.almacen.filter(it => 
        it.owner === sesionUser.user && 
        it.modulo === moduloActual && 
        (it.ideal - it.actual) > 0
    );

    if (productosFaltantes.length === 0) {
        return alert("✅ El almacén ya está en su existencia ideal. No hay faltantes.");
    }

    // 2. PEDIR CONTRASEÑA DE AUTORIZACIÓN
    let passConfirm = prompt("🔒 SEGURIDAD: Ingrese su contraseña para autorizar la ENTRADA MASIVA:");

    // 3. Validar contra la contraseña del usuario en sesión
    if (passConfirm === null) return; // Si cancela el prompt

    if (passConfirm === sesionUser.pass) {
        let confirmacionFinal = confirm(`Contraseña correcta.\nSe actualizarán ${productosFaltantes.length} productos.\n\n¿Desea proceder?`);

        if (confirmacionFinal) {
            productosFaltantes.forEach(prod => {
                let cantidadFaltante = prod.ideal - prod.actual;
                
                // Cálculo de costo basado en el historial prorrateado
                let costoUnitario = prod.costoTotal / (prod.actual || 1); 
                let costoDelFaltante = cantidadFaltante * costoUnitario;

                // Actualizar Stock al Ideal
                prod.actual = prod.ideal;

                // Registrar en el historial de entradas
                db.entradas.push({
                    fecha: new Date().toLocaleString(),
                    producto: prod.nombre,
                    cantidad: cantidadFaltante,
                    unidad: prod.unidad,
                    operador: sesionUser.user,
                    modulo: moduloActual,
                    owner: sesionUser.user,
                    tipo: 'AUTOMATICO_MASIVO'
                });
            });

            // Guardar y Recargar
            guardarDatos();
            alert(`✅ ¡Éxito! Existencia nivelada correctamente.\nLa página se recargará ahora.`);
            location.reload();
        }
    } else {
        alert("❌ Contraseña incorrecta. Acción cancelada por seguridad.");
    }
}

// Variable global para datos del cliente actual
let datosClienteGlobal = { rnc: "", nombre: "", telefono: "" };
let facturaActualItems = [];
let facturaActualMesa = "";
let clientePagoModalId = null;
let calendarioCobroInterval = null;
let WHATSAPP_DEFAULT = localStorage.getItem('LURO_WHATSAPP_DEFAULT') || "18297886552";
const DGII_RNC_PROXY = localStorage.getItem('DGII_RNC_PROXY') || 'http://localhost:8787/api/dgii/rnc';

function normalizarTelefonoWhatsapp(numero) {
    return (numero || '').toString().replace(/[^\d]/g, '');
}

function abrirWhatsAppConMensaje(numero, mensaje, opts = {}) {
    const { noRedirect = false } = opts;
    let telefono = normalizarTelefonoWhatsapp(numero || WHATSAPP_DEFAULT);
    if (!telefono) {
        telefono = normalizarTelefonoWhatsapp(prompt("Ingrese número de WhatsApp (solo dígitos):") || "");
        if (!telefono) return false;
    }
    const texto = String(mensaje || '').trim();
    if (!texto) {
        alert("No hay contenido para enviar por WhatsApp.");
        return false;
    }
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    const win = window.open(url, '_blank');
    if (!win) {
        const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
        if (isMobile) {
            const appUrl = `whatsapp://send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`;
            window.location.href = appUrl;
            if (!noRedirect) {
                setTimeout(() => { window.location.href = url; }, 650);
            }
            return true;
        }
        // Fallback si el navegador bloquea popups.
        if (!noRedirect) {
            window.location.href = url;
            return true;
        }
        return false;
    }
    return true;
}

const MSG_USUARIO_SUSPENDIDO = "Usuario suspendido, comuniquese con su proveedor";
const MSG_USUARIO_INACTIVO = MSG_USUARIO_SUSPENDIDO;
window.MSG_USUARIO_SUSPENDIDO = MSG_USUARIO_SUSPENDIDO;

window.eliminarUsuarioMaestroLocal = function(username) {
    const user = String(username || '').trim().toLowerCase();
    if (!user || user === MASTER_USER) return false;
    const before = (db.usuarios || []).length;
    db.usuarios = (db.usuarios || []).filter(u => {
        const uName = String(u?.user || '').trim().toLowerCase();
        const uOwner = String(u?.owner || '').trim().toLowerCase();
        if (uName === user) return false;
        if ((u.role || '').toLowerCase() === 'colaborador' && uOwner === user) return false;
        return true;
    });
    if (db.registroInicialUsuarios && typeof db.registroInicialUsuarios === 'object') {
        delete db.registroInicialUsuarios[user];
    }
    const changed = (db.usuarios || []).length !== before;
    if (changed) {
        guardarDatos();
        actualizarTablaUsuarios();
        actualizarTablaColaboradores();
    }
    return changed;
};

window.forzarLogoutPorRevocacion = function(mensaje = MSG_USUARIO_INACTIVO) {
    if (window.__accesoRevocadoActual) return;
    window.__accesoRevocadoActual = true;
    detenerAutoRefreshBovedaMaster();
    if (typeof window.detenerGuardiaSesionActiva === 'function') window.detenerGuardiaSesionActiva();
    try { if (typeof window.detenerListenerCloudTiempoReal === 'function') window.detenerListenerCloudTiempoReal(); } catch (_) {}
    sesionUser = null;
    operadorActual = "";
    loginClave = "";
    window.loginClave = "";
    permisosSesion = [];
    asignacionesEntradasSesion = [];
    esColaboradorSesion = false;
    cuentaLoginActual = "";
    window.cuentaLoginActual = "";
    usuarioSesionLabel = "";
    window.usuarioActivoCloud = "";
    localStorage.removeItem('LURO_OWNER_SYNC');
    const login = document.getElementById('login-overlay');
    const selector = document.getElementById('module-selector');
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    if (login) login.style.display = 'flex';
    if (selector) selector.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (main) main.style.display = 'none';
    if (typeof window.cerrarSesionBackend === 'function') window.cerrarSesionBackend();
    alert(mensaje);
};

window.iniciarGuardiaSesionActiva = function () {
    if (window.__guardiaSesionTimer) clearInterval(window.__guardiaSesionTimer);
    window.__guardiaSesionEnCurso = false;
    window.__guardiaSesionTimer = setInterval(async () => {
        if (window.__guardiaSesionEnCurso) return;
        if (!sesionUser || !sesionUser.user) return;
        if (!cuentaLoginActual || !loginClave) return;
        window.__guardiaSesionEnCurso = true;
        try {
            if (typeof window.validarSesionActivaCloud === 'function') {
                const ok = await window.validarSesionActivaCloud({ silent: true });
                // Solo cerrar sesión cuando backend confirme revocación real.
                if (ok === false && !window.__accesoRevocadoActual) {
                    window.forzarLogoutPorRevocacion(MSG_USUARIO_INACTIVO);
                }
            }
        } catch (_) {
            // no-op: errores de red temporales no deben cerrar sesión local.
        } finally {
            window.__guardiaSesionEnCurso = false;
        }
    }, 2200);
};

window.detenerGuardiaSesionActiva = function () {
    if (window.__guardiaSesionTimer) clearInterval(window.__guardiaSesionTimer);
    window.__guardiaSesionTimer = null;
    window.__guardiaSesionEnCurso = false;
};

window.verificarSesionRevocadaEnNube = function(registrosNube = []) {
    if (!sesionUser || !sesionUser.user) return false;
    if (!Array.isArray(registrosNube)) return false;
    const ownerSesion = String(window.obtenerOwnerSesionActual?.() || '').trim().toLowerCase();
    if (!ownerSesion) return false;
    // El super-master no se invalida por ausencia en listados parciales de owners.
    if (ownerSesion === MASTER_USER || String(sesionUser?.role || '').toLowerCase() === 'super-master') return false;
    if (!window.__cloudOwnersConocidos || !(window.__cloudOwnersConocidos instanceof Set)) {
        window.__cloudOwnersConocidos = new Set();
    }
    const lista = Array.isArray(registrosNube) ? registrosNube : [];
    const ownerData = lista.find(x => String(x?.username || '').trim().toLowerCase() === ownerSesion);
    const ownerConocidoAntes = window.__cloudOwnersConocidos.has(ownerSesion);
    if (ownerData?.username) window.__cloudOwnersConocidos.add(ownerSesion);
    if ((ownerData && ownerData.activo === false) || (!ownerData && ownerConocidoAntes)) {
        window.forzarLogoutPorRevocacion(MSG_USUARIO_INACTIVO);
        return true;
    }
    return false;
};

window.verificarColaboradorSesionRevocadaEnNube = function (owner, colaboradores = []) {
    if (!sesionUser || !sesionUser.user) return false;
    if (!esColaboradorSesion) return false;
    if (!Array.isArray(colaboradores)) return false;
    const ownerSesion = String(window.obtenerOwnerSesionActual?.() || '').trim().toLowerCase();
    const ownerCheck = String(owner || ownerSesion).trim().toLowerCase();
    if (!ownerSesion || !ownerCheck || ownerSesion !== ownerCheck) return false;
    const userSesion = String(cuentaLoginActual || operadorActual || '').trim().toLowerCase();
    if (!userSesion) return false;

    if (!window.__cloudColabsConocidos || !(window.__cloudColabsConocidos instanceof Set)) {
        window.__cloudColabsConocidos = new Set();
    }
    const key = `${ownerSesion}::${userSesion}`;
    const conocidoAntes = window.__cloudColabsConocidos.has(key);
    const colabData = colaboradores.find((c) => String(c?.username || c?.user || '').trim().toLowerCase() === userSesion);
    if (colabData?.username || colabData?.user) window.__cloudColabsConocidos.add(key);

    if ((colabData && colabData.activo === false) || (!colabData && conocidoAntes)) {
        window.forzarLogoutPorRevocacion(MSG_USUARIO_INACTIVO);
        return true;
    }
    return false;
};

function normalizarRNC(rnc) {
    return (rnc || '').toString().replace(/[^0-9]/g, '');
}

function normalizarCedulaCliente(v) {
    return (v || '').toString().replace(/[^0-9]/g, '');
}

function normalizarNombreCliente(v) {
    return (v || '').toString().trim().toUpperCase();
}

function puntosPorCompra(totalRD$) {
    const total = Number(totalRD$ || 0);
    if (!isFinite(total) || total <= 0) return 0;
    return Math.floor(total / 100) * 3;
}

let MEMBRESIA_PUNTOS_MENSUAL = 2;
const PLANES_MEMBRESIA = {
    black: {
        id: 'black',
        nombre: 'Membresía Black',
        mensualUSD: 99.99,
        descuentoPorc: 25,
        cupoCostoProd: 6,
        tipoBeneficio: 'costo_produccion',
        descripcion: '6 platos/mes a costo de producción'
    },
    premium: {
        id: 'premium',
        nombre: 'Membresía Premium',
        mensualUSD: 30.00,
        descuentoPorc: 5.0,
        cupoCostoProd: 3,
        tipoBeneficio: 'costo_produccion',
        descripcion: '3 platos/mes a costo de producción'
    },
    basica: {
        id: 'basica',
        nombre: 'Membresía Básica',
        mensualUSD: 20.00,
        descuentoPorc: 3.0,
        desayunosGratis: 5,
        incluyeBebida: true,
        tipoBeneficio: 'desayuno_gratis',
        descripcion: '5 desayunos/mes gratis + 1 bebida incluida'
    }
};

const DESAYUNOS_BASICA = ['TOSTADAS', 'PANCAKES', 'TOSTADA FRANCESA'];
const BEBIDAS_BASICA = ['CAFE', 'JUGO', 'TE', 'CHOCOLATE', 'LECHE'];

function claveMesActual() {
    const f = new Date();
    const y = f.getFullYear();
    const m = String(f.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function aplicarConfigMembresiaDesdeDB() {
    if (!db || typeof db !== 'object') return;
    if (!db.configMembresia || typeof db.configMembresia !== 'object') db.configMembresia = {};
}

function renderConfigPlanMembresia() {
    const resumen = document.getElementById('plan-membresia-resumen');
    if (!resumen) return;
    const cards = Object.values(PLANES_MEMBRESIA).map(p => `
      <div style="background:#fff; border:1px solid #dfe6e9; border-radius:8px; padding:10px; margin-bottom:8px;">
        <div style="font-size:16px; font-weight:800; color:#2f3542;">${p.nombre}</div>
        <div style="font-size:14px; color:#485460;">USD$${Number(p.mensualUSD).toFixed(2)} mensual | ${Number(p.descuentoPorc).toFixed(1)}% descuento premium | ${p.descripcion}</div>
      </div>
    `).join('');
    resumen.innerHTML = cards;
}

function obtenerPlanCliente(cliente) {
    const id = (cliente?.planMembresiaId || 'premium').toLowerCase();
    return PLANES_MEMBRESIA[id] || PLANES_MEMBRESIA.premium;
}

function limiteBeneficioPlan(plan) {
    if (!plan) return 0;
    return plan.tipoBeneficio === 'desayuno_gratis'
        ? Number(plan.desayunosGratis || 0)
        : Number(plan.cupoCostoProd || 0);
}

function esDesayunoBasica(nombre) {
    const n = (nombre || '').toString().toUpperCase();
    return DESAYUNOS_BASICA.some(x => n.includes(x));
}

function esBebidaBasica(nombre) {
    const n = (nombre || '').toString().toUpperCase();
    return BEBIDAS_BASICA.some(x => n.includes(x));
}

function cambiarPlanCliente(clienteId, planId) {
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clienteId);
    if (!cliente) return;
    if (!PLANES_MEMBRESIA[planId]) return;
    cliente.planMembresiaId = planId;
    cliente.updatedAt = new Date().toISOString();
    guardarDatos();
    renderTablaClientesPuntos();
}

function limpiarClientesPuntosMasivo() {
    if (!confirm('⚠️ Esta acción eliminará TODOS los clientes y sus puntos. ¿Desea continuar?')) return;
    const clave = prompt('Ingrese contraseña para confirmar eliminación masiva:');
    if (clave === null) return;
    const valida = (sesionUser && sesionUser.pass && clave === sesionUser.pass) || clave === MASTER_PASS;
    if (!valida) return alert('Contraseña incorrecta.');
    db.clientesFidelizacion = [];
    guardarDatos();
    renderTablaClientesPuntos();
    alert('Todos los clientes fueron eliminados.');
}

function normalizarNumeroTarjeta(v) {
    return (v || '').toString().replace(/[^\d]/g, '');
}

function detectarMarcaTarjeta(numeroLimpio) {
    if (/^4/.test(numeroLimpio)) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(numeroLimpio)) return 'MASTERCARD';
    if (/^3[47]/.test(numeroLimpio)) return 'AMEX';
    return 'TARJETA';
}

function enmascararTarjeta(numeroLimpio) {
    if (!numeroLimpio) return '****';
    const ult4 = numeroLimpio.slice(-4);
    return `**** **** **** ${ult4}`;
}

function formatearFechaISO(fecha) {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function sumarMesesAFechaISO(fechaISO, meses = 1) {
    const base = new Date(`${fechaISO}T00:00:00`);
    if (isNaN(base.getTime())) return '';
    const d = new Date(base);
    d.setMonth(d.getMonth() + meses);
    return formatearFechaISO(d);
}

function diasHastaFechaISO(fechaISO) {
    if (!fechaISO) return NaN;
    const hoy = new Date();
    const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const destino = new Date(`${fechaISO}T00:00:00`);
    if (isNaN(destino.getTime())) return NaN;
    const diff = destino.getTime() - hoyDate.getTime();
    return Math.floor(diff / 86400000);
}

function clienteTieneMetodoPago(cliente) {
    return !!(cliente && cliente.transferencia && cliente.transferencia.tarjetaOrigen && cliente.transferencia.tarjetaOrigen.last4 && cliente.transferencia.receptor && cliente.transferencia.receptor.cuenta && cliente.transferencia.receptor.telefono);
}

function enviarRecordatorioPagoWhatsApp(cliente, tipoAviso) {
    const tel = normalizarTelefonoWhatsapp(cliente?.telefono || '');
    if (!tel) return;
    const plan = obtenerPlanCliente(cliente);
    const receptor = cliente.transferencia?.receptor || {};
    const fechaCobro = cliente.suscripcionProximoCobro || '';
    const monto = `USD$${Number(plan.mensualUSD).toFixed(2)}`;
    let mensaje = `Hola ${cliente.nombre}, recordatorio de su membresía mensual (${monto}).\n`;
    if (tipoAviso === 'faltan3') {
        mensaje += `Faltan 3 días para su fecha de pago: ${fechaCobro}.`;
    } else {
        mensaje += `Hoy (${fechaCobro}) corresponde su fecha de pago. Favor saldar para mantener la membresía activa.`;
    }
    mensaje += `\n\nTransferencia a:\nBanco: ${receptor.banco || 'N/D'}\nCuenta: ${receptor.cuenta || 'N/D'}\nNombre: ${receptor.nombre || 'N/D'} ${receptor.apellido || ''}\nCédula: ${receptor.cedula || 'N/D'}\nTeléfono: ${receptor.telefono || 'N/D'}`;
    abrirWhatsAppConMensaje(tel, mensaje, { noRedirect: true });
}

function revisarRecordatoriosPagoCliente(cliente) {
    if (!cliente || !cliente.suscripcionActiva || !clienteTieneMetodoPago(cliente) || !cliente.suscripcionProximoCobro) return;
    const dias = diasHastaFechaISO(cliente.suscripcionProximoCobro);
    if (!isFinite(dias)) return;
    const marcaFecha = cliente.suscripcionProximoCobro;
    if (dias === 3 && cliente.ultimoAvisoPago3dias !== marcaFecha) {
        enviarRecordatorioPagoWhatsApp(cliente, 'faltan3');
        cliente.ultimoAvisoPago3dias = marcaFecha;
        cliente.updatedAt = new Date().toISOString();
        guardarDatos();
    }
    if (dias === 0 && cliente.ultimoAvisoPagoVencimiento !== marcaFecha) {
        enviarRecordatorioPagoWhatsApp(cliente, 'vencimiento');
        cliente.ultimoAvisoPagoVencimiento = marcaFecha;
        cliente.updatedAt = new Date().toISOString();
        guardarDatos();
    }
}

function ejecutarCalendarioCobros() {
    if (!Array.isArray(db.clientesFidelizacion)) return;
    db.clientesFidelizacion.forEach(c => revisarRecordatoriosPagoCliente(c));
}

function iniciarCalendarioCobros() {
    ejecutarCalendarioCobros();
    if (calendarioCobroInterval) return;
    calendarioCobroInterval = setInterval(ejecutarCalendarioCobros, 60 * 1000);
}

function procesarCobroMembresia(cliente, opts = {}) {
    if (!cliente) return false;
    const { tipo = 'manual', silencio = false } = opts;
    const mes = claveMesActual();
    if (!Array.isArray(cliente.premiumPagosHistorial)) cliente.premiumPagosHistorial = [];
    if (!Array.isArray(cliente.transferenciasAhorroHistorial)) cliente.transferenciasAhorroHistorial = [];

    if (cliente.premiumMesCobrado === mes && cliente.premiumActivo) return true;
    if (!clienteTieneMetodoPago(cliente)) {
        if (!silencio) alert('Este cliente no tiene datos de transferencia configurados.');
        return false;
    }
    const plan = obtenerPlanCliente(cliente);

    cliente.premiumActivo = true;
    cliente.premiumMesReferencia = mes;
    cliente.premiumMesCobrado = mes;
    cliente.premiumPlatosCostoUsados = 0;
    cliente.puntos = Number(cliente.puntos || 0) + MEMBRESIA_PUNTOS_MENSUAL;
    cliente.updatedAt = new Date().toISOString();

    const tarjeta = cliente.transferencia?.tarjetaOrigen || {};
    const receptor = cliente.transferencia?.receptor || {};
    cliente.premiumPagosHistorial.unshift({
        fecha: new Date().toISOString(),
        montoUSD: Number(plan.mensualUSD || 0),
        puntosOtorgados: MEMBRESIA_PUNTOS_MENSUAL,
        mes,
        tipo,
        tarjeta: `${tarjeta.marca || 'TARJETA'} ${tarjeta.last4 || ''}`.trim(),
        planId: plan.id,
        planNombre: plan.nombre
    });
    cliente.transferenciasAhorroHistorial.unshift({
        fecha: new Date().toISOString(),
        mes,
        montoUSD: Number(plan.mensualUSD || 0),
        banco: receptor.banco || 'BANCO',
        cuenta: receptor.cuenta || '',
        receptor: `${receptor.nombre || ''} ${receptor.apellido || ''}`.trim()
    });

    const baseCobro = cliente.suscripcionProximoCobro || formatearFechaISO(new Date());
    cliente.suscripcionProximoCobro = sumarMesesAFechaISO(baseCobro, 1);
    return true;
}

function refrescarEstadoMembresia(cliente) {
    if (!cliente) return;
    const mes = claveMesActual();
    if (!Array.isArray(cliente.premiumPagosHistorial)) cliente.premiumPagosHistorial = [];
    if (!Array.isArray(cliente.transferenciasAhorroHistorial)) cliente.transferenciasAhorroHistorial = [];
    if (typeof cliente.suscripcionActiva !== 'boolean') cliente.suscripcionActiva = false;
    if (cliente.premiumMesReferencia !== mes) {
        cliente.premiumMesReferencia = mes;
        cliente.premiumActivo = false;
        cliente.premiumPlatosCostoUsados = 0;
    }
    revisarRecordatoriosPagoCliente(cliente);
}

function actualizarPreviewTarjetaPago() {
    const numero = normalizarNumeroTarjeta(document.getElementById('pago-tarjeta-numero')?.value || '');
    const titular = (document.getElementById('pago-tarjeta-titular')?.value || '').trim().toUpperCase();
    const mes = (document.getElementById('pago-tarjeta-exp-mes')?.value || '').replace(/[^\d]/g, '').slice(0, 2);
    const ano = (document.getElementById('pago-tarjeta-exp-ano')?.value || '').replace(/[^\d]/g, '').slice(0, 4);
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clientePagoModalId);
    const tarjetaPrev = cliente?.transferencia?.tarjetaOrigen || null;
    const marca = numero ? detectarMarcaTarjeta(numero) : (tarjetaPrev?.marca || 'TARJETA');
    const chunks = numero ? numero.match(/.{1,4}/g) : null;
    const numeroFmt = chunks
        ? chunks.join(' ')
        : (tarjetaPrev?.tarjetaEnmascarada || (tarjetaPrev?.last4 ? `**** **** **** ${tarjetaPrev.last4}` : '**** **** **** ****'));

    const marcaEl = document.getElementById('pago-card-marca');
    const numeroEl = document.getElementById('pago-card-numero');
    const titularEl = document.getElementById('pago-card-titular');
    const expEl = document.getElementById('pago-card-exp');
    if (marcaEl) marcaEl.textContent = marca;
    if (numeroEl) numeroEl.textContent = numeroFmt;
    if (titularEl) titularEl.textContent = titular || 'NOMBRE APELLIDO';
    if (expEl) expEl.textContent = `${mes || 'MM'}/${ano || 'AAAA'}`;
}

function abrirModalPagoSuscripcion(clienteId) {
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clienteId);
    if (!cliente) return false;
    const modal = document.getElementById('modal-pago-suscripcion');
    if (!modal) return false;
    clientePagoModalId = clienteId;

    document.getElementById('pago-cliente-id').value = clienteId;
    document.getElementById('pago-cliente-nombre').textContent = cliente.nombre || '-';
    document.getElementById('pago-tarjeta-tipo').value = cliente.transferencia?.tarjetaOrigen?.tipo || 'credito';
    document.getElementById('pago-tarjeta-numero').value = '';
    document.getElementById('pago-tarjeta-titular').value = cliente.transferencia?.tarjetaOrigen?.titular || '';
    document.getElementById('pago-tarjeta-exp-mes').value = cliente.transferencia?.tarjetaOrigen?.expMes || '';
    document.getElementById('pago-tarjeta-exp-ano').value = cliente.transferencia?.tarjetaOrigen?.expAno || '';
    document.getElementById('pago-receptor-banco').value = cliente.transferencia?.receptor?.banco || '';
    document.getElementById('pago-receptor-cuenta').value = cliente.transferencia?.receptor?.cuenta || '';
    document.getElementById('pago-receptor-nombre').value = cliente.transferencia?.receptor?.nombre || '';
    document.getElementById('pago-receptor-apellido').value = cliente.transferencia?.receptor?.apellido || '';
    document.getElementById('pago-receptor-cedula').value = cliente.transferencia?.receptor?.cedula || '';
    document.getElementById('pago-receptor-telefono').value = cliente.transferencia?.receptor?.telefono || '';
    document.getElementById('pago-periodo').value = cliente.transferencia?.periodo || 'MENSUAL';
    document.getElementById('pago-fecha-cobro').value = cliente.suscripcionProximoCobro || '';
    actualizarPreviewTarjetaPago();
    modal.style.display = 'flex';
    return true;
}

function cerrarModalPagoSuscripcion() {
    const modal = document.getElementById('modal-pago-suscripcion');
    if (modal) modal.style.display = 'none';
    clientePagoModalId = null;
}

function guardarDatosPagoSuscripcionDesdeModal() {
    const clienteId = document.getElementById('pago-cliente-id')?.value || clientePagoModalId;
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clienteId);
    if (!cliente) return alert('Cliente no encontrado.');

    const tipoTarjeta = document.getElementById('pago-tarjeta-tipo')?.value || 'credito';
    const numero = normalizarNumeroTarjeta(document.getElementById('pago-tarjeta-numero')?.value || '');
    const titular = (document.getElementById('pago-tarjeta-titular')?.value || '').trim();
    const expMes = (document.getElementById('pago-tarjeta-exp-mes')?.value || '').replace(/[^\d]/g, '').slice(0, 2);
    const expAno = (document.getElementById('pago-tarjeta-exp-ano')?.value || '').replace(/[^\d]/g, '').slice(0, 4);
    const banco = (document.getElementById('pago-receptor-banco')?.value || '').trim();
    const cuenta = (document.getElementById('pago-receptor-cuenta')?.value || '').replace(/[^\dA-Za-z]/g, '');
    const nombre = (document.getElementById('pago-receptor-nombre')?.value || '').trim();
    const apellido = (document.getElementById('pago-receptor-apellido')?.value || '').trim();
    const cedula = normalizarCedulaCliente(document.getElementById('pago-receptor-cedula')?.value || '');
    const telefonoReceptor = normalizarTelefonoWhatsapp(document.getElementById('pago-receptor-telefono')?.value || '');

    const tarjetaPrev = cliente.transferencia?.tarjetaOrigen || null;
    const usaTarjetaAnterior = numero.length === 0 && !!tarjetaPrev;
    if (!usaTarjetaAnterior && numero.length < 12) return alert('Ingrese un número de tarjeta válido.');
    if (!titular) return alert('Ingrese titular de la tarjeta.');
    if (!expMes || Number(expMes) < 1 || Number(expMes) > 12) return alert('Mes de vencimiento inválido.');
    if (!expAno || expAno.length < 4) return alert('Año de vencimiento inválido.');
    if (!banco || !cuenta || !nombre || !apellido || !cedula || !telefonoReceptor) return alert('Complete todos los datos del receptor de transferencia.');

    const tarjetaOrigen = usaTarjetaAnterior ? {
        ...tarjetaPrev,
        tipo: (tipoTarjeta || '').toLowerCase().includes('deb') ? 'debito' : 'credito',
        titular: titular.toUpperCase(),
        expMes: String(expMes).padStart(2, '0'),
        expAno: expAno
    } : {
        tipo: (tipoTarjeta || '').toLowerCase().includes('deb') ? 'debito' : 'credito',
        marca: detectarMarcaTarjeta(numero),
        last4: numero.slice(-4),
        tarjetaEnmascarada: enmascararTarjeta(numero),
        titular: titular.toUpperCase(),
        expMes: String(expMes).padStart(2, '0'),
        expAno: expAno
    };

    cliente.transferencia = {
        periodo: 'MENSUAL',
        tarjetaOrigen: tarjetaOrigen,
        receptor: {
            banco: banco.toUpperCase(),
            cuenta: cuenta,
            nombre: nombre.toUpperCase(),
            apellido: apellido.toUpperCase(),
            cedula: cedula,
            telefono: telefonoReceptor
        }
    };
    cliente.updatedAt = new Date().toISOString();
    guardarDatos();
    renderTablaClientesPuntos();
    cerrarModalPagoSuscripcion();
    alert(`Datos de transferencia guardados para ${cliente.nombre}.`);
}

function configurarPagoSuscripcion(clienteId) {
    return abrirModalPagoSuscripcion(clienteId);
}

function activarSuscripcionCliente(clienteId) {
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clienteId);
    if (!cliente) return alert('Cliente no encontrado.');
    refrescarEstadoMembresia(cliente);
    if (!clienteTieneMetodoPago(cliente)) {
        configurarPagoSuscripcion(clienteId);
        return alert('Complete los datos de transferencia en la tarjeta flotante y vuelva a activar la suscripción.');
    }
    if (!cliente.suscripcionFechaInicio) {
        cliente.suscripcionFechaInicio = formatearFechaISO(new Date());
        cliente.suscripcionProximoCobro = cliente.suscripcionFechaInicio;
    }
    cliente.suscripcionActiva = true;
    const okCobro = procesarCobroMembresia(cliente, { tipo: 'primer-pago-auto' });
    if (!okCobro) {
        cliente.suscripcionActiva = false;
        guardarDatos();
        renderTablaClientesPuntos();
        return;
    }
    guardarDatos();
    renderTablaClientesPuntos();
    const plan = obtenerPlanCliente(cliente);
    alert(`Suscripción activada para ${cliente.nombre} (${plan.nombre}).\nPrimer pago realizado automáticamente por USD$${Number(plan.mensualUSD).toFixed(2)}.`);
}

function desactivarSuscripcionCliente(clienteId) {
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clienteId);
    if (!cliente) return alert('Cliente no encontrado.');
    cliente.suscripcionActiva = false;
    cliente.updatedAt = new Date().toISOString();
    guardarDatos();
    renderTablaClientesPuntos();
    alert(`Suscripción desactivada para ${cliente.nombre}.`);
}

function pagarMembresiaCliente(clienteId) {
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clienteId);
    if (!cliente) return alert('Cliente no encontrado.');

    refrescarEstadoMembresia(cliente);
    if (!clienteTieneMetodoPago(cliente)) {
        configurarPagoSuscripcion(clienteId);
        return alert('Complete los datos de transferencia en la tarjeta flotante y vuelva a ejecutar el cobro.');
    }
    if (cliente.premiumMesCobrado === claveMesActual() && cliente.premiumActivo) {
        return alert('La membresía premium ya está activa en este mes.');
    }

    const plan = obtenerPlanCliente(cliente);
    const ok = confirm(`Confirmar pago de ${plan.nombre} por USD$${Number(plan.mensualUSD).toFixed(2)} para ${cliente.nombre}?`);
    if (!ok) return;
    procesarCobroMembresia(cliente, { tipo: 'manual' });

    guardarDatos();
    renderTablaClientesPuntos();
    alert(`Pago de membresía aplicado para ${cliente.nombre}.\n+${MEMBRESIA_PUNTOS_MENSUAL} puntos acreditados.`);
}

function construirMensajeMenuPremium(cliente) {
    const nombreNegocio = obtenerNombreNegocioActual();
    const plan = obtenerPlanCliente(cliente);
    const menu = (db.platos || [])
        .filter(p => p.owner === sesionUser?.user && p.modulo === moduloActual)
        .slice(0, 12);

    let msg = `Hola ${cliente.nombre}, te escribe ${nombreNegocio}.\n\n`;
    msg += '*Menú y ofertas exclusivas*\n';

    if (menu.length) {
        menu.forEach((p, i) => {
            const venta = Number(p.precio || 0);
            const premium = venta * (1 - (Number(plan.descuentoPorc || 0) / 100));
            msg += `${i + 1}. ${p.nombre}: RD$${venta.toFixed(2)} | ${plan.nombre} ${Number(plan.descuentoPorc || 0).toFixed(1)}%: RD$${premium.toFixed(2)}\n`;
        });
    } else {
        msg += 'Estamos actualizando el menú en este momento.\n';
    }

    msg += '\n*Membresía Premium*\n';
    msg += `- Plan: ${plan.nombre}\n`;
    msg += `- Pago mensual: USD$${Number(plan.mensualUSD).toFixed(2)}\n`;
    msg += `- Beneficio mensual: +${MEMBRESIA_PUNTOS_MENSUAL} puntos\n`;
    msg += `- ${Number(plan.descuentoPorc || 0).toFixed(1)}% de descuento en todos los platos\n`;
    msg += `- ${plan.descripcion}\n`;
    msg += '\nSi deseas activarla, responde a este mensaje.';

    return msg;
}

function obtenerPrecioCanjePlato(cliente, plato) {
    refrescarEstadoMembresia(cliente);
    const plan = obtenerPlanCliente(cliente);

    const precioVenta = Number(plato?.precio || 0);
    const costoProduccion = Number(plato?.costo || 0);
    const premiumActivo = !!cliente.premiumActivo;
    const usados = Number(cliente.premiumPlatosCostoUsados || 0);
    const cupoCostoDisponible = premiumActivo && plan.tipoBeneficio === 'costo_produccion' && usados < limiteBeneficioPlan(plan) && costoProduccion > 0;

    let precioAplicado = precioVenta * 0.97;
    let etiqueta = 'Descuento 3%';

    if (premiumActivo) {
        precioAplicado = precioVenta * (1 - (Number(plan.descuentoPorc || 0) / 100));
        etiqueta = `${plan.nombre} ${Number(plan.descuentoPorc || 0).toFixed(1)}%`;
        if (cupoCostoDisponible) {
            precioAplicado = costoProduccion;
            etiqueta = `${plan.nombre} costo de producción (${usados + 1}/${limiteBeneficioPlan(plan)})`;
        }
    }

    const puntosNecesarios = Math.max(1, Math.ceil(precioAplicado));
    return {
        precioVenta,
        costoProduccion,
        precioAplicado,
        etiqueta,
        puntosNecesarios,
        premiumActivo,
        cupoCostoDisponible,
        usados
    };
}

function generarLinkRegistroClientesQR() {
    const base = location.origin + location.pathname;
    return `${base}?registroCliente=1`;
}

function generarTokenQRCliente() {
    return `qr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generarLinkQRCliente(tipo, clienteId) {
    if (!db.qrClienteLinks || typeof db.qrClienteLinks !== 'object') db.qrClienteLinks = {};
    const token = generarTokenQRCliente();
    db.qrClienteLinks[token] = {
        clienteId,
        tipo,
        createdAt: new Date().toISOString()
    };
    guardarDatos();
    const base = location.origin + location.pathname;
    return `${base}?qrv=${encodeURIComponent(token)}`;
}

function escaparTextoSVG(txt) {
    return String(txt || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function generarImagenInfoCliente(tipo, cliente) {
    const plan = obtenerPlanCliente(cliente);
    const transferencia = cliente.transferencia || {};
    const tarjeta = transferencia.tarjetaOrigen || {};
    const receptor = transferencia.receptor || {};
    const premium = cliente.premiumActivo ? 'SI' : 'NO';
    const usados = Number(cliente.premiumPlatosCostoUsados || 0);
    const titulo = tipo === 'ofertas' ? 'QR OFERTAS' : 'QR SUSCRIPCIÓN';
    const subt = tipo === 'ofertas' ? 'Promociones y menú premium' : 'Resumen de suscripción';
    const lineas = tipo === 'ofertas'
        ? [
            `Cliente: ${cliente.nombre || '-'}`,
            `Teléfono: ${cliente.telefono || '-'}`,
            `Plan: ${plan.nombre}`,
            `Descuento premium: ${Number(plan.descuentoPorc || 0).toFixed(1)}%`,
            `Beneficio: ${plan.descripcion}`
        ]
        : [
            `Teléfono: ${cliente.telefono || '-'}`,
            `Cédula: ${cliente.cedula || '-'}`,
            `Método de pago: ${(tarjeta.marca || 'TARJETA')} ${(tarjeta.tarjetaEnmascarada || '-')}`.trim(),
            `Próximo cobro: ${cliente.suscripcionProximoCobro || 'NO DEFINIDA'} | Período: ${transferencia.periodo || 'MENSUAL'}`,
            `Receptor: ${(receptor.nombre || '-')} ${(receptor.apellido || '')} | ${receptor.banco || '-'} | ${receptor.cuenta || '-'}`,
            `Membresía premium: ${premium} (${usados}/${limiteBeneficioPlan(plan)} beneficio)`
        ];

    const svgW = 980;
    const svgH = 520;
    const lineasSvg = lineas.map((l, i) =>
        `<text x="44" y="${190 + (i * 48)}" font-family="Segoe UI, Arial" font-size="30" font-weight="700" fill="#0f1720">${escaparTextoSVG(l)}</text>`
    ).join('');

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
  <rect width="100%" height="100%" fill="#f7fbff"/>
  <rect x="0" y="0" width="100%" height="120" fill="#1e3a5f"/>
  <text x="44" y="72" font-family="Segoe UI, Arial" font-size="44" font-weight="800" fill="#ffffff">${escaparTextoSVG(titulo)}</text>
  <text x="44" y="106" font-family="Segoe UI, Arial" font-size="22" font-weight="600" fill="#dbeafe">${escaparTextoSVG(subt)}</text>
  ${lineasSvg}
  <text x="44" y="${svgH - 20}" font-family="Segoe UI, Arial" font-size="18" fill="#4b5563">LuRo Control</text>
</svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function manejarVistaQRClienteDesdeURL() {
    const params = new URLSearchParams(window.location.search || '');
    const token = params.get('qrv');
    if (!token) return false;
    if (!db.qrClienteLinks || !db.qrClienteLinks[token]) {
        document.body.innerHTML = '<div style="font-family:Segoe UI,Arial; padding:20px;">QR no válido o expirado.</div>';
        return true;
    }
    const ref = db.qrClienteLinks[token];
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === ref.clienteId);
    if (!cliente) {
        document.body.innerHTML = '<div style="font-family:Segoe UI,Arial; padding:20px;">Cliente no encontrado para este QR.</div>';
        return true;
    }
    const tipo = ref.tipo || 'suscripcion';
    const img = generarImagenInfoCliente(tipo, cliente);
    const title = tipo === 'ofertas' ? 'QR OFERTAS' : 'QR SUSCRIPCIÓN';
    let destino = '';
    let mensaje = '';

    if (tipo === 'ofertas') {
        destino = normalizarTelefonoWhatsapp(cliente.telefono || '');
        mensaje = construirMensajeMenuPremium(cliente);
    } else {
        const plan = obtenerPlanCliente(cliente);
        const transferencia = cliente.transferencia || {};
        const tarjeta = transferencia.tarjetaOrigen || {};
        const receptor = transferencia.receptor || {};
        const premium = cliente.premiumActivo ? 'SI' : 'NO';
        const usados = Number(cliente.premiumPlatosCostoUsados || 0);
        destino = normalizarTelefonoWhatsapp(obtenerTelefonoNegocioActual() || WHATSAPP_DEFAULT || '');
        mensaje = [
            `DATOS DE SUSCRIPCIÓN`,
            ``,
            `Cliente: ${cliente.nombre || '-'}`,
            `Teléfono: ${cliente.telefono || '-'}`,
            `Cédula: ${cliente.cedula || '-'}`,
            `Método de pago: ${(tarjeta.marca || 'TARJETA')} ${(tarjeta.tarjetaEnmascarada || '-')}`.trim(),
            `Próximo cobro: ${cliente.suscripcionProximoCobro || 'NO DEFINIDA'} | Período: ${transferencia.periodo || 'MENSUAL'}`,
            `Receptor: ${(receptor.nombre || '-')} ${(receptor.apellido || '')} | ${receptor.banco || '-'} | ${receptor.cuenta || '-'}`,
            `Plan: ${plan.nombre} | Membresía premium: ${premium} (${usados}/${limiteBeneficioPlan(plan)} beneficio)`
        ].join('\n');
    }

    const waUrl = destino ? `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}` : '';
    document.body.innerHTML = `
      <div style="margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0f1419; padding:18px;">
        <div style="width:min(1020px,96vw); background:#fff; border-radius:14px; overflow:hidden;">
          <div style="padding:12px 16px; background:#1e3a5f; color:#fff; font-family:Segoe UI,Arial; font-size:20px; font-weight:700;">${title}</div>
          <div style="padding:10px 16px; font-family:Segoe UI,Arial; font-size:14px; color:#2f3542; background:#f1f2f6;">
            ${waUrl ? 'Abriendo WhatsApp automáticamente...' : 'No hay número válido para envío automático.'}
          </div>
          <div style="padding:12px; text-align:center;">
            <img src="${img}" alt="${title}" style="max-width:100%; height:auto; border-radius:10px;">
            ${waUrl ? `<div style="margin-top:10px;"><a href="${waUrl}" style="display:inline-block; background:#25D366; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px; font-family:Segoe UI,Arial; font-weight:700;">Enviar por WhatsApp</a></div>` : ''}
          </div>
        </div>
      </div>`;
    if (waUrl) {
        setTimeout(() => { window.location.href = waUrl; }, 300);
    }
    return true;
}

function registrarClientePuntosDesdeDatos(nombre, cedula, telefono) {
    const nombreNorm = normalizarNombreCliente(nombre);
    const cedulaNorm = normalizarCedulaCliente(cedula);
    const telefonoNorm = normalizarTelefonoWhatsapp(telefono || '');
    if (!nombreNorm || !cedulaNorm) return null;

    if (!Array.isArray(db.clientesFidelizacion)) db.clientesFidelizacion = [];
    const existente = db.clientesFidelizacion.find(c => c.cedula === cedulaNorm);
    if (existente) {
        existente.nombre = nombreNorm;
        existente.telefono = telefonoNorm || existente.telefono || '';
        if (typeof existente.suscripcionActiva !== 'boolean') existente.suscripcionActiva = false;
        if (!Array.isArray(existente.premiumPagosHistorial)) existente.premiumPagosHistorial = [];
        if (!Array.isArray(existente.transferenciasAhorroHistorial)) existente.transferenciasAhorroHistorial = [];
        if (!existente.transferencia) existente.transferencia = null;
        if (!existente.suscripcionFechaInicio) existente.suscripcionFechaInicio = '';
        if (!existente.suscripcionProximoCobro) existente.suscripcionProximoCobro = '';
        if (!existente.planMembresiaId) existente.planMembresiaId = 'premium';
        existente.updatedAt = new Date().toISOString();
        return existente;
    }

    const nuevo = {
        id: `CLIQR-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        nombre: nombreNorm,
        cedula: cedulaNorm,
        telefono: telefonoNorm || '',
        puntos: 0,
        totalAcumulado: 0,
        suscripcionActiva: false,
        premiumActivo: false,
        premiumPlatosCostoUsados: 0,
        premiumPagosHistorial: [],
        transferenciasAhorroHistorial: [],
        transferencia: null,
        planMembresiaId: 'premium',
        suscripcionFechaInicio: '',
        suscripcionProximoCobro: '',
        ultimoAvisoPago3dias: '',
        ultimoAvisoPagoVencimiento: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    db.clientesFidelizacion.unshift(nuevo);
    return nuevo;
}

function buscarClienteFidelizacion(nombre, cedula) {
    const nombreNorm = normalizarNombreCliente(nombre);
    const cedulaNorm = normalizarCedulaCliente(cedula);
    const lista = Array.isArray(db.clientesFidelizacion) ? db.clientesFidelizacion : [];
    if (cedulaNorm) {
        const byCed = lista.find(c => c.cedula === cedulaNorm);
        if (byCed) return byCed;
    }
    if (nombreNorm) return lista.find(c => c.nombre === nombreNorm) || null;
    return null;
}

function acreditarPuntosClienteFactura(nombreCliente, cedula, totalFactura) {
    const cliente = buscarClienteFidelizacion(nombreCliente, cedula);
    if (!cliente) return;
    const puntos = puntosPorCompra(totalFactura);
    if (puntos <= 0) return;
    cliente.puntos = Number(cliente.puntos || 0) + puntos;
    cliente.totalAcumulado = Number(cliente.totalAcumulado || 0) + Number(totalFactura || 0);
    cliente.updatedAt = new Date().toISOString();
}

function keyItemVenta(item) {
    return `${item?.nombre || ''}|${item?.originalIndex ?? ''}|${item?.personaId || ''}`;
}

function obtenerClienteSalidaActual() {
    const rncInput = document.getElementById('venta-cliente-rnc')?.value || '';
    const nombreInput = document.getElementById('venta-cliente-nombre')?.value || '';
    const rncNorm = normalizarCedulaCliente(rncInput);
    return buscarClienteFidelizacion(nombreInput, rncNorm);
}

function actualizarEstadoClienteSalida(cliente, mensajeAlt = '') {
    const estado = document.getElementById('venta-cliente-estado');
    if (!estado) return;
    if (!cliente) {
        estado.textContent = mensajeAlt || 'Cliente sin identificar.';
        estado.style.color = '#666';
        return;
    }
    refrescarEstadoMembresia(cliente);
    const plan = obtenerPlanCliente(cliente);
    const usados = Number(cliente.premiumPlatosCostoUsados || 0);
    const limite = limiteBeneficioPlan(plan);
    const restante = Math.max(0, limite - usados);
    const susTxt = cliente.suscripcionActiva ? 'SUSCRIPCIÓN ON' : 'SUSCRIPCIÓN OFF';
    estado.textContent = `Cliente registrado | Plan: ${plan.nombre} | Puntos: ${Number(cliente.puntos || 0)} | ${susTxt} | Membresía: ${cliente.premiumActivo ? `ACTIVA (${restante}/${limite} beneficio disponible)` : 'INACTIVA'}`;
    estado.style.color = cliente.premiumActivo ? '#05c46b' : '#666';
}

function autocompletarClienteSalidaDesdeDocumento() {
    const inputDoc = document.getElementById('venta-cliente-rnc');
    const inputNom = document.getElementById('venta-cliente-nombre');
    const inputTel = document.getElementById('venta-cliente-telefono');
    if (!inputDoc || !inputNom || !inputTel) return;

    const doc = normalizarCedulaCliente(inputDoc.value);
    if (!doc) {
        actualizarEstadoClienteSalida(null, 'Cliente sin identificar.');
        actualizarPanelCobro();
        return;
    }

    const perfilFidelizacion = buscarClienteFidelizacion('', doc);
    if (perfilFidelizacion) {
        inputDoc.value = perfilFidelizacion.cedula || doc;
        inputNom.value = perfilFidelizacion.nombre || '';
        inputTel.value = perfilFidelizacion.telefono || '';
        actualizarEstadoClienteSalida(perfilFidelizacion);
        actualizarPanelCobro();
        return;
    }

    const perfilHistorial = buscarClienteRNCEnHistorial(doc);
    if (perfilHistorial && perfilHistorial.nombre) {
        inputNom.value = perfilHistorial.nombre;
        actualizarEstadoClienteSalida(null, 'Cliente encontrado en historial de facturas. Falta registrarlo en fidelizacion para puntos.');
    } else {
        actualizarEstadoClienteSalida(null, 'Documento no encontrado en registros previos.');
    }
    actualizarPanelCobro();
}

function abrirModalRegistrarClienteVenta() {
    const modal = document.getElementById('modal-registrar-cliente-venta');
    if (!modal) return;
    const inNom = document.getElementById('venta-modal-cliente-nombre');
    const inDoc = document.getElementById('venta-modal-cliente-rnc');
    const inTel = document.getElementById('venta-modal-cliente-telefono');
    if (inNom) inNom.value = '';
    if (inDoc) inDoc.value = '';
    if (inTel) inTel.value = '';
    modal.style.display = 'flex';
}

function cerrarModalRegistrarClienteVenta() {
    const modal = document.getElementById('modal-registrar-cliente-venta');
    if (modal) modal.style.display = 'none';
    if (window.__ventaPendienteRegistroSalida) window.__ventaPendienteRegistroSalida = false;
}

function guardarClienteDesdeModalVenta() {
    const nombre = document.getElementById('venta-modal-cliente-nombre')?.value || '';
    const cedula = document.getElementById('venta-modal-cliente-rnc')?.value || '';
    const telefono = document.getElementById('venta-modal-cliente-telefono')?.value || '';
    const cliente = registrarClientePuntosDesdeDatos(nombre, cedula, telefono);
    if (!cliente) return alert('Debe ingresar nombre y cédula/RNC válidos.');

    const outNom = document.getElementById('venta-cliente-nombre');
    const outDoc = document.getElementById('venta-cliente-rnc');
    const outTel = document.getElementById('venta-cliente-telefono');
    if (outNom) outNom.value = cliente.nombre || '';
    if (outDoc) outDoc.value = cliente.cedula || '';
    if (outTel) outTel.value = cliente.telefono || '';
    if (typeof setClienteMesa === 'function') {
        setClienteMesa(typeof canonMesaActual === 'function' ? canonMesaActual() : mesaActiva, {
            nombre: cliente.nombre || '',
            rnc: cliente.cedula || '',
            telefono: cliente.telefono || ''
        });
    }

    guardarDatos();
    actualizarEstadoClienteSalida(cliente);
    actualizarPanelCobro();
    if (typeof renderTablaClientesPuntos === 'function') renderTablaClientesPuntos();
    cerrarModalRegistrarClienteVenta();
    alert('Cliente registrado y cargado en el detalle de venta.');
    if (window.__ventaPendienteRegistroSalida) {
        window.__ventaPendienteRegistroSalida = false;
        setTimeout(() => { if (typeof window.finalizarVenta === 'function') window.finalizarVenta(); }, 0);
    }
}

function seleccionarConsumidorFinalVenta() {
    const outNom = document.getElementById('venta-cliente-nombre');
    const outDoc = document.getElementById('venta-cliente-rnc');
    const outTel = document.getElementById('venta-cliente-telefono');
    if (outNom) outNom.value = 'CONSUMIDOR FINAL';
    if (outDoc) outDoc.value = 'CONSUMIDOR FINAL';
    if (outTel) outTel.value = '';
    if (typeof setClienteMesa === 'function') {
        setClienteMesa(typeof canonMesaActual === 'function' ? canonMesaActual() : mesaActiva, {
            nombre: 'CONSUMIDOR FINAL',
            rnc: 'CONSUMIDOR FINAL',
            telefono: ''
        });
    }
    actualizarEstadoClienteSalida(null, 'Consumidor final seleccionado (sin perfil).');
    actualizarPanelCobro();
    cerrarModalRegistrarClienteVenta();
    if (window.__ventaPendienteRegistroSalida) {
        window.__ventaPendienteRegistroSalida = false;
        setTimeout(() => { if (typeof window.finalizarVenta === 'function') window.finalizarVenta(); }, 0);
    }
}

function calcularDetallePreciosVenta(carritoVenta, cliente) {
    const detalles = [];
    let total = 0;
    let beneficiosAplicados = 0;
    const plan = obtenerPlanCliente(cliente);
    const descuentoPlan = Number(plan.descuentoPorc || 0) / 100;

    refrescarEstadoMembresia(cliente);
    let cupoDisponible = (cliente && cliente.premiumActivo)
        ? Math.max(0, limiteBeneficioPlan(plan) - Number(cliente.premiumPlatosCostoUsados || 0))
        : 0;
    let bebidasIncluidasDisponibles = 0;

    (carritoVenta || []).forEach(item => {
        const platoRef = db.platos[item.originalIndex] || db.platos.find(p => p.nombre === item.nombre && p.modulo === moduloActual);
        const precioVenta = Number(item.precio || platoRef?.precio || 0);
        const costoProduccion = Number(platoRef?.costo || 0);
        const cantidad = Math.max(0, Number(item.cantidad || 0));
        const premiumActivo = !!(cliente && cliente.premiumActivo);
        const precioDescuento = precioVenta * (1 - descuentoPlan);
        let cantidadBeneficio = 0;
        let subtotal = cantidad * (premiumActivo ? precioDescuento : precioVenta);
        let etiqueta = premiumActivo ? `${plan.nombre} ${Number(plan.descuentoPorc || 0).toFixed(1)}%` : 'Precio regular';

        if (premiumActivo && plan.tipoBeneficio === 'costo_produccion' && cupoDisponible > 0 && costoProduccion > 0) {
            cantidadBeneficio = Math.min(cantidad, cupoDisponible);
            const cantidadResto = cantidad - cantidadBeneficio;
            subtotal = (cantidadBeneficio * costoProduccion) + (cantidadResto * precioDescuento);
            cupoDisponible -= cantidadBeneficio;
            beneficiosAplicados += cantidadBeneficio;
            etiqueta = `${plan.nombre} costo de producción (${cantidadBeneficio})`;
        } else if (premiumActivo && plan.tipoBeneficio === 'desayuno_gratis') {
            if (esDesayunoBasica(item.nombre) && cupoDisponible > 0) {
                cantidadBeneficio = Math.min(cantidad, cupoDisponible);
                const cantidadResto = cantidad - cantidadBeneficio;
                subtotal = (cantidadBeneficio * 0) + (cantidadResto * precioDescuento);
                cupoDisponible -= cantidadBeneficio;
                bebidasIncluidasDisponibles += cantidadBeneficio;
                beneficiosAplicados += cantidadBeneficio;
                etiqueta = `${plan.nombre} desayuno gratis (${cantidadBeneficio})`;
            } else if (plan.incluyeBebida && esBebidaBasica(item.nombre) && bebidasIncluidasDisponibles > 0) {
                cantidadBeneficio = Math.min(cantidad, bebidasIncluidasDisponibles);
                const cantidadResto = cantidad - cantidadBeneficio;
                subtotal = (cantidadBeneficio * 0) + (cantidadResto * precioDescuento);
                bebidasIncluidasDisponibles -= cantidadBeneficio;
                etiqueta = `${plan.nombre} bebida incluida (${cantidadBeneficio})`;
            }
        }

        total += subtotal;

        detalles.push({
            key: keyItemVenta(item),
            cantidad,
            precioVenta,
            costoProduccion,
            cantidadCosto: cantidadBeneficio,
            cantidadRegular: Math.max(0, cantidad - cantidadBeneficio),
            subtotal,
            etiqueta
        });
    });

    return { detalles, total, beneficiosAplicados };
}

function renderTablaClientesPuntos() {
    const tbody = document.getElementById('tabla-clientes-puntos');
    const resumen = document.getElementById('clientes-puntos-resumen');
    if (!tbody || !resumen) return;

    const listaBase = Array.isArray(db.clientesFidelizacion) ? db.clientesFidelizacion : [];
    listaBase.forEach(refrescarEstadoMembresia);

    const q = (document.getElementById('clientes-puntos-buscar')?.value || '').toString().trim().toLowerCase();
    const codigoMap = (db.codigosClienteRNC && typeof db.codigosClienteRNC === 'object') ? db.codigosClienteRNC : {};
    const obtenerCodigoCliente = (cedula) => {
        const key = normalizarRNC(cedula || '');
        if (!key) return '---';
        return codigoMap[key] || '---';
    };

    const lista = [...listaBase].filter(c => {
        if (!q) return true;
        const ced = (c.cedula || '').toString().toLowerCase();
        const cod = (obtenerCodigoCliente(c.cedula) || '').toString().toLowerCase();
        return ced.includes(q) || cod.includes(q);
    });
    resumen.textContent = listaBase.length
        ? (q ? `Clientes: ${listaBase.length} | Resultados: ${lista.length}` : `Clientes registrados: ${listaBase.length}`)
        : 'Sin clientes registrados.';

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#777;">${q ? 'Sin resultados para la búsqueda.' : 'No hay clientes registrados.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(c => {
        const codigoCliente = obtenerCodigoCliente(c.cedula);

        return `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <strong>${c.nombre || '-'}</strong>
                    <button class="btn btn-blue" style="padding:6px 10px;" onclick="abrirModalMembresiaCliente('${c.id}')">MEMBRESÍA</button>
                </div>
            </td>
            <td>${c.cedula || '-'}</td>
            <td><strong>${codigoCliente}</strong></td>
            <td>${c.telefono || '-'}</td>
            <td><strong>${Number(c.puntos || 0)}</strong></td>
            <td>RD$${Number(c.totalAcumulado || 0).toFixed(2)}</td>
        </tr>
        `;
    }).join('');
}

function asegurarModalMembresiaCliente() {
    if (document.getElementById('modal-membresia-cliente')) return;
    const modal = document.createElement('div');
    modal.id = 'modal-membresia-cliente';
    modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,.72); z-index:3350; align-items:center; justify-content:center; padding:16px;';
    modal.innerHTML = `
      <div style="width:min(720px,96vw); max-height:92vh; overflow:auto; background:#fff; border-radius:12px; border-top:6px solid var(--blue);">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border-bottom:1px solid #eee;">
          <strong id="modal-membresia-cliente-titulo">Membresía</strong>
          <button class="btn btn-danger" style="padding:6px 10px;" onclick="cerrarModalMembresiaCliente()">X</button>
        </div>
        <div id="modal-membresia-cliente-body" style="padding:14px;"></div>
      </div>`;
    document.body.appendChild(modal);
}

function cerrarModalMembresiaCliente() {
    const m = document.getElementById('modal-membresia-cliente');
    if (m) m.style.display = 'none';
}

function abrirModalMembresiaCliente(clienteId) {
    asegurarModalMembresiaCliente();
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clienteId);
    if (!cliente) return alert('Cliente no encontrado.');

    const plan = obtenerPlanCliente(cliente);
    const suscripcionActiva = !!cliente.suscripcionActiva;
    const premiumTxt = cliente.premiumActivo
        ? `ACTIVA (${Number(cliente.premiumPlatosCostoUsados || 0)}/${limiteBeneficioPlan(plan)} beneficio)`
        : 'INACTIVA';
    const premiumColor = cliente.premiumActivo ? '#05c46b' : '#777';
    const tarjeta = cliente.transferencia?.tarjetaOrigen || null;
    const receptor = cliente.transferencia?.receptor || null;
    const tarjetaTxt = tarjeta ? `${tarjeta.marca || 'TARJETA'} ${tarjeta.tarjetaEnmascarada || ('**** ' + (tarjeta.last4 || ''))}` : 'Sin tarjeta';
    const receptorTxt = receptor ? `${receptor.banco || 'BANCO'} | ${receptor.cuenta || ''} | ${receptor.nombre || ''} ${receptor.apellido || ''}` : 'Sin receptor';
    const fechaCobroTxt = cliente.suscripcionProximoCobro || 'No definida';
    const btnSuscripcion = suscripcionActiva
        ? `<button class="btn btn-danger" onclick="desactivarSuscripcionCliente('${cliente.id}'); abrirModalMembresiaCliente('${cliente.id}');">DESACTIVAR</button>`
        : `<button class="btn btn-save" onclick="activarSuscripcionCliente('${cliente.id}'); abrirModalMembresiaCliente('${cliente.id}');">ACTIVAR</button>`;

    const titulo = document.getElementById('modal-membresia-cliente-titulo');
    const body = document.getElementById('modal-membresia-cliente-body');
    const modal = document.getElementById('modal-membresia-cliente');
    if (!body || !modal) return;

    if (titulo) titulo.textContent = `Membresía · ${(cliente.nombre || 'CLIENTE').toUpperCase()}`;
    body.innerHTML = `
      <div style="display:grid; gap:8px;">
        <div style="font-size:12px; font-weight:bold; color:${premiumColor};">${premiumTxt}</div>
        <div style="font-size:12px; color:#2f3542;"><strong>Plan:</strong> ${plan.nombre}</div>
        <div style="font-size:12px; color:#555;">USD$${Number(plan.mensualUSD).toFixed(2)} | ${Number(plan.descuentoPorc).toFixed(1)}% | ${plan.descripcion}</div>
        <div>
          <select onchange="cambiarPlanCliente('${cliente.id}', this.value); abrirModalMembresiaCliente('${cliente.id}');" style="padding:6px; border-radius:6px; border:1px solid #dfe6e9;">
            <option value="black" ${plan.id === 'black' ? 'selected' : ''}>Membresía Black</option>
            <option value="premium" ${plan.id === 'premium' ? 'selected' : ''}>Membresía Premium</option>
            <option value="basica" ${plan.id === 'basica' ? 'selected' : ''}>Membresía Básica</option>
          </select>
        </div>
        <div style="font-size:12px; color:#555;">Suscripción: <strong style="color:${suscripcionActiva ? '#05c46b' : '#777'};">${suscripcionActiva ? 'ACTIVA' : 'INACTIVA'}</strong></div>
        <div style="font-size:12px; color:#555;">Tarjeta origen: ${tarjetaTxt}</div>
        <div style="font-size:12px; color:#555;">Transferencia: ${receptorTxt}</div>
        <div style="font-size:12px; color:#555;">Periodo: MENSUAL | Próx. cobro: ${fechaCobroTxt}</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
          <button class="btn btn-purple" onclick="pagarMembresiaCliente('${cliente.id}'); abrirModalMembresiaCliente('${cliente.id}');">COBRAR USD$${Number(plan.mensualUSD).toFixed(2)}</button>
          <button class="btn btn-blue" onclick="configurarPagoSuscripcion('${cliente.id}')">DATOS TRANSFERENCIA</button>
          ${btnSuscripcion}
          <button class="btn btn-blue" onclick="mostrarQRCodeCliente('${cliente.id}')">VER QR</button>
          <button class="btn btn-warning" onclick="canjearPuntosCliente('${cliente.id}'); abrirModalMembresiaCliente('${cliente.id}');">CANJEAR</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
}

function registrarClientePuntos() {
    const nombre = document.getElementById('cliente_nombre_reg')?.value || '';
    const cedula = document.getElementById('cliente_cedula_reg')?.value || '';
    const telefono = document.getElementById('cliente_telefono_reg')?.value || '';

    const cliente = registrarClientePuntosDesdeDatos(nombre, cedula, telefono);
    if (!cliente) return alert('Debe ingresar nombre y cédula válidos.');

    guardarDatos();
    renderTablaClientesPuntos();
    document.getElementById('cliente_nombre_reg').value = '';
    document.getElementById('cliente_cedula_reg').value = '';
    document.getElementById('cliente_telefono_reg').value = '';
    alert('Cliente registrado correctamente.');
}

let entrenamientoEquipoActivoId = null;
let entrenamientoPlatoActivoId = null;

function obtenerEquiposEntrenamientoActuales() {
    if (!Array.isArray(db.entrenamientos)) db.entrenamientos = [];
    const ownerActivo = ownerDatosActivo();
    return db.entrenamientos.filter(e =>
        String(e.owner || '').trim().toLowerCase() === ownerActivo &&
        e.modulo === moduloActual
    );
}

function obtenerEquipoEntrenamientoActivo() {
    return obtenerEquiposEntrenamientoActuales().find(e => e.id === entrenamientoEquipoActivoId) || null;
}

function obtenerPlatoEntrenamientoActivo() {
    const eq = obtenerEquipoEntrenamientoActivo();
    if (!eq || !Array.isArray(eq.platos)) return null;
    return eq.platos.find(p => p.id === entrenamientoPlatoActivoId) || null;
}

function renderSelectPlatosEntrenamiento() {
    const sel = document.getElementById('ent-plato-select');
    if (!sel) return;
    const ownerActivo = ownerDatosActivo();
    const platos = (db.platos || [])
        .filter(p => String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual)
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    sel.innerHTML = platos.length
        ? platos.map(p => `<option value="${p.nombre}">${String(p.nombre || '').toUpperCase()}</option>`).join('')
        : '<option value="">No hay platos en disponibilidad</option>';
}

function renderEntrenamientos() {
    const listaBox = document.getElementById('ent-equipos-lista');
    const detalleVacio = document.getElementById('ent-detalle-vacio');
    const detalleEq = document.getElementById('ent-detalle-equipo');
    const tituloEq = document.getElementById('ent-equipo-titulo');
    const platosBox = document.getElementById('ent-platos-equipo');
    const procBox = document.getElementById('ent-procedimiento-box');
    const platoTitulo = document.getElementById('ent-plato-titulo');
    if (!listaBox || !detalleVacio || !detalleEq || !tituloEq || !platosBox || !procBox || !platoTitulo) return;

    const equipos = obtenerEquiposEntrenamientoActuales();
    if (entrenamientoEquipoActivoId && !equipos.some(e => e.id === entrenamientoEquipoActivoId)) {
        entrenamientoEquipoActivoId = null;
        entrenamientoPlatoActivoId = null;
    }
    listaBox.innerHTML = equipos.length
        ? equipos.map(e => {
            const active = e.id === entrenamientoEquipoActivoId;
            return `<div onclick="seleccionarEquipoEntrenamiento('${e.id}')" style="cursor:pointer; border:1px solid ${active ? 'var(--accent)' : '#ddd'}; border-left:5px solid ${active ? 'var(--accent)' : '#ccc'}; border-radius:8px; background:${active ? '#eefcf4' : '#fff'}; padding:8px; margin-bottom:8px;">
                <div style="font-size:11px; color:#666;">Área: ${(e.area || 'GENERAL').toUpperCase()}</div>
                <div style="font-weight:700;">${(e.nombre || '').toUpperCase()}</div>
                <div style="font-size:11px; color:#666;">Platos: ${Array.isArray(e.platos) ? e.platos.length : 0}</div>
            </div>`;
        }).join('')
        : '<div style="color:#777;">Sin equipos creados.</div>';

    const equipoActivo = obtenerEquipoEntrenamientoActivo();
    if (!equipoActivo) {
        detalleVacio.style.display = 'block';
        detalleEq.style.display = 'none';
        entrenamientoPlatoActivoId = null;
        return;
    }

    detalleVacio.style.display = 'none';
    detalleEq.style.display = 'block';
    tituloEq.textContent = `${(equipoActivo.area || 'GENERAL').toUpperCase()} · ${(equipoActivo.nombre || '').toUpperCase()}`;
    renderSelectPlatosEntrenamiento();

    const platos = Array.isArray(equipoActivo.platos) ? equipoActivo.platos : [];
    if (entrenamientoPlatoActivoId && !platos.some(p => p.id === entrenamientoPlatoActivoId)) {
        entrenamientoPlatoActivoId = null;
    }
    platosBox.innerHTML = platos.length
        ? platos.map(p => {
            const active = p.id === entrenamientoPlatoActivoId;
            return `<div onclick="seleccionarPlatoEntrenamiento('${p.id}')" style="cursor:pointer; border:1px solid ${active ? 'var(--blue)' : '#ddd'}; border-radius:8px; padding:8px; background:${active ? '#eaf3ff' : '#fff'};">
                <div style="font-weight:700; font-size:12px;">${(p.nombre || '').toUpperCase()}</div>
                <div style="font-size:11px; color:#666;">${(p.tiempoFuego || 'Sin tiempo')}</div>
            </div>`;
        }).join('')
        : '<div style="color:#777;">Aún no hay platos asignados a este equipo.</div>';

    const platoActivo = obtenerPlatoEntrenamientoActivo();
    if (!platoActivo) {
        procBox.style.display = 'none';
        return;
    }

    procBox.style.display = 'block';
    platoTitulo.textContent = `Procedimientos: ${(platoActivo.nombre || '').toUpperCase()}`;
    document.getElementById('ent-proc-onzas').value = platoActivo.onzas || '';
    document.getElementById('ent-proc-medidas').value = platoActivo.medidas || '';
    document.getElementById('ent-proc-tiempo').value = platoActivo.tiempoFuego || '';
    document.getElementById('ent-proc-pasos').value = platoActivo.pasos || '';
    document.getElementById('ent-proc-protocolos').value = platoActivo.protocolos || '';
}

function agregarEquipoEntrenamiento() {
    const area = (document.getElementById('ent-equipo-area')?.value || '').trim();
    const nombre = (document.getElementById('ent-equipo-nombre')?.value || '').trim();
    if (!nombre) return alert('Ingrese el nombre del equipo.');
    if (!Array.isArray(db.entrenamientos)) db.entrenamientos = [];

    const ownerActivo = ownerDatosActivo();
    db.entrenamientos.push({
        id: generarId('ent_eq'),
        area: area || 'General',
        nombre,
        platos: [],
        owner: ownerActivo,
        modulo: moduloActual,
        createdAt: new Date().toISOString()
    });
    document.getElementById('ent-equipo-area').value = '';
    document.getElementById('ent-equipo-nombre').value = '';
    guardarDatos();
    renderEntrenamientos();
}

function seleccionarEquipoEntrenamiento(equipoId) {
    entrenamientoEquipoActivoId = equipoId;
    entrenamientoPlatoActivoId = null;
    renderEntrenamientos();
}

function eliminarEquipoEntrenamientoActivo() {
    const eq = obtenerEquipoEntrenamientoActivo();
    if (!eq) return;
    if (!confirm(`¿Eliminar equipo ${eq.nombre}?`)) return;
    db.entrenamientos = (db.entrenamientos || []).filter(e => e.id !== eq.id);
    entrenamientoEquipoActivoId = null;
    entrenamientoPlatoActivoId = null;
    guardarDatos();
    renderEntrenamientos();
}

function agregarPlatoAEquipoEntrenamiento() {
    const eq = obtenerEquipoEntrenamientoActivo();
    if (!eq) return alert('Seleccione un equipo.');
    const nom = (document.getElementById('ent-plato-select')?.value || '').trim();
    if (!nom) return alert('Seleccione un plato.');
    if (!Array.isArray(eq.platos)) eq.platos = [];
    const exists = eq.platos.find(p => (p.nombre || '').toLowerCase() === nom.toLowerCase());
    if (exists) return alert('Ese plato ya está asignado a este equipo.');

    const nuevo = {
        id: generarId('ent_pl'),
        nombre: nom,
        onzas: '',
        medidas: '',
        tiempoFuego: '',
        pasos: '',
        protocolos: ''
    };
    eq.platos.push(nuevo);
    entrenamientoPlatoActivoId = nuevo.id;
    guardarDatos();
    renderEntrenamientos();
}

function seleccionarPlatoEntrenamiento(platoId) {
    entrenamientoPlatoActivoId = platoId;
    renderEntrenamientos();
}

function eliminarPlatoEntrenamientoActivo() {
    const eq = obtenerEquipoEntrenamientoActivo();
    const pl = obtenerPlatoEntrenamientoActivo();
    if (!eq || !pl) return;
    if (!confirm(`¿Eliminar plato ${pl.nombre} del equipo?`)) return;
    eq.platos = (eq.platos || []).filter(p => p.id !== pl.id);
    entrenamientoPlatoActivoId = null;
    guardarDatos();
    renderEntrenamientos();
}

function guardarProcedimientoEntrenamiento() {
    const pl = obtenerPlatoEntrenamientoActivo();
    if (!pl) return alert('Seleccione un plato.');
    pl.onzas = (document.getElementById('ent-proc-onzas')?.value || '').trim();
    pl.medidas = (document.getElementById('ent-proc-medidas')?.value || '').trim();
    pl.tiempoFuego = (document.getElementById('ent-proc-tiempo')?.value || '').trim();
    pl.pasos = (document.getElementById('ent-proc-pasos')?.value || '').trim();
    pl.protocolos = (document.getElementById('ent-proc-protocolos')?.value || '').trim();
    guardarDatos();
    alert('Procedimiento y protocolos guardados.');
    renderEntrenamientos();
}

function renderProcedimientosSoloVista() {
    const box = document.getElementById('procedimientos-view');
    if (!box) return;
    const equipos = obtenerEquiposEntrenamientoActuales()
        .slice()
        .sort((a, b) => `${a.area || ''} ${a.nombre || ''}`.localeCompare(`${b.area || ''} ${b.nombre || ''}`));

    if (!equipos.length) {
        box.innerHTML = '<div style="color:#777;">No hay equipos o procedimientos registrados en Entrenamientos.</div>';
        return;
    }

    box.innerHTML = equipos.map(eq => {
        const platos = Array.isArray(eq.platos) ? eq.platos : [];
        const platosHtml = platos.length
            ? platos.map((p, i) => `
                <details style="border:1px solid #e5e7eb; border-radius:8px; background:#fff; margin-bottom:8px;">
                  <summary style="cursor:pointer; padding:8px 10px; font-weight:700; color:#2f3542;">${i + 1}. ${(p.nombre || 'PLATO').toUpperCase()}</summary>
                  <div style="padding:10px; border-top:1px solid #f1f2f6; font-size:13px; line-height:1.45;">
                    <div><strong>Onzas / Cantidad:</strong> ${p.onzas || '---'}</div>
                    <div><strong>Medidas / Unidades:</strong> ${p.medidas || '---'}</div>
                    <div><strong>Tiempo en fuego:</strong> ${p.tiempoFuego || '---'}</div>
                    <div style="margin-top:8px;"><strong>Procedimiento:</strong></div>
                    <div style="white-space:pre-wrap; background:#f8f9fa; border-radius:6px; padding:8px; margin-top:4px;">${p.pasos || 'Sin procedimiento registrado.'}</div>
                    <div style="margin-top:8px;"><strong>Protocolos:</strong></div>
                    <div style="white-space:pre-wrap; background:#fff8ee; border-radius:6px; padding:8px; margin-top:4px;">${p.protocolos || 'Sin protocolos registrados.'}</div>
                  </div>
                </details>
            `).join('')
            : '<div style="color:#777; padding:8px;">Sin platos asignados.</div>';

        return `
          <details style="border:1px solid #dfe6e9; border-left:6px solid var(--blue); border-radius:10px; margin-bottom:10px; background:#fcfcff;">
            <summary style="cursor:pointer; padding:10px 12px; font-weight:800; color:#1f2d3d;">
              ${(eq.area || 'GENERAL').toUpperCase()} · ${(eq.nombre || 'EQUIPO').toUpperCase()} <span style="font-size:12px; color:#666;">(${platos.length} plato${platos.length === 1 ? '' : 's'})</span>
            </summary>
            <div style="padding:10px;">${platosHtml}</div>
          </details>
        `;
    }).join('');
}

function mostrarQRRegistroClientes() {
    const url = generarLinkRegistroClientesQR();
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    const win = window.open('', '_blank');
    if (!win) return alert('No se pudo abrir la ventana del QR.');
    win.document.write(`<html><body style="font-family:Arial; text-align:center; padding:20px;"><h3>QR de Registro de Clientes</h3><img src="${qr}" alt="QR"><p>${url}</p></body></html>`);
}

function mostrarQRCodeCliente(clienteId) {
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clienteId);
    if (!cliente) return alert('Cliente no encontrado.');

    const telefono = normalizarTelefonoWhatsapp(cliente.telefono || '');
    if (!telefono) {
        return alert('Este cliente no tiene teléfono válido para WhatsApp.');
    }

    refrescarEstadoMembresia(cliente);
    const mensajeOfertas = construirMensajeMenuPremium(cliente);
    const waOfertasDirectUrl = `https://wa.me/${telefono}?text=${encodeURIComponent(mensajeOfertas)}`;

    const win = window.open('', '_blank');
    if (!win) return alert('No se pudo abrir la ventana del QR.');

    const puntos = Number(cliente.puntos || 0);
    const premium = cliente.premiumActivo ? 'SI' : 'NO';
    const usados = Number(cliente.premiumPlatosCostoUsados || 0);
    const transferencia = cliente.transferencia || {};
    const tarjeta = transferencia.tarjetaOrigen || {};
    const receptor = transferencia.receptor || {};
    const fechaProxCobro = cliente.suscripcionProximoCobro || 'NO DEFINIDA';
    const periodoPago = transferencia.periodo || 'MENSUAL';
    const waNegocio = normalizarTelefonoWhatsapp(obtenerTelefonoNegocioActual() || WHATSAPP_DEFAULT || '');
    const mensajeSuscripcion = [
        `DATOS DE SUSCRIPCIÓN`,
        ``,
        `Cliente: ${cliente.nombre || '-'}`,
        `Teléfono: ${cliente.telefono || '-'}`,
        `Cédula: ${cliente.cedula || '-'}`,
        `Método de pago: ${(tarjeta.marca || 'TARJETA')} ${(tarjeta.tarjetaEnmascarada || '-')}`.trim(),
        `Próximo cobro: ${fechaProxCobro} | Período: ${periodoPago}`,
        `Receptor: ${(receptor.nombre || '-')} ${(receptor.apellido || '')} | ${receptor.banco || '-'} | ${receptor.cuenta || '-'}`,
        `Plan: ${plan.nombre} | Membresía premium: ${premium} (${usados}/${limiteBeneficioPlan(plan)} beneficio)`
    ].join('\n');
    const waSuscripcionDirectUrl = waNegocio ? `https://wa.me/${waNegocio}?text=${encodeURIComponent(mensajeSuscripcion)}` : '';
    const qrOfertas = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(waOfertasDirectUrl)}`;
    const qrSuscripcion = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(waSuscripcionDirectUrl || 'https://wa.me')}`;
    win.document.write(`
      <html>
      <head>
        <title>QR Cliente | LuRo Control</title>
      </head>
      <body style="margin:0; font-family:'Segoe UI',Tahoma,sans-serif; background:linear-gradient(135deg,#1e272e 0%,#0f1419 100%); color:#fff; padding:20px;">
        <div style="max-width:980px; margin:0 auto; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:18px; box-shadow:0 14px 35px rgba(0,0,0,.45); overflow:hidden;">
          <div style="padding:16px 18px; border-bottom:1px solid rgba(255,255,255,.1);">
            <div style="font-size:22px; font-weight:800; color:#05c46b;">LuRo Control</div>
            <div style="font-size:12px; color:#d2dae2;">Cliente fidelización: ${cliente.nombre || '-'}</div>
          </div>
          <div style="padding:16px 18px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; margin-bottom:14px;">
              <div style="background:#fff; border-radius:12px; padding:12px; text-align:center;">
                <div style="font-weight:700; color:#2f3542; margin-bottom:8px;">QR OFERTAS</div>
                <img src="${qrOfertas}" alt="QR Ofertas" style="width:100%; max-width:320px; height:auto;">
                <div style="font-size:11px; color:#57606f;">Escanear para abrir WhatsApp de ofertas.</div>
                <button onclick="enviarQROfertasWhatsapp()" style="margin-top:8px; background:#25D366; color:#fff; border:none; padding:8px 10px; border-radius:8px; cursor:pointer;">WhatsApp: Enviar QR Ofertas</button>
              </div>
              <div style="background:#fff; border-radius:12px; padding:12px; text-align:center;">
                <div style="font-weight:700; color:#2f3542; margin-bottom:8px;">QR SUSCRIPCIÓN</div>
                <img src="${qrSuscripcion}" alt="QR Suscripción" style="width:100%; max-width:320px; height:auto;">
                <div style="font-size:11px; color:#57606f;">Escanear para ver imagen completa de suscripción.</div>
                <button onclick="enviarQRSuscripcionWhatsapp()" style="margin-top:8px; background:#25D366; color:#fff; border:none; padding:8px 10px; border-radius:8px; cursor:pointer;">WhatsApp: Enviar QR Suscripción</button>
              </div>
            </div>
            <div style="font-size:17px; color:#111; line-height:1.65; margin-bottom:12px; background:#fff; border-radius:12px; padding:14px; border-left:6px solid #3498db; font-weight:700;">
              <div><strong>Teléfono:</strong> ${cliente.telefono || '-'}</div>
              <div><strong>Cédula:</strong> ${cliente.cedula || '-'}</div>
              <div><strong>Método de pago:</strong> ${(tarjeta.marca || 'TARJETA')} ${(tarjeta.tarjetaEnmascarada || '-')}</div>
              <div><strong>Próximo cobro:</strong> ${fechaProxCobro} | <strong>Periodo:</strong> ${periodoPago}</div>
              <div><strong>Receptor:</strong> ${(receptor.nombre || '-')} ${(receptor.apellido || '')} | ${receptor.banco || '-'} | ${receptor.cuenta || '-'}</div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button onclick="enviarRecordatorioQR('faltan3')" style="background:#ffa801; color:#fff; border:none; padding:10px 12px; border-radius:8px; cursor:pointer;">WhatsApp recordatorio (faltan 3 días)</button>
              <button onclick="enviarRecordatorioQR('hoy')" style="background:#ff4757; color:#fff; border:none; padding:10px 12px; border-radius:8px; cursor:pointer;">WhatsApp recordatorio (pago hoy)</button>
            </div>
          </div>
        </div>
        <script>
          const telefonoCliente = ${JSON.stringify(telefono)};
          const nombreCliente = ${JSON.stringify(cliente.nombre || '')};
          const fechaCobro = ${JSON.stringify(fechaProxCobro)};
          const qrOfertasUrl = ${JSON.stringify(qrOfertas)};
          const qrSuscripcionUrl = ${JSON.stringify(qrSuscripcion)};
          const waOfertasDirectUrl = ${JSON.stringify(waOfertasDirectUrl)};
          const waSuscripcionDirectUrl = ${JSON.stringify(waSuscripcionDirectUrl)};
          const receptorInfo = ${JSON.stringify({
              banco: receptor.banco || '-',
              cuenta: receptor.cuenta || '-',
              nombre: receptor.nombre || '-',
              apellido: receptor.apellido || '',
              cedula: receptor.cedula || '-',
              telefono: receptor.telefono || '-'
          })};

          function enviarQROfertasWhatsapp() {
            window.open(waOfertasDirectUrl, '_blank');
          }

          function enviarQRSuscripcionWhatsapp() {
            if (!waSuscripcionDirectUrl) return alert('No hay WhatsApp de negocios configurado.');
            window.open(waSuscripcionDirectUrl, '_blank');
          }

          function enviarRecordatorioQR(tipo) {
            const fechaClick = new Date().toLocaleString();
            let texto = 'Hola ' + nombreCliente + ',\\n';
            if (tipo === 'faltan3') {
              texto += 'Recordatorio: faltan 3 días para su fecha de pago de membresía (' + fechaCobro + ').\\n';
            } else {
              texto += 'Recordatorio: hoy corresponde el pago de su membresía (' + fechaCobro + ').\\n';
            }
            texto += 'Fecha/hora de este recordatorio: ' + fechaClick + '\\n\\n';
            texto += 'Transferir a:\\n';
            texto += 'Banco: ' + receptorInfo.banco + '\\n';
            texto += 'Cuenta: ' + receptorInfo.cuenta + '\\n';
            texto += 'Nombre: ' + receptorInfo.nombre + ' ' + receptorInfo.apellido + '\\n';
            texto += 'Cédula: ' + receptorInfo.cedula + '\\n';
            texto += 'Teléfono: ' + receptorInfo.telefono;
            const url = 'https://wa.me/' + telefonoCliente + '?text=' + encodeURIComponent(texto);
            window.open(url, '_blank');
          }
        <\/script>
      </body>
      </html>
    `);
}

function canjearPuntosCliente(clienteId) {
    const cliente = (db.clientesFidelizacion || []).find(c => c.id === clienteId);
    if (!cliente) return alert('Cliente no encontrado.');

    refrescarEstadoMembresia(cliente);
    const menu = (db.platos || [])
        .filter(p => p.owner === sesionUser?.user && p.modulo === moduloActual && Number(p.precio || 0) > 0)
        .sort((a, b) => Number(a.precio || 0) - Number(b.precio || 0));

    if (!menu.length) return alert('No hay comidas disponibles para canje.');

    const lineas = menu.map((p, i) => {
        const calc = obtenerPrecioCanjePlato(cliente, p);
        return `${i + 1}. ${p.nombre} | Venta: RD$${calc.precioVenta.toFixed(2)} | Costo: RD$${calc.costoProduccion.toFixed(2)} | ${calc.etiqueta}: RD$${calc.precioAplicado.toFixed(2)} | Puntos: ${calc.puntosNecesarios}`;
    }).join('\n');

    const seleccion = parseInt(prompt(
        `Cliente: ${cliente.nombre}\nPuntos disponibles: ${cliente.puntos}\nPremium: ${cliente.premiumActivo ? 'ACTIVA' : 'INACTIVA'}\n\nSeleccione comida para canjear:\n${lineas}\n\nEscriba el número:`
    ) || '0', 10);

    if (!seleccion || seleccion < 1 || seleccion > menu.length) return;

    const plato = menu[seleccion - 1];
    const calc = obtenerPrecioCanjePlato(cliente, plato);
    const puntosNecesarios = calc.puntosNecesarios;

    if (Number(cliente.puntos || 0) < puntosNecesarios) {
        return alert(`Puntos insuficientes.\nNecesita: ${puntosNecesarios}\nTiene: ${cliente.puntos}`);
    }

    if (!confirm(`Canjear "${plato.nombre}" por ${puntosNecesarios} puntos?\nPrecio venta: RD$${calc.precioVenta.toFixed(2)}\nModalidad: ${calc.etiqueta}\nPrecio aplicado: RD$${calc.precioAplicado.toFixed(2)}`)) return;

    cliente.puntos = Number(cliente.puntos || 0) - puntosNecesarios;
    if (calc.cupoCostoDisponible) {
        cliente.premiumPlatosCostoUsados = Number(cliente.premiumPlatosCostoUsados || 0) + 1;
    }
    cliente.updatedAt = new Date().toISOString();

    guardarDatos();
    renderTablaClientesPuntos();
    alert(`Canje realizado: ${plato.nombre}\nPuntos descontados: ${puntosNecesarios}\nPuntos restantes: ${cliente.puntos}`);
}

function manejarRegistroClienteDesdeQR() {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('registroCliente') !== '1') return;

    const nombre = prompt('Registro de Cliente\nIngrese su nombre:');
    if (!nombre) return;
    const cedula = prompt('Ingrese su cédula:');
    if (!cedula) return;
    const telefono = prompt('Ingrese su teléfono:') || '';

    const cliente = registrarClientePuntosDesdeDatos(nombre, cedula, telefono);
    if (!cliente) return alert('No se pudo completar el registro.');
    guardarDatos();
    alert('Registro completado. Ya puede indicar su nombre al facturar para acumular puntos.');
}

function asegurarEstructurasFacturacion() {
    if (!Array.isArray(db.facturasResumen)) db.facturasResumen = [];
    if (!db.codigosClienteRNC || typeof db.codigosClienteRNC !== 'object') db.codigosClienteRNC = {};
    if (!db.contadorCodigoCliente) db.contadorCodigoCliente = 1;
    if (!db.contadorCodigoFacturaBusqueda) db.contadorCodigoFacturaBusqueda = 1;
}

function generarCodigoClienteRNC(rnc) {
    asegurarEstructurasFacturacion();
    const limpio = normalizarRNC(rnc);
    if (!limpio) return '';
    if (db.codigosClienteRNC[limpio]) return db.codigosClienteRNC[limpio];
    const codigo = `CLI-${String(db.contadorCodigoCliente).padStart(5, '0')}`;
    db.contadorCodigoCliente += 1;
    db.codigosClienteRNC[limpio] = codigo;
    return codigo;
}

function generarCodigoBusquedaFactura() {
    asegurarEstructurasFacturacion();
    const codigo = `FAC-${String(db.contadorCodigoFacturaBusqueda).padStart(6, '0')}`;
    db.contadorCodigoFacturaBusqueda += 1;
    return codigo;
}

function registrarFacturaEnResumen({ fecha, operador, mesa, cliente, ncf, rnc, codigo, total, telefono, items, origen }) {
    asegurarEstructurasFacturacion();
    const tsRegistro = Date.now();
    db.facturasResumen.push({
        fecha: fecha || new Date().toLocaleString(),
        ts: tsRegistro,
        operador: operador || operadorActual || sesionUser?.user || '---',
        mesa: mesa || obtenerNombreMesa(mesaActiva),
        nombre: (cliente || 'CONSUMIDOR FINAL').toUpperCase(),
        ncf: ncf || '---',
        rnc: rnc || 'CONSUMIDOR FINAL',
        codigo: codigo || generarCodigoBusquedaFactura(),
        total: Number(total || 0),
        telefono: telefono || 'N/A',
        items: Array.isArray(items) ? items : [],
        origen: origen || 'manual',
        owner: sesionUser?.user || MASTER_USER,
        modulo: moduloActual
    });
}

function generarFacturaVisualYResumen({ carritoVenta, nombreCliente, rncInput, telefonoWhatsApp, mesaNombre, origen, detallePreciosVenta = [] }) {
    const fechaFactura = new Date().toLocaleString();
    if (!db.contadorNCF) db.contadorNCF = 1;
    const rncLimpio = normalizarRNC(rncInput);
    const prefijo = rncLimpio ? "B01" : "B02";
    const ncfCompleto = prefijo + db.contadorNCF.toString().padStart(8, '0');
    const codigoCliente = rncLimpio ? generarCodigoClienteRNC(rncLimpio) : generarCodigoBusquedaFactura();
    const rncFinal = rncLimpio || "CONSUMIDOR FINAL";
    const mesaFinal = mesaNombre || obtenerNombreMesa(mesaActiva);

    datosClienteGlobal = {
        rnc: rncFinal,
        nombre: (nombreCliente || "CONSUMIDOR FINAL").toUpperCase(),
        telefono: telefonoWhatsApp || "N/A"
    };

    const nombreNegocio = obtenerNombreNegocioActual();
    document.getElementById('factura-negocio').innerText = nombreNegocio.toUpperCase();
    document.getElementById('factura-usuario').innerText = operadorActual || sesionUser?.user || '---';

    document.getElementById('factura-fecha').innerHTML = `
        ${fechaFactura}<br>
        <strong>Mesa: ${mesaFinal}</strong><br>
        <strong>Cliente: ${datosClienteGlobal.nombre}</strong><br>
        <strong>NCF: ${ncfCompleto}</strong><br>
        <strong>RNC: ${rncFinal}</strong><br>
        <strong>Código: ${codigoCliente}</strong>
    `;

    const cuerpo = document.getElementById('cuerpo-factura');
    cuerpo.innerHTML = "";
    let total = 0;
    facturaActualItems = [];
    facturaActualMesa = mesaFinal;
    const detalleMap = new Map((detallePreciosVenta || []).map(d => [d.key, d]));

    carritoVenta.forEach(item => {
        const detalle = detalleMap.get(keyItemVenta(item));
        const subtotal = detalle ? Number(detalle.subtotal || 0) : ((item.precio || 0) * (item.cantidad || 0));
        const precioUnitarioFactura = (item.cantidad || 0) > 0 ? (subtotal / item.cantidad) : Number(item.precio || 0);
        total += subtotal;
        facturaActualItems.push({ ...item, precio: precioUnitarioFactura, subtotal, detallePrecio: detalle || null });
        cuerpo.innerHTML += `<tr><td>${item.cantidad}</td><td>${(item.nombre || '').toUpperCase()}</td><td style="text-align:right;">RD$${subtotal.toFixed(2)}</td></tr>`;
    });

    document.getElementById('factura-total').innerText = `RD$${total.toFixed(2)}`;
    document.getElementById('modal-factura').style.display = 'flex';

    registrarFacturaEnResumen({
        fecha: fechaFactura,
        operador: operadorActual,
        mesa: mesaFinal,
        cliente: datosClienteGlobal.nombre,
        ncf: ncfCompleto,
        rnc: rncFinal,
        codigo: codigoCliente,
        total,
        telefono: datosClienteGlobal.telefono,
        items: facturaActualItems,
        origen
    });
    acreditarPuntosClienteFactura(datosClienteGlobal.nombre, rncFinal, total);

    // Compatibilidad: mantener caché por RNC para búsquedas de DGII en próximas facturas.
    if (rncLimpio) {
        if (!db.clientesRNC) db.clientesRNC = [];
        db.clientesRNC.push({
            fecha: fechaFactura,
            operador: sesionUser.user,
            rnc: rncLimpio,
            nombre: datosClienteGlobal.nombre,
            telefono: datosClienteGlobal.telefono
        });
    }

    db.contadorNCF++;
    guardarDatos();
}

function buscarClienteRNCEnHistorial(rnc) {
    const limpio = normalizarRNC(rnc);
    if (!limpio) return null;

    const fromFacturas = Array.isArray(db.facturasResumen)
        ? [...db.facturasResumen].reverse().find(c => normalizarRNC(c.rnc) === limpio)
        : null;
    if (fromFacturas && fromFacturas.nombre) {
        return {
            rnc: fromFacturas.rnc,
            nombre: fromFacturas.nombre || '',
            estado: 'FACTURA_LOCAL'
        };
    }

    if (!Array.isArray(db.clientesRNC)) return null;
    const match = [...db.clientesRNC].reverse().find(c => normalizarRNC(c.rnc) === limpio);
    if (!match) return null;
    return {
        rnc: match.rnc,
        nombre: match.nombre || '',
        estado: 'CACHE_LOCAL'
    };
}

async function consultarRNCClienteDGII(rnc) {
    const limpio = normalizarRNC(rnc);
    if (!limpio) return null;

    // 1) Cache local del propio sistema
    const localHit = buscarClienteRNCEnHistorial(limpio);
    if (localHit && localHit.nombre) return localHit;

    // 2) Endpoint proxy configurable (recomendado para sortear CORS)
    if (!DGII_RNC_PROXY) return null;
    try {
        const url = `${DGII_RNC_PROXY}${DGII_RNC_PROXY.includes('?') ? '&' : '?'}rnc=${encodeURIComponent(limpio)}`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data) return null;
        const nombre = (data.nombre || data.razonSocial || '').toString().trim();
        if (!nombre) return null;
        return {
            rnc: data.rnc || limpio,
            nombre: nombre.toUpperCase(),
            estado: data.estado || 'DGII'
        };
    } catch (e) {
        return null;
    }
}

async function capturarDatosClienteFactura() {
    const inputDoc = document.getElementById('venta-cliente-rnc');
    const inputNom = document.getElementById('venta-cliente-nombre');
    const inputTel = document.getElementById('venta-cliente-telefono');

    if (inputDoc && inputNom && inputTel) {
        const doc = normalizarRNC(inputDoc.value);
        let nombreCliente = normalizarNombreCliente(inputNom.value);
        let telefonoWhatsApp = normalizarTelefonoWhatsapp(inputTel.value) || 'N/A';
        let rncFinal = doc || 'CONSUMIDOR FINAL';

        let perfil = buscarClienteFidelizacion(nombreCliente, rncFinal);
        if (!perfil && doc) perfil = buscarClienteFidelizacion('', doc);

        if (perfil) {
            nombreCliente = perfil.nombre || nombreCliente;
            rncFinal = perfil.cedula || rncFinal;
            if (perfil.telefono) {
                telefonoWhatsApp = perfil.telefono;
                inputTel.value = perfil.telefono;
            }
            inputNom.value = nombreCliente;
            inputDoc.value = rncFinal;
        } else {
            if (!nombreCliente) {
                alert("Debe ingresar el nombre del cliente.");
                return null;
            }
            if (doc) {
                const creado = registrarClientePuntosDesdeDatos(nombreCliente, doc, telefonoWhatsApp === 'N/A' ? '' : telefonoWhatsApp);
                if (creado) {
                    perfil = creado;
                    nombreCliente = creado.nombre;
                    rncFinal = creado.cedula || rncFinal;
                    telefonoWhatsApp = creado.telefono || telefonoWhatsApp;
                    inputNom.value = nombreCliente;
                    inputDoc.value = rncFinal;
                    inputTel.value = telefonoWhatsApp === 'N/A' ? '' : telefonoWhatsApp;
                    guardarDatos();
                }
            }
        }

        actualizarEstadoClienteSalida(perfil || null, perfil ? '' : 'Cliente no registrado en fidelizacion. Se facturará sin acumulación de puntos.');
        if (typeof setClienteMesa === 'function') {
            setClienteMesa(typeof canonMesaActual === 'function' ? canonMesaActual() : mesaActiva, {
                nombre: nombreCliente || '',
                rnc: rncFinal || '',
                telefono: telefonoWhatsApp === 'N/A' ? '' : telefonoWhatsApp
            });
        }
        return { rncInput: rncFinal, nombreCliente, telefonoWhatsApp, perfilFidelizacion: perfil || null };
    }

    let rncInput = prompt("Ingrese RNC/Cédula del Cliente (O deje vacío para cliente sin RNC):");
    if (rncInput === null) return null;

    let nombreCliente = "";
    let rncFinal = "CONSUMIDOR FINAL";

    if (rncInput && rncInput.trim() !== "") {
        const rncLimpio = normalizarRNC(rncInput);
        const consulta = await consultarRNCClienteDGII(rncLimpio);

        if (consulta && consulta.nombre) {
            nombreCliente = consulta.nombre.toUpperCase();
            rncFinal = consulta.rnc || rncLimpio;
        } else {
            let aviso = "No se pudo consultar automáticamente en DGII.";
            if (!DGII_RNC_PROXY) {
                aviso += "\nTip: configure localStorage.DGII_RNC_PROXY con su endpoint de consulta.";
            }
            alert(aviso);
            const nombreManual = prompt("Ingrese el nombre/razón social:");
            if (nombreManual === null) return null;
            nombreCliente = nombreManual ? nombreManual.toUpperCase() : ("CLIENTE RNC: " + rncLimpio);
            rncFinal = rncLimpio;
        }
    } else {
        const nombreManual = prompt("Ingrese nombre del cliente (obligatorio):");
        if (nombreManual === null) return null;
        const limpio = (nombreManual || "").trim();
        if (!limpio) {
            alert("Debe ingresar un nombre de cliente.");
            return null;
        }
        nombreCliente = limpio.toUpperCase();
        rncFinal = "CONSUMIDOR FINAL";
    }

    const perfil = buscarClienteFidelizacion(nombreCliente, rncFinal);
    if (perfil) {
        nombreCliente = perfil.nombre;
        rncFinal = perfil.cedula || rncFinal;
    }

    const telefonoWhatsApp = prompt("Ingrese número de WhatsApp (Ej: 18290000000):") || "N/A";
    return { rncInput: rncFinal, nombreCliente, telefonoWhatsApp, perfilFidelizacion: perfil || null };
}

async function pasarAFacturacion() {
    const carritoVenta = obtenerCarritoMesaActiva();
    if (typeof carritoVenta === 'undefined' || carritoVenta.length === 0) {
        return alert("El detalle de venta está vacío.");
    }
    const datosCliente = await capturarDatosClienteFactura();
    if (!datosCliente) return;
    const perfil = datosCliente.perfilFidelizacion || buscarClienteFidelizacion(datosCliente.nombreCliente, datosCliente.rncInput);
    const detallePreciosVenta = calcularDetallePreciosVenta(carritoVenta, perfil).detalles;

    generarFacturaVisualYResumen({
        carritoVenta,
        nombreCliente: datosCliente.nombreCliente,
        rncInput: datosCliente.rncInput,
        telefonoWhatsApp: datosCliente.telefonoWhatsApp,
        mesaNombre: obtenerNombreMesa(mesaActiva),
        origen: 'crear-factura',
        detallePreciosVenta
    });

    actualizarTablaRNC();
}

function parseFechaRegistro(fechaRaw) {
    if (!fechaRaw) return null;
    if (fechaRaw instanceof Date) return fechaRaw;
    const txt = String(fechaRaw).trim();
    const fromNative = new Date(txt);
    if (!isNaN(fromNative.getTime())) return fromNative;

    const m = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return null;
    let d = parseInt(m[1], 10);
    let mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    const dt = new Date(y, mo - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
}

function fechaDentroRango(fechaRaw, idDesde, idHasta) {
    const f = parseFechaRegistro(fechaRaw);
    if (!f) return true;
    const desdeVal = document.getElementById(idDesde)?.value || '';
    const hastaVal = document.getElementById(idHasta)?.value || '';
    if (!desdeVal && !hastaVal) return true;

    const actual = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
    if (desdeVal) {
        const desde = new Date(`${desdeVal}T00:00:00`);
        if (actual < new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).getTime()) return false;
    }
    if (hastaVal) {
        const hasta = new Date(`${hastaVal}T00:00:00`);
        if (actual > new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate()).getTime()) return false;
    }
    return true;
}

function actualizarTablaRNC() {
    const tabla = document.getElementById('tabla-rnc-dgii');
    if (!tabla) return;
    const busquedaInput = document.getElementById('busqueda-rnc-clientes');
    const q = (busquedaInput ? busquedaInput.value : "").toString().trim().toLowerCase();
    
    tabla.innerHTML = ""; // Limpiar antes de llenar

    const fuente = Array.isArray(db.facturasResumen)
        ? db.facturasResumen.filter(x =>
            (!x.owner || x.owner === sesionUser.user) &&
            moduloPerteneceVista(x.modulo)
        )
        : [];
    const filtrados = [...fuente].reverse().filter(c => {
        if (!fechaDentroRango(c.fecha, 'filtro-rnc-desde', 'filtro-rnc-hasta')) return false;
        if (!q) return true;
        const nombre = (c.nombre || "").toString().toLowerCase();
        const rnc = (c.rnc || "").toString().toLowerCase();
        const tel = (c.telefono || "").toString().toLowerCase();
        const ncf = (c.ncf || "").toString().toLowerCase();
        const mesa = (c.mesa || "").toString().toLowerCase();
        const codigo = (c.codigo || "").toString().toLowerCase();
        return nombre.includes(q) || rnc.includes(q) || tel.includes(q) || ncf.includes(q) || mesa.includes(q) || codigo.includes(q);
    });

    if (filtrados.length === 0) {
        const msj = q ? `Sin resultados para: <strong>${q}</strong>` : "No hay facturas registradas.";
        tabla.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 30px; color: gray;">${msj}</td></tr>`;
        return;
    }

    filtrados.forEach(c => {
        const fila = document.createElement('tr');
        const tel = normalizarTelefonoWhatsapp(c.telefono);
        fila.innerHTML = `
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${c.fecha || '---'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><span class="badge-user">${c.operador || '---'}</span></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${c.mesa || '---'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${c.nombre || 'CONSUMIDOR FINAL'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${c.ncf || '---'}</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${c.rnc || 'CONSUMIDOR FINAL'}</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${c.codigo || '---'}</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">RD$${Number(c.total || 0).toFixed(2)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                ${tel ? `<a href="https://wa.me/${tel}" target="_blank" style="color: #25D366; text-decoration: none; font-weight: bold;">💬 ${tel}</a>` : '-'}
            </td>
        `;
        tabla.appendChild(fila);
    });
}

// Recuerda también agregar el caso 'rnc' a tu función limpiarHistorial si tienes una
// Ejemplo rápido:
// if (tipo === 'rnc') { db.clientesRNC = []; guardarDatos(); actualizarTablaRNC(); }

function enviarFacturaWhatsapp() {
    if (!datosClienteGlobal.telefono) {
        datosClienteGlobal.telefono = prompt("Por favor ingrese el número de WhatsApp:");
        if (!datosClienteGlobal.telefono) return;
    }
    datosClienteGlobal.telefono = normalizarTelefonoWhatsapp(datosClienteGlobal.telefono);
    if (!datosClienteGlobal.telefono) {
        alert("Número de WhatsApp inválido.");
        return;
    }

    const nombreNegocio = obtenerNombreNegocioActual();
    let mensaje = `*FACTURA DIGITAL - ${nombreNegocio.toUpperCase()}*\n`;
    mensaje += `------------------------------------------\n`;
    mensaje += `*Negocio:* ${nombreNegocio}\n`;
    mensaje += `*Cliente:* ${datosClienteGlobal.nombre}\n`;
    mensaje += `*RNC:* ${datosClienteGlobal.rnc}\n`;
    mensaje += `*Mesa:* ${facturaActualMesa || obtenerNombreMesa(mesaActiva)}\n`;
    mensaje += `*Fecha:* ${new Date().toLocaleString()}\n`;
    mensaje += `------------------------------------------\n`;

    const itemsFactura = facturaActualItems.length ? facturaActualItems : obtenerCarritoMesaActiva().map(it => ({ ...it, subtotal: it.precio * it.cantidad }));
    itemsFactura.forEach(item => {
        mensaje += `• ${item.cantidad}x ${item.nombre} - RD$${(item.precio * item.cantidad).toFixed(2)}\n`;
    });

    mensaje += `------------------------------------------\n`;
    const totalFactura = document.getElementById('factura-total')?.innerText ||
        `RD$${itemsFactura.reduce((acc, it) => acc + ((it.precio || 0) * (it.cantidad || 0)), 0).toFixed(2)}`;
    mensaje += `*TOTAL A PAGAR: ${totalFactura}*\n`;
    mensaje += `------------------------------------------\n`;
    mensaje += `_Gracias por su preferencia_`;

    abrirWhatsAppConMensaje(datosClienteGlobal.telefono, mensaje);
}

function imprimirTicket() {
    // Obtenemos los datos actuales del modal
    const fecha = document.getElementById('factura-fecha').innerText;
    const cuerpo = document.getElementById('cuerpo-factura').innerHTML;
    const total = document.getElementById('factura-total').innerText;
    const usuario = document.getElementById('factura-usuario').innerText;
    
    // Abrimos una nueva ventana para impresión
    const ventanaImpresion = window.open('', '_blank', 'width=400,height=600');
    
    ventanaImpresion.document.write(`
        <html>
        <head>
            <title>Factura - LuRo Control | El control en tus manos</title>
            <style>
                body { font-family: 'Courier New', Courier, monospace; width: 300px; margin: 0 auto; padding: 20px; color: #000; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .header { border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                .header h2 { margin: 0; font-size: 18px; }
                .header p { margin: 2px 0; font-size: 12px; }
                table { width: 100%; font-size: 13px; border-collapse: collapse; }
                th { border-bottom: 1px solid #000; text-align: left; }
                td { padding: 4px 0; }
                .total-section { border-top: 1px solid #000; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 16px; }
                .footer { margin-top: 20px; font-size: 11px; text-align: center; border-top: 1px dashed #000; padding-top: 10px; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header text-center">
                <h2>${obtenerNombreNegocioActual().toUpperCase()}</h2>
                <p><strong>FACTURA DE VENTA</strong></p>
                <p>${fecha}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>CANT.</th>
                        <th>PRODUCTO</th>
                        <th class="text-right">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${cuerpo}
                </tbody>
            </table>
            
            <div class="total-section">
                <div style="display:flex; justify-content:space-between;">
                    <span>TOTAL:</span>
                    <span>${total}</span>
                </div>
            </div>
            
            <div class="footer">
                <p>Atendido por: ${usuario}</p>
                <p>¡Gracias por su preferencia!</p>
                <p>*** LuRo Control | El control en tus manos ***</p>
            </div>
        </body>
        </html>
    `);

    ventanaImpresion.document.close();
    
    // Esperamos un momento para cargar estilos antes de imprimir
    setTimeout(() => {
        ventanaImpresion.print();
        ventanaImpresion.close();
    }, 500);
}
  function transferirAFactura(index) {
    const plato = db.platos[index];
    const carritoVenta = obtenerCarritoMesaActiva();
    const personaId = String(window.__mesaPersonaSeleccionadaId || '');
    const personaNombre = String(window.__mesaPersonaSeleccionadaNombre || '');
    
    // 1. Agregamos el plato al carrito/detalle de venta
    // Si ya existe en el detalle, solo aumentamos la cantidad
    const itemEnCarrito = carritoVenta.find(item =>
        item.nombre === plato.nombre &&
        String(item.personaId || '') === personaId
    );
    
    if (itemEnCarrito) {
        itemEnCarrito.cantidad++;
    } else {
        carritoVenta.push({
            nombre: plato.nombre,
            precio: plato.precio,
            cantidad: 1,
            originalIndex: index,
            personaId: personaId || '',
            personaNombre: personaNombre || ''
        });
    }
    const canonMesa = (typeof mesaCanonica === 'function') ? mesaCanonica(mesaActiva) : mesaActiva;
    if (personaId && db.mesaCuentas && db.mesaCuentas[canonMesa] && Array.isArray(db.mesaCuentas[canonMesa].personas)) {
        const per = db.mesaCuentas[canonMesa].personas.find(p => String(p.id || '') === personaId);
        if (per) { per.pagada = false; per.metodoPago = ''; per.pagadaEn = ''; }
    }
    window.__mesaPersonaSeleccionadaId = '';
    window.__mesaPersonaSeleccionadaNombre = '';

    // 2. Actualizamos visualmente el panel de cobro (el ticket)
    actualizarPanelCobro();

    // 3. Limpiamos el buscador para la siguiente venta
    document.getElementById('busqueda-plato').value = "";
    document.getElementById('contenedor-salidas-busqueda').innerHTML = "";

    // 4. (Opcional) Si quieres que salte visualmente a la factura, 
    // podrías usar showPage('facturacion') si tienes esa sección, 
    // pero como pediste que se vea en el panel, solo actualizamos el panel.
    const sufijoPersona = personaNombre ? ` para ${personaNombre}` : '';
    alert(`✅ ${plato.nombre} añadido${sufijoPersona} al detalle de ${mesaActiva}.`);
}
  function ajustarPrecioMasivo(porcentaje) {
    if (bloquearAccionAdministrativaColaborador()) return;
    if(confirm(`¿Aplicar un aumento del ${porcentaje * 100}% a todos los precios de venta?`)) {
        db.platos.forEach(p => {
            if(p.owner === sesionUser.user && p.modulo === moduloActual) {
                p.precio = p.precio * (1 + porcentaje);
            }
        });
        guardarDatos();
        renderDispoTable();
    }
}

function ajustarPrecioManual() {
    if (bloquearAccionAdministrativaColaborador()) return;
    let monto = parseFloat(prompt("Ingrese la cantidad fija a sumar al precio de venta:"));
    if(!isNaN(monto)) {
        db.platos.forEach(p => {
            if(p.owner === sesionUser.user && p.modulo === moduloActual) {
                p.precio += monto;
            }
        });
        guardarDatos();
        renderDispoTable();
    }
}
    let db = {
        usuarios: [{user: "Jssantana077", pass: "852347", role: "super-master", activo: true, colab: []}],
        platos: [], almacen: [], entradas: [], ventas: [], decomisos: [], autorizaciones: [], produccion_stock: [], historial_prod: [],
        distribuidores: [], catalogoDistribuidores: [], facturasResumen: [], codigosClienteRNC: {}, contadorCodigoCliente: 1, contadorCodigoFacturaBusqueda: 1, registroInicial: null, registroInicialUsuarios: {}, recuperacionClave: null, registroInicialBackups: [], clientesFidelizacion: [], configMembresia: { mensualUSD: 20, descuentoPorc: 8, cupoPlatosCosto: 5 }, qrClienteLinks: {}, entrenamientos: [], modulosCustom: []
    };
    let sesionUser = null; let operadorActual = ""; let loginClave = ""; let moduloActual = "COCINA"; let moduloVistaActual = "COCINA"; let moduloAdminObjetivo = "COCINA";
    let registroInicialModoUsuario = ""; let registroInicialPassTemporal = "";
    let esColaboradorSesion = false; let permisosSesion = []; let usuarioSesionLabel = ""; let cuentaLoginActual = "";
    let asignacionesEntradasSesion = [];
    let copiasRegistroDesbloqueadas = false;
    const MASTER_USER = "jssantana077";
    const MASTER_PASS = "852347";
    const USUARIO_ELIMINADO_FORZOSO = "__forced_removed_user_disabled__";

function purgarUsuarioEliminadoForzoso() {
    const target = String(USUARIO_ELIMINADO_FORZOSO || '').trim().toLowerCase();
    if (!target || !Array.isArray(db?.usuarios)) return false;
    const before = db.usuarios.length;
    db.usuarios = db.usuarios.filter((u) => {
        const user = String(u?.user || '').trim().toLowerCase();
        const owner = String(u?.owner || '').trim().toLowerCase();
        if (user === target) return false;
        if (String(u?.role || '').toLowerCase() === 'colaborador' && owner === target) return false;
        return true;
    });
    if (db.registroInicialUsuarios && typeof db.registroInicialUsuarios === 'object') {
        delete db.registroInicialUsuarios[target];
    }
    return db.usuarios.length !== before;
}

function asegurarCuentaMaestra() {
    if (!Array.isArray(db.usuarios)) db.usuarios = [];
    purgarUsuarioEliminadoForzoso();

    const existeMaster = db.usuarios.find(u => (u.user || "").trim().toLowerCase() === MASTER_USER);
    if (!existeMaster) {
        db.usuarios.push({
            user: MASTER_USER,
            pass: MASTER_PASS,
            role: "super-master",
            owner: MASTER_USER,
            activo: true
        });
    }

    db.usuarios = db.usuarios.map(u => {
        const userNorm = (u.user || "").trim().toLowerCase();
        if (userNorm === MASTER_USER) {
            return {
                ...u,
                user: MASTER_USER,
                pass: MASTER_PASS,
                role: "super-master",
                owner: MASTER_USER,
                activo: true
            };
        }
        return u;
    });
}

function normalizarDBSyncGlobal() {
    if (!db || typeof db !== 'object') db = {};
    const arrKeys = [
        'usuarios', 'platos', 'almacen', 'entradas', 'ventas', 'decomisos', 'autorizaciones',
        'produccion_stock', 'historial_prod', 'distribuidores', 'catalogoDistribuidores',
        'facturasResumen', 'clientesFidelizacion', 'entrenamientos', 'modulosCustom',
        'comandasActivas', 'comandasHistorial'
    ];
    arrKeys.forEach((k) => { if (!Array.isArray(db[k])) db[k] = []; });

    const objKeys = [
        'codigosClienteRNC', 'registroInicialUsuarios', 'qrClienteLinks',
        'deliveryMeta', 'mesaCuentas', 'mesaEstadoVenta', 'mesaClienteVenta'
    ];
    objKeys.forEach((k) => { if (!db[k] || typeof db[k] !== 'object') db[k] = {}; });

    if (!db.configMembresia || typeof db.configMembresia !== 'object') {
        db.configMembresia = { mensualUSD: 20, descuentoPorc: 8, cupoPlatosCosto: 5 };
    }
    if (!db.mesasEstado || typeof db.mesasEstado !== 'object') db.mesasEstado = {};
}

    function guardarDatos() { 
        asegurarCuentaMaestra();
        normalizarDBSyncGlobal();
        const tablasModulo = ['platos', 'almacen', 'entradas', 'ventas', 'decomisos', 'autorizaciones', 'produccion_stock', 'historial_prod', 'distribuidores', 'catalogoDistribuidores', 'facturasResumen', 'entrenamientos'];
        tablasModulo.forEach(k => {
            if (!Array.isArray(db[k])) return;
            db[k] = db[k].map(item => (item && item.modulo === 'ADMINISTRADOR') ? { ...item, modulo: 'COCINA' } : item);
        });
        db.mesasEstado = {
            carritoPorMesa: (typeof carritoPorMesa !== 'undefined') ? carritoPorMesa : {},
            mesaNombres: (typeof mesaNombres !== 'undefined') ? mesaNombres : {},
            mesaMeta: (typeof mesaMeta !== 'undefined') ? mesaMeta : {},
            mesaUniones: (typeof mesaUniones !== 'undefined') ? mesaUniones : {}
        };
        if (!window.__cloudApplyingRemote) {
            window.__cloudLocalChangeAt = Date.now();
        }
        localStorage.setItem('LURO_CONTROL_DB', JSON.stringify(db));
        if (typeof window.autoSubirCloudDebounced === 'function') window.autoSubirCloudDebounced();
    }
function cargarDatos() { 
        const d = JSON.parse(localStorage.getItem('LURO_CONTROL_DB')); 
        if(d) { 
          db = d; 
          normalizarDBSyncGlobal();
          if(!db.usuarios) db.usuarios = [];
          if(!db.autorizaciones) db.autorizaciones = [];
          if(!db.produccion_stock) db.produccion_stock = [];
          if(!db.historial_prod) db.historial_prod = [];
          if(!db.clientesRNC) db.clientesRNC = [];
          if(!db.facturasResumen) db.facturasResumen = [];
          if(!db.codigosClienteRNC || typeof db.codigosClienteRNC !== 'object') db.codigosClienteRNC = {};
          if(!db.contadorCodigoCliente) db.contadorCodigoCliente = 1;
          if(!db.contadorCodigoFacturaBusqueda) db.contadorCodigoFacturaBusqueda = 1;
          if(!db.registroInicial || typeof db.registroInicial !== 'object') db.registroInicial = null;
          if(!db.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
          if(!db.recuperacionClave || typeof db.recuperacionClave !== 'object') db.recuperacionClave = null;
          if(!Array.isArray(db.registroInicialBackups)) db.registroInicialBackups = [];
          if(!Array.isArray(db.clientesFidelizacion)) db.clientesFidelizacion = [];
          if(!db.qrClienteLinks || typeof db.qrClienteLinks !== 'object') db.qrClienteLinks = {};
          if(!Array.isArray(db.entrenamientos)) db.entrenamientos = [];
          if(!db.configMembresia || typeof db.configMembresia !== 'object') db.configMembresia = { mensualUSD: 20, descuentoPorc: 8, cupoPlatosCosto: 5 };
          aplicarConfigMembresiaDesdeDB();
          db.clientesFidelizacion = db.clientesFidelizacion.map(c => ({
            ...c,
            suscripcionActiva: c.suscripcionActiva === true,
            premiumActivo: c.premiumActivo === true,
            premiumPlatosCostoUsados: Number(c.premiumPlatosCostoUsados || 0),
            premiumPagosHistorial: Array.isArray(c.premiumPagosHistorial) ? c.premiumPagosHistorial : [],
            transferenciasAhorroHistorial: Array.isArray(c.transferenciasAhorroHistorial) ? c.transferenciasAhorroHistorial : [],
            transferencia: c.transferencia || ((c.metodoPago || c.cuentaAhorroDestino) ? {
                periodo: 'MENSUAL',
                tarjetaOrigen: c.metodoPago || null,
                receptor: c.cuentaAhorroDestino ? {
                    banco: c.cuentaAhorroDestino.banco || '',
                    cuenta: c.cuentaAhorroDestino.numero || '',
                    nombre: (c.cuentaAhorroDestino.titular || '').split(' ')[0] || '',
                    apellido: (c.cuentaAhorroDestino.titular || '').split(' ').slice(1).join(' '),
                    cedula: '',
                    telefono: ''
                } : null
            } : null),
            planMembresiaId: c.planMembresiaId || 'premium',
            suscripcionFechaInicio: c.suscripcionFechaInicio || '',
            suscripcionProximoCobro: c.suscripcionProximoCobro || '',
            ultimoAvisoPago3dias: c.ultimoAvisoPago3dias || '',
            ultimoAvisoPagoVencimiento: c.ultimoAvisoPagoVencimiento || ''
          }));
          if(!db.distribuidores) db.distribuidores = [];
          if(!db.catalogoDistribuidores) db.catalogoDistribuidores = [];
          if(!Array.isArray(db.modulosCustom)) db.modulosCustom = [];
          if(!db.mesasEstado) db.mesasEstado = {};

          // Migración de estructura vieja (db.colaboradores) a usuarios persistentes.
          if(Array.isArray(db.colaboradores) && db.colaboradores.length > 0) {
            db.colaboradores.forEach(c => {
                const userColab = (c.nombre || "").trim().toLowerCase();
                if(!userColab) return;
                const yaExiste = db.usuarios.find(u => u.user === userColab);
                if(!yaExiste) {
                    db.usuarios.push({
                        user: userColab,
                        pass: c.pass || "",
                        role: "colaborador",
                        owner: c.owner || null,
                        permisos: Array.isArray(c.permisos) ? c.permisos : ["home", "salida"],
                        activo: true
                    });
                }
            });
            // Limpiar legado para evitar que colaboradores eliminados reaparezcan.
            db.colaboradores = [];
          }

          db.usuarios = db.usuarios.map(u => ({
            ...u,
            user: (u.user || "").trim().toLowerCase(),
            owner: u.owner ? String(u.owner).trim().toLowerCase() : u.owner,
            permisos: normalizarPermisos(u.permisos),
            asignacionesEntradas: normalizarAsignacionesEntradas(u.asignacionesEntradas),
            role: u.role || "admin",
            activo: u.activo !== false
          }));

          // Reparación de dueños:
          // - admins con owner inválido pasan al admin por defecto
          // - colaboradores con owner inválido quedan bloqueados (no operan sin maestro activo)
          db.usuarios.forEach(u => {
            if (!u || !u.user || u.user === MASTER_USER) return;
            const ownerActual = u.owner ? String(u.owner).trim().toLowerCase() : "";
            const ownerExiste = db.usuarios.some(x => x.user === ownerActual);
            const role = String(u.role || '').trim().toLowerCase();
            if (role === 'colaborador') {
                if (!ownerActual || !ownerExiste) u.activo = false;
            } else {
                if (!ownerActual || !ownerExiste) u.owner = obtenerAdminPorDefecto();
            }
          });

          asegurarCuentaMaestra();

          if (db.mesasEstado && typeof db.mesasEstado === 'object') {
            if (typeof carritoPorMesa !== 'undefined') carritoPorMesa = db.mesasEstado.carritoPorMesa || {};
            if (typeof mesaNombres !== 'undefined') mesaNombres = db.mesasEstado.mesaNombres || {};
            if (typeof mesaMeta !== 'undefined') mesaMeta = db.mesasEstado.mesaMeta || {};
            if (typeof mesaUniones !== 'undefined') mesaUniones = db.mesasEstado.mesaUniones || {};
          }

          db.distribuidores = (db.distribuidores || []).map(d => ({
            id: d.id || generarId('dist'),
            owner: d.owner || sesionUser?.user || MASTER_USER,
            modulo: d.modulo || 'COCINA',
            nombre: (d.nombre || '').trim(),
            contacto: d.contacto || '',
            telefono: d.telefono || '',
            email: d.email || '',
            direccion: d.direccion || '',
            activo: d.activo !== false,
            createdAt: d.createdAt || new Date().toISOString(),
            updatedAt: d.updatedAt || new Date().toISOString()
          })).filter(d => d.nombre);

          db.catalogoDistribuidores = (db.catalogoDistribuidores || []).map(c => ({
            id: c.id || generarId('cat'),
            owner: c.owner || sesionUser?.user || MASTER_USER,
            modulo: c.modulo || 'COCINA',
            distId: c.distId || '',
            distNombre: c.distNombre || '',
            nombreProducto: normalizarNombreProducto(c.nombreProducto || c.producto || ''),
            unidad: c.unidad || 'Lb',
            precio: Number(c.precio || 0),
            disponible: c.disponible !== false,
            updatedAt: c.updatedAt || new Date().toISOString(),
            historialPrecios: Array.isArray(c.historialPrecios) ? c.historialPrecios : []
          })).filter(c => c.nombreProducto && c.precio >= 0);

          // Migración suave: historial antiguo de clientes -> resumen de facturas básico.
          if ((!db.facturasResumen || db.facturasResumen.length === 0) && Array.isArray(db.clientesRNC) && db.clientesRNC.length > 0) {
            db.facturasResumen = db.clientesRNC.map(c => ({
              fecha: c.fecha || new Date().toLocaleString(),
              operador: c.operador || '---',
              mesa: c.mesa || '---',
              nombre: (c.nombre || 'CONSUMIDOR FINAL').toUpperCase(),
              ncf: c.ncf || '---',
              rnc: c.rnc || 'CONSUMIDOR FINAL',
              codigo: normalizarRNC(c.rnc) ? generarCodigoClienteRNC(c.rnc) : generarCodigoBusquedaFactura(),
              total: Number(c.total || 0),
              telefono: c.telefono || 'N/A',
              items: Array.isArray(c.items) ? c.items : [],
              origen: c.origen || 'migracion',
              owner: c.owner || sesionUser?.user || MASTER_USER,
              modulo: c.modulo || moduloActual
            }));
          }

          guardarDatos();
        } else {
          asegurarCuentaMaestra();
          if(!db.qrClienteLinks || typeof db.qrClienteLinks !== 'object') db.qrClienteLinks = {};
          if(!Array.isArray(db.entrenamientos)) db.entrenamientos = [];
          if(!db.configMembresia || typeof db.configMembresia !== 'object') db.configMembresia = { mensualUSD: 20, descuentoPorc: 8, cupoPlatosCosto: 5 };
          aplicarConfigMembresiaDesdeDB();
          guardarDatos();
        }

        if (manejarVistaQRClienteDesdeURL()) return;
    
        inicializarFlujoRegistro();
        renderHomeRegistroInfo();
        manejarRegistroClienteDesdeQR();
    }

function sincronizarOwnersNubeALocal(registrosNube = []) {
    if (!Array.isArray(registrosNube)) return 0;
    if (!Array.isArray(db.usuarios)) db.usuarios = [];
    let cambios = 0;
    const cloudMap = new Map();
    registrosNube.forEach((it) => {
        const user = String(it.username || '').trim().toLowerCase();
        const pass = String(it.pass || '').trim();
        if (!user || !pass || user === MASTER_USER || user === USUARIO_ELIMINADO_FORZOSO) return;
        cloudMap.set(user, it || {});
        const idx = db.usuarios.findIndex(u => String(u.user || '').toLowerCase() === user);
        const base = {
            user,
            pass,
            role: 'admin',
            owner: user,
            activo: it.activo !== false,
            plan: String(it.plan || 'basico').trim().toLowerCase(),
            estado: String(it.estado || 'activo').trim().toLowerCase(),
            suscripcion: it.suscripcion || null,
            requiereRegistroInicial: false,
            origenCloud: true
        };
        if (idx === -1) {
            db.usuarios.push(base);
            cambios++;
        } else {
            const actual = db.usuarios[idx] || {};
            const nuevo = { ...actual, ...base };
            if (JSON.stringify(actual) !== JSON.stringify(nuevo)) {
                db.usuarios[idx] = nuevo;
                cambios++;
            }
        }
    });
    // Seguridad: no eliminar colaboradores automáticamente por snapshots parciales de nube.
    // Solo se depuran admins de origen cloud cuando el snapshot trae datos.
    if (cloudMap.size > 0) {
        const before = db.usuarios.length;
        db.usuarios = db.usuarios.filter(u => {
            const user = String(u?.user || '').trim().toLowerCase();
            const role = String(u?.role || '').trim().toLowerCase();
            if (!user || user === MASTER_USER) return true;
            if (role === 'admin' && u?.origenCloud === true) {
                const inCloud = cloudMap.has(user);
                if (!inCloud) {
                    if (db.registroInicialUsuarios && typeof db.registroInicialUsuarios === 'object') {
                        delete db.registroInicialUsuarios[user];
                    }
                    return false;
                }
            }
            return true;
        });
        if (db.usuarios.length !== before) cambios++;

        // Jerarquía estricta: colaborador solo activo si su maestro existe y está activo.
        (db.usuarios || []).forEach((u) => {
            if (!u || String(u.role || '').trim().toLowerCase() !== 'colaborador') return;
            const owner = String(u.owner || '').trim().toLowerCase();
            if (!owner) {
                if (u.activo !== false) { u.activo = false; cambios++; }
                return;
            }
            // El owner master no depende de cloudMap (se omite del snapshot por diseño).
            if (owner === MASTER_USER) return;
            const ownerCloud = cloudMap.get(owner);
            const debeEstarActivo = !!(ownerCloud && ownerCloud.activo !== false);
            if ((u.activo !== false) !== debeEstarActivo) {
                u.activo = debeEstarActivo;
                cambios++;
            }
        });
    }
    if (cambios > 0) guardarDatos();
    if (typeof window.verificarSesionRevocadaEnNube === 'function') {
        window.verificarSesionRevocadaEnNube(registrosNube);
    }
    return cambios;
}
window.sincronizarOwnersNubeALocal = sincronizarOwnersNubeALocal;

function normalizarPermisos(permisos) {
    const base = Array.isArray(permisos) ? permisos : [];
    const filtrados = [...new Set(base.filter(Boolean))];
    if (!filtrados.includes('home')) filtrados.unshift('home');
    return filtrados;
}

function etiquetaPermisoRenglon(p) {
    const map = {
        home: 'Inicio',
        configuracion: 'Configuración',
        agregar: 'Agregar Plato',
        inventario: 'Almacén',
        distribuidores: 'Distribuidores',
        'produccion-interna': 'Producción Interna',
        disponibilidad: 'Disponibilidad',
        'disponibilidad-lite': 'Disponibilidad (solo nombre y existencias)',
        salida: 'Registro de Salida (Caja)',
        comandas: 'Comandas',
        'clientes-puntos': 'Clientes y Puntos',
        entrenamientos: 'Entrenamientos',
        procedimientos: 'Procedimientos',
        'historial-produccion': 'Historial Producción',
        'entradas-almacen': 'Entradas Almacén',
        ventas: 'Historial de Ventas',
        'reporte-compras-distribuidor': 'Compras por Distribuidor',
        'rnc-dgii': 'Resumen de facturas',
        autorizaciones: 'Autorizaciones',
        'historial-decomiso': 'Historial Decomiso',
        decomiso: 'Registrar Decomiso',
        produccion: 'Departamentos A-B-C'
    };
    return map[p] || p;
}

function obtenerAdminPorDefecto(excluirUser = "") {
    const excl = (excluirUser || "").trim().toLowerCase();
    const admin = (db.usuarios || []).find(u => u.role === 'admin' && u.activo !== false && u.user !== excl);
    return admin ? admin.user : MASTER_USER;
}

function normalizarAsignacionesEntradas(asignaciones) {
    const base = Array.isArray(asignaciones) ? asignaciones : [];
    return [...new Set(base.filter(Boolean))];
}

function aplicarEstadoUsuariosVinculados(ownerUser, activoOwner) {
    const owner = String(ownerUser || '').trim().toLowerCase();
    if (!owner) return 0;
    let cambios = 0;
    (db.usuarios || []).forEach((u) => {
        if (!u || String(u.role || '').toLowerCase() !== 'colaborador') return;
        if (String(u.owner || '').trim().toLowerCase() !== owner) return;
        const estadoNuevo = activoOwner !== false;
        if ((u.activo !== false) !== estadoNuevo) {
            u.activo = estadoNuevo;
            cambios++;
        }
    });
    return cambios;
}

function togglePermisosGrupo(grupo, checked) {
    document.querySelectorAll(`.colab-perm-${grupo}`).forEach(c => {
        c.checked = checked;
    });
}

function sincronizarSeleccionGrupo(grupo) {
    const checks = Array.from(document.querySelectorAll(`.colab-perm-${grupo}`));
    if (!checks.length) return;
    const toggle = document.getElementById(`colab-group-${grupo}`);
    if (!toggle) return;
    toggle.checked = checks.every(c => c.checked);
}

function obtenerAdminAutorizadorPorClave(claveAdmin) {
    const clave = (claveAdmin || "").toString();
    if (!clave) return null;
    return (db.usuarios || []).find(u =>
        (u.role === 'admin' || u.role === 'super-master') &&
        u.activo !== false &&
        u.pass === clave
    ) || null;
}

function cargarAsignacionDuenoColaborador() {
    // Mantenida por compatibilidad con llamadas existentes.
    // La asignación de dueño ahora se resuelve por clave de Usuario Maestro en crearColaborador().
}

function tieneAsignacionEntrada(tipo) {
    if (esMasterEnSesion()) return true;
    if (!esColaboradorSesion) return true;
    return normalizarAsignacionesEntradas(asignacionesEntradasSesion).includes(tipo);
}

function esMasterEnSesion() {
    // Si la sesión actual es colaborador, nunca debe heredar privilegios master del dueño.
    if (esColaboradorSesion) return false;
    return !!sesionUser && ((sesionUser.user || "").trim().toLowerCase() === MASTER_USER);
}

function puedeUsarClientesPuntosExclusivo() {
    return !!sesionUser &&
        !esColaboradorSesion &&
        String(sesionUser.user || "").trim().toLowerCase() === MASTER_USER;
}

function filtrarPermisosRestringidos(permisos, owner = "") {
    const ownerKey = String(owner || "").trim().toLowerCase();
    const list = normalizarPermisos(permisos || []);
    if (ownerKey !== MASTER_USER) return list.filter(p => p !== 'clientes-puntos');
    return list;
}

function obtenerPermisosColaboradorSesion() {
    const permitidos = [
        'home',
        'configuracion',
        'agregar',
        'inventario',
        'distribuidores',
        'produccion-interna',
        'disponibilidad',
        'disponibilidad-lite',
        'salida',
        'comandas',
        'clientes-puntos',
        'entrenamientos',
        'procedimientos',
        'historial-produccion',
        'entradas-almacen',
        'ventas',
        'reporte-compras-distribuidor',
        'rnc-dgii',
        'autorizaciones',
        'historial-decomiso',
        'decomiso',
        'produccion'
    ];
    const setPermitidos = new Set(permitidos);
    const ownerSesion = String(sesionUser?.user || '').trim().toLowerCase();
    const permisosFiltrados = filtrarPermisosRestringidos(permisosSesion, ownerSesion);
    return permisosFiltrados.filter(p => p !== 'home' && setPermitidos.has(p));
}

function obtenerPaginaInicialSesion() {
    if (!esColaboradorSesion) return 'home';
    const orden = [
        'salida',
        'comandas',
        'disponibilidad',
        'inventario',
        'produccion-interna',
        'distribuidores',
        'agregar',
        'clientes-puntos',
        'entrenamientos',
        'procedimientos',
        'configuracion',
        'historial-produccion',
        'entradas-almacen',
        'ventas',
        'reporte-compras-distribuidor',
        'rnc-dgii',
        'autorizaciones',
        'historial-decomiso',
        'decomiso',
        'produccion'
    ];
    const permisosColab = obtenerPermisosColaboradorSesion();
    return orden.find(p => permisosColab.includes(p)) || 'home';
}

function esModoBasicoColaborador() {
    return !!esColaboradorSesion;
}

function bloquearAccionAdministrativaColaborador(mensaje = "🚫 Esta acción no está permitida para colaboradores.") {
    if (!esModoBasicoColaborador()) return false;
    alert(mensaje);
    return true;
}

function tienePermisoPagina(pageId) {
    if (pageId === 'diagnostico') return true;
    if (pageId === 'clientes-puntos' && !puedeUsarClientesPuntosExclusivo()) return false;
    if (esMasterEnSesion()) return true;
    if (!esColaboradorSesion) return true;

    const permisosColab = obtenerPermisosColaboradorSesion();
    if (pageId === 'disponibilidad' && (permisosColab.includes('disponibilidad-lite') || permisosColab.includes('disponibilidad'))) return true;
    return permisosColab.includes(pageId);
}

function aplicarRestriccionClientesPuntosUI() {
    const allow = puedeUsarClientesPuntosExclusivo();
    document.querySelectorAll('.sidebar a[onclick*="showPage(\'clientes-puntos\')"]').forEach(link => {
        link.style.display = allow ? '' : 'none';
    });
    document.querySelectorAll('.colab-perm[value="clientes-puntos"]').forEach(chk => {
        if (!allow) chk.checked = false;
        chk.disabled = !allow;
        const label = chk.closest('label');
        if (label) label.style.display = allow ? '' : 'none';
    });
}

    function aplicarPermisosSidebar() {
        if (esMasterEnSesion()) {
            document.querySelectorAll('.sidebar a[onclick*="showPage("]').forEach(link => {
                const scope = link.getAttribute('data-module-scope');
                if (scope && scope !== 'ANY' && scope !== moduloVistaActual) {
                    link.style.display = 'none';
            } else {
                link.style.display = 'block';
            }
        });
        document.querySelectorAll('.folder-container').forEach(folder => {
            folder.style.display = 'block';
        });
        aplicarVisibilidadModuloEspecial();
        aplicarRestriccionClientesPuntosUI();
        return;
    }

    const links = document.querySelectorAll('.sidebar a[onclick*="showPage("]');
    links.forEach(link => {
        const onclickValue = link.getAttribute('onclick') || '';
        const match = onclickValue.match(/showPage\('([^']+)'\)/);
        if (!match) return;
        const scope = link.getAttribute('data-module-scope');
        if (scope && scope !== 'ANY' && scope !== moduloVistaActual) {
            link.style.display = 'none';
            return;
        }
        const pageId = match[1];
        const allowed = tienePermisoPagina(pageId);
        link.style.display = allowed ? 'block' : 'none';
    });

    document.querySelectorAll('.folder-container').forEach(folder => {
        const childLinks = folder.querySelectorAll('.folder-content a');
        const visibleCount = Array.from(childLinks).filter(a => a.style.display !== 'none').length;
        folder.style.display = visibleCount > 0 ? 'block' : 'none';
    });
    aplicarVisibilidadModuloEspecial();
    aplicarRestriccionClientesPuntosUI();
}

function cerrarSesionPorRevocacion() {
    sesionUser = null;
    operadorActual = "";
    loginClave = "";
    window.loginClave = "";
    esColaboradorSesion = false;
    permisosSesion = [];
    usuarioSesionLabel = "";
    cuentaLoginActual = "";
    window.cuentaLoginActual = "";
    asignacionesEntradasSesion = [];
    document.getElementById('log_pass').value = "";
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('module-selector').style.display = 'none';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';
}

function validarAccesoCuentaActual() {
    if (!cuentaLoginActual) return true;
    const latest = JSON.parse(localStorage.getItem('LURO_CONTROL_DB') || 'null');
    if (latest && Array.isArray(latest.usuarios)) {
        db.usuarios = latest.usuarios;
        asegurarCuentaMaestra();
    }
    const cuenta = db.usuarios.find(u => u.user === cuentaLoginActual);
    if (!cuenta || cuenta.activo === false) {
        alert(MSG_USUARIO_INACTIVO);
        cerrarSesionPorRevocacion();
        return false;
    }
    return true;
}

function resaltarProducto() {
    const busqueda = document.getElementById('buscarProductoAlmacen').value.toLowerCase().trim();
    const filas = document.querySelectorAll('#tabla-inventario tr');
    
    if (busqueda === "") {
        filas.forEach(f => f.classList.remove('resaltado-temporal'));
        return;
    }

    filas.forEach(fila => {
        const nombreProducto = fila.cells[0].innerText.toLowerCase();
        
        // Si hay una coincidencia exacta o muy cercana
        if (nombreProducto.includes(busqueda)) {
            fila.classList.add('resaltado-temporal');
            fila.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Si la búsqueda es exacta, abrir ventana flotante
            if (nombreProducto === busqueda || (busqueda.length > 3 && nombreProducto.startsWith(busqueda))) {
                abrirModalInfo(nombreProducto, fila);
            }
        } else {
            fila.classList.remove('resaltado-temporal');
        }
    });
}

function abrirModalInfo(nombre, fila) {
    const modal = document.getElementById('modal-info-producto');
    const contenido = document.getElementById('info-contenido');
    
    // Extraer datos de las celdas de la tabla
    const stock = fila.cells[1].innerText;
    const costo = fila.cells[2].innerText;
    const faltante = fila.cells[3].innerText;

    document.getElementById('info-titulo').innerText = nombre.toUpperCase();
    contenido.innerHTML = `
        <p><strong>📦 Existencia Disponible:</strong> ${stock}</p>
        <p><strong>💲 Costo Unitario:</strong> ${costo}</p>
        <p><strong>⚠️ Faltante:</strong> ${faltante}</p>
        <hr>
        <p style="font-size: 0.8em; color: gray;">Producto localizado en el Almacén de Suministros.</p>
    `;
    
    modal.style.display = 'flex';
}

function cerrarModalInfo() {
    document.getElementById('modal-info-producto').style.display = 'none';
    document.getElementById('buscarProductoAlmacen').value = ""; // Limpiar búsqueda
}

function obtenerRegistroInicialActivo() {
    const ownerKey = (window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || cuentaLoginActual || '').toString().trim().toLowerCase();
    if (!ownerKey) return null;
    if (!db?.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
    const regOwner = db.registroInicialUsuarios[ownerKey];
    if (regOwner && regOwner.completado === true) return regOwner;

    // Migración legacy: solo el master principal conserva fallback desde db.registroInicial.
    if (ownerKey === MASTER_USER && db?.registroInicial && db.registroInicial.completado === true) {
        db.registroInicialUsuarios[ownerKey] = { ...db.registroInicial };
        return db.registroInicialUsuarios[ownerKey];
    }
    return null;
}
    
    
function obtenerNombreNegocioActual() {
    const regActivo = obtenerRegistroInicialActivo();
    const nombre = (regActivo?.businessName || "").trim();
    return nombre || "LuRo Control";
}

function obtenerTelefonoNegocioActual() {
    const regActivo = obtenerRegistroInicialActivo();
    const telRegistro = normalizarTelefonoWhatsapp(regActivo?.phone || "");
    const telDefault = normalizarTelefonoWhatsapp(WHATSAPP_DEFAULT || "");
    return telRegistro || telDefault || "";
}

function renderHomeRegistroInfo() {
    const reg = obtenerRegistroInicialActivo();
    const btnDel = document.getElementById("home-btn-eliminar-registro");
    const logoEl = document.getElementById("home-reg-logo");
    if (btnDel) btnDel.style.display = reg ? "inline-block" : "none";

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '-';
    };

    if (!reg) {
        setText('home-reg-user', '-');
        setText('home-reg-business', '-');
        setText('home-reg-phone', '-');
        setText('home-reg-created', '-');
        setText('home-reg-reason', '-');
        if (logoEl) { logoEl.style.display = 'none'; logoEl.src = ''; }
        renderEstadoMembresiaInicio();
        return;
    }

    const fecha = reg.createdAt ? new Date(reg.createdAt).toLocaleString() : '-';
    setText('home-reg-user', reg.user || '-');
    setText('home-reg-business', reg.businessName || '-');
    setText('home-reg-phone', reg.phone || '-');
    setText('home-reg-created', fecha);
    setText('home-reg-reason', reg.reason || '-');
    if (logoEl) {
        if (reg.logo) { logoEl.src = reg.logo; logoEl.style.display = 'inline-block'; }
        else { logoEl.style.display = 'none'; logoEl.src = ''; }
    }
    renderEstadoMembresiaInicio();
}

function obtenerOwnerCloudInfoInicio() {
    const owner = String(window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || '').trim().toLowerCase();
    if (!owner) return null;
    const local = (db?.usuarios || []).find(u => String(u?.user || '').trim().toLowerCase() === owner && String(u?.role || '').toLowerCase() !== 'colaborador');
    if (local) return local;
    const cloud = (window.luroCloudOwnersCache || []).find(o => String(o?.username || '').trim().toLowerCase() === owner);
    return cloud || null;
}

function nombrePlanDesdeId(planId) {
    const p = String(planId || 'basico').trim().toLowerCase();
    if (p === 'empresarial') return 'Plan Empresarial';
    if (p === 'profesional') return 'Plan Profesional';
    return 'Plan Básico';
}

function calcularDiasTrial(suscripcion) {
    const trialEnd = suscripcion?.trialEndsAt;
    if (!trialEnd) return 0;
    let ms = 0;
    if (typeof trialEnd?.toMillis === 'function') {
        ms = trialEnd.toMillis();
    } else if (typeof trialEnd === 'object' && trialEnd) {
        const sec = Number(trialEnd.seconds ?? trialEnd._seconds ?? 0);
        const ns = Number(trialEnd.nanoseconds ?? trialEnd._nanoseconds ?? 0);
        if (sec > 0) ms = (sec * 1000) + Math.floor(ns / 1000000);
    } else {
        ms = Date.parse(String(trialEnd || ''));
    }
    if (!ms || Number.isNaN(ms)) return 0;
    const diff = ms - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function renderEstadoMembresiaInicio() {
    const planEl = document.getElementById('home-plan-actual');
    const estadoEl = document.getElementById('home-estado-suscripcion');
    const noticeEl = document.getElementById('home-trial-notice');
    const statusEl = document.getElementById('home-membership-status');
    const planSelect = document.getElementById('home-plan-select');
    const daySelect = document.getElementById('home-billing-day-select');
    if (!planEl || !estadoEl || !noticeEl || !statusEl) return;

    const info = obtenerOwnerCloudInfoInicio() || {};
    const plan = String(info?.plan || 'basico').trim().toLowerCase();
    const estado = String(info?.estado || info?.suscripcion?.estado || 'activo').trim().toLowerCase();
    const sus = info?.suscripcion || {};
    const billingDay = Number(sus?.billingDay || 10);
    const diasTrial = calcularDiasTrial(sus);

    planEl.textContent = nombrePlanDesdeId(plan);
    estadoEl.textContent = estado === 'activo' ? 'ACTIVA' : (estado === 'trial' ? 'PRUEBA' : 'PENDIENTE');
    estadoEl.style.color = estado === 'activo' ? '#1f8f4c' : (estado === 'trial' ? '#a66a00' : '#c0392b');
    if (planSelect) planSelect.value = plan;
    if (daySelect && billingDay >= 1 && billingDay <= 28) daySelect.value = String(billingDay);

    if (diasTrial > 0 || estado === 'trial') {
        noticeEl.style.display = 'block';
        noticeEl.textContent = `🎁 Prueba gratis activa: le quedan ${diasTrial} día(s). Después debe completar su pago para mantener acceso.`;
    } else {
        noticeEl.style.display = 'none';
        noticeEl.textContent = '';
    }
    statusEl.textContent = 'Puede cambiar de membresía aquí y completar el pago adicional para activar el nuevo plan.';
}

async function iniciarCambioMembresiaDesdeInicio() {
    if (bloquearAccionAdministrativaColaborador()) return;
    const plan = String(document.getElementById('home-plan-select')?.value || 'basico').trim().toLowerCase();
    const billingDay = Number(document.getElementById('home-billing-day-select')?.value || 10);
    const st = document.getElementById('home-membership-status');
    if (st) st.textContent = 'Generando enlace de pago...';
    try {
        if (typeof window.crearCheckoutCambioMembresia !== 'function') {
            throw new Error('Backend de pago no disponible.');
        }
        const rs = await window.crearCheckoutCambioMembresia({ plan, billingDay });
        const url = String(rs?.paymentUrl || rs?.checkoutUrl || rs?.paypalUrl || '').trim();
        if (!url) throw new Error('No se pudo crear el enlace de pago.');
        if (st) st.textContent = 'Redirigiendo al pago seguro...';
        setTimeout(() => { window.location.href = url; }, 450);
    } catch (e) {
        const msg = String(e?.message || e || 'Error interno');
        if (st) st.textContent = `Error: ${msg}`;
        alert(`No se pudo iniciar el cambio de membresía.\n${msg}`);
    }
}

function validarPasswordSeguridad(mensaje) {
    const pass = prompt(mensaje || "Ingrese su contraseña:");
    if (pass === null) return false;
    return pass === (sesionUser && sesionUser.pass ? sesionUser.pass : "") || pass === MASTER_PASS || pass === loginClave;
}

function crearCopiaSeguridadRegistroInicial(motivo, fechaEliminado, eliminadoPor) {
    const regActivo = obtenerRegistroInicialActivo();
    if (!regActivo) return null;
    if (!Array.isArray(db.registroInicialBackups)) db.registroInicialBackups = [];
    const ownerKey = (window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || cuentaLoginActual || '').toString().trim().toLowerCase();

    const copia = {
        id: 'REG-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        owner: ownerKey || '',
        createdAt: new Date().toISOString(),
        motivo: motivo || 'manual',
        deletedAt: fechaEliminado || '',
        deletedBy: eliminadoPor || '',
        data: JSON.parse(JSON.stringify(regActivo))
    };

    db.registroInicialBackups.unshift(copia);
    if (db.registroInicialBackups.length > 50) db.registroInicialBackups = db.registroInicialBackups.slice(0, 50);
    return copia;
}

function eliminarRegistroInicialDesdeInicio() {
    const ownerKey = (window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || cuentaLoginActual || '').toString().trim().toLowerCase();
    const regActivo = obtenerRegistroInicialActivo();
    if (!regActivo || !ownerKey) return alert("No hay registro inicial para eliminar.");

    if (!validarPasswordSeguridad("SEGURIDAD: Ingrese su contraseña para eliminar el registro inicial:")) {
        return alert("Contraseña incorrecta. Operación cancelada.");
    }

    if (!confirm("Se eliminará el registro inicial y se guardará una copia de seguridad. ¿Desea continuar?")) return;

    const fechaEliminado = new Date().toISOString();
    const eliminadoPor = operadorActual || (sesionUser && sesionUser.user ? sesionUser.user : '---');

    crearCopiaSeguridadRegistroInicial('eliminado', fechaEliminado, eliminadoPor);
    if (!db.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
    delete db.registroInicialUsuarios[ownerKey];
    if (ownerKey === MASTER_USER) db.registroInicial = null;
    db.recuperacionClave = null;
    guardarDatos();

    copiasRegistroDesbloqueadas = false;
    renderHomeRegistroInfo();
    inicializarFlujoRegistro();

    alert("Registro inicial eliminado. Se guardó una copia de seguridad.");
}

function crearCopiaRegistroManual() {
    if (!obtenerRegistroInicialActivo()) return alert("No hay registro inicial para respaldar.");

    if (!validarPasswordSeguridad("Ingrese contraseña para crear copia de seguridad:")) {
        return alert("Contraseña incorrecta.");
    }

    crearCopiaSeguridadRegistroInicial('manual', '', operadorActual || (sesionUser && sesionUser.user ? sesionUser.user : '---'));
    guardarDatos();
    renderTablaCopiasRegistro();
    alert("Copia de seguridad creada.");
}

function desbloquearCopiasRegistroConPassword() {
    if (!validarPasswordSeguridad("Ingrese contraseña para ver las copias de seguridad:")) {
        return alert("Contraseña incorrecta.");
    }

    copiasRegistroDesbloqueadas = true;
    renderTablaCopiasRegistro();
}

function restaurarCopiaRegistro(copiaId) {
    if (!copiasRegistroDesbloqueadas) return alert("Primero desbloquee las copias con contraseña.");

    if (!validarPasswordSeguridad("Ingrese contraseña para restaurar esta copia:")) {
        return alert("Contraseña incorrecta.");
    }

    const copia = (db.registroInicialBackups || []).find(c => c.id === copiaId);
    if (!copia) return alert("No se encontró la copia seleccionada.");

    if (!confirm("Se restaurará el registro inicial desde la copia seleccionada. ¿Continuar?")) return;

    const ownerKey = (window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || cuentaLoginActual || '').toString().trim().toLowerCase();
    if (!ownerKey) return alert("No se pudo determinar el usuario activo.");
    if (!db.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
    db.registroInicialUsuarios[ownerKey] = JSON.parse(JSON.stringify(copia.data || {}));
    if (ownerKey === MASTER_USER) db.registroInicial = JSON.parse(JSON.stringify(copia.data || {}));
    guardarDatos();

    renderHomeRegistroInfo();
    inicializarFlujoRegistro();
    renderTablaCopiasRegistro();

    alert("Registro inicial restaurado correctamente.");
}

function renderTablaCopiasRegistro() {
    const tbody = document.getElementById('config-registro-backups-body');
    const status = document.getElementById('config-registro-backups-status');
    if (!tbody || !status) return;

    if (!copiasRegistroDesbloqueadas) {
        status.textContent = "Copias bloqueadas. Ingrese contraseña para visualizar.";
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#777;">Copias bloqueadas.</td></tr>';
        return;
    }

    const lista = Array.isArray(db.registroInicialBackups) ? db.registroInicialBackups : [];
    status.textContent = 'Copias visibles: ' + lista.length;

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#777;">No hay copias disponibles.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(function(c) {
        const fCopia = c.createdAt ? new Date(c.createdAt).toLocaleString() : '-';
        const fDel = c.deletedAt ? new Date(c.deletedAt).toLocaleString() : '-';
        return '<tr>' +
            '<td>' + fCopia + '</td>' +
            '<td>' + (c.motivo || '-') + '</td>' +
            '<td>' + fDel + '</td>' +
            '<td>' + (c.deletedBy || '-') + '</td>' +
            '<td><button class="btn btn-save" onclick="restaurarCopiaRegistro(\'' + c.id + '\')">RESTAURAR</button></td>' +
        '</tr>';
    }).join('');
}

function abrirRegistroInicialParaUsuario(userObj) {
    const registroOverlay = document.getElementById('registro-inicial-overlay');
    if (!registroOverlay || !userObj) return;
    registroInicialModoUsuario = (userObj.user || '').toLowerCase();
    registroInicialPassTemporal = userObj.pass || '';
    const inUser = document.getElementById('reg_user');
    const inPass = document.getElementById('reg_pass');
    const inPhone = document.getElementById('reg_phone');
    const inBusiness = document.getElementById('reg_business');
    const inReason = document.getElementById('reg_reason');
    const inLogo = document.getElementById('reg_logo');
    if (inUser) { inUser.value = userObj.user || ''; inUser.readOnly = true; }
    if (inPass) { inPass.value = userObj.pass || ''; inPass.readOnly = true; }
    if (inPhone) inPhone.value = '';
    if (inBusiness) inBusiness.value = '';
    if (inReason) inReason.value = 'Registro inicial de usuario administrador';
    if (inLogo) inLogo.value = '';
    registroOverlay.style.display = 'flex';
    const userInput = document.getElementById('log_user');
    const passInput = document.getElementById('log_pass');
    if (userInput) userInput.disabled = true;
    if (passInput) passInput.disabled = true;
}
function inicializarFlujoRegistro() {
    const registroOverlay = document.getElementById('registro-inicial-overlay');
    const userInput = document.getElementById('log_user');
    const passInput = document.getElementById('log_pass');
    if (!registroOverlay || !userInput || !passInput) return;
    registroOverlay.style.display = 'none';
    userInput.disabled = false;
    passInput.disabled = false;

    const regActivo = obtenerRegistroInicialActivo() || {};
    const tel = normalizarTelefonoWhatsapp(regActivo.phone || "");
    if (tel) {
        WHATSAPP_DEFAULT = tel;
        localStorage.setItem('LURO_WHATSAPP_DEFAULT', tel);
    }
}

function completarRegistroInicial() {
    const userRaw = (document.getElementById('reg_user')?.value || '').trim();
    const pass = (document.getElementById('reg_pass')?.value || '').trim();
    const phoneRaw = (document.getElementById('reg_phone')?.value || '').trim();
    const businessName = (document.getElementById('reg_business')?.value || '').trim();
    const reason = (document.getElementById('reg_reason')?.value || '').trim();
    const logoFile = document.getElementById('reg_logo')?.files?.[0] || null;

    if (!userRaw || !pass || !phoneRaw || !businessName || !reason) {
        return alert("Complete todos los campos del registro inicial.");
    }

    const user = userRaw.toLowerCase();
    if (user === MASTER_USER) {
        return alert("Ese usuario está reservado. Use otro nombre de usuario.");
    }

    const phone = normalizarTelefonoWhatsapp(phoneRaw);
    if (!phone) {
        return alert("Número de WhatsApp inválido. Ingrese solo dígitos.");
    }

    let existing = db.usuarios.find(u => u.user === user);
    if (existing && existing.role === 'colaborador') {
        return alert("Ese usuario pertenece a un colaborador. Use otro nombre.");
    }

    if (registroInicialModoUsuario) {
        if (user !== registroInicialModoUsuario) return alert("El usuario no coincide con el creado.");
        if (pass !== registroInicialPassTemporal) return alert("La contraseña no coincide con la creada.");
    } else if (existing) {
        existing.pass = pass;
        existing.role = existing.role || 'admin';
        existing.owner = existing.owner || user;
        existing.activo = true;
    } else {
        db.usuarios.push({ user, pass, role: 'admin', owner: user, activo: true, permisos: ['home'] });
    }

    const finalizarRegistro = (logoData) => {
        if (!db.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
        db.registroInicialUsuarios[user] = {
            completado: true,
            user,
            phone,
            businessName,
            reason,
            logo: logoData || '',
            createdAt: new Date().toISOString()
        };
        if (user === MASTER_USER) db.registroInicial = { ...db.registroInicialUsuarios[user] };
        const usr = db.usuarios.find(u => u.user === user);
        if (usr) usr.requiereRegistroInicial = false;

        db.recuperacionClave = null;
        WHATSAPP_DEFAULT = phone;
        localStorage.setItem('LURO_WHATSAPP_DEFAULT', phone);

        guardarDatos();
        registroInicialModoUsuario = "";
        registroInicialPassTemporal = "";
        inicializarFlujoRegistro();

        renderHomeRegistroInfo();
        document.getElementById('log_user').value = user;
        document.getElementById('log_pass').value = pass;
        intentarLogin();
    };

    if (logoFile) {
        const fr = new FileReader();
        fr.onload = () => finalizarRegistro(fr.result || '');
        fr.onerror = () => finalizarRegistro('');
        fr.readAsDataURL(logoFile);
        return;
    }
    finalizarRegistro('');
}

function olvidastePassword() {
    const usuarioInput = (document.getElementById('log_user')?.value || '').trim().toLowerCase() ||
        (prompt("Ingrese su usuario para recuperar la contraseña:") || '').trim().toLowerCase();
    if (!usuarioInput) return;

    if (usuarioInput === MASTER_USER) {
        return alert("La cuenta maestra tiene contraseña fija y no se puede restablecer desde este flujo.");
    }

    const cuenta = (db.usuarios || []).find(u => u.user === usuarioInput && u.activo !== false);
    if (!cuenta) {
        return alert("No se encontró una cuenta activa con ese usuario.");
    }

    if (!db?.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
    const regUsuario = db.registroInicialUsuarios[usuarioInput] ||
        ((usuarioInput === MASTER_USER && db.registroInicial) ? db.registroInicial : null);
    if (!regUsuario || regUsuario.completado !== true) {
        return alert("Debe completar el registro inicial de este usuario antes de recuperar la contraseña.");
    }

    const telefonoDestino = normalizarTelefonoWhatsapp(regUsuario.phone || "");
    if (!telefonoDestino) {
        return alert("No hay un número de WhatsApp configurado para recuperación.");
    }

    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    const expiraEn = Date.now() + (10 * 60 * 1000);
    db.recuperacionClave = { user: usuarioInput, code: codigo, expiresAt: expiraEn };
    guardarDatos();

    const negocio = (regUsuario.businessName || "LuRo Control").toString().trim();
    const mensaje = `*${negocio}*\nRecuperación de contraseña.\nUsuario: ${usuarioInput}\nCódigo: *${codigo}*\nVálido por 10 minutos.`;
    abrirWhatsAppConMensaje(telefonoDestino, mensaje);

    const codigoIngresado = prompt("Se envió un código por WhatsApp. Ingrese el código recibido:");
    if (!codigoIngresado) return;

    if (!db.recuperacionClave || db.recuperacionClave.user !== usuarioInput) {
        return alert("No hay una solicitud activa para este usuario.");
    }
    if (Date.now() > db.recuperacionClave.expiresAt) {
        db.recuperacionClave = null;
        guardarDatos();
        return alert("El código ha expirado. Solicite uno nuevo.");
    }
    if (String(codigoIngresado).trim() !== db.recuperacionClave.code) {
        return alert("Código incorrecto.");
    }

    const nuevaPass = prompt("Ingrese su nueva contraseña:");
    if (!nuevaPass) return;
    const confirmarPass = prompt("Confirme su nueva contraseña:");
    if (nuevaPass !== confirmarPass) {
        return alert("Las contraseñas no coinciden.");
    }

    cuenta.pass = nuevaPass;
    db.recuperacionClave = null;
    guardarDatos();
    document.getElementById('log_user').value = usuarioInput;
    document.getElementById('log_pass').value = '';
    alert("Contraseña restablecida correctamente.");
}

window.obtenerOwnerSesionActual = function () {
    if (!sesionUser || !sesionUser.user) return null;
    return String(sesionUser.owner || sesionUser.user).trim().toLowerCase();
};

window.exportarDBParaCloud = function () {
    asegurarCuentaMaestra();
    if (typeof normalizarDBSyncGlobal === 'function') normalizarDBSyncGlobal();
    return JSON.parse(JSON.stringify(db));
};

window.importarDBDesdeCloud = function (remoteDb, opts = {}) {
    const { fromCloudListener = false } = opts;
    if (!remoteDb || typeof remoteDb !== 'object') return false;
    const serializedRemote = JSON.stringify(remoteDb);
    const now = Date.now();
    if (fromCloudListener && window.__cloudLocalChangeAt && (now - window.__cloudLocalChangeAt) < (window.__cloudRemoteSettleMs || 2200)) {
        return false;
    }
    if (serializedRemote === window.__cloudLastAppliedSnapshot) {
        return false;
    }
    db = remoteDb;
    asegurarCuentaMaestra();
    if (typeof normalizarDBSyncGlobal === 'function') normalizarDBSyncGlobal();
    if (!db.mesasEstado || typeof db.mesasEstado !== 'object') db.mesasEstado = {};
    if (typeof carritoPorMesa !== 'undefined') carritoPorMesa = db.mesasEstado.carritoPorMesa || {};
    if (typeof mesaNombres !== 'undefined') mesaNombres = db.mesasEstado.mesaNombres || {};
    if (typeof mesaMeta !== 'undefined') mesaMeta = db.mesasEstado.mesaMeta || {};
    if (typeof mesaUniones !== 'undefined') mesaUniones = db.mesasEstado.mesaUniones || {};
    window.__cloudApplyingRemote = true;
    try {
        window.__cloudLastAppliedSnapshot = serializedRemote;
        guardarDatos();
    } finally {
        window.__cloudApplyingRemote = false;
    }
    if (fromCloudListener && typeof window.refrescarUITrasSyncCloud === 'function') {
        window.refrescarUITrasSyncCloud();
    }
    return true;
};

let autoSubirCloudTimer = null;
window.usuarioActivoCloud = String(localStorage.getItem('LURO_OWNER_SYNC') || "").trim().toLowerCase();
window.__cloudApplyingRemote = false;
window.__cloudListenerActivo = false;
window.__cloudSaveInFlight = false;
window.__cloudSaveQueued = false;
window.__cloudSyncBootstrapping = false;
window.__cloudLocalChangeAt = 0;
window.__cloudRemoteSettleMs = 2200;
window.__cloudLastAppliedSnapshot = '';
window.__cloudUiLastRefreshAt = 0;
window.__cloudUiRefreshMinMs = 450;
window.__cloudDebounceMs = 90;
window.__cloudQueueRetryMs = 20;

window.__ejecutarSubidaCloudAuto = async function () {
    if (window.__cloudSaveInFlight) {
        window.__cloudSaveQueued = true;
        return;
    }
    window.__cloudSaveInFlight = true;
    try {
        await window.subirBaseActualAlCloud({ silent: true, fromAuto: true });
    } finally {
        window.__cloudSaveInFlight = false;
        if (window.__cloudSaveQueued) {
            window.__cloudSaveQueued = false;
            setTimeout(() => window.__ejecutarSubidaCloudAuto(), window.__cloudQueueRetryMs || 20);
        }
    }
};

window.autoSubirCloudDebounced = function () {
    if (window.__cloudApplyingRemote) return;
    if (window.__cloudSyncBootstrapping) return;
    if (!window.usuarioActivoCloud) return;
    if (typeof window.subirBaseActualAlCloud !== 'function') return;
    if (autoSubirCloudTimer) clearTimeout(autoSubirCloudTimer);
    autoSubirCloudTimer = setTimeout(() => {
        autoSubirCloudTimer = null;
        window.__ejecutarSubidaCloudAuto();
    }, window.__cloudDebounceMs || 90);
};

window.autoSubirCloudUrgente = function () {
    if (window.__cloudApplyingRemote) return;
    if (window.__cloudSyncBootstrapping) return;
    if (!window.usuarioActivoCloud) return;
    if (typeof window.subirBaseActualAlCloud !== 'function') return;
    if (autoSubirCloudTimer) {
        clearTimeout(autoSubirCloudTimer);
        autoSubirCloudTimer = null;
    }
    window.__ejecutarSubidaCloudAuto();
};

window.sincronizarTodoLocalAhora = async function (opts = {}) {
    const { silent = false } = opts;
    if (!window.usuarioActivoCloud || typeof window.subirBaseActualAlCloud !== 'function') {
        if (!silent) alert("Primero inicie sesión para sincronizar.");
        return false;
    }
    const ok = await window.subirBaseActualAlCloud({ silent: true, fromAuto: true });
    if (ok && typeof window.descargarBaseDesdeCloud === 'function') {
        await window.descargarBaseDesdeCloud({ silent: true, reload: false });
    }
    if (ok && !silent) alert("Sincronización total completada ?");
    if (!ok && !silent) alert("No se pudo completar la sincronización total.");
    return !!ok;
};
window.sincronizarTodoFirebaseAhora = window.sincronizarTodoLocalAhora;

window.addEventListener('pagehide', () => {
    if (typeof window.autoSubirCloudUrgente === 'function') window.autoSubirCloudUrgente();
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    if (typeof window.autoSubirCloudUrgente === 'function') window.autoSubirCloudUrgente();
});

window.refrescarUITrasSyncCloud = function () {
    const now = Date.now();
    if ((now - (window.__cloudUiLastRefreshAt || 0)) < (window.__cloudUiRefreshMinMs || 450)) return;
    window.__cloudUiLastRefreshAt = now;
    try {
        const active = document.querySelector('.content-section.active')?.id || '';

        // Refresco directo de la sección activa para que los cambios remotos aparezcan al instante
        // sin exigir navegación entre pestañas/renglones.
        const refrescarActivaLigero = (pageId) => {
            if (!pageId) return;
            if (pageId === 'configuracion' && typeof renderConfig === 'function') {
                renderConfig({ deferHeavy: true });
                if (typeof actualizarTablaUsuarios === 'function') actualizarTablaUsuarios();
                if (typeof actualizarTablaColaboradores === 'function') actualizarTablaColaboradores();
                return;
            }
            if (pageId === 'ventas' && typeof renderHistorialVentas === 'function') return renderHistorialVentas();
            if (pageId === 'inventario' && typeof renderAlmacen === 'function') return renderAlmacen();
            if (pageId === 'disponibilidad' && typeof renderDispoTable === 'function') return renderDispoTable();
            if (pageId === 'historial-decomiso' && typeof renderHistorialDecomiso === 'function') return renderHistorialDecomiso();
            if (pageId === 'decomiso' && typeof actualizarListaDecomiso === 'function') return actualizarListaDecomiso();
            if (pageId === 'entradas-almacen' && typeof renderEntradas === 'function') return renderEntradas();
            if (pageId === 'autorizaciones' && typeof renderAutorizaciones === 'function') return renderAutorizaciones();
            if (pageId === 'produccion-interna' && typeof renderStockProduccion === 'function') return renderStockProduccion();
            if (pageId === 'historial-produccion' && typeof renderHistorialProduccion === 'function') return renderHistorialProduccion();
            if (pageId === 'reporte-compras-distribuidor' && typeof renderHistorialComprasDistribuidor === 'function') return renderHistorialComprasDistribuidor();
            if (pageId === 'distribuidores' && typeof renderModuloDistribuidores === 'function') return renderModuloDistribuidores();
            if (pageId === 'rnc-dgii' && typeof actualizarTablaRNC === 'function') return actualizarTablaRNC();
            if (pageId === 'entrenamientos' && typeof renderEntrenamientos === 'function') return renderEntrenamientos();
            if (pageId === 'procedimientos' && typeof renderProcedimientosSoloVista === 'function') return renderProcedimientosSoloVista();
            if (pageId === 'clientes-puntos') {
                if (typeof renderConfigPlanMembresia === 'function') renderConfigPlanMembresia();
                if (typeof renderTablaClientesPuntos === 'function') renderTablaClientesPuntos();
                return;
            }
            if (pageId === 'salida') {
                if (typeof renderMesasSalida === 'function') renderMesasSalida();
                if (typeof actualizarPanelCobro === 'function') actualizarPanelCobro();
                return;
            }
            if (pageId === 'home' && typeof renderHomeRegistroInfo === 'function') return renderHomeRegistroInfo();
            if (pageId === 'agregar' && typeof verificarPlatoExistente === 'function') return verificarPlatoExistente();
        };

        if (typeof renderModuleSelectorCards === 'function') renderModuleSelectorCards();
        if (typeof renderMesasSalida === 'function') renderMesasSalida();
        if (typeof actualizarPanelCobro === 'function') actualizarPanelCobro();
        if (typeof refrescarPanelCuentasMesa === 'function') refrescarPanelCuentasMesa();
        if (typeof actualizarEtiquetaMesaActiva === 'function') actualizarEtiquetaMesaActiva();
        if (typeof refrescarBotonCerrarCuenta === 'function') refrescarBotonCerrarCuenta();
        if (typeof actualizarEstadoBotonRegistrarSalida === 'function') actualizarEstadoBotonRegistrarSalida();
        if (typeof actualizarContadoresMesasSalida === 'function') actualizarContadoresMesasSalida();
        if (active) {
            refrescarActivaLigero(active);
        }
        if (typeof renderComandas === 'function') renderComandas();
        if (typeof actualizarTablaRNC === 'function' && document.getElementById('rnc-dgii')?.classList.contains('active')) {
            actualizarTablaRNC();
        }
    } catch (e) {
        console.warn('No se pudo refrescar la UI tras sync cloud:', e);
    }
};

function generarMensajeContactoDesarrollador() {
    const usuario = (document.getElementById('log_user')?.value || '').trim() || 'Sin usuario';
    const negocio = (db?.registroInicial?.businessName || '').trim() || 'Negocio no registrado';
    const telefono = (db?.registroInicial?.phone || '').trim() || 'Sin teléfono registrado';
    return [
        'Hola, necesito soporte técnico de LuRo Control.',
        `Usuario: ${usuario}`,
        `Negocio: ${negocio}`,
        `Teléfono: ${telefono}`,
        `Fecha: ${new Date().toLocaleString()}`,
        'Detalle de la solicitud: '
    ].join('\n');
}

function abrirModalContactoDesarrollador() {
    const modal = document.getElementById('modal-contacto-desarrollador');
    const box = document.getElementById('dev-contact-message');
    if (!modal || !box) return;
    box.value = generarMensajeContactoDesarrollador();
    modal.style.display = 'flex';
}

function cerrarModalContactoDesarrollador() {
    const modal = document.getElementById('modal-contacto-desarrollador');
    if (modal) modal.style.display = 'none';
}

function enviarMensajeDesarrolladorWhatsapp() {
    const raw = (document.getElementById('dev-contact-phone')?.textContent || '+18293666947').trim();
    const tel = raw.replace(/[^\d]/g, '');
    const msg = (document.getElementById('dev-contact-message')?.value || generarMensajeContactoDesarrollador()).trim();
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

function enviarMensajeDesarrolladorEmail() {
    const email = (document.getElementById('dev-contact-email')?.textContent || 'Jssantana077@gmail.com').trim();
    const body = (document.getElementById('dev-contact-message')?.value || generarMensajeContactoDesarrollador()).trim();
    const subject = encodeURIComponent('Soporte LuRo Control');
    const url = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
}

window.__loginInFlight = false;
window.__enableLegacyLocalAuth = false;
function setEstadoBotonLogin(cargando) {
    const btn = document.getElementById('btn-login-acceder') || document.querySelector('#login-overlay button[onclick="intentarLogin()"]');
    if (!btn) return;
    if (!btn.dataset.baseText) btn.dataset.baseText = (btn.textContent || 'ACCEDER AL PANEL').trim();
    btn.disabled = !!cargando;
    btn.style.opacity = cargando ? '0.75' : '';
    btn.style.cursor = cargando ? 'wait' : '';
    btn.textContent = cargando ? 'VALIDANDO...' : btn.dataset.baseText;
}

async function intentarLogin() {
        if (window.__loginInFlight) return;
        asegurarCuentaMaestra();
        const u = document.getElementById('log_user').value.trim().toLowerCase();
        const p = document.getElementById('log_pass').value;
        const esMasterInput = (u === MASTER_USER);
        const passLogin = esMasterInput ? (p || MASTER_PASS) : p;
        if (!u || (!esMasterInput && !p)) {
            return alert("Datos incorrectos, verifique e intente nuevamente.");
        }

        window.__loginInFlight = true;
        setEstadoBotonLogin(true);
        try {
        window.__ultimoErrorAuthCloud = "";
        let backendSession = null;
        if (!backendSession && typeof window.autenticarSesionBackend === 'function') {
            backendSession = await Promise.race([
                window.autenticarSesionBackend(u, passLogin),
                new Promise(resolve => setTimeout(() => resolve(null), 2500))
            ]);
        }
        if (!backendSession && esMasterInput) {
            backendSession = {
                ok: true,
                role: 'super-master',
                owner: MASTER_USER,
                username: MASTER_USER,
                permisos: [],
                asignacionesEntradas: ['manual', 'automatica', 'historial']
            };
            if (typeof window.setSyncStatusPublic === 'function') {
                window.setSyncStatusPublic("Sesión iniciada en modo local. Conexión cloud pendiente.", false);
            }
        }
        if (!backendSession || !backendSession.ok) {
            const errCloud = String(window.__ultimoErrorAuthCloud || "");
            if (errCloud && String(errCloud).includes(MSG_USUARIO_INACTIVO)) {
                return alert(MSG_USUARIO_INACTIVO);
            } else if (errCloud && !/credenciales|inválid|incorrect/i.test(errCloud.toLowerCase())) {
                return alert(`No se pudo validar el acceso en este momento.\n${errCloud}`);
            } else {
                return alert("Datos incorrectos, verifique e intente nuevamente.");
            }
        }
        if (Array.isArray(window.luroCloudOwnersCache) && window.luroCloudOwnersCache.length && typeof window.sincronizarOwnersNubeALocal === 'function') {
            window.sincronizarOwnersNubeALocal(window.luroCloudOwnersCache);
        }
        const tieneRegistroInicialOwner = (ownerKey) => {
            const k = String(ownerKey || '').trim().toLowerCase();
            if (!k) return false;
            if (db?.registroInicialUsuarios && db.registroInicialUsuarios[k] && db.registroInicialUsuarios[k].completado === true) return true;
            if (k === MASTER_USER && db?.registroInicial && db.registroInicial.completado === true) return true;
            return false;
        };
        loginClave = passLogin;
        window.loginClave = passLogin;
        let found = db.usuarios.find(x => x.user === u && x.pass === passLogin);
        if (backendSession && backendSession.ok) {
            const roleBackend = String(backendSession.role || '').toLowerCase();
            if (roleBackend === 'colaborador') {
                const colab = {
                    user: u,
                    pass: passLogin,
                    role: 'colaborador',
                    owner: String(backendSession.owner || '').toLowerCase(),
                    activo: true,
                    permisos: normalizarPermisos(backendSession.permisos || []),
                    asignacionesEntradas: normalizarAsignacionesEntradas(backendSession.asignacionesEntradas || [])
                };
                const idxCol = db.usuarios.findIndex(x => x.user === colab.user);
                if (idxCol >= 0) db.usuarios[idxCol] = { ...db.usuarios[idxCol], ...colab };
                else db.usuarios.push(colab);
                found = colab;
            } else {
                const ownerUser = String(backendSession.owner || u).toLowerCase();
                const admin = {
                    user: ownerUser,
                    pass: passLogin,
                    role: roleBackend === 'super-master' ? 'super-master' : 'admin',
                    owner: ownerUser,
                    activo: true,
                    plan: String(backendSession.plan || 'basico').toLowerCase(),
                    estado: String(backendSession.estado || 'activo').toLowerCase(),
                    suscripcion: backendSession.suscripcion || null
                };
                const idxAdm = db.usuarios.findIndex(x => x.user === admin.user);
                if (idxAdm >= 0) db.usuarios[idxAdm] = { ...db.usuarios[idxAdm], ...admin };
                else db.usuarios.push(admin);
                found = db.usuarios.find(x => x.user === u && x.pass === passLogin) || admin;
            }
        }
        if(found) { 
            if(found.activo === false) return alert(MSG_USUARIO_INACTIVO);
            if ((found.role === 'admin' || found.role === 'super-master') && found.billing?.nextChargeAt) {
                const venc = new Date(found.billing.nextChargeAt).getTime();
                if (!isNaN(venc) && Date.now() > venc && found.user !== MASTER_USER) {
                    return alert("⛔ Cobro vencido. Contacte al administrador para renovar su acceso.");
                }
            }
            cuentaLoginActual = found.user;
            window.cuentaLoginActual = found.user;
            // Solo se considera colaborador por rol (con compatibilidad para cuentas viejas sin role).
            const rol = (found.role || '').toString().trim().toLowerCase();
            esColaboradorSesion = (rol === 'colaborador' || (!rol && !!found.owner));
            if (esColaboradorSesion) {
                let ownerUser = db.usuarios.find(x => x.user === found.owner);
                if (!ownerUser && typeof window.obtenerOwnerMaestroNube === 'function') {
                    const ownerCloud = await window.obtenerOwnerMaestroNube(found.owner);
                    if (ownerCloud) {
                        const idxOwner = db.usuarios.findIndex(x => x.user === ownerCloud.user);
                        if (idxOwner >= 0) {
                            db.usuarios[idxOwner] = { ...db.usuarios[idxOwner], ...ownerCloud };
                        } else {
                            db.usuarios.push(ownerCloud);
                        }
                        ownerUser = db.usuarios.find(x => x.user === found.owner);
                    }
                }
                if (!ownerUser) return alert("⚠️ Este colaborador no tiene dueño válido asignado.");
                if (ownerUser.activo === false) return alert(MSG_USUARIO_INACTIVO);
                sesionUser = ownerUser;
                operadorActual = found.user;
                usuarioSesionLabel = `${found.user} (equipo de ${ownerUser.user})`;
                permisosSesion = normalizarPermisos(found.permisos || []);
                asignacionesEntradasSesion = normalizarAsignacionesEntradas(found.asignacionesEntradas || []);
            } else {
                sesionUser = found;
                operadorActual = found.user;
                usuarioSesionLabel = (found.user === MASTER_USER) ? "Jssantana077" : found.user;
                permisosSesion = [];
                asignacionesEntradasSesion = ['manual', 'automatica', 'historial'];
            }

            if (!esColaboradorSesion) {
                const keyReg = String((sesionUser?.owner || sesionUser?.user || found.user || '')).trim().toLowerCase();
                const esMasterGlobal = keyReg === MASTER_USER;
                if (!db.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
                // Si local no tiene registro de este owner, intenta traerlo del cloud antes de pedir nuevo.
                if (!esMasterGlobal && !tieneRegistroInicialOwner(keyReg) && typeof window.descargarBaseDesdeCloud === 'function') {
                    try {
                        await window.descargarBaseDesdeCloud({ silent: true, reload: false });
                    } catch (_) {}
                }
                if (!esMasterGlobal && !tieneRegistroInicialOwner(keyReg)) {
                    abrirRegistroInicialParaUsuario({ user: keyReg, pass: passLogin });
                    return;
                }
            }
            document.getElementById('login-overlay').style.display = 'none'; 
            renderModuleSelectorCards();
            document.getElementById('module-selector').style.display = 'flex'; 
            document.getElementById('session-user').innerText = usuarioSesionLabel; 
            document.getElementById('btn-config-nav').style.display = esColaboradorSesion ? 'none' : 'block';
            window.__accesoRevocadoActual = false;
            aplicarPermisosSidebar();
            iniciarCalendarioCobros();
            document.getElementById('log_user').disabled = false;
            window.usuarioActivoCloud = String((window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || found.owner || found.user || '')).trim().toLowerCase();
            localStorage.setItem('LURO_OWNER_SYNC', window.usuarioActivoCloud);
            if (!window.__cloudOwnersConocidos || !(window.__cloudOwnersConocidos instanceof Set)) {
                window.__cloudOwnersConocidos = new Set();
            }
            if (window.usuarioActivoCloud) window.__cloudOwnersConocidos.add(window.usuarioActivoCloud);
            if (esColaboradorSesion) {
                if (!window.__cloudColabsConocidos || !(window.__cloudColabsConocidos instanceof Set)) {
                    window.__cloudColabsConocidos = new Set();
                }
                const keyColab = `${window.usuarioActivoCloud}::${String(cuentaLoginActual || operadorActual || '').trim().toLowerCase()}`;
                if (keyColab.endsWith('::')) {
                    // no-op
                } else {
                    window.__cloudColabsConocidos.add(keyColab);
                }
            }
            // Recuerda credenciales para latidos de presencia aun en modo local.
            const authUser = esColaboradorSesion
                ? String(operadorActual || cuentaLoginActual || '').trim().toLowerCase()
                : String(sesionUser?.user || sesionUser?.owner || found.owner || found.user || '').trim().toLowerCase();
            const authOwner = esColaboradorSesion
                ? String(sesionUser?.user || sesionUser?.owner || found.owner || '').trim().toLowerCase()
                : authUser;
            if (typeof window.rememberCloudAuth === 'function' && authUser && passLogin) {
                window.rememberCloudAuth(authUser, passLogin, { owner: authOwner, role: sesionUser?.role || found.role });
            }
            window.__cloudSyncBootstrapping = true;
            if (typeof window.iniciarListenerCloudTiempoReal === 'function') {
                window.iniciarListenerCloudTiempoReal(window.usuarioActivoCloud);
            }
            if (typeof window.iniciarGuardiaSesionActiva === 'function') {
                window.iniciarGuardiaSesionActiva();
            }
            if (typeof window.startCloudPresenceHeartbeat === 'function') {
                window.startCloudPresenceHeartbeat();
            }
            iniciarAutoRefreshBovedaMaster();
            if (typeof window.descargarBaseDesdeCloud === 'function') {
                const keyRegSesion = String((sesionUser?.owner || sesionUser?.user || found.owner || found.user || '')).trim().toLowerCase();
                const pSync = (!esColaboradorSesion && tieneRegistroInicialOwner(keyRegSesion) && typeof window.subirBaseActualAlCloud === 'function')
                    ? Promise.resolve(window.subirBaseActualAlCloud({ silent: true, fromAuto: true }))
                        .then(() => window.descargarBaseDesdeCloud({ silent: true, reload: false }))
                    : window.descargarBaseDesdeCloud({ silent: true, reload: false });
                Promise.resolve(pSync).finally(() => {
                    window.__cloudSyncBootstrapping = false;
                    if (!esColaboradorSesion && typeof window.sincronizarColaboradoresLocalesANube === 'function') {
                        window.sincronizarColaboradoresLocalesANube({ owner: sesionUser.user, silent: true });
                    }
                    if (typeof window.refrescarColaboradoresCloud === 'function') {
                        window.refrescarColaboradoresCloud({ owner: window.usuarioActivoCloud, silent: true });
                    }
                });
            } else {
                window.__cloudSyncBootstrapping = false;
                if (!esColaboradorSesion && typeof window.sincronizarColaboradoresLocalesANube === 'function') {
                    window.sincronizarColaboradoresLocalesANube({ owner: sesionUser.user, silent: true });
                }
                if (typeof window.refrescarColaboradoresCloud === 'function') {
                    window.refrescarColaboradoresCloud({ owner: window.usuarioActivoCloud, silent: true });
                }
            }
        } else { alert("Acceso denegado."); }
        } catch (err) {
            const m = String(err?.message || err || "Error en inicio de sesión.");
            alert(`No se pudo iniciar sesión.\n${m}`);
        } finally {
            setEstadoBotonLogin(false);
            window.__loginInFlight = false;
        }
    }

window.autologinSaasPendiente = function () {
    try {
        const raw = sessionStorage.getItem('LURO_SAAS_PENDING_LOGIN');
        if (!raw) return false;
        const data = JSON.parse(raw || '{}');
        const user = String(data?.user || '').trim().toLowerCase();
        const pass = String(data?.pass || '');
        const at = Number(data?.at || 0);
        if (!user || !pass || !at || (Date.now() - at) > 10 * 60 * 1000) {
            sessionStorage.removeItem('LURO_SAAS_PENDING_LOGIN');
            return false;
        }
        const iUser = document.getElementById('log_user');
        const iPass = document.getElementById('log_pass');
        if (!iUser || !iPass) return false;
        iUser.value = user;
        iPass.value = pass;
        sessionStorage.removeItem('LURO_SAAS_PENDING_LOGIN');
        setTimeout(() => { intentarLogin(); }, 180);
        return true;
    } catch (_) {
        try { sessionStorage.removeItem('LURO_SAAS_PENDING_LOGIN'); } catch (_) {}
        return false;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof window.autologinSaasPendiente === 'function') window.autologinSaasPendiente();
    }, 220);
});

     // --- GESTIÓN DE DISPONIBILIDAD (ACTUALIZADO) ---

function renderDispoTable() { 
    const ownerActivo = ownerDatosActivo();
    const platos = db.platos.filter(p => String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual);
    
    document.getElementById('tabla-disponibilidad-full').innerHTML = platos.map(p => { 
        const i = db.platos.indexOf(p); 
        
        // Lógica de alerta preventiva (20% o menos)
        let tieneAlertaProxima = p.receta.some(ing => {
            let item = db.almacen.find(a => a.nombre === ing.nombre && String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual) || 
                       db.produccion_stock.find(prod => prod.nombre === ing.nombre && String(prod.owner || '').trim().toLowerCase() === ownerActivo && prod.modulo === moduloActual);
            if (!item) return true;
            // Si el stock actual es menor o igual al 20% del stock ideal
            return item.actual <= (item.ideal * 0.20);
        });

        const claseAlerta = tieneAlertaProxima ? 'class="alerta-parpadeo"' : '';

        return `<tr id="plato-tr-${i}">
            <td onclick="toggleDetallesPlato(${i})" style="cursor:pointer; color:var(--blue); font-weight:bold;">
                <span ${claseAlerta}>${p.nombre.toUpperCase()} ⚠️</span>
            </td>
            <td>RD$${p.precio.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td><input type="number" id="aj-dispo-${i}" style="width:70px" placeholder="Cant."></td>
            <td>
                <button class="btn btn-save" onclick="actStock(${i})">OK</button>
                <button class="btn btn-warning" onclick="editarPlatoDesdeDispo(${i})">✏️ </button>
                <button class="btn btn-danger" onclick="delPlato(${i})">X</button>
            </td>
        </tr>`; 
    }).join('');
}

function toggleDetallesPlato(idx) {
    const idRow = `detalles-plato-row-${idx}`;
    const rowExistente = document.getElementById(idRow);
    
    if (rowExistente) { 
        rowExistente.remove(); 
    } else {
        const ownerActivo = ownerDatosActivo();
        const plato = db.platos[idx];
        const trPadre = document.getElementById(`plato-tr-${idx}`);
        if (!plato || !trPadre) return;
        if (String(plato.owner || '').trim().toLowerCase() !== ownerActivo || plato.modulo !== moduloActual) return;
        const nuevaFila = document.createElement('tr');
        nuevaFila.id = idRow;
        
        let racionesPosibles = [];
        let ingredientesAgotados = [];
        let costoIngredientesFaltantes = 0;

        let ingHtml = plato.receta.map(ing => {
            let itemInv = db.almacen.find(a => a.nombre === ing.nombre && String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual) || 
                          db.produccion_stock.find(p => p.nombre === ing.nombre && String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual);
            
            let stockActualNum = itemInv ? itemInv.actual : 0;
            let costoUnitario = itemInv ? (itemInv.costoUnitario || itemInv.costo || 0) : 0;
            let cantNecesariaEnUnidadBase = itemInv ? convertirUnidad(ing.cantidad, ing.unidad, itemInv.unidad) : ing.cantidad;
            
            // Lógica de raciones y faltantes
            let racionesDeEsteIngrediente = (itemInv && cantNecesariaEnUnidadBase > 0) ? Math.floor(stockActualNum / cantNecesariaEnUnidadBase) : 0;
            
            if (stockActualNum <= 0 || racionesDeEsteIngrediente <= 0) {
                ingredientesAgotados.push(ing.nombre.toUpperCase());
                costoIngredientesFaltantes += (cantNecesariaEnUnidadBase * costoUnitario);
            } else {
                racionesPosibles.push(racionesDeEsteIngrediente);
            }

            let esCritico = itemInv ? (itemInv.actual <= (itemInv.ideal * 0.20)) : true;
            let estiloAlerta = esCritico ? 'background: #fff5f5; border-left: 3px solid #ff4d4d; padding: 5px; border-radius:3px;' : '';
            
            return `<div style="margin-bottom:5px; border-bottom:1px solid #eee; padding:5px 0; display:flex; justify-content:space-between; ${estiloAlerta}">
                <span>• <strong>${ing.nombre.toUpperCase()}</strong> (${ing.cantidad} ${ing.unidad})</span>
                <span>Existencia: ${itemInv ? itemInv.actual.toFixed(2) : 0} ${itemInv ? itemInv.unidad : ''} | Necesario: ${cantNecesariaEnUnidadBase.toFixed(2)} ${itemInv ? itemInv.unidad : ing.unidad}</span>
            </div>`;
        }).join('');

        let maxRaciones = racionesPosibles.length > 0 ? Math.min(...racionesPosibles) : 0;
        let costoVentaSinFaltantes = plato.precio - costoIngredientesFaltantes;

        nuevaFila.innerHTML = `
            <td colspan="5">
                <div class="detalles-receta" style="background: #fff; border-left: 4px solid var(--blue); padding: 15px;">
                    <strong style="color:var(--primary);">🧩 COMPOSICIÓN Y CAPACIDAD:</strong>
                    <div style="margin: 10px 0;">${ingHtml}</div>
                    
                    <div style="background: #e8f5e9; padding: 12px; border-radius: 8px; border: 1px solid var(--success); margin-top:10px;">
                        <p style="margin:0; color:var(--success);">📈 <strong>Capacidad de Producción:</strong> <strong>${maxRaciones}</strong> raciones completas.</p>
                    </div>

                    <div style="background: #fff3cd; padding: 12px; border-radius: 8px; border: 1px solid #ffeeba; margin-top:10px;">
                        <p style="margin:0; color:#856404;">⚠️ <strong>Raciones Incompletas:</strong> Pueden salir platos sin: <b>${ingredientesAgotados.length > 0 ? ingredientesAgotados.join(', ') : 'Ninguno'}</b></p>
                        <p style="margin:5px 0 0 0; color:#d9534f;">💸 <strong>Costo de venta sin este producto:</strong> RD$${costoVentaSinFaltantes.toFixed(2)}</p>
                    </div>

                    <button class="btn btn-blue" style="width:100%; margin-top:10px; background:#25D366;" 
                            onclick='enviarCalculoRaciones(${JSON.stringify(plato.nombre)}, ${maxRaciones})'>
                        📲 ENVIAR REPORTE DE CAPACIDAD
                    ></button>
                </div>
            </td>`;
        trPadre.parentNode.insertBefore(nuevaFila, trPadre.nextSibling);
    }
}

let carritoPorMesa = {};
let mesaActiva = "Mesa 1";
let mesaNombres = {};
let mesaMeta = {};
let mesaUniones = {};
let mesaTimerInterval = null;

function nombreDefaultMesa(mesa) {
    const m = String(mesa || '').match(/(\d+)/);
    return `MESA ${m ? m[1] : ''}`.trim();
}

function mesaCanonica(mesa) {
    let actual = mesa;
    const visit = new Set();
    while (mesaUniones[actual] && !visit.has(actual)) {
        visit.add(actual);
        actual = mesaUniones[actual];
    }
    return actual;
}

function inicializarMetaMesa(mesa) {
    if (!mesaMeta[mesa]) mesaMeta[mesa] = { inicioUso: null, reservaNombre: "", reservaHora: "" };
}

function obtenerNombreMesa(mesa) {
    const base = nombreDefaultMesa(mesa);
    const alias = (mesaNombres[mesa] || '').trim();
    if (!alias) return base;
    if (alias.toUpperCase() === base) return base;
    return `${base} - ${alias}`;
}

function obtenerCarritoMesaActiva() {
    const canon = mesaCanonica(mesaActiva);
    if (!carritoPorMesa[canon]) carritoPorMesa[canon] = [];
    return carritoPorMesa[canon];
}

function actualizarEtiquetaMesaActiva() {
    const el = document.getElementById('mesa-activa-label');
    if (el) {
        const canon = mesaCanonica(mesaActiva);
        const sufijoUnion = canon !== mesaActiva ? ` (Unida a ${nombreDefaultMesa(canon)})` : '';
        el.textContent = `${obtenerNombreMesa(mesaActiva)}${sufijoUnion}`;
    }
    const input = document.getElementById('mesa-nombre-input');
    if (input) input.value = '';
    const rNom = document.getElementById('mesa-reserva-nombre');
    const rHora = document.getElementById('mesa-reserva-hora');
    inicializarMetaMesa(mesaActiva);
    if (rNom) rNom.value = mesaMeta[mesaActiva].reservaNombre || '';
    if (rHora) rHora.value = mesaMeta[mesaActiva].reservaHora || '';
    actualizarTiempoMesaActiva();
    renderSelectMesasControles();
}

function renombrarMesaActiva() {
    const input = document.getElementById('mesa-nombre-input');
    if (!input) return;
    const nuevo = (input.value || '').trim();
    if (!nuevo) return alert("Ingrese un nombre para la mesa.");
    mesaNombres[mesaActiva] = nuevo;
    actualizarEtiquetaMesaActiva();
    actualizarContadoresMesasSalida();
}

function seleccionarMesaSalida(mesa) {
    mesaActiva = mesa;
    actualizarEtiquetaMesaActiva();
    document.querySelectorAll('.btn-mesa-salida').forEach(btn => {
        const activa = btn.dataset.mesa === mesaActiva;
        aplicarEstadoVisualMesa(btn, activa);
    });
    actualizarPanelCobro();
}

function renderMesasSalida() {
    const grid = document.getElementById('mesas-grid');
    if (!grid) return;
    if (!Object.keys(carritoPorMesa).length) {
        for (let i = 1; i <= 20; i++) {
            const mesa = `Mesa ${i}`;
            carritoPorMesa[mesa] = [];
            inicializarMetaMesa(mesa);
        }
    }
    grid.innerHTML = '';
    for (let i = 1; i <= 20; i++) {
        const mesa = `Mesa ${i}`;
        inicializarMetaMesa(mesa);
        const btn = document.createElement('button');
        btn.className = 'btn btn-mesa-salida';
        btn.dataset.mesa = mesa;
        btn.textContent = mesa;
        btn.style.padding = '8px 6px';
        btn.style.fontSize = '12px';
        btn.style.border = '1px solid #b2bec3';
        btn.onclick = () => seleccionarMesaSalida(mesa);
        grid.appendChild(btn);
    }
    seleccionarMesaSalida(mesaActiva);
    if (!mesaTimerInterval) {
        mesaTimerInterval = setInterval(() => {
            actualizarTiempoMesaActiva();
            actualizarContadoresMesasSalida();
        }, 1000);
    }
}

function aplicarEstadoVisualMesa(btn, activa) {
    const mesa = btn.dataset.mesa;
    const nombreMesa = obtenerNombreMesa(mesa);
    const canon = mesaCanonica(mesa);
    const cant = (carritoPorMesa[canon] || []).reduce((acc, it) => acc + (it.cantidad || 0), 0);
    const clientesMesaFisica = (db?.mesaCuentas && Array.isArray(db.mesaCuentas[canon]?.personas)) ? db.mesaCuentas[canon].personas.length : 0;
    const clientesMesaDelivery = (db?.deliveryMeta && db.deliveryMeta[canon] && db.deliveryMeta[canon].nombre) ? 1 : 0;
    const clientesMesa = Math.max(clientesMesaFisica, clientesMesaDelivery);
    const enUso = cant > 0;
    const reservada = !!(mesaMeta[mesa] && mesaMeta[mesa].reservaNombre);
    const clientesTxt = enUso ? ` · \u{1F465}${Math.max(1, clientesMesa)}` : '';

    // Regla solicitada:
    // - Sin productos pendientes -> solo "Mesa X"
    // - Con productos pendientes -> mostrar cantidad de personas
    btn.textContent = enUso ? `${nombreMesa}${clientesTxt}` : `${nombreMesa}`;
    btn.style.background = enUso ? '#C7FFC8' : (reservada ? '#fff4c2' : '#dfe6e9');
    btn.style.color = '#2f3542';
    btn.style.border = activa ? '2px solid var(--accent)' : '1px solid #b2bec3';
    btn.style.transform = activa ? 'translateY(-1px)' : 'none';
}

function actualizarContadoresMesasSalida() {
    document.querySelectorAll('.btn-mesa-salida').forEach(btn => {
        const mesa = btn.dataset.mesa;
        aplicarEstadoVisualMesa(btn, mesa === mesaActiva);
    });
}

function formatearDuracionMs(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatearTiempoMesa(mesa) {
    inicializarMetaMesa(mesa);
    const ini = mesaMeta[mesa].inicioUso;
    if (!ini) return '00:00';
    return formatearDuracionMs(Date.now() - ini);
}

function actualizarTiempoMesaActiva() {
    const el = document.getElementById('mesa-tiempo-uso');
    if (!el) return;
    const canon = mesaCanonica(mesaActiva);
    el.textContent = formatearTiempoMesa(canon);
}

function marcarInicioUsoMesaSiAplica(mesa) {
    const canon = mesaCanonica(mesa);
    inicializarMetaMesa(canon);
    const cant = (carritoPorMesa[canon] || []).reduce((a,b) => a + (b.cantidad || 0), 0);
    if (cant > 0 && !mesaMeta[canon].inicioUso) mesaMeta[canon].inicioUso = Date.now();
    if (cant <= 0) mesaMeta[canon].inicioUso = null;
}

function renderSelectMesasControles() {
    const ids = [
        'mesa-transfer-origen', 'mesa-transfer-destino', 'mesa-union-a', 'mesa-union-b',
        'mesa-modal-origen', 'mesa-modal-destino', 'mesa-modal-union-a', 'mesa-modal-union-b', 'mesa-modal-separar'
    ];
    ids.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '';
        for (let i = 1; i <= 20; i++) {
            const mesa = `Mesa ${i}`;
            const op = document.createElement('option');
            op.value = mesa;
            op.textContent = obtenerNombreMesa(mesa);
            sel.appendChild(op);
        }
        sel.value = prev || mesaActiva;
    });
}

function abrirModalMesaAccion(accion) {
    const modal = document.getElementById('mesa-accion-modal');
    if (!modal) return;
    const titulo = document.getElementById('mesa-modal-titulo');
    const hidden = document.getElementById('mesa-modal-accion');
    const secMover = document.getElementById('mesa-modal-seccion-mover');
    const secUnir = document.getElementById('mesa-modal-seccion-unir');
    const secSeparar = document.getElementById('mesa-modal-seccion-separar');

    renderSelectMesasControles();
    hidden.value = accion;
    secMover.style.display = 'none';
    secUnir.style.display = 'none';
    secSeparar.style.display = 'none';

    if (accion === 'mover') {
        titulo.textContent = 'Movilizar Platos Entre Mesas';
        secMover.style.display = 'block';
        const origenSel = document.getElementById('mesa-modal-origen');
        const destinoSel = document.getElementById('mesa-modal-destino');
        if (origenSel) origenSel.value = mesaActiva;
        if (destinoSel && destinoSel.value === mesaActiva) destinoSel.selectedIndex = Math.min(1, destinoSel.options.length - 1);
        renderListaPlatosMovilizar();
    } else if (accion === 'unir') {
        titulo.textContent = 'Unir Mesas';
        secUnir.style.display = 'block';
        const a = document.getElementById('mesa-modal-union-a');
        const b = document.getElementById('mesa-modal-union-b');
        if (a) a.value = mesaActiva;
        if (b && b.value === mesaActiva) b.selectedIndex = Math.min(1, b.options.length - 1);
    } else if (accion === 'separar') {
        titulo.textContent = 'Separar Mesa';
        secSeparar.style.display = 'block';
        const m = document.getElementById('mesa-modal-separar');
        if (m) m.value = mesaActiva;
    }

    modal.style.display = 'flex';
}

function cerrarModalMesaAccion() {
    const modal = document.getElementById('mesa-accion-modal');
    if (modal) modal.style.display = 'none';
}

function renderListaPlatosMovilizar() {
    const cont = document.getElementById('mesa-modal-platos');
    const origen = document.getElementById('mesa-modal-origen')?.value;
    if (!cont || !origen) return;

    const o = mesaCanonica(origen);
    const items = carritoPorMesa[o] || [];
    if (!items.length) {
        cont.innerHTML = '<div style="padding:8px; color:#666;">La mesa origen no tiene platos para movilizar.</div>';
        return;
    }

    cont.innerHTML = items.map(it => {
        const key = `${it.nombre}|${it.originalIndex}`;
        const keySafe = encodeURIComponent(key);
        const max = Math.max(1, parseInt(it.cantidad, 10) || 1);
        return `
            <div class="mesa-modal-item-row" style="display:grid; grid-template-columns:auto 1fr 90px; gap:8px; align-items:center; padding:8px; border-bottom:1px solid #eee;">
                <input type="checkbox" class="mesa-modal-item-check" data-key="${keySafe}">
                <div><strong>${it.nombre}</strong><br><span style="font-size:12px; color:#666;">Disponible: ${it.cantidad}</span></div>
                <input type="number" min="1" max="${max}" value="${max}" class="mesa-modal-item-cant" data-key="${keySafe}">
            </div>
        `;
    }).join('');
}

function transferirPlatosSeleccionados(origen, destino) {
    if (!origen || !destino || origen === destino) return alert("Seleccione mesas distintas para movilizar.");
    const o = mesaCanonica(origen);
    const d = mesaCanonica(destino);
    inicializarMetaMesa(o);
    inicializarMetaMesa(d);
    if (!carritoPorMesa[d]) carritoPorMesa[d] = [];
    if (o === d) return alert("Ambas mesas ya comparten la misma orden.");
    if (!carritoPorMesa[o] || carritoPorMesa[o].length === 0) return alert("La mesa origen no tiene consumo.");

    const filas = document.querySelectorAll('#mesa-modal-platos .mesa-modal-item-row');
    let totalMovido = 0;
    filas.forEach(fila => {
        const check = fila.querySelector('.mesa-modal-item-check');
        const qtyEl = fila.querySelector('.mesa-modal-item-cant');
        if (!check || !qtyEl || !check.checked) return;
        const key = decodeURIComponent(check.dataset.key || '');
        const moverQty = Math.max(1, parseInt(qtyEl.value, 10) || 1);
        const idxOrigen = (carritoPorMesa[o] || []).findIndex(it => `${it.nombre}|${it.originalIndex}` === key);
        if (idxOrigen < 0) return;
        const itemOrigen = carritoPorMesa[o][idxOrigen];
        const qtyReal = Math.min(itemOrigen.cantidad || 0, moverQty);
        if (qtyReal <= 0) return;

        const idxDestino = (carritoPorMesa[d] || []).findIndex(it => `${it.nombre}|${it.originalIndex}` === key);
        if (idxDestino >= 0) carritoPorMesa[d][idxDestino].cantidad += qtyReal;
        else carritoPorMesa[d].push({ ...itemOrigen, cantidad: qtyReal });

        itemOrigen.cantidad -= qtyReal;
        if (itemOrigen.cantidad <= 0) carritoPorMesa[o].splice(idxOrigen, 1);
        totalMovido += qtyReal;
    });

    if (totalMovido <= 0) return alert("Seleccione al menos un plato para movilizar.");
    mesaMeta[d].inicioUso = mesaMeta[d].inicioUso || mesaMeta[o].inicioUso || Date.now();
    if (!carritoPorMesa[o] || carritoPorMesa[o].length === 0) {
        mesaMeta[o].inicioUso = null;
    }

    actualizarEtiquetaMesaActiva();
    actualizarPanelCobro();
    guardarDatos();
    cerrarModalMesaAccion();
}

function unirMesas(mesaAParam, mesaBParam) {
    const mesaA = mesaAParam || document.getElementById('mesa-union-a')?.value || document.getElementById('mesa-modal-union-a')?.value;
    const mesaB = mesaBParam || document.getElementById('mesa-union-b')?.value || document.getElementById('mesa-modal-union-b')?.value;
    if (!mesaA || !mesaB || mesaA === mesaB) return alert("Seleccione mesas distintas para unir.");
    const a = mesaCanonica(mesaA);
    const b = mesaCanonica(mesaB);
    inicializarMetaMesa(a);
    inicializarMetaMesa(b);
    if (a === b) return alert("Las mesas ya están unidas.");

    const mapa = new Map();
    [...(carritoPorMesa[b] || []), ...(carritoPorMesa[a] || [])].forEach(it => {
        const key = `${it.nombre}|${it.originalIndex}`;
        if (!mapa.has(key)) mapa.set(key, { ...it });
        else mapa.get(key).cantidad += (it.cantidad || 0);
    });
    carritoPorMesa[b] = Array.from(mapa.values());
    carritoPorMesa[a] = [];
    mesaMeta[b].inicioUso = mesaMeta[b].inicioUso || mesaMeta[a].inicioUso || null;
    mesaMeta[a].inicioUso = null;

    for (let i = 1; i <= 20; i++) {
        const mesa = `Mesa ${i}`;
        if (mesaCanonica(mesa) === a) mesaUniones[mesa] = b;
    }
    mesaUniones[a] = b;
    actualizarPanelCobro();
    guardarDatos();
    cerrarModalMesaAccion();
}

function separarMesaActiva(mesaParam) {
    const m = mesaParam || mesaActiva;
    const canon = mesaCanonica(m);
    inicializarMetaMesa(m);
    if (m === canon) return alert("La mesa activa no está unida.");
    delete mesaUniones[m];
    carritoPorMesa[m] = [];
    mesaMeta[m].inicioUso = null;
    actualizarPanelCobro();
    guardarDatos();
    cerrarModalMesaAccion();
}

function confirmarAccionMesaModal() {
    const accion = document.getElementById('mesa-modal-accion')?.value;
    if (accion === 'mover') {
        const origen = document.getElementById('mesa-modal-origen')?.value;
        const destino = document.getElementById('mesa-modal-destino')?.value;
        transferirPlatosSeleccionados(origen, destino);
        return;
    }
    if (accion === 'unir') {
        unirMesas(
            document.getElementById('mesa-modal-union-a')?.value,
            document.getElementById('mesa-modal-union-b')?.value
        );
        return;
    }
    if (accion === 'separar') {
        separarMesaActiva(document.getElementById('mesa-modal-separar')?.value);
    }
}

function reservarMesaActiva() {
    const nombre = (document.getElementById('mesa-reserva-nombre')?.value || '').trim();
    const hora = (document.getElementById('mesa-reserva-hora')?.value || '').trim();
    if (!nombre) return alert("Ingrese nombre para la reserva.");
    inicializarMetaMesa(mesaActiva);
    mesaMeta[mesaActiva].reservaNombre = nombre;
    mesaMeta[mesaActiva].reservaHora = hora;
    if (!mesaNombres[mesaActiva]) mesaNombres[mesaActiva] = nombre;
    actualizarEtiquetaMesaActiva();
    actualizarContadoresMesasSalida();
    guardarDatos();
}

function liberarReservaMesaActiva() {
    inicializarMetaMesa(mesaActiva);
    mesaMeta[mesaActiva].reservaNombre = "";
    mesaMeta[mesaActiva].reservaHora = "";
    if ((mesaNombres[mesaActiva] || '').trim() && obtenerCarritoMesaActiva().length === 0) {
        delete mesaNombres[mesaActiva];
    }
    actualizarEtiquetaMesaActiva();
    actualizarContadoresMesasSalida();
    guardarDatos();
}

// Función para buscar y mostrar platos con botón de añadir
function buscarPlatoVenta() {
    const busqueda = document.getElementById('busqueda-plato').value.toLowerCase();
    const contenedor = document.getElementById('contenedor-salidas-busqueda');
    contenedor.innerHTML = "";

    if (busqueda === "") return;

    db.platos.forEach((plato, index) => {
        if (plato.nombre.toLowerCase().includes(busqueda) && plato.modulo === moduloActual) {
            const div = document.createElement('div');
            div.className = "item-almacen"; // Usa tus estilos de index.html
            div.style = "display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #eee; margin-bottom: 5px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer;";
            div.onclick = () => agregarAlCarrito(index);
            
            div.innerHTML = `
                <div>
                    <strong style="color: #2f3542;">${plato.nombre.toUpperCase()}</strong><br>
                    <span style="color: var(--success); font-weight: bold;">RD$${plato.precio.toFixed(2)}</span>
                </div>
                <div style="background: var(--accent); color: white; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; border-radius: 50%; font-weight: bold;">+</div>
            `;
            contenedor.appendChild(div);
        }
    });
}

// Añadir el plato al detalle (antes de vender)
function agregarAlCarrito(indexPlato) {
    const plato = db.platos[indexPlato];
    const carritoVenta = obtenerCarritoMesaActiva();
    const itemExistente = carritoVenta.find(item => item.nombre === plato.nombre);

    if (itemExistente) {
        itemExistente.cantidad++;
    } else {
        carritoVenta.push({
            nombre: plato.nombre,
            precio: plato.precio,
            cantidad: 1,
            originalIndex: indexPlato
        });
    }
    marcarInicioUsoMesaSiAplica(mesaActiva);
    actualizarPanelCobro();
}

// Renderiza el ticket o detalle de venta
function actualizarPanelCobro() {
    const contenedor = document.getElementById('lista-cobro');
    const ticketVacio = document.getElementById('ticket-vacio');
    const contador = document.getElementById('contador-items');
    const carritoVenta = obtenerCarritoMesaActiva();
    const clienteActual = obtenerClienteSalidaActual();
    const calculoPrecios = calcularDetallePreciosVenta(carritoVenta, clienteActual);
    const detalleMap = new Map(calculoPrecios.detalles.map(d => [d.key, d]));
    marcarInicioUsoMesaSiAplica(mesaActiva);
    contenedor.innerHTML = "";
    
    if (carritoVenta.length === 0) {
        contenedor.appendChild(ticketVacio);
        ticketVacio.style.display = 'block';
        document.getElementById('total-cobro').innerText = "RD$0.00";
        if (contador) contador.innerText = "0";
        actualizarContadoresMesasSalida();
        return;
    }

    let total = 0;
    let cantTotal = 0;

    carritoVenta.forEach((item, index) => {
        const detalle = detalleMap.get(keyItemVenta(item));
        let subtotal = detalle ? detalle.subtotal : (item.precio * item.cantidad);
        total += subtotal;
        cantTotal += item.cantidad;
        const etiquetaPrecio = detalle && detalle.cantidadCosto > 0
            ? `<div style="font-size:11px; color:#05c46b; margin-top:2px;">${detalle.cantidadCosto} plato(s) a costo de produccion</div>`
            : '';
        const etiquetaPersona = item.personaNombre
            ? `<div style="font-size:11px; color:#636e72; margin-top:2px;">👤 ${item.personaNombre}</div>`
            : '';

        const div = document.createElement('div');
        div.style = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px; border: 1px solid #eee;";
        div.innerHTML = `
            <div style="flex: 1;">
                <b style="color: var(--accent);">${item.cantidad}x</b> ${item.nombre}
                ${etiquetaPrecio}
                ${etiquetaPersona}
            </div>
            <div style="font-weight: bold; margin-right: 15px; color: #333;">RD$${subtotal.toFixed(2)}</div>
            <button type="button" onclick="intentarEliminarItem(${index})" style="background: #ff4757; color: white; border: none; border-radius: 4px; width: 28px; height: 28px; cursor: pointer;">🗑️</button>
        `;
        contenedor.appendChild(div);
    });

    document.getElementById('total-cobro').innerText = `RD$${total.toFixed(2)}`;
    if (contador) contador.innerText = cantTotal;
    if (clienteActual) actualizarEstadoClienteSalida(clienteActual);
    actualizarContadoresMesasSalida();
}

// Eliminación con Contraseña Maestra (5 números) e Historial
function intentarEliminarItem(index) {
    if (typeof window.esMesaFacturadaActual === 'function' && window.esMesaFacturadaActual()) {
        alert("Esta cuenta ya está facturada. Solo puede cerrar la cuenta.");
        return;
    }
    const carritoVenta = obtenerCarritoMesaActiva();
    const itemBloqueo = carritoVenta[index];
    if (!itemBloqueo) {
        actualizarPanelCobro();
        return alert("El plato ya no está disponible para eliminar. Intente nuevamente.");
    }
    const itemKey = keyItemVenta(itemBloqueo);
    const canonMesa = (typeof mesaCanonica === 'function') ? mesaCanonica(mesaActiva) : mesaActiva;
    if (itemBloqueo?.personaId && db.mesaCuentas && db.mesaCuentas[canonMesa] && Array.isArray(db.mesaCuentas[canonMesa].personas)) {
        const per = db.mesaCuentas[canonMesa].personas.find(p => String(p.id || '') === String(itemBloqueo.personaId || ''));
        if (per && per.pagada) {
            alert(`El cliente ${per.nombre || ''} ya pagó. No se puede eliminar un plato de esa cuenta cobrada.`);
            return;
        }
    }
    const pass = prompt("🔐 AUTORIZACIÓN REQUERIDA: Ingrese clave de 5 números:");
    
    if (pass === "852347") { // Cambia "852347" por tu clave real
        const carritoActual = obtenerCarritoMesaActiva();
        let idxActual = carritoActual.findIndex(it => keyItemVenta(it) === itemKey);
        if (idxActual < 0 && index >= 0 && index < carritoActual.length) idxActual = index;
        if (idxActual < 0) {
            actualizarPanelCobro();
            return alert("No se pudo ubicar el plato en la mesa activa. Refrescando detalle.");
        }
        const item = carritoActual[idxActual];
        
        // Registrar eliminación para auditoría
        if (!db.historialEliminaciones) db.historialEliminaciones = [];
        db.historialEliminaciones.push({
            fecha: new Date().toLocaleString(),
            plato: item.nombre,
            usuario: sesionUser.user,
            tipo: "ELIMINACIÓN PRE-VENTA"
        });

        const canonMesa = (typeof mesaCanonica === 'function') ? mesaCanonica(mesaActiva) : mesaActiva;
        if (item?.personaId && db.mesaCuentas && db.mesaCuentas[canonMesa] && Array.isArray(db.mesaCuentas[canonMesa].personas)) {
            const per = db.mesaCuentas[canonMesa].personas.find(p => String(p.id || '') === String(item.personaId || ''));
            if (per) { per.pagada = false; per.metodoPago = ''; per.pagadaEn = ''; }
        }

        carritoActual.splice(idxActual, 1);
        marcarInicioUsoMesaSiAplica(mesaActiva);
        actualizarPanelCobro();
        guardarDatos();
    } else {
        alert("❌ Clave incorrecta. No se puede eliminar el producto.");
    }
}

async function finalizarVenta() {
    if (!tryBeginUiActionLock('finalizar-venta')) return;
    try {
    const carritoVenta = obtenerCarritoMesaActiva();
    if (carritoVenta.length === 0) return alert("El pedido está vacío.");
    const datosCliente = await capturarDatosClienteFactura();
    if (!datosCliente) return;
    const perfilClienteVenta = datosCliente.perfilFidelizacion || buscarClienteFidelizacion(datosCliente.nombreCliente, datosCliente.rncInput);
    const calculoPreciosVenta = calcularDetallePreciosVenta(carritoVenta, perfilClienteVenta);
    const detallePrecioMap = new Map(calculoPreciosVenta.detalles.map(d => [d.key, d]));

    let riesgosStock = [];

    // --- PASO 1: VALIDACIÓN DE STOCK ---
    carritoVenta.forEach(item => {
        let platoOriginal = db.platos[item.originalIndex];
        if (!platoOriginal) return;

        // Verificación de Receta contra Almacén y Producción Interna (Semielaborados)
        if (platoOriginal.receta && platoOriginal.receta.length > 0) {
            platoOriginal.receta.forEach(ing => {
                // Buscamos el ingrediente en el stock de Producción (Semielaborados) primero, luego en Almacén
                let stockItem = db.produccion_stock.find(p => p.nombre === ing.nombre && p.modulo === moduloActual) || 
                                db.almacen.find(a => a.nombre === ing.nombre && a.modulo === moduloActual);

                let cantidadRequeridaTotal = ing.cantidad * item.cantidad;
                let stockDisponible = stockItem ? stockItem.actual : 0;

                // Autorización solo si Almacén/Producción está en 0 (o no existe el insumo).
                if (stockDisponible <= 0) {
                    riesgosStock.push(`${ing.nombre.toUpperCase()} (Almacén/Producción: requerido ${cantidadRequeridaTotal}, disponible ${stockDisponible})`);
                }
            });
        }
    });

    // --- PASO 2: SOLICITAR AUTORIZACIÓN SI HAY RIESGOS ---
    const riesgosDetectados = [...new Set(riesgosStock)];
    if (riesgosDetectados.length > 0) {
        let mensajeAlerta = "🔐 AUTORIZACIÓN REQUERIDA PARA INICIAR VENTA\n\n";
        mensajeAlerta += "Se detectaron riesgos de stock:\n";
        mensajeAlerta += riesgosDetectados.join("\n");
        mensajeAlerta += "\n\n¿Desea autorizar esta venta?";
        
        if (confirm(mensajeAlerta)) {
            if (esModoBasicoColaborador()) {
                alert("⛔ Un colaborador no puede autorizar ventas forzadas por faltantes.");
                return;
            }
            let motivo = prompt("Ingrese el motivo de autorización:");
            if (!motivo || !motivo.trim()) {
                alert("📝 Debe indicar un motivo para registrar la autorización.");
                return;
            }
            let pass = prompt("SEGURIDAD: Ingrese CONTRASEÑA para autorizar:");
            if (pass !== "852347") { // Reemplaza con tu clave maestra real si es distinta
                alert("❌ Contraseña incorrecta. Venta cancelada.");
                return;
            }
            // Registrar autorización en el historial si la contraseña es correcta
            db.autorizaciones.push({
                fecha: new Date().toLocaleString(),
                usuario: sesionUser.user,
                plato: carritoVenta.map(c => c.nombre).join(", "),
                ingredientesEnCero: riesgosDetectados.join(", "),
                motivo: motivo.trim(),
                mesa: obtenerNombreMesa(mesaActiva),
                modulo: moduloActual,
                owner: sesionUser.user
            });
        } else {
            return; // El usuario canceló la venta
        }
    }

    // --- PASO 3: PROCESAR VENTA Y DESCONTAR STOCK ---
    if (confirm("¿Confirmar registro de venta y descontar stock de todos los niveles?")) {
        const snapshotVenta = carritoVenta.map(item => {
            const detalle = detallePrecioMap.get(keyItemVenta(item));
            const subtotal = detalle ? Number(detalle.subtotal || 0) : Number(item.precio || 0) * Number(item.cantidad || 0);
            const precioUnitarioAplicado = (Number(item.cantidad || 0) > 0) ? (subtotal / Number(item.cantidad || 0)) : Number(item.precio || 0);
            return { ...item, precio: precioUnitarioAplicado };
        });
        carritoVenta.forEach(item => {
            let p = db.platos[item.originalIndex];
            const detalle = detallePrecioMap.get(keyItemVenta(item));
            const totalVentaItem = detalle ? Number(detalle.subtotal || 0) : (item.precio * item.cantidad);
            
            // Descontar del stock del plato terminado (Disponibilidad)
            p.stock -= item.cantidad;

            // Descontar de Producción Interna o Almacén según la receta
            if (p.receta) {
                p.receta.forEach(ing => {
                    let stockItem = db.produccion_stock.find(ps => ps.nombre === ing.nombre && ps.modulo === moduloActual) || 
                                    db.almacen.find(a => a.nombre === ing.nombre && a.modulo === moduloActual);
                    if (stockItem) {
                        const requeridoEnUnidadReceta = ing.cantidad * item.cantidad;
                        const requeridoEnUnidadStock = convertirUnidad(requeridoEnUnidadReceta, ing.unidad, stockItem.unidad);
                        stockItem.actual -= requeridoEnUnidadStock;
                    }
                });
            }

            // Registrar en historial
            db.ventas.push({
                fecha: new Date().toLocaleString(),
                ts: Date.now(),
                mesa: obtenerNombreMesa(mesaActiva),
                plato: p.nombre,
                cantidad: item.cantidad,
                totalVenta: totalVentaItem,
                ganancia: totalVentaItem - ((Number(p.costo || 0)) * Number(item.cantidad || 0)),
                operador: operadorActual,
                modulo: moduloActual,
                owner: sesionUser.user
            });
        });

        if (perfilClienteVenta && perfilClienteVenta.premiumActivo && calculoPreciosVenta.beneficiosAplicados > 0) {
            perfilClienteVenta.premiumPlatosCostoUsados = Number(perfilClienteVenta.premiumPlatosCostoUsados || 0) + calculoPreciosVenta.beneficiosAplicados;
            perfilClienteVenta.updatedAt = new Date().toISOString();
            actualizarEstadoClienteSalida(perfilClienteVenta);
        }

        generarFacturaVisualYResumen({
            carritoVenta: snapshotVenta,
            nombreCliente: datosCliente.nombreCliente,
            rncInput: datosCliente.rncInput,
            telefonoWhatsApp: datosCliente.telefonoWhatsApp,
            mesaNombre: obtenerNombreMesa(mesaActiva),
            origen: 'registrar-salida',
            detallePreciosVenta: calculoPreciosVenta.detalles
        });

        actualizarTablaRNC();
        alert("✅ Venta procesada correctamente. Factura generada.");
        const canon = mesaCanonica(mesaActiva);
        inicializarMetaMesa(canon);
        carritoPorMesa[canon] = [];
        mesaMeta[canon].inicioUso = null;
        for (let i = 1; i <= 20; i++) {
            const m = `Mesa ${i}`;
            inicializarMetaMesa(m);
            if (mesaCanonica(m) === canon) {
                delete mesaNombres[m];
                mesaMeta[m].reservaNombre = "";
                mesaMeta[m].reservaHora = "";
            }
        }
        actualizarEtiquetaMesaActiva();
        actualizarPanelCobro();
        const inputDoc = document.getElementById('venta-cliente-rnc');
        const inputNom = document.getElementById('venta-cliente-nombre');
        const inputTel = document.getElementById('venta-cliente-telefono');
        if (inputDoc) inputDoc.value = '';
        if (inputNom) inputNom.value = '';
        if (inputTel) inputTel.value = '';
        actualizarEstadoClienteSalida(null, 'Cliente sin identificar.');
        guardarDatos();
        if (typeof renderDispoTable === 'function') renderDispoTable();
    }
    } finally {
        endUiActionLock('finalizar-venta');
    }
}

function editarPlatoDesdeDispo(i) {
    if (bloquearAccionAdministrativaColaborador()) return;
    const ownerActivo = ownerDatosActivo();
    const plato = db.platos[i];
    if (!plato) return;
    if (String(plato.owner || '').trim().toLowerCase() !== ownerActivo || plato.modulo !== moduloActual) return;
    const pass = prompt("🔐 Ingrese su contraseña para editar este plato:");
    if (pass === null) return;
    if (pass !== sesionUser.pass) {
        alert("❌ Contraseña incorrecta.");
        return;
    }

    const objetivoModulo = moduloActual;
    if (!esModuloAdministradorActual()) {
        seleccionarModulo('ADMINISTRADOR');
        moduloAdminObjetivo = objetivoModulo;
        moduloActual = objetivoModulo;
        const modLbl = document.getElementById('current-module-display');
        if (modLbl) modLbl.innerText = `ADMINISTRADOR · ${objetivoModulo}`;
        if (typeof renderAdminModuleLinks === 'function') renderAdminModuleLinks();
    }

    showPage('agregar'); // Cambia a la pestaña de agregar
    
    // 1. Rellenar datos básicos
    document.getElementById('p_nombre').value = plato.nombre;
    document.getElementById('p_precio').value = plato.precio;
    
    // 2. Verificar si existe para mostrar la alerta amarilla si es necesario
    verificarPlatoExistente(); 

    // 3. Limpiar y reconstruir las filas de ingredientes
    const contenedor = document.getElementById('contenedor-ingredientes');
    contenedor.innerHTML = "";
    
    plato.receta.forEach(ing => {
        agregarFilaIngrediente(); // Crea una nueva fila visual
        let filas = contenedor.querySelectorAll('.ingrediente-row');
        let ultimaFila = filas[filas.length - 1];
        
        // Rellenar los selectores y cantidades de la nueva fila
        ultimaFila.querySelector('.ing-nom').value = ing.nombre;
        ultimaFila.querySelector('.ing-cant').value = ing.cantidad;
        ultimaFila.querySelector('.ing-unid').value = ing.unidad;
    });

    // 4. CORRECCIÓN: Forzar el recálculo de costos e impuestos
    // Esto disparará la visualización de los costos de producción y los checks de impuestos
    recalcularCostoReceta(); 
}

// --- LÓGICA DE PRODUCCIÓN (SCRIPT COMPLETO ACTUALIZADO) ---

    function normalizarUnidadProduccionAsistente(unidad) {
        if (unidad === 'Lt') return 'Litros';
        if (unidad === 'Unid') return 'Unidad';
        return unidad;
    }

    function actualizarVistaRestanteProduccionFila(fila) {
        if (!fila) return;
        const nomEl = fila.querySelector('.prod-insumo-nom');
        const cantEl = fila.querySelector('.prod-insumo-cant');
        const unidEl = fila.querySelector('.prod-insumo-unid');
        const outEl = fila.querySelector('.prod-restante');
        if (!nomEl || !cantEl || !unidEl || !outEl) return;

        const nomInsumo = (nomEl.value || '').trim();
        const cantUsada = parseFloat(cantEl.value) || 0;
        const unidUsada = normalizarUnidadProduccionAsistente(unidEl.value);

        if (!nomInsumo) {
            outEl.textContent = 'Restante: --';
            outEl.style.color = '#666';
            outEl.style.background = '#f1f2f6';
            return;
        }

        const ownerActivo = ownerDatosActivo();
        const alm = db.almacen.find(a =>
            a.nombre === nomInsumo &&
            String(a.owner || '').trim().toLowerCase() === ownerActivo &&
            a.modulo === moduloActual
        );
        if (!alm) {
            outEl.textContent = 'No existe en almacén';
            outEl.style.color = '#ff5e57';
            outEl.style.background = '#ffeaea';
            return;
        }

        const cantRestar = convertirUnidad(cantUsada, unidUsada, alm.unidad);
        const restante = (alm.actual || 0) - (isNaN(cantRestar) ? 0 : cantRestar);
        outEl.textContent = `Restante: ${restante.toFixed(2)} ${alm.unidad}`;
        outEl.style.color = restante < 0 ? '#ff5e57' : '#0f8f4f';
        outEl.style.background = restante < 0 ? '#ffeaea' : '#eafaf1';
    }

    function agregarFilaIngredienteProduccion() {
        const div = document.createElement('div');
        div.className = 'ingrediente-row';
        const ownerActivo = ownerDatosActivo();
        let opts = db.almacen.filter(a => String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual)
                             .map(a => `<option value="${a.nombre}">${a.nombre.toUpperCase()}</option>`).join('');
        
        div.innerHTML = `
            <select class="prod-insumo-nom" onchange="actualizarVistaRestanteProduccionFila(this.parentElement)"><option value="">Insumo...</option>${opts}</select>
            <input type="number" class="prod-insumo-cant" placeholder="Cant." oninput="actualizarVistaRestanteProduccionFila(this.parentElement)">
            <select class="prod-insumo-unid" onchange="actualizarVistaRestanteProduccionFila(this.parentElement)">
                <option value="g">g</option><option value="Oz">Oz</option><option value="Lb">Lb</option><option value="mL">mL</option><option value="Unidad">Unid</option>
            </select>
            <div style="display:flex; flex-direction:column; gap:4px;">
                <button class="btn btn-danger" onclick="this.closest('.ingrediente-row').remove()">X</button>
            </div>
            <div class="prod-restante" style="grid-column:1 / -1; margin-top:2px; padding:8px 10px; border-radius:8px; border:1px solid #dfe6e9; font-size:14px; font-weight:800; color:#666; background:#f1f2f6; text-align:center;">
                Restante: --
            </div>
        `;
        document.getElementById('contenedor-insumos-produccion').appendChild(div);
        actualizarVistaRestanteProduccionFila(div);
    }

function procesarNuevaProduccion() {
    if (bloquearAccionAdministrativaColaborador()) return;
    const nombre = document.getElementById('prod_nombre').value.trim();
    const cantFinal = parseFloat(document.getElementById('prod_cantidad').value);
    const unidadFinal = document.getElementById('prod_unidad').value;
    const idealProd = parseFloat(document.getElementById('prod_ideal')?.value) || 10; 
    
    if(!nombre || isNaN(cantFinal)) return alert("Complete el nombre y cantidad producida");

    const ownerActivo = ownerDatosActivo();
    let costoTotalProduccion = 0;
    let recetaUsada = [];
    // Usamos el selector de tu código original para encontrar las filas
    const filas = document.querySelectorAll('#contenedor-insumos-produccion .ingrediente-row');

    filas.forEach(fila => {
        const nomInsumo = fila.querySelector('.prod-insumo-nom').value;
        const cantUsada = parseFloat(fila.querySelector('.prod-insumo-cant').value) || 0;
        const unidUsada = fila.querySelector('.prod-insumo-unid').value;

        if(nomInsumo) {
            recetaUsada.push({ nombre: nomInsumo, cantidad: cantUsada, unidad: unidUsada });
            
            // Buscar en Almacén (con validación de módulo y usuario)
            let alm = db.almacen.find(a => a.nombre === nomInsumo && String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual);
            
            if(alm) {
                // --- NUEVA LÓGICA DE CONVERSIÓN ---
                // Reemplazamos los 'if factor' manuales por la función centralizada
                const cantidadARestar = convertirUnidad(cantUsada, unidUsada, alm.unidad);
                
                // DESCUENTO REAL E INMEDIATO DEL ALMACÉN
                alm.actual -= cantidadARestar; 
                costoTotalProduccion += (cantidadARestar * (alm.costoUnitario || 0));
            }
        }
    });

    // 1. ACTUALIZAR O CREAR EN STOCK DE PRODUCCIÓN (Semielaborados)
    let prodExistente = db.produccion_stock.find(p => p.nombre === nombre && String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual);
    const costoUnitarioCalculado = costoTotalProduccion / cantFinal;

    if(prodExistente) {
        prodExistente.actual += cantFinal;
        prodExistente.costoUnitario = costoUnitarioCalculado;
        prodExistente.receta = recetaUsada;
        prodExistente.ideal = idealProd;
    } else {
        db.produccion_stock.push({
            owner: ownerActivo, 
            modulo: moduloActual, 
            nombre, 
            actual: cantFinal, 
            unidad: unidadFinal, 
            costoUnitario: costoUnitarioCalculado, 
            receta: recetaUsada, 
            ideal: idealProd
        });
    }

    // 2. REGISTRAR EN EL HISTORIAL
    db.historial_prod.push({
        owner: ownerActivo, 
        modulo: moduloActual, 
        fecha: new Date().toLocaleString(),
        producto: nombre, 
        cantidad: cantFinal + " " + unidadFinal, 
        costoOp: costoTotalProduccion, 
        operador: typeof operadorActual !== 'undefined' ? operadorActual : 'Admin'
    });

    // 3. LIMPIEZA DE INTERFAZ
    alert("Producción registrada y descontada del almacén.");
    document.getElementById('contenedor-insumos-produccion').innerHTML = "";
    document.getElementById('prod_nombre').value = "";
    document.getElementById('prod_cantidad').value = "";
    if(document.getElementById('prod_ideal')) document.getElementById('prod_ideal').value = "";

    // 4. PERSISTENCIA Y RENDERIZADO
    guardarDatos(); // Asegúrate que se llame guardarDatos() como en tu original
    renderStockProduccion();
    if(typeof renderAlmacen === 'function') renderAlmacen();
}

function renderStockProduccion() {
    const ownerActivo = ownerDatosActivo();
    const lista = db.produccion_stock.filter(p => String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual);
    const tabla = document.getElementById('tabla-stock-produccion');
    const modoBasico = esModoBasicoColaborador();
    
    if (!tabla) return;

    tabla.innerHTML = lista.map((p) => {
        const i = db.produccion_stock.indexOf(p);
        
        // --- LÓGICA DE VERIFICACIÓN DE INGREDIENTES ---
        let faltaIngrediente = false;
        if (p.receta && p.receta.length > 0) {
            faltaIngrediente = p.receta.some(ing => {
                let alm = db.almacen.find(a => a.nombre === ing.nombre && String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual);
                let stockDisp = alm ? alm.actual : 0;
                let cantNecesaria = alm ? convertirUnidad(ing.cantidad, ing.unidad, alm.unidad) : ing.cantidad;
                return stockDisp < cantNecesaria;
            });
        }

        // --- LÓGICA DE COLORES Y PARPADEO ---
        let estiloExtra = "";
        let claseAlerta = "";

        if (p.actual <= 0) {
            // Caso 1: Sin Stock Terminado (Rojo fijo subrayado)
            estiloExtra = "color: #ff5e57; font-weight: 900; text-decoration: underline;";
        } 
        
        // Si el stock es bajo (20%) O si falta algún ingrediente para fabricar más
        if (p.actual <= (p.ideal * 0.20) || faltaIngrediente) {
            claseAlerta = 'class="alerta-critica-roja"';
        }

        return `
        <tr id="prod-tr-${i}">
            <td onclick="toggleDetallesProduccion(${i})" style="cursor:pointer; color:var(--blue); font-weight:bold;">
                <span ${claseAlerta} style="${estiloExtra}">${p.nombre.toUpperCase()} ⚠️</span>
            </td>
            <td style="font-weight:bold;">${p.actual.toFixed(2)} ${p.unidad}</td>
            <td>RD$${p.costoUnitario.toFixed(2)}</td>
            <td>${modoBasico ? '<span style="color:#999;">Solo lectura</span>' : `<div style="display: flex; gap: 5px;"><button class="btn btn-warning" onclick="cargarEdicionProduccion(${i})">✏️ </button><button class="btn btn-danger" onclick="eliminarProduccion(${i})">X</button></div>`}</td>
        </tr>`;
    }).join('');
}

    function eliminarProduccion(index) {
        if (bloquearAccionAdministrativaColaborador()) return;
        const pass = prompt("Ingrese su contraseña de 5 números para ELIMINAR:");
        if (pass === sesionUser.pass) {
            if (confirm("¿Eliminar este registro de producción?")) {
                db.produccion_stock.splice(index, 1);
                guardarDatos();
                renderStockProduccion();
            }
        } else {
            alert("Contraseña incorrecta.");
        }
    }

function toggleDetallesProduccion(idx) {
    const idRow = `detalles-prod-row-${idx}`;
    const rowExistente = document.getElementById(idRow);
    
    if(rowExistente) { 
        rowExistente.remove(); 
    } else {
        const ownerActivo = ownerDatosActivo();
        const prod = db.produccion_stock[idx];
        const trPadre = document.getElementById(`prod-tr-${idx}`);
        if (!prod || !trPadre) return;
        if (String(prod.owner || '').trim().toLowerCase() !== ownerActivo || prod.modulo !== moduloActual) return;
        const nuevaFila = document.createElement('tr');
        nuevaFila.id = idRow;

        let racionesPosibles = [];
        let costoTotalReposicion = 0;
        let listaFaltantes = [];
        
        let ingHtml = prod.receta ? prod.receta.map(ing => {
            let alm = db.almacen.find(a => a.nombre === ing.nombre && String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual);
            
            let stockDisp = alm ? alm.actual : 0;
            let costoU = alm ? (alm.costoUnitario || 0) : 0;
            let cantNecesaria = alm ? convertirUnidad(ing.cantidad, ing.unidad, alm.unidad) : ing.cantidad;
            let capacidad = (alm && cantNecesaria > 0) ? Math.floor(stockDisp / cantNecesaria) : 0;
            if (alm) racionesPosibles.push(capacidad);

            // Cálculo de Faltantes
            let falta = Math.max(0, cantNecesaria - stockDisp);
            let costoRepo = falta * costoU;
            costoTotalReposicion += costoRepo;

            if (falta > 0) {
                listaFaltantes.push({ nombre: ing.nombre, cant: falta, unid: (alm ? alm.unidad : ing.unidad), costo: costoRepo });
            }
            
            let esCritico = stockDisp < cantNecesaria;
            let claseAlerta = esCritico ? 'class="alerta-critica-roja"' : '';
            
            return `
                <div style="display:flex; justify-content:space-between; font-size:0.9em; border-bottom:1px solid #f0f0f0; padding:3px 0;">
                    <span ${claseAlerta}>• ${ing.nombre.toUpperCase()}</span>
                    <span>${stockDisp.toFixed(2)} ${(alm ? alm.unidad : ing.unidad)} / ${cantNecesaria.toFixed(2)} ${(alm ? alm.unidad : ing.unidad)}</span>
                </div>`;
        }).join('') : "Sin receta definida.";

        let maxPodriasHacer = racionesPosibles.length > 0 ? Math.min(...racionesPosibles) : 0;

        nuevaFila.innerHTML = `
            <td colspan="4">
                <div class="detalles-receta" style="border-left: 4px solid var(--purple); background: #fdfbff; padding: 15px; border-radius: 0 10px 10px 0;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="color: var(--primary);">🧩 COMPOSICIÓN Y CAPACIDAD:</strong>
                        <strong style="color:var(--success);">RD$${costoTotalReposicion.toFixed(2)}</strong>
                    </div>
                    <div style="margin-top: 10px; line-height: 1.6;">${ingHtml}</div>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
                    <p style="margin:5px 0; color:var(--purple); font-size: 0.95em;">
                        🏭 Con el almacén actual, puedes fabricar: <br>
                        <strong style="font-size: 1.2em;">${maxPodriasHacer} ${prod.unidad} más.</strong>
                    </p>
                    <button class="btn btn-blue" style="width:100%; background:#25D366; margin-top:10px; border:none; font-weight:bold;" 
                            onclick='enviarDiagnosticoWhatsApp(${JSON.stringify(prod.nombre)}, ${JSON.stringify(listaFaltantes)}, ${costoTotalReposicion})'>
                        📲 INFORMAR FALTANTES (WhatsApp)
                    ></button>
                </div>
            </td>`;
        trPadre.parentNode.insertBefore(nuevaFila, trPadre.nextSibling);
    }
}

    function eliminarProduccion(index) {
        if (bloquearAccionAdministrativaColaborador()) return;
        const pass = prompt("Ingrese su contraseña de 5 números para ELIMINAR:");
        if (pass === sesionUser.pass) {
            if (confirm("¿Eliminar este registro de producción?")) {
                db.produccion_stock.splice(index, 1);
                guardarDatos();
                renderStockProduccion();
            }
        } else {
            alert("Contraseña incorrecta.");
        }
    }

    function enviarEstadoProduccionUnica(idx, capacidad) {
        const p = db.produccion_stock[idx];
        let mensaje = `*LURO CONTROL - EL CONTROL EN TUS MANOS*\n`;
        mensaje += `------------------------------------------\n`;
        mensaje += `*Producto:* ${p.nombre.toUpperCase()}\n`;
        mensaje += `*Existencia:* ${p.actual.toFixed(2)} ${p.unidad}\n`;
        mensaje += `*Capacidad:* Podemos fabricar ${capacidad} más.\n`;
        mensaje += `------------------------------------------\n`;
        abrirWhatsAppConMensaje(WHATSAPP_DEFAULT, mensaje);
    }

    function enviarDiagnosticoWhatsApp(nombreProd, listaFaltantes, costoTotalReposicion) {
        const faltantes = Array.isArray(listaFaltantes) ? listaFaltantes : [];
        let mensaje = `*LURO CONTROL - DIAGNOSTICO DE FALTANTES*\n`;
        mensaje += `*Módulo:* ${moduloActual}\n`;
        mensaje += `*Producción:* ${String(nombreProd || '').toUpperCase()}\n`;
        mensaje += `------------------------------------------\n`;

        if (!faltantes.length) {
            mensaje += `No hay faltantes registrados para este producto.\n`;
        } else {
            faltantes.forEach(f => {
                const nom = String(f.nombre || '').toUpperCase();
                const cant = Number(f.cant || 0);
                const unid = String(f.unid || '');
                const costo = Number(f.costo || 0);
                mensaje += `• ${nom}: ${cant.toFixed(2)} ${unid} | Costo aprox: RD$${costo.toFixed(2)}\n`;
            });
        }

        mensaje += `------------------------------------------\n`;
        mensaje += `*Costo total de reposición:* RD$${Number(costoTotalReposicion || 0).toFixed(2)}\n`;
        mensaje += `_Generado por LuRo Control_`;
        abrirWhatsAppConMensaje(WHATSAPP_DEFAULT, mensaje);
    }

    function cargarEdicionProduccion(idx) {
        if (bloquearAccionAdministrativaColaborador()) return;
        const ownerActivo = ownerDatosActivo();
        const prod = db.produccion_stock[idx];
        if (!prod) return;
        if (String(prod.owner || '').trim().toLowerCase() !== ownerActivo || prod.modulo !== moduloActual) return;
        document.getElementById('prod_nombre').value = prod.nombre;
        document.getElementById('prod_cantidad').value = prod.actual;
        document.getElementById('prod_unidad').value = prod.unidad;
        const contenedor = document.getElementById('contenedor-insumos-produccion');
        contenedor.innerHTML = "";
        if(prod.receta) {
            prod.receta.forEach(ing => {
                const div = document.createElement('div');
                div.className = 'ingrediente-row';
                let opts = db.almacen.filter(a => String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual)
                                     .map(a => `<option value="${a.nombre}" ${a.nombre === ing.nombre ? 'selected' : ''}>${a.nombre.toUpperCase()}</option>`).join('');
                div.innerHTML = `<select class="prod-insumo-nom">${opts}</select><input type="number" class="prod-insumo-cant" value="${ing.cantidad}"><select class="prod-insumo-unid"><option value="g" ${ing.unidad==='g'?'selected':''}>g</option><option value="Oz" ${ing.unidad==='Oz'?'selected':''}>Oz</option><option value="Lb" ${ing.unidad==='Lb'?'selected':''}>Lb</option><option value="mL" ${ing.unidad==='mL'?'selected':''}>mL</option></select><button class="btn btn-danger" onclick="this.parentElement.remove()">X</button>`;
                contenedor.appendChild(div);
            });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- FUNCIONES CORE ---

    const ADMIN_ONLY_PAGES = new Set([
        'configuracion',
        'entrenamientos',
        'agregar',
        'clientes-puntos',
        'rnc-dgii',
        'reporte-compras-distribuidor',
        'ventas',
        'autorizaciones'
    ]);
    const RESERVED_MODULES = new Set(['COCINA', 'ADMINISTRADOR']);

    function esModuloAdministradorActual() {
        return moduloVistaActual === 'ADMINISTRADOR';
    }

    function moduloPerteneceVista(moduloRegistro) {
        if (!moduloRegistro) return true;
        if (esModuloAdministradorActual()) {
            return moduloRegistro === moduloAdminObjetivo;
        }
        return moduloRegistro === moduloActual;
    }

    function obtenerModulosDisponibles() {
        const base = esColaboradorSesion ? ['COCINA'] : ['COCINA', 'ADMINISTRADOR'];
        const custom = (Array.isArray(db.modulosCustom) ? db.modulosCustom : [])
            .filter(m => m && m.owner === sesionUser?.user && m.nombre)
            .map(m => String(m.nombre).trim().toUpperCase())
            .filter(n => n && !RESERVED_MODULES.has(n));
        return [...new Set(base), ...new Set(custom)];
    }

    function estilosModulo(nombre) {
        if (nombre === 'ADMINISTRADOR') return { color: 'var(--purple)', icono: '🛡️ ', titulo: 'ADMINISTRADOR' };
        if (nombre === 'COCINA') return { color: 'var(--accent)', icono: '👨‍🍳 ', titulo: 'ADMINISTRAR COCINA' };
        return { color: 'var(--blue)', icono: '🧩 ', titulo: `MÓDULO ${nombre}` };
    }

    function obtenerModuloEtiquetaActivo() {
        if (esModuloAdministradorActual()) return `ADMINISTRADOR · ${moduloAdminObjetivo}`;
        return moduloActual || moduloVistaActual || 'COCINA';
    }

    function actualizarMarcaModuloActivo() {
        const sub = document.getElementById('sidebar-brand-sub');
        const tag = document.getElementById('sidebar-brand-module');
        if (sub) sub.textContent = `El control en tus manos · ${obtenerModuloEtiquetaActivo()}`;
        if (tag) tag.textContent = `Módulo: ${obtenerModuloEtiquetaActivo()}`;
    }

    function animarTransicionModulo() {
        const main = document.getElementById('main-content');
        if (!main) return;
        main.classList.add('module-switching');
        setTimeout(() => main.classList.remove('module-switching'), 210);
    }

    function renderModuleSelectorCards() {
        const grid = document.getElementById('module-cards-grid');
        const btnNuevo = document.querySelector('#module-selector .btn-add-module-float');
        if (!grid) return;
        if (btnNuevo) btnNuevo.style.display = esColaboradorSesion ? 'none' : 'inline-block';
        const modulos = obtenerModulosDisponibles();
        grid.innerHTML = modulos.map(mod => {
            const est = estilosModulo(mod);
            const esCustom = !RESERVED_MODULES.has(mod);
            const btnEliminar = (!esColaboradorSesion && esCustom)
                ? `<button class="module-delete-btn" onclick="event.stopPropagation(); eliminarModuloCustom('${mod.replace(/'/g, "\\'")}')">🗑️ ELIMINAR MÓDULO</button>`
                : '';
            return `<div class="module-card" onclick="seleccionarModulo('${mod.replace(/'/g, "\\'")}')" style="border-color:${est.color};">
              <span style="font-size:60px;">${est.icono}</span>
              <h3 style="margin-top:20px; text-align:center;">${est.titulo}</h3>
              ${btnEliminar}
            </div>`;
        }).join('');
    }

    function renderAdminModuleLinks() {
        const box = document.getElementById('admin-module-links');
        const list = document.getElementById('admin-module-links-list');
        if (!box || !list) return;
        if (!esModuloAdministradorActual()) {
            box.style.display = 'none';
            return;
        }
        box.style.display = 'block';
        const modulos = obtenerModulosDisponibles().filter(m => m !== 'ADMINISTRADOR');
        list.innerHTML = modulos.map(m => {
            const esCocina = m === 'COCINA';
            const activo = m === moduloAdminObjetivo;
            const bg = activo ? 'var(--accent)' : (esCocina ? '#00b894' : 'var(--blue)');
            const txt = esCocina ? 'ABRIR VISTA COCINA' : 'ABRIR MÓDULO';
            return `<button class="btn" style="padding:8px 10px; background:${bg}; font-size:11px;" onclick="abrirEnlaceModuloAdmin('${m.replace(/'/g, "\\'")}')">${m} · ${txt}${activo ? ' · ACTIVO' : ''}</button>`;
        }).join('');
    }

    function abrirEnlaceModuloAdmin(modulo) {
        const m = String(modulo || '').trim().toUpperCase();
        if (!esModuloAdministradorActual()) return;
        if (!m || m === 'ADMINISTRADOR') return;
        moduloAdminObjetivo = m;
        moduloActual = m;
        const inicioAdmin = tienePermisoPagina('configuracion') ? 'configuracion' : obtenerPaginaInicialSesion();
        const modLbl = document.getElementById('current-module-display');
        if (modLbl) modLbl.innerText = `ADMINISTRADOR · ${m}`;
        animarTransicionModulo();
        actualizarMarcaModuloActivo();
        renderAdminModuleLinks();
        showPage(inicioAdmin);
    }

    function agregarNuevoModulo() {
        if (!sesionUser || !sesionUser.user) return;
        if (esColaboradorSesion) return alert("🚫 Solo usuarios administradores pueden crear módulos.");
        const entrada = prompt("Nombre del nuevo módulo:");
        if (!entrada) return;
        const nombre = String(entrada).trim().toUpperCase();
        if (!nombre) return;
        if (RESERVED_MODULES.has(nombre)) return alert("Ese nombre está reservado.");
        if (!Array.isArray(db.modulosCustom)) db.modulosCustom = [];
        const existe = db.modulosCustom.some(m => m.owner === sesionUser.user && String(m.nombre || '').toUpperCase() === nombre);
        if (existe) return alert("Ese módulo ya existe.");
        db.modulosCustom.push({ id: 'MOD-' + Date.now(), owner: sesionUser.user, nombre, creadoPor: operadorActual || sesionUser.user, createdAt: new Date().toISOString() });
        guardarDatos();
        renderModuleSelectorCards();
        renderAdminModuleLinks();
        alert(`Módulo ${nombre} creado correctamente.`);
    }

    function eliminarModuloCustom(nombreModulo) {
        if (!sesionUser || !sesionUser.user) return;
        if (esColaboradorSesion) return alert("🚫 Solo usuarios administradores pueden eliminar módulos.");
        const nombre = String(nombreModulo || '').trim().toUpperCase();
        if (!nombre || RESERVED_MODULES.has(nombre)) return alert("No se puede eliminar ese módulo.");
        if (!confirm(`¿Eliminar el módulo ${nombre}?\n\nSe eliminarán también sus datos.`)) return;

        db.modulosCustom = (db.modulosCustom || []).filter(m =>
            !(m.owner === sesionUser.user && String(m.nombre || '').trim().toUpperCase() === nombre)
        );

        const tablasModulo = ['platos', 'almacen', 'entradas', 'ventas', 'decomisos', 'autorizaciones', 'produccion_stock', 'historial_prod', 'distribuidores', 'catalogoDistribuidores', 'facturasResumen', 'entrenamientos'];
        tablasModulo.forEach(k => {
            if (!Array.isArray(db[k])) return;
            db[k] = db[k].filter(item => !(item && item.owner === sesionUser.user && String(item.modulo || '').trim().toUpperCase() === nombre));
        });

        guardarDatos();
        renderModuleSelectorCards();
        renderAdminModuleLinks();
        alert(`Módulo ${nombre} eliminado.`);
    }

    function seleccionarModulo(mod) {
        if (!validarAccesoCuentaActual()) return;
        if (esColaboradorSesion && String(mod || '').toUpperCase() === 'ADMINISTRADOR') {
            alert("🚫 Los colaboradores no pueden entrar al módulo ADMINISTRADOR.");
            return;
        }
        moduloVistaActual = mod;
        moduloActual = (mod === 'ADMINISTRADOR') ? 'COCINA' : mod;
        if (mod === 'ADMINISTRADOR') moduloAdminObjetivo = 'COCINA';
        document.getElementById('module-selector').style.display = 'none';
        document.getElementById('sidebar').style.display = 'block';
        document.getElementById('main-content').style.display = 'block';
        const esAdminModulo = (mod === 'ADMINISTRADOR');
        const colorModulo = esAdminModulo ? 'var(--purple)' : (mod === 'COCINA' ? 'var(--accent)' : 'var(--blue)');
        document.getElementById('sidebar-title').innerText = mod;
        document.getElementById('sidebar-title').style.color = colorModulo;
        document.getElementById('current-module-display').innerText = esAdminModulo ? `${mod} · ${moduloAdminObjetivo}` : mod;
        document.getElementById('current-module-display').style.color = colorModulo;
        actualizarMarcaModuloActivo();
        document.getElementById('p_nombre').placeholder = "Ej. Pollo a la Plancha";
        document.getElementById('titulo-receta').innerText = "🧪 Crear Receta Nueva";
        document.getElementById('label-nombre-item').innerText = "Nombre del Plato";
        document.getElementById('nav-item-plato').innerText = "🧪 Agregar Plato";
        const selectUnid = document.getElementById('inv_unidad');
        selectUnid.innerHTML = '<option value="Lb">Lb (Libras)</option><option value="g">g (Gramos)</option><option value="Oz">Oz (Onzas)</option><option value="Litros">Litros</option><option value="Unidad">Unidad</option>';
        aplicarPermisosSidebar();
        renderAdminModuleLinks();
        if (esAdminModulo) {
            const inicioAdmin = tienePermisoPagina('configuracion') ? 'configuracion' : obtenerPaginaInicialSesion();
            showPage(inicioAdmin);
        } else {
            showPage(obtenerPaginaInicialSesion());
        }
    }

    let configRenderHeavyTimer = null;
    function renderConfig(opts = {}) {
        const { deferHeavy = true } = opts;
        const adminBox = document.getElementById('section-admin-master');
        const colabBox = document.getElementById('section-user-colaboradores');
        const cloudBox = document.getElementById('section-cloud-masters');
        const vaultBox = document.getElementById('section-servidor-master');
        const esMasterGlobal = !!(sesionUser && (sesionUser.user || '').trim().toLowerCase() === MASTER_USER);
        if (adminBox) adminBox.style.display = (sesionUser && sesionUser.role === 'super-master') ? 'block' : 'none';
        if (cloudBox) cloudBox.style.display = esMasterGlobal ? 'block' : 'none';
        if (vaultBox) vaultBox.style.display = esMasterGlobal ? 'block' : 'none';
        if (esMasterGlobal) iniciarAutoRefreshBovedaMaster();
        else detenerAutoRefreshBovedaMaster();
        if (colabBox) colabBox.style.display = esColaboradorSesion ? 'none' : 'block';
        const backupBox = document.getElementById('section-registro-backups');
        if (backupBox) backupBox.style.display = esColaboradorSesion ? 'none' : 'block';
        const heavyRender = () => {
            copiasRegistroDesbloqueadas = false;
            renderTablaCopiasRegistro();
            cargarAsignacionDuenoColaborador();
            actualizarTablaUsuarios();
            actualizarTablaColaboradores();
            actualizarEstadoPagoNuevoUsuario();
            if (esMasterGlobal && typeof cargarBovedaMaster === 'function') cargarBovedaMaster();
        };
        if (!deferHeavy) {
            heavyRender();
            return;
        }
        if (configRenderHeavyTimer) clearTimeout(configRenderHeavyTimer);
        configRenderHeavyTimer = setTimeout(() => {
            configRenderHeavyTimer = null;
            heavyRender();
        }, 25);
    }

    function aplicarModoBasicoInterfaz(pageId) {
        const esBasico = esModoBasicoColaborador();

        // Inventario: colaboradores solo lectura.
        ['inv_nombre', 'inv_dist', 'inv_dist_select', 'inv_unidad', 'inv_actual', 'inv_ideal', 'inv_costo_total'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = esBasico;
        });
        document.querySelectorAll('#inventario button[onclick*="agregarAlmacen"], #inventario button[onclick*="entradaAutomaticaMasiva"], #inventario button[onclick*="enviarPedidoWhatsapp"], #inventario button[onclick*="borrarTodoElAlmacen"]').forEach(btn => {
            btn.style.display = esBasico ? 'none' : '';
        });

        // Producción interna: colaboradores solo lectura.
        ['prod_nombre', 'prod_cantidad', 'prod_unidad'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = esBasico;
        });
        document.querySelectorAll('#produccion-interna button[onclick*="agregarFilaIngredienteProduccion"], #produccion-interna button[onclick*="procesarNuevaProduccion"]').forEach(btn => {
            btn.style.display = esBasico ? 'none' : '';
        });

        // Disponibilidad: colaboradores sin panel de ajustes masivos.
        const panelAjustes = document.querySelector('#disponibilidad .card .card');
        if (panelAjustes) panelAjustes.style.display = esBasico ? 'none' : '';

        // Historiales: colaboradores no pueden borrar masivamente.
        document.querySelectorAll('.content-section button[onclick*="limpiarHistorial("]').forEach(btn => {
            btn.style.display = esBasico ? 'none' : '';
        });

        // Distribuidores: colaboradores solo lectura.
        ['dist_nombre', 'dist_contacto', 'dist_telefono', 'dist_email', 'dist_direccion', 'dist_estado', 'cat_dist', 'cat_producto', 'cat_unidad', 'cat_precio', 'cat_disponible'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = esBasico;
        });
        document.querySelectorAll('#distribuidores button').forEach(btn => {
            if ((btn.getAttribute('onclick') || '').includes('showPage(')) return;
            btn.style.display = esBasico ? 'none' : '';
        });
    }

    function showPage(pageId) {
        if (!validarAccesoCuentaActual()) return;
        if (!tienePermisoPagina(pageId)) {
            alert("🚫 No tiene permisos para acceder a esta sección.");
            return;
        }
        if (!esModuloAdministradorActual() && ADMIN_ONLY_PAGES.has(pageId)) {
            alert("🚫 Esta sección solo se puede abrir desde el módulo ADMINISTRADOR.");
            return;
        }
        if (pageId === 'entradas-almacen' && !esColaboradorSesion && !tieneAsignacionEntrada('historial')) {
            alert("🚫 No tiene asignación para ver el historial de entradas.");
            return;
        }
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        if(pageId === 'configuracion') renderConfig({ deferHeavy: true });
        if(pageId === 'ventas') renderHistorialVentas();
        if(pageId === 'inventario') renderAlmacen();
        if(pageId === 'disponibilidad') renderDispoTable();
        if(pageId === 'historial-decomiso') renderHistorialDecomiso();
        if(pageId === 'decomiso') actualizarListaDecomiso();
        if(pageId === 'entradas-almacen') renderEntradas();
        if(pageId === 'autorizaciones') renderAutorizaciones();
        if(pageId === 'produccion-interna') renderStockProduccion();
        if(pageId === 'historial-produccion') renderHistorialProduccion();
        if(pageId === 'reporte-compras-distribuidor') renderHistorialComprasDistribuidor();
        if(pageId === 'distribuidores') renderModuloDistribuidores();
        if(pageId === 'rnc-dgii') actualizarTablaRNC();
        if(pageId === 'entrenamientos') renderEntrenamientos();
        if(pageId === 'procedimientos') renderProcedimientosSoloVista();
        if(pageId === 'clientes-puntos') { renderConfigPlanMembresia(); renderTablaClientesPuntos(); }
        if(pageId === 'salida') { renderMesasSalida(); actualizarPanelCobro(); }
        if(pageId === 'home') renderHomeRegistroInfo();
        aplicarModoBasicoInterfaz(pageId);
    }

function generarId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function obtenerDistribuidoresActuales() {
    if (!sesionUser || !sesionUser.user) return [];
    return (db.distribuidores || []).filter(d => d.owner === sesionUser.user && d.modulo === moduloActual);
}

function obtenerCatalogoDistribuidoresActual() {
    if (!sesionUser || !sesionUser.user) return [];
    return (db.catalogoDistribuidores || []).filter(c => c.owner === sesionUser.user && c.modulo === moduloActual);
}

function deduplicarCatalogoDistribuidoresActual() {
    const map = new Map();
    obtenerCatalogoDistribuidoresActual().forEach(c => {
        const key = `${c.distId}|${c.nombreProducto}|${c.unidad}`;
        const current = map.get(key);
        const fechaActual = new Date(c.updatedAt || 0).getTime();
        const fechaPrev = current ? new Date(current.updatedAt || 0).getTime() : -1;
        if (!current || fechaActual >= fechaPrev) map.set(key, c);
    });
    const idsKeep = new Set(Array.from(map.values()).map(x => x.id));
    db.catalogoDistribuidores = (db.catalogoDistribuidores || []).filter(c => {
        if (c.owner !== sesionUser.user || c.modulo !== moduloActual) return true;
        return idsKeep.has(c.id);
    });
}

function normalizarNombreProducto(txt) {
    return String(txt || '').trim().toLowerCase();
}

function esUnidadPeso(u) {
    return ['g', 'Lb', 'Oz'].includes(u);
}

function esUnidadVolumen(u) {
    return ['mL', 'Litros'].includes(u);
}

function esUnidadCompatible(u1, u2) {
    if (u1 === u2) return true;
    if (esUnidadPeso(u1) && esUnidadPeso(u2)) return true;
    if (esUnidadVolumen(u1) && esUnidadVolumen(u2)) return true;
    return false;
}

function calcularPrecioUnitarioEnUnidad(itemCatalogo, unidadDestino) {
    if (!itemCatalogo || !unidadDestino) return null;
    if (!esUnidadCompatible(itemCatalogo.unidad, unidadDestino)) return null;
    const equivalenteEnUnidadCatalogo = convertirUnidad(1, unidadDestino, itemCatalogo.unidad);
    return (Number(itemCatalogo.precio) || 0) * equivalenteEnUnidadCatalogo;
}

function actualizarSelectDistribuidores() {
    const distribuidores = obtenerDistribuidoresActuales();
    const selectInv = document.getElementById('inv_dist_select');
    if (selectInv) {
        const prev = selectInv.value;
        selectInv.innerHTML = '<option value="">Distribuidor / Proveedor</option>';
        distribuidores.filter(d => d.activo).forEach(d => {
            const op = document.createElement('option');
            op.value = d.nombre;
            op.textContent = d.nombre;
            selectInv.appendChild(op);
        });
        if (prev) selectInv.value = prev;
    }

    const selectCat = document.getElementById('cat_dist');
    if (selectCat) {
        const prev = selectCat.value;
        selectCat.innerHTML = '<option value="">Distribuidor</option>';
        distribuidores.forEach(d => {
            const op = document.createElement('option');
            op.value = d.id;
            op.textContent = `${d.nombre} ${d.activo ? '' : '(Inactivo)'}`;
            selectCat.appendChild(op);
        });
        if (prev) selectCat.value = prev;
    }
}

function actualizarOpcionesProductosCatalogo() {
    const sel = document.getElementById('cat_producto');
    if (!sel) return;
    const prev = sel.value;
    const distId = document.getElementById('cat_dist')?.value || '';
    const distNombre = db.distribuidores.find(d =>
        d.id === distId && d.owner === sesionUser.user && d.modulo === moduloActual
    )?.nombre || '';

    const nombres = new Set();
    // Sin distribuidor seleccionado: lista vacía para forzar selección primero.
    if (!distId) {
        sel.innerHTML = '<option value="">Seleccione primero un distribuidor</option>';
        return;
    }

    // Productos ya registrados en catálogo para ese distribuidor.
    obtenerCatalogoDistribuidoresActual()
        .filter(c => c.distId === distId)
        .forEach(c => nombres.add(normalizarNombreProducto(c.nombreProducto)));

    // Productos del almacén que tengan asignado ese mismo distribuidor.
    db.almacen
        .filter(a =>
            a.owner === sesionUser.user &&
            a.modulo === moduloActual &&
            normalizarNombreProducto(a.distribuidor) === normalizarNombreProducto(distNombre)
        )
        .forEach(a => nombres.add(normalizarNombreProducto(a.nombre)));

    const lista = Array.from(nombres).filter(Boolean).sort((a, b) => a.localeCompare(b));
    sel.innerHTML = '<option value="">Seleccionar producto</option>';
    lista.forEach(n => {
        const op = document.createElement('option');
        op.value = n;
        op.textContent = n.toUpperCase();
        sel.appendChild(op);
    });
    if (prev) sel.value = prev;
}

function actualizarOpcionesComparadorProductos() {
    const sel = document.getElementById('cmp_producto');
    if (!sel) return;
    const prev = sel.value;
    const nombres = Array.from(new Set(obtenerCatalogoDistribuidoresActual().map(c => normalizarNombreProducto(c.nombreProducto))))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    sel.innerHTML = '<option value="">Seleccionar producto exacto</option>';
    nombres.forEach(n => {
        const op = document.createElement('option');
        op.value = n;
        op.textContent = n.toUpperCase();
        sel.appendChild(op);
    });
    if (prev) sel.value = prev;
}

function autocompletarPrecioUnitarioCatalogo() {
    const distId = document.getElementById('cat_dist')?.value || '';
    const producto = normalizarNombreProducto(document.getElementById('cat_producto')?.value || '');
    const unidad = document.getElementById('cat_unidad')?.value || '';
    const precioInput = document.getElementById('cat_precio');
    if (!precioInput || !distId || !producto || !unidad) return;

    let item = obtenerCatalogoDistribuidoresActual().find(c =>
        c.distId === distId && c.nombreProducto === producto && c.unidad === unidad
    );
    if (item) {
        precioInput.value = Number(item.precio || 0).toFixed(2);
        const disp = document.getElementById('cat_disponible');
        if (disp) disp.checked = !!item.disponible;
        return;
    }

    item = obtenerCatalogoDistribuidoresActual().find(c =>
        c.distId === distId && c.nombreProducto === producto && esUnidadCompatible(c.unidad, unidad)
    );
    if (item) {
        const convertido = calcularPrecioUnitarioEnUnidad(item, unidad);
        if (convertido !== null) precioInput.value = Number(convertido).toFixed(2);
        return;
    }

    const distNombre = db.distribuidores.find(d => d.id === distId)?.nombre || '';
    const itemAlm = db.almacen.find(a =>
        a.owner === sesionUser.user &&
        a.modulo === moduloActual &&
        normalizarNombreProducto(a.nombre) === producto &&
        (!distNombre || a.distribuidor === distNombre)
    );
    if (itemAlm && esUnidadCompatible(itemAlm.unidad, unidad)) {
        const precioDesdeAlmacen = calcularPrecioUnitarioEnUnidad({ unidad: itemAlm.unidad, precio: itemAlm.costoUnitario || 0 }, unidad);
        if (precioDesdeAlmacen !== null) precioInput.value = Number(precioDesdeAlmacen).toFixed(2);
    }
}

function limpiarFormularioDistribuidor() {
    ['dist_nombre', 'dist_contacto', 'dist_telefono', 'dist_email', 'dist_direccion', 'dist_edit_id'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const estado = document.getElementById('dist_estado');
    if (estado) estado.value = 'activo';
}

function guardarDistribuidor() {
    if (bloquearAccionAdministrativaColaborador()) return;
    const idEdit = document.getElementById('dist_edit_id')?.value || '';
    const nombre = (document.getElementById('dist_nombre')?.value || '').trim();
    const contacto = (document.getElementById('dist_contacto')?.value || '').trim();
    const telefono = (document.getElementById('dist_telefono')?.value || '').trim();
    const email = (document.getElementById('dist_email')?.value || '').trim();
    const direccion = (document.getElementById('dist_direccion')?.value || '').trim();
    const activo = (document.getElementById('dist_estado')?.value || 'activo') === 'activo';

    if (!nombre) return alert('Ingrese el nombre del distribuidor.');
    const existeNombre = (db.distribuidores || []).find(d =>
        d.owner === sesionUser.user &&
        d.modulo === moduloActual &&
        d.nombre.toLowerCase() === nombre.toLowerCase() &&
        d.id !== idEdit
    );
    if (existeNombre) return alert('Ya existe un distribuidor con ese nombre.');

    if (idEdit) {
        const idx = db.distribuidores.findIndex(d => d.id === idEdit && d.owner === sesionUser.user && d.modulo === moduloActual);
        if (idx >= 0) {
            const nombreAnterior = db.distribuidores[idx].nombre;
            db.distribuidores[idx] = { ...db.distribuidores[idx], nombre, contacto, telefono, email, direccion, activo, updatedAt: new Date().toISOString() };
            db.catalogoDistribuidores.forEach(c => {
                if (c.owner === sesionUser.user && c.modulo === moduloActual && c.distId === idEdit) {
                    c.distNombre = nombre;
                }
            });
            db.almacen.forEach(a => {
                if (a.owner === sesionUser.user && a.modulo === moduloActual && a.distribuidor === nombreAnterior) {
                    a.distribuidor = nombre;
                }
            });
            db.entradas.forEach(e => {
                if (e.owner === sesionUser.user && e.modulo === moduloActual && e.distribuidor === nombreAnterior) {
                    e.distribuidor = nombre;
                }
            });
        }
    } else {
        db.distribuidores.push({
            id: generarId('dist'),
            owner: sesionUser.user,
            modulo: moduloActual,
            nombre,
            contacto,
            telefono,
            email,
            direccion,
            activo,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    guardarDatos();
    limpiarFormularioDistribuidor();
    renderModuloDistribuidores();
}

function editarDistribuidor(id) {
    const d = db.distribuidores.find(x => x.id === id && x.owner === sesionUser.user && x.modulo === moduloActual);
    if (!d) return;
    document.getElementById('dist_edit_id').value = d.id;
    document.getElementById('dist_nombre').value = d.nombre || '';
    document.getElementById('dist_contacto').value = d.contacto || '';
    document.getElementById('dist_telefono').value = d.telefono || '';
    document.getElementById('dist_email').value = d.email || '';
    document.getElementById('dist_direccion').value = d.direccion || '';
    document.getElementById('dist_estado').value = d.activo ? 'activo' : 'inactivo';
}

function eliminarDistribuidorSeleccionado() {
    if (bloquearAccionAdministrativaColaborador()) return;
    if (!validarPermiso()) return;
    const idEdit = document.getElementById('dist_edit_id')?.value || '';
    if (!idEdit) return alert('Seleccione un distribuidor para eliminar.');
    if (!confirm('¿Eliminar distribuidor y su catálogo asociado?')) return;
    const dist = db.distribuidores.find(d => d.id === idEdit);
    if (!dist) return;
    db.distribuidores = db.distribuidores.filter(d => d.id !== idEdit);
    db.catalogoDistribuidores = db.catalogoDistribuidores.filter(c => c.distId !== idEdit);
    db.almacen.forEach(a => {
        if (a.owner === sesionUser.user && a.modulo === moduloActual && a.distribuidor === dist.nombre) a.distribuidor = '';
    });
    guardarDatos();
    limpiarFormularioDistribuidor();
    renderModuloDistribuidores();
}

function renderTablaDistribuidores() {
    const tbody = document.getElementById('tabla-distribuidores');
    if (!tbody) return;
    const rows = obtenerDistribuidoresActuales()
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(d => {
            const productosDist = obtenerCatalogoDistribuidoresActual().filter(c => c.distId === d.id);
            const cantProductos = productosDist.length;

            let productosCero = [];
            let productosEnUso = [];
            productosDist.forEach(c => {
                const nombreProd = normalizarNombreProducto(c.nombreProducto);
                const alm = db.almacen.find(a =>
                    a.owner === sesionUser.user &&
                    a.modulo === moduloActual &&
                    normalizarNombreProducto(a.nombre) === nombreProd &&
                    normalizarNombreProducto(a.distribuidor) === normalizarNombreProducto(d.nombre)
                );
                if (!alm) return;
                const actual = Number(alm.actual || 0);
                const ideal = Number(alm.ideal || 0);
                if (actual <= 0) productosCero.push(c.nombreProducto);
                else if (ideal > 0 && actual < ideal) productosEnUso.push(c.nombreProducto);
            });

            const resumir = (arr) => {
                const unicos = [...new Set(arr.map(x => String(x || '').toUpperCase()))];
                if (unicos.length <= 2) return unicos.join(', ');
                return `${unicos.slice(0, 2).join(', ')} +${unicos.length - 2}`;
            };

            const alertaTexto = productosCero.length > 0
                ? `EN 0: ${resumir(productosCero)}`
                : (productosEnUso.length > 0 ? `EN USO: ${resumir(productosEnUso)}` : 'Sin alertas');

            const colorAlerta = productosCero.length > 0 ? '#FF2B00' : (productosEnUso.length > 0 ? '#FF9680' : '#2ecc71');
            const estiloDistrib = (productosCero.length > 0 || productosEnUso.length > 0)
                ? `color:${colorAlerta}; font-weight:900; animation: parpadeoRojo 0.9s infinite;`
                : 'font-weight:700;';

            return `
            <tr>
                <td><span style="${estiloDistrib}">${d.nombre}</span></td>
                <td>${d.activo ? '<span style="color:var(--success);font-weight:bold;">Activo</span>' : '<span style="color:var(--danger);font-weight:bold;">Inactivo</span>'}</td>
                <td>${d.contacto || '-'}</td>
                <td>${d.telefono || '-'}</td>
                <td>${d.email || '-'}</td>
                <td><span style="color:${colorAlerta}; font-weight:${(productosCero.length > 0 || productosEnUso.length > 0) ? '900' : '700'}; ${(productosCero.length > 0 || productosEnUso.length > 0) ? 'animation: parpadeoRojo 1s infinite;' : ''}">${alertaTexto}</span></td>
                <td><button class="btn btn-blue" onclick="verProductosDistribuidor('${d.id}')">${cantProductos} producto(s)</button></td>
                <td><button class="btn btn-warning" onclick="editarDistribuidor('${d.id}')">✏️ </button></td>
            </tr>
        `;
        }).join('');
    tbody.innerHTML = rows || '<tr><td colspan="8" style="text-align:center;color:#777;">Sin distribuidores registrados.</td></tr>';
}

function verProductosDistribuidor(distId) {
    const dist = db.distribuidores.find(d => d.id === distId && d.owner === sesionUser.user && d.modulo === moduloActual);
    const tbody = document.getElementById('tabla-dist-productos');
    const titulo = document.getElementById('dist-productos-titulo');
    const distHidden = document.getElementById('dist-productos-dist-id');
    const selectAll = document.getElementById('dist-prod-select-all');
    const modal = document.getElementById('modal-gestion-productos-distribuidor');
    if (!tbody || !titulo) return;
    if (!dist) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#777;">Distribuidor no encontrado.</td></tr>';
        return;
    }
    if (modal) modal.style.display = 'flex';
    if (distHidden) distHidden.value = distId;
    if (selectAll) selectAll.checked = false;
    titulo.textContent = `Productos de ${dist.nombre}`;
    const rows = obtenerCatalogoDistribuidoresActual()
        .filter(c => c.distId === distId)
        .sort((a, b) => a.nombreProducto.localeCompare(b.nombreProducto))
        .map(c => {
            const faltante = obtenerFaltanteProductoCatalogo(c);
            return `
            <tr data-catid="${c.id}">
                <td><input type="checkbox" class="dist-prod-check" data-catid="${c.id}" ${faltante.cantidad > 0 ? 'checked' : ''}</td>
                <td>${String(c.nombreProducto || '').toUpperCase()}</td>
                <td>${c.unidad}</td>
                <td>RD$${Number(c.precio || 0).toFixed(2)}</td>
                <td class="dist-prod-faltante" style="font-weight:bold; color:${faltante.cantidad > 0 ? 'var(--danger)' : 'var(--success)'};">${faltante.cantidad.toFixed(2)} ${faltante.unidad}</td>
                <td>${c.disponible ? 'Sí' : 'No'}</td>
                <td><button class="btn btn-purple" onclick="verDetalleProductoDistribuidor('${c.id}')">VER</button></td>
            </tr>
        `;
        }).join('');
    tbody.innerHTML = rows || '<tr><td colspan="7" style="text-align:center;color:#777;">Este distribuidor no tiene productos en catálogo.</td></tr>';
    actualizarFaltantesDistribuidorTabla();
}

function cerrarModalProductosDistribuidor() {
    const modal = document.getElementById('modal-gestion-productos-distribuidor');
    if (modal) modal.style.display = 'none';
}

function obtenerFaltanteProductoCatalogo(itemCatalogo) {
    const nombre = normalizarNombreProducto(itemCatalogo?.nombreProducto);
    if (!nombre) return { cantidad: 0, unidad: itemCatalogo?.unidad || '' };
    const distNombre = itemCatalogo?.distNombre || '';
    let itemAlm = db.almacen.find(a =>
        a.owner === sesionUser.user &&
        a.modulo === moduloActual &&
        normalizarNombreProducto(a.nombre) === nombre &&
        normalizarNombreProducto(a.distribuidor) === normalizarNombreProducto(distNombre)
    );
    if (!itemAlm) {
        itemAlm = db.almacen.find(a =>
            a.owner === sesionUser.user &&
            a.modulo === moduloActual &&
            normalizarNombreProducto(a.nombre) === nombre
        );
    }
    if (!itemAlm) return { cantidad: 0, unidad: itemCatalogo.unidad };
    const faltanteAlmacen = Math.max(0, Number(itemAlm.ideal || 0) - Number(itemAlm.actual || 0));
    if (faltanteAlmacen <= 0) return { cantidad: 0, unidad: itemCatalogo.unidad };
    if (!esUnidadCompatible(itemAlm.unidad, itemCatalogo.unidad)) {
        return { cantidad: 0, unidad: itemCatalogo.unidad };
    }
    const faltanteCatalogo = convertirUnidad(faltanteAlmacen, itemAlm.unidad, itemCatalogo.unidad);
    return { cantidad: Number(faltanteCatalogo || 0), unidad: itemCatalogo.unidad };
}

function seleccionarTodosProductosDistribuidor(checkAll) {
    document.querySelectorAll('#tabla-dist-productos .dist-prod-check').forEach(chk => {
        chk.checked = !!checkAll;
    });
}

let distribuidorFaltanteLiveInterval = null;
function actualizarFaltantesDistribuidorTabla() {
    const activa = document.getElementById('distribuidores')?.classList.contains('active');
    if (!activa) return;
    const rows = document.querySelectorAll('#tabla-dist-productos tr[data-catid]');
    rows.forEach(row => {
        const catId = row.getAttribute('data-catid');
        if (!catId) return;
        const c = db.catalogoDistribuidores.find(x => x.id === catId && x.owner === sesionUser.user && x.modulo === moduloActual);
        if (!c) return;
        const faltante = obtenerFaltanteProductoCatalogo(c);
        const celda = row.querySelector('.dist-prod-faltante');
        if (celda) {
            celda.textContent = `${faltante.cantidad.toFixed(2)} ${faltante.unidad}`;
            celda.style.color = faltante.cantidad > 0 ? 'var(--danger)' : 'var(--success)';
        }
    });
}

function iniciarFaltantesDistribuidorEnVivo() {
    if (distribuidorFaltanteLiveInterval) return;
    distribuidorFaltanteLiveInterval = setInterval(() => {
        actualizarFaltantesDistribuidorTabla();
    }, 3000);
}

function pedirProductosDistribuidorSeleccionados() {
    const distId = document.getElementById('dist-productos-dist-id')?.value || '';
    const dist = db.distribuidores.find(d => d.id === distId && d.owner === sesionUser.user && d.modulo === moduloActual);
    if (!dist) return alert('Seleccione un distribuidor primero.');

    const idsSeleccionados = Array.from(document.querySelectorAll('#tabla-dist-productos .dist-prod-check:checked'))
        .map(chk => chk.getAttribute('data-catid'))
        .filter(Boolean);
    if (!idsSeleccionados.length) return alert('Seleccione al menos un producto para pedir.');

    const items = idsSeleccionados
        .map(id => db.catalogoDistribuidores.find(c => c.id === id && c.owner === sesionUser.user && c.modulo === moduloActual))
        .filter(Boolean);

    const faltantes = items.map(it => ({ item: it, faltante: obtenerFaltanteProductoCatalogo(it) }))
        .filter(x => x.faltante.cantidad > 0);

    if (!faltantes.length) return alert('Los productos seleccionados no tienen faltante para completar stock.');

    let mensaje = `Nombre de Distribuidor: ${dist.nombre}\n`;
    mensaje += `Asunto: Pedido de reposición\n`;
    mensaje += `Cantidad a pedir:\n`;
    faltantes.forEach(x => {
        mensaje += `- ${String(x.item.nombreProducto || '').toUpperCase()}: ${x.faltante.cantidad.toFixed(2)} ${x.faltante.unidad}\n`;
    });

    abrirWhatsAppConMensaje(dist.telefono || WHATSAPP_DEFAULT, mensaje);
}

function verDetalleProductoDistribuidor(catId) {
    const c = db.catalogoDistribuidores.find(x => x.id === catId && x.owner === sesionUser.user && x.modulo === moduloActual);
    if (!c) return;
    alert(`Producto: ${String(c.nombreProducto || '').toUpperCase()}\nDistribuidor: ${c.distNombre}\nPrecio: RD$${Number(c.precio || 0).toFixed(2)} por ${c.unidad}\nDisponible: ${c.disponible ? 'Sí' : 'No'}\nActualizado: ${new Date(c.updatedAt || Date.now()).toLocaleString()}`);
}

function limpiarFormularioCatalogo() {
    ['cat_producto', 'cat_precio', 'cat_edit_key'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const disp = document.getElementById('cat_disponible');
    if (disp) disp.checked = true;
}

function guardarCatalogoDistribuidor() {
    if (bloquearAccionAdministrativaColaborador()) return;
    const distId = document.getElementById('cat_dist')?.value || '';
    const producto = normalizarNombreProducto(document.getElementById('cat_producto')?.value || '');
    const unidad = document.getElementById('cat_unidad')?.value || '';
    const precio = parseFloat(document.getElementById('cat_precio')?.value) || 0;
    const disponible = !!document.getElementById('cat_disponible')?.checked;

    if (!distId || !producto || !unidad || precio <= 0) return alert('Complete distribuidor, producto, unidad y precio válido.');
    const dist = db.distribuidores.find(d => d.id === distId && d.owner === sesionUser.user && d.modulo === moduloActual);
    if (!dist) return alert('Distribuidor no válido.');

    const existente = db.catalogoDistribuidores.find(c =>
        c.owner === sesionUser.user && c.modulo === moduloActual && c.distId === distId &&
        c.nombreProducto === producto && c.unidad === unidad
    );

    if (existente) {
        const historial = Array.isArray(existente.historialPrecios) ? existente.historialPrecios : [];
        historial.push({ fecha: new Date().toISOString(), precio: Number(existente.precio || 0), disponible: !!existente.disponible });
        existente.precio = precio;
        existente.disponible = disponible;
        existente.updatedAt = new Date().toISOString();
        existente.historialPrecios = historial.slice(-200);
    } else {
        db.catalogoDistribuidores.push({
            id: generarId('cat'),
            owner: sesionUser.user,
            modulo: moduloActual,
            distId,
            distNombre: dist.nombre,
            nombreProducto: producto,
            unidad,
            precio,
            disponible,
            updatedAt: new Date().toISOString(),
            historialPrecios: []
        });
    }

    guardarDatos();
    limpiarFormularioCatalogo();
    renderModuloDistribuidores();
}

function registrarCatalogoDesdeEntradaAlmacen(nombreProducto, distribuidorNombre, unidad, costoTotal, cantidadEntrada) {
    const prod = normalizarNombreProducto(nombreProducto);
    if (!prod || !distribuidorNombre || !unidad) return;
    const cant = Number(cantidadEntrada || 0);
    const costo = Number(costoTotal || 0);
    if (cant <= 0 || costo < 0) return;
    const precioUnitario = costo / cant;
    if (!isFinite(precioUnitario) || precioUnitario <= 0) return;

    const dist = obtenerDistribuidoresActuales().find(d => d.nombre === distribuidorNombre);
    if (!dist) return;

    const existente = db.catalogoDistribuidores.find(c =>
        c.owner === sesionUser.user &&
        c.modulo === moduloActual &&
        c.distId === dist.id &&
        c.nombreProducto === prod &&
        c.unidad === unidad
    );

    if (existente) {
        const historial = Array.isArray(existente.historialPrecios) ? existente.historialPrecios : [];
        if (Number(existente.precio || 0) !== Number(precioUnitario)) {
            historial.push({ fecha: new Date().toISOString(), precio: Number(existente.precio || 0), disponible: !!existente.disponible });
            existente.historialPrecios = historial.slice(-200);
        }
        existente.precio = precioUnitario;
        existente.disponible = true;
        existente.updatedAt = new Date().toISOString();
    } else {
        db.catalogoDistribuidores.push({
            id: generarId('cat'),
            owner: sesionUser.user,
            modulo: moduloActual,
            distId: dist.id,
            distNombre: dist.nombre,
            nombreProducto: prod,
            unidad,
            precio: precioUnitario,
            disponible: true,
            updatedAt: new Date().toISOString(),
            historialPrecios: []
        });
    }
    aplicarVisibilidadModuloEspecial();
}

function aplicarVisibilidadModuloEspecial() {
    const esAdminModulo = esModuloAdministradorActual();

    document.querySelectorAll('.sidebar a[onclick*="showPage("]').forEach(link => {
        const on = link.getAttribute('onclick') || '';
        const m = on.match(/showPage\('([^']+)'\)/);
        if (!m) return;
        const pageId = m[1];
        let visible = esAdminModulo ? ADMIN_ONLY_PAGES.has(pageId) : !ADMIN_ONLY_PAGES.has(pageId);
        visible = visible && tienePermisoPagina(pageId);
        link.style.display = visible ? '' : 'none';
    });

    document.querySelectorAll('.folder-container').forEach(folder => {
        const visibles = Array.from(folder.querySelectorAll('.folder-content a'))
            .some(a => a.style.display !== 'none');
        folder.style.display = visibles ? '' : 'none';
    });
    aplicarRestriccionClientesPuntosUI();
}

function editarCatalogoDistribuidor(catId) {
    const c = db.catalogoDistribuidores.find(x => x.id === catId && x.owner === sesionUser.user && x.modulo === moduloActual);
    if (!c) return;
    document.getElementById('cat_dist').value = c.distId || '';
    actualizarOpcionesProductosCatalogo();
    document.getElementById('cat_producto').value = c.nombreProducto || '';
    document.getElementById('cat_unidad').value = c.unidad || 'Lb';
    document.getElementById('cat_precio').value = Number(c.precio || 0).toFixed(2);
    document.getElementById('cat_disponible').checked = !!c.disponible;
}

function eliminarCatalogoDistribuidor(catId) {
    if (bloquearAccionAdministrativaColaborador()) return;
    if (!confirm('¿Eliminar este precio del catálogo?')) return;
    db.catalogoDistribuidores = db.catalogoDistribuidores.filter(c => c.id !== catId);
    guardarDatos();
    renderModuloDistribuidores();
}

function renderTablaCatalogoDistribuidores() {
    const tbody = document.getElementById('tabla-catalogo-distribuidores');
    if (!tbody) return;
    const distribuidores = obtenerDistribuidoresActuales().sort((a, b) => a.nombre.localeCompare(b.nombre));
    const rows = distribuidores.map(d => {
        const productos = obtenerCatalogoDistribuidoresActual().filter(c => c.distId === d.id);
        const ultima = productos.length
            ? new Date(Math.max(...productos.map(p => new Date(p.updatedAt || 0).getTime()))).toLocaleString()
            : '-';
        return `
            <tr>
                <td>${d.nombre}</td>
                <td>${d.activo ? '<span style="color:var(--success);font-weight:bold;">Activo</span>' : '<span style="color:var(--danger);font-weight:bold;">Inactivo</span>'}</td>
                <td>${productos.length}</td>
                <td>${ultima}</td>
                <td><button class="btn btn-purple" onclick="abrirModalCatalogoDistribuidor('${d.id}')">VER PRODUCTOS</button></td>
            </tr>
        `;
    }).join('');
    tbody.innerHTML = rows || '<tr><td colspan="5" style="text-align:center;color:#777;">Sin distribuidores registrados.</td></tr>';
}

function abrirModalCatalogoDistribuidor(distId) {
    const modal = document.getElementById('modal-catalogo-distribuidor');
    const hidden = document.getElementById('modal-catalogo-dist-id');
    const titulo = document.getElementById('modal-catalogo-titulo');
    const dist = db.distribuidores.find(d => d.id === distId && d.owner === sesionUser.user && d.modulo === moduloActual);
    if (!modal || !hidden || !titulo || !dist) return;
    hidden.value = distId;
    titulo.textContent = `Productos de ${dist.nombre}`;
    renderProductosModalCatalogo(distId);
    modal.style.display = 'flex';
}

function cerrarModalCatalogoDistribuidor() {
    const modal = document.getElementById('modal-catalogo-distribuidor');
    if (modal) modal.style.display = 'none';
}

function renderProductosModalCatalogo(distId) {
    const tbody = document.getElementById('modal-catalogo-productos-body');
    if (!tbody) return;
    const rows = obtenerCatalogoDistribuidoresActual()
        .filter(c => c.distId === distId)
        .sort((a, b) => a.nombreProducto.localeCompare(b.nombreProducto))
        .map(c => `
            <tr>
                <td><button class="btn btn-blue" onclick="verDetalleProductoDistribuidor('${c.id}')">${String(c.nombreProducto || '').toUpperCase()}</button></td>
                <td>${c.unidad}</td>
                <td>RD$${Number(c.precio || 0).toFixed(2)}</td>
                <td>${c.disponible ? 'Sí' : 'No'}</td>
                <td>${new Date(c.updatedAt || Date.now()).toLocaleString()}</td>
                <td><button class="btn btn-warning" onclick="editarCatalogoDistribuidor('${c.id}')">✏️ </button><button class="btn btn-danger" onclick="eliminarCatalogoDistribuidor('${c.id}')">X</button></td>
            </tr>
        `).join('');
    tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:#777;">Este distribuidor no tiene productos en catálogo.</td></tr>';
}

function obtenerComparacionProducto(producto, unidadFiltro = '', exacto = true) {
    const p = normalizarNombreProducto(producto);
    let datos = obtenerCatalogoDistribuidoresActual().filter(c => exacto ? c.nombreProducto === p : c.nombreProducto.includes(p));
    if (unidadFiltro) {
        datos = datos.filter(c => esUnidadCompatible(c.unidad, unidadFiltro));
    }
    return datos.map(c => {
        const precioComp = unidadFiltro ? calcularPrecioUnitarioEnUnidad(c, unidadFiltro) : Number(c.precio || 0);
        return { ...c, precioComparado: precioComp };
    }).filter(c => c.precioComparado !== null).sort((a, b) => a.precioComparado - b.precioComparado);
}

function compararPreciosDistribuidores() {
    const producto = (document.getElementById('cmp_producto')?.value || '').trim();
    const unidadFiltro = document.getElementById('cmp_unidad')?.value || '';
    const tbody = document.getElementById('tabla-comparador-distribuidores');
    if (!tbody) return;
    if (!producto) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#777;">Escriba un producto para comparar.</td></tr>';
        return;
    }
    const lista = obtenerComparacionProducto(producto, unidadFiltro, true);
    tbody.innerHTML = lista.map((c, idx) => `
        <tr style="${idx === 0 ? 'background:#e8f5e9;' : ''}">
            <td>${String(c.nombreProducto || '').toUpperCase()}</td>
            <td>${c.distNombre}</td>
            <td>${unidadFiltro || c.unidad}</td>
            <td>RD$${Number(c.precioComparado || 0).toFixed(2)}</td>
            <td>${c.disponible ? 'Disponible' : 'No disponible'}</td>
            <td><button class="btn btn-save" onclick="seleccionarProveedorComparador('${c.id}','${unidadFiltro}')">USAR</button></td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:#777;">Sin coincidencias exactas. Escriba el nombre exacto del producto.</td></tr>';
}

function seleccionarProveedorComparador(catId, unidadObjetivo = '') {
    const item = db.catalogoDistribuidores.find(c => c.id === catId && c.owner === sesionUser.user && c.modulo === moduloActual);
    if (!item) return;
    seleccionarProveedorParaAlmacen(item.distNombre, item.nombreProducto, unidadObjetivo || item.unidad, Number(item.precio || 0));
}

function seleccionarProveedorParaAlmacen(distribuidor, producto, unidadCatalogo, precioCatalogo) {
    showPage('inventario');
    const inputNom = document.getElementById('inv_nombre');
    const selectDist = document.getElementById('inv_dist_select');
    const selectUnid = document.getElementById('inv_unidad');
    if (inputNom) inputNom.value = String(producto || '').toLowerCase();
    if (selectDist) selectDist.value = distribuidor || '';
    if (selectUnid && unidadCatalogo && esUnidadCompatible(unidadCatalogo, selectUnid.value || unidadCatalogo)) {
        if (!selectUnid.value) selectUnid.value = unidadCatalogo;
    }
    autocompletarCostoPorCatalogo(precioCatalogo, unidadCatalogo);
}

function autocompletarCostoPorCatalogo(precioDirecto = null, unidadPrecioDirecto = '') {
    const nom = normalizarNombreProducto(document.getElementById('inv_nombre')?.value || '');
    const dist = document.getElementById('inv_dist_select')?.value || '';
    const unidad = document.getElementById('inv_unidad')?.value || '';
    const cant = parseFloat(document.getElementById('inv_actual')?.value) || 0;
    const costoInput = document.getElementById('inv_costo_total');
    if (!nom || !dist || !unidad || cant <= 0 || !costoInput) return;

    let precioUnit = null;
    if (precioDirecto !== null && unidadPrecioDirecto && esUnidadCompatible(unidadPrecioDirecto, unidad)) {
        const fake = { unidad: unidadPrecioDirecto, precio: Number(precioDirecto || 0) };
        precioUnit = calcularPrecioUnitarioEnUnidad(fake, unidad);
    } else {
        const item = obtenerCatalogoDistribuidoresActual().find(c =>
            c.distNombre === dist &&
            c.nombreProducto === nom &&
            c.disponible &&
            esUnidadCompatible(c.unidad, unidad)
        );
        if (item) precioUnit = calcularPrecioUnitarioEnUnidad(item, unidad);
    }
    if (precioUnit !== null) {
        costoInput.value = (precioUnit * cant).toFixed(2);
    }
}

function buscarMejorProveedorEnAlmacen() {
    const nom = normalizarNombreProducto(document.getElementById('inv_nombre')?.value || '');
    const unidad = document.getElementById('inv_unidad')?.value || '';
    if (!nom) return alert('Escriba el nombre del producto.');
    const lista = obtenerComparacionProducto(nom, unidad);
    if (!lista.length) return alert('No hay precios cargados para este producto.');
    const mejor = lista[0];
    const sel = document.getElementById('inv_dist_select');
    if (sel) sel.value = mejor.distNombre || '';
    autocompletarCostoPorCatalogo(mejor.precio, mejor.unidad);
    alert(`Proveedor sugerido: ${mejor.distNombre} | RD$${Number(mejor.precioComparado || 0).toFixed(2)} ${unidad || mejor.unidad}`);
}

let cacheDetalleComprasDistribuidor = [];

function obtenerKeyDia(fechaRaw) {
    const f = parseFechaRegistro(fechaRaw);
    if (!f) return '';
    const y = f.getFullYear();
    const m = String(f.getMonth() + 1).padStart(2, '0');
    const d = String(f.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function obtenerResumenComprasDistribuidor(idDesde = '', idHasta = '') {
    const entradas = (db.entradas || []).filter(e => {
        if (e.owner !== sesionUser.user || !moduloPerteneceVista(e.modulo)) return false;
        if (!e.distribuidor) return false;
        if (idDesde || idHasta) {
            if (!fechaDentroRango(e.fecha, idDesde, idHasta)) return false;
        }
        return true;
    });

    const mapa = new Map();
    entradas.forEach(e => {
        const key = e.distribuidor || 'SIN DISTRIBUIDOR';
        if (!mapa.has(key)) {
            mapa.set(key, { distribuidor: key, entradas: 0, monto: 0, ultimaFecha: '', ultimaTs: 0, ultimaDiaKey: '' });
        }
        const row = mapa.get(key);
        row.entradas += 1;
        row.monto += Number(e.costoTotal || 0);
        const f = parseFechaRegistro(e.fecha);
        const ts = f ? f.getTime() : 0;
        if (ts >= row.ultimaTs) {
            row.ultimaTs = ts;
            row.ultimaFecha = e.fecha || '';
            row.ultimaDiaKey = obtenerKeyDia(e.fecha);
        }
    });
    return Array.from(mapa.values()).sort((a, b) => b.monto - a.monto);
}

function renderReporteComprasDistribuidor() {
    const tbody = document.getElementById('tabla-reporte-distribuidores');
    if (!tbody) return;
    const resumen = obtenerResumenComprasDistribuidor();
    const filas = resumen.map(r => `
        <tr>
            <td>${r.distribuidor}</td>
            <td>${r.entradas}</td>
            <td>RD$${Number(r.monto || 0).toFixed(2)}</td>
            <td>${r.ultimaFecha || '-'}</td>
        </tr>
    `).join('');
    tbody.innerHTML = filas || '<tr><td colspan="4" style="text-align:center;color:#777;">Sin compras registradas.</td></tr>';
}

function renderHistorialComprasDistribuidor() {
    const tbody = document.getElementById('tabla-historial-compras-distribuidor');
    if (!tbody) return;
    const resumen = obtenerResumenComprasDistribuidor('filtro-compra-dist-desde', 'filtro-compra-dist-hasta');
    cacheDetalleComprasDistribuidor = resumen;
    const filas = resumen.map((r, idx) => `
        <tr>
            <td>${r.distribuidor}</td>
            <td>${r.entradas}</td>
            <td>RD$${Number(r.monto || 0).toFixed(2)}</td>
            <td><button class="btn btn-blue" onclick="abrirDetalleCompraDistribuidor(${idx})">${r.ultimaFecha || '-'}</button></td>
        </tr>
    `).join('');
    tbody.innerHTML = filas || '<tr><td colspan="4" style="text-align:center;color:#777;">Sin compras registradas en el rango.</td></tr>';
}

function abrirDetalleCompraDistribuidor(index) {
    const ref = cacheDetalleComprasDistribuidor[index];
    if (!ref) return;
    const modal = document.getElementById('modal-detalle-compra-distribuidor');
    const titulo = document.getElementById('detalle-compra-dist-titulo');
    const tbody = document.getElementById('tabla-detalle-compra-distribuidor');
    const totalBox = document.getElementById('total-detalle-compra-distribuidor');
    if (!modal || !titulo || !tbody || !totalBox) return;

    const items = (db.entradas || []).filter(e =>
        e.owner === sesionUser.user &&
        moduloPerteneceVista(e.modulo) &&
        (e.distribuidor || '') === ref.distribuidor &&
        obtenerKeyDia(e.fecha) === ref.ultimaDiaKey
    );

    let total = 0;
    const filas = items.map(e => {
        const monto = Number(e.costoTotal || 0);
        total += monto;
        return `<tr><td>${String(e.producto || '').toUpperCase()}</td><td>${e.cant || 0}</td><td>${e.medida || '---'}</td><td>RD$${monto.toFixed(2)}</td></tr>`;
    }).join('');

    titulo.textContent = `Detalle ${ref.distribuidor} - ${ref.ultimaFecha || ''}`;
    tbody.innerHTML = filas || '<tr><td colspan="4" style="text-align:center;color:#777;">Sin productos registrados para esa fecha.</td></tr>';
    totalBox.innerText = `MONTO TOTAL DE ENTRADA: RD$${total.toFixed(2)}`;
    modal.style.display = 'flex';
}

function cerrarModalDetalleCompraDistribuidor() {
    const modal = document.getElementById('modal-detalle-compra-distribuidor');
    if (modal) modal.style.display = 'none';
}

function renderModuloDistribuidores() {
    deduplicarCatalogoDistribuidoresActual();
    actualizarSelectDistribuidores();
    actualizarOpcionesProductosCatalogo();
    actualizarOpcionesComparadorProductos();
    renderTablaDistribuidores();
    renderTablaCatalogoDistribuidores();
    renderReporteComprasDistribuidor();
    const cmp = document.getElementById('tabla-comparador-distribuidores');
    if (cmp && !cmp.innerHTML.trim()) {
        cmp.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#777;">Busque un producto para comparar precios.</td></tr>';
    }
    const tblDistProd = document.getElementById('tabla-dist-productos');
    if (tblDistProd && !tblDistProd.innerHTML.trim()) {
        tblDistProd.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#777;">Seleccione un distribuidor para ver sus productos.</td></tr>';
    }
    const modalAbierto = document.getElementById('modal-catalogo-distribuidor')?.style.display === 'flex';
    if (modalAbierto) {
        const distId = document.getElementById('modal-catalogo-dist-id')?.value || '';
        if (distId) renderProductosModalCatalogo(distId);
    }
    iniciarFaltantesDistribuidorEnVivo();
    actualizarFaltantesDistribuidorTabla();
}

function buscarPlatoVenta() { 
  const t = document.getElementById('busqueda-plato').value.toLowerCase(); 
  const r = document.getElementById('contenedor-salidas-busqueda'); 
  r.innerHTML = ""; 
  if(!t) return; 

  db.platos.filter(p => 
    p.owner === sesionUser.user && 
    p.modulo === moduloActual && 
    p.nombre.toLowerCase().includes(t)
  ).forEach(p => { 
    // Buscamos el índice real en la base de datos para pasarlo a la factura
    const indexReal = db.platos.indexOf(p);
    
    r.innerHTML += `
      <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong>${p.nombre} (Existencia: ${p.stock})</strong>
        <button class="btn btn-save" onclick="transferirAFactura(${indexReal})">FACTURAR</button>
      </div>`; 
  }); 
}

function venderPlato() {
    const platoNombre = document.getElementById('salidaPlato').value;
    const cantidadVenta = parseFloat(document.getElementById('salidaCantidad').value);

    if (!platoNombre || isNaN(cantidadVenta) || cantidadVenta <= 0) {
        return alert("Seleccione un plato y cantidad válida.");
    }

    // Buscamos el plato creado en "Agregar Plato"
    const plato = db.platos.find(p => p.nombre === platoNombre && p.owner === sesionUser.user);
    if (!plato) return alert("Plato no encontrado.");

    // --- FASE 1: CÁLCULO DE DISPONIBILIDAD REAL CON CONVERSIÓN ---
    let disponibilidadReal = Infinity;
    let ingredienteCritico = "";

    plato.receta.forEach(ing => {
        // Buscamos el ingrediente tanto en Almacén como en Semielaborados (Producción)
        const item = db.almacen.find(a => a.nombre === ing.nombre && a.modulo === moduloActual && a.owner === sesionUser.user) ||
                     db.produccion_stock.find(p => p.nombre === ing.nombre && p.modulo === moduloActual && p.owner === sesionUser.user);
        
        if (item) {
            // CONVERSIÓN: Pasamos el stock disponible a la unidad que pide la receta
            // Ej: Si hay 1 Lb en stock y la receta pide Oz, convertimos 1 Lb a 16 Oz para el cálculo
            const stockEnUnidadReceta = convertirUnidad(item.actual, item.unidad, ing.unidad);
            
            let racionesPosibles = stockEnUnidadReceta / ing.cantidad;
            if (racionesPosibles < disponibilidadReal) {
                disponibilidadReal = racionesPosibles;
                ingredienteCritico = ing.nombre;
            }
        } else {
            disponibilidadReal = 0;
            ingredienteCritico = ing.nombre;
        }
    });

    if (disponibilidadReal < 0) disponibilidadReal = 0;

    // --- BLOQUEO POR STOCK CERO ---
    if (disponibilidadReal <= 0) {
        return alert(`🚫 PRODUCTO SIN STOCK\nEl ingrediente "${ingredienteCritico}" está agotado. No se puede realizar la venta.`);
    }

    // --- FASE 2: AUTORIZACIÓN POR FALTANTE ---
    if (cantidadVenta > disponibilidadReal) {
        let falta = (cantidadVenta - disponibilidadReal).toFixed(2);
        let autorizar = confirm(`⚠️ STOCK INSUFICIENTE:\nSegún la disponibilidad, solo puede hacer ${disponibilidadReal.toFixed(1)} raciones.\nFaltan ${falta} raciones.\n\n¿Desea autorizar la venta con contraseña?`);
        
        if (!autorizar) return;

        let pass = prompt("SEGURIDAD: Ingrese su contraseña:");
        if (pass !== sesionUser.pass) return alert("❌ Contraseña incorrecta.");
        
        if(!db.incidencias) db.incidencias = [];
        db.incidencias.push({
            fecha: new Date().toLocaleString(),
            operador: sesionUser.user,
            item: platoNombre,
            ingredientesEnCero: `Faltante: ${falta} raciones (Insumo: ${ingredienteCritico})`,
            motivo: "Venta autorizada superando stock"
        });
    }

    // --- FASE 3: PROCESAR DESCUENTO REAL CON CONVERSIÓN ---
    plato.receta.forEach(ing => {
        // Buscamos nuevamente en Almacén o Semielaborados
        const itemStock = db.almacen.find(a => a.nombre === ing.nombre && a.modulo === moduloActual && a.owner === sesionUser.user) ||
                          db.produccion_stock.find(p => p.nombre === ing.nombre && p.modulo === moduloActual && p.owner === sesionUser.user);
        
        if (itemStock) {
            // 1. Calculamos cuánto se necesita según la receta (Ej: 5 Oz * 2 Platos = 10 Oz)
            const cantidadTotalReceta = ing.cantidad * cantidadVenta;
            
            // 2. CONVERSIÓN: Convertimos esas 10 Oz a la unidad del Stock (Ej: Lb)
            const cantidadARestarStock = convertirUnidad(cantidadTotalReceta, ing.unidad, itemStock.unidad);
            
            // 3. Descontamos
            itemStock.actual -= cantidadARestarStock;
        }
    });

    // Registrar salida
    db.salidas.push({
        fecha: new Date().toLocaleString(),
        plato: platoNombre,
        cantidad: cantidadVenta,
        operador: sesionUser.user,
        modulo: moduloActual,
        owner: sesionUser.user
    });

    guardarDatos();
    alert("✅ Venta registrada y stock descontado correctamente.");
    location.reload();
}

    function agregarFilaIngrediente() { 
        const div = document.createElement('div'); div.className = 'ingrediente-row'; 
        const ownerActivo = ownerDatosActivo();
        const alm = db.almacen.filter(a => String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual);
        const prod = db.produccion_stock.filter(p => String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual);
        let opts = '<option value="">Seleccionar...</option>';
        opts += '<optgroup label="ALMACÉN">' + alm.map(a => `<option value="${a.nombre}">${a.nombre.toUpperCase()}</option>`).join('') + '</optgroup>';
        opts += '<optgroup label="PRODUCCIÓN">' + prod.map(p => `<option value="${p.nombre}">${p.nombre.toUpperCase()} (P)</option>`).join('') + '</optgroup>';
        let unidOpts = '<option value="g">g</option><option value="Oz">Oz</option><option value="Lb">Lb</option><option value="mL">mL</option><option value="Unidad">Unid</option>';
        div.innerHTML = `<select class="ing-nom" onchange="recalculateAndVerify()">${opts}</select><input type="number" class="ing-cant" placeholder="Cant." onkeyup="recalculateAndVerify()"><select class="ing-unid" onchange="recalculateAndVerify()">${unidOpts}</select><button class="btn btn-danger" onclick="this.parentElement.remove(); recalcularCostoReceta();">X</button>`; 
        document.getElementById('contenedor-ingredientes').appendChild(div); 
    }

    function recalculateAndVerify() { recalcularCostoReceta(); }

    function recalcularCostoReceta() { 
      const ownerActivo = ownerDatosActivo();
      let t = 0;
      document.querySelectorAll('#contenedor-ingredientes .ingrediente-row').forEach(row => { 
        const nom = row.querySelector('.ing-nom').value; 
        const cant = parseFloat(row.querySelector('.ing-cant').value) || 0; 
        const unid = row.querySelector('.ing-unid').value; 
        const item = db.almacen.find(a => a.nombre === nom && String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual) || 
                     db.produccion_stock.find(p => p.nombre === nom && String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual); 
        if(item) { 
          const cantidadConvertida = convertirUnidad(cant, unid, item.unidad);
          t += ((item.costoUnitario || 0) * cantidadConvertida); 
        } 
      });
      document.getElementById('p_costo').value = t.toFixed(2);
      let totalTax = 0; document.querySelectorAll('.tax-check:checked').forEach(cb => { totalTax += parseFloat(cb.value); });
      let costoFinal = t * (1 + totalTax);
      if(totalTax > 0) { document.getElementById('row-tax-visual').style.display = 'block'; document.getElementById('p_costo_tax').value = costoFinal.toFixed(2); }
      else { document.getElementById('row-tax-visual').style.display = 'none'; document.getElementById('p_costo_tax').value = t.toFixed(2); }
      document.getElementById('p_recom').value = (costoFinal * 3).toFixed(2);
    }

// 1. Esta función detecta si el plato existe y CARGA los ingredientes automáticamente
function verificarPlatoExistente() {
    const nombreInput = document.getElementById('p_nombre').value.trim().toLowerCase();
    const ownerActivo = String(window.obtenerOwnerSesionActual?.() || sesionUser?.user || '').trim().toLowerCase();
    const alerta = document.getElementById('alerta-existente');
    const btnGuardar = document.getElementById('btn-guardar-plato');
    const titulo = document.getElementById('titulo-receta');
    
    // Buscamos si el nombre que escribes ya está en tu menú
    const platoExistente = db.platos.find(p => 
        p.nombre.toLowerCase() === nombreInput && 
        String(p.owner || '').trim().toLowerCase() === ownerActivo && 
        p.modulo === moduloActual
    );

    if (platoExistente && nombreInput !== "") {
        // Muestra el mensaje que pediste
        alerta.style.display = 'block';
        alerta.innerHTML = `⚠️ <strong>(PLATO YA EXISTENTE)</strong>: Se han cargado los ingredientes. Al guardar, se actualizará la receta actual.`;
        
        // Cambia el botón a modo Actualizar
        btnGuardar.innerText = "ACTUALIZAR DATOS DEL PLATO";
        btnGuardar.style.background = "#ff9f43"; 
        titulo.innerText = "✏️ Editando Plato";

        // ACCIÓN: Carga los ingredientes automáticamente en pantalla
        cargarIngredientesAlFormulario(platoExistente);
    } else {
        // Si el plato es nuevo, limpia la alerta y deja el botón normal
        alerta.style.display = 'none';
        btnGuardar.innerText = "GUARDAR EN EL MENÚ";
        btnGuardar.style.background = "var(--success)";
        titulo.innerText = "🧪 Crear Receta Nueva";
    }
}

// 2. Función auxiliar para rellenar las filas de ingredientes
function cargarIngredientesAlFormulario(plato) {
    const contenedor = document.getElementById('contenedor-ingredientes');
    contenedor.innerHTML = ""; // Limpiamos para no duplicar filas
    
    plato.receta.forEach(ing => {
        agregarFilaIngrediente(); // Llama a tu función que crea la fila vacía
        let filas = contenedor.querySelectorAll('.ingrediente-row');
        let ultima = filas[filas.length - 1];
        
        // Rellenamos la fila con lo que ya tenía el plato guardado
        ultima.querySelector('.ing-nom').value = ing.nombre;
        ultima.querySelector('.ing-cant').value = ing.cantidad;
        ultima.querySelector('.ing-unid').value = ing.unidad;
    });
    recalcularCostoReceta(); // Actualiza los cálculos de costo en tiempo real
}

// 3. Esta función reemplaza a la anterior para permitir ACTUALIZAR
function guardarPlatoNuevo() {
    if (!tryBeginUiActionLock('guardar-plato')) return;
    try {
    if (bloquearAccionAdministrativaColaborador()) return;
    recalcularCostoReceta();
    const ownerActivo = String(window.obtenerOwnerSesionActual?.() || sesionUser?.user || '').trim().toLowerCase();
    if (!ownerActivo) return alert("No se pudo identificar el usuario maestro activo.");
    const nombre = document.getElementById('p_nombre').value.trim();
    const precio = parseFloat(document.getElementById('p_precio').value);
    const costoProdBase = parseFloat(document.getElementById('p_costo').value) || 0;
    const costoProdTax = parseFloat(document.getElementById('p_costo_tax').value) || costoProdBase;
    let totalTax = 0;
    document.querySelectorAll('.tax-check:checked').forEach(cb => {
        totalTax += parseFloat(cb.value) || 0;
    });
    const costoProdFinal = totalTax > 0 ? costoProdTax : costoProdBase;
    
    if (!nombre || isNaN(precio)) return alert("Por favor, ingresa nombre y precio.");

    let receta = [];
    document.querySelectorAll('.ingrediente-row').forEach(f => {
        const n = f.querySelector('.ing-nom').value;
        const c = parseFloat(f.querySelector('.ing-cant').value);
        const u = f.querySelector('.ing-unid').value;
        if (n && c) receta.push({ nombre: n, cantidad: c, unidad: u });
    });

    // Buscamos si ya existe para sobrescribirlo
    const index = db.platos.findIndex(p => 
        p.nombre.toLowerCase() === nombre.toLowerCase() && 
        String(p.owner || '').trim().toLowerCase() === ownerActivo && 
        p.modulo === moduloActual
    );

    const datosPlato = {
        nombre: nombre,
        precio: precio,
        costo: costoProdFinal,
        costoBase: costoProdBase,
        costoConImpuestos: costoProdFinal,
        impuestoAplicado: totalTax,
        receta: receta,
        stock: (index !== -1) ? db.platos[index].stock : 0, // Mantiene el stock si ya existía
        owner: ownerActivo,
        modulo: moduloActual
    };

    if (index !== -1) {
        db.platos[index] = datosPlato; // ACTUALIZA
        alert("✅ El plato ha sido actualizado correctamente.");
    } else {
        db.platos.push(datosPlato); // CREA NUEVO
        alert("✅ Plato guardado en el menú.");
    }

    guardarDatos();
    limpiarFormularioPlato();
    showPage('home'); 
    } finally {
        endUiActionLock('guardar-plato');
    }
}

// 4. Función para limpiar todo después de guardar (Agrégala si no la tienes)
function limpiarFormularioPlato() {
    document.getElementById('p_nombre').value = "";
    document.getElementById('p_precio').value = "";
    document.getElementById('contenedor-ingredientes').innerHTML = "";
    document.getElementById('alerta-existente').style.display = 'none';
    recalcularCostoReceta();
}

    // Funciones de apoyo (Validación, Limpieza, etc.)
    function validarPermiso() {
        if (esModoBasicoColaborador()) {
            alert("⛔ Los colaboradores no tienen permisos administrativos.");
            return false;
        }
        const p = prompt("Contraseña de seguridad:");
        return (p === sesionUser.pass);
    }
    function regresarAModulos() { document.getElementById('sidebar').style.display = 'none'; document.getElementById('main-content').style.display = 'none'; renderModuleSelectorCards(); document.getElementById('module-selector').style.display = 'flex'; }
    function cambiarUsuario() { document.getElementById('log_user').value = ""; document.getElementById('log_user').disabled = false; document.getElementById('log_pass').value = ""; document.getElementById('login-overlay').style.display = 'flex'; document.getElementById('sidebar').style.display = 'none'; document.getElementById('main-content').style.display = 'none'; detenerAutoRefreshBovedaMaster(); if (typeof window.detenerGuardiaSesionActiva === 'function') window.detenerGuardiaSesionActiva(); if (typeof window.detenerListenerCloudTiempoReal === 'function') window.detenerListenerCloudTiempoReal(); if (typeof window.cerrarSesionBackend === 'function') window.cerrarSesionBackend(); }
    function cerrarSesion() {
      guardarDatos();
      detenerAutoRefreshBovedaMaster();
      if (typeof window.detenerGuardiaSesionActiva === 'function') window.detenerGuardiaSesionActiva();
      if (typeof window.detenerListenerCloudTiempoReal === 'function') window.detenerListenerCloudTiempoReal();
      location.reload();
    }
    
// --- LÓGICA DE ALMACÉN INTELIGENTE Y SEGURO (VERSIÓN FINAL) ---

// 1. ESCUCHADORES PARA AUTORRELLENO Y COSTO AUTOMÁTICO
document.getElementById('inv_nombre').addEventListener('input', function(e) {
    const busqueda = e.target.value.toLowerCase().trim();
    if(!busqueda) return;

    // Buscar si el producto ya existe en la base de datos
    let existente = db.almacen.find(a => a.nombre === busqueda && a.owner === sesionUser.user && a.modulo === moduloActual);

    if(existente) {
        // Autorrelleno de datos previos
        document.getElementById('inv_ideal').value = existente.ideal;
        document.getElementById('inv_unidad').value = existente.unidad;
        document.getElementById('inv_dist_select').value = existente.distribuidor || "";
        
        // Guardar el costo unitario para calcular el total automáticamente
        e.target.dataset.ultimoCosto = existente.costoUnitario;
        calcularCostoAutomatico();
    }
    autocompletarCostoPorCatalogo();
});

// --- LÓGICA DE ALMACÉN: CARGA INTELIGENTE Y COSTO PONDERADO ---

// 1. EVENTO: Calcular costo de la entrada actual basado en el precio histórico

function agregarAlmacen() { 
    if (!tryBeginUiActionLock('agregar-almacen')) return;
    try {
    if (bloquearAccionAdministrativaColaborador()) return;
    if (!tieneAsignacionEntrada('manual')) {
        return alert("🚫 No tiene asignación para registrar entradas manuales.");
    }
    // Referencias a los inputs (usando tus IDs originales)
    const inputNom = document.getElementById('inv_nombre'); 
    const inputCant = document.getElementById('inv_actual'); 
    const inputIdeal = document.getElementById('inv_ideal'); 
    const inputCosto = document.getElementById('inv_costo_total'); 
    const inputUnid = document.getElementById('inv_unidad'); 
    // Ajustado para usar el ID del distribuidor de tu script original
    const inputDist = document.getElementById('inv_dist_select') || document.getElementById('inv_dist');
    
    const nom = inputNom.value.toLowerCase().trim(); 
    const cantEntradaOriginal = parseFloat(inputCant.value) || 0; 
    const costoCompraHoy = parseFloat(inputCosto.value) || 0; 
    const ideal = parseFloat(inputIdeal.value) || 0; 
    const unidEntrada = inputUnid.value; 
    let dist = inputDist.value;

    if(!nom || isNaN(cantEntradaOriginal) || cantEntradaOriginal <= 0) {
        return alert("Debe ingresar el nombre y la cantidad de la nueva entrada."); 
    }

    if (!dist) {
        const candidatos = obtenerComparacionProducto(nom, unidEntrada);
        if (candidatos.length > 0) {
            dist = candidatos[0].distNombre;
            if (inputDist) inputDist.value = dist;
        }
    }

    let item = db.almacen.find(a => a.nombre === nom && a.owner === sesionUser.user && a.modulo === moduloActual); 
    
    if(item) { 
        // --- NUEVA LÓGICA DE CONVERSIÓN ---
        // Convertimos la cantidad que entra a la unidad que ya tiene el producto en el sistema
        const cantEntradaConvertida = convertirUnidad(cantEntradaOriginal, unidEntrada, item.unidad);

        // --- CÁLCULO DE PROMEDIO PONDERADO ---
        // Valor total de lo que ya existe + Valor de la nueva compra
        let inversionTotalAnterior = item.actual * item.costoUnitario;
        let nuevaInversionTotal = inversionTotalAnterior + costoCompraHoy;
        let nuevaCantidadTotal = item.actual + cantEntradaConvertida;

        // El nuevo costo unitario es el promedio basado en la unidad base del sistema
        item.costoUnitario = nuevaInversionTotal / nuevaCantidadTotal; 
        item.actual = nuevaCantidadTotal; 
        
        // Actualizamos meta y proveedor
        item.ideal = ideal; 
        item.distribuidor = dist;
        // La unidad se mantiene como la original del item para no romper recetas
    } else { 
        // Si el producto es nuevo, se registra con la unidad de esta primera entrada
        db.almacen.push({
            owner: sesionUser.user, 
            modulo: moduloActual, 
            nombre: nom, 
            actual: cantEntradaOriginal, 
            ideal: ideal, 
            costoUnitario: costoCompraHoy / cantEntradaOriginal, 
            unidad: unidEntrada, 
            distribuidor: dist
        }); 
    } 

    // --- HISTORIAL DE AUDITORÍA (Se mantiene de tu original) ---
    db.entradas.push({
        owner: sesionUser.user, 
        modulo: moduloActual, 
        fecha: new Date().toLocaleString(), 
        producto: nom, 
        cant: cantEntradaOriginal, 
        medida: unidEntrada, 
        costoTotal: costoCompraHoy,
        distribuidor: dist || '',
        operador: typeof operadorActual !== 'undefined' ? operadorActual : 'Admin'
    }); 

    registrarCatalogoDesdeEntradaAlmacen(nom, dist, unidEntrada, costoCompraHoy, cantEntradaOriginal);

    guardarDatos(); // Usando el nombre de tu función original
    renderAlmacen(); 
    
    // Reset total del formulario y limpieza de metadatos
    inputNom.value = ""; 
    inputCant.value = ""; 
    inputIdeal.value = ""; 
    inputCosto.value = ""; 
    if(inputNom.dataset) delete inputNom.dataset.ultimoCosto;
    
    alert("Existencia actualizada. Se ha recalculado el costo unitario promedio y registrado la entrada.");
    } finally {
        endUiActionLock('agregar-almacen');
    }
}

// 4. RENDERIZADO CON PRIORIDADES (Rojo > Naranja)
function renderAlmacen(busqueda = "") { 
    let items = db.almacen.filter(a => a.owner === sesionUser.user && a.modulo === moduloActual);
    const modoBasico = esModoBasicoColaborador();

    // --- LÓGICA DE ORDENAMIENTO COMPLEJA ---
    items.sort((a, b) => {
        // 1. Prioridad por Búsqueda (Si el nombre coincide con lo que escribes, va arriba de todo)
        if (busqueda !== "") {
            const coincideA = a.nombre.toLowerCase().includes(busqueda);
            const coincideB = b.nombre.toLowerCase().includes(busqueda);
            if (coincideA && !coincideB) return -1;
            if (!coincideA && coincideB) return 1;
        }

        // 2. Prioridad por Alerta (Rojo > Naranja > OK)
        let prioridadA = a.actual <= 0 ? 2 : (a.actual <= (a.ideal * 0.20) ? 1 : 0);
        let prioridadB = b.actual <= 0 ? 2 : (b.actual <= (b.ideal * 0.20) ? 1 : 0);
        
        if (prioridadA !== prioridadB) {
            return prioridadB - prioridadA;
        }

        // 3. Orden alfabético si todo lo demás es igual
        return a.nombre.localeCompare(b.nombre);
    });

    const tabla = document.getElementById('tabla-inventario');
    tabla.innerHTML = items.map(it => { 
        let cantidadFaltante = it.ideal - it.actual; 
        if (cantidadFaltante < 0) cantidadFaltante = 0;
        let costoPorFaltante = cantidadFaltante * it.costoUnitario;

        let statusLabel = cantidadFaltante > 0 
            ? `<span style="color:orange">Falta: ${cantidadFaltante.toFixed(1)}</span>` 
            : '<span style="color:green">OK</span>'; 
        
        let claseAlerta = "";
        let estiloFila = "";

        // Si el producto coincide con la búsqueda, le damos un fondo de resaltado
        if (busqueda !== "" && it.nombre.toLowerCase().includes(busqueda)) {
            estiloFila = "background-color: #fff9c4; border: 2px solid var(--blue);"; // Amarillo claro con borde azul
        } else if (it.actual <= 0) {
            claseAlerta = "alerta-critica-roja";
            estiloFila = "background-color: rgba(255, 94, 87, 0.1);"; 
        } else if (it.actual <= (it.ideal * 0.20)) {
            claseAlerta = "alerta-aviso-naranja";
        }

        return `
            <tr style="${estiloFila}">
                <td><strong class="${claseAlerta}">${it.nombre.toUpperCase()}</strong> <small>(${it.ideal})</small></td>
                <td style="font-weight:bold;">${it.actual.toFixed(2)} ${it.unidad}</td>
                <td>RD$${it.costoUnitario.toFixed(2)}</td>
                <td>${statusLabel}</td>
                <td style="color: #2ecc71; font-weight: bold;">RD$${costoPorFaltante.toFixed(2)}</td>
                <td>${modoBasico ? '<span style="color:#999;">Solo lectura</span>' : `<button class="btn btn-warning" onclick="prepararEdicionAlmacen('${it.nombre}')">✏️ </button><button class="btn btn-danger" onclick="eliminarAlmacen('${it.nombre}')">X</button>`}</td>
            </tr>`; 
    }).join('');

    actualizarSelectDistribuidores();
}

// 5. ELIMINAR CON SEGURIDAD
function eliminarAlmacen(nom) { 
    if (bloquearAccionAdministrativaColaborador()) return;
    const pass = prompt("Ingrese contraseña de 5 números para ELIMINAR:");
    if(pass === sesionUser.pass) { 
        if(confirm(`¿Eliminar ${nom.toUpperCase()}?`)){ 
            db.almacen = db.almacen.filter(a => !(a.nombre === nom && a.owner === sesionUser.user && a.modulo === moduloActual)); 
            guardarDatos(); 
            renderAlmacen(); 
        }
    } else {
        alert("Contraseña incorrecta.");
    }
}

function prepararEdicionAlmacen(nom) {
    if (bloquearAccionAdministrativaColaborador()) return;
    let item = db.almacen.find(a => a.nombre === nom && a.owner === sesionUser.user && a.modulo === moduloActual);
    
    if(item) {
        document.getElementById('inv_nombre').value = item.nombre;
        document.getElementById('inv_ideal').value = item.ideal;
        document.getElementById('inv_unidad').value = item.unidad;
        document.getElementById('inv_dist_select').value = item.distribuidor || "";
        
        // --- LÓGICA INTELIGENTE DE CARGA ---
        let cantidadFaltante = item.ideal - item.actual;
        if (cantidadFaltante < 0) cantidadFaltante = 0;

        // 1. Rellenamos la cantidad con lo que falta para completar el stock ideal
        document.getElementById('inv_actual').value = cantidadFaltante.toFixed(2);
        
        // 2. Rellenamos el costo total con el "completivo" basado en el precio actual
        let costoCompletivo = cantidadFaltante * item.costoUnitario;
        document.getElementById('inv_costo_total').value = costoCompletivo.toFixed(2);

        // Guardamos el costo unitario para recálculos manuales
        document.getElementById('inv_nombre').dataset.ultimoCosto = item.costoUnitario;

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// 3. EVENTO PARA RE-CALCULAR SI CAMBIAS LA CANTIDAD MANUALMENTE
document.getElementById('inv_actual').addEventListener('input', function() {
    const cantInput = document.getElementById('inv_actual');
    const costoTotalInput = document.getElementById('inv_costo_total');
    const nombreInput = document.getElementById('inv_nombre');
    
    const nuevaCantidad = parseFloat(cantInput.value) || 0;
    const costoUnitarioHistorico = parseFloat(nombreInput.dataset.ultimoCosto) || 0;

    if (nuevaCantidad >= 0 && costoUnitarioHistorico > 0) {
        costoTotalInput.value = (nuevaCantidad * costoUnitarioHistorico).toFixed(2);
    }
    autocompletarCostoPorCatalogo();
});

document.getElementById('inv_dist_select')?.addEventListener('change', function() {
    autocompletarCostoPorCatalogo();
});
document.getElementById('inv_unidad')?.addEventListener('change', function() {
    autocompletarCostoPorCatalogo();
});
document.getElementById('inv_nombre')?.addEventListener('change', function() {
    autocompletarCostoPorCatalogo();
});
document.getElementById('cat_dist')?.addEventListener('change', function() {
    actualizarOpcionesProductosCatalogo();
    autocompletarPrecioUnitarioCatalogo();
});
document.getElementById('cat_producto')?.addEventListener('change', function() {
    autocompletarPrecioUnitarioCatalogo();
});
document.getElementById('cat_unidad')?.addEventListener('change', function() {
    autocompletarPrecioUnitarioCatalogo();
});
document.getElementById('cmp_producto')?.addEventListener('change', function() {
    compararPreciosDistribuidores();
});
document.getElementById('cmp_unidad')?.addEventListener('change', function() {
    if (document.getElementById('cmp_producto')?.value) compararPreciosDistribuidores();
});

       function actualizarListaDecomiso() { 
      const tipo = document.getElementById('tipo-decomiso').value;
      const bus = document.getElementById('busqueda-decomiso').value.toLowerCase(); 
      const lista = document.getElementById('lista-decomiso-items'); 
      lista.innerHTML = "";
      if(tipo === 'plato') { 
        db.platos.filter(p => p.owner === sesionUser.user && p.modulo === moduloActual && p.nombre.toLowerCase().includes(bus)).forEach(p => { 
          lista.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span><strong>${p.nombre}</strong></span><button class="btn btn-purple" onclick="ejecutarDecomisoPlato('${p.nombre}')">DECOMISAR</button></div>`; 
        });
      } else { 
        db.almacen.filter(a => a.owner === sesionUser.user && a.modulo === moduloActual && a.nombre.toLowerCase().includes(bus)).forEach(a => { 
          lista.innerHTML += `
            <div class="card">
              <strong>${a.nombre.toUpperCase()}</strong> (${a.actual.toFixed(2)} ${a.unidad})<br>
              <div style="display: flex; gap: 5px; margin-top: 10px;">
                <input type="number" id="dec-cant-${a.nombre}" placeholder="Cantidad" style="width: 100px;">
                <select id="dec-unid-${a.nombre}">
                  <option value="${a.unidad}">${a.unidad}</option>
                  <option value="Lb">Lb</option><option value="Oz">Oz</option><option value="g">g</option><option value="mL">mL</option><option value="Litros">Litros</option><option value="Unidad">Unid</option>
                </select>
                <button class="btn btn-danger" onclick="ejecutarDecomisoAlmacen('${a.nombre}')">BAJA</button>
              </div>
            </div>`; 
        });
      } 
    }

    function ejecutarDecomisoPlato(nombre) { if(!validarPermiso()) return;
      let p = db.platos.find(x => x.nombre === nombre && x.owner === sesionUser.user && x.modulo === moduloActual);
      if(p.stock >= 1) { p.stock--; db.decomisos.push({owner: sesionUser.user, modulo: moduloActual, fecha: new Date().toLocaleString(), tipo: "PLATO", nombre: p.nombre, cant: 1, medida: "Unid", perdida: p.costo, operador: operadorActual});
      guardarDatos(); actualizarListaDecomiso(); } }
    
    function ejecutarDecomisoAlmacen(nombre) { 
      const cant = parseFloat(document.getElementById(`dec-cant-${nombre}`).value);
      const unid = document.getElementById(`dec-unid-${nombre}`).value;
      if(!cant || !validarPermiso()) return; 
      let a = db.almacen.find(x => x.nombre === nombre && x.owner === sesionUser.user && x.modulo === moduloActual);
      let cantDescuento = convertirUnidad(cant, unid, a.unidad);
      if(a.actual >= cantDescuento) { 
        a.actual -= cantDescuento;
        db.decomisos.push({owner: sesionUser.user, modulo: moduloActual, fecha: new Date().toLocaleString(), tipo: "ALMACEN", nombre: a.nombre, cant, medida: unid, perdida: a.costoUnitario * cantDescuento, operador: operadorActual});
        guardarDatos(); actualizarListaDecomiso(); 
      } else { alert("Existencia insuficiente"); }
    }

    function renderHistorialDecomiso() {
        const dec = db.decomisos.filter(x =>
            x.owner === sesionUser.user &&
            x.modulo === moduloActual &&
            fechaDentroRango(x.fecha, 'filtro-decomiso-desde', 'filtro-decomiso-hasta')
        );
        let totalPerdida = 0;
        const filas = [...dec].reverse().map(x => {
            totalPerdida += (x.perdida || 0);
            return `<tr><td>${x.fecha}</td><td>${x.tipo}</td><td>${(x.nombre || '').toUpperCase()}</td><td>${x.cant}</td><td>${x.medida}</td><td>RD$${(x.perdida || 0).toFixed(2)}</td><td>${x.operador || '---'}</td></tr>`;
        }).join('');
        document.getElementById('tabla-historial-decomiso').innerHTML = filas || '<tr><td colspan="7" style="text-align:center; color:gray;">Sin registros</td></tr>';
        document.getElementById('total-perdidas-cuadro').innerText = `PÉRDIDA TOTAL: RD$${totalPerdida.toFixed(2)}`;
    }

    function filtrarPlatosABC(color) { 
        const res = document.getElementById('resultado-filtro-abc');
        const ownerActivo = ownerDatosActivo();
        const platos = db.platos.filter(p => String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual); 
        let f = [];
        if(color === 'rojo') f = platos.filter(p => p.stock <= 0);
        else if(color === 'amarillo') f = platos.filter(p => p.stock > 0 && p.stock <= 5);
        else f = platos.filter(p => p.stock >= 6); 
        res.innerHTML = f.map(p => `<div class="card" style="border-left: 10px solid ${color==='rojo'?'red':color==='amarillo'?'orange':(moduloActual!=='COCINA'?'#3498db':'green')};"><strong>${p.nombre}</strong> - Existencia: ${p.stock}</div>`).join('') || "Sin resultados"; 
    }
    
function renderDispoTable() { 
        const ownerActivo = ownerDatosActivo();
        const platos = db.platos.filter(p => String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual);
        const perms = normalizarPermisos(permisosSesion);
        const modoSoloLecturaDispo = esColaboradorSesion && (perms.includes('disponibilidad-lite') || perms.includes('disponibilidad'));
        const thead = document.getElementById('thead-disponibilidad-full');

        if (modoSoloLecturaDispo) {
            if (thead) {
                thead.innerHTML = '<tr><th>Plato</th><th>Precio</th><th>Existencia</th></tr>';
            }
            document.getElementById('tabla-disponibilidad-full').innerHTML = platos.map(p => `
                <tr ${Number(p.stock || 0) <= 0 ? 'class="dispo-sin-stock-parpadeo"' : ''}>
                    <td style="font-weight:bold;">${p.nombre}</td>
                    <td>RD$${Number(p.precio || 0).toFixed(2)}</td>
                    <td>${p.stock}</td>
                </tr>
            `).join('');
            return;
        }

        if (thead) {
            thead.innerHTML = '<tr><th>Plato / Receta</th><th>Precio</th><th>Existencia</th><th>Nueva Existencia</th><th>Acciones</th></tr>';
        }

        document.getElementById('tabla-disponibilidad-full').innerHTML = platos.map(p => { 
            const i = db.platos.indexOf(p); 
            const claseSinStock = Number(p.stock || 0) <= 0 ? ' class="dispo-sin-stock-parpadeo"' : '';
            return `<tr id="plato-tr-${i}"${claseSinStock}>
                <td onclick="toggleDetallesPlato(${i})" style="cursor:pointer; color:var(--blue); font-weight:bold;">${p.nombre} ⚠️</td>
                <td>RD$${p.precio}</td><td>${p.stock}</td><td><input type="number" id="aj-dispo-${i}" style="width:70px"></td>
                <td><button class="btn btn-save" onclick="actStock(${i})">OK</button><button class="btn btn-warning" onclick="editarPlatoDesdeDispo(${i})">✏️ </button><button class="btn btn-danger" onclick="delPlato(${i})">X</button></td>
            </tr>`; 
        }).join('');
    }

    function actStock(i) {
        if (bloquearAccionAdministrativaColaborador()) return;
        const ownerActivo = ownerDatosActivo();
        const p = db.platos[i];
        if (!p) return;
        if (String(p.owner || '').trim().toLowerCase() !== ownerActivo || p.modulo !== moduloActual) return;
        const v = parseFloat(document.getElementById(`aj-dispo-${i}`).value);
        if (!isNaN(v)) {
            p.stock = v;
            guardarDatos();
            renderDispoTable();
        }
    }
    function delPlato(i) {
        if (bloquearAccionAdministrativaColaborador()) return;
        const ownerActivo = ownerDatosActivo();
        const p = db.platos[i];
        if (!p) return;
        if (String(p.owner || '').trim().toLowerCase() !== ownerActivo || p.modulo !== moduloActual) return;
        if (validarPermiso()) {
            db.platos.splice(i, 1);
            guardarDatos();
            renderDispoTable();
        }
    }

    function limpiarHistorial(tipo) { 
        if (bloquearAccionAdministrativaColaborador()) return;
        if(!validarPermiso()) return;

        if(tipo === 'ventas') db.ventas = db.ventas.filter(x => !(x.owner === sesionUser.user && x.modulo === moduloActual)); 
        if(tipo === 'produccion') db.historial_prod = db.historial_prod.filter(x => !(x.owner === sesionUser.user && x.modulo === moduloActual)); 
        if(tipo === 'decomisos') db.decomisos = db.decomisos.filter(x => !(x.owner === sesionUser.user && x.modulo === moduloActual)); 
        if(tipo === 'entradas') db.entradas = db.entradas.filter(x => !(x.owner === sesionUser.user && x.modulo === moduloActual)); 
        if(tipo === 'autorizaciones') {
            db.autorizaciones = db.autorizaciones.filter(x => !(
                (!x.owner || x.owner === sesionUser.user) && (!x.modulo || x.modulo === moduloActual)
            ));
        }
        if(tipo === 'rnc') {
            db.clientesRNC = [];
            db.facturasResumen = [];
        }

        guardarDatos();

        if(tipo === 'ventas') renderHistorialVentas();
        if(tipo === 'produccion') renderHistorialProduccion();
        if(tipo === 'decomisos') renderHistorialDecomiso();
        if(tipo === 'entradas') renderEntradas();
        if(tipo === 'autorizaciones') renderAutorizaciones();
        if(tipo === 'rnc') actualizarTablaRNC();
    }
    function renderEntradas() { 
        const e = db.entradas.filter(x =>
            x.owner === sesionUser.user &&
            x.modulo === moduloActual &&
            fechaDentroRango(x.fecha, 'filtro-entradas-desde', 'filtro-entradas-hasta')
        ); 
        const filas = [...e].reverse().map(x => `<tr><td>${x.fecha}</td><td>${(x.producto || '').toUpperCase()}</td><td>${x.cant}</td><td>${x.medida || '---'}</td><td>${x.operador || '---'}</td></tr>`).join('');
        document.getElementById('tabla-registro-entradas').innerHTML = filas || '<tr><td colspan="5" style="text-align:center; color:gray;">Sin registros</td></tr>';
    }

    function renderHistorialProduccion() {
        const hp = db.historial_prod.filter(x =>
            x.owner === sesionUser.user &&
            x.modulo === moduloActual &&
            fechaDentroRango(x.fecha, 'filtro-prod-desde', 'filtro-prod-hasta')
        );
        const filas = [...hp].reverse().map(x => `<tr><td>${x.fecha}</td><td>${(x.producto || '').toUpperCase()}</td><td>${x.cantidad || '---'}</td><td>RD$${(x.costoOp || 0).toFixed(2)}</td><td>${x.operador || '---'}</td></tr>`).join('');
        document.getElementById('tabla-historial-produccion').innerHTML = filas || '<tr><td colspan="5" style="text-align:center; color:gray;">Sin registros</td></tr>';
    }

    function renderHistorialVentas() { 
        const v = db.ventas.filter(x =>
            x.owner === sesionUser.user &&
            moduloPerteneceVista(x.modulo) &&
            fechaDentroRango(x.fecha, 'filtro-ventas-desde', 'filtro-ventas-hasta')
        ); 
        let total = 0; 
        const filas = [...v].reverse().map(x => { 
            total += (x.ganancia || 0); 
            return `<tr><td>${x.fecha}</td><td>${x.plato || '---'}</td><td>RD$${(x.totalVenta || 0).toFixed(2)}</td><td style="color:green;">RD$${(x.ganancia||0).toFixed(2)}</td><td>${x.operador || '---'}</td></tr>`; 
        }).join(''); 
        document.getElementById('tabla-historial-ventas').innerHTML = filas || '<tr><td colspan="5" style="text-align:center; color:gray;">Sin registros</td></tr>';
        document.getElementById('total-ganancias-cuadro').innerText = `GANANCIA TOTAL: RD$${total.toFixed(2)}`; 
    }

    function renderAutorizaciones() { 
        const aut = db.autorizaciones.filter(x =>
            (!x.owner || x.owner === sesionUser.user) &&
            moduloPerteneceVista(x.modulo) &&
            fechaDentroRango(x.fecha, 'filtro-auth-desde', 'filtro-auth-hasta')
        ); 
        const filas = [...aut].reverse().map(x => `<tr><td>${x.fecha}</td><td><strong>${x.usuario || '---'}</strong></td><td>${x.plato || '---'}</td><td style="color:var(--danger);">${x.ingredientesEnCero || x.ingredientes || '---'}</td><td><em>${x.motivo || '---'}</em></td></tr>`).join('');
        document.getElementById('tabla-historial-autorizaciones').innerHTML = filas || '<tr><td colspan="5" style="text-align:center; color:gray;">Sin registros</td></tr>';
    }

    function validarPermiso() {
        if (esModoBasicoColaborador()) {
            alert("⛔ Los colaboradores no tienen permisos administrativos.");
            return false;
        }
        const p = prompt("Contraseña de seguridad:");
        return (p === sesionUser.pass);
    }
    function regresarAModulos() { document.getElementById('sidebar').style.display = 'none'; document.getElementById('main-content').style.display = 'none'; renderModuleSelectorCards(); document.getElementById('module-selector').style.display = 'flex'; }
    function cambiarUsuario() { document.getElementById('log_user').value = ""; document.getElementById('log_user').disabled = false; document.getElementById('log_pass').value = ""; document.getElementById('login-overlay').style.display = 'flex'; document.getElementById('sidebar').style.display = 'none'; document.getElementById('main-content').style.display = 'none'; detenerAutoRefreshBovedaMaster(); if (typeof window.detenerGuardiaSesionActiva === 'function') window.detenerGuardiaSesionActiva(); if (typeof window.detenerListenerCloudTiempoReal === 'function') window.detenerListenerCloudTiempoReal(); if (typeof window.cerrarSesionBackend === 'function') window.cerrarSesionBackend(); }
    function cerrarSesion() {
      guardarDatos();
      detenerAutoRefreshBovedaMaster();
      if (typeof window.detenerGuardiaSesionActiva === 'function') window.detenerGuardiaSesionActiva();
      if (typeof window.detenerListenerCloudTiempoReal === 'function') window.detenerListenerCloudTiempoReal();
      location.reload();
    }

    // Variables para el control de cambios
let backupPrecios = null;

function validarYEjecutarAjuste(valor) {
    if (bloquearAccionAdministrativaColaborador()) return;
    const pass = prompt("🔐 INGRESE CONTRASEÑA MAESTRA (5 NÚMEROS):");
    
    // Validación basada en tu instrucción de seguridad [cite: 2025-12-27]
    if (pass === sesionUser.pass) {
        // Crear backup antes de modificar
        backupPrecios = JSON.parse(JSON.stringify(db.platos));
        
        if (valor === 'manual') {
            ajustarPrecioManual();
        } else {
            ajustarPrecioMasivo(valor);
        }
        
        // Mostrar botón de revertir
        document.getElementById('btn-revertir').style.display = 'block';
    } else {
        alert("❌ Contraseña incorrecta o formato inválido.");
    }
}

function revertirCambioPrecio() {
    if (backupPrecios && confirm("¿Desea deshacer el último ajuste de precios masivo?")) {
        db.platos = JSON.parse(JSON.stringify(backupPrecios));
        backupPrecios = null;
        document.getElementById('btn-revertir').style.display = 'none';
        guardarDatos();
        renderDispoTable();
        alert("✅ Cambios revertidos con éxito.");
    }
}

let cierreTotalActual = null;

function cerrarModalCierreTotal() {
    const m = document.getElementById('modal-cierre-total');
    if (m) m.style.display = 'none';
}

function mostrarModalCierreTotal(data) {
    cierreTotalActual = data || null;
    const m = document.getElementById('modal-cierre-total');
    const box = document.getElementById('cierre-total-contenido');
    if (!m || !box || !data) return;

    const platosHtml = (data.platosOrdenados && data.platosOrdenados.length)
        ? data.platosOrdenados.map(([n, c], i) => `<div>${i + 1}. <strong>${n}</strong>: ${c}</div>`).join('')
        : '<div>Sin platos vendidos.</div>';

    box.innerHTML = `
      <div id="cierre-total-imprimible" style="font-family:'Courier New',monospace; color:#111;">
        <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:8px; margin-bottom:10px;">
          <h3 style="margin:0;">${obtenerNombreNegocioActual().toUpperCase()}</h3>
          <div style="font-size:12px;">CIERRE DE TURNO (CAJA GENERAL)</div>
          <div style="font-size:11px;">Desde: ${data.desdeTxt}</div>
          <div style="font-size:11px;">Hasta: ${data.hastaTxt}</div>
        </div>
        <div style="font-size:13px; margin-bottom:10px;">
          <div><strong>ID Cierre:</strong> ${data.id || '-'}</div>
          <div><strong>Owner:</strong> ${data.owner || '-'}</div>
          <div><strong>Operador:</strong> ${data.operador || '-'}</div>
          <div><strong>Dinero vendido:</strong> RD$${Number(data.dineroVendido || 0).toFixed(2)}</div>
          <div><strong>Facturas emitidas:</strong> ${Number(data.facturasCount || 0)}</div>
          <div><strong>Registros de ventas:</strong> ${Number(data.ventasCount || 0)}</div>
          <div><strong>Total de platos vendidos:</strong> ${Number(data.cantidadPlatos || 0)}</div>
        </div>
        <div style="border-top:1px dashed #000; padding-top:8px; margin-top:8px;">
          <div style="font-weight:bold; margin-bottom:6px;">Platos vendidos</div>
          <div style="font-size:12px; line-height:1.4;">${platosHtml}</div>
        </div>
        <div style="text-align:center; font-size:11px; margin-top:12px;">Módulo: ${data.modulo || '-'}</div>
      </div>
    `;
    m.style.display = 'flex';
}

function imprimirCierreTotal() {
    if (!cierreTotalActual) return alert("No hay cierre para imprimir.");
    const html = document.getElementById('cierre-total-imprimible')?.outerHTML || '';
    if (!html) return alert("No se pudo generar el formato de impresión.");
    const w = window.open('', '_blank');
    if (!w) return alert("No se pudo abrir ventana de impresión.");
    w.document.write(`<!DOCTYPE html><html><head><title>Cierre Total</title></head><body style="font-family:Arial; margin:20px;">${html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 350);
}

function ejecutarCierreTotalConfirmado() {
    if (!Array.isArray(db.cierresTotales)) db.cierresTotales = [];
    const owner = sesionUser.user;
    const modulo = moduloActual;
    const ultimoCierre = [...db.cierresTotales].reverse().find(c => c.owner === owner && c.modulo === modulo);
    const inicioTs = ultimoCierre ? Number(ultimoCierre.endTs || 0) : 0;
    const finTs = Date.now();
    const obtenerTsRegistro = (x) => {
        const ts = Number(x?.ts || 0);
        if (Number.isFinite(ts) && ts > 0) return ts;
        return parseFechaRegistro(x?.fecha)?.getTime() || 0;
    };

    const facturas = (db.facturasResumen || []).filter(f => {
        if ((f.owner || owner) !== owner) return false;
        if ((f.modulo || modulo) !== modulo) return false;
        const ts = obtenerTsRegistro(f);
        return ts > inicioTs && ts <= finTs;
    });
    const ventas = (db.ventas || []).filter(v => {
        if ((v.owner || owner) !== owner) return false;
        if ((v.modulo || modulo) !== modulo) return false;
        const ts = obtenerTsRegistro(v);
        return ts > inicioTs && ts <= finTs;
    });

    const dineroVendido = facturas.reduce((acc, f) => acc + Number(f.total || 0), 0);
    const mapaPlatos = {};
    let cantidadPlatos = 0;
    facturas.forEach(f => {
        const items = Array.isArray(f.items) ? f.items : [];
        items.forEach(it => {
            const nom = (it?.nombre || 'SIN NOMBRE').toString().toUpperCase();
            const cant = Number(it?.cantidad || 0);
            cantidadPlatos += cant;
            mapaPlatos[nom] = (mapaPlatos[nom] || 0) + cant;
        });
    });
    if (cantidadPlatos === 0) {
        ventas.forEach(v => {
            const nom = (v.plato || 'SIN NOMBRE').toString().toUpperCase();
            const cant = Number(v.cantidad || 0);
            cantidadPlatos += cant;
            mapaPlatos[nom] = (mapaPlatos[nom] || 0) + cant;
        });
    }
    const platosOrdenados = Object.entries(mapaPlatos).sort((a, b) => b[1] - a[1]);

    const desdeTxt = inicioTs ? new Date(inicioTs).toLocaleString() : 'Inicio de operaciones';
    const hastaTxt = new Date(finTs).toLocaleString();
    const cierreId = `CIERRE-${Date.now()}`;

    db.cierresTotales.push({
        id: cierreId,
        owner,
        modulo,
        startTs: inicioTs,
        endTs: finTs,
        dineroVendido,
        cantidadPlatos,
        platos: mapaPlatos,
        platosOrdenados,
        facturasCount: facturas.length,
        ventasCount: ventas.length,
        operador: operadorActual || owner
    });
    guardarDatos();

    mostrarModalCierreTotal({
        id: cierreId,
        owner,
        modulo,
        desdeTxt,
        hastaTxt,
        dineroVendido,
        cantidadPlatos,
        facturasCount: facturas.length,
        ventasCount: ventas.length,
        platosOrdenados,
        operador: operadorActual || owner
    });
}

function realizarCierreTotalConCodigo() {
    if (bloquearAccionAdministrativaColaborador()) return;
    if (!sesionUser || !sesionUser.user) return alert("Debe iniciar sesión para ejecutar el cierre.");
    if (!confirm("¿Confirmar cierre de turno de Caja General ahora?")) return;
    const pass = prompt("🔐 Ingrese su contraseña para confirmar CIERRE TOTAL:");
    if (pass === null) return;
    if (String(pass) !== String(sesionUser.pass || '')) {
        return alert("❌ Contraseña incorrecta. Cierre cancelado.");
    }
    ejecutarCierreTotalConfirmado();
}

function crearBaseLimpiaSoloMaster() {
    return {
        usuarios: [{ user: MASTER_USER, pass: MASTER_PASS, role: "super-master", owner: MASTER_USER, activo: true, colab: [] }],
        platos: [],
        almacen: [],
        entradas: [],
        ventas: [],
        decomisos: [],
        autorizaciones: [],
        produccion_stock: [],
        historial_prod: [],
        distribuidores: [],
        catalogoDistribuidores: [],
        clientesRNC: [],
        facturasResumen: [],
        codigosClienteRNC: {},
        contadorCodigoCliente: 1,
        contadorCodigoFacturaBusqueda: 1,
        registroInicial: null,
        registroInicialUsuarios: {},
        recuperacionClave: null,
        registroInicialBackups: [],
        clientesFidelizacion: [],
        configMembresia: { mensualUSD: 20, descuentoPorc: 8, cupoPlatosCosto: 5 },
        qrClienteLinks: {},
        entrenamientos: [],
        modulosCustom: [],
        cierresTotales: [],
        comandasActivas: [],
        comandasHistorial: [],
        deliveryMeta: {},
        mesaCuentas: {},
        mesaEstadoVenta: {},
        mesaClienteVenta: {},
        mesasEstado: {}
    };
}

async function purgarBaseNubeExceptoMaster() {
    if (typeof window.refrescarListaOwnersCloud !== 'function' || typeof window.eliminarUsuarioMaestroNube !== 'function') {
        return { ok: false, eliminados: 0 };
    }
    await window.refrescarListaOwnersCloud({ silent: true });
    const owners = Array.isArray(window.luroCloudOwnersCache) ? window.luroCloudOwnersCache : [];
    let eliminados = 0;
    for (const owner of owners) {
        const username = String(owner?.username || '').trim().toLowerCase();
        if (!username || username === MASTER_USER) continue;
        const ok = await window.eliminarUsuarioMaestroNube(username);
        if (ok) eliminados++;
    }
    return { ok: true, eliminados };
}

async function borrarBaseDatosConPassword() {
    if (bloquearAccionAdministrativaColaborador()) return;
    if (!sesionUser || !sesionUser.user) return alert("Debe iniciar sesión para borrar la base.");
    const userSesion = String(sesionUser.user || '').trim().toLowerCase();
    if (userSesion !== MASTER_USER) {
        return alert("Solo el usuario maestro Jssantana077 puede borrar la base de datos.");
    }
    if (!confirm("Esta acción eliminará TODOS los datos y usuarios (excepto Jssantana077). ¿Desea continuar?")) return;

    const pass = prompt("🔐 Ingrese su contraseña para confirmar BORRAR BASE DE DATOS:");
    if (pass === null) return;
    const passValida = String(pass) === String(sesionUser.pass || '') || String(pass) === String(MASTER_PASS);
    if (!passValida) {
        return alert("❌ Contraseña incorrecta. Operación cancelada.");
    }
    if (!confirm("Última confirmación: se eliminará toda la base local y en Firebase excepto Jssantana077.")) return;

    try {
        const purgeRes = await purgarBaseNubeExceptoMaster();

        db = crearBaseLimpiaSoloMaster();
        carritoPorMesa = {};
        mesaNombres = {};
        mesaMeta = {};
        mesaUniones = {};
        mesaActiva = "Mesa 1";
        window.__mesaPersonaSeleccionadaId = '';
        window.__mesaPersonaSeleccionadaNombre = '';

        guardarDatos();
        if (typeof window.subirBaseActualAlCloud === 'function') {
            await window.subirBaseActualAlCloud({ silent: true });
        }
        if (typeof window.refrescarListaOwnersCloud === 'function') {
            await window.refrescarListaOwnersCloud({ silent: true });
        }
        if (typeof window.refrescarUITrasSyncCloud === 'function') {
            window.refrescarUITrasSyncCloud();
        }
        if (typeof renderConfig === 'function') {
            renderConfig({ deferHeavy: true });
        }

        const extraCloud = purgeRes.ok ? `\nUsuarios maestros eliminados en Firebase: ${purgeRes.eliminados}.` : "";
        alert(`✅ Base reiniciada correctamente.\nSe conservó solo Jssantana077.${extraCloud}`);
    } catch (e) {
        alert(`❌ Error al borrar la base de datos:\n${String(e?.message || e || 'Error interno')}`);
    }
}

    function agregarFilaIngrediente() { 
        const div = document.createElement('div'); div.className = 'ingrediente-row'; 
        const ownerActivo = ownerDatosActivo();
        const alm = db.almacen.filter(a => String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual);
        const prod = db.produccion_stock.filter(p => String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual);
        let opts = '<option value="">Seleccionar...</option>';
        opts += '<optgroup label="ALMACÉN">' + alm.map(a => `<option value="${a.nombre}">${a.nombre.toUpperCase()}</option>`).join('') + '</optgroup>';
        opts += '<optgroup label="PRODUCCIÓN">' + prod.map(p => `<option value="${p.nombre}">${p.nombre.toUpperCase()} (P)</option>`).join('') + '</optgroup>';
        let unidOpts = '<option value="g">g</option><option value="Oz">Oz</option><option value="Lb">Lb</option><option value="mL">mL</option><option value="Unidad">Unid</option>';
        div.innerHTML = `<select class="ing-nom" onchange="recalculateAndVerify()">${opts}</select><input type="number" class="ing-cant" placeholder="Cant." onkeyup="recalculateAndVerify()"><select class="ing-unid" onchange="recalculateAndVerify()">${unidOpts}</select><button class="btn btn-danger" onclick="this.parentElement.remove(); recalcularCostoReceta();">X</button>`; 
        document.getElementById('contenedor-ingredientes').appendChild(div); 
    }

   function recalcularCostoReceta() { 
      const ownerActivo = ownerDatosActivo();
      let t = 0;
    // Seleccionamos las filas según tu estructura original
    document.querySelectorAll('#contenedor-ingredientes .ingrediente-row').forEach(row => { 
        const nom = row.querySelector('.ing-nom').value; 
        const cant = parseFloat(row.querySelector('.ing-cant').value) || 0; 
        const unid = row.querySelector('.ing-unid').value; 

        // Buscar en almacén o en producción (semielaborados)
        const item = db.almacen.find(a => a.nombre === nom && String(a.owner || '').trim().toLowerCase() === ownerActivo && a.modulo === moduloActual) || 
                     db.produccion_stock.find(p => p.nombre === nom && String(p.owner || '').trim().toLowerCase() === ownerActivo && p.modulo === moduloActual); 
        
        if(item) { 
            // NUEVA LÓGICA: Convertimos la cantidad de la receta a la unidad que tiene el item en stock
            const cantidadConvertida = convertirUnidad(cant, unid, item.unidad);
            // El costo se suma basándose en la cantidad equivalente en la unidad del stock
            t += (item.costoUnitario * cantidadConvertida); 
        } 
    });

    // Actualizar campos de costo base
    document.getElementById('p_costo').value = t.toFixed(2);

    // Lógica de Impuestos (Taxes) original
    let totalTax = 0; 
    document.querySelectorAll('.tax-check:checked').forEach(cb => { 
        totalTax += parseFloat(cb.value); 
    });

    let costoFinal = t * (1 + totalTax);

    // Mostrar u ocultar fila de impuestos según tu lógica original
    if(totalTax > 0) { 
        document.getElementById('row-tax-visual').style.display = 'block'; 
        document.getElementById('p_costo_tax').value = costoFinal.toFixed(2); 
    } else { 
        document.getElementById('row-tax-visual').style.display = 'none'; 
        document.getElementById('p_costo_tax').value = t.toFixed(2); 
    }

    // Precio recomendado (Costo con tax * 3)
    document.getElementById('p_recom').value = (costoFinal * 3).toFixed(2);
}

// Mantener el alias de verificación
function recalculateAndVerify() { recalcularCostoReceta(); }

function enviarPedidoWhatsapp() {
    const items = db.almacen.filter(a => a.owner === sesionUser.user && a.modulo === moduloActual);
    let faltantes = items.filter(it => it.actual < it.ideal);

    if (faltantes.length === 0) {
        return alert("✅ Todo el stock está al día. No hay productos por reabastecer.");
    }

    let mensaje = `*LURO CONTROL - EL CONTROL EN TUS MANOS*\n`;
    mensaje += `*Módulo:* ${moduloActual}\n`;
    mensaje += `------------------------------------------\n`;

    faltantes.forEach(it => {
        let cantidadAComprar = it.ideal - it.actual;
        // Mantenemos tu lógica para manejar stocks negativos correctamente
        mensaje += `• *${it.nombre.toUpperCase()}*\n`;
        mensaje += `   Necesito: *${cantidadAComprar.toFixed(2)} ${it.unidad}*\n`;
    });

    mensaje += `------------------------------------------\n`;
    mensaje += `_Generado automáticamente por LuRo Control - El control en tus manos_`;

    // Codificar para URL con tu número de teléfono original
    abrirWhatsAppConMensaje(WHATSAPP_DEFAULT, mensaje);
}

function enviarCalculoRaciones(nombrePlato, raciones) {
    let mensaje = `*LURO CONTROL - EL CONTROL EN TUS MANOS*\n`;
    mensaje += `------------------------------------------\n`;
    mensaje += `*Plato:* ${nombrePlato.toUpperCase()}\n`;
    mensaje += `*Capacidad Actual:* ${raciones} raciones disponibles\n`;
    mensaje += `------------------------------------------\n`;
    mensaje += `_Basado en el stock actual de ingredientes._`;

    abrirWhatsAppConMensaje(WHATSAPP_DEFAULT, mensaje);
}

function toggleFolder(element) {
    const container = element.parentElement;
    container.classList.toggle('folder-active');
}
(function(){
const DC='#FFCA63',TG='#F54927';
function edb(){if(!db.comandasActivas)db.comandasActivas=[];if(!db.comandasHistorial)db.comandasHistorial=[];if(!db.deliveryMeta)db.deliveryMeta={};}
function isD(m){return /^Delivery\s+\d+$/i.test(String(m||''));}
function allM(){let a=[];for(let i=1;i<=20;i++)a.push('Mesa '+i);for(let i=1;i<=20;i++)a.push('Delivery '+i);return a;}
window.finalizarComanda=function(id){edb();const i=db.comandasActivas.findIndex(x=>x.id===id);if(i<0)return;const c=db.comandasActivas[i];db.comandasActivas.splice(i,1);db.comandasHistorial.push({...c,doneAt:Date.now()});guardarDatos();renderComandas();};
window.handleComandaCheck=function(cb,id){const card=cb?.closest('.comanda-card-box');if(card){card.style.transition='all .25s ease';card.style.transform='scale(.96)';card.style.opacity='.35';}setTimeout(()=>finalizarComanda(id),220);};
window.abrirHistorialComandasModal=function(){const b=document.getElementById('historial-comandas-body');if(!b)return;const h=[...(db.comandasHistorial||[])].reverse();b.innerHTML=h.map(c=>`<div style="border:1px solid #ddd;padding:8px;border-radius:8px;margin-bottom:8px;"><b>${c.mesa}</b><div>${new Date(c.createdAt).toLocaleString()} -> ${new Date(c.doneAt).toLocaleString()}</div><div>${(c.items||[]).map(i=>`${i.cantidad}x ${i.nombre}`).join(' · ')}</div></div>`).join('')||'Sin historial';document.getElementById('modal-historial-comandas').style.display='flex';};
function upCom(m){edb();const c=mesaCanonica(m),it=(carritoPorMesa[c]||[]);if(!it.length)return;const id=`CMD-${sesionUser.user}-${moduloActual}-${c}`;const i=db.comandasActivas.findIndex(x=>x.id===id),r={id,mesa:c,createdAt:i>=0?db.comandasActivas[i].createdAt:Date.now(),items:it.map(x=>({nombre:x.nombre,cantidad:x.cantidad})),owner:sesionUser.user,modulo:moduloActual};if(i>=0)db.comandasActivas[i]=r;else db.comandasActivas.push(r);guardarDatos();}
window.renderComandas=function(){
const b=document.getElementById('comandas-activas');if(!b)return;
const a=(db.comandasActivas||[]).filter(x=>(!x.owner||x.owner===sesionUser.user)&&(!x.modulo||x.modulo===moduloActual));
b.style.display='grid';b.style.gridTemplateColumns='repeat(auto-fill,minmax(230px,1fr))';b.style.gap='10px';
const pal=['#ff4757','#ffa502','#2ed573','#1e90ff','#ff6b81','#2f3542','#e84393','#00a8ff'];
b.innerHTML=a.map(c=>{
const ms=(Date.now()-c.createdAt);const min=Math.floor(ms/60000);
let tiempoColor='#2ed573',bordeColor='#20bf6b',badgeTxt='0-10 MIN';
if(min>10&&min<15){tiempoColor='#ff9f1a';bordeColor='#ff9f1a';badgeTxt='10-15 MIN';}
else if(min>=15){tiempoColor='#ff3b30';bordeColor='#ff3b30';badgeTxt='15+ MIN';}
const items=(c.items||[]).map((i,idx)=>`<div style="margin:6px 0; color:${pal[idx%pal.length]}; font-weight:900; text-align:center; line-height:1.25;">
<div style="font-size:18px;">${idx+1}. ${(i.nombre||'').toUpperCase()}</div>
<div style="font-size:13px; color:#555;">${i.cantidad}x</div>
</div>`).join('');
return `<div class="comanda-card-box" style="border:2px solid ${bordeColor};border-left:8px solid ${bordeColor};padding:10px;border-radius:10px;min-height:210px;background:#fff;display:flex;flex-direction:column;justify-content:space-between;">
<div>
<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><b>${c.mesa}</b><label style="font-size:12px;"><input type="checkbox" onchange="handleComandaCheck(this,'${c.id}')"> Listo</label></div>
<div style="font-size:12px;color:${tiempoColor};margin-top:5px;font-weight:800;">Tiempo: ${formatearDuracionMs(ms)} <span style="margin-left:6px; background:${tiempoColor}; color:#fff; border-radius:999px; padding:2px 7px; font-size:10px;">${badgeTxt}</span></div>
</div>

<div style="font-size:13px;line-height:1.35;margin-top:8px;max-height:110px;overflow:auto;">${items || '<div style="text-align:center;color:#999;">Sin ítems</div>'}</div>
</div>`;
}).join('')||'Sin comandas';
};
window.marcarOrdenEntregada=function(){const c=mesaCanonica(mesaActiva);if(!isD(c))return alert('Solo Delivery');if(!db.deliveryMeta[c]?.facturada)return alert('Primero facture la orden');if(!confirm('Marcar orden entregada y cerrar mesa?'))return;carritoPorMesa[c]=[];db.deliveryMeta[c].facturada=false;db.deliveryMeta[c].entregada=true;mesaMeta[c].inicioUso=null;guardarDatos();actualizarPanelCobro();actualizarContadoresMesasSalida();};
const t0=window.transferirAFactura;window.transferirAFactura=function(i){const c=mesaCanonica(mesaActiva);if(isD(c)&&!db.deliveryMeta[c]){const n=prompt('Delivery - Nombre');if(!n)return;const t=prompt('Delivery - Teléfono');if(!t)return;const d=prompt('Delivery - Dirección');if(!d)return;const r=prompt('Delivery - Referencia')||'';const h=prompt('Delivery - No. Casa')||'';db.deliveryMeta[c]={nombre:n,telefono:t,direccion:d,referencia:r,casa:h,facturada:false,entregada:false};}t0(i);upCom(c);};
const f0=window.finalizarVenta;window.finalizarVenta=async function(){const c=mesaCanonica(mesaActiva);if(isD(c)&&db.deliveryMeta[c]?.facturada)return alert('Ya facturada. Use ORDEN ENTREGADA');const snap=(obtenerCarritoMesaActiva()||[]).map(x=>({...x}));const n=(db.facturasResumen||[]).length;await f0();if(isD(c)&&(db.facturasResumen||[]).length>n){carritoPorMesa[c]=snap;db.deliveryMeta[c]=db.deliveryMeta[c]||{};db.deliveryMeta[c].facturada=true;const last=db.facturasResumen[db.facturasResumen.length-1];if(last)last.tipoFactura='DELIVERY';guardarDatos();actualizarPanelCobro();actualizarContadoresMesasSalida();alert('Delivery facturado: se cierra con ORDEN ENTREGADA');}upCom(c);};
window.renderMesasSalida=function(){const g=document.getElementById('mesas-grid');if(!g)return;allM().forEach(m=>{if(!carritoPorMesa[m])carritoPorMesa[m]=[];inicializarMetaMesa(m);});g.innerHTML='';allM().forEach(m=>{const b=document.createElement('button');b.className='btn btn-mesa-salida';b.dataset.mesa=m;b.textContent=m;b.style.padding='8px 6px';b.style.fontSize='12px';b.style.border='1px solid #b2bec3';b.onclick=()=>seleccionarMesaSalida(m);g.appendChild(b);});if(!allM().includes(mesaActiva))mesaActiva='Mesa 1';seleccionarMesaSalida(mesaActiva);if(!mesaTimerInterval)mesaTimerInterval=setInterval(()=>{actualizarTiempoMesaActiva();actualizarContadoresMesasSalida();if(document.getElementById('comandas')?.classList.contains('active'))renderComandas();},1000);};
const a0=window.aplicarEstadoVisualMesa;window.aplicarEstadoVisualMesa=function(btn,ac){a0(btn,ac);const m=btn?.dataset?.mesa||'';if(!isD(m))return;const c=mesaCanonica(m),q=(carritoPorMesa[c]||[]).reduce((s,it)=>s+Number(it.cantidad||0),0);btn.style.background=q>0?'#C7FFC8':DC;};
const s0=window.seleccionarMesaSalida;window.seleccionarMesaSalida=function(m){s0(m);const c=mesaCanonica(mesaActiva),b=document.getElementById('btn-orden-entregada');if(b)b.style.display=isD(c)?'inline-block':'none';const inN=document.getElementById('venta-cliente-nombre');const inD=document.getElementById('venta-cliente-rnc');const inT=document.getElementById('venta-cliente-telefono');if(inN)inN.value='';if(inD)inD.value='';if(inT)inT.value='';if(typeof actualizarEstadoClienteSalida==='function')actualizarEstadoClienteSalida(null,'Cliente sin identificar.');};
window.abrirDetalleFacturaHistorial=function(i){const src=(db.facturasResumen||[]).filter(x=>(!x.owner||x.owner===sesionUser.user)&&moduloPerteneceVista(x.modulo));const f=[...src].reverse()[i];if(!f)return;const b=document.getElementById('detalle-factura-body');b.innerHTML=`<div><b>${f.nombre||'CLIENTE'}</b> | ${f.rnc||'-'} | ${f.telefono||'-'}</div><div>Mesa: ${f.mesa||'-'} | NCF: ${f.ncf||'-'} | Código: ${f.codigo||'-'}</div><div>Órdenes de la factura:</div><ul>${(f.items||[]).map(it=>`<li>${it.cantidad}x ${it.nombre}</li>`).join('')||'<li>Sin ítems</li>'}</ul>`;document.getElementById('modal-detalle-factura').style.display='flex';};
window.actualizarTablaRNC=function(){const t=document.getElementById('tabla-rnc-dgii');if(!t)return;const q=(document.getElementById('busqueda-rnc-clientes')?.value||'').toLowerCase().trim();const src=(db.facturasResumen||[]).filter(x=>(!x.owner||x.owner===sesionUser.user)&&moduloPerteneceVista(x.modulo));const lst=[...src].reverse().filter(c=>!q||[c.nombre,c.rnc,c.telefono,c.ncf,c.mesa,c.codigo].join(' ').toLowerCase().includes(q));t.innerHTML=lst.map((c,i)=>`<tr onclick="abrirDetalleFacturaHistorial(${i})" style="cursor:pointer;"><td>${c.fecha||'---'}</td><td>${c.operador||'---'}</td><td>${c.mesa||'---'}</td><td>${c.nombre||'---'} ${((c.tipoFactura||'')==='DELIVERY'||isD(c.mesa))?'<span style="color:'+TG+';font-weight:800;">DELIVERY</span>':''}</td><td>${c.ncf||'---'}</td><td>${c.rnc||'---'}</td><td>${c.codigo||'---'}</td><td>RD$${Number(c.total||0).toFixed(2)}</td><td>${c.telefono||'-'}</td></tr>`).join('')||'<tr><td colspan="9" style="text-align:center;color:gray;">Sin facturas</td></tr>';};
const g0=window.registrarFacturaEnResumen;window.registrarFacturaEnResumen=function(p){g0(p);const l=db.facturasResumen[db.facturasResumen.length-1];if(l)l.tipoFactura=isD(l.mesa)?'DELIVERY':'FISICA';guardarDatos();};
const sh0=window.showPage;window.showPage=function(id){sh0(id);if(id==='comandas')renderComandas();if(id==='rnc-dgii')actualizarTablaRNC();};
document.addEventListener('DOMContentLoaded',()=>{edb();const st=document.createElement('style');st.textContent='.delivery-tag{color:'+TG+';font-weight:800;}';document.head.appendChild(st);const refs=[...document.querySelectorAll('.folder-content a')],h=refs.find(a=>(a.textContent||'').includes('Resumen de facturas'));if(h&&!refs.some(a=>(a.getAttribute('onclick')||'').includes("showPage('comandas')"))){const a=document.createElement('a');a.setAttribute('onclick',"showPage('comandas')");a.textContent='🧾 Comandas';h.parentElement.insertBefore(a,h.nextSibling);}const main=document.getElementById('main-content');if(main&&!document.getElementById('comandas')){const s=document.createElement('div');s.id='comandas';s.className='content-section';s.innerHTML='<div class="card"><h2>🧾 Hoja de Comandas <button class="btn btn-blue" onclick="abrirHistorialComandasModal()">VER HISTORIAL</button></h2><div id="comandas-activas"></div></div>';main.appendChild(s);}if(!document.getElementById('modal-historial-comandas')){const m=document.createElement('div');m.id='modal-historial-comandas';m.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:3200;align-items:center;justify-content:center;padding:16px;';m.innerHTML='<div style="width:min(900px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:12px;border-top:6px solid var(--blue);"><div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #eee;"><strong>Historial de Comandas</strong><button class="btn btn-danger" onclick="document.getElementById(\'modal-historial-comandas\').style.display=\'none\'">X</button></div><div id="historial-comandas-body" style="padding:14px;"></div></div>';document.body.appendChild(m);}if(!document.getElementById('modal-detalle-factura')){const m=document.createElement('div');m.id='modal-detalle-factura';m.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:3210;align-items:center;justify-content:center;padding:16px;';m.innerHTML='<div style="width:min(980px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:12px;border-top:6px solid var(--accent);"><div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #eee;"><strong>Detalle Cliente / Factura</strong><button class="btn btn-danger" onclick="document.getElementById(\'modal-detalle-factura\').style.display=\'none\'">X</button></div><div id="detalle-factura-body" style="padding:14px;"></div></div>';document.body.appendChild(m);}const sc=document.querySelector('#salida .card[style*="border-left"]');if(sc&&!document.getElementById('btn-orden-entregada')){const b=document.createElement('button');b.id='btn-orden-entregada';b.className='btn btn-blue';b.textContent='ORDEN ENTREGADA';b.style.display='none';b.style.marginTop='8px';b.onclick=marcarOrdenEntregada;const p=sc.querySelector('button[onclick="finalizarVenta()"]')?.parentElement;if(p)p.appendChild(b);}});
})();

// Ajuste Delivery: botón "INGRESE DATOS DE ENVIO" en Detalle de Venta
(function(){
  function isDeliveryMesaName(m){ return /^Delivery\s+\d+$/i.test(String(m || '')); }
  function canonMesaActual(){ return (typeof mesaCanonica === 'function') ? mesaCanonica(mesaActiva) : mesaActiva; }
  function tieneDatosEnvio(mesa){
    const d = (db && db.deliveryMeta && db.deliveryMeta[mesa]) ? db.deliveryMeta[mesa] : null;
    return !!(d && String(d.nombre || '').trim() && String(d.telefono || '').trim() && String(d.direccion || '').trim());
  }

  function asegurarModalDatosEnvio(){
    if (document.getElementById('modal-datos-envio-delivery')) return;
    const m = document.createElement('div');
    m.id = 'modal-datos-envio-delivery';
    m.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,.65); z-index:3310; align-items:center; justify-content:center; padding:16px;';
    m.innerHTML = `
      <div style="width:min(520px,96vw); background:#fff; border-radius:12px; box-shadow:0 18px 45px rgba(0,0,0,.35); border-top:6px solid #ff9f43;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border-bottom:1px solid #eee;">
          <strong>🚚 Datos de Envío Delivery</strong>
          <button class="btn btn-danger" onclick="cerrarModalDatosEnvioDelivery()">X</button>
        </div>
        <div style="padding:14px; display:grid; gap:10px;">
          <input id="delivery-envio-nombre" type="text" placeholder="Nombre">
          <input id="delivery-envio-telefono" type="text" placeholder="Teléfono">
          <input id="delivery-envio-direccion" type="text" placeholder="Dirección">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; padding:12px 14px; border-top:1px solid #eee;">
          <button class="btn" style="background:#7f8c8d; color:#fff;" onclick="cerrarModalDatosEnvioDelivery()">CANCELAR</button>
          <button class="btn btn-save" onclick="guardarDatosEnvioDelivery()">GUARDAR</button>
        </div>
      </div>`;
    document.body.appendChild(m);
  }

  function asegurarBotonDatosEnvio(){
    const panel = document.querySelector('#salida .card[style*="border-left"]');
    if (!panel) return;
    if (document.getElementById('btn-datos-envio-delivery')) return;
    const holder = panel.querySelector('button[onclick="finalizarVenta()"]')?.parentElement || panel;
    const b = document.createElement('button');
    b.id = 'btn-datos-envio-delivery';
    b.className = 'btn btn-warning';
    b.textContent = 'INGRESE DATOS DE ENVIO';
    b.style.display = 'none';
    b.style.marginTop = '8px';
    b.onclick = () => abrirModalDatosEnvioDelivery();
    holder.appendChild(b);
  }

  function actualizarBotonDatosEnvio(){
    const btn = document.getElementById('btn-datos-envio-delivery');
    if (!btn) return;
    const mesa = canonMesaActual();
    const esDelivery = isDeliveryMesaName(mesa);
    btn.style.display = esDelivery ? 'inline-block' : 'none';
    if (!esDelivery) return;
    btn.textContent = tieneDatosEnvio(mesa) ? 'EDITAR DATOS DE ENVIO' : 'INGRESE DATOS DE ENVIO';
    btn.style.background = tieneDatosEnvio(mesa) ? '#2ed573' : '#ffa502';
    btn.style.color = '#fff';
  }

  function asegurarDataCuentasMesa(){
    if (!db.mesaCuentas || typeof db.mesaCuentas !== 'object') db.mesaCuentas = {};
  }
  function asegurarEstadoVentaMesa(){
    if (!db.mesaEstadoVenta || typeof db.mesaEstadoVenta !== 'object') db.mesaEstadoVenta = {};
  }
  function esMesaFacturada(mesa){
    asegurarEstadoVentaMesa();
    const key = String(mesa || '');
    return !!(db.mesaEstadoVenta[key] && db.mesaEstadoVenta[key].facturada === true);
  }
  function setMesaFacturada(mesa, facturada = true){
    asegurarEstadoVentaMesa();
    const key = String(mesa || '');
    if (!db.mesaEstadoVenta[key]) db.mesaEstadoVenta[key] = {};
    db.mesaEstadoVenta[key].facturada = !!facturada;
    db.mesaEstadoVenta[key].updatedAt = new Date().toISOString();
  }
  window.esMesaFacturadaActual = function(){
    return esMesaFacturada(canonMesaActual());
  };

  function actualizarEstadoBotonRegistrarSalida(){
    const btn = document.getElementById('btn-registrar-salida');
    if (!btn) return;
    const mesa = canonMesaActual();
    const esDelivery = isDeliveryMesaName(mesa);
    const carrito = (typeof obtenerCarritoMesaActiva === 'function') ? (obtenerCarritoMesaActiva() || []) : [];
    const totalItems = carrito.reduce((a, it) => a + Number(it?.cantidad || 0), 0);
    let text = '📤 REGISTRAR SALIDA';
    let color = '#2ed573';
    let disabled = false;
    let ready = false;

    if (totalItems <= 0) {
      text = '🛒 AGREGUE PRODUCTOS';
      color = '#95a5a6';
      disabled = true;
    } else if (esDelivery && !tieneDatosEnvio(mesa)) {
      text = '📦 COMPLETE DATOS DE ENV\u00cdO';
      color = '#ffa502';
      disabled = true;
    } else if (!esDelivery && esMesaFacturada(mesa)) {
      text = '🧾 CUENTA FACTURADA';
      color = '#27ae60';
      disabled = true;
    } else if (!esDelivery) {
      const cfg = getCuentaMesa(mesa);
      if (!cfg || !Array.isArray(cfg.personas) || !cfg.personas.length) {
        text = '👥 CONFIGURE PERSONAS';
        color = '#8e44ad';
        disabled = true;
      } else {
        const dist = obtenerDistribucionConsumoMesa(mesa);
        if (Number(dist.totalSinAsignar || 0) > 0) {
          text = '🧾 ASIGNE CONSUMOS';
          color = '#ff7675';
          disabled = true;
        } else if (personasMesaPendientes(mesa).length > 0) {
          text = '💳 COBRE CUENTAS PENDIENTES';
          color = '#f39c12';
          disabled = true;
        } else {
          ready = true;
        }
      }
    } else {
      ready = true;
    }

    btn.textContent = text;
    btn.style.background = color;
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '.75' : '1';
    if (ready) btn.classList.add('btn-dynamic-ready');
    else btn.classList.remove('btn-dynamic-ready');
  }

  function obtenerTotalMesaActual(){
    try {
      const carrito = (typeof obtenerCarritoMesaActiva === 'function') ? (obtenerCarritoMesaActiva() || []) : [];
      const cliente = (typeof obtenerClienteSalidaActual === 'function') ? obtenerClienteSalidaActual() : null;
      const calc = (typeof calcularDetallePreciosVenta === 'function') ? calcularDetallePreciosVenta(carrito, cliente) : null;
      return Number(calc?.total || 0);
    } catch(_) {
      const txt = (document.getElementById('total-cobro')?.textContent || '').replace(/[^\d.]/g,'');
      return Number(txt || 0);
    }
  }

  function getCuentaMesa(mesa){
    asegurarDataCuentasMesa();
    return db.mesaCuentas[mesa] || null;
  }

  function personasMesaPendientes(mesa){
    const personas = calcularMontosPersonas(mesa);
    return personas.filter(p => Number(p.montoObjetivo || 0) > 0 && !p.pagada);
  }

  function obtenerDistribucionConsumoMesa(mesa){
    const cfg = getCuentaMesa(mesa);
    const personas = Array.isArray(cfg?.personas) ? cfg.personas : [];
    const porPersona = new Map();
    personas.forEach(p => porPersona.set(String(p.id || ''), { total: 0, items: 0 }));

    const carrito = (typeof obtenerCarritoMesaActiva === 'function') ? (obtenerCarritoMesaActiva() || []) : [];
    const cliente = (typeof obtenerClienteSalidaActual === 'function') ? obtenerClienteSalidaActual() : null;
    const calc = (typeof calcularDetallePreciosVenta === 'function') ? calcularDetallePreciosVenta(carrito, cliente) : { detalles: [] };
    const detalleMap = new Map((calc.detalles || []).map(d => [d.key, d]));

    let totalSinAsignar = 0;
    let itemsSinAsignar = 0;
    carrito.forEach(item => {
      const key = (typeof keyItemVenta === 'function') ? keyItemVenta(item) : '';
      const det = detalleMap.get(key);
      const subtotal = Number(det?.subtotal ?? (Number(item.precio || 0) * Number(item.cantidad || 0)));
      const pid = String(item?.personaId || '');
      if (!pid || !porPersona.has(pid)) {
        totalSinAsignar += subtotal;
        itemsSinAsignar += Number(item?.cantidad || 0);
        return;
      }
      const row = porPersona.get(pid);
      row.total += subtotal;
      row.items += Number(item?.cantidad || 0);
    });

    return { porPersona, totalSinAsignar, itemsSinAsignar };
  }

  function calcularMontosPersonas(mesa){
    const cfg = getCuentaMesa(mesa);
    const personas = Array.isArray(cfg?.personas) ? cfg.personas : [];
    if (!personas.length) return [];
    const dist = obtenerDistribucionConsumoMesa(mesa);
    return personas.map(p => {
      const row = dist.porPersona.get(String(p.id || '')) || { total: 0, items: 0 };
      return { ...p, montoObjetivo: Math.max(0, Number(row.total || 0)), itemsConsumo: Number(row.items || 0) };
    });
  }

  function asegurarUICuentasMesa(){
    const panel = document.querySelector('#salida .card[style*="border-left"]');
    if (!panel) return;
    if (!document.getElementById('mesa-cuentas-wrap')) {
      const acciones = panel.querySelector('button[onclick="finalizarVenta()"]')?.parentElement || panel;
      const box = document.createElement('div');
      box.id = 'mesa-cuentas-wrap';
      box.style.cssText = 'margin:10px 0; padding:10px; border:1px dashed #ccc; border-radius:8px; background:#fafafa;';
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
          <strong style="font-size:12px; color:var(--secondary);">Cuentas por persona (Mesa física)</strong>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-danger" style="padding:8px 10px;" onclick="eliminarClientesMesaActual()">ELIMINAR CLIENTES</button>
            <button class="btn btn-purple" style="padding:8px 10px;" onclick="abrirModalConfigPersonasMesa()">CONFIGURAR PERSONAS</button>
          </div>
        </div>
        <div id="mesa-cuentas-lista" style="display:grid; gap:8px;"></div>
        <button id="btn-cobrar-todos-mesa" class="btn btn-save" style="margin-top:8px; display:none;" onclick="abrirModalPagoMesaTodos()">COBRAR A TODOS</button>`;
      acciones.parentNode.insertBefore(box, acciones);
    }
    if (!document.getElementById('btn-cerrar-cuenta-mesa')) {
      const acciones = panel.querySelector('button[onclick="finalizarVenta()"]')?.parentElement || panel;
      const b = document.createElement('button');
      b.id = 'btn-cerrar-cuenta-mesa';
      b.className = 'btn btn-danger';
      b.style.marginTop = '8px';
      b.style.display = 'none';
      b.textContent = 'CERRAR CUENTA';
      b.onclick = () => cerrarCuentaMesaActual();
      acciones.appendChild(b);
    }
  }

  function refrescarBotonCerrarCuenta(){
    const btn = document.getElementById('btn-cerrar-cuenta-mesa');
    if (!btn) return;
    const mesa = canonMesaActual();
    const esDelivery = isDeliveryMesaName(mesa);
    btn.style.display = (!esDelivery && esMesaFacturada(mesa)) ? 'inline-block' : 'none';
  }

  window.cerrarCuentaMesaActual = function(){
    const mesa = canonMesaActual();
    if (isDeliveryMesaName(mesa)) return alert('Use ORDEN ENTREGADA para Delivery.');
    if (!esMesaFacturada(mesa)) return alert('Esta cuenta aún no está facturada.');
    if (!confirm('¿Cerrar cuenta y limpiar pedido de esta mesa?')) return;
    carritoPorMesa[mesa] = [];
    inicializarMetaMesa(mesa);
    mesaMeta[mesa].inicioUso = null;
    if (db.mesaCuentas && db.mesaCuentas[mesa]) delete db.mesaCuentas[mesa];
    if (db.mesaClienteVenta && db.mesaClienteVenta[mesa]) delete db.mesaClienteVenta[mesa];
    const inputNom = document.getElementById('venta-cliente-nombre');
    const inputDoc = document.getElementById('venta-cliente-rnc');
    const inputTel = document.getElementById('venta-cliente-telefono');
    if (inputNom) inputNom.value = '';
    if (inputDoc) inputDoc.value = '';
    if (inputTel) inputTel.value = '';
    if (typeof actualizarEstadoClienteSalida === 'function') actualizarEstadoClienteSalida(null, 'Cliente sin identificar.');
    const totalEl = document.getElementById('total-cobro');
    if (totalEl) totalEl.innerText = 'RD$0.00';
    setMesaFacturada(mesa, false);
    guardarDatos();
    if (typeof actualizarPanelCobro === 'function') actualizarPanelCobro();
    if (typeof actualizarContadoresMesasSalida === 'function') actualizarContadoresMesasSalida();
  };

  function asegurarModalesCuentasMesa(){
    if (!document.getElementById('modal-personas-mesa')) {
      const m = document.createElement('div');
      m.id = 'modal-personas-mesa';
      m.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,.65); z-index:3330; align-items:center; justify-content:center; padding:16px;';
      m.innerHTML = `
      <div style="width:min(620px,96vw); background:#fff; border-radius:12px; border-top:6px solid #3498db;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border-bottom:1px solid #eee;">
          <strong>👥 Configurar Personas en Mesa</strong>
          <button class="btn btn-danger" onclick="cerrarModalConfigPersonasMesa()">X</button>
        </div>
        <div style="padding:14px; display:grid; gap:10px;">
          <input id="mesa-personas-cantidad" type="number" min="1" max="20" placeholder="Cantidad de personas" oninput="renderInputsPersonasMesa()">
          <div id="mesa-personas-inputs" style="display:grid; gap:8px; max-height:320px; overflow:auto;"></div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; padding:12px 14px; border-top:1px solid #eee;">
          <button class="btn" style="background:#7f8c8d;color:#fff;" onclick="cerrarModalConfigPersonasMesa()">CANCELAR</button>
          <button class="btn btn-save" onclick="guardarConfigPersonasMesa()">GUARDAR</button>
        </div>
      </div>`;
      document.body.appendChild(m);
    }
    if (!document.getElementById('modal-pago-cuentas-mesa')) {
      const m = document.createElement('div');
      m.id = 'modal-pago-cuentas-mesa';
      m.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,.65); z-index:3340; align-items:center; justify-content:center; padding:16px;';
      m.innerHTML = `
      <div style="width:min(520px,96vw); background:#fff; border-radius:12px; border-top:6px solid #2ed573;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border-bottom:1px solid #eee;">
          <strong id="pago-cuentas-mesa-titulo">Método de pago</strong>
          <button class="btn btn-danger" onclick="cerrarModalPagoCuentaMesa()">X</button>
        </div>
        <div style="padding:14px; display:grid; gap:10px;">
          <div id="pago-cuentas-mesa-monto" style="font-weight:800; color:#2f3542;">Monto: RD$0.00</div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
            <button class="btn btn-save" onclick="seleccionarMetodoPagoCuentaMesa('EFECTIVO')">💵 EFECTIVO</button>
            <button class="btn btn-blue" onclick="seleccionarMetodoPagoCuentaMesa('TARJETA')">💳 TARJETA</button>
            <button class="btn btn-warning" onclick="seleccionarMetodoPagoCuentaMesa('TRANSFERENCIA')">🏦 TRANSFERENCIA</button>
          </div>
          <div id="pago-cuentas-mesa-metodo" style="font-size:12px; color:#555;">Método seleccionado: -</div>
          <div id="pago-cuentas-mesa-efectivo-wrap" style="display:none; border:1px dashed #c8d6e5; border-radius:10px; padding:10px; background:#f8fbff;">
            <label style="font-size:12px; font-weight:700; color:#2f3542; display:block; margin-bottom:6px;">Monto recibido en efectivo</label>
            <input id="pago-cuentas-mesa-efectivo-recibido" type="number" min="0" step="0.01" placeholder="0.00" oninput="actualizarCambioPagoCuentaMesa()">
            <div id="pago-cuentas-mesa-efectivo-cambio" style="margin-top:8px; font-size:13px; font-weight:800; color:#2f3542;">Devuelta: RD$0.00</div>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; padding:12px 14px; border-top:1px solid #eee;">
          <button class="btn" style="background:#7f8c8d;color:#fff;" onclick="cerrarModalPagoCuentaMesa()">CANCELAR</button>
          <button class="btn btn-save" onclick="confirmarPagoCuentaMesa()">CONFIRMAR PAGO</button>
        </div>
      </div>`;
      document.body.appendChild(m);
    }
    if (!document.getElementById('modal-asignar-plato-persona')) {
      const m = document.createElement('div');
      m.id = 'modal-asignar-plato-persona';
      m.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,.65); z-index:3345; align-items:center; justify-content:center; padding:16px;';
      m.innerHTML = `
      <div style="width:min(520px,96vw); background:#fff; border-radius:12px; border-top:6px solid #1e90ff;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border-bottom:1px solid #eee;">
          <strong>🧪 Asignar Plato a Cliente</strong>
          <button class="btn btn-danger" onclick="cerrarModalAsignarPlatoPersona()">X</button>
        </div>
        <div style="padding:14px;">
          <div style="font-size:12px; color:#666; margin-bottom:8px;">Seleccione la persona de la mesa:</div>
          <div id="asignar-plato-persona-lista" style="display:grid; gap:8px;"></div>
        </div>
      </div>`;
      document.body.appendChild(m);
    }
  }

  let pagoCuentaMesaCtx = null;
  let asignarPlatoIndexPendiente = null;

  function refrescarPanelCuentasMesa(){
    const mesa = canonMesaActual();
    const lista = document.getElementById('mesa-cuentas-lista');
    const btnTodos = document.getElementById('btn-cobrar-todos-mesa');
    if (!lista || !btnTodos) return;
    refrescarBotonCerrarCuenta();
    actualizarEstadoBotonRegistrarSalida();
    if (isDeliveryMesaName(mesa)) {
      lista.innerHTML = '<div style="font-size:12px;color:#777;">Mesas Delivery no usan cuentas por persona.</div>';
      btnTodos.style.display = 'none';
      actualizarEstadoBotonRegistrarSalida();
      return;
    }
    const cfg = getCuentaMesa(mesa);
    const personasCalc = calcularMontosPersonas(mesa);
    if (!cfg || !personasCalc.length) {
      lista.innerHTML = '<div style="font-size:12px;color:#777;">No hay personas configuradas en esta mesa.</div>';
      btnTodos.style.display = 'none';
      actualizarEstadoBotonRegistrarSalida();
      return;
    }
    const dist = obtenerDistribucionConsumoMesa(mesa);
    const pendientes = personasCalc.filter(p => !p.pagada && Number(p.montoObjetivo || 0) > 0);
    const avisoSinAsignar = dist.totalSinAsignar > 0
      ? `<div style="padding:8px; border:1px solid #ff7675; border-radius:8px; background:#fff4f4; color:#c0392b; font-size:12px; font-weight:700;">⚠️ Hay consumos sin cliente asignado: RD$${Number(dist.totalSinAsignar || 0).toFixed(2)} (${dist.itemsSinAsignar} item(s)).</div>`
      : '';
    lista.innerHTML = personasCalc.map(p => {
      const tieneConsumo = Number(p.montoObjetivo || 0) > 0;
      const estado = !tieneConsumo ? 'SIN CONSUMO' : (p.pagada ? 'PAGADA' : 'PENDIENTE');
      const color = !tieneConsumo ? '#636e72' : (p.pagada ? '#2ed573' : '#ff9f1a');
      const action = !tieneConsumo
        ? '<span style="font-size:11px; color:#666;">-</span>'
        : (p.pagada ? '<span style="font-size:11px; color:#666;">Cobrada</span>' : `<button class="btn btn-blue" style="padding:6px 10px;" onclick="abrirModalPagoCuentaPersona('${String(p.id||'').replace(/'/g, "\\'")}')">COBRAR</button>`);
      return `<div style="display:grid; grid-template-columns:1fr auto auto; gap:8px; align-items:center; padding:8px; border:1px solid #eee; border-radius:8px;">
        <div><strong>${p.nombre || 'Persona'}</strong><div style="font-size:11px; color:#666;">RD$${Number(p.montoObjetivo || 0).toFixed(2)} · ${Number(p.itemsConsumo || 0)} item(s)</div></div>
        <div style="font-size:11px; font-weight:800; color:${color};">${estado}</div>
        <div>${action}</div>
      </div>`;
    }).join('');
    lista.innerHTML = `${avisoSinAsignar}${lista.innerHTML}`;
    btnTodos.style.display = pendientes.length ? 'inline-block' : 'none';
    actualizarEstadoBotonRegistrarSalida();
  }

  window.abrirModalConfigPersonasMesa = function(){
    const mesa = canonMesaActual();
    if (isDeliveryMesaName(mesa)) return alert('Esta función solo aplica para mesas físicas.');
    asegurarModalesCuentasMesa();
    const cfg = getCuentaMesa(mesa);
    const cant = Math.max(1, Number(cfg?.personas?.length || 1));
    const inCant = document.getElementById('mesa-personas-cantidad');
    if (inCant) inCant.value = cant;
    renderInputsPersonasMesa(cfg?.personas || []);
    document.getElementById('modal-personas-mesa').style.display = 'flex';
  };

  window.cerrarModalConfigPersonasMesa = function(){
    const m = document.getElementById('modal-personas-mesa');
    if (m) m.style.display = 'none';
  };

  window.renderInputsPersonasMesa = function(personasInit){
    const wrap = document.getElementById('mesa-personas-inputs');
    const inCant = document.getElementById('mesa-personas-cantidad');
    if (!wrap || !inCant) return;
    const cant = Math.max(1, Math.min(20, Number(inCant.value || 1)));
    const arr = Array.isArray(personasInit) ? personasInit : [];
    wrap.innerHTML = Array.from({length: cant}).map((_, i) => {
      const nombreBase = (arr[i]?.nombre || `Persona ${i+1}`);
      return `<input type="text" class="mesa-persona-nombre" value="${String(nombreBase).replace(/"/g,'&quot;')}" placeholder="Nombre persona ${i+1}">`;
    }).join('');
  };

  window.guardarConfigPersonasMesa = function(){
    const mesa = canonMesaActual();
    if (isDeliveryMesaName(mesa)) return alert('Esta función solo aplica para mesas físicas.');
    const nombres = Array.from(document.querySelectorAll('.mesa-persona-nombre')).map((el, i) => (el.value || '').trim() || `Persona ${i+1}`);
    if (!nombres.length) return alert('Agregue al menos una persona.');
    asegurarDataCuentasMesa();
    db.mesaCuentas[mesa] = {
      personas: nombres.map((n, i) => ({ id: `P${i+1}`, nombre: n, pagada: false, metodoPago: '', pagadaEn: '' })),
      createdAt: new Date().toISOString()
    };
    __ultimaMesaSolicitadaClientes = mesa;
    guardarDatos();
    cerrarModalConfigPersonasMesa();
    refrescarPanelCuentasMesa();
    if (typeof actualizarContadoresMesasSalida === 'function') actualizarContadoresMesasSalida();
  };

  window.eliminarClientesMesaActual = function(){
    const mesa = canonMesaActual();
    if (isDeliveryMesaName(mesa)) return alert('Delivery no usa clientes por mesa.');
    if (!db.mesaCuentas || !db.mesaCuentas[mesa]) return alert('No hay clientes generados en esta mesa.');
    if (!confirm('¿Eliminar todos los clientes generados de esta mesa?')) return;
    delete db.mesaCuentas[mesa];
    window.__mesaPersonaSeleccionadaId = '';
    window.__mesaPersonaSeleccionadaNombre = '';
    __ultimaMesaSolicitadaClientes = '';
    guardarDatos();
    refrescarPanelCuentasMesa();
    if (typeof actualizarContadoresMesasSalida === 'function') actualizarContadoresMesasSalida();
  };

  window.abrirModalPagoCuentaPersona = function(personaId){
    const mesa = canonMesaActual();
    const personas = calcularMontosPersonas(mesa);
    const p = personas.find(x => String(x.id) === String(personaId));
    if (!p) return;
    if (Number(p.montoObjetivo || 0) <= 0) return alert('Esta persona no tiene consumo asignado.');
    if (p.pagada) return alert('Esta persona ya está pagada.');
    asegurarModalesCuentasMesa();
    pagoCuentaMesaCtx = { tipo: 'persona', personaId: p.id, monto: Number(p.montoObjetivo || 0), metodo: '' };
    const t = document.getElementById('pago-cuentas-mesa-titulo');
    const m = document.getElementById('pago-cuentas-mesa-monto');
    const s = document.getElementById('pago-cuentas-mesa-metodo');
    const wrapEf = document.getElementById('pago-cuentas-mesa-efectivo-wrap');
    const inEf = document.getElementById('pago-cuentas-mesa-efectivo-recibido');
    const lblEf = document.getElementById('pago-cuentas-mesa-efectivo-cambio');
    if (t) t.textContent = `Cobro individual - ${p.nombre || 'Persona'}`;
    if (m) m.textContent = `Monto: RD$${Number(pagoCuentaMesaCtx.monto || 0).toFixed(2)}`;
    if (s) s.textContent = 'Método seleccionado: -';
    if (wrapEf) wrapEf.style.display = 'none';
    if (inEf) inEf.value = '';
    if (lblEf) lblEf.textContent = 'Devuelta: RD$0.00';
    document.getElementById('modal-pago-cuentas-mesa').style.display = 'flex';
  };

  window.abrirModalPagoMesaTodos = function(){
    const mesa = canonMesaActual();
    const pendientes = calcularMontosPersonas(mesa).filter(p => !p.pagada && Number(p.montoObjetivo || 0) > 0);
    if (!pendientes.length) return alert('No hay cuentas pendientes.');
    const monto = pendientes.reduce((a, p) => a + Number(p.montoObjetivo || 0), 0);
    asegurarModalesCuentasMesa();
    pagoCuentaMesaCtx = { tipo: 'todos', monto, metodo: '' };
    const t = document.getElementById('pago-cuentas-mesa-titulo');
    const m = document.getElementById('pago-cuentas-mesa-monto');
    const s = document.getElementById('pago-cuentas-mesa-metodo');
    const wrapEf = document.getElementById('pago-cuentas-mesa-efectivo-wrap');
    const inEf = document.getElementById('pago-cuentas-mesa-efectivo-recibido');
    const lblEf = document.getElementById('pago-cuentas-mesa-efectivo-cambio');
    if (t) t.textContent = 'Cobro total de la mesa';
    if (m) m.textContent = `Monto: RD$${Number(monto || 0).toFixed(2)}`;
    if (s) s.textContent = 'Método seleccionado: -';
    if (wrapEf) wrapEf.style.display = 'none';
    if (inEf) inEf.value = '';
    if (lblEf) lblEf.textContent = 'Devuelta: RD$0.00';
    document.getElementById('modal-pago-cuentas-mesa').style.display = 'flex';
  };

  window.cerrarModalPagoCuentaMesa = function(){
    const m = document.getElementById('modal-pago-cuentas-mesa');
    if (m) m.style.display = 'none';
  };

  window.seleccionarMetodoPagoCuentaMesa = function(metodo){
    if (!pagoCuentaMesaCtx) return;
    pagoCuentaMesaCtx.metodo = metodo;
    const s = document.getElementById('pago-cuentas-mesa-metodo');
    const wrapEf = document.getElementById('pago-cuentas-mesa-efectivo-wrap');
    const inEf = document.getElementById('pago-cuentas-mesa-efectivo-recibido');
    if (wrapEf) wrapEf.style.display = metodo === 'EFECTIVO' ? 'block' : 'none';
    if (metodo === 'EFECTIVO' && inEf) {
      inEf.focus();
      actualizarCambioPagoCuentaMesa();
    }
    if (s) s.textContent = `Método seleccionado: ${metodo}`;
  };

  window.actualizarCambioPagoCuentaMesa = function(){
    const inEf = document.getElementById('pago-cuentas-mesa-efectivo-recibido');
    const lblEf = document.getElementById('pago-cuentas-mesa-efectivo-cambio');
    if (!inEf || !lblEf || !pagoCuentaMesaCtx) return;
    const recibido = Number(inEf.value || 0);
    const cambio = Number(recibido || 0) - Number(pagoCuentaMesaCtx.monto || 0);
    if (cambio >= 0) {
      lblEf.textContent = `Devuelta: RD$${cambio.toFixed(2)}`;
      lblEf.style.color = '#27ae60';
      return;
    }
    lblEf.textContent = `Faltan: RD$${Math.abs(cambio).toFixed(2)}`;
    lblEf.style.color = '#c0392b';
  };

  window.confirmarPagoCuentaMesa = async function(){
    const mesa = canonMesaActual();
    if (!pagoCuentaMesaCtx) return;
    if (!pagoCuentaMesaCtx.metodo) return alert('Seleccione un método de pago.');
    if (pagoCuentaMesaCtx.metodo === 'EFECTIVO') {
      const recibido = Number(document.getElementById('pago-cuentas-mesa-efectivo-recibido')?.value || 0);
      if (!Number.isFinite(recibido) || recibido <= 0) return alert('Ingrese el monto recibido en efectivo.');
      if (recibido < Number(pagoCuentaMesaCtx.monto || 0)) return alert('El monto recibido es menor al total a cobrar.');
    }
    const cfg = getCuentaMesa(mesa);
    if (!cfg || !Array.isArray(cfg.personas)) return alert('Configure las personas de la mesa primero.');
    const ahora = new Date().toLocaleString();
    if (pagoCuentaMesaCtx.tipo === 'persona') {
      const p = cfg.personas.find(x => String(x.id) === String(pagoCuentaMesaCtx.personaId));
      if (!p) return;
      p.pagada = true; p.metodoPago = pagoCuentaMesaCtx.metodo; p.pagadaEn = ahora;
      guardarDatos();
      cerrarModalPagoCuentaMesa();
      refrescarPanelCuentasMesa();
      return;
    }
    const montos = calcularMontosPersonas(mesa);
    cfg.personas.forEach(p => {
      const m = montos.find(x => String(x.id) === String(p.id));
      if (Number(m?.montoObjetivo || 0) > 0) {
        p.pagada = true; p.metodoPago = pagoCuentaMesaCtx.metodo; p.pagadaEn = ahora;
      }
    });
    guardarDatos();
    cerrarModalPagoCuentaMesa();
    refrescarPanelCuentasMesa();
    if (confirm('Pago total registrado. ¿Desea registrar la salida y cerrar la mesa ahora?')) {
      await window.finalizarVenta();
    }
  };

  window.abrirModalAsignarPlatoPersona = function(indexPlato){
    const mesa = canonMesaActual();
    if (isDeliveryMesaName(mesa)) return;
    const cfg = getCuentaMesa(mesa);
    const personas = Array.isArray(cfg?.personas) ? cfg.personas : [];
    if (!personas.length) {
      alert('Primero configure las personas de la mesa.');
      abrirModalConfigPersonasMesa();
      return;
    }
    asignarPlatoIndexPendiente = indexPlato;
    const lista = document.getElementById('asignar-plato-persona-lista');
    if (!lista) return;
    lista.innerHTML = personas.map(p => `
      <button class="btn btn-blue" style="text-align:left;" onclick="confirmarAsignarPlatoPersona('${String(p.id||'').replace(/'/g, "\\'")}')">
        👤 ${p.nombre || 'Persona'}
      ></button>`).join('');
    document.getElementById('modal-asignar-plato-persona').style.display = 'flex';
  };

  window.cerrarModalAsignarPlatoPersona = function(){
    const m = document.getElementById('modal-asignar-plato-persona');
    if (m) m.style.display = 'none';
    asignarPlatoIndexPendiente = null;
  };

  window.confirmarAsignarPlatoPersona = function(personaId){
    const mesa = canonMesaActual();
    const cfg = getCuentaMesa(mesa);
    const personas = Array.isArray(cfg?.personas) ? cfg.personas : [];
    const p = personas.find(x => String(x.id) === String(personaId));
    if (!p) return;
    const idx = asignarPlatoIndexPendiente;
    cerrarModalAsignarPlatoPersona();
    if (idx === null || idx === undefined) return;
    window.__mesaPersonaSeleccionadaId = p.id || '';
    window.__mesaPersonaSeleccionadaNombre = p.nombre || '';
    if (typeof prevTransferir === 'function') prevTransferir(idx);
  };

  window.abrirModalDatosEnvioDelivery = function(){
    const mesa = canonMesaActual();
    if (!isDeliveryMesaName(mesa)) return alert('Seleccione una mesa Delivery.');
    asegurarModalDatosEnvio();
    const d = (db.deliveryMeta && db.deliveryMeta[mesa]) ? db.deliveryMeta[mesa] : {};
    const n = document.getElementById('delivery-envio-nombre');
    const t = document.getElementById('delivery-envio-telefono');
    const dir = document.getElementById('delivery-envio-direccion');
    if (n) n.value = d.nombre || '';
    if (t) t.value = d.telefono || '';
    if (dir) dir.value = d.direccion || '';
    document.getElementById('modal-datos-envio-delivery').style.display = 'flex';
  };

  window.cerrarModalDatosEnvioDelivery = function(){
    const m = document.getElementById('modal-datos-envio-delivery');
    if (m) m.style.display = 'none';
  };

  window.guardarDatosEnvioDelivery = function(){
    const mesa = canonMesaActual();
    if (!isDeliveryMesaName(mesa)) return alert('Seleccione una mesa Delivery.');
    const nombre = (document.getElementById('delivery-envio-nombre')?.value || '').trim();
    const telefono = (document.getElementById('delivery-envio-telefono')?.value || '').trim();
    const direccion = (document.getElementById('delivery-envio-direccion')?.value || '').trim();
    if (!nombre || !telefono || !direccion) return alert('Complete nombre, teléfono y dirección.');
    if (!db.deliveryMeta || typeof db.deliveryMeta !== 'object') db.deliveryMeta = {};
    db.deliveryMeta[mesa] = { ...(db.deliveryMeta[mesa] || {}), nombre, telefono, direccion };
    guardarDatos();
    cerrarModalDatosEnvioDelivery();
    actualizarBotonDatosEnvio();
    actualizarEstadoBotonRegistrarSalida();
    alert('Datos de envío guardados.');
  };

  const prevSeleccionarMesa = window.seleccionarMesaSalida;
  let __ultimaMesaSolicitadaClientes = '';
  function asegurarClientesPorMesaStore() {
    if (!db.mesaClienteVenta || typeof db.mesaClienteVenta !== 'object') db.mesaClienteVenta = {};
  }
  function setClienteMesa(mesa, payload) {
    const key = mesaCanonica(mesa);
    asegurarClientesPorMesaStore();
    const nombre = String(payload?.nombre || '').trim();
    const rnc = String(payload?.rnc || '').trim();
    const telefono = String(payload?.telefono || '').trim();
    if (!nombre && !rnc && !telefono) {
      delete db.mesaClienteVenta[key];
      return;
    }
    db.mesaClienteVenta[key] = {
      nombre,
      rnc,
      telefono,
      updatedAt: new Date().toISOString()
    };
  }
  function getClienteMesa(mesa) {
    asegurarClientesPorMesaStore();
    return db.mesaClienteVenta[mesaCanonica(mesa)] || null;
  }
  function aplicarClienteEnInputsDesdeMesa(mesa) {
    const inN = document.getElementById('venta-cliente-nombre');
    const inD = document.getElementById('venta-cliente-rnc');
    const inT = document.getElementById('venta-cliente-telefono');
    const guardado = getClienteMesa(mesa);
    if (!guardado) {
      if (inN) inN.value = '';
      if (inD) inD.value = '';
      if (inT) inT.value = '';
      if (typeof actualizarEstadoClienteSalida === 'function') actualizarEstadoClienteSalida(null, 'Cliente sin identificar.');
      return null;
    }
    if (inN) inN.value = guardado.nombre || '';
    if (inD) inD.value = guardado.rnc || '';
    if (inT) inT.value = guardado.telefono || '';
    if (typeof obtenerClienteSalidaActual === 'function' && typeof actualizarEstadoClienteSalida === 'function') {
      actualizarEstadoClienteSalida(obtenerClienteSalidaActual(), guardado.nombre ? '' : 'Cliente sin identificar.');
    }
    return guardado;
  }
  window.__seleccionMesaManual = false;
  document.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('.btn-mesa-salida')) window.__seleccionMesaManual = true;
  });
  window.seleccionarMesaSalida = function(mesa){
    if (typeof prevSeleccionarMesa === 'function') prevSeleccionarMesa(mesa);
    actualizarBotonDatosEnvio();
    asegurarUICuentasMesa();
    asegurarModalesCuentasMesa();
    aplicarClienteEnInputsDesdeMesa(canonMesaActual());
    const mesaActual = canonMesaActual();
    const cfgMesa = getCuentaMesa(mesaActual);
    const sinPersonas = !Array.isArray(cfgMesa?.personas) || !cfgMesa.personas.length;
    if (!isDeliveryMesaName(mesaActual)) {
      if (window.__seleccionMesaManual && __ultimaMesaSolicitadaClientes !== mesaActual && sinPersonas) {
        __ultimaMesaSolicitadaClientes = mesaActual;
        abrirModalConfigPersonasMesa();
      }
    }
    window.__seleccionMesaManual = false;
    refrescarPanelCuentasMesa();
  };

  const prevTransferir = window.transferirAFactura;
  window.transferirAFactura = function(index){
    const mesa = canonMesaActual();
    if (isDeliveryMesaName(mesa) && !tieneDatosEnvio(mesa)) {
      alert('Debe ingresar datos de envío antes de agregar productos.');
      abrirModalDatosEnvioDelivery();
      return;
    }
    if (!isDeliveryMesaName(mesa)) {
      if (esMesaFacturada(mesa)) {
        alert('Esta cuenta ya está facturada. Solo puede cerrar la cuenta.');
        return;
      }
      const cfg = getCuentaMesa(mesa);
      const personas = Array.isArray(cfg?.personas) ? cfg.personas : [];
      if (!personas.length) {
        alert('Configure las personas de la mesa para asignar platos por cliente.');
        abrirModalConfigPersonasMesa();
        return;
      }
      abrirModalAsignarPlatoPersona(index);
      return;
    }
    if (typeof prevTransferir === 'function') prevTransferir(index);
  };

  const prevFinalizarVenta = window.finalizarVenta;
  function limpiarMesaDespuesDeVenta(mesa) {
    const canon = mesaCanonica(mesa);
    carritoPorMesa[canon] = [];
    if (typeof inicializarMetaMesa === 'function') inicializarMetaMesa(canon);
    if (mesaMeta && mesaMeta[canon]) mesaMeta[canon].inicioUso = null;
    setMesaFacturada(canon, false);
    if (db.mesaCuentas && typeof db.mesaCuentas === 'object') delete db.mesaCuentas[canon];
    if (db.mesaClienteVenta && typeof db.mesaClienteVenta === 'object') delete db.mesaClienteVenta[canon];
    if (db.deliveryMeta && typeof db.deliveryMeta === 'object') delete db.deliveryMeta[canon];
    if (typeof mesaNombres !== 'undefined' && mesaNombres && typeof mesaNombres === 'object') {
      delete mesaNombres[canon];
    }
    const inputNomMesa = document.getElementById('mesa-nombre-input');
    if (inputNomMesa) inputNomMesa.value = '';
    const inputNom = document.getElementById('venta-cliente-nombre');
    const inputDoc = document.getElementById('venta-cliente-rnc');
    const inputTel = document.getElementById('venta-cliente-telefono');
    if (inputNom) inputNom.value = '';
    if (inputDoc) inputDoc.value = '';
    if (inputTel) inputTel.value = '';
    const estadoCliente = document.getElementById('venta-cliente-estado');
    if (estadoCliente) {
      estadoCliente.style.display = 'block';
      estadoCliente.textContent = 'Cliente sin identificar.';
    }
    const totalEl = document.getElementById('total-cobro');
    if (totalEl) totalEl.innerText = 'RD$0.00';
    window.__mesaPersonaSeleccionadaId = '';
    window.__mesaPersonaSeleccionadaNombre = '';
    __ultimaMesaSolicitadaClientes = '';
    guardarDatos();
  }

  function salirDeMesaPostVenta(mesaCerrada) {
    const destino = mesaCanonica(mesaCerrada);
    if (typeof seleccionarMesaSalida === 'function') seleccionarMesaSalida(destino);
  }

  window.finalizarVenta = async function(){
    const mesa = canonMesaActual();
    const inputNom = document.getElementById('venta-cliente-nombre');
    const inputDoc = document.getElementById('venta-cliente-rnc');
    let tieneClienteGenerado = !!((inputNom?.value || '').toString().trim() || (inputDoc?.value || '').toString().trim());
    if (!tieneClienteGenerado) {
      const restaurado = aplicarClienteEnInputsDesdeMesa(mesa);
      tieneClienteGenerado = !!(restaurado && ((restaurado.nombre || '').trim() || (restaurado.rnc || '').trim()));
    }
    if (!tieneClienteGenerado) {
      window.__ventaPendienteRegistroSalida = true;
      abrirModalRegistrarClienteVenta();
      return;
    }
    const btn = document.getElementById('btn-registrar-salida');
    const txtPrev = btn ? btn.textContent : '';
    const colorPrev = btn ? btn.style.background : '';
    if (!isDeliveryMesaName(mesa) && esMesaFacturada(mesa)) {
      alert('Esta cuenta ya fue facturada. Use CERRAR CUENTA para finalizarla.');
      return;
    }
    if (isDeliveryMesaName(mesa) && !tieneDatosEnvio(mesa)) {
      alert('Debe ingresar datos de envío antes de facturar.');
      abrirModalDatosEnvioDelivery();
      return;
    }
    if (!isDeliveryMesaName(mesa)) {
      const cfg = getCuentaMesa(mesa);
      if (!cfg || !Array.isArray(cfg.personas) || !cfg.personas.length) {
        alert('Antes de abrir esta mesa debe configurar las personas.');
        abrirModalConfigPersonasMesa();
        return;
      }
      const dist = obtenerDistribucionConsumoMesa(mesa);
      if (Number(dist.totalSinAsignar || 0) > 0) {
        alert('Hay consumos sin cliente asignado. Asigne cada producto antes de cerrar la mesa.');
        return;
      }
      const pendientes = personasMesaPendientes(mesa);
      if (pendientes.length) {
        alert('Hay cuentas individuales pendientes. Debe cobrarlas o usar "COBRAR A TODOS".');
        return;
      }
    }
    const snap = (typeof obtenerCarritoMesaActiva === 'function') ? (obtenerCarritoMesaActiva() || []).map(x => ({...x})) : [];
    const nFact = Array.isArray(db.facturasResumen) ? db.facturasResumen.length : 0;
    const nVentas = Array.isArray(db.ventas) ? db.ventas.length : 0;
    if (btn) {
      btn.disabled = true;
      btn.classList.remove('btn-dynamic-ready');
      btn.textContent = '⏳ PROCESANDO VENTA...';
      btn.style.background = '#2980b9';
    }
    try {
      if (typeof prevFinalizarVenta === 'function') await prevFinalizarVenta();
    } catch (e) {
      console.error('Error al finalizar venta:', e);
      alert(`No se pudo completar la salida.\n${String(e?.message || e || 'Error interno')}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = txtPrev || '📤 REGISTRAR SALIDA';
        btn.style.background = colorPrev || '#2ed573';
      }
    }
    const facturo = (Array.isArray(db.facturasResumen) ? db.facturasResumen.length : 0) > nFact;
    const registroVenta = (Array.isArray(db.ventas) ? db.ventas.length : 0) > nVentas;
    if (facturo) {
      if (!isDeliveryMesaName(mesa)) limpiarMesaDespuesDeVenta(mesa);
      if (typeof actualizarEtiquetaMesaActiva === 'function') actualizarEtiquetaMesaActiva();
      if (typeof actualizarPanelCobro === 'function') actualizarPanelCobro();
      if (typeof actualizarContadoresMesasSalida === 'function') actualizarContadoresMesasSalida();
      if (typeof actualizarBotonDatosEnvio === 'function') actualizarBotonDatosEnvio();
      salirDeMesaPostVenta(mesa);
      if (typeof window.autoSubirCloudUrgente === 'function') window.autoSubirCloudUrgente();
    } else if (registroVenta) {
      console.warn('Venta registrada sin facturaResumen; se conserva mesa para evitar pérdida de datos.');
    }
    if (facturo && !isDeliveryMesaName(mesa) && (!obtenerCarritoMesaActiva() || obtenerCarritoMesaActiva().length === 0)) {
      asegurarDataCuentasMesa();
      delete db.mesaCuentas[mesa];
      setMesaFacturada(mesa, false);
      guardarDatos();
      refrescarPanelCuentasMesa();
    }
    refrescarBotonCerrarCuenta();
    actualizarEstadoBotonRegistrarSalida();
  };

  const prevActualizarPanelCobro = window.actualizarPanelCobro;
  window.actualizarPanelCobro = function(){
    if (typeof prevActualizarPanelCobro === 'function') prevActualizarPanelCobro();
    refrescarPanelCuentasMesa();
    refrescarBotonCerrarCuenta();
    actualizarEstadoBotonRegistrarSalida();
  };

  document.addEventListener('DOMContentLoaded', function(){
    asegurarModalDatosEnvio();
    asegurarBotonDatosEnvio();
    asegurarUICuentasMesa();
    asegurarModalesCuentasMesa();
    actualizarBotonDatosEnvio();
    refrescarPanelCuentasMesa();
    actualizarEstadoBotonRegistrarSalida();
  });
})();

(() => {
  function esMovil() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function refsNav() {
    return {
      sidebar: document.getElementById('sidebar'),
      toggle: document.getElementById('mobile-nav-toggle'),
      backdrop: document.getElementById('mobile-nav-backdrop'),
      topbar: document.getElementById('mobile-topbar'),
      topbarTitle: document.getElementById('mobile-topbar-title'),
      login: document.getElementById('login-overlay'),
      selector: document.getElementById('module-selector'),
      main: document.getElementById('main-content')
    };
  }

  function esVisible(el) {
    return !!(el && getComputedStyle(el).display !== 'none');
  }
  let __lastMobileMenuOpenAt = 0;

  window.cerrarSidebarMovil = function(source = '') {
    if (source === 'backdrop' && (Date.now() - __lastMobileMenuOpenAt) < 250) return;
    const { sidebar, backdrop, toggle } = refsNav();
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.style.display = 'none';
    if (toggle) toggle.textContent = '?';
    document.body.classList.remove('mobile-nav-open');
  };

  window.abrirSidebarMovil = function() {
    const { sidebar, backdrop, toggle } = refsNav();
    if (!esMovil() || !sidebar) return;
    __lastMobileMenuOpenAt = Date.now();
    sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.style.display = 'block';
    if (toggle) toggle.textContent = '?';
    document.body.classList.add('mobile-nav-open');
  };

  window.toggleSidebarMovil = function(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    const { sidebar } = refsNav();
    if (!esMovil() || !sidebar) return;
    if (sidebar.classList.contains('mobile-open')) cerrarSidebarMovil();
    else abrirSidebarMovil();
  };

  function tituloMovil() {
    const active = document.querySelector('.content-section.active');
    if (!active) return 'LuRo Control';
    const h2 = active.querySelector('h2');
    const txt = (h2?.textContent || active.id || 'LuRo Control').replace(/\s+/g, ' ').trim();
    return txt || 'LuRo Control';
  }

  function actualizarTopbarMovil() {
    const { topbar, topbarTitle, login, selector, main } = refsNav();
    const visible = esMovil() && !esVisible(login) && !esVisible(selector) && esVisible(main);
    if (topbar) topbar.style.display = visible ? 'flex' : 'none';
    if (topbarTitle && visible) topbarTitle.textContent = tituloMovil();
  }

  function adaptarTablasMovil() {
    if (document.body.classList.contains('mobile-web-like')) return;
    const tables = document.querySelectorAll('table');
    tables.forEach((table) => {
      if (table.dataset.mobileLabelsReady === '1') return;
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent || '').trim());
      if (!headers.length) return;
      table.querySelectorAll('tbody tr').forEach((tr) => {
        Array.from(tr.children).forEach((cell, idx) => {
          if (!(cell instanceof HTMLElement)) return;
          const label = headers[idx] || `Campo ${idx + 1}`;
          cell.setAttribute('data-label', label);
        });
      });
      table.dataset.mobileLabelsReady = '1';
    });
  }

  function syncNav() {
    const { toggle, login, selector, main } = refsNav();
    const visible = esMovil() && !esVisible(login) && !esVisible(selector) && esVisible(main);
    if (toggle) toggle.style.display = visible ? 'block' : 'none';
    document.body.classList.toggle('mobile-app', esMovil());
    document.body.classList.toggle('mobile-web-like', esMovil());
    adaptarTablasMovil();
    actualizarTopbarMovil();
    if (!esMovil()) cerrarSidebarMovil();
  }
  const showPageOriginal = window.showPage;
  if (typeof showPageOriginal === 'function') {
    window.showPage = function(pageId, opts = {}) {
      showPageOriginal(pageId);
      if (esMovil() && opts?.keepMenuOpen !== true) cerrarSidebarMovil();
      adaptarTablasMovil();
      actualizarTopbarMovil();
      syncNav();
    };
  }

  document.addEventListener('click', (ev) => {
    if (!esMovil()) return;
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    const link = target.closest('#sidebar a');
    if (!link) return;
    const esCarpeta = link.classList.contains('menu-folder');
    if (esCarpeta) return;
    const onClickAttr = link.getAttribute('onclick') || '';
    if (onClickAttr.includes("showPage(")) cerrarSidebarMovil();
  });

  window.addEventListener('resize', syncNav);
  document.addEventListener('DOMContentLoaded', () => {
    adaptarTablasMovil();
    syncNav();
    const main = document.getElementById('main-content');
    if (main && 'MutationObserver' in window) {
      const obs = new MutationObserver(() => {
        adaptarTablasMovil();
        actualizarTopbarMovil();
      });
      obs.observe(main, { childList: true, subtree: true });
    }
  });
})();

(() => {
  function asegurarBotonOlvidoLogin() {
    const loginBox = document.querySelector('#login-overlay .login-box');
    if (!loginBox) return;
    if (document.getElementById('btn-olvido-login')) return;
    if (loginBox.querySelector('button[onclick="olvidastePassword()"]')) return;
    const btnAcceder = loginBox.querySelector('button[onclick="intentarLogin()"]');
    if (!btnAcceder) return;
    const btn = document.createElement('button');
    btn.id = 'btn-olvido-login';
    btn.className = 'btn btn-warning';
    btn.style.width = '100%';
    btn.style.padding = '10px';
    btn.style.marginTop = '10px';
    btn.setAttribute('onclick', 'olvidastePassword()');
    btn.textContent = '¿Olvidaste tu contraseña?';
    btnAcceder.insertAdjacentElement('afterend', btn);
  }

  document.addEventListener('DOMContentLoaded', asegurarBotonOlvidoLogin);
  window.addEventListener('load', asegurarBotonOlvidoLogin);
})();

(() => {
  function actualizarEtiquetaMesasSalida() {
    const lbl = document.getElementById('mesas-total-label');
    if (!lbl || typeof allM !== 'function') return;
    try {
      lbl.textContent = `Mesas (${allM().length})`;
    } catch (_) {}
  }

  const prevRenderMesasSalida = window.renderMesasSalida;
  if (typeof prevRenderMesasSalida === 'function') {
    window.renderMesasSalida = function() {
      prevRenderMesasSalida();
      actualizarEtiquetaMesasSalida();
    };
  }

  document.addEventListener('DOMContentLoaded', actualizarEtiquetaMesasSalida);
})();

// ============================
// Diagnóstico Inteligente (escalable)
// ============================
(() => {
  const diagState = {
    resultados: [],
    runtime: []
  };

  const tipoClase = {
    error: 'diagnostico-error',
    warning: 'diagnostico-warning',
    info: 'diagnostico-info'
  };

  function asegurarDiagId(el) {
    if (!el) return null;
    if (!el.dataset.diagId) {
      el.dataset.diagId = `diag-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    return `[data-diag-id="${el.dataset.diagId}"]`;
  }

  function describirElemento(el) {
    if (!el) return 'elemento';
    const parts = [el.tagName?.toLowerCase() || 'el'];
    if (el.id) parts.push(`#${el.id}`);
    if (el.className && typeof el.className === 'string') parts.push(`.${el.className.trim().split(/\s+/).join('.')}`);
    return parts.join('');
  }

  function moduloDeElemento(el) {
    const sec = el?.closest?.('.content-section');
    return sec?.id || 'global';
  }

  function marcarComponente(selectorOrEl, tipo = 'info') {
    const className = tipoClase[tipo] || tipoClase.info;
    const nodes = (typeof selectorOrEl === 'string')
      ? document.querySelectorAll(selectorOrEl)
      : (selectorOrEl ? [selectorOrEl] : []);
    let selector = null;
    nodes.forEach((el) => {
      const sel = asegurarDiagId(el);
      selector = selector || sel;
      el.classList.remove('diagnostico-error', 'diagnostico-warning', 'diagnostico-info');
      el.classList.add(className);
    });
    return selector;
  }

  function removerDiagnostico(selectorOrEl) {
    const nodes = (typeof selectorOrEl === 'string')
      ? document.querySelectorAll(selectorOrEl)
      : (selectorOrEl ? [selectorOrEl] : []);
    nodes.forEach((el) => {
      el.classList.remove('diagnostico-error', 'diagnostico-warning', 'diagnostico-info');
    });
  }

  function limpiarDiagnostico() {
    diagState.resultados = [];
    document.querySelectorAll('.diagnostico-error, .diagnostico-warning, .diagnostico-info').forEach((el) => {
      el.classList.remove('diagnostico-error', 'diagnostico-warning', 'diagnostico-info');
    });
    const panel = document.getElementById('panel-errores');
    if (panel) panel.innerHTML = '<div class="diag-muted">Sin alertas.</div>';
  }

  function buildSelector(el) {
    return asegurarDiagId(el) || 'body';
  }

  function registrarIssue(el, tipo, mensaje, prioridad = 'media') {
    const selector = (typeof el === 'string') ? el : buildSelector(el);
    const obj = {
      selector,
      tipo,
      prioridad,
      mensaje,
      modulo: (typeof el === 'string') ? 'global' : moduloDeElemento(el),
      componente: (typeof el === 'string') ? selector : describirElemento(el)
    };
    diagState.resultados.push(obj);
    marcarComponente(selector, tipo);
  }

  function detectarErroresDOM() {
    const issues = [];
    const push = (el, tipo, msg, prioridad = 'media') => {
      const selector = (typeof el === 'string') ? el : buildSelector(el);
      issues.push({
        selector,
        tipo,
        prioridad,
        mensaje: msg,
        modulo: (typeof el === 'string') ? 'global' : moduloDeElemento(el),
        componente: (typeof el === 'string') ? selector : describirElemento(el)
      });
    };

    // Botones sin evento o con handlers inexistentes
    document.querySelectorAll('button, .btn').forEach((btn) => {
      if (btn.closest('#panel-errores')) return;
      if (btn.disabled) return;
      const onclick = btn.getAttribute('onclick') || '';
      const hasDataset = btn.dataset?.action || btn.dataset?.event;
      const isSubmit = (btn.getAttribute('type') || '').toLowerCase() === 'submit';
      if (onclick) {
        const fnMatch = onclick.match(/([A-Za-z0-9_$]+)\s*\(/);
        if (fnMatch && typeof window[fnMatch[1]] !== 'function') {
          push(btn, 'error', `Función ${fnMatch[1]} no está definida`, 'alta');
        }
      } else if (!hasDataset && !isSubmit) {
        push(btn, 'warning', 'Botón sin evento asignado', 'media');
      }
    });

    // Campos requeridos vacíos
    document.querySelectorAll('input[required], select[required], textarea[required]').forEach((el) => {
      const val = (el.value || '').trim();
      if (!val) push(el, 'warning', 'Campo requerido vacío', 'media');
    });

    // Tablas sin registros (solo cuando deberían tener datos)
    document.querySelectorAll('table').forEach((tbl) => {
      if (tbl.classList.contains('diag-table')) return;
      if (tbl.dataset.allowEmpty === '1') return;
      const body = tbl.querySelector('tbody');
      if (body && body.children.length === 0) {
        push(tbl, 'info', 'Tabla sin registros visibles', 'baja');
      }
    });

    // Enlaces showPage a secciones inexistentes
    document.querySelectorAll('a[onclick*="showPage("]').forEach((a) => {
      const match = (a.getAttribute('onclick') || '').match(/showPage\\('([^']+)'\\)/);
      if (!match) return;
      const id = match[1];
      if (!document.getElementById(id)) {
        push(a, 'error', `showPage apunta a sección inexistente: ${id}`, 'alta');
      }
    });

    // Errores JS capturados previamente
    if (diagState.runtime.length) {
      diagState.runtime.forEach((rt) => issues.push(rt));
      diagState.runtime = [];
    }

    return issues;
  }

  function renderizarErrores() {
    const panel = document.getElementById('panel-errores');
    if (!panel) return;
    if (!diagState.resultados.length) {
      panel.innerHTML = '<div class="diag-muted">Sin alertas.</div>';
      return;
    }
    const rows = diagState.resultados.map((r, idx) => {
      const selEsc = r.selector.replace(/'/g, "\\'");
      const tipoBadge = r.tipo === 'error' ? 'error' : (r.tipo === 'warning' ? 'warn' : 'info');
      return `<tr>
        <td>${r.modulo}</td>
        <td>${r.componente}</td>
        <td>${r.mensaje}</td>
        <td><span class="diag-badge ${tipoBadge}">${r.prioridad}</span></td>
        <td style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-blue" style="padding:6px 8px; font-size:11px;" onclick="irAComponente('${selEsc}')">Ir</button>
          <button class="btn btn-warning" style="padding:6px 8px; font-size:11px;" onclick="removerDiagnostico('${selEsc}')">Resolver</button>
        </td>
      </tr>`;
    }).join('');
    panel.innerHTML = `<table class="diag-table">
      <thead><tr><th>Módulo</th><th>Componente</th><th>Error</th><th>Prioridad</th><th>Acciones</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function irAComponente(selector) {
    const el = document.querySelector(selector);
    if (!el) {
      alert('No se encontró el componente señalado.');
      return;
    }
    const sec = el.closest('.content-section');
    if (sec && !sec.classList.contains('active')) {
      showPage(sec.id, { keepMenuOpen: true });
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220);
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    el.classList.add('diagnostico-info');
    setTimeout(() => el.classList.remove('diagnostico-info'), 2000);
  }

  function ejecutarDiagnosticoGlobal() {
    limpiarDiagnostico();
    const issues = detectarErroresDOM();
    issues.forEach((i) => {
      diagState.resultados.push(i);
      marcarComponente(i.selector, i.tipo);
    });
    renderizarErrores();
  }

  window.ejecutarDiagnosticoGlobal = ejecutarDiagnosticoGlobal;
  window.limpiarDiagnostico = limpiarDiagnostico;
  window.renderizarErrores = renderizarErrores;
  window.removerDiagnostico = removerDiagnostico;
  window.irAComponente = irAComponente;
  window.marcarComponente = marcarComponente;

  window.addEventListener('error', (ev) => {
    diagState.runtime.push({
      selector: 'body',
      tipo: 'error',
      prioridad: 'alta',
      mensaje: `JS: ${ev.message}`,
      modulo: 'global',
      componente: 'script'
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    diagState.runtime.push({
      selector: 'body',
      tipo: 'error',
      prioridad: 'alta',
      mensaje: `Promise rechazada: ${ev.reason}`,
      modulo: 'global',
      componente: 'promise'
    });
  });
})();



