import { ArrowLeft, ArrowRight, Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { site } from '../config/site';
import { finalUnitPrice, formatMoney } from '../utils/money';

export default function Wishlist({ products, add, remove, open, go, back }) {
  return <section className="store-wishlist">
    <button className="page-back" onClick={back}><ArrowLeft /> {site.labels.back}</button>
    <p className="eyebrow">{site.copy.wishlistEyebrow}</p>
    <h1>{site.copy.wishlistTitle}</h1>
    {!products.length ? (
      <div className="empty">
        <Heart aria-hidden="true" />
        <p>{site.labels.emptyWishlist}</p>
        <button onClick={() => go('shop')}>{site.labels.startShopping} <ArrowRight /></button>
      </div>
    ) : (
      <div className="wishlist-list">
        {products.map(product => (
          <article className="wishlist-row" key={product.id}>
            <button className="wishlist-product" onClick={() => open(product)}>
              <img src={product.images?.[0]} alt={product.name} width="110" height="140" loading="lazy" />
              <span><small>{product.category}</small><strong>{product.name}</strong><b>{formatMoney(finalUnitPrice(product))}</b></span>
            </button>
            <div className="wishlist-actions">
              <button className="primary" onClick={() => add(product)}><ShoppingCart /> Add to cart</button>
              <button className="wishlist-remove" onClick={() => remove(product.id)} aria-label={`Remove ${product.name} from wishlist`}><Trash2 /></button>
            </div>
          </article>
        ))}
      </div>
    )}
  </section>;
}
