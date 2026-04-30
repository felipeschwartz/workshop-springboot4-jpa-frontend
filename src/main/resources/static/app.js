"use strict";

// ============================================================
// UTILITARIOS
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

var STATUS_MAP = {
    1: { label: "WAITING_PAYMENT", css: "badge-wait" },
    2: { label: "PAID",            css: "badge-paid" },
    3: { label: "SHIPPED",         css: "badge-ship" },
    4: { label: "DELIVERED",       css: "badge-del"  },
    5: { label: "CANCELED",        css: "badge-can"  }
};

function statusBadge(code) {
    var s = STATUS_MAP[code];
    if (!s) return "<span class='badge badge-wait'>?</span>";
    return "<span class='badge " + s.css + "'>" + s.label + "</span>";
}

// ============================================================
// API
// ============================================================

function apiFetch(path, options) {
    options = options || {};
    var headers = { "Accept": "application/json" };
    if (options.body && typeof options.body === "string") {
        headers["Content-Type"] = "application/json";
    }
    options.headers = headers;
    return fetch(path, options).then(function(res) {
        var ct = (res.headers.get("content-type") || "").toLowerCase();
        var bodyP = ct.indexOf("application/json") !== -1 ? res.json() : res.text();
        return bodyP.then(function(body) {
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
// NAVEGACAO
// ============================================================

var navBtns = document.querySelectorAll(".nav-btn");
var pages   = document.querySelectorAll(".page");

navBtns.forEach(function(btn) {
    btn.addEventListener("click", function() {
        navBtns.forEach(function(b) { b.classList.remove("active"); });
        pages.forEach(function(p)   { p.classList.remove("active"); });
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
    setStatus(userStatus, "Carregando...");
    var t = performance.now();
    return apiFetch("/users").then(function(data) {
        var list = Array.isArray(data) ? data : [];
        renderUsers(list);
        setStatus(userStatus, "OK: " + list.length + " usuario(s) em " + Math.round(performance.now() - t) + " ms");
    }).catch(function(err) {
        setStatus(userStatus, String(err.message || err), true);
    });
}

function renderUsers(list) {
    userEmpty.style.display = list.length ? "none" : "block";
    var html = "";
    list.forEach(function(u) {
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
    apiFetch("/users", { method: "POST", body: payload })
        .then(function() {
            userForm.reset();
            setStatus(userStatus, "Usuario criado.");
            loadUsers();
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
        apiFetch("/users/" + id, { method: "DELETE" })
            .then(function() {
                setStatus(userStatus, "Usuario " + id + " excluido.");
                loadUsers();
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
    apiFetch("/users/" + id, { method: "PUT", body: payload })
        .then(function() {
            userModal.classList.add("hidden");
            setStatus(userStatus, "Usuario " + id + " atualizado.");
            loadUsers();
        })
        .catch(function(err) { setStatus(userStatus, String(err.message || err), true); });
});

document.getElementById("userModalClose").addEventListener("click", function() {
    userModal.classList.add("hidden");
});

// ============================================================
// CATEGORIES — GET + POST (backend ja tem os dois)
// ============================================================

var catStatus = document.getElementById("catStatus");
var catTbody  = document.getElementById("catTbody");
var catEmpty  = document.getElementById("catEmpty");
var catForm   = document.getElementById("catForm");

function loadCategories() {
    setStatus(catStatus, "Carregando...");
    var t = performance.now();
    return apiFetch("/categories").then(function(data) {
        var list = Array.isArray(data) ? data : [];
        catEmpty.style.display = list.length ? "none" : "block";
        var html = "";
        list.forEach(function(c) {
            html += "<tr><td>" + esc(c.id) + "</td><td>" + esc(c.name) + "</td></tr>";
        });
        catTbody.innerHTML = html;
        setStatus(catStatus, "OK: " + list.length + " categoria(s) em " + Math.round(performance.now() - t) + " ms");
    }).catch(function(err) {
        setStatus(catStatus, String(err.message || err), true);
    });
}

catForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var payload = JSON.stringify({
        name: document.getElementById("catName").value.trim()
    });
    apiFetch("/categories", { method: "POST", body: payload })
        .then(function() {
            catForm.reset();
            setStatus(catStatus, "Categoria criada.");
            loadCategories();
        })
        .catch(function(err) { setStatus(catStatus, String(err.message || err), true); });
});

document.getElementById("catClearBtn").addEventListener("click", function() { catForm.reset(); });
document.getElementById("catReloadBtn").addEventListener("click", function() { loadCategories(); });

// ============================================================
// PRODUCTS — GET + POST (backend ja tem os dois)
// ============================================================

var productStatus = document.getElementById("productStatus");
var productTbody  = document.getElementById("productTbody");
var productEmpty  = document.getElementById("productEmpty");
var productForm   = document.getElementById("productForm");

function loadProducts() {
    setStatus(productStatus, "Carregando...");
    var t = performance.now();
    return apiFetch("/products").then(function(data) {
        var list = Array.isArray(data) ? data : [];
        productEmpty.style.display = list.length ? "none" : "block";
        var html = "";
        list.forEach(function(p) {
            var desc = String(p.description || "");
            if (desc.length > 55) { desc = desc.substring(0, 55) + "..."; }
            var cats = "";
            if (p.categories && p.categories.length) {
                p.categories.forEach(function(c) {
                    cats += "<span class='badge badge-ship' style='margin-right:4px'>" + esc(c.name) + "</span>";
                });
            } else {
                cats = "<span style='color:var(--muted)'>-</span>";
            }
            html += "<tr>";
            html += "<td>" + esc(p.id) + "</td>";
            html += "<td>" + esc(p.name) + "</td>";
            html += "<td>" + esc(desc) + "</td>";
            html += "<td>R$ " + formatMoney(p.price) + "</td>";
            html += "<td>" + cats + "</td>";
            html += "</tr>";
        });
        productTbody.innerHTML = html;
        setStatus(productStatus, "OK: " + list.length + " produto(s) em " + Math.round(performance.now() - t) + " ms");
    }).catch(function(err) {
        setStatus(productStatus, String(err.message || err), true);
    });
}

productForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var payload = JSON.stringify({
        name:        document.getElementById("pName").value.trim(),
        description: document.getElementById("pDesc").value.trim(),
        price:       parseFloat(document.getElementById("pPrice").value),
        imgUrl:      document.getElementById("pImgUrl").value.trim()
    });
    apiFetch("/products", { method: "POST", body: payload })
        .then(function() {
            productForm.reset();
            setStatus(productStatus, "Produto criado.");
            loadProducts();
        })
        .catch(function(err) { setStatus(productStatus, String(err.message || err), true); });
});

document.getElementById("productSeedBtn").addEventListener("click", function() {
    document.getElementById("pName").value   = "Smart TV";
    document.getElementById("pDesc").value   = "Nulla eu imperdiet purus. Maecenas ante.";
    document.getElementById("pPrice").value  = "2190.00";
    document.getElementById("pImgUrl").value = "";
});

document.getElementById("productClearBtn").addEventListener("click", function() { productForm.reset(); });
document.getElementById("productReloadBtn").addEventListener("click", function() { loadProducts(); });

// ============================================================
// ORDERS — GET + POST (backend ja tem os dois)
// ============================================================

var orderStatusEl   = document.getElementById("orderStatus");
var orderTbody      = document.getElementById("orderTbody");
var orderEmpty      = document.getElementById("orderEmpty");
var orderForm       = document.getElementById("orderForm");
var orderModal      = document.getElementById("orderModal");
var orderModalBody  = document.getElementById("orderModalBody");
var orderModalTitle = document.getElementById("orderModalTitle");

function loadOrders() {
    setStatus(orderStatusEl, "Carregando...");
    var t = performance.now();
    return apiFetch("/orders").then(function(data) {
        var list = Array.isArray(data) ? data : [];
        orderEmpty.style.display = list.length ? "none" : "block";
        var html = "";
        list.forEach(function(o) {
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
        setStatus(orderStatusEl, "OK: " + list.length + " pedido(s) em " + Math.round(performance.now() - t) + " ms");
    }).catch(function(err) {
        setStatus(orderStatusEl, String(err.message || err), true);
    });
}

orderForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var clientId   = parseInt(document.getElementById("oClientId").value, 10);
    var statusCode = parseInt(document.getElementById("oStatus").value, 10);
    var payload = JSON.stringify({
        moment:      new Date().toISOString(),
        orderStatus: statusCode,
        client:      { id: clientId }
    });
    apiFetch("/orders", { method: "POST", body: payload })
        .then(function() {
            orderForm.reset();
            setStatus(orderStatusEl, "Pedido criado.");
            loadOrders();
        })
        .catch(function(err) { setStatus(orderStatusEl, String(err.message || err), true); });
});

document.getElementById("orderReloadBtn").addEventListener("click", function() { loadOrders(); });

orderTbody.addEventListener("click", function(e) {
    var btn = e.target.closest("button[data-action='view-order']");
    if (!btn) return;
    apiFetch("/orders/" + btn.getAttribute("data-id"))
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

    var rows = "";
    items.forEach(function(i) {
        var pName    = i.product ? (i.product.name || String(i.product.id)) : "-";
        var subTotal = i.subTotal || i.subtotal || (i.price * i.quantity) || 0;
        rows += "<tr>";
        rows += "<td>" + esc(pName) + "</td>";
        rows += "<td>" + esc(i.quantity) + "</td>";
        rows += "<td>R$ " + formatMoney(i.price) + "</td>";
        rows += "<td>R$ " + formatMoney(subTotal) + "</td>";
        rows += "</tr>";
    });
    if (!rows) {
        rows = "<tr><td colspan='4' class='empty'>Sem itens.</td></tr>";
    }

    var payHtml = payment
        ? "<p><strong>ID:</strong> " + esc(payment.id) + "</p>"
        + "<p><strong>Momento:</strong> " + formatDate(payment.moment) + "</p>"
        : "<p style='color:var(--muted)'>Nenhum pagamento registrado.</p>";

    var html = "";
    html += "<div class='order-detail-grid'>";
    html += "<div class='detail-item'><div class='detail-label'>Momento</div><div>"  + formatDate(o.moment)       + "</div></div>";
    html += "<div class='detail-item'><div class='detail-label'>Status</div><div>"   + statusBadge(o.orderStatus) + "</div></div>";
    html += "<div class='detail-item'><div class='detail-label'>Cliente</div><div>"  + esc(clientName)            + "</div></div>";
    html += "<div class='detail-item'><div class='detail-label'>Total</div><div>R$ " + formatMoney(o.total)       + "</div></div>";
    html += "</div>";
    html += "<h3 style='margin-bottom:8px'>Itens</h3>";
    html += "<div class='table-wrap' style='margin-bottom:14px'>";
    html += "<table class='table'><thead><tr>";
    html += "<th>Produto</th><th>Qtd</th><th>Preco Unit.</th><th>Subtotal</th>";
    html += "</tr></thead><tbody>" + rows + "</tbody></table></div>";
    html += "<h3 style='margin-bottom:8px'>Pagamento</h3>";
    html += "<div class='card' style='margin-bottom:0'>" + payHtml + "</div>";
    return html;
}

// ============================================================
// BOOT
// ============================================================

loadUsers();
loadCategories();
loadProducts();
loadOrders();