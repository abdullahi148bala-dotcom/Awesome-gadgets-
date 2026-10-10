import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Heart, Minus, Plus } from 'lucide-react';
import { formatMoney, finalUnitPrice, priceBeforeDiscount, variantKey } from '../utils/money';

const valueLabel = value => typeof value === 'string' ? value : value.label;
const valueAmount = (group, value) => {
  if (typeof value === 'string') return 0;
  const amount = Math.max(0, Number(value.amount || 0));
  return group.pricing === 'subtract' ? -amount : group.pricing === 'add' ? amount : 0;
};

export default function Product({ product, back, add, cartItems = [], wishlist = [], toggleWishlist }) {
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [options, setOptions] = useState(() => Object.fromEntries((product?.options || []).map(o => [o.key, valueLabel(o.values?.[0])])));

  useEffect(() => {
    setQuantity(1); setImageIndex(0);
    setOptions(Object.fromEntries((product?.options || []).map(o => [o.key, valueLabel(o.values?.[0])])));
  }, [product?.id]);

  if (!product) return null;
  const image = product.images?.[imageIndex] || product.images?.[0];
  const beforeDiscount = priceBeforeDiscount(product, options);
  const salePrice = finalUnitPrice(product, options);
  const discount = Number(product.discount_percent || 0);
  const addedToCart = cartItems.some(item => item.key === variantKey(product, options));

  return <section className="product-detail">
    <button className="page-back" onClick={back}><ArrowLeft /> Back to shop</button>
    <div className="product-detail-grid">
      <div>
        <div className="product-detail-image">{toggleWishlist && <button className={`product-detail-like ${wishlist.includes(product.id) ? 'liked' : ''}`} aria-label={wishlist.includes(product.id) ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} onClick={() => toggleWishlist(product.id)}><Heart aria-hidden="true" fill="currentColor" /></button>}<img src={image} alt={`${product.name} image ${imageIndex + 1}`} width="800" height="1000" /></div>
        {product.images?.length > 1 && <div className="gallery" aria-label="Product images">{product.images.map((src,index) => <button key={src} className={index === imageIndex ? 'active' : ''} onClick={() => setImageIndex(index)} aria-label={`Show image ${index + 1}`}><img src={src} alt="" width="100" height="120" loading="lazy" /></button>)}</div>}
      </div>
      <div className="product-detail-copy">
        <p className="eyebrow">{product.category}</p>{discount > 0 && <span className="product-detail-discount">{discount}% discount</span>}<h1>{product.name}</h1><strong>{discount > 0 ? <><s>{formatMoney(beforeDiscount)}</s> <span className="product-sale-price">{formatMoney(salePrice)}</span></> : formatMoney(salePrice)}</strong><p className="description">{product.description}</p>
        {product.options?.length > 0 && <div className="product-options">{product.options.map(group => <div key={group.key}><div className="option-head"><span>{group.label}</span><b>{options[group.key]}</b></div><div className="option-values">{group.values.map(value => {const label=valueLabel(value);const adjustment=valueAmount(group,value);return <button key={label} className={options[group.key] === label ? 'active' : ''} onClick={() => setOptions(prev => ({...prev,[group.key]:label}))} aria-pressed={options[group.key] === label}>{label}{adjustment !== 0 && <small>{adjustment > 0 ? '+' : '−'}{formatMoney(Math.abs(adjustment))}</small>}</button>})}</div></div>)}</div>}
        {discount > 0 && <p className="price-note">Discount is applied after your selected options are added or reduced.</p>}
        <div className="quantity"><button onClick={() => setQuantity(q => Math.max(1,q-1))} aria-label="Decrease quantity"><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity(q => q+1)} aria-label="Increase quantity"><Plus /></button></div>
        <button className="primary full" disabled={addedToCart} onClick={() => add(product, quantity, options)}>{addedToCart ? "Added to cart" : "Add to cart"} {addedToCart ? "✓" : <ArrowRight />}</button>
        {toggleWishlist && <button className={`wishlist-detail-button ${wishlist.includes(product.id) ? 'active' : ''}`} onClick={() => toggleWishlist(product.id)} aria-pressed={wishlist.includes(product.id)}>
          <Heart size={18} fill={wishlist.includes(product.id) ? 'currentColor' : 'none'} />
          {wishlist.includes(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
        </button>}
      </div>
    </div>
  </section>;
}
