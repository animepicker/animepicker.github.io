import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, EyeOff } from 'lucide-react';

export default function ExcludeModal({ isOpen, onClose, onConfirm, item, enhancedMotion = true }) {
    const [reason, setReason] = useState('');

    const handleSubmit = () => {
        onConfirm(item, reason);
        setReason('');
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
                <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-16 md:items-center md:pt-4">
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
                                <EyeOff size={20} className="text-gray-400" />
                                Exclude Anime
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-gray-400 mb-6 text-sm">
                            Are you sure you want to exclude <span className="text-white font-medium">"{item?.title}"</span>?
                            It will be hidden from all lists and recommendations.
                        </p>

                        <div className="mb-6">
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">
                                Reason (Optional)
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g. Too violent, Not my style..."
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Providing a reason helps the AI give you better recommendations.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                            >
                                Exclude
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
