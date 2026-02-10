import bcrypt from 'bcryptjs';

const USERS_KEY = 'anime_users';
const CURRENT_USER_KEY = 'anime_current_user';
const GOOGLE_USER_PREFIX = 'google_';

// Get all users from localStorage
const getUsers = () => {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : {};
};

// Save users to localStorage
const saveUsers = (users) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// Check if user exists
export const userExists = (username) => {
    const users = getUsers();
    const normalizedUsername = username.toLowerCase().trim();
    return !!users[normalizedUsername];
};

// Get current logged-in user
export const getCurrentUser = () => {
    const username = localStorage.getItem(CURRENT_USER_KEY);
    if (!username) return null;

    // Check if it's a pure Google session (native Google account)
    if (username.startsWith(GOOGLE_USER_PREFIX)) {
        const profile = JSON.parse(localStorage.getItem(`${username}_profile`) || '{}');
        return { username, isGoogle: true, profile };
    }

    // Manual users are always isGoogle: false now (identity isolation)
    return { username, isGoogle: false };
};

// Sign up a new user
export const signup = async (username, password) => {
    const users = getUsers();
    const normalizedUsername = username.toLowerCase().trim();

    if (normalizedUsername.length < 3) {
        throw new Error("Username must be at least 3 characters");
    }
    if (password.length < 4) {
        throw new Error("Password must be at least 4 characters");
    }
    if (users[normalizedUsername]) {
        throw new Error("Username already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    users[normalizedUsername] = {
        passwordHash,
        watchlist: [],
        wishlist: [],
        recommendations: [],
        createdAt: new Date().toISOString()
    };

    saveUsers(users);
    localStorage.setItem(CURRENT_USER_KEY, normalizedUsername);

    return { username: normalizedUsername, isGoogle: false };
};

// Login an existing user
export const login = async (username, password) => {
    const users = getUsers();
    const normalizedUsername = username.toLowerCase().trim();

    const user = users[normalizedUsername];
    if (!user) {
        throw new Error("User not found");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        throw new Error("Invalid password");
    }

    localStorage.setItem(CURRENT_USER_KEY, normalizedUsername);

    // Manual accounts are always isGoogle: false (decoupled)
    return { username: normalizedUsername, isGoogle: false };
};

// Login/Sync with Google
// Login/Sync with Google (Pure Google Account)
export const loginWithGoogle = (profile) => {
    const googleId = `${GOOGLE_USER_PREFIX}${profile.sub}`;

    // Pure isolation: Google sign-in always uses the Google-native account
    localStorage.setItem(CURRENT_USER_KEY, googleId);
    localStorage.setItem(`${googleId}_profile`, JSON.stringify(profile));
    return { username: googleId, isGoogle: true, profile };
};

// Link manual account to Google
// Simplified: No longer linking permanent identity
export const linkGoogleToEmail = (username, profile) => {
    // For decoupled flow, we don't store anything in the user object.
    // The link is maintained purely through the persistent token in googleDriveService.
    return true;
};

// Logout
export const logout = () => {
    const username = localStorage.getItem(CURRENT_USER_KEY);
    if (username) {
        // Cleanup sensitive profiles and session metadata
        localStorage.removeItem(`${username}_profile`);
        localStorage.removeItem(`${username}_google_profile`);
        localStorage.removeItem(`${username}_last_cloud_sync`);

        // Also clear AI provider keys to ensure total privacy on logout
        localStorage.removeItem('openrouter_api_key');
        localStorage.removeItem('groq_api_key');
        localStorage.removeItem('cerebras_api_key');
        localStorage.removeItem('mistral_api_key');
    }
    localStorage.removeItem(CURRENT_USER_KEY);
};

// LIBRARY (Formerly Watchlist) Management
export const getUserLibrary = (username) => {
    if (!username) return [];
    const data = localStorage.getItem(`${username}_library`);
    if (data) {
        return JSON.parse(data);
    }

    // Migration: Check for old '_watchlist' key
    const oldData = localStorage.getItem(`${username}_watchlist`);
    if (oldData) {
        const parsed = JSON.parse(oldData);
        saveUserLibrary(username, parsed); // Save to new key
        localStorage.removeItem(`${username}_watchlist`); // Optional: Clean up old key
        return parsed;
    }
    return [];
};

export const saveUserLibrary = (username, library) => {
    if (!username) return;
    localStorage.setItem(`${username}_library`, JSON.stringify(library));
};

// WATCHLIST (Formerly Wishlist) Management
export const getUserWatchlist = (username) => {
    if (!username) return [];
    const data = localStorage.getItem(`${username}_watchlist`);
    // Note: If we just migrated '_watchlist' to '_library', this key might be empty or contain old library data if we didn't clear it.
    // Actually, 'wishlist' became 'watchlist'.
    // So we check `${username}_watchlist` (new key). 
    // IF it was the OLD library key, it might have data.
    // We need to be careful.
    // The OLD key for Wishlist was `_wishlist`.
    // The NEW key for Watchlist is `_watchlist`.
    // The OLD key for Watchlist was `_watchlist`.

    // CONFLICT: `_watchlist` was used for Library. Now it's used for Watchlist.
    // Resolution:
    // 1. Library checks `_library`. If missing, check `_watchlist` (OLD library) AND move it to `_library`.
    // 2. Watchlist checks `_watchlist` (NEW). 
    //    BUT `_watchlist` might still hold OLD library data if step 1 hasn't run or completed.
    //    WE SHOULD USE A DIFFERENT KEY for the new Watchlist to avoid collision? 
    //    Or we rely on `getUserLibrary` running FIRST.
    //    Let's use `_new_watchlist` or `_user_watchlist`? Or just `_watchlist_list`?
    //    Or better: The plan said `_wishlist` -> `_watchlist`.
    //    To avoid collision with the old `_watchlist` (which was Library), we should ensure Library migration happens or use a distinct key.
    //    Let's use `_saved_watchlist` or similar? 
    //    Actually, if we migrate `_watchlist` (old lib) to `_library` and REMOVE `_watchlist`, then `_watchlist` is free.

    if (data) {
        return JSON.parse(data);
    }

    // Migration: Check for old '_wishlist' key
    const oldData = localStorage.getItem(`${username}_wishlist`);
    if (oldData) {
        const parsed = JSON.parse(oldData);
        saveUserWatchlist(username, parsed);
        localStorage.removeItem(`${username}_wishlist`);
        return parsed;
    }
    return [];
};

export const saveUserWatchlist = (username, watchlist) => {
    if (!username) return;
    localStorage.setItem(`${username}_watchlist`, JSON.stringify(watchlist));
};

// Get user's recommendations
export const getUserRecommendations = (username) => {
    if (!username) return [];
    const data = localStorage.getItem(`${username}_recommendations`);
    return data ? JSON.parse(data) : [];
};

// Save user's recommendations
export const saveUserRecommendations = (username, recommendations) => {
    if (!username) return;
    localStorage.setItem(`${username}_recommendations`, JSON.stringify(recommendations));
};

// Custom Instructions Management
export const getUserInstructions = (username) => {
    if (!username) return [];
    const data = localStorage.getItem(`${username}_custom_instructions`);
    try {
        return data ? JSON.parse(data) : [];
    } catch (e) {
        // Fallback for old string-based format
        return data ? [data] : [];
    }
};

export const saveUserInstructions = (username, instructions) => {
    if (!username) return;
    localStorage.setItem(`${username}_custom_instructions`, JSON.stringify(instructions));
};

// Excluded Items Management
export const getUserExcluded = (username) => {
    if (!username) return [];
    const data = localStorage.getItem(`${username}_excluded`);
    return data ? JSON.parse(data) : [];
};

export const saveUserExcluded = (username, excluded) => {
    if (!username) return;
    localStorage.setItem(`${username}_excluded`, JSON.stringify(excluded));
};

export const deleteUser = (username) => {
    if (!username) return false;

    try {
        localStorage.removeItem(`${username}_library`);
        localStorage.removeItem(`${username}_watchlist`);
        localStorage.removeItem(`${username}_wishlist`);
        localStorage.removeItem(`${username}_recommendations`);
        localStorage.removeItem(`${username}_excluded`);
        localStorage.removeItem(`${username}_google_profile`);
        localStorage.removeItem(`${username}_custom_instructions`);
        localStorage.removeItem(`${username}_performance_settings`);

        // Also remove from users array
        const users = getUsers();
        delete users[username];
        saveUsers(users);

        logout();
        return true;
    } catch (error) {
        console.error("Error deleting user:", error);
        return false;
    }
};
