import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with the Service Role Key (securely hidden on the backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_PASSWORD = process.env.APP_PASSWORD || 'izzy123';

export default async function handler(req, res) {
  // 1. Verify the password sent from the frontend header
  const clientPassword = req.headers['x-app-password'];
  if (!clientPassword || clientPassword !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
  }

  const action = req.query.action || req.body?.action;

  try {
    // --- GET REQUESTS ---
    if (req.method === 'GET') {
      if (action === 'getClothes') {
        const { data, error } = await supabase.from('clothes').select('*');
        if (error) throw error;
        return res.status(200).json({ data });
      }
      if (action === 'getOutfits') {
        const { data, error } = await supabase.from('outfits').select('*');
        if (error) throw error;
        return res.status(200).json({ data });
      }
    }

    // --- POST REQUESTS ---
    if (req.method === 'POST') {
      const body = req.body;

      if (action === 'uploadClothing') {
        const { item, fileName, imageFile } = body;
        // Decode base64 image and upload to Supabase storage bucket
        const buffer = Buffer.from(imageFile.split(',')[1], 'base64');
        const { error: storageError } = await supabase.storage
          .from('wardrobe-images')
          .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
        
        if (storageError) throw storageError;

        const { data: publicUrlData } = supabase.storage
          .from('wardrobe-images')
          .getPublicUrl(fileName);

        const finalItem = { ...item, image: publicUrlData.publicUrl };
        const { data, error: dbError } = await supabase.from('clothes').insert([finalItem]).select();
        if (dbError) throw dbError;

        return res.status(200).json({ data: data[0] });
      }

      if (action === 'deleteCloth') {
        const { error } = await supabase.from('clothes').delete().eq('id', body.id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      if (action === 'saveOutfit') {
        const { id, name, item_ids, metadata, imageFile } = body;
        let imageUrl = null;

        if (imageFile) {
          const buffer = Buffer.from(imageFile.split(',')[1], 'base64');
          const fileName = `outfit_${Date.now()}.jpg`;
          const { error: storageError } = await supabase.storage
            .from('wardrobe-images')
            .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
          
          if (!storageError) {
            const { data: pub } = supabase.storage.from('wardrobe-images').getPublicUrl(fileName);
            imageUrl = pub.publicUrl;
          }
        }

        const { data, error } = await supabase.from('outfits').insert([{
          id, name, item_ids, metadata, image_url: imageUrl
        }]).select();

        if (error) throw error;
        return res.status(200).json({ data: data[0] });
      }

      if (action === 'deleteOutfit') {
        const { error } = await supabase.from('outfits').delete().eq('id', body.id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }
    }

    return res.status(400).json({ error: 'Invalid action or method' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}