/**
 * DApp Features Service
 * 
 * Provides typical dApp functionality:
 * - Token balance queries (ETH, ERC20)
 * - Send transactions
 * - Contract interactions
 * - Transaction history
 * - ENS resolution
 */

import { ethers } from 'ethers';

// ============================================================================
// Types
// ============================================================================

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  address?: string; // undefined for native token
  value?: string; // USD value if available
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  type: 'send' | 'receive' | 'contract';
}

export interface ContractCallParams {
  contractAddress: string;
  abi: string[];
  method: string;
  params: any[];
  value?: string;
}

// ============================================================================
// Common ERC20 ABI
// ============================================================================

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

// ============================================================================
// Popular Tokens (for quick testing)
// ============================================================================

export const POPULAR_TOKENS = {
  mainnet: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
    { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  ],
  polygon: [
    { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
    { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18 },
  ],
  sepolia: [
    { symbol: 'USDC', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
  ],
};

// ============================================================================
// DApp Features Service Class
// ============================================================================

class DAppFeaturesService {
  private provider?: ethers.Provider;
  private signer?: ethers.Signer;
  private userAddress?: string;

  /**
   * Initialize the service
   */
  initialize(provider: ethers.Provider, signer: ethers.Signer, userAddress: string) {
    this.provider = provider;
    this.signer = signer;
    this.userAddress = userAddress;
    console.log('[DAppFeatures] Service initialized for address:', userAddress);
  }

  /**
   * Get ETH balance
   */
  async getEthBalance(address?: string): Promise<TokenBalance> {
    if (!this.provider) {
      throw new Error('Service not initialized');
    }

    const targetAddress = address || this.userAddress;
    if (!targetAddress) {
      throw new Error('No address provided');
    }

    const balance = await this.provider.getBalance(targetAddress);
    const formatted = ethers.formatEther(balance);

    return {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: formatted,
      decimals: 18,
    };
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(tokenAddress: string, userAddress?: string): Promise<TokenBalance> {
    if (!this.provider) {
      throw new Error('Service not initialized');
    }

    const targetAddress = userAddress || this.userAddress;
    if (!targetAddress) {
      throw new Error('No address provided');
    }

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

    try {
      const [symbol, name, decimals, balance] = await Promise.all([
        contract.symbol(),
        contract.name(),
        contract.decimals(),
        contract.balanceOf(targetAddress),
      ]);

      const formatted = ethers.formatUnits(balance, decimals);

      return {
        symbol,
        name,
        balance: formatted,
        decimals,
        address: tokenAddress,
      };
    } catch (error) {
      console.error('[DAppFeatures] Error fetching token balance:', error);
      throw error;
    }
  }

  /**
   * Get all token balances (ETH + popular ERC20s)
   */
  async getAllBalances(network: 'mainnet' | 'polygon' | 'sepolia' = 'sepolia'): Promise<TokenBalance[]> {
    if (!this.provider || !this.userAddress) {
      throw new Error('Service not initialized');
    }

    const balances: TokenBalance[] = [];

    // Get ETH balance
    try {
      const ethBalance = await this.getEthBalance();
      balances.push(ethBalance);
    } catch (error) {
      console.error('[DAppFeatures] Error fetching ETH balance:', error);
    }

    // Get token balances
    const tokens = POPULAR_TOKENS[network] || [];
    
    for (const token of tokens) {
      try {
        const balance = await this.getTokenBalance(token.address);
        // Only include tokens with non-zero balance
        if (parseFloat(balance.balance) > 0) {
          balances.push(balance);
        }
      } catch (error) {
        console.error(`[DAppFeatures] Error fetching ${token.symbol} balance:`, error);
      }
    }

    return balances;
  }

  /**
   * Send ETH
   */
  async sendEth(to: string, amount: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Service not initialized');
    }

    console.log('[DAppFeatures] Sending ETH:', { to, amount });

    const tx = await this.signer.sendTransaction({
      to,
      value: ethers.parseEther(amount),
    });

    console.log('[DAppFeatures] Transaction sent:', tx.hash);
    await tx.wait();
    console.log('[DAppFeatures] Transaction confirmed');

    return tx.hash;
  }

  /**
   * Send ERC20 token
   */
  async sendToken(tokenAddress: string, to: string, amount: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Service not initialized');
    }

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    const decimals = await contract.decimals();
    const parsedAmount = ethers.parseUnits(amount, decimals);

    console.log('[DAppFeatures] Sending token:', { tokenAddress, to, amount });

    const tx = await contract.transfer(to, parsedAmount);
    console.log('[DAppFeatures] Transaction sent:', tx.hash);
    
    await tx.wait();
    console.log('[DAppFeatures] Transaction confirmed');

    return tx.hash;
  }

  /**
   * Call a smart contract method
   */
  async callContract(params: ContractCallParams): Promise<any> {
    if (!this.provider) {
      throw new Error('Service not initialized');
    }

    const contract = new ethers.Contract(
      params.contractAddress,
      params.abi,
      this.provider
    );

    console.log('[DAppFeatures] Calling contract method:', params.method);

    try {
      const result = await contract[params.method](...params.params);
      console.log('[DAppFeatures] Contract call result:', result);
      return result;
    } catch (error) {
      console.error('[DAppFeatures] Contract call error:', error);
      throw error;
    }
  }

  /**
   * Send a contract transaction
   */
  async sendContractTransaction(params: ContractCallParams): Promise<string> {
    if (!this.signer) {
      throw new Error('Service not initialized');
    }

    const contract = new ethers.Contract(
      params.contractAddress,
      params.abi,
      this.signer
    );

    console.log('[DAppFeatures] Sending contract transaction:', params.method);

    const options: any = {};
    if (params.value) {
      options.value = ethers.parseEther(params.value);
    }

    try {
      const tx = await contract[params.method](...params.params, options);
      console.log('[DAppFeatures] Transaction sent:', tx.hash);
      
      await tx.wait();
      console.log('[DAppFeatures] Transaction confirmed');
      
      return tx.hash;
    } catch (error) {
      console.error('[DAppFeatures] Transaction error:', error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<Transaction | null> {
    if (!this.provider) {
      throw new Error('Service not initialized');
    }

    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return null;

      const receipt = await this.provider.getTransactionReceipt(txHash);
      const block = tx.blockNumber ? await this.provider.getBlock(tx.blockNumber) : null;

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: ethers.formatEther(tx.value),
        timestamp: block?.timestamp || Date.now() / 1000,
        status: receipt ? (receipt.status === 1 ? 'confirmed' : 'failed') : 'pending',
        blockNumber: tx.blockNumber || undefined,
        gasUsed: receipt?.gasUsed.toString(),
        type: 'send', // Simplified
      };
    } catch (error) {
      console.error('[DAppFeatures] Error fetching transaction:', error);
      return null;
    }
  }

  /**
   * Resolve ENS name to address
   */
  async resolveENS(ensName: string): Promise<string | null> {
    if (!this.provider) {
      throw new Error('Service not initialized');
    }

    try {
      const address = await this.provider.resolveName(ensName);
      console.log('[DAppFeatures] ENS resolved:', { ensName, address });
      return address;
    } catch (error) {
      console.error('[DAppFeatures] ENS resolution error:', error);
      return null;
    }
  }

  /**
   * Lookup address to ENS name
   */
  async lookupAddress(address: string): Promise<string | null> {
    if (!this.provider) {
      throw new Error('Service not initialized');
    }

    try {
      const ensName = await this.provider.lookupAddress(address);
      console.log('[DAppFeatures] Address lookup:', { address, ensName });
      return ensName;
    } catch (error) {
      console.error('[DAppFeatures] Address lookup error:', error);
      return null;
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Service not initialized');
    }

    console.log('[DAppFeatures] Signing message...');
    const signature = await this.signer.signMessage(message);
    console.log('[DAppFeatures] Message signed');
    
    return signature;
  }

  /**
   * Verify a signature
   */
  verifySignature(message: string, signature: string): string {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    console.log('[DAppFeatures] Signature verified:', recoveredAddress);
    return recoveredAddress;
  }
}

// Export singleton instance
export const dappFeaturesService = new DAppFeaturesService();
