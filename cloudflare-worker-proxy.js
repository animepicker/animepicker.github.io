export default {
  async fetch(request) {
    // Only allow POST requests for security (and OPTIONS for CORS preflight)
    if (request.method !== "POST" && request.method !== "OPTIONS") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Handle CORS preflight request from the browser
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*", // You can change "*" to "https://yourusername.github.io" for better security
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    }

    // The target URL we want to proxy to
    const url = "https://integrate.api.nvidia.com/v1/chat/completions";
    
    // Create a new request object to send to NVIDIA, copying the body and headers from the original request
    const newRequest = new Request(url, request);

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
