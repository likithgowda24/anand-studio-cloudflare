const STATUSES = new Set(["PENDING", "IN_PROGRESS", "READY", "COMPLETED", "CANCELLED"]);

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "vary": "Origin"
    }
  });
}

function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    phoneNumber: row.phone_number,
    product: row.product,
    size: row.size,
    quantity: row.quantity,
    totalAmount: Number(row.total_amount),
    advancePaid: Number(row.advance_paid),
    balanceAmount: Number(row.balance_amount),
    expectedDeliveryDate: row.expected_delivery_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at
  };
}

function selectColumns() {
  return `id, order_number, customer_name, phone_number, product, size, quantity,
    total_amount, advance_paid, balance_amount, expected_delivery_date, status, notes, created_at`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";
    const corsOrigin = allowed === "*" || origin === allowed ? (origin || "*") : allowed;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": corsOrigin,
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "Content-Type",
        "access-control-max-age": "86400",
        "vary": "Origin"
      }});
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ service: "Anand Studio API", status: "ok" }, 200, corsOrigin);
    }

    if (!url.pathname.startsWith("/api/orders")) {
      return json({ message: "Not found" }, 404, corsOrigin);
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/orders/stats") {
        const rows = await env.DB.prepare(`SELECT status, COUNT(*) AS count FROM studio_orders GROUP BY status`).all();
        const counts = Object.fromEntries(rows.results.map(r => [r.status, Number(r.count)]));
        return json({
          total: Object.values(counts).reduce((a, b) => a + b, 0),
          pending: counts.PENDING || 0,
          inProgress: counts.IN_PROGRESS || 0,
          ready: counts.READY || 0,
          completed: counts.COMPLETED || 0
        }, 200, corsOrigin);
      }

      if (request.method === "GET" && url.pathname === "/api/orders") {
        const search = (url.searchParams.get("search") || "").trim();
        let result;
        if (search) {
          const q = `%${search}%`;
          result = await env.DB.prepare(`SELECT ${selectColumns()} FROM studio_orders
            WHERE customer_name LIKE ? OR phone_number LIKE ? OR order_number LIKE ?
            ORDER BY created_at DESC`).bind(q, q, q).all();
        } else {
          result = await env.DB.prepare(`SELECT ${selectColumns()} FROM studio_orders ORDER BY created_at DESC`).all();
        }
        return json(result.results.map(mapOrder), 200, corsOrigin);
      }

      if (request.method === "POST" && url.pathname === "/api/orders") {
        const body = await request.json();
        const customerName = String(body.customerName || "").trim();
        const phoneNumber = String(body.phoneNumber || "").trim();
        const product = String(body.product || "").trim();
        const quantity = Number(body.quantity);
        const totalAmount = Number(body.totalAmount);
        const advancePaid = Number(body.advancePaid);
        if (!customerName || !phoneNumber || !product || !/^[+]?[0-9]{10,15}$/.test(phoneNumber) || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(totalAmount) || totalAmount < 0 || !Number.isFinite(advancePaid) || advancePaid < 0) {
          return json({ message: "Please check the required fields and amounts." }, 400, corsOrigin);
        }
        if (advancePaid > totalAmount) return json({ message: "Advance cannot exceed total amount" }, 400, corsOrigin);
        const orderNumber = `APS-${Date.now()}`;
        const now = new Date().toISOString();
        const result = await env.DB.prepare(`INSERT INTO studio_orders
          (order_number, customer_name, phone_number, product, size, quantity, total_amount, advance_paid, balance_amount, expected_delivery_date, status, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
          RETURNING ${selectColumns()}`)
          .bind(orderNumber, customerName, phoneNumber, product, body.size || null, quantity, totalAmount, advancePaid, totalAmount - advancePaid, body.expectedDeliveryDate || null, body.notes || null, now)
          .first();
        return json({ order: mapOrder(result), whatsappStatus: "NOT_CONFIGURED" }, 201, corsOrigin);
      }

      const statusMatch = url.pathname.match(/^\/api\/orders\/(\d+)\/status$/);
      if (request.method === "PATCH" && statusMatch) {
        const id = Number(statusMatch[1]);
        const body = await request.json();
        if (!STATUSES.has(body.status)) return json({ message: "Invalid status" }, 400, corsOrigin);
        const row = await env.DB.prepare(`UPDATE studio_orders SET status = ? WHERE id = ? RETURNING ${selectColumns()}`).bind(body.status, id).first();
        if (!row) return json({ message: "Order not found" }, 404, corsOrigin);
        return json({ order: mapOrder(row), whatsappStatus: "NOT_CONFIGURED" }, 200, corsOrigin);
      }

      const idMatch = url.pathname.match(/^\/api\/orders\/(\d+)$/);
      if (request.method === "DELETE" && idMatch) {
        const result = await env.DB.prepare("DELETE FROM studio_orders WHERE id = ?").bind(Number(idMatch[1])).run();
        return new Response(null, { status: result.meta.changes ? 204 : 404, headers: { "access-control-allow-origin": corsOrigin, "vary": "Origin" } });
      }

      return json({ message: "Not found" }, 404, corsOrigin);
    } catch (error) {
      return json({ message: "Server error", detail: error?.message || "Unknown error" }, 500, corsOrigin);
    }
  }
};
