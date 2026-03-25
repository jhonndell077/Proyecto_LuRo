# 🚀 CONFIGURACIÓN AUTOMÁTICA DE GITHUB ACTIONS

## PASO 1: OBTENER SERVICE ACCOUNT

### Ve a Firebase Console:
```
https://console.firebase.google.com/project/luro-control
```

### Genera Service Account:
1. ⚙️ Project Settings → Service accounts
2. "Generate new private key"
3. Selecciona "Firebase Admin SDK"
4. "Generate key"

### Copia el JSON:
```json
{
  "type": "service_account",
  "project_id": "luro-control",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-...@luro-control.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

## PASO 2: CONFIGURAR GITHUB SECRETS

### Ve a GitHub:
```
https://github.com/jhonndell077/Proyecto_LuRo/settings/secrets/actions
```

### Crea el Secret:
1. "New repository secret"
2. Name: `FIREBASE_SERVICE_ACCOUNT`
3. Value: [Pega el JSON completo aquí]
4. "Add secret"

## PASO 3: VERIFICAR

### Haz un cambio de prueba:
1. Modifica cualquier archivo
2. Commit y push
3. El workflow debería funcionar ✅

## LISTO! 🎉

Tu código quedará 100% funcional con deploy automático.
