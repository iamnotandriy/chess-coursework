<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import io from 'socket.io-client';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const socket = io('http://localhost:3001');
const game = new Chess();

const status = ref('Welcome');
const isSearching = ref(false);
const myColor = ref(null);
const currentRoom = ref(null);
const boardData = ref(game.board());

const gameOver = ref(false);
const gameResult = ref('');
const winner = ref(null);

const leaveGame = () => {
  socket.disconnect();
  router.push('/');
};

// --- SEARCH FUNCTIONS ---
const findGame = () => {
  if (isSearching.value) return;
  isSearching.value = true;
  status.value = "Searching for opponent...";
  socket.emit('find_game');
};

const cancelSearch = () => {
  isSearching.value = false;
  status.value = "Search canceled";
  socket.emit('cancel_search');
};
// -----------------------

const checkGameOver = () => {
  if (game.isGameOver()) {
    gameOver.value = true;
    if (game.isCheckmate()) {
      const loser = game.turn() === 'w' ? 'White' : 'Black';
      const winColor = game.turn() === 'w' ? 'black' : 'white';
      gameResult.value = `Checkmate! ${loser} is defeated.`;
      winner.value = winColor;
    } else if (game.isDraw()) {
      gameResult.value = 'Draw!';
      winner.value = 'draw';
    } else {
      gameResult.value = 'Game Over';
    }
  }
};

onMounted(() => {
  socket.on('connect', () => { status.value = 'Connected to server'; });
  
  socket.on('game_start', (data) => {
    isSearching.value = false;
    status.value = `Playing as ${data.color}`;
    myColor.value = data.color;
    currentRoom.value = data.roomId;
    
    game.reset();
    gameOver.value = false;
    winner.value = null;
    updateBoard();
  });

  socket.on('opponent_move', (move) => {
    game.move(move);
    updateBoard();
    checkGameOver();
  });
});

onUnmounted(() => {
  socket.disconnect();
});

const updateBoard = () => {
  boardData.value = game.board();
};

const handleMove = ({ from, to }) => {
  if (game.turn() !== myColor.value.charAt(0)) return; 
  if (gameOver.value) return;

  try {
    const moveResult = game.move({ from, to, promotion: 'q' });
    if (moveResult) {
      socket.emit('make_move', { roomId: currentRoom.value, move: moveResult });
      updateBoard();
      checkGameOver();
    }
  } catch (e) {}
};
</script>

<template>
  <div class="main-wrapper">
    
    <nav class="navbar">
      <button class="nav-btn back-btn" @click="leaveGame">
        <span class="icon">❮</span> Back
      </button>
      <div class="logo">CHESS <span class="accent">PLUS</span></div>
      <div class="status-indicator" :class="{ 'online': status !== 'Disconnected' }"></div>
    </nav>

    <Transition name="fade">
      <div v-if="gameOver" class="overlay">
        <div class="modal result-modal">
          <h2>GAME OVER</h2>
          <p class="result-message">{{ gameResult }}</p>
          <div class="winner-icon">
            <span v-if="winner === myColor">🏆 VICTORY</span>
            <span v-else-if="winner === 'draw'">🤝 DRAW</span>
            <span v-else>💀 DEFEAT</span>
          </div>
          <button class="primary-btn" @click="findGame">Find New Game</button>
          <button class="secondary-btn" @click="leaveGame">Exit to Menu</button>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="!currentRoom" class="center-container">
        <div class="lobby-card">
          <h2>Ready to Play?</h2>
          <p class="status-text">{{ status }}</p>
          
          <div v-if="isSearching" class="loader"></div>
          
          <div class="button-group">
            <button 
              v-if="!isSearching"
              class="primary-btn big-btn" 
              @click="findGame"
            >
              Find Match
            </button>
            
            <button 
              v-else 
              class="cancel-btn big-btn" 
              @click="cancelSearch"
            >
              Cancel Search
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="currentRoom" class="game-layout">
        <div class="player-bar top">
          <div class="avatar opponent-avatar"></div>
          <div class="player-info">
            <span class="name">Opponent</span>
            <span class="rating">Rating: ???</span>
          </div>
        </div>

        <div class="board-wrapper">
          <ChessBoard 
            :board="boardData" 
            :flipped="myColor === 'black'" 
            @move="handleMove"
          />
        </div>

        <div class="player-bar bottom">
          <div class="avatar my-avatar"></div>
          <div class="player-info">
            <span class="name">You ({{ myColor }})</span>
            <span class="rating">Rating: 1200</span>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* global alignment for full screen */
.main-wrapper {
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at top, #2b303b 0%, #101014 100%);
  color: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.navbar {
  flex: 0 0 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.logo { font-weight: bold; font-size: 1.2rem; letter-spacing: 2px; }
.accent { color: #42b883; }

/* Centering for Lobby */
.center-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.game-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 10px;
  gap: 15px; /* smaller gap for smaller screens */
}

/* Button styles */
.primary-btn, .cancel-btn {
  border: none; padding: 12px 30px; font-weight: bold; cursor: pointer; border-radius: 6px; text-transform: uppercase; font-size: 1rem; transition: all 0.2s;
  width: 100%; /* Кнопки на всю ширину картки */
}
.primary-btn { background: #42b883; color: #000; }
.primary-btn:hover { background: #3aa876; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(66, 184, 131, 0.4); }

.cancel-btn { background: #e74c3c; color: white; }
.cancel-btn:hover { background: #c0392b; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(231, 76, 60, 0.4); }

.nav-btn { background: none; border: none; color: #aaa; cursor: pointer; font-size: 1rem; }
.secondary-btn { background: transparent; border: 1px solid #555; color: #ddd; margin-left: 10px; padding: 10px 20px; border-radius: 6px; cursor: pointer; }

/* lobby card */
.lobby-card {
  background: rgba(30, 30, 35, 0.8);
  padding: 40px;
  border-radius: 20px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  min-width: 320px;
}

.loader {
  border: 3px solid rgba(255,255,255,0.1);
  border-top: 3px solid #42b883;
  border-radius: 50%; width: 30px; height: 30px;
  animation: spin 1s linear infinite; margin: 0 auto 20px auto;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.board-wrapper {
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
  border-radius: 4px;
}
.player-bar {
  display: flex; align-items: center; width: 100%; max-width: 500px;
  gap: 15px; background: rgba(0,0,0,0.3); padding: 8px 15px; border-radius: 10px;
}
.avatar { width: 35px; height: 35px; border-radius: 50%; background: #555; }
.opponent-avatar { background: #e74c3c; }
.my-avatar { background: #42b883; }
.player-info { display: flex; flex-direction: column; }
.name { font-weight: bold; font-size: 0.9rem; }
.rating { font-size: 0.75rem; color: #aaa; }
.status-indicator { width: 8px; height: 8px; background: red; border-radius: 50%; }
.status-indicator.online { background: #42b883; box-shadow: 0 0 10px #42b883; }

.overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(5px); z-index: 999;
}
.result-modal {
  background: #1e1e24; border: 1px solid #333; padding: 40px; border-radius: 15px; text-align: center;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>