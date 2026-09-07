require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\x1b[32m%s\x1b[0m', '✓ MongoDB Atlas connected');
  } catch (err) {
    console.log('\x1b[33m%s\x1b[0m', '⚠ Atlas unavailable (' + err.message + ') — starting local in-memory MongoDB...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    console.log('\x1b[33m%s\x1b[0m', '⚠ In-memory MongoDB connected (data will NOT persist across restarts)');
  }
}
connectDB();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));

// Expose Google Client ID to the frontend
app.get('/api/config/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

/* ---------- Socket.io real-time ---------- */
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('register', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));
  });

  socket.on('sendMessage', async (data) => {
    const { senderId, receiverId, content } = data;
    const Message = require('./models/Message');
    const msg = await Message.create({ sender: senderId, receiver: receiverId, content });
    const populated = await msg.populate('sender', 'name avatar');

    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) io.to(receiverSocket).emit('newMessage', populated);
    socket.emit('newMessage', populated);
  });

  socket.on('typing', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) io.to(receiverSocket).emit('userTyping', { userId: data.senderId });
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) { onlineUsers.delete(userId); break; }
    }
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));
  });
});

/* ---------- Catch-all → index.html ---------- */
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`CollabX running → http://localhost:${PORT}`));
