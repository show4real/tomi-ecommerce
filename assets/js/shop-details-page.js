/*
  Shop details page renderer
  - Reads ?id=<product.id>
  - Populates shop-details.html with data from window.DSNH_PRODUCTS
*/

(() => {
  let products = window.DSNH_PRODUCTS;

  if (!window.CartStore) {
    console.warn('[shop-details-page] CartStore not found. Did you include assets/js/cart-store.js?');
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || '';

  const setText = (sel, text) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  };

  const setAttr = (sel, name, value) => {
    const el = document.querySelector(sel);
    if (el && value != null) el.setAttribute(name, String(value));
  };

  const formatPrice = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
    return String(value ?? '');
  };

  const render = () => {
    if (!Array.isArray(products) || products.length === 0) return;
    const findById = (pid) => products.find((p) => String(p.id) === String(pid));
    const product = findById(id) || products[0];
    if (!product) return;

    // Title + meta
    setText('.js-sd-title', product.name || 'Product');
    setText('.js-sd-brand', product.brand || 'DS Nutritional Health');
    setText('.js-sd-sku', product.sku || product.id || '');
    setText('.js-sd-price', formatPrice(product.price));
    setText('.js-sd-short', product.shortDescription || product.description || '');

    // Details list
    setText('.js-sd-type', product.details?.type || 'Supplement');
    setText('.js-sd-xpd', product.details?.xpd || '');
    setText('.js-sd-co', product.details?.countryOfOrigin || product.brand || '');

    // Description tab
    setText('.js-sd-description', product.description || product.shortDescription || '');

    // Images (keep existing tab structure, just swap src)
    const images = Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.thumbnail].filter(Boolean);

    const imgSelectors = [
      '.js-sd-img-1',
      '.js-sd-img-2',
      '.js-sd-img-3',
      '.js-sd-img-4',
    ];

    const thumbSelectors = [
      '.js-sd-thumb-1',
      '.js-sd-thumb-2',
      '.js-sd-thumb-3',
      '.js-sd-thumb-4',
    ];

    imgSelectors.forEach((sel, idx) => {
      const src = images[idx] || images[0];
      if (!src) return;
      setAttr(sel, 'src', src);
      setAttr(sel, 'alt', product.name || 'Product');
      setAttr(sel, 'loading', 'lazy');
    });

    thumbSelectors.forEach((sel, idx) => {
      const src = images[idx] || images[0];
      if (!src) return;
      setAttr(sel, 'src', src);
      setAttr(sel, 'alt', product.name || 'Product');
      setAttr(sel, 'loading', 'lazy');
    });

    // Add to cart
    const addBtn = document.querySelector('[data-add-to-cart="1"]');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!window.CartStore) return;

        window.CartStore.addItem({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.thumbnail || images[0] || '',
        }, 1);
      }, { once: true });
    }
  };

  if (!Array.isArray(products) || products.length === 0) {
    window.addEventListener('products:change', (e) => {
      const next = e?.detail?.products;
      if (!Array.isArray(next)) return;
      products = next;
      render();
    }, { once: true });
  }

  render();
})();
