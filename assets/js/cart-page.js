/*
	Cart page logic
	- Renders items from window.CartStore into cart.html
	- Supports qty changes and removal
*/

(() => {
	if (!window.CartStore) {
		console.warn('[cart-page] CartStore not found. Did you include assets/js/cart-store.js?');
		return;
	}

	const tbody = document.getElementById('cart-items');
	const subtotalEl = document.getElementById('cart-subtotal');
	const totalEl = document.getElementById('cart-total');

	if (!tbody) return;

	const formatPrice = (value) => {
		const n = typeof value === 'number' ? value : Number(value);
		if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
		return '$0.00';
	};

	const escapeHtml = (s) => String(s)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

	const render = () => {
		const cart = window.CartStore.getCart();
		const items = cart.items || [];

		if (items.length === 0) {
			tbody.innerHTML = `
				<tr>
					<td colspan="6" class="text-center py-5">
						<p class="mb-3">Your cart is empty.</p>
						<a href="shop.html" class="btn btn-sm">Go to shop</a>
					</td>
				</tr>
			`;
		} else {
			tbody.innerHTML = items.map((it) => {
				const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
				const detailsHref = `shop-details.html?id=${encodeURIComponent(it.id)}`;

				return `
					<tr data-cart-row="1" data-product-id="${escapeHtml(it.id)}">
						<td class="product__thumb">
							<a href="${detailsHref}"><img src="${escapeHtml(it.image || 'assets/img/products/home_shop_thumb01.png')}" alt="${escapeHtml(it.name || 'Product')}"></a>
							<a class="js-cart-remove cart__remove-under-thumb" href="#" aria-label="Remove item">&times;</a>
						</td>
						<td class="product__name">
								<a href="${detailsHref}">${escapeHtml(it.name || 'Product')}</a>
								<small class="cart__mobile-subtotal d-md-none">Subtotal: ${formatPrice(line)}</small>
						</td>
						<td class="product__price">${formatPrice(it.price)}</td>
						<td class="product__quantity">
							<div class="quickview-cart-plus-minus">
								<input class="js-cart-qty" type="number" min="1" step="1" value="${escapeHtml(it.qty)}" aria-label="Quantity">
							</div>
						</td>
						<td class="product__subtotal">${formatPrice(line)}</td>
						<td class="product__remove">
							<a class="js-cart-remove d-none d-md-inline" href="#" aria-label="Remove item">
							<a class="js-cart-remove d-none d-md-inline" href="#" aria-label="Remove item">&times;</a>
						</td>
					</tr>
				`;
			}).join('');
		}

		const subtotal = window.CartStore.getSubtotal();
		if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
		if (totalEl) totalEl.textContent = formatPrice(subtotal);
	};

	// Handle qty changes (debounced a bit by using change event)
	tbody.addEventListener('change', (e) => {
		const target = e.target instanceof Element ? e.target : null;
		if (!target) return;
		if (!target.classList.contains('js-cart-qty')) return;

		const row = target.closest('[data-cart-row="1"]');
		if (!row) return;
		const id = row.getAttribute('data-product-id');
		if (!id) return;

		window.CartStore.setQty(id, target.value);
		render();
	});

	tbody.addEventListener('click', (e) => {
		const target = e.target instanceof Element ? e.target : null;
		if (!target) return;
		const remove = target.closest('.js-cart-remove');
		if (!remove) return;
		e.preventDefault();

		const row = remove.closest('[data-cart-row="1"]');
		const id = row?.getAttribute('data-product-id');
		if (!id) return;

		window.CartStore.removeItem(id);
		render();
	});

	window.addEventListener('cart:change', () => render());
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', render);
	} else {
		render();
	}
})();

