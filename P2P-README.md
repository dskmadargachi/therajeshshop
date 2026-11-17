# WebRTC P2P direct transfer (v13)

New files: `p2p.js` (customer sender + shared helpers), `p2p-counter.js` (counter receiver).
Changed: counter.html, index.html, cards.html, pdf-tools.html, wizard.js, site-ui.js. `_worker.js` is unchanged (used only for the fallback upload).

* Counter peer id: `therajeshshop-counter-main` (keep ONE counter tab open). Signalling: PeerJS cloud + Google STUN. No Worker involved.
* P2P orders are stored in the counter browser (IndexedDB, kept 24 h) and shown as "⚡ P2P Direct" cards in the normal queue.
* v18 payments: after the counter link opens, the customer chooses **Pay at Counter** (order arrives as "Pay at Counter / Unpaid", cash_wait) or **Pay Now** (UPI QR, customer types the UPI ref/UTR; order arrives as "Paid (UPI)" in the print queue). The UPI ref is customer-entered, so confirm it in your UPI app. Set `UPI_ID` (and optionally `UPI_NAME`) in Cloudflare variables or Pay Now shows "not set up".
* Printing P2P orders uses the browser print path ("Print Now"), not the PC agent (the agent can only fetch files from the server).
