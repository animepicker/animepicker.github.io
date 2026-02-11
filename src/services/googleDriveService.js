/* global gapi, google */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid profile email';

// Fetch user profile from Google
export const getUserProfile = async () => {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`
            }
        });
        return await response.json();
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
};

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Initialize GAPI
export const initGapi = () => {
    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                if (!API_KEY) throw new Error('VITE_GOOGLE_API_KEY is missing from .env');
                await gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                });
                gapiInited = true;
                resolve();
            } catch (err) {
                console.error('Error initializing GAPI client', err);
                reject(err);
            }
        });
    });
};

// Initialize GIS
export const initGis = () => {
    return new Promise((resolve) => {
        if (!CLIENT_ID) {
            console.error('VITE_GOOGLE_CLIENT_ID is missing from .env');
            return resolve(); // Resolve anyway so we don't hang, but handle in getToken
        }
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined at request time
        });
        gisInited = true;
        resolve();
    });
};

// Ensure everything is ready
export const ensureSubsystems = async () => {
    if (!gapiInited) await initGapi();
    if (!gisInited) await initGis();
};

const PERSISTENT_TOKEN_KEY = 'google_drive_persistent_token';

// Get access token
export const getToken = (username, hint = null, silent = false, forceSelect = false) => {
    if (!username) {
        console.error('getToken: No username provided for storage key');
        return Promise.reject('No username provided');
    }

    const userTokenKey = `${username}_google_drive_persistent_token`;

    // Check if we have a valid token in persistent storage first
    // Skip this if we are forcing account selection
    if (!forceSelect) {
        const persistentData = localStorage.getItem(userTokenKey);
        if (persistentData) {
            try {
                const { token, expiresAt } = JSON.parse(persistentData);
                // If token is still valid (with 5 min buffer), use it
                if (token && expiresAt > Date.now() + 300000) {
                    gapi.client.setToken({ access_token: token });
                    return Promise.resolve(token);
                }
            } catch (e) {
                localStorage.removeItem(userTokenKey);
            }
        }
    }

    // For silent re-auth, if we don't have ANY token record at all, 
    // we should NOT trigger the GIS library at all to avoid "popup spam".
    if (silent && !localStorage.getItem(userTokenKey)) {
        console.log(`getToken: Silent re-auth skipped for ${username}, no persistent token record found.`);
        return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
        let hasResolved = false;

        // Safety timeout: If Google doesn't call back in 30 seconds, reject.
        // This prevents the UI from hanging on "Connecting..." indefinitely.
        const timeoutId = setTimeout(() => {
            if (!hasResolved && !silent) {
                hasResolved = true;
                console.error('getToken: Request timed out after 30 seconds.');
                reject(new Error('Sign-in request timed out. Please check if the popup was blocked.'));
            }
        }, 30000);

        try {
            tokenClient.callback = async (resp) => {
                if (hasResolved) return; // Already timed out
                hasResolved = true;
                clearTimeout(timeoutId);

                console.log('GIS Callback Response Received:', resp);
                if (resp.error !== undefined) {
                    console.error('GIS Error Response:', resp.error, resp.error_description);
                    if (resp.error === 'interaction_required') {
                        console.warn('Silent auth failed: interaction required. User must click sign-in.');
                        if (silent) {
                            resolve(null);
                            return;
                        }
                    } else if (resp.error === 'access_denied' && resp.error_description && resp.error_description.includes('FedCM')) {
                        console.warn('Silent auth failed due to FedCM error. User must click sign-in.');
                        if (silent) {
                            resolve(null);
                            return;
                        }
                    }
                    if (silent) {
                        resolve(null);
                    } else {
                        reject(resp);
                    }
                } else if (!resp.access_token) {
                    console.error('GIS Result: No access token in response');
                    if (silent) resolve(null);
                    else reject('No access token');
                } else {
                    console.log('GIS Result: Success, token acquired.');
                    // Store in persistent storage (survives tab closing)
                    const expiresAt = Date.now() + (resp.expires_in * 1000);
                    localStorage.setItem(userTokenKey, JSON.stringify({
                        token: resp.access_token,
                        expiresAt
                    }));
                    // Set token for GAPI client
                    gapi.client.setToken({ access_token: resp.access_token });
                    resolve(resp.access_token);
                }
            };

            const options = {};
            if (silent) {
                options.prompt = 'none';
            } else if (forceSelect || gapi.client.getToken() === null) {
                options.prompt = 'select_account';
            } else {
                options.prompt = '';
            }

            if (hint) {
                options.login_hint = hint;
            }

            console.log('getToken: Triggering requestAccessToken with options:', options);
            tokenClient.requestAccessToken(options);
        } catch (err) {
            console.error('GIS Error inside Promise:', err);
            if (!hasResolved) {
                hasResolved = true;
                clearTimeout(timeoutId);
                reject(err);
            }
        }
    });
};

// List files in appDataFolder
export const listFiles = async () => {
    const response = await gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        fields: 'nextPageToken, files(id, name)',
        pageSize: 10,
    });
    return response.result.files;
};

// Find our specific sync file
export const findSyncFile = async () => {
    const files = await listFiles();
    return files.find(f => f.name === 'anime_picker_sync.json');
};

// Download sync data
export const downloadSyncData = async (fileId) => {
    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
    });
    return response.result;
};

// Upload/Update sync data
export const uploadSyncData = async (data, fileId = null) => {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const fileName = 'anime_picker_sync.json';
    const contentType = 'application/json';

    const metadata = {
        'name': fileName,
        'mimeType': contentType,
        'parents': fileId ? undefined : ['appDataFolder']
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        JSON.stringify(data) +
        close_delim;

    const request = gapi.client.request({
        'path': fileId ? `/upload/drive/v3/files/${fileId}` : '/upload/drive/v3/files',
        'method': fileId ? 'PATCH' : 'POST',
        'params': { 'uploadType': 'multipart' },
        'headers': {
            'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
    });

    return await request;
};

// Logout from Google (revoke token)
export const googleLogout = (username) => {
    try {
        const token = gapi?.client?.getToken?.();
        if (token && token !== null) {
            try {
                google.accounts.oauth2.revoke(token.access_token);
            } catch (e) {
                console.warn('Revocation failed:', e);
            }
            gapi.client.setToken('');
        }
    } catch (e) {
        console.warn('googleLogout: gapi not initialized, skipping revocation.');
    }

    // Clear persistent session data for this specific user
    if (username) {
        localStorage.removeItem(`${username}_google_drive_persistent_token`);
    }
};
