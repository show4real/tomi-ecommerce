/*
  Shared product data (API-backed)
  - Fetches from HayzeeOnline API: /api/health-supplements/products?rows=20
  - Normalizes the API response into the shape expected by existing renderers

  Exposes:
    - window.DSNH_PRODUCTS (Array)
    - window.DSNH_ProductsAPI (helpers)
    - window.dispatchEvent('products:change') when refreshed
*/

(() => {
  const DEFAULT_BASE_URL = 'https://api.dsnutritional.com';
  const DEFAULT_ROWS = 20;

  const getBaseUrl = () => {
    const v = (typeof window.HEALTH_SUPPLEMENTS_API_BASE_URL === 'string')
      ? window.HEALTH_SUPPLEMENTS_API_BASE_URL
      : '';
    return (v && v.trim()) ? v.trim().replace(/\/$/, '') : DEFAULT_BASE_URL;
  };

  const buildProductsUrl = ({ rows = DEFAULT_ROWS, search = '' } = {}) => {
    const base = getBaseUrl();
    const url = new URL(`${base}/api/health-supplements/products`);
    url.searchParams.set('rows', String(rows));
    if (search) url.searchParams.set('search', String(search));
    return url.toString();
  };

  // Sample JSON fallback (matches the Postman collection intent)
  const SAMPLE_PRODUCTS_RESPONSE = {
    data: [
      {
        id: 1,
        name: 'Vitamin D3 5000IU',
        description: 'Bone + immune support (90 softgels)',
        price: 9800,
        availability: 1,
        image: 'assets/img/products/product-1.png',
        created_at: '2026-02-23T00:00:00Z',
        updated_at: '2026-02-23T00:00:00Z',
      },
      {
        id: 2,
        name: 'Omega-3 Fish Oil 2000mg',
        description: 'Heart + brain support (60 capsules)',
        price: 14500,
        availability: 1,
        image: 'assets/img/products/product-1.png',
        created_at: '2026-02-23T00:00:00Z',
        updated_at: '2026-02-23T00:00:00Z',
      },
    ],
    meta: { rows: DEFAULT_ROWS },
  };

  const asNumber = (v, fallback = 0) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const pickFirstImage = (p) => {
    // API might return: image, images[], thumbnail, photo_url, etc.
    const direct = p?.image || p?.thumbnail || p?.photo_url || p?.image_url;
    if (direct) return String(direct);
    const arr = Array.isArray(p?.images) ? p.images : [];
    if (arr.length) return String(arr[0]);
    return 'assets/img/products/product-1.png';
  };

  const normalizeProduct = (p) => {
    const id = p?.id ?? p?.product_id ?? p?.uuid;
    const name = p?.name ?? p?.title ?? 'Product';

    const image = pickFirstImage(p);

    // Storefront expects price like 49.99. API works with 9800 (likely NGN kobo?)
    // We'll expose both raw and a display-friendly value.
    const rawPrice = asNumber(p?.price, 0);
    const displayPrice = rawPrice >= 1000 ? (rawPrice / 100) : rawPrice; // heuristic

    return {
      // Required by existing pages
      id: String(id ?? ''),
      name: String(name),
      category: String(p?.category ?? p?.category_name ?? 'Supplement'),
      price: displayPrice,
      discountLabel: String(p?.discountLabel ?? ''),
      rating: asNumber(p?.rating, 4.5),
      reviewsCount: asNumber(p?.reviewsCount ?? p?.reviews ?? 0, 0),
      images: Array.isArray(p?.images) && p.images.length ? p.images.map(String) : [image],
      thumbnail: String(p?.thumbnail ?? image),
      sku: String(p?.sku ?? p?.id ?? ''),
      brand: String(p?.brand ?? 'HayzeeOnline'),
      shortDescription: String(p?.shortDescription ?? p?.short_description ?? p?.description ?? ''),
      description: String(p?.description ?? ''),
      details: {
        type: String(p?.details?.type ?? 'Supplement'),
        xpd: String(p?.details?.xpd ?? ''),
        countryOfOrigin: String(p?.details?.countryOfOrigin ?? ''),
      },

      // Admin/API helpers
      api: {
        price_raw: rawPrice,
        availability: p?.availability,
        image,
        raw: p,
      },
    };
  };

  const unwrapList = (json) => {
    // Supports: {data:[...]}, {items:[...]}, or plain array
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.data)) return json.data;
    if (json && Array.isArray(json.items)) return json.items;
  // API shape observed from backend: { products: { data: [...] } }
  if (json && json.products && Array.isArray(json.products.data)) return json.products.data;
    if (json && json.data && Array.isArray(json.data.data)) return json.data.data;
    return [];
  };

  const setProducts = (products) => {
    window.DSNH_PRODUCTS = products;
    window.dispatchEvent(new CustomEvent('products:change', { detail: { products } }));
  };

  const fetchProducts = async ({ rows = DEFAULT_ROWS, search = '' } = {}) => {
    const url = buildProductsUrl({ rows, search });
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
    return res.json();
  };

  const refresh = async ({ rows = DEFAULT_ROWS, search = '' } = {}) => {
    try {
      const json = await fetchProducts({ rows, search });
      const list = unwrapList(json);
      const normalized = list.map(normalizeProduct).filter((p) => p.id);
      setProducts(normalized);
      return normalized;
    } catch (err) {
      console.warn('[products-data] Falling back to sample JSON. Reason:', err);
      const list = unwrapList(SAMPLE_PRODUCTS_RESPONSE);
      const normalized = list.map(normalizeProduct).filter((p) => p.id);
      setProducts(normalized);
      return normalized;
    }
  };

  window.DSNH_ProductsAPI = {
    getBaseUrl,
    buildProductsUrl,
    refresh,
    normalizeProduct,
  };

  // Initial load (non-blocking)
  setProducts([]);
  refresh({ rows: DEFAULT_ROWS });
})();
