# StockBodega

Aplicación web estática para ayudar a bodegas pequeñas a controlar su inventario, registrar compras y ventas, identificar productos por reponer y consultar movimientos.

## Ejecutar

No requiere instalación ni dependencias. Desde la carpeta del proyecto, inicia un servidor local:

```powershell
python -m http.server 8765
```

Abre [http://localhost:8765/](http://localhost:8765/) en el navegador. También puedes abrir `index.html` directamente, aunque un servidor local ofrece una experiencia más consistente.

## Funcionalidades

- Crear, editar y eliminar productos con categoría, precio, stock y stock mínimo.
- Registrar compras y ventas; las ventas no pueden superar las unidades disponibles.
- Consultar alertas de stock, indicadores del inventario y cantidades sugeridas para reponer.
- Buscar productos sin distinguir tildes y filtrar por categoría o estado.
- Revisar el historial de entradas y salidas y exportar el inventario a CSV.
- Usar la interfaz responsive desde computadora o celular.

## Datos y privacidad

La aplicación guarda productos y movimientos en el `localStorage` del navegador, bajo la clave `stockbodega.v1`. Los datos permanecen en ese navegador y dispositivo; no se sincronizan entre dispositivos. Borrar los datos del sitio o cambiar de navegador puede eliminar el inventario. Usa **Exportar CSV** para guardar una copia del inventario.

## Desarrollo y verificación

La interfaz está en `index.html`, los estilos en `styles.css` y la lógica en `app.js`. Para comprobar la sintaxis de JavaScript:

```powershell
node --check app.js
```

Verifica los cambios de interacción en el navegador integrado, siguiendo el flujo afectado y confirmando sus resultados visibles. No hay build, linter ni suite automatizada configurados.
