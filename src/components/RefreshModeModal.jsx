import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Tag } from 'lucide-react';

export default function RefreshModeModal({ isOpen, onClose, onSelect, item, enhancedMotion = true }) {
    const handleSelect = (mode) => {
        onSelect(mode);
        onClose();
    };

    const variants = enhancedMotion ? {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.95 }
    } : {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={variants}
                        className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-hidden"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <RefreshCw size={20} className="text-violet-400" />
                                Refresh Options
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-gray-400 mb-6 text-sm">
                            Choose how to refresh <span className="text-white font-medium">"{item?.title}"</span>.
                        </p>

                        <div className="space-y-3 mb-6">
                            <button
                                onClick={() => handleSelect('all')}
                                className="w-full p-4 rounded-xl text-left bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <RefreshCw size={18} className="text-violet-400 group-hover:rotate-180 transition-transform duration-300" />
                                    <div>
                                        <div className="text-white font-medium">Refresh All</div>
                                        <div className="text-xs text-gray-400">Full regeneration (genres, description, year)</div>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => handleSelect('genres')}
                                className="w-full p-4 rounded-xl text-left bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <Tag size={18} className="text-emerald-400" />
                                    <div>
                                        <div className="text-white font-medium">Refresh Genres Only</div>
                                        <div className="text-xs text-gray-400">Update genres only, preserve other metadata</div>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
