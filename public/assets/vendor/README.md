# Lectores de documentos de inventario

Las bibliotecas se sirven desde el mismo Hosting de LuRo; no se ejecutan desde CDN ni envían archivos del usuario a terceros.

- PDF.js 6.5.438, distribución legacy, instalado como dependencia de desarrollo exacta. Archivos copiados desde node_modules/pdfjs-dist/legacy/build: pdf.mjs y pdf.worker.mjs. Licencia Apache-2.0 incluida en pdfjs/LICENSE. Fuente: https://github.com/mozilla/pdf.js y https://mozilla.github.io/pdf.js/getting_started/.
- SheetJS CE 0.20.3, distribución standalone oficial: https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js. Licencia Apache-2.0 incluida en sheetjs/LICENSE. Documentación: https://docs.sheetjs.com/docs/getting-started/installation/standalone/.

Para actualizar, fijar las nuevas versiones, copiar las distribuciones correspondientes, conservar las licencias y volver a ejecutar las pruebas de importación. El lector PDF utiliza texto y coordenadas de tabla, no renderizado ni OCR. No se incluyeron las dependencias nativas opcionales de renderizado de PDF.js.
