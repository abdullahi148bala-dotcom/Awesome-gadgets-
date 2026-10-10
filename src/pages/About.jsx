import { ArrowLeft, ArrowRight, MapPin, MessageCircle, Instagram } from 'lucide-react';
import { site } from '../config/site';

const splitTitle = lines => <>{lines[0]}<br/><i>{lines[1]}</i></>;

export default function About({ go, back }) {
  return <section className="store-about">
    <button className="page-back about-back" onClick={back}><ArrowLeft /> {site.labels.back}</button>
    <div className="about-copy">
      <p className="eyebrow">{site.copy.aboutEyebrow}</p>
      <h1>{splitTitle(site.copy.aboutTitle)}</h1>
      {site.copy.aboutText.map(text => <p key={text}>{text}</p>)}
      <div className="about-business-details">
        <h2>Contact &amp; location</h2>
        <p><MessageCircle aria-hidden="true" /> <a href="https://wa.me/2347026834576" target="_blank" rel="noopener noreferrer">WhatsApp: 07026834576</a></p>
        <p><Instagram aria-hidden="true" /> <span>Instagram: @Awesome tech</span></p>
        <p><span className="about-social-mark">♪</span> <a href="https://www.tiktok.com/@Awesome_Tech1" target="_blank" rel="noopener noreferrer">TikTok: Awesome_Tech1</a></p>
        <p><MapPin aria-hidden="true" /> <span>No 169–170 Fansamu Farm Center, Kano</span></p>
      </div>
      <div className="about-business-details about-terms">
        <h2>Terms &amp; Conditions</h2>
        <ul>
          <li>No refunds or exchanges on duplicate phones.</li>
          <li>Original brand-new phones come with a 3-day warranty.</li>
          <li>Original pre-owned devices come with a 3-day warranty.</li>
          <li>Goods received in good condition are not returnable.</li>
        </ul>
      </div>
      <button className="primary" onClick={() => go('shop')}>{site.labels.exploreCollection} <ArrowRight /></button>
    </div>
    <img src="https://images.unsplash.com/photo-1738707060349-c92b5b15bf80?auto=format&fit=crop&w=1000&q=85" alt="Featured Awesome Tech product" width="800" height="1000" />
  </section>;
}
