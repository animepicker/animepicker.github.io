// Demographics to prioritize
const DEMOGRAPHICS = ['Shounen', 'Shonen', 'Seinen', 'Shoujo', 'Shojo', 'Josei', 'Kids', 'Kodomomuke'];

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
