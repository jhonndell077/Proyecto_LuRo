const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const MASTER_USER = String(process.env.MASTER_USER || "jssantana077").trim().toLowerCase();
const MASTER_PASS = String(process.env.MASTER_PASS || "852347");
const FORCED_REMOVED_USER = "todo en pan";
const INACTIVE_MSG = "Usuario Inactivo o eliminado. Comuníquese con su proveedor.";

function norm(v) {
  return String(v || "").trim().toLowerCase();
}

function mustAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debe iniciar sesiÃ³n.");
  return request.auth;
}

function claims(request) {
  return request.auth?.token || {};
}

async function getOwnerDoc(owner) {
  const id = norm(owner);
  if (!id) return null;
  if (id === FORCED_REMOVED_USER) return null;
  if (id === MASTER_USER) {
    return {
      id: MASTER_USER,
      data: {
        username: MASTER_USER,
        pass: MASTER_PASS,
        activo: true,
        empresa: "MASTER"
      }
    };
  }
  const direct = await db.collection("owners").doc(id).get();
  if (direct.exists) return { id, data: direct.data() || {} };
  const q = await db.collection("owners").where("username", "==", id).limit(1).get();
  if (q.empty) return null;
  return { id: q.docs[0].id, data: q.docs[0].data() || {} };
}

function isPasswordMatch(stored, incoming) {
  return String(stored || "") === String(incoming || "");
}

async function assertOwnerActive(owner) {
  if (norm(owner) === MASTER_USER) {
    return {
      id: MASTER_USER,
      data: { username: MASTER_USER, activo: true, pass: MASTER_PASS, empresa: "MASTER" }
    };
  }
  const o = await getOwnerDoc(owner);
  if (!o) throw new HttpsError("permission-denied", INACTIVE_MSG);
  if (o.data.activo === false) throw new HttpsError("permission-denied", INACTIVE_MSG);
  return o;
}

function canManageOwner(request, owner) {
  const c = claims(request);
  const ownerClaim = norm(c.owner);
  return c.superMaster === true || ownerClaim === norm(owner);
}

async function resolveSession(request, allowCredentialFallback = false) {
  if (request.auth) {
    const c = claims(request);
    const owner = norm(c.owner);
    return {
      owner,
      username: norm(c.username),
      role: String(c.role || "").toLowerCase(),
      superMaster: c.superMaster === true,
      collaborator: c.collaborator === true,
      via: "auth"
    };
  }
  if (!allowCredentialFallback) throw new HttpsError("unauthenticated", "Debe iniciar sesiÃ³n.");

  const username = norm(request.data?.authUsername);
  const password = String(request.data?.authPassword || "");
  if (!username || !password) throw new HttpsError("unauthenticated", "Sin credenciales de respaldo.");
  if (username === FORCED_REMOVED_USER) throw new HttpsError("permission-denied", INACTIVE_MSG);

  // Permitir super-master fijo tambiÃ©n en fallback de credenciales para operaciones cloud.
  if (username === MASTER_USER && password === MASTER_PASS) {
    return {
      owner: MASTER_USER,
      username: MASTER_USER,
      role: "super-master",
      superMaster: true,
      collaborator: false,
      via: "credentials"
    };
  }

  const ownerEntry = await getOwnerDoc(username);
  if (ownerEntry && isPasswordMatch(ownerEntry.data.pass, password) && ownerEntry.data.activo !== false) {
    const role = username === MASTER_USER ? "super-master" : "admin";
    return {
      owner: username,
      username,
      role,
      superMaster: role === "super-master",
      collaborator: false,
      via: "credentials"
    };
  }

  const q = await db.collection("autorizaciones").where("username", "==", username).limit(5).get();
  let colab = null;
  q.forEach((d) => {
    if (colab) return;
    const data = d.data() || {};
    if (isPasswordMatch(data.pass, password)) colab = data;
  });
  if (!colab) throw new HttpsError("permission-denied", "Credenciales invÃ¡lidas.");
  if (colab.activo === false) throw new HttpsError("permission-denied", INACTIVE_MSG);
  const owner = norm(colab.owner);
  await assertOwnerActive(owner);
  return {
    owner,
    username,
    role: "colaborador",
    superMaster: false,
    collaborator: true,
    via: "credentials"
  };
}

exports.authenticateSession = onCall(async (request) => {
  const username = norm(request.data?.username);
  const password = String(request.data?.password || "");
  if (!username || !password) throw new HttpsError("invalid-argument", "Credenciales incompletas.");
  if (username === FORCED_REMOVED_USER) throw new HttpsError("permission-denied", INACTIVE_MSG);

  // Fallback seguro para super-master fijo (evita bloqueo si owners no tiene registro aÃºn).
  if (username === MASTER_USER && password === MASTER_PASS) {
    return {
      ok: true,
      role: "super-master",
      owner: MASTER_USER,
      username: MASTER_USER,
      permisos: [],
      asignacionesEntradas: ["manual", "automatica", "historial"]
    };
  }

  const ownerEntry = await getOwnerDoc(username);
  if (ownerEntry && isPasswordMatch(ownerEntry.data.pass, password) && ownerEntry.data.activo !== false) {
    const role = username === MASTER_USER ? "super-master" : "admin";
    return {
      ok: true,
      role,
      owner: username,
      username,
      permisos: [],
      asignacionesEntradas: ["manual", "automatica", "historial"]
    };
  }

  const q = await db.collection("autorizaciones").where("username", "==", username).limit(5).get();
  let found = null;
  q.forEach((d) => {
    if (found) return;
    const data = d.data() || {};
    if (isPasswordMatch(data.pass, password)) found = { id: d.id, data };
  });
  if (!found) throw new HttpsError("permission-denied", "Credenciales invÃ¡lidas.");
  if (found.data.activo === false) throw new HttpsError("permission-denied", INACTIVE_MSG);

  const owner = norm(found.data.owner);
  await assertOwnerActive(owner);
  return {
    ok: true,
    role: "colaborador",
    owner,
    username,
    permisos: Array.isArray(found.data.permisos) ? found.data.permisos : ["home", "salida"],
    asignacionesEntradas: Array.isArray(found.data.asignacionesEntradas) ? found.data.asignacionesEntradas : []
  };
});

exports.createMasterUser = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");

  const username = norm(request.data?.username);
  const pass = String(request.data?.pass || "").trim();
  const empresa = String(request.data?.empresa || "").trim();
  if (!username || !pass) throw new HttpsError("invalid-argument", "Datos incompletos.");
  if (username === FORCED_REMOVED_USER) throw new HttpsError("failed-precondition", "Usuario reservado.");
  if (username === MASTER_USER) throw new HttpsError("failed-precondition", "Usuario reservado.");

  await db.collection("owners").doc(username).set({
    username,
    pass,
    empresa,
    activo: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: norm(s.username || "")
  }, { merge: true });
  return { ok: true, username };
});

exports.setMasterStatus = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const username = norm(request.data?.username);
  const activo = request.data?.activo !== false;
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
  if (username === MASTER_USER) throw new HttpsError("failed-precondition", "No puede suspender super master.");
  if (!(s.superMaster === true || norm(s.owner) === username)) throw new HttpsError("permission-denied", "Sin permisos.");

  await db.collection("owners").doc(username).set({
    username,
    activo,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const q = await db.collection("autorizaciones").where("owner", "==", username).get();
  const batch = db.batch();
  q.forEach((d) => batch.set(d.ref, { activo, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }));
  if (!q.empty) await batch.commit();
  return { ok: true, username, activo, collaborators: q.size };
});

exports.deleteMasterAccount = onCall(async (request) => {
  const s = await resolveSession(request, true);
  if (s.superMaster !== true) throw new HttpsError("permission-denied", "Solo super master.");
  const username = norm(request.data?.username);
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
  if (username === MASTER_USER) throw new HttpsError("failed-precondition", "No puede eliminar super master.");

  const dels = [];
  dels.push(db.collection("owners").doc(username).delete());
  dels.push(db.collection("datos_del_propietario").doc(username).delete());
  const q = await db.collection("autorizaciones").where("owner", "==", username).get();
  q.forEach((d) => dels.push(d.ref.delete()));
  await Promise.all(dels);
  return { ok: true, username, collaboratorsDeleted: q.size };
});

exports.createTeamMember = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const owner = norm(s.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  if (s.role !== "admin" && s.role !== "super-master") throw new HttpsError("permission-denied", "Solo maestro.");
  await assertOwnerActive(owner);

  const username = norm(request.data?.username);
  const pass = String(request.data?.pass || "").trim();
  const permisos = Array.isArray(request.data?.permisos) ? request.data.permisos : ["home", "salida"];
  const asignacionesEntradas = Array.isArray(request.data?.asignacionesEntradas) ? request.data.asignacionesEntradas : [];
  const activo = request.data?.activo !== false;
  if (!username || !pass) throw new HttpsError("invalid-argument", "Datos incompletos.");
  if (username === FORCED_REMOVED_USER) throw new HttpsError("failed-precondition", "Usuario reservado.");

  const ownerExists = await getOwnerDoc(username);
  if (ownerExists) throw new HttpsError("already-exists", "Ese username pertenece a un maestro.");

  const docId = `${owner}__${username}`;
  await db.collection("autorizaciones").doc(docId).set({
    owner,
    username,
    pass,
    role: "colaborador",
    activo,
    permisos: Array.from(new Set(permisos)),
    asignacionesEntradas: Array.from(new Set(asignacionesEntradas)),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: norm(s.username || owner)
  }, { merge: true });
  return { ok: true, owner, username };
});

exports.listMasterUsers = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const isSuper = s.superMaster === true;
  const owner = norm(s.owner);
  const owners = [];

  if (isSuper) {
    const snap = await db.collection("owners").get();
    let hasMaster = false;
    let foundForcedRemovedOwner = false;
    snap.forEach((d) => {
      const data = d.data() || {};
      const uname = norm(data.username || d.id);
      if (uname === FORCED_REMOVED_USER) {
        foundForcedRemovedOwner = true;
        return;
      }
      if (uname === MASTER_USER) hasMaster = true;
      owners.push({
        username: uname,
        pass: String(data.pass || ""),
        empresa: String(data.empresa || ""),
        activo: data.activo !== false
      });
    });
    if (foundForcedRemovedOwner) {
      await db.collection("owners").doc(FORCED_REMOVED_USER).delete();
      await db.collection("datos_del_propietario").doc(FORCED_REMOVED_USER).delete();
      const q = await db.collection("autorizaciones").where("owner", "==", FORCED_REMOVED_USER).get();
      const batch = db.batch();
      q.forEach((d) => batch.delete(d.ref));
      if (!q.empty) await batch.commit();
    }
    if (!hasMaster) {
      owners.push({
        username: MASTER_USER,
        pass: MASTER_PASS,
        empresa: "MASTER",
        activo: true
      });
    }
  } else if (owner) {
    const o = await getOwnerDoc(owner);
    if (o) {
      owners.push({
        username: norm(o.data.username || o.id),
        pass: String(o.data.pass || ""),
        empresa: String(o.data.empresa || ""),
        activo: o.data.activo !== false
      });
    }
  }

  return { ok: true, owners };
});

exports.listTeamMembers = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const ownerReq = norm(request.data?.owner);
  const owner = s.superMaster === true
    ? (ownerReq || norm(s.owner))
    : norm(s.owner);
  if (!owner) throw new HttpsError("invalid-argument", "Owner requerido.");
  if (owner === FORCED_REMOVED_USER) return { ok: true, owner, collaborators: [] };
  await assertOwnerActive(owner);

  const q = await db.collection("autorizaciones").where("owner", "==", owner).get();
  const collaborators = [];
  q.forEach((d) => {
    const it = d.data() || {};
    const username = norm(it.username || d.id.split("__")[1] || "");
    if (!username || username === FORCED_REMOVED_USER) return;
    collaborators.push({
      owner,
      username,
      pass: String(it.pass || ""),
      role: "colaborador",
      activo: it.activo !== false,
      permisos: Array.isArray(it.permisos) ? Array.from(new Set(it.permisos)) : ["home", "salida"],
      asignacionesEntradas: Array.isArray(it.asignacionesEntradas) ? Array.from(new Set(it.asignacionesEntradas)) : []
    });
  });
  return { ok: true, owner, collaborators };
});

exports.setTeamMemberStatus = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const owner = norm(s.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  if (s.role !== "admin" && s.role !== "super-master") throw new HttpsError("permission-denied", "Solo maestro.");
  await assertOwnerActive(owner);

  const username = norm(request.data?.username);
  const activo = request.data?.activo !== false;
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
  const docId = `${owner}__${username}`;
  await db.collection("autorizaciones").doc(docId).set({
    owner,
    username,
    activo,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: norm(s.username || owner)
  }, { merge: true });
  return { ok: true, owner, username, activo };
});

exports.deleteTeamMember = onCall(async (request) => {
  const s = await resolveSession(request, true);
  const owner = norm(s.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  if (s.role !== "admin" && s.role !== "super-master") throw new HttpsError("permission-denied", "Solo maestro.");
  await assertOwnerActive(owner);

  const username = norm(request.data?.username);
  if (!username) throw new HttpsError("invalid-argument", "Username requerido.");
  const docId = `${owner}__${username}`;
  await db.collection("autorizaciones").doc(docId).delete();
  return { ok: true, owner, username };
});

exports.upsertOwnerData = onCall(async (request) => {
  const c = await resolveSession(request, true);
  const owner = norm(c.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  await assertOwnerActive(owner);

  if (c.collaborator === true) {
    const username = norm(c.username);
    const id = `${owner}__${username}`;
    const colDoc = await db.collection("autorizaciones").doc(id).get();
    const colData = colDoc.data() || {};
    if (!colDoc.exists || colData.activo === false) {
      throw new HttpsError("permission-denied", INACTIVE_MSG);
    }
  }

  const payload = request.data?.db;
  if (!payload || typeof payload !== "object") throw new HttpsError("invalid-argument", "DB invÃ¡lida.");
  await db.collection("datos_del_propietario").doc(owner).set({
    owner,
    db: payload,
    "base de datos": payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAtClient: Number(request.data?.updatedAtClient || Date.now()),
    syncKey: String(request.data?.syncKey || `${Date.now()}`),
    updatedBy: norm(c.username || owner),
    updatedFrom: "server-callable"
  }, { merge: true });
  return { ok: true, owner };
});

exports.getOwnerData = onCall(async (request) => {
  const c = await resolveSession(request, true);
  const owner = norm(c.owner);
  if (!owner) throw new HttpsError("permission-denied", "SesiÃ³n sin owner.");
  await assertOwnerActive(owner);

  if (c.collaborator === true) {
    const username = norm(c.username);
    const id = `${owner}__${username}`;
    const colDoc = await db.collection("autorizaciones").doc(id).get();
    const colData = colDoc.data() || {};
    if (!colDoc.exists || colData.activo === false) {
      throw new HttpsError("permission-denied", INACTIVE_MSG);
    }
  }

  const snap = await db.collection("datos_del_propietario").doc(owner).get();
  if (!snap.exists) return { ok: false, owner, db: null };
  const data = snap.data() || {};
  return { ok: true, owner, db: data.db || data["base de datos"] || null, raw: data };
});
