import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth';
import txRoutes from './routes/tx';

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`\n[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path}`);
  console.log(`  Headers:`, JSON.stringify(req.headers, null, 2));
  if (Object.keys(req.body || {}).length > 0) {
    console.log(`  Body:`, JSON.stringify(req.body, null, 2));
  }
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${requestId}] Response: ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api', authRoutes);
app.use('/api', txRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
}); 

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`\n🔌 [SOCKET] New client connected: ${socket.id}`);
  console.log(`  Transport: ${socket.conn.transport.name}`);
  console.log(`  Auth data:`, socket.handshake.auth);
  
  // Client joins a session room
  socket.on('join', async (sessionId: string) => {
    console.log(`📥 [SOCKET] Client ${socket.id} joining session room: ${sessionId}`);
    await socket.join(sessionId);
    
    // Verify the join
    const socketsInRoom = await io.in(sessionId).allSockets();
    console.log(`✅ [SOCKET] Client joined room: ${sessionId}`);
    console.log(`  Total clients in room: ${socketsInRoom.size}`);
    console.log(`  Socket IDs:`, Array.from(socketsInRoom));
    
    // Send confirmation back to the client
    socket.emit('joined', { sessionId, socketId: socket.id });
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 [SOCKET] Client disconnected: ${socket.id}`);
    console.log(`  Reason: ${reason}`);
  });
  
  socket.on('error', (error) => {
    console.error(`❌ [SOCKET] Socket error for ${socket.id}:`, error);
  });
});

server.listen(PORT, () => {
  console.log('\n===========================================');
  console.log('🚀 Server Started Successfully');
  console.log('===========================================');
  console.log(`📡 HTTP Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO Server ready`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('===========================================\n');
});
