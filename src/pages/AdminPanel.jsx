import {useEffect,useState} from 'react';
import {ArrowLeft,KeyRound,LogOut,RefreshCw,ShieldCheck} from 'lucide-react';
import {adminApi} from '../lib/supabase';

const ADMIN_SESSION='web-forge-admin-session-v1';

export default function AdminPanel({go}){
  const [mode,setMode]=useState('login');
  const [code,setCode]=useState('');
  const [stores,setStores]=useState([]);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [issued,setIssued]=useState(null);

  const token=()=>localStorage.getItem(ADMIN_SESSION);

  const load=async()=>{
    setBusy(true);setMsg('');
    try{
      const r=await adminApi({action:'admin_list_stores',adminToken:token()});
      setStores(r.stores||[]);
    }catch(e){
      localStorage.removeItem(ADMIN_SESSION);
      setMode('login');
      setMsg(e.message||'Could not load store owners.');
    }finally{setBusy(false);}
  };

  useEffect(()=>{if(token()){setMode('dashboard');load();}},[]);

  const login=async e=>{
    e.preventDefault();setBusy(true);setMsg('');
    try{
      const r=await adminApi({action:'admin_login',code});
      localStorage.setItem(ADMIN_SESSION,r.token);
      setCode('');
      setMode('dashboard');
      await load();
    }catch(err){setMsg(err.message||'Could not sign in.');}
    finally{setBusy(false);}
  };

  const resetOwner=async store=>{
    if(!window.confirm('Reset this store owner access code? Their current owner sessions will be revoked.'))return;
    setBusy(true);setMsg('');setIssued(null);
    try{
      const r=await adminApi({action:'admin_reset_owner_code',adminToken:token(),storeId:store.id});
      setIssued(r);
    }catch(e){setMsg(e.message||'Could not reset the owner code.');}
    finally{setBusy(false);}
  };

  const logout=async()=>{
    try{await adminApi({action:'admin_logout',adminToken:token()});}catch{}
    localStorage.removeItem(ADMIN_SESSION);
    setMode('login');
    setIssued(null);
  };

  if(mode==='login')return <section className="owner-shell">
    <button className="owner-back" onClick={()=>go('home')}><ArrowLeft/> Back to site</button>
    <div className="owner-card">
      <p className="eyebrow">WEB FORGE / ADMIN</p>
      <div className="owner-auth-icon"><ShieldCheck/></div>
      <h1>Platform administration.</h1>
      <p className="owner-muted">Use your private Web Forge admin code to manage store-owner access.</p>
      <form className="owner-form" onSubmit={login}>
        <label>8-digit admin code<input inputMode="numeric" autoComplete="one-time-code" maxLength="8" pattern="\d{8}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="••••••••" required/></label>
        {msg&&<p className="owner-message">{msg}</p>}
        <button className="primary full" disabled={busy}>{busy?'Please wait…':'Enter admin panel'} <KeyRound/></button>
      </form>
    </div>
  </section>;

  return <section className="owner-dashboard">
    <header className="owner-top">
      <div><p className="eyebrow">WEB FORGE ADMIN</p><h1>Store owners.</h1><p className="owner-muted">Reset access codes without seeing or storing their permanent codes.</p></div>
      <div className="owner-top-actions"><button className="owner-security-button" onClick={load} disabled={busy}><RefreshCw/> Refresh</button><button className="owner-logout" onClick={logout}><LogOut/> Log out</button></div>
    </header>

    {issued&&<div className="owner-code-panel">
      <div><p className="eyebrow">TEMPORARY ACCESS CODE</p><h2>{issued.store.brand}</h2><p className="owner-muted">Give this code to the owner. It works once for setup and forces them to create a new 8-digit code.</p></div>
      <strong className="admin-temp-code">{issued.temporaryCode}</strong>
      <button className="owner-security-button" onClick={()=>setIssued(null)}>Close</button>
    </div>}

    {msg&&<p className="owner-message">{msg}</p>}
    <div className="owner-products admin-store-list">
      <div className="owner-list-head"><div><p className="eyebrow">STORES</p><h2>{stores.length} store owners</h2></div></div>
      {stores.map(store=><article className="owner-product" key={store.id}>
        <div><h3>{store.brand||'Unnamed store'}</h3><p>/{store.slug}</p><small>{store.currency_code||'NGN'}</small></div>
        <div className="owner-product-actions"><button onClick={()=>resetOwner(store)} disabled={busy}>Reset access code</button></div>
      </article>)}
      {!stores.length&&!busy&&<div className="owner-empty-options">No store owners have been created yet.</div>}
    </div>
  </section>;
}
