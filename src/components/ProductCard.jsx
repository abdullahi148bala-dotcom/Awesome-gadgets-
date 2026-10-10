import { Heart, Plus } from 'lucide-react';
import { site } from '../config/site';
import { discountAmount, finalUnitPrice, formatMoney, priceBeforeDiscount } from '../utils/money';

export default function ProductCard({ product, open, add, quantity, wishlist, toggleWishlist }) {
  const liked = wishlist.includes(product.id);
  const added = quantity > 0;
  const baseBefore = priceBeforeDiscount(product);
  const baseSale = finalUnitPrice(product);
  const discount = Number(product.discount_percent || 0);
  return <article className="product-card"><div className="product-card-visual"><button className="product-card-image" onClick={() => open(product)} aria-label={`View ${product.name}`}><img src={product.images?.[0]} alt={product.name} width="800" height="1000" loading="lazy" /></button><span className="product-category">{product.category}</span>{discount > 0 && <span className="product-discount-badge">{discount}% off</span>}{site.features.wishlist && <button className={`product-like ${liked ? 'liked' : ''}`} aria-label={liked ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} onClick={() => toggleWishlist(product.id)}><Heart aria-hidden="true" fill="currentColor" /></button>}</div><div className="product-card-bottom"><div><h3>{product.name}</h3><strong>{discount > 0 ? <><s>{formatMoney(baseBefore)}</s> <span className="product-sale-price">{formatMoney(baseSale)}</span></> : formatMoney(baseSale)}</strong></div><button className={`product-add ${added ? 'added' : ''}`} onClick={() => add(product)}>{added ? site.labels.addedToCart : site.labels.addToCart}{added ? <span aria-hidden="true">✓</span> : <Plus aria-hidden="true" />}</button></div></article>;
}
