# S.Gamage Constructions — Website (Frontend + Backend + Admin Panel)

Features: Home, About, Services, Projects/Portfolio, Contact form, Footer, customer feedback & ratings, and a basic hardware shop..

## NEW: Advance Payment Checkout (Hardware Orders)
The hardware shop checkout now follows a real-world **advance payment before order confirmation** workflow.

### Customer Flow
- Logged-in customer adds products to cart and opens **Your Cart**.
- Checkout shows:
  - full order total
  - configurable advance percentage (default **25%**)
  - advance due now + remaining balance later
  - customer-facing payment / cancellation terms
- Customer chooses one of the configured payment methods:
  - Bank Transfer
  - Cash Deposit
  - Mobile Banking / App Transfer
  - Skrill
  - Crypto Transfer
- Customer uploads the **payment slip / screenshot** and then places the order.
- After the order is created, a **WhatsApp confirmation link** is generated with the order details and uploaded proof URLs so the customer can instantly message the business.

### Admin Flow
- Admin opens **Settings** and can change:
  - advance percentage
  - bank details / instructions
  - Skrill details
  - crypto wallet address / network
  - crypto QR image upload
  - customer-facing checkout terms
- Admin opens **Orders** and can review:
  - advance amount
  - balance due
  - payment method
  - payment reference / crypto TX hash
  - uploaded proof images
  - payment verification status

### Important Note
This implementation uses **manual / free-friendly payment collection** rather than a paid gateway. WhatsApp is handled with a prefilled chat link containing the order details and proof URLs.

## NEW: Owner Vehicle Delivery Workflow (Customer Visible)
The hardware shop now includes a real-world delivery process for bulky construction materials delivered by the **shop owner&apos;s vehicle + delivery boy**, with delivery details visible to the customer.

### Customer Flow
- During checkout, the customer can now add:
  - site contact name + phone
  - preferred delivery date + time slot
  - unloading support availability
  - balance collection preference
  - access / route notes
  - call-before-delivery and split-delivery preferences
- After placing the order, the customer receives a **delivery confirmation code** and can view delivery progress from **Customer Dashboard → My Orders**.
- The order card now shows:
  - delivery status timeline
  - scheduled date / window
  - driver / vehicle information
  - latest admin note
  - proof of delivery image (when uploaded)
  - confirmation code / handover info

### Admin Flow
- Admin opens **Admin → Orders** and gets a new **Own vehicle delivery control** section for each order.
- Admin can:
  - update delivery status
  - assign route date / time window
  - assign driver and vehicle number
  - update site contact / unloading / balance mode
  - log issues and reschedules
  - add customer-visible notes
  - verify the customer delivery code at handover
  - upload delivery proof image
- Every update is saved into a timeline that appears on the customer dashboard.

### Technical Additions
- Order model now includes a dedicated `delivery` object with event history and operational fields.
- New admin delivery update endpoint: `PATCH /api/admin/orders/:id/delivery`
- New admin proof upload endpoint: `POST /api/uploads/admin-delivery-proof`
- Site settings now include delivery policy text fields used in the public shop page and checkout guide.


## NEW: Delivery Team Management + Rider Portal
The hardware shop delivery workflow now includes a **real delivery-boy management module** for your own vehicle / rider operations.

### What Admin Can Do
- Open **Admin → Delivery Team** and add / edit / deactivate delivery boys.
- Give each delivery boy a **separate username + password**.
- Save rider profile details such as:
  - phone number
  - vehicle number / type
  - service areas / route zones
  - max daily stops
  - max concurrent assignments
  - availability status (available / on route / off duty / leave)
- Open **Admin → Orders** and:
  - assign a specific delivery boy to an order
  - set route zone, priority and stop sequence
  - use **Suggest best rider** to pick the least-conflicted rider based on workload + route fit
  - see delivery-boy activity logs and proof uploads

### What Delivery Boys Can Do
A new portal is available at:
- `frontend/delivery/login.html`
- `frontend/delivery/dashboard.html`

After login, the delivery boy can:
- view assigned jobs
- update delivery progress (accepted / packed / out for delivery / arriving soon / delivered / issue)
- upload proof images
- verify the customer delivery code at handover
- add completed activity logs and notes
- update own availability status

### API Endpoints Added
- Delivery boy login: `POST /api/delivery/auth/login`
- Delivery boy profile: `GET /api/delivery/me`
- Delivery boy availability update: `PATCH /api/delivery/me`
- Delivery boy assigned orders: `GET /api/delivery/orders`
- Delivery boy activity log: `POST /api/delivery/orders/:id/activity`
- Admin delivery-boy management: `GET/POST/PATCH/DELETE /api/admin/delivery-boys`
- Admin password reset for delivery boy: `POST /api/admin/delivery-boys/:id/reset-password`
- Admin rider suggestion for order: `GET /api/admin/orders/:id/delivery-suggestions`
- Delivery boy proof upload: `POST /api/uploads/delivery-proof`

## NEW: Hardware Shop Return Management
The hardware shop now includes a real-world style return workflow for logged-in customers and admins.

### Customer Flow
- Customer buys from **Hardware Shop** and the order is saved with product snapshot details.
- After the order is marked **delivered**, the customer can open **My Account → My Orders & Returns**.
- Customer can submit a **Return Request** with:
  - selected order items + quantities
  - reason (damage / wrong item / defective / unused unopened)
  - product condition
  - evidence photos (up to 4)
  - preferred resolution (replacement / refund / exchange / store credit / repair)
  - optional bank details for refund handling
- Submitted requests appear in the same dashboard with their live status.

### Admin Flow
- Admin opens **Admin → Orders**.
- Admin can:
  - mark an order as delivered / returned / partially returned
  - review every return request
  - change request status (requested → approved → received → completed, etc.)
  - set the final resolution type
  - add a customer-visible note and internal admin notes
  - optionally restock returned quantities back to inventory when completing a return

### Return Rules Implemented
- Wrong item / missing parts / visible transport damage: within **48 hours**
- Defective / quality issue: within **7 days**
- Unused standard-stock items: within **14 days** if sealed / unused
- Custom, mixed, tinted, cut-to-size and special-order items can be marked as **non-returnable for change-of-mind** from the product admin form

### Technical Additions
- New image upload endpoint for return evidence: `POST /api/uploads/return-evidence`
- New customer return request endpoint: `POST /api/orders/:id/returns`
- New admin return update endpoint: `PATCH /api/admin/orders/:orderId/returns/:returnId`
- Product-level fields:
  - `isReturnable`
  - `nonReturnableReason`
  - `warrantyDays`

## NEW: Inquiry Replies (Customer ↔ Admin)
When a logged-in customer submits an inquiry from **Contact**, the message is saved as a conversation thread.
Admin can open **Admin → Inquiries → Chat / Reply** and send a reply. The customer can view the full thread from **Customer Dashboard → My Inquiries → Conversation** and can also send follow-up messages.

### API Endpoints
- Customer creates inquiry: `POST /api/inquiries`
- Customer follow-up message: `POST /api/inquiries/:id/messages`
- Admin reply: `POST /api/admin/inquiries/:id/reply`

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: MongoDB Atlas (Mongoose)

## Run Backend
```bash
cd backend
npm install
npm run dev
```

Test: http://localhost:5000/api/health

## Run Frontend
Open `frontend/` in VS Code and use **Live Server**:
- index.html

## Admin Panel
Admin UI lives in: `frontend/admin/`

1) Start backend
2) Open: `frontend/admin/login.html`

Default credentials (change in `backend/.env`):
- Username: `admin`
- Password: `admin123`

Admin API endpoints are under `/api/admin/*` and protected by JWT.

## Sample Data
Import Postman collections inside `postman/` and run:
- Services-9
- Projects-9
- Products-9
