import {useEffect,useState} from 'react';
import {KeyRound,LogOut,Plus,Save,Trash2,X} from 'lucide-react';
import {ownerApi,uploadOwnerImage} from '../lib/supabase';
import {formatMoney} from '../utils/money';

const SESSION='web-forge-owner-session-v1';
const STORE='web-forge-owner-store-v1';
const blank={name:'',description:'',price:'',discount_percent:0,category:'General',images:[],options:[],is_sold_out:false};
const blankContact={whatsapp:'',phone:'',address:'',maps_url:'',instagram_url:'',tiktok_url:'',facebook_url:''};

const slugify=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'option';
const normalizeOptions=options=>(options||[]).map((group,i)=>{
  const values=(group.values||[]).map(v=>typeof v==='string'?{label:v,amount:0}:{label:String(v.label||'').trim(),amount:Math.max(0,Number(v.amount||0))}).filter(v=>v.label).slice(0,50);
  return {key:slugify(group.key||group.label||`option_${i+1}`),label:String(group.label||'Option').trim().slice(0,80),pricing:['add','subtract','none'].includes(group.pricing)?group.pricing:'none',values};
}).filter(g=>g.label&&g.values.length).slice(0,20);

const newGroup=()=>({key:'',label:'',pricing:'add',values:[{label:'',amount:0}]});
const presetToGroup=p=>({key:slugify(p.name),label:p.name,pricing:p.pricing,values:(p.values||[]).map(v=>({label:v.label||'',amount:Number(v.amount||0)}))});

export default function OwnerDashboard({go}){
 const[user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem(STORE))}catch{return null}}),[rows,setRows]=useState([]),[presets,setPresets]=useState([]),[categories,setCategories]=useState([]),[form,setForm]=useState(blank),[edit,setEdit]=useState(null),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[msg,setMsg]=useState(''),[showCode,setShowCode]=useState(false),[newCode,setNewCode]=useState(''),[confirmCode,setConfirmCode]=useState(''),[contact,setContact]=useState(blankContact),[savingContact,setSavingContact]=useState(false),[contactMsg,setContactMsg]=useState('');
 const token=()=>localStorage.getItem(SESSION);
 const load=async()=>{try{const [r,p,c,d]=await Promise.all([ownerApi({action:'list',token:token()}),ownerApi({action:'list_presets',token:token()}),ownerApi({action:'list_categories',token:token()}),ownerApi({action:'get_store_details',token:token()})]);setRows(r.products||[]);setPresets(p.presets||[]);setCategories(c.categories||[]);setContact({...blankContact,...d.store})}catch(e){localStorage.removeItem(SESSION);localStorage.removeItem(STORE);go('owner')}finally{setBusy(false)}};
 useEffect(()=>{if(!token()){go('owner');return}load()},[]);
 const reset=()=>{setForm(blank);setEdit(null);setMsg('')};
 const saveContact=async e=>{e.preventDefault();setSavingContact(true);setContactMsg('');try{const r=await ownerApi({action:'save_store_details',token:token(),store:contact});setContact({...blankContact,...r.store});setContactMsg('Contact details saved.')}catch(e){setContactMsg(e.message||'Could not save contact details.')}finally{setSavingContact(false)}};
 const toggleSoldOut=async p=>{try{const r=await ownerApi({action:'set_sold_out',token:token(),productId:p.id,is_sold_out:!p.is_sold_out});setRows(current=>current.map(row=>row.id===p.id?r.product:row));setMsg(r.product.is_sold_out?'Product marked sold out.':'Product is back in stock.')}catch(e){setMsg(e.message||'Could not update availability.')}};
 const addPreset=p=>setForm(f=>({...f,options:[...f.options,presetToGroup(p)]}));
 const saveCategory=async name=>{const value=String(name||'').trim();if(!value)return setMsg('Enter a category name first.');try{const r=await ownerApi({action:'save_category',token:token(),name:value});setCategories(x=>[r.category,...x.filter(c=>c.id!==r.category.id)]);setForm(f=>({...f,category:r.category.name}));setMsg('Category saved.')}catch(e){setMsg(e.message||'Could not save the category.')}};
 const deleteCategory=async id=>{if(!confirm('Delete this saved category? Products already using it will keep their category name.'))return;try{await ownerApi({action:'delete_category',token:token(),categoryId:id});setCategories(x=>x.filter(c=>c.id!==id));setMsg('Category deleted.')}catch(e){setMsg(e.message||'Could not delete the category.')}};
 const savePreset=async group=>{const name=String(group.label||'').trim();const values=group.values||[];if(!name||!values.some(v=>String(v.label||'').trim()))return setMsg('Give the add-on preset a name and at least one value.');try{const r=await ownerApi({action:'save_preset',token:token(),preset:{name,pricing:group.pricing,values}});setPresets(x=>[r.preset,...x.filter(p=>p.id!==r.preset.id)]);setMsg('Add-on preset saved.')}catch(e){setMsg(e.message||'Could not save the add-on preset.')}};
 const deletePreset=async id=>{try{await ownerApi({action:'delete_preset',token:token(),presetId:id});setPresets(x=>x.filter(p=>p.id!==id));setMsg('Add-on preset deleted.')}catch(e){setMsg(e.message||'Could not delete the add-on preset.')}};
 const updateGroup=(index,patch)=>setForm(f=>({...f,options:f.options.map((g,i)=>i===index?{...g,...patch}:g)}));
 const updateValue=(gi,vi,patch)=>setForm(f=>({...f,options:f.options.map((g,i)=>i===gi?{...g,values:g.values.map((v,n)=>n===vi?{...v,...patch}:v)}:g)}));
 const save=async e=>{e.preventDefault();setSaving(true);setMsg('');
  try{const options=normalizeOptions(form.options);const category=String(form.category||'').trim()||'General';if(category!=='General'){const categoryResult=await ownerApi({action:'save_category',token:token(),name:category});setCategories(x=>[categoryResult.category,...x.filter(c=>c.id!==categoryResult.category.id)]);}const payload={...(edit?{id:edit}:{id:crypto.randomUUID()}),name:form.name.trim(),description:form.description.trim(),price:Number(form.price),discount_percent:Math.max(0,Math.min(100,Number(form.discount_percent||0))),category:form.category.trim()||'General',images:form.images,options,is_sold_out:Boolean(form.is_sold_out)};const r=await ownerApi({action:'save',token:token(),product:payload});setRows(x=>edit?x.map(p=>p.id===edit?r.product:p):[r.product,...x]);reset();setMsg('Product saved.')}catch(e){setMsg(e.message||'Could not save product.')}finally{setSaving(false)}
 };
 const editRow=p=>{setEdit(p.id);setForm({name:p.name||'',description:p.description||'',price:p.price,discount_percent:p.discount_percent||0,category:p.category||'General',images:p.images||[],is_sold_out:p.is_sold_out===true,options:(p.options||[]).map((g,i)=>({key:g.key||slugify(g.label),label:g.label||`Option ${i+1}`,pricing:g.pricing||'none',values:(g.values||[]).map(v=>typeof v==='string'?{label:v,amount:0}:{label:v.label||'',amount:Number(v.amount||0)})}))})};
 const remove=async id=>{if(!confirm('Delete this product?'))return;try{await ownerApi({action:'delete',token:token(),productId:id});setRows(x=>x.filter(p=>p.id!==id))}catch(e){setMsg(e.message||'Could not delete product.')}};
 const images=async e=>{
  const files=[...e.target.files].slice(0,4);
  if(!files.length)return;
  setMsg('');
  try{
    const uploaded=[];
    for(const file of files){
      if(file.size>5*1024*1024) throw new Error('Each image must be 5 MB or smaller.');
      const result=await uploadOwnerImage(file);
      uploaded.push(result.url);
    }
    setForm(x=>({...x,images:[...x.images,...uploaded].slice(0,4)}));
    setMsg('Image uploaded.');
  }catch(err){setMsg(err.message||'Could not upload the selected image.')}
  finally{e.target.value='';}
 };
 const changeCode=async e=>{e.preventDefault();setMsg('');if(!/^\d{8}$/.test(newCode)||newCode!==confirmCode)return setMsg('Enter matching 8-digit codes.');try{const r=await ownerApi({action:'change_code',token:token(),newCode});localStorage.setItem(SESSION,r.token);setNewCode('');setConfirmCode('');setShowCode(false);setMsg('Access code changed.')}catch(e){setMsg(e.message||'Could not change access code.')}};
 const logout=async()=>{try{await ownerApi({action:'logout',token:token()})}catch{}localStorage.removeItem(SESSION);localStorage.removeItem(STORE);go('owner')};
 if(busy)return <section className="owner-shell"><div className="owner-card">Loading owner dashboard…</div></section>;
 return <section className="owner-dashboard">
  <header className="owner-top"><div><p className="eyebrow">OWNER DASHBOARD</p><h1>{user?.brand||'Your store'}.</h1><p className="owner-muted">Manage products, pricing, discounts and options.</p></div><div className="owner-top-actions"><button className="owner-security-button" onClick={()=>setShowCode(v=>!v)}><KeyRound/> {showCode?'Close':'Change code'}</button><button className="owner-logout" onClick={logout}><LogOut/> Log out</button></div></header>
  {showCode&&<form className="owner-code-panel" onSubmit={changeCode}><div><p className="eyebrow">SECURITY</p><h2>Change owner access code.</h2><p className="owner-muted">Changing it invalidates the current owner sessions.</p></div><label>New 8-digit code<input inputMode="numeric" maxLength="8" value={newCode} onChange={e=>setNewCode(e.target.value.replace(/\D/g,'').slice(0,8))} required/></label><label>Confirm code<input inputMode="numeric" maxLength="8" value={confirmCode} onChange={e=>setConfirmCode(e.target.value.replace(/\D/g,'').slice(0,8))} required/></label><button className="primary" type="submit">Change code <KeyRound/></button></form>}
  <form className="owner-store-settings" onSubmit={saveContact}>
   <div className="owner-form-head"><div><p className="eyebrow">HOMEPAGE CONTACT DETAILS</p><h2>Socials and location.</h2><p className="owner-muted">These details appear near the bottom of the public homepage. Leave a field blank to hide it.</p></div></div>
   <div className="owner-store-settings-grid">
    <label>Shop address<input value={contact.address||''} onChange={e=>setContact({...contact,address:e.target.value})} placeholder="Street, area, city"/></label>
    <label>Google Maps link<input type="url" value={contact.maps_url||''} onChange={e=>setContact({...contact,maps_url:e.target.value})} placeholder="https://maps.google.com/..."/></label>
    <label>Phone number<input value={contact.phone||''} onChange={e=>setContact({...contact,phone:e.target.value})} placeholder="Phone customers can call"/></label>
    <label>WhatsApp number<input inputMode="tel" value={contact.whatsapp||''} onChange={e=>setContact({...contact,whatsapp:e.target.value})} placeholder="234... (country code, no +)"/></label>
    <label>Instagram URL<input type="url" value={contact.instagram_url||''} onChange={e=>setContact({...contact,instagram_url:e.target.value})} placeholder="https://instagram.com/..."/></label>
    <label>TikTok URL<input type="url" value={contact.tiktok_url||''} onChange={e=>setContact({...contact,tiktok_url:e.target.value})} placeholder="https://tiktok.com/@..."/></label>
    <label>Facebook URL<input type="url" value={contact.facebook_url||''} onChange={e=>setContact({...contact,facebook_url:e.target.value})} placeholder="https://facebook.com/..."/></label>
   </div>
   {contactMsg&&<p className="owner-message">{contactMsg}</p>}
   <button className="primary" type="submit" disabled={savingContact}>{savingContact?'Saving…':'Save contact details'} <Save/></button>
  </form>
  <div className="owner-grid"><form className="owner-product-form" onSubmit={save}>
   <div className="owner-form-head"><div><p className="eyebrow">{edit?'EDIT PRODUCT':'NEW PRODUCT'}</p><h2>{edit?'Update the product.':'Add a product.'}</h2></div>{edit&&<button type="button" className="icon-button" onClick={reset}><X/></button>}</div>
   <label>Product name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
   <label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows="4" required/></label>
   <div className="owner-two"><label>Base price<input type="number" min="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/></label><label>Category<input list="owner-category-list" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/><datalist id="owner-category-list">{categories.map(c=><option key={c.id} value={c.name}/>)}</datalist><small>Saved categories stay available for future products.</small></label></div>
   {categories.length>0&&<div className="owner-saved-categories"><div className="owner-list-label">SAVED CATEGORIES</div><div className="owner-category-list">{categories.map(c=><div className="owner-category-chip" key={c.id}><button type="button" onClick={()=>setForm(f=>({...f,category:c.name}))}>{c.name}</button><button type="button" className="owner-mini-delete" onClick={()=>deleteCategory(c.id)} aria-label={'Delete category '+c.name}><Trash2/></button></div>)}</div></div>}
   <div className="owner-category-save"><button type="button" className="owner-add" onClick={()=>saveCategory(form.category)}>Save category</button></div>
   <label>Discount percentage<input type="number" min="0" max="100" value={form.discount_percent} onChange={e=>setForm({...form,discount_percent:e.target.value})}/><small>Discount applies to the base price plus any selected option/add-on adjustments.</small></label>
   {Number(form.discount_percent)>0&&<div className="discount-preview"><span>{form.discount_percent}% DISCOUNT</span><s>{formatMoney(Number(form.price)||0)}</s><strong>{formatMoney(Number(form.price||0)*(1-Number(form.discount_percent)/100))}</strong></div>}
   <label>Product images<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple onChange={images}/><small>Up to 4 images. Images are stored securely in the store's Supabase Storage area. Maximum 5 MB each.</small></label>
   {form.images.length>0&&<div className="owner-image-grid">{form.images.map((x,i)=><div key={x}><img src={x} alt=""/><button type="button" onClick={()=>setForm(f=>({...f,images:f.images.filter((_,n)=>n!==i)}))}><X/></button></div>)}</div>}
   <div className="owner-options-editor"><div className="owner-form-head"><div><p className="eyebrow">OPTIONS & ADD-ONS</p><h2>Flexible pricing.</h2><p className="owner-muted">Each group can add to or reduce the base price. The discount is applied after all adjustments.</p></div><button type="button" className="owner-add" onClick={()=>setForm(f=>({...f,options:[...f.options,newGroup()]}))}><Plus/> Add group</button></div>{presets.length>0&&<div className="owner-presets"><div className="owner-form-head"><div><p className="eyebrow">SAVED ADD-ONS</p><p className="owner-muted">Reuse these presets on any product. They remain available after products are uploaded.</p></div></div><div className="owner-preset-list">{presets.map(p=><div className="owner-preset" key={p.id}><button type="button" className="owner-preset-use" onClick={()=>addPreset(p)}><strong>{p.name}</strong><small>{p.values?.map(v=>v.label).join(' · ')}</small></button><button type="button" className="icon-button" onClick={()=>deletePreset(p.id)} aria-label={'Delete preset '+p.name}><Trash2/></button></div>)}</div></div>}
    {!form.options.length&&<div className="owner-empty-options">No options yet. Add Size, Color, Protein, Extras, Storage, or any other configuration.</div>}
    {form.options.map((group,gi)=><div className="owner-option-group" key={gi}>
      <div className="owner-option-group-head"><input placeholder="Group name e.g. Size, Protein, Extras" value={group.label} onChange={e=>updateGroup(gi,{label:e.target.value,key:slugify(e.target.value)})}/><select value={group.pricing} onChange={e=>updateGroup(gi,{pricing:e.target.value})}><option value="add">Add to price</option><option value="subtract">Reduce price</option><option value="none">No price change</option></select><button type="button" className="icon-button" onClick={()=>setForm(f=>({...f,options:f.options.filter((_,i)=>i!==gi)}))}><Trash2/></button></div>
      <div className="owner-option-values">{group.values.map((value,vi)=><div className="owner-option-value" key={vi}><input placeholder="Option name" value={value.label} onChange={e=>updateValue(gi,vi,{label:e.target.value})}/><div className="owner-option-amount"><span>{group.pricing==='subtract'?'−':group.pricing==='add'?'+':'='}</span><input type="number" min="0" value={value.amount} disabled={group.pricing==='none'} onChange={e=>updateValue(gi,vi,{amount:e.target.value})}/></div><button type="button" className="icon-button" onClick={()=>updateGroup(gi,{values:group.values.filter((_,n)=>n!==vi)})}><X/></button></div>)}</div>
      <div className="owner-option-footer"><button type="button" className="owner-add" onClick={()=>updateGroup(gi,{values:[...group.values,{label:'',amount:0}]})}><Plus/> Add option</button><button type="button" className="owner-add" onClick={()=>savePreset(group)}>Save as preset</button></div>
    </div>)}
   </div>
   {msg&&<p className="owner-message">{msg}</p>}<button className="primary full" disabled={saving}>{saving?'Saving…':edit?'Save product':'Add product'} {edit?<Save/>:<Plus/>}</button>
  </form>
  <div className="owner-products"><div className="owner-list-head"><div><p className="eyebrow">CATALOGUE</p><h2>{rows.length} products</h2></div><button className="owner-add" onClick={reset}><Plus/> New</button></div>{rows.map(p=>{const discount=Number(p.discount_percent||0);const base=Number(p.price||0);const sale=Math.max(0,base*(1-discount/100));return <article className={`owner-product ${p.is_sold_out?'owner-product-sold-out':''}`} key={p.id}><img src={p.images?.[0]} alt=""/><div><h3>{p.name} {p.is_sold_out&&<span className="owner-sold-out-badge">SOLD OUT</span>}</h3><p>{discount>0?<><s>{formatMoney(base)}</s> <strong>{formatMoney(sale)}</strong></>:formatMoney(base)}</p><small>{p.category}{discount>0?' · '+discount+'% off':''}{p.options?.length?' · '+p.options.length+' option groups':''}</small></div><div className="owner-product-actions"><button onClick={()=>editRow(p)}>Edit</button><button className={p.is_sold_out?'owner-restock-button':'owner-sold-out-button'} onClick={()=>toggleSoldOut(p)}>{p.is_sold_out?'Restock':'Mark sold out'}</button><button onClick={()=>remove(p.id)} aria-label={'Delete '+p.name}><Trash2/></button></div></article>})}</div></div>
 </section>;
}