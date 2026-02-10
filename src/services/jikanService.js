// Service to fetch anime data from Jikan API (MyAnimeList)
// Rate limit handling with aggressive resilience strategies

const JIKAN_API_URL = "https://api.jikan.moe/v4/anime";
const KITSU_API_URL = "https://kitsu.io/api/edge/anime";

// Persistent Cache Key
const CACHE_KEY = "anime_image_cache";

// Helper to get persistent cache
const getPersistentCache = () => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return new Map();
        const data = JSON.parse(cached);
        return new Map(data);
    } catch (e) {
        console.error("Failed to load image cache:", e);
        return new Map();
    }
};

const imageCache = getPersistentCache();

// Debounced save
let saveTimeout = null;
const saveCache = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const data = Array.from(imageCache.entries());
            if (data.length > 500) data.splice(0, data.length - 500);
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn("Failed to save image cache:", e);
        }
    }, 2000);
};

// Queue & Concurrency Management
const queue = [];
let activeRequests = 0;
const MAX_CONCURRENT = 2; // Reduced to minimize pressure
const MIN_SPACING = 1000; // Strict 1s between any requests
let lastRequestTime = 0;
const pendingPromises = new Map();

// Resilience State
let backoffDelay = 0;
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_TIME = 30000; // 30s pause on circuit break
let circuitBrokenUntil = 0;

const fetchFromJikan = async (query) => {
    try {
        const response = await fetch(`${JIKAN_API_URL}?q=${encodeURIComponent(query)}&limit=1`);

        if (response.status === 429) return { status: 429 };
        if (response.status >= 500) return { status: response.status };

        if (!response.ok) throw new Error(`Jikan API Error: ${response.status}`);

        const data = await response.json();
        const result = data.data?.[0];
        if (!result) return null;

        return result.images?.jpg?.large_image_url || result.images?.jpg?.image_url || null;
    } catch (error) {
        return { status: 'NETWORK_ERROR' };
    }
};

const fetchFromKitsu = async (query) => {
    try {
        const response = await fetch(`${KITSU_API_URL}?filter[text]=${encodeURIComponent(query)}&page[limit]=1`);

        if (!response.ok) return null;

        const data = await response.json();
        const result = data.data?.[0];

        if (!result) return null;

        return result.attributes?.posterImage?.original || result.attributes?.posterImage?.large || null;
    } catch (error) {
        console.warn("Kitsu API fallback failed:", error);
        return null;
    }
};

const processQueue = async () => {
    // Basic guards
    if (activeRequests >= MAX_CONCURRENT || queue.length === 0) return;

    // Circuit Breaker guard
    const now = Date.now();
    if (now < circuitBrokenUntil) {
        const wait = circuitBrokenUntil - now;
        console.warn(`Circuit breaker active. Pausing all requests for ${Math.round(wait / 1000)}s...`);
        setTimeout(processQueue, Math.min(wait, 5000));
        return;
    }

    // Strict spacing guard
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < MIN_SPACING) {
        setTimeout(processQueue, MIN_SPACING - timeSinceLast);
        return;
    }

    activeRequests++;
    const request = queue.shift();
    const { resolve, title, retryCount = 0 } = request;

    // Last-mile cache check: If another request for this title succeeded while this was queued
    // or while it was waiting for retry, resolve immediately.
    if (imageCache.has(title)) {
        resolve(imageCache.get(title));
        activeRequests--;
        if (activeRequests < MAX_CONCURRENT) processQueue();
        return;
    }

    lastRequestTime = Date.now();

    // Extra buffer if we're in backoff mode
    const effectiveDelay = backoffDelay > 0 ? backoffDelay + (Math.random() * 2000) : 0;
    if (effectiveDelay > 0) {
        await new Promise(r => setTimeout(r, effectiveDelay));
    }

    try {
        let result = await fetchFromJikan(title);

        // Handle temporary failures (429, 5xx, Network)
        if (result && (typeof result === 'object' && result.status)) {
            consecutiveFailures++;
            const isRateLimit = result.status === 429;
            const isTimeout = result.status === 504 || result.status === 503;

            // Trigger Circuit Breaker if failure rate is high
            if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
                console.error("Multiple Jikan API failures detected. Activating Circuit Breaker.");
                circuitBrokenUntil = Date.now() + CIRCUIT_BREAKER_RESET_TIME;
                consecutiveFailures = 0;
                backoffDelay = 0;
            }

            if (retryCount < 6) {
                // Jittered Exponential Backoff: (2^retry * 2000) + random jitter
                const jitter = Math.random() * 2000;
                const baseDelay = Math.pow(2, retryCount) * 2000;
                const delay = baseDelay + jitter;

                if (isRateLimit || isTimeout) {
                    backoffDelay = Math.max(backoffDelay, baseDelay);
                }

                console.warn(`Jikan API Error ${result.status} for "${title}". retry ${retryCount + 1}/6 in ${Math.round(delay)}ms`);

                setTimeout(() => {
                    queue.push({ ...request, retryCount: retryCount + 1 });
                    processQueue();
                }, delay);

                // Gradually cool down backoff
                setTimeout(() => { backoffDelay = Math.max(0, backoffDelay - 2000); }, delay + 10000);
            } else {
                console.error(`Giving up on Jikan for "${title}" after 6 retries. Switch to Fallback.`);
                // Don't resolve null yet, try fallback
            }
            // If we are here, Jikan failed seriously (retries exhausted or severe error)
            // Fall through to try Kitsu
        }

        if (result && typeof result === 'string') {
            // Jikan Success
            consecutiveFailures = 0;
        } else {
            // Jikan Failed or returned null - Try Kitsu Fallback
            console.log(`Trying Kitsu fallback for "${title}"...`);
            const kitsuResult = await fetchFromKitsu(title);

            if (kitsuResult) {
                result = kitsuResult;
                consecutiveFailures = 0; // Reset failures since we found an image
            } else {
                result = null;
            }
        }

        // Success Path
        let imageUrl = typeof result === 'string' ? result : null;

        // Clean-up fallback if first try failed (but connection was ok)
        if (!imageUrl) {
            const cleanTitle = title
                .replace(/[\(\[].*?[\)\]]/g, '')
                .replace(/season\s*\d+/gi, '')
                .trim();

            if (cleanTitle !== title) {
                // Try Jikan again with clean title
                imageUrl = await fetchFromJikan(cleanTitle);

                // If Jikan fails again, try Kitsu with clean title
                if (typeof imageUrl !== 'string') {
                    imageUrl = await fetchFromKitsu(cleanTitle);
                }
            }
        }

        if (imageUrl) {
            imageCache.set(title, imageUrl);
            saveCache();
        }
        resolve(imageUrl || null);

    } catch (error) {
        console.error(`Unexpected error:`, error);
        resolve(null);
    } finally {
        activeRequests--;
        setTimeout(processQueue, MIN_SPACING);
    }

    // Try starting another concurrent request if allowed
    if (activeRequests < MAX_CONCURRENT) processQueue();
};

export const getAnimeImage = (title) => {
    if (!title) return Promise.resolve(null);
    if (imageCache.has(title)) return Promise.resolve(imageCache.get(title));

    // Deduplication: If a request for this title is already in flight, return the shared promise.
    if (pendingPromises.has(title)) {
        return pendingPromises.get(title);
    }

    const promise = new Promise((resolve) => {
        queue.push({ resolve, title });
        processQueue();
    });

    pendingPromises.set(title, promise);

    // Clean up pending entry when done (success or fail)
    promise.finally(() => {
        pendingPromises.delete(title);
    });

    return promise;
};
