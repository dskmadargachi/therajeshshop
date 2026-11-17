# WebRTC P2P direct transfer (v13)

New files: `p2p.js` (customer sender + shared helpers), `p2p-counter.js` (counter receiver).
Changed: counter.html, index.html, cards.html, pdf-tools.html, wizard.js, site-ui.js. `_worker.js` is unchanged (used only for the fallback upload).

* Counter peer id: `therajeshshop-counter-main` (keep ONE counter tab open). Signalling: PeerJS cloud + Google STUN. No Worker involved.
* P2P orders are stored in the counter browser (IndexedDB, kept 24 h) and shown as "⚡ P2P Direct" cards in the normal queue.
* P2P orders are unpaid "Cash Pending" orders: customers pay at the counter (no server order exists for online payment).
* Printing P2P orders uses the browser print path ("Print Now"), not the PC agent (the agent can only fetch files from the server).
