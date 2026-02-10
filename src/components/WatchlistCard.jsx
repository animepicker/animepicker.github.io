// Fix missing imports if any
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, LayoutGrid, X, Calendar, Tag, Sparkles, RefreshCw, EyeOff, PlayCircle } from 'lucide-react';
import { getAnimeImage } from '../services/jikanService';
import { formatTags } from '../utils/tagUtils';

export default function WatchlistCard({ item, onClick, onMoveToLibrary, onRemove, onGenerateInfo, loadingItems, onExclude }) {
    const [imageUrl, setImageUrl] = useState(null);

    const isLoading = Array.isArray(loadingItems) && (loadingItems.includes(item.title) || loadingItems.includes(item.id));

    useEffect(() => {
        let mounted = true;

        const fetchImage = async () => {
            // Priority 1: Use existing image from item
            if (item.image) {
                setImageUrl(item.image);
                return;
            }

            // Priority 2: Fetch from API
            const url = await getAnimeImage(item.title);
            if (mounted && url) {
                setImageUrl(url);
            }
        };

        fetchImage();

        return () => {
            mounted = false;
        };
    }, [item.image, item.title]);

    const hasInfo = item.description || (item.genres && item.genres.length > 0);

    const isMobile = window.innerWidth <= 768;

    const content = (
        <div
            onClick={() => onClick({ ...item, image: imageUrl || item.image })}
            className={`group relative bg-[#12121f] rounded-2xl overflow-hidden border border-white/5 transition-all duration-300 cursor-pointer flex flex-col h-full 
                ${isMobile ? 'low-power-card' : 'hover:border-rose-500/30 hover:shadow-[0_0_20px_rgba(225,29,72,0.15)]'}`}
        >
            {/* Image Area */}
            <div className="relative aspect-[2/3] bg-black/50 border-b border-white/5 overflow-hidden">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700 bg-gray-900/50">
                        <Heart size={32} />
                    </div>
                )}

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#12121f] via-transparent to-transparent opacity-60" />

                {/* Overlay Action Buttons */}
                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all z-10" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => onMoveToLibrary(item)}
                        className="p-2 rounded-xl bg-black/60 hover:bg-violet-600 text-white shadow-lg transition-all"
                        title="Move to Library"
                    >
                        <LayoutGrid size={16} />
                    </button>
                    <button
                        onClick={() => onExclude(item)}
                        className="p-2 rounded-xl bg-black/60 hover:bg-gray-500 text-gray-300 hover:text-white shadow-lg transition-all"
                        title="Exclude from recommendations"
                    >
                        <EyeOff size={16} />
                    </button>
                    <button
                        onClick={() => onGenerateInfo(item.title, item.id, 'watchlist')}
                        disabled={isLoading}
                        className="p-2 rounded-xl bg-black/60 hover:bg-violet-600 text-gray-300 hover:text-white shadow-lg transition-all disabled:opacity-50"
                        title="Regenerate info"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => onRemove(item.id, item.title)}
                        className="p-2 rounded-xl bg-black/60 hover:bg-red-600 text-gray-300 hover:text-white shadow-lg transition-all"
                        title="Remove from Watchlist"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="text-sm font-bold text-white line-clamp-2 mb-1">{item.title}</h3>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-violet-400 text-xs py-1 mb-2">
                        <span>Generating info...</span>
                    </div>
                ) : item.year ? (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                        <Calendar size={12} className="text-violet-400" />
                        <span>{item.year}</span>
                    </div>
                ) : !hasInfo && (
                    <span className="text-xs text-gray-600 mb-2 italic">No details yet</span>
                )}

                <div className="flex flex-wrap gap-1 mt-auto">
                    {hasInfo && !isLoading ? (
                        (() => {
                            const { visibleTags, remainingCount } = formatTags(item.genres, 2);
                            return (
                                <>
                                    {visibleTags.map((genre, i) => (
                                        <span key={i} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
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
                        })()
                    ) : !isLoading && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onGenerateInfo && onGenerateInfo(item.title || item, item.id, 'watchlist');
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 hover:border-violet-500 py-2 rounded-xl text-xs font-medium transition-all"
                        >
                            <Sparkles size={12} />
                            <span>Generate Info</span>
                        </button>
                    )}
                </div>

                {/* Watch Button */}
                {(hasInfo || item.year) && (
                    <a
                        href={`https://hianime.to/search?keyword=${encodeURIComponent(item.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-violet-600/10 hover:bg-violet-600 hover:text-white py-2.5 rounded-xl text-xs font-medium text-violet-300 transition-all border border-violet-500/20 hover:border-violet-500 mt-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <PlayCircle size={14} />
                        <span>Watch Now</span>
                    </a>
                )}
            </div>
        </div>
    );

    if (isMobile) {
        return content;
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
        >
            {content}
        </motion.div>
    );
}
