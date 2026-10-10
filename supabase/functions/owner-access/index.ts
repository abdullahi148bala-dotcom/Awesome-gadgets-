import { withSupabase } from 'npm:@supabase/server@1';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SESSION_HOURS = 12;

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function validCode(code: unknown) {
  return typeof code === 'string' && /^\d{8}$/.test(code);
}

function storagePathFromUrl(value: unknown, storeId: string) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/public/store-assets/';
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    const path = decodeURIComponent(url.pathname.slice(index + marker.length));
    return path.startsWith(storeId + '/') ? path : null;
  } catch { return null; }
}

async function removeStoreImages(ctx: any, images: unknown, storeId: string) {
  const paths = Array.isArray(images) ? images.map(image => storagePathFromUrl(image, storeId)).filter(Boolean) : [];
  if (paths.length) await ctx.supabaseAdmin.storage.from('store-assets').remove(paths);
}

function validDiscount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

function clientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

async function sessionFor(ctx: any, token: string) {
  if (!token) return null;
  const hash = await sha256(token);
  const { data } = await ctx.supabaseAdmin
    .from('store_owner_sessions')
    .select('id,store_id,expires_at')
    .eq('token_hash', hash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data || null;
}

async function adminSessionFor(ctx: any, token: string) {
  if (!token) return null;
  const hash = await sha256(token);
  const { data } = await ctx.supabaseAdmin
    .from('web_forge_admin_sessions')
    .select('id,expires_at')
    .eq('token_hash', hash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data || null;
}

function randomEightDigitCode() {
  const max = 100000000;
  const limit = Math.floor(0x100000000 / max) * max;
  const bytes = new Uint32Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return String(bytes[0] % max).padStart(8, '0');
}

async function createAdminSession(ctx: any) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await ctx.supabaseAdmin.from('web_forge_admin_sessions').insert({
    token_hash: await sha256(token),
    expires_at: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString(),
  });
  return token;
}

function cleanProduct(input: any, storeId: string) {
  const price = Number(input?.price);
  const discount = Number(input?.discount_percent ?? 0);
  if (!input?.name || !Number.isFinite(price) || price < 0 || !validDiscount(discount)) {
    throw new Error('Invalid product details.');
  }
  const images = Array.isArray(input.images) ? input.images.filter((x: unknown) => typeof x === 'string').slice(0, 4) : [];
  const options = Array.isArray(input.options) ? input.options.slice(0, 20) : [];
  const id = typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null;
  return {
    ...(id ? { id } : {}),
    store_id: storeId,
    name: String(input.name).trim().slice(0, 160),
    description: String(input.description || '').trim().slice(0, 5000),
    price,
    discount_percent: discount,
    category: String(input.category || 'General').trim().slice(0, 80) || 'General',
    images,
    options,
  };
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

    let body: any;
    let uploadFile: File | null = null;
    const contentType = req.headers.get('content-type') || '';
    try {
      if (contentType.includes('multipart/form-data')) {
        const form = await req.formData();
        uploadFile = form.get('file') instanceof File ? form.get('file') as File : null;
        body = { action: String(form.get('action') || ''), token: String(form.get('token') || '') };
      } else {
        body = await req.json();
      }
    } catch { return json({ error: 'Invalid request.' }, 400); }

    const action = body?.action;

    if (action === 'admin_login') {
      const code = String(body?.code || '');
      if (!validCode(code)) return json({ error: 'Enter the 8-digit Web Forge admin code.' }, 400);

      const codeHash = await sha256(code);
      const { data: admin } = await ctx.supabaseAdmin
        .from('web_forge_admin_access')
        .select('id,active,failed_attempts,locked_until,code_hash')
        .eq('id', true)
        .maybeSingle();

      if (!admin?.active || admin.code_hash !== codeHash) {
        if (admin?.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
          return json({ error: 'Too many attempts. Try again later.' }, 429);
        }
        const failures = Number(admin?.failed_attempts || 0) + 1;
        await ctx.supabaseAdmin.from('web_forge_admin_access').update({
          failed_attempts: failures,
          locked_until: failures >= 5 ? new Date(Date.now() + 60 * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('id', true);
        return json({ error: 'Invalid Web Forge admin code.' }, 401);
      }

      const token = await createAdminSession(ctx);
      await ctx.supabaseAdmin.from('web_forge_admin_access').update({
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq('id', true);
      return json({ token });
    }

    if (action === 'admin_list_stores') {
      const adminSession = await adminSessionFor(ctx, String(body?.adminToken || ''));
      if (!adminSession) return json({ error: 'Your Web Forge admin session has expired.' }, 401);
      const { data, error } = await ctx.supabaseAdmin
        .from('store_sites')
        .select('id,brand,slug,currency_code,created_at')
        .order('created_at', { ascending: false });
      if (error) return json({ error: 'Could not load store owners.' }, 500);
      return json({ stores: data || [] });
    }

    if (action === 'admin_reset_owner_code') {
      const adminSession = await adminSessionFor(ctx, String(body?.adminToken || ''));
      if (!adminSession) return json({ error: 'Your Web Forge admin session has expired.' }, 401);
      const storeId = String(body?.storeId || '');
      if (!storeId) return json({ error: 'Missing store.' }, 400);

      const { data: store } = await ctx.supabaseAdmin
        .from('store_sites')
        .select('id,brand,slug')
        .eq('id', storeId)
        .maybeSingle();
      if (!store) return json({ error: 'Store owner not found.' }, 404);

      let temporaryCode = '';
      let codeHash = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        temporaryCode = randomEightDigitCode();
        codeHash = await sha256(temporaryCode);
        const { data: conflict } = await ctx.supabaseAdmin
          .from('store_owner_access')
          .select('id')
          .eq('code_hash', codeHash)
          .maybeSingle();
        if (!conflict) break;
        temporaryCode = '';
      }
      if (!temporaryCode) return json({ error: 'Could not generate a unique temporary code.' }, 500);

      const { error: updateError } = await ctx.supabaseAdmin
        .from('store_owner_access')
        .update({
          code_hash: codeHash,
          force_change: true,
          active: true,
          failed_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('store_id', storeId);
      if (updateError) return json({ error: 'Could not reset the owner access code.' }, 500);

      await ctx.supabaseAdmin.from('store_owner_sessions').delete().eq('store_id', storeId);

      return json({
        store: { id: store.id, brand: store.brand, slug: store.slug },
        temporaryCode,
        forceChange: true,
      });
    }

    if (action === 'admin_logout') {
      const adminSession = await adminSessionFor(ctx, String(body?.adminToken || ''));
      if (adminSession) await ctx.supabaseAdmin.from('web_forge_admin_sessions').delete().eq('id', adminSession.id);
      return json({ ok: true });
    }

    if (action === 'login') {
      const code = String(body?.code || '');
      if (!validCode(code)) return json({ error: 'Enter the 8-digit access code.' }, 400);

      const ipHash = await sha256(clientIp(req));
      const { data: limitState, error: limitError } = await ctx.supabaseAdmin.rpc(
        'check_store_owner_login_rate_limit',
        { p_ip_hash: ipHash }
      );
      if (limitError) return json({ error: 'Could not verify login protection.' }, 500);

      const rate = Array.isArray(limitState) ? limitState[0] : limitState;
      if (rate && rate.allowed === false) {
        return json({ error: 'Too many attempts. Try again in ' + Math.max(1, Number(rate.retry_after_seconds || 60)) + ' seconds.' }, 429);
      }

      const codeHash = await sha256(code);
      const { data: access } = await ctx.supabaseAdmin
        .from('store_owner_access')
        .select('id,store_id,code_hash,force_change,active,failed_attempts,locked_until')
        .eq('code_hash', codeHash)
        .maybeSingle();

      if (!access || !access.active) {
        const { data: failureState, error: failureError } = await ctx.supabaseAdmin.rpc(
          'record_store_owner_login_failure',
          { p_ip_hash: ipHash }
        );
        if (failureError) return json({ error: 'Could not record login attempt.' }, 500);

        const failure = Array.isArray(failureState) ? failureState[0] : failureState;
        if (failure && failure.cooldown_started) {
          return json({ error: 'Too many attempts. Try again in 60 seconds.' }, 429);
        }
        return json({ error: 'Invalid access code.' }, 401);
      }

      const { data: resetState, error: resetError } = await ctx.supabaseAdmin.rpc(
        'reset_store_owner_login_rate_limit',
        { p_ip_hash: ipHash }
      );
      if (resetError) return json({ error: 'Could not start the owner session.' }, 500);

      const token = crypto.randomUUID() + crypto.randomUUID();
      const tokenHash = await sha256(token);
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

      const { error } = await ctx.supabaseAdmin.from('store_owner_sessions').insert({
        store_id: access.store_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      if (error) return json({ error: 'Could not create the owner session.' }, 500);

      const { data: store } = await ctx.supabaseAdmin
        .from('store_sites')
        .select('id,brand,slug,currency_code,whatsapp')
        .eq('id', access.store_id)
        .single();

      return json({ token, forceChange: access.force_change, store });
    }

    const token = String(body?.token || '');
    const session = await sessionFor(ctx, token);
    if (!session) return json({ error: 'Your owner session has expired. Enter your access code again.' }, 401);

    if (action === 'change_code') {
      if (!validCode(body?.newCode)) return json({ error: 'Your new code must be exactly 8 digits.' }, 400);
      const newHash = await sha256(body.newCode);

      const { data: conflict } = await ctx.supabaseAdmin
        .from('store_owner_access')
        .select('id')
        .eq('code_hash', newHash)
        .neq('store_id', session.store_id)
        .maybeSingle();
      if (conflict) return json({ error: 'Choose a different code.' }, 409);

      const { error } = await ctx.supabaseAdmin
        .from('store_owner_access')
        .update({ code_hash: newHash, force_change: false, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
        .eq('store_id', session.store_id);
      if (error) return json({ error: 'Could not change your access code.' }, 500);

      await ctx.supabaseAdmin.from('store_owner_sessions').delete().eq('store_id', session.store_id);
      const newToken = crypto.randomUUID() + crypto.randomUUID();
      await ctx.supabaseAdmin.from('store_owner_sessions').insert({
        store_id: session.store_id,
        token_hash: await sha256(newToken),
        expires_at: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString(),
      });
      return json({ token: newToken, forceChange: false });
    }

    const { data: access } = await ctx.supabaseAdmin
      .from('store_owner_access')
      .select('force_change,active')
      .eq('store_id', session.store_id)
      .single();
    if (!access?.active) return json({ error: 'Owner access has been disabled.' }, 403);
    if (access.force_change) return json({ error: 'Change your temporary access code first.' }, 403);

    if (action === 'upload_image') {
      if (!uploadFile) return json({ error: 'Choose an image to upload.' }, 400);
      const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
      if (!allowed.has(uploadFile.type)) return json({ error: 'Only JPG, PNG, WebP, GIF or AVIF images are allowed.' }, 400);
      if (uploadFile.size > 5 * 1024 * 1024) return json({ error: 'Each image must be 5 MB or smaller.' }, 400);
      const extension = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'} as Record<string,string>)[uploadFile.type];
      const path = session.store_id + '/products/' + crypto.randomUUID() + '.' + extension;
      const { error: uploadError } = await ctx.supabaseAdmin.storage.from('store-assets').upload(path, new Uint8Array(await uploadFile.arrayBuffer()), { contentType: uploadFile.type, cacheControl: '31536000', upsert: false });
      if (uploadError) return json({ error: 'Could not upload the image.' }, 500);
      const { data: publicUrl } = ctx.supabaseAdmin.storage.from('store-assets').getPublicUrl(path);
      return json({ url: publicUrl.publicUrl, path });
    }

    if (action === 'list_categories') {
      const { data, error } = await ctx.supabaseAdmin.from('store_categories').select('id,name,created_at,updated_at').eq('store_id', session.store_id).order('name', { ascending: true });
      if (error) return json({ error: 'Could not load categories.' }, 500);
      return json({ categories: data || [] });
    }

    if (action === 'save_category') {
      const name = String(body?.name || '').trim().slice(0, 80);
      if (!name) return json({ error: 'Category needs a name.' }, 400);
      const { data, error } = await ctx.supabaseAdmin
        .from('store_categories')
        .upsert({ store_id: session.store_id, name, updated_at: new Date().toISOString() }, { onConflict: 'store_id,name' })
        .select()
        .single();
      if (error) return json({ error: 'Could not save the category.' }, 500);
      return json({ category: data });
    }

    if (action === 'list_presets') {
      const { data, error } = await ctx.supabaseAdmin.from('store_option_presets').select('id,name,pricing,values,created_at,updated_at').eq('store_id', session.store_id).order('name', { ascending: true });
      if (error) return json({ error: 'Could not load add-on presets.' }, 500);
      return json({ presets: data || [] });
    }

    if (action === 'save_preset') {
      const input = body?.preset || {};
      const name = String(input.name || '').trim().slice(0, 80);
      const pricing = ['add','subtract','none'].includes(input.pricing) ? input.pricing : 'add';
      const values = Array.isArray(input.values) ? input.values.map((v: any) => ({ label: String(v?.label || '').trim().slice(0, 80), amount: Math.max(0, Number(v?.amount || 0)) })).filter(v => v.label).slice(0, 50) : [];
      if (!name || !values.length) return json({ error: 'Preset needs a name and at least one value.' }, 400);
      const presetId = body?.preset?.id ? String(body.preset.id) : undefined;
      const query = presetId
        ? ctx.supabaseAdmin.from('store_option_presets').update({ name, pricing, values, updated_at: new Date().toISOString() }).eq('id', presetId).eq('store_id', session.store_id).select().single()
        : ctx.supabaseAdmin.from('store_option_presets').upsert({ store_id: session.store_id, name, pricing, values, updated_at: new Date().toISOString() }, { onConflict: 'store_id,name' }).select().single();
      const { data, error } = await query;
      if (error) return json({ error: 'Could not save the add-on preset.' }, 500);
      return json({ preset: data });
    }

    if (action === 'delete_preset') {
      const presetId = String(body?.presetId || '');
      if (!presetId) return json({ error: 'Missing preset.' }, 400);
      const { error } = await ctx.supabaseAdmin.from('store_option_presets').delete().eq('id', presetId).eq('store_id', session.store_id);
      if (error) return json({ error: 'Could not delete the add-on preset.' }, 500);
      return json({ ok: true });
    }

    if (action === 'list') {
      const { data, error } = await ctx.supabaseAdmin
        .from('store_products').select('*').eq('store_id', session.store_id).order('created_at', { ascending: false });
      if (error) return json({ error: 'Could not load products.' }, 500);
      return json({ products: data || [] });
    }

    if (action === 'save') {
      try {
        const payload = cleanProduct(body.product, session.store_id);
        let result;
        let oldImages: string[] = [];
        if (body.product?.id) {
          const { data: existing } = await ctx.supabaseAdmin.from('store_products').select('images').eq('id', body.product.id).eq('store_id', session.store_id).maybeSingle();
          oldImages = Array.isArray(existing?.images) ? existing.images : [];
          result = await ctx.supabaseAdmin.from('store_products').update(payload).eq('id', body.product.id).eq('store_id', session.store_id).select().single();
        } else {
          result = await ctx.supabaseAdmin.from('store_products').upsert(payload, { onConflict: 'id' }).select().single();
        }
        if (result.error) return json({ error: 'Could not save the product.' }, 500);
        const retained = new Set(payload.images);
        const removed = oldImages.filter(image => !retained.has(image));
        if (removed.length) await removeStoreImages(ctx, removed, session.store_id);
        return json({ product: result.data });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Invalid product details.' }, 400);
      }
    }

    if (action === 'delete') {
      if (!body.productId) return json({ error: 'Missing product.' }, 400);
      const { data: existing } = await ctx.supabaseAdmin.from('store_products').select('images').eq('id', body.productId).eq('store_id', session.store_id).maybeSingle();
      const { error } = await ctx.supabaseAdmin.from('store_products').delete().eq('id', body.productId).eq('store_id', session.store_id);
      if (error) return json({ error: 'Could not delete the product.' }, 500);
      await removeStoreImages(ctx, existing?.images, session.store_id);
      return json({ ok: true });
    }

    if (action === 'logout') {
      await ctx.supabaseAdmin.from('store_owner_sessions').delete().eq('id', session.id);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  }),
};
