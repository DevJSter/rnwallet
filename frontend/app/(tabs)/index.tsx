import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert, AppState, AppStateStatus, Platform, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import WalletWebView from '@/components/WalletWebView';
import WalletSelectorSheet, { WalletSelectorSheetRef } from '@/components/WalletSelectorSheet';
import { io, Socket } from 'socket.io-client';
import { deepLinkService, formatAddress, formatSessionId } from '@/services/deeplink.service';
import type { ParsedDeepLink } from '@/services/deeplink.service';
import { walletService, WalletInfo } from '@/services/wallet.service';
import { erc4337Service } from '@/services/erc4337.service';
import { dappFeaturesService, TokenBalance } from '@/services/dapp.service';
import { BACKEND_URL, DAPP_URL, SOCKET_CONFIG } from '@/config/app.config';
import { ethers } from 'ethers';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function HomeScreen() {
  const [showWebView, setShowWebView] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [installedWallets, setInstalledWallets] = useState<WalletInfo[]>([]);
  const [allWallets, setAllWallets] = useState<WalletInfo[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const appState = useRef(AppState.currentState);
  const walletSheetRef = useRef<WalletSelectorSheetRef>(null);

  // Test wallet detection (debug function)
  const testWalletDetection = async () => {
    console.log('\n========================================')
    console.log('🔍 WALLET DETECTION TEST')
    console.log('========================================\n')

    const allWallets = walletService.getAllWallets();
    const results: string[] = [];
    
    for (const wallet of allWallets) {
      console.log(`\n📱 Testing: ${wallet.name}`);
      console.log(`   Scheme: ${wallet.deepLinkScheme}`);
      
      try {
        const isInstalled = await walletService.isWalletInstalled(wallet);
        const status = isInstalled ? '✅ INSTALLED' : '❌ NOT INSTALLED';
        console.log(`   ${status}`);
        results.push(`${wallet.icon} ${wallet.name}: ${isInstalled ? '✅' : '❌'}`);
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
        results.push(`${wallet.icon} ${wallet.name}: ⚠️ ERROR`);
      }
    }
    
    const installed = await walletService.getInstalledWallets();
    console.log('\n========================================');
    console.log(`📊 Total installed: ${installed.length}`);
    console.log('========================================\n');
    
    Alert.alert(
      '🔍 Wallet Detection Test',
      `${results.join('\n')}\n\nTotal Installed: ${installed.length}/${allWallets.length}`,
      [{ text: 'OK' }]
    );
  };

  // Initialize wallet detection
  useEffect(() => {
    const detectWallets = async () => {
      const installed = await walletService.getInstalledWallets();
      const all = walletService.getAllWallets();
      setInstalledWallets(installed);
      setAllWallets(all);
      console.log('[HomeScreen] Detected wallets:', installed.map(w => w.name));
    };
    detectWallets();
  }, []);

  // Load token balances
  const loadTokenBalances = useCallback(async () => {
    if (!userAddress) return;
    
    setLoadingBalances(true);
    try {
      const balances = await dappFeaturesService.getAllBalances('sepolia');
      setTokenBalances(balances);
      console.log('[HomeScreen] Loaded balances:', balances);
    } catch (error) {
      console.error('[HomeScreen] Error loading balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  }, [userAddress]);

  // Handle wallet connected
  const handleWalletConnected = useCallback(async (address: string) => {
    setAuthenticated(true);
    setUserAddress(address);
    
    Alert.alert(
      '✅ Wallet Connected!',
      `Address: ${formatAddress(address)}\n\nYour wallet has been successfully connected.`,
      [{ text: 'OK' }]
    );

    // Initialize services
    try {
      // Create provider and signer (using public RPC for demo)
      const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/your-infura-key');
      const signer = new ethers.Wallet('dummy-key', provider); // In reality, use wallet connection
      
      // Initialize dApp features
      dappFeaturesService.initialize(provider, signer, address);
      
      // Initialize ERC-4337
      erc4337Service.initialize(provider, signer, 'sepolia');
      
      // Get smart account address
      const smartAccount = await erc4337Service.getSmartAccountAddress(address);
      setSmartAccountAddress(smartAccount);
      console.log('[HomeScreen] Smart account:', smartAccount);
      
      // Load balances
      await loadTokenBalances();
    } catch (error) {
      console.error('[HomeScreen] Error initializing services:', error);
    }
  }, [loadTokenBalances]);

  // Deep link handler for wallet connection
  useEffect(() => {
    console.log('[HomeScreen] 🎧 Setting up deep link listeners...');

    const handleWalletConnection = async (link: ParsedDeepLink) => {
      console.log('[HomeScreen] 🎉 Wallet connection deep link received:', link);
      
      const { sid, address, error } = link.params;

      if (error) {
        Alert.alert(
          '❌ Connection Error',
          `Failed to connect wallet: ${error}`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (sid) {
        console.log('[HomeScreen] ✅ Session ID received:', sid);
        setSessionId(sid);
        
        if (address) {
          await handleWalletConnected(address);
        } else {
          Alert.alert(
            '⏳ Connection Initiated',
            `Session: ${formatSessionId(sid)}\n\nWaiting for wallet confirmation...`,
            [{ text: 'OK' }]
          );
        }
      }
    };

    const handleTransaction = async (link: ParsedDeepLink) => {
      console.log('[HomeScreen] 💸 Transaction deep link received:', link);
      const { txHash } = link.params;
      if (txHash) {
        Alert.alert(
          '✅ Transaction Complete',
          `Transaction Hash: ${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}`,
          [{ text: 'OK' }]
        );
      }
    };

    const handleError = async (link: ParsedDeepLink) => {
      console.error('[HomeScreen] ❌ Error deep link received:', link);
      Alert.alert(
        '❌ Error',
        link.params.error || 'An unknown error occurred',
        [{ text: 'OK' }]
      );
    };

    deepLinkService.on('session', handleWalletConnection);
    deepLinkService.on('connect', handleWalletConnection);
    deepLinkService.on('transaction', handleTransaction);
    deepLinkService.on('error', handleError);

    return () => {
      deepLinkService.off('session', handleWalletConnection);
      deepLinkService.off('connect', handleWalletConnection);
      deepLinkService.off('transaction', handleTransaction);
      deepLinkService.off('error', handleError);
    };
  }, [handleWalletConnected]);

  // App state and socket management
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[HomeScreen] 📱 App returned to foreground, reloading WebView');
        setWebViewKey(prev => prev + 1);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (socketRef.current) {
        console.log('[HomeScreen] 🧹 Cleaning up socket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Show wallet selector
  const handleConnectWallet = () => {
    walletSheetRef.current?.open();
  };

  // Handle wallet selection
  const handleWalletSelect = async (wallet: WalletInfo) => {
    try {
      console.log('[HomeScreen] Selected wallet:', wallet.name);
      console.log('[HomeScreen] Backend URL:', BACKEND_URL);
      console.log('[HomeScreen] Attempting to create session...');
      
      // Create new session with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(`${BACKEND_URL}/api/session/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const { sessionId: newSessionId } = await response.json();
      setSessionId(newSessionId);
      console.log('[HomeScreen] ✅ Session created:', newSessionId);
      
      // Setup polling
      startSessionPolling(newSessionId);
      
      // Setup socket (backup)
      setupSocket(newSessionId);
      
      // Open wallet
      console.log('[HomeScreen] Opening wallet app...');
      const result = await walletService.openWallet(wallet, DAPP_URL, newSessionId);
      
      if (result.success) {
        Alert.alert(
          'Wallet Opening',
          `Opening ${wallet.name}...\n\n1. Connect your wallet\n2. Sign the message\n3. Return to app\n\n⏱️ We'll detect the connection automatically.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to open wallet');
      }
    } catch (error: any) {
      console.error('[HomeScreen] Error connecting wallet:', error);
      
      let errorMsg = 'Failed to create session';
      if (error.name === 'AbortError') {
        errorMsg = `Cannot connect to backend server at ${BACKEND_URL}\n\nMake sure the server is running.`;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      Alert.alert(
        '❌ Connection Failed',
        errorMsg,
        [
          { text: 'Retry', onPress: () => handleWalletSelect(wallet) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  // Handle wallet installation
  const handleInstallWallet = (wallet: WalletInfo) => {
    Alert.alert(
      `Get ${wallet.name}`,
      `${wallet.name} is not installed on your device. Would you like to download it from the app store?`,
      [
        {
          text: 'Download',
          onPress: () => {
            const platform = Platform.OS === 'ios' ? 'ios' : 'android';
            walletService.openWalletStore(wallet, platform);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Start session polling
  const startSessionPolling = (sid: string) => {
    console.log('[HomeScreen] 🔍 Starting session polling...');
    let pollAttempts = 0;
    const maxPollAttempts = 60;
    
    const pollInterval = setInterval(async () => {
      if (authenticated) {
        clearInterval(pollInterval);
        return;
      }
      
      pollAttempts++;
      
      try {
        const statusResponse = await fetch(`${BACKEND_URL}/api/session/${sid}`);
        
        if (statusResponse.ok) {
          const sessionData = await statusResponse.json();
          
          if (sessionData.connected && sessionData.address) {
            clearInterval(pollInterval);
            await handleWalletConnected(sessionData.address);
          }
        }
      } catch (err) {
        console.error('[HomeScreen] Poll error:', err);
      }
      
      if (pollAttempts >= maxPollAttempts) {
        clearInterval(pollInterval);
        if (!authenticated) {
          Alert.alert(
            '⏱️ Connection Timeout',
            'Connection timed out. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    }, 2000);
  };

  // Setup socket connection
  const setupSocket = (sid: string) => {
    try {
      const socket = io(SOCKET_CONFIG.url, {
        ...SOCKET_CONFIG.options,
        extraHeaders: { 'x-client': 'react-native' }
      });
      
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('[HomeScreen] Socket connected');
        socket.emit('join', sid);
      });
      
      socket.on('session:connected', async ({ address }: { address: string }) => {
        console.log('[HomeScreen] Wallet connected via socket:', address);
        await handleWalletConnected(address);
      });
      
      socket.on('connect_error', (error: Error) => {
        console.error('[HomeScreen] Socket error:', error.message);
      });
    } catch (err) {
      console.error('[HomeScreen] Failed to setup socket:', err);
    }
  };

  // Send transaction
  const handleSendTransaction = async () => {
    Alert.prompt(
      'Send ETH',
      'Enter recipient address:',
      async (toAddress) => {
        if (!toAddress) return;
        
        Alert.prompt(
          'Send ETH',
          'Enter amount (ETH):',
          async (amount) => {
            if (!amount) return;
            
            try {
              const txHash = await dappFeaturesService.sendEth(toAddress, amount);
              Alert.alert(
                '✅ Transaction Sent',
                `Hash: ${txHash.substring(0, 10)}...`,
                [{ text: 'OK' }]
              );
              await loadTokenBalances();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Transaction failed');
            }
          }
        );
      }
    );
  };

  // Send gasless transaction
  const handleGaslessTransaction = async () => {
    if (!smartAccountAddress) {
      Alert.alert('Error', 'Smart account not initialized');
      return;
    }
    
    try {
      const txHash = await erc4337Service.sendGaslessTransaction(
        smartAccountAddress,
        userAddress!,
        '0',
        '0x'
      );
      Alert.alert(
        '✅ Gasless Transaction Sent',
        `Hash: ${txHash.substring(0, 10)}...\n\nNo gas fees paid!`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Gasless transaction failed');
    }
  };

  // Disconnect
  const handleDisconnect = () => {
    setShowWebView(false);
    setAuthenticated(false);
    setUserAddress(null);
    setSessionId(null);
    setTokenBalances([]);
    setSmartAccountAddress(null);
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Render authenticated view
  if (authenticated && userAddress) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemedView style={styles.container}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>🦊 DApp Wallet</Text>
                <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtnSmall}>
                  <Text style={styles.disconnectBtnSmallText}>Disconnect</Text>
                </TouchableOpacity>
              </View>

              {/* Address Card */}
              <View style={styles.addressCard}>
                <Text style={styles.addressLabel}>Connected Address</Text>
                <Text style={styles.addressShort}>
                  {formatAddress(userAddress)}
                </Text>
                {smartAccountAddress && (
                  <View style={styles.smartAccountBadge}>
                    <Text style={styles.smartAccountText}>
                      🔐 Smart Account: {formatAddress(smartAccountAddress)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Token Balances */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>💰 Token Balances</Text>
                  <TouchableOpacity onPress={loadTokenBalances} disabled={loadingBalances}>
                    <Text style={styles.refreshText}>
                      {loadingBalances ? '...' : '🔄'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {tokenBalances.length > 0 ? (
                  tokenBalances.map((token, index) => (
                    <View key={index} style={styles.tokenCard}>
                      <View>
                        <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                        <Text style={styles.tokenName}>{token.name}</Text>
                      </View>
                      <Text style={styles.tokenBalance}>
                        {parseFloat(token.balance).toFixed(4)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No tokens found</Text>
                )}
              </View>

              {/* DApp Features */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚡ DApp Features</Text>
                
                <TouchableOpacity style={styles.featureButton} onPress={handleSendTransaction}>
                  <Text style={styles.featureButtonText}>💸 Send Transaction</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.featureButton} onPress={handleGaslessTransaction}>
                  <Text style={styles.featureButtonText}>🚀 Send Gasless Transaction (ERC-4337)</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.featureButton}
                  onPress={async () => {
                    try {
                      const signature = await dappFeaturesService.signMessage('Hello from DApp!');
                      Alert.alert('Signature', signature.substring(0, 20) + '...');
                    } catch (error: any) {
                      Alert.alert('Error', error.message);
                    }
                  }}
                >
                  <Text style={styles.featureButtonText}>✍️ Sign Message</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.featureButton}
                  onPress={async () => {
                    if (!smartAccountAddress) return;
                    const info = await erc4337Service.getAccountInfo(smartAccountAddress);
                    Alert.alert(
                      'Smart Account Info',
                      `Deployed: ${info.isDeployed}\nNonce: ${info.nonce}\nBalance: ${info.balance} ETH`
                    );
                  }}
                >
                  <Text style={styles.featureButtonText}>🔐 View Smart Account Info</Text>
                </TouchableOpacity>
              </View>

              
            </View>
          </ScrollView>
        </ThemedView>
      </GestureHandlerRootView>
    );
  }

  // Show WebView if needed
  if (showWebView) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity onPress={handleDisconnect} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <WalletWebView
          key={webViewKey}
          dappUrl={sessionId ? `${DAPP_URL}?sid=${sessionId}` : DAPP_URL}
          sessionId={sessionId || undefined}
          authenticated={authenticated}
          onAuthenticated={handleWalletConnected}
        />
      </View>
    );
  }

  // Show wallet connection screen
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🦊</Text>
              Web3 DApp Wallet
  
            <ThemedText style={styles.subtitle}>
              Connect with any wallet on your phone
            </ThemedText>
          </View>


          {/* Connect Button */}
          <TouchableOpacity 
            style={styles.connectButton} 
            onPress={handleConnectWallet}
          >
            <Text style={styles.connectButtonText}>Connect Wallet</Text>
          </TouchableOpacity>

          {/* Detected Wallets Info */}
          {installedWallets.length > 0 && (
            <View style={styles.walletsInfo}>
              <Text style={styles.walletsInfoText}>
                {installedWallets.length} wallet{installedWallets.length !== 1 ? 's' : ''} detected: {installedWallets.map(w => w.icon).join(' ')}
              </Text>
            </View>
          )}
        </View>

        {/* Wallet Selector Bottom Sheet */}
        <WalletSelectorSheet
          ref={walletSheetRef}
          installedWallets={installedWallets}
          allWallets={allWallets}
          onWalletSelect={handleWalletSelect}
          onInstallWallet={handleInstallWallet}
        />
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  logo: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  featuresBox: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#667eea',
  },
  featureItem: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.8,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  testButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  walletsInfo: {
    padding: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
  },
  walletsInfoText: {
    fontSize: 13,
    textAlign: 'center',
    color: '#4CAF50',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  disconnectBtnSmall: {
    backgroundColor: '#ff4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  disconnectBtnSmallText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addressCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  addressShort: {
    fontSize: 20,
    fontWeight: '600',
    color: '#667eea',
    fontFamily: 'monospace',
  },
  smartAccountBadge: {
    marginTop: 12,
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 8,
  },
  smartAccountText: {
    fontSize: 11,
    color: '#4CAF50',
    fontFamily: 'monospace',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  refreshText: {
    fontSize: 20,
  },
  tokenCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenName: {
    fontSize: 12,
    color: '#666',
  },
  tokenBalance: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  featureButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 10,
  },
  featureButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#4CAF50',
  },
  infoCardText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.8,
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#667eea',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
