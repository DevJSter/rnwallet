/**
 * Wallet Selector Bottom Sheet
 * 
 * Displays a list of available wallets for connection
 */

import React, { useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { WalletInfo } from '@/services/wallet.service';

// ============================================================================
// Types
// ============================================================================

export interface WalletSelectorSheetProps {
  installedWallets: WalletInfo[];
  allWallets: WalletInfo[];
  onWalletSelect: (wallet: WalletInfo) => void;
  onInstallWallet: (wallet: WalletInfo) => void;
}

export interface WalletSelectorSheetRef {
  open: () => void;
  close: () => void;
}

// ============================================================================
// Component
// ============================================================================

const WalletSelectorSheet = forwardRef<WalletSelectorSheetRef, WalletSelectorSheetProps>(
  function WalletSelectorSheet({ installedWallets, allWallets, onWalletSelect, onInstallWallet }, ref) {
    const bottomSheetRef = React.useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['65%', '85%'], []);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      open: () => bottomSheetRef.current?.expand(),
      close: () => bottomSheetRef.current?.close(),
    }));

    // Backdrop component
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    // Check if wallet is installed
    const isInstalled = (walletId: string): boolean => {
      return installedWallets.some(w => w.id === walletId);
    };

    // Render wallet item
    const renderWalletItem = (wallet: WalletInfo, installed: boolean) => (
      <TouchableOpacity
        key={wallet.id}
        style={[
          styles.walletItem,
          { borderLeftColor: wallet.color },
          !installed && styles.walletItemDisabled,
        ]}
        onPress={() => {
          if (installed) {
            onWalletSelect(wallet);
            bottomSheetRef.current?.close();
          } else {
            onInstallWallet(wallet);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.walletIcon}>
          <Text style={styles.walletEmoji}>{wallet.icon}</Text>
        </View>
        
        <View style={styles.walletInfo}>
          <Text style={styles.walletName}>{wallet.name}</Text>
          {!installed && (
            <Text style={styles.notInstalledText}>Not installed • Tap to install</Text>
          )}
          {installed && (
            <Text style={styles.installedText}>✓ Ready to connect</Text>
          )}
        </View>

        {!installed && (
          <View style={styles.downloadBadge}>
            <Text style={styles.downloadText}>GET</Text>
          </View>
        )}
      </TouchableOpacity>
    );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Connect Wallet</Text>
            <Text style={styles.subtitle}>
              Choose your preferred wallet to connect
            </Text>
          </View>

          {/* Installed Wallets Section */}
          {installedWallets.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Available on your device ({installedWallets.length})
              </Text>
              <ScrollView 
                style={styles.walletList}
                showsVerticalScrollIndicator={false}
              >
                {installedWallets.map(wallet => renderWalletItem(wallet, true))}
              </ScrollView>
            </View>
          )}

          {/* Other Wallets Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {installedWallets.length > 0 ? 'Other Wallets' : 'Get a Wallet'}
            </Text>
            <ScrollView 
              style={styles.walletList}
              showsVerticalScrollIndicator={false}
            >
              {allWallets
                .filter(wallet => !isInstalled(wallet.id))
                .map(wallet => renderWalletItem(wallet, false))}
            </ScrollView>
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              🔒 Secure • Your keys, your crypto
            </Text>
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: '#666',
    width: 40,
    height: 4,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  header: {
    marginBottom: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
  },
  section: {
    marginBottom: 20,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  walletList: {
    flex: 1,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  walletItemDisabled: {
    opacity: 0.6,
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  walletEmoji: {
    fontSize: 28,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  installedText: {
    fontSize: 12,
    color: '#4CAF50',
  },
  notInstalledText: {
    fontSize: 12,
    color: '#999',
  },
  downloadBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  downloadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
});

export default WalletSelectorSheet;
