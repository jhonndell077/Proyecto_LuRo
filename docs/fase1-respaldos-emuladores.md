# Fase 1: respaldos verificables y pruebas aisladas

Implementación autorizada el 2 de noviembre de 2026. No modifica la aplicación, Functions, reglas publicadas, credenciales, datos de producción ni configuración Firebase principal. No hay migraciones, commits, push o despliegues en esta fase.

## Cobertura y límites

- Código confirmado: bundle Git de HEAD `02c34918b7f3a51dc327d2988ea3e3e2b08d328d` y sus ancestros. Verificado por Git y SHA-256. No contiene los cambios locales sin commit ni estos nuevos scripts. Es un respaldo privado: el historial puede contener información sensible; no publicarlo.
- Datos: fixtures nuevos y totalmente sintéticos, no derivados de clientes reales. Dos negocios, 10 documentos, agregados heredados, stock, producción, entradas, venta/factura histórica y pedido de nueve pechugas con reservas. No constituyen prueba de que todos los datos productivos estén respaldados.
- Formato de datos: JSON local `luro-local-documents-v1`. No es el formato de exportación administrada de Firestore. No soporta Timestamp, GeoPoint, DocumentReference ni bytes de Firestore; no convertir exportaciones reales mediante pérdida de tipos. Una exportación real requerirá un procedimiento específico, origen identificado y validación adicional.
- Integridad: SHA-256 de bytes, hashes canónicos por documento, conteos y esquema. El manifiesto no está firmado: detecta corrupción/inconsistencia, no una alteración intencional que recalcule todos los hashes.
- La restauración solo crea un destino inexistente. No sobrescribe fuentes, respaldos ni archivos existentes. Los scripts de respaldo JSON no contienen acceso a red o SDK Firebase.

## Archivos

| Ruta | Responsabilidad |
| --- | --- |
| `scripts/phase1/backup.cjs` | Crear, verificar y restaurar paquetes JSON locales. |
| `scripts/phase1/source-backup.cjs` | Respaldo de código confirmado mediante Git bundle; verificación de hash y revisión. |
| `tests/phase1/fixtures.cjs` | Fixtures sintéticos deterministas y validación de referencias. |
| `tests/phase1/*.test.cjs` | Corrupción, no sobrescritura, aislamiento, contratos de datos y validaciones. |
| `tests/phase1/firebase.emulators.json` | Configuración separada; únicamente Firestore, sin Hosting ni Functions. |
| `tests/phase1/firestore.rules` | Denegación completa para clientes del emulador. No sustituye `firestore.rules` del repositorio. |
| `scripts/phase1/run-emulator.ps1` | Inicio aislado con proyecto demo, configuración explícita y logs temporales. |
| `scripts/phase1/emulator-smoke.cjs` | Importar fixtures, consultar, respaldar, restaurar en otro namespace demo y comparar. |

## Ejecución repetible

Desde la raíz del repositorio:

```powershell
node --test tests/phase1/backup.test.cjs tests/phase1/fixtures.test.cjs tests/phase1/isolation.test.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/phase1/run-emulator.ps1
```

Prerrequisitos ya presentes durante la verificación: Node, Firebase CLI 15.11.0, Java 21 y Firestore Emulator 1.20.4 en caché. El runner se detiene si falta el JAR; no instala dependencias automáticamente. El runner actual está preparado para la instalación global Windows existente de Firebase CLI.

El acceso REST de prueba se restringe exactamente a `127.0.0.1:18180` y a `demo-luro-phase1` / `demo-luro-phase1-restore`. No se acepta un proyecto configurable ni un host alternativo. El runner se ejecuta desde un directorio temporal y no utiliza la configuración principal. La credencial literal `Bearer owner` es el marcador administrativo local del emulador, no una credencial real. Las reglas se comprueban mediante una petición anónima que debe recibir 403; las operaciones administrativas de fixtures las omiten deliberadamente. Esta prueba no certifica las reglas productivas ni el aislamiento completo por roles.

El proyecto demo no inicia la aplicación ni las Functions productivas. Evita activar pagos, correo, IA o integraciones. Los puertos REST/hub/logging se configuran en loopback. La suite se apaga al terminar.

Para un archivo JSON local explícito y compatible:

```powershell
node scripts/phase1/backup.cjs create RUTA_ORIGEN.json NUEVO_DIRECTORIO
node scripts/phase1/backup.cjs verify DIRECTORIO_RESPALDO
node scripts/phase1/backup.cjs restore DIRECTORIO_RESPALDO NUEVO_ARCHIVO.json
node scripts/phase1/source-backup.cjs NUEVO_DIRECTORIO_CODIGO
node scripts/phase1/source-backup.cjs verify DIRECTORIO_CODIGO
```

No proporcionar rutas a almacenes de autenticación, claves o dumps privados sin un procedimiento aprobado. Los respaldos locales no cifran datos automáticamente ni garantizan redundancia fuera del equipo.

## Evidencia de esta ejecución

- 13 pruebas Node aprobadas.
- Recorrido real de Firestore Emulator aprobado: importar y leer 10 documentos; rechazar consulta anónima; respaldar/verificar; restaurar en un segundo proyecto demo; comparar documentos y relaciones.
- Código: bundle verificado con SHA-256 `1c75d5ed08355346bf3d96fcf5efb70a3b3a197a7a609e3b849f3e6decf37d5b`.
- Respaldo local persistente: `C:\Users\USER\LuRo-Backups\phase1-765f29ff2bab48deacc801601e591368` (`source`, `synthetic` y `restored-fixtures.json`).
- Logs del emulador: `C:\Users\USER\AppData\Local\Temp\luro-phase1-emulator-a42591b761644d57a4c84fd7c86e40dc`.
- Los cambios ajenos preexistentes del workspace se conservaron.

## Pendientes antes de declarar respaldo productivo completo

1. Identificar una exportación real autorizada y su formato; preservar tipos nativos y relaciones.
2. Respaldar explícitamente los cambios locales que aún no estén confirmados, sin incluir archivos privados por descubrimiento automático.
3. Definir cifrado, destino secundario, retención, responsables y objetivos de recuperación.
4. Hacer restauración aislada y reconciliación sobre esa exportación real.
5. Añadir pruebas de roles/Auth y reglas reales en una fase autorizada; las fixtures de esta fase no crean usuarios Auth.

No comenzar consolidación de contratos, cambios de motor, autenticación ni reglas de producción por la autorización limitada a esta fase.
