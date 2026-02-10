import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { Tag, X, PlayCircle, RefreshCw, Sparkles, ChevronDown, Calendar, Image as ImageIcon, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, SlidersHorizontal, Search, Heart, LayoutGrid, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DetailsModal from './DetailsModal';
import { getAnimeImage } from '../services/jikanService';
import { formatTags } from '../utils/tagUtils';

const ITEMS_PER_PAGE = 9; // 3 columns x 3 rows

// Memoized anime card component
const AnimeCard = memo(function AnimeCard({ animeData, isLoading, hasInfo, isExpanded, onToggleExpand, onGenerateInfo, onRemove, onClick, onMoveToWatchlist, onExclude }) {
    const [imageUrl, setImageUrl] = useState(null);

    useEffect(() => {
        let mounted = true;

        const fetchImage = async () => {
            if (animeData.image) {
                setImageUrl(animeData.image);
                return;
            }

            const url = await getAnimeImage(animeData.title);
            if (mounted && url) {
                setImageUrl(url);
            }
        };

        fetchImage();

        return () => {
            mounted = false;
        };
    }, [animeData.title, animeData.image]);

    const isMobile = window.innerWidth <= 768;

    return (
        <div
            onClick={() => onClick(imageUrl)}
            className={`group relative bg-[#12121f] rounded-xl overflow-hidden border border-white/5 transition-all duration-300 h-full flex flex-col cursor-pointer 
                ${isMobile ? 'low-power-card' : 'hover:border-violet-500/30 hover:shadow-[0_0_20px_rgba(124,58,237,0.1)]'}`}
        >
            {/* Portrait Image Area (Top) */}
            <div className="relative w-full aspect-[2/3] bg-black/50 border-b border-white/5 overflow-hidden">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={animeData.title}
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

                {/* Action Buttons Overlay on Image */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 z-10" onClick={(e) => e.stopPropagation()}>
                    {onMoveToWatchlist && (
                        <button
                            onClick={() => onMoveToWatchlist(animeData)}
                            className="p-2 rounded-lg bg-black/60 hover:bg-rose-500 text-white transition-colors"
                            title="Move to watchlist"
                        >
                            <Heart size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => onExclude(animeData)}
                        className="p-2 rounded-lg bg-black/60 hover:bg-gray-500 text-white transition-colors"
                        title="Exclude from recommendations"
                    >
                        <EyeOff size={14} />
                    </button>
                    <button
                        onClick={() => onGenerateInfo(animeData.title)}
                        disabled={isLoading}
                        className="p-2 rounded-lg bg-black/60 hover:bg-violet-600 text-white transition-colors disabled:opacity-50"
                        title="Regenerate info"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => onRemove(animeData.id, animeData.title)}
                        className="p-2 rounded-lg bg-black/60 hover:bg-red-500 text-white transition-colors"
                        title="Remove from library"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content Area (Bottom) */}
            <div className="p-3 flex flex-col flex-grow relative z-10 w-full min-w-0">
                <div className="mb-1">
                    <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-2 leading-tight">
                        {animeData.title}
                    </h3>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-violet-400 text-xs py-1">
                        <span>Generating info...</span>
                    </div>
                ) : hasInfo ? (
                    <>
                        {animeData.year && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                                <Calendar size={12} className="text-violet-400" />
                                <span>{animeData.year}</span>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-1 mb-2">
                            {(() => {
                                const { visibleTags, remainingCount } = formatTags(animeData.genres, 2);
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
                                            <span className="text-[10px] text-gray-500 flex items-center px-1">+{remainingCount}</span>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-center mt-auto">
                        <p className="text-xs text-gray-500 mb-2">No details yet</p>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onGenerateInfo(animeData.title, animeData.id);
                            }}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded-lg transition-colors shadow-lg shadow-violet-500/20"
                        >
                            <Sparkles size={12} />
                            Generate Info
                        </button>
                    </div>
                )}

                {/* Watch Button */}
                {(hasInfo || animeData.year) && (
                    <a
                        href={`https://hianime.to/search?keyword=${encodeURIComponent(animeData.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-violet-600/10 hover:bg-violet-600 hover:text-white py-2.5 rounded-xl text-xs font-medium text-violet-300 transition-all border border-violet-500/20 hover:border-violet-500 mt-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <PlayCircle size={14} />
                        <span>Watch Now</span>
                    </a>
                )}
            </div>
        </div>
    );
});

export default function LibraryDisplay({ library, onRemove, onGenerateInfo, onGenerateAllInfo, onImport, loadingItems, searchQuery, onSearchChange, onUpdateNote, onModalStateChange, onMoveToWatchlist, onExclude, enhancedMotion }) {
    const [expandedItems, setExpandedItems] = useState({});
    const [showDropdown, setShowDropdown] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [showManageDropdown, setShowManageDropdown] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    const [sortConfig, setSortConfig] = useState({ key: 'added', direction: 'desc' });

    // Details Modal State
    const [selectedAnime, setSelectedAnime] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    const dropdownRef = useRef(null);
    const sortDropdownRef = useRef(null);
    const manageDropdownRef = useRef(null);
    const fileInputRef = useRef(null);
    const loadMoreRef = useRef(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
                setShowSortDropdown(false);
            }
            if (manageDropdownRef.current && !manageDropdownRef.current.contains(event.target)) {
                setShowManageDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Intersection observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < library.length) {
                    setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, library.length));
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [visibleCount, library.length]);

    // Reset visible count when library changes significantly
    useEffect(() => {
        if (library.length <= ITEMS_PER_PAGE) {
            setVisibleCount(library.length);
        }
    }, [library.length]);

    const toggleExpand = useCallback((title) => {
        setExpandedItems(prev => ({ ...prev, [title]: !prev[title] }));
    }, []);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setShowSortDropdown(false);
    };

    const sortedLibrary = useMemo(() => {
        if (!library) return [];

        let filtered = [...library];

        if (searchQuery) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item => {
                if (!item) return false;
                const title = typeof item === 'string' ? item : item.title;
                return title && typeof title === 'string' && title.toLowerCase().includes(query);
            });
        }

        let sorted = filtered; // Apply sort to filtered list

        if (sortConfig.key === 'name') {
            sorted.sort((a, b) => {
                const tA = (typeof a === 'string' ? a : a.title || '').toLowerCase();
                const tB = (typeof b === 'string' ? b : b.title || '').toLowerCase();
                return tA.localeCompare(tB);
            });
        } else if (sortConfig.key === 'year') {
            sorted.sort((a, b) => {
                const yA = parseInt(a.year) || 0;
                const yB = parseInt(b.year) || 0;
                return yA - yB;
            });
        }

        if (sortConfig.direction === 'desc') {
            sorted.reverse();
        }

        return sorted;
    }, [library, sortConfig, searchQuery]);

    const itemsWithoutInfo = library ? library.filter(anime => {
        if (!anime) return false;
        const data = typeof anime === 'string' ? { genres: [] } : anime;
        return !data.genres || data.genres.length === 0;
    }) : [];

    const visibleItems = sortedLibrary.slice(0, visibleCount);
    const hasMore = library && visibleCount < sortedLibrary.length;

    const handleRegenerateClick = (mode) => {
        setShowDropdown(false);
        setConfirmAction(mode);
        setShowConfirmModal(true);
    };

    const handleConfirm = () => {
        setShowConfirmModal(false);
        if (confirmAction === 'all') {
            onGenerateAllInfo('all');
        } else {
            onGenerateAllInfo('missing');
        }
        setConfirmAction(null);
    };

    const getConfirmMessage = () => {
        if (confirmAction === 'all') {
            return `Regenerate info for all ${library.length} items?`;
        } else {
            return `Generate info for ${itemsWithoutInfo.length} items without info?`;
        }
    };

    const getSortLabel = () => {
        if (sortConfig.key === 'added') return 'Date Added';
        if (sortConfig.key === 'name') return 'Name';
        if (sortConfig.key === 'year') return 'Year';
        return 'Sort';
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(library, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `anime-library-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setShowManageDropdown(false);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
        setShowManageDropdown(false);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                onImport(importedData);
            } catch (error) {
                console.error("Import error:", error);
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    // if (!library || library.length === 0) return null; // Removed to allow header display

    const handleModalOpen = (animeData, img) => {
        setSelectedAnime({ ...animeData, image: img || animeData.image });
        setIsDetailsModalOpen(true);
        if (onModalStateChange) onModalStateChange(true);
    };

    const handleModalClose = () => {
        setIsDetailsModalOpen(false);
        if (onModalStateChange) onModalStateChange(false);
    };

    if (!library || library.length === 0) {
        return (
            <div className="text-center py-20 px-6">
                <div className="bg-white/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                    <LayoutGrid size={32} className="text-violet-500/50" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Your Library is Empty</h3>
                <p className="text-gray-400 max-w-md mx-auto mb-8">
                    Items you add to your library will appear here. You can also import your existing data.
                </p>
                <button
                    onClick={onImport}
                    className="flex items-center gap-2 mx-auto bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-all"
                >
                    <Upload size={18} />
                    <span>Import Data</span>
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto mt-8 mb-8 px-4">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                    Your Library
                </h2>
                {/* Search Bar with Sort */}
                <div className="flex gap-2 w-full sm:max-w-md">
                    <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                            <Search size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search library..."
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

                    <div className="relative shrink-0" ref={sortDropdownRef}>
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
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 max-w-sm mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-semibold text-white mb-2">Confirm Action</h3>
                        <p className="text-gray-400 text-sm mb-6">{getConfirmMessage()}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 px-4 py-2 text-sm text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            <DetailsModal
                isOpen={isDetailsModalOpen}
                onClose={handleModalClose}
                item={selectedAnime}
                onAction={selectedAnime ? () => onRemove(selectedAnime.id, selectedAnime.title) : undefined}
                actionLabel="Remove"
                actionIcon={<X size={18} />}
                onUpdateNote={onUpdateNote}
                enhancedMotion={enhancedMotion}
                showNotes={true}
            />

            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${window.innerWidth <= 768 ? 'grid-optimization' : ''}`}>
                {visibleItems.map((anime) => {
                    const animeData = typeof anime === 'string'
                        ? { title: anime, genres: [], description: '' }
                        : anime;

                    const isLoading = Array.isArray(loadingItems) && loadingItems.includes(animeData.title);
                    const hasInfo = animeData.genres && animeData.genres.length > 0;
                    const isExpanded = expandedItems[animeData.title];

                    return (
                        <AnimeCard
                            key={animeData.id || animeData.title}
                            animeData={animeData}
                            isLoading={isLoading}
                            hasInfo={hasInfo}
                            isExpanded={expandedItems[animeData.title]}
                            onToggleExpand={() => toggleExpand(animeData.title)}
                            onGenerateInfo={onGenerateInfo}
                            onRemove={onRemove}
                            onClick={(img) => handleModalOpen(animeData, img)}
                            onMoveToWatchlist={onMoveToWatchlist}
                            onExclude={onExclude}
                        />
                    );
                })}
            </div>

            {/* Load more trigger */}
            {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-8">
                    <div className="text-gray-500 text-sm">
                        Showing {visibleCount} of {library.length} • Scroll for more
                    </div>
                </div>
            )}
        </div>
    );
}
