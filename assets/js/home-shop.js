/*
  Home shop grid renderer
  - Uses local JSON placeholder (replace with API call later)
  - Renders the first 6 products into #home-shop-grid using #home-shop-template
*/

(() => {
  const grid = document.getElementById('home-shop-grid');
  const template = document.getElementById('home-shop-template');

  if (!grid || !template) return;

  let products = Array.isArray(window.DSNH_PRODUCTS) ? window.DSNH_PRODUCTS : [];

  const formatPrice = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
    return String(value ?? '');
  };

  const setText = (el, text) => {
    if (!el) return;
    el.textContent = text;
  };

  const setHref = (el, href) => {
    if (!el || !href) return;
    el.setAttribute('href', href);
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

  const setShapeClass = (el, shapeClass) => {
    if (!el) return;
    // base class must remain for theme styling
    el.className = `shop-thumb-shape${shapeClass ? ` ${shapeClass}` : ''}`;
  };

  const render = (items) => {
    grid.innerHTML = '';

    const firstSix = (items || []).slice(0, 6);
    const frag = document.createDocumentFragment();

    firstSix.forEach((p) => {
      const node = template.content.cloneNode(true);

      const link = node.querySelector('.js-product-link');
      const title = node.querySelector('.js-product-title');
      const price = node.querySelector('.js-product-price');
      const image = node.querySelector('.js-product-image');
      const discount = node.querySelector('.js-product-discount');
      const shape = node.querySelector('.js-product-shape');
      const reviews = node.querySelector('.js-product-reviews');
      const buy = node.querySelector('.js-product-buy');

  const href = `shop-details.html?id=${encodeURIComponent(p.id)}`;

      setHref(link, href);
      setHref(title, href);
      setHref(buy, href);
      setText(title, p.name || 'Product');
      setText(price, formatPrice(p.price));
  setImage(image, p.thumbnail || (p.images && p.images[0]) || p.image, p.name);
      setDiscount(discount, p.discountLabel);
      setShapeClass(shape, p.shapeClass);
      setText(reviews, `(${p.reviewsCount ?? 0})`);

      const add = node.querySelector('.cart');
      if (add) {
        add.setAttribute('href', '#');
        add.setAttribute('data-add-to-cart', '1');
        add.setAttribute('data-product-id', String(p.id));
        add.setAttribute('aria-label', `Add ${p.name || 'item'} to cart`);
      }

      frag.appendChild(node);
    });

    grid.appendChild(frag);

    // If the theme initialized slick before we injected items, we need to refresh it.
    // The theme uses slick on `.home-shop-active`.
    if (window.jQuery) {
      const $ = window.jQuery;
      const $slider = $('.home-shop-active');

      if ($slider.length) {
        // Already initialized
        if ($slider.hasClass('slick-initialized')) {
          $slider.slick('refresh');
        } else if (typeof $slider.slick === 'function') {
          // Not initialized yet (or got destroyed). Re-init with a safe default.
          // If your theme already initializes it elsewhere, this block won't run.
          $slider.slick({
            dots: false,
            arrows: true,
            infinite: true,
            autoplay: false,
            speed: 600,
            slidesToShow: 4,
            slidesToScroll: 1,
            responsive: [
              { breakpoint: 1200, settings: { slidesToShow: 3 } },
              { breakpoint: 992, settings: { slidesToShow: 2 } },
              { breakpoint: 576, settings: { slidesToShow: 1 } },
            ],
          });
        }
      }
    }
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
