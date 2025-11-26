import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppKit, useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';
import { BrowserProvider, formatEther } from 'ethers';

export default function HomeScreen() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { provider } = useProvider();
  const [balance, setBalance] = useState<string | null>(null);

  // Fetch balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected || !address || !provider) {
        setBalance(null);
        return;
      }

      try {
        const ethersProvider = new BrowserProvider(provider as any);
        const balanceWei = await ethersProvider.getBalance(address);
        const balanceEth = formatEther(balanceWei);
        setBalance(parseFloat(balanceEth).toFixed(4));
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    fetchBalance();
  }, [isConnected, address, provider]);

  const handleDisconnect = async () => {
    // Open the modal to show disconnect option
    open();
  };

  return (
    <>
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
        headerImage={
          <Image
            source={require('@/assets/images/partial-react-logo.png')}
            style={styles.reactLogo}
          />
        }>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Meow Wallet</ThemedText>
          <HelloWave />
        </ThemedView>

        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">Web3 Wallet Connection</ThemedText>
          
          {isConnected ? (
            <View style={styles.walletInfo}>
              <ThemedText type="defaultSemiBold">Connected Wallet</ThemedText>
              <ThemedText style={styles.address}>
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </ThemedText>
              
              {balance && (
                <ThemedText style={styles.balance}>
                  Balance: {balance} ETH
                </ThemedText>
              )}

              <TouchableOpacity 
                style={styles.disconnectButton}
                onPress={handleDisconnect}
              >
                <ThemedText style={styles.buttonText}>Manage Connection</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.connectContainer}>
              <ThemedText style={styles.description}>
                Connect your wallet to access Web3 features. Supports MetaMask, Trust Wallet, and more.
              </ThemedText>
              
              <TouchableOpacity 
                style={styles.connectButton}
                onPress={() => open()}
              >
                <ThemedText style={styles.buttonText}>Connect Wallet</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ThemedView>

        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">Supported Networks</ThemedText>
          <ThemedText>
            • Ethereum Mainnet{'\n'}
            • Polygon{'\n'}
            • Arbitrum{'\n'}
            • Optimism{'\n'}
            • Base
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">Features</ThemedText>
          <ThemedText>
            ✓ Multi-wallet support{'\n'}
            ✓ EVM chain compatibility{'\n'}
            ✓ Secure connection{'\n'}
            ✓ Real-time balance updates
          </ThemedText>
        </ThemedView>
      </ParallaxScrollView>

      {/* AppKit Modal - positioned absolutely for Expo Router compatibility */}
      <View style={styles.modalContainer}>
        <AppKit />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  connectContainer: {
    gap: 12,
    paddingVertical: 8,
  },
  description: {
    lineHeight: 20,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  walletInfo: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  address: {
    fontSize: 16,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  balance: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  modalContainer: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    pointerEvents: 'box-none',
  },
});
