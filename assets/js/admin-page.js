/*
  Admin dashboard
  - Uses HayzeeOnline Health Supplements API (per Postman collection)
  Endpoints:
    - GET  /api/health-supplements/products?rows=20&search=
    - POST /api/health-supplements/products           (multipart)
    - POST /api/health-supplements/products/{id}      (multipart)
    - POST /api/health-supplements/orders             (json)
    - GET  /api/health-supplements/orders/{id}

  Notes:
  - This is a static frontend. Auth isn’t included.
  - If CORS blocks requests, products fall back to sample JSON (see products-data.js).
*/

(() => {
  const ORDER_HISTORY_KEY = 'tomi_orders_v1';
  const DEFAULT_BASE_URL = 'https://api.dsnutritional.com';

  const $ = (sel) => document.querySelector(sel);

  const apiStatusEl = $('#api-status');
  const metaProductsEl = $('#meta-products');

  const navItems = Array.from(document.querySelectorAll('.tadmin-nav__item[data-tab]'));
  const tabsByName = {
    products: $('#tab-products'),
    orders: $('#tab-orders'),
  };

  const productsTbody = $('#products-tbody');
  const searchInput = $('#product-search');
  const refreshBtn = $('#refresh-products');

  const productForm = $('#product-form');
  const productFormTitle = $('#product-form-title');
  const productStatus = $('#product-status');
  const clearFormBtn = $('#clear-form');
  const deleteBtn = $('#delete-product');

  const fId = $('#product-id');
  const fName = $('#product-name');
  const fDesc = $('#product-description');
  const fPrice = $('#product-price');
  const fAvail = $('#product-availability');
  const fImage = $('#product-image');

  const ordersTbody = $('#orders-tbody');
  const ordersStatus = $('#orders-status');
  const refreshOrdersBtn = $('#refresh-orders');
  const orderDetail = $('#order-detail');
  const orderFetchForm = $('#order-fetch-form');
  const orderFetchId = $('#order-fetch-id');
  const orderFetchStatus = $('#order-fetch-status');

  if (!apiStatusEl || !productsTbody || !productForm) return;

  const setBadge = (state, text) => {
    apiStatusEl.dataset.state = state;
    apiStatusEl.textContent = text;
  };

  const setStatus = (el, msg, type = 'info') => {
    if (!el) return;
    el.textContent = msg;
    el.dataset.type = type;
  };

  const getBaseUrl = () => {
    const fromWindow = (typeof window.HEALTH_SUPPLEMENTS_API_BASE_URL === 'string') ? window.HEALTH_SUPPLEMENTS_API_BASE_URL : '';
  const base = (fromWindow && fromWindow.trim()) ? fromWindow.trim() : (window.DSNH_ProductsAPI?.getBaseUrl?.() || DEFAULT_BASE_URL);
    return base.replace(/\/$/, '');
  };

  const urlProductsList = ({ rows = 20, search = '' } = {}) => {
    const u = new URL(`${getBaseUrl()}/api/health-supplements/products`);
    u.searchParams.set('rows', String(rows));
    if (search) u.searchParams.set('search', String(search));
    return u.toString();
  };

  const urlProductsCreate = () => `${getBaseUrl()}/api/health-supplements/products`;
  const urlProductsUpdate = (id) => `${getBaseUrl()}/api/health-supplements/products/${encodeURIComponent(String(id))}`;

  const urlOrdersGet = (id) => `${getBaseUrl()}/api/health-supplements/orders/${encodeURIComponent(String(id))}`;

  const formatMoney = (rawPrice) => {
    const n = Number(rawPrice);
    if (!Number.isFinite(n)) return String(rawPrice ?? '');
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const escapeHtml = (s) => String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const getCurrentProducts = () => Array.isArray(window.DSNH_PRODUCTS) ? window.DSNH_PRODUCTS : [];

  let filtered = [];

  const renderProductsTable = () => {
    const items = filtered;
    metaProductsEl.textContent = String(items.length);

    if (!items.length) {
      productsTbody.innerHTML = `<tr><td colspan="5" class="tadmin-muted">No products found.</td></tr>`;
      return;
    }

    productsTbody.innerHTML = items.map((p) => {
      const img = escapeHtml(p.thumbnail || (p.images && p.images[0]) || 'assets/img/products/product-1.png');
      const name = escapeHtml(p.name);
      const price = escapeHtml(String(p.api?.price_raw ?? p.price ?? ''));
      const avail = (p.api?.availability ?? 1) ? '1' : '0';

      return `
        <tr data-row="1" data-product-id="${escapeHtml(p.id)}">
          <td><img class="tadmin-thumb" src="${img}" alt="${name}" loading="lazy"></td>
          <td>
            <div style="font-weight:800; color:rgba(15,23,42,.92)">${name}</div>
            <div class="tadmin-muted" style="font-size:12px; white-space:normal; max-width:340px;">
              ${escapeHtml(p.shortDescription || p.description || '')}
            </div>
          </td>
          <td><strong>${formatMoney(price)}</strong></td>
          <td><span class="tadmin-pill" data-state="${avail}">${avail === '1' ? 'Available' : 'Hidden'}</span></td>
          <td>
            <button class="tadmin-btn-icon" type="button" data-edit="1" aria-label="Edit">
              <i class="fas fa-pen"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  };

  const applySearch = () => {
    const q = (searchInput?.value ?? '').toString().trim().toLowerCase();
    const all = getCurrentProducts();
    filtered = !q ? all : all.filter((p) =>
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.description || '').toLowerCase().includes(q) ||
      String(p.shortDescription || '').toLowerCase().includes(q)
    );
    renderProductsTable();
  };

  const fillProductForm = (p) => {
    fId.value = String(p?.id ?? '');
    fName.value = String(p?.name ?? '');
    fDesc.value = String(p?.description ?? p?.shortDescription ?? '');
    fPrice.value = String(p?.api?.price_raw ?? p?.price ?? '');
    fAvail.value = String((p?.api?.availability ?? 1) ? 1 : 0);
    if (fImage) fImage.value = '';

    const idVal = fId.value.trim();
    productFormTitle.textContent = idVal ? `Update product #${idVal}` : 'Create product';
    deleteBtn.disabled = !idVal;
  };

  const clearProductForm = () => {
    fillProductForm({});
    setStatus(productStatus, '', 'info');
  };

  const parseProductFromRow = (id) => {
    const all = getCurrentProducts();
    return all.find((p) => String(p.id) === String(id));
  };

  const toMultipart = ({ name, description, price, availability, imageFile }) => {
    const fd = new FormData();
    if (name != null && name !== '') fd.append('name', String(name));
    if (description != null && description !== '') fd.append('description', String(description));
    if (price != null && price !== '') fd.append('price', String(price));
    if (availability != null && availability !== '') fd.append('availability', String(availability));
    if (imageFile instanceof File) fd.append('image', imageFile);
    return fd;
  };

  const refreshProducts = async ({ search = '' } = {}) => {
    try {
      setBadge('ok', 'API');
      setStatus(productStatus, 'Loading products...', 'info');

      // Prefer central loader if present
      if (window.DSNH_ProductsAPI?.refresh) {
        await window.DSNH_ProductsAPI.refresh({ rows: 20, search });
      } else {
        const res = await fetch(urlProductsList({ rows: 20, search }), { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        const norm = (list || []).map((p) => window.DSNH_ProductsAPI?.normalizeProduct ? window.DSNH_ProductsAPI.normalizeProduct(p) : p);
        window.DSNH_PRODUCTS = norm;
        window.dispatchEvent(new CustomEvent('products:change', { detail: { products: norm } }));
      }

      applySearch();
      setStatus(productStatus, '', 'info');
      return true;
    } catch (err) {
      setBadge('err', 'API');
      setStatus(productStatus, err instanceof Error ? err.message : 'Failed to load products', 'error');
      return false;
    }
  };

  const createProduct = async (fields) => {
    const res = await fetch(urlProductsCreate(), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: toMultipart(fields),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Create failed (${res.status}) ${text}`);
    }

    return res.json().catch(() => null);
  };

  const updateProduct = async (id, fields) => {
    const res = await fetch(urlProductsUpdate(id), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: toMultipart(fields),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Update failed (${res.status}) ${text}`);
    }

    return res.json().catch(() => null);
  };

  const getOrder = async (id) => {
    const res = await fetch(urlOrdersGet(id), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Get order failed (${res.status}) ${text}`);
    }
    return res.json().catch(() => null);
  };

  const formatDateTime = (iso) => {
    const d = iso ? new Date(iso) : null;
    if (d && !Number.isNaN(d.getTime())) return d.toLocaleString();
    return '—';
  };

  const currencySymbol = (currency) => {
    const c = String(currency || '').toUpperCase();
    if (c === 'NGN') return '₦';
    if (c === 'USD') return '$';
    if (c === 'EUR') return '€';
    if (c === 'GBP') return '£';
    return c ? `${c} ` : '';
  };

  const formatMoneyCompact = (value, currency = '') => {
    const n = Number(value);
    if (!Number.isFinite(n)) return `${currencySymbol(currency)}${String(value ?? '—')}`;
    return `${currencySymbol(currency)}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const calcItemsTotal = (items) => {
    const arr = Array.isArray(items) ? items : [];
    return arr.reduce((sum, it) => {
      const qty = Number(it.quantity ?? it.qty ?? 0) || 0;
      const price = Number(it.price ?? 0) || 0;
      return sum + qty * price;
    }, 0);
  };

  const pickItemImage = (it) => {
    const img = it?.image || it?.thumbnail || it?.photo_url || it?.image_url;
    if (img) return String(img);
    return 'assets/img/products/product-1.png';
  };

  const renderOrderDetailHtml = ({
    id = '',
    createdAt = '',
    customer = null,
    payment = null,
    items = [],
  currency = 'NGN',
    source = 'Stored',
  } = {}) => {
    if (!orderDetail) return;

    const safeId = escapeHtml(id || '—');
    const custName = escapeHtml(customer?.name || '—');
    const custEmail = escapeHtml(customer?.email || '—');
    const custPhone = escapeHtml(customer?.phone || '—');
    const custAddress = escapeHtml(customer?.address || '—');

    const payRef = escapeHtml(payment?.reference || '—');
    const payProvider = escapeHtml(payment?.provider || '—');
    const payStatus = escapeHtml(payment?.status || '—');

  const total = calcItemsTotal(items);
    const createdLabel = formatDateTime(createdAt);

    const list = (Array.isArray(items) ? items : []).map((it, idx) => {
      const pid = escapeHtml(String(it.product_id ?? it.id ?? '—'));
      const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
      const price = Number(it.price ?? 0) || 0;
      const line = qty * price;
      const name = escapeHtml(it.product_name || it.name || `Product #${pid}`);
      const img = escapeHtml(pickItemImage(it));
      const unit = formatMoneyCompact(price, currency);
      const lineTotal = formatMoneyCompact(line, currency);

      return `
        <li class="tadmin-order__item">
          <div class="tadmin-order__itemLeft">
            <img class="tadmin-order__itemImg" src="${img}" alt="${name}" loading="lazy">
            <div>
              <div class="tadmin-order__itemName">${name}</div>
              <div class="tadmin-order__itemMeta">Product ID: ${pid} • Qty: ${escapeHtml(String(qty))} • Unit: ${escapeHtml(unit)}</div>
            </div>
          </div>
          <div class="tadmin-order__itemPrice">${escapeHtml(String(lineTotal))}</div>
        </li>
      `;
    }).join('') || `<li class="tadmin-order__item"><div class="tadmin-muted">No items</div></li>`;

    orderDetail.innerHTML = `
      <div class="tadmin-order__top">
        <div>
          <h5 class="tadmin-order__title">Order ${safeId}</h5>
          <p class="tadmin-order__sub">${escapeHtml(source)} • ${escapeHtml(createdLabel)}</p>
        </div>
        <span class="tadmin-badge" data-state="ok">${escapeHtml(payStatus)}</span>
      </div>

      <div class="tadmin-kv">
        <div class="tadmin-kv__item">
          <div class="tadmin-kv__label">Customer</div>
          <div class="tadmin-kv__value">${custName}</div>
          <div class="tadmin-order__sub">${custEmail}</div>
        </div>
        <div class="tadmin-kv__item">
          <div class="tadmin-kv__label">Phone</div>
          <div class="tadmin-kv__value">${custPhone}</div>
          <div class="tadmin-order__sub">${custAddress}</div>
        </div>
        <div class="tadmin-kv__item">
          <div class="tadmin-kv__label">Payment</div>
          <div class="tadmin-kv__value">${payProvider}</div>
          <div class="tadmin-order__sub">Ref: ${payRef}</div>
        </div>
        <div class="tadmin-kv__item">
          <div class="tadmin-kv__label">Total</div>
          <div class="tadmin-kv__value">${escapeHtml(String(formatMoneyCompact(total, currency)))}</div>
          <div class="tadmin-order__sub">Items: ${escapeHtml(String(Array.isArray(items) ? items.length : 0))}</div>
        </div>
      </div>

      <div class="tadmin-order__section">
        <div class="tadmin-order__sectionHeader">Items</div>
        <ul class="tadmin-order__items">${list}</ul>
      </div>
    `;
  };

  const safeJsonParse = (value, fallback) => {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  };

  const readOrderHistory = () => {
    const raw = window.localStorage.getItem(ORDER_HISTORY_KEY);
    const base = { version: 1, orders: [] };
    if (!raw) return base;
    const data = safeJsonParse(raw, base);
    if (!data || typeof data !== 'object') return base;
    if (!Array.isArray(data.orders)) data.orders = [];
    return data;
  };

  const renderOrders = () => {
    if (!ordersTbody) return;
    const history = readOrderHistory();
    const orders = history.orders || [];

    if (!orders.length) {
      ordersTbody.innerHTML = `<tr><td colspan="5" class="tadmin-muted">No orders yet. Orders will appear after a checkout.</td></tr>`;
      if (ordersStatus) setStatus(ordersStatus, '', 'info');
      return;
    }

    ordersTbody.innerHTML = orders.map((o) => {
      const customerName = escapeHtml(o.customer?.name || '—');
      const customerEmail = escapeHtml(o.customer?.email || '');
      const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
      const created = escapeHtml(new Date(o.createdAt || Date.now()).toLocaleString());
      const id = escapeHtml(o.id || '');
      return `
        <tr data-order-row="1" data-order-id="${id}">
          <td><strong>${id || '—'}</strong></td>
          <td>
            <div style="font-weight:800; color:rgba(15,23,42,.92)">${customerName}</div>
            <div class="tadmin-muted" style="font-size:12px;">${customerEmail}</div>
          </td>
          <td>${itemsCount}</td>
          <td>${created}</td>
          <td>
            <button class="tadmin-btn-icon" type="button" data-view-order="1" aria-label="View">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  };

  const showOrderDetail = (orderIdValue) => {
    const history = readOrderHistory();
    const order = (history.orders || []).find((o) => String(o.id) === String(orderIdValue));
    if (!orderDetail) return;
    if (!order) {
      orderDetail.innerHTML = `<div class="tadmin-order__empty tadmin-muted">Order not found.</div>`;
      return;
    }

    // Stored shape: { id, createdAt, customer, items, payment, response }
    renderOrderDetailHtml({
      id: order.id,
      createdAt: order.createdAt,
      customer: order.customer,
      payment: order.payment,
      items: order.items,
  currency: order.currency || 'NGN',
      source: 'Stored (checkout)',
    });
  };

  const activateTab = (name) => {
    navItems.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === name));
    Object.entries(tabsByName).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle('is-active', k === name);
    });
  };

  // Wiring
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  document.addEventListener('products:change', () => applySearch());

  productsTbody.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const editBtn = target.closest('[data-edit="1"]');
    if (!editBtn) return;

    const row = editBtn.closest('[data-row="1"]');
    const id = row?.getAttribute('data-product-id');
    if (!id) return;

    const product = parseProductFromRow(id);
    if (!product) return;

    fillProductForm(product);
  });

  // Orders UI
  ordersTbody?.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

  // Click anywhere in the row to view. (Don’t trigger if the click is on a link/input/etc.)
  const row = target.closest('[data-order-row="1"]');
  if (!row) return;

  const interactive = target.closest('button, a, input, select, textarea, label');
  // Allow the explicit view button to work too.
  const viewBtn = target.closest('[data-view-order="1"]');
  if (interactive && !viewBtn) return;

  const id = row.getAttribute('data-order-id');
  if (!id) return;
  showOrderDetail(id);
  });

  refreshOrdersBtn?.addEventListener('click', () => {
    renderOrders();
    setStatus(ordersStatus, 'Orders refreshed.', 'success');
  });

  window.addEventListener('orders:change', () => {
    renderOrders();
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => applySearch());
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => refreshProducts({ search: '' }));
  }

  clearFormBtn?.addEventListener('click', clearProductForm);

  deleteBtn?.addEventListener('click', () => {
    // No DELETE endpoint in provided collection
    setStatus(productStatus, 'Delete endpoint not in collection (UI-only).', 'error');
  });

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!productForm.checkValidity()) {
      productForm.reportValidity();
      return;
    }

    const id = fId.value.trim();
    const fields = {
      name: fName.value.trim(),
      description: fDesc.value.trim(),
      price: fPrice.value.trim(),
      availability: fAvail.value,
      imageFile: fImage?.files?.[0],
    };

    try {
      setStatus(productStatus, id ? 'Updating product…' : 'Creating product…', 'info');
      setBadge('ok', 'API');

      if (id) await updateProduct(id, fields);
      else await createProduct(fields);

      setStatus(productStatus, 'Saved successfully. Refreshing…', 'success');
      await refreshProducts({ search: '' });
      clearProductForm();
    } catch (err) {
      setBadge('err', 'API');
      setStatus(productStatus, err instanceof Error ? err.message : 'Save failed', 'error');
    }
  });

  orderFetchForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      const id = (orderFetchId?.value ?? '').toString().trim();
      if (!id) {
        setStatus(orderFetchStatus, 'Enter an order ID.', 'error');
        return;
      }

      setStatus(orderFetchStatus, 'Fetching order…', 'info');
      setBadge('ok', 'API');

      const res = await getOrder(id);

      // API shape could vary. Try to map common shapes.
      const apiOrder = res?.order || res?.data || res;
      const apiItems = apiOrder?.items || apiOrder?.data?.items || apiOrder?.order_items || [];
      const apiCustomer = apiOrder?.customer || apiOrder?.data?.customer || apiOrder?.customer_details || null;
      const apiPayment = apiOrder?.payment || apiOrder?.data?.payment || apiOrder?.payment_details || null;

      renderOrderDetailHtml({
        id: apiOrder?.id ?? id,
        createdAt: apiOrder?.created_at ?? apiOrder?.createdAt ?? '',
        customer: apiCustomer,
        payment: apiPayment,
        items: apiItems,
  currency: apiOrder?.currency || 'NGN',
        source: 'Live (API)',
      });
      setStatus(orderFetchStatus, 'Fetched.', 'success');
    } catch (err) {
      setBadge('err', 'API');
      setStatus(orderFetchStatus, err instanceof Error ? err.message : 'Fetch failed', 'error');
    }
  });

  // Init
  window.HEALTH_SUPPLEMENTS_API_BASE_URL = getBaseUrl();
  clearProductForm();

  renderOrders();

  applySearch();
  refreshProducts({ search: '' });
})();
