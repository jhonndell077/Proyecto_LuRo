
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
            parentOwner: normalizarOwnerPadreAdmin(sesionUser.parentOwner || sesionUser.delegadoPor),
            canCreateAdmins: puedeUsuarioCrearAdmins(sesionUser),
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
async function crearUsuario() {
    const nombreInput = document.getElementById('new_u_name');
    const passInput = document.getElementById('new_u_pass');
    const nombre = nombreInput.value.trim().toLowerCase();
    const pass = passInput.value;
    const payData = window.__nuevoUsuarioPagoTemp || null;
    const creadorSesion = String(window.obtenerOwnerSesionActual?.() || sesionUser?.user || '').trim().toLowerCase();
    const esSesionSuperMaster = String(sesionUser?.role || '').toLowerCase() === 'super-master' || creadorSesion === MASTER_USER;
    const nuevoAdminPuedeCrearAdmins = esSesionSuperMaster;

    if (!puedeSesionCrearUsuariosAdministradores()) {
        return alert("⛔ Esta cuenta no tiene permisos para crear usuarios administradores.");
    }
    if (!nombre || !pass) return alert("⚠️ Complete usuario y clave.");
    if (!payData) return alert("💳 Debe registrar método de pago antes de añadir el usuario.");
    if (!creadorSesion) return alert("⚠️ No se pudo detectar el administrador en sesión.");

    if (db.usuarios.find(u => u.user === nombre)) {
        return alert("⚠️ El usuario ya existe.");
    }
    if (nombre === creadorSesion) {
        return alert("⚠️ No puede crearse a usted mismo.");
    }

    if (typeof window.crearOwnerCloud === 'function') {
        const okCloud = await window.crearOwnerCloud({
            username: nombre,
            pass,
            empresa: '',
            parentOwner: creadorSesion,
            canCreateAdmins: nuevoAdminPuedeCrearAdmins
        }, { silent: true });
        if (!okCloud) {
            return alert("❌ No se pudo crear el usuario administrador en la nube.");
        }
    }

    db.usuarios.push({
        user: nombre,
        pass: pass,
        role: 'admin',
        activo: true,
        owner: nombre,
        parentOwner: creadorSesion,
        canCreateAdmins: nuevoAdminPuedeCrearAdmins,
        requiereRegistroInicial: false,
        billing: { ...payData, createdAt: new Date().toISOString() }
    });
    guardarDatos();
    actualizarTablaUsuarios();
    
    nombreInput.value = "";
    passInput.value = "";
    window.__nuevoUsuarioPagoTemp = null;
    actualizarEstadoPagoNuevoUsuario();
    alert("✅ Usuario administrador creado con éxito.");
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

    const ownerSesion = String(sesionUser?.user || '').trim().toLowerCase();
    const esSuperMasterSesion = esMasterEnSesion();
    const vistosUsuarios = new Set();
    const usuariosUnicos = (db.usuarios || []).filter(u => {
        if (!u || u.role === 'colaborador') return false;
        const key = String(u.user || '').trim().toLowerCase();
        if (!key || vistosUsuarios.has(key)) return false;
        if (!esSuperMasterSesion && ownerSesion) {
            const parentOwner = normalizarOwnerPadreAdmin(u.parentOwner || u.delegadoPor);
            if (key !== ownerSesion && parentOwner !== ownerSesion) return false;
        }
        vistosUsuarios.add(key);
        return true;
    });

    usuariosUnicos.forEach(u => {
        const row = document.createElement('tr');
        const esSistema = (u.user === 'admin' || u.user === MASTER_USER);
        const puedeCrearAdminsUsuario = puedeUsuarioCrearAdmins(u);
        const parentOwner = normalizarOwnerPadreAdmin(u.parentOwner || u.delegadoPor);
        const perfilUsuario = String(u?.role || '').toLowerCase() === 'super-master'
            ? 'SUPER MASTER'
            : (puedeCrearAdminsUsuario ? 'ADMIN PRINCIPAL' : 'ADMIN DELEGADO');
        const perfilMeta = String(u?.role || '').toLowerCase() === 'super-master'
            ? 'Acceso total del sistema'
            : (puedeCrearAdminsUsuario
                ? 'Puede crear administradores y equipo'
                : `Solo equipo (${(parentOwner || 'raiz').toUpperCase()})`);
        const puedeGestionarObjetivo = puedeSesionGestionarAdminObjetivo(u);
        const estadoTxt = u.activo === false ? 'Suspendido' : 'Activo';
        const estadoColor = u.activo === false ? 'var(--danger)' : 'green';
        const cobroTxt = textoCobroUsuario(u);
        const pagoHtml = resumenMetodoPagoUsuario(u);
        row.innerHTML = `
            <td style="padding:10px 0;">
                <strong>${u.user.toUpperCase()}</strong>
                <div style="font-size:11px; color:#2f3542; font-weight:700; margin-top:3px;">${perfilUsuario}</div>
                <div style="font-size:11px; color:#6b7280;">${perfilMeta}</div>
            </td>
            <td><span style="color:${estadoColor}">✅ ${estadoTxt}</span></td>
            <td>${textoMembresiaUsuario(u)}</td>
            <td>${pagoHtml}</td>
            <td style="font-size:12px; color: var(--secondary);">${cobroTxt}</td>
            <td>
                ${(!esSistema && puedeGestionarObjetivo) ? 
                `<button class="btn-warning" onclick="toggleAccesoUsuarioMaestro('${u.user}')" style="background:#ffa801; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-right:6px;">${u.activo === false ? 'Reactivar' : 'Suspender'}</button><button class="btn-danger" onclick="eliminarUsuario('${u.user}')" style="background:#ff4444; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Eliminar</button>` 
                : '<em style="color:#999">Sin acción</em>'}
            </td>
        `;
        tabla.appendChild(row);
    });
}

async function toggleAccesoUsuarioMaestro(username) {
    const u = (db.usuarios || []).find(x => x.user === username && x.role !== 'colaborador');
    if (!u) return;
    if ((u.user || '').toLowerCase() === MASTER_USER) return alert("🔒 El usuario maestro no se puede suspender.");
    if (!puedeSesionGestionarAdminObjetivo(u)) return alert("⛔ No tiene permisos para gestionar este administrador.");
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
    const targetUser = (db.usuarios || []).find(u =>
        String(u?.user || '').trim().toLowerCase() === String(username || '').trim().toLowerCase() &&
        String(u?.role || '').toLowerCase() !== 'colaborador'
    );
    if (!targetUser) return;
    if (!puedeSesionGestionarAdminObjetivo(targetUser)) {
        return alert("⛔ No tiene permisos para eliminar este administrador.");
    }
    if (!esMasterEnSesion() && String(targetUser?.user || '').trim().toLowerCase() === String(sesionUser?.user || '').trim().toLowerCase()) {
        return alert("⛔ No puede eliminar su propia cuenta administradora.");
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
let masterVaultRefreshInFlight = false;
let masterVaultLoadedOnce = false;
let masterVaultLastSnapshot = '';
let masterVaultLastMetaRefreshAt = 0;
const MASTER_VAULT_REFRESH_MS = 3000;
const MASTER_VAULT_META_REFRESH_MS = 15000;

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
        const includeExtras = (Date.now() - masterVaultLastMetaRefreshAt) >= MASTER_VAULT_META_REFRESH_MS;
        cargarBovedaMaster({ silent: true, includeExtras, includeCollaborators: false });
    }, MASTER_VAULT_REFRESH_MS);
}

function construirSnapshotBovedaMaster(owners = []) {
    return JSON.stringify((Array.isArray(owners) ? owners : []).map((o) => ({
        username: String(o?.username || '').trim().toLowerCase(),
        empresa: String(o?.empresa || ''),
        activo: o?.activo !== false,
        createdAt: String(o?.createdAt || ''),
        collaboratorsCount: Number(o?.collaboratorsCount || 0),
        online: o?.online === true
    })));
}

function renderRowsBovedaMaster(body, owners = []) {
    if (!body) return;
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

async function verColaboradoresBoveda(owner, opts = {}) {
    const ownerKey = String(owner || '').trim().toLowerCase();
    if (!ownerKey) return;
    const silent = opts?.silent === true;
    masterVaultOwnerSelected = ownerKey;
    const title = document.getElementById('master-vault-collab-title');
    const body = document.getElementById('master-vault-collab-body');
    if (title) title.textContent = `Colaboradores de ${ownerKey.toUpperCase()}`;
    if (!body) return;
    if (!silent) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777;">Cargando...</td></tr>';
    }
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
    const opts = arguments[0] && typeof arguments[0] === 'object' ? arguments[0] : {};
    const silent = opts?.silent === true;
    const includeExtras = opts?.includeExtras !== false;
    const includeCollaborators = opts?.includeCollaborators !== false;
    if (masterVaultRefreshInFlight) return false;
    masterVaultRefreshInFlight = true;
    if (!masterVaultLoadedOnce) {
        statusEl.textContent = 'Cargando bóveda...';
        statusEl.style.color = '#666';
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777;">Cargando...</td></tr>';
    } else if (!silent) {
        statusEl.textContent = 'Actualizando bóveda...';
        statusEl.style.color = '#0b5ed7';
    }
    if (typeof window.obtenerBovedaMasterCloud !== 'function') {
        statusEl.textContent = 'Backend cloud no disponible.';
        statusEl.style.color = '#c0392b';
        masterVaultRefreshInFlight = false;
        return false;
    }
    try {
        const rs = await window.obtenerBovedaMasterCloud();
        const owners = Array.isArray(rs?.owners) ? rs.owners : [];
        if (!owners.length) {
            if (!masterVaultLoadedOnce || masterVaultLastSnapshot !== '__EMPTY__') {
                body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777;">Sin usuarios maestros.</td></tr>';
                masterVaultLastSnapshot = '__EMPTY__';
            }
            statusEl.textContent = 'Sin registros.';
            statusEl.style.color = '#666';
            masterVaultLoadedOnce = true;
            if (includeExtras) {
                masterVaultLastMetaRefreshAt = Date.now();
                await Promise.all([cargarNotificacionesPagoMaster(), cargarResumenControlMaster()]);
            }
            masterVaultRefreshInFlight = false;
            return;
        }
        const snapshot = construirSnapshotBovedaMaster(owners);
        if (!masterVaultLoadedOnce || snapshot !== masterVaultLastSnapshot) {
            renderRowsBovedaMaster(body, owners);
            masterVaultLastSnapshot = snapshot;
        }
        const onlineCount = owners.filter((o) => o?.online === true).length;
        statusEl.textContent = `Bóveda activa (${owners.length} maestro(s), ${onlineCount} en línea).`;
        statusEl.style.color = '#1f8f4c';
        masterVaultLoadedOnce = true;
        if (includeCollaborators && masterVaultOwnerSelected) {
            await verColaboradoresBoveda(masterVaultOwnerSelected, { silent: true });
        }
    } catch (e) {
        if (!masterVaultLoadedOnce) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#c0392b;">Error cargando bóveda.</td></tr>';
        }
        statusEl.textContent = `Error: ${String(e?.message || e || 'interno')}`;
        statusEl.style.color = '#c0392b';
        masterVaultRefreshInFlight = false;
        return false;
    }
    if (includeExtras) {
        masterVaultLastMetaRefreshAt = Date.now();
        await Promise.all([cargarNotificacionesPagoMaster(), cargarResumenControlMaster()]);
    }
    masterVaultRefreshInFlight = false;
    return true;
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
    const facturaBrand = document.getElementById('factura-negocio');
    if (facturaBrand) {
        const brandLabel = facturaBrand.querySelector('span');
        if (brandLabel) brandLabel.innerText = nombreNegocio.toUpperCase();
        else facturaBrand.innerText = nombreNegocio.toUpperCase();
    }
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

function cerrarFactura() {
    const modal = document.getElementById('modal-factura');
    if (modal) modal.style.display = 'none';
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
  function transferirAFactura(index, cantidadSolicitada, inputCantidadId) {
    const plato = db.platos[index];
    if (!plato) return;
    const cantidadAgregar = Math.max(1, parseInt(cantidadSolicitada, 10) || 1);
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
        itemEnCarrito.cantidad += cantidadAgregar;
    } else {
        carritoVenta.push({
            nombre: plato.nombre,
            precio: plato.precio,
            cantidad: cantidadAgregar,
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

    // Mantenemos la búsqueda visible para añadir varios platos seguidos.
    if (inputCantidadId) {
        const inputCantidad = document.getElementById(String(inputCantidadId));
        if (inputCantidad) inputCantidad.value = '1';
    }
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
        usuarios: [{user: "Jssantana077", pass: "852347", role: "super-master", activo: true, colab: [], parentOwner: '', canCreateAdmins: true}],
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
    const LOCAL_DB_META_KEY = "LURO_CONTROL_DB_META";

function leerMetaDbLocal() {
    try {
        const raw = localStorage.getItem(LOCAL_DB_META_KEY) || "";
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            updatedAtClient: Number(parsed.updatedAtClient || 0),
            syncKey: String(parsed.syncKey || '').trim(),
            uploadedAtClient: Number(parsed.uploadedAtClient || 0),
            lastSource: String(parsed.lastSource || '').trim()
        };
    } catch (_) {
        return null;
    }
}

function guardarMetaDbLocal(meta = {}) {
    const current = leerMetaDbLocal() || {};
    const next = {
        ...current,
        ...meta
    };
    try {
        localStorage.setItem(LOCAL_DB_META_KEY, JSON.stringify(next));
    } catch (_) {}
    window.__luroLastSavedAt = Number(next.updatedAtClient || 0);
    window.__luroLastSyncKey = String(next.syncKey || '').trim();
    window.__cloudLastUploadedAtClient = Number(next.uploadedAtClient || 0);
    return next;
}

window.obtenerMetaDbLocal = leerMetaDbLocal;
window.guardarMetaDbLocal = guardarMetaDbLocal;

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
            activo: true,
            parentOwner: '',
            canCreateAdmins: true
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
                activo: true,
                parentOwner: '',
                canCreateAdmins: true
            };
        }
        const roleNorm = String(u?.role || '').trim().toLowerCase();
        if (roleNorm === 'admin') {
            const parentOwner = normalizarOwnerPadreAdmin(u?.parentOwner || u?.delegadoPor);
            return {
                ...u,
                parentOwner,
                canCreateAdmins: puedeUsuarioCrearAdmins({
                    ...u,
                    role: 'admin',
                    parentOwner
                })
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

function baseTieneContenido(dbRef) {
    if (!dbRef || typeof dbRef !== 'object') return false;
    const claves = ['platos', 'almacen', 'ventas', 'clientes', 'distribuidores', 'historial_prod', 'entradas'];
    if (claves.some((k) => Array.isArray(dbRef[k]) && dbRef[k].length > 0)) return true;
    const extras = ['clientesFidelizacion', 'clientesRNC', 'facturasResumen', 'produccion_stock', 'decomisos', 'autorizaciones', 'catalogoDistribuidores', 'entrenamientos'];
    return extras.some((k) => Array.isArray(dbRef[k]) && dbRef[k].length > 0);
}

window.baseTieneContenido = baseTieneContenido;

    function guardarDatos(opts = {}) { 
        const skipCloudUpload = opts?.skipCloudUpload === true;
        const keepExistingVersion = opts?.keepExistingVersion === true;
        const saveSource = String(opts?.source || '').trim().toLowerCase();
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
        const serializedCurrent = JSON.stringify(db);
        if (serializedCurrent === String(window.__luroLastSavedSnapshot || '')) {
            return;
        }
        const importMeta = window.__cloudApplyingRemote ? (window.__cloudImportMeta || null) : null;
        const now = Date.now();
        const localMeta = leerMetaDbLocal() || {};
        const previousVersion = Number(localMeta?.updatedAtClient || window.__luroLastSavedAt || db?.updatedAt || 0);
        const saveMeta = importMeta && Number(importMeta.updatedAtClient || 0) > 0
            ? {
                updatedAtClient: Number(importMeta.updatedAtClient || now),
                syncKey: String(importMeta.syncKey || `remote-${Date.now()}`).trim(),
                uploadedAtClient: Number(importMeta.updatedAtClient || 0),
                lastSource: String(importMeta.lastSource || 'cloud').trim() || 'cloud'
            }
            : (() => {
                const updatedAtClient = keepExistingVersion
                    ? (previousVersion > 0 ? previousVersion : 0)
                    : now;
                const syncSeed = updatedAtClient > 0 ? updatedAtClient : now;
                return {
                    updatedAtClient,
                    syncKey: `local-${syncSeed}-${Math.random().toString(36).slice(2, 8)}`,
                    lastSource: saveSource || 'local'
                };
            })();
        db.updatedAt = Number(saveMeta.updatedAtClient || 0);
        const serializedDb = JSON.stringify(db);
        if (serializedDb === String(window.__luroLastSavedSnapshot || '')) return;
        if (!window.__cloudApplyingRemote && Number(saveMeta.updatedAtClient || 0) > 0) {
            window.__cloudLocalChangeAt = Number(saveMeta.updatedAtClient || now);
        }
        localStorage.setItem('LURO_CONTROL_DB', serializedDb);
        window.__luroLastSavedSnapshot = serializedDb;
        guardarMetaDbLocal(saveMeta);
        if (!skipCloudUpload && typeof window.autoSubirCloudDebounced === 'function') window.autoSubirCloudDebounced();
    }
function cargarDatos() { 
        const rawDb = localStorage.getItem('LURO_CONTROL_DB') || '';
        window.__luroLastSavedSnapshot = rawDb;
        const localMeta = leerMetaDbLocal();
        window.__luroLastSavedAt = Number(localMeta?.updatedAtClient || 0);
        window.__luroLastSyncKey = String(localMeta?.syncKey || '').trim();
        window.__cloudLastUploadedAtClient = Number(localMeta?.uploadedAtClient || 0);
        let d = null;
        if (rawDb) {
            try {
                d = JSON.parse(rawDb);
            } catch (e) {
                console.warn('No se pudo leer la base local guardada. Se intentará recuperar una copia limpia.', e);
                try {
                    localStorage.setItem(`LURO_CONTROL_DB_RECOVERY_${Date.now()}`, rawDb);
                } catch (_) {}
            }
        }
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

          db.usuarios = db.usuarios.map(u => {
            const roleNorm = String(u?.role || 'admin').trim().toLowerCase();
            const base = {
              ...u,
              user: (u.user || "").trim().toLowerCase(),
              owner: u.owner ? String(u.owner).trim().toLowerCase() : u.owner,
              permisos: normalizarPermisos(u.permisos),
              asignacionesEntradas: normalizarAsignacionesEntradas(u.asignacionesEntradas),
              role: roleNorm,
              activo: u.activo !== false
            };
            if (roleNorm === 'admin' || roleNorm === 'super-master') {
              const parentOwner = normalizarOwnerPadreAdmin(u?.parentOwner || u?.delegadoPor);
              base.parentOwner = parentOwner;
              base.canCreateAdmins = puedeUsuarioCrearAdmins({
                ...base,
                parentOwner,
                canCreateAdmins: u?.canCreateAdmins
              });
            } else {
              base.parentOwner = '';
              base.canCreateAdmins = false;
            }
            return base;
          });

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

          if (typeof window.baseTieneContenido === 'function' && !window.baseTieneContenido(db)) {
            console.warn('Carga local detectó base sin contenido operativo; se mantendrá en modo seguro hasta sincronizar con nube.');
          }
          guardarDatos({ source: 'bootstrap-load', skipCloudUpload: true, keepExistingVersion: true });
        } else {
          console.warn('No se encontró base local. Se crea estructura mínima sin subir automáticamente a la nube.');
          asegurarCuentaMaestra();
          if(!db.qrClienteLinks || typeof db.qrClienteLinks !== 'object') db.qrClienteLinks = {};
          if(!Array.isArray(db.entrenamientos)) db.entrenamientos = [];
          if(!db.configMembresia || typeof db.configMembresia !== 'object') db.configMembresia = { mensualUSD: 20, descuentoPorc: 8, cupoPlatosCosto: 5 };
          aplicarConfigMembresiaDesdeDB();
          guardarDatos({ source: 'bootstrap-empty', skipCloudUpload: true, keepExistingVersion: true });
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
        const parentOwner = normalizarOwnerPadreAdmin(it.parentOwner || it.delegadoPor);
        const base = {
            user,
            pass,
            role: 'admin',
            owner: user,
            activo: it.activo !== false,
            plan: String(it.plan || 'basico').trim().toLowerCase(),
            estado: String(it.estado || 'activo').trim().toLowerCase(),
            suscripcion: it.suscripcion || null,
            parentOwner,
            canCreateAdmins: typeof it?.canCreateAdmins === 'boolean' ? it.canCreateAdmins === true : undefined,
            requiereRegistroInicial: false,
            origenCloud: true
        };
        const baseNormalizada = {
            ...base,
            canCreateAdmins: puedeUsuarioCrearAdmins({
                ...base,
                parentOwner
            })
        };
        if (idx === -1) {
            db.usuarios.push(baseNormalizada);
            cambios++;
        } else {
            const actual = db.usuarios[idx] || {};
            const nuevo = {
                ...actual,
                ...baseNormalizada,
                canCreateAdmins: puedeUsuarioCrearAdmins({
                    ...actual,
                    ...baseNormalizada
                }),
                parentOwner: normalizarOwnerPadreAdmin(baseNormalizada.parentOwner || actual.parentOwner || actual.delegadoPor)
            };
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

        (db.usuarios || []).forEach((u) => {
            const role = String(u?.role || '').trim().toLowerCase();
            if (role !== 'admin' && role !== 'super-master') return;
            u.parentOwner = normalizarOwnerPadreAdmin(u.parentOwner || u.delegadoPor);
            u.canCreateAdmins = puedeUsuarioCrearAdmins(u);
        });

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
    if (cambios > 0) {
        const prevCloudApplying = !!window.__cloudApplyingRemote;
        window.__cloudApplyingRemote = true;
        try {
            guardarDatos();
        } finally {
            window.__cloudApplyingRemote = prevCloudApplying;
        }
    }
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

function normalizarOwnerPadreAdmin(ownerPadre) {
    return String(ownerPadre || '').trim().toLowerCase();
}

function puedeUsuarioCrearAdmins(userData = {}) {
    const role = String(userData?.role || '').trim().toLowerCase();
    const userKey = String(userData?.user || '').trim().toLowerCase();
    const parentOwner = normalizarOwnerPadreAdmin(userData?.parentOwner || userData?.delegadoPor);
    if (role === 'super-master' || userKey === MASTER_USER) return true;
    if (role !== 'admin') return false;
    if (parentOwner && parentOwner !== MASTER_USER) return false;
    // Regla jerárquica global:
    // admin raíz => sí, admin delegado => no.
    return true;
}

function puedeSesionCrearUsuariosAdministradores() {
    if (!sesionUser || esColaboradorSesion) return false;
    return puedeUsuarioCrearAdmins(sesionUser);
}

function puedeSesionGestionarAdminObjetivo(usuarioObjetivo = {}) {
    if (!usuarioObjetivo || String(usuarioObjetivo?.role || '').toLowerCase() === 'colaborador') return false;
    const objetivoUser = String(usuarioObjetivo?.user || '').trim().toLowerCase();
    if (!objetivoUser) return false;
    if (objetivoUser === MASTER_USER) return esMasterEnSesion();
    if (esMasterEnSesion()) return true;
    if (!puedeSesionCrearUsuariosAdministradores()) return false;
    const ownerSesion = String(sesionUser?.user || '').trim().toLowerCase();
    if (!ownerSesion) return false;
    if (objetivoUser === ownerSesion) return true;
    const parentOwner = normalizarOwnerPadreAdmin(usuarioObjetivo?.parentOwner || usuarioObjetivo?.delegadoPor);
    return !!parentOwner && parentOwner === ownerSesion;
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
    if (pageId === 'comandos') return true;
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

let homePerfilQuitarLogo = false;
const LURO_PROFILE_MEDIA_DB = 'luro-profile-media';
const LURO_PROFILE_MEDIA_STORE = 'profile-logos';
let luroProfileMediaDbPromise = null;

function obtenerOwnerClavePerfilInicio(reg) {
    const fromReg = String(reg?.user || '').trim().toLowerCase();
    const fromSession = String(window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || cuentaLoginActual || '').trim().toLowerCase();
    return fromReg || fromSession || '';
}

function abrirDbLogoPerfil() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (luroProfileMediaDbPromise) return luroProfileMediaDbPromise;
    luroProfileMediaDbPromise = new Promise((resolve) => {
        try {
            const req = indexedDB.open(LURO_PROFILE_MEDIA_DB, 1);
            req.onupgradeneeded = () => {
                const dbLocal = req.result;
                if (!dbLocal.objectStoreNames.contains(LURO_PROFILE_MEDIA_STORE)) {
                    dbLocal.createObjectStore(LURO_PROFILE_MEDIA_STORE, { keyPath: 'owner' });
                }
            };
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        } catch (_) {
            resolve(null);
        }
    });
    return luroProfileMediaDbPromise;
}

async function guardarLogoPerfilPersistente(ownerKey, logo, updatedAt) {
    const owner = String(ownerKey || '').trim().toLowerCase();
    if (!owner) return false;
    const dbLocal = await abrirDbLogoPerfil();
    if (!dbLocal) return false;
    const payload = {
        owner,
        logo: String(logo || ''),
        updatedAt: Number(updatedAt || Date.now())
    };
    return new Promise((resolve) => {
        try {
            const tx = dbLocal.transaction(LURO_PROFILE_MEDIA_STORE, 'readwrite');
            tx.objectStore(LURO_PROFILE_MEDIA_STORE).put(payload);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
        } catch (_) {
            resolve(false);
        }
    });
}

async function leerLogoPerfilPersistente(ownerKey) {
    const owner = String(ownerKey || '').trim().toLowerCase();
    if (!owner) return null;
    const dbLocal = await abrirDbLogoPerfil();
    if (!dbLocal) return null;
    return new Promise((resolve) => {
        try {
            const tx = dbLocal.transaction(LURO_PROFILE_MEDIA_STORE, 'readonly');
            const req = tx.objectStore(LURO_PROFILE_MEDIA_STORE).get(owner);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        } catch (_) {
            resolve(null);
        }
    });
}

function aplicarLogoPerfilInicioEnUI(logoSrc) {
    const logoEl = document.getElementById('home-reg-logo');
    if (logoEl) {
        if (logoSrc) {
            logoEl.src = logoSrc;
            logoEl.style.display = 'inline-block';
        } else {
            logoEl.src = '';
            logoEl.style.display = 'none';
        }
    }
    const avatarShell = document.querySelector('.home-profile-avatar-shell');
    if (avatarShell) avatarShell.classList.toggle('has-logo', !!String(logoSrc || '').trim());
}

async function rehidratarLogoPerfilActivo(opts = {}) {
    const reg = opts?.reg || obtenerRegistroInicialActivo();
    const ownerKey = obtenerOwnerClavePerfilInicio(reg);
    if (!reg || !ownerKey) return null;

    const persisted = await leerLogoPerfilPersistente(ownerKey);
    if (!persisted) {
        const currentLogo = String(reg?.logo || '').trim();
        if (currentLogo) {
            const seedAt = Number(reg?.logoUpdatedAt || Date.now());
            guardarLogoPerfilPersistente(ownerKey, currentLogo, seedAt).catch(() => {});
        }
        return null;
    }

    const persistedLogo = String(persisted?.logo || '');
    const persistedAt = Number(persisted?.updatedAt || 0);
    const currentLogo = String(reg?.logo || '');
    const currentAt = Number(reg?.logoUpdatedAt || 0);
    const shouldApply = persistedAt >= currentAt && (persistedLogo !== currentLogo || (!currentLogo && !!persistedLogo));

    if (!shouldApply) {
        if (currentLogo && (!persistedLogo || persistedAt < currentAt)) {
            guardarLogoPerfilPersistente(ownerKey, currentLogo, currentAt || Date.now()).catch(() => {});
        }
        return null;
    }

    if (!db.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
    if (db.registroInicialUsuarios[ownerKey] && typeof db.registroInicialUsuarios[ownerKey] === 'object') {
        db.registroInicialUsuarios[ownerKey] = {
            ...db.registroInicialUsuarios[ownerKey],
            logo: persistedLogo,
            logoUpdatedAt: persistedAt || Date.now()
        };
    }
    if (ownerKey === MASTER_USER && db.registroInicial && typeof db.registroInicial === 'object') {
        db.registroInicial = {
            ...db.registroInicial,
            logo: persistedLogo,
            logoUpdatedAt: persistedAt || Date.now()
        };
    }

    aplicarLogoPerfilInicioEnUI(persistedLogo);
    try {
        guardarDatos();
    } catch (_) {}
    return { logo: persistedLogo, updatedAt: persistedAt || Date.now() };
}

function leerArchivoComoDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve('');
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
        reader.readAsDataURL(file);
    });
}

function cargarImagenDesdeDataUrl(src) {
    return new Promise((resolve, reject) => {
        if (!src) return reject(new Error('Imagen vacia.'));
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
        img.src = src;
    });
}

async function optimizarLogoPerfil(file) {
    const source = await leerArchivoComoDataUrl(file);
    if (!source) return '';
    try {
        const img = await cargarImagenDesdeDataUrl(source);
        const maxSide = 320;
        const scale = Math.min(1, maxSide / Math.max(img.width || maxSide, img.height || maxSide));
        const width = Math.max(1, Math.round((img.width || maxSide) * scale));
        const height = Math.max(1, Math.round((img.height || maxSide) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return source;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const attempts = [
            ['image/webp', 0.86],
            ['image/webp', 0.74],
            ['image/jpeg', 0.82],
            ['image/jpeg', 0.68]
        ];
        let best = source;
        for (const [type, quality] of attempts) {
            let candidate = '';
            try {
                candidate = canvas.toDataURL(type, quality);
            } catch (_) {
                candidate = '';
            }
            if (!candidate) continue;
            if (!best || candidate.length < best.length) best = candidate;
            if (candidate.length <= 160000) return candidate;
        }
        return best && best.length < source.length ? best : source;
    } catch (_) {
        return source;
    }
}

function obtenerInicialesPerfilInicio() {
    const values = Array.from(arguments)
        .map(v => String(v || '').trim())
        .filter(Boolean);
    const base = values[0] || 'LC';
    const parts = base.replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
    return initials || base.slice(0, 2).toUpperCase();
}

function obtenerEtiquetaRolInicio(role) {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'super-master') return 'Dirección general';
    if (r === 'colaborador') return 'Colaborador autorizado';
    return 'Administrador principal';
}

function renderHomePerfilHeader(reg) {
    const info = obtenerOwnerCloudInfoInicio() || {};
    const ownerUser = String(window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || '').trim().toLowerCase();
    const activeUser = String(cuentaLoginActual || operadorActual || sesionUser?.user || ownerUser || '').trim();
    const businessName = String(reg?.businessName || info?.empresa || '').trim();
    const roleKey = String(sesionUser?.role || info?.role || 'admin').trim().toLowerCase();
    const roleLabel = obtenerEtiquetaRolInicio(roleKey);
    const displayName = businessName || (activeUser ? `Perfil de ${activeUser}` : 'LuRo Control');
    const handleLabel = activeUser ? `@${activeUser.toLowerCase()}` : (ownerUser ? `@${ownerUser}` : '@lurocontrol');
    const moduleLabel = String(document.getElementById('current-module-display')?.textContent || moduloActual || '').trim();
    const reason = String(reg?.reason || '').trim();
    const summary = reason || `Centro principal de ${displayName}${moduleLabel ? ` para operar y supervisar ${moduleLabel}.` : '.'}`;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '-';
    };

    setText('home-profile-display-name', displayName);
    setText('home-profile-handle', handleLabel);
    setText('home-profile-role', roleLabel);
    setText('home-profile-owner', ownerUser || activeUser || '-');
    setText('home-profile-summary', summary);

    const roleEl = document.getElementById('home-profile-role');
    if (roleEl) roleEl.dataset.role = roleKey || 'admin';

    const avatarFallback = document.getElementById('home-profile-avatar-fallback');
    if (avatarFallback) {
        avatarFallback.textContent = obtenerInicialesPerfilInicio(businessName, activeUser, ownerUser);
    }

    const avatarShell = document.querySelector('.home-profile-avatar-shell');
    if (avatarShell) {
        avatarShell.classList.toggle('has-logo', !!String(reg?.logo || '').trim());
    }
}

function setEstadoEditarPerfilInicio(msg, isError = false) {
    const box = document.getElementById('home-edit-profile-status');
    if (!box) return;
    box.textContent = msg || '';
    box.style.color = isError ? '#b03a2e' : '#556572';
}

function renderPreviewLogoPerfilInicio(src, fallbackBase) {
    const preview = document.getElementById('home-edit-logo-preview');
    const fallback = document.getElementById('home-edit-logo-fallback');
    const hasSrc = !!String(src || '').trim();
    if (preview) {
        preview.src = hasSrc ? String(src).trim() : '';
        preview.style.display = hasSrc ? 'block' : 'none';
    }
    if (fallback) {
        fallback.textContent = obtenerInicialesPerfilInicio(fallbackBase, document.getElementById('home-edit-user')?.value || '');
        fallback.style.display = hasSrc ? 'none' : 'flex';
    }
}

function abrirModalEditarPerfilInicio() {
    if (bloquearAccionAdministrativaColaborador()) return;
    const reg = obtenerRegistroInicialActivo();
    if (!reg) return alert('No hay perfil registrado para editar.');

    homePerfilQuitarLogo = false;
    const modal = document.getElementById('modal-editar-perfil-home');
    const userField = document.getElementById('home-edit-user');
    const businessField = document.getElementById('home-edit-business');
    const phoneField = document.getElementById('home-edit-phone');
    const reasonField = document.getElementById('home-edit-reason');
    const newPassField = document.getElementById('home-edit-new-pass');
    const confirmField = document.getElementById('home-edit-new-pass-confirm');
    const fileField = document.getElementById('home-edit-logo');

    if (userField) userField.value = reg.user || cuentaLoginActual || sesionUser?.user || '';
    if (businessField) businessField.value = reg.businessName || '';
    if (phoneField) phoneField.value = reg.phone || '';
    if (reasonField) reasonField.value = reg.reason || '';
    if (newPassField) newPassField.value = '';
    if (confirmField) confirmField.value = '';
    if (fileField) fileField.value = '';
    renderPreviewLogoPerfilInicio(reg.logo || '', reg.businessName || reg.user || 'LC');
    setEstadoEditarPerfilInicio('');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalEditarPerfilInicio() {
    const modal = document.getElementById('modal-editar-perfil-home');
    const newPassField = document.getElementById('home-edit-new-pass');
    const confirmField = document.getElementById('home-edit-new-pass-confirm');
    const fileField = document.getElementById('home-edit-logo');
    homePerfilQuitarLogo = false;
    if (newPassField) newPassField.value = '';
    if (confirmField) confirmField.value = '';
    if (fileField) fileField.value = '';
    setEstadoEditarPerfilInicio('');
    if (modal) modal.style.display = 'none';
}

function actualizarPreviewLogoPerfilInicio() {
    const reg = obtenerRegistroInicialActivo() || {};
    const input = document.getElementById('home-edit-logo');
    const file = input?.files?.[0] || null;
    const fallbackBase = document.getElementById('home-edit-business')?.value || reg.businessName || reg.user || 'LC';
    if (!file) {
        renderPreviewLogoPerfilInicio(homePerfilQuitarLogo ? '' : (reg.logo || ''), fallbackBase);
        return;
    }
    homePerfilQuitarLogo = false;
    const reader = new FileReader();
    reader.onload = () => renderPreviewLogoPerfilInicio(reader.result || '', fallbackBase);
    reader.onerror = () => renderPreviewLogoPerfilInicio(reg.logo || '', fallbackBase);
    reader.readAsDataURL(file);
}

function quitarLogoPerfilInicio() {
    homePerfilQuitarLogo = true;
    const input = document.getElementById('home-edit-logo');
    if (input) input.value = '';
    renderPreviewLogoPerfilInicio('', document.getElementById('home-edit-business')?.value || document.getElementById('home-edit-user')?.value || 'LC');
}

async function guardarPerfilDesdeInicio() {
    if (bloquearAccionAdministrativaColaborador()) return;
    const ownerKey = String(window.obtenerOwnerSesionActual?.() || sesionUser?.owner || sesionUser?.user || cuentaLoginActual || '').trim().toLowerCase();
    const reg = obtenerRegistroInicialActivo();
    if (!ownerKey || !reg) return alert('No hay perfil activo para actualizar.');

    const newPass = String(document.getElementById('home-edit-new-pass')?.value || '').trim();
    const confirmPass = String(document.getElementById('home-edit-new-pass-confirm')?.value || '').trim();
    const phoneRaw = String(document.getElementById('home-edit-phone')?.value || '').trim();
    const businessName = String(document.getElementById('home-edit-business')?.value || '').trim();
    const reason = String(document.getElementById('home-edit-reason')?.value || '').trim();
    const logoFile = document.getElementById('home-edit-logo')?.files?.[0] || null;

    if (!phoneRaw || !businessName || !reason) {
        setEstadoEditarPerfilInicio('Complete negocio, WhatsApp y motivo de uso.', true);
        return;
    }
    const phone = normalizarTelefonoWhatsapp(phoneRaw);
    if (!phone) {
        setEstadoEditarPerfilInicio('Número de WhatsApp inválido. Ingrese solo dígitos.', true);
        return;
    }
    if ((newPass || confirmPass) && newPass !== confirmPass) {
        setEstadoEditarPerfilInicio('La nueva contraseña y su confirmación no coinciden.', true);
        return;
    }

    const cuentaActualKey = String(cuentaLoginActual || sesionUser?.user || ownerKey).trim().toLowerCase();
    const cuenta = (db.usuarios || []).find(u => String(u?.user || '').trim().toLowerCase() === cuentaActualKey);
    const sessionPass = String(loginClave || sesionUser?.pass || '').trim();

    const aplicarCambios = async (logoData) => {
        setEstadoEditarPerfilInicio('Guardando perfil...');
        if (newPass) {
            if (typeof window.actualizarPasswordCloud === 'function') {
                if (!sessionPass) {
                    setEstadoEditarPerfilInicio('No se pudo validar la sesión actual para cambiar la contraseña.', true);
                    return;
                }
                const okCloud = await window.actualizarPasswordCloud(sessionPass, newPass);
                if (!okCloud) {
                    setEstadoEditarPerfilInicio('No se pudo actualizar la contraseña en la nube.', true);
                    return;
                }
            }
            if (cuenta) cuenta.pass = newPass;
            if (sesionUser) sesionUser.pass = newPass;
            loginClave = newPass;
            window.loginClave = newPass;
        }

        const nextLogo = homePerfilQuitarLogo ? '' : (typeof logoData === 'string' ? logoData : (reg.logo || ''));
        const currentLogo = String(reg.logo || '');
        const nextLogoUpdatedAt = (nextLogo !== currentLogo || !Number(reg.logoUpdatedAt || 0))
            ? Date.now()
            : Number(reg.logoUpdatedAt || 0);

        if (!db.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
        db.registroInicialUsuarios[ownerKey] = {
            ...reg,
            completado: true,
            user: reg.user || ownerKey,
            phone,
            businessName,
            reason,
            logo: nextLogo,
            logoUpdatedAt: nextLogoUpdatedAt
        };
        if (ownerKey === MASTER_USER) db.registroInicial = { ...db.registroInicialUsuarios[ownerKey] };
        await guardarLogoPerfilPersistente(ownerKey, nextLogo, nextLogoUpdatedAt);

        WHATSAPP_DEFAULT = phone;
        localStorage.setItem('LURO_WHATSAPP_DEFAULT', phone);
        guardarDatos();
        renderHomeRegistroInfo();
        cerrarModalEditarPerfilInicio();
        alert('Perfil actualizado correctamente.');
    };

    try {
        if (logoFile) {
            const logoData = await optimizarLogoPerfil(logoFile);
            await aplicarCambios(logoData || '');
            return;
        }
        await aplicarCambios(undefined);
    } catch (e) {
        setEstadoEditarPerfilInicio(String(e?.message || e || 'No se pudo actualizar el perfil.'), true);
    }
}

function renderHomeRegistroInfo() {
    const reg = obtenerRegistroInicialActivo();
    const btnDel = document.getElementById("home-btn-eliminar-registro");
    const btnEdit = document.getElementById("home-btn-editar-perfil");
    if (btnDel) btnDel.style.display = reg ? "inline-block" : "none";
    if (btnEdit) btnEdit.style.display = reg ? "inline-flex" : "none";

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
        aplicarLogoPerfilInicioEnUI('');
        renderHomePerfilHeader(null);
        renderEstadoMembresiaInicio();
        return;
    }

    const fecha = reg.createdAt ? new Date(reg.createdAt).toLocaleString() : '-';
    setText('home-reg-user', reg.user || '-');
    setText('home-reg-business', reg.businessName || '-');
    setText('home-reg-phone', reg.phone || '-');
    setText('home-reg-created', fecha);
    setText('home-reg-reason', reg.reason || '-');
    aplicarLogoPerfilInicioEnUI(reg.logo || '');
    renderHomePerfilHeader(reg);
    renderEstadoMembresiaInicio();
    rehidratarLogoPerfilActivo({ reg }).catch(() => {});
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
    if (!planEl || !estadoEl) return;

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

    if (noticeEl && (diasTrial > 0 || estado === 'trial')) {
        noticeEl.style.display = 'block';
        noticeEl.textContent = `🎁 Prueba gratis activa: le quedan ${diasTrial} día(s). Después debe completar su pago para mantener acceso.`;
    } else if (noticeEl) {
        noticeEl.style.display = 'none';
        noticeEl.textContent = '';
    }
    if (statusEl) {
        statusEl.textContent = 'Puede cambiar de membresía aquí y completar el pago adicional para activar el nuevo plan.';
    }
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

async function completarRegistroInicial() {
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
        const logo = String(logoData || '');
        const logoUpdatedAt = Date.now();
        if (!db.registroInicialUsuarios || typeof db.registroInicialUsuarios !== 'object') db.registroInicialUsuarios = {};
        db.registroInicialUsuarios[user] = {
            completado: true,
            user,
            phone,
            businessName,
            reason,
            logo,
            logoUpdatedAt,
            createdAt: new Date().toISOString()
        };
        if (user === MASTER_USER) db.registroInicial = { ...db.registroInicialUsuarios[user] };
        guardarLogoPerfilPersistente(user, logo, logoUpdatedAt).catch(() => {});
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
        try {
            const logoData = await optimizarLogoPerfil(logoFile);
            finalizarRegistro(logoData || '');
        } catch (_) {
            finalizarRegistro('');
        }
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
    const { fromCloudListener = false, force = false } = opts;
    const remoteMeta = opts?.remoteMeta && typeof opts.remoteMeta === 'object' ? opts.remoteMeta : {};
    if (!remoteDb || typeof remoteDb !== 'object') return false;
    const serializedRemote = JSON.stringify(remoteDb);
    const localSnapshot = String(window.__luroLastSavedSnapshot || '');
    const now = Date.now();
    const remoteUpdatedAt = Number(remoteMeta.updatedAtClient || 0);
    const remoteSyncKey = String(remoteMeta.syncKey || '').trim();
    const localUpdatedAt = Number(window.__luroLastSavedAt || 0);
    const localHasContent = typeof window.baseTieneContenido === 'function' ? window.baseTieneContenido(db) : true;
    const remoteHasContent = typeof window.baseTieneContenido === 'function' ? window.baseTieneContenido(remoteDb) : true;
    if (fromCloudListener && window.__cloudLocalChangeAt && (now - window.__cloudLocalChangeAt) < (window.__cloudRemoteSettleMs || 2200)) {
        return false;
    }
    if (!force && !remoteHasContent && localHasContent && serializedRemote !== localSnapshot) {
        console.warn('Bloqueado: nube vacía no puede reemplazar base local con contenido.');
        if (typeof window.setSyncStatusPublic === 'function') {
            window.setSyncStatusPublic('Bloqueado: intento de reemplazar datos locales con base cloud vacía.', false);
        }
        if (typeof window.autoSubirCloudUrgente === 'function') {
            setTimeout(() => window.autoSubirCloudUrgente(), 0);
        }
        return false;
    }
    if (!force && remoteUpdatedAt > 0 && localUpdatedAt > 0 && remoteUpdatedAt < localUpdatedAt && serializedRemote !== localSnapshot) {
        if (!localHasContent && remoteHasContent) {
            console.warn('Prioridad nube: se aplicará base cloud con contenido aunque su timestamp sea menor.');
        } else {
            console.warn('Conflicto de versiones: se conserva base local por timestamp más reciente.');
            window.__cloudLastUploadedSnapshot = '';
            window.__cloudLastUploadedAtClient = 0;
            if (typeof window.guardarMetaDbLocal === 'function') {
                window.guardarMetaDbLocal({ uploadedAtClient: 0 });
            }
            if (typeof window.setSyncStatusPublic === 'function') {
                window.setSyncStatusPublic('Se conservó la base local porque la copia cloud era más antigua.', true);
            }
            if (typeof window.autoSubirCloudUrgente === 'function') {
                setTimeout(() => window.autoSubirCloudUrgente(), 0);
            }
            return false;
        }
    }
    if (serializedRemote === window.__cloudLastAppliedSnapshot) {
        return false;
    }
    if (!force && remoteHasContent && !localHasContent && serializedRemote !== localSnapshot) {
        console.warn('Prioridad nube: base local vacía detectada, aplicando datos remotos.');
    }
    if (!force && remoteUpdatedAt <= 0 && remoteHasContent && localHasContent && serializedRemote !== localSnapshot) {
        console.warn('Conflicto sin versión remota válida: se aplicará nube por seguridad de sincronización.');
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
    window.__cloudImportMeta = {
        updatedAtClient: remoteUpdatedAt || Date.now(),
        syncKey: remoteSyncKey || `remote-${Date.now()}`,
        lastSource: 'cloud'
    };
    try {
        window.__cloudLastAppliedSnapshot = serializedRemote;
        guardarDatos();
        window.__cloudLastUploadedSnapshot = String(window.__luroLastSavedSnapshot || serializedRemote || '');
        window.__cloudLastKnownRemoteAt = Number(remoteUpdatedAt || window.__cloudLastKnownRemoteAt || 0);
    } finally {
        window.__cloudImportMeta = null;
        window.__cloudApplyingRemote = false;
    }
    rehidratarLogoPerfilActivo().then((restored) => {
        if (restored && typeof window.refrescarUITrasSyncCloud === 'function') {
            window.refrescarUITrasSyncCloud();
        }
    }).catch(() => {});
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
window.__cloudUiRefreshMinMs = 240;
window.__cloudUiRefreshTimer = null;
window.__cloudDebounceMs = 60;
window.__cloudQueueRetryMs = 20;
window.__cloudLastKnownRemoteAt = 0;
window.__luroLastSavedAt = Number(window.__luroLastSavedAt || 0);
window.__luroLastSyncKey = String(window.__luroLastSyncKey || '').trim();

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
    let ok = false;
    if (typeof window.descargarBaseDesdeCloud === 'function') {
        const downloaded = await window.descargarBaseDesdeCloud({ silent: true, reload: false });
        const pullReason = String(window.__cloudLastPullResult?.reason || '');
        if (downloaded || pullReason === 'ignored') {
            ok = true;
        } else if (pullReason === 'no-data') {
            ok = await window.subirBaseActualAlCloud({ silent: true, fromAuto: true });
            if (ok) {
                await window.descargarBaseDesdeCloud({ silent: true, reload: false });
            }
        }
    } else {
        ok = await window.subirBaseActualAlCloud({ silent: true, fromAuto: true });
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
    const waitMs = Math.max(0, (window.__cloudUiRefreshMinMs || 450) - (now - (window.__cloudUiLastRefreshAt || 0)));
    if (window.__cloudUiRefreshTimer) return;
    window.__cloudUiRefreshTimer = setTimeout(() => {
        window.__cloudUiRefreshTimer = null;
        window.__cloudUiLastRefreshAt = Date.now();
        requestAnimationFrame(() => {
            try {
                const active = document.querySelector('.content-section.active')?.id || '';
                const moduleSelectorVisible = (() => {
                    const el = document.getElementById('module-selector');
                    return !!(el && el.style.display !== 'none');
                })();

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
                        if (typeof refrescarPanelCuentasMesa === 'function') refrescarPanelCuentasMesa();
                        if (typeof actualizarEtiquetaMesaActiva === 'function') actualizarEtiquetaMesaActiva();
                        if (typeof refrescarBotonCerrarCuenta === 'function') refrescarBotonCerrarCuenta();
                        if (typeof actualizarEstadoBotonRegistrarSalida === 'function') actualizarEstadoBotonRegistrarSalida();
                        if (typeof actualizarContadoresMesasSalida === 'function') actualizarContadoresMesasSalida();
                        return;
                    }
                    if (pageId === 'comandas' && typeof renderComandas === 'function') return renderComandas();
                    if (pageId === 'home' && typeof renderHomeRegistroInfo === 'function') return renderHomeRegistroInfo();
                    if (pageId === 'agregar' && typeof verificarPlatoExistente === 'function') return verificarPlatoExistente();
                };

                if (moduleSelectorVisible && typeof renderModuleSelectorCards === 'function') {
                    renderModuleSelectorCards();
                }
                if (active) refrescarActivaLigero(active);
            } catch (e) {
                console.warn('No se pudo refrescar la UI tras sync cloud:', e);
            }
        });
    }, waitMs);
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
function setLoginLoadingOverlay(visible, title = "Validando acceso", message = "Estamos preparando tu panel de control...") {
    const overlay = document.getElementById('login-loading-overlay');
    if (!overlay) return;
    const titleEl = document.getElementById('login-loading-title');
    const messageEl = document.getElementById('login-loading-message');
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    overlay.style.display = visible ? 'flex' : 'none';
    overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function setEstadoBotonLogin(cargando) {
    const btn = document.getElementById('btn-login-acceder') || document.querySelector('#login-overlay button[onclick="intentarLogin()"]');
    if (!btn) return;
    if (!btn.dataset.baseText) btn.dataset.baseText = (btn.textContent || 'ACCEDER AL PANEL').trim();
    btn.disabled = !!cargando;
    btn.style.opacity = cargando ? '0.75' : '';
    btn.style.cursor = cargando ? 'wait' : '';
    btn.textContent = cargando ? 'VALIDANDO...' : btn.dataset.baseText;
    setLoginLoadingOverlay(!!cargando);
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
                    parentOwner: String(backendSession?.parentOwner || '').trim().toLowerCase(),
                    canCreateAdmins: backendSession?.canCreateAdmins === true,
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
            if (String(found?.role || '').toLowerCase() === 'admin' || String(found?.role || '').toLowerCase() === 'super-master') {
                found.parentOwner = normalizarOwnerPadreAdmin(found.parentOwner || found.delegadoPor);
                found.canCreateAdmins = puedeUsuarioCrearAdmins(found);
            }
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
                const puedeSembrarNube = !esColaboradorSesion && tieneRegistroInicialOwner(keyRegSesion) && typeof window.subirBaseActualAlCloud === 'function';
                const pSync = Promise.resolve(window.descargarBaseDesdeCloud({ silent: true, reload: false }))
                    .then((downloaded) => {
                        if (downloaded) return true;
                        const pullReason = String(window.__cloudLastPullResult?.reason || '');
                        if (!puedeSembrarNube || pullReason !== 'no-data') return false;
                        return Promise.resolve(window.subirBaseActualAlCloud({ silent: true, fromAuto: true }))
                            .then((uploaded) => uploaded ? window.descargarBaseDesdeCloud({ silent: true, reload: false }) : false);
                    });
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
                <div class="luro-action-buttons luro-action-buttons--tight">
                    <button class="btn btn-save" onclick="actStock(${i})">OK</button>
                    <button class="btn btn-warning" onclick="editarPlatoDesdeDispo(${i})">✏️ </button>
                    <button class="btn btn-danger" onclick="delPlato(${i})">X</button>
                </div>
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
    if (!contenedor) return;
    let ticketVacio = document.getElementById('ticket-vacio');
    const contador = document.getElementById('contador-items');
    const carritoVenta = obtenerCarritoMesaActiva();
    const clienteActual = obtenerClienteSalidaActual();
    const calculoPrecios = calcularDetallePreciosVenta(carritoVenta, clienteActual);
    const detalleMap = new Map(calculoPrecios.detalles.map(d => [d.key, d]));
    marcarInicioUsoMesaSiAplica(mesaActiva);
    contenedor.innerHTML = "";
    
    if (carritoVenta.length === 0) {
        if (!(ticketVacio instanceof Node)) {
            ticketVacio = document.createElement('p');
            ticketVacio.id = 'ticket-vacio';
            ticketVacio.style.color = 'gray';
            ticketVacio.style.textAlign = 'center';
            ticketVacio.style.marginTop = '100px';
            ticketVacio.textContent = '🛒 Carrito vacío';
        }
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
        seleccionarModulo('ADMINISTRADOR', { skipAdminPassword: true });
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
            <div class="prod-row-actions">
                <button class="btn btn-danger prod-remove-btn" onclick="this.closest('.ingrediente-row').remove()">X</button>
            </div>
            <div class="prod-restante">
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
            <td class="luro-action-cell">${modoBasico ? '<span style="color:#999;">Solo lectura</span>' : `<div class="luro-action-buttons luro-action-buttons--tight"><button class="btn btn-warning" onclick="cargarEdicionProduccion(${i})">✏️ </button><button class="btn btn-danger" onclick="eliminarProduccion(${i})">X</button></div>`}</td>
        </tr>`;
    }).join('');
}

const ROW_REMOVE_ANIMATION_MS = 230;

function buildRowKeyId(prefix, value) {
    const raw = String(value ?? '').trim().toLowerCase();
    return `${prefix}-tr-${encodeURIComponent(raw || 'item')}`;
}

function runWithRowRemovalAnimation(rowIds, onDone) {
    const ids = Array.isArray(rowIds) ? rowIds : [rowIds];
    const rows = [...new Set(ids.filter(Boolean))]
        .map((id) => document.getElementById(id))
        .filter(Boolean);

    if (!rows.length) {
        onDone();
        return;
    }

    if (rows.some((row) => row.dataset.rowRemoving === '1')) return;

    rows.forEach((row) => {
        row.dataset.rowRemoving = '1';
    });

    window.requestAnimationFrame(() => {
        rows.forEach((row) => row.classList.add('row-removing-left'));
    });

    window.setTimeout(() => {
        onDone();
    }, ROW_REMOVE_ANIMATION_MS);
}

    function eliminarProduccion(index) {
        if (bloquearAccionAdministrativaColaborador()) return;
        const pass = prompt("Ingrese su contraseña de 5 números para ELIMINAR:");
        if (pass === sesionUser.pass) {
            if (confirm("¿Eliminar este registro de producción?")) {
                runWithRowRemovalAnimation([`prod-tr-${index}`, `detalles-prod-row-${index}`], () => {
                    db.produccion_stock.splice(index, 1);
                    guardarDatos();
                    renderStockProduccion();
                });
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
                runWithRowRemovalAnimation([`prod-tr-${index}`, `detalles-prod-row-${index}`], () => {
                    db.produccion_stock.splice(index, 1);
                    guardarDatos();
                    renderStockProduccion();
                });
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
                div.innerHTML = `
                    <select class="prod-insumo-nom" onchange="actualizarVistaRestanteProduccionFila(this.parentElement)">${opts}</select>
                    <input type="number" class="prod-insumo-cant" value="${ing.cantidad}" oninput="actualizarVistaRestanteProduccionFila(this.parentElement)">
                    <select class="prod-insumo-unid" onchange="actualizarVistaRestanteProduccionFila(this.parentElement)">
                        <option value="g" ${ing.unidad==='g'?'selected':''}>g</option>
                        <option value="Oz" ${ing.unidad==='Oz'?'selected':''}>Oz</option>
                        <option value="Lb" ${ing.unidad==='Lb'?'selected':''}>Lb</option>
                        <option value="mL" ${ing.unidad==='mL'?'selected':''}>mL</option>
                        <option value="Unidad" ${ing.unidad==='Unidad'?'selected':''}>Unid</option>
                    </select>
                    <div class="prod-row-actions">
                        <button class="btn btn-danger prod-remove-btn" onclick="this.closest('.ingrediente-row').remove()">X</button>
                    </div>
                    <div class="prod-restante">Restante: --</div>
                `;
                contenedor.appendChild(div);
                actualizarVistaRestanteProduccionFila(div);
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

    function seleccionarModulo(mod, opts = {}) {
        if (!validarAccesoCuentaActual()) return;
        const moduloNombre = String(mod || '').trim();
        const moduloNormalizado = moduloNombre.toUpperCase();
        const esAdminModulo = (moduloNormalizado === 'ADMINISTRADOR');
        if (esColaboradorSesion && esAdminModulo) {
            alert("🚫 Los colaboradores no pueden entrar al módulo ADMINISTRADOR.");
            return;
        }
        if (esAdminModulo && opts.skipAdminPassword !== true) {
            const passAdmin = prompt("🔐 Ingrese la contraseña del administrador para abrir este módulo:");
            if (passAdmin === null) return;
            const accesoAutorizado = passAdmin === (sesionUser && sesionUser.pass ? sesionUser.pass : "") || passAdmin === MASTER_PASS || passAdmin === loginClave;
            if (!accesoAutorizado) {
                alert("❌ Contraseña incorrecta.");
                return;
            }
        }
        moduloVistaActual = mod;
        moduloActual = esAdminModulo ? 'COCINA' : mod;
        if (esAdminModulo) moduloAdminObjetivo = 'COCINA';
        document.getElementById('module-selector').style.display = 'none';
        document.getElementById('sidebar').style.display = 'block';
        document.getElementById('main-content').style.display = 'block';
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

    let githubDeployUiTimer = null;

    function setGithubDeployPanelText(id, text, color) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = String(text || '');
        if (color) el.style.color = color;
    }

    function describirObjetivoGithubDeploy(target) {
        const value = String(target || '').trim().toLowerCase();
        if (value === 'functions') return 'functions';
        if (value === 'all') return 'hosting + functions';
        return 'hosting';
    }

    function formatearFechaGithubDeploy(value) {
        const raw = String(value || '').trim();
        if (!raw) return '---';
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return raw;
        return date.toLocaleString();
    }

    function renderGithubDeployPanel(payload = null) {
        const connectionEl = document.getElementById('github-deploy-connection');
        const statusEl = document.getElementById('github-deploy-status');
        const lastRunEl = document.getElementById('github-deploy-last-run');
        if (!connectionEl || !statusEl || !lastRunEl) return;

        if (!payload) {
            connectionEl.textContent = 'Comprobando conexión con GitHub Actions...';
            connectionEl.style.color = '#666';
            statusEl.textContent = 'Sin solicitudes remotas.';
            statusEl.style.color = '#666';
            lastRunEl.textContent = 'Sin ejecuciones detectadas todavía.';
            lastRunEl.style.color = '#57606f';
            return;
        }

        if (payload.configured === false) {
            connectionEl.textContent = `Repositorio: ${payload.repo || 'No configurado'} · Workflow: ${payload.workflow || 'deploy.yml'} · Firebase: ${payload.firebaseProject || 'luro-control'}`;
            connectionEl.style.color = '#8c6111';
            statusEl.textContent = payload.message || 'Falta configurar el secreto GITHUB_DEPLOY_TOKEN en Firebase.';
            statusEl.style.color = '#8c6111';
            lastRunEl.textContent = 'El puente está listo en código, pero todavía no puede disparar acciones hasta que se cargue el token de GitHub en Firebase.';
            lastRunEl.style.color = '#57606f';
            return;
        }

        connectionEl.textContent = `Repositorio: ${payload.repo || '---'} · Workflow: ${payload.workflow || 'deploy.yml'} · Ref base: ${payload.defaultRef || 'main'} · Firebase: ${payload.firebaseProject || 'luro-control'}`;
        connectionEl.style.color = '#1f6f9e';

        const latest = payload.latestRun || null;
        if (!latest) {
            statusEl.textContent = 'Conexión lista. Todavía no hay ejecuciones detectadas en GitHub Actions.';
            statusEl.style.color = '#1f8f4c';
            lastRunEl.textContent = 'Cuando dispares un deploy desde aquí, el último run aparecerá en este panel.';
            lastRunEl.style.color = '#57606f';
            return;
        }

        const estado = latest.conclusion ? `${latest.status || 'completed'} · ${latest.conclusion}` : (latest.status || 'queued');
        const estadoColor = latest.conclusion === 'success'
            ? '#1f8f4c'
            : (latest.conclusion === 'failure' || latest.conclusion === 'cancelled' ? '#c0392b' : '#1f6f9e');
        statusEl.textContent = `Último deploy: ${latest.displayTitle || latest.workflowName || 'GitHub Actions'} · ${estado}`;
        statusEl.style.color = estadoColor;
        lastRunEl.textContent = `Run #${Number(latest.runNumber || 0)} · Evento: ${latest.event || '---'} · Rama: ${latest.headBranch || '---'} · Actor: ${latest.actor || '---'} · Creado: ${formatearFechaGithubDeploy(latest.createdAt)}${latest.htmlUrl ? ` · ${latest.htmlUrl}` : ''}`;
        lastRunEl.style.color = '#57606f';
    }

    window.cargarEstadoDeployGithubUI = async function(opts = {}) {
        const silent = opts?.silent === true;
        const connectionEl = document.getElementById('github-deploy-connection');
        if (!connectionEl) return null;
        if (!silent) {
            setGithubDeployPanelText('github-deploy-connection', 'Consultando estado del puente Firebase → GitHub...', '#1f6f9e');
            setGithubDeployPanelText('github-deploy-status', 'Consultando ejecuciones...', '#666');
        }
        if (typeof window.obtenerEstadoDeployGithubCloud !== 'function') {
            renderGithubDeployPanel({
                configured: false,
                repo: 'GitHub no disponible',
                workflow: 'deploy.yml',
                firebaseProject: 'luro-control',
                message: 'El backend para GitHub Deploy no está disponible todavía.'
            });
            return null;
        }
        try {
            const payload = await window.obtenerEstadoDeployGithubCloud({});
            renderGithubDeployPanel(payload || null);
            return payload || null;
        } catch (e) {
            renderGithubDeployPanel({
                configured: false,
                repo: 'Error de conexión',
                workflow: 'deploy.yml',
                firebaseProject: 'luro-control',
                message: String(e?.message || e || 'No se pudo consultar el estado del deploy remoto.')
            });
            return null;
        }
    };

    window.solicitarDeployGithub = async function(target = 'hosting') {
        const deployTarget = String(target || 'hosting').trim().toLowerCase();
        if (!['hosting', 'functions', 'all'].includes(deployTarget)) {
            return alert('Objetivo de deploy no válido.');
        }
        const descripcion = describirObjetivoGithubDeploy(deployTarget);
        if (!confirm(`¿Desea ejecutar un deploy remoto de ${descripcion} en GitHub Actions?`)) return false;
        if (typeof window.dispararDeployGithubCloud !== 'function') {
            return alert('El backend de GitHub Deploy no está disponible.');
        }
        try {
            setGithubDeployPanelText('github-deploy-status', `Lanzando deploy remoto de ${descripcion}...`, '#1f6f9e');
            const result = await window.dispararDeployGithubCloud({ target: deployTarget });
            const requestId = String(result?.requestId || '').trim();
            const ref = String(result?.ref || 'main').trim();
            setGithubDeployPanelText('github-deploy-status', `Solicitud enviada a GitHub Actions para ${descripcion}.`, '#1f8f4c');
            setGithubDeployPanelText('github-deploy-last-run', `Solicitud ${requestId || 'sin id'} · Ref ${ref} · GitHub tomará el deploy en cola y este panel se actualizará automáticamente.`, '#57606f');
            if (githubDeployUiTimer) clearTimeout(githubDeployUiTimer);
            githubDeployUiTimer = setTimeout(() => {
                githubDeployUiTimer = null;
                window.cargarEstadoDeployGithubUI({ silent: true });
            }, 4500);
            return true;
        } catch (e) {
            setGithubDeployPanelText('github-deploy-status', `No se pudo lanzar el deploy remoto: ${String(e?.message || e || 'Error interno')}`, '#c0392b');
            return false;
        }
    };

    let configRenderHeavyTimer = null;
    function renderConfig(opts = {}) {
        const { deferHeavy = true } = opts;
        const adminBox = document.getElementById('section-admin-master');
        const colabBox = document.getElementById('section-user-colaboradores');
        const cloudBox = document.getElementById('section-cloud-masters');
        const vaultBox = document.getElementById('section-servidor-master');
        const esMasterGlobal = !!(sesionUser && (sesionUser.user || '').trim().toLowerCase() === MASTER_USER);
        const puedeCrearAdmins = puedeSesionCrearUsuariosAdministradores();
        if (adminBox) adminBox.style.display = puedeCrearAdmins ? 'block' : 'none';
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
            if (esMasterGlobal && typeof window.cargarEstadoDeployGithubUI === 'function') {
                window.cargarEstadoDeployGithubUI({ silent: true });
            }
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
        if(pageId === 'comandos' && typeof window.renderModuloComandos === 'function') window.renderModuloComandos();
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

function eliminarDistribuidor(id) {
    if (bloquearAccionAdministrativaColaborador()) return;
    if (!validarPermiso()) return;
    const distId = String(id || '').trim();
    if (!distId) return alert('Seleccione un distribuidor para eliminar.');
    const dist = db.distribuidores.find(d => d.id === distId && d.owner === sesionUser.user && d.modulo === moduloActual);
    if (!dist) return;
    if (!confirm('¿Eliminar distribuidor y su catálogo asociado?')) return;
    db.distribuidores = db.distribuidores.filter(d => d.id !== distId);
    db.catalogoDistribuidores = db.catalogoDistribuidores.filter(c => c.distId !== distId);
    db.almacen.forEach(a => {
        if (a.owner === sesionUser.user && a.modulo === moduloActual && a.distribuidor === dist.nombre) a.distribuidor = '';
    });
    const idEdit = document.getElementById('dist_edit_id')?.value || '';
    runWithRowRemovalAnimation(buildRowKeyId('dist', distId), () => {
        guardarDatos();
        if (idEdit === distId) limpiarFormularioDistribuidor();
        renderModuloDistribuidores();
    });
}

function eliminarDistribuidorSeleccionado() {
    const idEdit = document.getElementById('dist_edit_id')?.value || '';
    if (!idEdit) return alert('Seleccione un distribuidor para eliminar.');
    eliminarDistribuidor(idEdit);
}

function renderTablaDistribuidores() {
    const tbody = document.getElementById('tabla-distribuidores');
    if (!tbody) return;
    const rows = obtenerDistribuidoresActuales()
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(d => {
            const productosDist = obtenerCatalogoDistribuidoresActual().filter(c => c.distId === d.id);
            const cantProductos = productosDist.length;
            const distRowId = buildRowKeyId('dist', d.id);

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
            <tr id="${distRowId}">
                <td><span style="${estiloDistrib}">${d.nombre}</span></td>
                <td>${d.activo ? '<span style="color:var(--success);font-weight:bold;">Activo</span>' : '<span style="color:var(--danger);font-weight:bold;">Inactivo</span>'}</td>
                <td>${d.contacto || '-'}</td>
                <td>${d.telefono || '-'}</td>
                <td>${d.email || '-'}</td>
                <td><span style="color:${colorAlerta}; font-weight:${(productosCero.length > 0 || productosEnUso.length > 0) ? '900' : '700'}; ${(productosCero.length > 0 || productosEnUso.length > 0) ? 'animation: parpadeoRojo 1s infinite;' : ''}">${alertaTexto}</span></td>
                <td><button class="btn btn-blue dist-productos-btn" onclick="verProductosDistribuidor('${d.id}')">${cantProductos} producto(s)</button></td>
                <td class="luro-action-cell">
                    <div class="luro-action-buttons luro-action-buttons--tight">
                        <button type="button" class="btn btn-warning" onclick="editarDistribuidor('${d.id}')" title="Editar distribuidor" aria-label="Editar distribuidor">✏️</button>
                        <button type="button" class="btn btn-danger" onclick="eliminarDistribuidor('${d.id}')" title="Eliminar distribuidor" aria-label="Eliminar distribuidor">🗑️</button>
                    </div>
                </td>
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

function escaparHtmlBusquedaSalida(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizarCantidadBusquedaPlato(inputOrId) {
    const input = typeof inputOrId === 'string'
        ? document.getElementById(inputOrId)
        : inputOrId;
    if (!(input instanceof HTMLInputElement)) return 1;
    let valor = parseInt(input.value, 10);
    if (!Number.isFinite(valor) || valor < 1) valor = 1;
    input.value = String(valor);
    return valor;
}

function obtenerCantidadBusquedaPlato(inputOrId) {
    return normalizarCantidadBusquedaPlato(inputOrId);
}

function ajustarCantidadBusquedaPlato(inputOrId, delta) {
    const input = typeof inputOrId === 'string'
        ? document.getElementById(inputOrId)
        : inputOrId;
    if (!(input instanceof HTMLInputElement)) return;
    const actual = normalizarCantidadBusquedaPlato(input);
    const siguiente = Math.max(1, actual + Number(delta || 0));
    input.value = String(siguiente);
}

function agregarCantidadBusquedaPlato(index, inputId) {
    const cantidad = obtenerCantidadBusquedaPlato(inputId);
    transferirAFactura(index, cantidad, inputId);
    const input = document.getElementById(String(inputId));
    if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
    }
}

function manejarTeclaCantidadBusquedaPlato(event, index, inputId) {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();
    agregarCantidadBusquedaPlato(index, inputId);
}

function buscarPlatoVenta() { 
    const input = document.getElementById('busqueda-plato');
    const resultados = document.getElementById('contenedor-salidas-busqueda');
    if (!input || !resultados) return;

    const termino = String(input.value || '').trim().toLowerCase();
    resultados.innerHTML = '';
    if (!termino) return;

    const coincidencias = [];
    db.platos.forEach((plato, index) => {
        const nombrePlato = String(plato?.nombre || '').toLowerCase();
        if (
            plato &&
            plato.owner === sesionUser.user &&
            plato.modulo === moduloActual &&
            nombrePlato.includes(termino)
        ) {
            coincidencias.push({ plato, index });
        }
    });

    if (!coincidencias.length) {
        resultados.innerHTML = '<div class="salida-product-empty">No se encontraron platos con ese nombre.</div>';
        return;
    }

    resultados.innerHTML = coincidencias.map(({ plato, index }) => {
        const nombreSeguro = escaparHtmlBusquedaSalida(plato.nombre || '');
        const precio = Number(plato.precio || 0);
        const stock = Number(plato.stock || 0);
        const stockTexto = Number.isFinite(stock)
            ? stock.toFixed(2).replace(/\.00$/, '')
            : '0';
        const inputId = `salida-busqueda-cantidad-${index}`;
        return `
            <div class="salida-product-card">
                <div class="salida-product-copy">
                    <strong class="salida-product-name">${nombreSeguro}</strong>
                    <span class="salida-product-meta">RD$${precio.toFixed(2)} · Existencia: <strong>${stockTexto}</strong></span>
                </div>
                <div class="salida-product-actions">
                    <div class="salida-qty-selector">
                        <button type="button" class="salida-qty-btn" onclick="ajustarCantidadBusquedaPlato('${inputId}', -1)" aria-label="Disminuir cantidad de ${nombreSeguro}">−</button>
                        <input type="number" id="${inputId}" class="salida-qty-input" value="1" min="1" step="1" oninput="normalizarCantidadBusquedaPlato(this)" onkeydown="manejarTeclaCantidadBusquedaPlato(event, ${index}, '${inputId}')" aria-label="Cantidad de ${nombreSeguro}">
                        <button type="button" class="salida-qty-btn" onclick="ajustarCantidadBusquedaPlato('${inputId}', 1)" aria-label="Aumentar cantidad de ${nombreSeguro}">+</button>
                    </div>
                    <button class="btn btn-save salida-product-add-btn" onclick="agregarCantidadBusquedaPlato(${index}, '${inputId}')">AÑADIR</button>
                </div>
            </div>
        `;
    }).join('');
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

function abrirModalPlatoDirecto() {
    if (bloquearAccionAdministrativaColaborador()) return;
    if (!ownerDatosActivo()) return alert("No se pudo identificar el usuario maestro activo.");
    const modal = document.getElementById('modal-plato-directo');
    const nombreInput = document.getElementById('plato-directo-nombre');
    const precioInput = document.getElementById('plato-directo-precio');
    if (!modal || !nombreInput || !precioInput) return;
    nombreInput.value = "";
    precioInput.value = "";
    const guardarSiEnter = (ev) => {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        guardarPlatoDirecto();
    };
    nombreInput.onkeydown = guardarSiEnter;
    precioInput.onkeydown = guardarSiEnter;
    modal.style.display = 'flex';
    setTimeout(() => nombreInput.focus(), 40);
}

function cerrarModalPlatoDirecto() {
    const modal = document.getElementById('modal-plato-directo');
    const nombreInput = document.getElementById('plato-directo-nombre');
    const precioInput = document.getElementById('plato-directo-precio');
    if (modal) modal.style.display = 'none';
    if (nombreInput) nombreInput.value = "";
    if (precioInput) precioInput.value = "";
}

function guardarPlatoDirecto() {
    if (!tryBeginUiActionLock('guardar-plato-directo')) return;
    try {
        if (bloquearAccionAdministrativaColaborador()) return;
        const ownerActivo = ownerDatosActivo();
        const moduloDestino = String(moduloActual || '').trim();
        const nombreInput = document.getElementById('plato-directo-nombre');
        const precioInput = document.getElementById('plato-directo-precio');
        const nombre = String(nombreInput?.value || '').trim();
        const precio = parseFloat(precioInput?.value);

        if (!ownerActivo) return alert("No se pudo identificar el usuario maestro activo.");
        if (!moduloDestino) return alert("No se pudo identificar el módulo activo.");
        if (!nombre || !Number.isFinite(precio) || precio < 0) {
            return alert("Ingrese un nombre y un precio válidos.");
        }

        const index = db.platos.findIndex((p) =>
            String(p?.nombre || '').trim().toLowerCase() === nombre.toLowerCase() &&
            String(p?.owner || '').trim().toLowerCase() === ownerActivo &&
            p?.modulo === moduloDestino
        );

        if (index !== -1) {
            const platoActual = db.platos[index] || {};
            db.platos[index] = {
                ...platoActual,
                nombre,
                precio,
                receta: Array.isArray(platoActual.receta) ? platoActual.receta : [],
                stock: Number(platoActual.stock || 0),
                costo: Number(platoActual.costo || 0),
                costoBase: Number(platoActual.costoBase || platoActual.costo || 0),
                costoConImpuestos: Number(platoActual.costoConImpuestos || platoActual.costo || 0),
                impuestoAplicado: Number(platoActual.impuestoAplicado || 0),
                owner: ownerActivo,
                modulo: moduloDestino
            };
            alert("✅ El plato ya existía. Se actualizó el precio correctamente.");
        } else {
            db.platos.push({
                nombre,
                precio,
                costo: 0,
                costoBase: 0,
                costoConImpuestos: 0,
                impuestoAplicado: 0,
                receta: [],
                stock: 0,
                owner: ownerActivo,
                modulo: moduloDestino
            });
            alert("✅ Plato añadido directamente al menú.");
        }

        guardarDatos();
        cerrarModalPlatoDirecto();
        if (typeof renderDispoTable === 'function') renderDispoTable();
        if (typeof buscarPlatoVenta === 'function' && String(document.getElementById('busqueda-plato')?.value || '').trim()) {
            buscarPlatoVenta();
        }
    } finally {
        endUiActionLock('guardar-plato-directo');
    }
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
    let totalCostoFaltante = 0;

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
        totalCostoFaltante += costoPorFaltante;

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
            <tr id="${buildRowKeyId('almacen', it.nombre)}" style="${estiloFila}">
                <td><strong class="${claseAlerta}">${it.nombre.toUpperCase()}</strong> <small>(${it.ideal})</small></td>
                <td style="font-weight:bold;">${it.actual.toFixed(2)} ${it.unidad}</td>
                <td>RD$${it.costoUnitario.toFixed(2)}</td>
                <td>${statusLabel}</td>
                <td style="color: #2ecc71; font-weight: bold;">RD$${costoPorFaltante.toFixed(2)}</td>
                <td class="luro-action-cell">${modoBasico ? '<span style="color:#999;">Solo lectura</span>' : `<div class="luro-action-buttons luro-action-buttons--tight"><button class="btn btn-warning" onclick="prepararEdicionAlmacen('${it.nombre}')">✏️ </button><button class="btn btn-danger" onclick="eliminarAlmacen('${it.nombre}')">X</button></div>`}</td>
            </tr>`; 
    }).join('');

    const totalFaltanteEl = document.getElementById('inventory-faltante-total-value');
    if (totalFaltanteEl) {
        totalFaltanteEl.textContent = `RD$${Number(totalCostoFaltante || 0).toFixed(2)}`;
    }

    actualizarSelectDistribuidores();
}

// 5. ELIMINAR CON SEGURIDAD
function eliminarAlmacen(nom) { 
    if (bloquearAccionAdministrativaColaborador()) return;
    const pass = prompt("Ingrese contraseña de 5 números para ELIMINAR:");
    if(pass === sesionUser.pass) { 
        if(confirm(`¿Eliminar ${nom.toUpperCase()}?`)){ 
            runWithRowRemovalAnimation(buildRowKeyId('almacen', nom), () => {
                db.almacen = db.almacen.filter(a => !(a.nombre === nom && a.owner === sesionUser.user && a.modulo === moduloActual)); 
                guardarDatos(); 
                renderAlmacen(); 
            });
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
      if (!lista) return;
      if(tipo === 'plato') { 
        const platos = db.platos.filter(p => p.owner === sesionUser.user && p.modulo === moduloActual && p.nombre.toLowerCase().includes(bus));
        lista.innerHTML = platos.map(p => `
          <div class="card decomiso-item-card">
            <div class="decomiso-item-main">
              <strong>${p.nombre}</strong>
            </div>
            <div class="decomiso-item-actions">
              <button class="btn btn-danger decomiso-action-btn" onclick="ejecutarDecomisoPlato('${p.nombre}')">DECOMISAR</button>
            </div>
          </div>`).join('');
      } else { 
        const items = db.almacen.filter(a => a.owner === sesionUser.user && a.modulo === moduloActual && a.nombre.toLowerCase().includes(bus));
        lista.innerHTML = items.map(a => `
          <div class="card decomiso-item-card decomiso-item-card--almacen">
            <div class="decomiso-item-main">
              <div class="decomiso-item-head">
                <strong>${a.nombre.toUpperCase()}</strong>
                <span class="decomiso-item-meta">(${a.actual.toFixed(2)} ${a.unidad})</span>
              </div>
            </div>
            <div class="decomiso-item-actions decomiso-item-actions--almacen">
              <input type="number" class="decomiso-cantidad" id="dec-cant-${a.nombre}" placeholder="Cantidad">
              <select id="dec-unid-${a.nombre}" class="decomiso-unidad">
                <option value="${a.unidad}">${a.unidad}</option>
                <option value="Lb">Lb</option><option value="Oz">Oz</option><option value="g">g</option><option value="mL">mL</option><option value="Litros">Litros</option><option value="Unidad">Unid</option>
              </select>
              <button class="btn btn-danger decomiso-action-btn" onclick="ejecutarDecomisoAlmacen('${a.nombre}')">BAJA</button>
            </div>
          </div>`).join('');
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
                <td class="luro-action-cell"><div class="luro-action-buttons luro-action-buttons--tight"><button class="btn btn-save" onclick="actStock(${i})">OK</button><button class="btn btn-warning" onclick="editarPlatoDesdeDispo(${i})">✏️ </button><button class="btn btn-danger" onclick="delPlato(${i})">X</button></div></td>
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
            runWithRowRemovalAnimation([`plato-tr-${i}`, `detalles-plato-row-${i}`], () => {
                db.platos.splice(i, 1);
                guardarDatos();
                renderDispoTable();
            });
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
        usuarios: [{ user: MASTER_USER, pass: MASTER_PASS, role: "super-master", owner: MASTER_USER, activo: true, colab: [], parentOwner: '', canCreateAdmins: true }],
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
const t0=window.transferirAFactura;window.transferirAFactura=function(){const c=mesaCanonica(mesaActiva);if(isD(c)&&!db.deliveryMeta[c]){const n=prompt('Delivery - Nombre');if(!n)return;const t=prompt('Delivery - Teléfono');if(!t)return;const d=prompt('Delivery - Dirección');if(!d)return;const r=prompt('Delivery - Referencia')||'';const h=prompt('Delivery - No. Casa')||'';db.deliveryMeta[c]={nombre:n,telefono:t,direccion:d,referencia:r,casa:h,facturada:false,entregada:false};}if(typeof t0==='function')t0.apply(this,arguments);upCom(c);};
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
  let asignarPlatoCantidadPendiente = 1;
  let asignarPlatoInputPendiente = '';

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

  window.abrirModalAsignarPlatoPersona = function(indexPlato, cantidadSolicitada, inputCantidadId){
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
    asignarPlatoCantidadPendiente = Math.max(1, parseInt(cantidadSolicitada, 10) || 1);
    asignarPlatoInputPendiente = String(inputCantidadId || '');
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
    asignarPlatoCantidadPendiente = 1;
    asignarPlatoInputPendiente = '';
  };

  window.confirmarAsignarPlatoPersona = function(personaId){
    const mesa = canonMesaActual();
    const cfg = getCuentaMesa(mesa);
    const personas = Array.isArray(cfg?.personas) ? cfg.personas : [];
    const p = personas.find(x => String(x.id) === String(personaId));
    if (!p) return;
    const idx = asignarPlatoIndexPendiente;
    const cantidadPendiente = Math.max(1, parseInt(asignarPlatoCantidadPendiente, 10) || 1);
    const inputPendiente = String(asignarPlatoInputPendiente || '');
    cerrarModalAsignarPlatoPersona();
    if (idx === null || idx === undefined) return;
    window.__mesaPersonaSeleccionadaId = p.id || '';
    window.__mesaPersonaSeleccionadaNombre = p.nombre || '';
    if (typeof prevTransferir === 'function') prevTransferir(idx, cantidadPendiente, inputPendiente);
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
  window.transferirAFactura = function(index, cantidadSolicitada, inputCantidadId){
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
      abrirModalAsignarPlatoPersona(index, cantidadSolicitada, inputCantidadId);
      return;
    }
    if (typeof prevTransferir === 'function') prevTransferir(index, cantidadSolicitada, inputCantidadId);
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
  function puedeUsarSidebarToggle() {
    const { login, selector, main, sidebar } = refsNav();
    return !!sidebar && !esVisible(login) && !esVisible(selector) && esVisible(main);
  }
  let __lastMobileMenuOpenAt = 0;

  window.cerrarSidebarMovil = function(source = '') {
    if (source === 'backdrop' && (Date.now() - __lastMobileMenuOpenAt) < 250) return;
    const { sidebar, backdrop, toggle } = refsNav();
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.style.display = 'none';
    if (toggle) {
      toggle.textContent = '☰';
      toggle.setAttribute('aria-label', 'Abrir menú');
      toggle.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.remove('mobile-nav-open');
  };

  window.abrirSidebarMovil = function() {
    const { sidebar, backdrop, toggle } = refsNav();
    if (!puedeUsarSidebarToggle()) return;
    __lastMobileMenuOpenAt = Date.now();
    sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.style.display = 'block';
    if (toggle) {
      toggle.textContent = 'X';
      toggle.setAttribute('aria-label', 'Cerrar menú');
      toggle.setAttribute('aria-expanded', 'true');
    }
    document.body.classList.add('mobile-nav-open');
  };

  window.toggleSidebarMovil = function(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    const { sidebar } = refsNav();
    if (!sidebar || !puedeUsarSidebarToggle()) return;
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
    const tables = document.querySelectorAll('table');
    tables.forEach((table) => {
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
    const { toggle } = refsNav();
    const visible = puedeUsarSidebarToggle();
    if (toggle) toggle.style.display = visible ? 'block' : 'none';
    document.body.classList.toggle('mobile-app', esMovil());
    document.body.classList.toggle('mobile-web-like', esMovil());
    adaptarTablasMovil();
    actualizarTopbarMovil();
    if (!visible) cerrarSidebarMovil();
  }

  function activarImpuestosAgregarPlato() {
    const section = document.getElementById('agregar');
    if (!section || !section.classList.contains('active')) return;
    section.querySelectorAll('.tax-check').forEach((checkbox) => {
      checkbox.checked = true;
    });
    if (typeof window.recalcularCostoReceta === 'function') {
      window.recalcularCostoReceta();
    }
  }

  const showPageOriginal = window.showPage;
  if (typeof showPageOriginal === 'function') {
    window.showPage = function(pageId, opts = {}) {
      showPageOriginal.apply(this, arguments);
      if (pageId === 'agregar') {
        setTimeout(activarImpuestosAgregarPlato, 0);
      }
      if (opts?.keepMenuOpen !== true) cerrarSidebarMovil();
      adaptarTablasMovil();
      actualizarTopbarMovil();
      syncNav();
    };
  }

  document.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    const link = target.closest('#sidebar a');
    if (!link) return;
    const esCarpeta = link.classList.contains('menu-folder');
    if (esCarpeta) return;
    cerrarSidebarMovil();
    setTimeout(syncNav, 0);
  });

  ['regresarAModulos', 'cambiarUsuario', 'cerrarSesion'].forEach((fnName) => {
    const original = window[fnName];
    if (typeof original !== 'function') return;
    window[fnName] = function(...args) {
      const result = original.apply(this, args);
      cerrarSidebarMovil();
      syncNav();
      return result;
    };
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
  const SALIDA_TARJETAS_VISIBLES = 10;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function obtenerEspaciosCobroSalida() {
    const list = [];
    for (let i = 1; i <= 20; i++) list.push(`Mesa ${i}`);
    for (let i = 1; i <= 20; i++) list.push(`Delivery ${i}`);
    return list;
  }

  function esMesaDeliverySalida(mesa) {
    return /^Delivery\s+\d+$/i.test(String(mesa || ''));
  }

  function tieneMesaCobroSeleccionada() {
    return !!String(window.__salidaMesaSeleccionada || '').trim();
  }

  function obtenerMesaSeleccionadaSalida() {
    return String(window.__salidaMesaSeleccionada || '').trim();
  }

  function sincronizarVistaCobroSalida() {
    const salidaSection = document.getElementById('salida');
    const salidaVisible = !!(salidaSection && getComputedStyle(salidaSection).display !== 'none');
    const salidaActiva = !!(salidaSection && (salidaSection.classList.contains('active') || salidaVisible));
    const detailOverlay = document.getElementById('salida-facturacion-overlay');
    const detailCard = document.getElementById('salida-facturacion-card');
    const searchInput = document.getElementById('busqueda-plato');
    const results = document.getElementById('contenedor-salidas-busqueda');
    const productsShell = document.getElementById('salida-productos-shell');
    const hint = document.getElementById('salida-productos-hint');
    const hasSelection = tieneMesaCobroSeleccionada();
    if (!hasSelection) window.__salidaFacturacionMinimizada = false;
    const isMinimized = window.__salidaFacturacionMinimizada === true;
    const shouldOpen = hasSelection && salidaActiva;

    if (detailOverlay) {
      detailOverlay.classList.toggle('is-open', shouldOpen);
      detailOverlay.classList.toggle('is-minimized', shouldOpen && isMinimized);
      detailOverlay.classList.toggle('salida-card-hidden', !shouldOpen);
      detailOverlay.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    }

    if (detailCard) {
      detailCard.classList.toggle('salida-card-hidden', !shouldOpen || isMinimized);
      detailCard.setAttribute('aria-hidden', shouldOpen && !isMinimized ? 'false' : 'true');
    }

    if (productsShell) productsShell.classList.toggle('is-disabled', !hasSelection);
    if (hint) hint.classList.toggle('is-hidden', hasSelection);

    if (searchInput) {
      searchInput.disabled = !hasSelection;
      searchInput.placeholder = hasSelection
        ? 'Escriba nombre del plato...'
        : 'Seleccione una tarjeta para comenzar a cobrar';
      if (!hasSelection) searchInput.value = '';
    }

    if (!hasSelection && results) results.innerHTML = '';
  }

  window.toggleSalidaFacturacionMinimize = function(forceState) {
    if (!tieneMesaCobroSeleccionada()) return;
    if (typeof forceState === 'boolean') {
      window.__salidaFacturacionMinimizada = forceState;
    } else {
      window.__salidaFacturacionMinimizada = !window.__salidaFacturacionMinimizada;
    }
    sincronizarVistaCobroSalida();
  };

  window.cerrarMesaCobroActiva = function() {
    window.__salidaFacturacionMinimizada = false;
    window.__salidaMesaSeleccionada = '';
    sincronizarVistaCobroSalida();
    refrescarTarjetasSalida();
  };

  function actualizarEtiquetaMesasSalida() {
    const lbl = document.getElementById('mesas-total-label');
    if (!lbl) return;
    lbl.textContent = `Espacios de cobro (${obtenerEspaciosCobroSalida().length})`;
  }

  function actualizarBotonMostrarMasSalida() {
    const btn = document.getElementById('mesas-mostrar-mas-btn');
    if (!btn) return;
    const total = obtenerEspaciosCobroSalida().length;
    const remaining = Math.max(0, total - SALIDA_TARJETAS_VISIBLES);
    if (remaining === 0) {
      btn.style.display = 'none';
      btn.textContent = 'Mostrar más';
      return;
    }
    btn.style.display = '';
    btn.textContent = window.__salidaTarjetasExpandidas === true
      ? 'Mostrar menos'
      : `Mostrar más (${remaining})`;
  }

  function construirMetaTarjetaMesa(mesa) {
    const canon = typeof mesaCanonica === 'function' ? mesaCanonica(mesa) : mesa;
    if (!carritoPorMesa[canon]) carritoPorMesa[canon] = [];
    if (typeof inicializarMetaMesa === 'function') {
      inicializarMetaMesa(mesa);
      inicializarMetaMesa(canon);
    }

    const nombre = typeof obtenerNombreMesa === 'function' ? obtenerNombreMesa(mesa) : mesa;
    const consumo = (carritoPorMesa[canon] || []).reduce((acc, item) => acc + Number(item?.cantidad || 0), 0);
    const cuentaMesa = db?.mesaCuentas?.[canon];
    const clientesMesa = Array.isArray(cuentaMesa?.personas) ? cuentaMesa.personas.length : 0;
    const delivery = db?.deliveryMeta?.[canon] || null;
    const reservada = !!(mesaMeta?.[mesa]?.reservaNombre || mesaMeta?.[canon]?.reservaNombre);
    const reservaNombre = String(mesaMeta?.[mesa]?.reservaNombre || mesaMeta?.[canon]?.reservaNombre || '').trim();
    const esDelivery = esMesaDeliverySalida(mesa);
    const facturada = !!delivery?.facturada;
    const entregada = !!delivery?.entregada;

    let tone = 'idle';
    let badge = 'Disponible';
    if (esDelivery && facturada) {
      tone = 'facturada';
      badge = 'Facturada';
    } else if (esDelivery && entregada) {
      tone = 'idle';
      badge = 'Entregada';
    } else if (consumo > 0) {
      tone = esDelivery ? 'delivery' : 'busy';
      badge = esDelivery ? 'Delivery activo' : 'En cobro';
    } else if (reservada) {
      tone = 'reserved';
      badge = 'Reservada';
    }

    let meta = consumo > 0
      ? `${consumo} producto(s) en la cuenta`
      : 'Sin productos agregados';
    if (!esDelivery && clientesMesa > 0) {
      meta += ` · ${clientesMesa} cliente(s)`;
    }

    let foot = consumo > 0
      ? `Tiempo en uso: ${typeof formatearTiempoMesa === 'function' ? formatearTiempoMesa(canon) : '00:00'}`
      : 'Toca para abrir el cobro';
    if (reservada && reservaNombre && consumo === 0) {
      foot = `Reserva: ${reservaNombre}`;
    }
    if (esDelivery && delivery?.nombre && consumo === 0) {
      foot = `Cliente: ${delivery.nombre}`;
    }
    if (esDelivery && facturada) {
      foot = 'Pendiente de entrega';
    }

    return {
      nombre,
      badge,
      meta,
      foot,
      tone,
      type: esDelivery ? 'Delivery' : 'Mesa',
      icon: esDelivery ? '🚚' : '🍽️'
    };
  }

  function renderizarTarjetaMesaSalida(btn, activa) {
    if (!(btn instanceof HTMLElement)) return;
    const mesa = btn.dataset.mesa || '';
    const meta = construirMetaTarjetaMesa(mesa);
    btn.classList.add('salida-mesa-card');
    btn.dataset.tone = meta.tone;
    btn.classList.toggle('is-active', !!activa);
    btn.innerHTML = `
      <span class="salida-mesa-card__top">
        <span class="salida-mesa-card__type">${escapeHtml(meta.icon)} ${escapeHtml(meta.type)}</span>
        <span class="salida-mesa-card__badge">${escapeHtml(meta.badge)}</span>
      </span>
      <strong class="salida-mesa-card__title">${escapeHtml(meta.nombre)}</strong>
      <span class="salida-mesa-card__meta">${escapeHtml(meta.meta)}</span>
      <span class="salida-mesa-card__foot">${escapeHtml(meta.foot)}</span>
    `;
  }

  function refrescarTarjetasSalida() {
    const seleccionada = obtenerMesaSeleccionadaSalida();
    document.querySelectorAll('#mesas-grid .btn-mesa-salida').forEach((btn) => {
      renderizarTarjetaMesaSalida(btn, btn.dataset.mesa === seleccionada);
    });
    actualizarEtiquetaMesasSalida();
    actualizarBotonMostrarMasSalida();
  }

  window.mostrarMasTarjetasSalida = function() {
    if (obtenerEspaciosCobroSalida().length <= SALIDA_TARJETAS_VISIBLES) return;
    window.__salidaTarjetasExpandidas = window.__salidaTarjetasExpandidas !== true;
    if (typeof window.renderMesasSalida === 'function') window.renderMesasSalida();
  };

  window.abrirMesaCobroDesdeTarjeta = function(mesa) {
    const mesaObjetivo = String(mesa || '').trim();
    if (!mesaObjetivo) return;

    window.__salidaMesaSeleccionada = mesaObjetivo;
    window.__salidaFacturacionMinimizada = false;

    try {
      if (typeof window.seleccionarMesaSalida === 'function') {
        window.seleccionarMesaSalida(mesaObjetivo);
      } else {
        mesaActiva = mesaObjetivo;
        if (typeof actualizarEtiquetaMesaActiva === 'function') actualizarEtiquetaMesaActiva();
        if (typeof actualizarPanelCobro === 'function') actualizarPanelCobro();
      }
    } catch (err) {
      console.error('Fallo en seleccionarMesaSalida; aplicando apertura directa de respaldo.', err);
      mesaActiva = mesaObjetivo;
      if (typeof actualizarEtiquetaMesaActiva === 'function') actualizarEtiquetaMesaActiva();
      if (typeof actualizarPanelCobro === 'function') actualizarPanelCobro();
    }

    sincronizarVistaCobroSalida();
    refrescarTarjetasSalida();
  };

  window.renderMesasSalida = function() {
    const grid = document.getElementById('mesas-grid');
    if (!grid) return;

    const espacios = obtenerEspaciosCobroSalida();
    if (!espacios.includes(mesaActiva)) mesaActiva = 'Mesa 1';

    espacios.forEach((mesa) => {
      const canon = typeof mesaCanonica === 'function' ? mesaCanonica(mesa) : mesa;
      if (!carritoPorMesa[canon]) carritoPorMesa[canon] = [];
      if (typeof inicializarMetaMesa === 'function') {
        inicializarMetaMesa(mesa);
        inicializarMetaMesa(canon);
      }
    });

    const seleccionada = obtenerMesaSeleccionadaSalida();
    grid.innerHTML = '';

    espacios.forEach((mesa, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-mesa-salida salida-mesa-card';
      btn.dataset.mesa = mesa;
      if (window.__salidaTarjetasExpandidas !== true && index >= SALIDA_TARJETAS_VISIBLES) {
        btn.classList.add('salida-mesa-card--hidden');
      }
      btn.onclick = () => window.abrirMesaCobroDesdeTarjeta(mesa);
      grid.appendChild(btn);
      renderizarTarjetaMesaSalida(btn, mesa === seleccionada);
    });

    sincronizarVistaCobroSalida();
    actualizarEtiquetaMesasSalida();
    actualizarBotonMostrarMasSalida();

    if (!mesaTimerInterval) {
      mesaTimerInterval = setInterval(() => {
        if (typeof actualizarTiempoMesaActiva === 'function') actualizarTiempoMesaActiva();
        refrescarTarjetasSalida();
        if (document.getElementById('comandas')?.classList.contains('active') && typeof renderComandas === 'function') {
          renderComandas();
        }
      }, 1000);
    }
  };

  window.actualizarContadoresMesasSalida = function() {
    refrescarTarjetasSalida();
  };

  const prevSeleccionarMesaSalida = window.seleccionarMesaSalida;
  if (typeof prevSeleccionarMesaSalida === 'function') {
    window.seleccionarMesaSalida = function(mesa) {
      window.__salidaMesaSeleccionada = mesa;
      window.__salidaFacturacionMinimizada = false;
      const result = prevSeleccionarMesaSalida.apply(this, arguments);
      sincronizarVistaCobroSalida();
      refrescarTarjetasSalida();
      return result;
    };
  }

  const prevActualizarPanelCobro = window.actualizarPanelCobro;
  if (typeof prevActualizarPanelCobro === 'function') {
    window.actualizarPanelCobro = function() {
      const result = prevActualizarPanelCobro.apply(this, arguments);
      sincronizarVistaCobroSalida();
      refrescarTarjetasSalida();
      return result;
    };
  }

  const prevBuscarPlatoVenta = window.buscarPlatoVenta;
  if (typeof prevBuscarPlatoVenta === 'function') {
    window.buscarPlatoVenta = function() {
      if (!tieneMesaCobroSeleccionada()) {
        const results = document.getElementById('contenedor-salidas-busqueda');
        if (results) results.innerHTML = '';
        return;
      }
      return prevBuscarPlatoVenta.apply(this, arguments);
    };
  }

  const prevTransferirAFactura = window.transferirAFactura;
  if (typeof prevTransferirAFactura === 'function') {
    window.transferirAFactura = function(index) {
      if (!tieneMesaCobroSeleccionada()) {
        alert('Seleccione una tarjeta de cobro antes de agregar platos.');
        return;
      }
      return prevTransferirAFactura.apply(this, arguments);
    };
  }

  const prevShowPageSalida = window.showPage;
  if (typeof prevShowPageSalida === 'function') {
    window.showPage = function(pageId) {
      if (pageId === 'salida') {
        window.__salidaMesaSeleccionada = '';
        window.__salidaTarjetasExpandidas = false;
        window.__salidaFacturacionMinimizada = false;
      }
      const result = prevShowPageSalida.apply(this, arguments);
      sincronizarVistaCobroSalida();
      if (pageId === 'salida') {
        refrescarTarjetasSalida();
      }
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.__salidaMesaSeleccionada = '';
    window.__salidaTarjetasExpandidas = false;
    window.__salidaFacturacionMinimizada = false;
    const salidaOverlay = document.getElementById('salida-facturacion-overlay');
    if (salidaOverlay) {
      salidaOverlay.addEventListener('click', (ev) => {
        if (ev.target === salidaOverlay) window.cerrarMesaCobroActiva();
      });
    }
    sincronizarVistaCobroSalida();
    actualizarEtiquetaMesasSalida();
    actualizarBotonMostrarMasSalida();
  });
})();


// ============================
// Centro de comandos LuRo
// Consola desacoplada + motor determinista de órdenes
// ============================
(() => {
  const ASSISTANT_PAGES = [
    {
      page: 'home',
      label: 'Inicio',
      aliases: ['inicio', 'home', 'panel principal', 'pantalla principal', 'abrir inicio', 'ir a inicio', 'ver perfil del negocio', 'perfil del negocio'],
      description: 'Muestra el perfil del negocio, el estado general de la cuenta y los datos base del sistema.'
    },
    {
      page: 'agregar',
      label: 'Agregar Plato',
      aliases: ['agregar plato', 'crear plato', 'nuevo plato', 'nueva receta', 'agregar receta', 'abrir agregar plato', 'ir a agregar plato', 'crear plato nuevo'],
      description: 'Permite crear platos o recetas, calcular costos y guardarlos en el menú.'
    },
    {
      page: 'inventario',
      label: 'Almacén',
      aliases: ['almacen', 'inventario', 'suministros', 'stock de almacen'],
      description: 'Gestiona las existencias del almacén, entradas, costos y niveles ideales de cada producto.'
    },
    {
      page: 'distribuidores',
      label: 'Distribuidores',
      aliases: ['distribuidores', 'proveedores', 'proveedor', 'catalogo de distribuidores'],
      description: 'Administra distribuidores, sus contactos, productos asociados y apoyo de compras.'
    },
    {
      page: 'produccion-interna',
      label: 'Producción Interna',
      aliases: ['produccion interna', 'produccion', 'semielaborados', 'produccion de cocina'],
      description: 'Registra producciones internas, consume insumos del almacén y controla semielaborados.'
    },
    {
      page: 'disponibilidad',
      label: 'Disponibilidad',
      aliases: ['disponibilidad', 'menu disponible', 'existencia del menu', 'disponibilidad del menu'],
      description: 'Permite revisar el stock disponible de platos y ajustar existencias del menú.'
    },
    {
      page: 'salida',
      label: 'Registrar Salida',
      aliases: ['registrar salida', 'salida', 'facturacion', 'cobro', 'detalle de venta', 'abrir registrar salida', 'ir a salida', 'mostrar detalle de venta'],
      description: 'Gestiona mesas, ventas, clientes y el cierre operativo de una salida o factura.'
    },
    {
      page: 'procedimientos',
      label: 'Procedimientos',
      aliases: ['procedimientos', 'manuales', 'protocolos', 'proceso operativo', 'abrir procedimientos', 'ir a procedimientos', 'ver protocolos'],
      description: 'Muestra procedimientos y protocolos operativos en modo consulta.'
    },
    {
      page: 'clientes-puntos',
      label: 'Clientes y Puntos',
      aliases: ['clientes y puntos', 'clientes puntos', 'puntos', 'fidelizacion'],
      description: 'Administra clientes, puntos acumulados y datos de fidelización.'
    },
    {
      page: 'historial-produccion',
      label: 'Historial Producción',
      aliases: ['historial produccion', 'revisar historial de produccion', 'produccion historial'],
      description: 'Consulta el historial operativo de producciones internas y sus costos.'
    },
    {
      page: 'entradas-almacen',
      label: 'Entradas Almacén',
      aliases: ['entradas almacen', 'historial de entradas', 'registro de entradas', 'entradas de almacen'],
      description: 'Muestra el historial de entradas registradas en el almacén.'
    },
    {
      page: 'ventas',
      label: 'Historial de Ventas',
      aliases: ['historial de ventas', 'ventas historial', 'revisar ventas', 'ver ventas'],
      description: 'Presenta el historial de ventas, totales y ganancias acumuladas.'
    },
    {
      page: 'reporte-compras-distribuidor',
      label: 'Reporte Compras Distribuidor',
      aliases: ['reporte compras distribuidor', 'compras distribuidor', 'reporte de compras', 'historial compras distribuidor', 'abrir reporte compras distribuidor', 'ver compras por distribuidor', 'compras por distribuidor'],
      description: 'Resume entradas y montos comprados por distribuidor.'
    },
    {
      page: 'rnc-dgii',
      label: 'Resumen de facturas',
      aliases: ['resumen de facturas', 'facturas', 'rnc dgii', 'dgii', 'resumen facturas'],
      description: 'Centraliza facturas, RNC, NCF y datos de clientes facturados.'
    },
    {
      page: 'comandas',
      label: 'Comandas',
      aliases: ['comandas', 'hoja de comandas', 'ordenes de cocina', 'comanda'],
      description: 'Muestra comandas activas, tiempos de preparación e historial reciente.'
    },
    {
      page: 'autorizaciones',
      label: 'Autorizaciones',
      aliases: ['autorizaciones', 'historial autorizaciones', 'autorizacion', 'abrir autorizaciones', 'ver historial de autorizaciones'],
      description: 'Permite revisar autorizaciones operativas registradas en el sistema.'
    },
    {
      page: 'historial-decomiso',
      label: 'Historial Decomiso',
      aliases: ['historial decomiso', 'decomisos historial', 'ver decomisos'],
      description: 'Consulta el historial de decomisos y las pérdidas registradas.'
    },
    {
      page: 'decomiso',
      label: 'Registrar Decomiso',
      aliases: ['registrar decomiso', 'decomiso', 'decomisar'],
      description: 'Permite registrar decomisos de productos terminados o ingredientes del almacén.'
    },
    {
      page: 'produccion',
      label: 'Departamentos A-B-C',
      aliases: ['departamentos a b c', 'departamentos abc', 'abc', 'a b c'],
      description: 'Clasifica platos por nivel de stock para una lectura rápida por colores.'
    },
    {
      page: 'diagnostico',
      label: 'Diagnóstico Inteligente',
      aliases: ['diagnostico inteligente', 'diagnostico', 'revisar errores', 'errores del sistema'],
      description: 'Analiza el DOM y resalta alertas operativas o visuales dentro del sistema.'
    },
    {
      page: 'comandos',
      label: 'Comandos',
      aliases: ['comandos', 'lista de comandos', 'centro de comandos', 'catalogo de comandos', 'ver comandos', 'ayuda'],
      description: 'Centraliza los comandos reales disponibles del sistema y permite ejecutarlos desde una sola vista.'
    },
    {
      page: 'configuracion',
      label: 'Configuración',
      aliases: ['configuracion', 'ajustes', 'opciones del sistema', 'configurar sistema', 'abrir configuracion', 'ir a configuracion', 'ver seguridad', 'seguridad'],
      description: 'Reúne controles de seguridad, sincronización, usuarios y parámetros administrativos.'
    },
    {
      page: 'entrenamientos',
      label: 'Entrenamientos',
      aliases: ['entrenamientos', 'entrenamiento', 'equipos', 'capacitacion'],
      description: 'Organiza equipos, platos asignados y procedimientos de formación.'
    }
  ];

  const ASSISTANT_ACTIONS = [
    {
      id: 'open-assistant',
      label: 'Asistente LuRo',
      aliases: ['abrir asistente', 'abre asistente', 'abrir asistente luro', 'abre asistente luro', 'mostrar asistente luro'],
      help: 'Abre la consola flotante de comandos de LuRo Control.',
      response: 'Abriendo Asistente LuRo.',
      run: () => {
        if (typeof window.abrirAsistente === 'function') window.abrirAsistente();
      }
    },
    {
      id: 'switch-module',
      label: 'Cambiar módulo',
      aliases: ['cambiar modulo', 'cambiar de modulo', 'volver a modulos', 'selector de modulos'],
      help: 'Puedo llevarte al selector de módulos para elegir otro entorno de trabajo.',
      response: 'Te llevo al selector de módulos.',
      run: () => {
        if (typeof window.regresarAModulos === 'function') window.regresarAModulos();
      }
    },
    {
      id: 'switch-user',
      label: 'Cambiar de Usuario',
      aliases: ['cambiar usuario', 'cambiar de usuario', 'otro usuario', 'iniciar con otro usuario'],
      help: 'Puedo abrir el cambio de usuario para volver al acceso principal del sistema.',
      response: 'Abriendo cambio de usuario.',
      run: () => {
        if (typeof window.cambiarUsuario === 'function') window.cambiarUsuario();
      }
    },
    {
      id: 'logout',
      label: 'Cerrar Sesión',
      aliases: ['cerrar sesion', 'cerrar la sesion', 'salir de la sesion', 'terminar sesion'],
      help: 'Si quieres cerrar tu sesión actual, puedo ejecutar la salida segura del sistema.',
      response: 'Cerrando sesión segura de LuRo Control.',
      run: () => {
        if (typeof window.cerrarSesion === 'function') window.cerrarSesion();
      }
    }
  ];
  const ASSISTANT_RESTRICTED_PAGES = new Set();

  const ASSISTANT_MODULE_GUIDES = {
    home: 'Desde Inicio puedes revisar el perfil del negocio, la cuenta activa y editar los datos base del sistema.',
    inventario: 'En Almacén registras entradas, costos, stock ideal y controlas faltantes de insumos o ingredientes.',
    distribuidores: 'En Distribuidores registras suplidores, contacto, estado y puedes consultar los productos asociados a cada uno.',
    'produccion-interna': 'Producción Interna sirve para fabricar semielaborados desde insumos del almacén y controlar su costo y existencia.',
    disponibilidad: 'Disponibilidad te permite controlar los platos activos para venta y ajustar su existencia disponible.',
    salida: 'Registrar Salida gestiona mesas, clientes, facturación y el cierre operativo de una venta.',
    procedimientos: 'Procedimientos muestra protocolos y guías de trabajo para consulta rápida del equipo.',
    'clientes-puntos': 'Clientes y Puntos administra la fidelización, el historial del cliente y sus puntos acumulados.',
    'historial-produccion': 'Historial Producción te deja consultar operaciones ya registradas, con fechas, cantidades y costos.',
    'entradas-almacen': 'Entradas Almacén muestra el historial de entradas manuales y te ayuda a auditar movimientos de inventario.',
    ventas: 'Historial de Ventas centraliza ventas anteriores, totales cobrados y ganancia acumulada.',
    'reporte-compras-distribuidor': 'Este reporte resume compras por distribuidor y cuánto se ha invertido con cada suplidor.',
    'rnc-dgii': 'Resumen de facturas reúne datos fiscales, NCF, RNC o cédula, mesa, total y cliente.',
    comandas: 'Comandas muestra órdenes activas de cocina, sus tiempos y el historial reciente.',
    autorizaciones: 'Autorizaciones te permite revisar permisos operativos concedidos dentro del sistema.',
    'historial-decomiso': 'Historial Decomiso guarda pérdidas, fechas y operadores asociados a cada decomiso.',
    decomiso: 'Registrar Decomiso sirve para dar baja a productos o ingredientes y dejar trazabilidad de la pérdida.',
    produccion: 'Departamentos A-B-C clasifica platos según su stock para una lectura rápida por colores.',
    diagnostico: 'Diagnóstico Inteligente revisa alertas operativas y visuales dentro del sistema.',
    comandos: 'Comandos reúne las órdenes reales conectadas al sistema, las organiza por módulo y te deja probarlas desde un solo lugar.',
    configuracion: 'Configuración concentra seguridad, sincronización, usuarios y parámetros sensibles del sistema.',
    entrenamientos: 'Entrenamientos organiza equipos, platos asignados y procedimientos de capacitación.'
  };
  const ASSISTANT_COMMAND_LIBRARY = [
    {
      page: 'home',
      title: '🏠 Inicio',
      description: 'Comandos para volver al panel principal y revisar el perfil del negocio.',
      commands: ['abrir inicio', 'ir a inicio', 'panel principal']
    },
    {
      page: 'agregar',
      title: '🧪 Agregar Plato',
      description: 'Accesos para crear o revisar recetas desde el módulo de platos.',
      commands: ['abrir agregar plato', 'ir a agregar plato', 'crear plato nuevo']
    },
    {
      page: 'inventario',
      title: '📦 Almacén',
      description: 'Órdenes conectadas al almacén y al inventario real.',
      commands: ['abre almacén', 'agrega [cantidad] [unidad] de [producto]', 'elimina [producto]', 'busca [producto]', 'cuánto queda de [producto]', 'qué productos están bajos']
    },
    {
      page: 'distribuidores',
      title: '🚚 Distribuidores',
      description: 'Comandos para suplidores, catálogos y faltantes por distribuidor.',
      commands: ['abre distribuidores', 'crea un nuevo distribuidor [nombre], [contacto], [teléfono]', 'elimina distribuidor [nombre]', 'qué productos tiene [distribuidor]', 'muéstrame los faltantes del distribuidor [nombre]']
    },
    {
      page: 'produccion-interna',
      title: '🏭 Producción Interna',
      description: 'Consultas sobre producciones internas, composición y faltantes.',
      commands: ['ir a producción interna', 'cuáles son mis producciones', 'de qué está compuesta la producción [nombre]', 'qué me falta para completar la producción [nombre]', 'qué debo producir hoy']
    },
    {
      page: 'disponibilidad',
      title: '👁️ Disponibilidad',
      description: 'Comandos sobre platos activos, faltantes y bloqueos por stock.',
      commands: ['abrir disponibilidad', 'qué producto falta para completar [plato]', 'qué plato no puede salir por falta de ingredientes', 'cuáles productos están bajos']
    },
    {
      page: 'salida',
      title: '📤 Registrar Salida',
      description: 'Accesos rápidos al módulo de ventas operativas.',
      commands: ['abrir registrar salida', 'registrar salida de [cantidad] platos mesa [número]', 'cobrar mesa [número]', 'dividir cuenta mesa [número]']
    },
    {
      page: 'procedimientos',
      title: '📘 Procedimientos',
      description: 'Navegación a guías y protocolos del sistema.',
      commands: ['abrir procedimientos', 'ir a procedimientos', 'ver protocolos de [equipo o plato]']
    },
    {
      page: 'clientes-puntos',
      title: '👥 Clientes y Puntos',
      description: 'Búsqueda y análisis de clientes dentro del módulo real.',
      commands: ['abrir clientes y puntos', 'buscar cliente [nombre]', 'cuántos puntos tiene [cliente]', 'quién tiene más puntos acumulados', 'qué cliente compra más']
    },
    {
      page: 'historial-produccion',
      title: '📜 Historial Producción',
      description: 'Comandos para revisar el historial productivo.',
      commands: ['abrir historial producción', 'mostrar historial de producción', 'producción desde [fecha] hasta [fecha]']
    },
    {
      page: 'entradas-almacen',
      title: '📥 Entradas Almacén',
      description: 'Acceso al historial de entradas del almacén.',
      commands: ['abrir entradas almacén', 'ver historial de entradas', 'entradas de [producto]']
    },
    {
      page: 'ventas',
      title: '📊 Historial de Ventas',
      description: 'Consultas reales de ventas, ganancias y productos con movimiento.',
      commands: ['abrir historial de ventas', 'ventas de hoy', 'cuánto he ganado', 'cuál es mi total de ganancias', 'cuál es el producto que más se vende', 'qué plato deja más ganancia']
    },
    {
      page: 'reporte-compras-distribuidor',
      title: '📑 Reporte Compras Distribuidor',
      description: 'Acceso al resumen histórico de compras por distribuidor.',
      commands: ['abrir reporte compras distribuidor', 'compras del distribuidor [nombre]']
    },
    {
      page: 'rnc-dgii',
      title: '🧾 Resumen de facturas',
      description: 'Consultas de facturación y facturas registradas.',
      commands: ['abrir resumen de facturas', 'muéstrame las facturas de hoy', 'cuánto se ha facturado', 'cuál factura fue la más alta', 'busca la factura de [cliente]']
    },
    {
      page: 'comandas',
      title: '🧾 Comandas',
      description: 'Navegación al tablero operativo de comandas.',
      commands: ['abrir comandas', 'ver comandas activas', 'comandas de [mesa]']
    },
    {
      page: 'autorizaciones',
      title: '✅ Autorizaciones',
      description: 'Acceso al historial de autorizaciones.',
      commands: ['abrir autorizaciones', 'historial autorizaciones', 'autorizaciones de [usuario]']
    },
    {
      page: 'historial-decomiso',
      title: '📑 Historial Decomiso',
      description: 'Consultas reales de pérdidas y decomisos registrados.',
      commands: ['abrir historial decomiso', 'cuáles son mis pérdidas', 'cuánto he perdido', 'decomisos de [fecha]']
    },
    {
      page: 'decomiso',
      title: '🗑️ Registrar Decomiso',
      description: 'Órdenes para decomisar platos, ingredientes y producciones.',
      commands: ['abrir decomiso', 'decomisa [plato]', 'decomisa [cantidad] [unidad] de [ingrediente]', 'decomisa [cantidad] [unidad] de [producto]']
    },
    {
      page: 'produccion',
      title: '📊 Departamentos A-B-C',
      description: 'Acceso al módulo ABC para revisar stock por colores.',
      commands: ['abrir departamentos a b c', 'ver departamentos abc']
    },
    {
      page: 'diagnostico',
      title: '🧠 Diagnóstico Inteligente',
      description: 'Comandos para abrir el módulo de diagnóstico.',
      commands: ['abrir diagnóstico inteligente', 'ir a diagnóstico']
    },
    {
      page: 'entrenamientos',
      title: '🎓 Entrenamientos',
      description: 'Acceso a equipos, platos y procedimientos de capacitación.',
      commands: ['abrir entrenamientos', 'ir a entrenamientos', 'ver entrenamientos de [equipo]']
    },
    {
      page: 'configuracion',
      title: '⚙️ Configuración',
      description: 'Comandos de acceso a la configuración general del sistema.',
      commands: ['abrir configuración', 'mostrar usuarios', 'autorizar usuario [nombre]']
    },
    {
      page: '',
      title: '🧠 Asistente LuRo',
      description: 'Controles globales y acciones del sistema fuera de un módulo específico.',
      commands: ['abrir asistente luro', 'abrir comandos', 'cerrar sesión', 'cambiar módulo', 'cambiar de usuario']
    }
  ];
  const ASSISTANT_GREETING = 'Centro de comandos listo. Escribe una orden real del sistema o abre el módulo 📜 COMANDOS.';
  const ASSISTANT_HELP = 'Abre el módulo 📜 COMANDOS para ver y probar las órdenes reales disponibles.';
  const ASSISTANT_UNKNOWN_COMMAND = 'Comando no reconocido.';
  const ASSISTANT_SUGGESTIONS_STORAGE_KEY = 'LURO_ASSISTANT_ACTIVE_COMMAND_SECTIONS_V1';
  const ASSISTANT_COMMAND_LIBRARY_STORAGE_KEY = 'LURO_ASSISTANT_COMMAND_LIBRARY_OVERRIDES_V1';
  const ASSISTANT_SUGGESTION_DEFAULT_KEYS = ['comandos', 'inventario', 'distribuidores', 'produccion-interna', 'historial-decomiso'];
  const ASSISTANT_SUGGESTION_OVERRIDES = {
    comandos: { label: '📜 Comandos', command: 'Abre comandos' },
    inventario: { label: '📦 Almacén', command: 'Abre almacén' },
    distribuidores: { label: '🚚 Distribuidores', command: 'Abre distribuidores' },
    'produccion-interna': { label: '🏭 Producción', command: 'Ir a producción interna' },
    ventas: { label: '📊 Ventas', command: 'Ventas de hoy' },
    disponibilidad: { label: '👁️ Disponibilidad', command: 'Abrir disponibilidad' },
    'historial-decomiso': { label: '📉 Pérdidas', command: '¿Cuál es mi total de pérdidas?' }
  };
  const ASSISTANT_IDLE_CLEAR_MS = 5 * 60 * 1000;
  let assistantSeeded = false;
  let assistantPendingAction = null;
  let assistantIdleTimer = null;
  let assistantSuggestionPreviewKey = '';
  let comandosEditorState = null;
  const assistantDebugState = {
    traceId: 0,
    current: [],
    history: []
  };
  const ASSISTANT_CONTEXT_DEFAULTS = {
    lastIntent: '',
    lastModule: '',
    lastEntityType: '',
    lastEntityName: '',
    lastReference: '',
    lastProduct: '',
    lastDistributor: '',
    lastClient: '',
    lastPlate: '',
    lastQuantity: null,
    lastUnit: '',
    lastCost: null,
    lastIdeal: null,
    lastQueryTopic: ''
  };
  const assistantConversationContext = { ...ASSISTANT_CONTEXT_DEFAULTS };
  function assistantRefs() {
    return {
      panel: document.getElementById('luro-assistant-panel'),
      fab: document.getElementById('luro-assistant-fab'),
      sidebarLaunch: document.getElementById('sidebar-assistant-launch'),
      comandosLaunch: document.getElementById('comandos-open-assistant-btn'),
      input: document.getElementById('luro-assistant-input'),
      messages: document.getElementById('luro-assistant-messages'),
      suggestions: document.getElementById('luro-assistant-suggestions')
    };
  }

  function resetearContextoConversacionAsistente() {
    Object.keys(ASSISTANT_CONTEXT_DEFAULTS).forEach((key) => {
      assistantConversationContext[key] = ASSISTANT_CONTEXT_DEFAULTS[key];
    });
    return obtenerContextoConversacionAsistente();
  }

  function programarLimpiezaInactividadAsistente() {
    if (assistantIdleTimer) {
      clearTimeout(assistantIdleTimer);
    }
    assistantIdleTimer = setTimeout(() => {
      reiniciarConversacionAsistente('idle');
    }, ASSISTANT_IDLE_CLEAR_MS);
  }

  function registrarActividadAsistente() {
    programarLimpiezaInactividadAsistente();
  }

  function reiniciarConversacionAsistente(motivo = 'manual') {
    const { messages, input, panel } = assistantRefs();
    if (assistantIdleTimer) {
      clearTimeout(assistantIdleTimer);
      assistantIdleTimer = null;
    }
    if (messages) {
      messages.innerHTML = '';
    }
    if (input) {
      input.value = '';
    }
    assistantPendingAction = null;
    assistantSeeded = false;
    resetearContextoConversacionAsistente();
    sembrarAsistenteSiHaceFalta(panel?.classList.contains('is-open'));
    if (motivo === 'idle') {
      actualizarEstadoModuloComandos('La conversación se reinició después de 5 minutos de inactividad.');
    } else {
      actualizarEstadoModuloComandos(ASSISTANT_HELP);
    }
    if (panel?.classList.contains('is-open')) {
      registrarActividadAsistente();
    }
  }

  function esDisparadorAsistente(target) {
    if (!(target instanceof Element)) return false;
    const { fab, sidebarLaunch, comandosLaunch } = assistantRefs();
    return !!(
      (fab && fab.contains(target)) ||
      (sidebarLaunch && sidebarLaunch.contains(target)) ||
      (comandosLaunch && comandosLaunch.contains(target))
    );
  }

  function comandosRefs() {
    return {
      search: document.getElementById('comandos-buscar'),
      runnerInput: document.getElementById('comandos-ejecutor-input'),
      summary: document.getElementById('comandos-resumen'),
      state: document.getElementById('comandos-estado'),
      list: document.getElementById('comandos-lista'),
      editorModal: document.getElementById('comandos-editor-modal'),
      editorKey: document.getElementById('comandos-editor-key'),
      editorTitle: document.getElementById('comandos-editor-title'),
      editorDescription: document.getElementById('comandos-editor-description'),
      editorList: document.getElementById('comandos-editor-lista')
    };
  }

  function describirComandoCatalogoAsistente(section, commandText) {
    const texto = normalizarTextoAsistente(commandText);
    const modulo = section?.title || 'este módulo';
    if (!texto) return `Ejecuta una orden dentro de ${modulo}.`;
    if (/^(abre|abrir|ir a|ve a|panel principal|abrir )/.test(texto)) return `Abre o enfoca ${modulo}.`;
    if (/(crea|nuevo distribuidor|agrega .* distribuidor|registra .* distribuidor)/.test(texto)) return 'Prepara la creación de un distribuidor nuevo con sus datos principales.';
    if (/(elimina|borra|quita|remueve)/.test(texto)) return 'Prepara una eliminación y pedirá confirmación antes de ejecutarla.';
    if (/(busca|buscar|encuentra|localiza)/.test(texto)) return `Busca información real dentro de ${modulo}.`;
    if (/(cuanto|cuanta|cual|que|quien|muestrame|mostrar|ver)/.test(texto)) return `Consulta datos reales del sistema dentro de ${modulo}.`;
    if (/(decomisa|decomisar|decomiso)/.test(texto)) return 'Prepara un decomiso usando la lógica real del sistema y pide confirmación.';
    if (/(cobrar|registrar salida|dividir cuenta)/.test(texto)) return 'Prepara una acción operativa de ventas o salida dentro del sistema.';
    return `Ejecuta o prepara esta acción dentro de ${modulo}.`;
  }

  function normalizarComandoCatalogoAsistente(section, command) {
    if (typeof command === 'string') {
      const text = String(command || '').trim();
      if (!text) return null;
      return {
        text,
        help: describirComandoCatalogoAsistente(section, text)
      };
    }
    if (!command || typeof command !== 'object') return null;
    const text = String(command.text || command.label || '').trim();
    if (!text) return null;
    return {
      text,
      help: String(command.help || command.description || describirComandoCatalogoAsistente(section, text)).trim()
    };
  }

  function normalizarSeccionCatalogoAsistente(section = {}) {
    const base = {
      ...section,
      title: String(section.title || '').trim(),
      description: String(section.description || '').trim()
    };
    base.commands = (Array.isArray(section.commands) ? section.commands : [])
      .map((command) => normalizarComandoCatalogoAsistente(base, command))
      .filter(Boolean);
    return base;
  }

  function obtenerCatalogoBaseComandosSistema() {
    return ASSISTANT_COMMAND_LIBRARY.map((section) => normalizarSeccionCatalogoAsistente(section));
  }

  function obtenerOverridesComandosAsistente() {
    try {
      const raw = localStorage.getItem(ASSISTANT_COMMAND_LIBRARY_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function guardarOverridesComandosAsistente(overrides = {}) {
    try {
      localStorage.setItem(ASSISTANT_COMMAND_LIBRARY_STORAGE_KEY, JSON.stringify(overrides || {}));
    } catch (_) {}
  }

  function obtenerCatalogoComandosSistema() {
    const baseCatalog = obtenerCatalogoBaseComandosSistema();
    const overrides = obtenerOverridesComandosAsistente();
    return baseCatalog.map((baseSection) => {
      const key = obtenerClaveSeccionComandos(baseSection);
      const override = overrides[key];
      if (!override || typeof override !== 'object') return baseSection;
      const merged = {
        ...baseSection,
        title: String(override.title || baseSection.title || '').trim() || baseSection.title,
        description: String(override.description || baseSection.description || '').trim() || baseSection.description
      };
      if (Array.isArray(override.commands) && override.commands.length) {
        merged.commands = override.commands
          .map((command) => normalizarComandoCatalogoAsistente(merged, command))
          .filter(Boolean);
      }
      return merged;
    });
  }

  function obtenerTextoPrimarioComandoSeccion(section = {}) {
    const commands = Array.isArray(section.commands) ? section.commands : [];
    return commands[0]?.text || '';
  }

  function buscarSeccionComandosPorKey(sectionKey, catalog = obtenerCatalogoComandosSistema()) {
    const key = String(sectionKey || '').trim();
    if (!key) return null;
    return (Array.isArray(catalog) ? catalog : []).find((section) => obtenerClaveSeccionComandos(section) === key) || null;
  }

  function obtenerClaveSeccionComandos(section = {}) {
    const base = String(section.page || normalizarTextoAsistente(section.title || '') || '').trim();
    return base || `section-${Math.abs(String(section.title || 'comandos').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0))}`;
  }

  function obtenerConfigSugerenciaSeccion(section = {}) {
    const key = obtenerClaveSeccionComandos(section);
    const override = ASSISTANT_SUGGESTION_OVERRIDES[key] || {};
    return {
      key,
      label: override.label || section.title || 'Comando',
      command: override.command || section.suggestionCommand || obtenerTextoPrimarioComandoSeccion(section)
    };
  }

  function obtenerClavesValidasSugerenciasAsistente() {
    return obtenerCatalogoComandosSistema()
      .map((section) => obtenerConfigSugerenciaSeccion(section).key)
      .filter(Boolean);
  }

  function normalizarClavesSugerenciasAsistente(keys = []) {
    const validas = new Set(obtenerClavesValidasSugerenciasAsistente());
    return Array.from(new Set((Array.isArray(keys) ? keys : []).map((key) => String(key || '').trim()).filter((key) => validas.has(key))));
  }

  function obtenerClavesSugerenciasActivasAsistente() {
    try {
      const raw = localStorage.getItem(ASSISTANT_SUGGESTIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const normalizadas = normalizarClavesSugerenciasAsistente(parsed);
        if (normalizadas.length || Array.isArray(parsed)) {
          return normalizadas;
        }
      }
    } catch (_) {}
    return normalizarClavesSugerenciasAsistente(ASSISTANT_SUGGESTION_DEFAULT_KEYS);
  }

  function guardarClavesSugerenciasActivasAsistente(keys = []) {
    const normalizadas = normalizarClavesSugerenciasAsistente(keys);
    try {
      localStorage.setItem(ASSISTANT_SUGGESTIONS_STORAGE_KEY, JSON.stringify(normalizadas));
    } catch (_) {}
    return normalizadas;
  }

  function seccionSugerenciaActivaAsistente(section) {
    const key = obtenerConfigSugerenciaSeccion(section).key;
    return obtenerClavesSugerenciasActivasAsistente().includes(key);
  }

  function renderSugerenciasAsistente() {
    const { suggestions } = assistantRefs();
    if (!suggestions) return;
    suggestions.innerHTML = '';

    const activas = new Set(obtenerClavesSugerenciasActivasAsistente());
    const secciones = obtenerCatalogoComandosSistema()
      .map((section) => ({
        section,
        suggestion: obtenerConfigSugerenciaSeccion(section)
      }))
      .filter((item) => activas.has(item.suggestion.key) && item.suggestion.command);

    if (assistantSuggestionPreviewKey && !secciones.some((item) => item.suggestion.key === assistantSuggestionPreviewKey)) {
      assistantSuggestionPreviewKey = '';
    }

    if (!secciones.length) {
      const empty = document.createElement('div');
      empty.className = 'luro-assistant-suggestions-empty';
      empty.textContent = 'Activa accesos desde el módulo 📜 COMANDOS para mostrarlos aquí.';
      suggestions.appendChild(empty);
      return;
    }

    const rail = document.createElement('div');
    rail.className = 'luro-assistant-suggestion-rail';
    let previewPayload = null;

    secciones.forEach(({ section, suggestion }) => {
      const item = document.createElement('div');
      item.className = 'luro-assistant-suggestion-item';
      item.dataset.sectionKey = suggestion.key;
      const isOpen = assistantSuggestionPreviewKey === suggestion.key;
      if (isOpen) item.classList.add('is-open');
      item.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'luro-assistant-chip';
      btn.textContent = suggestion.label;
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      btn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.toggleVistaPreviaSugerenciaAsistente(suggestion.key);
      };
      item.appendChild(btn);
      rail.appendChild(item);
      if (isOpen) previewPayload = { section, suggestion };
    });

    suggestions.appendChild(rail);

    if (previewPayload) {
      const previewHost = document.createElement('div');
      previewHost.className = 'luro-assistant-suggestion-preview';
      previewHost.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      const popover = document.createElement('div');
      popover.className = 'luro-assistant-suggestion-popover';

      const popoverTitle = document.createElement('strong');
      popoverTitle.className = 'luro-assistant-suggestion-popover-title';
      popoverTitle.textContent = previewPayload.section.title || previewPayload.suggestion.label;

      const popoverCopy = document.createElement('p');
      popoverCopy.className = 'luro-assistant-suggestion-popover-copy';
      popoverCopy.textContent = previewPayload.section.description || 'Comandos disponibles de esta sección.';

      const popoverCommands = document.createElement('div');
      popoverCommands.className = 'luro-assistant-suggestion-popover-commands';

      (Array.isArray(previewPayload.section.commands) ? previewPayload.section.commands : []).forEach((commandText) => {
        const commandBtn = document.createElement('button');
        commandBtn.type = 'button';
        commandBtn.className = 'luro-assistant-suggestion-command';
        commandBtn.textContent = commandText.text;
        if (commandText.help) commandBtn.title = commandText.help;
        commandBtn.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.usarSugerenciaAsistente(commandText.text);
        };
        popoverCommands.appendChild(commandBtn);
      });

      popover.appendChild(popoverTitle);
      popover.appendChild(popoverCopy);
      popover.appendChild(popoverCommands);
      previewHost.appendChild(popover);
      suggestions.appendChild(previewHost);
    }
  }

  const ASSISTANT_SYNONYM_REPLACEMENTS = [
    [/\bmuestreme\b/g, 'muestrame'],
    [/\bmostrarme\b/g, 'muestrame'],
    [/\bborralo\b/g, 'eliminalo'],
    [/\bborralo\b/g, 'eliminalo'],
    [/\bborra\b/g, 'elimina'],
    [/\bquitalo\b/g, 'eliminalo'],
    [/\bquitarlo\b/g, 'eliminalo'],
    [/\bquita\b/g, 'elimina'],
    [/\bremuevelo\b/g, 'eliminalo'],
    [/\bremueve\b/g, 'elimina'],
    [/\bremover\b/g, 'eliminar'],
    [/\bsacalo\b/g, 'eliminalo'],
    [/\bsaca\b/g, 'elimina'],
    [/\banade\b/g, 'agrega'],
    [/\banadir\b/g, 'agregar'],
    [/\bmete\b/g, 'agrega'],
    [/\bmeter\b/g, 'agregar'],
    [/\bsuma\b/g, 'agrega'],
    [/\bsumar\b/g, 'agregar'],
    [/\bpon\b/g, 'agrega'],
    [/\bingresa\b/g, 'agrega'],
    [/\bcambiale\b/g, 'edita'],
    [/\bcambiarle\b/g, 'editar'],
    [/\bmodifica\b/g, 'edita'],
    [/\bmodificar\b/g, 'editar'],
    [/\bactualiza\b/g, 'edita'],
    [/\bactualizar\b/g, 'editar'],
    [/\bproveedor\b/g, 'distribuidor'],
    [/\bproveedores\b/g, 'distribuidores']
  ];

  function normalizarSinonimosAsistente(texto) {
    let valor = String(texto || '');
    ASSISTANT_SYNONYM_REPLACEMENTS.forEach(([pattern, replacement]) => {
      valor = valor.replace(pattern, replacement);
    });
    return valor.replace(/\s+/g, ' ').trim();
  }

  function normalizarTextoAsistente(texto) {
    const limpio = String(texto || '')
      .toLowerCase()
      .replace(/ã¡/g, 'a')
      .replace(/ã©/g, 'e')
      .replace(/ã­/g, 'i')
      .replace(/ã³/g, 'o')
      .replace(/ãº/g, 'u')
      .replace(/ã±/g, 'n')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return normalizarSinonimosAsistente(limpio);
  }

  function textoIncluyeAlias(textoNormalizado, aliases = []) {
    return aliases.some(alias => textoNormalizado.includes(normalizarTextoAsistente(alias)));
  }

  function detectarNavegacionExplicitaAsistente(textoNormalizado) {
    if (!textoNormalizado) return null;
    const match = textoNormalizado.match(/^(?:abre|abrir|ir a|ve a|mostrar|muestrame|muestrame el modulo|mostrar el modulo|llename a|llevame a)\s+(.+)$/);
    if (!match) return null;
    const destinoNormalizado = normalizarTextoAsistente(match[1] || '');
    if (!destinoNormalizado) return null;
    if (/(productos?|faltantes?|ganancias?|perdidas?|facturas?|puntos|telefono|numero|contacto|pedido|cliente|cuanto|cual|que|decomisa|elimina|crea|actualiza|busca)/.test(destinoNormalizado)) {
      return null;
    }
    return ASSISTANT_PAGES.find((item) => {
      const aliases = Array.isArray(item.aliases) ? item.aliases : [];
      return aliases.some((alias) => {
        const aliasNormalizado = normalizarTextoAsistente(alias);
        return destinoNormalizado === aliasNormalizado || destinoNormalizado.includes(aliasNormalizado);
      });
    }) || null;
  }

  function detectarIntencionAyuda(textoNormalizado) {
    return /(ayuda|ayudame|ayudarme|que puedes hacer|que haces|comandos|opciones|soporte|orientame|orientacion)/.test(textoNormalizado);
  }

  function detectarConsultaGananciasAsistente(textoNormalizado) {
    const hablaDeGanancias = /(ganancia|ganancias|ganado|total ganado|dinero ganado|cuanto he ganado|cuanto llevo ganado|total de ganancias)/.test(textoNormalizado);
    const tonoConsulta = /(cual|cuanto|muestrame|muest[r]?ame|mostrar|dime|consulta|ver|total|actual|he ganado|llevo ganado)/.test(textoNormalizado);
    return hablaDeGanancias && (tonoConsulta || /\bganancia(s)?\b/.test(textoNormalizado) || /\bganado\b/.test(textoNormalizado));
  }

  function detectarConsultaPerdidasAsistente(textoNormalizado) {
    const hablaDePerdidas = /(perdida|perdidas|perdido|dinero perdido|total perdido|total de perdidas|cuanto he perdido|cuanto llevo perdido|mis perdidas)/.test(textoNormalizado);
    const tonoConsulta = /(cual|cuanto|muestrame|muest[r]?ame|mostrar|dime|consulta|ver|total|actual|he perdido|llevo perdido)/.test(textoNormalizado);
    return hablaDePerdidas && (tonoConsulta || /\bperdida(s)?\b/.test(textoNormalizado) || /\bperdido\b/.test(textoNormalizado));
  }

  function detectarIntencionExplicacion(textoNormalizado) {
    return /(que hace|para que sirve|explica|explicame|como funciona|que es|que hace el modulo|como uso|que hace esta opcion|explicame esta pantalla)/.test(textoNormalizado);
  }

  function detectarIntencionProcedimiento(textoNormalizado) {
    return /(como registro|como agrego|como creo|como entro|como uso|como hago|pasos|guia|guiame)/.test(textoNormalizado);
  }

  function detectarSaludo(textoNormalizado) {
    return /^(hola|buenas|hey|saludos|hola asistente|hola luro)$/.test(textoNormalizado);
  }

  function esConfirmacionAsistente(textoNormalizado) {
    return /^(si|sí|confirmo|confirmar|dale|ok|okay|hazlo|procede|adelante|correcto|de acuerdo|afirmativo)$/.test(textoNormalizado);
  }

  function esCancelacionAsistente(textoNormalizado) {
    return /^(no|cancelar|cancela|deten|detener|mejor no|olvidalo|olvidalo por ahora|descarta)$/.test(textoNormalizado);
  }

  function pareceNuevoComandoAsistente(textoNormalizado) {
    return !!(
      detectarConsultaSistemaAvanzadaAsistente(textoNormalizado) ||
      detectarConsultaGananciasAsistente(textoNormalizado) ||
      detectarIntencionExplicacion(textoNormalizado) ||
      detectarIntencionProcedimiento(textoNormalizado) ||
      /(abre|abrir|ve a|ir a|ll[eé]vame|muestrame|mu[eé]strame|quiero ver|agrega|agregar|anade|anadir|registra|registrar|mete|meter|suma|sumar|pon|ponle|ingresa|ingresar|elimina|eliminar|eliminalo|borra|borrar|borralo|quita|quitar|quitalo|remueve|remover|remuevelo|edita|editar|modifica|modificar|cambia|cambiar|actualiza|actualizar|busca|buscar|decomisa|decomisar|decomiso|pedido|prepara|genera|que hace|para que sirve|explica|explicame|como|ganancia|ganancias|ganado|perdida|perdidas|perdido|factura|facturas|puntos|cliente|clientes|queda|stock|productos|distribuidor|plato|produccion)/.test(textoNormalizado)
    );
  }

  function formatearNumeroAsistente(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '';
    if (Math.abs(numero - Math.round(numero)) < 0.0001) return String(Math.round(numero));
    return numero.toFixed(2).replace(/\.?0+$/, '');
  }

  function formatearMonedaAsistente(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 'RD$0';
    return `RD$${formatearNumeroAsistente(numero)}`;
  }

  function capitalizarTextoAsistente(texto) {
    return String(texto || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' ');
  }

  function limpiarNombreEntidadAsistente(texto) {
    return normalizarTextoAsistente(texto)
      .replace(/\b(?:producto|productos|ingrediente|ingredientes|insumo|insumos|distribuidor|distribuidores|proveedor|proveedores)\b/g, ' ')
      .replace(/\b(?:del?|en el|en la|en|de la|de)\s+(?:almacen|inventario|distribuidor(?:es)?|proveedor(?:es)?)\b/g, ' ')
      .replace(/\b(?:el|la|lo|los|las|un|una|unos|unas|este|esta|esto|ese|esa|eso|aquel|aquella)\b/g, ' ')
      .replace(/\b(?:por favor|porfa|quiero|necesito|me gustaria|me gustaria que|llename)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizarNumeroAsistente(texto) {
    if (texto === null || texto === undefined) return null;
    const limpio = String(texto).replace(',', '.').replace(/[^\d.]/g, '');
    if (!limpio) return null;
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : null;
  }

  function clonarDebugAsistente(value, depth = 0) {
    if (depth > 2) return '[max-depth]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'function') return '[function]';
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.slice(0, 8).map(item => clonarDebugAsistente(item, depth + 1));
    const clone = {};
    Object.keys(value).slice(0, 12).forEach((key) => {
      clone[key] = clonarDebugAsistente(value[key], depth + 1);
    });
    return clone;
  }

  function iniciarDebugAsistente(rawText, normalizedText) {
    assistantDebugState.traceId += 1;
    assistantDebugState.current = [];
    registrarDebugAsistente('input', {
      rawText,
      normalizedText,
      activeModule: obtenerModuloActivoAsistente()?.page || '',
      pendingAction: !!assistantPendingAction
    });
  }

  function registrarDebugAsistente(stage, payload = {}) {
    const entry = {
      id: assistantDebugState.traceId,
      stage,
      at: new Date().toISOString(),
      data: clonarDebugAsistente(payload)
    };
    assistantDebugState.current.push(entry);
    try {
      console.info('[LuRo Assistant]', stage, entry.data);
    } catch (_) {}
    return entry;
  }

  function cerrarDebugAsistente(resultado) {
    assistantDebugState.history.unshift({
      id: assistantDebugState.traceId,
      at: new Date().toISOString(),
      result: clonarDebugAsistente(resultado),
      trace: assistantDebugState.current.slice()
    });
    assistantDebugState.history = assistantDebugState.history.slice(0, 40);
    window.__luroAssistantDebug = assistantDebugState.history;
    window.getLuroAssistantDebug = function () {
      return assistantDebugState.history.slice();
    };
  }

  function distanciaLevenshteinAsistente(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (!left) return right.length;
    if (!right) return left.length;
    const dp = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
    for (let i = 0; i <= left.length; i += 1) dp[i][0] = i;
    for (let j = 0; j <= right.length; j += 1) dp[0][j] = j;
    for (let i = 1; i <= left.length; i += 1) {
      for (let j = 1; j <= right.length; j += 1) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[left.length][right.length];
  }

  function normalizarUnidadAsistente(texto) {
    const valor = normalizarTextoAsistente(texto);
    if (!valor) return '';
    if (['lb', 'lbr', 'libra', 'libras'].includes(valor)) return 'Lb';
    if (['g', 'gr', 'grs', 'gramo', 'gramos'].includes(valor)) return 'g';
    if (['oz', 'onza', 'onzas'].includes(valor)) return 'Oz';
    if (['lt', 'lts', 'litro', 'litros', 'l'].includes(valor)) return 'Litros';
    if (['unidad', 'unidades', 'ud', 'uds', 'u'].includes(valor)) return 'Unidad';
    if (['ml', 'mililitro', 'mililitros'].includes(valor)) return 'Litros';
    return '';
  }

  function etiquetaUnidadAsistente(unidad) {
    switch (unidad) {
      case 'Lb': return 'libras';
      case 'g': return 'gramos';
      case 'Oz': return 'onzas';
      case 'Litros': return 'litros';
      case 'Unidad': return 'unidades';
      default: return unidad || 'unidades';
    }
  }

  function obtenerModuloActivoAsistente() {
    const activo = document.querySelector('.content-section.active');
    if (!activo || !activo.id) return null;
    return ASSISTANT_PAGES.find(item => item.page === activo.id) || null;
  }

  function obtenerModuloPorPaginaAsistente(page) {
    return ASSISTANT_PAGES.find(item => item.page === page) || null;
  }

  function esModuloRestringidoAsistente(moduloOPage) {
    const page = typeof moduloOPage === 'string' ? moduloOPage : moduloOPage?.page;
    return ASSISTANT_RESTRICTED_PAGES.has(page);
  }

  function construirRespuestaRestriccionAsistente(moduloOPage) {
    const modulo = typeof moduloOPage === 'string' ? obtenerModuloPorPaginaAsistente(moduloOPage) : moduloOPage;
    const label = modulo?.label || 'ese módulo';
    return {
      message: `No tengo acceso a ${label}. Esa acción está restringida para el asistente.`,
      role: 'assistant'
    };
  }

  function resolverModuloAsistente(intencion) {
    if (!intencion) return null;
    const topicMap = {
      'ganancias-total': 'ventas',
      'perdidas-total': 'historial-decomiso',
      'ventas-total-hoy': 'ventas',
      'ventas-top-product': 'ventas',
      'ventas-low-product': 'ventas',
      'facturas-hoy': 'rnc-dgii',
      'facturacion-total': 'rnc-dgii',
      'factura-mas-alta': 'rnc-dgii',
      'factura-por-cliente': 'rnc-dgii',
      'almacen-restante': 'inventario',
      'almacen-mas-critico': 'inventario',
      'almacen-bajo-ideal': 'inventario',
      'almacen-buscar': 'inventario',
      'distribuidor-productos': 'distribuidores',
      'distribuidor-faltantes': 'distribuidores',
      'distribuidor-pedido': 'distribuidores',
      'distribuidor-vende-producto': 'distribuidores',
      'clientes-puntos': 'clientes-puntos',
      'clientes-buscar': 'clientes-puntos',
      'clientes-top-puntos': 'clientes-puntos',
      'clientes-top-compra': 'clientes-puntos',
      'plato-mas-ganancia': 'ventas',
      'plato-faltantes': 'disponibilidad',
      'platos-bloqueados': 'disponibilidad',
      'produccion-recomendada': 'produccion-interna',
      'produccion-listado': 'produccion-interna',
      'produccion-composicion': 'produccion-interna',
      'produccion-faltantes': 'produccion-interna',
      'plato-consume-ingrediente': 'disponibilidad',
      'ingrediente-mas-usado': 'disponibilidad'
    };
    const actionMap = {
      'distribuidor-create': 'distribuidores',
      'distribuidor-update-phone': 'distribuidores',
      'decomiso-create': 'decomiso'
    };
    const page = topicMap[intencion.topic] || actionMap[intencion.kind] || '';
    if (page) {
      return ASSISTANT_PAGES.find(item => item.page === page) || null;
    }
    return null;
  }

  function leerValorDOMAsistente(selector) {
    if (!selector || typeof document === 'undefined') return '';
    let node = null;
    if (selector.startsWith('#') && typeof document.getElementById === 'function') {
      node = document.getElementById(selector.slice(1));
    } else if (typeof document.querySelector === 'function') {
      node = document.querySelector(selector);
    }
    if (!node) return '';
    return String(node.innerText || node.textContent || node.value || '').trim();
  }

  function extraerMontoDesdeTextoAsistente(texto) {
    const match = String(texto || '').match(/RD\$\s*([0-9.,]+)/i);
    if (!match) return null;
    const limpio = match[1].replace(/,/g, '');
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : null;
  }

  function formatearMontoRespuestaAsistente(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 'RD$0.00';
    return `RD$${numero.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function obtenerOwnerAsistente() {
    if (typeof ownerDatosActivo === 'function') {
      const owner = ownerDatosActivo();
      if (owner) return String(owner).trim().toLowerCase();
    }
    return String(sesionUser?.user || '').trim().toLowerCase();
  }

  function itemPerteneceContextoAsistente(item) {
    return String(item?.owner || '').trim().toLowerCase() === obtenerOwnerAsistente() && item?.modulo === moduloActual;
  }

  function obtenerContextoConversacionAsistente() {
    return { ...assistantConversationContext };
  }

  function actualizarContextoConversacionAsistente(payload = {}) {
    Object.keys(payload).forEach((key) => {
      if (!(key in assistantConversationContext)) return;
      const value = payload[key];
      if (value === undefined) return;
      assistantConversationContext[key] = value;
    });
    return obtenerContextoConversacionAsistente();
  }

  function recordarEntidadAsistente(payload = {}) {
    const patch = {};
    if (payload.intent) patch.lastIntent = payload.intent;
    if (payload.module) patch.lastModule = payload.module;
    if (payload.entityType) patch.lastEntityType = payload.entityType;
    if (payload.reference) patch.lastReference = payload.reference;
    if (payload.quantity !== undefined) patch.lastQuantity = payload.quantity;
    if (payload.unit !== undefined) patch.lastUnit = payload.unit;
    if (payload.cost !== undefined) patch.lastCost = payload.cost;
    if (payload.ideal !== undefined) patch.lastIdeal = payload.ideal;

    const entityName = payload.entityName || payload.product || payload.distributor || '';
    if (entityName) {
      patch.lastEntityName = entityName;
    }

    if (payload.product) {
      patch.lastProduct = payload.product;
      patch.lastEntityName = payload.product;
      patch.lastEntityType = payload.entityType || 'almacen';
    }

    if (payload.distributor) {
      patch.lastDistributor = payload.distributor;
      patch.lastEntityName = payload.distributor;
      patch.lastEntityType = payload.entityType || 'distribuidor';
    }

    if (payload.client) {
      patch.lastClient = payload.client;
      patch.lastEntityName = payload.client;
      patch.lastEntityType = payload.entityType || 'cliente';
    }

    if (payload.plate) {
      patch.lastPlate = payload.plate;
      patch.lastEntityName = payload.plate;
      patch.lastEntityType = payload.entityType || 'plato';
    }

    if (payload.queryTopic) {
      patch.lastQueryTopic = payload.queryTopic;
    }

    return actualizarContextoConversacionAsistente(patch);
  }

  function esReferenciaGenericaAsistente(referencia) {
    return /^(|lo|la|el|los|las|ese|esa|eso|este|esta|esto|aquello|aquella|mismo|misma|producto|distribuidor|plato|receta|item|registro)$/.test(normalizarTextoAsistente(referencia));
  }

  function buscarModuloAsistente(textoNormalizado) {
    return ASSISTANT_PAGES.find(item => textoIncluyeAlias(textoNormalizado, item.aliases)) || null;
  }

  function buscarAccionAsistente(textoNormalizado) {
    return ASSISTANT_ACTIONS.find(item => textoIncluyeAlias(textoNormalizado, item.aliases)) || null;
  }

  function construirExplicacionModuloAsistente(modulo, modoGuia = false) {
    if (!modulo) {
      const activo = obtenerModuloActivoAsistente();
      if (activo) modulo = activo;
    }
    if (!modulo) {
      return 'No pude identificar la opción que deseas revisar. Puedes preguntarme por Almacén, Distribuidores, Producción Interna, Disponibilidad, Clientes y Puntos, Comandas o Historial de Ventas.';
    }
    if (esModuloRestringidoAsistente(modulo)) {
      return construirRespuestaRestriccionAsistente(modulo).message;
    }
    const base = `${modulo.label}: ${modulo.description}`;
    if (!modoGuia) return base;
    const guia = ASSISTANT_MODULE_GUIDES[modulo.page];
    return guia ? `${base} ${guia}` : base;
  }

  function registrarMensajeAsistente(role, text, options = {}) {
    const { messages } = assistantRefs();
    if (!messages) return;
    if (options.trackActivity !== false) {
      registrarActividadAsistente();
    }
    const wrap = document.createElement('div');
    wrap.className = `luro-assistant-msg ${role === 'user' ? 'is-user' : (role === 'system' ? 'is-system' : 'is-assistant')}`;

    const meta = document.createElement('span');
    meta.className = 'luro-assistant-msg-meta';
    meta.textContent = role === 'user' ? 'Tú' : (role === 'system' ? 'Sistema' : 'LuRo Control');

    const bubble = document.createElement('div');
    bubble.className = 'luro-assistant-bubble';
    bubble.textContent = text;

    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  function sembrarAsistenteSiHaceFalta(trackActivity = false) {
    if (assistantSeeded) return;
    assistantSeeded = true;
    registrarMensajeAsistente('assistant', ASSISTANT_GREETING, { trackActivity });
  }

  function enfocarInputAsistente() {
    const { input } = assistantRefs();
    if (!input) return;
    setTimeout(() => {
      try {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      } catch (_) {}
    }, 60);
  }

  function actualizarEstadoVisualAsistente(abierto) {
    const { panel, fab } = assistantRefs();
    if (panel) {
      panel.classList.toggle('is-open', !!abierto);
      panel.setAttribute('aria-hidden', abierto ? 'false' : 'true');
      if (!abierto) panel.classList.remove('is-minimized');
    }
    if (fab) {
      fab.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    }
  }

  function abrirPanelAsistente() {
    sembrarAsistenteSiHaceFalta();
    registrarActividadAsistente();
    actualizarEstadoVisualAsistente(true);
    if (window.innerWidth <= 900 && typeof window.cerrarSidebarMovil === 'function') {
      window.cerrarSidebarMovil('assistant');
    }
    enfocarInputAsistente();
  }

  function cerrarPanelAsistente() {
    assistantSuggestionPreviewKey = '';
    actualizarEstadoVisualAsistente(false);
  }

  function irAModuloAsistente(modulo) {
    if (!modulo?.page || esModuloRestringidoAsistente(modulo) || typeof window.showPage !== 'function') return;
    window.showPage(modulo.page);
  }

  function responderModulo(modulo, soloExplicacion = false, modoGuia = false) {
    if (!modulo) {
      return {
        message: 'No encontré ese módulo dentro de LuRo Control.',
        role: 'assistant'
      };
    }
    if (esModuloRestringidoAsistente(modulo)) {
      return construirRespuestaRestriccionAsistente(modulo);
    }
    if (soloExplicacion || modoGuia) {
      return {
        message: construirExplicacionModuloAsistente(modulo, modoGuia),
        role: 'assistant'
      };
    }
    return {
      message: `Abriendo ${modulo.label}.`,
      role: 'system',
      actionDelay: 260,
      action: () => irAModuloAsistente(modulo)
    };
  }

  function responderAccion(actionDef, soloExplicacion = false) {
    if (!actionDef) {
      return {
        message: ASSISTANT_UNKNOWN_COMMAND,
        role: 'assistant'
      };
    }
    if (soloExplicacion) {
      return {
        message: actionDef.help,
        role: 'assistant'
      };
    }
    return {
      message: actionDef.response,
      role: 'system',
      actionDelay: 260,
      action: () => actionDef.run()
    };
  }

  function actualizarEstadoModuloComandos(texto) {
    const { state } = comandosRefs();
    if (state) state.textContent = texto || ASSISTANT_HELP;
  }

  const ASSISTANT_TEMPLATE_PLACEHOLDERS = new Set([
    'nombre',
    'contacto',
    'telefono',
    'telefono del distribuidor',
    'distribuidor',
    'producto',
    'ingrediente',
    'cliente',
    'cantidad',
    'unidad',
    'fecha',
    'mesa',
    'numero',
    'número',
    'plato',
    'equipo',
    'equipo o plato'
  ]);

  function normalizarTextoPlantillaAsistente(texto) {
    return String(texto || '').replace(/\[([^\]]+)\]/g, (_, contenido) => {
      const limpio = String(contenido || '').trim();
      return limpio ? limpio : ' ';
    });
  }

  function esPlantillaComandoAsistente(texto) {
    const matches = String(texto || '').match(/\[([^\]]+)\]/g);
    if (!matches) return false;
    return matches.some((token) => {
      const contenido = normalizarTextoAsistente(token.slice(1, -1)).trim();
      return !contenido || ASSISTANT_TEMPLATE_PLACEHOLDERS.has(contenido);
    });
  }

  function prepararTextoComandoAsistente(texto, opciones = {}) {
    const commandText = String(texto || '').trim();
    if (!commandText) return false;
    const { runnerInput } = comandosRefs();
    const { input } = assistantRefs();
    if (runnerInput) runnerInput.value = commandText;
    if (input) input.value = commandText;
    if (opciones.abrirPanel !== false) abrirPanelAsistente();
    if (opciones.enfocar !== false) enfocarInputAsistente();
    return true;
  }

  function prepararComandoDesdeCatalogo(texto) {
    if (!prepararTextoComandoAsistente(texto, { abrirPanel: false, enfocar: false })) return;
    const { runnerInput } = comandosRefs();
    if (runnerInput) {
      setTimeout(() => {
        try {
          runnerInput.focus();
          runnerInput.setSelectionRange(runnerInput.value.length, runnerInput.value.length);
        } catch (_) {}
      }, 40);
    }
    if (esPlantillaComandoAsistente(texto)) {
      actualizarEstadoModuloComandos(`Plantilla preparada: completa los campos y ejecútala. ${texto}`);
      return;
    }
    actualizarEstadoModuloComandos(`Comando preparado: ${texto}`);
  }

  function crearEstadoEditorComandos(section) {
    if (!section) return null;
    return {
      key: obtenerClaveSeccionComandos(section),
      page: section.page || '',
      title: section.title || '',
      description: section.description || '',
      commands: (Array.isArray(section.commands) ? section.commands : []).map((command) => ({
        text: String(command?.text || '').trim(),
        help: String(command?.help || '').trim()
      }))
    };
  }

  function renderEditorComandosModulo() {
    const { editorKey, editorTitle, editorDescription, editorList } = comandosRefs();
    if (!comandosEditorState || !editorList) return;
    if (editorKey) editorKey.value = comandosEditorState.key || '';
    if (editorTitle) editorTitle.value = comandosEditorState.title || '';
    if (editorDescription) editorDescription.value = comandosEditorState.description || '';
    editorList.innerHTML = '';

    comandosEditorState.commands.forEach((command, index) => {
      const item = document.createElement('div');
      item.className = 'comandos-editor-item';

      const head = document.createElement('div');
      head.className = 'comandos-editor-item-head';

      const title = document.createElement('strong');
      title.textContent = `Acción ${index + 1}`;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger comandos-editor-delete-btn';
      deleteBtn.textContent = 'Eliminar';
      deleteBtn.onclick = () => window.eliminarFilaEditorComandoModulo(index);

      head.appendChild(title);
      head.appendChild(deleteBtn);

      const textWrap = document.createElement('label');
      textWrap.className = 'comandos-editor-field';
      const textLabel = document.createElement('span');
      textLabel.textContent = 'Nombre de la acción';
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.value = command.text || '';
      textInput.placeholder = 'Ej. busca [producto]';
      textInput.oninput = (event) => window.actualizarCampoEditorComandoModulo(index, 'text', event.target.value);
      textWrap.appendChild(textLabel);
      textWrap.appendChild(textInput);

      const helpWrap = document.createElement('label');
      helpWrap.className = 'comandos-editor-field';
      const helpLabel = document.createElement('span');
      helpLabel.textContent = 'Qué hace esta acción';
      const helpInput = document.createElement('textarea');
      helpInput.rows = 3;
      helpInput.value = command.help || '';
      helpInput.placeholder = 'Explica qué hace este comando dentro del sistema.';
      helpInput.oninput = (event) => window.actualizarCampoEditorComandoModulo(index, 'help', event.target.value);
      helpWrap.appendChild(helpLabel);
      helpWrap.appendChild(helpInput);

      item.appendChild(head);
      item.appendChild(textWrap);
      item.appendChild(helpWrap);
      editorList.appendChild(item);
    });
  }

  function abrirEditorComandosModulo(sectionKey) {
    const section = buscarSeccionComandosPorKey(sectionKey);
    if (!section) return;
    const { editorModal } = comandosRefs();
    comandosEditorState = crearEstadoEditorComandos(section);
    renderEditorComandosModulo();
    if (editorModal) {
      editorModal.style.display = 'flex';
      editorModal.setAttribute('aria-hidden', 'false');
    }
  }

  function cerrarEditorComandosModulo() {
    const { editorModal } = comandosRefs();
    if (editorModal) {
      editorModal.style.display = 'none';
      editorModal.setAttribute('aria-hidden', 'true');
    }
    comandosEditorState = null;
  }

  function sincronizarCabeceraEditorComandos() {
    const { editorTitle, editorDescription } = comandosRefs();
    if (!comandosEditorState) return;
    if (editorTitle) comandosEditorState.title = String(editorTitle.value || '').trim();
    if (editorDescription) comandosEditorState.description = String(editorDescription.value || '').trim();
  }

  function guardarEditorComandosModulo() {
    sincronizarCabeceraEditorComandos();
    if (!comandosEditorState) return;
    const commands = (Array.isArray(comandosEditorState.commands) ? comandosEditorState.commands : [])
      .map((command) => ({
        text: String(command?.text || '').trim(),
        help: String(command?.help || '').trim()
      }))
      .filter((command) => command.text);
    if (!commands.length) {
      actualizarEstadoModuloComandos('Debes dejar al menos una acción en la tarjeta antes de guardar.');
      return;
    }
    const overrides = obtenerOverridesComandosAsistente();
    overrides[comandosEditorState.key] = {
      title: comandosEditorState.title,
      description: comandosEditorState.description,
      commands
    };
    guardarOverridesComandosAsistente(overrides);
    cerrarEditorComandosModulo();
    renderModuloComandos();
    renderSugerenciasAsistente();
    actualizarEstadoModuloComandos('Tarjeta de comandos actualizada correctamente.');
  }

  function restaurarEditorComandosModulo() {
    if (!comandosEditorState?.key) return;
    const baseSection = buscarSeccionComandosPorKey(comandosEditorState.key, obtenerCatalogoBaseComandosSistema());
    if (!baseSection) return;
    const overrides = obtenerOverridesComandosAsistente();
    delete overrides[comandosEditorState.key];
    guardarOverridesComandosAsistente(overrides);
    comandosEditorState = crearEstadoEditorComandos(baseSection);
    renderEditorComandosModulo();
    renderModuloComandos();
    renderSugerenciasAsistente();
    actualizarEstadoModuloComandos('Restauré la tarjeta a su configuración original.');
  }

  function construirClaveFiltroComandos(section) {
    return normalizarTextoAsistente([
      section.title,
      section.description,
      ...(Array.isArray(section.commands) ? section.commands.flatMap((command) => [command?.text || '', command?.help || '']) : [])
    ].join(' '));
  }

  function renderModuloComandos() {
    const { search, summary, list } = comandosRefs();
    if (!list) return;

    const filtro = normalizarTextoAsistente(search?.value || '');
    const sugerenciasActivas = new Set(obtenerClavesSugerenciasActivasAsistente());
    const sections = obtenerCatalogoComandosSistema().filter((section) => {
      if (!filtro) return true;
      return construirClaveFiltroComandos(section).includes(filtro);
    });

    list.innerHTML = '';

    if (summary) {
      const totalComandos = sections.reduce((acc, section) => acc + (section.commands?.length || 0), 0);
      summary.textContent = `${sections.length} módulos visibles · ${totalComandos} comandos listados · ${sugerenciasActivas.size} accesos activos en el asistente. Pulsa un comando para prepararlo, ejecútalo o marca la tarjeta para mostrarla arriba en el panel.`;
    }

    if (!sections.length) {
      const empty = document.createElement('div');
      empty.className = 'comandos-module-empty';
      empty.textContent = 'No encontré comandos con ese filtro.';
      list.appendChild(empty);
      return;
    }

    sections.forEach((section) => {
      const card = document.createElement('article');
      card.className = 'comandos-module-section';
      card.dataset.sectionKey = obtenerClaveSeccionComandos(section);

      const head = document.createElement('div');
      head.className = 'comandos-module-section-head';

      const headTop = document.createElement('div');
      headTop.className = 'comandos-module-section-top';

      const headCopy = document.createElement('div');
      headCopy.className = 'comandos-module-section-copy';

      const title = document.createElement('strong');
      title.textContent = section.title;

      const description = document.createElement('p');
      description.textContent = section.description;

      const suggestion = obtenerConfigSugerenciaSeccion(section);
      const toggle = document.createElement('label');
      toggle.className = 'comandos-module-suggestion-toggle';
      toggle.title = 'Mostrar esta tarjeta dentro de las sugerencias rápidas del asistente';

      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = sugerenciasActivas.has(suggestion.key);
      toggleInput.setAttribute('aria-label', `Mostrar ${section.title} en las sugerencias del asistente`);
      toggleInput.onchange = () => window.toggleSugerenciaComandoModulo(suggestion.key, toggleInput.checked);

      const toggleUi = document.createElement('span');
      toggleUi.className = 'comandos-module-suggestion-toggle-ui';

      const toggleCopy = document.createElement('span');
      toggleCopy.className = 'comandos-module-suggestion-toggle-copy';
      toggleCopy.textContent = 'Sugerencia';

      const sectionTools = document.createElement('div');
      sectionTools.className = 'comandos-module-section-tools';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn comandos-module-edit-btn';
      editBtn.setAttribute('aria-label', `Editar ${section.title}`);
      editBtn.title = 'Editar título, descripción y acciones de esta tarjeta';
      editBtn.textContent = '✏️ Editar';
      editBtn.onclick = () => window.abrirEditorComandosModulo(obtenerClaveSeccionComandos(section));

      const commandsWrap = document.createElement('div');
      commandsWrap.className = 'comandos-module-command-list';

      (section.commands || []).forEach((command) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'comandos-module-command';
        btn.textContent = command.text;
        if (command.help) btn.title = command.help;
        btn.onclick = () => prepararComandoDesdeCatalogo(command.text);
        commandsWrap.appendChild(btn);
      });

      headCopy.appendChild(title);
      toggle.appendChild(toggleInput);
      toggle.appendChild(toggleUi);
      toggle.appendChild(toggleCopy);
      sectionTools.appendChild(editBtn);
      sectionTools.appendChild(toggle);
      headTop.appendChild(headCopy);
      headTop.appendChild(sectionTools);
      head.appendChild(headTop);
      head.appendChild(description);
      card.appendChild(head);
      card.appendChild(commandsWrap);
      list.appendChild(card);
    });
  }

  function obtenerItemsAlmacenAsistente() {
    if (!sesionUser?.user) return [];
    return (db.almacen || []).filter(item => itemPerteneceContextoAsistente(item));
  }

  function obtenerDistribuidoresAsistente() {
    if (typeof obtenerDistribuidoresActuales === 'function') {
      return obtenerDistribuidoresActuales();
    }
    if (!sesionUser?.user) return [];
    return (db.distribuidores || []).filter(item => itemPerteneceContextoAsistente(item));
  }

  function obtenerProduccionesAsistente() {
    if (!sesionUser?.user) return [];
    return (db.produccion_stock || []).filter(item => itemPerteneceContextoAsistente(item));
  }

  function obtenerPlatosAsistente() {
    if (!sesionUser?.user) return [];
    return (db.platos || []).filter(item => itemPerteneceContextoAsistente(item));
  }

  function obtenerCatalogoDistribuidoresAsistente() {
    if (typeof obtenerCatalogoDistribuidoresActual === 'function') {
      return obtenerCatalogoDistribuidoresActual();
    }
    if (!sesionUser?.user) return [];
    return (db.catalogoDistribuidores || []).filter(item => itemPerteneceContextoAsistente(item));
  }

  function obtenerClientesAsistente() {
    return Array.isArray(db.clientesFidelizacion) ? db.clientesFidelizacion : [];
  }

  function obtenerTsAsistente(registro) {
    if (!registro) return 0;
    if (typeof obtenerTsRegistro === 'function') {
      const ts = Number(obtenerTsRegistro(registro) || 0);
      if (Number.isFinite(ts) && ts > 0) return ts;
    }
    const tsDirecto = Number(registro.ts || 0);
    if (Number.isFinite(tsDirecto) && tsDirecto > 0) return tsDirecto;
    if (typeof parseFechaRegistro === 'function') {
      const parsed = parseFechaRegistro(registro.fecha);
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
    const parsed = new Date(registro.fecha || registro.createdAt || registro.updatedAt || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function mismoDiaAsistente(ts, offsetDays = 0) {
    const fecha = new Date(ts || 0);
    if (Number.isNaN(fecha.getTime())) return false;
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + offsetDays);
    const limite = new Date(base);
    limite.setDate(limite.getDate() + 1);
    return fecha >= base && fecha < limite;
  }

  function obtenerVentasAsistente(options = {}) {
    const useDateFilters = options.useDateFilters === true;
    return (db.ventas || []).filter((venta) => {
      if (!sesionUser?.user) return false;
      if (venta.owner !== sesionUser.user) return false;
      if (typeof moduloPerteneceVista === 'function' && !moduloPerteneceVista(venta.modulo)) return false;
      if (options.currentModuleOnly && venta.modulo !== moduloActual) return false;
      if (useDateFilters && typeof fechaDentroRango === 'function' && !fechaDentroRango(venta.fecha, 'filtro-ventas-desde', 'filtro-ventas-hasta')) return false;
      const ts = obtenerTsAsistente(venta);
      if (options.todayOnly && !mismoDiaAsistente(ts, 0)) return false;
      if (options.yesterdayOnly && !mismoDiaAsistente(ts, -1)) return false;
      return true;
    });
  }

  function obtenerFacturasAsistente(options = {}) {
    const useDateFilters = options.useDateFilters === true;
    return (db.facturasResumen || []).filter((factura) => {
      if (!sesionUser?.user) return false;
      if ((factura.owner || '') !== sesionUser.user) return false;
      if (typeof moduloPerteneceVista === 'function' && !moduloPerteneceVista(factura.modulo)) return false;
      if (options.currentModuleOnly && factura.modulo !== moduloActual) return false;
      if (useDateFilters && typeof fechaDentroRango === 'function' && !fechaDentroRango(factura.fecha, 'filtro-rnc-desde', 'filtro-rnc-hasta')) return false;
      const ts = obtenerTsAsistente(factura);
      if (options.todayOnly && !mismoDiaAsistente(ts, 0)) return false;
      if (options.yesterdayOnly && !mismoDiaAsistente(ts, -1)) return false;
      return true;
    });
  }

  function construirMapaVentasPlatosAsistente(options = {}) {
    const mapa = new Map();
    const facturas = obtenerFacturasAsistente(options);
    if (facturas.length) {
      facturas.forEach((factura) => {
        (Array.isArray(factura.items) ? factura.items : []).forEach((item) => {
          const nombre = capitalizarTextoAsistente(item?.nombre || '');
          if (!nombre) return;
          const actual = mapa.get(nombre) || { nombre, cantidad: 0, total: 0, ganancia: 0 };
          const cantidad = Number(item?.cantidad || 0);
          const subtotal = Number(item?.subtotal || ((item?.precio || 0) * cantidad) || 0);
          actual.cantidad += cantidad;
          actual.total += subtotal;
          mapa.set(nombre, actual);
        });
      });
    } else {
      obtenerVentasAsistente(options).forEach((venta) => {
        const nombre = capitalizarTextoAsistente(venta?.plato || '');
        if (!nombre) return;
        const actual = mapa.get(nombre) || { nombre, cantidad: 0, total: 0, ganancia: 0 };
        actual.cantidad += Number(venta?.cantidad || 0);
        actual.total += Number(venta?.totalVenta || 0);
        actual.ganancia += Number(venta?.ganancia || 0);
        mapa.set(nombre, actual);
      });
    }
    return Array.from(mapa.values()).sort((a, b) => b.cantidad - a.cantidad || b.total - a.total);
  }

  function obtenerProductosBajoIdealAsistente() {
    return obtenerItemsAlmacenAsistente()
      .map((item) => {
        const actual = Number(item.actual || 0);
        const ideal = Number(item.ideal || 0);
        const faltante = Math.max(0, ideal - actual);
        const ratio = ideal > 0 ? actual / ideal : (actual > 0 ? 1 : 0);
        return { ...item, actual, ideal, faltante, ratio };
      })
      .filter((item) => item.ideal > 0 && item.actual < item.ideal)
      .sort((a, b) => b.faltante - a.faltante || a.ratio - b.ratio);
  }

  function obtenerProductoMasCriticoAsistente() {
    return obtenerProductosBajoIdealAsistente()[0] || null;
  }

  function calcularGananciaPorPlatoAsistente() {
    const mapa = new Map();
    obtenerVentasAsistente().forEach((venta) => {
      const nombre = capitalizarTextoAsistente(venta?.plato || '');
      if (!nombre) return;
      const actual = mapa.get(nombre) || { nombre, cantidad: 0, ganancia: 0, total: 0 };
      actual.cantidad += Number(venta?.cantidad || 0);
      actual.ganancia += Number(venta?.ganancia || 0);
      actual.total += Number(venta?.totalVenta || 0);
      mapa.set(nombre, actual);
    });
    return Array.from(mapa.values()).sort((a, b) => b.ganancia - a.ganancia || b.cantidad - a.cantidad);
  }

  function construirDetalleProduccionAsistente(prod) {
    if (!prod) return null;
    const ownerActivo = obtenerOwnerAsistente();
    const detalle = {
      produccion: prod,
      ingredientes: [],
      faltantes: [],
      capacidad: 0,
      costoReposicion: 0
    };
    const capacidades = [];
    const receta = Array.isArray(prod.receta) ? prod.receta : [];
    receta.forEach((ing) => {
      const alm = (db.almacen || []).find((item) =>
        normalizarTextoAsistente(item.nombre) === normalizarTextoAsistente(ing.nombre) &&
        String(item.owner || '').trim().toLowerCase() === ownerActivo &&
        item.modulo === prod.modulo
      );
      const unidadBase = alm?.unidad || ing.unidad || '';
      let requerida = Number(ing.cantidad || 0);
      if (alm && typeof convertirUnidad === 'function') {
        try {
          requerida = convertirUnidad(Number(ing.cantidad || 0), ing.unidad, unidadBase);
        } catch (_) {}
      }
      const actual = Number(alm?.actual || 0);
      const costoUnitario = Number(alm?.costoUnitario || 0);
      const faltante = Math.max(0, requerida - actual);
      if (requerida > 0) {
        capacidades.push(Math.floor(actual / requerida));
      }
      detalle.ingredientes.push({
        nombre: capitalizarTextoAsistente(ing.nombre),
        requerida,
        actual,
        unidad: unidadBase || ing.unidad || ''
      });
      if (faltante > 0.0001) {
        const costo = faltante * costoUnitario;
        detalle.faltantes.push({
          nombre: capitalizarTextoAsistente(ing.nombre),
          faltante,
          unidad: unidadBase || ing.unidad || '',
          costo
        });
        detalle.costoReposicion += costo;
      }
    });
    detalle.capacidad = capacidades.length ? Math.max(0, Math.min(...capacidades)) : 0;
    return detalle;
  }

  function obtenerIngredienteMasUsadoAsistente() {
    const mapa = new Map();
    const registrar = (ing, fuente) => {
      const clave = normalizarTextoAsistente(ing?.nombre || '');
      if (!clave) return;
      const actual = mapa.get(clave) || {
        nombre: capitalizarTextoAsistente(ing.nombre),
        cantidad: 0,
        unidad: ing.unidad || '',
        veces: 0,
        fuentes: new Set()
      };
      actual.cantidad += Number(ing?.cantidad || 0);
      actual.veces += 1;
      if (!actual.unidad) actual.unidad = ing.unidad || '';
      actual.fuentes.add(fuente);
      mapa.set(clave, actual);
    };

    obtenerPlatosAsistente().forEach((plato) => {
      (Array.isArray(plato.receta) ? plato.receta : []).forEach((ing) => registrar(ing, 'plato'));
    });
    obtenerProduccionesAsistente().forEach((prod) => {
      (Array.isArray(prod.receta) ? prod.receta : []).forEach((ing) => registrar(ing, 'produccion'));
    });

    return Array.from(mapa.values())
      .map((item) => ({ ...item, fuentes: Array.from(item.fuentes) }))
      .sort((a, b) => b.veces - a.veces || b.cantidad - a.cantidad)[0] || null;
  }

  function obtenerIngredientesFaltantesPlatoAsistente(plato) {
    if (!plato || !Array.isArray(plato.receta)) return [];
    const ownerActivo = obtenerOwnerAsistente();
    return plato.receta.map((ing) => {
      const itemStock = (db.almacen || []).find(a =>
        String(a.nombre || '').trim().toLowerCase() === String(ing.nombre || '').trim().toLowerCase() &&
        String(a.owner || '').trim().toLowerCase() === ownerActivo &&
        a.modulo === moduloActual
      ) || (db.produccion_stock || []).find(p =>
        String(p.nombre || '').trim().toLowerCase() === String(ing.nombre || '').trim().toLowerCase() &&
        String(p.owner || '').trim().toLowerCase() === ownerActivo &&
        p.modulo === moduloActual
      );

      let requerido = Number(ing.cantidad || 0);
      let unidad = ing.unidad || '';
      let actual = 0;
      if (itemStock) {
        unidad = itemStock.unidad || unidad;
        actual = Number(itemStock.actual || 0);
        if (typeof convertirUnidad === 'function') {
          try {
            requerido = convertirUnidad(Number(ing.cantidad || 0), ing.unidad, unidad);
          } catch (_) {}
        }
      }
      const faltante = Math.max(0, requerido - actual);
      return {
        nombre: capitalizarTextoAsistente(ing.nombre),
        unidad,
        requerido,
        actual,
        faltante
      };
    }).filter((item) => item.faltante > 0.0001);
  }

  function obtenerPlatosBloqueadosAsistente() {
    return obtenerPlatosAsistente()
      .map((plato) => ({ plato, faltantes: obtenerIngredientesFaltantesPlatoAsistente(plato) }))
      .filter((entry) => entry.faltantes.length > 0)
      .sort((a, b) => b.faltantes.length - a.faltantes.length || a.plato.nombre.localeCompare(b.plato.nombre));
  }

  function obtenerProduccionesBajasAsistente() {
    return obtenerProduccionesAsistente()
      .map((item) => {
        const actual = Number(item.actual || 0);
        const ideal = Number(item.ideal || 0);
        const faltante = Math.max(0, ideal - actual);
        return { ...item, actual, ideal, faltante };
      })
      .filter((item) => item.actual <= 0 || (item.ideal > 0 && item.actual < item.ideal))
      .sort((a, b) => b.faltante - a.faltante || a.actual - b.actual);
  }

  function resolverClienteAsistente(referencia) {
    const consulta = limpiarNombreEntidadAsistente(referencia || obtenerReferenciaDesdeContextoAsistente('cliente'));
    if (!consulta) return { query: '', match: null, matches: [], ambiguous: false };
    const objetivo = normalizarTextoAsistente(consulta);
    const resultados = obtenerClientesAsistente().map((cliente) => {
      const nombre = normalizarTextoAsistente(cliente.nombre);
      const cedula = normalizarTextoAsistente(cliente.cedula);
      const telefono = normalizarTextoAsistente(cliente.telefono);
      let score = 0;
      if (nombre === objetivo || cedula === objetivo || telefono === objetivo) {
        score = 500;
      } else if (nombre.includes(objetivo) || objetivo.includes(nombre)) {
        score = 280;
      } else if (cedula.includes(objetivo) || telefono.includes(objetivo)) {
        score = 240;
      } else {
        const distance = distanciaLevenshteinAsistente(nombre.replace(/\s+/g, ''), objetivo.replace(/\s+/g, ''));
        const maxLen = Math.max(nombre.replace(/\s+/g, '').length, objetivo.replace(/\s+/g, '').length, 1);
        const similarity = 1 - (distance / maxLen);
        if (similarity >= 0.62) score = Math.round(similarity * 150);
      }
      return { cliente, score, nombre: cliente.nombre };
    }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || String(a.nombre).localeCompare(String(b.nombre)));

    return {
      query: consulta,
      match: resultados[0]?.cliente || null,
      matches: resultados.slice(0, 4).map((entry) => entry.cliente),
      ambiguous: !!(resultados[1] && Math.abs(resultados[0].score - resultados[1].score) < 55)
    };
  }

  function calcularGananciaTotalAsistente() {
    if (!Array.isArray(db?.ventas) || !sesionUser?.user) return null;
    const total = db.ventas
      .filter((venta) => {
        if (venta.owner !== sesionUser.user) return false;
        if (typeof moduloPerteneceVista === 'function' && !moduloPerteneceVista(venta.modulo)) return false;
        if (typeof fechaDentroRango === 'function' && !fechaDentroRango(venta.fecha, 'filtro-ventas-desde', 'filtro-ventas-hasta')) return false;
        return true;
      })
      .reduce((acc, venta) => acc + (Number(venta.ganancia) || 0), 0);
    return total;
  }

  function calcularPerdidaTotalAsistente() {
    if (!Array.isArray(db?.decomisos) || !sesionUser?.user) return null;
    const total = db.decomisos
      .filter((registro) => {
        if (registro.owner !== sesionUser.user) return false;
        if (typeof moduloPerteneceVista === 'function' && !moduloPerteneceVista(registro.modulo)) return false;
        if (typeof fechaDentroRango === 'function' && !fechaDentroRango(registro.fecha, 'filtro-decomiso-desde', 'filtro-decomiso-hasta')) return false;
        return true;
      })
      .reduce((acc, registro) => acc + (Number(registro.perdida) || 0), 0);
    return total;
  }

  function obtenerDatoVentasAsistente(intencion) {
    if (!intencion) return null;
    if (intencion.topic === 'ganancias-total') {
      const modulo = resolverModuloAsistente(intencion);
      try {
        if (typeof renderHistorialVentas === 'function') {
          renderHistorialVentas();
        } else if (modulo?.page === 'ventas' && typeof window.showPage === 'function') {
          window.showPage('ventas');
        }
      } catch (_) {}

      const domRaw = leerValorDOMAsistente('#total-ganancias-cuadro');
      const domValue = extraerMontoDesdeTextoAsistente(domRaw);
      if (Number.isFinite(domValue)) {
        return {
          source: 'dom',
          selector: '#total-ganancias-cuadro',
          label: 'total de ganancias',
          raw: domRaw,
          value: domValue,
          module: modulo?.page || 'ventas'
        };
      }

      const calculated = calcularGananciaTotalAsistente();
      if (Number.isFinite(calculated)) {
        return {
          source: 'db',
          label: 'total de ganancias',
          value: calculated,
          module: modulo?.page || 'ventas'
        };
      }
      return { topic: intencion.topic, reason: 'not-found' };
    }

    if (intencion.topic === 'ventas-total-hoy') {
      const facturasHoy = obtenerFacturasAsistente({ todayOnly: true });
      const totalFacturas = facturasHoy.reduce((acc, factura) => acc + Number(factura.total || 0), 0);
      if (facturasHoy.length) {
        return {
          topic: intencion.topic,
          source: 'facturas',
          count: facturasHoy.length,
          value: totalFacturas
        };
      }
      const ventasHoy = obtenerVentasAsistente({ todayOnly: true });
      return {
        topic: intencion.topic,
        source: 'ventas',
        count: ventasHoy.length,
        value: ventasHoy.reduce((acc, venta) => acc + Number(venta.totalVenta || 0), 0)
      };
    }

    if (intencion.topic === 'ventas-top-product' || intencion.topic === 'ventas-low-product') {
      const ranking = construirMapaVentasPlatosAsistente();
      if (!ranking.length) return { topic: intencion.topic, reason: 'not-found' };
      const entry = intencion.topic === 'ventas-low-product'
        ? [...ranking].filter(item => item.cantidad > 0).sort((a, b) => a.cantidad - b.cantidad || a.total - b.total)[0]
        : ranking[0];
      return {
        topic: intencion.topic,
        entry: entry || null
      };
    }

    if (intencion.topic === 'plato-mas-ganancia') {
      const ranking = calcularGananciaPorPlatoAsistente();
      return ranking.length
        ? { topic: intencion.topic, entry: ranking[0] }
        : { topic: intencion.topic, reason: 'not-found' };
    }

    return null;
  }

  function obtenerDatoDecomisosAsistente(intencion) {
    if (!intencion) return null;
    if (intencion.topic === 'perdidas-total') {
      const modulo = resolverModuloAsistente(intencion);
      try {
        if (typeof renderHistorialDecomiso === 'function') {
          renderHistorialDecomiso();
        } else if (modulo?.page === 'historial-decomiso' && typeof window.showPage === 'function') {
          window.showPage('historial-decomiso');
        }
      } catch (_) {}

      const domRaw = leerValorDOMAsistente('#total-perdidas-cuadro');
      const domValue = extraerMontoDesdeTextoAsistente(domRaw);
      if (Number.isFinite(domValue)) {
        return {
          source: 'dom',
          selector: '#total-perdidas-cuadro',
          label: 'total de perdidas',
          raw: domRaw,
          value: domValue,
          module: modulo?.page || 'historial-decomiso'
        };
      }

      const calculated = calcularPerdidaTotalAsistente();
      if (Number.isFinite(calculated)) {
        return {
          source: 'db',
          label: 'total de perdidas',
          value: calculated,
          module: modulo?.page || 'historial-decomiso'
        };
      }

      return { topic: intencion.topic, reason: 'not-found' };
    }

    return null;
  }

  function obtenerDatoFacturacionAsistente(intencion) {
    if (!intencion) return null;
    const facturas = obtenerFacturasAsistente();
    if (intencion.topic === 'facturas-hoy') {
      const hoy = obtenerFacturasAsistente({ todayOnly: true });
      return {
        topic: intencion.topic,
        count: hoy.length,
        value: hoy.reduce((acc, factura) => acc + Number(factura.total || 0), 0),
        facturas: hoy
      };
    }
    if (intencion.topic === 'facturacion-total') {
      return {
        topic: intencion.topic,
        count: facturas.length,
        value: facturas.reduce((acc, factura) => acc + Number(factura.total || 0), 0)
      };
    }
    if (intencion.topic === 'factura-mas-alta') {
      const highest = [...facturas].sort((a, b) => Number(b.total || 0) - Number(a.total || 0))[0] || null;
      return highest ? { topic: intencion.topic, factura: highest } : { topic: intencion.topic, reason: 'not-found' };
    }
    if (intencion.topic === 'factura-por-cliente') {
      const reference = limpiarNombreEntidadAsistente(intencion.reference);
      if (!reference) return { topic: intencion.topic, reason: 'missing-reference' };
      const target = normalizarTextoAsistente(reference);
      const coincidencias = facturas.filter((factura) => {
        const nombre = normalizarTextoAsistente(factura.nombre);
        const rnc = normalizarTextoAsistente(factura.rnc);
        const codigo = normalizarTextoAsistente(factura.codigo);
        return nombre.includes(target) || target.includes(nombre) || rnc.includes(target) || codigo.includes(target);
      });
      return coincidencias.length
        ? { topic: intencion.topic, reference, facturas: coincidencias }
        : { topic: intencion.topic, reference, reason: 'not-found' };
    }
    return null;
  }

  function obtenerDatoAlmacenAsistente(intencion) {
    if (!intencion) return null;
    if (intencion.topic === 'almacen-restante' || intencion.topic === 'almacen-buscar') {
      const resolucion = resolverReferenciaAmbiguaAsistente(intencion.reference, 'almacen');
      if (!resolucion.query) return { topic: intencion.topic, reason: 'missing-reference' };
      if (!resolucion.entity) return { topic: intencion.topic, reason: 'not-found', reference: resolucion.query };
      if (resolucion.ambiguous) return { topic: intencion.topic, reason: 'ambiguous', matches: resolucion.matches, reference: resolucion.query };
      return {
        topic: intencion.topic,
        item: resolucion.entity.item,
        entity: resolucion.entity
      };
    }
    if (intencion.topic === 'almacen-bajo-ideal') {
      return {
        topic: intencion.topic,
        items: obtenerProductosBajoIdealAsistente()
      };
    }
    if (intencion.topic === 'almacen-mas-critico') {
      return {
        topic: intencion.topic,
        item: obtenerProductoMasCriticoAsistente()
      };
    }
    return null;
  }

  function obtenerDatoDistribuidoresAsistente(intencion) {
    if (!intencion) return null;
    if (intencion.topic === 'distribuidor-productos' || intencion.topic === 'distribuidor-faltantes') {
      const resolucion = resolverReferenciaAmbiguaAsistente(intencion.reference, 'distribuidor');
      if (!resolucion.query && !obtenerReferenciaDesdeContextoAsistente('distribuidor')) {
        return { topic: intencion.topic, reason: 'missing-reference' };
      }
      if (!resolucion.entity) return { topic: intencion.topic, reason: 'not-found', reference: resolucion.query };
      if (resolucion.ambiguous) return { topic: intencion.topic, reason: 'ambiguous', matches: resolucion.matches, reference: resolucion.query };
      const distribuidor = resolucion.entity.item;
      const productos = obtenerCatalogoDistribuidoresAsistente().filter(item => item.distId === distribuidor.id);
      if (intencion.topic === 'distribuidor-faltantes') {
        const faltantes = productos
          .map((item) => ({ item, faltante: obtenerFaltanteProductoCatalogo(item) }))
          .filter((entry) => Number(entry.faltante.cantidad || 0) > 0);
        return { topic: intencion.topic, distribuidor, productos, faltantes };
      }
      return { topic: intencion.topic, distribuidor, productos };
    }
    if (intencion.topic === 'distribuidor-vende-producto') {
      const referencia = limpiarNombreEntidadAsistente(intencion.reference);
      if (!referencia) return { topic: intencion.topic, reason: 'missing-reference' };
      const objetivo = normalizarTextoAsistente(referencia);
      const coincidencias = obtenerCatalogoDistribuidoresAsistente().filter((item) => {
        const nombre = normalizarTextoAsistente(item.nombreProducto);
        return nombre.includes(objetivo) || objetivo.includes(nombre);
      });
      if (!coincidencias.length) return { topic: intencion.topic, reference: referencia, reason: 'not-found' };
      const agrupado = Array.from(new Map(coincidencias.map(item => [item.distId, item])).values());
      return { topic: intencion.topic, reference: referencia, proveedores: agrupado, coincidencias };
    }
    if (intencion.topic === 'distribuidor-pedido') {
      const resolucion = resolverReferenciaAmbiguaAsistente(intencion.reference, 'distribuidor');
      if (!resolucion.query && !obtenerReferenciaDesdeContextoAsistente('distribuidor')) {
        return { topic: intencion.topic, reason: 'missing-reference' };
      }
      if (!resolucion.entity) return { topic: intencion.topic, reason: 'not-found', reference: resolucion.query };
      if (resolucion.ambiguous) return { topic: intencion.topic, reason: 'ambiguous', matches: resolucion.matches, reference: resolucion.query };
      const distribuidor = resolucion.entity.item;
      const productos = obtenerCatalogoDistribuidoresAsistente().filter(item => item.distId === distribuidor.id);
      const faltantes = productos
        .map((item) => ({ item, faltante: obtenerFaltanteProductoCatalogo(item) }))
        .filter((entry) => Number(entry.faltante.cantidad || 0) > 0);
      return { topic: intencion.topic, distribuidor, productos, faltantes };
    }
    return null;
  }

  function obtenerDatoClientesAsistente(intencion) {
    if (!intencion) return null;
    if (intencion.topic === 'clientes-puntos' || intencion.topic === 'clientes-buscar') {
      const resolucion = resolverClienteAsistente(intencion.reference);
      if (!resolucion.query) return { topic: intencion.topic, reason: 'missing-reference' };
      if (!resolucion.match) return { topic: intencion.topic, reason: 'not-found', reference: resolucion.query };
      if (resolucion.ambiguous) return { topic: intencion.topic, reason: 'ambiguous', matches: resolucion.matches, reference: resolucion.query };
      return { topic: intencion.topic, cliente: resolucion.match };
    }
    if (intencion.topic === 'clientes-top-puntos') {
      const cliente = [...obtenerClientesAsistente()].sort((a, b) => Number(b.puntos || 0) - Number(a.puntos || 0))[0] || null;
      return cliente ? { topic: intencion.topic, cliente } : { topic: intencion.topic, reason: 'not-found' };
    }
    if (intencion.topic === 'clientes-top-compra') {
      const cliente = [...obtenerClientesAsistente()].sort((a, b) => Number(b.totalAcumulado || 0) - Number(a.totalAcumulado || 0))[0] || null;
      return cliente ? { topic: intencion.topic, cliente } : { topic: intencion.topic, reason: 'not-found' };
    }
    return null;
  }

  function obtenerDatoDisponibilidadAsistente(intencion) {
    if (!intencion) return null;
    if (intencion.topic === 'plato-faltantes') {
      const resolucion = resolverReferenciaAmbiguaAsistente(intencion.reference, 'plato');
      if (!resolucion.query) return { topic: intencion.topic, reason: 'missing-reference' };
      if (!resolucion.entity) return { topic: intencion.topic, reason: 'not-found', reference: resolucion.query };
      if (resolucion.ambiguous) return { topic: intencion.topic, reason: 'ambiguous', matches: resolucion.matches, reference: resolucion.query };
      return {
        topic: intencion.topic,
        plato: resolucion.entity.item,
        faltantes: obtenerIngredientesFaltantesPlatoAsistente(resolucion.entity.item)
      };
    }
    if (intencion.topic === 'platos-bloqueados') {
      return {
        topic: intencion.topic,
        platos: obtenerPlatosBloqueadosAsistente()
      };
    }
    if (intencion.topic === 'produccion-recomendada') {
      return {
        topic: intencion.topic,
        items: obtenerProduccionesBajasAsistente()
      };
    }
    if (intencion.topic === 'plato-consume-ingrediente') {
      const ingrediente = limpiarNombreEntidadAsistente(intencion.reference);
      if (!ingrediente) return { topic: intencion.topic, reason: 'missing-reference' };
      const objetivo = normalizarTextoAsistente(ingrediente);
      const ranking = obtenerPlatosAsistente().map((plato) => {
        let total = 0;
        let unidad = '';
        (Array.isArray(plato.receta) ? plato.receta : []).forEach((ing) => {
          const nombreIng = normalizarTextoAsistente(ing.nombre);
          if (!(nombreIng.includes(objetivo) || objetivo.includes(nombreIng))) return;
          total += Number(ing.cantidad || 0);
          unidad = ing.unidad || unidad;
        });
        return { plato, total, unidad };
      }).filter((entry) => entry.total > 0).sort((a, b) => b.total - a.total);
      return ranking.length
        ? { topic: intencion.topic, ingrediente, entry: ranking[0] }
        : { topic: intencion.topic, ingrediente, reason: 'not-found' };
    }
    if (intencion.topic === 'ingrediente-mas-usado') {
      const entry = obtenerIngredienteMasUsadoAsistente();
      return entry ? { topic: intencion.topic, entry } : { topic: intencion.topic, reason: 'not-found' };
    }
    return null;
  }

  function obtenerDatoProduccionAsistente(intencion) {
    if (!intencion) return null;
    if (intencion.topic === 'produccion-recomendada') {
      return {
        topic: intencion.topic,
        items: obtenerProduccionesBajasAsistente()
      };
    }
    if (intencion.topic === 'produccion-listado') {
      return {
        topic: intencion.topic,
        items: obtenerProduccionesAsistente().sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')))
      };
    }
    if (intencion.topic === 'produccion-composicion' || intencion.topic === 'produccion-faltantes') {
      const resolucion = resolverReferenciaAmbiguaAsistente(intencion.reference, 'produccion');
      if (!resolucion.query && !obtenerReferenciaDesdeContextoAsistente('produccion')) {
        return { topic: intencion.topic, reason: 'missing-reference' };
      }
      if (!resolucion.entity) return { topic: intencion.topic, reason: 'not-found', reference: resolucion.query };
      if (resolucion.ambiguous) return { topic: intencion.topic, reason: 'ambiguous', matches: resolucion.matches, reference: resolucion.query };
      return {
        topic: intencion.topic,
        entity: resolucion.entity,
        detalle: construirDetalleProduccionAsistente(resolucion.entity.item)
      };
    }
    return null;
  }

  function obtenerDatoSistemaAsistente(intencion) {
    if (!intencion) return null;
    if (intencion.kind !== 'system-query') return null;
    const modulo = resolverModuloAsistente(intencion);
    let dato = null;
    if (modulo?.page === 'ventas') dato = obtenerDatoVentasAsistente(intencion);
    if (!dato && modulo?.page === 'produccion-interna') dato = obtenerDatoProduccionAsistente(intencion);
    if (!dato && modulo?.page === 'historial-decomiso') dato = obtenerDatoDecomisosAsistente(intencion);
    if (!dato && modulo?.page === 'rnc-dgii') dato = obtenerDatoFacturacionAsistente(intencion);
    if (!dato && modulo?.page === 'inventario') dato = obtenerDatoAlmacenAsistente(intencion);
    if (!dato && modulo?.page === 'distribuidores') dato = obtenerDatoDistribuidoresAsistente(intencion);
    if (!dato && modulo?.page === 'clientes-puntos') dato = obtenerDatoClientesAsistente(intencion);
    if (!dato && (modulo?.page === 'disponibilidad' || modulo?.page === 'produccion-interna')) dato = obtenerDatoDisponibilidadAsistente(intencion);
    registrarDebugAsistente('system-query:data', { intent: intencion, module: modulo?.page || '', data: dato });
    if (dato) return dato;
    return null;
  }

  function listarCoincidenciasAsistente(items, consulta, getLabel) {
    const objetivo = limpiarNombreEntidadAsistente(consulta);
    if (!objetivo) {
      return { query: '', scored: [], matches: [] };
    }
    const objetivoNormalizado = normalizarTextoAsistente(objetivo);
    const objetivoCompacto = objetivoNormalizado.replace(/\s+/g, '');
    const puntuadas = items.map(item => {
      const nombre = normalizarTextoAsistente(getLabel(item));
      const nombreCompacto = nombre.replace(/\s+/g, '');
      let score = 0;
      if (nombre === objetivoNormalizado) {
        score = 500;
      } else if (nombre.startsWith(objetivoNormalizado) || objetivoNormalizado.startsWith(nombre)) {
        score = 350;
      } else if (nombre.includes(objetivoNormalizado) || objetivoNormalizado.includes(nombre)) {
        score = 250;
      } else {
        const tokensObjetivo = objetivoNormalizado.split(' ').filter(Boolean);
        const tokensNombre = nombre.split(' ').filter(Boolean);
        const comunes = tokensObjetivo.filter(token => tokensNombre.includes(token));
        score = comunes.length * 25;
      }
      if (!score && objetivoCompacto.length >= 4 && nombreCompacto.length >= 4) {
        const distance = distanciaLevenshteinAsistente(nombreCompacto, objetivoCompacto);
        const maxLen = Math.max(nombreCompacto.length, objetivoCompacto.length, 1);
        const similarity = 1 - (distance / maxLen);
        if (similarity >= 0.62) {
          score = Math.round(similarity * 160);
        }
      }
      return { item, score, nombre };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.nombre.length - b.nombre.length);

    return { query: objetivo, scored: puntuadas, matches: puntuadas.slice(0, 3).map(item => item.item) };
  }

  function resolverCoincidenciaAsistente(items, consulta, getLabel) {
    const listado = listarCoincidenciasAsistente(items, consulta, getLabel);
    return {
      query: listado.query,
      match: listado.scored[0]?.item || null,
      matches: listado.matches,
      ambiguous: !!(listado.scored[1] && listado.scored[0].score === listado.scored[1].score && listado.scored[0].score < 500)
    };
  }

  function seleccionarValorSeguroAsistente(select, value) {
    if (!select || !value) return false;
    const existe = Array.from(select.options || []).some(option => option.value === value);
    if (!existe) return false;
    select.value = value;
    return true;
  }

  function construirCoincidenciasSistemaAsistente(consulta, explicitType = '') {
    const contexto = obtenerContextoConversacionAsistente();
    const fuentes = [
      { type: 'almacen', module: 'inventario', label: 'Almacén', items: obtenerItemsAlmacenAsistente(), getLabel: item => item.nombre },
      { type: 'produccion', module: 'produccion-interna', label: 'Producción Interna', items: obtenerProduccionesAsistente(), getLabel: item => item.nombre },
      { type: 'plato', module: 'disponibilidad', label: 'Disponibilidad', items: obtenerPlatosAsistente(), getLabel: item => item.nombre },
      { type: 'distribuidor', module: 'distribuidores', label: 'Distribuidores', items: obtenerDistribuidoresAsistente(), getLabel: item => item.nombre }
    ];

    const resultados = [];
    fuentes.forEach((fuente) => {
      const listado = listarCoincidenciasAsistente(fuente.items, consulta, fuente.getLabel);
      listado.scored.forEach((entry) => {
        let score = entry.score;
        if (explicitType && fuente.type === explicitType) score += 90;
        if (contexto.lastEntityType && fuente.type === contexto.lastEntityType) score += 40;
        if (contexto.lastModule && fuente.module === contexto.lastModule) score += 24;
        resultados.push({
          ...fuente,
          item: entry.item,
          score,
          name: fuente.getLabel(entry.item)
        });
      });
    });

    resultados.sort((a, b) => b.score - a.score || normalizarTextoAsistente(a.name).localeCompare(normalizarTextoAsistente(b.name)));
    const best = resultados[0] || null;
    const second = resultados[1] || null;
    const ambiguous = !!(best && second && Math.abs(best.score - second.score) < 55 && normalizarTextoAsistente(best.name) !== normalizarTextoAsistente(second.name));

    return {
      query: limpiarNombreEntidadAsistente(consulta),
      all: resultados,
      top: resultados.slice(0, 4),
      best,
      ambiguous
    };
  }

  function obtenerReferenciaDesdeContextoAsistente(explicitType = '') {
    const contexto = obtenerContextoConversacionAsistente();
    if (explicitType === 'cliente') {
      return contexto.lastClient || contexto.lastEntityName || '';
    }
    if (explicitType === 'distribuidor') {
      return contexto.lastDistributor || contexto.lastEntityName || '';
    }
    if (explicitType === 'plato' && contexto.lastEntityType === 'plato') {
      return contexto.lastEntityName || '';
    }
    if (explicitType === 'produccion' && contexto.lastEntityType === 'produccion') {
      return contexto.lastEntityName || '';
    }
    return contexto.lastProduct || contexto.lastEntityName || '';
  }

  function resolverReferenciaAmbiguaAsistente(referencia, explicitType = '') {
    const contexto = obtenerContextoConversacionAsistente();
    const referenciaLimpia = limpiarNombreEntidadAsistente(referencia);
    const consulta = !referenciaLimpia || esReferenciaGenericaAsistente(referenciaLimpia)
      ? obtenerReferenciaDesdeContextoAsistente(explicitType)
      : referenciaLimpia;

    if (!consulta) {
      return { query: '', entity: null, ambiguous: false, matches: [] };
    }

    const coincidencias = construirCoincidenciasSistemaAsistente(consulta, explicitType);
    if (!coincidencias.best) {
      return { query: consulta, entity: null, ambiguous: false, matches: [] };
    }

    if (coincidencias.ambiguous) {
      const contextoCompatible = coincidencias.all.find((entry) => {
        if (explicitType && entry.type !== explicitType) return false;
        if (contexto.lastEntityType && entry.type === contexto.lastEntityType) return true;
        if (contexto.lastModule && entry.module === contexto.lastModule) return true;
        return false;
      });
      if (contextoCompatible) {
        return {
          query: consulta,
          entity: contextoCompatible,
          ambiguous: false,
          matches: coincidencias.top
        };
      }
    }

    return {
      query: consulta,
      entity: coincidencias.best,
      ambiguous: coincidencias.ambiguous,
      matches: coincidencias.top
    };
  }

  function extraerReferenciaConsultaAsistente(textoNormalizado, patrones = []) {
    for (const patron of patrones) {
      const match = textoNormalizado.match(patron);
      if (match && match[1]) {
        const referencia = limpiarNombreEntidadAsistente(match[1]);
        if (referencia) return referencia;
      }
    }
    return '';
  }

  function normalizarTelefonoAsistente(texto) {
    return String(texto || '').replace(/[^\d+]/g, '').trim();
  }

  function detectarConsultaSistemaAvanzadaAsistente(textoNormalizado) {
    const moduloActivo = obtenerModuloActivoAsistente()?.page || '';
    const contexto = obtenerContextoConversacionAsistente();

    if (detectarConsultaPerdidasAsistente(textoNormalizado)) {
      return { kind: 'system-query', topic: 'perdidas-total' };
    }

    if (/(cuanto vendi hoy|cuanto se vendio hoy|ventas de hoy|total vendido hoy|cuanto facture hoy|facture hoy)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'ventas-total-hoy' };
    }
    if (/(producto|plato).*(mas se vende|mas vendido|mas salida|mas movimiento)|que se vende mas|cual se vende mas|producto mas vendido|plato mas vendido|producto con mas salida|producto con mas movimiento/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'ventas-top-product' };
    }
    if (/(producto|plato).*(se vende menos|menos vendido|menos salida|menos movimiento)|que se vende menos|cual se vende menos|producto menos vendido|plato menos vendido/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'ventas-low-product' };
    }
    if (/(que plato deja mas ganancia|cual plato deja mas ganancia|plato mas rentable|plato deja mayor ganancia)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'plato-mas-ganancia' };
    }
    if (/(facturas de hoy|muestrame las facturas de hoy|mostrar facturas de hoy|facturacion de hoy)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'facturas-hoy' };
    }
    if (/(cuanto se ha facturado|cuanto he facturado|total facturado|facturacion total|cuanto se ha vendido en facturas)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'facturacion-total' };
    }
    if (/(factura mas alta|factura fue la mas alta|factura mas grande|mayor factura)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'factura-mas-alta' };
    }

    const facturaCliente = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:busca|buscar|muestrame|mostrar|ensename|ver)\s+(?:la\s+)?factura(?:s)?\s+(?:de|del cliente)\s+(.+)$/,
      /\b(?:factura|facturas)\s+de\s+(.+)$/
    ]);
    if (facturaCliente) {
      return { kind: 'system-query', topic: 'factura-por-cliente', reference: facturaCliente };
    }

    const puntosCliente = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:cuantos|cuanto)\s+puntos\s+tiene\s+(.+)$/,
      /\b(?:puntos\s+de|puntos del cliente)\s+(.+)$/
    ]);
    if (puntosCliente) {
      return { kind: 'system-query', topic: 'clientes-puntos', reference: puntosCliente };
    }

    const clienteBuscado = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:busca|buscar|encuentra|localiza)\s+(?:al\s+)?cliente\s+(.+)$/,
      /\b(?:busca|buscar|encuentra|localiza)\s+(.+)$/
    ]);
    if (clienteBuscado && (/(cliente|clientes)/.test(textoNormalizado) || moduloActivo === 'clientes-puntos')) {
      return { kind: 'system-query', topic: 'clientes-buscar', reference: clienteBuscado };
    }

    if (/(quien tiene mas puntos|cliente.*mas puntos|mas puntos acumulados)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'clientes-top-puntos' };
    }
    if (/(que cliente compra mas|quien compra mas|cliente.*compra mas|cliente mas comprador)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'clientes-top-compra' };
    }

    const distribuidorFaltantes = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:productos?\s+faltantes?\s+del?\s+distribuidor)\s+(.+)$/,
      /\b(?:faltantes?\s+del?\s+distribuidor)\s+(.+)$/,
      /\b(?:sus\s+faltantes)\b/
    ]);
    if (distribuidorFaltantes || (/sus faltantes/.test(textoNormalizado) && contexto.lastEntityType === 'distribuidor')) {
      return { kind: 'system-query', topic: 'distribuidor-faltantes', reference: distribuidorFaltantes || obtenerReferenciaDesdeContextoAsistente('distribuidor') };
    }

    const distribuidorProductos = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:que|cuales)\s+productos\s+tiene\s+(?:el\s+)?(?:distribuidor\s+)?(.+)$/,
      /\b(?:cuales son|mostrar|muestrame|ver)\s+(?:los\s+)?productos\s+(?:del?|de)\s+(?:distribuidor\s+)?(.+)$/,
      /\b(?:productos\s+del?\s+distribuidor)\s+(.+)$/,
      /\b(?:sus productos)\b/
    ]);
    if (distribuidorProductos || (/sus productos/.test(textoNormalizado) && obtenerContextoConversacionAsistente().lastEntityType === 'distribuidor')) {
      return { kind: 'system-query', topic: 'distribuidor-productos', reference: distribuidorProductos || obtenerReferenciaDesdeContextoAsistente('distribuidor') };
    }

    const pedidoDistribuidor = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:haz|genera|prepara|crea|realiza|arma)\s+(?:el\s+)?pedido\s+(?:del?|de)\s+(?:distribuidor\s+)?(.+)$/,
      /\b(?:pide|pedir|solicita|ordena)\s+(?:todo\s+)?(?:al?\s+)?distribuidor\s+(.+)$/
    ]);
    if (pedidoDistribuidor) {
      return { kind: 'system-query', topic: 'distribuidor-pedido', reference: pedidoDistribuidor };
    }

    const distribuidoresProducto = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:que|cual|quien)\s+(?:distribuidor|distribuidores)\s+vende(?:n)?\s+(.+)$/,
      /\b(?:quien vende|donde consigo)\s+(.+)$/
    ]);
    if (distribuidoresProducto) {
      return { kind: 'system-query', topic: 'distribuidor-vende-producto', reference: distribuidoresProducto };
    }

    const platoFaltantes = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:que\s+(?:producto|ingrediente)s?\s+falta(?:n)?\s+para\s+completar)\s+(.+)$/,
      /\b(?:que\s+(?:producto|ingrediente)s?\s+falta(?:n)?\s+para\s+completar\s+(?:el\s+)?plato)\s+(.+)$/,
      /\b(?:que\s+le\s+falta\s+a)\s+(.+?)\s+(?:para\s+salir|para\s+completar)$/
    ]);
    if (platoFaltantes) {
      return { kind: 'system-query', topic: 'plato-faltantes', reference: platoFaltantes };
    }

    if (/(que plato no puede salir|que platos no pueden salir|platos sin stock|platos bloqueados|que plato esta bloqueado)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'platos-bloqueados' };
    }

    if (/(cuales son mis producciones|que producciones tengo|que produccion tengo|mostrar produccion interna|muestrame la produccion interna|que hay en produccion interna|listar producciones)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'produccion-listado' };
    }

    const composicionProduccion = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:de que esta compuesta(?: la)? produccion)\s+(.+)$/,
      /\b(?:que ingredientes tiene(?: la)? produccion)\s+(.+)$/,
      /\b(?:composicion de(?: la)? produccion)\s+(.+)$/,
      /\b(?:de que se compone(?: la)? produccion)\s+(.+)$/
    ]);
    if (composicionProduccion || ((/sus ingredientes|su composicion/.test(textoNormalizado)) && contexto.lastEntityType === 'produccion')) {
      return { kind: 'system-query', topic: 'produccion-composicion', reference: composicionProduccion || obtenerReferenciaDesdeContextoAsistente('produccion') };
    }

    const faltantesProduccion = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:que me falta para completar(?: la)? produccion)\s+(.+)$/,
      /\b(?:faltantes? de(?: la)? produccion)\s+(.+)$/,
      /\b(?:informa(?:me)?\s+el\s+faltante\s+de)\s+(.+)$/
    ]);
    if (faltantesProduccion || ((/que me falta|faltantes/.test(textoNormalizado)) && contexto.lastEntityType === 'produccion')) {
      return { kind: 'system-query', topic: 'produccion-faltantes', reference: faltantesProduccion || obtenerReferenciaDesdeContextoAsistente('produccion') };
    }

    if (/(que produccion debo hacer|que debo producir|produccion baja|que hay que producir hoy)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'produccion-recomendada' };
    }

    if (/(que ingrediente se usa mas|cual ingrediente se usa mas|ingrediente mas usado|ingrediente que mas se usa)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'ingrediente-mas-usado' };
    }

    const consumeIngrediente = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:cual|que)\s+plato\s+consume\s+mas\s+(.+)$/,
      /\b(?:que\s+plato\s+usa\s+mas)\s+(.+)$/
    ]);
    if (consumeIngrediente) {
      return { kind: 'system-query', topic: 'plato-consume-ingrediente', reference: consumeIngrediente };
    }

    const restanteProducto = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:cuanto\s+queda\s+de)\s+(.+)$/,
      /\b(?:que\s+queda\s+de)\s+(.+)$/,
      /\b(?:existencia\s+de|stock\s+de)\s+(.+)$/
    ]);
    if (restanteProducto) {
      return { kind: 'system-query', topic: 'almacen-restante', reference: restanteProducto };
    }

    if (/(que producto se esta acabando|cual producto se esta acabando|que producto se agota mas rapido|cual producto se agota mas rapido|que producto falta mas|cual producto tiene mas faltante)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'almacen-mas-critico' };
    }

    if (/(productos?\s+estan\s+por\s+debajo\s+del\s+ideal|productos?\s+bajos|stock\s+bajo|que productos se estan acabando|que productos estan bajos|cuales productos estan bajos|cuales son los productos bajos)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'almacen-bajo-ideal' };
    }

    const busquedaInventario = extraerReferenciaConsultaAsistente(textoNormalizado, [
      /\b(?:busca|buscar|encuentra|localiza)\s+(?:el\s+)?(?:producto|ingrediente|insumo)?\s*(.+)$/
    ]);
    if (busquedaInventario && (/(almacen|inventario|ingrediente|insumo|producto)/.test(textoNormalizado) || moduloActivo === 'inventario')) {
      return { kind: 'system-query', topic: 'almacen-buscar', reference: busquedaInventario };
    }
    if (busquedaInventario && !/(cliente|clientes|factura|facturas|distribuidor|distribuidores|proveedor|proveedores)/.test(textoNormalizado)) {
      return { kind: 'system-query', topic: 'almacen-buscar', reference: busquedaInventario };
    }

    return null;
  }

  function detectarComandoCrearDistribuidor(textoNormalizado) {
    if (!/(crea|crear|agrega|agregar|registra|registrar|nuevo)/.test(textoNormalizado)) return null;
    if (!/(distribuidor|distribuidores)/.test(textoNormalizado)) return null;

    let trabajo = textoNormalizado
      .replace(/\b(?:crea|crear|agrega|agregar|registra|registrar)\b/g, ' ')
      .replace(/\b(?:un|una|nuevo|nueva)\b/g, ' ')
      .replace(/\b(?:distribuidor|distribuidores)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!trabajo) return null;

    const telefonoMatch = trabajo.match(/(\+?\d[\d\s-]{6,})$/);
    const telefono = telefonoMatch ? normalizarTelefonoAsistente(telefonoMatch[1]) : '';
    if (telefonoMatch) {
      trabajo = trabajo.replace(telefonoMatch[1], '').trim().replace(/[,\-]+$/, '').trim();
    }

    const partes = trabajo.split(',').map(part => limpiarNombreEntidadAsistente(part)).filter(Boolean);
    let nombre = partes[0] || '';
    let contacto = partes[1] || '';
    if (!contacto) {
      const tokens = trabajo.split(' ').filter(Boolean);
      if (tokens.length >= 4) {
        contacto = tokens.slice(-2).join(' ');
        nombre = tokens.slice(0, -2).join(' ');
      }
    }
    if (!nombre) return null;
    return {
      kind: 'distribuidor-create',
      nombre,
      contacto,
      telefono
    };
  }

  function detectarComandoActualizarTelefonoDistribuidor(textoNormalizado) {
    if (!/(edita|editar|cambia|cambiar|modifica|modificar|actualiza|actualizar)/.test(textoNormalizado)) return null;
    if (!/(distribuidor|telefono|numero|celular|contacto)/.test(textoNormalizado)) return null;

    const telefonoMatch = textoNormalizado.match(/(\+?\d[\d\s-]{6,})/);
    const telefono = telefonoMatch ? normalizarTelefonoAsistente(telefonoMatch[1]) : '';
    let trabajo = textoNormalizado
      .replace(/\b(?:edita|editar|cambia|cambiar|modifica|modificar|actualiza|actualizar)\b/g, ' ')
      .replace(/\b(?:telefono|numero|celular|contacto)\b/g, ' ')
      .replace(/\b(?:del?|de la|de)\s+distribuidor\b/g, ' ')
      .replace(/\b(?:distribuidor)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (telefonoMatch) {
      trabajo = trabajo.replace(telefonoMatch[1], ' ').replace(/\s+/g, ' ').trim();
    }

    const nombre = limpiarNombreEntidadAsistente(trabajo);
    if (!nombre && !telefono) return null;
    return {
      kind: 'distribuidor-update-phone',
      nombre,
      telefono
    };
  }

  function detectarComandoAgregarAlmacen(textoNormalizado) {
    if (!/(^| )(agrega|agregar|anade|anadir|registra|registrar|mete|meter|suma|sumar|pon|poner|ingresa|ingresar)( |$)/.test(textoNormalizado)) {
      return null;
    }
    if (/(distribuidor|proveedor|produccion interna|produccion|plato|comanda|sesion)/.test(textoNormalizado) && !/(almacen|inventario|ingrediente|insumo)/.test(textoNormalizado)) {
      return null;
    }
    if (!/(almacen|inventario|ingrediente|insumo|ideal|costo|coste|precio|\ba\s*\$?\s*\d)/.test(textoNormalizado)) {
      return null;
    }

    let trabajo = textoNormalizado;
    let costo = null;
    let ideal = null;
    let unidadIdeal = '';

    const idealMatch = trabajo.match(/\b(?:stock\s+)?ideal\s+(?:de\s+)?(\d+(?:[.,]\d+)?)(?:\s+([a-z]+))?/);
    if (idealMatch) {
      ideal = normalizarNumeroAsistente(idealMatch[1]);
      unidadIdeal = normalizarUnidadAsistente(idealMatch[2] || '');
      trabajo = trabajo.replace(idealMatch[0], ' ');
    }

    const costoMatch = trabajo.match(/\b(?:a|por|costo|coste|precio|vale|valor)\s*\$?\s*(\d+(?:[.,]\d+)?)(?:\s*(?:pesos|rd|rds))?/);
    if (costoMatch) {
      costo = normalizarNumeroAsistente(costoMatch[1]);
      trabajo = trabajo.replace(costoMatch[0], ' ');
    }

    trabajo = trabajo
      .replace(/\b(?:al?|en el|en la|en|de)\s+(?:almacen|inventario)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const cabeza = trabajo.match(/^(?:agrega|agregar|anade|anadir|registra|registrar|mete|meter|suma|sumar|pon|poner|ingresa|ingresar)\s+(.+)$/);
    if (!cabeza) return null;

    const cuerpo = cabeza[1].trim();
    let cantidad = null;
    let unidad = '';
    let producto = '';

    let matchCantidad = cuerpo.match(/^(\d+(?:[.,]\d+)?)\s+([a-z]+)\s+(?:de\s+)?(.+)$/);
    if (matchCantidad) {
      cantidad = normalizarNumeroAsistente(matchCantidad[1]);
      unidad = normalizarUnidadAsistente(matchCantidad[2]);
      producto = matchCantidad[3] || '';
    } else {
      matchCantidad = cuerpo.match(/^(\d+(?:[.,]\d+)?)\s+(?:de\s+)?(.+)$/);
      if (!matchCantidad) return null;
      cantidad = normalizarNumeroAsistente(matchCantidad[1]);
      producto = matchCantidad[2] || '';
    }

    producto = limpiarNombreEntidadAsistente(producto)
      .replace(/\b(?:con|ideal|costo|precio)\b.*$/, '')
      .trim();

    if (!producto || !Number.isFinite(cantidad) || cantidad <= 0) return null;

    const existente = resolverCoincidenciaAsistente(obtenerItemsAlmacenAsistente(), producto, item => item.nombre).match;
    const unidadBase = unidad || existente?.unidad || 'Unidad';
    let idealConvertido = ideal;

    if (Number.isFinite(idealConvertido) && unidadIdeal && unidadIdeal !== unidadBase && typeof convertirUnidad === 'function') {
      try {
        idealConvertido = convertirUnidad(idealConvertido, unidadIdeal, unidadBase);
      } catch (_) {}
    }

    if (!Number.isFinite(idealConvertido)) {
      idealConvertido = existente ? Number(existente.ideal) || 0 : null;
    }

    return {
      kind: 'almacen-add',
      producto,
      productoBonito: capitalizarTextoAsistente(producto),
      cantidad,
      unidad: unidadBase,
      costo,
      ideal: idealConvertido,
      existente
    };
  }

  function detectarComandoAgregarBasico(textoNormalizado) {
    if (!/(^| )(agrega|agregar|anade|anadir|registra|registrar|mete|meter|suma|sumar|pon|poner|ingresa|ingresar)( |$)/.test(textoNormalizado)) {
      return null;
    }
    if (/(distribuidor|proveedor|produccion interna|produccion|plato|receta|comanda|sesion)/.test(textoNormalizado)) {
      return null;
    }

    const resto = limpiarNombreEntidadAsistente(
      textoNormalizado
        .replace(/^(?:agrega|agregar|anade|anadir|registra|registrar|mete|meter|suma|sumar|pon|poner|ingresa|ingresar)\b/, ' ')
        .replace(/\b(?:al?|en el|en la|en|de)\s+(?:almacen|inventario)\b/g, ' ')
        .replace(/\b(?:ideal|costo|coste|precio)\b.*$/, ' ')
    );

    if (!resto || esReferenciaGenericaAsistente(resto)) return null;
    return {
      kind: 'almacen-add-incomplete',
      producto: resto,
      productoBonito: capitalizarTextoAsistente(resto)
    };
  }

  function detectarComandoEliminarAlmacen(textoNormalizado) {
    if (!/(elimina|eliminar|eliminalo|borra|borrar|borralo|quita|quitar|quitalo|remueve|remover|remuevelo|saca|sacar|sacalo)/.test(textoNormalizado)) {
      return null;
    }
    if (/(distribuidor|proveedor)/.test(textoNormalizado)) return null;
    if (/(plato|menu|disponibilidad|produccion)/.test(textoNormalizado) && !/(almacen|inventario|ingrediente|producto)/.test(textoNormalizado)) {
      return null;
    }
    if (!/(almacen|inventario|ingrediente|producto)/.test(textoNormalizado)) return null;

    const producto = limpiarNombreEntidadAsistente(
      textoNormalizado
        .replace(/\b(?:elimina|eliminar|eliminalo|borra|borrar|borralo|quita|quitar|quitalo|remueve|remover|remuevelo|saca|sacar|sacalo)\b/g, ' ')
        .replace(/\s+/g, ' ')
    );
    return producto ? { kind: 'almacen-delete', producto } : null;
  }

  function detectarComandoEliminarGenerico(textoNormalizado) {
    if (!/(elimina|eliminar|eliminalo|borra|borrar|borralo|quita|quitar|quitalo|remueve|remover|remuevelo|saca|sacar|sacalo)/.test(textoNormalizado)) {
      return null;
    }
    const explicitType = /(distribuidor|distribuidores|proveedor|proveedores)/.test(textoNormalizado)
      ? 'distribuidor'
      : (/(plato|platos|menu|disponibilidad|receta|recetas)/.test(textoNormalizado)
        ? 'plato'
        : (/(produccion|semielaborado|semielaborados)/.test(textoNormalizado) ? 'produccion' : ''));

    const referencia = limpiarNombreEntidadAsistente(
      textoNormalizado
        .replace(/\b(?:elimina|eliminar|eliminalo|borra|borrar|borralo|quita|quitar|quitalo|remueve|remover|remuevelo|saca|sacar|sacalo)\b/g, ' ')
        .replace(/\b(?:del?|de la|de|en el|en la|en)\s+(?:almacen|inventario|produccion|produccion interna|disponibilidad|menu)\b/g, ' ')
        .replace(/\s+/g, ' ')
    );

    return {
      kind: 'entity-delete',
      reference: referencia,
      explicitType
    };
  }

  function detectarComandoEliminarDistribuidor(textoNormalizado) {
    if (!/(elimina|eliminar|eliminalo|borra|borrar|borralo|quita|quitar|quitalo|remueve|remover|remuevelo)/.test(textoNormalizado)) {
      return null;
    }
    if (!/(distribuidor|distribuidores|proveedor|proveedores)/.test(textoNormalizado)) return null;

    const nombre = limpiarNombreEntidadAsistente(
      textoNormalizado
        .replace(/\b(?:elimina|eliminar|eliminalo|borra|borrar|borralo|quita|quitar|quitalo|remueve|remover|remuevelo)\b/g, ' ')
        .replace(/\s+/g, ' ')
    );
    return nombre ? { kind: 'distribuidor-delete', nombre } : null;
  }

  function detectarComandoActualizarGenerico(textoNormalizado) {
    if (!/\b(?:ponle|pon|cambiale|cambiarle|ajusta|ajustale|actualiza|actualizar|edita|editar|modifica|modificar)\b/.test(textoNormalizado)) {
      return null;
    }

    const cantidadMatch = textoNormalizado.match(/\b(?:ponle|pon|cambiale|cambiarle|ajusta|ajustale|actualiza|actualizar|edita|editar|modifica|modificar)(?:\s+a)?\s*(\d+(?:[.,]\d+)?)(?:\s+([a-z]+))?/);
    const reference = limpiarNombreEntidadAsistente(
      textoNormalizado
        .replace(/\b(?:ponle|pon|cambiale|cambiarle|ajusta|ajustale|actualiza|actualizar|edita|editar|modifica|modificar)\b/g, ' ')
        .replace(/\b(?:costo|precio|ideal|stock)\b/g, ' ')
        .replace(/\b(?:lb|lbr|libra|libras|g|gr|grs|gramo|gramos|oz|onza|onzas|lt|lts|litro|litros|l|unidad|unidades|ud|uds|ml|mililitro|mililitros)\b/g, ' ')
        .replace(/\d+(?:[.,]\d+)?/g, ' ')
        .replace(/\s+/g, ' ')
    );

    return {
      kind: 'entity-update',
      reference,
      quantity: cantidadMatch ? normalizarNumeroAsistente(cantidadMatch[1]) : null,
      unit: cantidadMatch ? normalizarUnidadAsistente(cantidadMatch[2] || '') : ''
    };
  }

  function detectarComandoDecomiso(textoNormalizado) {
    if (!/\b(?:decomisa|decomisar|decomiso)\b/.test(textoNormalizado)) {
      return null;
    }

    const cantidadMatch = textoNormalizado.match(/\b(?:decomisa|decomisar)\s+(\d+(?:[.,]\d+)?)(?:\s+([a-z]+))?/);
    const explicitType = /\bplato\b/.test(textoNormalizado)
      ? 'plato'
      : (/\b(?:ingrediente|insumo|almacen)\b/.test(textoNormalizado)
        ? 'almacen'
        : (/\bproduccion\b/.test(textoNormalizado) ? 'produccion' : ''));

    const reference = limpiarNombreEntidadAsistente(
      textoNormalizado
        .replace(/\b(?:decomisa|decomisar|decomiso)\b/g, ' ')
        .replace(/\b(?:plato|ingrediente|insumo|producto|produccion|almacen)\b/g, ' ')
        .replace(/\b(?:si esta vencido|si esta vencida|si esta malo|si esta mala)\b/g, ' ')
        .replace(/\d+(?:[.,]\d+)?/g, ' ')
        .replace(/\b(?:lb|lbr|libra|libras|g|gr|grs|gramo|gramos|oz|onza|onzas|lt|lts|litro|litros|l|unidad|unidades|ud|uds|ml|mililitro|mililitros)\b/g, ' ')
        .replace(/\s+/g, ' ')
    ).replace(/^de\s+/g, '').trim();

    return {
      kind: 'decomiso-create',
      reference,
      explicitType,
      quantity: cantidadMatch ? normalizarNumeroAsistente(cantidadMatch[1]) : null,
      unit: cantidadMatch ? normalizarUnidadAsistente(cantidadMatch[2] || '') : ''
    };
  }

  function detectarIntencionAsistente(textoNormalizado) {
    const consultaAvanzada = detectarConsultaSistemaAvanzadaAsistente(textoNormalizado);
    if (consultaAvanzada) return consultaAvanzada;

    if (detectarConsultaGananciasAsistente(textoNormalizado)) {
      return { kind: 'system-query', topic: 'ganancias-total' };
    }

    const crearDistribuidor = detectarComandoCrearDistribuidor(textoNormalizado);
    if (crearDistribuidor) return crearDistribuidor;

    const actualizarTelefonoDistribuidor = detectarComandoActualizarTelefonoDistribuidor(textoNormalizado);
    if (actualizarTelefonoDistribuidor) return actualizarTelefonoDistribuidor;

    const deleteDistribuidor = detectarComandoEliminarDistribuidor(textoNormalizado);
    if (deleteDistribuidor) return deleteDistribuidor;

    const deleteGenerico = detectarComandoEliminarGenerico(textoNormalizado);
    if (deleteGenerico) return deleteGenerico;

    const deleteAlmacen = detectarComandoEliminarAlmacen(textoNormalizado);
    if (deleteAlmacen) return deleteAlmacen;

    const addAlmacen = detectarComandoAgregarAlmacen(textoNormalizado);
    if (addAlmacen) return addAlmacen;

    const addBasico = detectarComandoAgregarBasico(textoNormalizado);
    if (addBasico) return addBasico;

    const updateGenerico = detectarComandoActualizarGenerico(textoNormalizado);
    if (updateGenerico) return updateGenerico;

    const decomiso = detectarComandoDecomiso(textoNormalizado);
    if (decomiso) return decomiso;

    if (detectarIntencionExplicacion(textoNormalizado)) return { kind: 'explain' };
    if (detectarIntencionProcedimiento(textoNormalizado)) return { kind: 'guide' };
    if (detectarIntencionAyuda(textoNormalizado)) return { kind: 'help' };
    return { kind: 'navigate-or-action' };
  }

  function extraerEntidadesAsistente(textoNormalizado, intento) {
    if (intento?.kind === 'almacen-add') return detectarComandoAgregarAlmacen(textoNormalizado) || intento;
    if (intento?.kind === 'almacen-add-incomplete') return detectarComandoAgregarBasico(textoNormalizado) || intento;
    if (intento?.kind === 'almacen-delete') return detectarComandoEliminarAlmacen(textoNormalizado) || intento;
    if (intento?.kind === 'entity-delete') return detectarComandoEliminarGenerico(textoNormalizado) || intento;
    if (intento?.kind === 'distribuidor-delete') return detectarComandoEliminarDistribuidor(textoNormalizado) || intento;
    if (intento?.kind === 'distribuidor-create') return detectarComandoCrearDistribuidor(textoNormalizado) || intento;
    if (intento?.kind === 'distribuidor-update-phone') return detectarComandoActualizarTelefonoDistribuidor(textoNormalizado) || intento;
    if (intento?.kind === 'entity-update') return detectarComandoActualizarGenerico(textoNormalizado) || intento;
    if (intento?.kind === 'decomiso-create') return detectarComandoDecomiso(textoNormalizado) || intento;
    return intento || {};
  }

  function construirPendienteAsistente(config) {
    assistantPendingAction = {
      summary: config.summary,
      confirmMessage: config.confirmMessage,
      run: config.run
    };
    return {
      message: config.message,
      role: 'assistant'
    };
  }

  function manejarPendienteAsistente(textoNormalizado) {
    if (!assistantPendingAction) return null;
    if (esCancelacionAsistente(textoNormalizado)) {
      assistantPendingAction = null;
      return {
        message: 'Acción cancelada. No hice cambios en LuRo Control.',
        role: 'assistant'
      };
    }
    if (esConfirmacionAsistente(textoNormalizado)) {
      const pending = assistantPendingAction;
      assistantPendingAction = null;
      return {
        message: pending.confirmMessage,
        role: 'system',
        actionDelay: 220,
        action: pending.run
      };
    }
    if (pareceNuevoComandoAsistente(textoNormalizado)) {
      assistantPendingAction = null;
      return null;
    }
    return {
      message: `Tengo pendiente esta acción: ${assistantPendingAction.summary}. Responde "sí" para continuar o "cancelar" para detenerla.`,
      role: 'assistant'
    };
  }

  function prepararFormularioAlmacenAsistente(datos) {
    if (typeof window.showPage === 'function') {
      window.showPage('inventario');
    }
    if (typeof actualizarSelectDistribuidores === 'function') {
      actualizarSelectDistribuidores();
    }

    const inputNombre = document.getElementById('inv_nombre');
    const inputCantidad = document.getElementById('inv_actual');
    const inputIdeal = document.getElementById('inv_ideal');
    const inputCosto = document.getElementById('inv_costo_total');
    const selectUnidad = document.getElementById('inv_unidad');

    if (inputNombre) inputNombre.value = normalizarTextoAsistente(datos.producto);
    if (inputCantidad) inputCantidad.value = formatearNumeroAsistente(datos.cantidad);
    if (inputIdeal) inputIdeal.value = datos.ideal !== null && datos.ideal !== undefined ? formatearNumeroAsistente(datos.ideal) : '';
    if (inputCosto) inputCosto.value = datos.costo !== null && datos.costo !== undefined ? formatearNumeroAsistente(datos.costo) : '';
    if (selectUnidad) seleccionarValorSeguroAsistente(selectUnidad, datos.unidad || 'Unidad');
  }

  function ejecutarRegistroAlmacenAsistente(datos) {
    prepararFormularioAlmacenAsistente(datos);
    if (typeof agregarAlmacen === 'function') {
      agregarAlmacen();
    }
  }

  function ejecutarEliminacionAlmacenAsistente(item) {
    if (typeof window.showPage === 'function') {
      window.showPage('inventario');
    }
    if (typeof eliminarAlmacen === 'function') {
      eliminarAlmacen(item.nombre);
    }
  }

  function ejecutarEliminacionDistribuidorAsistente(item) {
    if (typeof window.showPage === 'function') {
      window.showPage('distribuidores');
    }
    if (typeof eliminarDistribuidor === 'function') {
      eliminarDistribuidor(item.id);
    }
  }

  function ejecutarEliminacionProduccionAsistente(item) {
    if (typeof window.showPage === 'function') {
      window.showPage('produccion-interna');
    }
    const index = (db.produccion_stock || []).indexOf(item);
    if (index >= 0 && typeof eliminarProduccion === 'function') {
      eliminarProduccion(index);
    }
  }

  function ejecutarEliminacionPlatoAsistente(item) {
    if (typeof window.showPage === 'function') {
      window.showPage('disponibilidad');
    }
    const index = (db.platos || []).indexOf(item);
    if (index >= 0 && typeof delPlato === 'function') {
      delPlato(index);
    }
  }

  function prepararFormularioDistribuidorAsistente(datos) {
    if (typeof window.showPage === 'function') window.showPage('distribuidores');
    const inputId = document.getElementById('dist_edit_id');
    const inputNombre = document.getElementById('dist_nombre');
    const inputContacto = document.getElementById('dist_contacto');
    const inputTelefono = document.getElementById('dist_telefono');
    const inputEmail = document.getElementById('dist_email');
    const inputDireccion = document.getElementById('dist_direccion');
    const selectEstado = document.getElementById('dist_estado');
    if (inputId) inputId.value = datos.id || '';
    if (inputNombre) inputNombre.value = datos.nombre || '';
    if (inputContacto) inputContacto.value = datos.contacto || '';
    if (inputTelefono) inputTelefono.value = datos.telefono || '';
    if (inputEmail) inputEmail.value = datos.email || '';
    if (inputDireccion) inputDireccion.value = datos.direccion || '';
    if (selectEstado) selectEstado.value = datos.activo === false ? 'inactivo' : 'activo';
  }

  function ejecutarRegistroDistribuidorAsistente(datos) {
    prepararFormularioDistribuidorAsistente(datos);
    if (typeof guardarDistribuidor === 'function') guardarDistribuidor();
  }

  function ejecutarActualizacionTelefonoDistribuidorAsistente(item, telefono) {
    if (!item || !telefono) return;
    if (typeof window.showPage === 'function') window.showPage('distribuidores');
    if (typeof editarDistribuidor === 'function') editarDistribuidor(item.id);
    const inputTelefono = document.getElementById('dist_telefono');
    if (inputTelefono) inputTelefono.value = telefono;
    if (typeof guardarDistribuidor === 'function') guardarDistribuidor();
  }

  function ejecutarBusquedaAlmacenAsistente(item) {
    if (typeof window.showPage === 'function') window.showPage('inventario');
    const input = document.getElementById('buscarProductoAlmacen');
    if (input) input.value = item?.nombre || '';
    if (typeof resaltarProducto === 'function') {
      try { resaltarProducto(); } catch (_) {}
    }
  }

  function ejecutarBusquedaFacturasClienteAsistente(filtro) {
    if (typeof window.showPage === 'function') window.showPage('rnc-dgii');
    const input = document.getElementById('busqueda-rnc-clientes');
    if (input) input.value = filtro || '';
    if (typeof actualizarTablaRNC === 'function') {
      try { actualizarTablaRNC(); } catch (_) {}
    }
  }

  function ejecutarBusquedaClienteAsistente(cliente) {
    if (typeof window.showPage === 'function') window.showPage('clientes-puntos');
    const input = document.getElementById('clientes-puntos-buscar');
    if (input) input.value = cliente?.cedula || cliente?.nombre || '';
    if (typeof renderTablaClientesPuntos === 'function') {
      try { renderTablaClientesPuntos(); } catch (_) {}
    }
  }

  function ejecutarVerProductosDistribuidorAsistente(distribuidor) {
    if (!distribuidor) return;
    if (typeof window.showPage === 'function') window.showPage('distribuidores');
    if (typeof verProductosDistribuidor === 'function') {
      try { verProductosDistribuidor(distribuidor.id); } catch (_) {}
    }
  }

  function ejecutarPedidoDistribuidorAsistente(distribuidor) {
    if (!distribuidor) return;
    const productos = obtenerCatalogoDistribuidoresAsistente().filter(item => item.distId === distribuidor.id);
    const faltantes = productos
      .map((item) => ({ item, faltante: obtenerFaltanteProductoCatalogo(item) }))
      .filter((entry) => Number(entry.faltante.cantidad || 0) > 0);
    if (!faltantes.length) return;
    let mensaje = `Nombre de Distribuidor: ${distribuidor.nombre}\n`;
    mensaje += 'Asunto: Pedido de reposición\n';
    mensaje += 'Cantidad a pedir:\n';
    faltantes.forEach((entry) => {
      mensaje += `- ${String(entry.item.nombreProducto || '').toUpperCase()}: ${entry.faltante.cantidad.toFixed(2)} ${entry.faltante.unidad}\n`;
    });
    if (typeof abrirWhatsAppConMensaje === 'function') {
      abrirWhatsAppConMensaje(distribuidor.telefono || WHATSAPP_DEFAULT, mensaje);
    }
  }

  function prepararPantallaDecomisoAsistente(tipo, referencia = '') {
    if (typeof window.showPage === 'function') window.showPage('decomiso');
    const selectTipo = document.getElementById('tipo-decomiso');
    const inputBusqueda = document.getElementById('busqueda-decomiso');
    if (selectTipo) selectTipo.value = tipo === 'plato' ? 'plato' : 'almacen';
    if (typeof actualizarListaDecomiso === 'function') {
      try { actualizarListaDecomiso(); } catch (_) {}
    }
    if (inputBusqueda) inputBusqueda.value = referencia || '';
    if (typeof actualizarListaDecomiso === 'function') {
      try { actualizarListaDecomiso(); } catch (_) {}
    }
  }

  function ejecutarDecomisoPlatoAsistente(item) {
    if (!item) return;
    prepararPantallaDecomisoAsistente('plato', item.nombre || '');
    if (typeof ejecutarDecomisoPlato === 'function') {
      ejecutarDecomisoPlato(item.nombre);
    }
  }

  function ejecutarDecomisoInventarioAsistente(item, cantidad, unidad) {
    if (!item || !Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) return;
    prepararPantallaDecomisoAsistente('almacen', item.nombre || '');
    const inputCantidad = document.getElementById(`dec-cant-${item.nombre}`);
    const selectUnidad = document.getElementById(`dec-unid-${item.nombre}`);
    if (inputCantidad) inputCantidad.value = formatearNumeroAsistente(cantidad);
    if (selectUnidad) seleccionarValorSeguroAsistente(selectUnidad, unidad || item.unidad || 'Unidad');
    if (typeof ejecutarDecomisoAlmacen === 'function') {
      ejecutarDecomisoAlmacen(item.nombre);
    }
  }

  function ejecutarDecomisoProduccionAsistente(item, cantidad, unidad) {
    const qty = Number(cantidad || 0);
    if (!item || !Number.isFinite(qty) || qty <= 0) return;
    const unidadBase = item.unidad || unidad || 'Unidad';
    let descuento = qty;
    if (unidad && unidadBase && unidad !== unidadBase && typeof convertirUnidad === 'function') {
      try {
        descuento = convertirUnidad(qty, unidad, unidadBase);
      } catch (_) {}
    }
    if (!Number.isFinite(descuento) || descuento <= 0 || Number(item.actual || 0) < descuento) {
      return;
    }
    item.actual = Math.max(0, Number(item.actual || 0) - descuento);
    db.decomisos.push({
      owner: sesionUser.user,
      modulo: moduloActual,
      fecha: new Date().toLocaleString(),
      tipo: 'PRODUCCION',
      nombre: item.nombre,
      cant: qty,
      medida: unidad || unidadBase,
      perdida: Number(item.costoUnitario || item.costo || 0) * descuento,
      operador: typeof operadorActual !== 'undefined' ? operadorActual : 'Admin'
    });
    guardarDatos();
    if (typeof renderStockProduccion === 'function') {
      try { renderStockProduccion(); } catch (_) {}
    }
    if (typeof renderHistorialDecomiso === 'function') {
      try { renderHistorialDecomiso(); } catch (_) {}
    }
  }

  function ejecutarEliminacionPorNombreAsistente(type, name) {
    const nombre = normalizarTextoAsistente(name);
    if (!nombre) return;
    if (type === 'almacen') {
      if (typeof window.showPage === 'function') window.showPage('inventario');
      if (typeof eliminarAlmacen === 'function') eliminarAlmacen(nombre);
      return;
    }
    if (type === 'distribuidor') {
      const resultado = resolverCoincidenciaAsistente(obtenerDistribuidoresAsistente(), nombre, item => item.nombre);
      if (resultado.match && typeof eliminarDistribuidor === 'function') {
        if (typeof window.showPage === 'function') window.showPage('distribuidores');
        eliminarDistribuidor(resultado.match.id);
      }
      return;
    }
    if (type === 'produccion') {
      const resultado = resolverCoincidenciaAsistente(obtenerProduccionesAsistente(), nombre, item => item.nombre);
      const index = resultado.match ? (db.produccion_stock || []).indexOf(resultado.match) : -1;
      if (index >= 0 && typeof eliminarProduccion === 'function') {
        if (typeof window.showPage === 'function') window.showPage('produccion-interna');
        eliminarProduccion(index);
      }
      return;
    }
    if (type === 'plato') {
      const resultado = resolverCoincidenciaAsistente(obtenerPlatosAsistente(), nombre, item => item.nombre);
      const index = resultado.match ? (db.platos || []).indexOf(resultado.match) : -1;
      if (index >= 0 && typeof delPlato === 'function') {
        if (typeof window.showPage === 'function') window.showPage('disponibilidad');
        delPlato(index);
      }
    }
  }

  function responderConsultaSistemaAsistente(intencion, dato) {
    if (!intencion) return null;
    if (intencion.kind !== 'system-query') return null;

    if (intencion.topic === 'ganancias-total') {
      if (dato && Number.isFinite(dato.value)) {
        recordarEntidadAsistente({
          intent: 'consultar',
          module: 'ventas',
          entityType: 'ventas',
          reference: 'ganancias',
          queryTopic: intencion.topic
        });
        return {
          message: `Tu ganancia total actual es ${formatearMontoRespuestaAsistente(dato.value)}.`,
          role: 'assistant'
        };
      }
      return { message: 'No encontré el total de ganancias en este momento.', role: 'assistant' };
    }

    if (intencion.topic === 'perdidas-total') {
      if (dato && Number.isFinite(dato.value)) {
        recordarEntidadAsistente({
          intent: 'consultar',
          module: 'historial-decomiso',
          entityType: 'decomisos',
          reference: 'perdidas',
          queryTopic: intencion.topic
        });
        return {
          message: `Tu pérdida total actual es ${formatearMontoRespuestaAsistente(dato.value)}.`,
          role: 'assistant'
        };
      }
      return { message: 'No encontré el total de pérdidas en este momento.', role: 'assistant' };
    }

    if (intencion.topic === 'ventas-total-hoy') {
      return {
        message: `Hoy llevas vendido ${formatearMontoRespuestaAsistente(dato?.value || 0)} en ${Number(dato?.count || 0)} registro(s).`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'ventas-top-product' || intencion.topic === 'ventas-low-product') {
      if (dato?.entry) {
        const intro = intencion.topic === 'ventas-low-product' ? 'El producto con menor salida actual es' : 'El producto más vendido actualmente es';
        return {
          message: `${intro} ${dato.entry.nombre}, con ${formatearNumeroAsistente(dato.entry.cantidad)} unidad(es) registradas.`,
          role: 'assistant'
        };
      }
      return {
        message: intencion.topic === 'ventas-low-product'
          ? 'No encontré ventas suficientes para determinar el producto menos vendido.'
          : 'No encontré ventas suficientes para determinar el producto más vendido.',
        role: 'assistant'
      };
    }

    if (intencion.topic === 'plato-mas-ganancia') {
      if (!dato?.entry) {
        return { message: 'No encontré ventas suficientes para calcular qué plato deja más ganancia.', role: 'assistant' };
      }
      return {
        message: `${dato.entry.nombre} es el plato que más ganancia deja actualmente, con ${formatearMontoRespuestaAsistente(dato.entry.ganancia || 0)} acumulados.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'facturas-hoy') {
      return {
        message: `Hoy hay ${Number(dato?.count || 0)} factura(s) registradas por un total de ${formatearMontoRespuestaAsistente(dato?.value || 0)}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'facturacion-total') {
      return {
        message: `La facturación acumulada disponible es ${formatearMontoRespuestaAsistente(dato?.value || 0)} en ${Number(dato?.count || 0)} factura(s).`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'factura-mas-alta') {
      if (!dato?.factura) {
        return { message: 'No encontré facturas registradas para identificar la más alta.', role: 'assistant' };
      }
      const factura = dato.factura;
      return {
        message: `La factura más alta actual es de ${formatearMontoRespuestaAsistente(factura.total || 0)}, correspondiente a ${factura.nombre || 'CONSUMIDOR FINAL'} el ${factura.fecha || 'sin fecha disponible'}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'factura-por-cliente') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Necesito el nombre, RNC o código del cliente para buscar sus facturas.', role: 'assistant' };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré facturas para ${capitalizarTextoAsistente(dato.reference)} en los registros actuales.`, role: 'assistant' };
      }
      const facturas = dato?.facturas || [];
      const total = facturas.reduce((acc, factura) => acc + Number(factura.total || 0), 0);
      const nombres = formatearListaCortaAsistente(facturas, factura => `${factura.fecha} (${formatearMontoRespuestaAsistente(factura.total || 0)})`, 3);
      return {
        message: `Encontré ${facturas.length} factura(s) para ${capitalizarTextoAsistente(dato.reference)} por un total de ${formatearMontoRespuestaAsistente(total)}. Ejemplos: ${nombres}.`,
        role: 'assistant',
        action: () => ejecutarBusquedaFacturasClienteAsistente(dato.reference),
        actionDelay: 220
      };
    }

    if (intencion.topic === 'almacen-restante') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Indícame el producto del almacén que deseas consultar. Ejemplo: "cuánto queda de cebolla".', role: 'assistant' };
      }
      if (dato?.reason === 'ambiguous') {
        return {
          message: `Encontré varias coincidencias para "${capitalizarTextoAsistente(dato.reference)}": ${sugerirCoincidenciasAsistente(dato.matches)}. Dime cuál quieres consultar.`,
          role: 'assistant'
        };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré ${capitalizarTextoAsistente(dato.reference)} dentro del almacén actual.`, role: 'assistant' };
      }
      recordarCoincidenciaAsistente(dato.entity, 'consultar');
      return {
        message: `${capitalizarTextoAsistente(dato.item.nombre)} tiene ${formatearNumeroAsistente(dato.item.actual || 0)} ${etiquetaUnidadAsistente(dato.item.unidad)} disponibles. Su stock ideal es ${formatearNumeroAsistente(dato.item.ideal || 0)} ${etiquetaUnidadAsistente(dato.item.unidad)} y su costo unitario actual es ${formatearMonedaAsistente(dato.item.costoUnitario || 0)}.`,
        role: 'assistant',
        action: () => ejecutarBusquedaAlmacenAsistente(dato.item),
        actionDelay: 220
      };
    }

    if (intencion.topic === 'almacen-buscar') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Dime qué producto del almacén quieres buscar.', role: 'assistant' };
      }
      if (dato?.reason === 'ambiguous') {
        return {
          message: `Encontré varias coincidencias para "${capitalizarTextoAsistente(dato.reference)}": ${sugerirCoincidenciasAsistente(dato.matches)}. Dime cuál deseas abrir.`,
          role: 'assistant'
        };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré ${capitalizarTextoAsistente(dato.reference)} en el almacén actual.`, role: 'assistant' };
      }
      recordarCoincidenciaAsistente(dato.entity, 'buscar');
      return {
        message: `Encontré ${capitalizarTextoAsistente(dato.item.nombre)} en Almacén con ${formatearNumeroAsistente(dato.item.actual || 0)} ${etiquetaUnidadAsistente(dato.item.unidad)} disponibles.`,
        role: 'assistant',
        action: () => ejecutarBusquedaAlmacenAsistente(dato.item),
        actionDelay: 220
      };
    }

    if (intencion.topic === 'almacen-bajo-ideal') {
      const items = dato?.items || [];
      if (!items.length) {
        return { message: 'No encontré productos del almacén por debajo del stock ideal en este momento.', role: 'assistant' };
      }
      const lista = formatearListaCortaAsistente(items, item => `${capitalizarTextoAsistente(item.nombre)} (${formatearNumeroAsistente(item.actual)} / ${formatearNumeroAsistente(item.ideal)} ${item.unidad})`, 4);
      return {
        message: `Los productos más comprometidos por debajo del ideal son: ${lista}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'almacen-mas-critico') {
      if (!dato?.item) {
        return { message: 'No encontré un producto comprometido por debajo del ideal en este momento.', role: 'assistant' };
      }
      return {
        message: `${capitalizarTextoAsistente(dato.item.nombre)} es el producto que ahora mismo luce más comprometido: tiene ${formatearNumeroAsistente(dato.item.actual)} ${etiquetaUnidadAsistente(dato.item.unidad)} disponibles frente a un ideal de ${formatearNumeroAsistente(dato.item.ideal)}.`,
        role: 'assistant',
        action: () => ejecutarBusquedaAlmacenAsistente(dato.item),
        actionDelay: 220
      };
    }

    if (intencion.topic === 'distribuidor-productos') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Indícame el distribuidor del que deseas ver productos. También puedes decir "muéstrame sus productos" si acabas de mencionarlo.', role: 'assistant' };
      }
      if (dato?.reason === 'ambiguous') {
        return {
          message: `Encontré varios distribuidores parecidos para "${capitalizarTextoAsistente(dato.reference)}": ${sugerirCoincidenciasAsistente(dato.matches)}. Dime cuál quieres revisar.`,
          role: 'assistant'
        };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré el distribuidor ${capitalizarTextoAsistente(dato.reference)} en los datos actuales.`, role: 'assistant' };
      }
      recordarEntidadAsistente({
        intent: 'consultar',
        module: 'distribuidores',
        entityType: 'distribuidor',
        distributor: dato.distribuidor.nombre,
        queryTopic: intencion.topic
      });
      const productosTxt = formatearListaCortaAsistente(dato.productos, item => capitalizarTextoAsistente(item.nombreProducto), 5) || 'sin productos registrados';
      return {
        message: `${capitalizarTextoAsistente(dato.distribuidor.nombre)} tiene ${dato.productos.length} producto(s) asociados: ${productosTxt}.`,
        role: 'assistant',
        action: () => ejecutarVerProductosDistribuidorAsistente(dato.distribuidor),
        actionDelay: 220
      };
    }

    if (intencion.topic === 'distribuidor-faltantes') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Necesito el nombre del distribuidor para revisar sus productos faltantes.', role: 'assistant' };
      }
      if (dato?.reason === 'ambiguous') {
        return {
          message: `Encontré varios distribuidores parecidos para "${capitalizarTextoAsistente(dato.reference)}": ${sugerirCoincidenciasAsistente(dato.matches)}. Dime cuál quieres revisar.`,
          role: 'assistant'
        };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré el distribuidor ${capitalizarTextoAsistente(dato.reference)} en los datos actuales.`, role: 'assistant' };
      }
      recordarEntidadAsistente({
        intent: 'consultar',
        module: 'distribuidores',
        entityType: 'distribuidor',
        distributor: dato.distribuidor.nombre,
        queryTopic: intencion.topic
      });
      if (!dato.faltantes.length) {
        return {
          message: `${capitalizarTextoAsistente(dato.distribuidor.nombre)} no tiene faltantes pendientes para completar stock ideal en este momento.`,
          role: 'assistant',
          action: () => ejecutarVerProductosDistribuidorAsistente(dato.distribuidor),
          actionDelay: 220
        };
      }
      const lista = formatearListaCortaAsistente(dato.faltantes, entry => `${capitalizarTextoAsistente(entry.item.nombreProducto)} (${formatearNumeroAsistente(entry.faltante.cantidad)} ${entry.faltante.unidad})`, 4);
      return {
        message: `Los faltantes principales para ${capitalizarTextoAsistente(dato.distribuidor.nombre)} son: ${lista}.`,
        role: 'assistant',
        action: () => ejecutarVerProductosDistribuidorAsistente(dato.distribuidor),
        actionDelay: 220
      };
    }

    if (intencion.topic === 'distribuidor-vende-producto') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Indícame el producto que deseas consultar en distribuidores.', role: 'assistant' };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré distribuidores con ${capitalizarTextoAsistente(dato.reference)} en el catálogo actual.`, role: 'assistant' };
      }
      const lista = formatearListaCortaAsistente(dato.proveedores, item => `${capitalizarTextoAsistente(item.distNombre)} (${formatearMonedaAsistente(item.precio || 0)} por ${item.unidad})`, 4);
      return {
        message: `Encontré ${dato.proveedores.length} distribuidor(es) para ${capitalizarTextoAsistente(dato.reference)}: ${lista}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'distribuidor-pedido') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Necesito el nombre del distribuidor para preparar el pedido.', role: 'assistant' };
      }
      if (dato?.reason === 'ambiguous') {
        return {
          message: `Encontré varios distribuidores parecidos para "${capitalizarTextoAsistente(dato.reference)}": ${sugerirCoincidenciasAsistente(dato.matches)}. Dime cuál quieres usar para el pedido.`,
          role: 'assistant'
        };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré el distribuidor ${capitalizarTextoAsistente(dato.reference)} para preparar el pedido.`, role: 'assistant' };
      }
      recordarEntidadAsistente({
        intent: 'pedido',
        module: 'distribuidores',
        entityType: 'distribuidor',
        distributor: dato.distribuidor.nombre,
        queryTopic: intencion.topic
      });
      if (!dato.faltantes.length) {
        return {
          message: `${capitalizarTextoAsistente(dato.distribuidor.nombre)} no tiene faltantes pendientes para reponer stock ideal ahora mismo.`,
          role: 'assistant',
          action: () => ejecutarVerProductosDistribuidorAsistente(dato.distribuidor),
          actionDelay: 220
        };
      }
      const lista = formatearListaCortaAsistente(dato.faltantes, entry => `${capitalizarTextoAsistente(entry.item.nombreProducto)} (${formatearNumeroAsistente(entry.faltante.cantidad)} ${entry.faltante.unidad})`, 4);
      return {
        message: `Preparé el pedido de ${capitalizarTextoAsistente(dato.distribuidor.nombre)} con estos faltantes: ${lista}. Abriré WhatsApp para enviarlo.`,
        role: 'system',
        action: () => ejecutarPedidoDistribuidorAsistente(dato.distribuidor),
        actionDelay: 260
      };
    }

    if (intencion.topic === 'clientes-puntos' || intencion.topic === 'clientes-buscar') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Indícame el nombre, cédula o teléfono del cliente.', role: 'assistant' };
      }
      if (dato?.reason === 'ambiguous') {
        const nombres = formatearListaCortaAsistente(dato.matches || [], item => `${capitalizarTextoAsistente(item.nombre)} (${item.cedula || 'sin cédula'})`, 4);
        return { message: `Encontré varios clientes parecidos: ${nombres}. Dime cuál necesitas revisar.`, role: 'assistant' };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré un cliente que coincida con ${capitalizarTextoAsistente(dato.reference)}.`, role: 'assistant' };
      }
      const cliente = dato.cliente;
      recordarEntidadAsistente({
        intent: 'consultar',
        module: 'clientes-puntos',
        entityType: 'cliente',
        client: cliente.nombre,
        queryTopic: intencion.topic
      });
      const resumen = intencion.topic === 'clientes-puntos'
        ? `${capitalizarTextoAsistente(cliente.nombre)} tiene ${Number(cliente.puntos || 0)} punto(s) acumulados y un total histórico de ${formatearMontoRespuestaAsistente(cliente.totalAcumulado || 0)}.`
        : `Encontré al cliente ${capitalizarTextoAsistente(cliente.nombre)} con cédula ${cliente.cedula || 'N/A'}, teléfono ${cliente.telefono || 'N/A'} y ${Number(cliente.puntos || 0)} punto(s).`;
      return {
        message: resumen,
        role: 'assistant',
        action: () => ejecutarBusquedaClienteAsistente(cliente),
        actionDelay: 220
      };
    }

    if (intencion.topic === 'clientes-top-puntos' || intencion.topic === 'clientes-top-compra') {
      if (!dato?.cliente) {
        return {
          message: intencion.topic === 'clientes-top-puntos'
            ? 'No encontré clientes con puntos acumulados.'
            : 'No encontré clientes con compras acumuladas.',
          role: 'assistant'
        };
      }
      const cliente = dato.cliente;
      const mensaje = intencion.topic === 'clientes-top-puntos'
        ? `${capitalizarTextoAsistente(cliente.nombre)} es el cliente con más puntos acumulados, con ${Number(cliente.puntos || 0)} punto(s).`
        : `${capitalizarTextoAsistente(cliente.nombre)} es el cliente con mayor compra acumulada, con ${formatearMontoRespuestaAsistente(cliente.totalAcumulado || 0)}.`;
      return {
        message: mensaje,
        role: 'assistant',
        action: () => ejecutarBusquedaClienteAsistente(cliente),
        actionDelay: 220
      };
    }

    if (intencion.topic === 'plato-faltantes') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Necesito el nombre del plato que deseas revisar.', role: 'assistant' };
      }
      if (dato?.reason === 'ambiguous') {
        return {
          message: `Encontré varias coincidencias para "${capitalizarTextoAsistente(dato.reference)}": ${sugerirCoincidenciasAsistente(dato.matches)}. Dime cuál plato quieres revisar.`,
          role: 'assistant'
        };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré el plato ${capitalizarTextoAsistente(dato.reference)} en Disponibilidad.`, role: 'assistant' };
      }
      recordarEntidadAsistente({
        intent: 'consultar',
        module: 'disponibilidad',
        entityType: 'plato',
        plate: dato.plato.nombre,
        queryTopic: intencion.topic
      });
      if (!dato.faltantes.length) {
        return { message: `${capitalizarTextoAsistente(dato.plato.nombre)} no tiene faltantes. Con el stock actual sí puede salir.`, role: 'assistant' };
      }
      const lista = formatearListaCortaAsistente(dato.faltantes, item => `${item.nombre} (${formatearNumeroAsistente(item.faltante)} ${item.unidad})`, 5);
      return {
        message: `Para completar ${capitalizarTextoAsistente(dato.plato.nombre)} te faltan: ${lista}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'platos-bloqueados') {
      const platos = dato?.platos || [];
      if (!platos.length) {
        return { message: 'No encontré platos bloqueados por falta de ingredientes en este momento.', role: 'assistant' };
      }
      const lista = formatearListaCortaAsistente(platos, entry => `${capitalizarTextoAsistente(entry.plato.nombre)} (${entry.faltantes.length} faltante(s))`, 4);
      return {
        message: `Los platos que ahora mismo no pueden salir completos por faltantes son: ${lista}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'produccion-recomendada') {
      const items = dato?.items || [];
      if (!items.length) {
        return { message: 'No encontré producciones internas comprometidas por debajo del nivel esperado en este momento.', role: 'assistant' };
      }
      const lista = formatearListaCortaAsistente(items, item => `${capitalizarTextoAsistente(item.nombre)} (${formatearNumeroAsistente(item.actual)} ${item.unidad})`, 4);
      return {
        message: `Las producciones internas que conviene revisar o reforzar primero son: ${lista}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'produccion-listado') {
      const items = dato?.items || [];
      if (!items.length) {
        return { message: 'No encontré producciones internas registradas en el módulo actual.', role: 'assistant' };
      }
      const lista = formatearListaCortaAsistente(items, item => `${capitalizarTextoAsistente(item.nombre)} (${formatearNumeroAsistente(item.actual || 0)} ${item.unidad || ''})`, 5);
      return {
        message: `Estas son las producciones internas registradas ahora mismo: ${lista}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'produccion-composicion') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Necesito el nombre de la producción que deseas revisar.', role: 'assistant' };
      }
      if (dato?.reason === 'ambiguous') {
        return {
          message: `Encontré varias producciones parecidas para "${capitalizarTextoAsistente(dato.reference)}": ${sugerirCoincidenciasAsistente(dato.matches)}. Dime cuál quieres revisar.`,
          role: 'assistant'
        };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré la producción ${capitalizarTextoAsistente(dato.reference)} en Producción Interna.`, role: 'assistant' };
      }
      recordarCoincidenciaAsistente(dato.entity, 'consultar');
      const ingredientes = formatearListaCortaAsistente(dato.detalle?.ingredientes || [], item => `${item.nombre} (${formatearNumeroAsistente(item.requerida)} ${item.unidad})`, 5);
      return {
        message: `${capitalizarTextoAsistente(dato.detalle?.produccion?.nombre || dato.entity.name)} está compuesta por: ${ingredientes || 'sin ingredientes definidos'}. Con el almacén actual puedes fabricar aproximadamente ${formatearNumeroAsistente(dato.detalle?.capacidad || 0)} ${dato.detalle?.produccion?.unidad || 'unidad(es)'} más.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'produccion-faltantes') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Necesito el nombre de la producción para calcular sus faltantes.', role: 'assistant' };
      }
      if (dato?.reason === 'ambiguous') {
        return {
          message: `Encontré varias producciones parecidas para "${capitalizarTextoAsistente(dato.reference)}": ${sugerirCoincidenciasAsistente(dato.matches)}. Dime cuál quieres revisar.`,
          role: 'assistant'
        };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré la producción ${capitalizarTextoAsistente(dato.reference)} en Producción Interna.`, role: 'assistant' };
      }
      recordarCoincidenciaAsistente(dato.entity, 'consultar');
      if (!(dato.detalle?.faltantes || []).length) {
        return {
          message: `${capitalizarTextoAsistente(dato.detalle?.produccion?.nombre || dato.entity.name)} no tiene faltantes en este momento. Puedes producir con el stock actual.`,
          role: 'assistant'
        };
      }
      const faltantes = formatearListaCortaAsistente(dato.detalle.faltantes, item => `${item.nombre} (${formatearNumeroAsistente(item.faltante)} ${item.unidad})`, 5);
      return {
        message: `Para completar ${capitalizarTextoAsistente(dato.detalle?.produccion?.nombre || dato.entity.name)} te faltan: ${faltantes}. El costo estimado de reposición es ${formatearMontoRespuestaAsistente(dato.detalle?.costoReposicion || 0)}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'plato-consume-ingrediente') {
      if (dato?.reason === 'missing-reference') {
        return { message: 'Necesito el ingrediente que deseas analizar. Ejemplo: "cuál plato consume más pollo".', role: 'assistant' };
      }
      if (dato?.reason === 'not-found') {
        return { message: `No encontré recetas que consuman ${capitalizarTextoAsistente(dato.ingrediente)} en el módulo actual.`, role: 'assistant' };
      }
      return {
        message: `${capitalizarTextoAsistente(dato.entry.plato.nombre)} es el plato que más consume ${capitalizarTextoAsistente(dato.ingrediente)}, con aproximadamente ${formatearNumeroAsistente(dato.entry.total)} ${dato.entry.unidad || ''}.`,
        role: 'assistant'
      };
    }

    if (intencion.topic === 'ingrediente-mas-usado') {
      if (!dato?.entry) {
        return { message: 'No encontré recetas suficientes para determinar cuál ingrediente se usa más.', role: 'assistant' };
      }
      return {
        message: `${dato.entry.nombre} es el ingrediente con mayor presencia operativa ahora mismo. Aparece ${Number(dato.entry.veces || 0)} vez/veces entre platos y producciones activas.`,
        role: 'assistant'
      };
    }

    return null;
  }

  function describirEntidadSistemaAsistente(entity) {
    if (!entity) return '';
    switch (entity.type) {
      case 'almacen':
        return `el producto ${capitalizarTextoAsistente(entity.name)} del almacén`;
      case 'produccion':
        return `la producción ${capitalizarTextoAsistente(entity.name)} de Producción Interna`;
      case 'plato':
        return `el plato ${capitalizarTextoAsistente(entity.name)} de Disponibilidad`;
      case 'distribuidor':
        return `el distribuidor ${capitalizarTextoAsistente(entity.name)}`;
      case 'cliente':
        return `el cliente ${capitalizarTextoAsistente(entity.name)}`;
      default:
        return capitalizarTextoAsistente(entity.name);
    }
  }

  function sugerirCoincidenciasAsistente(matches = []) {
    return matches.map((entry) => `${capitalizarTextoAsistente(entry.name)} (${entry.label})`).join(', ');
  }

  function formatearListaCortaAsistente(items = [], mapper = (item) => item, limit = 4) {
    const lista = items.slice(0, limit).map(mapper).filter(Boolean);
    if (!lista.length) return '';
    if (items.length > limit) {
      lista.push(`+${items.length - limit} más`);
    }
    return lista.join(', ');
  }

  function recordarCoincidenciaAsistente(entity, intent = '') {
    if (!entity) return;
    recordarEntidadAsistente({
      intent,
      module: entity.module,
      entityType: entity.type,
      entityName: entity.name,
      product: entity.type === 'distribuidor' ? '' : entity.name,
      distributor: entity.type === 'distribuidor' ? entity.name : '',
      client: entity.type === 'cliente' ? entity.name : '',
      plate: entity.type === 'plato' ? entity.name : ''
    });
  }

  function construirRespuestaAsistente(intento, datos, textoNormalizado) {
    if (!intento) return null;
    const contexto = obtenerContextoConversacionAsistente();
    const moduloDetectado = buscarModuloAsistente(textoNormalizado);
    if (moduloDetectado && !esModuloRestringidoAsistente(moduloDetectado)) {
      actualizarContextoConversacionAsistente({ lastModule: moduloDetectado.page });
    }

    if (intento.kind === 'help') {
      return { message: ASSISTANT_HELP, role: 'assistant' };
    }

    if (intento.kind === 'system-query') {
      const modulo = resolverModuloAsistente(intento);
      if (esModuloRestringidoAsistente(modulo)) {
        return construirRespuestaRestriccionAsistente(modulo);
      }
      if (modulo) {
        actualizarContextoConversacionAsistente({ lastModule: modulo.page, lastQueryTopic: intento.topic || '' });
      }
      return responderConsultaSistemaAsistente(intento, obtenerDatoSistemaAsistente(intento));
    }

    if (intento.kind === 'explain' || intento.kind === 'guide') {
      const modulo = buscarModuloAsistente(textoNormalizado) || obtenerModuloActivoAsistente();
      if (modulo) {
        return responderModulo(modulo, true, intento.kind === 'guide');
      }
      const accion = buscarAccionAsistente(textoNormalizado);
      if (accion) {
        return responderAccion(accion, true);
      }
      return {
        message: construirExplicacionModuloAsistente(null, intento.kind === 'guide'),
        role: 'assistant'
      };
    }

    if (intento.kind === 'almacen-add-incomplete') {
      recordarEntidadAsistente({
        intent: 'agregar',
        module: 'inventario',
        entityType: 'almacen',
        product: datos.producto
      });
      return {
        message: `Entendí que deseas registrar ${datos.productoBonito} en Almacén, pero todavía me faltan datos. Puedes completarlo con algo como: "agrega 50 libras de ${datos.producto} a 560 ideal 40 libras".`,
        role: 'assistant'
      };
    }

    if (intento.kind === 'distribuidor-create') {
      if (!datos.nombre) {
        return {
          message: 'Necesito al menos el nombre del distribuidor para crearlo. Puedes decirme algo como: "crea un nuevo distribuidor La Sirena, Jhonn Santana, 8293666947".',
          role: 'assistant'
        };
      }
      recordarEntidadAsistente({
        intent: 'crear',
        module: 'distribuidores',
        entityType: 'distribuidor',
        distributor: datos.nombre
      });
      const partes = [
        `Entendí que deseas crear el distribuidor ${capitalizarTextoAsistente(datos.nombre)}`
      ];
      if (datos.contacto) partes.push(`con contacto ${capitalizarTextoAsistente(datos.contacto)}`);
      if (datos.telefono) partes.push(`y teléfono ${datos.telefono}`);
      return construirPendienteAsistente({
        summary: `Crear distribuidor ${capitalizarTextoAsistente(datos.nombre)}`,
        confirmMessage: `Voy a abrir Distribuidores y registrar ${capitalizarTextoAsistente(datos.nombre)} usando la lógica real del sistema.`,
        message: `${partes.join(' ')}. ¿Deseas que lo registre ahora?`,
        run: () => ejecutarRegistroDistribuidorAsistente({
          nombre: capitalizarTextoAsistente(datos.nombre),
          contacto: capitalizarTextoAsistente(datos.contacto || ''),
          telefono: datos.telefono || ''
        })
      });
    }

    if (intento.kind === 'distribuidor-update-phone') {
      const referencia = datos.nombre || obtenerReferenciaDesdeContextoAsistente('distribuidor');
      if (!referencia) {
        return {
          message: 'Indícame el nombre del distribuidor cuyo teléfono deseas editar.',
          role: 'assistant'
        };
      }
      if (!datos.telefono) {
        return {
          message: `Entendí que deseas editar el teléfono de ${capitalizarTextoAsistente(referencia)}, pero todavía me falta el nuevo número.`,
          role: 'assistant'
        };
      }
      const resolucion = resolverReferenciaAmbiguaAsistente(referencia, 'distribuidor');
      if (!resolucion.entity) {
        return {
          message: `No encontré un distribuidor exacto para ${capitalizarTextoAsistente(referencia)}. Si quieres, dime el nombre más completo.`,
          role: 'assistant'
        };
      }
      if (resolucion.ambiguous) {
        return {
          message: `Encontré varios distribuidores parecidos para "${capitalizarTextoAsistente(referencia)}": ${sugerirCoincidenciasAsistente(resolucion.matches)}. Dime cuál quieres editar.`,
          role: 'assistant'
        };
      }
      recordarCoincidenciaAsistente(resolucion.entity, 'editar');
      return construirPendienteAsistente({
        summary: `Actualizar teléfono de ${capitalizarTextoAsistente(resolucion.entity.name)}`,
        confirmMessage: `Voy a abrir Distribuidores y actualizar el teléfono de ${capitalizarTextoAsistente(resolucion.entity.name)} a ${datos.telefono}.`,
        message: `Entendí que deseas cambiar el teléfono del distribuidor ${capitalizarTextoAsistente(resolucion.entity.name)} a ${datos.telefono}. ¿Confirmas este cambio?`,
        run: () => ejecutarActualizacionTelefonoDistribuidorAsistente(resolucion.entity.item, datos.telefono)
      });
    }

    if (intento.kind === 'almacen-add') {
      recordarEntidadAsistente({
        intent: 'agregar',
        module: 'inventario',
        entityType: 'almacen',
        product: datos.producto,
        quantity: datos.cantidad,
        unit: datos.unidad,
        cost: datos.costo,
        ideal: datos.ideal
      });
      if (!Number.isFinite(datos?.costo)) {
        return {
          message: `Entendí que deseas registrar ${datos?.productoBonito || 'ese producto'} en Almacén, pero me falta el costo total para prepararlo automáticamente. Puedes escribir algo como: "agrega 50 libras de plátano maduro a 560 ideal 40 libras".`,
          role: 'assistant'
        };
      }

      const unidadTexto = etiquetaUnidadAsistente(datos.unidad);
      const idealTexto = datos.ideal !== null && datos.ideal !== undefined
        ? ` y stock ideal de ${formatearNumeroAsistente(datos.ideal)} ${unidadTexto}`
        : '';
      const mensaje = `Entendí que deseas agregar al almacén ${datos.productoBonito} con ${formatearNumeroAsistente(datos.cantidad)} ${unidadTexto}, costo total ${formatearMonedaAsistente(datos.costo)}${idealTexto}. ¿Deseas que lo registre ahora?`;

      return construirPendienteAsistente({
        summary: `Registrar ${datos.productoBonito} en Almacén`,
        confirmMessage: `Voy a registrar ${datos.productoBonito} en Almacén y usaré la lógica actual del sistema para guardar la entrada.`,
        message: mensaje,
        run: () => ejecutarRegistroAlmacenAsistente(datos)
      });
    }

    if (intento.kind === 'almacen-delete' || intento.kind === 'entity-delete' || intento.kind === 'distribuidor-delete') {
      const reference = intento.kind === 'almacen-delete'
        ? datos.producto
        : (intento.kind === 'distribuidor-delete' ? datos.nombre : datos.reference);
      const explicitType = intento.kind === 'almacen-delete'
        ? 'almacen'
        : (intento.kind === 'distribuidor-delete' ? 'distribuidor' : (datos.explicitType || ''));
      const resolucion = resolverReferenciaAmbiguaAsistente(reference, explicitType);

      if (!resolucion.query && !obtenerReferenciaDesdeContextoAsistente(explicitType)) {
        return {
          message: explicitType === 'distribuidor'
            ? 'Indícame el nombre del distribuidor que deseas eliminar. Ejemplo: "elimina distribuidor Pricesmart".'
            : 'Indícame el nombre del producto, plato, producción o distribuidor que deseas eliminar. También puedes decirme "elimínalo" si ya mencionaste uno antes.',
          role: 'assistant'
        };
      }

      if (!resolucion.entity) {
        const referenciaContextual = obtenerReferenciaDesdeContextoAsistente(explicitType);
        if (referenciaContextual && contexto.lastEntityType) {
          const tipoContextual = explicitType || contexto.lastEntityType || 'almacen';
          const syntheticEntity = {
            type: tipoContextual,
            module: contexto.lastModule || (tipoContextual === 'distribuidor' ? 'distribuidores' : 'inventario'),
            label: tipoContextual === 'distribuidor' ? 'Distribuidores' : (tipoContextual === 'produccion' ? 'Producción Interna' : (tipoContextual === 'plato' ? 'Disponibilidad' : 'Almacén')),
            name: referenciaContextual
          };
          recordarCoincidenciaAsistente(syntheticEntity, 'eliminar');
          return construirPendienteAsistente({
            summary: `Eliminar ${describirEntidadSistemaAsistente(syntheticEntity)}`,
            confirmMessage: `Voy a intentar resolver y eliminar ${describirEntidadSistemaAsistente(syntheticEntity)} usando el contexto reciente de la conversación.`,
            message: `Entendí que deseas eliminar ${describirEntidadSistemaAsistente(syntheticEntity)}. ¿Confirmas esta acción?`,
            run: () => ejecutarEliminacionPorNombreAsistente(syntheticEntity.type, syntheticEntity.name)
          });
        }
        return {
          message: `No encontré una coincidencia exacta para "${capitalizarTextoAsistente(resolucion.query)}" en los datos actuales. Si quieres, dime el módulo o el nombre más completo.`,
          role: 'assistant'
        };
      }

      if (resolucion.ambiguous) {
        return {
          message: `Encontré varias coincidencias para "${capitalizarTextoAsistente(resolucion.query)}": ${sugerirCoincidenciasAsistente(resolucion.matches)}. Dime cuál quieres eliminar.`,
          role: 'assistant'
        };
      }

      const entity = resolucion.entity;
      recordarCoincidenciaAsistente(entity, 'eliminar');

      let confirmMessage = '';
      let run = null;
      if (entity.type === 'almacen') {
        confirmMessage = `Voy a abrir Almacén y ejecutar la eliminación segura de ${capitalizarTextoAsistente(entity.name)}. El sistema te pedirá la contraseña de seguridad antes de borrar.`;
        run = () => ejecutarEliminacionAlmacenAsistente(entity.item);
      } else if (entity.type === 'distribuidor') {
        confirmMessage = `Voy a abrir Distribuidores y ejecutar la eliminación segura de ${capitalizarTextoAsistente(entity.name)}. Después el sistema te pedirá la validación administrativa correspondiente.`;
        run = () => ejecutarEliminacionDistribuidorAsistente(entity.item);
      } else if (entity.type === 'produccion') {
        confirmMessage = `Voy a abrir Producción Interna y ejecutar la eliminación segura de ${capitalizarTextoAsistente(entity.name)}. El sistema te pedirá la validación correspondiente.`;
        run = () => ejecutarEliminacionProduccionAsistente(entity.item);
      } else if (entity.type === 'plato') {
        confirmMessage = `Voy a abrir Disponibilidad y ejecutar la eliminación segura de ${capitalizarTextoAsistente(entity.name)}. El sistema te pedirá la validación administrativa correspondiente.`;
        run = () => ejecutarEliminacionPlatoAsistente(entity.item);
      }

      return construirPendienteAsistente({
        summary: `Eliminar ${describirEntidadSistemaAsistente(entity)}`,
        confirmMessage,
        message: `Entendí que deseas eliminar ${describirEntidadSistemaAsistente(entity)}. ¿Confirmas esta acción?`,
        run
      });
    }

    if (intento.kind === 'entity-update') {
      const resolucion = resolverReferenciaAmbiguaAsistente(datos.reference, '');
      if (!resolucion.entity) {
        return {
          message: 'Entendí que quieres actualizar un registro, pero necesito que me indiques cuál. Si acabas de mencionarlo, también puedes decirme "ponle 60 libras a plátano maduro".',
          role: 'assistant'
        };
      }
      recordarCoincidenciaAsistente(resolucion.entity, 'actualizar');
      const unidadTexto = datos.unit ? ` ${etiquetaUnidadAsistente(datos.unit)}` : '';
      if (Number.isFinite(datos.quantity)) {
        return {
          message: `Entendí que deseas actualizar ${describirEntidadSistemaAsistente(resolucion.entity)} a ${formatearNumeroAsistente(datos.quantity)}${unidadTexto}. Para no asumir mal, dime si quieres cambiar cantidad, stock ideal, costo o preparar la edición.`,
          role: 'assistant'
        };
      }
      return {
        message: `Entendí que deseas editar ${describirEntidadSistemaAsistente(resolucion.entity)}. Dime qué valor quieres cambiar y te ayudo a prepararlo.`,
        role: 'assistant'
      };
    }

    if (intento.kind === 'decomiso-create') {
      const tipoExplicito = datos.explicitType === 'plato'
        ? 'plato'
        : (datos.explicitType === 'produccion' ? 'produccion' : (datos.explicitType ? 'almacen' : ''));
      const resolucion = resolverReferenciaAmbiguaAsistente(datos.reference, tipoExplicito);
      if (!resolucion.query && !obtenerReferenciaDesdeContextoAsistente(tipoExplicito || '')) {
        return {
          message: 'Indícame qué plato, ingrediente o producción deseas decomisar. También puedes decir "decomisa 2 libras de tomate" o "decomisa costilla infinita".',
          role: 'assistant'
        };
      }
      if (!resolucion.entity) {
        return {
          message: `No encontré una coincidencia clara para "${capitalizarTextoAsistente(resolucion.query || datos.reference)}" dentro de los módulos permitidos para decomiso.`,
          role: 'assistant'
        };
      }
      if (resolucion.ambiguous) {
        return {
          message: `Encontré varias coincidencias para "${capitalizarTextoAsistente(resolucion.query)}": ${sugerirCoincidenciasAsistente(resolucion.matches)}. Dime cuál deseas decomisar.`,
          role: 'assistant'
        };
      }
      const entity = resolucion.entity;
      recordarCoincidenciaAsistente(entity, 'decomisar');

      if (entity.type === 'plato') {
        return construirPendienteAsistente({
          summary: `Decomisar el plato ${capitalizarTextoAsistente(entity.name)}`,
          confirmMessage: `Voy a registrar el decomiso de ${capitalizarTextoAsistente(entity.name)} usando la lógica real del sistema.`,
          message: `Entendí que deseas decomisar el plato ${capitalizarTextoAsistente(entity.name)}. Esto descontará 1 unidad del plato y registrará la pérdida. ¿Confirmas esta acción?`,
          run: () => ejecutarDecomisoPlatoAsistente(entity.item)
        });
      }

      if ((entity.type === 'almacen' || entity.type === 'produccion') && (!Number.isFinite(datos.quantity) || Number(datos.quantity) <= 0)) {
        return {
          message: `Entendí que deseas decomisar ${describirEntidadSistemaAsistente(entity)}, pero necesito la cantidad. Puedes decirme algo como: "decomisa 2 ${etiquetaUnidadAsistente(entity.item?.unidad || datos.unit || 'Unidad')} de ${entity.name}".`,
          role: 'assistant'
        };
      }

      if (entity.type === 'almacen') {
        const unidad = datos.unit || entity.item?.unidad || 'Unidad';
        return construirPendienteAsistente({
          summary: `Decomisar ${formatearNumeroAsistente(datos.quantity)} ${etiquetaUnidadAsistente(unidad)} de ${capitalizarTextoAsistente(entity.name)}`,
          confirmMessage: `Voy a registrar el decomiso de ${formatearNumeroAsistente(datos.quantity)} ${etiquetaUnidadAsistente(unidad)} de ${capitalizarTextoAsistente(entity.name)} en Almacén.`,
          message: `Entendí que deseas decomisar ${formatearNumeroAsistente(datos.quantity)} ${etiquetaUnidadAsistente(unidad)} del producto ${capitalizarTextoAsistente(entity.name)}. ¿Confirmas esta acción?`,
          run: () => ejecutarDecomisoInventarioAsistente(entity.item, datos.quantity, unidad)
        });
      }

      if (entity.type === 'produccion') {
        const unidad = datos.unit || entity.item?.unidad || 'Unidad';
        return construirPendienteAsistente({
          summary: `Decomisar ${formatearNumeroAsistente(datos.quantity)} ${etiquetaUnidadAsistente(unidad)} de ${capitalizarTextoAsistente(entity.name)}`,
          confirmMessage: `Voy a registrar el decomiso de ${formatearNumeroAsistente(datos.quantity)} ${etiquetaUnidadAsistente(unidad)} de ${capitalizarTextoAsistente(entity.name)} en Producción Interna y lo dejaré trazado en Historial Decomiso.`,
          message: `Entendí que deseas decomisar ${formatearNumeroAsistente(datos.quantity)} ${etiquetaUnidadAsistente(unidad)} de la producción ${capitalizarTextoAsistente(entity.name)}. ¿Confirmas esta acción?`,
          run: () => ejecutarDecomisoProduccionAsistente(entity.item, datos.quantity, unidad)
        });
      }
    }

    return null;
  }

  function respuestaFallback() {
    return {
      message: ASSISTANT_UNKNOWN_COMMAND,
      role: 'assistant'
    };
  }

  async function resolverIntencionAsistente(textoCrudo) {
    const unresolvedTemplate = esPlantillaComandoAsistente(textoCrudo);
    const rawText = normalizarTextoPlantillaAsistente(textoCrudo).trim();
    const normalizedText = normalizarTextoAsistente(rawText);
    iniciarDebugAsistente(rawText, normalizedText);
    const finalizarRespuestaAsistente = (response, extra = {}) => {
      registrarDebugAsistente('output', {
        extra,
        response,
        context: obtenerContextoConversacionAsistente(),
        pendingSummary: assistantPendingAction?.summary || ''
      });
      cerrarDebugAsistente(response);
      return response;
    };

    if (!normalizedText) {
      return finalizarRespuestaAsistente({
        message: 'Escribe un comando.',
        role: 'assistant'
      }, { reason: 'empty-input' });
    }

    if (unresolvedTemplate) {
      return finalizarRespuestaAsistente({
        message: 'Completa los campos pendientes de la plantilla antes de ejecutarla.',
        role: 'assistant'
      }, { reason: 'template-incomplete' });
    }

    const pendingResponse = manejarPendienteAsistente(normalizedText);
    registrarDebugAsistente('pending-check', {
      hadPending: !!assistantPendingAction,
      pendingResolved: !!pendingResponse
    });
    if (pendingResponse) return finalizarRespuestaAsistente(pendingResponse, { stage: 'pending' });

    if (detectarSaludo(normalizedText)) {
      return finalizarRespuestaAsistente({ message: ASSISTANT_GREETING, role: 'assistant' }, { stage: 'greeting' });
    }

    const explicitNavigation = detectarNavegacionExplicitaAsistente(normalizedText);
    if (explicitNavigation) {
      return finalizarRespuestaAsistente(responderModulo(explicitNavigation, false, false), {
        stage: 'explicit-navigation',
        page: explicitNavigation.page
      });
    }

    const helpModuleMatch = buscarModuloAsistente(normalizedText);
    const helpActionMatch = buscarAccionAsistente(normalizedText);
    if (detectarIntencionAyuda(normalizedText) && !helpModuleMatch && !helpActionMatch) {
      return finalizarRespuestaAsistente(responderModulo(obtenerModuloPorPaginaAsistente('comandos')), { stage: 'help' });
    }

    const askExplanation = detectarIntencionExplicacion(normalizedText);
    const askGuide = detectarIntencionProcedimiento(normalizedText);

    const intencion = detectarIntencionAsistente(normalizedText);
    const datos = extraerEntidadesAsistente(normalizedText, intencion);
    registrarDebugAsistente('intent-detected', { intencion });
    registrarDebugAsistente('entities-extracted', { datos });
    const respuestaInteligente = construirRespuestaAsistente(intencion, datos, normalizedText);
    registrarDebugAsistente('smart-response', { handled: !!respuestaInteligente, respuesta: respuestaInteligente });
    if (respuestaInteligente) return finalizarRespuestaAsistente(respuestaInteligente, { stage: 'smart-response' });

    const actionMatch = buscarAccionAsistente(normalizedText);
    if (actionMatch) {
      return finalizarRespuestaAsistente(responderAccion(actionMatch, askExplanation || askGuide), {
        stage: 'action-match',
        action: actionMatch.id
      });
    }

    const pageMatch = buscarModuloAsistente(normalizedText);
    if (pageMatch) {
      return finalizarRespuestaAsistente(responderModulo(pageMatch, askExplanation || askGuide, askGuide), {
        stage: 'page-match',
        page: pageMatch.page
      });
    }

    if ((askExplanation || askGuide) && obtenerModuloActivoAsistente()) {
      return finalizarRespuestaAsistente(responderModulo(obtenerModuloActivoAsistente(), true, askGuide), {
        stage: 'active-module-help',
        page: obtenerModuloActivoAsistente()?.page || ''
      });
    }

    return finalizarRespuestaAsistente(respuestaFallback(), { stage: 'fallback' });
  }

  function ejecutarAccionResultadoAsistente(result) {
    if (typeof result?.action === 'function') {
      setTimeout(() => {
        try {
          registrarDebugAsistente('action-run-start', {
            message: result?.message || '',
            role: result?.role || 'assistant'
          });
          result.action();
          registrarDebugAsistente('action-run-complete', {
            message: result?.message || '',
            role: result?.role || 'assistant'
          });
        } catch (e) {
          console.warn('No se pudo ejecutar la acción del asistente:', e);
          registrarDebugAsistente('action-run-error', {
            message: result?.message || '',
            error: e?.message || String(e)
          });
          registrarMensajeAsistente('assistant', 'No se pudo ejecutar el comando automáticamente.');
          actualizarEstadoModuloComandos('No se pudo ejecutar el comando automáticamente.');
        }
      }, Number(result?.actionDelay || 240));
    }
  }

  window.procesarComando = resolverIntencionAsistente;
  window.interpretarComandoAsistente = resolverIntencionAsistente;

  window.enviarMensajeAsistente = async function () {
    const { input } = assistantRefs();
    if (!input) return;
    const texto = String(input.value || '').trim();
    if (!texto) return;
    if (esPlantillaComandoAsistente(texto)) {
      actualizarEstadoModuloComandos('Completa los campos de la plantilla antes de enviarla.');
      enfocarInputAsistente();
      return;
    }
    registrarMensajeAsistente('user', texto);
    input.value = '';

    const result = await resolverIntencionAsistente(texto);
    registrarMensajeAsistente(result?.role || 'assistant', result?.message || ASSISTANT_UNKNOWN_COMMAND);
    actualizarEstadoModuloComandos(result?.message || ASSISTANT_UNKNOWN_COMMAND);
    ejecutarAccionResultadoAsistente(result);
  };

  window.handleLuroAssistantKeydown = function (event) {
    if (!event) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      window.enviarMensajeAsistente();
    }
  };

  window.toggleLuroAssistant = function (forceOpen) {
    const { panel } = assistantRefs();
    if (!panel) return;
    const isOpen = panel.classList.contains('is-open');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
    if (shouldOpen) {
      abrirPanelAsistente();
    } else {
      cerrarPanelAsistente();
    }
  };

  window.abrirAsistente = function () {
    abrirPanelAsistente();
  };

  window.cerrarAsistente = function () {
    cerrarPanelAsistente();
  };

  window.limpiarConversacionAsistente = function () {
    reiniciarConversacionAsistente('manual');
  };

  window.toggleLuroAssistantMinimize = function () {
    const { panel } = assistantRefs();
    if (!panel) return;
    if (!panel.classList.contains('is-open')) {
      abrirPanelAsistente();
      return;
    }
    panel.classList.toggle('is-minimized');
    if (!panel.classList.contains('is-minimized')) enfocarInputAsistente();
  };

  window.usarSugerenciaAsistente = function (texto) {
    assistantSuggestionPreviewKey = '';
    renderSugerenciasAsistente();
    if (!prepararTextoComandoAsistente(texto)) return;
    if (esPlantillaComandoAsistente(texto)) {
      actualizarEstadoModuloComandos('Plantilla cargada en el asistente. Completa los datos antes de enviarla.');
      return;
    }
    window.enviarMensajeAsistente();
  };

  window.toggleVistaPreviaSugerenciaAsistente = function (sectionKey) {
    const key = String(sectionKey || '').trim();
    if (!key) return;
    assistantSuggestionPreviewKey = assistantSuggestionPreviewKey === key ? '' : key;
    renderSugerenciasAsistente();
    registrarActividadAsistente();
  };

  window.filtrarModuloComandos = function () {
    renderModuloComandos();
  };

  window.renderModuloComandos = renderModuloComandos;
  window.renderSugerenciasAsistente = renderSugerenciasAsistente;
  window.abrirEditorComandosModulo = abrirEditorComandosModulo;
  window.cerrarEditorComandosModulo = cerrarEditorComandosModulo;
  window.guardarEditorComandosModulo = guardarEditorComandosModulo;
  window.restaurarEditorComandoModulo = restaurarEditorComandosModulo;
  window.restaurarEditorComandosModulo = restaurarEditorComandosModulo;
  window.actualizarCampoEditorComandoModulo = function (index, field, value) {
    if (!comandosEditorState || !Array.isArray(comandosEditorState.commands)) return;
    const safeIndex = Number(index);
    if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= comandosEditorState.commands.length) return;
    if (!['text', 'help'].includes(field)) return;
    comandosEditorState.commands[safeIndex][field] = String(value || '');
  };
  window.actualizarCabeceraEditorComandoModulo = function (field, value) {
    if (!comandosEditorState) return;
    if (!['title', 'description'].includes(field)) return;
    comandosEditorState[field] = String(value || '');
  };
  window.agregarFilaEditorComandoModulo = function () {
    if (!comandosEditorState) return;
    comandosEditorState.commands.push({
      text: '',
      help: 'Explica aquí qué hace esta acción dentro del sistema.'
    });
    renderEditorComandosModulo();
  };
  window.eliminarFilaEditorComandoModulo = function (index) {
    if (!comandosEditorState || !Array.isArray(comandosEditorState.commands)) return;
    if (comandosEditorState.commands.length <= 1) {
      actualizarEstadoModuloComandos('Cada tarjeta debe conservar al menos una acción.');
      return;
    }
    const safeIndex = Number(index);
    if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= comandosEditorState.commands.length) return;
    comandosEditorState.commands.splice(safeIndex, 1);
    renderEditorComandosModulo();
  };

  window.toggleSugerenciaComandoModulo = function (sectionKey, checked) {
    const actuales = new Set(obtenerClavesSugerenciasActivasAsistente());
    const key = String(sectionKey || '').trim();
    if (!key) return;
    if (checked) {
      actuales.add(key);
    } else {
      actuales.delete(key);
      if (assistantSuggestionPreviewKey === key) assistantSuggestionPreviewKey = '';
    }
    guardarClavesSugerenciasActivasAsistente(Array.from(actuales));
    renderModuloComandos();
    renderSugerenciasAsistente();
    actualizarEstadoModuloComandos(
      checked
        ? 'Acceso activado. Ya aparece en las sugerencias del asistente.'
        : 'Acceso desactivado. Ya no aparece en las sugerencias del asistente.'
    );
  };

  window.handleComandosSearchKeydown = function (event) {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();
    renderModuloComandos();
  };

  window.handleComandoModuloKeydown = function (event) {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();
    window.ejecutarComandoDesdeModulo();
  };

  window.ejecutarComandoDesdeModulo = async function () {
    const { runnerInput } = comandosRefs();
    if (!runnerInput) return;
    const texto = String(runnerInput.value || '').trim();
    if (!texto) {
      actualizarEstadoModuloComandos('Escribe un comando.');
      return;
    }
    if (esPlantillaComandoAsistente(texto)) {
      actualizarEstadoModuloComandos('Completa los campos pendientes de la plantilla antes de ejecutarla.');
      prepararTextoComandoAsistente(texto);
      return;
    }
    registrarMensajeAsistente('user', texto);
    const result = await resolverIntencionAsistente(texto);
    registrarMensajeAsistente(result?.role || 'assistant', result?.message || ASSISTANT_UNKNOWN_COMMAND);
    actualizarEstadoModuloComandos(result?.message || ASSISTANT_UNKNOWN_COMMAND);
    ejecutarAccionResultadoAsistente(result);
  };

  document.addEventListener('DOMContentLoaded', () => {
    sembrarAsistenteSiHaceFalta();
    renderModuloComandos();
    renderSugerenciasAsistente();
    const { panel } = assistantRefs();
    const { editorModal } = comandosRefs();
    if (panel) {
      panel.addEventListener('pointerdown', registrarActividadAsistente, true);
      panel.addEventListener('input', registrarActividadAsistente, true);
      panel.addEventListener('keydown', registrarActividadAsistente, true);
    }
    if (editorModal) {
      editorModal.addEventListener('click', (event) => {
        if (event.target === editorModal) cerrarEditorComandosModulo();
      });
    }
    document.addEventListener('click', (event) => {
      const { panel } = assistantRefs();
      if (panel?.classList.contains('is-open')) {
        registrarActividadAsistente();
      }
      if (!panel || !panel.classList.contains('is-open')) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panel.contains(target)) {
        if (
          assistantSuggestionPreviewKey &&
          !target.closest('.luro-assistant-suggestion-item') &&
          !target.closest('.luro-assistant-suggestion-preview')
        ) {
          assistantSuggestionPreviewKey = '';
          renderSugerenciasAsistente();
        }
        return;
      }
      if (esDisparadorAsistente(target)) return;
      cerrarPanelAsistente();
    });
    document.addEventListener('keydown', (event) => {
      const { editorModal } = comandosRefs();
      if (editorModal && editorModal.style.display === 'flex' && event.key === 'Escape') {
        cerrarEditorComandosModulo();
        return;
      }
      const { panel } = assistantRefs();
      if (!panel || !panel.classList.contains('is-open')) return;
      if (event.key === 'Escape') cerrarPanelAsistente();
    });
  });
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



