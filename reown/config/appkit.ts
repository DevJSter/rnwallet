import '@walletconnect/react-native-compat'; // MUST be first!

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import { createAppKit } from '@reown/appkit-react-native';
import Constants from 'expo-constants';
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains';

// Get Project ID from environment variables
// Priority: expo-constants extra > process.env > direct value from .env
const projectId = 
  // Constants.expoConfig?.extra?.REOWN_PROJECT_ID || 
  // process.env.REOWN_PROJECT_ID ||
  'ec331fa36e7aa0809cdf6a6a80dd2853'; // Fallback to the actual project ID


// Initialize Ethers adapter for EVM chains
const ethersAdapter = new EthersAdapter();

// Storage wrapper for AsyncStorage
const storage = {
  async getKeys(): Promise<string[]> {
    const keys = await AsyncStorage.getAllKeys();
    return [...keys]; // Convert readonly to mutable array
  },
  async getEntries(): Promise<[string, any][]> {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await Promise.all(
      keys.map(async (key): Promise<[string, any]> => {
        const value = await AsyncStorage.getItem(key);
        return [key, value ? JSON.parse(value) : null];
      })
    );
    return entries;
  },
  async getItem(key: string) {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : undefined;
  },
  async setItem(key: string, value: any) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};

// Create AppKit instance
export const appKit = createAppKit({
  projectId,
  adapters: [ethersAdapter],
  networks: [mainnet, polygon, arbitrum, optimism, base],
  defaultNetwork: mainnet,
  storage,
  metadata: {
    name: 'Meow Wallet',
    description: 'Connect your wallet to Reown',
    url: 'https://qoneqt.com',
    icons: ['https://qoneqt.com/favicon.ico'],
    redirect: {
      native: 'meow://', // Matches scheme in app.json
      universal: 'reown.com',
    },
  },

});
