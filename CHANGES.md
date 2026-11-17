# Step 3 changes

index.js
- File picker: 100 MB limit when window.P2P exists, otherwise 25 MB.
- New Dm() (document amount) and rewritten Re(files, meta, formData, btn, amount):
  P2P.askPayment -> payment stored in meta.payment (FormData rewritten) and passed to P2P.submit.
  Files > 1 MB go with direct:true. Files > 25 MB are blocked from server fallback; error shown if P2P is offline.
- Document submit passes Dm(); passport submit passes sheets * k.passport[sheet].
- Ge(e): when e.payment is set, shows final paid/unpaid status and does not open Razorpay/Youpi again.

cards.js
- sendOrder: 100 MB / 25 MB limit, askPayment before submit, same P2P/server rules, payment in meta.
- showDone(e): same no-second-popup behaviour.

Assumptions (Step 1 not attached): P2P.askPayment resolves to {status:"paid"|"unpaid", razorpay_payment_id, ...} or null if closed;
P2P.isOnline() optional; client-generated meta.orderId is accepted by the server.
