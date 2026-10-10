import { createClient } from '@supabase/supabase-js';
import { site } from '../config/site';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://kkzounlnakoxarzcgbkz.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_MaTO2ykgEzJNqZ8Dr-NT1g_rZ8RhRly';

export const supabase = createClient(url, key);

const OWNER_FUNCTION = 'owner-access-v2';

// supabase-js hides the response body when the function returns a non-2xx status and only
// gives a generic message. Read the real { error } message the function sent instead.
async function serverErrorMessage(error) {
  try {
    const body = await error?.context?.json();
    return typeof body?.error === 'string' ? body.error : '';
  } catch {
    return '';
  }
}

export async function adminApi(body) {
  const { data, error } = await supabase.functions.invoke(OWNER_FUNCTION, { body });
  if (error) throw new Error((await serverErrorMessage(error)) || data?.error || error.message || 'Web Forge admin request failed.');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function ownerApi(body) {
  const retryable = ['save', 'list', 'delete'].includes(body?.action);
  let lastError = null;
  for (let attempt = 0; attempt < (retryable ? 3 : 1); attempt += 1) {
    try {
      const { data, error } = await supabase.functions.invoke(OWNER_FUNCTION, { body });
      if (error) {
        const serverMessage = await serverErrorMessage(error);
        if (serverMessage) throw new Error(serverMessage);
        const message = error.message || '';
        const transient = /relay|network|fetch|unable to reach/i.test(message) ||
          ['FunctionsRelayError', 'FunctionsFetchError'].includes(error?.constructor?.name);
        if (transient && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw new Error(data?.error || message || 'Owner request failed.');
      }
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < 2 && /relay|network|fetch|unable to reach/i.test(error?.message || '')) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('Owner request failed.');
}

export async function loadStoreProducts() {
  const slug = import.meta.env.VITE_STORE_SLUG || site.storeSlug || 'mara';
  const { data: store, error: storeError } = await supabase
    .from('store_sites')
    .select('id,brand,slug,currency_code,whatsapp')
    .eq('slug', slug)
    .maybeSingle();

  if (storeError) throw storeError;
  if (!store) return [];

  const { data, error } = await supabase
    .from('store_products')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_sold_out', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function loadStoreDetails() {
  const slug = import.meta.env.VITE_STORE_SLUG || site.storeSlug || 'mara';
  const { data, error } = await supabase
    .from('store_sites')
    .select('brand,slug,whatsapp,address,maps_url,phone,instagram_url,tiktok_url,facebook_url')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function uploadOwnerImage(file) {
  const token = localStorage.getItem('web-forge-owner-session-v1');
  if (!token) throw new Error('Your owner session has expired.');

  const form = new FormData();
  form.append('action', 'upload_image');
  form.append('token', token);
  form.append('file', file);

  const response = await fetch(url + '/functions/v1/' + OWNER_FUNCTION, {
    method: 'POST',
    headers: { apikey: key },
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error || 'Could not upload image.');
  }
  return data;
}
