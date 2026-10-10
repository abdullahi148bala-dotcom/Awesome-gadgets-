import { Heart, Search, ShoppingCart } from 'lucide-react';
import { site } from '../config/site';
export default function Header({ go, count }) {
  return <header className="store-header" data-store-type={site.type}>
    <button className="store-brand" onClick={() => go('home')} aria-label="Go to home"><span className="brand-mark">A</span>{site.brand}</button>
    <nav className="store-nav" aria-label="Main navigation"><button onClick={() => go('home')}>Home</button><button onClick={() => go('shop')}>{site.labels.shop}</button>{site.features.about && <button onClick={() => go('about')}>{site.labels.story}</button>}</nav>
    <div className="store-actions"><button className="store-icon store-search-trigger" onClick={() => go('search')} aria-label="Search products"><Search aria-hidden="true" /></button><button className="store-icon" onClick={() => go('wishlist')} aria-label={site.labels.wishlist}><Heart aria-hidden="true" /></button><button className="store-cart-link" onClick={() => go('cart')} aria-label={`Open ${site.labels.cart}, ${count} items`}><ShoppingCart aria-hidden="true" /><span>Cart</span><b>{count}</b></button></div>
  </header>;
}