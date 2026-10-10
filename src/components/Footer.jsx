import { ArrowRight } from 'lucide-react';
import { site } from '../config/site';

export default function Footer({ go }) {
  return <footer className="store-footer">
    <b>{site.brand}.</b><span>Everyday goods, chosen well.</span>
    <div className="store-footer-links">
      {site.features.about && <button onClick={() => go('about')}>{site.labels.story}</button>}
      <button onClick={() => go('shop')}>{site.labels.shop} <ArrowRight aria-hidden="true" /></button>
    </div>
  </footer>;
}
