<script setup>
import { ref } from 'vue';
const props = defineProps({ board: Array, flipped: Boolean, validMoves: { type: Array, default: () => [] }, playerColor: String });
const emit = defineEmits(['move', 'select']);
const pieces = {
  w: { p: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg', r: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg', n: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg', b: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg', q: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg', k: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg' },
  b: { p: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg', r: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg', n: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg', b: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg', q: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg', k: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg' }
};
const selectedSquare = ref(null);
const getSquareId = (r, c) => `${['a','b','c','d','e','f','g','h'][c]}${8-r}`;
const isDark = (r, c) => (r+c)%2===1;

const handleSquareClick = (r, c) => {
  const id = getSquareId(r, c);
  const piece = props.board[r][c];
  const myColor = props.playerColor ? props.playerColor.charAt(0) : null;
  const isMyPiece = piece && piece.color === myColor;

  if (selectedSquare.value === id) { selectedSquare.value = null; emit('select', null); return; }
  if (isMyPiece) { selectedSquare.value = id; emit('select', id); return; }
  if (selectedSquare.value) { emit('move', { from: selectedSquare.value, to: id }); selectedSquare.value = null; emit('select', null); }
};
</script>

<template>
  <div class="chessboard" :class="{ flipped: flipped }">
    <div v-for="(row, r) in board" :key="r" class="row">
      <div v-for="(sq, c) in row" :key="c" class="square" :class="{ dark: isDark(r,c), light: !isDark(r,c), selected: selectedSquare===getSquareId(r,c), 'valid-target': validMoves.includes(getSquareId(r,c)) }" @click="handleSquareClick(r, c)">
        <img v-if="sq" :src="pieces[sq.color][sq.type]" class="piece" :class="{ 'flipped-piece': flipped }" />
        <div v-if="!sq && validMoves.includes(getSquareId(r,c))" class="hint-dot"></div>
        <div v-if="sq && validMoves.includes(getSquareId(r,c))" class="hint-capture"></div>
        <span v-if="c===0" class="coord-rank">{{8-r}}</span><span v-if="r===7" class="coord-file">{{['a','b','c','d','e','f','g','h'][c]}}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chessboard { display: grid; grid-template-rows: repeat(8, 1fr); width: 100%; height: 100%; user-select: none; border-radius: 4px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.row { display: grid; grid-template-columns: repeat(8, 1fr); }
.square { position: relative; display: flex; justify-content: center; align-items: center; cursor: pointer; }
.light { background-color: var(--board-light); color: var(--board-dark); }
.dark { background-color: var(--board-dark); color: var(--board-light); }
.selected { background-color: rgba(255, 235, 59, 0.6) !important; }
.piece { width: 90%; height: 90%; transition: transform 0.2s; z-index: 2; }
.piece:hover { transform: scale(1.1); }
.hint-dot { width: 25%; height: 25%; background-color: rgba(0,0,0,0.2); border-radius: 50%; pointer-events: none; }
.hint-capture { position: absolute; width: 100%; height: 100%; border: 6px solid rgba(0,0,0,0.2); border-radius: 50%; box-sizing: border-box; pointer-events: none; }
.coord-rank { position: absolute; top: 2px; left: 3px; font-size: 10px; font-weight: 700; opacity: 0.8; pointer-events: none; }
.coord-file { position: absolute; bottom: 1px; right: 3px; font-size: 10px; font-weight: 700; opacity: 0.8; pointer-events: none; }
.chessboard.flipped { transform: rotate(180deg); }
.chessboard.flipped .piece { transform: rotate(180deg); }
.chessboard.flipped .coord-rank, .chessboard.flipped .coord-file { transform: rotate(180deg); }
</style>