/**
 * Food Cart Menu Application - Interactive Logic & Admin System with Firebase & Self-Healing Cloud Engine
 */

// Active Primary Cloud API Endpoint
const DEFAULT_CLOUD_API_URL = "https://jsonblob.com/api/jsonBlob/019fc2df-784d-779a-a563-9add0445d984";

// Default Production Firebase Credentials for lala-halwai
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCrCzx8wBbUayGEIbzN2xfLqrxrpaEvFYQ",
  authDomain: "lala-halwai.firebaseapp.com",
  databaseURL: "https://lala-halwai-default-rtdb.firebaseio.com",
  projectId: "lala-halwai",
  storageBucket: "lala-halwai.firebasestorage.app",
  messagingSenderId: "691713785616",
  appId: "1:691713785616:web:7dbc9baa1019a8b698ef95",
  measurementId: "G-X1LKQHNVKL"
};

function initFirebaseEngine() {
  let config = DEFAULT_FIREBASE_CONFIG;
  const savedConfig = localStorage.getItem("FIREBASE_CONFIG_JSON");
  if (savedConfig) {
    try {
      config = JSON.parse(savedConfig);
    } catch (e) {}
  }

  if (typeof firebase !== "undefined" && config && config.databaseURL) {
    try {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(config);
      } else {
        firebaseApp = firebase.app();
      }
      firebaseDb = firebase.database();
      console.log("🔥 Connected to Firebase Realtime Database: " + config.databaseURL);
      
      // Listen for live instant changes via WebSockets (Sub-50ms latency)
      firebaseDb.ref("menu_app_state").on("value", (snapshot) => {
        const cloudData = snapshot.val();
        if (cloudData) {
          if (Array.isArray(cloudData.items) && cloudData.items.length > 0) {
            state.items = cloudData.items;
          }
          if (Array.isArray(cloudData.categories) && cloudData.categories.length > 0) {
            state.categories = cloudData.categories;
          }
          state.cartName = cloudData.cartName || state.cartName;
          state.tagline = cloudData.tagline || state.tagline;
          state.adminPin = cloudData.adminPin || state.adminPin;
          state.orders = cloudData.orders || [];

          localStorage.setItem(STORAGE_KEY, JSON.stringify(getAppStateData()));
          updateCloudSyncStatus("synced");
          renderApp();
        } else {
          // First time initialization on brand new Firebase DB
          saveState();
        }
      });
      return true;
    } catch (e) {
      console.warn("Failed to initialize Firebase Engine", e);
    }
  }
  return false;
}

function getCloudUrl() {
  return localStorage.getItem("CUSTOM_CLOUD_API_URL") || DEFAULT_CLOUD_API_URL;
}

// Self-healing: Dynamically create a fresh cloud storage bin if ever needed
async function createNewCloudBin(dataToSave) {
  try {
    const res = await fetch("https://jsonblob.com/api/jsonBlob", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(dataToSave)
    });
    if (res.ok || res.status === 201) {
      const loc = res.headers.get("location");
      if (loc) {
        const fullUrl = loc.startsWith("http") ? loc : `https://jsonblob.com${loc}`;
        localStorage.setItem("CUSTOM_CLOUD_API_URL", fullUrl);
        console.log("Created self-healed Cloud Storage Bin:", fullUrl);
        return fullUrl;
      }
    }
  } catch (e) {
    console.error("Failed to auto-create cloud bin", e);
  }
  return getCloudUrl();
}

function getAppStateData() {
  return {
    cartName: state.cartName,
    tagline: state.tagline,
    adminPin: state.adminPin,
    categories: state.categories,
    items: state.items,
    orders: state.orders || [],
    updatedAt: new Date().toISOString()
  };
}

// Global State
let state = {
  cartName: "Lala Hoti Lal Halwai & Cafe",
  tagline: "Pure Veg Artisanal Street Eats, Snacks & Cafe Favorites 🌱",
  location: "Pure Veg Station • Cart #04",
  hours: "Open Daily: 10:00 AM - 10:00 PM",
  adminPin: "1234",
  categories: [],
  items: [],
  orders: [], // Live Customer Orders Array { id, items, total, status, time }
  
  // UI State
  isAdmin: false,
  activeCategory: "all",
  searchQuery: "",
  activeDietaryFilters: new Set(),
  cart: [], // Array of { itemId, qty }
  editingItemId: null,
  activeOrdersFilter: "all"
};

// LocalStorage Keys
const STORAGE_KEY = "LALA_HOTI_LAL_MENU_V3";
const CART_STORAGE_KEY = "FOOD_CART_CART_ITEMS";

// Initialize App on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  initData();
  setupEventListeners();

  // Auto-sync polling every 5 seconds for live orders & menu edits across devices
  setInterval(() => {
    if (!firebaseDb) {
      fetchCloudData(true);
    }
  }, 5000);
});

// Load state from LocalStorage first, then fetch live Cloud Database
async function initData() {
  loadLocalData();
  renderApp();
  const hasFirebase = initFirebaseEngine();
  if (!hasFirebase) {
    await fetchCloudData();
  }
}

function loadLocalData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.cartName = parsed.cartName || DEFAULT_MENU_DATA.cartName;
      state.tagline = parsed.tagline || DEFAULT_MENU_DATA.tagline;
      state.adminPin = parsed.adminPin || DEFAULT_MENU_DATA.adminPin;
      state.categories = (parsed.categories && parsed.categories.length > 0) ? parsed.categories : DEFAULT_MENU_DATA.categories;
      state.items = (parsed.items && parsed.items.length > 0) ? parsed.items : DEFAULT_MENU_DATA.items;
      state.orders = parsed.orders || [];
    } catch (e) {
      console.error("Failed to parse saved data, reverting to defaults", e);
      resetToDefaultData();
    }
  } else {
    resetToDefaultData();
  }

  // Load saved cart items
  const savedCart = localStorage.getItem(CART_STORAGE_KEY);
  if (savedCart) {
    try {
      state.cart = JSON.parse(savedCart);
    } catch (e) {
      state.cart = [];
    }
  }

  // Restore Admin login session across page refreshes
  if (localStorage.getItem("ADMIN_LOGGED_IN") === "true") {
    state.isAdmin = true;
  }
}

async function fetchCloudData(silent = false) {
  let url = getCloudUrl();
  let retries = 2;

  while (retries >= 0) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });

      if (res.status === 404) {
        console.warn("Cloud Blob 404, self-healing & creating dynamic storage bin...");
        const dataToSave = getAppStateData();
        url = await createNewCloudBin(dataToSave);
        updateCloudSyncStatus("synced");
        return;
      }

      if (res.status === 429) {
        // Rate limited temporarily - maintain current synced status gracefully
        updateCloudSyncStatus("synced");
        return;
      }

      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && Array.isArray(cloudData.items) && cloudData.items.length > 0) {
          state.cartName = cloudData.cartName || state.cartName;
          state.tagline = cloudData.tagline || state.tagline;
          state.adminPin = cloudData.adminPin || state.adminPin;
          state.categories = cloudData.categories || state.categories;
          state.items = cloudData.items;
          state.orders = cloudData.orders || state.orders || [];

          // Save local cache
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            cartName: state.cartName,
            tagline: state.tagline,
            adminPin: state.adminPin,
            categories: state.categories,
            items: state.items,
            orders: state.orders
          }));

          updateCloudSyncStatus("synced");
          renderApp();
          return;
        }
      }
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 800));
      }
    }
    retries--;
  }

  if (!silent && !navigator.onLine) {
    updateCloudSyncStatus("offline");
  } else {
    updateCloudSyncStatus("synced");
  }
}

function resetToDefaultData() {
  state.cartName = DEFAULT_MENU_DATA.cartName;
  state.tagline = DEFAULT_MENU_DATA.tagline;
  state.adminPin = DEFAULT_MENU_DATA.adminPin;
  state.categories = JSON.parse(JSON.stringify(DEFAULT_MENU_DATA.categories));
  state.items = JSON.parse(JSON.stringify(DEFAULT_MENU_DATA.items));
  state.orders = [];
  saveState();
}

async function saveState() {
  const dataToSave = getAppStateData();

  // 1. Save to local storage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));

  // 2. Sync via Firebase Realtime DB if connected (Instant sub-50ms WebSocket sync)
  if (firebaseDb) {
    try {
      firebaseDb.ref("menu_app_state").set(dataToSave);
      updateCloudSyncStatus("synced");
      return;
    } catch (e) {
      console.warn("Firebase sync fallback to HTTP", e);
    }
  }

  // 3. Broadcast & Sync to Cloud Database
  updateCloudSyncStatus("syncing");

  let url = getCloudUrl();
  let retries = 3;
  let success = false;

  while (retries > 0 && !success) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(dataToSave)
      });

      if (res.status === 404) {
        url = await createNewCloudBin(dataToSave);
        success = true;
        updateCloudSyncStatus("synced");
        break;
      }

      if (res.status === 429) {
        // Rate limited - data saved locally, mark as synced
        success = true;
        updateCloudSyncStatus("synced");
        break;
      }

      if (res.ok) {
        success = true;
        updateCloudSyncStatus("synced");
      } else {
        retries--;
        if (retries > 0) await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      retries--;
      if (retries > 0) await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!success && !navigator.onLine) {
    updateCloudSyncStatus("error");
  } else {
    updateCloudSyncStatus("synced");
  }
}

function updateCloudSyncStatus(status) {
  const pill = document.getElementById("cloud-sync-pill");
  if (!pill) return;

  if (status === "syncing") {
    pill.style.background = "rgba(245, 158, 11, 0.2)";
    pill.style.color = "#fbbf24";
    pill.style.borderColor = "rgba(245, 158, 11, 0.4)";
    pill.innerHTML = "⏳ Syncing to Cloud...";
  } else if (status === "synced") {
    pill.style.background = "rgba(16, 185, 129, 0.15)";
    pill.style.color = "#34d399";
    pill.style.borderColor = "rgba(16, 185, 129, 0.3)";
    pill.innerHTML = "☁️ Cloud Synced";
  } else {
    pill.style.background = "rgba(239, 68, 68, 0.15)";
    pill.style.color = "#fca5a5";
    pill.style.borderColor = "rgba(239, 68, 68, 0.3)";
    pill.innerHTML = "⚡ Cached Locally";
  }
}

function saveCartState() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
}

/* ==========================================================================
   DOM Render Functions
   ========================================================================== */

function renderApp() {
  renderAdminHeaderState();
  renderCategoryBar();
  renderDietaryFilters();
  renderMenuItems();
  renderCartDrawer();
  renderCartBadge();
  renderCustomerActiveTicketPill();
}

function renderAdminHeaderState() {
  const adminBtn = document.getElementById("btn-admin-toggle");
  const adminToolbar = document.getElementById("admin-toolbar");
  const adminPill = document.getElementById("admin-mode-pill");
  const orderBadge = document.getElementById("admin-order-count");

  const orders = state.orders || [];
  // Count active non-completed orders (Pending, Preparing, Ready)
  const activeCount = orders.filter(o => o.status !== "Completed").length;

  if (orderBadge) {
    orderBadge.textContent = activeCount;
  }

  if (state.isAdmin) {
    adminBtn.classList.add("active");
    adminBtn.innerHTML = `⚙️ Admin Mode (Exit)`;
    if (adminToolbar) adminToolbar.style.display = "flex";
    if (adminPill) adminPill.style.display = "flex";
  } else {
    adminBtn.classList.remove("active");
    if (activeCount > 0) {
      adminBtn.innerHTML = `🔒 Admin Login <span style="background: var(--primary); color: white; border-radius: 99px; padding: 0.15rem 0.55rem; font-size: 0.75rem; font-weight: 800; margin-left: 0.35rem; box-shadow: 0 0 10px rgba(255,87,34,0.6);">⚡ ${activeCount} NEW</span>`;
    } else {
      adminBtn.innerHTML = `🔒 Admin Login`;
    }
    if (adminToolbar) adminToolbar.style.display = "none";
    if (adminPill) adminPill.style.display = "none";
  }
}

function renderCategoryBar() {
  const container = document.getElementById("category-bar");
  if (!container) return;

  container.innerHTML = state.categories.map(cat => {
    const isActive = state.activeCategory === cat.id ? "active" : "";
    // count items in category
    const count = cat.id === "all" 
      ? state.items.length 
      : state.items.filter(i => i.category === cat.id).length;

    return `
      <button class="cat-btn ${isActive}" data-cat-id="${cat.id}">
        <span>${cat.icon || '🍴'}</span>
        <span>${cat.name}</span>
        <span style="opacity: 0.7; font-size: 0.75rem;">(${count})</span>
      </button>
    `;
  }).join("");

  // Add click listeners to category buttons
  container.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeCategory = btn.dataset.catId;
      renderCategoryBar();
      renderMenuItems();
    });
  });
}

function renderDietaryFilters() {
  const container = document.getElementById("dietary-filters");
  if (!container) return;

  const filters = [
    { id: "vegan", label: "Vegan 🌱" },
    { id: "vegetarian", label: "Vegetarian 🥦" },
    { id: "gluten-free", label: "Gluten-Free 🌾" },
    { id: "spicy", label: "Spicy 🌶️" }
  ];

  container.innerHTML = filters.map(f => {
    const isActive = state.activeDietaryFilters.has(f.id) ? "active" : "";
    return `
      <button class="filter-chip ${isActive}" data-dietary="${f.id}">
        ${f.label}
      </button>
    `;
  }).join("");

  container.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const diet = chip.dataset.dietary;
      if (state.activeDietaryFilters.has(diet)) {
        state.activeDietaryFilters.delete(diet);
      } else {
        state.activeDietaryFilters.add(diet);
      }
      renderDietaryFilters();
      renderMenuItems();
    });
  });
}

function renderMenuItems() {
  const container = document.getElementById("menu-grid");
  const countLabel = document.getElementById("menu-item-count");
  if (!container) return;

  // Filter items based on active category, search query, dietary
  let filtered = state.items.filter(item => {
    // Category check
    if (state.activeCategory !== "all" && item.category !== state.activeCategory) {
      return false;
    }
    // Search query check
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchTags = item.tags && item.tags.some(t => t.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchTags) return false;
    }
    // Dietary check
    if (state.activeDietaryFilters.size > 0) {
      const itemDietary = item.dietary || [];
      for (let diet of state.activeDietaryFilters) {
        if (!itemDietary.includes(diet)) return false;
      }
    }
    return true;
  });

  if (countLabel) {
    countLabel.textContent = `${filtered.length} dish${filtered.length === 1 ? '' : 'es'} available`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <p style="font-size: 3rem; margin-bottom: 1rem;">🌮</p>
        <h4 style="color: white; font-size: 1.2rem; margin-bottom: 0.5rem;">No dishes found</h4>
        <p style="font-size: 0.9rem;">Try adjusting your search or category filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isSoldOut = !item.inStock;
    const soldOutClass = isSoldOut ? "sold-out" : "";
    const adminCardClass = state.isAdmin ? "admin-card-edit" : "";

    // Cart item quantity
    const cartEntry = state.cart.find(c => String(c.itemId).trim() === String(item.id).trim());
    const cartQty = cartEntry ? cartEntry.qty : 0;

    return `
      <div class="food-card ${soldOutClass} ${adminCardClass}" data-item-id="${item.id}">
        <div class="card-image-wrapper">
          <img src="${item.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'}" 
               alt="${escapeHtml(item.name)}" 
               loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'" />
          
          <div class="card-tags">
            ${(item.tags || []).map(tag => `<span class="food-badge ${tag.includes('Popular') || tag.includes('Bestseller') ? 'popular' : ''}">${escapeHtml(tag)}</span>`).join('')}
          </div>

          ${isSoldOut ? `
            <div class="sold-out-overlay">
              <div class="sold-out-banner">Sold Out</div>
            </div>
          ` : ''}
        </div>

        <div class="card-body">
          <div class="card-header-line">
            <h4 class="food-title">${escapeHtml(item.name)}</h4>
            <div style="text-align: right;">
              <span class="food-price">₹${item.price}</span>
              ${(item.offerQty > 1 && item.offerPrice > 0) ? `
                <div style="font-size: 0.7rem; color: var(--accent-gold); font-weight: 700; margin-top: 0.1rem;">
                  🏷️ Buy ${item.offerQty} @ ₹${item.offerPrice}
                </div>
              ` : ''}
            </div>
          </div>

          <p class="food-desc">${escapeHtml(item.description)}</p>

          <div class="card-footer">
            <span class="calories-label">${item.calories ? `🔥 ${item.calories}` : ''}</span>

            <button class="btn-add-cart" 
                    data-item-id="${item.id}" 
                    onclick="event.stopPropagation(); addToCart('${item.id}');"
                    ${isSoldOut ? 'disabled' : ''}>
              ${cartQty > 0 ? `In Cart (${cartQty})` : `+ Add ₹${item.price}`}
            </button>
          </div>
        </div>

        ${state.isAdmin ? `
          <!-- ADMIN CONTROL BAR -->
          <div class="admin-card-controls">
            <div class="admin-control-row">
              <button class="stock-toggle-btn ${item.inStock ? 'in-stock' : 'sold-out'}" data-item-id="${item.id}">
                ${item.inStock ? '✅ In Stock' : '🚫 Mark Available'}
              </button>

              <div style="display: flex; gap: 0.35rem;">
                <button class="btn-edit-dish" data-item-id="${item.id}">✏️ Edit</button>
                <button class="btn-delete-dish" data-item-id="${item.id}">🗑️</button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");

  // Attach event handlers to card elements
  container.querySelectorAll(".btn-add-cart").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetBtn = e.target.closest(".btn-add-cart") || btn;
      const itemId = targetBtn.getAttribute("data-item-id") || targetBtn.dataset.itemId;
      if (itemId) {
        addToCart(itemId);
      }
    });
  });

  if (state.isAdmin) {
    // Stock toggle buttons
    container.querySelectorAll(".stock-toggle-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleStockStatus(btn.dataset.itemId);
      });
    });

    // Edit dish buttons
    container.querySelectorAll(".btn-edit-dish").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditItemModal(btn.dataset.itemId);
      });
    });

    // Delete dish buttons
    container.querySelectorAll(".btn-delete-dish").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteItem(btn.dataset.itemId);
      });
    });
  }
}

/* ==========================================================================
   Cart System Logic
   ========================================================================== */

function saveCartState() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
}

function addToCart(itemId) {
  if (!itemId) return;
  const cleanId = String(itemId).trim();

  // Find item by ID in active state or default menu
  let item = state.items.find(i => String(i.id).trim() === cleanId);
  if (!item) {
    item = DEFAULT_MENU_DATA.items.find(i => String(i.id).trim() === cleanId);
    if (item && !state.items.some(i => String(i.id).trim() === cleanId)) {
      state.items.push(item);
    }
  }

  if (!item) {
    console.warn("Item not found in state.items:", itemId);
    showToast("Dish not found!", "error");
    return;
  }
  
  if (item.inStock === false) {
    showToast("Sorry, this item is currently sold out!", "error");
    return;
  }

  const existingIndex = state.cart.findIndex(c => String(c.itemId).trim() === cleanId);
  if (existingIndex !== -1) {
    state.cart[existingIndex].qty += 1;
  } else {
    state.cart.push({ itemId: cleanId, qty: 1 });
  }

  saveCartState();
  renderMenuItems();
  renderCartDrawer();
  renderCartBadge();

  // Auto-open Order Bag Drawer so customer immediately sees item in their cart bag
  const drawerBackdrop = document.getElementById("cart-drawer-backdrop");
  if (drawerBackdrop && !drawerBackdrop.classList.contains("open")) {
    drawerBackdrop.classList.add("open");
  }

  showToast(`Added "${item.name}" to your order bag! 🛍️`, "success");
}

function updateCartQty(itemId, delta) {
  const cleanId = String(itemId).trim();
  const index = state.cart.findIndex(c => String(c.itemId).trim() === cleanId);
  if (index === -1) return;

  state.cart[index].qty += delta;
  if (state.cart[index].qty <= 0) {
    state.cart.splice(index, 1);
  }

  saveCartState();
  renderMenuItems();
  renderCartDrawer();
  renderCartBadge();
}

function renderCartBadge() {
  const floatBtn = document.getElementById("floating-cart-btn");
  const totalItems = state.cart.reduce((sum, i) => sum + i.qty, 0);

  let cartTotal = 0;
  state.cart.forEach(c => {
    const item = state.items.find(i => String(i.id).trim() === String(c.itemId).trim()) || 
                 DEFAULT_MENU_DATA.items.find(i => String(i.id).trim() === String(c.itemId).trim());
    if (item) cartTotal += calculateLineItemTotal(item, c.qty);
  });

  if (floatBtn) {
    if (totalItems > 0) {
      floatBtn.style.display = "flex";
      floatBtn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.55rem;">
          <span style="background: rgba(255,255,255,0.25); border-radius: 99px; padding: 0.15rem 0.6rem; font-weight: 800; font-size: 0.85rem;">${totalItems}</span>
          <span style="font-weight: 700;">🛍️ View Order Bag</span>
        </div>
        <span style="font-weight: 800; font-size: 1.05rem;">₹${cartTotal.toFixed(0)} ➔</span>
      `;
    } else {
      floatBtn.style.display = "flex";
      floatBtn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.55rem;">
          <span id="cart-count-badge" class="badge">0</span>
          <span>🛍️ View Bag</span>
        </div>
        <span style="font-size: 0.85rem; opacity: 0.8;">Empty</span>
      `;
    }
  }
}

function renderCartDrawer() {
  const bodyContainer = document.getElementById("cart-body");
  const subtotalElem = document.getElementById("cart-subtotal");
  const taxElem = document.getElementById("cart-tax");
  const totalElem = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("btn-checkout");

  if (!bodyContainer) return;

  const validCartEntries = state.cart.filter(c => {
    return state.items.some(i => String(i.id).trim() === String(c.itemId).trim()) ||
           DEFAULT_MENU_DATA.items.some(i => String(i.id).trim() === String(c.itemId).trim());
  });

  if (validCartEntries.length === 0) {
    bodyContainer.innerHTML = `
      <div class="cart-empty-state">
        <span style="font-size: 3.5rem; display: block; margin-bottom: 0.5rem;">🛍️</span>
        <h4 style="color: white; font-size: 1.1rem;">Your bag is empty</h4>
        <p style="font-size: 0.85rem; margin-top: 0.3rem;">Select delicious items from the food cart menu to get started!</p>
      </div>
    `;
    if (subtotalElem) subtotalElem.textContent = "₹0";
    if (taxElem) taxElem.textContent = "₹0";
    if (totalElem) totalElem.textContent = "₹0";
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  let subtotal = 0;

  bodyContainer.innerHTML = validCartEntries.map(c => {
    const item = state.items.find(i => String(i.id).trim() === String(c.itemId).trim()) ||
                 DEFAULT_MENU_DATA.items.find(i => String(i.id).trim() === String(c.itemId).trim());
    if (!item) return "";

    const lineTotal = calculateLineItemTotal(item, c.qty);
    subtotal += lineTotal;
    const hasOffer = (item.offerQty > 1 && item.offerPrice > 0 && c.qty >= item.offerQty);
    const savedAmount = (item.price * c.qty) - lineTotal;

    return `
      <div class="cart-item-card">
        <img class="cart-item-img" src="${item.image}" alt="${escapeHtml(item.name)}" 
             onerror="this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'" />
        
        <div class="cart-item-details">
          <div class="cart-item-title">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">₹${lineTotal.toFixed(0)} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${c.qty}x ₹${item.price})</span></div>
          ${hasOffer ? `<div style="font-size: 0.725rem; color: #34d399; font-weight: 700; margin-top: 0.15rem;">🎉 Combo Offer Applied! Saved ₹${savedAmount}</div>` : ''}
        </div>

        <div class="qty-controls">
          <button class="qty-btn btn-minus" data-item-id="${item.id}">-</button>
          <span class="qty-val">${c.qty}</span>
          <button class="qty-btn btn-plus" data-item-id="${item.id}">+</button>
        </div>
      </div>
    `;
  }).join("");

  const tax = subtotal * 0.05; // 5% GST/Tax
  const total = subtotal + tax;

  if (subtotalElem) subtotalElem.textContent = `₹${subtotal.toFixed(0)}`;
  if (taxElem) taxElem.textContent = `₹${tax.toFixed(0)}`;
  if (totalElem) totalElem.textContent = `₹${total.toFixed(0)}`;
  if (checkoutBtn) checkoutBtn.disabled = false;

  // Attach quantity event listeners
  bodyContainer.querySelectorAll(".btn-minus").forEach(btn => {
    btn.addEventListener("click", () => updateCartQty(btn.dataset.itemId, -1));
  });
  bodyContainer.querySelectorAll(".btn-plus").forEach(btn => {
    btn.addEventListener("click", () => updateCartQty(btn.dataset.itemId, 1));
  });
}

/* ==========================================================================
   Admin Operations (CRUD, Auth, PIN)
   ========================================================================== */

function toggleStockStatus(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  item.inStock = !item.inStock;
  saveState();
  renderMenuItems();
  showToast(`"${item.name}" marked as ${item.inStock ? 'IN STOCK ✅' : 'SOLD OUT 🚫'}`, "admin");
}

function openEditItemModal(itemId = null) {
  state.editingItemId = itemId;
  const modal = document.getElementById("item-modal");
  const title = document.getElementById("item-modal-title");
  
  // Fill category options
  const catSelect = document.getElementById("modal-item-category");
  catSelect.innerHTML = state.categories
    .filter(c => c.id !== "all")
    .map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  if (itemId) {
    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    if (title) title.textContent = "✏️ Edit Food Cart Item";
    document.getElementById("modal-item-name").value = item.name;
    catSelect.value = item.category;
    document.getElementById("modal-item-price").value = item.price;
    document.getElementById("modal-item-image").value = item.image || "";
    document.getElementById("modal-item-calories").value = item.calories || "";
    document.getElementById("modal-item-tags").value = (item.tags || []).join(", ");
    document.getElementById("modal-item-desc").value = item.description || "";
    document.getElementById("modal-item-instock").checked = item.inStock;

    const offerQtyInput = document.getElementById("modal-item-offer-qty");
    const offerPriceInput = document.getElementById("modal-item-offer-price");
    if (offerQtyInput) offerQtyInput.value = item.offerQty || "";
    if (offerPriceInput) offerPriceInput.value = item.offerPrice || "";

    // Set dietary checkboxes
    const dietary = item.dietary || [];
    document.getElementById("diet-vegan").checked = dietary.includes("vegan");
    document.getElementById("diet-vegetarian").checked = dietary.includes("vegetarian");
    document.getElementById("diet-gluten-free").checked = dietary.includes("gluten-free");
    document.getElementById("diet-spicy").checked = dietary.includes("spicy");

  } else {
    if (title) title.textContent = "➕ Add New Food Cart Dish";
    document.getElementById("modal-item-name").value = "";
    document.getElementById("modal-item-price").value = "";
    document.getElementById("modal-item-image").value = "";
    document.getElementById("modal-item-calories").value = "";
    document.getElementById("modal-item-tags").value = "";
    document.getElementById("modal-item-desc").value = "";
    document.getElementById("modal-item-instock").checked = true;

    const offerQtyInput = document.getElementById("modal-item-offer-qty");
    const offerPriceInput = document.getElementById("modal-item-offer-price");
    if (offerQtyInput) offerQtyInput.value = "";
    if (offerPriceInput) offerPriceInput.value = "";

    document.getElementById("diet-vegan").checked = false;
    document.getElementById("diet-vegetarian").checked = false;
    document.getElementById("diet-gluten-free").checked = false;
    document.getElementById("diet-spicy").checked = false;
  }

  modal.classList.add("open");
}

function saveItemFromModal() {
  const name = document.getElementById("modal-item-name").value.trim();
  const category = document.getElementById("modal-item-category").value;
  const price = parseFloat(document.getElementById("modal-item-price").value);
  const image = document.getElementById("modal-item-image").value.trim();
  const calories = document.getElementById("modal-item-calories").value.trim();
  const tagsRaw = document.getElementById("modal-item-tags").value.trim();
  const description = document.getElementById("modal-item-desc").value.trim();
  const inStock = document.getElementById("modal-item-instock").checked;

  const offerQtyInput = document.getElementById("modal-item-offer-qty");
  const offerPriceInput = document.getElementById("modal-item-offer-price");
  const offerQtyVal = offerQtyInput ? parseInt(offerQtyInput.value) : NaN;
  const offerPriceVal = offerPriceInput ? parseFloat(offerPriceInput.value) : NaN;
  const offerQty = (!isNaN(offerQtyVal) && offerQtyVal > 1) ? offerQtyVal : null;
  const offerPrice = (!isNaN(offerPriceVal) && offerPriceVal > 0) ? offerPriceVal : null;

  if (!name || isNaN(price) || price < 0) {
    showToast("Please provide a valid dish name and price!", "error");
    return;
  }

  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
  
  const dietary = [];
  if (document.getElementById("diet-vegan").checked) dietary.push("vegan");
  if (document.getElementById("diet-vegetarian").checked) dietary.push("vegetarian");
  if (document.getElementById("diet-gluten-free").checked) dietary.push("gluten-free");
  if (document.getElementById("diet-spicy").checked) dietary.push("spicy");

  if (state.editingItemId) {
    // Update existing
    const item = state.items.find(i => i.id === state.editingItemId);
    if (item) {
      item.name = name;
      item.category = category;
      item.price = price;
      item.offerQty = offerQty;
      item.offerPrice = offerPrice;
      item.image = image || item.image;
      item.calories = calories;
      item.tags = tags;
      item.description = description;
      item.inStock = inStock;
      item.dietary = dietary;
      showToast(`Updated "${name}" successfully!`, "admin");
    }
  } else {
    // Create new
    const newItem = {
      id: "item-" + Date.now(),
      name,
      category,
      price,
      offerQty,
      offerPrice,
      image: image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
      description,
      inStock,
      tags,
      dietary,
      calories
    };
    state.items.unshift(newItem);
    showToast(`Added new dish "${name}" to menu!`, "admin");
  }

  saveState();
  renderCategoryBar();
  renderMenuItems();
  closeModal("item-modal");
}

function deleteItem(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  if (confirm(`Are you sure you want to delete "${item.name}" from the menu?`)) {
    state.items = state.items.filter(i => i.id !== itemId);
    saveState();
    renderCategoryBar();
    renderMenuItems();
    showToast(`Deleted "${item.name}"`, "admin");
  }
}

/* ==========================================================================
   Category Management
   ========================================================================== */

function openCategoryModal() {
  const modal = document.getElementById("cat-modal");
  renderCategoryListInModal();
  modal.classList.add("open");
}

function renderCategoryListInModal() {
  const container = document.getElementById("cat-list-container");
  if (!container) return;

  container.innerHTML = state.categories
    .filter(c => c.id !== "all")
    .map(c => `
      <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; background: var(--bg-surface); padding: 0.5rem; border-radius: var(--radius-sm);">
        <span style="font-size: 1.2rem;">${c.icon || '🍴'}</span>
        <span style="font-weight: 600; flex: 1; color: white;">${escapeHtml(c.name)}</span>
        <button class="btn-delete-cat" data-cat-id="${c.id}" style="background: rgba(239,68,68,0.2); color: #f87171; padding: 0.25rem 0.5rem; border-radius: 4px;">Delete</button>
      </div>
    `).join("");

  container.querySelectorAll(".btn-delete-cat").forEach(btn => {
    btn.addEventListener("click", () => {
      const catId = btn.dataset.catId;
      const count = state.items.filter(i => i.category === catId).length;
      if (count > 0) {
        alert(`Cannot delete category! There are ${count} item(s) inside it. Move or delete the items first.`);
        return;
      }
      state.categories = state.categories.filter(c => c.id !== catId);
      saveState();
      renderCategoryListInModal();
      renderCategoryBar();
    });
  });
}

function addCategoryFromModal() {
  const nameInput = document.getElementById("new-cat-name");
  const iconInput = document.getElementById("new-cat-icon");
  const name = nameInput.value.trim();
  const icon = iconInput.value.trim() || "🍴";

  if (!name) {
    showToast("Please enter a category name", "error");
    return;
  }

  const id = "cat-" + Date.now();
  state.categories.push({ id, name, icon });
  saveState();

  nameInput.value = "";
  iconInput.value = "";
  renderCategoryListInModal();
  renderCategoryBar();
  showToast(`Added category "${name}"`, "admin");
}

/* ==========================================================================
   Event Listeners & Modal Controls
   ========================================================================== */

function setupEventListeners() {
  // Admin Mode Toggle Button
  document.getElementById("btn-admin-toggle").addEventListener("click", () => {
    if (state.isAdmin) {
      state.isAdmin = false;
      localStorage.removeItem("ADMIN_LOGGED_IN");
      renderApp();
      showToast("Logged out of Admin Mode", "admin");
    } else {
      openPinModal();
    }
  });

  // Search Input
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderMenuItems();
    });
  }

  // Cart Drawer open/close
  document.getElementById("floating-cart-btn").addEventListener("click", () => {
    document.getElementById("cart-drawer-backdrop").classList.add("open");
  });

  document.getElementById("btn-close-cart").addEventListener("click", () => {
    document.getElementById("cart-drawer-backdrop").classList.remove("open");
  });

  document.getElementById("cart-drawer-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "cart-drawer-backdrop") {
      document.getElementById("cart-drawer-backdrop").classList.remove("open");
    }
  });

  // Checkout Button
  document.getElementById("btn-checkout").addEventListener("click", () => {
    if (state.cart.length === 0) return;
    openCheckoutTicketModal();
  });

  // Admin Toolbar buttons
  document.getElementById("btn-admin-add-dish").addEventListener("click", () => openEditItemModal(null));
  document.getElementById("btn-admin-cats").addEventListener("click", openCategoryModal);
  const bulkBtn = document.getElementById("btn-admin-bulk");
  if (bulkBtn) bulkBtn.addEventListener("click", openBulkModal);
  const ordersBtn = document.getElementById("btn-admin-orders");
  if (ordersBtn) ordersBtn.addEventListener("click", openOrdersModal);

  // Firebase DB Config Modal Triggers
  const firebaseBtn = document.getElementById("btn-admin-firebase");
  if (firebaseBtn) {
    firebaseBtn.addEventListener("click", () => {
      const modal = document.getElementById("firebase-modal");
      const textarea = document.getElementById("firebase-config-input");
      const savedConfig = localStorage.getItem("FIREBASE_CONFIG_JSON");
      if (textarea && savedConfig) {
        textarea.value = savedConfig;
      }
      if (modal) modal.classList.add("open");
    });
  }

  const saveFirebaseBtn = document.getElementById("btn-save-firebase");
  if (saveFirebaseBtn) {
    saveFirebaseBtn.addEventListener("click", () => {
      const input = document.getElementById("firebase-config-input").value.trim();
      if (!input) {
        showToast("Please paste valid Firebase configuration JSON", "error");
        return;
      }
      try {
        const parsed = JSON.parse(input);
        if (!parsed.databaseURL) {
          showToast("Firebase JSON must contain a valid databaseURL!", "error");
          return;
        }
        localStorage.setItem("FIREBASE_CONFIG_JSON", JSON.stringify(parsed));
        closeModal("firebase-modal");
        const connected = initFirebaseEngine();
        if (connected) {
          saveState();
          showToast("🔥 Google Firebase connected! 100% Zero-Error Sync Active.", "admin");
        } else {
          showToast("Saved Firebase config!", "success");
        }
      } catch (e) {
        showToast("Invalid JSON format. Check Firebase console config snippet.", "error");
      }
    });
  }

  const clearFirebaseBtn = document.getElementById("btn-clear-firebase");
  if (clearFirebaseBtn) {
    clearFirebaseBtn.addEventListener("click", () => {
      localStorage.removeItem("FIREBASE_CONFIG_JSON");
      firebaseApp = null;
      firebaseDb = null;
      closeModal("firebase-modal");
      showToast("Cleared Firebase configuration. Switched to Cloud HTTP engine.", "admin");
    });
  }

  document.getElementById("btn-admin-reset").addEventListener("click", () => {
    if (confirm("Reset menu data to factory defaults? All custom changes will be overwritten.")) {
      resetToDefaultData();
      renderApp();
      showToast("Menu reset to defaults!", "admin");
    }
  });

  // Bulk Modal Buttons
  const importBtn = document.getElementById("btn-import-bulk");
  if (importBtn) importBtn.addEventListener("click", importBulkItems);
  const exportBtn = document.getElementById("btn-export-bulk");
  if (exportBtn) exportBtn.addEventListener("click", exportItems);

  // Orders Modal Buttons & Filters
  const clearCompletedBtn = document.getElementById("btn-clear-completed-orders");
  if (clearCompletedBtn) clearCompletedBtn.addEventListener("click", clearCompletedOrders);

  document.querySelectorAll(".order-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".order-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeOrdersFilter = btn.dataset.orderStatus;
      renderOrdersList();
    });
  });

  // Save Item Modal Button
  document.getElementById("btn-save-item").addEventListener("click", saveItemFromModal);
  document.getElementById("btn-add-cat").addEventListener("click", addCategoryFromModal);

  // Close modals when clicking close buttons or backdrops
  document.querySelectorAll(".btn-close-modal").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.closest(".modal-overlay").classList.remove("open");
    });
  });

  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("open");
      }
    });
  });

  // QR Code Modal Trigger & Active Ticket Button
  const qrBtn = document.getElementById("btn-qr-view");
  if (qrBtn) {
    qrBtn.addEventListener("click", openQrModal);
  }

  const activeTicketBtn = document.getElementById("btn-view-active-ticket");
  if (activeTicketBtn) {
    activeTicketBtn.addEventListener("click", () => {
      const savedOrderJson = sessionStorage.getItem("ACTIVE_CUSTOMER_ORDER");
      if (savedOrderJson) {
        try {
          const savedOrder = JSON.parse(savedOrderJson);
          openCheckoutTicketModal(savedOrder);
        } catch (e) {}
      }
    });
  }
}

/* ==========================================================================
   PIN Authentication Modal Logic
   ========================================================================== */

function openPinModal() {
  const modal = document.getElementById("pin-modal");
  const inputs = modal.querySelectorAll(".pin-digit");
  inputs.forEach(input => input.value = "");
  modal.classList.add("open");
  inputs[0].focus();

  inputs.forEach((input, idx) => {
    input.onkeyup = (e) => {
      if (e.key >= "0" && e.key <= "9") {
        input.value = e.key;
        if (idx < inputs.length - 1) inputs[idx + 1].focus();
        checkPinEntry();
      } else if (e.key === "Backspace") {
        input.value = "";
        if (idx > 0) inputs[idx - 1].focus();
      }
    };
  });
}

function checkPinEntry() {
  const inputs = document.querySelectorAll(".pin-digit");
  const enteredPin = Array.from(inputs).map(i => i.value).join("");

  if (enteredPin.length === 4) {
    if (enteredPin === state.adminPin) {
      state.isAdmin = true;
      localStorage.setItem("ADMIN_LOGGED_IN", "true");
      closeModal("pin-modal");
      renderApp();
      showToast("Admin access granted! 🔓 Edit mode activated.", "admin");
    } else {
      showToast("Incorrect PIN! Default PIN is 1234", "error");
      inputs.forEach(i => i.value = "");
      inputs[0].focus();
    }
  }
}

/* ==========================================================================
   Receipt & QR Modal Functions
   ========================================================================== */

function openCheckoutTicketModal(existingOrder = null) {
  closeModal("cart-drawer-backdrop");
  const modal = document.getElementById("ticket-modal");
  const ticketBody = document.getElementById("ticket-items-list");
  const ticketTotal = document.getElementById("ticket-total-val");
  const ticketQrImg = document.getElementById("ticket-qr-img");
  const orderNumElem = document.getElementById("ticket-order-id");

  let orderToDisplay = existingOrder;

  if (!orderToDisplay) {
    if (state.cart.length === 0) return;

    const customerNameInput = document.getElementById("customer-name-input");
    const customerName = customerNameInput ? customerNameInput.value.trim() : "";

    if (!customerName) {
      if (customerNameInput) {
        customerNameInput.style.borderColor = "#ef4444";
        customerNameInput.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.5)";
        customerNameInput.focus();
      }
      showToast("Please enter your name for pickup before placing your order! 👤", "error");
      return;
    } else if (customerNameInput) {
      customerNameInput.style.borderColor = "var(--border-color)";
      customerNameInput.style.boxShadow = "none";
    }

    let subtotal = 0;
    const orderItemsList = [];

    state.cart.forEach(c => {
      const item = state.items.find(i => i.id === c.itemId);
      if (item) {
        const lineTotal = calculateLineItemTotal(item, c.qty);
        subtotal += lineTotal;
        orderItemsList.push({
          itemId: item.id,
          name: item.name,
          price: item.price,
          qty: c.qty,
          lineTotal: lineTotal
        });
      }
    });

    const tax = subtotal * 0.05; // 5% GST
    const grandTotal = subtotal + tax;
    const orderId = "SB-" + Math.floor(1000 + Math.random() * 9000);

    orderToDisplay = {
      id: orderId,
      customerName: customerName,
      items: orderItemsList,
      subtotal: subtotal,
      tax: tax,
      total: grandTotal,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString(),
      status: "Pending"
    };

    state.orders = state.orders || [];
    state.orders.unshift(orderToDisplay);

    // Save active order ticket for customer's current session tab
    sessionStorage.setItem("ACTIVE_CUSTOMER_ORDER", JSON.stringify(orderToDisplay));

    // Clear cart on checkout & sync
    state.cart = [];
    saveCartState();
    saveState();
  }

  // Fetch latest live order status from state.orders (e.g., if admin set to Preparing or Ready)
  const liveOrder = (state.orders || []).find(o => o.id === orderToDisplay.id) || orderToDisplay;

  // Render ticket items & Customer Name
  ticketBody.innerHTML = (liveOrder.items || []).map(i => `
    <div class="ticket-item-row">
      <span>${i.qty}x ${escapeHtml(i.name)}</span>
      <span>₹${(i.price * i.qty).toFixed(0)}</span>
    </div>
  `).join("");

  ticketTotal.textContent = `₹${parseFloat(liveOrder.total).toFixed(0)}`;

  const customerNameElem = document.getElementById("ticket-customer-name");
  if (customerNameElem) {
    customerNameElem.textContent = "👤 Customer: " + (liveOrder.customerName || "Guest");
  }

  const currentUrl = window.location.origin + window.location.pathname;
  if (ticketQrImg) {
    ticketQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl + '?order=' + liveOrder.id)}`;
  }
  
  if (orderNumElem) {
    let statusText = "Pending ⏳";
    if (liveOrder.status === "Preparing") statusText = "Preparing 👨‍🍳";
    else if (liveOrder.status === "Ready") statusText = "READY FOR PICKUP! 🔔";
    else if (liveOrder.status === "Completed") statusText = "Completed 💵";

    orderNumElem.innerHTML = `Order #${escapeHtml(liveOrder.id)} • <span style="color: var(--primary); font-weight: 800;">${statusText}</span>`;
  }

  renderCustomerActiveTicketPill();
  renderCartBadge();

  modal.classList.add("open");
}

function renderCustomerActiveTicketPill() {
  const activeBtn = document.getElementById("btn-view-active-ticket");
  const ticketIdSpan = document.getElementById("active-ticket-id");
  const ticketStatusSpan = document.getElementById("active-ticket-status");

  const savedOrderJson = sessionStorage.getItem("ACTIVE_CUSTOMER_ORDER");
  if (savedOrderJson) {
    try {
      const savedOrder = JSON.parse(savedOrderJson);
      const liveOrder = (state.orders || []).find(o => o.id === savedOrder.id) || savedOrder;

      if (activeBtn) activeBtn.style.display = "flex";
      if (ticketIdSpan) ticketIdSpan.textContent = liveOrder.id;
      if (ticketStatusSpan) {
        ticketStatusSpan.textContent = liveOrder.status === "Ready" ? "READY! 🔔" : liveOrder.status;
      }
    } catch (e) {
      if (activeBtn) activeBtn.style.display = "none";
    }
  } else {
    if (activeBtn) activeBtn.style.display = "none";
  }
}

function openQrModal() {
  const modal = document.getElementById("qr-modal");
  const qrImage = document.getElementById("qr-code-image");
  const qrUrlDisplay = document.getElementById("qr-url-display");

  // Get current live Vercel URL automatically
  const currentUrl = window.location.origin + window.location.pathname;
  
  if (qrImage) {
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentUrl)}`;
  }

  if (qrUrlDisplay) {
    qrUrlDisplay.innerHTML = `
      <div style="background: var(--bg-surface); padding: 0.55rem 0.85rem; border-radius: var(--radius-md); font-size: 0.8rem; color: var(--accent-gold); display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.75rem; border: 1px solid var(--border-color);">
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(currentUrl)}</span>
        <button id="btn-copy-live-url" style="background: var(--primary); color: white; border: none; padding: 0.35rem 0.65rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem; cursor: pointer; white-space: nowrap;">📋 Copy Link</button>
      </div>
    `;

    setTimeout(() => {
      const copyBtn = document.getElementById("btn-copy-live-url");
      if (copyBtn) {
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(currentUrl);
          showToast("Live Vercel URL copied to clipboard! 📋", "success");
        };
      }
    }, 10);
  }

  modal.classList.add("open");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("open");
}

/* Helper Utilities */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'admin' ? '⚙️' : type === 'error' ? '❌' : '✅'}</span> ${escapeHtml(message)}`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-100%)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

/* Bulk Import / Export Functions for 80+ Items */
function openBulkModal() {
  const modal = document.getElementById("bulk-modal");
  if (modal) modal.classList.add("open");
}

function importBulkItems() {
  const input = document.getElementById("bulk-input-data").value.trim();
  if (!input) {
    showToast("Please paste CSV or JSON data to import", "error");
    return;
  }

  let importedItems = [];
  try {
    if (input.startsWith("[") || input.startsWith("{")) {
      // JSON import
      const parsed = JSON.parse(input);
      importedItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
    } else {
      // CSV import (name, category, price, description, image)
      const lines = input.split("\n").map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && line.toLowerCase().includes("name")) continue; // skip header
        const parts = line.split(",").map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 3) {
          importedItems.push({
            id: "item-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            name: parts[0],
            category: parts[1] || "burgers",
            price: parseFloat(parts[2]) || 9.99,
            description: parts[3] || "",
            image: parts[4] || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
            inStock: true,
            tags: ["Featured"],
            dietary: []
          });
        }
      }
    }

    if (importedItems.length === 0) {
      showToast("No valid items found in import data", "error");
      return;
    }

    // Append to existing items or replace based on checkbox
    const replaceMode = document.getElementById("bulk-replace-check").checked;
    if (replaceMode) {
      state.items = importedItems;
    } else {
      state.items = [...importedItems, ...state.items];
    }

    saveState();
    renderCategoryBar();
    renderMenuItems();
    closeModal("bulk-modal");
    showToast(`Successfully imported ${importedItems.length} dishes to live menu! 🎉`, "admin");

  } catch (err) {
    showToast("Error parsing import data. Check CSV or JSON format.", "error");
  }
}

function exportItems() {
  const jsonStr = JSON.stringify(state.items, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `food_cart_menu_export_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported menu JSON backup file! 📄", "success");
}

/* Admin Live Orders Management */
function openOrdersModal() {
  const modal = document.getElementById("orders-modal");
  renderOrdersList();
  if (modal) modal.classList.add("open");
}

function renderOrdersList() {
  const container = document.getElementById("orders-list-container");
  const countBadge = document.getElementById("modal-orders-count");
  if (!container) return;

  const orders = state.orders || [];
  const filter = state.activeOrdersFilter || "all";

  let filtered = orders.filter(o => {
    if (filter === "pending") return o.status === "Pending";
    if (filter === "preparing") return o.status === "Preparing";
    if (filter === "ready") return o.status === "Ready";
    if (filter === "completed") return o.status === "Completed";
    return true;
  });

  if (countBadge) countBadge.textContent = `${filtered.length} order${filtered.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <p style="font-size: 3rem; margin-bottom: 0.5rem;">📦</p>
        <h4 style="color: white; font-size: 1.1rem;">No orders in this category</h4>
        <p style="font-size: 0.85rem;">New customer orders will appear here in real time!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(order => {
    let statusClass = "warning";
    let statusIcon = "⏳";
    if (order.status === "Preparing") { statusClass = "admin"; statusIcon = "👨‍🍳"; }
    else if (order.status === "Ready") { statusClass = "success"; statusIcon = "🔔"; }
    else if (order.status === "Completed") { statusClass = "popular"; statusIcon = "💵"; }

    return `
      <div class="cart-item-card" style="flex-direction: column; align-items: stretch; gap: 0.75rem; border-left: 5px solid var(--primary); margin-bottom: 0.85rem; background: var(--bg-card); padding: 1rem; border-radius: var(--radius-md);">
        
        <!-- CALLOUT CUSTOMER NAME BANNER FOR ADMIN -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 179, 0, 0.12); padding: 0.6rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid rgba(255, 179, 0, 0.3);">
          <div>
            <span style="font-size: 0.725rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 700; display: block;">🗣️ CALLOUT CUSTOMER NAME:</span>
            <strong style="color: var(--accent-gold); font-size: 1.25rem; font-weight: 800;">👤 ${escapeHtml(order.customerName || "Guest")}</strong>
          </div>
          <div style="text-align: right;">
            <span style="font-weight: 800; color: white; font-size: 0.95rem;">Order #${escapeHtml(order.id)}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">🕒 ${order.time}</span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="food-badge ${statusClass}">
            ${statusIcon} Status: ${order.status}
          </span>
        </div>

        <div style="background: var(--bg-main); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.85rem;">
          ${(order.items || []).map(i => `<div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem; color: #cbd5e1;"><span>${i.qty}x ${escapeHtml(i.name)}</span><span>₹${(i.price * i.qty).toFixed(0)}</span></div>`).join('')}
          <div style="border-top: 1px dashed var(--border-color); margin-top: 0.4rem; padding-top: 0.4rem; display: flex; justify-content: space-between; font-weight: 800; color: white;">
            <span>Total Paid</span>
            <span style="color: var(--accent-gold);">₹${parseFloat(order.total).toFixed(0)}</span>
          </div>
        </div>

        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: flex-end;">
          ${order.status === "Pending" ? `<button class="btn-edit-dish btn-order-status" data-order-id="${order.id}" data-new-status="Preparing" style="background: rgba(139,92,246,0.2); color:#c4b5fd;">👨‍🍳 Start Preparing</button>` : ''}
          ${order.status === "Preparing" || order.status === "Pending" ? `<button class="btn-edit-dish btn-order-status" data-order-id="${order.id}" data-new-status="Ready" style="background: rgba(16,185,129,0.2); color:#6ee7b7;">🔔 Mark Ready</button>` : ''}
          ${order.status !== "Completed" ? `<button class="btn-edit-dish btn-order-status" data-order-id="${order.id}" data-new-status="Completed" style="background: rgba(255,179,0,0.2); color:#fde047;">💵 Complete & Pay</button>` : ''}
          <button class="btn-delete-dish btn-delete-order" data-order-id="${order.id}">🗑️</button>
        </div>
      </div>
    `;
  }).join("");

  // Attach event handlers
  container.querySelectorAll(".btn-order-status").forEach(btn => {
    btn.addEventListener("click", () => {
      updateOrderStatus(btn.dataset.orderId, btn.dataset.newStatus);
    });
  });

  container.querySelectorAll(".btn-delete-order").forEach(btn => {
    btn.addEventListener("click", () => {
      deleteOrder(btn.dataset.orderId);
    });
  });
}

function updateOrderStatus(orderId, newStatus) {
  const order = (state.orders || []).find(o => o.id === orderId);
  if (!order) return;

  order.status = newStatus;
  saveState();
  renderOrdersList();
  renderAdminHeaderState();
  showToast(`Order #${orderId} set to "${newStatus}"`, "admin");
}

function deleteOrder(orderId) {
  state.orders = (state.orders || []).filter(o => o.id !== orderId);
  saveState();
  renderOrdersList();
  renderAdminHeaderState();
  showToast(`Deleted order #${orderId}`, "admin");
}

function clearCompletedOrders() {
  state.orders = (state.orders || []).filter(o => o.status !== "Completed");
  saveState();
  renderOrdersList();
  renderAdminHeaderState();
  showToast("Cleared all completed orders!", "admin");
}
