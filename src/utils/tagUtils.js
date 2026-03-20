// Demographics to prioritize
export const DEMOGRAPHICS = ['Shounen', 'Shonen', 'Seinen', 'Shoujo', 'Shojo', 'Josei', 'Kids', 'Kodomomuke'];

// Map of lowercase demographic to canonical form for normalization
const DEMOGRAPHIC_NORMALIZATION = {
    'shounen': 'Shounen',
    'shonen': 'Shounen',
    'seinen': 'Seinen',
    'shoujo': 'Shoujo',
    'shojo': 'Shoujo',
    'josei': 'Josei',
    'kids': 'Kids',
    'kodomomuke': 'Kodomomuke'
};

/**
 * Validates and filters demographic values against the standard MyAnimeList demographic list.
 * Returns only valid demographics, normalized to canonical form.
 * @param {string[]} demographics - Array of demographic strings to validate
 * @returns {string[]} - Filtered array of valid, normalized demographics
 */
export const validateDemographics = (demographics) => {
    if (!demographics || !Array.isArray(demographics)) return [];

    return demographics
        .filter(d => d && typeof d === 'string')
        .map(d => {
            const normalized = DEMOGRAPHIC_NORMALIZATION[d.toLowerCase()];
            return normalized || null;
        })
        .filter(d => d !== null);
};

/**
 * Formats tags by prioritizing demographics and limiting the visible count.
 * @param {string[]} tags - Array of tag strings
 * @param {number} maxVisible - Maximum number of tags to show (default 2)
 * @returns {object} - { visibleTags: string[], remainingCount: number }
 */
export const formatTags = (tags, maxVisible = 2) => {
    if (!tags || !Array.isArray(tags)) return { visibleTags: [], remainingCount: 0 };

    // 1. Separate demographics from other genres
    const demographicTags = [];
    const otherTags = [];

    // Normalize check
    tags.forEach(tag => {
        // Simple case-insensitive check
        const isDemographic = DEMOGRAPHICS.some(d => d.toLowerCase() === tag.toLowerCase());
        if (isDemographic) {
            demographicTags.push(tag);
        } else {
            otherTags.push(tag);
        }
    });

    // 2. Combine: Demographics first, then others
    // basic optimization: if we have multiple demographics, we just preserve their relative order
    // if we want specific demographics order, we could sort demographicTags based on DEMOGRAPHICS index
    const sortedTags = [...demographicTags, ...otherTags];

    // 3. Slice
    const visibleTags = sortedTags.slice(0, maxVisible);
    const remainingCount = Math.max(0, sortedTags.length - maxVisible);

    return { visibleTags, remainingCount };
};
