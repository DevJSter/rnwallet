import React, { useState, useRef } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface WalletWebViewProps {
  dappUrl: string;
  sessionId?: string;
  authenticated?: boolean;
  onAuthenticated?: (address: string) => void;
  onTransactionSent?: (txHash: string) => void;
  onError?: (error: string) => void;
  onOpenMetaMask?: () => void;
}

export default function WalletWebView({
  dappUrl,
  sessionId,
  authenticated = false,
  onAuthenticated,
  onTransactionSent,
  onError,
  onOpenMetaMask
}: WalletWebViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const waitingForConnection = !!sessionId && !authenticated;
  const webViewRef = useRef<WebView>(null);

  // NOTE: Socket.IO connection is now handled in the parent HomeScreen component
  // This component only displays the waiting UI and handles WebView messages

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Received message from WebView:', data);

      switch (data.type) {
        case 'connected':
          Alert.alert('Wallet Connected', `Address: ${data.address.substring(0, 10)}...`);
          break;

        case 'login':
          // Handle authentication
          verifySignature(data);
          break;

        case 'transactionSent':
          Alert.alert(
            'Transaction Sent',
            `Transaction Hash: ${data.txHash.substring(0, 10)}...`
          );
          onTransactionSent?.(data.txHash);
          break;

        case 'transactionConfirmed':
          Alert.alert(
            'Transaction Confirmed',
            `Block: ${data.blockNumber}\nHash: ${data.txHash.substring(0, 10)}...`
          );
          break;

        case 'accountChanged':
          Alert.alert('Account Changed', `New address: ${data.address.substring(0, 10)}...`);
          break;

        case 'disconnected':
          Alert.alert('Wallet Disconnected', 'Your wallet has been disconnected.');
          break;

        case 'error':
          Alert.alert('Error', data.error);
          onError?.(data.error);
          break;

        case 'noWalletDetected':
          // Trigger MetaMask opening from parent component
          onOpenMetaMask?.();
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (err) {
      console.error('Error parsing WebView message:', err);
      setError('Failed to parse message from wallet');
    }
  };

  const verifySignature = async (data: any) => {
    try {
      const { address, signature, nonce, sessionId } = data;

      // Send to backend for verification
      const response = await fetch(`${dappUrl.replace(/\/[^/]*$/, '')}/api/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          signature,
          nonce,
          sessionId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert('Authentication Successful', `Welcome! Address: ${address.substring(0, 10)}...`);
        onAuthenticated?.(address);
      } else {
        Alert.alert('Authentication Failed', result.error || 'Invalid signature');
        onError?.(result.error || 'Invalid signature');
      }
    } catch (err: any) {
      console.error('Error verifying signature:', err);
      Alert.alert('Verification Error', err.message);
      onError?.(err.message);
    }
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setError('Failed to load DApp');
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
    setError(null);
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {waitingForConnection && (
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.waitingTitle}>🦊 Waiting for MetaMask</Text>
          <Text style={styles.waitingText}>
            Complete the connection in MetaMask browser:
          </Text>
          <Text style={styles.waitingSteps}>
            1. Connect your wallet{'\n'}
            2. Sign the login message{'\n'}
            3. You&apos;ll be notified automatically!
          </Text>
          <View style={styles.statusIndicator}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Listening for connection...</Text>
          </View>
        </View>
      )}
      {loading && !waitingForConnection && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading Wallet...</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: dappUrl }}
        onMessage={handleMessage}
        onError={handleError}
        onLoad={handleLoad}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        style={[styles.webview, waitingForConnection && styles.webviewHidden]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  webviewHidden: {
    opacity: 0,
    position: 'absolute',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
  },
  waitingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    zIndex: 2,
    padding: 40,
  },
  waitingTitle: {
    marginTop: 24,
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  waitingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  waitingSteps: {
    marginTop: 20,
    fontSize: 15,
    color: '#444',
    textAlign: 'left',
    lineHeight: 28,
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#e8f5e9',
    borderRadius: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4caf50',
    marginRight: 10,
  },
  statusText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#721c24',
    textAlign: 'center',
  },
});
