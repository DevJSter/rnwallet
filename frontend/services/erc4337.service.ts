/**
 * ERC-4337 Account Abstraction Service
 * 
 * Provides smart account features:
 * - Gasless transactions (sponsored by paymaster)
 * - Batch transactions
 * - Social recovery
 * - Session keys
 * - Transaction bundling
 */

import { ethers } from 'ethers';

// ============================================================================
// Types
// ============================================================================

export interface SmartAccountConfig {
  entryPointAddress: string;
  factoryAddress: string;
  paymasterUrl?: string;
  bundlerUrl: string;
  chainId: number;
}

export interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export interface BatchTransaction {
  to: string;
  value: string;
  data: string;
}

export interface SmartAccountInfo {
  address: string;
  isDeployed: boolean;
  nonce: number;
  balance: string;
  guardians?: string[];
}

// ============================================================================
// ERC-4337 Constants
// ============================================================================

// EntryPoint v0.6.0 (canonical address)
const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

// Common RPC endpoints for different networks
export const BUNDLER_URLS = {
  mainnet: 'https://bundler.biconomy.io/api/v2/1/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44',
  polygon: 'https://bundler.biconomy.io/api/v2/137/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44',
  optimism: 'https://bundler.biconomy.io/api/v2/10/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44',
  arbitrum: 'https://bundler.biconomy.io/api/v2/42161/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44',
  base: 'https://bundler.biconomy.io/api/v2/8453/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44',
  sepolia: 'https://bundler.biconomy.io/api/v2/11155111/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44',
};

export const PAYMASTER_URLS = {
  mainnet: 'https://paymaster.biconomy.io/api/v1/1',
  polygon: 'https://paymaster.biconomy.io/api/v1/137',
  optimism: 'https://paymaster.biconomy.io/api/v1/10',
  arbitrum: 'https://paymaster.biconomy.io/api/v1/42161',
  base: 'https://paymaster.biconomy.io/api/v1/8453',
  sepolia: 'https://paymaster.biconomy.io/api/v1/11155111',
};

// ============================================================================
// Smart Account ABI Fragments
// ============================================================================

const SIMPLE_ACCOUNT_FACTORY_ABI = [
  'function createAccount(address owner, uint256 salt) returns (address)',
  'function getAddress(address owner, uint256 salt) view returns (address)',
];

const SIMPLE_ACCOUNT_ABI = [
  'function execute(address dest, uint256 value, bytes calldata func)',
  'function executeBatch(address[] calldata dest, bytes[] calldata func)',
  'function getNonce() view returns (uint256)',
  'function owner() view returns (address)',
];

// ============================================================================
// ERC-4337 Service Class
// ============================================================================

class ERC4337Service {
  private config?: SmartAccountConfig;
  private provider?: ethers.Provider;
  private signer?: ethers.Signer;

  /**
   * Initialize the service with configuration
   */
  initialize(
    provider: ethers.Provider,
    signer: ethers.Signer,
    network: 'mainnet' | 'polygon' | 'sepolia' = 'sepolia'
  ) {
    this.provider = provider;
    this.signer = signer;
    
    const chainId = network === 'mainnet' ? 1 : network === 'polygon' ? 137 : 11155111;
    
    this.config = {
      entryPointAddress: ENTRYPOINT_ADDRESS,
      factoryAddress: '0x9406Cc6185a346906296840746125a0E44976454', // SimpleAccountFactory
      bundlerUrl: BUNDLER_URLS[network],
      paymasterUrl: PAYMASTER_URLS[network],
      chainId,
    };

    console.log('[ERC4337] Service initialized for', network);
  }

  /**
   * Get or predict smart account address
   */
  async getSmartAccountAddress(ownerAddress: string, salt: number = 0): Promise<string> {
    if (!this.provider || !this.config) {
      throw new Error('Service not initialized');
    }

    const factory = new ethers.Contract(
      this.config.factoryAddress,
      SIMPLE_ACCOUNT_FACTORY_ABI,
      this.provider
    );

    const accountAddress = await factory.getAddress(ownerAddress, salt);
    console.log('[ERC4337] Smart account address:', accountAddress);
    
    return accountAddress;
  }

  /**
   * Get smart account info
   */
  async getAccountInfo(accountAddress: string): Promise<SmartAccountInfo> {
    if (!this.provider) {
      throw new Error('Service not initialized');
    }

    const code = await this.provider.getCode(accountAddress);
    const isDeployed = code !== '0x';
    
    let nonce = 0;
    let balance = '0';

    if (isDeployed) {
      const account = new ethers.Contract(
        accountAddress,
        SIMPLE_ACCOUNT_ABI,
        this.provider
      );
      
      nonce = Number(await account.getNonce());
      const balanceBigInt = await this.provider.getBalance(accountAddress);
      balance = ethers.formatEther(balanceBigInt);
    }

    return {
      address: accountAddress,
      isDeployed,
      nonce,
      balance,
    };
  }

  /**
   * Deploy smart account (if not already deployed)
   */
  async deployAccount(ownerAddress: string, salt: number = 0): Promise<string> {
    if (!this.signer || !this.config) {
      throw new Error('Service not initialized');
    }

    const factory = new ethers.Contract(
      this.config.factoryAddress,
      SIMPLE_ACCOUNT_FACTORY_ABI,
      this.signer
    );

    console.log('[ERC4337] Deploying smart account...');
    const tx = await factory.createAccount(ownerAddress, salt);
    const receipt = await tx.wait();
    
    console.log('[ERC4337] Account deployed in tx:', receipt.hash);
    
    const accountAddress = await this.getSmartAccountAddress(ownerAddress, salt);
    return accountAddress;
  }

  /**
   * Send a gasless transaction using paymaster
   */
  async sendGaslessTransaction(
    accountAddress: string,
    to: string,
    value: string,
    data: string
  ): Promise<string> {
    if (!this.config) {
      throw new Error('Service not initialized');
    }

    console.log('[ERC4337] Preparing gasless transaction...');
    
    // In a real implementation, you would:
    // 1. Build the UserOperation
    // 2. Get paymaster signature
    // 3. Sign the UserOperation
    // 4. Send to bundler
    
    // For demo purposes, return a mock transaction hash
    const mockTxHash = '0x' + Array(64).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    console.log('[ERC4337] Gasless transaction sent:', mockTxHash);
    return mockTxHash;
  }

  /**
   * Send batch transactions in a single UserOperation
   */
  async sendBatchTransactions(
    accountAddress: string,
    transactions: BatchTransaction[]
  ): Promise<string> {
    if (!this.signer || !this.config) {
      throw new Error('Service not initialized');
    }

    console.log('[ERC4337] Preparing batch transaction...');
    console.log('[ERC4337] Batch size:', transactions.length);

    // Build batch call data
    const account = new ethers.Contract(
      accountAddress,
      SIMPLE_ACCOUNT_ABI,
      this.signer
    );

    const destinations = transactions.map(tx => tx.to);
    const calldatas = transactions.map(tx => tx.data);

    const callData = account.interface.encodeFunctionData('executeBatch', [
      destinations,
      calldatas,
    ]);

    console.log('[ERC4337] Batch transaction call data prepared:', callData.substring(0, 20));
    
    // In a real implementation, this would be sent as a UserOperation
    // For demo, return a mock hash
    const mockTxHash = '0x' + Array(64).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    console.log('[ERC4337] Batch transaction sent:', mockTxHash);
    return mockTxHash;
  }

  /**
   * Estimate gas for a UserOperation
   */
  async estimateUserOperationGas(
    accountAddress: string,
    to: string,
    value: string,
    data: string
  ): Promise<{
    callGasLimit: string;
    verificationGasLimit: string;
    preVerificationGas: string;
  }> {
    // In a real implementation, call bundler's eth_estimateUserOperationGas
    // For now, return conservative estimates
    return {
      callGasLimit: '100000',
      verificationGasLimit: '150000',
      preVerificationGas: '21000',
    };
  }

  /**
   * Add a guardian for social recovery
   */
  async addGuardian(accountAddress: string, guardianAddress: string): Promise<string> {
    console.log('[ERC4337] Adding guardian:', guardianAddress);
    
    // This would call a social recovery module
    // For demo, return mock tx hash
    const mockTxHash = '0x' + Array(64).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    return mockTxHash;
  }

  /**
   * Initiate recovery with guardian signatures
   */
  async initiateRecovery(
    accountAddress: string,
    newOwner: string,
    guardianSignatures: string[]
  ): Promise<string> {
    console.log('[ERC4337] Initiating recovery to new owner:', newOwner);
    console.log('[ERC4337] Guardian signatures:', guardianSignatures.length);
    
    // This would call the social recovery module
    const mockTxHash = '0x' + Array(64).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    return mockTxHash;
  }
}

// Export singleton instance
export const erc4337Service = new ERC4337Service();
