export default {
  async fetch(request) {
    // Handle CORS preflight request from the browser
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        }
      });
    }

    // Only allow GET and POST requests for security
    if (request.method !== "POST" && request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    
    // Determine the target URL
    let targetUrl = url.searchParams.get('url');
    
    // If no ?url= provided, try to extract from path
    if (!targetUrl) {
      const pathUrl = url.pathname.slice(1) + url.search; // remove leading slash
      if (pathUrl.startsWith('http')) {
        targetUrl = pathUrl;
      } else if (url.pathname.startsWith('/v1/')) {
        // Fallback for existing NVIDIA direct paths
        targetUrl = "https://integrate.api.nvidia.com" + url.pathname + url.search;
      }
    }

    if (!targetUrl) {
      return new Response("Missing target URL. Use ?url=... or /https://...", { status: 400 });
    }
    
    // Create a new request object to send to the target, copying the body and headers
    const newRequest = new Request(targetUrl, request);

    // Remove headers that might cause issues with some APIs
    newRequest.headers.delete("Origin");
    newRequest.headers.delete("Referer");

    try {
      // Fetch the data from the target
      let response = await fetch(newRequest);

      // Reconstruct the response so we can modify the headers
      response = new Response(response.body, response);
      
      // Add the CORS header so the browser allows your frontend to read the response
      response.headers.set("Access-Control-Allow-Origin", "*");
      
      return response;
    } catch (e) {
      return new Response(`Proxy Error: ${e.message}`, { status: 500 });
    }
  }
};
