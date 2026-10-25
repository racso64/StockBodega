(() => {
  const STORAGE_KEY = 'stockbodega.v1';
  const defaultState = { products: [], movements: [] };
  const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
  const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  const dialog = document.getElementById('app-dialog');
  const toast = document.getElementById('toast');
  let state = defaultState;
  let storageReady = true;
  let toastTimeout;
  let activeView = 'inventory';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const normalized = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const formatMoney = (value) => currency.format(value);
  const formatDate = (value) => dateFormat.format(new Date(value));
  const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  function showStorageError(message) {
    storageReady = false;
    const warning = $('#storage-warning');
    warning.textContent = message;
    warning.hidden = false;
    render();
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaultState;
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.movements)) {
        throw new Error('El formato de los datos guardados no es válido.');
      }
      const validProducts = parsed.products.every((product) =>
        product && typeof product.id === 'string' && typeof product.name === 'string' &&
        typeof product.category === 'string' && Number.isFinite(product.price) &&
        Number.isInteger(product.stock) && Number.isInteger(product.minStock));
      const validMovements = parsed.movements.every((movement) =>
        movement && typeof movement.id === 'string' && typeof movement.productName === 'string' &&
        typeof movement.type === 'string' && Number.isInteger(movement.quantity) &&
        Number.isInteger(movement.stockAfter) && typeof movement.date === 'string');
      if (!validProducts || !validMovements) throw new Error('Hay datos incompletos en el inventario guardado.');
      return { products: parsed.products, movements: parsed.movements };
    } catch (error) {
      const detail = error instanceof SyntaxError ? 'Los datos guardados están dañados.' : error.message;
      showStorageError(`No se pudo cargar el inventario desde este navegador. ${detail} No se realizarán cambios para proteger tus datos.`);
      return defaultState;
    }
  }

  function commit(nextState) {
    if (!storageReady) {
      showToast('No se puede guardar mientras el almacenamiento no esté disponible.');
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      state = nextState;
      render();
      return true;
    } catch (error) {
      showToast(`No se pudo guardar el cambio: ${error.message}`);
      return false;
    }
  }

  function stockStatus(product) {
    if (product.stock === 0) return 'empty';
    if (product.stock <= product.minStock) return 'low';
    return 'ok';
  }

  function statusMarkup(product) {
    const status = stockStatus(product);
    const labels = { ok: 'OK', low: 'Stock bajo', empty: 'Agotado' };
    return `<span class="status-badge status-${status}">${labels[status]}</span>`;
  }

  function avatarLetter(name) {
    return safeText((name.trim().charAt(0) || '?').toLocaleUpperCase('es'));
  }

  function renderMetrics() {
    const products = state.products;
    const low = products.filter((product) => stockStatus(product) === 'low').length;
    const empty = products.filter((product) => stockStatus(product) === 'empty').length;
    $('#metric-products').textContent = products.length.toLocaleString('es-PE');
    $('#metric-units').textContent = products.reduce((sum, product) => sum + product.stock, 0).toLocaleString('es-PE');
    $('#metric-value').textContent = formatMoney(products.reduce((sum, product) => sum + product.stock * product.price, 0));
    $('#metric-alerts').textContent = (low + empty).toLocaleString('es-PE');
    $('#metric-low').textContent = `${low} con stock bajo`;
    $('#metric-empty').textContent = `${empty} agotados`;
    $('#nav-restock-count').textContent = low + empty ? String(low + empty) : '';
  }

  function renderCategoryFilter() {
    const select = $('#category-filter');
    const current = select.value;
    const categories = [...new Set(state.products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, 'es'));
    select.innerHTML = '<option value="">Todas las categorías</option>' + categories.map((category) =>
      `<option value="${safeText(category)}">${safeText(category)}</option>`).join('');
    if (categories.includes(current)) select.value = current;
  }

  function renderProducts() {
    const query = normalized($('#search-input').value.trim());
    const category = $('#category-filter').value;
    const status = $('#status-filter').value;
    const filtered = state.products.filter((product) =>
      normalized(product.name).includes(query) &&
      (!category || product.category === category) &&
      (!status || stockStatus(product) === status))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    $('#product-list').innerHTML = filtered.map((product) => `
      <tr>
        <td class="product-cell" data-label="PRODUCTO"><div class="product-name"><span class="product-avatar">${avatarLetter(product.name)}</span><span><strong>${safeText(product.name)}</strong><small>Mínimo: ${product.minStock} unidades</small></span></div></td>
        <td data-label="CATEGORÍA"><span class="category-tag">${safeText(product.category)}</span></td>
        <td class="price-cell" data-label="PRECIO">${formatMoney(product.price)}</td>
        <td class="stock-cell" data-label="STOCK">${product.stock}<span class="stock-min">unidades</span></td>
        <td data-label="ESTADO">${statusMarkup(product)}</td>
        <td data-label="ACCIONES"><div class="row-actions">
          <button class="icon-button movement-action" type="button" title="Registrar compra" aria-label="Registrar compra de ${safeText(product.name)}" data-action="purchase" data-id="${safeText(product.id)}"><span aria-hidden="true">＋</span><span>Compra</span></button>
          <button class="icon-button movement-action" type="button" title="Registrar venta" aria-label="Registrar venta de ${safeText(product.name)}" data-action="sale" data-id="${safeText(product.id)}"><span aria-hidden="true">↗</span><span>Venta</span></button>
          <button class="icon-button" type="button" title="Editar producto" aria-label="Editar ${safeText(product.name)}" data-action="edit" data-id="${safeText(product.id)}">✎</button>
          <button class="icon-button delete" type="button" title="Eliminar producto" aria-label="Eliminar ${safeText(product.name)}" data-action="delete" data-id="${safeText(product.id)}">×</button>
        </div></td>
      </tr>`).join('');
    const empty = filtered.length === 0;
    $('#inventory-empty').hidden = !empty;
    $('#product-list').closest('table').hidden = empty;
    const noProducts = state.products.length === 0;
    $('#inventory-empty-title').textContent = noProducts ? 'Aún no tienes productos' : 'No encontramos productos';
    $('#inventory-empty-copy').textContent = noProducts
      ? 'Agrega el primer producto para comenzar a controlar tu inventario.'
      : 'Prueba con otra búsqueda o cambia los filtros seleccionados.';
    const addButton = $('[data-action="add-product"]', $('#inventory-empty'));
    addButton.hidden = !noProducts;
  }

  function getRestockProducts() {
    return state.products.filter((product) => stockStatus(product) !== 'ok')
      .sort((a, b) => {
        const urgency = (product) => product.stock === 0 ? -1 : product.stock / product.minStock;
        return urgency(a) - urgency(b) || a.name.localeCompare(b.name, 'es');
      });
  }

  function renderRestock() {
    const products = getRestockProducts();
    $('#restock-summary').textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;
    $('#restock-list').innerHTML = products.map((product) => {
      const suggested = Math.max(0, product.minStock * 2 - product.stock);
      return `<tr>
        <td class="product-cell" data-label="PRODUCTO"><div class="product-name"><span class="product-avatar">${avatarLetter(product.name)}</span><span><strong>${safeText(product.name)}</strong>${statusMarkup(product)}</span></div></td>
        <td data-label="CATEGORÍA">${safeText(product.category)}</td>
        <td class="stock-cell" data-label="STOCK ACTUAL">${product.stock} unidades</td>
        <td data-label="STOCK MÍNIMO">${product.minStock} unidades</td>
        <td class="suggested-quantity" data-label="CANTIDAD SUGERIDA">+${suggested} unidades</td>
        <td data-label="ACCIÓN"><button class="button button-primary buy-button" type="button" data-action="suggested-purchase" data-id="${safeText(product.id)}" data-quantity="${suggested}">＋ Registrar compra</button></td>
      </tr>`;
    }).join('');
    const empty = products.length === 0;
    $('#restock-empty').hidden = !empty;
    $('#restock-list').closest('table').hidden = empty;
  }

  function renderMovements() {
    const movements = [...state.movements].sort((a, b) => new Date(b.date) - new Date(a.date));
    $('#movement-summary').textContent = `${movements.length} ${movements.length === 1 ? 'movimiento' : 'movimientos'}`;
    $('#movement-list').innerHTML = movements.map((movement) => {
      const typeClass = movement.type === 'Venta' ? 'type-sale' : '';
      const quantityPrefix = movement.type === 'Venta' ? '−' : '+';
      return `<tr>
        <td data-label="FECHA">${formatDate(movement.date)}</td>
        <td class="product-cell" data-label="PRODUCTO"><div class="product-name"><span class="product-avatar">${avatarLetter(movement.productName)}</span><span><strong>${safeText(movement.productName)}</strong></span></div></td>
        <td data-label="TIPO"><span class="movement-type ${typeClass}">${safeText(movement.type)}</span></td>
        <td data-label="CANTIDAD">${quantityPrefix}${movement.quantity}</td>
        <td class="stock-cell" data-label="STOCK RESULTANTE">${movement.stockAfter} unidades</td>
        <td class="movement-note" data-label="NOTA" title="${safeText(movement.note)}">${safeText(movement.note || '—')}</td>
      </tr>`;
    }).join('');
    const empty = movements.length === 0;
    $('#movement-empty').hidden = !empty;
    $('#movement-list').closest('table').hidden = empty;
  }

  function render() {
    renderMetrics();
    renderCategoryFilter();
    renderProducts();
    renderRestock();
    renderMovements();
    $$('button[data-action], #add-product-button, #export-button').forEach((button) => {
      button.disabled = !storageReady && button.id !== 'export-button';
    });
    $('#sale-button').disabled = !storageReady || !state.products.some((product) => product.stock > 0);
    $('#export-button').disabled = state.products.length === 0;
  }

  function setView(view) {
    activeView = view;
    const titles = {
      inventory: ['RESUMEN DE TU BODEGA', 'Inventario'],
      restock: ['PLANIFICA TUS COMPRAS', 'Por reponer'],
      movements: ['ACTIVIDAD RECIENTE', 'Movimientos']
    };
    $('#page-eyebrow').textContent = titles[view][0];
    $('#page-title').textContent = titles[view][1];
    $$('.view-panel').forEach((panel) => {
      const visible = panel.id === `${view}-view`;
      panel.hidden = !visible;
      panel.classList.toggle('is-visible', visible);
    });
    $$('[data-view-link]').forEach((button) => button.classList.toggle('is-active', button.dataset.viewLink === view));
    $('#add-product-button').hidden = view !== 'inventory';
    $('#sale-button').hidden = view !== 'inventory';
    $('#export-button').hidden = view !== 'inventory';
  }

  function openDialog(content) {
    dialog.innerHTML = content;
    dialog.showModal();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function openProductDialog(id = '') {
    const product = state.products.find((item) => item.id === id);
    const editing = Boolean(product);
    const title = editing ? 'Editar producto' : 'Agregar producto';
    const categories = [...new Set(['Abarrotes', 'Bebidas', 'Lácteos', 'Limpieza', ...state.products.map((item) => item.category)])];
    openDialog(`
      <div class="dialog-head"><div><h2 id="dialog-title">${title}</h2><p>${editing ? 'Actualiza los datos del producto.' : 'Completa los datos para añadirlo a tu inventario.'}</p></div><button class="dialog-close" type="button" aria-label="Cerrar" data-action="close-dialog">×</button></div>
      <form class="dialog-form" id="product-form" data-id="${safeText(id)}">
        <div class="form-grid">
          <label class="form-field full">Nombre del producto<input name="name" type="text" maxlength="80" required autocomplete="off" value="${safeText(product?.name || '')}" placeholder="Ej. Arroz extra 1 kg"></label>
          <label class="form-field full">Categoría<input name="category" type="text" maxlength="40" list="category-options" required autocomplete="off" value="${safeText(product?.category || '')}" placeholder="Ej. Abarrotes"><datalist id="category-options">${categories.map((category) => `<option value="${safeText(category)}">`).join('')}</datalist></label>
          <label class="form-field">Precio de venta (S/)<input name="price" type="number" min="0" step="0.01" inputmode="decimal" required value="${editing ? product.price : ''}" placeholder="0.00"></label>
          <label class="form-field">${editing ? 'Stock actual' : 'Stock inicial'}<input name="stock" type="number" min="0" step="1" inputmode="numeric" ${editing ? `value="${product.stock}" disabled` : 'value="0" required'}></label>
          <label class="form-field">Stock mínimo<input name="minStock" type="number" min="1" step="1" inputmode="numeric" required value="${editing ? product.minStock : '5'}"></label>
          ${editing ? '<p class="form-hint full">Para cambiar el stock, registra una compra o una venta desde el inventario.</p>' : '<p class="form-hint full">Te avisaremos cuando el stock llegue a este mínimo.</p>'}
        </div>
        <div class="dialog-actions"><button class="button button-secondary" type="button" data-action="close-dialog">Cancelar</button><button class="button button-primary" type="submit">${editing ? 'Guardar cambios' : 'Agregar producto'}</button></div>
      </form>`);
    $('input[name="name"]', dialog).focus();
  }

  function openMovementDialog(id, type, suggestedQuantity = '') {
    const product = state.products.find((item) => item.id === id);
    if (!product) return;
    const isSale = type === 'Venta';
    const actionLabel = isSale ? 'salida' : 'entrada';
    const transactionLabel = isSale ? 'venta' : 'compra';
    openDialog(`
      <div class="dialog-head"><div><h2 id="dialog-title">Registrar ${actionLabel}</h2><p>${safeText(product.name)} · Stock actual: ${product.stock} unidades · ${isSale ? 'Se guardará como venta.' : 'Se guardará como compra.'}</p></div><button class="dialog-close" type="button" aria-label="Cerrar" data-action="close-dialog">×</button></div>
      <form class="dialog-form" id="movement-form" data-id="${safeText(id)}" data-type="${type}">
        <div class="form-grid">
          <label class="form-field full">Cantidad de unidades<input name="quantity" type="number" min="1" step="1" max="${isSale ? product.stock : ''}" inputmode="numeric" required value="${suggestedQuantity || ''}" placeholder="Ej. 3"></label>
          ${isSale && product.stock === 0 ? '<p class="form-hint full">No se puede registrar una venta porque este producto está agotado.</p>' : ''}
          <label class="form-field full">Nota (opcional)<textarea name="note" maxlength="160" placeholder="${isSale ? 'Ej. Venta en mostrador' : 'Ej. Compra al proveedor'}"></textarea></label>
        </div>
        <div class="dialog-actions"><button class="button button-secondary" type="button" data-action="close-dialog">Cancelar</button><button class="button button-primary" type="submit" ${isSale && product.stock === 0 ? 'disabled' : ''}>Registrar ${actionLabel}</button></div>
      </form>`);
    $('input[name="quantity"]', dialog).focus();
  }

  function openSaleDialog() {
    const availableProducts = state.products.filter((product) => product.stock > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    if (!availableProducts.length) {
      showToast('No hay productos con stock disponible para vender.');
      return;
    }
    const selected = availableProducts[0];
    const options = [...state.products].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((product) =>
      `<option value="${safeText(product.id)}" ${product.stock === 0 ? 'disabled' : ''} ${product.id === selected.id ? 'selected' : ''}>${safeText(product.name)} — ${product.stock} disponibles</option>`).join('');
    openDialog(`
      <div class="dialog-head"><div><h2 id="dialog-title">Registrar venta</h2><p>Elige el producto y la cantidad que vendiste.</p></div><button class="dialog-close" type="button" aria-label="Cerrar" data-action="close-dialog">×</button></div>
      <form class="dialog-form" id="movement-form" data-id="${safeText(selected.id)}" data-type="Venta">
        <div class="form-grid">
          <label class="form-field full">Producto vendido<select class="form-select" name="productId" required>${options}</select></label>
          <p class="form-hint full" id="available-stock">${selected.stock} unidades disponibles.</p>
          <label class="form-field full">Cantidad de unidades<input name="quantity" type="number" min="1" step="1" max="${selected.stock}" inputmode="numeric" required placeholder="Ej. 3"></label>
          <label class="form-field full">Nota (opcional)<textarea name="note" maxlength="160" placeholder="Ej. Venta en mostrador"></textarea></label>
        </div>
        <div class="dialog-actions"><button class="button button-secondary" type="button" data-action="close-dialog">Cancelar</button><button class="button button-primary" type="submit">Confirmar venta</button></div>
      </form>`);
    $('input[name="quantity"]', dialog).focus();
  }

  function handleProductSubmit(form) {
    const data = new FormData(form);
    const id = form.dataset.id;
    const existing = state.products.find((product) => product.id === id);
    const name = String(data.get('name') || '').trim();
    const category = String(data.get('category') || '').trim();
    const price = Number(data.get('price'));
    const stock = existing ? existing.stock : Number(data.get('stock'));
    const minStock = Number(data.get('minStock'));
    if (!name || !category || !Number.isFinite(price) || price < 0 ||
      !Number.isInteger(stock) || stock < 0 || !Number.isInteger(minStock) || minStock < 1) {
      showToast('Revisa los datos: el precio debe ser válido y los stocks, unidades enteras.');
      return;
    }
    const duplicate = state.products.some((product) => product.id !== id && normalized(product.name) === normalized(name));
    if (duplicate) {
      showToast('Ya existe un producto con ese nombre.');
      $('input[name="name"]', form).focus();
      return;
    }
    const now = new Date().toISOString();
    const savedProduct = { id: existing?.id || createId(), name, category, price, stock, minStock, updatedAt: now };
    const products = existing
      ? state.products.map((product) => product.id === id ? savedProduct : product)
      : [...state.products, savedProduct];
    const movements = existing || stock === 0 ? state.movements : [{
      id: createId(), productId: savedProduct.id, productName: savedProduct.name,
      type: 'Stock inicial', quantity: stock, stockAfter: stock, note: 'Registro inicial del producto', date: now
    }, ...state.movements];
    if (commit({ products, movements })) {
      closeDialog();
      showToast(existing ? 'Producto actualizado.' : 'Producto agregado al inventario.');
    }
  }

  function handleMovementSubmit(form) {
    const product = state.products.find((item) => item.id === form.dataset.id);
    const type = form.dataset.type;
    const isSale = type === 'Venta';
    const actionLabel = isSale ? 'salida' : 'entrada';
    const transactionLabel = isSale ? 'venta' : 'compra';
    const data = new FormData(form);
    const quantity = Number(data.get('quantity'));
    const note = String(data.get('note') || '').trim();
    if (!product || !Number.isInteger(quantity) || quantity < 1) {
      showToast('Ingresa una cantidad válida de unidades.');
      return;
    }
    if (isSale && quantity > product.stock) {
      showToast(`No hay suficiente stock. Solo tienes ${product.stock} unidades.`);
      return;
    }
    const stock = isSale ? product.stock - quantity : product.stock + quantity;
    const now = new Date().toISOString();
    const movement = {
      id: createId(), productId: product.id, productName: product.name, type, quantity,
      stockAfter: stock, note, date: now
    };
    const products = state.products.map((item) =>
      item.id === product.id ? { ...item, stock, updatedAt: now } : item);
    if (commit({ products, movements: [movement, ...state.movements] })) {
      closeDialog();
      showToast(`${actionLabel[0].toLocaleUpperCase('es')}${actionLabel.slice(1)} registrada como ${transactionLabel}. Stock actualizado a ${stock} unidades.`);
    }
  }

  function deleteProduct(id) {
    const product = state.products.find((item) => item.id === id);
    if (!product || !window.confirm(`¿Eliminar "${product.name}" del inventario? Su historial de movimientos se conservará.`)) return;
    if (commit({ ...state, products: state.products.filter((item) => item.id !== id) })) {
      showToast('Producto eliminado.');
    }
  }

  function exportCsv() {
    if (!state.products.length) {
      showToast('Agrega productos antes de exportar el inventario.');
      return;
    }
    const fields = ['Producto', 'Categoría', 'Precio (S/)', 'Stock actual', 'Stock mínimo', 'Estado'];
    const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = state.products.map((product) => [
      product.name, product.category, product.price.toFixed(2), product.stock, product.minStock,
      stockStatus(product) === 'ok' ? 'OK' : stockStatus(product) === 'low' ? 'Stock bajo' : 'Agotado'
    ]);
    const csv = `\uFEFF${[fields, ...rows].map((row) => row.map(quote).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario-stockbodega-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action], [data-view-link]');
    if (!target) return;
    if (target.dataset.viewLink) {
      setView(target.dataset.viewLink);
      return;
    }
    const { action, id } = target.dataset;
    if (action === 'close-dialog') closeDialog();
    if (action === 'add-product') openProductDialog();
    if (action === 'edit') openProductDialog(id);
    if (action === 'delete') deleteProduct(id);
    if (action === 'purchase') openMovementDialog(id, 'Compra');
    if (action === 'sale') openMovementDialog(id, 'Venta');
    if (action === 'suggested-purchase') openMovementDialog(id, 'Compra', Number(target.dataset.quantity));
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('submit', (event) => {
    event.preventDefault();
    if (event.target.id === 'product-form') handleProductSubmit(event.target);
    if (event.target.id === 'movement-form') handleMovementSubmit(event.target);
  });
  dialog.addEventListener('change', (event) => {
    if (event.target.name !== 'productId') return;
    const form = event.target.form;
    const product = state.products.find((item) => item.id === event.target.value);
    if (!product) return;
    form.dataset.id = product.id;
    const quantity = $('input[name="quantity"]', form);
    quantity.max = String(product.stock);
    $('#available-stock', form).textContent = `${product.stock} unidades disponibles.`;
    $('button[type="submit"]', form).disabled = product.stock === 0;
  });
  $('#search-input').addEventListener('input', renderProducts);
  $('#category-filter').addEventListener('change', renderProducts);
  $('#status-filter').addEventListener('change', renderProducts);
  $('#add-product-button').addEventListener('click', () => openProductDialog());
  $('#sale-button').addEventListener('click', openSaleDialog);
  $('#export-button').addEventListener('click', exportCsv);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) closeDialog();
  });

  state = loadState();
  render();
  setView(activeView);
})();
