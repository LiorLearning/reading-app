// Netlify serverless function to proxy DALL-E images
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get the image URL from query parameter
    const imageUrl = event.queryStringParameters?.url;
    
    if (!imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing url parameter' }),
      };
    }

    // Validate that it's a DALL-E URL for security
    if (!imageUrl.includes('oaidalleapiprodscus.blob.core.windows.net')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid image source' }),
      };
    }

    console.log('Fetching image:', imageUrl);

    // Fetch the image from DALL-E
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Failed to fetch image: ${response.statusText}` }),
      };
    }

    // Get the image data as buffer
    const imageBuffer = await response.arrayBuffer();
    
    // Return the image data as base64
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': response.headers.get('content-type') || 'image/png',
      },
      body: Buffer.from(imageBuffer).toString('base64'),
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error('Error fetching image:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
