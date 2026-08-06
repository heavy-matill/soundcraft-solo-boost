// Electron store for persistence
console.log('electron-store');
let store = null;
try {
    const Store = require('electron-store');
    store = new Store();
} catch (e) {
    console.warn('electron-store not available, persistence disabled:', e);

}
console.log('electron-store done');

// State tracking
const muteState = {};
const boostState = {};
let lastChannel = 1;

// Load persisted state
function loadState() {
    if (!store) return;
    try {
        const persistedLastChannel = store.get('lastChannel');
        if (typeof persistedLastChannel === 'number') {
            lastChannel = persistedLastChannel;
        }
        const persistedMute = store.get('muteState');
        if (persistedMute && typeof persistedMute === 'object') {
            Object.assign(muteState, persistedMute);
        }
        const persistedBoost = store.get('boostState');
        if (persistedBoost && typeof persistedBoost === 'object') {
            Object.assign(boostState, persistedBoost);
        }
        // Set input channel
        const channelInput = document.getElementById('channelInput');
        if (channelInput) {
            channelInput.value = lastChannel;
        }
    } catch (e) {
        console.warn('Failed to load state from store:', e);
    }
}

// Save state
function saveState() {
    if (!store) return;
    try {
        store.set('lastChannel', lastChannel);
        store.set('muteState', muteState);
        store.set('boostState', boostState);
    } catch (e) {
        console.warn('Failed to save state to store:', e);
        // alert in browser
        alert('Failed to save state to store: ' + e);
    }
}

// Load state on startup
console.log('Loading persisted state...');
loadState();
console.log('State loaded.');

// Helper to get state with default false
function getMute(ch) { return muteState[ch] ?? false; }
function getBoost(ch) { return boostState[ch] ?? false; }
function setMute(ch, val) { muteState[ch] = val; }
function setBoost(ch, val) { boostState[ch] = val; }

// Update button text for current channel (from input)
function updateMuteButtonText() {
    const ch = parseInt(document.getElementById('channelInput').value) || 1;
    const btn = document.getElementById('muteToggleButton');
    btn.textContent = getMute(ch) ? `Unmute ${ch}` : `Mute ${ch}`;
}
function updateBoostButtonText() {
    const ch = parseInt(document.getElementById('channelInput').value) || 1;
    const btn = document.getElementById('boost3dBButton');
    btn.textContent = getBoost(ch) ? `Boost 3dB: ON` : `Boost 3dB: OFF`;
}

// When channel input changes, restore old channel state and read new channel state from device
document.getElementById('channelInput').addEventListener('change', function () {
    const newCh = parseInt(this.value) || 1;
    const oldCh = lastChannel;
    if (oldCh !== newCh) {
        // Restore old channel: apply its stored state to device (if connection ready)
        if (window.conn && window.conn.master && window.conn.master.input) {
            const oldChannelObj = window.conn.master.input(oldCh);
            if (oldChannelObj) {
                // Apply mute state
                if (getMute(oldCh)) {
                    oldChannelObj.mute();
                } else {
                    oldChannelObj.unmute();
                }
                // Note: Boost state is handled by the toggle function which sends relative changes
                // We assume the device boost state matches our stored state since we only change it via our buttons
            }
        }

        // Read the new channel's state from the device
        if (window.conn && window.conn.master && window.conn.master.input) {
            const newChannelObj = window.conn.master.input(newCh);
            if (newChannelObj) {
                try {
                    // Try to read mute state from device
                    // Assuming the channel object has an isMuted() or getMute() method
                    let isActuallyMuted = false;
                    if (typeof newChannelObj.isMuted === 'function') {
                        isActuallyMuted = newChannelObj.isMuted();
                    } else if (typeof newChannelObj.getMuted === 'function') {
                        isActuallyMuted = newChannelObj.getMuted();
                    } else {
                        // Fallback: if we can't read the state, keep our stored state
                        // This maintains current behavior as a fallback
                        isActuallyMuted = getMute(newCh);
                    }
                    // Update our stored state to match what we read from device
                    setMute(newCh, isActuallyMuted);
                } catch (e) {
                    console.warn('Could not read mute state from device, using stored state:', e);
                    // Keep existing state if we can't read from device
                }
            }
        }

        lastChannel = newCh;
        saveState(); // Persist channel change
        updateMuteButtonText();
        updateBoostButtonText();
    }
});

// Toggle mute for channel from input
window.toggleMuteFromInput = function () {
    const chInput = document.getElementById('channelInput');
    const ch = parseInt(chInput.value) || 1;
    if (!window.conn || !window.conn.master || !window.conn.master.input) {
        console.error('Soundcraft UI connection not ready');
        return;
    }
    const channel = window.conn.master.input(ch);
    if (!channel) {
        console.error(`Channel ${ch} not available`);
        return;
    }
    const nowMuted = !getMute(ch); // toggle
    setMute(ch, nowMuted);
    if (nowMuted) {
        channel.mute();
    } else {
        channel.unmute();
    }
    updateMuteButtonText();
    saveState(); // Persist mute toggle
};

// Toggle 3dB boost for channel from input
window.toggle3dBBoost = function () {
    const chInput = document.getElementById('channelInput');
    const ch = parseInt(chInput.value) || 1;
    if (!window.conn || !window.conn.master || !window.conn.master.input) {
        console.error('Soundcraft UI connection not ready');
        return;
    }
    const channel = window.conn.master.input(ch);
    if (!channel) {
        console.error(`Channel ${ch} not available`);
        return;
    }
    const nowBoosted = !getBoost(ch); // toggle
    setBoost(ch, nowBoosted);
    if (nowBoosted) {
        // Turn on: add 3dB
        channel.changeFaderLevelDB(3);
    } else {
        // Turn off: subtract 3dB
        channel.changeFaderLevelDB(-3);
    }
    updateBoostButtonText();

    if (window.ipcRenderer) {
        window.ipcRenderer.send('show-boost-notification', {
            isActive: nowBoosted
        });
    }
    saveState(); // Persist boost toggle
};
// Require the SoundcraftUI module
import { SoundcraftUI } from './node_modules/soundcraft-ui-connection/index.mjs';

// Create connection
window.conn = new SoundcraftUI('192.168.1.200');

// Subscribe to connection status updates
if (window.conn.status$) {
    window.conn.status$.subscribe({
        next: (status) => {
            document.getElementById('connection-status').textContent = `Status: ${status}`;
        },
        error: (err) => {
            console.error('Status subscription error:', err);
            document.getElementById('connection-status').textContent = 'Status: Error';
        }
    });
} else {
    // Fallback if status$ doesn't exist
    document.getElementById('connection-status').textContent = 'Status: Unknown (no status observable)';
}

// Create connection
(async () => {
    try {
        await window.conn.connect();
        console.log('Connected to Soundcraft UI');
        // Update status immediately after connect (in case subscription doesn't catch initial state)
        if (document.getElementById('connection-status')) {
            document.getElementById('connection-status').textContent = 'Status: Connected';
        }

        // Load mute state of initial channel from device
        try {
            const initialCh = lastChannel; // This is the channel we're showing initially
            const channelObj = window.conn.master.input(initialCh);
            if (channelObj) {
                let isActuallyMuted = false;
                if (typeof channelObj.isMuted === 'function') {
                    isActuallyMuted = channelObj.isMuted();
                } else if (typeof channelObj.getMuted === 'function') {
                    isActuallyMuted = channelObj.getMuted();
                }
                // Update our stored state to match what we read from device
                setMute(initialCh, isActuallyMuted);
                // Update button text to reflect the actual state
                updateMuteButtonText();
                saveState(); // Persist the loaded state
            }
        } catch (e) {
            console.warn('Could not read initial mute state from device:', e);
        }
    } catch (err) {
        console.error('Connection error:', err);
        document.getElementById('connection-status').textContent = 'Status: Connection Failed';
    }
})();

// Listen for IPC message from main process to toggle 3dB boost via global shortcut
if (typeof require !== 'undefined' && require('electron')) {
    const { ipcRenderer } = require('electron');
    window.ipcRenderer = ipcRenderer;
    ipcRenderer.on('toggle-3db-boost', (event) => {
        console.log('Received IPC message to toggle 3dB boost');
        if (typeof window.toggle3dBBoost === 'function') {
            window.toggle3dBBoost();
        }
    });
}