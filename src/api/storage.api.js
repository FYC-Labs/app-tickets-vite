const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64 || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a file to the upselling images bucket via Edge Function (service role).
 * Returns the public URL of the uploaded file.
 * @param {File} file - The file to upload
 * @param {string} eventId - Event UUID (for path)
 * @param {string} [folderId] - Optional folder (e.g. upselling id or 'new')
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadUpsellingImage(file, eventId, folderId = 'new') {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase URL or anon key missing');

  const fileBase64 = await fileToBase64(file);
  const fileName = file.name || 'image.jpg';
  const contentType = file.type || 'image/jpeg';

  const res = await fetch(`${supabaseUrl}/functions/v1/upsellings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      action: 'uploadImage',
      eventId,
      folderId,
      fileBase64,
      fileName,
      contentType,
      baseUrl: supabaseUrl.replace(/\/$/, ''),
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || 'Error al subir la imagen');
  if (!json.data?.url) throw new Error('No se recibió la URL de la imagen');
  return json.data.url;
}

/**
 * @param {string} publicUrl
 * @returns {Promise<string>}
 */
export async function getSignedUpsellingImageUrl(publicUrl) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase URL or anon key missing');
  const res = await fetch(`${supabaseUrl}/functions/v1/upsellings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      action: 'getSignedImageUrl',
      publicUrl,
      baseUrl: supabaseUrl.replace(/\/$/, ''),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || 'Error al obtener la imagen');
  if (!json.data?.url) throw new Error('No se recibió la URL');
  return json.data.url;
}

/**
 * @param {string} publicUrl
 * @returns {Promise<boolean>}
 */
export async function deleteUpsellingImage(publicUrl) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase URL or anon key missing');
  if (!publicUrl || !publicUrl.includes('upselling-images')) return false;
  const res = await fetch(`${supabaseUrl}/functions/v1/upsellings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ action: 'deleteImage', publicUrl }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || 'Error al borrar la imagen');
  return Boolean(json.data?.deleted);
}

export default {
  uploadUpsellingImage,
  getSignedUpsellingImageUrl,
  deleteUpsellingImage,
};
