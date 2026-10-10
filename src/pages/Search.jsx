import { useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { site } from '../config/site';

const synonyms = {
  iphone: ['apple', 'phone', 'mobile', 'smartphone'],
  apple: ['iphone', 'phone', 'mobile', 'smartphone'],
  samsung: ['galaxy', 'android', 'phone', 'mobile', 'smartphone'],
  pixel: ['google', 'android', 'phone', 'mobile', 'smartphone'],
  laptop: ['computer', 'notebook', 'computing', 'pc'],
  computer: ['laptop', 'notebook', 'computing', 'pc'],
  headphone: ['headphones', 'earphone', 'earphones', 'earbud', 'earbuds', 'audio', 'sound'],
  headphones: ['headphone', 'earphone', 'earphones', 'earbud', 'earbuds', 'audio', 'sound'],
  earbuds: ['earbud', 'earphones', 'headphones', 'audio', 'sound'],
  charger: ['charging', 'power', 'adapter', 'cable'],
  charging: ['charger', 'power', 'adapter', 'cable'],
  powerbank: ['power', 'charger', 'battery', 'portable'],
  gaming: ['game', 'controller', 'gamepad'],
  gamepad: ['gaming', 'controller', 'games'],
  case: ['cover', 'protection', 'accessory'],
  accessories: ['accessory', 'case', 'charger', 'cable'],
  mic: ['microphone', 'audio', 'recording'],
  microphone: ['mic', 'audio', 'recording'],
};

const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = value => normalize(value).split(/\s+/).filter(Boolean);

function scoreProduct(product, query) {
  const q = normalize(query);
  const queryTokens = tokens(query);
  if (!q) return 0;
  const name = normalize(product.name);
  const category = normalize(product.category);
  const brand = normalize(product.brand || product.brand_name || '');
  const description = normalize(product.description || '');
  const searchable = normalize([product.name, product.brand, product.brand_name, product.category, product.description, ...(Array.isArray(product.tags) ? product.tags : [])].filter(Boolean).join(' '));
  let score = 0;
  if (name === q) score += 120;
  else if (name.includes(q)) score += 80;
  if (brand === q) score += 75;
  else if (brand && brand.includes(q)) score += 55;
  if (category === q) score += 65;
  else if (category.includes(q)) score += 35;
  if (description.includes(q)) score += 18;
  for (const token of queryTokens) {
    if (name.split(' ').includes(token)) score += 24;
    else if (name.includes(token)) score += 15;
    if (brand.includes(token)) score += 18;
    if (category.includes(token)) score += 16;
    if (description.includes(token)) score += 5;
    if (searchable.includes(token)) score += 3;
    for (const related of synonyms[token] || []) {
      if (name.includes(related)) score += 12;
      if (category.includes(related)) score += 10;
      if (description.includes(related)) score += 4;
    }
  }
  if (queryTokens.length > 1 && queryTokens.every(token => searchable.includes(token))) score += 16;
  return score;
}

export default function SearchPage({ products, open, add, cartQty, wishlist, toggleWishlist, back }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return products
      .map(product => ({ product, score: scoreProduct(product, q) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.product.name).localeCompare(String(b.product.name)))
      .map(item => item.product);
  }, [products, query]);
  const suggestions = useMemo(() => [...new Set(products.map(product => product.category).filter(Boolean))].slice(0, 6), [products]);

  return <section className="store-search-page">
    <button className="page-back" onClick={back}><ArrowLeft aria-hidden="true" /> Back</button>
    <div className="search-page-heading">
      <p className="eyebrow">{site.brand} / FIND WHAT YOU NEED</p>
      <h1>Search <i>products.</i></h1>
      <p>Search by product, brand or category. Related matches are included too.</p>
    </div>
    <form className="search-field" role="search" onSubmit={event => event.preventDefault()}>
      <Search aria-hidden="true" />
      <input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try “iPhone”, “earbuds” or “charger”" aria-label="Search products" />
      {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X aria-hidden="true" /></button>}
    </form>
    {!query.trim() ? <div className="search-suggestions">
      <p className="eyebrow">BROWSE CATEGORIES</p>
      <div className="search-suggestion-list">{suggestions.map(category => <button key={category} onClick={() => setQuery(category)}>{category}</button>)}</div>
      <p className="search-hint">Start typing to see matching products from our catalogue.</p>
    </div> : <div className="search-results">
      <div className="search-results-head"><h2>Results</h2><span>{results.length} {results.length === 1 ? 'item' : 'items'}</span></div>
      {results.length ? <div className="product-grid">{results.map(product => <ProductCard key={product.id} product={product} open={open} add={add} quantity={cartQty(product)} wishlist={wishlist} toggleWishlist={toggleWishlist} />)}</div> : <div className="search-empty"><Search aria-hidden="true" /><h2>No close matches yet</h2><p>Try a shorter product name, another brand, or a category such as Audio, Power or Computing.</p><button onClick={() => setQuery('')}>Clear search</button></div>}
    </div>}
  </section>;
}
