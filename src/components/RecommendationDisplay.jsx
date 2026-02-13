import { useState, useMemo, useRef, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayCircle, Image as ImageIcon, Heart, EyeOff, Sparkles, ArrowUpDown, ArrowUp, ArrowDown, X, Check, Plus, Calendar, Tag, Trash2, Search } from 'lucide-react';
import { getAnimeImage } from '../services/jikanService';
import { formatTags } from '../utils/tagUtils';

const RecommendationCard = memo(({ rec, index, onWatched, onRemove, onRemovePick, isInLibrary, isInWatchlist, onAddToWatchlist, onRemoveFromWatchlist, onClick, onExclude }) => {
    const [image, setImage] = useState(rec.image || null);
    const [isLoadingImage, setIsLoadingImage] = useState(!rec.image);

    const isAdded = isInLibrary(rec.title);
    const isInWatchlistState = isInWatchlist(rec.title);

    useEffect(() => {
        let mounted = true;

        const fetchImage = async () => {
            setIsLoadingImage(true);
            const url = await getAnimeImage(rec.title);
            if (mounted && url) {
                setImage(url);
            }
            setIsLoadingImage(false);
        };

        if (rec.image) {
            setImage(rec.image);
            setIsLoadingImage(false);
        } else {
            setImage(null);
            fetchImage();
        }

        return () => {
            mounted = false;
        };
    }, [rec.title, rec.image]);

    const isMobile = window.innerWidth <= 768;

    const content = (
        <div
            onClick={() => onClick(image)}
            className={`group relative bg-[#12121f] rounded-2xl overflow-hidden border border-white/5 transition-all duration-300 flex flex-col h-full cursor-pointer 
                ${isMobile ? 'low-power-card' : 'hover:border-violet-500/30 hover:shadow-[0_0_20px_rgba(124,58,237,0.1)]'}`}
        >
            {/* Portrait Image Area (Top) */}
            <div className="relative w-full aspect-[2/3] bg-black/50 border-b border-white/5 overflow-hidden">
                {image ? (
                    <img
                        src={image}
                        alt={rec.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700">
                        <ImageIcon size={32} />
                    </div>
                )}

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#12121f] via-transparent to-transparent opacity-60" />

                {/* Overlay Action Buttons */}
                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 z-10" onClick={(e) => e.stopPropagation()}>
                    {onAddToWatchlist && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isInWatchlistState) {
                                    onRemoveFromWatchlist && onRemoveFromWatchlist(null, rec.title);
                                } else {
                                    onAddToWatchlist({ ...rec, image: image || rec.image });
                                }
                            }}
                            className={`p-2 rounded-xl transition-all group/btn ${isInWatchlistState
                                ? 'bg-rose-600/20 text-rose-400 hover:bg-white hover:text-red-500 border border-rose-500/20 hover:border-red-500 shadow-lg shadow-rose-500/10'
                                : 'bg-black/60 hover:bg-rose-600 hover:text-white text-gray-300 shadow-lg'
                                } ${isAdded ? 'opacity-50 pointer-events-none' : ''}`}
                            disabled={isAdded}
                            title={isAdded ? 'Already in library' : (isInWatchlistState ? 'Remove from watchlist' : 'Add to watchlist')}
                        >
                            {isInWatchlistState ? (
                                <>
                                    <Heart size={16} className="fill-current group-hover/btn:hidden" />
                                    <X size={16} className="hidden group-hover/btn:block" />
                                </>
                            ) : (
                                <Heart size={16} />
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => isAdded ? onRemove(null, rec.title, false) : onWatched({ ...rec, image: image || rec.image })}
                        className={`p-2 rounded-xl transition-all group/btn ${isAdded
                            ? 'bg-green-600/20 text-green-400 hover:bg-white hover:text-red-500 border border-green-500/20 hover:border-red-500 shadow-lg shadow-green-500/10'
                            : 'bg-black/60 hover:bg-green-600 hover:text-white text-gray-300 shadow-lg'
                            } ${isInWatchlistState && !isAdded ? 'opacity-50 pointer-events-none' : ''}`}
                        disabled={isInWatchlistState && !isAdded}
                        title={isAdded ? 'Remove from library' : (isInWatchlistState ? 'Already in watchlist' : 'Add to library')}
                    >
                        {isAdded ? (
                            <>
                                <Check size={16} className="group-hover/btn:hidden" />
                                <X size={16} className="hidden group-hover/btn:block" />
                            </>
                        ) : (
                            <Plus size={16} />
                        )}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onExclude(rec);
                        }}
                        className="p-2 rounded-xl bg-black/60 hover:bg-gray-500 text-gray-300 hover:text-white shadow-lg transition-all"
                        title="Exclude from recommendations"
                    >
                        <EyeOff size={16} />
                    </button>
                    {onRemovePick && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemovePick(rec);
                            }}
                            className="p-2 rounded-xl bg-black/60 hover:bg-red-600 text-gray-300 hover:text-white shadow-lg transition-all"
                            title="Remove from picks"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area (Bottom) */}
            <div className="p-4 flex flex-col flex-grow relative z-10 w-full min-w-0">
                <div className="mb-2">
                    <div className="flex flex-col gap-2 mb-2">
                        <div className="flex h-1.5" />
                        {rec.year && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <Calendar size={12} className="text-pink-400" />
                                <span>{rec.year}</span>
                            </div>
                        )}
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-2 leading-tight">
                        {rec.title}
                    </h3>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                    {(() => {
                        const { visibleTags, remainingCount } = formatTags(rec.genres, 2);
                        return (
                            <>
                                {visibleTags.map((genre, i) => (
                                    <span
                                        key={i}
                                        className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10"
                                    >
                                        <Tag size={8} />
                                        {genre}
                                    </span>
                                ))}
                                {remainingCount > 0 && (
                                    <span className="text-[10px] text-gray-500 flex items-center px-1">
                                        +{remainingCount}
                                    </span>
                                )}
                            </>
                        );
                    })()}
                </div>

                {/* Watch Button */}
                <a
                    href={`https://hianime.to/search?keyword=${encodeURIComponent(rec.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-violet-600/10 hover:bg-violet-600 hover:text-white py-2.5 rounded-xl text-xs font-medium text-violet-300 transition-all border border-violet-500/20 hover:border-violet-500 mt-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <PlayCircle size={14} />
                    <span>Watch Now</span>
                </a>
            </div>
        </div>
    );

    if (isMobile) {
        return content;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
        >
            {content}
        </motion.div>
    );
});

export default function RecommendationDisplay({
    recommendations,
    onWatched,
    onRemove,
    onRemovePick,
    library,
    watchlist,
    onAddToWatchlist,
    onRemoveFromWatchlist,

    onClear,
    onExclude,
    enhancedMotion,
    searchQuery,
    onSearchChange,
    isInLibrary,
    isInWatchlist,
    onOpenDetails
}) {
    const [sortConfig, setSortConfig] = useState({ key: 'added', direction: 'asc' });
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [visibleCount, setVisibleCount] = useState(20);

    const dropdownRef = useRef(null);
    const loadMoreRef = useRef(null);

    // Intersection observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < recommendations.length) {
                    setVisibleCount(prev => Math.min(prev + 20, recommendations.length));
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [recommendations.length, visibleCount]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowSortDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setShowSortDropdown(false);
    };

    const sortedRecommendations = useMemo(() => {
        let filtered = recommendations ? [...recommendations] : [];

        if (searchQuery) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item => {
                if (!item) return false;
                const title = typeof item === 'string' ? item : item.title;
                return title && typeof title === 'string' && title.toLowerCase().includes(query);
            });
        }

        // Add original index for stable sort fallback
        const withIndex = filtered.map((item, idx) => ({ ...item, originalIndex: idx }));

        if (sortConfig.key === 'name') {
            withIndex.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortConfig.key === 'year') {
            withIndex.sort((a, b) => {
                const yA = parseInt(a.year) || 0;
                const yB = parseInt(b.year) || 0;
                return yA - yB;
            });
        } else {
            // 'added' - relies on original index (chronological order)
            withIndex.sort((a, b) => a.originalIndex - b.originalIndex);
        }

        if (sortConfig.direction === 'desc') {
            withIndex.reverse();
        }

        return withIndex;
    }, [recommendations, sortConfig, searchQuery]);

    const getSortLabel = () => {
        if (sortConfig.key === 'added') return 'Date Added';
        if (sortConfig.key === 'name') return 'Name';
        if (sortConfig.key === 'year') return 'Year';
        return 'Sort';
    };

    if (!recommendations || !Array.isArray(recommendations)) return null;

    if (!recommendations || !Array.isArray(recommendations)) return null;

    return (
        <>

            {recommendations.length === 0 ? (
                <div className="w-full max-w-6xl mx-auto mt-12 mb-20 px-4">
                    <div className="text-center py-20 px-6 bg-white/5 rounded-3xl border border-white/5">
                        <div className="bg-white/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                            <Sparkles size={32} className="text-pink-500/50" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No Recommendations Yet</h3>
                        <p className="text-gray-400 max-w-md mx-auto">
                            Generate some picks to see them here!
                        </p>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-6xl mx-auto mt-12 mb-20 px-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                            Picked For You <span className="text-pink-500">✨</span>
                        </h2>

                        <div className="flex items-center gap-2 w-full sm:max-w-md">
                            {/* Search Bar */}
                            <div className="relative flex-1">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                    <Search size={16} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search picks..."
                                    value={searchQuery}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="w-full bg-[#12121f] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-gray-200 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all placeholder:text-gray-600"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => onSearchChange('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Clear Button */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onClear}
                                className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 rounded-xl transition-colors"
                                title="Clear Recommendations"
                            >
                                <Trash2 size={18} />
                            </motion.button>

                            <div className="relative shrink-0" ref={dropdownRef}>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                                    className="flex items-center justify-center w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white rounded-xl transition-colors"
                                    title={`Sort by ${getSortLabel()}`}
                                >
                                    <ArrowUpDown size={18} />
                                </motion.button>

                                <AnimatePresence>
                                    {showSortDropdown && (
                                        <motion.div
                                            key="sort-dropdown"
                                            initial={enhancedMotion ? { opacity: 0, scale: 0.95, y: -10 } : { opacity: 0 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={enhancedMotion ? { opacity: 0, scale: 0.95, y: -10 } : { opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-white/20 rounded-lg shadow-xl overflow-hidden z-20 min-w-[150px]"
                                        >
                                            <button
                                                onClick={() => handleSort('added')}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${sortConfig.key === 'added' ? 'text-violet-400' : 'text-gray-300'}`}
                                            >
                                                <span>Date Added</span>
                                                {sortConfig.key === 'added' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                            </button>
                                            <button
                                                onClick={() => handleSort('name')}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${sortConfig.key === 'name' ? 'text-violet-400' : 'text-gray-300'}`}
                                            >
                                                <span>Name</span>
                                                {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                            </button>
                                            <button
                                                onClick={() => handleSort('year')}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${sortConfig.key === 'year' ? 'text-violet-400' : 'text-gray-300'}`}
                                            >
                                                <span>Year</span>
                                                {sortConfig.key === 'year' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div >
                        </div>
                    </div >

                    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 ${window.innerWidth <= 768 ? 'grid-optimization' : ''}`}>
                        <AnimatePresence>
                            {sortedRecommendations.slice(0, visibleCount).map((rec, index) => {
                                // Skip invalid recommendations
                                if (!rec || !rec.title) return null;

                                return (
                                    <RecommendationCard
                                        key={rec.id || rec.title || index}
                                        rec={rec}
                                        index={index}
                                        onWatched={onWatched}
                                        onRemove={onRemove}
                                        onRemovePick={onRemovePick}
                                        isInLibrary={isInLibrary}
                                        isInWatchlist={isInWatchlist}
                                        onAddToWatchlist={onAddToWatchlist}
                                        onRemoveFromWatchlist={onRemoveFromWatchlist}
                                        onClick={(img) => {
                                            onOpenDetails({ ...rec, image: img || rec.image });
                                        }}
                                        onExclude={onExclude}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    </div>

                    {/* Intersection observer target */}
                    {visibleCount < recommendations.length && (
                        <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-8">
                            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
