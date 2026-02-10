import { X, Calendar, Tag, PlayCircle, Plus, Check, Edit3, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function DetailsModal({ isOpen, onClose, item, onAction, actionLabel, actionIcon, isActionDisabled, onUpdateNote, enhancedMotion = true, showNotes = false }) {
    const [note, setNote] = useState('');

    useEffect(() => {
        if (item) {
            setNote(item.note || '');
        }
    }, [item]);

    const handleNoteChange = (e) => {
        const newNote = e.target.value;
        setNote(newNote);
        if (item && onUpdateNote) {
            onUpdateNote(item.id, newNote);
        }
    };

    if (!isOpen || !item) return null;

    const variants = enhancedMotion ? {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 10 }
    } : {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={variants}
                        className="relative w-full max-w-2xl bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors border border-white/10"
                        >
                            <X size={20} />
                        </button>

                        {/* Image Section - Fixed on Desktop, Top on Mobile */}
                        <div className="relative w-full md:w-2/5 shrink-0 bg-black/50 h-48 md:h-auto">
                            {item.image ? (
                                <div className="w-full h-full relative">
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-transparent to-transparent md:bg-none z-10" />
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-700">
                                    <span className="text-sm">No Image</span>
                                </div>
                            )}
                        </div>

                        {/* Details Section - Scrollable Content */}
                        <div className="flex-1 flex flex-col min-w-0 min-h-0">

                            {/* Scrollable Body */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
                                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">
                                    {item.title}
                                </h2>

                                {item.year && (
                                    <div className="flex items-center gap-2 text-gray-400 mb-4 text-sm">
                                        <Calendar size={14} className="text-violet-400" />
                                        <span>{item.year}</span>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {item.genres?.map((genre, i) => (
                                        <span
                                            key={i}
                                            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10"
                                        >
                                            <Tag size={10} />
                                            {genre}
                                        </span>
                                    ))}
                                </div>

                                <div className="prose prose-invert prose-sm max-w-none mb-8">
                                    <p className="text-gray-300 leading-relaxed">
                                        {item.description || item.synopsis || "No description available."}
                                    </p>
                                </div>

                                {/* Recommendation Reason */}
                                {item.reason && (
                                    <div className="mb-6 bg-violet-600/10 border border-violet-500/20 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2 text-sm font-bold text-violet-300">
                                            <Sparkles size={14} />
                                            <span>Why we picked this for you</span>
                                        </div>
                                        <p className="text-sm text-gray-300 italic">
                                            "{item.reason}"
                                        </p>
                                    </div>
                                )}

                                {/* Personal Notes Section */}
                                {showNotes && (
                                    <div className="mb-2">
                                        <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-300">
                                            <Edit3 size={14} className="text-violet-400" />
                                            <span>Personal Notes</span>
                                        </div>
                                        <textarea
                                            value={note}
                                            onChange={handleNoteChange}
                                            placeholder="Add your thoughts... e.g. 'Love the art style' or 'Similar to Attack on Titan'"
                                            className="w-full h-24 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all resize-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions - Fixed at Bottom of Right Panel */}
                            <div className="p-4 border-t border-white/5 bg-[#1a1a2e]/98 z-20">
                                <div className="flex gap-3">
                                    {onAction && (
                                        <button
                                            onClick={() => {
                                                onAction();
                                            }}
                                            disabled={isActionDisabled}
                                            className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                        >
                                            {actionIcon}
                                            <span>{actionLabel}</span>
                                        </button>
                                    )}

                                    <a
                                        href={`https://hianime.to/search?keyword=${encodeURIComponent(item.title)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl font-medium transition-colors border border-white/10 hover:border-white/20 text-sm"
                                    >
                                        <PlayCircle size={18} />
                                        <span>Watch</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
