/* ============================================================
   DISHDASH — Sample data layer
   ------------------------------------------------------------
   Pure data. Swap this file (or back it with Supabase later)
   without touching any page code: the store (store.js) is the
   only module that reads and writes application state.
   ============================================================ */
'use strict';

window.DD_DATA = (function () {
  // --- helpers -------------------------------------------------
  function img(id, w) {
    // Item 8: real uploads arrive as data: URLs and links as http(s) — pass
    // them straight through; bare ids stay Unsplash photo references.
    if (!id) return '';
    if (id.slice(0, 5) === 'data:' || id.slice(0, 4) === 'http' || id.indexOf('/') !== -1) return id;
    return 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=' + (w || 800) + '&q=72';
  }
  function naira(n) {
    return '₦' + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 });
  }

  // --- categories ----------------------------------------------
  const CATEGORIES = [
    { id: 'burgers',  name: 'Burgers',  emoji: '🍔', img: 'photo-1568901346375-23c9450c58cd' },
    { id: 'pizza',    name: 'Pizza',    emoji: '🍕', img: 'photo-1513104890138-7c749659a591' },
    { id: 'chicken',  name: 'Chicken',  emoji: '🍗', img: 'photo-1562967914-608f82629710' },
    { id: 'rice',     name: 'Rice',     emoji: '🍛', img: 'photo-1512058564366-18510be2db19' },
    { id: 'pasta',    name: 'Pasta',    emoji: '🍝', img: 'photo-1621996346565-e3dbc646d9a9' },
    { id: 'snacks',   name: 'Snacks',   emoji: '🍟', img: 'photo-1573080496219-bb080dd4f877' },
    { id: 'desserts', name: 'Desserts', emoji: '🍰', img: 'photo-1578985545062-69928b1d9587' },
    { id: 'drinks',   name: 'Drinks',   emoji: '🥤', img: 'photo-1554866585-cd94860890b7' }
  ];

  // --- foods ----------------------------------------------------
  // tag: Bestseller | New | Spicy | Local favourite (optional)
  const FOODS = [
    { id: 1,  cat: 'burgers',  name: 'Classic Beef Burger',            price: 5500,  oldPrice: null, rating: 4.9, reviews: 1240, prep: 22, tag: 'Bestseller', popular: true,  inStock: true,  img: 'photo-1568901346375-23c9450c58cd',
      desc: 'Juicy 100% beef patty, melted cheddar, crisp lettuce and our secret house sauce in a toasted brioche bun. Served with golden fries.' },
    { id: 2,  cat: 'burgers',  name: 'Crispy Chicken Burger',          price: 5900,  oldPrice: null, rating: 4.7, reviews: 860,  prep: 24, tag: null,        popular: true,  inStock: true,  img: 'photo-1607013251379-e6eecfffe234',
      desc: 'Buttermilk-brined crunchy chicken fillet, cool coleslaw and smoky mayo stacked in a soft sesame bun. A crowd favourite.' },
    { id: 3,  cat: 'burgers',  name: 'Double Smash BBQ Burger',        price: 7200,  oldPrice: 8000, rating: 4.8, reviews: 540,  prep: 26, tag: 'New',       popular: false, inStock: true,  img: 'photo-1550547660-d9450f859349',
      desc: 'Two smashed beef patties caramelised with barbecue glaze, crispy onions and double cheddar. For serious appetites.' },
    { id: 4,  cat: 'pizza',    name: 'Margherita Pizza',               price: 7500,  oldPrice: null, rating: 4.8, reviews: 980,  prep: 30, tag: null,        popular: true,  inStock: true,  img: 'photo-1513104890138-7c749659a591',
      desc: 'Wood-fired base brushed with rich tomato sauce, fresh mozzarella and basil, finished with a drizzle of olive oil.' },
    { id: 5,  cat: 'pizza',    name: 'Pepperoni Pizza',                price: 9500,  oldPrice: null, rating: 4.9, reviews: 1510, prep: 32, tag: 'Bestseller', popular: true,  inStock: true,  img: 'photo-1565299624946-b28f40a0ae38',
      desc: 'Generously loaded with spicy pepperoni and bubbling mozzarella over our signature slow-cooked tomato base.' },
    { id: 6,  cat: 'pizza',    name: 'BBQ Chicken Pizza',              price: 11000, oldPrice: null, rating: 4.6, reviews: 320,  prep: 34, tag: null,        popular: false, inStock: false, img: 'photo-1574071318508-1cdbab80d002',
      desc: 'Smoky BBQ sauce, grilled chicken strips, red onions and sweet corn crowned with a three-cheese blend.' },
    { id: 7,  cat: 'chicken',  name: 'Chicken Wings (6 pcs)',          price: 5200,  oldPrice: null, rating: 4.8, reviews: 690,  prep: 25, tag: 'Spicy',     popular: true,  inStock: true,  img: 'photo-1608039755401-742074f0548d',
      desc: 'Sticky-glazed wings tossed in your choice of sweet chilli, honey garlic or peri-peri heat. Comes with ranch dip.' },
    { id: 8,  cat: 'chicken',  name: 'Grilled Half Chicken',           price: 6900,  oldPrice: null, rating: 4.5, reviews: 410,  prep: 35, tag: null,        popular: false, inStock: true,  img: 'photo-1598103442097-8b74394b95c6',
      desc: 'Half chicken flame-grilled and basted in native spices, served with grilled vegetables and a side of yaji.' },
    { id: 9,  cat: 'chicken',  name: 'Fried Chicken & Chips',          price: 5800,  oldPrice: null, rating: 4.7, reviews: 880,  prep: 28, tag: 'Local favourite', popular: true, inStock: true,  img: 'photo-1562967914-608f82629710',
      desc: 'Four pieces of golden crispy fried chicken with seasoned fries. Weeknight comfort, done right.' },
    { id: 10, cat: 'rice',     name: 'Jollof Rice & Chicken',          price: 4800,  oldPrice: null, rating: 4.9, reviews: 2100, prep: 25, tag: 'Bestseller', popular: true,  inStock: true,  img: 'photo-1604329760661-e71dc83f8f26',
      desc: 'Party-style smoky jollof rice cooked in rich tomato-pepper sauce, served with grilled chicken and plantain.' },
    { id: 11, cat: 'rice',     name: 'Fried Rice & Grilled Chicken',   price: 5200,  oldPrice: null, rating: 4.7, reviews: 940,  prep: 26, tag: 'Local favourite', popular: true, inStock: true,  img: 'photo-1603133872878-684f208fb84b',
      desc: 'Wok-tossed fried rice with mixed vegetables and fluffy egg, paired with juicy grilled chicken.' },
    { id: 12, cat: 'rice',     name: 'Coconut Rice & Peppered Beef',   price: 5600,  oldPrice: null, rating: 4.6, reviews: 380,  prep: 30, tag: 'New',       popular: false, inStock: true,  img: 'photo-1512058564366-18510be2db19',
      desc: 'Fragrant coconut rice simmered in mild spices, topped with tender peppered beef and fried plantain.' },
    { id: 13, cat: 'pasta',    name: 'Spaghetti Bolognese',            price: 5900,  oldPrice: null, rating: 4.8, reviews: 760,  prep: 27, tag: null,        popular: true,  inStock: true,  img: 'photo-1621996346565-e3dbc646d9a9',
      desc: 'Al dente spaghetti folded into a slow-simmered beef ragù with garlic bread on the side. Proper comfort.' },
    { id: 14, cat: 'pasta',    name: 'Creamy Alfredo Pasta',           price: 6500,  oldPrice: null, rating: 4.7, reviews: 450,  prep: 28, tag: null,        popular: false, inStock: true,  img: 'photo-1645112411341-6c4fd023714a',
      desc: 'Fettuccine tossed in a silky parmesan cream sauce with grilled chicken and a hint of nutmeg.' },
    { id: 15, cat: 'snacks',   name: 'French Fries',                   price: 2500,  oldPrice: null, rating: 4.8, reviews: 1330, prep: 15, tag: null,        popular: true,  inStock: true,  img: 'photo-1573080496219-bb080dd4f877',
      desc: 'Double-cooked, crispy on the outside and fluffy inside. Served hot with ketchup and our smoky dip.' },
    { id: 16, cat: 'snacks',   name: 'Meat Pie',                       price: 1500,  oldPrice: null, rating: 4.6, reviews: 1120, prep: 12, tag: null,        popular: true,  inStock: true,  img: 'photo-1601050690597-df0568f70950',
      desc: 'Golden, buttery pastry packed with savoury minced beef, potato and carrot. Baked fresh all day.' },
    { id: 17, cat: 'snacks',   name: 'Beef Shawarma Wrap',             price: 4500,  oldPrice: null, rating: 4.9, reviews: 870,  prep: 16, tag: 'Bestseller', popular: true,  inStock: true,  img: 'photo-1561651823-34feb02250e4',
      desc: 'Sliced beef shawarma with creamy garlic sauce, fresh vegetables and a squeeze of lemon, wrapped in soft flatbread.' },
    { id: 18, cat: 'snacks',   name: 'Suya Skewers',                   price: 4000,  oldPrice: null, rating: 4.8, reviews: 520,  prep: 18, tag: 'Spicy',     popular: false, inStock: true,  img: 'photo-1529193591184-b1d58069ecdd',
      desc: 'Beef suya coated in fiery yaji spice, charred over open flame and served with sliced onions and tomatoes.' },
    { id: 19, cat: 'desserts', name: 'Chocolate Lava Cake',            price: 4500,  oldPrice: null, rating: 4.9, reviews: 610,  prep: 20, tag: 'Bestseller', popular: true,  inStock: true,  img: 'photo-1578985545062-69928b1d9587',
      desc: 'Warm chocolate cake with a molten centre that flows when you cut in. Vanilla ice cream on the side.' },
    { id: 20, cat: 'desserts', name: 'Vanilla Ice Cream Tub',          price: 3500,  oldPrice: null, rating: 4.6, reviews: 290,  prep: 8,  tag: null,        popular: false, inStock: true,  img: 'photo-1563805042-7684c019e1cb',
      desc: 'Creamy Madagascan vanilla gelato, hand-churned and served chilled. Add a brownie for extra joy.' },
    { id: 21, cat: 'desserts', name: 'Red Velvet Cupcake',             price: 2800,  oldPrice: null, rating: 4.5, reviews: 180,  prep: 10, tag: 'New',       popular: false, inStock: true,  img: 'photo-1563729784474-d77dbb933a9e',
      desc: 'Soft red velvet cake with cream-cheese frosting and a dusting of cocoa. One is never quite enough.' },
    { id: 22, cat: 'drinks',   name: 'Chilled Soft Drink',             price: 800,   oldPrice: null, rating: 4.5, reviews: 1450, prep: 2,  tag: null,        popular: true,  inStock: true,  img: 'photo-1554866585-cd94860890b7',
      desc: 'Ice-cold Coca-Cola, Fanta or Sprite — your pick of the classic. The perfect sidekick to any meal.' },
    { id: 23, cat: 'drinks',   name: 'Chapman Cocktail',               price: 2000,  oldPrice: null, rating: 4.7, reviews: 640,  prep: 6,  tag: null,        popular: true,  inStock: true,  img: 'photo-1553530666-ba11a7da3888',
      desc: 'The Nigerian classic — a fruity blend of bitters, grenadine and citrus over ice with cucumber and lemon.' },
    { id: 24, cat: 'drinks',   name: 'Fresh Orange Juice',             price: 2500,  oldPrice: null, rating: 4.8, reviews: 350,  prep: 6,  tag: null,        popular: false, inStock: true,  img: 'photo-1600271886742-f049cd451bba',
      desc: 'Squeezed to order from sweet Nigerian oranges. No sugar, no preservatives — just sunshine in a cup.' },
    { id: 25, cat: 'drinks',   name: 'Zobo Cooler',                    price: 1500,  oldPrice: null, rating: 4.6, reviews: 270,  prep: 5,  tag: 'New',       popular: false, inStock: true,  img: 'photo-1546171753-97d7676e4602',
      desc: 'Tangy hibiscus drink brewed with ginger and pineapple, served ice cold. Heritage refreshment.' }
  ];

  // curated gallery presets used by the admin "add / edit food" image picker
  const GALLERY = [
    { img: 'photo-1568901346375-23c9450c58cd', e: '🍔' }, { img: 'photo-1550547660-d9450f859349', e: '🍔' },
    { img: 'photo-1513104890138-7c749659a591', e: '🍕' }, { img: 'photo-1565299624946-b28f40a0ae38', e: '🍕' },
    { img: 'photo-1574071318508-1cdbab80d002', e: '🍕' }, { img: 'photo-1562967914-608f82629710', e: '🍗' },
    { img: 'photo-1608039755401-742074f0548d', e: '🍗' }, { img: 'photo-1604329760661-e71dc83f8f26', e: '🍛' },
    { img: 'photo-1603133872878-684f208fb84b', e: '🍚' }, { img: 'photo-1512058564366-18510be2db19', e: '🍛' },
    { img: 'photo-1621996346565-e3dbc646d9a9', e: '🍝' }, { img: 'photo-1645112411341-6c4fd023714a', e: '🍝' },
    { img: 'photo-1573080496219-bb080dd4f877', e: '🍟' }, { img: 'photo-1601050690597-df0568f70950', e: '🥧' },
    { img: 'photo-1561651823-34feb02250e4', e: '🌯' }, { img: 'photo-1529193591184-b1d58069ecdd', e: '🍢' },
    { img: 'photo-1578985545062-69928b1d9587', e: '🍰' }, { img: 'photo-1563805042-7684c019e1cb', e: '🍦' },
    { img: 'photo-1554866585-cd94860890b7', e: '🥤' }, { img: 'photo-1553530666-ba11a7da3888', e: '🍹' }
  ];

  // --- seed users -------------------------------------------------
  // Demo credentials: demo@dishdash.ng / demo1234  ·  admin@dishdash.ng / admin123
  const SEED_USERS = [
    { id: 'u-admin',  name: 'DishDash Admin', email: 'admin@dishdash.ng',  phone: '+234 800 000 0000', password: 'admin123', role: 'admin', createdAt: '2026-01-10T09:00:00', delivery: { name: 'DishDash Admin', phone: '+234 800 000 0000', address: '14 Admiralty Way, Lekki Phase 1', city: 'Lagos', note: '' } },
    { id: 'u-demo',   name: 'Ayo Balogun',    email: 'demo@dishdash.ng',  phone: '+234 803 412 7788', password: 'demo1234', role: 'customer', createdAt: '2026-02-14T12:30:00', delivery: { name: 'Ayo Balogun', phone: '+234 803 412 7788', address: 'Plot 7B, Adeola Odeku Street, Victoria Island', city: 'Lagos', note: 'Ring the doorbell twice, please.' } },
    { id: 'u-chioma', name: 'Chioma Eze',     email: 'chioma@example.com', phone: '+234 805 990 1234', password: 'demo1234', role: 'customer', createdAt: '2026-03-02T16:10:00', delivery: { name: 'Chioma Eze', phone: '+234 805 990 1234', address: '25B Admiralty Way, Lekki Phase 1', city: 'Lagos', note: '' } },
    { id: 'u-temi',   name: 'Temi Adeyemi',   email: 'temi@example.com',  phone: '+234 809 221 4455', password: 'demo1234', role: 'customer', createdAt: '2026-04-18T10:05:00', delivery: { name: 'Temi Adeyemi', phone: '+234 809 221 4455', address: '7 Kodesho Street, Ikeja GRA', city: 'Lagos', note: 'Call on arrival — gate code 2214.' } },
    { id: 'u-musa',   name: 'Musa Ibrahim',   email: 'musa@example.com',  phone: '+234 807 664 8899', password: 'demo1234', role: 'customer', createdAt: '2026-05-11T14:40:00', delivery: { name: 'Musa Ibrahim', phone: '+234 807 664 8899', address: '12 Bode Thomas Street, Surulere', city: 'Lagos', note: '' } },
    { id: 'u-funmi',  name: 'Funmi Alabi',    email: 'funmi@example.com', phone: '+234 813 008 2211', password: 'demo1234', role: 'customer', createdAt: '2026-06-08T09:20:00', delivery: { name: 'Funmi Alabi', phone: '+234 813 008 2211', address: '3 Herbert Macaulay Way, Yaba', city: 'Lagos', note: 'Leave at the security post if I am not down.' } }
  ];

  // The demo accounts and seeded customers predate email verification, so mark
  // them confirmed. This mirrors what supabase/verification-schema.sql does to
  // the same accounts in cloud mode — nobody who could already order loses the
  // ability to, which keeps the demo account usable during a presentation.
  SEED_USERS.forEach(function (u) { u.emailVerifiedAt = u.createdAt || '2026-01-01T00:00:00'; });

  // --- seed orders -------------------------------------------------
  // generated relative to real "now" so the dashboard's 7-day chart always
  // covers the last seven days, no matter how old the checkout is
  const NOW = Date.now();
  function at(hoursAgo, minutesAgo) { return new Date(NOW - hoursAgo * 3600000 - (minutesAgo || 0) * 60000).toISOString(); }
  function seedStatus(order, statuses) {
    // statuses: [ [statusKey, hoursAgo], ... ] ascending time
    return statuses.map(function (s, i) {
      const prev = i ? statuses[i - 1][1] : 0;
      return { status: s[0], at: at(prev, s[1]) };
    });
  }
  const ALL_STATUSES = ['pending', 'confirmed', 'preparing', 'outfordelivery', 'delivered'];

  function O(id, userId, items, placedAtIso, laterStatuses, pay, payStatus) {
    const lines = items.map(function (it) {
      return { dishId: it[0], name: it[1], price: it[2], qty: it[3], img: it[4] };
    });
    const sub = lines.reduce(function (s, l) { return s + l.price * l.qty; }, 0);
    const fee = sub >= 20000 ? 0 : 1200;
    const user = SEED_USERS.find(function (u) { return u.id === userId; });
    // history always opens with the pending event at placement time
    const statusHistory = [{ status: 'pending', at: placedAtIso }].concat(
      (laterStatuses || []).filter(function (s) { return s.status !== 'pending'; })
    ).sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
    const status = statusHistory[statusHistory.length - 1].status;
    return {
      id: id, userId: userId,
      customer: { name: user.name, phone: user.delivery.phone, address: user.delivery.address, city: user.delivery.city, note: user.delivery.note },
      items: lines, sub: sub, deliveryFee: fee, discount: 0, total: sub + fee,
      pay: pay || 'cod', payStatus: payStatus || (pay === 'card' ? 'paid' : 'pending'),
      status: status,
      statusHistory: statusHistory,
      placedAt: placedAtIso,
      etaMin: 40,
      source: 'seed'
    };
  }
  const d = { i: 'photo-1568901346375-23c9450c58cd', j: 'photo-1604329760661-e71dc83f8f26', p: 'photo-1513104890138-7c749659a591', w: 'photo-1608039755401-742074f0548d', c: 'photo-1562967914-608f82629710', f: 'photo-1573080496219-bb080dd4f877', s: 'photo-1561651823-34feb02250e4', l: 'photo-1578985545062-69928b1d9587', x: 'photo-1554866585-cd94860890b7' };

  const SEED_ORDERS = [
    O('DD-1009', 'u-demo',   [[10, 'Jollof Rice & Chicken', 4800, 2, d.j], [22, 'Chilled Soft Drink', 800, 2, d.x]],            at(0, 40), [], 'card', 'paid'),
    O('DD-1008', 'u-chioma', [[5, 'Pepperoni Pizza', 9500, 1, d.p], [15, 'French Fries', 2500, 1, d.f]],                       at(26), [{ status: 'confirmed', at: at(25, 20) }, { status: 'preparing', at: at(24, 5) }], 'card', 'paid'),
    O('DD-1007', 'u-funmi',  [[7, 'Chicken Wings (6 pcs)', 5200, 1, d.w], [18, 'Suya Skewers', 4000, 1, 'photo-1529193591184-b1d58069ecdd'], [23, 'Chapman Cocktail', 2000, 1, 'photo-1553530666-ba11a7da3888']], at(50), [{ status: 'confirmed', at: at(49, 10) }, { status: 'preparing', at: at(47, 30) }, { status: 'outfordelivery', at: at(0, 45) }], 'bank_transfer', 'awaiting_verification'),
    O('DD-1006', 'u-musa',   [[9, 'Fried Chicken & Chips', 5800, 2, d.c]],                                                   at(73, 20), [{ status: 'confirmed', at: at(72) }, { status: 'preparing', at: at(70, 40) }, { status: 'outfordelivery', at: at(1, 50) }, { status: 'delivered', at: at(0, 50) }], 'cod', 'pending'),
    O('DD-1005', 'u-temi',   [[1, 'Classic Beef Burger', 5500, 1, d.i], [15, 'French Fries', 2500, 1, d.f], [22, 'Chilled Soft Drink', 800, 1, d.x]], at(97, 40), [{ status: 'confirmed', at: at(96, 30) }, { status: 'preparing', at: at(95) }, { status: 'outfordelivery', at: at(1, 10) }, { status: 'delivered', at: at(0, 10) }], 'card', 'paid'),
    O('DD-1004', 'u-demo',   [[13, 'Spaghetti Bolognese', 5900, 1, 'photo-1621996346565-e3dbc646d9a9'], [19, 'Chocolate Lava Cake', 4500, 1, d.l]], at(146), [{ status: 'confirmed', at: at(145) }, { status: 'preparing', at: at(143) }, { status: 'outfordelivery', at: at(2) }, { status: 'delivered', at: at(0, 40) }], 'card', 'paid'),
    O('DD-1003', 'u-chioma', [[11, 'Fried Rice & Grilled Chicken', 5200, 1, 'photo-1603133872878-684f208fb84b'], [17, 'Beef Shawarma Wrap', 4500, 1, d.s]], at(170), [{ status: 'confirmed', at: at(169) }, { status: 'preparing', at: at(166) }, { status: 'outfordelivery', at: at(3) }, { status: 'delivered', at: at(1) }], 'cod', 'pending'),
    O('DD-1002', 'u-funmi',  [[4, 'Margherita Pizza', 7500, 2, d.p], [20, 'Vanilla Ice Cream Tub', 3500, 1, 'photo-1563805042-7684c019e1cb']], at(242), [{ status: 'confirmed', at: at(240) }, { status: 'preparing', at: at(238) }, { status: 'outfordelivery', at: at(5) }, { status: 'delivered', at: at(3) }], 'bank_transfer', 'paid'),
    O('DD-1001', 'u-musa',   [[1, 'Classic Beef Burger', 5500, 2, d.i], [15, 'French Fries', 2500, 2, d.f]],                    at(290), [{ status: 'confirmed', at: at(288) }, { status: 'preparing', at: at(286) }, { status: 'outfordelivery', at: at(6) }, { status: 'delivered', at: at(4) }], 'cod', 'pending')
  ];

  // status flow (single source of truth for order lifecycle)
  const STATUS_FLOW = [
    { key: 'pending',        label: 'Pending',        desc: 'We received your order and are confirming it.' },
    { key: 'confirmed',      label: 'Confirmed',      desc: 'Your order is confirmed and queued for the kitchen.' },
    { key: 'preparing',      label: 'Preparing',      desc: 'The kitchen is cooking your meal fresh.' },
    { key: 'outfordelivery', label: 'Out for Delivery', desc: 'A rider is on the way with your order.' },
    { key: 'delivered',      label: 'Delivered',      desc: 'Delivered — enjoy your meal!' }
  ];

  /* `cancelled` is deliberately NOT a member of STATUS_FLOW. The flow above is
     the happy path: the tracking timeline renders one step per entry, the
     admin "Next ▸" action walks it, and nextStatus() reads its length. Hanging
     cancelled off the end would make "delivered → cancelled" a legal advance.
     Cancellation is an off-flow terminal state, so it lives here and every
     lookup goes through statusMeta(). */
  const CANCELLED = { key: 'cancelled', label: 'Cancelled', desc: 'This order was cancelled.' };

  function statusMeta(key) {
    return STATUS_FLOW.find(function (s) { return s.key === key; }) || (key === 'cancelled' ? CANCELLED : null);
  }

  // payment methods (simulation only — no real gateway)
  const PAY_METHODS = [
    { key: 'card',         label: 'Card payment',    sub: 'Visa · Mastercard · Verve (demo — no card needed)',   emoji: '💳' },
    { key: 'cod',          label: 'Cash on delivery', sub: 'Pay the rider when your food arrives',               emoji: '💵' },
    { key: 'bank_transfer', label: 'Bank transfer',  sub: 'Transfer to our demo account (simulated)',           emoji: '🏦' }
  ];

  // payment status badges — kept separate from order status on purpose.
  // 'refunded' is DERIVED (see UI.payStatusOf): it is not stored on the order,
  // it is read from the order's refund record, so refunded money can never
  // linger in a revenue figure by accident.
  const PAY_STATUS = {
    paid:                 { label: 'Paid',                  cls: 'st-delivered' },
    pending:              { label: 'Pending',               cls: 'st-pending'   },
    awaiting_verification: { label: 'Awaiting Verification', cls: 'st-preparing' },
    refunded:             { label: 'Refunded',              cls: 'st-cancelled' }
  };

  /* refunds — a customer asks, an admin decides (full amount only).
     The record lives in its own table/list keyed by order id (one request per
     order, and a decision is final), and the store decorates every order it
     hands out with `order.refund` so pages never have to join anything. */
  const REFUND_STATUS = {
    requested: { key: 'requested', label: 'Refund requested', cls: 'rf-requested', desc: 'Waiting for DishDash to review it.' },
    approved:  { key: 'approved',  label: 'Refunded',         cls: 'rf-approved',  desc: 'The money has been returned.' },
    rejected:  { key: 'rejected',  label: 'Refund declined',  cls: 'rf-rejected',  desc: 'DishDash reviewed it and said no.' }
  };
  function refundMeta(key) { return REFUND_STATUS[key] || null; }

  // clearly fictional demo bank details for the simulated transfer flow
  const DEMO_BANK = {
    bank: 'Demo Trust Bank',
    accountName: 'DishDash Foods (Demo) Ltd.',
    accountNumber: '00 1234 5678',
    note: 'This is a simulated academic payment flow — NOT a real bank account.'
  };

  // Nigerian banks with their CBN nip codes (used for NUBAN name-enquiry in the
  // bank-transfer flow). Real code list, shortened to the everyday banks —
  // see store.js resolveBankAccount for how it is consumed.
  const NG_BANKS = [
    { code: '044',  name: 'Access Bank' },
    { code: '023',  name: 'Citibank Nigeria' },
    { code: '050',  name: 'Ecobank Nigeria' },
    { code: '011',  name: 'First Bank of Nigeria' },
    { code: '214',  name: 'First City Monument Bank (FCMB)' },
    { code: '070',  name: 'Fidelity Bank' },
    { code: '058',  name: 'Guaranty Trust Bank (GTBank)' }, // NIP codes double as NUBAN check-digit prefixes for 3-digit banks
    { code: '030',  name: 'Heritage Bank' },
    { code: '082',  name: 'Keystone Bank' },
    { code: '076',  name: 'Polaris Bank' },
    { code: '101',  name: 'Providus Bank' },
    { code: '221',  name: 'Stanbic IBTC Bank' },
    { code: '032',  name: 'Union Bank of Nigeria' },
    { code: '033',  name: 'United Bank for Africa (UBA)' },
    { code: '057',  name: 'Zenith Bank' },
    { code: '215',  name: 'Unity Bank' },
    { code: '035',  name: 'Wema Bank' },
    { code: '232',  name: 'Sterling Bank' },
    { code: '301',  name: 'Jaiz Bank' },
    { code: '999',  name: 'OPay' },
    { code: '100',  name: 'PalmPay' },
    { code: '50515', name: 'Moniepoint MFB' },  // wallet providers use 5-digit NIP codes
    { code: '50211', name: 'Kuda MFB' }
  ];

  const CONFIG = {
    appName: 'DishDash',
    tagline: 'Good food. Fast delivery.',
    deliveryFee: 1200,
    freeDeliveryMin: 20000,
    avgDeliveryMin: 35,
    supportPhone: '+234 700 000 4747',
    supportEmail: 'hello@dishdash.ng'
  };

  /* promo codes (demo coupons — validation + discount math lives in store.js)

     THE RULE, AND IT IS GLOBAL: every promo code is single-use per account,
     today and for any code added later. That policy lives here in
     PROMO_POLICY instead of as a flag on each code, so a new code is
     one-time automatically and nobody has to remember to set anything —
     the "forgot the flag" bug cannot happen. Store this as a per-account
     redemption (see store.js redeemPromo) so it holds across reloads and,
     in cloud mode, across browsers.

     firstOrderOnly → an ADDITIONAL restriction: usable only before the
     account has a standing order (DISHWELCOME).
     Redeeming a code spends it; cancelling the order that used it releases it
     again, so a customer never loses a code to an order that never happened. */
  const PROMO_POLICY = { oncePerAccount: true };

  const PROMOS = {
    DISHWELCOME: {
      label: 'Welcome offer', type: 'flat', value: 1500, minSub: 0,
      desc: '₦1,500 off any order',
      firstOrderOnly: true, welcome: true
    },
    FAST10: {
      label: 'Fast 10', type: 'percent', value: 10, minSub: 5000,
      desc: '10% off orders over ₦5,000'
    }
  };

  /* The ONE implementation of the promo rules, called by BOTH stores (local
     and cloud) so a code can never behave differently depending on backend.
     The caller supplies the two environment-specific predicates:
       isUsed(code) → has this account already redeemed that code?
       hasOrders()  → does this account have an order that still stands?
     Predictates only — all messaging and money math lives here, once. */
  function checkPromo(code, sub, isUsed, hasOrders) {
    const key = String(code || '').trim().toUpperCase();
    if (!key) return { ok: false, error: 'Enter a promo code to apply it.' };
    const promo = PROMOS[key];
    if (!promo) return { ok: false, error: 'That promo code isn\u2019t valid. Double-check and try again.' };
    if (PROMO_POLICY.oncePerAccount && isUsed && isUsed(key)) {
      return { ok: false, used: true, error: key + ' is a one-time code, and this account has already used it.' };
    }
    if (promo.firstOrderOnly && hasOrders && hasOrders()) {
      return { ok: false, used: true, error: key + ' is a welcome code for a first order \u2014 this account has already placed one.' };
    }
    if (promo.minSub && sub < promo.minSub) {
      return { ok: false, error: 'This code needs an order of at least ' + naira(promo.minSub) + ' before it applies.' };
    }
    const discount = Math.round(promo.type === 'percent' ? sub * promo.value / 100 : Math.min(promo.value, sub));
    return { ok: true, code: key, promo: promo, discount: discount };
  }

  function getCategory(id) { return CATEGORIES.find(function (c) { return c.id === id; }); }
  function getFood(id) { return FOODS.find(function (f) { return f.id === Number(id); }); }
  function countByCat() {
    const map = {};
    FOODS.forEach(function (f) { map[f.cat] = (map[f.cat] || 0) + 1; });
    return map;
  }
  function foodsInCat(id) { return FOODS.filter(function (f) { return f.cat === id; }); }

  return {
    img, naira, CATEGORIES, FOODS, GALLERY, SEED_USERS, SEED_ORDERS, STATUS_FLOW,
    CANCELLED, statusMeta, checkPromo,
    PROMOS, PROMO_POLICY, CONFIG, PAY_METHODS, PAY_STATUS, REFUND_STATUS, refundMeta,
    DEMO_BANK, NG_BANKS, getCategory, getFood, countByCat, foodsInCat
  };
})();
