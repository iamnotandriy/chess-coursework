<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import io from 'socket.io-client';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard.vue';
import { useRoute, useRouter } from 'vue-router';
import authService from '../services/auth';

const router = useRouter();
const route = useRoute();
const game = new Chess();

// auto-detect server URL
const SERVER_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001' 
  : 'https://chess-api-18o3.onrender.com';

const getUserId = () => {
  const user = authService.getUser();
  if (user && user.id) return user.id;
  let id = sessionStorage.getItem('chess_userId');
  if (!id) { 
    id = 'guest_' + Math.random().toString(36).substr(2, 9); 
    sessionStorage.setItem('chess_userId', id); 
  }
  return id;
};
const userId = getUserId();

// 
const socket = io(SERVER_URL, { 
  query: { userId: userId },
  transports: ['websocket', 'polling'],
  withCredentials: true
});

const status = ref('Welcome');
const isSearching = ref(false);
const myColor = ref(null);
const currentRoom = ref(null);
const boardData = ref(game.board());
const validMoves = ref([]);
const opponentDisconnected = ref(false);
const currentTurnColor = ref('w');
const gameMode = ref('standard');

// player data
const opponentInfo = ref({ username: 'Opponent', rating: '???', avatar: '', id: null, rank: null, wins: 0, matches: 0 });
const currentUserInfo = ref({ username: 'You', rating: 1200, avatar: '', rank: null, wins: 0, matches: 0 });

const mineState = ref({}); 

// UI states
const showSettings = ref(false);
const showOpponentProfile = ref(false);
const opponentProfileData = ref(null);

const isMyTurn = computed(() => myColor.value && currentTurnColor.value === myColor.value.charAt(0));
const canViewProfile = computed(() => opponentInfo.value.username !== 'Anonymous' && opponentInfo.value.id);

const pieceNames = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
const getMoveDesc = (move) => {
  const piece = pieceNames[move.piece];
  const action = move.flags.includes('c') ? 'takes' : 'to';
  const check = move.san.includes('+') ? '(Check)' : '';
  const mate = move.san.includes('#') ? '(Mate)' : '';
  if (move.flags.includes('k') || move.flags.includes('q')) return 'Castling';
  return `${piece} ${action} ${move.to} ${check}${mate}`;
};

const rawHistory = ref([]);
const formattedHistory = computed(() => {
  const h = rawHistory.value;
  const p = [];
  for (let i = 0; i < h.length; i += 2) {
    p.push({ 
      num: (i/2)+1, 
      white: getMoveDesc(h[i]), 
      black: h[i+1] ? getMoveDesc(h[i+1]) : '' 
    });
  }
  return p;
});

const boardScale = ref(80);
const useGlassEffects = ref(true);
const themes = [{id:'default',name:'MINT'},{id:'blue',name:'CYBER'},{id:'gold',name:'GOLD'}];
const currentTheme = ref('default');

// Helpers
const getRankClass = (rank) => {
  if (rank === 1) return 'rank-gold';
  if (rank === 2) return 'rank-silver';
  if (rank === 3) return 'rank-bronze';
  if (rank <= 100) return 'rank-elite';
  return '';
};

onMounted(async () => {
  // 
  const myStats = await authService.getLatestStats();
  if (myStats) {
    currentUserInfo.value = { 
      username: myStats.username, 
      rating: myStats.rating, 
      avatar: myStats.avatar, 
      rank: myStats.rank,
      wins: myStats.wins,
      matches: myStats.matches
    };
  }
  
  const t = localStorage.getItem('chess_theme');
  const s = localStorage.getItem('chess_scale');
  const g = localStorage.getItem('chess_glass');
  if(t) setTheme(t);
  if(s) boardScale.value = parseInt(s);
  if(g !== null) { useGlassEffects.value = g === 'true'; applyGlassEffect(); }
});

const setTheme = (t) => { currentTheme.value = t; document.documentElement.setAttribute('data-theme', t); localStorage.setItem('chess_theme', t); };
const updateScale = (v) => { boardScale.value = v; localStorage.setItem('chess_scale', v); };
const toggleGlass = (v) => { useGlassEffects.value = v; localStorage.setItem('chess_glass', v); applyGlassEffect(); };
const applyGlassEffect = () => document.body.classList.toggle('no-glass', !useGlassEffects.value);

// actions
const viewOpponent = async () => {
  if (!canViewProfile.value) return;
  try {
    const data = await authService.getPublicProfile(opponentInfo.value.id);
    opponentProfileData.value = data;
    showOpponentProfile.value = true;
  } catch (e) { console.error(e); }
};

const gameOver = ref(false);
const gameResult = ref('');
const winner = ref(null);

const leaveGame = () => { socket.disconnect(); router.push('/'); };

const findGame = () => { 
  if(isSearching.value) return; 
  isSearching.value = true; 
  const mode = route.query.mode || 'standard';
  status.value = `SEARCHING (${mode.toUpperCase()})...`; 
  socket.emit('find_game', { mode: mode }); 
};

const cancelSearch = () => { isSearching.value = false; status.value = "CANCELED"; socket.emit('cancel_search'); };

const updateGameState = () => {
  boardData.value = game.board();
  rawHistory.value = game.history({ verbose: true });
  currentTurnColor.value = game.turn();
  
  if (game.isGameOver()) {
    gameOver.value = true;
    if (game.isCheckmate()) { 
      const l = game.turn()==='w'?'White':'Black'; 
      gameResult.value=`CHECKMATE! ${l.toUpperCase()} LOST`; 
      winner.value = game.turn()==='w'?'black':'white'; 
    }
    else if (game.isDraw()) { gameResult.value='DRAW'; winner.value='draw'; }
    else { gameResult.value='GAME OVER'; }
  }
  
  setTimeout(() => { 
    const el = document.getElementById('move-log'); 
    if(el) el.scrollTop = el.scrollHeight; 
  }, 10);
};

// core handlers
const handleSelect = (sq) => {
  if(!sq) { validMoves.value=[]; return; }
  const p = game.get(sq);
  if(p && p.color !== myColor.value.charAt(0)) { validMoves.value=[]; return; }
  validMoves.value = game.moves({ square: sq, verbose: true }).map(m => m.to);
};

const handleMove = ({ from, to }) => {
  if(game.turn() !== myColor.value.charAt(0) || gameOver.value) return;
  try {
    const res = game.move({ from, to, promotion: 'q' });
    if(res) {
      socket.emit('make_move', { 
        roomId: currentRoom.value, 
        move: res, 
        fen: game.fen(), 
        history: game.history({verbose:true}) 
      });
      validMoves.value = [];

      if (gameMode.value !== 'minesweeper') updateGameState();
    }
  } catch(e){}
};

const handleMoveResult = (data) => {
  if (data.move) { try { game.move(data.move); } catch (e) {} }
  
  if (data.explosion) {
    game.remove(data.explosion);
    mineState.value[data.explosion] = { type: 'exploded' };
    
    socket.emit('sync_fen', { roomId: currentRoom.value, fen: game.fen() });
  }
  
  if (data.reveal) {
    mineState.value[data.reveal.square] = { type: 'safe', count: data.reveal.count };
  }
  
  updateGameState();
};

onMounted(() => {
  socket.on('connect', () => status.value = 'CONNECTED');
  
  socket.on('game_start', (data) => {
    isSearching.value = false;
    status.value = `PLAYING AS ${data.color.toUpperCase()}`;
    myColor.value = data.color;
    currentRoom.value = data.roomId;
    
    if(data.opponent) {
        opponentInfo.value = { 
            ...data.opponent,
            wins: data.opponent.wins || 0,
            matches: data.opponent.matches || 0
        };
        if (data.opponent.id && !data.opponent.isPrivate && !data.opponent.rank) {
            authService.getPublicProfile(data.opponent.id).then(p => { 
                opponentInfo.value.rank = p.rank;
                opponentInfo.value.wins = p.wins;
                opponentInfo.value.matches = p.matches;
            });
        }
    }
    if(data.mode) gameMode.value = data.mode;
    
    mineState.value = {}; 
    if (data.initialHints) {
      for (const [sq, count] of Object.entries(data.initialHints)) {
        mineState.value[sq] = { type: 'safe', count: count };
      }
    }
    
    if(data.fen) { game.load(data.fen); rawHistory.value = data.history || []; } 
    else { game.reset(); rawHistory.value = []; }
    
    gameOver.value = false; winner.value = null; opponentDisconnected.value = false; 
    updateGameState();
  });

  socket.on('move_result', handleMoveResult);
  
  socket.on('opponent_move', (data) => { 
      if (!data.explosion && !data.reveal) handleMoveResult({move: data.move || data}); 
  });

  socket.on('mine_hit', (data) => {
    game.remove(data.square);
    mineState.value[data.square] = { type: 'exploded' };
    socket.emit('sync_fen', { roomId: currentRoom.value, fen: game.fen() });
    updateGameState();
  });

  socket.on('opponent_disconnected', () => opponentDisconnected.value = true);
  socket.on('opponent_reconnected', () => opponentDisconnected.value = false);
  socket.on('game_over', (d) => { 
    gameOver.value=true; 
    if(d.reason==='Opponent disconnected'){ 
      gameResult.value='OPPONENT TIMED OUT'; 
      winner.value=myColor.value; 
    } 
  });
  
  // auto-start search if needed
  if (route.query.auto === 'true') {
     findGame();
  }
});
onUnmounted(() => socket.disconnect());
</script>

<template>
  <div class="layout">
    <div class="liquid-background"><div class="blob blob-1"></div><div class="blob blob-2"></div><div class="blob blob-3"></div></div>
    
    <header class="navbar glass-panel">
      <div class="logo">CHESS <span class="accent-text">PLUS</span> <span v-if="gameMode!=='standard'" class="mode-tag">{{gameMode.toUpperCase()}}</span></div>
      <div class="actions">
        <button class="btn-icon" @click="showSettings=true"><span>⚙️</span></button>
        <button class="btn btn-danger" @click="leaveGame"><span>EXIT</span></button>
      </div>
    </header>

    <Transition name="fade"><div v-if="showSettings" class="settings-overlay" @click.self="showSettings=false">
      <div class="settings-modal glass-panel">
        <div class="modal-header"><h3>SETTINGS</h3><button class="btn-icon close-s" @click="showSettings=false"><span>✕</span></button></div>
        <div class="setting-row"><label>Glass Effects</label><label class="switch"><input type="checkbox" :checked="useGlassEffects" @change="toggleGlass($event.target.checked)"><span class="slider"></span></label></div>
        <div class="setting-group"><label>Size: {{boardScale}}%</label><input type="range" min="50" max="100" :value="boardScale" @input="updateScale($event.target.value)"></div><div class="setting-group"><label>Theme</label><div class="theme-grid"><button v-for="t in themes" :key="t.id" class="theme-btn" :class="{active:currentTheme===t.id}" @click="setTheme(t.id)">{{t.name}}</button></div></div>
      </div>
    </div></Transition>
    
    <Transition name="slide-in"><div v-if="showOpponentProfile && opponentProfileData" class="side-panel-overlay" @click.self="showOpponentProfile = false">
      <div class="side-profile glass-panel">
        <div class="panel-header"><h3>PLAYER INFO</h3><button class="btn-icon close-p" @click="showOpponentProfile = false">✕</button></div>
        <div class="profile-content">
            <img v-if="opponentProfileData.avatar" :src="opponentProfileData.avatar" class="big-avatar-img"><div v-else class="big-avatar"></div>
            <h2 class="profile-name">{{ opponentProfileData.username }}</h2>
            <div class="badges-row">
                <span class="elo-badge">{{ opponentProfileData.rating }} ELO</span>
                <span v-if="opponentProfileData.rank" class="rank-badge" :class="getRankClass(opponentProfileData.rank)">#{{opponentProfileData.rank}}</span>
            </div>
            <div class="bio-section"><span class="label">BIO</span><p class="bio-text">{{ opponentProfileData.bio || 'No bio provided.' }}</p></div>
            <div class="stats-grid">
                <div class="stat-box"><span class="stat-val">{{ opponentProfileData.wins }}</span><span class="stat-label">WINS</span></div>
                <div class="stat-box"><span class="stat-val">{{ opponentProfileData.matches }}</span><span class="stat-label">GAMES</span></div>
            </div>
        </div>
      </div>
    </div></Transition>

    <div class="content-area">
      <Transition name="fade"><div v-if="opponentDisconnected && !gameOver" class="disconnect-banner glass-panel">⚠️ Opponent Offline.</div></Transition>
      
      <Transition name="fade"><div v-if="!currentRoom" class="center-wrapper">
        <div class="lobby-card glass-panel">
          <h1 class="lobby-title">READY?</h1>
          <div class="status-badge" :class="{pulse:isSearching}">{{status}}</div>
          <div v-if="isSearching" class="loader-ring"></div>
          <div class="lobby-actions">
            <button v-if="!isSearching" class="btn btn-primary big" @click="findGame"><span>FIND MATCH</span></button>
            <button v-else class="btn btn-danger big" @click="cancelSearch"><span>CANCEL</span></button>
          </div>
        </div>
      </div></Transition>

      <Transition name="fade"><div v-if="gameOver" class="center-wrapper z-high">
        <div class="result-card glass-panel">
          <div class="result-icon">{{winner===myColor?'🏆':(winner==='draw'?'🤝':'💀')}}</div>
          <h2>{{winner===myColor?'VICTORY':(winner==='draw'?'DRAW':'DEFEAT')}}</h2>
          <p class="result-reason">{{gameResult}}</p>
          <div class="btn-group">
            <button class="btn btn-primary" @click="findGame"><span>REMATCH</span></button>
            <button class="btn btn-danger" @click="leaveGame"><span>EXIT</span></button>
          </div>
        </div>
      </div></Transition>

      <div v-if="currentRoom" class="game-grid">
        <div class="board-area"><div class="board-wrapper glass-panel" :style="{height:boardScale+'vmin',width:boardScale+'vmin'}"><ChessBoard :board="boardData" :flipped="myColor==='black'" :valid-moves="validMoves" :player-color="myColor" :mine-state="mineState" @move="handleMove" @select="handleSelect"/></div></div>
        
        <aside class="sidebar glass-panel">
          <div class="player-card" :class="{offline:opponentDisconnected, clickable: canViewProfile}" @click="viewOpponent">
            <div v-if="opponentInfo.avatar" class="avatar-img-wrap"><img :src="opponentInfo.avatar" class="avatar-img"></div>
            <div v-else class="avatar op-av"></div>
            <div class="player-details">
              <span class="p-name">{{opponentInfo.username}}</span>
              <div class="p-stats-row">
                <span class="p-status">{{opponentDisconnected?'OFFLINE':opponentInfo.rating+' ELO'}}</span>
                <span v-if="opponentInfo.rank" class="rank-badge small" :class="getRankClass(opponentInfo.rank)">#{{opponentInfo.rank}}</span>
              </div>
              <div class="mini-stats"><span class="mini-stat">W: {{opponentInfo.wins}}</span><span class="mini-stat">G: {{opponentInfo.matches}}</span></div>
            </div>
            <div v-if="!isMyTurn&&!gameOver" class="turn-marker"></div>
          </div>

          <div class="log-container"><div class="log-header"><span>#</span><span>WHITE</span><span>BLACK</span></div><div class="log-scroll" id="move-log"><div v-for="t in formattedHistory" :key="t.num" class="log-row detailed"><span class="turn-num">{{t.num}}.</span><span class="move w" :title="t.white">{{t.white}}</span><span class="move b" :title="t.black">{{t.black}}</span></div></div></div>

          <div class="player-card" :class="{'active-turn':isMyTurn&&!gameOver}">
            <div v-if="currentUserInfo.avatar" class="avatar-img-wrap"><img :src="currentUserInfo.avatar" class="avatar-img"></div><div v-else class="avatar my-av"></div>
            <div class="player-details">
              <span class="p-name">{{ currentUserInfo.username }}</span>
              <div class="p-stats-row">
                <span class="p-status">{{ currentUserInfo.rating }} ELO</span>
                <span v-if="currentUserInfo.rank" class="rank-badge small" :class="getRankClass(currentUserInfo.rank)">#{{currentUserInfo.rank}}</span>
              </div>
              <div class="mini-stats"><span class="mini-stat">W: {{currentUserInfo.wins}}</span><span class="mini-stat">G: {{currentUserInfo.matches}}</span></div>
            </div>
            <div v-if="isMyTurn&&!gameOver" class="turn-marker"></div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* DARKER SIDEBAR */
.sidebar { 
  width: 380px; display: flex; flex-direction: column; gap: 20px; padding: 30px; border-radius: 12px;
  background: rgba(5, 5, 5, 0.75); /* Темніший фон */
  backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: -10px 0 40px rgba(0,0,0,0.5);
}
.player-card { display: flex; align-items: center; gap: 15px; padding: 15px; background: rgba(255,255,255,0.03); border-left: 3px solid transparent; transition: all 0.3s; position: relative; }
.player-card.active-turn { background: rgba(255,255,255,0.05); border-left-color: var(--accent); box-shadow: 10px 0 30px -10px rgba(0,0,0,0.5); }

/* mini stats */
.mini-stats { display: flex; gap: 8px; margin-top: 4px; font-size: 0.65rem; color: #888; font-family: monospace; }
.mini-stat { background: rgba(255,255,255,0.05); padding: 2px 5px; border-radius: 3px; }

/* commons */
.p-stats-row { display: flex; align-items: center; gap: 8px; }
.rank-badge.small { font-size: 0.6rem; padding: 2px 5px; margin-left: 0; }
.mode-tag { font-size: 0.8rem; background: var(--danger); padding: 2px 8px; border-radius: 4px; margin-left: 10px; color: #fff; vertical-align: middle; }
.avatar-img { width: 50px; height: 50px; border-radius: 4px; object-fit: cover; clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%); border: 1px solid var(--accent); }
.big-avatar-img { width: 120px; height: 120px; border-radius: 12px; object-fit: cover; border: 3px solid var(--accent); box-shadow: 0 0 30px rgba(0,0,0,0.5); }
.side-panel-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 99; overflow: hidden; }
.side-profile { position: absolute; top: 0; right: 0; width: 400px; height: 100%; padding: 40px; border-left: 1px solid var(--glass-border); background: rgba(10, 10, 12, 0.95); backdrop-filter: blur(40px); display: flex; flex-direction: column; box-shadow: -10px 0 50px rgba(0,0,0,0.8); }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; }
.profile-content { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 15px; }
.profile-name { font-size: 2.5rem; margin: 0; text-transform: uppercase; letter-spacing: -1px; }
.badges-row { display: flex; align-items: center; justify-content: center; gap: 5px; }
.elo-badge { font-size: 1.2rem; color: var(--accent); font-weight: 800; border: 1px solid var(--accent); padding: 5px 15px; border-radius: 4px; transform: skewX(-10deg); display: inline-block; }
.bio-section { width: 100%; text-align: left; margin-top: 30px; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 8px; }
.bio-section .label { font-size: 0.7rem; color: var(--text-muted); display: block; margin-bottom: 10px; }
.bio-text { font-style: italic; color: #ddd; line-height: 1.5; margin: 0; }
.slide-in-enter-active, .slide-in-leave-active { transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); }
.slide-in-enter-from, .slide-in-leave-to { transform: translateX(100%); }

/* rest of styles */
.layout { width: 100vw; height: 100vh; display: flex; flex-direction: column; }
.navbar { height: 70px; margin: 0; border-radius: 0; border-bottom: 1px solid var(--glass-border); padding: 0 30px; display: flex; justify-content: space-between; align-items: center; z-index: 50; }
.logo { font-weight: 900; font-size: 1.5rem; letter-spacing: 2px; font-style: italic; }
.accent-text { color: var(--accent); }
.modal-header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
.setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.setting-group { margin-bottom: 20px; }
.setting-group label { display: block; margin-bottom: 8px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
.setting-group input[type="range"] { width: 100%; accent-color: var(--accent); }
.theme-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
.theme-btn { padding: 10px; font-size: 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #aaa; cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
.theme-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(255,255,255,0.1); }
.center-wrapper { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; z-index: 40; }
.z-high { z-index: 60; }
.lobby-card, .result-card { padding: 50px; border-radius: 4px; text-align: center; min-width: 400px; display: flex; flex-direction: column; align-items: center; gap: 25px; transform: skewX(-2deg); }
.lobby-title { font-size: 3rem; margin: 0; font-weight: 900; letter-spacing: -2px; font-style: italic; }
.status-badge { padding: 5px 15px; background: rgba(255,255,255,0.05); color: var(--text-muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; }
.status-badge.pulse { color: var(--accent); animation: pulse 1.5s infinite; }
.btn.big { padding: 20px 60px; font-size: 1.2rem; width: 100%; }
.loader-ring { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; }
.result-icon { font-size: 3rem; margin-bottom: -10px; }
.game-grid { display: flex; width: 100%; height: calc(100vh - 70px); padding: 20px; gap: 20px; }
.board-area { flex: 1; display: flex; justify-content: center; align-items: center; }
.board-wrapper { padding: 15px; border-radius: 4px; display: flex; justify-content: center; align-items: center; }
.avatar { width: 50px; height: 50px; background: #333; clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%); }
.op-av { background: linear-gradient(135deg, #ff9a9e, #fad0c4); }
.my-av { background: linear-gradient(135deg, var(--accent), #1d1d1d); }
.p-name { font-weight: 800; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; display: block; }
.p-status { font-size: 0.7rem; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; }
.turn-marker { position: absolute; right: 15px; width: 10px; height: 10px; background: var(--accent); border-radius: 50%; box-shadow: 0 0 10px var(--accent); }
.log-container { flex: 1; background: rgba(0,0,0,0.3); border-radius: 4px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--glass-border); }
.log-header { display: grid; grid-template-columns: 30px 1fr 1fr; padding: 10px; background: rgba(255,255,255,0.05); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); border-bottom: 1px solid var(--glass-border); }
.log-scroll { flex: 1; overflow-y: auto; padding: 5px 0; }
.log-row.detailed { font-size: 0.75rem; grid-template-columns: 30px 1fr 1fr; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.03); padding: 8px 5px; display: grid; }
.move { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #ddd; }
.turn-num { color: var(--accent); opacity: 0.8; }
.empty-msg { padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.8rem; letter-spacing: 2px; }
.disconnect-banner { position: absolute; top: 90px; left: 50%; transform: translateX(-50%); background: var(--danger); color: #fff; padding: 10px 30px; border-radius: 2px; font-weight: 800; z-index: 100; box-shadow: 0 5px 20px rgba(0,0,0,0.5); letter-spacing: 1px; }
.stats-grid { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }
.stat-box { background: rgba(255,255,255,0.05); padding: 10px; width: 80px; }
.stat-val { font-weight: 900; display: block; font-size: 1.2rem; }
.clickable { cursor: pointer; }
.clickable:hover { background: rgba(255,255,255,0.1); }
.btn-group { display: flex; gap: 25px; justify-content: center; margin-top: 20px; }
.result-card { padding: 60px 40px; gap: 30px; }

@keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
@keyframes spin { to { transform: rotate(360deg); } }
.pop-enter-active, .pop-leave-active { transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: scale(0.9) translateY(-10px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>