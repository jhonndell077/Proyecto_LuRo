    // Cloud bridge: conexión frontend <-> Firebase Cloud Functions.
    (() => {
      const CLOUD_PROJECT = 'luro-control';
      const CLOUD_REGION = 'us-central1';
      const CLOUD_BASE_URL = `https://${CLOUD_REGION}-${CLOUD_PROJECT}.cloudfunctions.net`;
      const POLL_DB_MS = 1500;
      const POLL_OWNERS_MS = 8000;
      const POLL_TEAM_MS = 3200;
      const POLL_SESSION_MS = 2500;
      let cloudDbPollTimer = null;
      let cloudOwnersPollTimer = null;
      let cloudTeamPollTimer = null;
      let cloudSessionPollTimer = null;
      let cloudAuth = null;
      let cloudDbPullInFlight = false;
      let cloudOwnersPullInFlight = false;
      let cloudTeamPullInFlight = false;
      let cloudPresenceTimer = null;
      let cloudPresenceInFlight = false;

      function setTextIfExists(id, txt, color) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = txt;
        if (color) el.style.color = color;
      }

      function getDbRef() {
        try {
          if (typeof db !== 'undefined' && db) return db;
        } catch (_) {}
        return null;
      }

      function getCurrentUsername() {
        return String(window.cuentaLoginActual || window.operadorActual || '').trim().toLowerCase();
      }

      function getCurrentPassword() {
        return String(window.loginClave || '').trim();
      }

      function rememberCloudAuth(username, password, meta = {}) {
        const u = String(username || '').trim().toLowerCase();
        const p = String(password || '');
        if (!u || !p) return null;
        cloudAuth = {
          username: u,
          password: p,
          owner: String(meta.owner || u).trim().toLowerCase(),
          role: String(meta.role || '').toLowerCase(),
          at: Date.now()
        };
        return cloudAuth;
      }

      // Expose for login fallback (cuando el backend no devolvió sesión, pero las credenciales son válidas).
      window.rememberCloudAuth = rememberCloudAuth;

      function ensureCloudAuth() {
        if (cloudAuth?.username && cloudAuth?.password) return cloudAuth;
        const u = getCurrentUsername();
        const p = getCurrentPassword();
        if (u && p) return rememberCloudAuth(u, p, { owner: u });
        return null;
      }

      function normalizeCloudError(errObj) {
        const message = String(
          errObj?.details?.message ||
          errObj?.message ||
          errObj?.error?.message ||
          'Error interno del backend.'
        );
        if (/usuario maestro no existe|usuario maestro suspendido|colaborador deshabilitado|inactivo|eliminado|permission[- ]denied|insufficient/i.test(message)) {
          return MSG_USUARIO_INACTIVO;
        }
        if (/unauthenticated|auth|sesi[oó]n/i.test(message)) return 'Sesión cloud expirada. Inicie sesión nuevamente.';
        if (/credenciales|inv[aá]lid|incorrect/i.test(message)) return 'Datos incorrectos, verifique e intente nuevamente.';
        return message;
      }

      function shouldForceLogoutByCloudError(message) {
        const m = String(message || '').toLowerCase();
        return /usuario inactivo|usuario suspendido|eliminado|credenciales inv[aá]lidas|sin permisos|permission[- ]denied|unauthenticated/i.test(m);
      }

      async function postCallable(name, data = {}, opts = {}) {
        const timeoutMs = Number(opts.timeoutMs || 7000);
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), timeoutMs);
        try {
          const resp = await fetch(`${CLOUD_BASE_URL}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data }),
            signal: ctl.signal
          });
          const json = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            const msg = normalizeCloudError(json?.error || json || { message: `HTTP ${resp.status}` });
            throw new Error(msg);
          }
          if (json?.error) throw new Error(normalizeCloudError(json.error));
          return json?.result ?? null;
        } catch (e) {
          if (String(e?.name || '').toLowerCase() === 'aborterror') throw new Error('Tiempo de espera agotado al conectar con el backend.');
          const msg = String(e?.message || '');
          if (window.cuentaLoginActual && shouldForceLogoutByCloudError(msg) && typeof window.forzarLogoutPorRevocacion === 'function') {
            const aviso = String(window.MSG_USUARIO_SUSPENDIDO || MSG_USUARIO_INACTIVO || 'Usuario suspendido, comuniquese con su proveedor');
            setTimeout(() => window.forzarLogoutPorRevocacion(aviso), 0);
          }
          throw e;
        } finally {
          clearTimeout(t);
        }
      }

      async function postCallableWithSession(name, data = {}, opts = {}) {
        const s = ensureCloudAuth();
        if (!s) throw new Error('No hay sesión cloud activa.');
        return postCallable(name, {
          ...data,
          authUsername: s.username,
          authPassword: s.password,
          authOwner: String(s.owner || '').trim().toLowerCase()
        }, opts);
      }

      async function pushCloudPresence(online = true, opts = {}) {
        const s = ensureCloudAuth();
        if (!s?.username || !s?.password) return false;
        const silent = opts?.silent === true;
        const keepalive = opts?.keepalive === true;
        if (cloudPresenceInFlight && online) return false;
        if (!keepalive) cloudPresenceInFlight = true;
        try {
          if (keepalive) {
            fetch(`${CLOUD_BASE_URL}/updateSessionPresence`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: {
                  online: online === true,
                  authUsername: s.username,
                  authPassword: s.password,
                  authOwner: String(s.owner || '').trim().toLowerCase()
                }
              }),
              keepalive: true
            }).catch(() => {});
            return true;
          }
          const r = await postCallableWithSession('updateSessionPresence', { online: online === true }, { timeoutMs: 3500 });
          return !!r?.ok;
        } catch (e) {
          if (!silent) {
            const m = String(e?.message || e || 'Error interno');
            window.setStatusPublic(`No se pudo actualizar presencia: ${m}`, false);
          }
          return false;
        } finally {
          if (!keepalive) cloudPresenceInFlight = false;
        }
      }

      function stopCloudPresenceHeartbeat() {
        if (cloudPresenceTimer) clearInterval(cloudPresenceTimer);
        cloudPresenceTimer = null;
        cloudPresenceInFlight = false;
      }

      function startCloudPresenceHeartbeat() {
        stopCloudPresenceHeartbeat();
        pushCloudPresence(true, { silent: true });
        cloudPresenceTimer = setInterval(() => {
          pushCloudPresence(true, { silent: true });
        }, 25000);
      }

      // Expose for fallback flows (cuando login fue local pero hay credenciales válidas).
      window.startCloudPresenceHeartbeat = startCloudPresenceHeartbeat;
      window.stopCloudPresenceHeartbeat = stopCloudPresenceHeartbeat;
      window.pushCloudPresence = pushCloudPresence;

      function renderCloudOwnerList(list = []) {
        const ul = document.getElementById('cloud-owner-lista');
        if (!ul) return;
        const visibleList = (Array.isArray(list) ? list : []).filter((o) =>
          String(o?.username || '').trim().toLowerCase() !== USUARIO_ELIMINADO_FORZOSO
        );
        if (!visibleList.length) {
          ul.innerHTML = '<li style="color:#777;">Sin registros cloud disponibles.</li>';
          return;
        }
        ul.innerHTML = visibleList.map((o) => {
          const user = String(o?.username || '').trim().toLowerCase();
          const empresa = String(o?.empresa || '').trim();
          const estado = o?.activo === false ? 'Suspendido' : 'Activo';
          const color = o?.activo === false ? 'var(--danger)' : 'green';
          const plan = String(o?.plan || 'basico').trim().toLowerCase();
          const planTxt = plan === 'empresarial' ? 'Empresarial' : (plan === 'profesional' ? 'Profesional' : 'Básico');
          return `<li><strong>${user}</strong>${empresa ? ` - ${empresa}` : ''} <span style="color:${color};">(${estado})</span> <span style="color:#57606f;">[${planTxt}]</span></li>`;
        }).join('');
      }

      function mergeCollaboratorsFromCloud(owner, collaborators = []) {
        const ownerKey = String(owner || '').trim().toLowerCase();
        if (!ownerKey) return 0;
        const dbRef = getDbRef();
        if (!dbRef || !Array.isArray(dbRef.usuarios)) return 0;
        const mapCloud = new Map();
        (Array.isArray(collaborators) ? collaborators : []).forEach((c) => {
          const user = String(c?.username || c?.user || '').trim().toLowerCase();
          const pass = String(c?.pass || '').trim();
          if (!user || !pass) return;
          mapCloud.set(user, {
            user,
            pass,
            role: 'colaborador',
            owner: ownerKey,
            activo: c?.activo !== false,
            permisos: normalizarPermisos(c?.permisos || []),
            asignacionesEntradas: normalizarAsignacionesEntradas(c?.asignacionesEntradas || [])
          });
        });
        let cambios = 0;
        // Upsert colaboradores cloud
        mapCloud.forEach((nuevo, user) => {
          const idx = dbRef.usuarios.findIndex(u =>
            String(u?.user || '').trim().toLowerCase() === user &&
            String(u?.role || '').toLowerCase() === 'colaborador'
          );
          if (idx >= 0) {
            const prev = dbRef.usuarios[idx] || {};
            const next = { ...prev, ...nuevo };
            if (JSON.stringify(prev) !== JSON.stringify(next)) {
              dbRef.usuarios[idx] = next;
              cambios++;
            }
          } else {
            dbRef.usuarios.push(nuevo);
            cambios++;
          }
        });
        // Purga colaboradores locales que ya no existen en cloud para este owner
        const before = dbRef.usuarios.length;
        dbRef.usuarios = dbRef.usuarios.filter((u) => {
          if (String(u?.role || '').toLowerCase() !== 'colaborador') return true;
          if (String(u?.owner || '').trim().toLowerCase() !== ownerKey) return true;
          const user = String(u?.user || '').trim().toLowerCase();
          return mapCloud.has(user);
        });
        if (dbRef.usuarios.length !== before) cambios++;
        if (cambios > 0 && typeof window.guardarDatos === 'function') window.guardarDatos();
        if (cambios > 0 && typeof window.actualizarTablaColaboradores === 'function') window.actualizarTablaColaboradores();
        if (typeof window.verificarColaboradorSesionRevocadaEnNube === 'function') {
          window.verificarColaboradorSesionRevocadaEnNube(ownerKey, collaborators);
        }
        return cambios;
      }

      window.setStatusPublic = function (msg, ok = true) {
        setTextIfExists('cloud-owner-status', String(msg || ''), ok ? '#1f8f4c' : '#c0392b');
      };

      window.setSyncStatusPublic = function (msg, ok = true) {
        setTextIfExists('cloud-sync-status', String(msg || ''), ok ? '#1f8f4c' : '#c0392b');
      };

      window.autenticarSesionBackend = async function (username, password) {
        const u = String(username || '').trim().toLowerCase();
        const p = String(password || '');
        if (!u || !p) return null;
        window.__ultimoErrorAuthCloud = '';
        try {
          const result = await postCallable('authenticateSession', { username: u, password: p }, { timeoutMs: 3500 });
          if (!result?.ok) return null;
          rememberCloudAuth(u, p, result);
          startCloudPresenceHeartbeat();
          window.setStatusPublic(`Sesión cloud activa para ${String(result.owner || u)}.`);
          return {
            ok: true,
            role: result.role,
            owner: result.owner,
            username: result.username,
            permisos: Array.isArray(result.permisos) ? result.permisos : [],
            asignacionesEntradas: Array.isArray(result.asignacionesEntradas) ? result.asignacionesEntradas : []
          };
        } catch (e) {
          const msg = String(e?.message || e || 'Error interno del backend.');
          window.__ultimoErrorAuthCloud = msg;
          window.setStatusPublic(`Error auth listener: ${msg}`, false);
          return null;
        }
      };

      window.cerrarSesionBackend = async function () {
        await pushCloudPresence(false, { silent: true });
        stopCloudPresenceHeartbeat();
        cloudAuth = null;
        window.detenerListenerCloudTiempoReal();
        window.setStatusPublic('Sesión cloud cerrada.', true);
        return true;
      };

      window.actualizarPasswordCloud = async function (oldPass, newPass) {
        const prevPass = String(oldPass || '');
        const nextPass = String(newPass || '');
        if (!prevPass || !nextPass) return false;
        try {
          const r = await postCallableWithSession('changeOwnPassword', { oldPass: prevPass, newPass: nextPass }, { timeoutMs: 7000 });
          if (!r?.ok) throw new Error('No se pudo actualizar la contraseña en cloud.');
          if (cloudAuth) cloudAuth.password = nextPass;
          if (typeof window.loginClave !== 'undefined') window.loginClave = nextPass;
          return true;
        } catch (e) {
          const m = String(e?.message || e || 'Error interno');
          window.setStatusPublic(`No se pudo cambiar la contraseña en cloud: ${m}`, false);
          alert(`No se pudo cambiar la contraseña en cloud.\n${m}`);
          return false;
        }
      };

      window.validarSesionActivaCloud = async function (opts = {}) {
        const silent = opts?.silent === true;
        const s = ensureCloudAuth();
        if (!s?.username || !s?.password) return null;
        try {
          const r = await postCallable('authenticateSession', {
            username: s.username,
            password: s.password,
            owner: String(s.owner || '').trim().toLowerCase()
          }, { timeoutMs: 3000 });
          return !!(r && r.ok);
        } catch (e) {
          const msg = String(e?.message || e || 'Error interno');
          if (window.cuentaLoginActual && shouldForceLogoutByCloudError(msg) && typeof window.forzarLogoutPorRevocacion === 'function') {
            const aviso = String(window.MSG_USUARIO_SUSPENDIDO || 'Usuario suspendido, comuniquese con su proveedor');
            window.forzarLogoutPorRevocacion(aviso);
            return false;
          }
          if (!silent) window.setStatusPublic(`Error validando sesión: ${msg}`, false);
          // Error transitorio (red/timeout): no forzar cierre.
          return null;
        }
      };

      window.crearOwner = async function () {
        const username = String(document.getElementById('cloud-owner-username')?.value || '').trim().toLowerCase();
        const pass = String(document.getElementById('cloud-owner-pass')?.value || '').trim();
        const empresa = String(document.getElementById('cloud-owner-empresa')?.value || '').trim();
        if (!username || !pass) {
          alert('Complete usuario y contraseña.');
          return false;
        }
        try {
          await postCallableWithSession('createMasterUser', { username, pass, empresa }, { timeoutMs: 8000 });
          window.setStatusPublic(`Usuario maestro ${username} guardado en cloud.`);
          await window.refrescarListaOwnersCloud({ silent: true });
          return true;
        } catch (e) {
          const m = String(e?.message || e || 'Error interno');
          window.setStatusPublic(`No se pudo guardar en Firebase: ${m}`, false);
          alert(`No se pudo guardar en Firebase.\n${m}`);
          return false;
        }
      };

      window.subirBaseActualAlCloud = async function (opts = {}) {
        const silent = opts?.silent === true;
        try {
          const payloadDb = (typeof window.exportarDBParaCloud === 'function')
            ? window.exportarDBParaCloud()
            : getDbRef();
          if (!payloadDb || typeof payloadDb !== 'object') throw new Error('Base local inválida.');
          await postCallableWithSession('upsertOwnerData', {
            db: payloadDb,
            updatedAtClient: Date.now(),
            syncKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          }, { timeoutMs: 9000 });
          window.setSyncStatusPublic('Base subida al cloud correctamente.');
          return true;
        } catch (e) {
          const m = String(e?.message || e || 'Error interno');
          window.setSyncStatusPublic(`Error al subir: ${m}`, false);
          if (!silent) alert(`No se pudo subir al Cloud: ${m}`);
          return false;
        }
      };

      window.descargarBaseDesdeCloud = async function (opts = {}) {
        const silent = opts?.silent === true;
        const reload = opts?.reload !== false;
        const fromCloudListener = opts?.fromCloudListener === true;
        if (cloudDbPullInFlight) return false;
        cloudDbPullInFlight = true;
        try {
          const result = await postCallableWithSession('getOwnerData', {}, { timeoutMs: 9000 });
          if (!result?.ok || !result?.db) {
            window.setSyncStatusPublic('Cloud sin datos para esta cuenta.', false);
            return false;
          }
          if (typeof window.importarDBDesdeCloud === 'function') {
            window.importarDBDesdeCloud(result.db, { fromCloudListener });
          }
          window.setSyncStatusPublic('Base descargada desde cloud.');
          if (reload && !fromCloudListener && typeof window.refrescarUITrasSyncCloud === 'function') {
            window.refrescarUITrasSyncCloud();
          }
          return true;
        } catch (e) {
          const m = String(e?.message || e || 'Error interno');
          window.setSyncStatusPublic(`Error al descargar: ${m}`, false);
          if (!silent) alert(`No se pudo descargar del Cloud: ${m}`);
          return false;
        } finally {
          cloudDbPullInFlight = false;
        }
      };

      window.refrescarListaOwnersCloud = async function (opts = {}) {
        const silent = opts?.silent === true;
        if (cloudOwnersPullInFlight) return [];
        cloudOwnersPullInFlight = true;
        try {
          const r = await postCallableWithSession('listMasterUsers', {}, { timeoutMs: 7000 });
          const owners = Array.isArray(r?.owners) ? r.owners : [];
          window.luroCloudOwnersCache = owners;
          renderCloudOwnerList(owners);
          if (typeof window.sincronizarOwnersNubeALocal === 'function') {
            window.sincronizarOwnersNubeALocal(owners);
          }
          return owners;
        } catch (e) {
          if (!silent) {
            window.setStatusPublic(`Error auth listener: ${String(e?.message || e || 'Error interno')}`, false);
          }
          return [];
        } finally {
          cloudOwnersPullInFlight = false;
        }
      };

      window.refrescarColaboradoresCloud = async function (opts = {}) {
        const silent = opts?.silent === true;
        const owner = String(opts?.owner || window.obtenerOwnerSesionActual?.() || '').trim().toLowerCase();
        if (!owner) return [];
        if (cloudTeamPullInFlight) return [];
        cloudTeamPullInFlight = true;
        try {
          const r = await postCallableWithSession('listTeamMembers', { owner }, { timeoutMs: 8000 });
          const list = Array.isArray(r?.collaborators) ? r.collaborators : [];
          mergeCollaboratorsFromCloud(owner, list);
          return list;
        } catch (e) {
          if (!silent) window.setStatusPublic(`Error sync colaboradores: ${String(e?.message || e || 'Error interno')}`, false);
          return [];
        } finally {
          cloudTeamPullInFlight = false;
        }
      };

      window.iniciarListenerCloudTiempoReal = function () {
        window.detenerListenerCloudTiempoReal();
        cloudDbPollTimer = setInterval(() => {
          if (window.__cloudApplyingRemote) return;
          if (window.__cloudLocalChangeAt && (Date.now() - window.__cloudLocalChangeAt) < (window.__cloudRemoteSettleMs || 2200)) return;
          window.descargarBaseDesdeCloud({ silent: true, reload: false, fromCloudListener: true });
        }, POLL_DB_MS);
        cloudOwnersPollTimer = setInterval(() => {
          window.refrescarListaOwnersCloud({ silent: true });
        }, POLL_OWNERS_MS);
        cloudTeamPollTimer = setInterval(() => {
          window.refrescarColaboradoresCloud({ silent: true });
        }, POLL_TEAM_MS);
        cloudSessionPollTimer = setInterval(() => {
          window.validarSesionActivaCloud({ silent: true });
        }, POLL_SESSION_MS);
        window.__cloudListenerActivo = true;
        window.setStatusPublic(`Listener cloud activo para ${String(ensureCloudAuth()?.username || '-')}.`);
        window.validarSesionActivaCloud({ silent: true });
      };

      window.detenerListenerCloudTiempoReal = function () {
        if (cloudDbPollTimer) clearInterval(cloudDbPollTimer);
        if (cloudOwnersPollTimer) clearInterval(cloudOwnersPollTimer);
        if (cloudTeamPollTimer) clearInterval(cloudTeamPollTimer);
        if (cloudSessionPollTimer) clearInterval(cloudSessionPollTimer);
        cloudDbPollTimer = null;
        cloudOwnersPollTimer = null;
        cloudTeamPollTimer = null;
        cloudSessionPollTimer = null;
        window.__cloudListenerActivo = false;
      };

      window.sincronizarEstadoUsuarioMaestroNube = async function (username, activo) {
        try {
          await postCallableWithSession('setMasterStatus', { username, activo: activo !== false }, { timeoutMs: 8000 });
          await window.refrescarListaOwnersCloud({ silent: true });
          return true;
        } catch (e) {
          alert(`No se pudo actualizar usuario maestro.\n${String(e?.message || e || 'Error interno')}`);
          return false;
        }
      };

      window.eliminarUsuarioMaestroNube = async function (username) {
        try {
          await postCallableWithSession('deleteMasterAccount', { username }, { timeoutMs: 8000 });
          await window.refrescarListaOwnersCloud({ silent: true });
          return true;
        } catch (e) {
          alert(`No se pudo eliminar usuario maestro.\n${String(e?.message || e || 'Error interno')}`);
          return false;
        }
      };

      window.eliminarOwnerDesdeListaNube = async function (username) {
        return window.eliminarUsuarioMaestroNube(username);
      };

      window.obtenerBovedaMasterCloud = async function () {
        const r = await postCallableWithSession('getMasterVaultOverview', {}, { timeoutMs: 9000 });
        return r || { ok: false, owners: [] };
      };

      window.eliminarColaboradorBovedaCloud = async function (owner, username) {
        const r = await postCallableWithSession('purgeTeamMemberHard', {
          owner: String(owner || '').trim().toLowerCase(),
          username: String(username || '').trim().toLowerCase()
        }, { timeoutMs: 9000 });
        return !!r?.ok;
      };

      window.eliminarUsuarioMaestroBovedaCloud = async function (username) {
        const r = await postCallableWithSession('purgeMasterAccountHard', {
          username: String(username || '').trim().toLowerCase()
        }, { timeoutMs: 12000 });
        return !!r?.ok;
      };

      window.listarNotificacionesPagosMasterCloud = async function (limit = 80) {
        const r = await postCallableWithSession('listMasterPaymentNotifications', { limit }, { timeoutMs: 9000 });
        return Array.isArray(r?.notifications) ? r.notifications : [];
      };

      window.obtenerResumenControlMasterCloud = async function () {
        const r = await postCallableWithSession('getMasterControlSummary', {}, { timeoutMs: 10000 });
        return r?.stats || null;
      };

      window.obtenerDetalleControlMasterCloud = async function (type) {
        const t = String(type || '').trim();
        if (!t) return [];
        const r = await postCallableWithSession('getMasterControlDetails', { type: t }, { timeoutMs: 12000 });
        return Array.isArray(r?.items) ? r.items : [];
      };

      window.eliminarDetalleControlMasterCloud = async function (payload = {}) {
        const r = await postCallableWithSession('deleteMasterControlDetail', payload, { timeoutMs: 12000 });
        return !!r?.ok;
      };

      window.crearCheckoutCambioMembresia = async function (payload = {}) {
        const plan = String(payload?.plan || 'basico').trim().toLowerCase();
        const billingDay = Number(payload?.billingDay || 0);
        const r = await postCallableWithSession('createMembershipCheckout', { plan, billingDay }, { timeoutMs: 9000 });
        return r || null;
      };

      window.sincronizarColaboradorNube = async function (colab, opts = {}) {
        const silent = opts?.silent === true;
        try {
          await postCallableWithSession('createTeamMember', {
            username: String(colab?.user || '').trim().toLowerCase(),
            pass: String(colab?.pass || ''),
            permisos: Array.isArray(colab?.permisos) ? colab.permisos : [],
            asignacionesEntradas: Array.isArray(colab?.asignacionesEntradas) ? colab.asignacionesEntradas : [],
            activo: colab?.activo !== false
          }, { timeoutMs: 8000 });
          return true;
        } catch (e) {
          if (!silent) alert(`Error al sincronizar colaborador.\n${String(e?.message || e || 'Error interno')}`);
          return false;
        }
      };

      window.eliminarColaboradorNube = async function (_owner, username, opts = {}) {
        const silent = opts?.silent === true;
        try {
          await postCallableWithSession('deleteTeamMember', {
            username: String(username || '').trim().toLowerCase()
          }, { timeoutMs: 8000 });
          return true;
        } catch (e) {
          if (!silent) alert(`Error al eliminar colaborador cloud.\n${String(e?.message || e || 'Error interno')}`);
          return false;
        }
      };

      window.buscarCredencialesColaboradorNube = async function () {
        return null;
      };

      window.obtenerOwnerMaestroNube = async function (owner) {
        const target = String(owner || '').trim().toLowerCase();
        if (!target) return null;
        const list = Array.isArray(window.luroCloudOwnersCache) ? window.luroCloudOwnersCache : [];
        const f = list.find(x => String(x?.username || '').trim().toLowerCase() === target);
        if (!f) return null;
        return {
          user: target,
          pass: String(f.pass || ''),
          role: target === 'jssantana077' ? 'super-master' : 'admin',
          owner: target,
          activo: f.activo !== false
        };
      };

      window.sincronizarColaboradoresLocalesANube = async function (opts = {}) {
        const owner = String(opts?.owner || window.obtenerOwnerSesionActual?.() || '').trim().toLowerCase();
        const silent = opts?.silent === true;
        if (!owner) return 0;
        const dbRef = getDbRef();
        const list = (dbRef?.usuarios || []).filter(u =>
          String(u?.role || '').toLowerCase() === 'colaborador' &&
          String(u?.owner || '').trim().toLowerCase() === owner
        );
        let okCount = 0;
        for (const c of list) {
          const ok = await window.sincronizarColaboradorNube(c, { silent: true });
          if (ok) okCount++;
        }
        if (!silent) window.setStatusPublic(`Colaboradores sincronizados: ${okCount}/${list.length}`);
        return okCount;
      };

      document.addEventListener('DOMContentLoaded', () => {
        window.setStatusPublic('Conectando a Firebase...');
        window.setSyncStatusPublic('Sincronización manual disponible.');
      });

      window.addEventListener('online', async () => {
        try {
          window.setStatusPublic('Conexión restablecida. Sincronizando...');
          startCloudPresenceHeartbeat();
          await window.subirBaseActualAlCloud({ silent: true });
          await window.descargarBaseDesdeCloud({ silent: true, reload: false });
          await window.refrescarListaOwnersCloud({ silent: true });
          await window.refrescarColaboradoresCloud({ silent: true });
          window.setStatusPublic('Sincronización cloud restablecida.');
        } catch (_) {}
      });

      window.addEventListener('pagehide', () => {
        pushCloudPresence(false, { silent: true, keepalive: true });
        stopCloudPresenceHeartbeat();
      });
    })();
