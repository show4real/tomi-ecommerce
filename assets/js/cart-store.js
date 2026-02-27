/*
	Cart Store

	Purpose
	- Single source of truth for the cart across pages (index.html, shop.html, cart.html, checkout.html)
	- Persists to localStorage
	- Keeps the cart count in the header synced (elements with .mini-cart-count)

	Exposes: window.CartStore

	Cart model (stored in localStorage)
	{
		version: 1,
		currency: 'USD',
		items: [
			{
				id: 'p1',
				name: 'Box Full of Muscles',
				price: 85.99,
				image: 'assets/img/products/home_shop_thumb01.png',
				qty: 2
			}
		]
	}
*/

(() => {
	const STORAGE_KEY = 'tomi_cart_v1';
	const VERSION = 1;

	const ensureToastStyles = () => {
		if (document.getElementById('tomi-toast-styles')) return;
		const style = document.createElement('style');
		style.id = 'tomi-toast-styles';
		style.textContent = `
			.tomi-toast-wrap{position:fixed;right:18px;top:18px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none}
			.tomi-toast{pointer-events:none;min-width:220px;max-width:360px;background:rgba(20,20,20,.92);color:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:14px;line-height:1.3;opacity:0;transform:translateY(-8px);transition:opacity .18s ease,transform .18s ease}
			.tomi-toast[data-type="success"]{background:rgba(22, 163, 74, .95)}
			.tomi-toast[data-type="error"]{background:rgba(220, 38, 38, .95)}
			.tomi-toast[data-type="info"]{background:rgba(17, 94, 163, .95)}
			.tomi-toast.is-visible{opacity:1;transform:translateY(0)}
		`;
		document.head.appendChild(style);
	};

	const showToast = (message, { type = 'success', durationMs = 1800 } = {}) => {
		if (typeof document === 'undefined') return;
		ensureToastStyles();

		let wrap = document.querySelector('.tomi-toast-wrap');
		if (!wrap) {
			wrap = document.createElement('div');
			wrap.className = 'tomi-toast-wrap';
			document.body.appendChild(wrap);
		}

		const toast = document.createElement('div');
		toast.className = 'tomi-toast';
		toast.dataset.type = type;
		toast.textContent = message;
		wrap.appendChild(toast);

		// paint
		requestAnimationFrame(() => toast.classList.add('is-visible'));

		window.setTimeout(() => {
			toast.classList.remove('is-visible');
			window.setTimeout(() => toast.remove(), 220);
		}, durationMs);
	};

	const safeJsonParse = (value, fallback) => {
		try {
			const parsed = JSON.parse(value);
			return parsed ?? fallback;
		} catch {
			return fallback;
		}
	};

	const clampQty = (qty) => {
		const n = Number(qty);
		if (!Number.isFinite(n)) return 1;
		return Math.max(1, Math.floor(n));
	};

	const normalizeItem = (item) => {
		const id = String(item?.id ?? '');
		if (!id) return null;
		return {
			id,
			name: String(item?.name ?? ''),
			price: Number(item?.price ?? 0),
			image: String(item?.image ?? ''),
			qty: clampQty(item?.qty ?? 1),
		};
	};

	const readCart = () => {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		const base = { version: VERSION, currency: 'USD', items: [] };
		if (!raw) return base;

		const data = safeJsonParse(raw, base);
		if (!data || typeof data !== 'object') return base;

		const items = Array.isArray(data.items) ? data.items.map(normalizeItem).filter(Boolean) : [];
		return {
			version: VERSION,
			currency: String(data.currency || 'USD'),
			items,
		};
	};

	const writeCart = (cart) => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
	};

	const countItems = (cart) => cart.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

	const calcSubtotal = (cart) => cart.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);

	const dispatchChange = () => {
		window.dispatchEvent(new CustomEvent('cart:change'));
	};

	const renderHeaderCount = () => {
		const cart = readCart();
		const count = countItems(cart);
		document.querySelectorAll('.mini-cart-count').forEach((el) => {
			el.textContent = String(count);
		});
	};

	// Keep count in sync across tabs/windows
	window.addEventListener('storage', (e) => {
		if (e.key === STORAGE_KEY) renderHeaderCount();
	});

	// Keep count in sync within a page
	window.addEventListener('cart:change', () => renderHeaderCount());

	// Initial render (in case templates have static 0)
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', renderHeaderCount);
	} else {
		renderHeaderCount();
	}

	const api = {
		STORAGE_KEY,
		toast: showToast,
		getCart() {
			return readCart();
		},
		clear() {
			writeCart({ version: VERSION, currency: 'USD', items: [] });
			dispatchChange();
		},
		addItem(item, qty = 1) {
			const cart = readCart();
			const normalized = normalizeItem({ ...item, qty });
			if (!normalized) return cart;

			const existing = cart.items.find((it) => String(it.id) === String(normalized.id));
			if (existing) {
				existing.qty = clampQty(existing.qty + normalized.qty);
			} else {
				cart.items.push(normalized);
			}

			writeCart(cart);
			dispatchChange();

			// UX: toast
			showToast(`${normalized.name || 'Item'} added to cart`, { type: 'success' });
			return cart;
		},
		removeItem(productId) {
			const cart = readCart();
			const id = String(productId ?? '');
			cart.items = cart.items.filter((it) => String(it.id) !== id);
			writeCart(cart);
			dispatchChange();
			return cart;
		},
		setQty(productId, qty) {
			const cart = readCart();
			const id = String(productId ?? '');
			const nextQty = clampQty(qty);
			const item = cart.items.find((it) => String(it.id) === id);
			if (item) item.qty = nextQty;
			writeCart(cart);
			dispatchChange();
			return cart;
		},
		getCount() {
			return countItems(readCart());
		},
		getSubtotal() {
			return calcSubtotal(readCart());
		},
		toOrderPayload(customer = {}) {
			const cart = readCart();
			const subtotal = calcSubtotal(cart);

			return {
				currency: cart.currency,
				items: cart.items.map((it) => ({
					id: it.id,
					name: it.name,
					price: it.price,
					qty: it.qty,
					image: it.image,
					lineTotal: Number(((Number(it.price) || 0) * (Number(it.qty) || 0)).toFixed(2)),
				})),
				totals: {
					subtotal: Number(subtotal.toFixed(2)),
					total: Number(subtotal.toFixed(2)),
				},
				customer,
				createdAt: new Date().toISOString(),
				source: window.location.href,
			};
		},
	};

	window.CartStore = api;
})();

