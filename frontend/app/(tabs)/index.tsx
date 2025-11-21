import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Linking, Alert, AppState, AppStateStatus } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import WalletWebView from '@/components/WalletWebView';
import { io, Socket } from 'socket.io-client';
import { deepLinkService, formatAddress, formatSessionId } from '@/services/deeplink.service';
import type { ParsedDeepLink } from '@/services/deeplink.service';
import { BACKEND_URL, DAPP_URL, SOCKET_CONFIG, METAMASK_CONFIG } from '@/config/app.config';

export default function HomeScreen() {
  const [showWebView, setShowWebView] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const appState = useRef(AppState.currentState);

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
        
        // If we have an address directly from the deep link
        if (address) {
          setAuthenticated(true);
          setUserAddress(address);
          Alert.alert(
            '✅ Wallet Connected!',
            `Address: ${formatAddress(address)}\n\nYour wallet has been successfully connected.`,
            [{ text: 'OK' }]
          );
        } else {
          // Show waiting message
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

    // Register listeners
    deepLinkService.on('session', handleWalletConnection);
    deepLinkService.on('connect', handleWalletConnection); // Also listen for connect action
    deepLinkService.on('transaction', handleTransaction);
    deepLinkService.on('error', handleError);

    // Cleanup
    return () => {
      console.log('[HomeScreen] Removing deep link listeners...');
      deepLinkService.off('session', handleWalletConnection);
      deepLinkService.off('connect', handleWalletConnection);
      deepLinkService.off('transaction', handleTransaction);
      deepLinkService.off('error', handleError);
    };
  }, []);

  // App state and socket management
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground - reload webview to check for wallet
        console.log('[HomeScreen] 📱 App returned to foreground, reloading WebView');
        setWebViewKey(prev => prev + 1);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      // Cleanup socket on unmount
      if (socketRef.current) {
        console.log('[HomeScreen] 🧹 Cleaning up socket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const handleConnectWallet = () => {
    Alert.alert(
      '⚠️ Limited Functionality',
      'The embedded browser cannot detect MetaMask or other wallets. For full wallet support, please use "🦊 Open in MetaMask Browser" button instead.\n\nDo you want to continue anyway?',
      [
        {
          text: 'Use MetaMask Browser',
          onPress: handleConnectMetaMask,
          style: 'default'
        },
        {
          text: 'Continue Anyway',
          onPress: () => setShowWebView(true),
          style: 'cancel'
        }
      ]
    );
  };

  const handleConnectMetaMask = async () => {
    try {
      console.log('🚀 [CONNECT] Creating new session...');
      
      // Step 1: Create a new session on the backend
      const response = await fetch(`${BACKEND_URL}/api/session/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const { sessionId: newSessionId, nonce } = await response.json();
      console.log('✅ [SESSION] Created:', newSessionId);
      console.log('✅ [NONCE] Received:', nonce);
      
      // Step 2: Set the session ID
      setSessionId(newSessionId);
      
      // Step 3: Setup polling FIRST (primary method for devtunnel)
      console.log('[RN] 🔍 Starting session status polling...');
      console.log('[RN] 📡 Polling endpoint:', `${BACKEND_URL}/api/session/${newSessionId}`);
      let pollAttempts = 0;
      const maxPollAttempts = 60; // 2 minutes at 2-second intervals
      
      const pollInterval = setInterval(async () => {
        if (authenticated) {
          // Already authenticated, stop polling
          console.log('[RN] ✅ Already authenticated, stopping polling');
          clearInterval(pollInterval);
          return;
        }
        
        pollAttempts++;
        
        try {
          console.log(`[RN] 🔍 Polling session status... (attempt ${pollAttempts}/${maxPollAttempts})`);
          const statusResponse = await fetch(`${BACKEND_URL}/api/session/${newSessionId}`);
          
          if (statusResponse.ok) {
            const sessionData = await statusResponse.json();
            console.log('[RN] 📊 Session data received:', {
              connected: sessionData.connected,
              hasAddress: !!sessionData.address,
              address: sessionData.address ? `${sessionData.address.substring(0, 6)}...` : 'none'
            });
            
            if (sessionData.connected && sessionData.address) {
              console.log('✅ [RN] Session connected via polling!');
              console.log('✅ [RN] Address:', sessionData.address);
              clearInterval(pollInterval);
              
              setAuthenticated(true);
              setUserAddress(sessionData.address);
              
              Alert.alert(
                '✅ Wallet Connected!',
                `Address: ${sessionData.address.substring(0, 6)}...${sessionData.address.substring(sessionData.address.length - 4)}\n\nYour wallet has been successfully connected.`,
                [{ text: 'OK' }]
              );
            } else {
              console.log('[RN] ⏳ Still waiting for connection...');
            }
          } else {
            console.log(`[RN] ⚠️ Status response not OK: ${statusResponse.status}`);
          }
        } catch (err) {
          console.error('[RN] ⚠️ Poll error:', err);
        }
        
        // Stop after max attempts
        if (pollAttempts >= maxPollAttempts) {
          clearInterval(pollInterval);
          console.log('[RN] ⏱️ Polling timeout reached - stopped checking');
          if (!authenticated) {
            Alert.alert(
              '⏱️ Connection Timeout',
              'Did not receive wallet connection. Please try again or check your connection.',
              [{ text: 'OK' }]
            );
          }
        }
      }, 2000); // Poll every 2 seconds
      
      // Step 4: Connect socket (secondary/backup method)
      console.log('[RN] 🔌 Attempting Socket.IO connection to:', SOCKET_CONFIG.url);
      try {
        const socket = io(SOCKET_CONFIG.url, {
          ...SOCKET_CONFIG.options,
          extraHeaders: {
            'x-client': 'react-native'
          }
        });
        
        socketRef.current = socket;
        
        socket.on('connect', () => {
          console.log('✅ [RN] Socket connected:', socket.id);
          console.log('[RN] Joining session room:', newSessionId);
          socket.emit('join', newSessionId);
        });
        
        socket.on('connect_error', (error: Error) => {
          console.error('❌ [RN] Socket connection error:', error.message);
          console.log('[RN] 📡 Falling back to polling only...');
        });
        
        socket.on('reconnect', (attemptNumber: number) => {
          console.log(`🔄 [RN] Socket reconnected after ${attemptNumber} attempts`);
          console.log('[RN] Rejoining session room:', newSessionId);
          socket.emit('join', newSessionId);
        });
        
        socket.on('session:connected', ({ address }: { address: string }) => {
          console.log('✅ [RN] Wallet connected via socket:', address);
          clearInterval(pollInterval);
          setAuthenticated(true);
          setUserAddress(address);
          Alert.alert(
            '✅ Wallet Connected!',
            `Address: ${address.substring(0, 6)}...${address.substring(address.length - 4)}\n\nYou can now use all wallet features.`,
            [{ text: 'OK' }]
          );
        });
        
        socket.on('disconnect', (reason: string) => {
          console.log('🔌 [RN] Socket disconnected:', reason);
        });
      } catch (err) {
        console.error('❌ [RN] Failed to initialize socket:', err);
        console.log('[RN] 📡 Continuing with polling only...');
      }
      
      // Step 5: Show WebView
      setShowWebView(true);
      
      // Step 6: Build MetaMask deep link with session ID (roomId)
      const dappUrlWithSession = `${DAPP_URL}?sid=${newSessionId}&roomId=${newSessionId}`;
      const urlWithSessionNoProtocol = dappUrlWithSession.replace(/^https?:\/\//, '');
      const metaMaskDeepLink = `${METAMASK_CONFIG.scheme}/${urlWithSessionNoProtocol}`;
      
      console.log('🦊 [METAMASK] Opening with session/roomId:', metaMaskDeepLink);
      console.log('🦊 [METAMASK] RoomId for polling:', newSessionId);
      
      // Step 8: Open MetaMask
      Alert.alert(
        'Connect Wallet',
        `🔑 Session: ${newSessionId.substring(0, 10)}...\n\nOpening MetaMask browser...\n\n1. Connect your wallet in MetaMask\n2. Sign the login message\n3. Return to app - we'll detect the connection!\n\n⏱️ The app will auto-update when connected.`,
        [
          {
            text: 'Open MetaMask',
            onPress: async () => {
              try {
                // Check if the URL can be opened first
                const canOpen = await Linking.canOpenURL(metaMaskDeepLink);
                console.log('[METAMASK] Can open URL:', canOpen);
                
                if (canOpen) {
                  await Linking.openURL(metaMaskDeepLink);
                  console.log('✅ [METAMASK] Opened successfully');
                  console.log('✅ [METAMASK] Polling is active and will detect connection');
                } else {
                  throw new Error('MetaMask app not found or URL cannot be opened');
                }
              } catch (err) {
                console.error('❌ [METAMASK] Failed to open:', err);
                Alert.alert(
                  'Cannot Open MetaMask',
                  'Please make sure MetaMask mobile app is installed. You can download it from:\n\n• Google Play Store (Android)\n• App Store (iOS)',
                  [{ text: 'OK' }]
                );
              }
            }
          },
          { text: 'Cancel', style: 'cancel', onPress: () => {
            setShowWebView(false);
            setSessionId(null);
            clearInterval(pollInterval);
            
            // Clean up socket if created
            if (socketRef.current) {
              console.log('[RN] Cancelling - disconnecting socket');
              socketRef.current.disconnect();
              socketRef.current = null;
            }
          }}
        ]
      );
    } catch (error) {
      console.error('❌ [ERROR] Failed to create session:', error);
      Alert.alert('Error', 'Failed to create session. Please try again.');
    }
  };

  const handleAuthenticated = (address: string) => {
    setAuthenticated(true);
    setUserAddress(address);
  };

  const handleTransactionSent = (txHash: string) => {
    console.log('Transaction sent:', txHash);
  };

  const handleError = (error: string) => {
    console.error('Wallet error:', error);
  };

  const handleOpenMetaMask = async () => {
    try {
      // If we already have a session ID, use it; otherwise create a new one
      let useSessionId = sessionId;
      
      if (!useSessionId) {
        console.log('🚀 [CONNECT] Creating new session for MetaMask...');
        const response = await fetch(`${BACKEND_URL}/api/session/new`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const { sessionId: newSessionId } = await response.json();
        useSessionId = newSessionId;
        setSessionId(newSessionId);
        console.log('✅ [SESSION] Created:', newSessionId);
      }
      
      // Build URL with session ID
      const dappUrlWithSession = `${DAPP_URL}?sid=${useSessionId}&roomId=${useSessionId}`;
      const urlWithoutProtocol = dappUrlWithSession.replace(/^https?:\/\//, '');
      const metaMaskDeepLink = `https://metamask.app.link/dapp/${urlWithoutProtocol}`;
      
      Alert.alert(
        'Open in MetaMask',
        `🔑 Session: ${useSessionId?.substring(0, 10)}...\n\nYou will be redirected to MetaMask to connect your wallet. After connecting, you can return to this app.`,
        [
          {
            text: 'Open MetaMask',
            onPress: async () => {
              try {
                console.log('Opening MetaMask with:', metaMaskDeepLink);
                
                // Check if the URL can be opened first
                const canOpen = await Linking.canOpenURL(metaMaskDeepLink);
                console.log('[METAMASK] Can open URL:', canOpen);
                
                if (!canOpen) {
                  throw new Error('MetaMask app not found or URL cannot be opened');
                }
                
                // Setup Socket.IO connection if we have a session
                if (useSessionId && !socketRef.current) {
                  console.log('[RN] 🔌 Setting up Socket.IO connection...');
                  const socket = io(SOCKET_CONFIG.url, {
                    ...SOCKET_CONFIG.options,
                    extraHeaders: { 'x-client': 'react-native' }
                  });
                  
                  socketRef.current = socket;
                  
                  socket.on('connect', () => {
                    console.log('✅ [RN] Socket connected:', socket.id);
                    socket.emit('join', useSessionId);
                  });
                  
                  socket.on('session:connected', ({ address }: { address: string }) => {
                    console.log('✅ [RN] Wallet connected via socket:', address);
                    setAuthenticated(true);
                    setUserAddress(address);
                    Alert.alert(
                      '✅ Wallet Connected!',
                      `Address: ${address.substring(0, 6)}...${address.substring(address.length - 4)}\n\nYou can now use all wallet features.`,
                      [{ text: 'OK' }]
                    );
                  });
                  
                  socket.on('connect_error', (error: Error) => {
                    console.error('❌ [RN] Socket error:', error.message);
                  });
                }
                
                // Start polling for connection status
                if (useSessionId) {
                  console.log('[RN] 🔍 Starting session status polling...');
                  let pollAttempts = 0;
                  const maxPollAttempts = 60;
                  
                  const pollInterval = setInterval(async () => {
                    if (authenticated) {
                      clearInterval(pollInterval);
                      return;
                    }
                    
                    pollAttempts++;
                    
                    try {
                      const statusResponse = await fetch(`${BACKEND_URL}/api/session/${useSessionId}`);
                      if (statusResponse.ok) {
                        const sessionData = await statusResponse.json();
                        if (sessionData.connected && sessionData.address) {
                          clearInterval(pollInterval);
                          setAuthenticated(true);
                          setUserAddress(sessionData.address);
                          Alert.alert(
                            '✅ Wallet Connected!',
                            `Address: ${sessionData.address.substring(0, 6)}...${sessionData.address.substring(sessionData.address.length - 4)}`,
                            [{ text: 'OK' }]
                          );
                        }
                      }
                    } catch (err) {
                      console.error('[RN] ⚠️ Poll error:', err);
                    }
                    
                    if (pollAttempts >= maxPollAttempts) {
                      clearInterval(pollInterval);
                    }
                  }, 2000);
                }
                
                await Linking.openURL(metaMaskDeepLink);
                
                // Show info that user can return
                setTimeout(() => {
                  Alert.alert(
                    'Return to App',
                    'After connecting in MetaMask, please return to this app to continue.\n\n⏱️ The app will auto-detect the connection.',
                    [{ text: 'OK' }]
                  );
                }, 1000);
              } catch (err) {
                console.error('Failed to open MetaMask:', err);
                Alert.alert(
                  'MetaMask Not Installed',
                  'Please install MetaMask mobile app from your app store.',
                  [{ text: 'OK' }]
                );
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error opening MetaMask:', error);
      Alert.alert('Error', 'Failed to open MetaMask.');
    }
  };

  const handleCheckStatus = async () => {
    if (!sessionId) return;
    
    try {
      console.log('[RN] 🔍 Manually checking session status for:', sessionId);
      const statusResponse = await fetch(`${BACKEND_URL}/api/session/${sessionId}`);
      
      if (statusResponse.ok) {
        const sessionData = await statusResponse.json();
        console.log('[RN] 📊 Session data:', sessionData);
        
        if (sessionData.connected && sessionData.address) {
          console.log('✅ [RN] Session is connected!');
          setAuthenticated(true);
          setUserAddress(sessionData.address);
          
          Alert.alert(
            '✅ Wallet Connected!',
            `Address: ${sessionData.address.substring(0, 6)}...${sessionData.address.substring(sessionData.address.length - 4)}\n\nYou can now use all wallet features.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            '⏳ Still Waiting',
            `Session Status: ${sessionData.connected ? 'Connected' : 'Pending'}\n\nPlease complete the connection in MetaMask and try again.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          '❌ Session Not Found',
          'Could not find the session. Please try connecting again.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('[RN] ⚠️ Status check error:', err);
      Alert.alert(
        '❌ Check Failed',
        'Failed to check connection status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleDisconnect = () => {
    setShowWebView(false);
    setAuthenticated(false);
    setUserAddress(null);
    setSessionId(null);
    
    // Disconnect socket
    if (socketRef.current) {
      console.log('[RN] Disconnecting socket');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Show authenticated state
  if (authenticated && userAddress) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.statusCard}>
            <Text style={styles.statusEmoji}></Text>
            <ThemedText type="title" style={styles.connectedTitle}>
              Wallet Connected!
            </ThemedText>
            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>Your Address</Text>
              <Text style={styles.addressValue}>
                {userAddress}
              </Text>
              <Text style={styles.addressShort}>
                {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}
              </Text>
            </View>
            
            {sessionId && (
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionLabel}>Session ID</Text>
                <Text style={styles.sessionValue}>
                  {sessionId}
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.disconnectButton} 
              onPress={handleDisconnect}
            >
              <Text style={styles.disconnectButtonText}>🔌 Disconnect Wallet</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.refreshButton} 
              onPress={() => setWebViewKey(prev => prev + 1)}
            >
              <Text style={styles.refreshButtonText}>🔄 Refresh Connection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
    );
  }

  // Show WebView for connection process
  if (showWebView) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleDisconnect} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          {sessionId ? (
            <TouchableOpacity onPress={handleCheckStatus} style={styles.checkButton}>
              <Text style={styles.checkButtonText}>🔄 Check Status</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <WalletWebView
          key={webViewKey}
          dappUrl={sessionId ? `${DAPP_URL}?sid=${sessionId}` : DAPP_URL}
          sessionId={sessionId || undefined}
          authenticated={authenticated}
          onAuthenticated={handleAuthenticated}
          onTransactionSent={handleTransactionSent}
          onError={handleError}
          onOpenMetaMask={handleOpenMetaMask}
        />
      </View>
    );
  }

  // Show connection options
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          🦊 Ethereum Wallet
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Connect your wallet to access blockchain features
        </ThemedText>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleConnectMetaMask}
          >
            <Text style={styles.primaryButtonText}>🦊 Open in MetaMask Browser</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={handleConnectWallet}
          >
            <Text style={styles.secondaryButtonText}>Try Embedded Browser (Limited)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  checkButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 32,
    opacity: 0.7,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#667eea',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  featuresContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.8,
  },
  noteContainer: {
    padding: 16,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  noteText: {
    fontSize: 12,
    opacity: 0.8,
  },
  statusCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statusEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  connectedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#28a745',
  },
  addressCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e8f5e9',
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addressValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#333',
    marginBottom: 12,
    lineHeight: 18,
  },
  addressShort: {
    fontSize: 20,
    fontWeight: '600',
    color: '#667eea',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  sessionInfo: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  sessionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sessionValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#856404',
  },
  disconnectButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  refreshButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
