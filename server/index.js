const path = require('path');
const crypto = require('crypto');
const express = require('express');

const { packages, crates } = require('./data/packages');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '128kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// In-memory stores. In production these would be replaced by a DB.
const orders = new Map();

const leaderboard = [
  { player: 'PixelPirate', amount: 489.55, rank: 'Ender Founder', avatar: 'PixelPirate' },
  { player: 'CraftQueen', amount: 312.10, rank: 'Netherite', avatar: 'CraftQueen' },
  { player: 'ObsidianOwl', amount: 264.40, rank: 'Netherite', avatar: 'ObsidianOwl' },
  { player: 'RedstoneRay', amount: 198.75, rank: 'Emerald', avatar: 'RedstoneRay' },
  { player: 'BlazeBuilder', amount: 154.99, rank: 'Emerald', avatar: 'BlazeBuilder' },
  { player: 'MossyMage', amount: 124.50, rank: 'Diamond', avatar: 'MossyMage' },
  { player: 'CocoaCreeper', amount: 99.80, rank: 'Diamond', avatar: 'CocoaCreeper' },
  { player: 'AmethystAria', amount: 79.95, rank: 'Gold', avatar: 'AmethystAria' },
];

const recentPurchases = [
  { player: 'GlowSquid', item: 'Diamond Rank', minutesAgo: 2 },
  { player: 'TundraTess', item: 'Adventurer Crate', minutesAgo: 6 },
  { player: 'WitherWill', item: 'Emerald Rank', minutesAgo: 11 },
  { player: 'PistonPete', item: 'Knight Crate ×3', minutesAgo: 14 },
  { player: 'NetherNyx', item: 'Netherite Rank', minutesAgo: 22 },
  { player: 'SlimeSage', item: 'Iron Rank', minutesAgo: 28 },
];

const serverStatus = {
  host: 'play.emeraldcraft.gg',
  version: '1.21.4',
  edition: 'Java & Bedrock',
  online: true,
  playersOnline: 387,
  playersMax: 1000,
  uptime: '99.98%',
  region: 'EU + NA + APAC',
};

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return typeof username === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(username);
}

// API ---------------------------------------------------------------

app.get('/api/packages', (_req, res) => {
  res.json({ packages, crates });
});

app.get('/api/server-status', (_req, res) => {
  // Vary online players slightly so the UI feels alive.
  const drift = Math.floor(Math.random() * 24) - 12;
  res.json({
    ...serverStatus,
    playersOnline: Math.max(50, serverStatus.playersOnline + drift),
  });
});

app.get('/api/leaderboard', (_req, res) => {
  res.json({ leaderboard });
});

app.get('/api/recent-purchases', (_req, res) => {
  res.json({ purchases: recentPurchases });
});

app.post('/api/checkout', (req, res) => {
  const { username, email, items, paymentMethod } = req.body || {};

  if (!isValidUsername(username)) {
    return res.status(400).json({
      error: 'Enter a valid Minecraft username (3-16 chars, letters/numbers/underscore).',
    });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty.' });
  }

  const known = new Map(
    [...packages, ...crates].map((p) => [p.id, p]),
  );

  let total = 0;
  const lineItems = [];
  for (const entry of items) {
    const item = known.get(entry?.id);
    if (!item) {
      return res.status(400).json({ error: `Unknown item: ${entry?.id}` });
    }
    const qty = Math.min(Math.max(parseInt(entry.qty, 10) || 1, 1), 10);
    total += item.price * qty;
    lineItems.push({ id: item.id, name: item.name, qty, price: item.price });
  }

  const order = {
    id: 'EC-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    username,
    email,
    items: lineItems,
    total: Math.round(total * 100) / 100,
    paymentMethod: paymentMethod || 'card',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  orders.set(order.id, order);

  res.json({
    success: true,
    orderId: order.id,
    total: order.total,
    message: `Thanks ${username}! Your perks will land in-game within 60 seconds.`,
  });
});

app.get('/api/order/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Fallback to SPA index for client-side routes.
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`EmeraldCraft store running on http://localhost:${PORT}`);
});
