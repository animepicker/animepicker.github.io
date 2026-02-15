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

        if (response.status === 429) return { error: true, status: 429 };
        if (response.status >= 500) return { error: true, status: response.status };

        if (!response.ok) throw new Error(`Jikan API Error: ${response.status}`);

        const data = await response.json();
        const result = data.data?.[0];
        if (!result) return null;

        // Return full object instead of just image URL
        return {
            mal_id: result.mal_id,
            url: result.url,
            images: result.images,
            title: result.title,
            title_english: result.title_english,
            title_japanese: result.title_japanese,
            type: result.type,
            source: result.source,
            episodes: result.episodes,
            status: result.status,
            airing: result.airing,
            aired: result.aired,
            duration: result.duration,
            rating: result.rating,
            score: result.score,
            scored_by: result.scored_by,
            rank: result.rank,
            popularity: result.popularity,
            members: result.members,
            favorites: result.favorites,
            synopsis: result.synopsis,
            background: result.background,
            season: result.season,
            year: result.year,
            broadcast: result.broadcast,
            producers: result.producers,
            licensors: result.licensors,
            studios: result.studios,
            genres: result.genres,
            explicit_genres: result.explicit_genres,
            themes: result.themes,
            demographics: result.demographics
        };
    } catch (error) {
        return { error: true, status: 'NETWORK_ERROR' };
    }
};

const fetchFromKitsu = async (query) => {
    try {
        const response = await fetch(`${KITSU_API_URL}?filter[text]=${encodeURIComponent(query)}&page[limit]=1`);

        if (!response.ok) return null;

        const data = await response.json();
        const result = data.data?.[0];

        if (!result) return null;

        // Return standardized object structure from Kitsu
        return {
            title: result.attributes?.canonicalTitle,
            synopsis: result.attributes?.synopsis,
            averageScore: result.attributes?.averageRating,
            year: result.attributes?.startDate ? new Date(result.attributes.startDate).getFullYear() : null,
            images: {
                jpg: {
                    image_url: result.attributes?.posterImage?.original || result.attributes?.posterImage?.large,
                    large_image_url: result.attributes?.posterImage?.large
                }
            }
        };
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
    const { resolve, title, retryCount = 0, fullDetails = false } = request;

    // Last-mile cache check: If another request for this title succeeded while this was queued
    // or while it was waiting for retry, AND we only want image, resolve immediately.
    if (!fullDetails && imageCache.has(title)) {
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
        if (result && result.error) {
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

        if (result && result.title) {
            // Jikan Success
            consecutiveFailures = 0;
        } else {
            // Jikan Failed or returned null - Try Kitsu Fallback
            console.log(`Trying Kitsu fallback for "${title}"...`);
            const kitsuResult = await fetchFromKitsu(title);

            if (kitsuResult) {
                result = kitsuResult;
                consecutiveFailures = 0; // Reset failures since we found an image/data
            } else {
                result = null;
            }
        }

        // Success Path
        // Extract image URL for cache
        const imageUrl = result?.images?.jpg?.large_image_url || result?.images?.jpg?.image_url || null;

        // Clean-up fallback if first try failed (but connection was ok)
        if (!result) {
            const cleanTitle = title
                .replace(/[\(\[].*?[\)\]]/g, '')
                .replace(/season\s*\d+/gi, '')
                .trim();

            if (cleanTitle !== title) {
                // Try Jikan again with clean title
                // Note: Recursive calls here is tricky with the queue, ideally we queue a new request
                // But for now keeping simple linear retry for cleanup
                let retryResult = await fetchFromJikan(cleanTitle);
                if (retryResult?.title) {
                    result = retryResult;
                } else {
                    retryResult = await fetchFromKitsu(cleanTitle);
                    if (retryResult) result = retryResult;
                }
            }
        }

        if (result) {
            const finalImageUrl = result?.images?.jpg?.large_image_url || result?.images?.jpg?.image_url;
            if (finalImageUrl) {
                imageCache.set(title, finalImageUrl);
                saveCache();
            }
        }

        if (fullDetails) {
            resolve(result);
        } else {
            resolve(result?.images?.jpg?.large_image_url || result?.images?.jpg?.image_url || null);
        }

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

    // Deduplication: If a request for this title is already in flight
    // AND it's not a full details request (which we can't easily piggyback on if we want simple image, or vice versa, 
    // but for now let's assume if it's pending, we wait)
    // Actually, if we have a pending full details request, it returns the object, NOT the string.
    // So we should be careful. For simplicity, we'll keep them separate or just check cache first.
    // To avoid complexity, we'll just push to queue.

    // Check pendingPromises map... 
    // Modification: pendingPromises now needs to track type of request?
    // For safety, let's just queue it. The queue has cache checks.

    return new Promise((resolve) => {
        queue.push({ resolve, title, fullDetails: false });
        processQueue();
    });
};

export const getAnimeDetails = (title) => {
    if (!title) return Promise.resolve(null);
    return new Promise((resolve) => {
        queue.push({ resolve, title, fullDetails: true });
        processQueue();
    });
};

export const searchAnime = async (query) => {
    if (!query || query.length < 3) return [];

    // Check if we have a recent cached search for this query to avoid spamming
    // Ideally we would cache search results too, but for now let's just hit the API with debouncing (handled in UI)

    try {
        const response = await fetch(`${JIKAN_API_URL}?q=${encodeURIComponent(query)}&limit=5`);
        if (!response.ok) return [];

        const data = await response.json();
        if (!data.data) return [];

        return data.data.map(item => ({
            mal_id: item.mal_id,
            title: item.title,
            image_url: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
            synopsis: item.synopsis,
            score: item.score,
            year: item.year || (item.aired?.from ? new Date(item.aired.from).getFullYear() : null),
            genres: item.genres?.map(g => g.name) || []
        }));
    } catch (error) {
        console.warn("Jikan search failed:", error);
        return [];
    }
};
