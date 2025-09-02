// Vercel serverless function to proxy DALL-E images
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Get the image URL from query parameter
    const { url: imageUrl } = req.query;
    
    if (!imageUrl) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }

    // Validate that it's a DALL-E URL for security
    if (!imageUrl.includes('oaidalleapiprodscus.blob.core.windows.net')) {
      res.status(400).json({ error: 'Invalid image source' });
      return;
    }

    console.log('Fetching image:', imageUrl);

    // Fetch the image from DALL-E
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
      return;
    }

    // Get the image data as buffer
    const imageBuffer = await response.arrayBuffer();
    
    // Set content type and return the image
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
