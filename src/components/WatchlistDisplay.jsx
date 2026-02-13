import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, Heart, Upload, Check, RefreshCw } from 'lucide-react';
import WatchlistCard from './WatchlistCard';

export default function WatchlistDisplay({ watchlist, library, onRemove, onMoveToLibrary, onMoveToWatchlist, onUpdateNote, onImport, searchQuery, onSearchChange, onGenerateInfo, loadingItems, onExclude, enhancedMotion, isInLibrary, isInWatchlist, onOpenDetails }) {
    // const [searchQuery, setSearchQuery] = useState(''); // Lifted to App
    const [sortConfig, setSortConfig] = useState({ key: 'added', direction: 'desc' });
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [visibleCount, setVisibleCount] = useState(20);

    const sortDropdownRef = useRef(null);
    const loadMoreRef = useRef(null);

    // Intersection observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < watchlist.length) {
                    setVisibleCount(prev => Math.min(prev + 20, watchlist.length));
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [watchlist.length, visibleCount]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
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

    const getSortLabel = () => {
        if (sortConfig.key === 'added') return 'Date Added';
        if (sortConfig.key === 'name') return 'Name';
        if (sortConfig.key === 'year') return 'Year';
        return 'Sort';
    };

    const sortedWatchlist = useMemo(() => {
        if (!watchlist) return [];

        let filtered = [...watchlist];

        if (searchQuery) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item =>
                (item.title || item).toLowerCase().includes(query)
            );
        }

        if (sortConfig.key === 'name') {
            filtered.sort((a, b) => {
                const tA = (a.title || a).toLowerCase();
                const tB = (b.title || b).toLowerCase();
                return tA.localeCompare(tB);
            });
        } else if (sortConfig.key === 'year') {
            filtered.sort((a, b) => {
                const yA = parseInt(a.year) || 0;
                const yB = parseInt(b.year) || 0;
                return yA - yB;
            });
        }

        if (sortConfig.direction === 'desc') {
            filtered.reverse();
        }

        return filtered;
    }, [watchlist, searchQuery, sortConfig]);



    if (!watchlist) return null;

    return (
        <>


            {watchlist.length === 0 ? (
                <div className="text-center py-20 px-6">
                    <div className="bg-white/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                        <Heart size={32} className="text-rose-500/50" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Your Watchlist is Empty</h3>
                    <p className="text-gray-400 max-w-md mx-auto mb-8">
                        Items you want to watch will appear here. You can also import your existing data.
                    </p>
                    <button
                        onClick={onImport}
                        className="flex items-center gap-2 mx-auto bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-all"
                    >
                        <Upload size={18} />
                        <span>Import Data</span>
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-6xl mx-auto mt-8 mb-8 px-4">
                    {/* Header Area */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                            Your Watchlist
                        </h2>

                        {/* Search & Sort Controls */}
                        <div className="flex gap-2 w-full sm:max-w-md">
                            <div className="relative flex-1">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                    <Search size={16} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search watchlist..."
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

                            {/* Sort Dropdown */}
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
                                            initial={enhancedMotion ? { opacity: 0, scale: 0.95, y: -10 } : { opacity: 0 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={enhancedMotion ? { opacity: 0, scale: 0.95, y: -10 } : { opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-white/20 rounded-lg shadow-xl overflow-hidden z-20 min-w-[150px]"
                                        >
                                            {[
                                                { key: 'added', label: 'Date Added' },
                                                { key: 'name', label: 'Name' },
                                                { key: 'year', label: 'Year' }
                                            ].map((option) => (
                                                <button
                                                    key={option.key}
                                                    onClick={() => handleSort(option.key)}
                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${sortConfig.key === option.key ? 'text-violet-400' : 'text-gray-300'}`}
                                                >
                                                    <span>{option.label}</span>
                                                    {sortConfig.key === option.key && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Grid */}
                    {sortedWatchlist.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">
                            <p>{searchQuery ? 'No matches found in watchlist' : 'Your watchlist is empty'}</p>
                        </div>
                    ) : (
                        <>
                            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${window.innerWidth <= 768 ? 'grid-optimization' : ''}`}>
                                {sortedWatchlist.slice(0, visibleCount).map((item, index) => (
                                    <WatchlistCard
                                        key={item.id || index}
                                        item={item}
                                        index={index}
                                        onClick={(clickedItem) => {
                                            onOpenDetails(clickedItem);
                                        }}
                                        onMoveToLibrary={onMoveToLibrary}
                                        onRemove={onRemove}
                                        onGenerateInfo={onGenerateInfo}
                                        loadingItems={loadingItems}
                                        onExclude={onExclude}
                                    />
                                ))}
                            </div>

                            {/* Intersection observer target */}
                            {visibleCount < sortedWatchlist.length && (
                                <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-8">
                                    <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}
