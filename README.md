# Ethereum Wallet Project

Complete Ethereum wallet authentication and transaction system with React Native frontend and Node.js backend.

## Project Structure

```
walllet/
├── server/              # Node.js + TypeScript backend
│   ├── src/
│   │   ├── index.ts     # Express server
│   │   └── routes/
│   │       ├── auth.ts  # Authentication endpoints
│   │       └── tx.ts    # Transaction endpoints
│   ├── public/
│   │   └── index.html   # DApp web page
│   └── package.json
├── frontend/            # React Native + Expo app
│   ├── app/
│   │   └── (tabs)/
│   │       └── index.tsx
│   ├── components/
│   │   └── WalletWebView.tsx
│   └── package.json
└── build.md            # Implementation plan
```

## Quick Start

### 1. Setup Backend

```bash
cd server
npm install
npm run dev
```

The backend will start on `http://localhost:3000`

**Configuration:**
- Create a `.env` file in the server directory:
```
PORT=3000
INFURA_PROJECT_ID=your_infura_project_id
NETWORK=goerli
```

### 2. Setup Frontend

```bash
cd frontend
npm install
npm start
```

Choose your platform:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web browser

**Configuration:**
- Update `BACKEND_URL` in `frontend/app/(tabs)/index.tsx` to match your backend URL

## Features

### Backend (Node.js)
- **Authentication API**: Generate nonces and verify Ethereum signatures
- **Transaction API**: Create and broadcast Ethereum transactions
- **DApp Page**: Web page with wallet integration using ethers.js

### Frontend (React Native)
- **Wallet Connection**: Connect via embedded WebView or MetaMask deep link
- **Message Signing**: Sign authentication messages
- **Transaction Sending**: Send Ethereum transactions
- **Real-time Updates**: Bidirectional messaging between WebView and React Native

## API Endpoints

### Authentication
- `GET /api/nonce` - Generate authentication nonce
- `POST /api/verify` - Verify signed message

### Transactions
- `POST /api/createTx` - Create transaction object
- `POST /api/broadcast` - Broadcast signed transaction
- `GET /api/tx/:hash` - Get transaction details

## How It Works

1. **Connect Wallet**: User opens the app and chooses to connect wallet
2. **Load DApp**: WebView loads the DApp page from backend
3. **Request Accounts**: DApp uses `window.ethereum.request({method: 'eth_requestAccounts'})`
4. **Get Nonce**: Backend generates a unique nonce
5. **Sign Message**: Wallet signs the nonce message
6. **Verify**: Backend verifies the signature using ethers.js
7. **Authenticated**: User can now send transactions

## Security Features

- **Nonce-based Authentication**: Prevents replay attacks
- **Client-side Signing**: Private keys never leave the wallet
- **Backend Verification**: Cryptographic signature verification
- **Session Management**: Nonces expire after use

## MetaMask Deep Linking

For MetaMask mobile integration:
```
https://metamask.app.link/dapp/{YOUR_DAPP_URL}
```

Other wallets (Trust Wallet, Rainbow, etc.) support similar schemes.

## Technologies Used

### Backend
- **Node.js + TypeScript**: Server runtime and type safety
- **Express**: HTTP server framework
- **ethers.js**: Ethereum library for signing and transactions
- **CORS**: Cross-origin resource sharing

### Frontend
- **React Native**: Mobile app framework
- **Expo**: React Native toolchain
- **react-native-webview**: WebView component
- **TypeScript**: Type safety

### DApp
- **ethers.js**: Browser Ethereum library
- **window.ethereum**: Wallet provider injection
- **HTML/CSS/JavaScript**: Web technologies

## Development

### Backend Development
```bash
cd server
npm run dev  # Watch mode with ts-node
```

### Frontend Development
```bash
cd frontend
npm start    # Start Expo dev server
```

### Building for Production

#### Backend
```bash
cd server
npm run build  # Compile TypeScript
npm start      # Run production server
```

#### Frontend
```bash
cd frontend
# iOS
eas build --platform ios

# Android
eas build --platform android
```

## Testing

1. **Local Testing**: Run backend and frontend locally
2. **MetaMask Mobile**: Test with MetaMask mobile app
3. **Test Networks**: Use Goerli, Sepolia, or other test networks
4. **Get Test ETH**: Use faucets to get test Ether

## Troubleshooting

### Common Issues

1. **SSL_PROTOCOL_ERROR in MetaMask Mobile**: MetaMask requires HTTPS. See [HTTPS Setup Guide](./HTTPS_SETUP.md)
   - **Quick Fix**: Use ngrok to create HTTPS tunnel
   - Run: `./start-https.sh` or `ngrok http 3000`
   - Update `BACKEND_URL` in frontend with the ngrok HTTPS URL

2. **CORS Errors**: Ensure backend has CORS enabled
3. **Network Errors**: Check that backend URL is correct in frontend
4. **Wallet Not Found in Embedded Browser**: Use "Open in MetaMask Browser" button instead
5. **Transaction Failures**: Ensure you have enough ETH for gas fees

### MetaMask Mobile Setup

For MetaMask mobile to work, you **must use HTTPS**. For local development:

```bash
# Terminal 1: Start backend
cd server && npm run dev

# Terminal 2: Create HTTPS tunnel
./start-https.sh
# Or manually: ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update BACKEND_URL in frontend/app/(tabs)/index.tsx
```

See [HTTPS_SETUP.md](./HTTPS_SETUP.md) for detailed instructions.

## Next Steps

- [ ] Add user session management
- [ ] Implement transaction history
- [ ] Add support for ERC-20 tokens
- [ ] Implement multi-signature transactions
- [ ] Add biometric authentication
- [ ] Deploy to production

## Resources

- [MetaMask Documentation](https://docs.metamask.io/)
- [ethers.js Documentation](https://docs.ethers.org/)
- [React Native WebView](https://github.com/react-native-webview/react-native-webview)
- [Expo Documentation](https://docs.expo.dev/)

## License

MIT
