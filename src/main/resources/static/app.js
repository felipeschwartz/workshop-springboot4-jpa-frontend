js
Copiar

"use strict";

// ============================================================
// UTILITÁRIOS
// ============================================================

function esc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(iso) {
    if (!iso) return "-";
    try { return new Date(iso).toLocaleString("pt-BR"); }
    catch (e) { return String(iso); }
}

var ORDER_STATUS_MAP = {
    1: { label: "WAITING_PAYMENT", css: "badge-wait" },
    2: { label: "PAID",            css: "badge-paid" },
    3: { label: "SHIPPED",         css: "badge-ship" },
    4: { label: "DELIVERED",       css: "badge-del"  },
    5: { label: "CANCELED",        css: "badge-can"  }
};

function statusBadge(code) {
    var entry = ORDER_STATUS_MAP[code];
    if (!entry) return "<span class='badge badge-wait'>?</span>";
    return "<span class='badge " + entry.css + "'>" + entry.label + "</span>";
}

// ============================================================
// API FETCH
// ============================================================

function readBody(res) {
    var ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.indexOf("application/json") !== -1) return res.json();
    return res.text();
}

function api(path, options) {
    options = options || {};
    var headers = { "Accept": "application/json" };
    if (options.body && typeof options.body === "string") {
        headers["Content-Type"] = "application/json";
    }
    if (options.headers) {
        Object.keys(options.headers).forEach(function(k) {
            headers[k] = options.headers[k];
        });
    }
    options.headers = headers;
    return fetch(path, options).then(function(res) {
        return readBody(res).then(function(body) {
            if (!res.ok) {
                var msg = typeof body === "string" ? body : JSON.stringify(body, null, 2);
                throw new Error("HTTP " + res.status + " " + res.statusText + "\n" + msg);
            }
            return body;
        });
    });
}

function setStatus(el, msg, isError) {
    el.textContent = msg;
    el.className = isError ? "status error" : "status";
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

document.querySelectorAll(".nav-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
        document.querySelectorAll(".nav-btn").forEach(function(b) {
            b.classList.remove("active");
        });
        document.querySelectorAll(".page").forEach(function(p) {
            p.classList.remove("active");
        });
        btn.classList.add("active");
        document.getElementById("page-" + btn.getAttribute("data-page")).classList.add("active");
    });
});

// ============================================================
// USERS — GET, POST, PUT, DELETE
// ============================================================

var userStatus   = document.getElementById("userStatus");
var userTbody    = document.getElementById("userTbody");
var userEmpty    = document.getElementById("userEmpty");
var userForm     = document.getElementById("userForm");
var userEditForm = document.getElementById("userEditForm");
var userModal    = document.getElementById("userModal");

function loadUsers() {
    setStatus(userStatus, "Carregando usuarios...");
    var t = performance.now();
    return api("/users").then(function(users) {
        users = Array.isArray(users) ? users : [];
        renderUsers(users);
        setStatus(userStatus, "OK: " + users.length + " usuario(s) em " + Math.round(performance.now() - t) + " ms");
    }).catch(function(err) {
        setStatus(userStatus, String(err.message || err), true);
    });
}

function renderUsers(users) {
    userEmpty.style.display = users.length ? "none" : "block";
    var html = "";
    users.forEach(function(u) {
        html += "<tr>";
        html += "<td>" + esc(u.id) + "</td>";
        html += "<td>" + esc(u.name) + "</td>";
        html += "<td>" + esc(u.email) + "</td>";
        html += "<td>" + esc(u.phone) + "</td>";
        html += "<td><div style='display:flex;gap:6px'>";
        html += "<button class='btn sm secondary' data-action='edit-user'"
            + " data-id='"    + esc(u.id)    + "'"
            + " data-name='"  + esc(u.name)  + "'"
            + " data-email='" + esc(u.email) + "'"
            + " data-phone='" + esc(u.phone) + "'"
            + ">Editar</button>";
        html += "<button class='btn sm danger' data-action='del-user'"
            + " data-id='" + esc(u.id) + "'>Excluir</button>";
        html += "</div></td></tr>";
    });
    userTbody.innerHTML = html;
}

userForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var payload = JSON.stringify({
        name:     document.getElementById("uName").value.trim(),
        email:    document.getElementById("uEmail").value.trim(),
        phone:    document.getElementById("uPhone").value.trim(),
        password: document.getElementById("uPassword").value
    });
    api("/users", { method: "POST", body: payload })
        .then(function() {
            userForm.reset();
            setStatus(userStatus, "Usuario criado com sucesso.");
            return loadUsers();
        })
        .catch(function(err) { setStatus(userStatus, String(err.message || err), true); });
});

document.getElementById("userSeedBtn").addEventListener("click", function() {
    document.getElementById("uName").value     = "Maria Brown";
    document.getElementById("uEmail").value    = "user" + Date.now() + "@gmail.com";
    document.getElementById("uPhone").value    = "988888888";
    document.getElementById("uPassword").value = "123456";
});

document.getElementById("userClearBtn").addEventListener("click", function() { userForm.reset(); });
document.getElementById("userReloadBtn").addEventListener("click", function() { loadUsers(); });

userTbody.addEventListener("click", function(e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var action = btn.getAttribute("data-action");
    var id     = btn.getAttribute("data-id");

    if (action === "del-user") {
        if (!confirm("Excluir usuario ID " + id + "?")) return;
        api("/users/" + id, { method: "DELETE" })
            .then(function() {
                setStatus(userStatus, "Usuario " + id + " excluido.");
                return loadUsers();
            })
            .catch(function(err) { setStatus(userStatus, String(err.message || err), true); });
    }

    if (action === "edit-user") {
        document.getElementById("euId").value    = id;
        document.getElementById("euName").value  = btn.getAttribute("data-name");
        document.getElementById("euEmail").value = btn.getAttribute("data-email");
        document.getElementById("euPhone").value = btn.getAttribute("data-phone");
        userModal.classList.remove("hidden");
    }
});

userEditForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var id = document.getElementById("euId").value;
    var payload = JSON.stringify({
        name:  document.getElementById("euName").value.trim(),
        email: document.getElementById("euEmail").value.trim(),
        phone: document.getElementById("euPhone").value.trim()
    });
    api("/users/" + id, { method: "PUT", body: payload })
        .then(function() {
            userModal.classList.add("hidden");
            setStatus(userStatus, "Usuario " + id + " atualizado.");
            return loadUsers();
        })
        .catch(function(err) { setStatus(userStatus, String(err.message || err), true); });
});

document.getElementById("userModalClose").addEventListener("click", function() {
    userModal.classList.add("hidden");
});

// ============================================================
// CATEGORIES — somente GET (seed data, sem POST)
// ============================================================

var catStatus = document.getElementById("catStatus");
var catTbody  = document.getElementById("catTbody");
var catEmpty  = document.getElementById("catEmpty");

function loadCategories() {
    setStatus(catStatus, "Carregando categorias...");
    var t = performance.now();
    return api("/categories").then(function(cats) {
        cats = Array.isArray(cats) ? cats : [];
        renderCategories(cats);
        setStatus(catStatus, "OK: " + cats.length + " categoria(s) em " + Math.round(performance.now() - t) + " ms");
        return cats;
    }).catch(function(err) {
        setStatus(catStatus, String(err.message || err), true);
    });
}

function renderCategories(cats) {
    catEmpty.style.display = cats.length ? "none" : "block";
    var html = "";
    cats.forEach(function(c) {
        html += "<tr><td>" + esc(c.id) + "</td><td>" + esc(c.name) + "</td></tr>";
    });
    catTbody.innerHTML = html;
}

document.getElementById("catReloadBtn").addEventListener("click", function() { loadCategories(); });

// ============================================================
// PRODUCTS — somente GET (seed data, sem POST)
// ============================================================

var productStatus = document.getElementById("productStatus");
var productTbody  = document.getElementById("productTbody");
var productEmpty  = document.getElementById("productEmpty");

function loadProducts() {
    setStatus(productStatus, "Carregando produtos...");
    var t = performance.now();
    return api("/products").then(function(products) {
        products = Array.isArray(products) ? products : [];
        renderProducts(products);
        setStatus(productStatus, "OK: " + products.length + " produto(s) em " + Math.round(performance.now() - t) + " ms");
        return products;
    }).catch(function(err) {
        setStatus(productStatus, String(err.message || err), true);
    });
}

function renderProducts(products) {
    productEmpty.style.display = products.length ? "none" : "block";
    var html = "";
    products.forEach(function(p) {
        var desc = String(p.description || "");
        if (desc.length > 60) desc = desc.substring(0, 60) + "...";
        html += "<tr>";
        html += "<td>" + esc(p.id) + "</td>";
        html += "<td>" + esc(p.name) + "</td>";
        html += "<td>" + esc(desc) + "</td>";
        html += "<td>R$ " + formatMoney(p.price) + "</td>";
        html += "<td>";
        if (p.categories && p.categories.length) {
            p.categories.forEach(function(cat) {
                html += "<span class='badge badge-ship' style='margin-right:4px'>" + esc(cat.name) + "</span>";
            });
        } else {
            html += "<span style='color:var(--muted)'>-</span>";
        }
        html += "</td>";
        html += "</tr>";
    });
    productTbody.innerHTML = html;
}

document.getElementById("productReloadBtn").addEventListener("click", function() { loadProducts(); });

// ============================================================
// ORDERS — somente GET (seed data, sem POST)
// ============================================================

var orderStatusEl   = document.getElementById("orderStatus");
var orderTbody      = document.getElementById("orderTbody");
var orderEmpty      = document.getElementById("orderEmpty");
var orderModal      = document.getElementById("orderModal");
var orderModalBody  = document.getElementById("orderModalBody");
var orderModalTitle = document.getElementById("orderModalTitle");

function loadOrders() {
    setStatus(orderStatusEl, "Carregando pedidos...");
    var t = performance.now();
    return api("/orders").then(function(orders) {
        orders = Array.isArray(orders) ? orders : [];
        renderOrders(orders);
        setStatus(orderStatusEl, "OK: " + orders.length + " pedido(s) em " + Math.round(performance.now() - t) + " ms");
        return orders;
    }).catch(function(err) {
        setStatus(orderStatusEl, String(err.message || err), true);
    });
}

function renderOrders(orders) {
    orderEmpty.style.display = orders.length ? "none" : "block";
    var html = "";
    orders.forEach(function(o) {
        var clientName = o.client ? (o.client.name || String(o.client.id || "-")) : "-";
        html += "<tr>";
        html += "<td>" + esc(o.id) + "</td>";
        html += "<td>" + formatDate(o.moment) + "</td>";
        html += "<td>" + statusBadge(o.orderStatus) + "</td>";
        html += "<td>" + esc(clientName) + "</td>";
        html += "<td>R$ " + formatMoney(o.total) + "</td>";
        html += "<td><button class='btn sm secondary' data-action='view-order'"
            + " data-id='" + esc(o.id) + "'>Ver</button></td>";
        html += "</tr>";
    });
    orderTbody.innerHTML = html;
}

document.getElementById("orderReloadBtn").addEventListener("click", function() { loadOrders(); });

orderTbody.addEventListener("click", function(e) {
    var btn = e.target.closest("button[data-action='view-order']");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    api("/orders/" + id)
        .then(function(order) {
            orderModalTitle.textContent = "Pedido #" + order.id;
            orderModalBody.innerHTML    = buildOrderDetail(order);
            orderModal.classList.remove("hidden");
        })
        .catch(function(err) { setStatus(orderStatusEl, String(err.message || err), true); });
});

document.getElementById("orderModalClose").addEventListener("click", function() {
    orderModal.classList.add("hidden");
});

function buildOrderDetail(o) {
    var items      = Array.isArray(o.items) ? o.items : [];
    var payment    = o.payment || null;
    var clientName = o.client ? (o.client.name || String(o.client.id)) : "-";

    var itemsRows = "";
    items.forEach(function(i) {
        var productName = i.product ? (i.product.name || String(i.product.id)) : "-";
        var subTotal    = i.subTotal || i.subtotal || (i.price * i.quantity) || 0;
        itemsRows += "<tr>";
        itemsRows += "<td>" + esc(productName) + "</td>";
        itemsRows += "<td>" + esc(i.quantity) + "</td>";
        itemsRows += "<td>R$ " + formatMoney(i.price) + "</td>";
        itemsRows += "<td>R$ " + formatMoney(subTotal) + "</td>";
        itemsRows += "</tr>";
    });
    if (!itemsRows) {
        itemsRows = "<tr><td colspan='4' class='empty'>Sem itens.</td></tr>";
    }

    var paymentHtml = payment
        ? "<p><strong>ID:</strong> " + esc(payment.id) + "</p>"
        + "<p><strong>Momento:</strong> " + formatDate(payment.moment) + "</p>"
        : "<p style='color:var(--muted)'>Nenhum pagamento registrado.</p>";

    var html = "";
    html += "<div class='order-detail-grid'>";
    html += "<div class='detail-item'><div class='detail-label'>Momento</div><div>" + formatDate(o.moment) + "</div></div>";
    html += "<div class='detail-item'><div class='detail-label'>Status</div><div>" + statusBadge(o.orderStatus) + "</div></div>";
    html += "<div class='detail-item'><div class='detail-label'>Cliente</div><div>" + esc(clientName) + "</div></div>";
    html += "<div class='detail-item'><div class='detail-label'>Total</div><div>R$ " + formatMoney(o.total) + "</div></div>";
    html += "</div>";

    html += "<h3 style='margin-bottom:8px'>Itens do Pedido</h3>";
    html += "<div class='table-wrap' style='margin-bottom:14px'>";
    html += "<table class='table'><thead><tr>";
    html += "<th>Produto</th><th>Qtd</th><th>Preco Unit.</th><th>Subtotal</th>";
    html += "</tr></thead><tbody>" + itemsRows + "</tbody></table></div>";

    html += "<h3 style='margin-bottom:8px'>Pagamento</h3>";
    html += "<div class='card' style='margin-bottom:0'>" + paymentHtml + "</div>";

    return html;
}

// ============================================================
// BOOT
// ============================================================

loadUsers();
loadCategories();
loadProducts();
loadOrders();