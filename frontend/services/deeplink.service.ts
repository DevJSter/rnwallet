/**
 * Deep Link Service
 * 
 * Professional service for handling deep links in the wallet application.
 * Provides URL parsing, session management, and event-driven callbacks.
 */

import { Linking, Alert } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export type DeepLinkScheme = 'myapp' | 'frontend';

export interface DeepLinkParams {
  /** Session ID from wallet connection */
  sid?: string;
  /** Wallet address */
  address?: string;
  /** Transaction hash */
  txHash?: string;
  /** Error message */
  error?: string;
  /** Custom action */
  action?: 'connect' | 'disconnect' | 'transaction' | 'error';
}

export interface ParsedDeepLink {
  /** Original URL */
  url: string;
  /** URL scheme */
  scheme: string;
  /** URL host/path */
  host: string;
  /** Parsed parameters */
  params: DeepLinkParams;
  /** Timestamp when parsed */
  timestamp: number;
}

export type DeepLinkEventHandler = (link: ParsedDeepLink) => void | Promise<void>;

// ============================================================================
// Constants
// ============================================================================

const DEEP_LINK_SCHEMES: DeepLinkScheme[] = ['myapp', 'frontend'];
const SESSION_ID_REGEX = /^0x[a-fA-F0-9]{16}$/;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

// ============================================================================
// Deep Link Service Class
// ============================================================================

class DeepLinkService {
  private listeners: Map<string, DeepLinkEventHandler[]> = new Map();
  private subscription: any = null;
  private isInitialized = false;
  private lastProcessedLink: string | null = null;
  private lastProcessedTime = 0;

  /**
   * Initialize the deep link service
   * Must be called before any other methods
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[DeepLink] Service already initialized');
      return;
    }

    console.log('[DeepLink] 🚀 Initializing service...');

    // Handle initial URL (cold start)
    try {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('[DeepLink] 📱 App opened via deep link:', initialUrl);
        await this.handleDeepLink(initialUrl, 'cold-start');
      }
    } catch (error) {
      console.error('[DeepLink] ❌ Error getting initial URL:', error);
    }

    // Subscribe to deep link events (warm start)
    this.subscription = Linking.addEventListener('url', async ({ url }) => {
      console.log('[DeepLink] 📲 Deep link received:', url);
      await this.handleDeepLink(url, 'warm-start');
    });

    this.isInitialized = true;
    console.log('[DeepLink] ✅ Service initialized');
  }

  /**
   * Clean up and remove all listeners
   */
  cleanup(): void {
    console.log('[DeepLink] 🧹 Cleaning up service...');
    
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    
    this.listeners.clear();
    this.isInitialized = false;
    this.lastProcessedLink = null;
    this.lastProcessedTime = 0;
    
    console.log('[DeepLink] ✅ Cleanup complete');
  }

  /**
   * Parse a deep link URL into structured data
   */
  parseDeepLink(url: string): ParsedDeepLink | null {
    try {
      // Validate URL format
      if (!url || typeof url !== 'string') {
        console.warn('[DeepLink] ⚠️ Invalid URL format:', url);
        return null;
      }

      // Extract scheme and rest of URL
      const urlParts = url.split('://');
      if (urlParts.length < 2) {
        console.warn('[DeepLink] ⚠️ URL missing scheme:', url);
        return null;
      }

      const [scheme, rest] = urlParts;
      
      // Validate scheme
      if (!DEEP_LINK_SCHEMES.includes(scheme as DeepLinkScheme)) {
        console.warn('[DeepLink] ⚠️ Unknown scheme:', scheme);
        return null;
      }

      // Split host and query string
      const [hostPath, queryString] = rest.split('?');
      const host = hostPath || '';

      // Parse query parameters
      const params: DeepLinkParams = {};
      
      if (queryString) {
        const urlParams = new URLSearchParams(queryString);
        
        // Session ID
        const sid = urlParams.get('sid');
        if (sid) {
          params.sid = decodeURIComponent(sid);
        }
        
        // Address
        const address = urlParams.get('address');
        if (address) {
          params.address = decodeURIComponent(address);
        }
        
        // Transaction hash
        const txHash = urlParams.get('txHash') || urlParams.get('tx');
        if (txHash) {
          params.txHash = decodeURIComponent(txHash);
        }
        
        // Error
        const error = urlParams.get('error');
        if (error) {
          params.error = decodeURIComponent(error);
        }
        
        // Action
        const action = urlParams.get('action');
        if (action) {
          params.action = action as any;
        }
      }

      const parsed: ParsedDeepLink = {
        url,
        scheme,
        host,
        params,
        timestamp: Date.now(),
      };

      console.log('[DeepLink] 📋 Parsed:', JSON.stringify(parsed, null, 2));
      return parsed;

    } catch (error) {
      console.error('[DeepLink] ❌ Parse error:', error);
      return null;
    }
  }

  /**
   * Validate parsed deep link data
   */
  private validateDeepLink(parsed: ParsedDeepLink): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate session ID format
    if (parsed.params.sid && !SESSION_ID_REGEX.test(parsed.params.sid)) {
      errors.push(`Invalid session ID format: ${parsed.params.sid}`);
    }

    // Validate address format
    if (parsed.params.address && !ADDRESS_REGEX.test(parsed.params.address)) {
      errors.push(`Invalid address format: ${parsed.params.address}`);
    }

    // Validate transaction hash format
    if (parsed.params.txHash && !TX_HASH_REGEX.test(parsed.params.txHash)) {
      errors.push(`Invalid transaction hash format: ${parsed.params.txHash}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Handle incoming deep link
   */
  private async handleDeepLink(url: string, source: 'cold-start' | 'warm-start'): Promise<void> {
    try {
      // Prevent duplicate processing (within 2 seconds)
      const now = Date.now();
      if (url === this.lastProcessedLink && now - this.lastProcessedTime < 2000) {
        console.log('[DeepLink] 🔄 Skipping duplicate link');
        return;
      }

      this.lastProcessedLink = url;
      this.lastProcessedTime = now;

      console.log(`[DeepLink] 🔍 Processing link (${source}):`, url);

      // Parse the deep link
      const parsed = this.parseDeepLink(url);
      if (!parsed) {
        console.warn('[DeepLink] ⚠️ Failed to parse URL');
        return;
      }

      // Validate the parsed data
      const validation = this.validateDeepLink(parsed);
      if (!validation.valid) {
        console.error('[DeepLink] ❌ Validation failed:', validation.errors);
        this.emit('error', parsed);
        
        Alert.alert(
          '⚠️ Invalid Deep Link',
          validation.errors.join('\n'),
          [{ text: 'OK' }]
        );
        return;
      }

      // Emit to all registered listeners
      this.emit('link', parsed);

      // Emit specific events based on action or params
      if (parsed.params.action) {
        console.log(`[DeepLink] 📤 Emitting action event: "${parsed.params.action}"`);
        this.emit(parsed.params.action, parsed);
      }
      
      // Always emit session event if sid is present (regardless of action)
      if (parsed.params.sid) {
        console.log('[DeepLink] 📤 Emitting session event with sid:', parsed.params.sid);
        this.emit('session', parsed);
      }
      
      if (parsed.params.txHash) {
        console.log('[DeepLink] 📤 Emitting transaction event');
        this.emit('transaction', parsed);
      }

      console.log('[DeepLink] ✅ Successfully processed link');

    } catch (error) {
      console.error('[DeepLink] ❌ Error handling deep link:', error);
      Alert.alert(
        '❌ Deep Link Error',
        `Failed to process deep link: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Register an event listener
   */
  on(event: string, handler: DeepLinkEventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const handlers = this.listeners.get(event)!;
    handlers.push(handler);
    
    console.log(`[DeepLink] 🎧 Registered listener for "${event}" (${handlers.length} total)`);
  }

  /**
   * Remove an event listener
   */
  off(event: string, handler: DeepLinkEventHandler): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      console.log(`[DeepLink] 🔇 Removed listener for "${event}"`);
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  private emit(event: string, data: ParsedDeepLink): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.length === 0) {
      console.log(`[DeepLink] 📢 No listeners for "${event}"`);
      return;
    }

    console.log(`[DeepLink] 📢 Emitting "${event}" to ${handlers.length} listener(s)`);
    
    handlers.forEach(async (handler) => {
      try {
        await handler(data);
      } catch (error) {
        console.error(`[DeepLink] ❌ Error in listener for "${event}":`, error);
      }
    });
  }

  /**
   * Build a deep link URL with parameters
   */
  buildDeepLink(params: DeepLinkParams, scheme: DeepLinkScheme = 'myapp', host = 'connected'): string {
    const queryParams = new URLSearchParams();
    
    if (params.sid) queryParams.set('sid', params.sid);
    if (params.address) queryParams.set('address', params.address);
    if (params.txHash) queryParams.set('txHash', params.txHash);
    if (params.error) queryParams.set('error', params.error);
    if (params.action) queryParams.set('action', params.action);
    
    const queryString = queryParams.toString();
    const url = `${scheme}://${host}${queryString ? `?${queryString}` : ''}`;
    
    console.log('[DeepLink] 🔨 Built URL:', url);
    return url;
  }

  /**
   * Test if a URL can be opened
   */
  async canOpenURL(url: string): Promise<boolean> {
    try {
      return await Linking.canOpenURL(url);
    } catch (error) {
      console.error('[DeepLink] ❌ Error checking URL:', error);
      return false;
    }
  }

  /**
   * Open a URL
   */
  async openURL(url: string): Promise<boolean> {
    try {
      const canOpen = await this.canOpenURL(url);
      if (!canOpen) {
        console.warn('[DeepLink] ⚠️ Cannot open URL:', url);
        return false;
      }
      
      await Linking.openURL(url);
      console.log('[DeepLink] ✅ Opened URL:', url);
      return true;
    } catch (error) {
      console.error('[DeepLink] ❌ Error opening URL:', error);
      return false;
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const deepLinkService = new DeepLinkService();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a session ID for display (shortened)
 */
export function formatSessionId(sid: string): string {
  if (!sid) return 'N/A';
  return `${sid.substring(0, 10)}...${sid.substring(sid.length - 6)}`;
}

/**
 * Format an address for display (shortened)
 */
export function formatAddress(address: string): string {
  if (!address) return 'N/A';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Format a transaction hash for display (shortened)
 */
export function formatTxHash(txHash: string): string {
  if (!txHash) return 'N/A';
  return `${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}`;
}

  