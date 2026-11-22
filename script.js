// Каталог товаров
const products = [
  { id: 1, name: "Розовое облако",  emoji: "🌸", desc: "25 розовых пионов", price: 2900 },
  { id: 2, name: "Красный роман",  emoji: "🌹", desc: "51 красная роза",  price: 4900 },
  { id: 3, name: "Весенний бриз",   emoji: "🌷", desc: "Тюльпаны микс, 35 шт", price: 2200 },
  { id: 4, name: "Солнечный день",  emoji: "🌻", desc: "Подсолнухи и ромашки", price: 2600 },
  { id: 5, name: "Белый сад",       emoji: "💐", desc: "Лилии и хризантемы", price: 3400 },
  { id: 6, name: "Нежность",        emoji: "🏵️", desc: "Эустома и гортензия", price: 3100 },
  { id: 7, name: "Лавандовое поле", emoji: "🪻", desc: "Лаванда и ромашки", price: 2400 },
  { id: 8, name: "Королевский",     emoji: "🥀", desc: "Голландские розы, 75 шт", price: 6900 },
];

// Адрес нашего сервера на Render (заменим на настоящий после деплоя)
const API_URL = "https://flowers-beautiful.onrender.com/api"; 

let token = localStorage.getItem("fb_token") || null;
let currentUser = null;
let cart = [];
let favorites = [];

// --- Отрисовка каталога ---
const grid = document.getElementById("productGrid");

function renderProducts() {
  grid.innerHTML = products.map(p => `
    <div class="card">
      <button class="heart-btn ${favorites.includes(p.id) ? "active" : ""}"
              data-id="${p.id}"
              onclick="toggleFav(${p.id})">
        ♥
      </button>
      <div class="card-img">${p.emoji}</div>
      <div class="card-body">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="card-price">${p.price.toLocaleString('ru-RU')} ₽</div>
        <button onclick="addToCart(${p.id})">В корзину</button>
      </div>
    </div>
  `).join("");
}

// --- Корзина ---
function addToCart(id) {
  const product = products.find(p => p.id === id);
  const item = cart.find(i => i.id === id);
  if (item) item.qty++;
  else cart.push({ ...product, qty: 1 });
  
  updateCartUI();
  saveCartToServer();
  UI.toast(`«${product.name}» добавлен в корзину 🌷`);
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartUI();
  saveCartToServer();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  updateCartUI();
  saveCartToServer();
}

function updateCartUI() {
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  document.getElementById("cartCount").textContent = count;

  const container = document.getElementById("cartItems");
  if (cart.length === 0) {
    container.innerHTML = `<p class="empty-cart">Корзина пуста 🥀</p>`;
  } else {
    container.innerHTML = cart.map(i => `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${i.emoji} ${i.name}</h4>
          <span>${(i.price * i.qty).toLocaleString('ru-RU')} ₽</span>
        </div>
        <div>
          <button onclick="changeQty(${i.id}, -1)">−</button>
          <strong>${i.qty}</strong>
          <button onclick="changeQty(${i.id}, 1)">+</button>
          <button onclick="removeFromCart(${i.id})">✕</button>
        </div>
      </div>
    `).join("");
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  document.getElementById("cartTotal").textContent = total.toLocaleString('ru-RU') + " ₽";
}

// --- Избранное ---
function toggleFav(id) {
  if (favorites.includes(id)) {
    favorites = favorites.filter(f => f !== id);
    UI.toast("Убрано из избранного");
  } else {
    favorites.push(id);
    UI.toast("Добавлено в избранное ♥");
  }
  renderProducts();
  updateFavUI();
  saveFavsToServer();
}

function updateFavUI() {
  document.getElementById("favCount").textContent = favorites.length;
  
  const box = document.getElementById("favItems");
  if (favorites.length === 0) {
    box.innerHTML = `<p class="empty-cart">В избранном пока пусто 🥀</p>`;
    return;
  }
  
  box.innerHTML = favorites.map(id => {
    const p = products.find(x => x.id === id);
    if (!p) return "";
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${p.emoji} ${p.name}</h4>
          <span>${p.price.toLocaleString('ru-RU')} ₽</span>
        </div>
        <div>
          <button onclick="addToCart(${p.id})">В корзину</button>
          <button onclick="toggleFav(${p.id})">✕</button>
        </div>
      </div>
    `;
  }).join("");
}

// --- СВЯЗЬ С СЕРВЕРОМ (API) ---
async function saveCartToServer() {
  if (!token) return; // Гость - ничего не сохраняем на сервер
  try {
    await fetch(`${API_URL}/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ cart })
    });
  } catch (e) { console.error("Ошибка сохранения корзины", e); }
}

async function saveFavsToServer() {
  if (!token) return;
  try {
    await fetch(`${API_URL}/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ favorites })
    });
  } catch (e) { console.error("Ошибка сохранения избранного", e); }
}

async function loadUserData() {
  if (!token) return;
  try {
    // Загружаем профиль
    const meRes = await fetch(`${API_URL}/me`, { headers: { "Authorization": `Bearer ${token}` } });
    if (!meRes.ok) throw new Error("Токен истёк");
    currentUser = await meRes.json();

    // Загружаем корзину и избранное
    const cartRes = await fetch(`${API_URL}/cart`, { headers: { "Authorization": `Bearer ${token}` } });
    cart = await cartRes.json();

    const favRes = await fetch(`${API_URL}/favorites`, { headers: { "Authorization": `Bearer ${token}` } });
    favorites = await favRes.json();

    UI.refreshHeader();
    updateCartUI();
    updateFavUI();
    renderProducts();
  } catch (e) {
    console.error(e);
    logout(); // Если токен плохой - сбрасываем
  }
}

// --- АККАУНТЫ ---
let authMode = "login";

function switchAuth(mode) {
  authMode = mode;
  document.getElementById("tabLogin").classList.toggle("active", mode === "login");
  document.getElementById("tabRegister").classList.toggle("active", mode === "register");
  document.getElementById("nameField").style.display = mode === "register" ? "block" : "none";
  document.getElementById("authError").textContent = "";
}

async function submitAuth(e) {
  e.preventDefault();
  const name = document.getElementById("authName").value;
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPass").value;
  const err = document.getElementById("authError");

  const url = authMode === "register" ? `${API_URL}/register` : `${API_URL}/login`;
  const body = authMode === "register" ? { name, email, password: pass } : { email, password: pass };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      err.textContent = data.error || "Ошибка";
      return;
    }

    // Успех!
    token = data.token;
    localStorage.setItem("fb_token", token);
    
    UI.closeAuth();
    await loadUserData();
    UI.toast(authMode === "register" ? "Аккаунт создан! 🌸" : "С возвращением! 💐");
  } catch (e) {
    err.textContent = "Сервер недоступен. Проверьте интернет.";
  }
}

function logout() {
  token = null;
  currentUser = null;
  cart = [];
  favorites = [];
  localStorage.removeItem("fb_token");
  
  UI.refreshHeader();
  updateCartUI();
  updateFavUI();
  renderProducts();
}

// --- UI ---
const UI = {
  refreshHeader() {
    const box = document.getElementById("userBox");
    if (currentUser) {
      box.innerHTML = `
        <span class="hi">Привет, ${currentUser.name}!</span>
        <button onclick="logout()">Выйти</button>
      `;
    } else {
      box.innerHTML = `<button onclick="document.getElementById('authModal').classList.add('active')">Войти</button>`;
    }
  },
  closeAuth() {
    document.getElementById("authModal").classList.remove("active");
  },
  toast(text) {
    const t = document.createElement("div");
    t.textContent = text;
    Object.assign(t.style, {
      position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)",
      background: "#c2185b", color: "#fff", padding: "12px 24px", borderRadius: "30px",
      fontSize: "14px", zIndex: 400, opacity: 0, transition: "opacity .3s",
      boxShadow: "0 4px 20px rgba(0,0,0,.2)"
    });
    document.body.appendChild(t);
    requestAnimationFrame(() => t.style.opacity = 1);
    setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, 2000);
  }
};

// --- Оформление заказа ---
function checkout() {
  if (cart.length === 0) {
    UI.toast("Корзина пуста 🌷");
    return;
  }
  if (!currentUser) {
    UI.toast("Войдите в аккаунт, чтобы оформить заказ");
    document.getElementById('authModal').classList.add('active');
    return;
  }
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  alert(`Спасибо за заказ, ${currentUser.name}!\nСумма: ${total.toLocaleString('ru-RU')} ₽\n\nНаш флорист свяжется с вами в течение 15 минут 💐`);
  
  cart = [];
  updateCartUI();
  saveCartToServer();
  document.getElementById("cartModal").classList.remove("active");
}

// --- Инициализация ---
document.getElementById("cartBtn").onclick = () => document.getElementById("cartModal").classList.add("active");
document.getElementById("closeModal").onclick = () => document.getElementById("cartModal").classList.remove("active");
document.querySelectorAll('.modal').forEach(m => {
  m.onclick = (e) => { if (e.target === m) m.classList.remove("active"); };
});

renderProducts();
UI.refreshHeader();

if (token) {
  loadUserData();
} else {
  updateCartUI();
  updateFavUI();
}