// AI Service for anime recommendations (OpenRouter, Groq, Cerebras)

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

const DEFAULT_OPENROUTER_MODEL = "tngtech/deepseek-r1t2-chimera:free";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_CEREBRAS_MODEL = "llama-3.3-70b";
const DEFAULT_MISTRAL_MODEL = "mistral-large-latest";

export const MODEL_URLS = {
  openrouter: "https://openrouter.ai/api/v1/models",
  groq: "https://api.groq.com/openai/v1/models",
  cerebras: "https://api.cerebras.ai/v1/models",
  mistral: "https://api.mistral.ai/v1/models"
};

const getModel = (provider) => {
  if (provider === 'groq') return localStorage.getItem('groq_model') || DEFAULT_GROQ_MODEL;
  if (provider === 'cerebras') return localStorage.getItem('cerebras_model') || DEFAULT_CEREBRAS_MODEL;
  if (provider === 'mistral') return localStorage.getItem('mistral_model') || DEFAULT_MISTRAL_MODEL;
  return localStorage.getItem('openrouter_model') || DEFAULT_OPENROUTER_MODEL;
};

const callAI = async (prompt, apiKey, provider = 'openrouter', signal = null, modelOverride = null) => {
  const model = modelOverride || getModel(provider);

  let url = OPENROUTER_API_URL;
  let headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  if (provider === 'openrouter') {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Anime Picker";
  } else if (provider === 'groq') {
    url = GROQ_API_URL;
  } else if (provider === 'cerebras') {
    url = CEREBRAS_API_URL;
  } else if (provider === 'mistral') {
    url = MISTRAL_API_URL;
  }

  // Defensive check: mismatch between model ID and provider
  if (provider !== 'openrouter' && (model.includes('/') || model.includes('openai/') || model.includes('anthropic/'))) {
    console.warn(`Potential model/provider mismatch: Sending ${model} to ${provider}. This usually results in an empty response.`);
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const getRetryDelayMs = (res, attempt) => {
    const retryAfter = res.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds)) return Math.min(seconds * 1000, 10000);
      const date = Date.parse(retryAfter);
      if (!Number.isNaN(date)) return Math.max(0, Math.min(date - Date.now(), 10000));
    }
    return Math.min(500 * Math.pow(2, attempt), 4000);
  };

  const maxAttempts = 3;
  let response = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    response = await fetch(url, {
      method: "POST",
      headers: headers,
      signal: signal,
      body: JSON.stringify({
        model: model,
        max_tokens: parseInt(localStorage.getItem('ai_max_tokens')) || 73728,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (response.ok) break;

    const isRateLimit = response.status === 429;
    const isTransient = response.status >= 500;
    const shouldRetry = (isRateLimit || isTransient) && attempt < maxAttempts - 1;
    if (shouldRetry) {
      await sleep(getRetryDelayMs(response, attempt));
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    let errorMessage = `API Error: ${response ? response.status : 'unknown'}`;
    try {
      const error = await response.json();
      errorMessage = error.error?.message || error.message || errorMessage;
    } catch (e) {
      try {
        const text = await response.text();
        if (text) errorMessage = text.slice(0, 200);
      } catch (inner) {
        // keep default errorMessage
      }
    }

    if (response && response.status === 429) {
      errorMessage = `Rate limit hit. Wait a bit or switch provider/model. Details: ${errorMessage}`;
    } else if (response && response.status === 402) {
      errorMessage = `Payment Required: Your account balance is too low for this request. ${errorMessage}. Please add credits at https://openrouter.ai/credits or switch to a free model.`;
    }
    const err = new Error(errorMessage);
    if (response) err.code = response.status;
    throw err;
  }

  const data = await response.json();

  if (!data || !data.choices || data.choices.length === 0) {
    console.error(`${provider} returned no choices:`, data);
    throw new Error(`${provider} returned no response for model: ${model}. Verify your API key and model compatibility.`);
  }

  const content = data.choices[0].message?.content;
  const reasoning = data.choices[0].message?.reasoning; // Capture reasoning output just in case

  if (reasoning) {
    console.log("AI Reasoning Trace:", reasoning);
  }




  if (content === undefined || content === null || content === "") {
    console.error(`${provider} returned empty content:`, data);
    const errorTip = (provider !== 'openrouter' && model.includes('/'))
      ? " TIP: You are using an OpenRouter model ID with a different provider. Switch back to OpenRouter or pick a compatible model."
      : " This can happen if the model is overloaded, the prompt was filtered, or the model ID is incompatible with the provider.";
    throw new Error(`AI model (${model}) returned an empty response.${errorTip}`);
  }




  console.log("AI Raw Content:", content); // Log the raw content for debugging

  return content;
};

const extractJson = (text) => {
  if (!text || !text.trim()) {
    throw new Error("Empty response from AI");
  }

  // 1. Initial Pre-processing
  let processedText = text.replace(/<think>[\s\S]*?<\/think>/g, '');

  // Normalize "smart" characters and non-standard symbols
  processedText = processedText
    .replace(/[\u201C\u201D]/g, '"') // Smart quotes
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/\u2011/g, '-')         // Non-breaking hyphen
    .replace(/[\u2013\u2014]/g, '-')  // En/em dashes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Strip illegal control chars
    .trim();

  // 2. Helper: The "Nuclear" Try-Parse
  const tryParse = (str) => {
    let cleaned = str.trim();
    if (!cleaned) return null;

    // a. Basic Syntax Fixes
    cleaned = cleaned
      .replace(/,\s*([}\]])/g, '$1') // Trailing commas
      .replace(/\n(?!(?:[^"]*"[^"]*")*[^"]*$)/g, '\\n'); // Unescaped newlines in strings

    // b. Defensive Quote Fixing
    // Tries to escape internal quotes in string values
    const fixQuotes = (s) => {
      // Match pattern like "key": "value" and grab the value part
      return s.replace(/:\s*"([\s\S]*?)"\s*([,}])/g, (match, p1, p2) => {
        const escaped = p1.replace(/(?<!\\)"/g, '\\"');
        return `: "${escaped}"${p2}`;
      });
    };

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      try {
        return JSON.parse(fixQuotes(cleaned));
      } catch (innerE) {
        try {
          // Final attempt: strip all remaining suspect control chars inside strings
          const sane = cleaned.replace(/[\x00-\x1F]/g, (c) =>
            ['\n', '\r', '\t'].includes(c) ? `\\${c === '\n' ? 'n' : c === '\r' ? 'r' : 't'}` : '');
          return JSON.parse(sane);
        } catch (finalE) {
          return null;
        }
      }
    }
  };

  // 3. Extraction Strategies
  try {
    // Find main boundaries
    const firstBracket = processedText.indexOf('[');
    const firstBrace = processedText.indexOf('{');

    let start = -1;
    let type = '';

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      start = firstBracket;
      type = 'array';
    } else if (firstBrace !== -1) {
      start = firstBrace;
      type = 'object';
    }

    if (start !== -1) {
      const lastBracket = processedText.lastIndexOf(']');
      const lastBrace = processedText.lastIndexOf('}');
      let end = (type === 'array') ? lastBracket : lastBrace;

      // Strategy A: Standard Delimited + Backtracking
      if (end !== -1 && end > start) {
        const candidate = processedText.substring(start, end + 1);
        const result = tryParse(candidate);
        if (result) return result;

        // Backtrack if 'end' was likely a nested brace
        if (type === 'array') {
          let searchPos = end;
          while (searchPos > start) {
            searchPos = processedText.lastIndexOf('}', searchPos - 1);
            if (searchPos === -1) break;
            const res = tryParse(processedText.substring(start, searchPos + 1) + ']');
            if (res) return res;
          }
        }
      }

      // Strategy B: Truncation Recovery
      if (end === -1 || end < start) {
        let partial = processedText.substring(start);
        if (type === 'array') {
          let searchPos = partial.length;
          while (searchPos > 0) {
            searchPos = partial.lastIndexOf('}', searchPos - 1);
            if (searchPos === -1) break;
            const res = tryParse(partial.substring(0, searchPos + 1) + ']');
            if (res) return res;
          }
        } else {
          const res = tryParse(partial + '}');
          if (res) return res;
        }
      }
    }

    // Strategy C: Regex-based individual object recovery (The "Indestructible" Layer)
    // This rescues objects even from mangled text strings
    const rescues = [];
    const objRegex = /{[^{}]*"title"\s*:\s*"[^"]*"[\s\S]*?}/g;
    let match;
    while ((match = objRegex.exec(processedText)) !== null) {
      const res = tryParse(match[0]);
      if (res) rescues.push(res);
    }
    if (rescues.length > 0) return rescues;

    // Strategy D: Last ditch "Nuclear" Regex Extraction 
    // Manually build objects from property-like matches
    const manualRescues = [];
    const blockRegex = /{[^}]*}/g;
    let block;
    while ((block = blockRegex.exec(processedText)) !== null) {
      const bText = block[0];
      const title = (bText.match(/"title"\s*:\s*"([^"]*)"/) || [null, null])[1];
      if (title) {
        manualRescues.push({
          title: title,
          year: (bText.match(/"year"\s*:\s*"([^"]*)"/) || [null, ""])[1],
          genres: (bText.match(/"genres"\s*:\s*\[([^\]]*)\]/) || [null, ""])[1].split(',').map(g => g.replace(/"/g, '').trim()).filter(g => g),
          reason: (bText.match(/"reason"\s*:\s*"([^"]*)"/) || [null, ""])[1],
          description: (bText.match(/"description"\s*:\s*"([^"]*)"/) || [null, ""])[1]
        });
      }
    }
    if (manualRescues.length > 0) return manualRescues;

    throw new Error("Indestructible parser could not rescue any valid data");

  } catch (err) {
    console.error("Critical JSON Parse Failure:", err);
    const preview = text.length > 2000 ? text.substring(0, 2000) + "..." : text;
    console.debug("AI Response Preview (Raw):", preview);
    throw new Error(`JSON Rescue Failed: ${err.message}`);
  }
};

export const getRecommendations = async (watchlistDescriptionOrList, apiKey, excludeList = [], customInstructions = [], count = 5, provider = 'openrouter', signal = null, model = null) => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  // Handle both string description (legacy) and array of objects (new)
  let watchlistPromptPart = "";
  if (Array.isArray(watchlistDescriptionOrList)) {
    if (watchlistDescriptionOrList.length === 0) throw new Error("Watchlist is empty");

    watchlistPromptPart = watchlistDescriptionOrList.map(item => {
      const title = item.title || item;
      const genres = item.genres ? ` (${item.genres.join(', ')})` : '';
      const note = item.note ? ` [User Note: "${item.note}"]` : '';
      return `- ${title}${genres}${note}`;
    }).join('\n');
  } else {
    if (!watchlistDescriptionOrList) throw new Error("Watchlist is empty");
    watchlistPromptPart = watchlistDescriptionOrList;
  }

  const excludeClause = excludeList.length > 0
    ? `IMPORTANT: Do NOT recommend any of the following titles.
    ${excludeList.map(a => {
      const title = a.title || a;
      const reason = a.reason ? `(User Reason: "${a.reason}")` : '(Already in collection)';
      return `- ${title} ${reason}`;
    }).join('\n    ')}`
    : '';

  const prompt = `
    Based on the following user watchlist and preferences, recommend EXACTLY ${count} anime series. 
    It is CRITICAL that you return exactly ${count} recommendations, no more and no less.

    User's Watchlist:
    ${watchlistPromptPart}
    
    ${excludeClause}

    ${Array.isArray(customInstructions) && customInstructions.length > 0
      ? `USER's ADDITIONAL INSTRUCTIONS:
${customInstructions.filter(i => i.trim()).map(i => {
        let clean = i.trim();
        if (clean.toUpperCase().startsWith('[ALWAYS]')) {
          clean = clean.substring(8).trim();
        }
        return `- ${clean}`;
      }).join('\n')}`
      : customInstructions && typeof customInstructions === 'string'
        ? `USER's ADDITIONAL INSTRUCTIONS: ${customInstructions.startsWith('[ALWAYS]') ? customInstructions.substring(8).trim() : customInstructions}`
        : ''}
    
    Return a strictly valid JSON response with the following schema:
    [
      {
        "title": "Anime Title",
        "year": "Release Year (e.g. 2023)",
        "genres": ["Genre1", "Genre2"],
        "reason": "A 2-sentence explanation of why this fits the user's taste, specifically referencing their notes if applicable.",
        "description": "A brief 1-sentence plot summary."
      }
    ]

    Do not include any markdown formatting (like \`\`\`json) in the response, just the raw JSON array.
    Make the recommendations diverse but relevant. Focus on high-quality productions.
  `;

  try {
    console.log("[DEBUG] Calling AI with prompt...");
    const text = await callAI(prompt, apiKey, provider, signal, model);
    console.log("[DEBUG] AI text received. Length:", text.length);
    console.log("[DEBUG] AI text preview:", text.substring(0, 100));

    const data = extractJson(text);
    console.log("[DEBUG] Extracted JSON data type:", typeof data);
    console.log("[DEBUG] Extracted JSON data isArray:", Array.isArray(data));
    console.log("[DEBUG] Extracted JSON data length:", Array.isArray(data) ? data.length : 'N/A');

    if (!Array.isArray(data)) {
      throw new Error("AI response format invalid: Expected an array of recommendations.");
    }

    return data.map((item, idx) => ({
      ...item,
      id: `rec-${Date.now()}-${idx}`
    }));
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    console.error("AI Service Error Details:", error);
    throw new Error(`${provider.toUpperCase()} API Error: ${error.message}. Please check your API key, model availability, or try again later.`);
  }
};

export const getAnimeInfo = async (title, apiKey, provider = 'openrouter', instructions = [], model = null) => {
  if (!apiKey) {
    return { title, genres: [], description: "Add API key to load details" };
  }

  const prompt = `Provide detailed information about the anime "${title}" in JSON format.
  Return ONLY a JSON object with: 
  {
    "title": "Anime Title",
    "genres": ["Genre1", "Genre2"],
    "description": "Short description of the plot",
    "year": 20XX,
    "averageScore": 85
  }
  
  ${Array.isArray(instructions) && instructions.length > 0
      ? `Specific Instructions:\n${instructions.map(i => {
        let clean = i.trim();
        if (clean.toUpperCase().startsWith('[ALWAYS]')) {
          clean = clean.substring(8).trim();
        }
        return `- ${clean}`;
      }).join('\n')}`
      : ""
    }
  
  Do not include any commentary, thoughts, or markdown boxes. Just the JSON.`;

  try {
    const text = await callAI(prompt, apiKey, provider, null, model);
    return extractJson(text);
  } catch (error) {
    return { title, genres: [], description: "Could not load details" };
  }
};

export const fetchModels = async (provider, apiKeys = {}) => {
  try {
    const url = MODEL_URLS[provider];
    const headers = {};

    if (provider === 'groq' && apiKeys.groq) {
      headers["Authorization"] = `Bearer ${apiKeys.groq}`;
    } else if (provider === 'cerebras' && apiKeys.cerebras) {
      headers["Authorization"] = `Bearer ${apiKeys.cerebras}`;
    } else if (provider === 'mistral' && apiKeys.mistral) {
      headers["Authorization"] = `Bearer ${apiKeys.mistral}`;
    }

    const response = await fetch(url, { headers });
    const data = await response.json();

    const modelsData = data.data || data;
    if (!Array.isArray(modelsData)) return [];

    return modelsData.map(m => {
      let contextLength = 0;
      let maxCompletionTokens = 0;

      if (provider === 'openrouter') {
        contextLength = m.context_length || 0;
        // OpenRouter exposes max output tokens via top_provider
        maxCompletionTokens = m.top_provider?.max_completion_tokens || 0;
      } else if (provider === 'groq' || provider === 'cerebras') {
        contextLength = m.context_window || 0;
        // Groq/Cerebras don't expose max output tokens in their models endpoint.
        // Use a safe default: typically much smaller than context_window.
        // Common Groq limits: 8192, 16384, 32768 depending on model.
        maxCompletionTokens = 0; // Will be handled by fallback logic
      } else if (provider === 'mistral') {
        contextLength = m.max_context_length || 0;
        maxCompletionTokens = m.max_completion_tokens || 0;
      }

      return {
        id: m.id,
        name: m.name || m.id,
        contextLength: parseInt(contextLength) || 0,
        maxCompletionTokens: parseInt(maxCompletionTokens) || 0
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error(`Failed to fetch models for ${provider}:`, error);
    return [];
  }
};
