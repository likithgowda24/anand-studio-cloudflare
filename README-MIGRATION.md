# Anand Studio – Cloudflare free-hosting migration pack

This pack adds a Cloudflare Workers + D1 replacement for the existing Spring Boot + MySQL API. The existing React frontend can continue using the same API paths and JSON field names.

## Important safety notes
- Do NOT delete Railway or its MySQL database yet.
- Export/backup the Railway MySQL `studio_orders` table before switching traffic.
- The Worker currently returns `whatsappStatus: NOT_CONFIGURED`; WhatsApp is intentionally not part of this migration.
- The original MVP has no user authentication. Do not use this publicly with real customer data until an authentication/access-control layer is added. CORS is not authentication.
- Cloudflare Free is usage-limited, not a contractual uptime guarantee. If limits are exceeded, API/database operations can fail until limits reset.

## 1. Create Cloudflare account and D1 database
1. Sign in at https://dash.cloudflare.com/.
2. Open Workers & Pages, then D1 SQL Database.
3. Create a database named `anand-studio-db`.
4. Copy its database ID.
5. Run `schema.sql` in the D1 Console (or with Wrangler).

## 2. Deploy the API Worker
1. Install Node.js LTS on your computer if it is not already installed.
2. Open a terminal in `cloudflare-worker`.
3. Run `npm install` to install Wrangler from the included `package.json`.
4. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with the D1 database ID.
5. Initialize the D1 schema using `npx wrangler d1 execute anand-studio-db --remote --file=./schema.sql`.
6. Set `ALLOWED_ORIGIN` to the exact Cloudflare Pages URL after the Pages site has been created.
7. Deploy with `npm run deploy`.
8. Copy the Worker URL, for example `https://anand-studio-api.<your-subdomain>.workers.dev`.

## 3. Deploy the existing React frontend
1. Import the existing GitHub repository into Cloudflare Pages.
2. Set the frontend root directory to the actual nested path in GitHub: `anand-studio-order-manager/frontend` (the repository screenshot showed an extra `anand-studio-order-manager` folder).
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Set build environment variable `VITE_API_URL` to `https://<your-worker-url>/api`.
6. Deploy. Set Worker `ALLOWED_ORIGIN` to the resulting `https://<project>.pages.dev` URL and redeploy the Worker.

## 4. Verify before switching
Test these URLs using your actual Worker URL:
- `GET https://<worker>/health` should return `{ "service": "Anand Studio API", "status": "ok" }`.
- `GET https://<worker>/api/orders` should return `[]` initially.
- `GET https://<worker>/api/orders/stats` should return zero counts.
- Create a test order in the Pages site, then confirm it appears after refresh and in D1.
- Test status update and search.

## 5. Migrate existing Railway orders
Do not delete Railway. Export the `studio_orders` table from Railway MySQL first. Transform/import the rows into D1, preserving `order_number`, `customer_name`, `phone_number`, product, size, quantity, amounts, expected delivery date, status, notes and created_at. D1 uses SQLite syntax/types, so use CSV import or prepared INSERT statements; do not import the MySQL dump unchanged.

## 6. Switch and retire old hosting
Only after the Cloudflare app passes all tests and the order data is verified:
- Bookmark the Cloudflare Pages URL on the shop computer and Android phone.
- Keep a separate backup export of orders.
- Then stop Railway services if you want to avoid trial expiry or charges. Do not remove the Railway database until the migrated records have been checked.

## API compatibility
Implemented routes:
- `GET /api/orders?search=`
- `GET /api/orders/stats`
- `POST /api/orders`
- `PATCH /api/orders/{id}/status`
- `DELETE /api/orders/{id}`

The frontend currently expects the same camelCase response fields. The Worker preserves those fields.
