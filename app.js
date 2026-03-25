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
function cambiarMiPassword() {
    const oldPass = document.getElementById('my_old_pass').value;
    const newPass = document.getElementById('my_new_pass').value;
    const confirmPass = document.getElementById('my_new_pass_confirm').value;

    if ((sesionUser.user || "").trim().toLowerCase() === MASTER_USER) {
        return alert("🔒 La contraseña del usuario maestro es fija y no puede cambiarse.");
    }

    // 1. Validar que la contraseña actual sea correcta
    if (oldPass !== sesionUser.pass) {
        return alert("❌ La contraseña actual es incorrecta.");
    }

    // 2. Validar que las nuevas coincidan
    if (newPass === "" || newPass !== confirmPass) {
        return alert("⚠️ Las nuevas contraseñas no coinciden o están vacías.");
    }

    // 3. Actualizar en la base de datos (db.usuarios)
    const userIndex = db.usuarios.findIndex(u => u.user === sesionUser.user);
    if (userIndex !== -1) {
        db.usuarios[userIndex].pass = newPass;
        sesionUser.pass = newPass; // Actualizar sesión actual
        guardarDatos();
        alert("✅ Contraseña actualizada correctamente.");
        
        // Limpiar campos
        document.getElementById('my_old_pass').value = "";
        document.getElementById('my_new_pass').value = "";
        document.getElementById('my_new_pass_confirm').value = "";
    }
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
async function crearColaborador() {
    const nombreInput = document.getElementById('colab_name');
    const passInput = document.getElementById('colab_pass');
    const nombre = nombreInput.value.trim().toLowerCase();
    const pass = passInput.value;
    const permisosChecks = document.querySelectorAll('.colab-perm:checked');
    const permisos = normalizarPermisos(Array.from(permisosChecks).map(c => c.value));
    const entradasChecks = document.querySelectorAll('.colab-entry:checked');
    const asignacionesEntradas = normalizarAsignacionesEntradas(Array.from(entradasChecks).map(c => c.value));

    if (!nombre || !pass) return alert("⚠️ Complete los datos del colaborador.");
    if (db.usuarios.find(u => u.user === nombre)) {
        return alert("⚠️ Ese usuario ya existe.");
    }
    if (permisos.length <= 1) {
        return alert("⚠️ Seleccione al menos una casilla de acceso para el colaborador.");
    }

    const ownerSesion = String(window.obtenerOwnerSesionActual?.() || sesionUser?.user || '').trim().toLowerCase();
    if (!ownerSesion || esColaboradorSesion) return alert("⛔ Solo un usuario maestro activo puede crear colaboradores.");
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

    if (typeof window.sincronizarColaboradorNube !== 'function') {
        return alert("☁️ Backend cloud no está disponible.");
    }
    const okCloud = await window.sincronizarColaboradorNube(nuevoColaborador, { silent: true });
    if (okCloud === false) {
        return alert("❌ No se pudo crear el colaborador en la nube.");
    }

    db.usuarios.push(nuevoColaborador);

    guardarDatos();
    if (typeof window.autoSubirCloudUrgente === 'function') window.autoSubirCloudUrgente();
    actualizarTablaColaboradores();
    
    nombreInput.value = "";
    passInput.value = "";
    document.querySelectorAll('.colab-perm').forEach(c => c.checked = false);
    document.querySelectorAll('.colab-perm-group').forEach(c => c.checked = false);
    document.querySelectorAll('.colab-entry').forEach(c => c.checked = false);
    alert("✅ Miembro de equipo añadido.");
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
                <button class="btn-warning" onclick="toggleAccesoColaborador('${c.user}')" style="background:#ffa801; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-right:6px;">${txtAcceso}</button>
                <button class="btn-danger" onclick="eliminarColaborador('${c.user}')" style="background:#ff4444; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Remover</button>
            </td>
        `;
        tabla.appendChild(row);
    });
}

async function eliminarUsuario(username) {
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
}

async function eliminarColaborador(nombreColab) {
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

const MSG_USUARIO_INACTIVO = "Usuario Inactivo o eliminado. Comuníquese con su proveedor.";

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

window.verificarSesionRevocadaEnNube = function(registrosNube = []) {
    if (!sesionUser || !sesionUser.user) return false;
    if (!Array.isArray(registrosNube) || !registrosNube.length) return false;
    const ownerSesion = String(window.obtenerOwnerSesionActual?.() || '').trim().toLowerCase();
    if (!ownerSesion) return false;
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

// Función para toggle del menú flotante
function toggleMenuFlotante() {
    const sidebar = document.getElementById('sidebar');
    const toggleCircle = document.querySelector('.menu-toggle-circle');
    
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        toggleCircle.classList.remove('active');
        toggleCircle.innerHTML = '☰';
    } else {
        sidebar.classList.add('active');
        toggleCircle.classList.add('active');
        toggleCircle.innerHTML = '✕';
    }
}

// Función para cerrar el menú al hacer clic en el sidebar-brand
function cerrarMenuDesdeBrand() {
    const sidebar = document.getElementById('sidebar');
    const toggleCircle = document.querySelector('.menu-toggle-circle');
    
    sidebar.classList.remove('active');
    toggleCircle.classList.remove('active');
    toggleCircle.innerHTML = '☰';
}
