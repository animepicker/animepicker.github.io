export default {
  async fetch(request) {
    // Handle CORS preflight request from the browser
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    }

    // Only allow GET and POST requests for security
    if (request.method !== "POST" && request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Extract the path from the incoming request (e.g., /v1/models or /v1/chat/completions)
    const url = new URL(request.url);
    const targetUrl = "https://integrate.api.nvidia.com" + url.pathname + url.search;
    
    // Create a new request object to send to NVIDIA, copying the body and headers
    const newRequest = new Request(targetUrl, request);

    try {
      // Fetch the data from NVIDIA
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
