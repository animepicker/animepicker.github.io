export const WATCH_PROVIDERS = {
    'miruro': {
        id: 'miruro',
        name: 'Miruro',
        getUrl: (title) => `https://www.miruro.bz/search?query=${encodeURIComponent(title)}&type=ANIME&sort=POPULARITY_DESC`
    },
    'hianime': {
        id: 'hianime',
        name: 'HiAnime',
        getUrl: (title) => `https://hianime.to/search?keyword=${encodeURIComponent(title)}`
    }
};

export const DEFAULT_WATCH_PROVIDER = 'miruro';
