/*
  Shop page renderer
  - Renders product grid in shop.html from window.DSNH_PRODUCTS
  - Product clicks navigate to shop-details.html?id=<product.id>
*/

(() => {
  let products = window.DSNH_PRODUCTS;

  // Ensure cart store is available
  if (!window.CartStore) {
    // If scripts were loaded out of order, fail gracefully.
    console.warn('[shop-page] CartStore not found. Did you include assets/js/cart-store.js?');
  }

  const grid = document.getElementById('shop-grid');
  const template = document.getElementById('shop-item-template');
  if (!grid || !template) return;

  const formatPrice = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
    return String(value ?? '');
  };

  const setText = (el, text) => {
    if (el) el.textContent = text;
  };

  const setHref = (el, href) => {
    if (el && href) el.setAttribute('href', href);
  };

  const setImage = (img, src, alt) => {
    if (!img) return;
    if (src) img.setAttribute('src', src);
    img.setAttribute('alt', alt || 'Product');
    img.setAttribute('loading', 'lazy');
  };

  const setDiscount = (el, label) => {
    if (!el) return;
    if (label) {
      el.hidden = false;
      el.textContent = ` ${label}`;
    } else {
      el.hidden = true;
    }
  };

  const render = (items) => {
    grid.innerHTML = '';

    const frag = document.createDocumentFragment();
    items.forEach((p) => {
      const node = template.content.cloneNode(true);

      const detailsHref = `shop-details.html?id=${encodeURIComponent(p.id)}`;

      const thumbLink = node.querySelector('.js-product-link');
      const titleLink = node.querySelector('.js-product-title');
      const img = node.querySelector('.js-product-image');
      const discount = node.querySelector('.js-product-discount');
      const cat = node.querySelector('.js-product-category');
      const price = node.querySelector('.js-product-price');
      const reviews = node.querySelector('.js-product-reviews');
      const buy = node.querySelector('.js-product-buy');

  // Add-to-cart button/icon inside template
  const add = node.querySelector('.cart');

      setHref(thumbLink, detailsHref);
      setHref(titleLink, detailsHref);
      setHref(buy, detailsHref);

      // Make the cart icon add to cart instead of navigating to cart.html
      if (add) {
        add.setAttribute('href', '#');
        add.setAttribute('data-add-to-cart', '1');
        add.setAttribute('data-product-id', String(p.id));
        add.setAttribute('aria-label', `Add ${p.name || 'item'} to cart`);
      }

      setImage(img, p.thumbnail || (p.images && p.images[0]), p.name);
      setDiscount(discount, p.discountLabel);
      setText(cat, p.category || 'Wellness');
      setText(titleLink, p.name || 'Product');
      setText(price, formatPrice(p.price));
      setText(reviews, `(${p.reviewsCount ?? 0})`);

      frag.appendChild(node);
    });

    grid.appendChild(frag);
  };

  const renderEmpty = () => {
    grid.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info" role="status" style="margin: 10px 0;">
          Loading products...
        </div>
      </div>
    `;
  };

  if (!Array.isArray(products) || products.length === 0) {
    renderEmpty();
  } else {
    render(products);
  }

  window.addEventListener('products:change', (e) => {
    const next = e?.detail?.products;
    if (!Array.isArray(next)) return;
    products = next;
    render(products);
  });

  // Event delegation for add-to-cart clicks
  grid.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const btn = target.closest('[data-add-to-cart="1"]');
    if (!btn) return;

    e.preventDefault();

    const id = btn.getAttribute('data-product-id') || '';
    const product = products.find((p) => String(p.id) === String(id));
    if (!product || !window.CartStore) return;

    window.CartStore.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.thumbnail || (product.images && product.images[0]) || '',
    }, 1);
  });
})();
