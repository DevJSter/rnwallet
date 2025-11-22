/**
 * Application Configuration
 * 
 * Centralized configuration for the wallet application.
 * Update these values to match your deployment environment.
 */

// ============================================================================
// Backend Configuration
// ============================================================================

/**
 * Backend server URL
 * Update this to your deployed backend URL or dev tunnel URL
 * 
 * Using public tunnel for wallet apps to access (localtunnel)
 * This allows MetaMask and other wallet apps to load the dApp page
 */
export const BACKEND_URL = 'https://2qpfn6bb-3000.inc1.devtunnels.ms';  // Public tunnel URL

/**
 * DApp HTML page URL
 */
export const DAPP_URL = `${BACKEND_URL}/index.html`;

/**
 * Socket.IO configuration
 */
export const SOCKET_CONFIG = {
  url: BACKEND_URL,
  options: {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  },
};

// ============================================================================
// Deep Link Configuration
// ============================================================================

/**
 * App URL scheme for deep linking
 */
export const APP_SCHEME = 'myapp';

/**
 * Deep link hosts
 */
export const DEEP_LINK_HOSTS = {
  connected: 'connected',
  transaction: 'transaction',
  error: 'error',
} as const;

/**
 * MetaMask deep link configuration
 */
export const METAMASK_CONFIG = {
  scheme: 'https://metamask.app.link/dapp',
  appLink: 'metamask://',
  storeUrls: {
    ios: 'https://apps.apple.com/us/app/metamask/id1438144202',
    android: 'https://play.google.com/store/apps/details?id=io.metamask',
  },
};

// ============================================================================
// Wallet Configuration
// ============================================================================

/**
 * Supported wallet types
 */
export const WALLET_TYPES = {
  METAMASK: 'metamask',
  WALLETCONNECT: 'walletconnect',
  COINBASE: 'coinbase',
} as const;

/**
 * Default wallet
 */
export const DEFAULT_WALLET = WALLET_TYPES.METAMASK;

// ============================================================================
// Session Configuration
// ============================================================================

/**
 * Session timeout in milliseconds (10 minutes)
 */
export const SESSION_TIMEOUT = 10 * 60 * 1000;

/**
 * Session ID format validation regex
 */
export const SESSION_ID_PATTERN = /^0x[a-fA-F0-9]{16}$/;

/**
 * Ethereum address format validation regex
 */
export const ETH_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Transaction hash format validation regex
 */
export const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

// ============================================================================
// UI Configuration
// ============================================================================

/**
 * Theme colors
 */
export const THEME_COLORS = {
  primary: '#667eea',
  secondary: '#764ba2',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  dark: '#1f2937',
  light: '#f3f4f6',
};

/**
 * Animation durations (milliseconds)
 */
export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
};

/**
 * Toast display duration (milliseconds)
 */
export const TOAST_DURATION = 3000;

// ============================================================================
// Development Configuration
// ============================================================================

/**
 * Enable debug logging
 */
export const DEBUG_MODE = __DEV__;

/**
 * Enable verbose socket logging
 */
export const SOCKET_DEBUG = __DEV__;

/**
 * Enable deep link debug logging
 */
export const DEEP_LINK_DEBUG = __DEV__;

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flags for conditional features
 */
export const FEATURES = {
  enableWalletConnect: false,
  enableCoinbaseWallet: false,
  enableBiometricAuth: false,
  enablePushNotifications: false,
  enableAnalytics: false,
};

// ============================================================================
// Export All
// ============================================================================

export default {
  BACKEND_URL,
  DAPP_URL,
  SOCKET_CONFIG,
  APP_SCHEME,
  DEEP_LINK_HOSTS,
  METAMASK_CONFIG,
  WALLET_TYPES,
  DEFAULT_WALLET,
  SESSION_TIMEOUT,
  SESSION_ID_PATTERN,
  ETH_ADDRESS_PATTERN,
  TX_HASH_PATTERN,
  THEME_COLORS,
  ANIMATION_DURATIONS,
  TOAST_DURATION,
  DEBUG_MODE,
  SOCKET_DEBUG,
  DEEP_LINK_DEBUG,
  FEATURES,
};
