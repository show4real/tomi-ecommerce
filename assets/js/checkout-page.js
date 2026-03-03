/*
	Checkout page logic — Stripe Payment Gateway
	============================================================
	API flow:
	  1. POST  base_url/api/health-supplements/create-payment-intent
	           → { client_secret, id }
	  2. stripe.confirmCardPayment(client_secret, { payment_method: { card } })
	           → Stripe confirms card on the client side
	  3. POST  base_url/api/health-supplements/orders
	           with full order payload including:
	           payment: { provider: "stripe", reference: "<pi_id>", status: "succeeded" }
	           Backend re-verifies the PaymentIntent before saving.

	Configure:
	  - Set window.STRIPE_PUBLISHABLE_KEY before this script, OR
	    add <meta name="stripe-key" content="pk_live_...">
	  - Set window.CHECKOUT_API_BASE before this script, OR
	    add <meta name="checkout-api-base" content="https://api.dsnutritional.com">
*/

(() => {
	// ─── Config ──────────────────────────────────────────────────────────────────
	const DEFAULT_API_BASE = 'https://api.dsnutritional.com';
	const ORDER_HISTORY_KEY = 'tomi_orders_v1';

	const getApiBase = () => {
		if (typeof window.CHECKOUT_API_BASE === 'string' && window.CHECKOUT_API_BASE.trim()) {
			return window.CHECKOUT_API_BASE.trim().replace(/\/$/, '');
		}
		const meta = document.querySelector('meta[name="checkout-api-base"]');
		const content = meta?.getAttribute('content')?.trim();
		return (content || DEFAULT_API_BASE).replace(/\/$/, '');
	};

	const getStripeKey = () => {
		if (typeof window.STRIPE_PUBLISHABLE_KEY === 'string' && window.STRIPE_PUBLISHABLE_KEY.trim()) {
			return window.STRIPE_PUBLISHABLE_KEY.trim();
		}
		const meta = document.querySelector('meta[name="stripe-key"]');
		return meta?.getAttribute('content')?.trim() || '';
	};

	// ─── Order history helpers ────────────────────────────────────────────────────
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
		const currency = requestPayload?.currency || 'USD';
		history.orders.unshift({
			id: id != null ? String(id) : '',
			createdAt: new Date().toISOString(),
			currency,
			customer: requestPayload?.customer || null,
			items: requestPayload?.items || [],
			payment: requestPayload?.payment || null,
			response: responseData || null,
		});
		history.orders = history.orders.slice(0, 50);
		writeOrderHistory(history);
		window.dispatchEvent(new CustomEvent('orders:change', { detail: history }));
	};

	// ─── Guard ────────────────────────────────────────────────────────────────────
	if (!window.CartStore) {
		console.warn('[checkout-page] CartStore not found. Did you include assets/js/cart-store.js?');
		return;
	}

	// ─── DOM refs ─────────────────────────────────────────────────────────────────
	const summaryEl   = document.getElementById('checkout-summary');
	const statusEl    = document.getElementById('checkout-status');
	const btn         = document.getElementById('place-order-btn');
	const form        = document.getElementById('checkout-form');
	const cardWrap    = document.getElementById('stripe-card-element');
	const cardErrEl   = document.getElementById('stripe-card-errors');

	// ─── Helpers ──────────────────────────────────────────────────────────────────
	const formatPrice = (value) => {
		const n = typeof value === 'number' ? value : Number(value);
		if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
		return '$0.00';
	};

	const setStatus = (msg, type = 'info') => {
		if (!statusEl) return;
		statusEl.textContent = msg;
		statusEl.dataset.type = type;
		statusEl.style.display = msg ? 'block' : 'none';
	};

	const setLoading = (loading) => {
		if (!btn) return;
		btn.disabled = loading;
		btn.textContent = loading ? 'Processing…' : 'Place order';
	};

	const getCustomer = () => {
		const v = (id) => (document.getElementById(id)?.value ?? '').toString().trim();
		const firstName = v('first-name');
		const lastName  = v('last-name');
		return {
			name:    `${firstName} ${lastName}`.trim(),
			email:   v('email'),
			phone:   v('phone'),
			address: [v('street-address'), v('street-address-two'), v('town-name'), v('district-name'), v('zip-code'), v('country-name')]
				.filter(Boolean)
				.join(', '),
		};
	};

	const buildOrderItems = () => {
		const cart = window.CartStore.getCart();
		return (cart.items || []).map((it) => ({
			product_id: Number(it.id),
			quantity:   Number(it.qty) || 1,
			// Price in cents (smallest USD unit) — multiply display price by 100
			price:      Math.round((Number(it.price) || 0) * 100),
			name:       it.name || '',
			image:      it.image || '',
		}));
	};

	// ─── Order summary render ─────────────────────────────────────────────────────
	const render = () => {
		if (!summaryEl) return;
		const cart     = window.CartStore.getCart();
		const items    = cart.items || [];
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
			return `<li>${it.name || 'Product'} × ${it.qty} <span>${formatPrice(line)}</span></li>`;
		}).join('');

		summaryEl.innerHTML = `
			<li class="title">Product <span>Subtotal</span></li>
			${lines}
			<li>Subtotal <span>${formatPrice(subtotal)}</span></li>
			<li>Total <span>${formatPrice(subtotal)}</span></li>
		`;
	};

	// ─── Stripe setup ─────────────────────────────────────────────────────────────
	let stripeInstance = null;
	let cardElement    = null;

	const mountStripeCard = () => {
		const key = getStripeKey();
		if (!key) {
			console.warn('[checkout-page] Stripe publishable key not set.');
			if (cardWrap) {
				cardWrap.innerHTML = '<p style="color:#c0392b;font-size:13px;">Payment provider not configured.</p>';
			}
			return;
		}

		if (typeof window.Stripe === 'undefined') {
			console.warn('[checkout-page] Stripe.js not loaded yet — retrying in 500 ms.');
			setTimeout(mountStripeCard, 500);
			return;
		}

		stripeInstance = window.Stripe(key);
		const elements = stripeInstance.elements();

		cardElement = elements.create('card', {
			style: {
				base: {
					color:           '#32325d',
					fontFamily:      '"Helvetica Neue", Helvetica, sans-serif',
					fontSmoothing:   'antialiased',
					fontSize:        '15px',
					'::placeholder': { color: '#aab7c4' },
				},
				invalid: { color: '#c0392b', iconColor: '#c0392b' },
			},
		});

		if (cardWrap) {
			cardElement.mount(cardWrap);
			cardElement.on('change', (event) => {
				if (cardErrEl) {
					cardErrEl.textContent = event.error ? event.error.message : '';
				}
			});
		}
	};

	// ─── Step 1 — Create PaymentIntent ────────────────────────────────────────────
	const createPaymentIntent = async (items) => {
		const url = `${getApiBase()}/api/health-supplements/create-payment-intent`;
		const res = await fetch(url, {
			method:  'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body:    JSON.stringify({ items }),
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`Could not initialise payment (${res.status}). ${text}`);
		}
		const data = await res.json();
		if (!data?.client_secret) throw new Error('Invalid response from payment server.');
		// Normalise: backend may return `payment_intent_id` or `id` for the PI id
		if (!data.id && data.payment_intent_id) data.id = data.payment_intent_id;
		return data; // { client_secret, id, payment_intent_id, amount }
	};

	// ─── Step 2 — Confirm card payment with Stripe.js ────────────────────────────
	const confirmCardPayment = async (clientSecret, customer) => {
		if (!stripeInstance || !cardElement) {
			throw new Error('Stripe is not initialised. Please refresh the page and try again.');
		}
		const { paymentIntent, error } = await stripeInstance.confirmCardPayment(clientSecret, {
			payment_method: {
				card:            cardElement,
				billing_details: {
					name:  customer.name,
					email: customer.email,
					phone: customer.phone,
					address: { line1: customer.address },
				},
			},
		});
		if (error) throw new Error(error.message);
		if (paymentIntent.status !== 'succeeded') {
			throw new Error(`Payment status: ${paymentIntent.status}. Please try again.`);
		}
		return paymentIntent; // { id, status, ... }
	};

	// ─── Step 3 — Submit confirmed order to backend ───────────────────────────────
	const submitOrderToBackend = async ({ customer, items, currency, clientSecret, paymentIntentId, amount }) => {
		const url     = `${getApiBase()}/api/health-supplements/orders`;
		const payload = {
			currency,
			customer,
			items,
			payment: {
				provider:          'stripe',
				reference:         paymentIntentId,
				status:            'succeeded',
				client_secret:     clientSecret,
				payment_intent_id: paymentIntentId,
				amount,
			},
		};
		console.log('[checkout] Submitting order payload:', JSON.stringify(payload, null, 2));

		const res = await fetch(url, {
			method:  'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body:    JSON.stringify(payload),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`Order submission failed (${res.status}). ${text}`);
		}

		const data = await res.json().catch(() => null);
		return { payload, data };
	};

	// ─── Main checkout handler ────────────────────────────────────────────────────
	const handlePlaceOrder = async () => {
		// Validate billing form
		if (form && !form.checkValidity()) {
			form.reportValidity();
			return;
		}

		// Require non-empty cart
		const cart = window.CartStore.getCart();
		if (!cart.items || cart.items.length === 0) {
			setStatus('Your cart is empty.', 'error');
			return;
		}

		const customer = getCustomer();
		const items    = buildOrderItems();
		const currency = String(cart.currency || 'USD');

		try {
			setLoading(true);
			setStatus('', 'info');

			// ── Step 1: Create PaymentIntent ──────────────────────────────────────
			setStatus('Initialising payment…', 'info');
			const piResponse = await createPaymentIntent(items);
			console.log('[checkout] PaymentIntent response:', piResponse);
			const clientSecret    = piResponse.client_secret;
			const paymentIntentId = piResponse.payment_intent_id ?? piResponse.id;
			const amount          = piResponse.amount;

			if (!paymentIntentId) throw new Error('Payment server did not return a payment intent ID.');

			// ── Step 2: Confirm card with Stripe ──────────────────────────────────
			setStatus('Verifying card…', 'info');
			await confirmCardPayment(clientSecret, customer);

			// ── Step 3: Submit order to backend ───────────────────────────────────
			setStatus('Placing your order…', 'info');
			const { payload, data } = await submitOrderToBackend({ customer, items, currency, clientSecret, paymentIntentId, amount });

			// ── Success ───────────────────────────────────────────────────────────
			setStatus('✓ Order placed successfully! Thank you for your purchase. Redirecting…', 'success');
			addOrderToHistory({ requestPayload: payload, responseData: data });

			window.CartStore.clear();
			render();

			if (data) window.lastOrderResponse = data;

			// Redirect to homepage after 2 seconds
			setTimeout(() => { window.location.href = 'index.html'; }, 2000);

		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
			setStatus(msg, 'error');
			console.error('[checkout-page] Stripe flow error:', err);
		} finally {
			setLoading(false);
		}
	};

	// ─── Boot ─────────────────────────────────────────────────────────────────────
	if (btn) btn.addEventListener('click', handlePlaceOrder);
	window.addEventListener('cart:change', render);

	const init = () => {
		render();
		mountStripeCard();
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();

