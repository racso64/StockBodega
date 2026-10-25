# Guía para mantener StockBodega

- Mantén la aplicación estática y sin dependencias. `index.html` contiene la interfaz, `styles.css` los estilos y `app.js` la lógica.
- Conserva el idioma español y los formatos locales `es-PE` / soles peruanos.
- Guarda los cambios de inventario mediante el estado existente y `localStorage` (`stockbodega.v1`). Las entradas y salidas deben actualizar el stock y registrar su movimiento juntos; nunca permitas vender más unidades de las disponibles.
- Escapa con `safeText` los valores dinámicos insertados en plantillas HTML y conserva los patrones actuales de acciones delegadas, diálogos y diseño responsive.
- Verifica los cambios de interacción en el navegador integrado: abre `http://localhost:8765/` mientras sirves la carpeta con `python -m http.server 8765`, y comprueba el flujo y su resultado visible. Para cambios en ventas, revisa también el stock y el historial de movimientos.
- Comprueba la sintaxis de JavaScript con `node --check app.js`. El proyecto no tiene un gestor de paquetes, build, linter ni suite de pruebas configurados.
