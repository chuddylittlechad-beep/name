# EmeraldCraft — Minecraft Donation Platform

A full-stack donation platform for a (fictional) Minecraft network. Players
browse ranks and mystery crates, add them to a cart, and check out with a
Minecraft username + email. The site features a custom voxel-themed design
and a hand-drawn SVG icon set — no third-party UI library, no image assets.

## Stack

- **Backend** — Node.js + Express. Serves the static frontend and a small JSON
  API (`/api/packages`, `/api/server-status`, `/api/leaderboard`,
  `/api/recent-purchases`, `/api/checkout`, `/api/order/:id`).
- **Frontend** — vanilla HTML/CSS/JS. Cart persisted to `localStorage`.
- **Icons** — every icon (pickaxe, sword, diamond, emerald, ingot, netherite,
  chest, creeper, crown, bolt, shield, leaf, Discord, etc.) is a custom SVG.
  An inline `<symbol>` sprite lives in `public/index.html`; the standalone
  files in `public/img/icons/` are higher-fidelity variants.

## Run

```bash
npm install
npm start
# → http://localhost:3000
```

Set `PORT` to override.

## Layout

```
server/
  index.js              # Express app + API routes
  data/packages.js      # In-memory catalog (ranks + crates)
public/
  index.html            # Single-page UI + SVG sprite
  css/styles.css        # Theme, layout, animations
  js/app.js             # Catalog rendering, cart, checkout
  img/icons/            # Standalone SVG icon assets
```

Storage is in-memory only — restarting the server clears placed orders. Swap
the `orders` Map for a real database (Postgres, Mongo, etc.) before going to
production.
