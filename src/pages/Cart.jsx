import { ArrowLeft, ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { site } from '../config/site';
import { checkoutUrl, finalUnitPrice, formatMoney, optionDetails, priceBeforeDiscount } from '../utils/money';

export default function Cart({ items, remove, changeQty, go, back }) {
  const total = items.reduce((sum,item) => sum + finalUnitPrice(item, item.options) * item.qty, 0);
  const savings = items.reduce((sum,item) => sum + (priceBeforeDiscount(item,item.options) - finalUnitPrice(item,item.options)) * item.qty, 0);
  return <section className="store-cart"><button className="page-back" onClick={back}><ArrowLeft /> {site.labels.back}</button><p className="eyebrow">{site.copy.cartEyebrow}</p><h1>{site.copy.cartTitle}</h1>
    {!items.length ? <div className="empty"><p>{site.labels.emptyBag}</p><button onClick={() => go('shop')}>{site.labels.startShopping} <ArrowRight /></button></div> :
      <><div className="cart-list">{items.map(item => {const unit=finalUnitPrice(item,item.options);const before=priceBeforeDiscount(item,item.options);const details=optionDetails(item,item.options);return <div className="cart-row" key={item.key}><img src={item.images?.[0]} alt={item.name} width="90" height="110" loading="lazy" /><div><small>{item.category}</small><h3>{item.name}</h3>{details.length > 0 && <div className="cart-options">{details.map(detail => <div key={detail}>{detail}</div>)}</div>}<div className="cart-price"><b>{formatMoney(unit * item.qty)}</b>{before !== unit && <s>{formatMoney(before * item.qty)}</s>}<span>{formatMoney(unit)} each</span></div><div className="cart-qty"><button onClick={() => changeQty(item,-1)} aria-label={`Decrease ${item.name}`}><Minus /></button><span>{item.qty}</span><button onClick={() => changeQty(item,1)} aria-label={`Increase ${item.name}`}><Plus /></button></div></div><button className="cart-remove" onClick={() => remove(item.key)} aria-label={`Remove ${item.name}`}><Trash2 /></button></div>})}</div><div className="cart-total"><span>Total</span><div>{savings > 0 && <small>You save {formatMoney(savings)}</small>}<strong>{formatMoney(total)}</strong></div></div>
      <aside className="checkout-terms">
        <h2>Terms &amp; Conditions</h2>
        <ul>
          <li>No refunds or exchanges on duplicate phones.</li>
          <li>Original brand-new phones come with a 3-day warranty.</li>
          <li>Original pre-owned devices come with a 3-day warranty.</li>
          <li>Goods received in good condition are not returnable.</li>
        </ul>
        <p>By proceeding to WhatsApp to place your order, you confirm that you have read these terms.</p>
      </aside>
      <a className="primary full checkout" href={checkoutUrl(items,total)} target="_blank" rel="noopener noreferrer">{site.labels.checkout} <ArrowRight /></a></>}
  </section>;
}
