import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Product from './pages/Product';
import About from './pages/About';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import OwnerAuth from './pages/OwnerAuth';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminPanel from './pages/AdminPanel';
import SearchPage from './pages/Search';
import { products as demoProducts } from './data/products';
import { site } from './config/site';
import { loadStoreProducts, loadStoreDetails } from './lib/supabase';
import { variantKey } from './utils/money';
import './styles.css';

const CART_KEY = 'web-forge-cart-v2';
const WISHLIST_KEY = 'web-forge-wishlist-v1';

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function readCart() {
  const value = readJson(CART_KEY, []);
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && item.id).map(item => ({
    ...item,
    options: item.options && typeof item.options === 'object' && !Array.isArray(item.options) ? item.options : {},
    qty: Math.max(1, Number(item.qty) || 1),
    key: item.key || variantKey(item, item.options && typeof item.options === 'object' ? item.options : {}),
  }));
}

function readRoute() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return { page: 'home', productId: null };
  const [page, productId] = hash.split('/');
  if (page === 'product' && productId) return { page, productId };
  if (page === 'shop' && productId) return { page, productId: null, category: decodeURIComponent(productId) };
  if (page === 'owner' && productId === 'dashboard') return { page: 'owner/dashboard', productId: null };
  if (['home','shop','search','about','cart','wishlist','owner','admin'].includes(page)) return { page, productId: null };
  return { page: 'home', productId: null };
}

function App() {
  const [route, setRoute] = useState(readRoute);
  const [items, setItems] = useState(readCart);
  const [wishlist, setWishlist] = useState(() => { const value = readJson(WISHLIST_KEY, []); return Array.isArray(value) ? value : []; });
  const [products, setProducts] = useState(demoProducts);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [storeDetails, setStoreDetails] = useState(null);

  useEffect(() => {
    const initial = readRoute();
    window.history.replaceState({ page: 'home', productId: null }, '', window.location.pathname);
    if (initial.page !== 'home') {
      const initialHash = initial.page === 'product' ? `#product/${initial.productId}` : initial.page === 'shop' && initial.category ? `#shop/${encodeURIComponent(initial.category)}` : `#${initial.page}`;
      window.history.pushState({ page: initial.page, productId: initial.productId }, '', initialHash);
    }
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => { window.removeEventListener('hashchange', onHashChange); window.removeEventListener('popstate', onHashChange); };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([loadStoreProducts(), loadStoreDetails()]).then(([data, details]) => {
      if (active && data !== null) {
        setProducts(data);
        const availableIds = new Set(data.map(product => product.id));
        setItems(current => {
          const migrated = current.map(item => {
            const product = data.find(entry => entry.id === item.id);
            const selected = item.options && !Array.isArray(item.options) && typeof item.options === 'object' ? item.options : {};
            return {
              ...item,
              optionGroups: Array.isArray(item.optionGroups) ? item.optionGroups : (product?.options || []),
              options: selected,
              key: variantKey(item, selected),
            };
          });
          return migrated.filter(item => availableIds.has(item.id)).reduce((merged, item) => {
            const existing = merged.find(entry => entry.key === item.key);
            if (existing) existing.qty += item.qty;
            else merged.push(item);
            return merged;
          }, []);
        });
      }
      if (active) setStoreDetails(details);
    }).catch(() => {}).finally(() => { if (active) setLoadingProducts(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, [route]);

  const go = (page, product = null) => {
    const hash = page === 'product' && product ? `#product/${product.id}` : page === 'shop' && typeof product === 'string' ? `#shop/${encodeURIComponent(product)}` : page === 'home' ? '' : `#${page}`;
    window.location.hash = hash;
  };
  const back = () => window.history.back();

  const add = (product, quantity = 1, options = {}) => {
    const key = variantKey(product, options);
    setItems(current => {
      const found = current.find(item => item.key === key);
      if (found) return current.map(item => item.key === key ? { ...item, qty: item.qty + quantity } : item);
      return [...current, { ...product, optionGroups: Array.isArray(product.options) ? product.options : [], options, key, qty: quantity }];
    });
  };
  const remove = key => setItems(current => current.filter(item => item.key !== key));
  const changeQty = (item, delta) => setItems(current => current.map(entry => entry.key === item.key ? { ...entry, qty: entry.qty + delta } : entry).filter(entry => entry.qty > 0));
  const cartQty = product => items.filter(item => item.id === product.id).reduce((sum,item) => sum + item.qty, 0);
  const toggleWishlist = id => setWishlist(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const wishlistProducts = wishlist.map(id => products.find(product => product.id === id)).filter(Boolean);

  const selectedProduct = route.productId ? products.find(product => product.id === route.productId) : null;
  const count = items.reduce((sum,item) => sum + item.qty, 0);

  if (loadingProducts) return <div className="store-app"><Header go={go} count={count} /><main><section className="store-shop"><div className="loading-state">Loading products…</div></section></main><Footer go={go} /></div>;

  return <div className="store-app">
    <Header go={go} count={count} />
    <main>
      {route.page === 'home' && <Home go={go} open={product => go('product', product)} add={add} cartQty={cartQty} wishlist={wishlist} toggleWishlist={toggleWishlist} products={products} storeDetails={storeDetails} />}
      {route.page === 'shop' && <Shop open={product => go('product', product)} add={add} cartQty={cartQty} back={back} wishlist={wishlist} toggleWishlist={toggleWishlist} products={products} initialCategory={route.category} />}
      {route.page === 'search' && <SearchPage products={products} open={product => go('product', product)} add={add} cartQty={cartQty} wishlist={wishlist} toggleWishlist={toggleWishlist} back={back} />}
      {route.page === 'product' && <Product product={selectedProduct} back={back} add={add} cartItems={items} wishlist={wishlist} toggleWishlist={toggleWishlist} />}
      {route.page === 'about' && site.features.about && <About go={go} back={back} />}
      {route.page === 'cart' && <Cart items={items} remove={remove} changeQty={changeQty} go={go} back={back} />}
      {route.page === 'wishlist' && <Wishlist products={wishlistProducts} add={add} remove={toggleWishlist} open={product => go('product', product)} go={go} back={back} />}
      {route.page === 'owner' && <OwnerAuth go={go} />}
      {route.page === 'owner/dashboard' && <OwnerDashboard go={go} />}
      {route.page === 'admin' && <AdminPanel go={go} />}
    </main>
    <Footer go={go} />
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
