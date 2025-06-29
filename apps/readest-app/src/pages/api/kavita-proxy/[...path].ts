import type { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'stream';

// Configure your Kavita backend URL here (or via env var)
const KAVITA_BASE_URL = process.env['KAVITA_BASE_URL'] || 'http://192.168.0.10:5200';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log("Kavita proxy request received:", req.method, req.url);

    // Build target backend URL
    const { path } = req.query;
    const backendPath = Array.isArray(path) ? path.join('/') : path;
    const queryString = req.url?.split(backendPath)[1] || '';
    const targetUrl = `${KAVITA_BASE_URL}/${backendPath}${queryString}`;
    console.log("Performing backend request to URL:", targetUrl, req.method);

    // Prepare headers (clone and filter out problematic ones)
    const { host, connection, ...filteredHeaders } = req.headers;

    const isBodyAllowed = req.method !== 'GET' && req.method !== 'HEAD';
    let bodyToSend: string | undefined = undefined;

    // Only send body if it's a POST/PUT/etc and req.body exists and is non-empty
    if (isBodyAllowed && req.body && Object.keys(req.body).length > 0) {
      bodyToSend = JSON.stringify(req.body);
      filteredHeaders['Content-Type'] = 'application/json';
    }

    // Stream the request body (for POST, PUT, etc.)
    const fetchResponse = await fetch(targetUrl, {
      method: req.method,
      headers: filteredHeaders as HeadersInit,
      body: bodyToSend,
    });

    // Forward status
    res.status(fetchResponse.status);

    // Copy relevant headers
    const skipHeaders = [
      'transfer-encoding', // Node.js handles this automatically
      'content-encoding', // Avoid issues with compressed responses
      'server', // Avoid exposing backend server details
      'date', // Avoid issues with date headers
      'content-length', // Node.js will handle this automatically
    ];
    fetchResponse.headers.forEach((value, key) => {
      // You may want to filter out certain headers if needed
      const lowerKey = key.toLowerCase();
      if (skipHeaders.includes(lowerKey)) return;
      console.log(`Forwarding header: ${key} = ${value}`);
      res.setHeader(key, value);
    });    

    // Stream backend response body
    const contentType = fetchResponse.headers.get('content-type') || '';

    if (fetchResponse.body) {
      // Node.js 18+ supports Readable.fromWeb
      if (typeof (Readable as any).fromWeb === 'function') {
        const nodeStream = (Readable as any).fromWeb(fetchResponse.body);
        nodeStream.pipe(res);
      } else {
        // Fallback: buffer and send
        const buffer = Buffer.from(await fetchResponse.arrayBuffer());
        res.end(buffer);
      }
    } else {
      res.end();
    }
    
    console.log("Kavita proxy finished processing");
  } catch (error) {
    console.error('Kavita proxy error:', error);
    res.status(500).json({ error: 'Proxy error', details: (error as Error).message });
  }
}
