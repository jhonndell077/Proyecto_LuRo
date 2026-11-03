# Preparación de publicación — fase 1

Fecha de referencia: 2 de noviembre de 2026, America/Santo_Domingo. Baseline: `02c34918b7f3a51dc327d2988ea3e3e2b08d328d`.

## Resultado y alcance

Las herramientas de fase 1 se pueden revisar, respaldar y probar localmente. **No hay cambios funcionales del POS 3.0 para desplegar:** la fase aprobada prepara respaldos y emuladores. No es una certificación de disponibilidad productiva de la arquitectura propuesta.

No se modifica `public/`, `functions/`, Firebase Authentication, reglas existentes, `firebase.json`, dependencias ni workflows. No se inicia ninguna migración o despliegue. No se crean commits ni se hace push: el workflow actual publica Hosting al hacer push a main, por lo que ese paso produciría una publicación indirecta.

## Paquete de revisión

`scripts/phase1/prepare-release.cjs` copia únicamente la lista explícita de 14 archivos de herramientas, pruebas y documentación de fase 1 a un directorio nuevo fuera del repositorio. Incluye hashes SHA-256, tamaños, revisión de origen y puertas de salida pendientes. No incluye los cambios ajenos preexistentes, `public/`, Functions, credenciales, archivos privados ni dumps productivos. Detecta corrupción, archivos adicionales y alteración de la puerta `productionReady:false`.

```powershell
node scripts/phase1/prepare-release.cjs create NUEVO_DIRECTORIO_FUERA_DEL_REPOSITORIO
node scripts/phase1/prepare-release.cjs verify DIRECTORIO_DEL_PAQUETE
```

El manifiesto es control de integridad, no firma contra manipulación intencional con hashes recalculados. El paquete conserva los archivos nuevos aún sin commit; el bundle Git de fase 1 conserva por separado el código confirmado y su historia.

## Verificación previa

```powershell
node --test tests/phase1/backup.test.cjs tests/phase1/fixtures.test.cjs tests/phase1/isolation.test.cjs tests/phase1/preparation.test.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/phase1/run-emulator.ps1
node scripts/phase1/source-backup.cjs verify DIRECTORIO_RESPALDO_CODIGO
node scripts/phase1/backup.cjs verify DIRECTORIO_RESPALDO_JSON
```

La prueba de emulador usa solo localhost y proyectos demo fijos, sin Functions productivas. No descarga dependencias si falta el JAR. Ver `fase1-respaldos-emuladores.md` para límites de tipos JSON, respaldo sintético y conservación de cambios locales.

## Lista para una publicación futura, no ejecutada

1. Aprobar alcance funcional y resolver política de cobro/consumo del diseño POS 3.0.
2. Identificar exportación real autorizada, preservar tipos nativos y verificar restauración/reconciliación en entorno aislado. Los fixtures no sustituyen este requisito.
3. Completar las fases de implementación aprobadas. Esta preparación no habilita fases 2–8.
4. Formar una revisión aislada con lista explícita de archivos. Revisar cada cambio ajeno; no usar `git add .` ni ejecutar el flujo de deploy del árbol mezclado.
5. Pasar regresiones del POS, aislamiento de negocios, autenticación, permisos, concurrencia, inventario, cobros y recuperación correspondientes al cambio real.
6. Definir exactamente Hosting/Functions a publicar y compatibilidad entre sus versiones. No publicar reglas/índices o migraciones sin autorización específica.
7. Revisar respaldo, responsable y plan de reversión; obtener instrucción explícita de despliegue para esa revisión.
8. Publicar solo desde esa revisión aprobada y comprobar archivos/versiones sin pedidos ni cobros de prueba en producción.

## Reversión

Fase 1 no cambia producción: no necesita rollback productivo. Se preservan bundle del código, respaldos sintéticos verificados y paquete de archivos de fase 1. Para cambios futuros, volver de versión de aplicación exige compatibilidad con las entidades vigentes; no restaurar una base anterior sobre ventas o movimientos posteriores. Las correcciones monetarias o físicas requieren movimientos compensatorios y aprobación.

## Puertas pendientes

| Puerta | Estado |
| --- | --- |
| Herramientas locales y fixtures | Preparados y verificables |
| Restauración sintética con Firestore Emulator | Verificada; repetible con runner separado |
| Bundle de código confirmado | Verificado |
| Archivos de fase 1 sin commit | Cubiertos por paquete de revisión explícito |
| Respaldo/restauración de datos productivos | Pendiente: exportación real no identificada |
| Implementación y QA completa de POS 3.0 | Pendiente de fases posteriores y aprobación |
| Publicación de producción | No autorizada ni ejecutada por esta preparación |

No se declara listo para producción hasta cerrar esas puertas. No se han cambiado los permisos ni la programación del workflow existente.
