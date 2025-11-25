const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

let waitingPlayer = null;

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('find_game', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      return; 
    }

    if (waitingPlayer) {
      const roomID = waitingPlayer.id + '#' + socket.id;
      socket.join(roomID);
      waitingPlayer.join(roomID);

      io.to(waitingPlayer.id).emit('game_start', { color: 'white', roomId: roomID });
      io.to(socket.id).emit('game_start', { color: 'black', roomId: roomID });
      
      console.log(`Game started in room: ${roomID}`);
      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
      socket.emit('waiting', 'Searching for opponent...');
    }
  });

  socket.on('make_move', (data) => {
    socket.to(data.roomId).emit('opponent_move', data.move);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    if (waitingPlayer === socket) waitingPlayer = null;
  });
});

server.listen(3001, () => {
  console.log('SERVER IS RUNNING ON PORT 3001');
});