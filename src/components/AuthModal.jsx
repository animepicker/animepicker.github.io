import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, LogIn, UserPlus, X, Cloud, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { userExists } from '../services/authService';

export default function AuthModal({ isOpen, onClose, onAuth, onGoogleAuth, onCancelGoogleAuth, isGoogleLoading = false, enhancedMotion = true }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [needsSignupConfirmation, setNeedsSignupConfirmation] = useState(false);
    const [showLocalDataWarning, setShowLocalDataWarning] = useState(false);
    const [showGooglePrivacyConfirm, setShowGooglePrivacyConfirm] = useState(false);

    // Body scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const normalizedUsername = username.toLowerCase().trim();
        if (!normalizedUsername) {
            setError('Please enter a username');
            return;
        }

        if (!needsSignupConfirmation) {
            const exists = userExists(normalizedUsername);
            if (!exists) {
                setNeedsSignupConfirmation(true);
                return;
            }

            // Login flow
            setIsLoading(true);
            try {
                await onAuth('login', normalizedUsername, password);
                resetAll();
                onClose();
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        } else {
            if (!showLocalDataWarning) {
                setShowLocalDataWarning(true);
                return;
            }
            // Signup flow (confirmed)
            setIsLoading(true);
            try {
                await onAuth('signup', normalizedUsername, password);
                resetAll();
                onClose();
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const resetAll = () => {
        setUsername('');
        setPassword('');
        setError('');
        setNeedsSignupConfirmation(false);
        setShowLocalDataWarning(false);
        setShowGooglePrivacyConfirm(false);
    };

    const handleClose = () => {
        resetAll();
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
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 md:items-center md:pt-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={variants}
                        className="relative w-full max-w-md bg-[#12121f] border border-white/10 rounded-2xl p-8 shadow-2xl"
                    >
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-2xl font-bold text-white mb-2">
                            {showGooglePrivacyConfirm ? 'Privacy & Sync' : (showLocalDataWarning ? 'Local Storage Warning' : (needsSignupConfirmation ? 'New Account?' : 'Welcome'))}
                        </h2>
                        <p className="text-gray-400 text-sm mb-6">
                            {showGooglePrivacyConfirm
                                ? 'Review how we handle your Google Drive data.'
                                : (showLocalDataWarning
                                    ? 'Please confirm you understand how local accounts work.'
                                    : (needsSignupConfirmation
                                        ? `Username "${username}" not found. Create a new account with this password?`
                                        : 'Sign in or create a new local account'))}
                        </p>

                        <div className="space-y-6">
                            {!showGooglePrivacyConfirm ? (
                                <>
                                    {!needsSignupConfirmation && (
                                        <>
                                            <button
                                                onClick={() => setShowGooglePrivacyConfirm(true)}
                                                className="w-full flex items-center justify-center gap-3 bg-white text-black hover:bg-gray-100 py-3 rounded-xl font-bold transition-all shadow-lg"
                                            >
                                                <Cloud size={20} className="text-blue-600" />
                                                <span>Continue with Google</span>
                                            </button>

                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center">
                                                    <div className="w-full border-t border-white/10"></div>
                                                </div>
                                                <div className="relative flex justify-center text-xs uppercase">
                                                    <span className="bg-[#12121f] px-2 text-gray-500 font-semibold tracking-wider">Or with Local Account</span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {!showLocalDataWarning ? (
                                            <>
                                                <div className="relative">
                                                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    <input
                                                        type="text"
                                                        value={username}
                                                        onChange={(e) => {
                                                            setUsername(e.target.value);
                                                            if (needsSignupConfirmation) setNeedsSignupConfirmation(false);
                                                        }}
                                                        placeholder="Username"
                                                        required
                                                        disabled={needsSignupConfirmation}
                                                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all disabled:opacity-50"
                                                    />
                                                </div>

                                                <div className="relative">
                                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    <input
                                                        type="password"
                                                        value={password}
                                                        onChange={(e) => {
                                                            setPassword(e.target.value);
                                                        }}
                                                        placeholder="Password"
                                                        required
                                                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
                                                <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                                                <p className="text-amber-200/90 text-sm leading-relaxed">
                                                    Your account data will be stored <span className="text-amber-200 font-bold underline">only</span> in this browser. Clearing site data or cookies will permanently delete your account.
                                                </p>
                                            </div>
                                        )}

                                        {error && (
                                            <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
                                                {error}
                                            </p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className={`w-full flex items-center justify-center gap-2 ${showLocalDataWarning ? 'bg-amber-600 hover:bg-amber-500' : (needsSignupConfirmation ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-gradient-to-r from-violet-600 to-indigo-600')} hover:shadow-lg text-white py-3 rounded-xl font-medium transition-all disabled:opacity-50`}
                                        >
                                            {isLoading ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : showLocalDataWarning ? (
                                                <>
                                                    <UserPlus size={18} />
                                                    <span>I Understand, Create Account</span>
                                                </>
                                            ) : needsSignupConfirmation ? (
                                                <>
                                                    <UserPlus size={18} />
                                                    <span>Confirm & Create Account</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Continue</span>
                                                    <ArrowRight size={18} />
                                                </>
                                            )}
                                        </button>

                                        {(needsSignupConfirmation || showLocalDataWarning) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (showLocalDataWarning) setShowLocalDataWarning(false);
                                                    else setNeedsSignupConfirmation(false);
                                                }}
                                                className="w-full py-2 text-sm text-gray-500 hover:text-gray-400 transition-colors"
                                            >
                                                {showLocalDataWarning ? 'Go Back' : 'Back to Sign In'}
                                            </button>
                                        )}
                                    </form>
                                </>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-4">
                                        <div className="flex gap-3">
                                            <Cloud className="text-blue-400 shrink-0 mt-0.5" size={20} />
                                            <div className="space-y-2">
                                                <p className="text-blue-200/90 text-[13px] leading-relaxed">
                                                    By continuing, you allow Anime Picker to create a <span className="text-blue-200 font-bold underline">private application data folder</span> in your Google Drive.
                                                </p>
                                                <ul className="text-[11px] text-gray-400 space-y-1.5 list-disc pl-4">
                                                    <li><span className="text-white/80 font-medium">No 3rd-party servers</span> or databases are used; sync is direct with Google.</li>
                                                    <li>Your personal files (photos, docs, etc.) are <span className="text-white/80 font-medium">never</span> accessed.</li>
                                                    <li>Only reads and writes data inside its <span className="text-white/80 font-medium">own hidden folder</span>.</li>
                                                    <li>Enables secure cloud backup and cross-device syncing.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <button
                                            onClick={onGoogleAuth}
                                            disabled={isGoogleLoading}
                                            className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-100 py-3 rounded-xl font-bold transition-all shadow-lg group disabled:opacity-50"
                                        >
                                            {isGoogleLoading ? (
                                                <>
                                                    <Loader2 size={18} className="animate-spin text-blue-600" />
                                                    <span>Connecting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Cloud size={18} className="text-blue-600 group-hover:scale-110 transition-transform" />
                                                    <span>I Understand & Continue</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={isGoogleLoading ? onCancelGoogleAuth : () => setShowGooglePrivacyConfirm(false)}
                                            className="w-full py-2 text-sm text-gray-500 hover:text-gray-400 transition-colors"
                                        >
                                            {isGoogleLoading ? "Cancel connection" : "Go Back"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div >
            )
            }
        </AnimatePresence >
    );
}
