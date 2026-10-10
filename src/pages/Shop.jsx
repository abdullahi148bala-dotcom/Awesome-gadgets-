import { useState } from 'react';
import { site } from '../config/site';
import { ArrowLeft } from 'lucide-react';
import ProductCard from '../components/ProductCard';

export default function Shop({ open, add, cartQty, back, wishlist, toggleWishlist, products, initialCategory }) {
  const [category, setCategory] = useState(initialCategory || 'All');
  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  const filtered = category === 'All' ? products : products.filter(p => p.category === category);
  return <section className="store-shop"><button className="page-back" onClick={back}><ArrowLeft /> {site.labels.back}</button><div className="shop-heading"><p className="eyebrow">{site.brand} / {site.copy.shopEyebrow}</p><h1>{site.copy.shopTitle}</h1><p>{site.copy.description}</p></div><div className="category-filter" role="tablist" aria-label="Product categories">{categories.map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} role="tab" aria-selected={category === item}>{item}</button>)}</div><div className="product-grid">{filtered.map(product => <ProductCard key={product.id} product={product} open={open} add={add} quantity={cartQty(product)} wishlist={wishlist} toggleWishlist={toggleWishlist} />)}</div></section>;
}
