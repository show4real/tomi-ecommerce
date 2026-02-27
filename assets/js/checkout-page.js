/*
	Checkout page logic
	- Renders order summary from window.CartStore
	- Sends order payload as JSON to an API endpoint

	Configure endpoint:
		- Set window.CHECKOUT_API_ENDPOINT before this script, OR
		- Add <meta name="checkout-endpoint" content="https://...">
*/

(() => {
	const DEFAULT_CHECKOUT_ENDPOINT = 'https://apiv2.hayzeeonline.com/api/health-supplements/orders';
	const ORDER_HISTORY_KEY = 'tomi_orders_v1';

	const safeJsonParse = (value, fallback) => {
		try {
			const parsed = JSON.parse(value);
			return parsed ?? fallback;
		} catch {
			return fallback;
		}
	};

	const writeOrderHistory = (next) => {
		window.localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(next));
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

	const addOrderToHistory = ({ requestPayload, responseData }) => {
		const history = readOrderHistory();
		const id = responseData?.id ?? responseData?.order?.id ?? responseData?.data?.id;
		const currency = requestPayload?.currency || 'NGN';
		history.orders.unshift({
			id: id != null ? String(id) : '',
			createdAt: new Date().toISOString(),
			currency,
			customer: requestPayload?.customer || null,
			items: requestPayload?.items || [],
			payment: requestPayload?.payment || null,
			response: responseData || null,
		});
		// keep last 50
		history.orders = history.orders.slice(0, 50);
		writeOrderHistory(history);
		window.dispatchEvent(new CustomEvent('orders:change', { detail: history }));
	};

	if (!window.CartStore) {
		console.warn('[checkout-page] CartStore not found. Did you include assets/js/cart-store.js?');
		return;
	}

	const summaryEl = document.getElementById('checkout-summary');
	const statusEl = document.getElementById('checkout-status');
	const btn = document.getElementById('place-order-btn');
	const form = document.getElementById('checkout-form');

	const formatPrice = (value) => {
		const n = typeof value === 'number' ? value : Number(value);
		if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
		return '$0.00';
	};

	const getEndpoint = () => {
		if (typeof window.CHECKOUT_API_ENDPOINT === 'string' && window.CHECKOUT_API_ENDPOINT.trim()) {
			return window.CHECKOUT_API_ENDPOINT.trim();
		}
		const meta = document.querySelector('meta[name="checkout-endpoint"]');
		const content = meta?.getAttribute('content')?.trim();
		return content || DEFAULT_CHECKOUT_ENDPOINT;
	};

	const setStatus = (msg, type = 'info') => {
		if (!statusEl) return;
		statusEl.textContent = msg;
		statusEl.dataset.type = type;
	};

	const getCustomer = () => {
		const v = (id) => (document.getElementById(id)?.value ?? '').toString().trim();
		const firstName = v('first-name');
		const lastName = v('last-name');
		return {
			name: `${firstName} ${lastName}`.trim(),
			email: v('email'),
			phone: v('phone'),
			address: [v('street-address'), v('street-address-two'), v('town-name'), v('district-name'), v('zip-code'), v('country-name')]
				.filter(Boolean)
				.join(', '),
		};
	};

	const toApiOrderPayload = () => {
		const cart = window.CartStore.getCart();
		const currency = String(cart.currency || 'NGN');
		const items = (cart.items || []).map((it) => ({
			product_id: Number(it.id),
			quantity: Number(it.qty) || 1,
			price: Number(it.price) || 0,
			name: it.name || '',
			image: it.image || '',
		}));

		return {
			currency,
			customer: getCustomer(),
			payment: {
				reference: `WEB_${Date.now()}`,
				provider: 'web',
				status: 'pending',
			},
			items,
		};
	};

	const render = () => {
		if (!summaryEl) return;
		const cart = window.CartStore.getCart();
		const items = cart.items || [];
		const subtotal = window.CartStore.getSubtotal();

		if (items.length === 0) {
			summaryEl.innerHTML = `
				<li class="title">Product <span>Subtotal</span></li>
				<li class="d-flex justify-content-between"><span>Your cart is empty</span> <span>${formatPrice(0)}</span></li>
				<li>Subtotal <span>${formatPrice(0)}</span></li>
				<li>Total <span>${formatPrice(0)}</span></li>
			`;
			if (btn) btn.disabled = true;
			return;
		}

		if (btn) btn.disabled = false;

		const lines = items.map((it) => {
			const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
			return `<li>${(it.name || 'Product')} × ${it.qty} <span>${formatPrice(line)}</span></li>`;
		}).join('');

		summaryEl.innerHTML = `
			<li class="title">Product <span>Subtotal</span></li>
			${lines}
			<li>Subtotal <span>${formatPrice(subtotal)}</span></li>
			<li>Total <span>${formatPrice(subtotal)}</span></li>
		`;
	};

	const submitOrder = async () => {
		const endpoint = getEndpoint();
		if (!endpoint) {
			setStatus('Checkout API endpoint not configured. Set window.CHECKOUT_API_ENDPOINT or <meta name="checkout-endpoint">.', 'error');
			return;
		}

		if (form && !form.checkValidity()) {
			form.reportValidity();
			return;
		}

		const payload = toApiOrderPayload();

		try {
			if (btn) btn.disabled = true;
			setStatus('Placing order...', 'info');

			const res = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new Error(`Request failed (${res.status}) ${text}`);
			}

			const data = await res.json().catch(() => null);
			setStatus('Order placed successfully.', 'success');
			addOrderToHistory({ requestPayload: payload, responseData: data });

			// Clear cart after success
			window.CartStore.clear();
			render();

			// Optional: store last order response for debugging
			if (data) {
				window.lastOrderResponse = data;
			}
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'Failed to place order.', 'error');
		} finally {
			if (btn) btn.disabled = false;
		}
	};

	if (btn) btn.addEventListener('click', submitOrder);
	window.addEventListener('cart:change', render);
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', render);
	} else {
		render();
	}
})();

