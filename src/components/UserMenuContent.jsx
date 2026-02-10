import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LogOut, User, LayoutGrid, Sparkles, ArrowUp, ArrowDown, Plus, X,
    Play, Search, Info, Key, Download, Upload, RefreshCw, Heart, Trash2,
    ChevronLeft, Check, Copy, ExternalLink, Loader2, Eye, EyeOff, ChevronDown, Undo, Zap, Wind, Cloud, CloudOff, Database, Calendar
} from 'lucide-react';
import AboutContent from './AboutContent';

// API Key Input Constants
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
const CEREBRAS_MODELS_URL = "https://api.cerebras.ai/v1/models";
const MISTRAL_MODELS_URL = "https://api.mistral.ai/v1/models";
const DEFAULT_MODEL = "tngtech/deepseek-r1t2-chimera:free";

export default function UserMenuContent({
    currentUser,
    onLogout,
    onClose,
    onDeleteAccount,
    onShowRegenModal, // Keeping regen as a separate modal for now as it's a confirmation/action workflow
    onImport,
    onExport,
    apiKey,
    setApiKey,
    groqApiKey,
    setGroqApiKey,
    cerebrasApiKey,
    setCerebrasApiKey,
    mistralApiKey,
    setMistralApiKey,
    aiProvider,
    setAiProvider,
    selectedModel,
    setSelectedModel,
    customInstructions,
    setCustomInstructions,
    showInstructionDeleteConfirm,
    setShowInstructionDeleteConfirm,
    showInstructionDeleteAllConfirm,
    setShowInstructionDeleteAllConfirm,
    instructionToDelete,
    setInstructionToDelete,
    showInstructionEditModal,
    setShowInstructionEditModal,
    instructionToEdit,
    setInstructionToEdit,
    defaultInstructions = [],
    watchlist = [], // Added watcher list prop for counts
    library = [], // Added library prop for counts
    onRegen, // Added callback for regeneration
    excludedItems = [],
    onRestore,
    onRestoreAll,
    onDeleteAllInstructions,
    onRestoreDefaults,
    performanceSettings = { enableBlur: false, enhancedMotion: true },
    onTogglePerformanceSetting,
    isGoogleSignedIn,
    isGoogleLoading,
    lastCloudSync,
    onGoogleSignIn,
    onGoogleSignOut,
    onCancelGoogleSignIn,
    onCloudSync,
    onLinkAccount,
    onClearData,
    onClearExcludedItem,
    onClearAllExcluded,
    onUpdateExcludedItem
}) {
    const [currentView, setCurrentView] = useState('main'); // 'main', 'about', 'api', 'instructions', 'regen', 'regen_options', 'excluded', 'effects', 'cloud', 'destruction', 'data_backup'
    const [regenTarget, setRegenTarget] = useState('watchlist'); // 'watchlist' or 'library'

    // API Settings State
    const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
    const [models, setModels] = useState([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModelListOpen, setIsModelListOpen] = useState(false);

    // Animation Variants
    const mainVariants = performanceSettings.enhancedMotion ? {
        initial: { x: -20, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: -20, opacity: 0 }
    } : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 }
    };

    const subViewVariants = performanceSettings.enhancedMotion ? {
        initial: { x: 20, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: 20, opacity: 0 }
    } : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 }
    };

    const modalVariants = performanceSettings.enhancedMotion ? {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.95 }
    } : {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 }
    };

    // Custom Instructions State
    const [newInstruction, setNewInstruction] = useState('');
    const [editingExcludedId, setEditingExcludedId] = useState(null);
    const [editedExcludedTitle, setEditedExcludedTitle] = useState('');
    const [editedExcludedReason, setEditedExcludedReason] = useState('');
    const [confirmConfig, setConfirmConfig] = useState(null); // { title, message, onConfirm, actionLabel, isDanger }
    const [showAllProviders, setShowAllProviders] = useState(false);
    const modelListRef = useRef(null);

    // Scroll selected model into view when list opens
    useEffect(() => {
        if (isModelListOpen && selectedModel && modelListRef.current && !isLoadingModels && models.length > 0) {
            const selectedElement = modelListRef.current.querySelector(`[data-model-id="${selectedModel}"]`);
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [isModelListOpen, selectedModel, isLoadingModels, models]);

    const fetchModels = async () => {
        if (models.length > 0) return;
        setIsLoadingModels(true);
        try {
            let url = OPENROUTER_MODELS_URL;
            let headers = {};

            if (aiProvider === 'groq') {
                url = GROQ_MODELS_URL;
                headers = { "Authorization": `Bearer ${groqApiKey}` };
            } else if (aiProvider === 'cerebras') {
                url = CEREBRAS_MODELS_URL;
                headers = { "Authorization": `Bearer ${cerebrasApiKey}` };
            } else if (aiProvider === 'mistral') {
                url = MISTRAL_MODELS_URL;
                headers = { "Authorization": `Bearer ${mistralApiKey}` };
            }

            const response = await fetch(url, { headers });
            const data = await response.json();

            // Handle different API response structures
            const modelsData = data.data || data;
            const sortedModels = modelsData
                .map(m => ({ id: m.id, name: m.name || m.id }))
                .sort((a, b) => a.name.localeCompare(b.name));
            setModels(sortedModels);
        } catch (error) {
            console.error('Failed to fetch models:', error);
        } finally {
            setIsLoadingModels(false);
        }
    };

    const handleModelSelect = (modelId) => {
        setSelectedModel(modelId);
        if (aiProvider === 'groq') localStorage.setItem('groq_model', modelId);
        else if (aiProvider === 'cerebras') localStorage.setItem('cerebras_model', modelId);
        else localStorage.setItem('openrouter_model', modelId);
        setIsModelListOpen(false);
    };

    const filteredModels = models.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const MenuHeader = ({ title, showBack = true, onBack }) => (
        <div className="sticky top-0 z-20 bg-[#1a1a2e]/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center gap-3">
            {showBack ? (
                <button
                    onClick={onBack || (() => setCurrentView('main'))}
                    className="p-2 -ml-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                    <ChevronLeft size={20} />
                </button>
            ) : (
                <div className="shrink-0">
                    {currentUser?.isGoogle && currentUser?.profile?.picture ? (
                        <img
                            src={currentUser.profile.picture}
                            alt={currentUser.profile.name}
                            className="w-10 h-10 rounded-full border border-white/10 shadow-lg"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-base font-bold text-white shadow-lg shadow-violet-900/20">
                            {(currentUser?.username || currentUser || 'U').charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">
                    {showBack ? title : (currentUser?.isGoogle ? (currentUser?.profile?.name || currentUser?.username) : (currentUser?.username || currentUser || 'User'))}
                </h3>
                {!showBack && (
                    <div className="flex items-center gap-1.5">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">
                            {currentUser?.isGoogle ? (isGoogleSignedIn ? 'Google Account' : 'Google Linked') : 'Local Account'}
                        </p>
                        {isGoogleSignedIn && (
                            <div className="w-1 h-1 rounded-full bg-emerald-500" />
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1">
                {!showBack && (
                    <button
                        onClick={onLogout}
                        title="Log out"
                        className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    >
                        <LogOut size={18} />
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );

    const handleStartEditExcluded = (item) => {
        setEditingExcludedId(item.id);
        setEditedExcludedTitle(item.title);
        setEditedExcludedReason(item.reason || '');
    };

    const handleSaveEditExcluded = (id) => {
        if (!editedExcludedTitle.trim()) return;
        onUpdateExcludedItem(id, {
            title: editedExcludedTitle,
            reason: editedExcludedReason
        });
        setEditingExcludedId(null);
    };

    const handleCancelEditExcluded = () => {
        setEditingExcludedId(null);
    };

    // Render Content based on view
    const handleDeleteAll = () => {
        if (onDeleteAllInstructions) {
            onDeleteAllInstructions();
        } else {
            // Fallback
            setCustomInstructions([]);
            setShowInstructionDeleteAllConfirm(false);
        }
    };

    const isDefault = (inst) => {
        if (Array.isArray(defaultInstructions)) {
            return defaultInstructions.includes(inst);
        }
        return false;
    };

    return (
        <>
            <AnimatePresence mode="wait" initial={false}>
                {currentView === 'main' && (
                    <motion.div
                        key="main"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={mainVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader showBack={false} />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                            <div className="space-y-2">
                                <button
                                    onClick={() => setCurrentView('about')}
                                    className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Info size={18} />
                                        <span className="text-sm font-medium">About</span>
                                    </div>
                                    <ChevronDown size={16} className="-rotate-90 text-gray-600 group-hover:text-gray-400 transition-all" />
                                </button>
                                <button
                                    onClick={() => setCurrentView('api')}
                                    className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Key size={18} />
                                        <span className="text-sm font-medium">API Settings</span>
                                    </div>
                                    <ChevronDown size={16} className="-rotate-90 text-gray-600 group-hover:text-gray-400 transition-all" />
                                </button>
                                <button
                                    onClick={() => setCurrentView('instructions')}
                                    className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Sparkles size={18} className="text-pink-400" />
                                        <span className="text-sm font-medium">Custom Instructions</span>
                                    </div>
                                    <ChevronDown size={16} className="-rotate-90 text-gray-600 group-hover:text-pink-400/70 transition-all" />
                                </button>
                                <button
                                    onClick={() => setCurrentView('excluded')}
                                    className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <EyeOff size={18} />
                                        <span className="text-sm font-medium">Excluded Items</span>
                                    </div>
                                    <ChevronDown size={16} className="-rotate-90 text-gray-600 group-hover:text-gray-400 transition-all" />
                                </button>
                                <button
                                    onClick={() => setCurrentView('effects')}
                                    className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Sparkles size={18} className="text-violet-400" />
                                        <span className="text-sm font-medium">Visual Effects</span>
                                    </div>
                                    <ChevronDown size={16} className="-rotate-90 text-gray-600 group-hover:text-violet-400/70 transition-all" />
                                </button>
                                <button
                                    onClick={() => setCurrentView('cloud')}
                                    className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Cloud size={18} className={isGoogleSignedIn ? 'text-emerald-400' : 'text-blue-400'} />
                                        <span className="text-sm font-medium">Cloud Sync</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isGoogleSignedIn && (
                                            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Live</span>
                                            </div>
                                        )}
                                        <ChevronDown size={16} className="-rotate-90 text-gray-600 group-hover:text-blue-400/70 transition-all" />
                                    </div>
                                </button>
                            </div>

                            {/* Watchlist Management */}
                            <div className="space-y-2 pt-4 border-t border-white/10">
                                <p className="text-xs text-gray-500 uppercase tracking-wider px-1 mb-2">Watchlist</p>
                                <button
                                    onClick={() => setCurrentView('data_backup')}
                                    className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Database size={18} className="text-gray-400 group-hover:text-violet-400 transition-colors" />
                                        <span className="text-sm font-medium">Backup & Portability</span>
                                    </div>
                                    <ChevronDown size={16} className="-rotate-90 text-gray-600 group-hover:text-gray-400 transition-all" />
                                </button>
                                <button
                                    onClick={() => setCurrentView('regen')}
                                    className="flex items-center justify-between w-full p-3 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 hover:border-violet-500/40 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <RefreshCw size={18} />
                                        <span className="text-sm font-medium">Regenerate Info</span>
                                    </div>
                                    <ChevronDown size={16} className="-rotate-90 text-violet-500/50 group-hover:text-violet-300 transition-all" />
                                </button>
                            </div>


                            <div className="pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setCurrentView('destruction')}
                                    className="flex items-center justify-between w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Trash2 size={18} />
                                        <span className="text-sm font-medium">Manage Account</span>
                                    </div>
                                    <ChevronDown size={16} className="-rotate-90 text-gray-600 group-hover:text-red-400 transition-all" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {currentView === 'about' && (
                    <motion.div
                        key="about"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="About" />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col items-center justify-center">
                            <AboutContent />
                        </div>
                    </motion.div>
                )}

                {currentView === 'api' && (
                    <motion.div
                        key="api"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="API Settings" />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* Provider Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-sm text-gray-400 font-medium">AI Provider</label>
                                    {!showAllProviders && (
                                        <button
                                            onClick={() => setShowAllProviders(true)}
                                            className="text-[10px] font-bold text-violet-400/60 hover:text-violet-400 uppercase tracking-widest transition-colors flex items-center gap-1 group"
                                        >
                                            <Zap size={10} className="group-hover:animate-pulse" />
                                            Show Others
                                        </button>
                                    )}
                                </div>
                                <div className={`grid ${showAllProviders ? 'grid-cols-4' : 'grid-cols-1'} gap-2 p-1 bg-black/30 border border-white/10 rounded-xl`}>
                                    {[
                                        { id: 'openrouter', name: 'OpenRouter' },
                                        { id: 'groq', name: 'Groq' },
                                        { id: 'cerebras', name: 'Cerebras' },
                                        { id: 'mistral', name: 'Mistral' }
                                    ].filter(p => showAllProviders || p.id === 'openrouter' || aiProvider === p.id).map(provider => (
                                        <button
                                            key={provider.id}
                                            onClick={() => {
                                                setAiProvider(provider.id);
                                                setModels([]); // Clear models when switching providers
                                                setSearchQuery(''); // Reset search query on provider switch

                                                // Load last used model for this provider if available
                                                let lastModel = localStorage.getItem(`${provider.id}_model`);
                                                if (!lastModel) {
                                                    if (provider.id === 'groq') lastModel = 'llama-3.3-70b-versatile';
                                                    else if (provider.id === 'cerebras') lastModel = 'llama-3.3-70b';
                                                    else if (provider.id === 'mistral') lastModel = 'mistral-large-latest';
                                                    else lastModel = DEFAULT_MODEL;
                                                }
                                                setSelectedModel(lastModel);
                                            }}
                                            className={`py-2 rounded-lg text-xs font-bold transition-all ${aiProvider === provider.id
                                                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                                                : 'text-gray-500 hover:text-gray-400 border border-transparent'
                                                }`}
                                        >
                                            {provider.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* API Key Input */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 font-medium ml-1">
                                    {aiProvider === 'groq' ? 'Groq Key' : aiProvider === 'cerebras' ? 'Cerebras Key' : aiProvider === 'mistral' ? 'Mistral Key' : 'OpenRouter Key'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={isApiKeyVisible ? "text" : "password"}
                                        value={aiProvider === 'groq' ? groqApiKey : aiProvider === 'cerebras' ? cerebrasApiKey : aiProvider === 'mistral' ? mistralApiKey : apiKey}
                                        onChange={(e) => {
                                            const key = e.target.value;
                                            if (aiProvider === 'groq') {
                                                setGroqApiKey(key);
                                                localStorage.setItem('groq_api_key', key);
                                            } else if (aiProvider === 'cerebras') {
                                                setCerebrasApiKey(key);
                                                localStorage.setItem('cerebras_api_key', key);
                                            } else if (aiProvider === 'mistral') {
                                                setMistralApiKey(key);
                                                localStorage.setItem('mistral_api_key', key);
                                            } else {
                                                setApiKey(key);
                                                localStorage.setItem('openrouter_api_key', key);
                                            }
                                        }}
                                        placeholder={aiProvider === 'groq' ? "gsk_..." : aiProvider === 'cerebras' ? "csk-..." : aiProvider === 'mistral' ? "Mistral API Key" : "sk-or-..."}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                                    />
                                    <button
                                        onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1"
                                    >
                                        {isApiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Model Selector */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 font-medium ml-1">Model Selection</label>
                                {isModelListOpen ? (
                                    <div className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-3">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search models..."
                                                className="w-full bg-white/5 border border-white/5 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                                            />
                                        </div>
                                        <div ref={modelListRef} className="max-h-[200px] overflow-y-auto custom-scrollbar -mx-1 px-1 space-y-1">
                                            {isLoadingModels ? (
                                                <div className="flex items-center justify-center py-4">
                                                    <Loader2 size={20} className="animate-spin text-violet-400" />
                                                </div>
                                            ) : (aiProvider !== 'openrouter' && !(aiProvider === 'groq' ? groqApiKey : aiProvider === 'cerebras' ? cerebrasApiKey : mistralApiKey)) ? (
                                                <div className="text-center py-4 text-amber-400/80 text-xs px-4">
                                                    Please enter an API key first to load models.
                                                </div>
                                            ) : filteredModels.length === 0 ? (
                                                <div className="text-center py-4 text-gray-500 text-xs">No models found</div>
                                            ) : (
                                                filteredModels.map(model => (
                                                    <button
                                                        key={model.id}
                                                        data-model-id={model.id}
                                                        onClick={() => handleModelSelect(model.id)}
                                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border border-transparent ${selectedModel === model.id
                                                            ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                                                            : 'text-gray-300 hover:bg-white/5 hover:border-white/5'
                                                            }`}
                                                    >
                                                        <div className="font-medium truncate text-xs">{model.name}</div>
                                                        <div className="text-[9px] opacity-50 truncate font-mono mt-0.5">{model.id}</div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setIsModelListOpen(false)}
                                            className="w-full py-2 text-xs text-gray-400 hover:text-white"
                                        >
                                            Close List
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setIsModelListOpen(true);
                                            fetchModels();
                                        }}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white text-left flex items-center justify-between hover:border-violet-500/50 hover:bg-white/5 transition-all group"
                                    >
                                        <span className="truncate flex-1 font-mono text-xs">{selectedModel}</span>
                                        <ChevronDown size={16} className="text-gray-400 group-hover:text-violet-400 transition-colors" />
                                    </button>
                                )}
                            </div>

                            {/* Help Links */}
                            <div className="pt-4 border-t border-white/5">
                                <a
                                    href={aiProvider === 'groq' ? "https://console.groq.com/keys" : aiProvider === 'cerebras' ? "https://cloud.cerebras.ai/" : aiProvider === 'mistral' ? "https://console.mistral.ai/api-keys/" : "https://openrouter.ai/keys"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-violet-400 hover:text-violet-300 hover:underline flex items-center justify-between group"
                                >
                                    <span>Get your {aiProvider === 'groq' ? 'Groq' : aiProvider === 'cerebras' ? 'Cerebras' : 'OpenRouter'} key &rarr;</span>
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                            </div>
                        </div>
                    </motion.div>
                )}

                {currentView === 'excluded' && (
                    <motion.div
                        key="excluded"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="Excluded Items" />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            {excludedItems.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-white/5 rounded-xl">
                                    No excluded items.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <button
                                            onClick={() => setConfirmConfig({
                                                title: "Clear All Excluded Content?",
                                                message: `This will permanently remove all ${excludedItems.length} items from your excluded list. They will start appearing in your recommendations again.`,
                                                actionLabel: "Clear All",
                                                isDanger: true,
                                                onConfirm: () => {
                                                    onClearAllExcluded();
                                                    setConfirmConfig(null);
                                                }
                                            })}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 group transition-all"
                                        >
                                            <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Clear All</span>
                                        </button>
                                        <button
                                            onClick={onRestoreAll}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 group transition-all"
                                        >
                                            <Undo size={14} className="group-hover:-rotate-45 transition-transform" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Restore All</span>
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {excludedItems.map(item => (
                                            <div key={item.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl group/item hover:border-white/20 transition-all">
                                                {editingExcludedId === item.id ? (
                                                    <div className="space-y-3">
                                                        <input
                                                            type="text"
                                                            value={editedExcludedTitle}
                                                            onChange={(e) => setEditedExcludedTitle(e.target.value)}
                                                            placeholder="Title"
                                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                                                            autoFocus
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editedExcludedReason}
                                                            onChange={(e) => setEditedExcludedReason(e.target.value)}
                                                            placeholder="Reason (optional)"
                                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                                                        />
                                                        <div className="flex gap-2 pt-1">
                                                            <button
                                                                onClick={() => handleSaveEditExcluded(item.id)}
                                                                className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-all"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEditExcluded}
                                                                className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold rounded-lg transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-4">
                                                        <div className="flex-1 min-w-0 cursor-pointer group/data" onClick={() => handleStartEditExcluded(item)}>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="text-sm font-bold text-white truncate flex-1 leading-tight">
                                                                    {item.title}
                                                                </div>
                                                                {item.year && (
                                                                    <div className="shrink-0 flex items-center gap-1 text-[10px] font-black text-gray-400 bg-white/5 border border-white/5 rounded-md px-1.5 py-0.5">
                                                                        <Calendar size={10} className="text-pink-500" />
                                                                        {item.year}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1">
                                                                    {item.reason ? (
                                                                        <div className="text-xs text-gray-500 line-clamp-2 italic opacity-80">"{item.reason}"</div>
                                                                    ) : (
                                                                        <div className="text-[10px] text-gray-600 opacity-0 group-hover/data:opacity-100 transition-opacity italic">Click to add reason or edit</div>
                                                                    )}
                                                                </div>
                                                                <div className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter self-end ${item.source === 'library' ? 'bg-violet-500/20 text-violet-400' : item.source === 'watchlist' ? 'bg-blue-500/20 text-blue-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                                    {item.source}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0 pt-1">
                                                            <button
                                                                onClick={() => onRestore(item.id)}
                                                                className="p-2 text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-all shadow-sm"
                                                                title="Restore"
                                                            >
                                                                <Undo size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmConfig({
                                                                    title: "Confirm Removal",
                                                                    message: `Permanently remove "${item.title}" from your excluded list?`,
                                                                    actionLabel: "Clear Item",
                                                                    isDanger: true,
                                                                    onConfirm: () => {
                                                                        onClearExcludedItem(item.id);
                                                                        setConfirmConfig(null);
                                                                    }
                                                                })}
                                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all shadow-sm"
                                                                title="Permanently Clear"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {currentView === 'instructions' && (
                    <motion.div
                        key="instructions"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="Instructions" />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <p className="text-sm text-gray-400 mb-6">
                                These instructions will be sent to the AI whenever you generate new picks or request details.
                            </p>

                            <div className="space-y-3 mb-8">
                                {customInstructions.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-white/5 rounded-xl">
                                        No custom instructions yet.
                                    </div>
                                ) : (
                                    customInstructions.map((inst, idx) => (
                                        <motion.div
                                            key={idx}
                                            className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl group cursor-pointer hover:bg-white/10 transition-all"
                                            onClick={() => {
                                                setInstructionToEdit({ index: idx, value: inst });
                                                setShowInstructionEditModal(true);
                                            }}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-pink-500/40"
                                                style={{ opacity: isDefault(inst) ? 1 : 0.3 }}
                                            />
                                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                                <span className="flex-1 text-white text-sm truncate">
                                                    {inst}
                                                </span>
                                                {isDefault(inst) && (
                                                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-pink-500/10 text-pink-400 border border-pink-500/20 font-bold whitespace-nowrap">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setInstructionToDelete(idx);
                                                    setShowInstructionDeleteConfirm(true);
                                                }}
                                                className="p-1.5 text-gray-500 hover:text-red-400 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </motion.div>
                                    ))
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    setInstructionToEdit({ index: null, value: '' });
                                    setShowInstructionEditModal(true);
                                }}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:border-pink-500/40 hover:text-white transition-all group"
                            >
                                <Plus size={18} className="group-hover:text-pink-400 transition-colors" />
                                <span className="text-sm font-medium">Add a new instruction...</span>
                            </button>

                            {customInstructions.length > 0 && (
                                <button
                                    onClick={() => setShowInstructionDeleteAllConfirm(true)}
                                    className="w-full mt-4 p-2 text-red-400/60 hover:text-red-400 text-xs transition-colors"
                                >
                                    Delete all instructions
                                </button>
                            )}

                            {defaultInstructions.some(def => !customInstructions.includes(def)) && (
                                <button
                                    onClick={onRestoreDefaults}
                                    className="w-full mt-2 p-2 text-gray-400/60 hover:text-gray-400 text-xs transition-colors flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Restore default instructions
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}

                {currentView === 'regen' && (
                    <motion.div
                        key="regen"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="Regenerate Info" />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <p className="text-sm text-gray-400 mb-6 font-medium">
                                Select which collection you want to update with AI-generated details.
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        setRegenTarget('watchlist');
                                        setCurrentView('regen_options');
                                    }}
                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-violet-500/40 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                                            <Heart size={20} />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Watchlist</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{watchlist.length} items</div>
                                        </div>
                                    </div>
                                    <ArrowUp size={16} className="rotate-90 text-gray-600 group-hover:text-violet-400 transition-colors" />
                                </button>

                                <button
                                    onClick={() => {
                                        setRegenTarget('library');
                                        setCurrentView('regen_options');
                                    }}
                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-violet-500/40 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                                            <LayoutGrid size={20} />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Library</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{library.length} items</div>
                                        </div>
                                    </div>
                                    <ArrowUp size={16} className="rotate-90 text-gray-600 group-hover:text-violet-400 transition-colors" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {currentView === 'regen_options' && (
                    <motion.div
                        key="regen_options"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader
                            title={`Update ${regenTarget === 'watchlist' ? 'Watchlist' : 'Library'}`}
                            onBack={() => setCurrentView('regen')}
                        />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <p className="text-sm text-gray-400 mb-6">
                                Use AI to generate plot summaries, genres, and release years for your items.
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => onRegen('all', regenTarget)}
                                    className="w-full p-4 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/40 hover:border-violet-500/50 transition-all text-left"
                                >
                                    <div className="font-bold text-sm">Regenerate All</div>
                                    <div className="text-xs text-violet-300/60 mt-1">
                                        {(regenTarget === 'watchlist' ? watchlist : library).length} items will be updated
                                    </div>
                                </button>
                                <button
                                    onClick={() => onRegen('missing', regenTarget)}
                                    disabled={(regenTarget === 'watchlist' ? watchlist : library).filter(item => !item.description || item.description === '').length === 0}
                                    className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="font-bold text-sm">Generate Missing Only</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {(regenTarget === 'watchlist' ? watchlist : library).filter(item => !item.description || item.description === '').length} items without info
                                    </div>
                                </button>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5">
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-500/5 border border-pink-500/10">
                                    <Sparkles size={16} className="text-pink-400 shrink-0" />
                                    <p className="text-[11px] text-pink-300/60 leading-relaxed">
                                        This will use your AI credits and can take a moment depending on the number of items.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {currentView === 'effects' && (
                    <motion.div
                        key="effects"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="Visual Effects" />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <p className="text-sm text-gray-400">
                                Customize the visual experience and optimize performance.
                            </p>

                            <div className="space-y-4">
                                {/* Enhanced Motion */}
                                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                            <Sparkles size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Enhanced Motion</div>
                                            <div className="text-[10px] text-gray-500">Enable scale and slide transitions</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onTogglePerformanceSetting('enhancedMotion')}
                                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${performanceSettings.enhancedMotion ? 'bg-violet-600' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${performanceSettings.enhancedMotion ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Enable Blur */}
                                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                            <Eye size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Enable Blur</div>
                                            <div className="text-[10px] text-gray-500">Enable glass-like background blur effects</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onTogglePerformanceSetting('enableBlur')}
                                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${performanceSettings.enableBlur ? 'bg-violet-600' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${performanceSettings.enableBlur ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                <div className="flex gap-3">
                                    <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-amber-300/60 leading-relaxed">
                                        Enabling blur effects can significantly impact performance on mobile devices and older hardware.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {currentView === 'cloud' && (
                    <motion.div
                        key="cloud"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="Cloud Sync" />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
                                        <Cloud size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Google Drive Sync</h4>
                                        <p className="text-[10px] text-blue-300/60 uppercase tracking-wider font-semibold">Secure appData Storage</p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                                    Keep your anime library and watchlist in sync across all your devices. Data is stored safely in your own Google Drive.
                                </p>

                                {!isGoogleSignedIn ? (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => setCurrentView('cloud_privacy')}
                                            disabled={isGoogleLoading}
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
                                        >
                                            {isGoogleLoading ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
                                            {currentUser?.isGoogle ? "Sign in with Google" : "Use Google Drive for Sync"}
                                        </button>

                                        {isGoogleLoading && (
                                            <button
                                                onClick={onCancelGoogleSignIn}
                                                className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors underline decoration-gray-600 underline-offset-4"
                                            >
                                                Cancel and use local data
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                            <div className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-wider">Status</div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span className="text-xs font-bold text-white">Connected</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={onCloudSync}
                                            disabled={isGoogleLoading}
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 hover:border-blue-500/30 transition-all disabled:opacity-50"
                                        >
                                            {isGoogleLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                            Sync Now
                                        </button>

                                        {!currentUser?.isGoogle && (
                                            <button
                                                onClick={onGoogleSignOut}
                                                className="w-full py-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                                            >
                                                Disconnect Google Drive
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {lastCloudSync && (
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Last Synchronized</p>
                                    <p className="text-sm text-gray-300 mt-1">{lastCloudSync}</p>
                                </div>
                            )}

                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                                <div className="flex gap-3">
                                    <Info size={16} className="text-gray-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-gray-300 mb-1">How it works</p>
                                        <p className="text-[10px] text-gray-500 leading-relaxed">
                                            Your data is stored in a hidden application folder in your Google Drive. This app cannot see or access any other files in your drive.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
                {currentView === 'cloud_privacy' && (
                    <motion.div
                        key="cloud_privacy"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="Privacy & Sync" onBack={() => setCurrentView('cloud')} />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 space-y-5">
                                <div className="flex gap-4">
                                    <Cloud className="text-blue-400 shrink-0 mt-0.5" size={24} />
                                    <div className="space-y-4">
                                        <p className="text-blue-200/90 text-sm leading-relaxed">
                                            By continuing, you allow Anime Picker to create a <span className="text-blue-200 font-bold underline">private application data folder</span> in your Google Drive.
                                        </p>
                                        <ul className="text-xs text-gray-400 space-y-2.5 list-disc pl-4">
                                            <li><span className="text-white/80 font-medium">No 3rd-party servers</span> or databases are used; sync is direct with Google.</li>
                                            <li>Your personal files (photos, docs, etc.) are <span className="text-white/80 font-medium">never</span> accessed.</li>
                                            <li>Only reads and writes data inside its <span className="text-white/80 font-medium">own hidden folder</span>.</li>
                                            <li>Enables secure cloud backup and cross-device syncing.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <button
                                    onClick={() => {
                                        if (currentUser?.isGoogle) onGoogleSignIn();
                                        else onLinkAccount();
                                    }}
                                    disabled={isGoogleLoading}
                                    className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-100 py-3.5 rounded-xl font-bold transition-all shadow-lg group disabled:opacity-50"
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
                                {isGoogleLoading && (
                                    <button
                                        onClick={onCancelGoogleSignIn}
                                        className="w-full py-2 text-xs text-gray-500 hover:text-white transition-colors underline decoration-gray-600 underline-offset-4"
                                    >
                                        Cancel connection
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
                {currentView === 'destruction' && (
                    <motion.div
                        key="view-destruction"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="Manage Account" />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                            <div className="space-y-6">
                                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4">
                                    <p className="text-xs text-red-400/80 leading-relaxed">
                                        These actions are destructive. Please proceed with caution. Data cleared or accounts deleted cannot be recovered.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Cleanup</h4>
                                        <button
                                            onClick={onClearData}
                                            className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                                                <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-700" />
                                            </div>
                                            <div className="text-left">
                                                <span className="text-sm font-bold block">Clear All Data</span>
                                                <span className="text-[10px] text-gray-500">Wipe Library, Watchlist & Picks</span>
                                            </div>
                                        </button>
                                    </div>

                                    {!currentUser?.isGoogle && (
                                        <div className="space-y-2 pt-2">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Danger Zone</h4>
                                            <button
                                                onClick={onDeleteAccount}
                                                className="flex items-center gap-3 w-full p-3 rounded-2xl bg-red-600/10 border border-red-600/20 text-red-400 hover:bg-red-600/20 hover:border-red-600/30 transition-all group"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                                                    <User size={20} />
                                                </div>
                                                <div className="text-left">
                                                    <span className="text-sm font-bold block">Delete Account</span>
                                                    <span className="text-[10px] text-red-500/70">Permanently remove your profile</span>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-auto pt-8">
                                <p className="text-[10px] text-center text-gray-600 italic">
                                    Be careful, one wrong click and—*poof*—it's gone.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
                {currentView === 'data_backup' && (
                    <motion.div
                        key="view-data-backup"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={subViewVariants}
                        className="flex flex-col h-full"
                    >
                        <MenuHeader title="Backup & Portability" />
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                            <div className="space-y-6">
                                <div className="bg-violet-500/5 border border-violet-500/10 rounded-2xl p-4">
                                    <p className="text-xs text-violet-300/80 leading-relaxed font-medium">
                                        Manage your local data by exporting to a file or importing from a previous backup.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Save Data</h4>
                                        <button
                                            onClick={onExport}
                                            className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform shadow-lg shadow-violet-900/10">
                                                <Download size={20} />
                                            </div>
                                            <div className="text-left">
                                                <span className="text-sm font-bold block">Export Library</span>
                                                <span className="text-[10px] text-gray-500">Download as .json file</span>
                                            </div>
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Restore Data</h4>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onImport();
                                            }}
                                            className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-pink-600/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform shadow-lg shadow-pink-900/10">
                                                <Upload size={20} />
                                            </div>
                                            <div className="text-left">
                                                <span className="text-sm font-bold block">Import Library</span>
                                                <span className="text-[10px] text-gray-500">Restore from .json file</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-8">
                                <div className="bg-white/5 border border-dashed border-white/10 rounded-xl p-3 text-center">
                                    <p className="text-[10px] text-gray-500">
                                        Local data is stored in your browser. Regularly export to keep your data safe.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Generic Confirmation Modal */}
            <AnimatePresence>
                {confirmConfig && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setConfirmConfig(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-sm bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6"
                        >
                            <h3 className="text-lg font-bold text-white mb-2">{confirmConfig.title}</h3>
                            <p className="text-sm text-gray-400 leading-relaxed mb-8">
                                {confirmConfig.message}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmConfig(null)}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmConfig.onConfirm}
                                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${confirmConfig.isDanger ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-900/20'}`}
                                >
                                    {confirmConfig.actionLabel}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
