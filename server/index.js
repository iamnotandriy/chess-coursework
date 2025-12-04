const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const User = require('./models/User');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

mongoose.connect('mongodb://127.0.0.1:27017/chess-master')
  .then(() => console.log('✅ MONGODB CONNECTED'))
  .catch(err => console.error('❌ MONGODB ERROR:', err));

app.use('/api/auth', authRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const games = {}; 
const users = {}; 
const timeouts = {};
const queues = { standard: null, casual: null };

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  if (!userId) { socket.disconnect(); return; }

  console.log(`Connected: ${userId}`);

  // Reconnect
  if (users[userId]) {
    const d = users[userId];
    const roomId = d.roomId;
    if (games[roomId]) {
      if (timeouts[userId]) { clearTimeout(timeouts[userId]); delete timeouts[userId]; }
      
      if (d.lastDisconnect) {
        d.timeLeft -= (Date.now() - d.lastDisconnect);
        d.lastDisconnect = null;
      }

      if (d.timeLeft <= 0) { handleTimeout(userId, roomId); return; }

      socket.join(roomId);
      users[userId].socketId = socket.id;

      socket.emit('game_start', { 
        color: d.color, roomId, 
        fen: games[roomId].fen, history: games[roomId].history,
        mode: games[roomId].mode,
        opponent: games[roomId].players[d.color === 'white' ? 'black' : 'white']
      });
      socket.to(roomId).emit('opponent_reconnected');
    }
  }

  // Matchmaking
  socket.on('find_game', async (data) => {
    const mode = data?.mode || 'standard';
    if (queues[mode] && queues[mode].userId === userId) return;

    if (queues[mode]) {
      const opponent = queues[mode];
      queues[mode] = null;
      const roomId = opponent.userId + '#' + userId;

      const p1Data = await getUserData(opponent.userId);
      const p2Data = await getUserData(userId);

      opponent.socket.join(roomId);
      socket.join(roomId);

      games[roomId] = { 
        white: opponent.userId, black: userId, 
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 
        history: [], mode,
        players: { white: p1Data, black: p2Data }
      };

      users[opponent.userId] = { socketId: opponent.socket.id, roomId, color: 'white', timeLeft: 60000, ...p1Data };
      users[userId] = { socketId: socket.id, roomId, color: 'black', timeLeft: 60000, ...p2Data };

      io.to(opponent.socket.id).emit('game_start', { color: 'white', roomId, opponent: p2Data, mode });
      io.to(socket.id).emit('game_start', { color: 'black', roomId, opponent: p1Data, mode });

    } else {
      queues[mode] = { socket, userId };
      socket.emit('waiting', `Searching ${mode}...`);
    }
  });

  socket.on('make_move', (data) => {
    const game = games[data.roomId];
    if (game) {
      game.fen = data.fen;
      game.history = data.history;
      socket.to(data.roomId).emit('opponent_move', data.move);
    }
  });

  socket.on('cancel_search', () => {
    for (const m in queues) if (queues[m]?.userId === userId) queues[m] = null;
  });

  socket.on('disconnect', () => {
    for (const m in queues) if (queues[m]?.userId === userId) queues[m] = null;

    if (users[userId]) {
      const { roomId } = users[userId];
      if (games[roomId]) {
        socket.to(roomId).emit('opponent_disconnected');
        users[userId].lastDisconnect = Date.now();
        const waitTime = Math.max(0, users[userId].timeLeft);
        timeouts[userId] = setTimeout(() => handleTimeout(userId, roomId), waitTime);
      }
    }
  });
});

async function getUserData(id) {
  if (id.startsWith('guest')) return { id, username: 'Guest', rating: 1200, avatar: '', bio: 'Guest' };
  try {
    const u = await User.findById(id);
    if (!u) return { id, username: 'Unknown', rating: 1200 };
    if (u.isPrivate) {
      return { id: u._id, username: 'Anonymous', rating: u.rating, avatar: '', bio: 'Private', isPrivate: true };
    }
    return { 
      id: u._id, username: u.username, rating: u.rating, 
      avatar: u.avatar, bio: u.bio, 
      wins: u.wins, draws: u.draws || 0, matches: u.matches, highestRating: u.highestRating || u.rating
    };
  } catch (e) { return { username: 'Error', rating: 0 }; }
}

async function handleTimeout(userId, roomId) {
  if (!games[roomId]) return;
  const loserColor = users[userId].color;
  const winnerColor = loserColor === 'white' ? 'black' : 'white';
  const winnerId = games[roomId][winnerColor === 'white' ? 'white' : 'black'];

  io.to(roomId).emit('game_over', { winner: winnerColor, reason: 'Opponent disconnected' });
  if (games[roomId].mode === 'standard') await updateRatings(winnerId, userId);
  delete games[roomId];
  delete users[userId]; 
}

async function updateRatings(winnerId, loserId, draw = false) {
  try {
    if (winnerId.startsWith('guest') || loserId.startsWith('guest')) return;
    const winner = await User.findById(winnerId);
    const loser = await User.findById(loserId);
    if (!winner || !loser) return;

    const K = 32;
    const expectedWinner = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winner.rating - loser.rating) / 400));

    const actualScoreWinner = draw ? 0.5 : 1;
    winner.rating = Math.round(winner.rating + K * (actualScoreWinner - expectedWinner));
    
    const actualScoreLoser = draw ? 0.5 : 0;
    loser.rating = Math.round(loser.rating + K * (actualScoreLoser - expectedLoser));

    // Update Records
    if (winner.rating > (winner.highestRating || 0)) winner.highestRating = winner.rating;
    if (loser.rating > (loser.highestRating || 0)) loser.highestRating = loser.rating;

    winner.matches++; loser.matches++;
    if (draw) {
      winner.draws = (winner.draws || 0) + 1;
      loser.draws = (loser.draws || 0) + 1;
    } else {
      winner.wins++;
    }
    
    await winner.save(); await loser.save();
  } catch (e) { console.error(e); }
}

server.listen(3001, () => console.log('SERVER RUNNING PORT 3001'));