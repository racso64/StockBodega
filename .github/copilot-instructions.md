# Copilot instructions for StockBodega

## Project overview

StockBodega is a dependency-free, static Spanish-language inventory app. `index.html` defines the page shell, navigation, inventory/restock/movement views, and the shared dialog. It loads `styles.css` and `app.js` directly; there is no build step or server-side component.

`app.js` owns the application state and behavior. The persisted state has `products` and `movements` arrays in `localStorage` under `stockbodega.v1`. Product stock is the current balance; purchases and sales create movement records and update that balance together. Restock suggestions, alerts, totals, and filtered product rows are derived from the current state and refreshed by `render()`.

## Commands and verification

There is no package manifest, build script, linter, or automated test suite in this repository. Do not assume npm scripts or a test runner are available.

- Check JavaScript syntax: `node --check app.js`
- Serve the static app locally: `python -m http.server 8765`
- Open `http://localhost:8765/` in the integrated browser to verify UI and interaction changes.

For interaction changes, verify the affected flow in the integrated browser, including its visible result and any stock or movement updates. For example, a sale should decrement stock and appear as a `Venta` in Movimientos; an invalid sale must not reduce stock below zero. There is no single-test command because no automated test framework is configured.

## Codebase conventions

- Keep the app static and dependency-free. Load browser code through the existing `defer` script in `index.html`; do not introduce a build tool or framework for a small feature.
- Keep user-facing copy in Spanish. Use the existing `es` locale normalization, `es-PE` currency formatting, and `PEN` currency for displayed values.
- Persist changes through `commit(nextState)`: validate user input before changing state, write the complete state to `localStorage`, then call `render()`. Preserve the explicit storage-error behavior; do not silently replace unreadable saved data.
- Treat stock changes as movements, not direct product edits. Use the existing movement flow so the balance and movement history stay consistent, and prevent sales that exceed available stock.
- Keep computed values derived from `state`; do not persist duplicate alert counts or restock quantities. A product is low when stock is positive and less than or equal to its minimum, and exhausted at zero.
- Follow the existing delegated interaction pattern: mark controls with `data-action` (or `data-view-link`) and handle them in the document-level click listener. Dialog forms are handled by the dialog's submit listener.
- Dynamic values inserted into HTML template strings must be escaped with `safeText`. Continue using the existing CSS classes and responsive table-to-card behavior rather than adding a separate rendering path for mobile.
