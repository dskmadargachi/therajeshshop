# 🖨️ therajesh.shop — Digital Print Studio & Document Utility Suite

**therajesh.shop** is a privacy-first, mobile-friendly web platform and **Digital Seva Kendra** print studio built for fast document printing, government ID card formatting, smart scanning, photo sheet generation, and real-time counter order management.

Designed for speed on both mobile and desktop browsers, all sensitive document cropping, PDF manipulation, and image processing run **100% client-side in the user's browser**—ensuring personal identity documents never leave the user's device until a print order is explicitly submitted.

---

## 🌐 Live Endpoints & Subdomains

| URL | Module | Purpose |
| :--- | :--- | :--- |
| **`https://therajesh.shop`** | Main Storefront & Print Wizard | Document printing (A4, A3, 4×6 Photo) & Passport/ID photo sheet maker |
| **`https://cards.therajesh.shop`** | ID Card & Smart Scanner | Multi-card batch formatter (up to 5 cards) & Smart Document Scanner |
| **`https://pdf-tools.therajesh.shop`** | PDF Utilities | Browser-based PDF merging, page selection, and print preparation |
| **`https://counter.therajesh.shop`** | Counter Dashboard | Live print queue, order token tracking, and counter fulfillment |

---

## ✨ Key Features

### 1. 📄 Instant Print Order Wizard (`index.html`)
* **Multi-File Upload & Preview:** Upload images or PDFs, preview pages, rotate, crop, and select specific page counts with real-time progress indicators.
* **Flexible Print Settings:** Supports **A4**, **A3**, and **4×6 Photo** paper sizes in **B&W** or **Color** modes with automatic per-page cost calculation (`₹`).
* **Token Checkout:** Generates a live order summary (*Files, Paper, Mode, Copies*) and sends print jobs directly to the shop counter queue.

### 2. 🪪 ID Card Formatter & Smart Scanner (`cards.html`)
* **Batch Card Processing (Up to 5 Cards):** Select and process up to 5 ID cards simultaneously with automatic **A4 Batch (`5/5`)** layout packing or **4×6 Photo** output.
* **Precision Government Card Presets:** Calibrated edge detection and aspect-ratio cropping (`85.6 mm × 54 mm`) for:
  * **West Bengal e-Ration Cards** (`RKSY-I`, `PHH`, `AAY`, `SPHH`)
  * **e-Shram Card**, **ABHA Health Card**, **Aadhaar**, **PAN**, and **Voter ID (EPIC)**
* **Smart Document Scanner (`scan-wizard.js`):** Dedicated capture and enhancement pipeline for **ID Cards**, **Certificates**, **Admit Cards / Marksheets**, and **Auto Detect** documents with *Original*, *Clean Scan*, and *B&W High Contrast* filters.
* **Flexible Export:** Download individual Front/Back JPGs, combined A4 Sheet JPGs, print-ready PDFs, or send directly to the counter.

### 3. 📸 Photo Sheet & Background Removal Studio (`#pp`)
* **Standard & Custom Sizes:** Supports `3×3.5 cm`, `35×45 mm`, `2×2 inch`, `25×35 mm`, and custom dimensions.
* **Multi-Copy Sheet Layouts:** Automatic grid arrangement for **4×6 Photo Paper** (e.g., 12 copies) and **A4 Sheets** (**9, 18, 27, 36, or 45 copies**).
* **Client-Side Background Replacement:** Fast portrait segmentation with instant background color switching (*Transparent, White, Blue, Red, Grey, Green, Custom*) and direct **Save as JPG** / **Save as PDF** export.

### 4. 📑 Client-Side PDF Tools (`pdf-tools.html`)
* Merge multiple PDFs, extract or reorder pages, and prepare print-ready documents directly in the browser without server-side file uploads.

### 5. 🖥️ Counter Dashboard & Edge Routing (`counter.html` & `_worker.js`)
* **Cloudflare Workers Edge Router:** Routes custom subdomains (`cards.therajesh.shop`, `counter.therajesh.shop`, `pdf-tools.therajesh.shop`) seamlessly to their respective web apps while serving backend token APIs.
* **Real-Time Counter Queue:** Receives incoming customer print orders with token tracking and status management.

---

## 📁 Repository Structure

```text
therajeshshop-main/
├── _worker.js          # Cloudflare Pages/Workers edge router & order token API
├── index.html          # Main landing page, document print wizard & photo studio (#pp)
├── cards.html          # ID card batch formatter (e-Ration, e-Shram, ABHA, Aadhaar, PAN)
├── pdf-tools.html      # Browser-based PDF merge, split & print preparation tools
├── counter.html        # Shop counter dashboard for managing incoming print tokens
├── poster.html         # Printable/digital shop service & QR promotional poster
├── site-theme.css      # Core design system, typography, cards & responsive button styles
├── site-ui.js          # Shared UI helpers, navigation & progress indicator utilities
├── wizard.css          # Multi-step wizard, modal bottom-sheet & scanner layout styles
├── wizard.js           # Client-side print flow, photo grid engine & background removal
└── scan-wizard.js      # Smart Scanner multi-page capture, edge crop & filter pipeline
