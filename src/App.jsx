import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LibraryDisplay from './components/LibraryDisplay';
import RecommendationDisplay from './components/RecommendationDisplay';
import WatchlistDisplay from './components/WatchlistDisplay';
import AboutContent from './components/AboutContent';
import AuthModal from './components/AuthModal';
import UserMenuContent from './components/UserMenuContent';
import ExcludeModal from './components/ExcludeModal';
import { getRecommendations, getAnimeInfo } from './services/aiService';
import { getAnimeImage } from './services/jikanService';
import {
    getCurrentUser,
    signup,
    login,
    logout,
    getUserLibrary,
    saveUserLibrary,
    getUserWatchlist,
    saveUserWatchlist,
    getUserRecommendations,
    saveUserRecommendations,
    deleteUser,
    getUserInstructions,
    saveUserInstructions,
    getUserExcluded,
    saveUserExcluded,
    loginWithGoogle,
    linkGoogleToEmail,
    getCurrentUser as getStoredUser
} from './services/authService';
import {
    ensureSubsystems,
    getToken,
    findSyncFile,
    downloadSyncData,
    uploadSyncData,
    googleLogout,
    getUserProfile
} from './services/googleDriveService';
import { Toaster, toast } from 'sonner';
import { LogOut, User, LayoutGrid, Sparkles, ArrowUp, ArrowDown, Plus, X, Play, Search, Info, Key, Download, Upload, RefreshCw, Heart, Trash2, ChevronUp, Check } from 'lucide-react';

const DEMOGRAPHIC_DEFAULT_INSTRUCTION = "[ALWAYS] IMPORTANT: Analyze the anime's demographic (Shonen, Seinen, Shojo, Josei, Kodomomuke). You MUST include the identified demographic as a string in the \"genres\" array.";
const RECOMMENDATION_DEFAULT_INSTRUCTION = "Identify the most common demographics (e.g., Seinen, Josei, Shonen, Shoujo) in my library and prioritize new recommendations that match them.";

function App() {
    const [aiProvider, setAiProvider] = useState(localStorage.getItem('ai_provider') || 'openrouter');
    const [apiKey, setApiKey] = useState(localStorage.getItem('openrouter_api_key') || '');
    const [groqApiKey, setGroqApiKey] = useState(localStorage.getItem('groq_api_key') || '');
    const [cerebrasApiKey, setCerebrasApiKey] = useState(localStorage.getItem('cerebras_api_key') || '');
    const [mistralApiKey, setMistralApiKey] = useState(localStorage.getItem('mistral_api_key') || '');
    const [selectedModel, setSelectedModel] = useState(() => {
        const provider = localStorage.getItem('ai_provider') || 'openrouter';
        if (provider === 'groq') return localStorage.getItem('groq_model') || 'llama-3.3-70b-versatile';
        if (provider === 'cerebras') return localStorage.getItem('cerebras_model') || 'llama-3.3-70b';
        if (provider === 'mistral') return localStorage.getItem('mistral_model') || 'mistral-large-latest';
        return localStorage.getItem('openrouter_model') || 'tngtech/deepseek-r1t2-chimera:free';
    });
    const [currentUser, setCurrentUser] = useState(() => getStoredUser());
    const [library, setLibrary] = useState(() => {
        const user = getStoredUser();
        if (!user) return [];
        return getUserLibrary(user.username || user);
    });
    const [watchlist, setWatchlist] = useState(() => {
        const user = getStoredUser();
        if (!user) return [];
        return getUserWatchlist(user.username || user);
    });
    const [recommendations, setRecommendations] = useState(() => {
        const user = getStoredUser();
        if (!user) return [];
        return getUserRecommendations(user.username || user);
    });
    const [excludedItems, setExcludedItems] = useState(() => {
        const user = getStoredUser();
        if (!user) return [];
        return getUserExcluded(user.username || user);
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [loadingItems, setLoadingItems] = useState([]);
    const [activeTab, setActiveTab] = useState('recommendations');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [showScrollBottom, setShowScrollBottom] = useState(true);
    const [scrollTopPressed, setScrollTopPressed] = useState(false);
    const [scrollBottomPressed, setScrollBottomPressed] = useState(false);

    // Quick Add Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItemTitle, setNewItemTitle] = useState('');

    // Quick Search State
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [watchlistSearchQuery, setWatchlistSearchQuery] = useState('');
    const [recommendationsSearchQuery, setRecommendationsSearchQuery] = useState('');
    const [quickSearchQuery, setQuickSearchQuery] = useState('');
    const [searchSources, setSearchSources] = useState({
        library: true,
        watchlist: true,
        recommendations: false
    });

    const scrollPositions = useRef({ library: 0, recommendations: 0, watchlist: 0 });
    const activeTabRef = useRef(activeTab);
    const tabsRef = useRef(null);
    const watchlistInputRef = useRef(null);
    const recsInputRef = useRef(null);

    const getCurrentApiKey = useCallback(() => {
        if (aiProvider === 'groq') return groqApiKey;
        if (aiProvider === 'cerebras') return cerebrasApiKey;
        if (aiProvider === 'mistral') return mistralApiKey;
        return apiKey;
    }, [aiProvider, apiKey, groqApiKey, cerebrasApiKey, mistralApiKey]);
    const countDropdownRef = useRef(null);
    const abortControllerRef = useRef(null);
    const [showFloatingBar, setShowFloatingBar] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, id: null, title: null, type: 'library' });
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showClearAllDataConfirm, setShowClearAllDataConfirm] = useState(false);
    const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
    const [customInstructions, setCustomInstructions] = useState(() => {
        const user = getStoredUser();
        if (!user) return [];
        return getUserInstructions(user.username || user);
    });
    const [showInstructionDeleteConfirm, setShowInstructionDeleteConfirm] = useState(false);
    const [showInstructionDeleteAllConfirm, setShowInstructionDeleteAllConfirm] = useState(false);
    const [instructionToDelete, setInstructionToDelete] = useState(null);
    const [showInstructionEditModal, setShowInstructionEditModal] = useState(false);

    const [instructionToEdit, setInstructionToEdit] = useState({ index: null, value: '' });
    const [addToTarget, setAddToTarget] = useState('library'); // 'library' or 'watchlist'
    const [generateCount, setGenerateCount] = useState(5);
    const [showCountDropdown, setShowCountDropdown] = useState(false);

    // Exclude Modal State
    const [showExcludeModal, setShowExcludeModal] = useState(false);
    const [itemToExclude, setItemToExclude] = useState(null);

    // Google Sync State
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
    const [lastCloudSync, setLastCloudSync] = useState(null);

    const [performanceSettings, setPerformanceSettings] = useState(() => {
        const saved = localStorage.getItem('performance_settings');
        return saved ? JSON.parse(saved) : { enableBlur: false, enhancedMotion: false };
    });

    // Apply blur settings to body
    useEffect(() => {
        if (performanceSettings.enableBlur) {
            document.body.classList.remove('disable-blur');
        } else {
            document.body.classList.add('disable-blur');
        }
    }, [performanceSettings.enableBlur]);

    const togglePerformanceSetting = useCallback((setting) => {
        setPerformanceSettings(prev => {
            const newSettings = { ...prev, [setting]: !prev[setting] };
            performanceRef.current = newSettings; // Update Ref
            return newSettings;
        });
    }, []);

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



    const libraryRef = useRef(library);
    const watchlistRef = useRef(watchlist);
    const recommendationsRef = useRef(recommendations);
    const instructionsRef = useRef(customInstructions);
    const excludedItemsRef = useRef(excludedItems);
    const performanceRef = useRef(performanceSettings);
    const isLoadingLibrary = useRef(true); // Start as true to prevent mount markings
    const isApplyingCloudSync = useRef(false);
    const [hasAutoSynced, setHasAutoSynced] = useState(false);
    const autoSyncTimerRef = useRef(null);
    const importFileRef = useRef(null);

    const markLocalChange = useCallback((field) => {
        if (!currentUser || isLoadingLibrary.current || isApplyingCloudSync.current) return;
        const username = currentUser.username || currentUser;
        localStorage.setItem(`${username}_last_local_change_iso`, new Date().toISOString());
        if (field) {
            const now = new Date().toISOString();
            localStorage.setItem(`${username}_last_local_change_${field}_iso`, now);
        }
    }, [currentUser]);

    useEffect(() => {
        localStorage.setItem('performance_settings', JSON.stringify(performanceSettings));
        if (currentUser && !isLoadingLibrary.current) {
            markLocalChange('performanceSettings');
        }
    }, [performanceSettings, currentUser, markLocalChange]);

    useEffect(() => {
        if (currentUser) {
            const username = currentUser.username || currentUser;
            isLoadingLibrary.current = true;
            const savedLibrary = getUserLibrary(username);

            // Remove duplicates (keep first occurrence) AND filter out invalid items
            const seen = new Set();
            const dedupedLibrary = savedLibrary.filter(item => {
                // Recover from corrupted data (empty strings, nulls, undefined)
                if (!item) return false;

                const titleStr = typeof item === 'string' ? item : item.title;
                if (!titleStr || typeof titleStr !== 'string' || !titleStr.trim()) return false;

                const title = titleStr.toLowerCase().trim();
                if (seen.has(title)) return false;
                seen.add(title);
                return true;
            });

            setLibrary(dedupedLibrary);
            libraryRef.current = dedupedLibrary;

            // Force save if duplicates were removed
            if (dedupedLibrary.length !== savedLibrary.length) {
                saveUserLibrary(username, dedupedLibrary);
            }

            // Load watchlist
            const savedWatchlist = getUserWatchlist(username);
            setWatchlist(savedWatchlist);
            watchlistRef.current = savedWatchlist;

            // Load recommendations
            const savedRecommendations = getUserRecommendations(username);
            setRecommendations(savedRecommendations);

            // Load custom instructions
            let savedInstructions = getUserInstructions(username);
            const hasSeenDefault = localStorage.getItem(`${username}_has_seen_demographic_default`);

            let hasChanges = false;

            // Migration: Ensure demographics info instruction is the strong version
            if (savedInstructions) {
                const newInst = savedInstructions.map(i => {
                    const normalized = i.trim().toUpperCase();
                    // Catch various previous versions of the [ALWAYS] tag by keywords
                    if (normalized.startsWith("[ALWAYS]") && normalized.includes("DEMOGRAPHIC")) {
                        return DEMOGRAPHIC_DEFAULT_INSTRUCTION;
                    }
                    return i;
                });

                // Check if actually changed
                if (JSON.stringify(newInst) !== JSON.stringify(savedInstructions)) {
                    savedInstructions = newInst;
                    hasChanges = true;
                }
            }

            // Initialization: Ensure BOTH defaults are present and at the top if not seen
            const hasSeenMultiDefault = localStorage.getItem(`${username}_has_seen_split_demographic_defaults`);

            if (!hasSeenMultiDefault) {
                let existingInst = savedInstructions || [];

                // Filter out existing versions to re-add them at the top
                const userInst = existingInst.filter(i =>
                    i !== DEMOGRAPHIC_DEFAULT_INSTRUCTION &&
                    i !== RECOMMENDATION_DEFAULT_INSTRUCTION &&
                    !(i.toLowerCase().includes("identify the most common demographics") && !i.startsWith("[ALWAYS]"))
                );

                const newInst = [
                    DEMOGRAPHIC_DEFAULT_INSTRUCTION,
                    RECOMMENDATION_DEFAULT_INSTRUCTION,
                    ...userInst
                ];

                if (JSON.stringify(newInst) !== JSON.stringify(existingInst)) {
                    savedInstructions = newInst;
                    hasChanges = true;
                }
                localStorage.setItem(`${username}_has_seen_split_demographic_defaults`, 'true');
                localStorage.setItem(`${username}_has_seen_demographic_default`, 'true');
            }

            if (hasChanges) {
                saveUserInstructions(username, savedInstructions);
            }

            setCustomInstructions(savedInstructions || []);

            // Load excluded items
            const savedExcluded = getUserExcluded(username);
            setExcludedItems(savedExcluded || []);

            // Protect against mount-load triggering auto-sync markers
            // 2000ms is enough for all React effects to settle
            setTimeout(() => {
                isLoadingLibrary.current = false;
            }, 2000);
        } else {
            setLibrary([]);
            libraryRef.current = [];
            setWatchlist([]);
            watchlistRef.current = [];
            setRecommendations([]);
            recommendationsRef.current = [];
            setExcludedItems([]);
            excludedItemsRef.current = [];
            isLoadingLibrary.current = false;
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser && !isLoadingLibrary.current) {
            const username = currentUser.username || currentUser;
            saveUserLibrary(username, library);
            markLocalChange('library');
        }
        libraryRef.current = library;
    }, [library, currentUser, markLocalChange]);

    // Body scroll lock effect
    useEffect(() => {
        const anyModalOpen = isModalOpen || deleteConfirmation.isOpen || showAddModal || showSearchModal ||
            showUserMenu || showLogoutConfirm || showGenerateConfirm ||
            showClearConfirm || showDeleteAccountConfirm || showInstructionDeleteConfirm ||
            showInstructionDeleteAllConfirm || showInstructionEditModal || showExcludeModal ||
            showAuthModal;

        if (anyModalOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [
        isModalOpen, deleteConfirmation.isOpen, showAddModal, showSearchModal,
        showUserMenu, showLogoutConfirm, showGenerateConfirm,
        showClearConfirm, showDeleteAccountConfirm, showInstructionDeleteConfirm,
        showInstructionDeleteAllConfirm, showInstructionEditModal, showExcludeModal,
        showAuthModal
    ]);

    // Save watchlist when it changes
    useEffect(() => {
        if (currentUser && !isLoadingLibrary.current) {
            const username = currentUser.username || currentUser;
            saveUserWatchlist(username, watchlist);
            markLocalChange('watchlist');
        }
        watchlistRef.current = watchlist;
    }, [watchlist, currentUser, markLocalChange]);

    // Save recommendations when they change
    useEffect(() => {
        if (currentUser && !isLoadingLibrary.current) {
            const username = currentUser.username || currentUser;
            saveUserRecommendations(username, recommendations);
            markLocalChange('recommendations');
        }
        recommendationsRef.current = recommendations;
    }, [recommendations, currentUser, markLocalChange]);

    // Automatic Cloud Sync (Debounced)
    useEffect(() => {
        if (isGoogleSignedIn && currentUser && !isLoadingLibrary.current && hasAutoSynced) {
            // Cancel existing timer
            if (autoSyncTimerRef.current) {
                clearTimeout(autoSyncTimerRef.current);
            }

            // Set new timer for 3 seconds
            autoSyncTimerRef.current = setTimeout(() => {
                console.log("Auto-syncing to Google Drive...");
                handleCloudUpload(false);
            }, 3000);
        }

        return () => {
            if (autoSyncTimerRef.current) {
                clearTimeout(autoSyncTimerRef.current);
            }
        };
    }, [library, watchlist, recommendations, customInstructions, excludedItems, performanceSettings, isGoogleSignedIn, currentUser, hasAutoSynced]);

    // Save custom instructions when they change
    useEffect(() => {
        if (currentUser && !isLoadingLibrary.current) {
            const username = currentUser.username || currentUser;
            saveUserInstructions(username, customInstructions);
            markLocalChange('instructions');
        }
        instructionsRef.current = customInstructions;
    }, [customInstructions, currentUser, markLocalChange]);

    // Save excluded items when they change
    useEffect(() => {
        if (currentUser && !isLoadingLibrary.current) {
            const username = currentUser.username || currentUser;
            saveUserExcluded(username, excludedItems);
            markLocalChange('excludedItems');
        }
        excludedItemsRef.current = excludedItems;
    }, [excludedItems, currentUser, markLocalChange]);

    // Keep activeTabRef in sync
    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (countDropdownRef.current && !countDropdownRef.current.contains(event.target)) {
                setShowCountDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Lock body scroll when any modal is open
    // Lock body scroll when any modal is open
    useEffect(() => {
        if (isModalOpen || deleteConfirmation.isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isModalOpen, deleteConfirmation.isOpen]);

    // Restore scroll position when tab changes
    useLayoutEffect(() => {
        const savedPosition = scrollPositions.current[activeTab];
        if (savedPosition !== undefined) {
            window.scrollTo({ top: savedPosition, behavior: 'auto' });
        }
    }, [activeTab]);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const scrollToBottom = () => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    // Initial load: restore Google sync (session is already restored in state)
    useEffect(() => {
        if (currentUser) {
            // For ALL users (manual or google), try to restore a Google session if they have a persistent token
            const username = currentUser.username || currentUser;
            const hint = currentUser.isGoogle ? currentUser.profile?.email : null;
            const hasStoredToken = localStorage.getItem(`${username}_google_drive_persistent_token`);

            // Only attempt silent re-auth if they are a Google user or have explicitly connected before
            if (currentUser.isGoogle || hasStoredToken) {
                ensureSubsystems().then(() => {
                    getToken(username, hint, true).then(token => {
                        if (token && !hasAutoSynced) {
                            setHasAutoSynced(true);
                            setIsGoogleSignedIn(true);
                            setLastCloudSync(localStorage.getItem(`${username}_last_cloud_sync`) || null);
                            // CRITICAL: Pass currentUser directly AND forceCloud=true to stop resurrection
                            handleCloudSync(false, currentUser, true);
                        }
                    }).catch((err) => {
                        console.warn('Initial silent Google re-auth failed or not available for user.');
                    });
                });
            }
        }
    }, []);

    // Scroll listener for back to top button only
    // Floating bar is now always visible
    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 300);

            // Detect if near bottom of page (within 200px)
            const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 200;
            setShowScrollBottom(!nearBottom);
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll(); // Initial check

        // Always show floating bar
        setShowFloatingBar(true);

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Google Drive Sync Handlers
    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        console.log('STEP 1: Starting Google Sign In flow');
        try {
            console.log('STEP 2: Ensuring GAPI subsystems');
            await ensureSubsystems();

            console.log('STEP 3: Requesting token from GIS');
            const token = await getToken('temp_login', null, false, true);

            if (token) {
                console.log('STEP 4: Token acquired, fetching user profile');
                const profile = await getUserProfile();

                if (profile) {
                    console.log('STEP 5: Profile fetched, logging in user locally');
                    const user = loginWithGoogle(profile);
                    setCurrentUser(user);
                    setIsGoogleSignedIn(true);

                    // CRITICAL: Re-save the token under the REAL username so startup re-auth works
                    const userTokenKey = `${user.username}_google_drive_persistent_token`;
                    const expiresAt = Date.now() + 3600000; // Default 1 hour
                    localStorage.setItem(userTokenKey, JSON.stringify({
                        token: token,
                        expiresAt
                    }));

                    setLastCloudSync(localStorage.getItem(`${user.username}_last_cloud_sync`) || null);
                    toast.success(`Welcome, ${profile.name || profile.email}!`);
                    setShowAuthModal(false);

                    console.log('STEP 6: Starting initial cloud sync');
                    try {
                        await handleCloudSync(false, user);
                        console.log('STEP 7: Cloud sync complete');
                    } catch (syncError) {
                        console.error('STEP 7 ERROR: Cloud sync failed:', syncError);
                    }
                } else {
                    console.error('STEP 5 ERROR: Profile fetch returned null');
                    throw new Error('Could not fetch user profile from Google');
                }
            } else {
                console.warn('STEP 4 WARNING: No token returned from getToken');
            }
        } catch (error) {
            console.error("CRITICAL SIGN-IN ERROR:", error);
            const errorMsg = error.message || "Failed to sign in with Google";
            toast.error(errorMsg);
        } finally {
            console.log('STEP FINAL: Sign-in flow ended, clearing loading state');
            setIsGoogleLoading(false);
        }
    };

    const handleLinkAccount = async () => {
        if (!currentUser) return;
        setIsGoogleLoading(true);

        try {
            await ensureSubsystems();
            const token = await getToken(currentUser.username, null, false, true);
            if (token) {
                // Pure isolation: We don't link the identity in authService.
                // We just mark as signed in for this session.
                setIsGoogleSignedIn(true);
                toast.success("Connected to Google Drive successfully!");
                // Initial upload/sync (silent)
                handleCloudSync(false);
            }
        } catch (error) {
            console.error("Linking Error:", error);
            toast.error("Failed to connect Google Drive");
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleCancelGoogleSignIn = () => {
        setIsGoogleLoading(false);
        toast.info("Sign-in cancelled");
    };

    const handleGoogleSignOut = () => {
        const username = currentUser.username || currentUser;
        googleLogout(username);
        setIsGoogleSignedIn(false);
        setLastCloudSync(null);
        toast.info("Signed out from Google Drive");
    };

    const handleCloudSync = async (showToast = true, overrideUser = null, forceCloud = false) => {
        const userToSync = overrideUser || currentUser;
        if (!userToSync || !userToSync.username) {
            console.error("Cloud Sync: No valid user to sync.", { currentUser, overrideUser });
            if (showToast) toast.error("Please log in to sync");
            return;
        }

        const username = userToSync.username;
        setIsGoogleLoading(true);
        try {
            await ensureSubsystems();
            const username = userToSync.username;

            // Safety check: ensure GAPI has a token
            if (!gapi.client.getToken()) {
                const token = await getToken(username, userToSync.isGoogle ? userToSync.profile?.email : null, true);
                if (!token) throw new Error("Not authenticated");
            }

            const syncFile = await findSyncFile();
            const fields = ['library', 'watchlist', 'recommendations', 'instructions', 'excludedItems', 'performanceSettings'];
            const getLocalFieldTs = (field) => {
                const iso = localStorage.getItem(`${username}_last_local_change_${field}_iso`);
                return iso ? new Date(iso).getTime() : 0;
            };
            const setLocalFieldTs = (field, ts) => {
                if (ts > 0) localStorage.setItem(`${username}_last_local_change_${field}_iso`, new Date(ts).toISOString());
            };

            if (syncFile) {
                const cloudData = await downloadSyncData(syncFile.id);
                const cloudSnapshotTs = cloudData?.timestamp ? new Date(cloudData.timestamp).getTime() : 0;
                const cloudModifiedAt = cloudData?.modifiedAt || {};
                const getCloudFieldTs = (field) => {
                    const iso = cloudModifiedAt[field];
                    if (iso) return new Date(iso).getTime();
                    return cloudSnapshotTs;
                };

                const localState = {
                    library: libraryRef.current,
                    watchlist: watchlistRef.current,
                    recommendations: recommendationsRef.current,
                    instructions: instructionsRef.current,
                    excludedItems: excludedItemsRef.current,
                    performanceSettings: performanceRef.current
                };

                const resolved = {};
                const resolvedModifiedAt = {};
                fields.forEach((field) => {
                    const localTs = getLocalFieldTs(field);
                    const cloudTs = getCloudFieldTs(field);
                    // Cloud >= Local ensures cloud wins in case of equality (stable baseline)
                    // forceCloud ensures we favor cloud on the very first sync of the session
                    const chooseCloud = forceCloud || (cloudTs >= localTs);

                    resolved[field] = chooseCloud ? cloudData?.[field] : localState[field];
                    const resolvedTs = chooseCloud ? cloudTs : localTs;
                    resolvedModifiedAt[field] = new Date(resolvedTs > 0 ? resolvedTs : Date.now()).toISOString();
                });

                isApplyingCloudSync.current = true;
                setLibrary(Array.isArray(resolved.library) ? resolved.library : library);
                setWatchlist(Array.isArray(resolved.watchlist) ? resolved.watchlist : watchlist);
                setRecommendations(Array.isArray(resolved.recommendations) ? resolved.recommendations : recommendations);
                setCustomInstructions(Array.isArray(resolved.instructions) ? resolved.instructions : customInstructions);
                setExcludedItems(Array.isArray(resolved.excludedItems) ? resolved.excludedItems : excludedItems);
                setPerformanceSettings(resolved.performanceSettings || performanceSettings);

                // CRITICAL: Synchronize Refs so subsequent auto-syncs don't re-upload stale local data
                libraryRef.current = Array.isArray(resolved.library) ? resolved.library : libraryRef.current;
                watchlistRef.current = Array.isArray(resolved.watchlist) ? resolved.watchlist : watchlistRef.current;
                recommendationsRef.current = Array.isArray(resolved.recommendations) ? resolved.recommendations : recommendationsRef.current;
                instructionsRef.current = Array.isArray(resolved.instructions) ? resolved.instructions : instructionsRef.current;
                excludedItemsRef.current = Array.isArray(resolved.excludedItems) ? resolved.excludedItems : excludedItemsRef.current;
                performanceRef.current = resolved.performanceSettings || performanceRef.current;

                setTimeout(() => {
                    isApplyingCloudSync.current = false;
                }, 0);

                await uploadSyncData({
                    library: Array.isArray(resolved.library) ? resolved.library : library,
                    watchlist: Array.isArray(resolved.watchlist) ? resolved.watchlist : watchlist,
                    recommendations: Array.isArray(resolved.recommendations) ? resolved.recommendations : recommendations,
                    instructions: Array.isArray(resolved.instructions) ? resolved.instructions : customInstructions,
                    excludedItems: Array.isArray(resolved.excludedItems) ? resolved.excludedItems : excludedItems,
                    performanceSettings: resolved.performanceSettings || performanceSettings,
                    modifiedAt: resolvedModifiedAt,
                    timestamp: new Date().toISOString()
                }, syncFile.id);

                fields.forEach((field) => {
                    const ts = new Date(resolvedModifiedAt[field]).getTime();
                    setLocalFieldTs(field, ts);
                });

            } else {
                // No sync file found, create one with current local data
                const nowIso = new Date().toISOString();
                const modifiedAt = {
                    library: localStorage.getItem(`${username}_last_local_change_library_iso`) || nowIso,
                    watchlist: localStorage.getItem(`${username}_last_local_change_watchlist_iso`) || nowIso,
                    recommendations: localStorage.getItem(`${username}_last_local_change_recommendations_iso`) || nowIso,
                    instructions: localStorage.getItem(`${username}_last_local_change_instructions_iso`) || nowIso,
                    excludedItems: localStorage.getItem(`${username}_last_local_change_excludedItems_iso`) || nowIso,
                    performanceSettings: localStorage.getItem(`${username}_last_local_change_performanceSettings_iso`) || nowIso
                };
                await uploadSyncData({
                    library,
                    watchlist,
                    recommendations,
                    instructions: customInstructions,
                    excludedItems,
                    performanceSettings,
                    modifiedAt,
                    timestamp: nowIso
                });
            }

            const nowIso = new Date().toISOString();
            const now = new Date(nowIso).toLocaleString();
            setLastCloudSync(now);
            localStorage.setItem(`${username}_last_cloud_sync`, now);
            localStorage.setItem(`${username}_last_cloud_sync_iso`, nowIso);
            localStorage.setItem(`${username}_last_local_change_iso`, nowIso);
            setHasAutoSynced(true); // Set gatekeeper after successful sync
            if (showToast) {
                toast.success("Synced with Google Drive");
            }
        } catch (error) {
            console.error("Cloud Sync Error:", error);
            toast.error("Failed to sync with Google Drive");
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleCloudUpload = async (showToast = true) => {
        setIsGoogleLoading(true);
        try {
            await ensureSubsystems();
            const username = currentUser.username || currentUser;

            // Safety check: ensure GAPI has a token
            if (!gapi.client.getToken()) {
                const token = await getToken(username, currentUser.isGoogle ? currentUser.profile?.email : null, true);
                if (!token) throw new Error("Not authenticated");
            }

            const syncFile = await findSyncFile();
            const nowIso = new Date().toISOString();
            const modifiedAt = {
                library: localStorage.getItem(`${username}_last_local_change_library_iso`) || nowIso,
                watchlist: localStorage.getItem(`${username}_last_local_change_watchlist_iso`) || nowIso,
                recommendations: localStorage.getItem(`${username}_last_local_change_recommendations_iso`) || nowIso,
                instructions: localStorage.getItem(`${username}_last_local_change_instructions_iso`) || nowIso,
                excludedItems: localStorage.getItem(`${username}_last_local_change_excludedItems_iso`) || nowIso,
                performanceSettings: localStorage.getItem(`${username}_last_local_change_performanceSettings_iso`) || nowIso
            };

            await uploadSyncData({
                library: libraryRef.current,
                watchlist: watchlistRef.current,
                recommendations: recommendationsRef.current,
                instructions: instructionsRef.current,
                excludedItems: excludedItemsRef.current,
                performanceSettings: performanceRef.current,
                modifiedAt,
                timestamp: nowIso
            }, syncFile?.id);

            const now = new Date(nowIso).toLocaleString();
            setLastCloudSync(now);
            localStorage.setItem(`${username}_last_cloud_sync`, now);
            localStorage.setItem(`${username}_last_cloud_sync_iso`, nowIso);
            localStorage.setItem(`${username}_last_local_change_iso`, nowIso);
            if (showToast) {
                toast.success("Data uploaded to Google Drive");
            }
        } catch (error) {
            console.error("Cloud Upload Error:", error);
            if (showToast) {
                toast.error("Failed to upload to Google Drive");
            }
        } finally {
            setIsGoogleLoading(false);
        }
    };


    const handleTabSwitch = (newTab) => {
        // Use ref to check against current state even if closure is stale
        if (newTab === activeTabRef.current) return;
        // Save current scroll position
        scrollPositions.current[activeTabRef.current] = window.scrollY;
        setActiveTab(newTab);
    };

    const handleAuth = async (mode, username, password) => {
        if (mode === 'signup') {
            const user = await signup(username, password);
            setCurrentUser(user);
            toast.success(`Welcome, ${user.username}! Account created.`);
        } else {
            const user = await login(username, password);
            setCurrentUser(user);
            // Reset Google state for this user
            setIsGoogleSignedIn(user.isGoogle || false);
            setLastCloudSync(localStorage.getItem(`${user.username}_last_cloud_sync`) || null);
            toast.success(`Welcome back, ${user.username}!`);
        }
        setShowAuthModal(false);
    };

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        const username = currentUser.username || currentUser;
        googleLogout(username);
        logout();
        setCurrentUser(null);
        setIsGoogleSignedIn(false);
        setLastCloudSync(null);
        setRecommendations([]);
        setActiveTab('library');
        scrollPositions.current = { library: 0, recommendations: 0 };
        setShowLogoutConfirm(false);
        setShowUserMenu(false);
        toast.info("Logged out successfully.");
    };

    const cancelLogout = () => {
        setShowLogoutConfirm(false);
    };

    const handleDeleteAccount = () => {
        setShowDeleteAccountConfirm(true);
    };

    const confirmDeleteAccount = () => {
        const username = currentUser.username || currentUser;
        if (deleteUser(username)) {
            setCurrentUser(null);
            setRecommendations([]);
            recommendationsRef.current = []; // Update Ref
            setLibrary([]);
            libraryRef.current = []; // Update Ref
            setWatchlist([]);
            watchlistRef.current = []; // Update Ref
            setExcludedItems([]);
            excludedItemsRef.current = []; // Update Ref
            setActiveTab('library');
            scrollPositions.current = { library: 0, recommendations: 0, watchlist: 0 };
            setShowDeleteAccountConfirm(false);
            setShowUserMenu(false);
            toast.success("Account deleted successfully.");
        } else {
            toast.error("Failed to delete account.");
        }
    };

    const addToLibrary = useCallback((titleOrAnime) => {
        const title = typeof titleOrAnime === 'string' ? titleOrAnime : titleOrAnime.title;

        if (!title || typeof title !== 'string' || !title.trim()) {
            toast.error("Please enter a valid anime title");
            return;
        }

        const normalizedTitle = title.toLowerCase().trim();

        // Check if already exists using ref (always current)
        const exists = libraryRef.current.some((item) =>
            (item.title || item).toLowerCase().trim() === normalizedTitle
        );

        if (exists) {
            toast.info("Already in library", {
                description: title
            });
            return;
        }

        // Add with placeholder and unique ID
        const newItem = typeof titleOrAnime === 'string'
            ? { id: Date.now().toString(), title: titleOrAnime, genres: [], description: '' }
            : { ...titleOrAnime, id: (titleOrAnime.id || Date.now()).toString() };

        // Update ref IMMEDIATELY to prevent rapid duplicate adds
        libraryRef.current = [...libraryRef.current, newItem];

        setLibrary(prev => [...prev, newItem]);
        markLocalChange('library');
        toast.success("Added to library", {
            description: title,
            action: {
                label: 'Undo',
                onClick: () => {
                    handleItemRemoval(newItem.id, title);
                }
            },
            duration: 5000
        });

        // Fetch info in background
        if (typeof titleOrAnime === 'string' && apiKey) {
            generateInfoForItem(title, newItem.id);
        }
    }, [apiKey]);

    const handleQuickAdd = (e) => {
        e.preventDefault();
        if (!newItemTitle.trim()) return;

        if (addToTarget === 'watchlist') {
            addToWatchlist(newItemTitle);
        } else {
            addToLibrary(newItemTitle);
        }

        setNewItemTitle('');
        setShowAddModal(false);
    };

    const isRateLimitError = (error) => {
        const message = (error?.message || '').toLowerCase();
        return message.includes('rate limit') || message.includes('429');
    };

    const getShortErrorMessage = (error) => {
        if (!error) return 'Something went wrong. Please try again.';
        if (isRateLimitError(error)) return 'Rate limit hit. Please wait and try again.';
        if (error.code === 402) return 'Not enough credits. Use a free model, lower tokens, or add credits.';
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('no response') || msg.includes('empty response')) {
            return 'Model returned no response. Try another model.';
        }
        if (msg.includes('model') && msg.includes('incompatible')) {
            return 'Model incompatible with provider. Pick another model.';
        }
        return 'AI request failed. Try again or switch model/provider.';
    };

    const generateInfoForItem = async (originalTitle, itemId = null, targetList = 'library') => {
        if (!apiKey) {
            toast.error("Add your API key to generate info");
            return;
        }

        const isObject = typeof originalTitle === 'object' && originalTitle !== null;
        const title = isObject ? originalTitle.title : originalTitle;

        // Filter instructions: only include those starting with [ALWAYS]
        const alwaysInstructions = customInstructions.filter(i =>
            i.trim().toUpperCase().startsWith('[ALWAYS]')
        );

        // Don't set loading state for single item to avoid full screen loader
        setLoadingItems(prev => Array.isArray(prev) ? [...prev, title] : [title]);

        try {
            const data = await getAnimeInfo(title, getCurrentApiKey(), aiProvider, alwaysInstructions, selectedModel);

            // Create the new item object, preserving existing metadata
            const newItem = {
                ...(isObject ? originalTitle : {}), // Preserve ALL existing properties (notes, reasons, IDs, etc.)
                id: (itemId || (isObject ? originalTitle.id : null) || Date.now()).toString(),
                title: data.title || title,
                genres: data.genres || [],
                description: data.description || '',
                averageScore: data.averageScore,
                year: data.year,
                bannerImage: data.bannerImage || (isObject ? originalTitle.bannerImage : null),
                coverImage: data.coverImage || (isObject ? originalTitle.coverImage : null),
            };

            if (targetList === 'watchlist') {
                setWatchlist(prev => {
                    // Check for duplicates based on title
                    const exists = prev.some(item =>
                        (item.title || item).toLowerCase() === newItem.title.toLowerCase() && item.id !== newItem.id
                    );

                    if (exists) return prev;

                    const newList = prev.map(item => {
                        if ((item.id && (item.id === itemId || (isObject && item.id === originalTitle.id))) || (item.title || item) === title) {
                            return newItem;
                        }
                        return item;
                    });
                    watchlistRef.current = newList; // Update Ref
                    return newList;
                });
                markLocalChange('watchlist');
            } else {
                setLibrary(prev => {
                    const exists = prev.some(item =>
                        (item.title || item).toLowerCase() === newItem.title.toLowerCase() &&
                        (item.id || '').toString() !== (newItem.id || '').toString()
                    );

                    let newList;
                    if (exists) {
                        // If it exists with a different ID, we update the existing one
                        newList = prev.map(item => {
                            if ((item.title || item).toLowerCase() === newItem.title.toLowerCase()) {
                                return { ...newItem, id: item.id }; // Keep the original ID
                            }
                            return item;
                        });
                    } else {
                        newList = prev.map(item => {
                            if (((item.id || '').toString() === (itemId || (isObject ? originalTitle.id : '') || '').toString()) || (item.title || item) === title) {
                                return newItem;
                            }
                            return item;
                        });
                    }
                    libraryRef.current = newList; // Update Ref
                    return newList;
                });
                markLocalChange('library');
            }
            toast.success("Updated info", {
                description: title
            });

        } catch (error) {
            console.error(`Failed to generate info for ${title}:`, error);
            toast.error(getShortErrorMessage(error));
        } finally {
            setLoadingItems(prev => Array.isArray(prev) ? prev.filter(item => item !== title) : []);
        }
    };

    const generateAllInfo = async (mode = 'missing', targetList = 'library') => {
        if (!apiKey) {
            toast.error("Please enter your API Key first");
            return;
        }

        const sourceList = targetList === 'watchlist' ? watchlist : library;

        const itemsToGenerate = sourceList.filter(item => {
            if (mode === 'all') return true;
            // Check if item has description/genres
            const hasInfo = item.description && item.genres && item.genres.length > 0;
            return !hasInfo;
        });

        if (itemsToGenerate.length === 0) {
            toast.info("No items need information generated");
            return;
        }

        const toastId = toast.loading(`Generating info for ${itemsToGenerate.length} items...`);
        let completed = 0;

        // Process in chunks of 3 to avoid rate limits but speed up process
        const chunkSize = 3;

        try {
            for (let i = 0; i < itemsToGenerate.length; i += chunkSize) {
                const chunk = itemsToGenerate.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (item) => {
                    const title = item.title || item;
                    await generateInfoForItem(item, item.id, targetList);
                    completed++;
                }));

                // Update toast message
                toast.loading(`Generated ${completed}/${itemsToGenerate.length} items...`, { id: toastId });

                // Small delay between chunks
                if (i + chunkSize < itemsToGenerate.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            toast.success("Generation complete!", { id: toastId });
        } catch (error) {
            console.error("Generation error:", error);
            toast.error("Stopped generation due to error", { id: toastId });
        }
    };

    const handleImportLibrary = (importedItems) => {
        if (!Array.isArray(importedItems)) {
            toast.error("Invalid import file. Expected a JSON array.");
            return;
        }

        let addedCount = 0;
        let updatedCount = 0;
        const newLibrary = [...libraryRef.current];

        importedItems.forEach(item => {
            if (!item || (!item.title && typeof item !== 'string')) return;

            const title = typeof item === 'string' ? item : item.title;
            const normalizedTitle = title.toLowerCase().trim();
            const existingIndex = newLibrary.findIndex(w =>
                (w.title || w).toLowerCase().trim() === normalizedTitle
            );

            const newItem = typeof item === 'string'
                ? { id: Date.now() + Math.random(), title: item, genres: [], description: '' }
                : { ...item, id: item.id || (Date.now() + Math.random()) };

            if (existingIndex !== -1) {
                // Determine if we should update (e.g. if new item has more info)
                const existing = newLibrary[existingIndex];
                const existingHasInfo = existing.genres && existing.genres.length > 0;
                const newHasInfo = newItem.genres && newItem.genres.length > 0;

                if (!existingHasInfo && newHasInfo) {
                    newLibrary[existingIndex] = newItem;
                    updatedCount++;
                }
            } else {
                newLibrary.push(newItem);
                addedCount++;
            }
        });

        if (addedCount === 0 && updatedCount === 0) {
            toast.info("No new items found to import.");
            return;
        }

        libraryRef.current = newLibrary;
        setLibrary(newLibrary);
        toast.success(`Imported: ${addedCount} new, ${updatedCount} updated.`);
    };

    // Export library to JSON file
    const handleExportLibrary = () => {
        const data = {
            version: 3,
            timestamp: new Date().toISOString(),
            library: library,
            watchlist: watchlist,
            recommendations: recommendations,
            instructions: customInstructions,
            excludedItems: excludedItems,
            performanceSettings: performanceSettings
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anime_data_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Data exported successfully");
    };

    // Exclude Functionality
    const openExcludeModal = (item) => {
        setItemToExclude(item);
        setShowExcludeModal(true);
    };

    const handleConfirmExclude = (item, reason) => {
        handleExcludeItem(item, reason);
        setShowExcludeModal(false);
        setItemToExclude(null);
    };

    const handleExcludeItem = (item, reason) => {
        if (!item) return;
        const title = typeof item === 'string' ? item : item.title;
        if (!title) return;

        // check if already excluded
        if (excludedItems.some(ex => ex.title.toLowerCase() === title.toLowerCase())) {
            toast.info("Already excluded", {
                description: title
            });
            return;
        }

        const itemTitleLower = title.toLowerCase();
        let source = 'recommendations'; // default
        let year = (typeof item !== 'string' ? item.year : '') || '';

        // Check source and try to get year if missing
        const libItem = library.find(i => (i.title || i).toLowerCase() === itemTitleLower);
        const watchItem = watchlist.find(i => (i.title || i).toLowerCase() === itemTitleLower);

        if (libItem) {
            source = 'library';
            if (!year && typeof libItem !== 'string') year = libItem.year || '';
        } else if (watchItem) {
            source = 'watchlist';
            if (!year && typeof watchItem !== 'string') year = watchItem.year || '';
        }

        const newExcludedItem = typeof item === 'string'
            ? {
                id: Date.now(),
                title: title,
                year,
                reason: reason || '',
                source,
                date: new Date().toISOString()
            }
            : {
                ...item, // Preserve metadata (description, genres, etc.)
                id: item.id || Date.now(),
                reason: reason || '',
                source,
                date: new Date().toISOString()
            };

        const newExcluded = [...excludedItems, newExcludedItem];
        setExcludedItems(newExcluded);
        excludedItemsRef.current = newExcluded; // Update Ref

        // Remove from other lists
        // Remove from Library
        setLibrary(prev => {
            const newList = prev.filter(i => (i.title || i).toLowerCase().trim() !== itemTitleLower);
            libraryRef.current = newList; // Update Ref
            return newList;
        });

        // Remove from Watchlist
        setWatchlist(prev => {
            const newList = prev.filter(i => (i.title || i).toLowerCase().trim() !== itemTitleLower);
            watchlistRef.current = newList; // Update Ref
            return newList;
        });

        // Remove from Recommendations
        setRecommendations(prev => {
            const newList = prev.filter(i => (i.title || i).toLowerCase().trim() !== itemTitleLower);
            recommendationsRef.current = newList; // Update Ref
            return newList;
        });

        toast.success("Excluded item", {
            description: title
        });
    };



    const handleRestoreItem = (id) => {
        // Use loose equality for ID matching to handle string/number mismatch
        const itemToRestore = excludedItems.find(item => item.id == id);
        if (!itemToRestore) return;

        const newExcluded = excludedItems.filter(item => item.id != id);
        setExcludedItems(newExcluded);
        excludedItemsRef.current = newExcluded; // Update Ref

        // Restore logic - preserve full object metadata
        if (itemToRestore.source === 'library') {
            if (!library.some(i => (i.title || i).toLowerCase() === itemToRestore.title.toLowerCase())) {
                setLibrary(prev => {
                    const newList = [...prev, itemToRestore];
                    libraryRef.current = newList; // Update Ref
                    return newList;
                });
            }
            toast.success("Restored to Library", {
                description: itemToRestore.title
            });
        } else if (itemToRestore.source === 'watchlist') {
            if (!watchlist.some(i => (i.title || i).toLowerCase() === itemToRestore.title.toLowerCase())) {
                setWatchlist(prev => {
                    const newList = [...prev, itemToRestore];
                    watchlistRef.current = newList; // Update Ref
                    return newList;
                });
            }
            toast.success("Restored to Watchlist", {
                description: itemToRestore.title
            });
        } else if (itemToRestore.source === 'recommendations') {
            if (!recommendations.some(i => (i.title || i).toLowerCase() === itemToRestore.title.toLowerCase())) {
                setRecommendations(prev => {
                    const newList = [...prev, itemToRestore];
                    recommendationsRef.current = newList; // Update Ref
                    return newList;
                });
            }
            toast.success("Restored to Recommendations", {
                description: itemToRestore.title
            });
        } else {
            toast.success("Restored", {
                description: itemToRestore.title
            });
        }
    };

    const handleRestoreAllExcluded = () => {
        if (excludedItems.length === 0) return;

        const toLibrary = [];
        const toWatchlist = [];
        const toRecommendations = [];

        excludedItems.forEach(item => {
            if (item.source === 'library') {
                if (!library.some(i => (i.title || i).toLowerCase() === item.title.toLowerCase())) {
                    toLibrary.push(item);
                }
            } else if (item.source === 'watchlist') {
                if (!watchlist.some(i => (i.title || i).toLowerCase() === item.title.toLowerCase())) {
                    toWatchlist.push(item);
                }
            } else if (item.source === 'recommendations') {
                if (!recommendations.some(i => (i.title || i).toLowerCase() === item.title.toLowerCase())) {
                    toRecommendations.push(item);
                }
            }
        });

        if (toLibrary.length > 0) {
            setLibrary(prev => {
                const newList = [...prev, ...toLibrary];
                libraryRef.current = newList;
                return newList;
            });
        }
        if (toWatchlist.length > 0) {
            setWatchlist(prev => {
                const newList = [...prev, ...toWatchlist];
                watchlistRef.current = newList;
                return newList;
            });
        }
        if (toRecommendations.length > 0) {
            setRecommendations(prev => {
                const newList = [...prev, ...toRecommendations];
                recommendationsRef.current = newList;
                return newList;
            });
        }

        setExcludedItems([]);
        excludedItemsRef.current = []; // Update Ref
        toast.success(`Restored ${excludedItems.length} items`);
    };

    const handleClearExcludedItem = (id) => {
        const itemToRemove = excludedItems.find(item => item.id == id);
        if (!itemToRemove) return;

        setExcludedItems(prev => {
            const newList = prev.filter(item => item.id != id);
            excludedItemsRef.current = newList; // Update Ref
            return newList;
        });
        toast.success("Permanently removed from excluded list", {
            description: itemToRemove.title
        });
    };

    const handleClearAllExcluded = () => {
        if (excludedItems.length === 0) return;
        const count = excludedItems.length;
        setExcludedItems([]);
        excludedItemsRef.current = []; // Update Ref
        toast.success(`Permanently cleared ${count} excluded items!`);
    };

    const handleUpdateExcludedItem = (id, updates) => {
        setExcludedItems(prev => {
            const newList = prev.map(item =>
                item.id === id || item.id == id ? { ...item, ...updates } : item
            );
            excludedItemsRef.current = newList; // Update Ref
            return newList;
        });
    };

    // Filter lists based on excluded items
    const isExcluded = (item) => {
        if (!item || !item.title) return false;
        return excludedItems.some(ex => ex.title.toLowerCase() === item.title.toLowerCase());
    };

    const filteredLibrary = library.filter(item => !isExcluded(item));
    const filteredWatchlist = watchlist.filter(item => !isExcluded(item));
    const filteredRecommendations = recommendations.filter(item => !isExcluded(item));

    const handleImportFile = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                // Handle different versions/formats
                let newLibrary = [];
                let newWatchlist = [];
                let newRecommendations = [];

                if (Array.isArray(importedData)) {
                    // Legacy Format (just watchlist array)
                    newLibrary = importedData;
                } else if (importedData.watchlist || importedData.library || importedData.wishlist || importedData.recommendations || importedData.instructions) {
                    // New Format
                    newLibrary = importedData.library || importedData.watchlist || [];
                    newWatchlist = importedData.watchlist || importedData.wishlist || [];
                    newRecommendations = importedData.recommendations || [];

                    if (importedData.instructions) {
                        setCustomInstructions(prev => {
                            const newList = Array.from(new Set([...prev, ...importedData.instructions]));
                            instructionsRef.current = newList; // Update Ref
                            return newList;
                        });
                    }
                    if (importedData.excludedItems) {
                        setExcludedItems(prev => {
                            const currentMap = new Map(prev.map(item => [((item.title || item).toLowerCase().trim()), item]));
                            importedData.excludedItems.forEach(item => {
                                if (item && (item.title || item)) {
                                    currentMap.set((item.title || item).toLowerCase().trim(), item);
                                }
                            });
                            const newList = Array.from(currentMap.values());
                            excludedItemsRef.current = newList; // Update Ref
                            return newList;
                        });
                    }
                    if (importedData.performanceSettings) {
                        setPerformanceSettings(prev => {
                            const newSettings = { ...prev, ...importedData.performanceSettings };
                            performanceRef.current = newSettings; // Update Ref
                            return newSettings;
                        });
                    }
                }

                // Merge with existing data (avoiding duplicates by title)
                // Helper to merge lists
                const mergeLists = (current, incoming) => {
                    const currentMap = new Map(current.map(item => [item.title.toLowerCase(), item]));
                    const excludedTitlesLower = excludedItems.map(a => (a.title || a).toLowerCase().trim());

                    incoming.forEach(item => {
                        if (item && item.title) {
                            const titleLower = item.title.toLowerCase().trim();
                            if (!excludedTitlesLower.includes(titleLower)) {
                                currentMap.set(titleLower, item);
                            }
                        }
                    });
                    return Array.from(currentMap.values());
                };

                const mergedLibrary = mergeLists(library, newLibrary);
                const mergedWatchlist = mergeLists(watchlist, newWatchlist);
                // For recommendations, we might want to just replacements or merge. Merging seems safer.
                const mergedRecommendations = mergeLists(recommendations, newRecommendations);

                setLibrary(mergedLibrary);
                libraryRef.current = mergedLibrary; // Update Ref
                setWatchlist(mergedWatchlist);
                watchlistRef.current = mergedWatchlist; // Update Ref
                setRecommendations(mergedRecommendations);
                recommendationsRef.current = mergedRecommendations; // Update Ref

                // Save to persistence
                if (currentUser) {
                    const username = currentUser.username || currentUser;
                    saveUserLibrary(username, mergedLibrary);
                    saveUserWatchlist(username, mergedWatchlist);
                    saveUserRecommendations(username, mergedRecommendations);
                }

                toast.success("Data imported successfully");
            } catch (error) {
                console.error("Import error:", error);
                toast.error("Failed to import data. Invalid file format.");
            }
        };
        reader.readAsText(file);

        // Reset file input
        event.target.value = '';
    };

    // Handle regenerate all from user menu
    const handleRegenFromMenu = (mode, targetList) => {
        setShowUserMenu(false);
        generateAllInfo(mode, targetList);
    };

    // Restore requested item
    const restoreItem = useCallback((item) => {
        setLibrary(prev => [...prev, item]);
        toast.success("Restored to library", {
            description: item.title || item
        });
    }, []);

    const handleItemRemoval = useCallback((id, title) => {
        // Find the item first to ensure we have it for the Undo action
        let removedItem = null;

        // Use a more robust search across the current library
        const index = library.findIndex((item) =>
            (id && item.id === id) || (title && (item.title || item)?.toLowerCase() === title.toLowerCase())
        );

        if (index !== -1) {
            removedItem = library[index];
        }

        setLibrary((prev) => {
            const idx = prev.findIndex((item) =>
                (id && item.id == id) || (title && (item.title || item)?.toLowerCase().trim() === title.toLowerCase().trim())
            );
            if (idx === -1) return prev;
            const newLib = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
            libraryRef.current = newLib; // Update Ref
            return newLib;
        });

        markLocalChange('library');

        if (removedItem) {
            toast.success("Removed from library", {
                description: title || (typeof removedItem === 'string' ? removedItem : removedItem.title),
                action: {
                    label: 'Undo',
                    onClick: () => restoreItem(removedItem),
                },
                duration: 5000,
            });
        }
    }, [library, restoreItem]);

    const requestRemove = useCallback((id, title, confirm = true) => {
        if (confirm) {
            setDeleteConfirmation({ isOpen: true, id, title });
        } else {
            handleItemRemoval(id, title);
        }
    }, [handleItemRemoval]);

    const loadUserInstructions = () => {
        const username = currentUser.username || currentUser;
        const saved = getUserInstructions(username);
        // Ensure default instruction exists if list is empty or doesn't contain it (optional, but good for first run)
        if (saved.length === 0) {
            setCustomInstructions([DEFAULT_DEMOGRAPHICS_INSTRUCTION]);
            const username = currentUser.username || currentUser;
            saveUserInstructions(username, [DEFAULT_DEMOGRAPHICS_INSTRUCTION]);
        } else {
            // Check if user has the old default without [ALWAYS] and update it?
            // Or just load what they have. Let's just load what they have to respect changes.
            // But if they NEVER had it, we might want to suggest it.
            // For now, simple:
            setCustomInstructions(saved);
        }
    };

    const confirmRemove = () => {
        const { id, title, type } = deleteConfirmation;
        if (type === 'watchlist') {
            handleWatchlistRemoval(id, title);
        } else {
            handleItemRemoval(id, title);
        }
        setDeleteConfirmation({ isOpen: false, id: null, title: null, type: 'library' });
    };

    const cancelRemove = () => {
        setDeleteConfirmation({ isOpen: false, id: null, title: null, type: 'library' });
    };

    const removeFromLibrary = requestRemove; // Alias for compatibility passed to child components

    // Watchlist functions
    const addToWatchlist = (item, showToast = true) => {
        const title = typeof item === 'string' ? item : item.title;
        if (!title) return;

        const normalizedTitle = title.toLowerCase().trim();
        const alreadyInWatchlist = watchlist.some(w =>
            (w.title || w).toLowerCase().trim() === normalizedTitle
        );

        if (alreadyInWatchlist) {
            toast.info("Already in watchlist", {
                description: title
            });
            return;
        }

        const newItem = typeof item === 'string'
            ? { id: Date.now().toString(), title: item, genres: [], description: '' }
            : { ...item, id: (item.id || Date.now()).toString() };

        // Update ref IMMEDIATELY
        watchlistRef.current = [...watchlistRef.current, newItem];
        setWatchlist(prev => [...prev, newItem]);
        markLocalChange('watchlist');
        if (showToast) {
            toast.success("Added to watchlist", {
                description: title,
                action: {
                    label: 'Undo',
                    onClick: () => handleWatchlistRemoval(newItem.id, title, false)
                }
            });
        }

        // Auto-generate info if API key is present AND info is missing (e.g. added via search)
        if (apiKey && (!newItem.description || newItem.description === '')) {
            generateInfoForItem(title, newItem.id, 'watchlist');
        }
    };

    const handleWatchlistRemoval = useCallback((id, title, showToast = true) => {
        const normalizedTitle = title?.toLowerCase().trim();

        // Find item to restore before removing
        const itemToRestore = watchlist.find(item =>
            (id && item.id === id) ||
            (normalizedTitle && (item.title || item).toLowerCase().trim() === normalizedTitle)
        );

        setWatchlist(prev => {
            const newList = prev.filter(item => {
                if (id && item.id == id) return false;
                if (normalizedTitle && (item.title || item).toLowerCase().trim() === normalizedTitle) return false;
                return true;
            });
            watchlistRef.current = newList; // Update Ref
            return newList;
        });

        if (title && showToast) {
            toast.success("Removed from watchlist", {
                description: title,
                action: {
                    label: 'Undo',
                    onClick: () => {
                        if (itemToRestore) {
                            setWatchlist(prev => {
                                const exists = prev.some(w =>
                                    (itemToRestore.id && w.id === itemToRestore.id) ||
                                    (w.title || w).toLowerCase().trim() === (itemToRestore.title || itemToRestore).toLowerCase().trim()
                                );
                                if (exists) return prev;
                                return [...prev, itemToRestore];
                            });
                            toast.success("Restored to watchlist", {
                                description: title
                            });
                        }
                    }
                }
            });
        }
    }, [watchlist]);

    const requestRemoveFromWatchlist = useCallback((id, title, confirm = true) => {
        if (confirm) {
            setDeleteConfirmation({ isOpen: true, id, title, type: 'watchlist' });
        } else {
            handleWatchlistRemoval(id, title);
        }
    }, [handleWatchlistRemoval]);

    const removeFromWatchlist = handleWatchlistRemoval; // Alias for compatibility

    const moveToWatchlist = (item, showToast = true) => {
        const title = item.title || item;
        const normalizedTitle = title.toLowerCase().trim();

        // Silent remove from library
        setLibrary(prev => {
            const newList = prev.filter(w => {
                if (item.id && w.id == item.id) return false;
                if ((w.title || w).toLowerCase().trim() === normalizedTitle) return false;
                return true;
            });
            libraryRef.current = newList; // Update ref for sync
            return newList;
        });
        markLocalChange('library');

        // Add to watchlist (silent)
        addToWatchlist(item, false);

        // Toast with Undo
        if (showToast) {
            toast.success("Moved to watchlist", {
                description: title,
                action: {
                    label: 'Undo',
                    onClick: () => {
                        setWatchlist(prev => {
                            const newList = prev.filter(w => {
                                if (item.id && w.id == item.id) return false;
                                if ((w.title || w).toLowerCase().trim() === normalizedTitle) return false;
                                return true;
                            });
                            watchlistRef.current = newList;
                            return newList;
                        });
                        markLocalChange('watchlist');
                        setLibrary(prev => {
                            const newList = [...prev, item];
                            libraryRef.current = newList;
                            return newList;
                        });
                        markLocalChange('library');
                        toast.success("Moved back to library", {
                            description: title
                        });
                    }
                },
                duration: 5000
            });
        }
    };

    const moveToLibrary = (item, showToast = true) => {
        const title = item.title || item;
        const normalizedTitle = title.toLowerCase().trim();

        // Remove from watchlist - Pass title to ensure removal works for items without IDs
        removeFromWatchlist(item.id, title, false);

        // Add to library
        const alreadyInLibrary = library.some(w =>
            (w.title || w).toLowerCase().trim() === normalizedTitle
        );

        if (!alreadyInLibrary) {
            const newItem = typeof item === 'string'
                ? { id: Date.now().toString(), title: item, genres: [], description: '' }
                : { ...item, id: (item.id || Date.now()).toString() };

            setLibrary(prev => {
                const newList = [...prev, newItem];
                libraryRef.current = newList; // Update ref for sync
                return newList;
            });
            markLocalChange('library');
        }

        if (showToast) {
            toast.success("Moved to library", {
                description: title,
                action: {
                    label: 'Undo',
                    onClick: () => {
                        // Remove from library
                        setLibrary(prev => {
                            const newList = prev.filter(w => {
                                if (item.id && w.id == item.id) return false;
                                if ((w.title || w).toLowerCase().trim() === normalizedTitle) return false;
                                return true;
                            });
                            libraryRef.current = newList;
                            return newList;
                        });
                        markLocalChange('library');
                        // Restore to watchlist (with full metadata)
                        setWatchlist(prev => {
                            const newList = [...prev, item];
                            watchlistRef.current = newList;
                            return newList;
                        });
                        markLocalChange('watchlist');
                        toast.success("Moved back to watchlist", {
                            description: title
                        });
                    }
                },
                duration: 5000
            });
        }
    };

    const handleCancelGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            toast.info("Generation cancelled.");
        }
    };

    const handleGenerate = async () => {
        if (isLoading) {
            handleCancelGeneration();
            return;
        }
        if (!apiKey) {
            toast.error("Please enter your OpenRouter API Key first.");
            return;
        }
        if (library.length === 0) {
            toast.error("Add some anime to your library first!");
            return;
        }

        handleGenerateRecommendations();
    };

    const handleGenerateRecommendations = async () => {
        setShowGenerateConfirm(false);
        setIsLoading(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // Ensure we are on the recommendations tab
            if (activeTab !== 'recommendations') {
                handleTabSwitch('recommendations');
            }

            const data = await getRecommendations(
                library,
                getCurrentApiKey(),
                [...library, ...watchlist, ...excludedItems, ...recommendations],
                customInstructions,
                generateCount,
                aiProvider,
                controller.signal,
                selectedModel
            );

            const dataWithMeta = data.map(item => ({
                ...item,
                model: selectedModel,
                provider: aiProvider
            }));

            // Filter out any recommendations that are already in library, watchlist, or recommendations
            const libraryTitlesLower = library.map(a => (a.title || a).toLowerCase().trim());
            const watchlistTitlesLower = watchlist.map(a => (a.title || a).toLowerCase().trim());
            const recommendationsTitlesLower = recommendations.map(a => (a.title || a).toLowerCase().trim());
            const excludedTitlesLower = excludedItems.map(a => (a.title || a).toLowerCase().trim());

            const filteredData = dataWithMeta.filter(rec => {
                const recTitle = rec.title?.toLowerCase().trim();
                return !libraryTitlesLower.includes(recTitle) &&
                    !watchlistTitlesLower.includes(recTitle) &&
                    !recommendationsTitlesLower.includes(recTitle) &&
                    !excludedTitlesLower.includes(recTitle);
            });

            setRecommendations(prev => [...prev, ...filteredData]);

            // Pre-fetch images in background for all new picks
            filteredData.forEach(item => {
                getAnimeImage(item.title).catch(() => { });
            });

            // Success Message
            const message = filteredData.length < data.length
                ? `Added ${filteredData.length} new picks (${data.length - filteredData.length} duplicates removed)`
                : `Added ${filteredData.length} new picks!`;

            toast.success(message, {
                duration: 5000,
            });
        } catch (error) {
            if (error.name === 'AbortError') {
                // Ignore AbortError as it's handled in handleCancelGeneration
                return;
            }
            toast.error(getShortErrorMessage(error));
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
            setIsLoading(false);
        }
    };

    const removeFromRecommendations = useCallback((itemOrTitle, showToast = true) => {
        const title = typeof itemOrTitle === 'string' ? itemOrTitle : itemOrTitle?.title;
        if (!title) return;

        const normalizedTitle = title.toLowerCase().trim();
        const removedItem = recommendations.find(item =>
            (item.title || item).toLowerCase().trim() === normalizedTitle
        );

        setRecommendations(prev => {
            const newList = prev.filter(item => (item.title || item).toLowerCase().trim() !== normalizedTitle);
            recommendationsRef.current = newList; // Update Ref
            return newList;
        });

        markLocalChange('recommendations');

        if (!removedItem || !showToast) return;

        toast.success("Removed from picks", {
            description: title,
            action: {
                label: 'Undo',
                onClick: () => {
                    setRecommendations(prev => {
                        const exists = prev.some(item =>
                            (item.title || item).toLowerCase().trim() === normalizedTitle
                        );
                        if (exists) return prev;
                        const newList = [...prev, removedItem];
                        recommendationsRef.current = newList; // Update Ref
                        return newList;
                    });
                }
            },
            duration: 5000
        });
    }, [recommendations]);

    const handleClear = () => {
        setShowClearConfirm(true);
    };

    const confirmClear = (mode = 'all') => {
        if (mode === 'all') {
            setRecommendations([]);
            recommendationsRef.current = []; // Update Ref
            markLocalChange('recommendations');
            toast.success("All recommendations cleared!");
        } else if (mode === 'added') {
            const libraryTitlesLower = library.map(a => (a.title || a).toLowerCase().trim());
            const watchlistTitlesLower = watchlist.map(a => (a.title || a).toLowerCase().trim());

            const beforeCount = recommendations.length;
            const filtered = recommendations.filter(rec => {
                const title = (rec.title || rec).toLowerCase().trim();
                return !libraryTitlesLower.includes(title) && !watchlistTitlesLower.includes(title);
            });

            if (filtered.length === beforeCount) {
                toast.info("No items were matched in Library or Watchlist.");
            } else {
                setRecommendations(filtered);
                recommendationsRef.current = filtered; // Update Ref
                markLocalChange('recommendations');
                toast.success(`Removed ${beforeCount - filtered.length} already added items!`);
            }
        }

        scrollPositions.current['recommendations'] = 0;
        setShowClearConfirm(false);
    };

    const confirmClearAllData = () => {
        const username = currentUser.username || currentUser;
        setLibrary([]);
        setWatchlist([]);
        setRecommendations([]);
        setExcludedItems([]);
        // Update all refs
        libraryRef.current = [];
        watchlistRef.current = [];
        recommendationsRef.current = [];
        excludedItemsRef.current = []; // Update Ref
        // Mark all as changed to trigger cloud sync
        markLocalChange('library');
        markLocalChange('watchlist');
        markLocalChange('recommendations');
        markLocalChange('excludedItems');

        scrollPositions.current = { library: 0, recommendations: 0, watchlist: 0 };
        setShowClearAllDataConfirm(false);
        setShowUserMenu(false);
        toast.success("All your data has been cleared.");
    };

    const updateLibraryNote = useCallback((id, note) => {
        setLibrary((prev) => {
            const newList = prev.map((item) => {
                if (item.id === id || item.id == id) {
                    return { ...item, note };
                }
                return item;
            });
            libraryRef.current = newList; // Update Ref
            return newList;
        });
    }, []);

    const updateWatchlistNote = useCallback((id, note) => {
        setWatchlist((prev) => {
            const newList = prev.map((item) => {
                if (item.id === id || item.id == id) {
                    return { ...item, note };
                }
                return item;
            });
            watchlistRef.current = newList; // Update Ref
            return newList;
        });
    }, []);

    const formatCount = (count) => {
        if (!count) return '';
        if (count < 1000) return count;
        if (count < 1000000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    };

    const handleDeleteAllInstructions = () => {
        setCustomInstructions([]);
        const username = currentUser.username || currentUser;
        saveUserInstructions(username, []);
        setShowInstructionDeleteAllConfirm(false);
        toast.success("All instructions cleared");
    };

    const handleRestoreDefaultInstructions = () => {
        // Filter out existing defaults (including similar ones) to re-add them at the top
        const userInst = customInstructions.filter(i =>
            i !== DEMOGRAPHIC_DEFAULT_INSTRUCTION &&
            i !== RECOMMENDATION_DEFAULT_INSTRUCTION &&
            !(i.toLowerCase().includes("identify the most common demographics") && !i.startsWith("[ALWAYS]"))
        );

        const newInst = [
            DEMOGRAPHIC_DEFAULT_INSTRUCTION,
            RECOMMENDATION_DEFAULT_INSTRUCTION,
            ...userInst
        ];

        if (JSON.stringify(newInst) !== JSON.stringify(customInstructions)) {
            setCustomInstructions(newInst);
            instructionsRef.current = newInst; // Update Ref
            const username = currentUser.username || currentUser;
            saveUserInstructions(username, newInst);
            toast.success("Default instructions restored to the top");
        } else {
            toast.error("Both default instructions are already present and prioritized");
        }
    };

    return (
        <div className={`relative bg-[#0a0a0f] ${currentUser ? 'min-h-screen pb-24' : 'h-screen overflow-hidden'} ${!performanceSettings.enableBlur ? 'disable-blur' : ''} ${!performanceSettings.enhancedMotion ? 'reduced-motion' : ''}`} style={{ overflowX: 'clip' }}>
            {/* Added padding-bottom to avoid overlap with Quick Bar */}

            {/* Fixed Background - OUTSIDE the scroll flow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-violet-900/20 to-transparent" />
                <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px]" />
            </div>

            {/* Top Left User Controls - Hide when modal is open */}
            {currentUser && (
                <div className={`fixed top-4 left-4 z-50 transition-opacity duration-300 ${isModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowUserMenu(true)}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30 rounded-full px-4 py-2 text-sm text-gray-300 hover:text-white transition-all backdrop-blur-md shadow-lg"
                    >
                        <div className="shrink-0">
                            {currentUser.isGoogle && currentUser.profile?.picture ? (
                                <img
                                    src={currentUser.profile.picture}
                                    alt={currentUser.profile.name}
                                    className="w-6 h-6 rounded-full border border-white/10"
                                />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
                                    {(currentUser.username || currentUser).charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <span className="hidden sm:inline font-medium">
                            {currentUser.profile?.name || currentUser.username || currentUser}
                        </span>
                    </motion.button>
                </div>
            )}

            {/* User Menu Modal */}
            <AnimatePresence>
                {showUserMenu && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowUserMenu(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm h-[550px] max-h-[80vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <UserMenuContent
                                currentUser={currentUser}
                                onLogout={handleLogout}
                                onClose={() => setShowUserMenu(false)}
                                onDeleteAccount={handleDeleteAccount}
                                onImport={() => importFileRef.current?.click()}
                                onExport={handleExportLibrary}
                                onLinkAccount={handleLinkAccount}
                                aiProvider={aiProvider}
                                setAiProvider={(p) => {
                                    setAiProvider(p);
                                    localStorage.setItem('ai_provider', p);
                                }}
                                apiKey={apiKey}
                                setApiKey={setApiKey}
                                groqApiKey={groqApiKey}
                                setGroqApiKey={setGroqApiKey}
                                cerebrasApiKey={cerebrasApiKey}
                                setCerebrasApiKey={setCerebrasApiKey}
                                mistralApiKey={mistralApiKey}
                                setMistralApiKey={setMistralApiKey}
                                selectedModel={selectedModel}
                                setSelectedModel={setSelectedModel}
                                customInstructions={customInstructions}
                                setCustomInstructions={setCustomInstructions}
                                showInstructionDeleteConfirm={showInstructionDeleteConfirm}
                                setShowInstructionDeleteConfirm={setShowInstructionDeleteConfirm}
                                showInstructionDeleteAllConfirm={showInstructionDeleteAllConfirm}
                                setShowInstructionDeleteAllConfirm={setShowInstructionDeleteAllConfirm}
                                instructionToDelete={instructionToDelete}
                                setInstructionToDelete={setInstructionToDelete}
                                showInstructionEditModal={showInstructionEditModal}
                                setShowInstructionEditModal={setShowInstructionEditModal}
                                instructionToEdit={instructionToEdit}
                                setInstructionToEdit={setInstructionToEdit}
                                defaultInstructions={[DEMOGRAPHIC_DEFAULT_INSTRUCTION, RECOMMENDATION_DEFAULT_INSTRUCTION]}
                                watchlist={watchlist}
                                library={library}
                                onRegen={handleRegenFromMenu}
                                excludedItems={excludedItems}
                                onRestore={handleRestoreItem}
                                onRestoreAll={handleRestoreAllExcluded}
                                onDeleteAllInstructions={handleDeleteAllInstructions}
                                onRestoreDefaults={handleRestoreDefaultInstructions}
                                performanceSettings={performanceSettings}
                                onTogglePerformanceSetting={togglePerformanceSetting}
                                isGoogleSignedIn={isGoogleSignedIn}
                                isGoogleLoading={isGoogleLoading}
                                lastCloudSync={lastCloudSync}
                                onGoogleSignIn={handleGoogleSignIn}
                                onGoogleSignOut={handleGoogleSignOut}
                                onCancelGoogleSignIn={handleCancelGoogleSignIn}
                                onCloudSync={handleCloudSync}
                                onClearData={() => setShowClearAllDataConfirm(true)}
                                onClearExcludedItem={handleClearExcludedItem}
                                onClearAllExcluded={handleClearAllExcluded}
                                onUpdateExcludedItem={handleUpdateExcludedItem}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Hidden file input for import */}
            <input
                type="file"
                ref={importFileRef}
                onChange={handleImportFile}
                accept=".json"
                className="hidden"
            />

            {/* Top Right Search Button - Fixed */}
            {currentUser && (
                <div className={`fixed top-4 right-4 z-50 transition-opacity duration-300 ${isModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            setShowSearchModal(true);
                        }}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30 rounded-full px-4 py-2 text-sm text-gray-300 hover:text-white transition-all backdrop-blur-md shadow-lg"
                    >
                        <Search size={16} />
                        <span className="hidden sm:inline">Search</span>
                    </motion.button>
                </div>
            )}

            {/* Search Modal */}
            <AnimatePresence>
                {showSearchModal && (
                    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-16 md:items-center md:pt-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowSearchModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-md h-[480px] flex flex-col overflow-hidden"
                        >
                            <button
                                onClick={() => setShowSearchModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <h3 className="text-xl font-bold text-white mb-4">Search Collections</h3>

                            {/* Source Selection */}
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
                                {[
                                    { id: 'library', label: 'Library', color: 'violet' },
                                    { id: 'watchlist', label: 'Watchlist', color: 'rose' },
                                    { id: 'recommendations', label: 'Picks', color: 'pink' }
                                ].map(source => (
                                    <button
                                        key={source.id}
                                        onClick={() => setSearchSources(prev => ({ ...prev, [source.id]: !prev[source.id] }))}
                                        className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${searchSources[source.id]
                                            ? `bg-${source.color}-600/20 text-${source.color}-400 border-${source.color}-500/50 shadow-[0_0_10px_rgba(139,92,246,0.1)]`
                                            : 'bg-white/5 text-gray-500 border-white/5 hover:text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${searchSources[source.id] ? `bg-${source.color}-500` : 'bg-gray-700'}`} />
                                            {source.label}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="relative mb-4">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                    <Search size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={quickSearchQuery}
                                    onChange={(e) => setQuickSearchQuery(e.target.value)}
                                    placeholder="Find an anime..."
                                    className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-12 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                                    autoFocus
                                />
                                {quickSearchQuery && (
                                    <button
                                        onClick={() => setQuickSearchQuery('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Search Results */}
                            <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                {quickSearchQuery.trim() === '' ? (
                                    <div className="py-8 text-center text-gray-500 text-sm">
                                        {(() => {
                                            const active = [];
                                            if (searchSources.library) active.push('library');
                                            if (searchSources.watchlist) active.push('watchlist');
                                            if (searchSources.recommendations) active.push('picks');

                                            if (active.length === 0) return "Select a collection above to search";
                                            const list = active.length === 3
                                                ? "library, watchlist, and picks"
                                                : active.length === 2
                                                    ? `${active[0]} and ${active[1]}`
                                                    : active[0];

                                            return `Type to search your ${list}`;
                                        })()}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {/* Combine and Filter Results */}
                                        {(() => {
                                            const query = quickSearchQuery.toLowerCase();

                                            const libraryMatches = searchSources.library ? library
                                                .filter(item => (item.title || item).toLowerCase().includes(query))
                                                .map(item => ({ ...item, type: 'library' })) : [];

                                            const watchlistMatches = searchSources.watchlist ? watchlist
                                                .filter(item => (item.title || item).toLowerCase().includes(query))
                                                .map(item => ({ ...item, type: 'watchlist' })) : [];

                                            const recMatches = searchSources.recommendations ? recommendations
                                                .filter(item => (item.title || item).toLowerCase().includes(query))
                                                .map(item => ({ ...item, type: 'recommendations' })) : [];

                                            const allMatches = [...libraryMatches, ...watchlistMatches, ...recMatches].slice(0, 10);

                                            if (allMatches.length === 0) {
                                                return (
                                                    <div className="py-8 text-center text-gray-500 text-sm">
                                                        No matches for "{quickSearchQuery}"
                                                    </div>
                                                );
                                            }

                                            return allMatches.map((item, idx) => {
                                                const title = typeof item === 'string' ? item : item.title;
                                                const isLibrary = item.type === 'library';

                                                const handleSelect = () => {
                                                    if (isLibrary) {
                                                        setSearchQuery(title);
                                                        handleTabSwitch('library');
                                                    } else if (item.type === 'watchlist') {
                                                        setWatchlistSearchQuery(title);
                                                        handleTabSwitch('watchlist');
                                                    } else {
                                                        // Recommendation match
                                                        setRecommendationsSearchQuery(title);
                                                        handleTabSwitch('recommendations');
                                                    }
                                                    setShowSearchModal(false);
                                                };

                                                return (
                                                    <button
                                                        key={`${item.type}-${item.id || idx}`}
                                                        onClick={handleSelect}
                                                        className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 text-left group transition-all"
                                                    >
                                                        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${isLibrary ? 'bg-violet-600/20 text-violet-400' : item.type === 'watchlist' ? 'bg-rose-600/20 text-rose-400' : 'bg-pink-600/20 text-pink-400'} group-hover:scale-110 transition-transform`}>
                                                            {isLibrary ? <LayoutGrid size={18} /> : item.type === 'watchlist' ? <Heart size={18} /> : <Sparkles size={18} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors truncate block">
                                                                {title}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${isLibrary ? 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]' : item.type === 'watchlist' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]'}`} />
                                                                <span className={`text-[10px] uppercase tracking-wider font-bold ${isLibrary ? 'text-violet-400/70' : item.type === 'watchlist' ? 'text-rose-400/70' : 'text-pink-400/70'}`}>
                                                                    {isLibrary ? 'Library' : item.type === 'watchlist' ? 'Watchlist' : 'Pick'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <ArrowUp size={14} className="rotate-45 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className={`relative z-10 w-full flex flex-col items-center px-4 ${currentUser ? 'py-12' : 'min-h-screen justify-center'}`}>
                {currentUser ? (
                    <>
                        {/* Tab Navigation - FIXED */}
                        {/* Tab Navigation - FIXED */}
                        {/* Tab Navigation - FIXED */}
                        <div ref={tabsRef} className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 flex gap-1 bg-[#1a1a2e]/90 p-1.5 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl ${performanceSettings.enhancedMotion ? 'transition-all duration-300' : ''} ring-1 ring-white/5 max-w-[90vw]`}>
                            <button
                                onClick={() => handleTabSwitch('recommendations')}
                                className={`relative flex items-center justify-center gap-0 px-4 py-2.5 rounded-lg text-sm font-medium z-0 ${performanceSettings.enhancedMotion ? 'transition-all' : ''} ${activeTab === 'recommendations'
                                    ? 'text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <AnimatePresence>
                                    {activeTab === 'recommendations' && (
                                        <motion.div
                                            layoutId={performanceSettings.enhancedMotion ? "activeTab" : undefined}
                                            className="absolute inset-0 bg-pink-600 rounded-lg -z-10 shadow-lg shadow-pink-500/25"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        />
                                    )}
                                </AnimatePresence>
                                <Sparkles size={16} className="min-w-[16px] relative z-10" />
                                <span className={`relative z-10 overflow-hidden whitespace-nowrap ${performanceSettings.enhancedMotion ? 'transition-all duration-300 ease-in-out' : ''} ${activeTab === 'recommendations' ? 'max-w-[100px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0 sm:max-w-[100px] sm:opacity-100 sm:ml-2'}`}>
                                    Picks
                                </span>
                                {filteredRecommendations.length > 0 && activeTab === 'recommendations' && (
                                    <span className={`relative z-10 bg-black/20 px-1.5 py-0.5 rounded-full text-xs ml-1.5`}>
                                        {formatCount(filteredRecommendations.length)}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => handleTabSwitch('watchlist')}
                                className={`relative flex items-center justify-center gap-0 px-4 py-2.5 rounded-lg text-sm font-medium z-0 ${performanceSettings.enhancedMotion ? 'transition-all' : ''} ${activeTab === 'watchlist'
                                    ? 'text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <AnimatePresence>
                                    {activeTab === 'watchlist' && (
                                        <motion.div
                                            layoutId={performanceSettings.enhancedMotion ? "activeTab" : undefined}
                                            className="absolute inset-0 bg-rose-600 rounded-lg -z-10 shadow-lg shadow-rose-500/25"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        />
                                    )}
                                </AnimatePresence>
                                <Heart size={16} className="min-w-[16px] relative z-10" />
                                <span className={`relative z-10 overflow-hidden whitespace-nowrap ${performanceSettings.enhancedMotion ? 'transition-all duration-300 ease-in-out' : ''} ${activeTab === 'watchlist' ? 'max-w-[100px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0 sm:max-w-[100px] sm:opacity-100 sm:ml-2'}`}>
                                    Watchlist
                                </span>
                                {filteredWatchlist.length > 0 && activeTab === 'watchlist' && (
                                    <span className={`relative z-10 bg-black/20 px-1.5 py-0.5 rounded-full text-xs ml-1.5`}>
                                        {formatCount(filteredWatchlist.length)}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => handleTabSwitch('library')}
                                className={`relative flex items-center justify-center gap-0 px-4 py-2.5 rounded-lg text-sm font-medium z-0 ${performanceSettings.enhancedMotion ? 'transition-all' : ''} ${activeTab === 'library'
                                    ? 'text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <AnimatePresence>
                                    {activeTab === 'library' && (
                                        <motion.div
                                            layoutId={performanceSettings.enhancedMotion ? "activeTab" : undefined}
                                            className="absolute inset-0 bg-violet-600 rounded-lg -z-10 shadow-lg shadow-violet-500/25"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        />
                                    )}
                                </AnimatePresence>
                                <LayoutGrid size={16} className="min-w-[16px] relative z-10" />
                                <span className={`relative z-10 overflow-hidden whitespace-nowrap ${performanceSettings.enhancedMotion ? 'transition-all duration-300 ease-in-out' : ''} ${activeTab === 'library' ? 'max-w-[100px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0 sm:max-w-[100px] sm:opacity-100 sm:ml-2'}`}>
                                    Library
                                </span>
                                {filteredLibrary.length > 0 && activeTab === 'library' && (
                                    <span className="relative z-10 bg-black/20 px-1.5 py-0.5 rounded-full text-xs transition-colors ml-1.5">
                                        {formatCount(filteredLibrary.length)}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Content Area - with top margin for fixed tabs */}
                        <div className="w-full mt-24">
                            <AnimatePresence mode="wait">
                                {activeTab === 'recommendations' && (
                                    <motion.div
                                        key="recommendations"
                                        initial={performanceSettings.enhancedMotion ? { opacity: 0, y: 10 } : { opacity: 0, y: 0 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={performanceSettings.enhancedMotion ? { opacity: 0, scale: 0.98 } : { opacity: 0, y: 0 }}
                                        transition={performanceSettings.enhancedMotion ? { duration: 0.25, ease: "easeOut" } : { duration: 0.2 }}
                                        className="min-h-[60vh]"
                                    >
                                        {filteredRecommendations.length === 0 ? (
                                            <div className="text-center py-16 relative overflow-hidden">
                                                <AnimatePresence mode="wait">
                                                    {isLoading ? (
                                                        <motion.div
                                                            key="loading-state"
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 1.05 }}
                                                            className="flex flex-col items-center"
                                                        >
                                                            <div className="relative mb-8">
                                                                {/* Simplified Glow Background */}
                                                                <div className="absolute inset-[-20px] bg-gradient-to-tr from-pink-500/10 via-violet-500/10 to-transparent blur-xl rounded-full" />
                                                                <motion.div
                                                                    animate={{ y: [0, -10, 0] }}
                                                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                                                    className="relative w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl shadow-pink-500/10"
                                                                >
                                                                    <Sparkles size={48} className="text-pink-400" />
                                                                </motion.div>
                                                            </div>
                                                            <motion.h3
                                                                animate={{ opacity: [0.5, 1, 0.5] }}
                                                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                                                className="text-2xl font-black text-white mb-3"
                                                            >
                                                                Curating...
                                                            </motion.h3>
                                                            <p className="text-gray-400 max-w-sm mx-auto text-sm leading-relaxed px-6">
                                                                Analyzing your taste profile to uncover your next obsession.
                                                            </p>
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div
                                                            key="empty-state"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            className="flex flex-col items-center"
                                                        >
                                                            <div className="w-20 h-20 rounded-2xl bg-white/5 mb-6 flex items-center justify-center border border-white/5">
                                                                <Sparkles size={40} className="text-violet-400/50" />
                                                            </div>
                                                            <h3 className="text-xl font-bold text-white mb-2">No recommendations yet</h3>
                                                            <p className="text-gray-400 max-w-sm mx-auto text-sm">
                                                                {filteredLibrary.length === 0
                                                                    ? "Add some anime to your library first, then click Generate Picks below."
                                                                    : "Click the Generate Picks button below to get personalized picks!"
                                                                }
                                                            </p>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ) : (
                                            <RecommendationDisplay
                                                recommendations={filteredRecommendations}
                                                onWatched={addToLibrary}
                                                onRemove={removeFromLibrary}
                                                onRemovePick={removeFromRecommendations}
                                                library={library}
                                                watchlist={watchlist}
                                                onAddToWatchlist={addToWatchlist}
                                                onRemoveFromWatchlist={removeFromWatchlist}
                                                onGenerate={handleGenerate}
                                                onClear={handleClear}
                                                onModalStateChange={setIsModalOpen}
                                                onExclude={openExcludeModal}
                                                enhancedMotion={performanceSettings.enhancedMotion}
                                                searchQuery={recommendationsSearchQuery}
                                                onSearchChange={setRecommendationsSearchQuery}
                                            />
                                        )}
                                    </motion.div>
                                )}

                                {activeTab === 'watchlist' && (
                                    <motion.div
                                        key="watchlist"
                                        initial={performanceSettings.enhancedMotion ? { opacity: 0, y: 10 } : { opacity: 0, y: 0 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={performanceSettings.enhancedMotion ? { opacity: 0, scale: 0.98 } : { opacity: 0, y: 0 }}
                                        transition={performanceSettings.enhancedMotion ? { duration: 0.25, ease: "easeOut" } : { duration: 0.2 }}
                                        className="min-h-[60vh]"
                                    >
                                        <WatchlistDisplay
                                            watchlist={filteredWatchlist}
                                            library={library}
                                            onRemove={requestRemoveFromWatchlist}
                                            onMoveToLibrary={moveToLibrary}
                                            onMoveToWatchlist={moveToWatchlist}
                                            onUpdateNote={updateWatchlistNote}
                                            onImport={() => importFileRef.current.click()}
                                            onModalStateChange={setIsModalOpen}
                                            loadingItems={loadingItems}
                                            searchQuery={watchlistSearchQuery}
                                            onSearchChange={setWatchlistSearchQuery}
                                            onGenerateInfo={generateInfoForItem}
                                            onExclude={openExcludeModal}
                                            enhancedMotion={performanceSettings.enhancedMotion}
                                        />
                                    </motion.div>
                                )}

                                {activeTab === 'library' && (
                                    <motion.div
                                        key="library"
                                        initial={performanceSettings.enhancedMotion ? { opacity: 0, y: 10 } : { opacity: 0, y: 0 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={performanceSettings.enhancedMotion ? { opacity: 0, scale: 0.98 } : { opacity: 0, y: 0 }}
                                        transition={performanceSettings.enhancedMotion ? { duration: 0.25, ease: "easeOut" } : { duration: 0.2 }}
                                        className="min-h-[60vh]"
                                    >
                                        <LibraryDisplay
                                            library={filteredLibrary}
                                            onRemove={removeFromLibrary}
                                            onGenerateInfo={generateInfoForItem}
                                            onGenerateAllInfo={generateAllInfo}
                                            onImport={() => importFileRef.current.click()}
                                            loadingItems={loadingItems}
                                            searchQuery={searchQuery}
                                            onSearchChange={setSearchQuery}
                                            onUpdateNote={updateLibraryNote}
                                            onModalStateChange={setIsModalOpen}
                                            onMoveToWatchlist={moveToWatchlist}
                                            onExclude={openExcludeModal}
                                            enhancedMotion={performanceSettings.enhancedMotion}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </>
                ) : (
                    <div className="text-center bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-10 max-w-md w-full">
                        <AboutContent />
                        <div className="mt-8">
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] text-white px-8 py-3 rounded-xl font-medium transition-all w-full sm:w-auto"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                )}
            </div>



            {/* Smart Floating Action Bar */}
            <AnimatePresence>
                {currentUser && showFloatingBar && !isModalOpen && (
                    <motion.div
                        key="floating-bar"
                        initial={{ y: 100, opacity: 0, x: "-50%" }}
                        animate={{ y: 0, opacity: 1, x: "-50%" }}
                        exit={{ y: 100, opacity: 0, x: "-50%" }}
                        transition={{
                            type: 'tween',
                            duration: 0.4,
                            ease: 'easeOut'
                        }}
                        className="fixed bottom-6 left-1/2 z-50 glass-panel border border-white/10 shadow-2xl rounded-2xl flex items-center justify-center gap-1 p-1.5 ring-1 ring-white/5 w-auto"
                    >
                        <button
                            onClick={() => {
                                setAddToTarget(activeTab === 'watchlist' ? 'watchlist' : 'library');
                                setShowAddModal(true);
                            }}
                            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-violet-500/25 transition-all text-sm group"
                        >
                            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                            <span className="hidden sm:inline">Add</span>
                        </button>

                        <div className="h-6 w-px bg-white/20 mx-1"></div>

                        <div className="flex items-center bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl shadow-lg shadow-pink-500/20">
                            <button
                                onClick={handleGenerate}
                                className={`group flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-all font-medium text-white text-sm whitespace-nowrap border-r border-white/10 rounded-l-xl ${isLoading ? 'bg-black/20' : ''}`}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={18} className="animate-spin text-pink-200" />
                                        <div className="flex flex-col items-start leading-none gap-0.5">
                                            <span className="text-[13px]">Thinking...</span>
                                            <span className="text-[8px] uppercase tracking-wider font-bold opacity-60">Click to Cancel</span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Sparkles size={18} />
                                        <span>Generate Picks</span>
                                    </>
                                )}
                            </button>

                            <div className="relative h-full flex" ref={countDropdownRef}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCountDropdown(!showCountDropdown);
                                    }}
                                    className="px-2.5 py-2.5 hover:bg-white/10 transition-all text-white flex items-center justify-center rounded-r-xl"
                                    title="Number of picks to generate"
                                >
                                    <ChevronUp size={16} className={`transition-transform duration-200 ${showCountDropdown ? 'rotate-180' : ''}`} />
                                    <span className="ml-1 text-[10px] font-bold opacity-80">{generateCount}</span>
                                </button>

                                <AnimatePresence>
                                    {showCountDropdown && (
                                        <motion.div
                                            initial={performanceSettings.enhancedMotion ? { opacity: 0, y: 10, scale: 0.95 } : { opacity: 0 }}
                                            animate={performanceSettings.enhancedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1 }}
                                            exit={performanceSettings.enhancedMotion ? { opacity: 0, y: 10, scale: 0.95 } : { opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute bottom-full right-0 mb-4 bg-[#1a1a2e] border border-white/20 rounded-xl shadow-2xl overflow-hidden min-w-[100px] z-[60]"
                                        >
                                            {[5, 10, 15].map((count) => (
                                                <button
                                                    key={count}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setGenerateCount(count);
                                                        setShowCountDropdown(false);
                                                    }}
                                                    className={`w-full px-4 py-2.5 text-sm text-left hover:bg-white/10 transition-colors rounded-lg ${generateCount === count ? 'text-pink-400 bg-pink-400/10 font-bold' : 'text-gray-300'}`}
                                                >
                                                    {count} Picks
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Back to Top Button */}
            {
                currentUser && (
                    <>
                        <button
                            onClick={(e) => { e.currentTarget.blur(); scrollToTop(); setScrollTopPressed(false); }}
                            onTouchStart={() => setScrollTopPressed(true)}
                            onTouchEnd={() => setScrollTopPressed(false)}
                            onMouseDown={() => setScrollTopPressed(true)}
                            onMouseUp={() => setScrollTopPressed(false)}
                            onMouseLeave={() => setScrollTopPressed(false)}
                            className={`fixed bottom-36 right-5 z-40 p-3 text-white rounded-full shadow-lg backdrop-blur-md transition-all duration-100 border border-white/20 focus:outline-none ${scrollTopPressed ? 'bg-violet-500 scale-95' : 'bg-violet-600/90'} ${showScrollTop && !isModalOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
                            title="Back to Top"
                        >
                            <ArrowUp size={20} />
                        </button>

                        {/* Scroll to Bottom Button */}
                        <button
                            onClick={(e) => { e.currentTarget.blur(); scrollToBottom(); setScrollBottomPressed(false); }}
                            onTouchStart={() => setScrollBottomPressed(true)}
                            onTouchEnd={() => setScrollBottomPressed(false)}
                            onMouseDown={() => setScrollBottomPressed(true)}
                            onMouseUp={() => setScrollBottomPressed(false)}
                            onMouseLeave={() => setScrollBottomPressed(false)}
                            className={`fixed bottom-24 right-5 z-40 p-3 text-white rounded-full shadow-lg backdrop-blur-md transition-all duration-100 border border-white/20 focus:outline-none ${scrollBottomPressed ? 'bg-violet-500 scale-95' : 'bg-violet-600/90'} ${showScrollBottom && !isModalOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
                            title="Scroll to Bottom"
                        >
                            <ArrowDown size={20} />
                        </button>
                    </>
                )
            }

            {/* Quick Add Modal */}
            <AnimatePresence>
                {
                    showAddModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowAddModal(false)}
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            />
                            <motion.div
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                variants={modalVariants}
                                className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl scale-100"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-white">Quick Add Anime</h3>
                                    <button
                                        onClick={() => setShowAddModal(false)}
                                        className="text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Target Toggle */}
                                <div className="flex bg-black/40 p-1 rounded-xl mb-4">
                                    <button
                                        onClick={() => setAddToTarget('library')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${addToTarget === 'library'
                                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        Library
                                    </button>
                                    <button
                                        onClick={() => setAddToTarget('watchlist')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${addToTarget === 'watchlist'
                                            ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        Watchlist
                                    </button>
                                </div>

                                <div className="relative mb-4">
                                    <input
                                        type="text"
                                        value={newItemTitle}
                                        onChange={(e) => setNewItemTitle(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleQuickAdd(e)}
                                        placeholder={`Add anime to ${addToTarget}...`}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-base"
                                        autoFocus
                                    />

                                    {newItemTitle && (
                                        <button
                                            onClick={() => setNewItemTitle('')}
                                            className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}

                                    <button
                                        onClick={handleQuickAdd}
                                        disabled={!newItemTitle.trim()}
                                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${newItemTitle.trim()
                                            ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                                            : 'bg-white/5 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                                <p className="text-gray-400 text-sm text-center">
                                    Press Enter to add, or click the plus icon.
                                </p>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence>


            {/* Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirmation.isOpen && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={cancelRemove}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">Remove from {deleteConfirmation.type === 'watchlist' ? 'Watchlist' : 'Library'}?</h3>
                            <p className="text-gray-400 mb-6 text-sm">
                                Are you sure you want to remove <span className="text-white font-medium">"{deleteConfirmation.title}"</span>? This action can be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={cancelRemove}
                                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmRemove}
                                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all text-sm font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Clear Recommendations Confirmation Modal */}
            <AnimatePresence>
                {showClearConfirm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowClearConfirm(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
                                    <Trash2 size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white">Clear picks?</h3>
                            </div>

                            <p className="text-gray-400 mb-4 text-sm">
                                Clear added removes picks already saved.
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => confirmClear('added')}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all text-sm font-bold"
                                >
                                    Clear added
                                </button>

                                <button
                                    onClick={() => confirmClear('all')}
                                    className="w-full px-4 py-3 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 transition-all text-sm font-bold shadow-lg shadow-red-500/5"
                                >
                                    Clear all
                                </button>

                                <button
                                    onClick={() => setShowClearConfirm(false)}
                                    className="w-full px-4 py-2 text-gray-400 hover:text-white transition-colors text-xs font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Generate Confirmation Modal */}
            <AnimatePresence>
                {showGenerateConfirm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowGenerateConfirm(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">Regenerate Picks?</h3>
                            <p className="text-gray-400 mb-6 text-sm">
                                This will replace your current picks. Are you sure you want to continue?
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowGenerateConfirm(false)}
                                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmGenerate}
                                    className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-500/20 transition-all text-sm font-medium"
                                >
                                    Regenerate
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Clear All Data Confirmation Modal */}
            <AnimatePresence>
                {showClearAllDataConfirm && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowClearAllDataConfirm(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">Clear All Data?</h3>
                            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
                                This will permanently remove your <span className="text-white font-medium">Library</span>, <span className="text-white font-medium">Watchlist</span>, and <span className="text-white font-medium">Picks</span>. Your account will remain active.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowClearAllDataConfirm(false)}
                                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmClearAllData}
                                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all text-sm font-medium"
                                >
                                    Clear All Data
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={cancelLogout}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">Log out?</h3>
                            <p className="text-gray-400 mb-6 text-sm">
                                Are you sure you want to log out of your account?
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={cancelLogout}
                                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmLogout}
                                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all text-sm font-medium"
                                >
                                    Log out
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>





            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onAuth={handleAuth}
                onGoogleAuth={handleGoogleSignIn}
                onCancelGoogleAuth={handleCancelGoogleSignIn}
                isGoogleLoading={isGoogleLoading}
                enhancedMotion={performanceSettings.enhancedMotion}
            />

            {/* Delete Account Confirmation Modal */}
            <AnimatePresence>
                {showDeleteAccountConfirm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDeleteAccountConfirm(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">Delete Account?</h3>
                            <p className="text-gray-400 mb-6 text-sm">
                                Are you sure you want to delete your account? This action cannot be undone and you will lose all your data.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowDeleteAccountConfirm(false)}
                                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteAccount}
                                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all text-sm font-medium"
                                >
                                    Delete Account
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>



            {/* Instruction Single Delete Confirmation */}
            <AnimatePresence>
                {showInstructionDeleteConfirm && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowInstructionDeleteConfirm(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">Delete Instruction?</h3>
                            <p className="text-gray-400 mb-6 text-sm">
                                Are you sure you want to remove this instruction?
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowInstructionDeleteConfirm(false)}
                                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const newList = customInstructions.filter((_, i) => i !== instructionToDelete);
                                        setCustomInstructions(newList);
                                        instructionsRef.current = newList; // Update Ref
                                        setShowInstructionDeleteConfirm(false);
                                        setInstructionToDelete(null);
                                        toast.success("Instruction removed");
                                    }}
                                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all text-sm font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Instruction Delete All Confirmation */}
            <AnimatePresence>
                {showInstructionDeleteAllConfirm && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowInstructionDeleteAllConfirm(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-3 w-12 h-12 rounded-xl bg-red-500/10 text-red-500 mb-4">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Clear All Instructions?</h3>
                            <p className="text-gray-400 mb-6 text-sm">
                                This will permanently remove all your custom instructions.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowInstructionDeleteAllConfirm(false)}
                                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setCustomInstructions([]);
                                        instructionsRef.current = []; // Update Ref
                                        setShowInstructionDeleteAllConfirm(false);
                                        toast.success("All instructions cleared");
                                    }}
                                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all text-sm font-medium"
                                >
                                    Clear All
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Instruction Edit Modal */}
            <AnimatePresence>
                {showInstructionEditModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowInstructionEditModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        />
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={modalVariants}
                            className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-lg"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">
                                    {instructionToEdit.index === null ? 'Add Instruction' : 'Edit Instruction'}
                                </h3>
                                <button
                                    onClick={() => setShowInstructionEditModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <textarea
                                value={instructionToEdit.value}
                                onChange={(e) => setInstructionToEdit({ ...instructionToEdit, value: e.target.value })}
                                placeholder="Example: Only recommend psychological thrillers from the 90s..."
                                className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-pink-500/40 focus:border-pink-500 outline-none transition-all resize-none placeholder:text-gray-600 mb-6"
                                autoFocus
                            />

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowInstructionEditModal(false)}
                                    className="px-6 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={!instructionToEdit.value.trim()}
                                    onClick={() => {
                                        const trimmedValue = instructionToEdit.value.trim();
                                        if (!trimmedValue) return;

                                        const newInsts = [...customInstructions];
                                        if (instructionToEdit.index === null) {
                                            newInsts.push(trimmedValue);
                                        } else {
                                            newInsts[instructionToEdit.index] = trimmedValue;
                                        }

                                        const finalInsts = newInsts.filter(i => i);
                                        setCustomInstructions(finalInsts);
                                        instructionsRef.current = finalInsts; // Update Ref
                                        setShowInstructionEditModal(false);
                                        toast.success(instructionToEdit.index === null ? "Instruction added" : "Instruction updated");
                                    }}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-medium hover:shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all text-sm disabled:opacity-50"
                                >
                                    {instructionToEdit.index === null ? 'Add Instruction' : 'Save Changes'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>



            <ExcludeModal
                isOpen={showExcludeModal}
                onClose={() => setShowExcludeModal(false)}
                onConfirm={handleConfirmExclude}
                item={itemToExclude}
                enhancedMotion={performanceSettings.enhancedMotion}
            />

            <Toaster
                position="bottom-center"
                theme="dark"
                closeButton
                richColors
                swipeDirections={['left', 'right']}
                toastOptions={{
                    classNames: {
                        closeButton: '!left-auto !right-2 !top-1/2 !-translate-y-1/2 bg-white/10 hover:bg-white/20',
                    },
                    actionButtonStyle: {
                        marginRight: '2rem'
                    },
                    style: {
                        background: '#1e1e2e',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        marginBottom: '80px'
                    }
                }}
            />
        </div >
    );
}

export default App;
