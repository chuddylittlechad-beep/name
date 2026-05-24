// ============================================================
// EmeraldCraft store — frontend logic
// Pulls catalog + status from the backend, manages cart state
// in localStorage, drives modal + checkout flow.
// ============================================================

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  // --- State -----------------------------------------------------
  const state = {
    packages: [],
    crates: [],
    catalogById: new Map(),
    cart: loadCart(),
  };

  function loadCart() {
    try {
      const raw = localStorage.getItem('ec-cart');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function saveCart() {
    localStorage.setItem('ec-cart', JSON.stringify(state.cart));
  }

  // --- Toast -----------------------------------------------------
  const toast = $('#toast');
  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => (toast.hidden = true), 320);
    }, 2400);
  }

  // --- Fetch helpers --------------------------------------------
  async function jsonFetch(url, options) {
    const r = await fetch(url, options);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${r.status})`);
    }
    return r.json();
  }

  // --- Initial data load ----------------------------------------
  async function bootstrap() {
    await Promise.all([loadCatalog(), loadStatus(), loadLeaderboard(), loadRecent()]);
    renderPackages();
    renderCrates();
    renderCart();
    // Refresh status + recent every 25s to feel alive.
    setInterval(loadStatus, 25_000);
    setInterval(loadRecent, 30_000);
  }

  async function loadCatalog() {
    try {
      const data = await jsonFetch('/api/packages');
      state.packages = data.packages;
      state.crates = data.crates;
      state.catalogById = new Map(
        [...state.packages, ...state.crates].map((p) => [p.id, p]),
      );
    } catch (e) {
      $('#packagesGrid').innerHTML =
        '<div class="packages-loading">Couldn\'t load ranks. Refresh to try again.</div>';
      console.error(e);
    }
  }

  async function loadStatus() {
    try {
      const s = await jsonFetch('/api/server-status');
      $('#statusHost').textContent = s.host;
      $('#statusVersion').textContent = `${s.version} · ${s.edition}`;
      $('#statusPlayers').textContent = s.playersOnline.toLocaleString();
      $('#heroPlayerCount').textContent = s.playersOnline.toLocaleString();
    } catch (e) {
      console.error(e);
    }
  }

  async function loadLeaderboard() {
    try {
      const { leaderboard } = await jsonFetch('/api/leaderboard');
      const list = $('#leaderboardList');
      list.innerHTML = leaderboard
        .map((row, i) => {
          const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
          return `
            <li class="${cls}">
              <span class="rank-pos">${i + 1}</span>
              <span class="player-info">
                <span class="player-avatar" style="background:${avatarColor(row.player)}">
                  ${row.player.slice(0, 1)}
                </span>
                <span>
                  <span class="player-name">${escapeHtml(row.player)}</span>
                  <span class="player-rank">${escapeHtml(row.rank)}</span>
                </span>
              </span>
              <span class="donation-amount">${fmt(row.amount)}</span>
            </li>
          `;
        })
        .join('');
    } catch (e) {
      console.error(e);
    }
  }

  async function loadRecent() {
    try {
      const { purchases } = await jsonFetch('/api/recent-purchases');
      const list = $('#recentList');
      list.innerHTML = purchases
        .map(
          (p) => `
        <li>
          <span class="player-avatar" style="background:${avatarColor(p.player)}">
            ${p.player.slice(0, 1)}
          </span>
          <span class="recent-meta">
            <strong>${escapeHtml(p.player)}</strong> bought ${escapeHtml(p.item)}
            <div class="recent-time">${p.minutesAgo} min ago</div>
          </span>
        </li>
      `,
        )
        .join('');
    } catch (e) {
      console.error(e);
    }
  }

  // Deterministic colour from a player name — gives each avatar a
  // distinct look without needing actual portraits.
  function avatarColor(name) {
    const palette = ['#3ee07a', '#4ad7e0', '#f5b342', '#9a6cf2', '#ff8c5a', '#7bf2a4', '#5acdf2'];
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
    return palette[Math.abs(h) % palette.length];
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
    );
  }

  // --- Render packages ------------------------------------------
  function iconHref(id) {
    return `#i-${id}`;
  }

  function renderPackages() {
    const grid = $('#packagesGrid');
    if (!state.packages.length) return;

    grid.innerHTML = state.packages
      .map((p) => {
        const glow = hexToRgba(p.color, 0.25);
        return `
          <article class="pack ${p.popular ? 'popular' : ''}"
                   style="--pack-color:${p.color}; --pack-glow:${glow};">
            ${p.popular ? '<span class="pack-popular-badge">Most popular</span>' : ''}
            <div class="pack-icon"><svg><use href="${iconHref(p.icon)}"/></svg></div>
            <div class="pack-head">
              <span class="pack-tier">${p.tier}</span>
              <h3 class="pack-name">${p.name}</h3>
              <p class="pack-tagline">${escapeHtml(p.tagline)}</p>
            </div>
            <div class="pack-price">
              <strong>${fmt(p.price)}</strong>
              <span>one-time</span>
            </div>
            <ul class="pack-features">
              ${p.features
                .map(
                  (f) => `
                <li>
                  <svg width="16" height="16"><use href="#i-check"/></svg>
                  <span>${escapeHtml(f)}</span>
                </li>
              `,
                )
                .join('')}
            </ul>
            <button class="pack-cta" data-add="${p.id}">
              <svg width="16" height="16"><use href="#i-cart"/></svg>
              Add to cart
            </button>
          </article>
        `;
      })
      .join('');

    $$('[data-add]', grid).forEach((btn) =>
      btn.addEventListener('click', () => addToCart(btn.dataset.add)),
    );
  }

  function renderCrates() {
    const grid = $('#cratesGrid');
    if (!state.crates.length) return;

    grid.innerHTML = state.crates
      .map(
        (c) => `
      <article class="crate" style="--crate-color:${c.color}">
        <div class="crate-icon"><svg><use href="#i-chest"/></svg></div>
        <div class="crate-body">
          <div class="crate-name">${escapeHtml(c.name)}</div>
          <div class="crate-meta">${escapeHtml(c.contains)}</div>
        </div>
        <div class="crate-action">
          <span class="crate-price">${fmt(c.price)}</span>
          <button class="crate-add" data-add="${c.id}">Add to cart</button>
        </div>
      </article>
    `,
      )
      .join('');

    $$('[data-add]', grid).forEach((btn) =>
      btn.addEventListener('click', () => addToCart(btn.dataset.add)),
    );
  }

  function hexToRgba(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(62,224,122,${alpha})`;
    const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // --- Cart -----------------------------------------------------
  function addToCart(id) {
    const item = state.catalogById.get(id);
    if (!item) return;
    const existing = state.cart.find((c) => c.id === id);
    if (existing) {
      existing.qty = Math.min(existing.qty + 1, 10);
    } else {
      state.cart.push({ id, qty: 1 });
    }
    saveCart();
    renderCart();
    showToast(`${item.name} added to cart`);
    bumpCartButton();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter((c) => c.id !== id);
    saveCart();
    renderCart();
  }

  function setQty(id, qty) {
    const entry = state.cart.find((c) => c.id === id);
    if (!entry) return;
    entry.qty = Math.max(1, Math.min(10, qty));
    saveCart();
    renderCart();
  }

  function bumpCartButton() {
    const badge = $('#cartBadge');
    badge.style.animation = 'none';
    requestAnimationFrame(() => {
      badge.style.animation = 'pulse 600ms ease';
    });
  }

  function cartTotal() {
    return state.cart.reduce((sum, line) => {
      const item = state.catalogById.get(line.id);
      return item ? sum + item.price * line.qty : sum;
    }, 0);
  }

  function renderCart() {
    const list = $('#cartItems');
    const empty = $('#cartEmpty');
    const checkoutBtn = $('#checkoutBtn');
    const badge = $('#cartBadge');

    const itemCount = state.cart.reduce((s, l) => s + l.qty, 0);
    badge.textContent = itemCount;
    badge.classList.toggle('show', itemCount > 0);

    if (state.cart.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      checkoutBtn.disabled = true;
    } else {
      empty.classList.add('hidden');
      list.innerHTML = state.cart
        .map((line) => {
          const item = state.catalogById.get(line.id);
          if (!item) return '';
          const icon = item.icon || 'chest';
          return `
            <li class="cart-item" data-line="${item.id}">
              <span class="cart-item-icon" style="background:${item.color}">
                <svg width="22" height="22"><use href="${iconHref(icon)}"/></svg>
              </span>
              <div class="cart-item-info">
                <div class="cart-item-name">${escapeHtml(item.name)}</div>
                <div class="cart-item-price">${fmt(item.price)} each</div>
              </div>
              <div class="cart-qty">
                <button data-dec aria-label="Decrease">
                  <svg width="14" height="14"><use href="#i-minus"/></svg>
                </button>
                <span>${line.qty}</span>
                <button data-inc aria-label="Increase">
                  <svg width="14" height="14"><use href="#i-plus"/></svg>
                </button>
                <button data-remove aria-label="Remove" title="Remove">
                  <svg width="14" height="14"><use href="#i-close"/></svg>
                </button>
              </div>
            </li>
          `;
        })
        .join('');
      checkoutBtn.disabled = false;
    }

    $('#cartSubtotal').textContent = fmt(cartTotal());

    $$('.cart-item', list).forEach((el) => {
      const id = el.dataset.line;
      const line = state.cart.find((c) => c.id === id);
      if (!line) return;
      el.querySelector('[data-inc]').addEventListener('click', () => setQty(id, line.qty + 1));
      el.querySelector('[data-dec]').addEventListener('click', () => setQty(id, line.qty - 1));
      el.querySelector('[data-remove]').addEventListener('click', () => removeFromCart(id));
    });
  }

  // --- Cart drawer ---------------------------------------------
  const cartDrawer = $('#cartDrawer');
  function openCart() {
    cartDrawer.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');
  }
  function closeCart() {
    cartDrawer.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
  }
  $('#cartButton').addEventListener('click', openCart);
  $$('[data-close-cart]').forEach((el) => el.addEventListener('click', closeCart));

  // --- Checkout modal ------------------------------------------
  const modal = $('#checkoutModal');
  const checkoutForm = $('#checkoutForm');
  const modalSummary = $('#modalSummary');
  const modalTotal = $('#modalTotal');
  const formError = $('#formError');
  const modalSuccess = $('#modalSuccess');

  function openCheckout() {
    if (state.cart.length === 0) return;
    formError.hidden = true;
    modalSuccess.hidden = true;
    checkoutForm.hidden = false;
    closeCart();
    refreshSummary();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => modal.querySelector('input[name="username"]').focus(), 220);
  }
  function closeCheckout() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
  $('#checkoutBtn').addEventListener('click', openCheckout);
  $$('[data-close-modal]').forEach((el) => el.addEventListener('click', closeCheckout));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      closeCheckout();
    }
  });

  function refreshSummary() {
    modalSummary.innerHTML =
      state.cart
        .map((line) => {
          const item = state.catalogById.get(line.id);
          if (!item) return '';
          return `<div class="line"><span>${escapeHtml(item.name)} × ${line.qty}</span>
                  <span>${fmt(item.price * line.qty)}</span></div>`;
        })
        .join('') +
      `<div class="line total"><span>Total</span><strong>${fmt(cartTotal())}</strong></div>`;
    modalTotal.textContent = fmt(cartTotal());
  }

  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;

    const formData = new FormData(checkoutForm);
    const payload = {
      username: formData.get('username').trim(),
      email: formData.get('email').trim(),
      paymentMethod: formData.get('paymentMethod'),
      items: state.cart,
    };

    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    const original = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Processing…';

    try {
      const result = await jsonFetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      checkoutForm.hidden = true;
      modalSuccess.hidden = false;
      $('#successMessage').textContent = result.message;
      $('#successOrderId').textContent = result.orderId;

      state.cart = [];
      saveCart();
      renderCart();
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }
  });

  // --- Copy IP --------------------------------------------------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const text = btn.dataset.copy;
    navigator.clipboard.writeText(text).then(
      () => showToast(`Copied ${text}`),
      () => showToast('Couldn\'t copy — please copy manually'),
    );
  });

  // --- Smooth nav highlight + scroll-aware UI ------------------
  const sections = ['packages', 'crates', 'leaderboard', 'faq']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navLinks = $$('.primary-nav a');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((a) => {
            a.style.color = a.getAttribute('href') === `#${id}` ? 'var(--emerald-bright)' : '';
          });
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px' },
  );
  sections.forEach((s) => observer.observe(s));

  bootstrap();
})();
