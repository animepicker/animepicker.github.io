// Service for persistent tag enrichment queue
// Handles background enrichment of anime items with demographics/genres from Jikan API

const ENRICHMENT_QUEUE_KEY = 'anime_enrichment_queue';
const MAX_JOB_ATTEMPTS = 3;
const JOB_RETRY_DELAY = 60000; // 1 minute between retries

// Helper to get queue from localStorage
const getQueue = () => {
    try {
        const stored = localStorage.getItem(ENRICHMENT_QUEUE_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to load enrichment queue:', e);
        return [];
    }
};

// Helper to save queue to localStorage
const saveQueue = (queue) => {
    try {
        localStorage.setItem(ENRICHMENT_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.warn('Failed to save enrichment queue:', e);
    }
};

// Normalize title for comparison
const normalizeTitle = (title) => {
    if (!title) return '';
    return String(title).toLowerCase().trim()
        .replace(/[\(\[].*?[\)\]]/g, '')
        .replace(/season\s*\d+/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
};

// Check if a job already exists in queue
const jobExists = (queue, malId, title) => {
    const normalizedTitle = normalizeTitle(title);

    return queue.some(job => {
        if (malId && job.malId === malId) return true;
        if (!malId && job.normalizedTitle === normalizedTitle) return true;
        return false;
    });
};

// Add a new enrichment job to the queue
export const enqueueEnrichmentJob = (item) => {
    if (!item) return;

    const malId = item.mal_id || item.malId || null;
    const title = item.title;

    if (!title) return;

    const queue = getQueue();

    // Deduplication: Check if job already exists
    if (jobExists(queue, malId, title)) {
        console.log(`Enrichment job already queued for: ${title}`);
        return;
    }

    const job = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        malId,
        title,
        normalizedTitle: normalizeTitle(title),
        status: 'pending', // pending, processing, completed, failed
        attempts: 0,
        maxAttempts: MAX_JOB_ATTEMPTS,
        nextAttemptAt: Date.now(),
        createdAt: Date.now(),
        listType: item.listType || null // 'library', 'watchlist', 'recommendations'
    };

    queue.push(job);
    saveQueue(queue);
    console.log(`Enqueued enrichment job for: ${title}`);

    // Try to process queue if not already processing
    processQueue();
};

// Remove a job from queue after processing
const removeJob = (jobId) => {
    const queue = getQueue();
    const newQueue = queue.filter(job => job.id !== jobId);
    saveQueue(newQueue);
};

// Update job status
const updateJobStatus = (jobId, updates) => {
    const queue = getQueue();
    const jobIndex = queue.findIndex(job => job.id === jobId);
    if (jobIndex === -1) return;

    queue[jobIndex] = { ...queue[jobIndex], ...updates };
    saveQueue(queue);
};

// Process the enrichment queue
let isProcessing = false;

export const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
        const queue = getQueue();
        const now = Date.now();

        // Find pending jobs that are ready to be processed
        const pendingJobs = queue.filter(job =>
            job.status === 'pending' &&
            job.attempts < job.maxAttempts &&
            job.nextAttemptAt <= now
        );

        if (pendingJobs.length === 0) {
            isProcessing = false;
            return;
        }

        console.log(`Processing ${pendingJobs.length} enrichment jobs...`);

        for (const job of pendingJobs) {
            // Mark as processing
            updateJobStatus(job.id, { status: 'processing' });

            try {
                // Jikan-first: Try to get details from Jikan
                const { getAnimeDetails } = await import('./jikanService');
                const details = await getAnimeDetails(job.title);

                console.log(`[Enrichment] Got Jikan details for: ${job.title}`, { details });

                const demographics = details?.demographics?.map(d => d.name) || [];
                const genres = details?.genres?.map(g => g.name) || [];
                console.log(`[Enrichment] Demographics: ${demographics}, Genres: ${genres}`);

                // Check if Jikan has data
                if (demographics.length > 0 || genres.length > 0) {
                    // Merge Jikan data
                    await mergeEnrichmentData(job, {
                        mal_id: details?.mal_id,
                        genres: [...demographics, ...genres],
                        demographics
                    });
                }

                // If Jikan has demographics, we're done
                if (demographics.length > 0) {
                    updateJobStatus(job.id, {
                        status: 'completed',
                        nextAttemptAt: Date.now() + JOB_RETRY_DELAY
                    });
                    removeJob(job.id);
                    console.log(`Enrichment completed for: ${job.title}`);
                    continue;
                }

                // Jikan has no demographics - try AI fallback to infer demographic
                console.log(`[Enrichment] Jikan has no demographics for: ${job.title}, trying AI fallback to infer demographic`);

                // If Jikan didn't return demographics (or no data at all), try AI fallback
                // Check if demographics are still missing
                const { getAnimeInfo } = await import('./aiService');
                const { getUserInstructions } = await import('./authService');

                // Get user's selected AI provider from localStorage
                const aiProvider = localStorage.getItem('ai_provider') || 'openrouter';
                const apiKey = localStorage.getItem(`${aiProvider}_api_key`) || '';

                // Get custom instructions for the current user, filtered to [ALWAYS] instructions
                const currentUsername = localStorage.getItem('anime_current_user');
                const userInstructions = currentUsername ? getUserInstructions(currentUsername) : [];
                const alwaysInstructions = userInstructions.filter(i =>
                    i && typeof i === 'string' && i.trim().toUpperCase().startsWith('[ALWAYS]')
                );

                if (apiKey) {
                    // Pass null for model to use provider's default model
                    const aiData = await getAnimeInfo(job.title, apiKey, aiProvider, alwaysInstructions, null);

                    const hasAiDemographics = aiData?.demographics && aiData.demographics.length > 0;
                    const hasAiGenres = aiData?.genres && aiData.genres.length > 0;

                    if (aiData && (hasAiGenres || hasAiDemographics)) {
                        await mergeEnrichmentData(job, {
                            genres: aiData.genres,
                            demographics: aiData.demographics
                        });

                        updateJobStatus(job.id, {
                            status: 'completed',
                            nextAttemptAt: Date.now() + JOB_RETRY_DELAY
                        });
                        removeJob(job.id);

                        console.log(`AI enrichment completed for: ${job.title}`);
                        continue;
                    }
                }

                // No data found, increment attempts
                throw new Error('No enrichment data found');

            } catch (error) {
                console.warn(`Enrichment failed for ${job.title}:`, error.message);

                const newAttempts = job.attempts + 1;

                if (newAttempts >= job.maxAttempts) {
                    // Max attempts reached, mark as failed
                    updateJobStatus(job.id, {
                        status: 'failed',
                        attempts: newAttempts
                    });
                    removeJob(job.id);
                    console.log(`Enrichment permanently failed for: ${job.title}`);
                } else {
                    // Schedule retry
                    updateJobStatus(job.id, {
                        status: 'pending',
                        attempts: newAttempts,
                        nextAttemptAt: Date.now() + JOB_RETRY_DELAY
                    });
                }
            }

            // Small delay between processing jobs
            await new Promise(resolve => setTimeout(resolve, 500));
        }

    } catch (error) {
        console.error('Error processing enrichment queue:', error);
    } finally {
        isProcessing = false;

        // Check if there are more jobs to process after a delay
        const queue = getQueue();
        const hasMorePending = queue.some(job =>
            job.status === 'pending' &&
            job.attempts < job.maxAttempts
        );

        if (hasMorePending) {
            setTimeout(processQueue, 5000);
        }
    }
};

// Merge enrichment data into the actual item in library/watchlist/recommendations
const mergeEnrichmentData = async (job, enrichmentData) => {
    try {
        console.log(`[Enrichment] Merging data for: ${job.title}`, { job, enrichmentData });

        // Get the auth service functions
        const { getCurrentUser, getUserLibrary, saveUserLibrary,
            getUserWatchlist, saveUserWatchlist,
            getUserRecommendations, saveUserRecommendations } = await import('./authService');

        const user = getCurrentUser();
        if (!user) {
            console.warn('[Enrichment] No user found, cannot merge');
            return;
        }

        const username = user.username || user;
        console.log(`[Enrichment] Username: ${username}`);

        // Get the appropriate list based on listType
        let listType = job.listType;
        if (!listType) {
            // Try to determine which list the item is in
            const library = getUserLibrary(username);
            const watchlist = getUserWatchlist(username);
            const recommendations = getUserRecommendations(username);

            const normalizedTitle = normalizeTitle(job.title);

            if (library.some(item => normalizeTitle(item.title) === normalizedTitle)) {
                listType = 'library';
            } else if (watchlist.some(item => normalizeTitle(item.title) === normalizedTitle)) {
                listType = 'watchlist';
            } else if (recommendations.some(item => normalizeTitle(item.title) === normalizedTitle)) {
                listType = 'recommendations';
            } else {
                console.warn(`[Enrichment] Could not find item in any list: ${job.title}`);
                return;
            }
        }

        console.log(`[Enrichment] Found item in list: ${listType}`);

        // Find and update the item
        const findAndUpdateItem = (items) => {
            return items.map(item => {
                const itemTitle = normalizeTitle(item.title);
                if (itemTitle === job.normalizedTitle ||
                    (enrichmentData.mal_id && item.mal_id === enrichmentData.mal_id)) {

                    // Merge semantics: never overwrite existing non-empty genres with empty result
                    const existingGenres = item.genres || [];
                    const newGenres = enrichmentData.genres || [];

                    // Only add new genres that don't exist
                    const mergedGenres = [...existingGenres];
                    newGenres.forEach(g => {
                        if (!mergedGenres.some(existing =>
                            existing.toLowerCase() === g.toLowerCase())) {
                            mergedGenres.push(g);
                        }
                    });

                    return {
                        ...item,
                        mal_id: enrichmentData.mal_id || item.mal_id,
                        genres: mergedGenres.length > 0 ? mergedGenres : item.genres,
                        demographics: (enrichmentData.demographics && enrichmentData.demographics.length > 0) ? enrichmentData.demographics : item.demographics
                    };
                }
                return item;
            });
        };

        switch (listType) {
            case 'library': {
                const library = getUserLibrary(username);
                const updatedLibrary = findAndUpdateItem(library);
                saveUserLibrary(username, updatedLibrary);
                // Dispatch event to notify React app to refresh
                window.dispatchEvent(new CustomEvent('anime-enriched', { detail: { listType: 'library', items: updatedLibrary } }));
                break;
            }
            case 'watchlist': {
                const watchlist = getUserWatchlist(username);
                const updatedWatchlist = findAndUpdateItem(watchlist);
                saveUserWatchlist(username, updatedWatchlist);
                // Dispatch event to notify React app to refresh
                window.dispatchEvent(new CustomEvent('anime-enriched', { detail: { listType: 'watchlist', items: updatedWatchlist } }));
                break;
            }
            case 'recommendations': {
                const recommendations = getUserRecommendations(username);
                const updatedRecommendations = findAndUpdateItem(recommendations);
                saveUserRecommendations(username, updatedRecommendations);
                // Dispatch event to notify React app to refresh
                window.dispatchEvent(new CustomEvent('anime-enriched', { detail: { listType: 'recommendations', items: updatedRecommendations } }));
                break;
            }
        }

    } catch (error) {
        console.error('Error merging enrichment data:', error);
    }
};

// Get queue status (for debugging)
export const getQueueStatus = () => {
    const queue = getQueue();
    return {
        total: queue.length,
        pending: queue.filter(j => j.status === 'pending').length,
        processing: queue.filter(j => j.status === 'processing').length,
        failed: queue.filter(j => j.status === 'failed').length
    };
};

// Clear all pending jobs
export const clearQueue = () => {
    saveQueue([]);
    console.log('Enrichment queue cleared');
};

// Initialize queue processing on app load
export const initializeEnrichmentQueue = () => {
    console.log('Initializing enrichment queue...');
    processQueue();
};
