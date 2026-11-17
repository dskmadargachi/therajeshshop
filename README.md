# The Rajesh Shop — Web Utilities & P2P Toolkit

A lightweight, high-performance Progressive Web App (PWA) suite featuring browser-based productivity tools, peer-to-peer (P2P) real-time synchronization, and edge deployment via Cloudflare Workers.

## ✨ Features

* **P2P Real-Time Counter (`counter.html`):** Synchronize counts across devices directly in the browser using WebRTC/P2P (`p2p.js`, `p2p-counter.js`) with optional audio feedback (`voice-alerts.js`).
* **Client-Side PDF Tools (`pdf-tools.html`):** Fast, privacy-first PDF manipulation running locally in the browser without server uploads.
* **Card & Poster Generators (`cards.html`, `poster.html`):** Interactive templates for creating custom cards and promotional posters.
* **Guided Scan Wizard (`scan-wizard.js`, `wizard.js`):** Step-by-step interactive workflow interface with dedicated styling (`wizard.css`).
* **Offline-First PWA (`sw.js`, `site.webmanifest`):** Installable on mobile and desktop with Service Worker caching for instant repeat loads.
* **Edge-Optimized Delivery (`_worker.js`, `_routes.json`):** Configured for Cloudflare Workers/Pages for low-latency global routing.

## 🚀 Recent Performance Optimizations

To eliminate render-blocking payloads and minimize Time to First Byte (TTFB), the HTML architecture was refactored:
* **Externalized Assets:** Moved inline `<style>` and `<script>` blocks out of HTML documents into cacheable external stylesheets (`site-theme.css`, `wizard.css`) and deferred scripts (`site-ui.js`, `wizard.js`).
* **Reduced HTML Payload:** Trimmed compressed HTML document sizes well below the 50 KB threshold for faster downloading and DOM parsing.
* **Asset & Icon Optimization:** Standardized external PNG favicons and PWA manifest icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) instead of inline Base64 data URIs.

## 📁 Project Structure

```text
├── index.html               # Main landing page & tool directory
├── counter.html             # Real-time P2P counter interface
├── pdf-tools.html           # Browser-based PDF utilities
├── cards.html               # Card generator tool
├── poster.html              # Poster generator tool
├── site-theme.css           # Core global styles & theme variables
├── wizard.css               # Styles for multi-step wizard workflows
├── site-ui.js               # Global UI interactions & navigation
├── p2p.js                   # Core peer-to-peer connection handler
├── p2p-counter.js           # P2P state synchronization for counters
├── voice-alerts.js          # Audio & speech synthesis notifications
├── wizard.js                # Multi-step wizard state controller
├── scan-wizard.js           # Document/item scanning workflow logic
├── sw.js                    # Service Worker for offline caching
├── site.webmanifest         # PWA configuration & icon manifest
├── _worker.js               # Cloudflare Worker edge handler
├── _routes.json             # Cloudflare Pages/Workers routing rules
└── sounds/                  # Audio alert assets

