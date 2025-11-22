/**
 * Wallet Service
 * 
 * Handles multi-wallet detection and connection for mobile wallets
 * Supports MetaMask, Rainbow, Trust Wallet, Coinbase Wallet, Phantom, Rabby, etc.
 */

import { Linking } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface WalletInfo {
  id: string;
  name: string;
  icon: string; // Emoji or icon name
  deepLinkScheme: string;
  universalLink?: string;
  color: string;
  supportsWalletConnect: boolean;
  downloadUrl: {
    ios: string;
    android: string;
  };
}

export interface WalletConnectionResult {
  success: boolean;
  address?: string;
  error?: string;
}

// ============================================================================
// Supported Wallets Configuration
// ============================================================================

export const SUPPORTED_WALLETS: WalletInfo[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    deepLinkScheme: 'metamask://',
    universalLink: 'https://metamask.app.link',
    color: '#F6851B',
    supportsWalletConnect: true,
    downloadUrl: {
      ios: 'https://apps.apple.com/app/metamask/id1438144202',
      android: 'https://play.google.com/store/apps/details?id=io.metamask',
    },
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    icon: '🌈',
    deepLinkScheme: 'rainbow://',
    universalLink: 'https://rainbow.me',
    color: '#FF6B6B',
    supportsWalletConnect: true,
    downloadUrl: {
      ios: 'https://apps.apple.com/app/rainbow-ethereum-wallet/id1457119021',
      android: 'https://play.google.com/store/apps/details?id=me.rainbow',
    },
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    icon: '🛡️',
    deepLinkScheme: 'trust://',
    universalLink: 'https://link.trustwallet.com',
    color: '#3375BB',
    supportsWalletConnect: true,
    downloadUrl: {
      ios: 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409',
      android: 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp',
    },
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '💙',
    deepLinkScheme: 'cbwallet://',
    universalLink: 'https://go.cb-w.com',
    color: '#0052FF',
    supportsWalletConnect: true,
    downloadUrl: {
      ios: 'https://apps.apple.com/app/coinbase-wallet/id1278383455',
      android: 'https://play.google.com/store/apps/details?id=org.toshi',
    },
  },
  {
    id: 'phantom',
    name: 'Phantom',
    icon: '👻',
    deepLinkScheme: 'phantom://',
    universalLink: 'https://phantom.app',
    color: '#AB9FF2',
    supportsWalletConnect: false,
    downloadUrl: {
      ios: 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977',
      android: 'https://play.google.com/store/apps/details?id=app.phantom',
    },
  },
  {
    id: 'rabby',
    name: 'Rabby Wallet',
    icon: '🐰',
    deepLinkScheme: 'rabby://',
    universalLink: 'https://rabby.io',
    color: '#8697FF',
    supportsWalletConnect: true,
    downloadUrl: {
      ios: 'https://apps.apple.com/app/rabby-wallet/id1609961064',
      android: 'https://play.google.com/store/apps/details?id=com.debank.rabbymobile',
    },
  },
  {
    id: 'zerion',
    name: 'Zerion',
    icon: '💎',
    deepLinkScheme: 'zerion://',
    color: '#2962EF',
    supportsWalletConnect: true,
    downloadUrl: {
      ios: 'https://apps.apple.com/app/zerion-wallet-for-web3/id1456732565',
      android: 'https://play.google.com/store/apps/details?id=io.zerion.android',
    },
  },
  {
    id: 'argent',
    name: 'Argent',
    icon: '🔷',
    deepLinkScheme: 'argent://',
    color: '#FF875B',
    supportsWalletConnect: true,
    downloadUrl: {
      ios: 'https://apps.apple.com/app/argent/id1358741926',
      android: 'https://play.google.com/store/apps/details?id=im.argent.contractwalletclient',
    },
  },
];

// ============================================================================
// Wallet Service Class
// ============================================================================

class WalletService {
  /**
   * Check if a specific wallet is installed on the device
   */
  async isWalletInstalled(wallet: WalletInfo): Promise<boolean> {
    try {
      const canOpen = await Linking.canOpenURL(wallet.deepLinkScheme);
      console.log(`[WalletService] ${wallet.name} installed:`, canOpen);
      return canOpen;
    } catch (error) {
      console.error(`[WalletService] Error checking ${wallet.name}:`, error);
      return false;
    }
  }

  /**
   * Get list of installed wallets from the device
   */
  async getInstalledWallets(): Promise<WalletInfo[]> {
    const installedWallets: WalletInfo[] = [];
    
    for (const wallet of SUPPORTED_WALLETS) {
      const isInstalled = await this.isWalletInstalled(wallet);
      if (isInstalled) {
        installedWallets.push(wallet);
      }
    }
    
    console.log(
      '[WalletService] Found installed wallets:',
      installedWallets.map(w => w.name)
    );
    
    return installedWallets;
  }

  /**
   * Get all supported wallets (for display purposes)
   */
  getAllWallets(): WalletInfo[] {
    return SUPPORTED_WALLETS;
  }

  /**
   * Build deep link for wallet connection
   */
  buildWalletDeepLink(
    wallet: WalletInfo,
    dappUrl: string,
    sessionId?: string
  ): string {
    // Add session ID to dapp URL if provided
    const urlWithParams = sessionId
      ? `${dappUrl}?sid=${sessionId}&roomId=${sessionId}`
      : dappUrl;
    
    // Remove protocol for deep link
    const urlWithoutProtocol = urlWithParams.replace(/^https?:\/\//, '');
    
    // Different wallets have different deep link formats
    switch (wallet.id) {
      case 'metamask':
        // MetaMask uses: metamask://dapp?url=[encoded_url]
        // The URL needs to be a publicly accessible URL, not localhost
        // For local dev, MetaMask won't be able to access localhost from the app
        return `${wallet.deepLinkScheme}dapp?url=${encodeURIComponent(urlWithParams)}`;
      
      case 'rainbow':
        // Rainbow uses universal link
        return `${wallet.universalLink}/dapp/${urlWithoutProtocol}`;
      
      case 'trust':
        // Trust Wallet uses: trust://open_url?url=[encoded_url]
        return `${wallet.deepLinkScheme}open_url?url=${encodeURIComponent(urlWithParams)}`;
      
      case 'coinbase':
        // Coinbase Wallet uses: cbwallet://dapp?url=[encoded_url]
        return `${wallet.deepLinkScheme}dapp?url=${encodeURIComponent(urlWithParams)}`;
      
      case 'rabby':
        // Rabby uses: rabby://dapp/[url]
        return `${wallet.deepLinkScheme}dapp/${urlWithoutProtocol}`;
      
      case 'zerion':
        // Zerion uses: zerion://dapp/[url]
        return `${wallet.deepLinkScheme}dapp/${urlWithoutProtocol}`;
      
      case 'argent':
        // Argent uses: argent://app/dapp/[url]
        return `${wallet.deepLinkScheme}app/dapp/${urlWithoutProtocol}`;
      
      default:
        // Generic format
        return `${wallet.deepLinkScheme}dapp/${urlWithoutProtocol}`;
    }
  }

  /**
   * Open wallet app with deep link
   */
  async openWallet(
    wallet: WalletInfo,
    dappUrl: string,
    sessionId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const deepLink = this.buildWalletDeepLink(wallet, dappUrl, sessionId);
      console.log(`[WalletService] ========================================`);
      console.log(`[WalletService] 🚀 Opening ${wallet.name}`);
      console.log(`[WalletService] 🔗 Deep Link: ${deepLink}`);
      console.log(`[WalletService] 🌐 DApp URL: ${dappUrl}`);
      console.log(`[WalletService] 🆔 Session ID: ${sessionId || 'none'}`);
      console.log(`[WalletService] ========================================`);
      
      // First verify the wallet is still installed
      const isInstalled = await this.isWalletInstalled(wallet);
      if (!isInstalled) {
        console.error(`[WalletService] ❌ ${wallet.name} is not installed!`);
        return {
          success: false,
          error: `${wallet.name} is not installed. Please install it first.`,
        };
      }
      
      console.log(`[WalletService] ✅ ${wallet.name} is installed, opening...`);
      
      // Try to open the deep link
      await Linking.openURL(deepLink);
      
      console.log(`[WalletService] ✅ Successfully opened ${wallet.name}`);
      return { success: true };
    } catch (error: any) {
      console.error(`[WalletService] ========================================`);
      console.error(`[WalletService] ❌ Error opening ${wallet.name}`);
      console.error(`[WalletService] Error message: ${error.message}`);
      console.error(`[WalletService] Error code: ${error.code}`);
      console.error(`[WalletService] Full error:`, error);
      console.error(`[WalletService] ========================================`);
      
      // Provide helpful error messages
      let errorMessage = 'Failed to open wallet';
      
      if (error.message?.includes('No Activity found')) {
        errorMessage = `${wallet.name} is not responding. Try opening it manually first.`;
      } else if (error.message?.includes('Unable to open URL')) {
        errorMessage = `Unable to open ${wallet.name}. The app may not be properly installed.`;
      } else if (error.code === 'ERR_INVALID_URL') {
        errorMessage = 'Invalid deep link format. Please report this issue.';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Open app store to install wallet
   */
  async openWalletStore(wallet: WalletInfo, platform: 'ios' | 'android'): Promise<void> {
    try {
      const storeUrl = wallet.downloadUrl[platform];
      await Linking.openURL(storeUrl);
    } catch (error) {
      console.error(`[WalletService] Error opening store for ${wallet.name}:`, error);
    }
  }
}

// Export singleton instance
export const walletService = new WalletService();
