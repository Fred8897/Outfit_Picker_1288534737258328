import { Client, handle_file } from "@gradio/client";

async function prepareInputBlob(source) {
  if (typeof source === 'string' && source.startsWith('data:image')) {
    const res = await fetch(source);
    return await res.blob();
  }
  if (typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'))) {
    const res = await fetch(source);
    return await res.blob();
  }
  return source;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { personImage, garmentImage } = req.body;
  if (!personImage || !garmentImage) {
    return res.status(400).json({ error: 'Missing personImage or garmentImage' });
  }

  const hfToken = process.env.HF_TOKEN;

  try {
    const personBlob = await prepareInputBlob(personImage);
    const garmentBlob = await prepareInputBlob(garmentImage);

    let resultUrl = null;

    try {
      const app = await Client.connect("weshopai/weshopai-virtual-try-on", { token: hfToken });
      const result = await app.predict("/generate_image", [
        handle_file(garmentBlob),
        handle_file(personBlob)
      ]);
      resultUrl = result.data[0]?.url || result.data[0];
    } catch (primaryErr) {
      const fallbackApp = await Client.connect("miragic-ai/miragic-virtual-try-on", { token: hfToken });
      const result = await fallbackApp.predict("/virtual_tryon", [
        handle_file(personBlob),
        handle_file(garmentBlob)
      ]);
      resultUrl = result.data[0]?.url || result.data[0];
    }

    return res.status(200).json({ resultUrl });
  } catch (err) {
    return res.status(500).json({ error: `Virtual try-on execution failed: ${err.message}` });
  }
}