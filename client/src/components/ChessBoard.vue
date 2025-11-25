<script setup>
import { computed } from 'vue';

const props = defineProps({
  board: Array,
  flipped: Boolean
});

const emit = defineEmits(['move']);

// Wiki Commons
const pieces = {
  w: {
    p: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
    r: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    n: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    b: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    q: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    k: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  },
  b: {
    p: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
    r: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    n: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    b: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    q: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    k: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
  }
};

import { ref } from 'vue';
const selectedSquare = ref(null);

const getSquareId = (rowIndex, colIndex) => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const rank = 8 - rowIndex;
  const file = files[colIndex];
  return `${file}${rank}`;
};

const handleSquareClick = (rowIndex, colIndex) => {
  const squareId = getSquareId(rowIndex, colIndex);
  
  if (selectedSquare.value) {
    if (selectedSquare.value === squareId) {
      selectedSquare.value = null;
    } else {

      emit('move', { from: selectedSquare.value, to: squareId });
      selectedSquare.value = null;
    }
  } else {

    const piece = props.board[rowIndex][colIndex];
    if (piece) {
      selectedSquare.value = squareId;
    }
  }
};

const isDark = (r, c) => (r + c) % 2 === 1;

</script>

<template>
  <div class="chessboard" :class="{ flipped: flipped }">
    <div 
      v-for="(row, rIndex) in board" 
      :key="rIndex" 
      class="row"
    >
      <div 
        v-for="(square, cIndex) in row" 
        :key="cIndex"
        class="square"
        :class="{ 
          'dark': isDark(rIndex, cIndex), 
          'light': !isDark(rIndex, cIndex),
          'selected': selectedSquare === getSquareId(rIndex, cIndex)
        }"
        @click="handleSquareClick(rIndex, cIndex)"
      >
        <img 
          v-if="square" 
          :src="pieces[square.color][square.type]" 
          class="piece"
          :class="{ 'flipped-piece': flipped }" 
        />
        
        <span v-if="cIndex === 0" class="coord-rank">{{ 8 - rIndex }}</span>
        <span v-if="rIndex === 7" class="coord-file">{{ ['a','b','c','d','e','f','g','h'][cIndex] }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chessboard {
  display: grid;
  grid-template-rows: repeat(8, 1fr);
  width: 100%;
  max-width: 500px;
  aspect-ratio: 1;
  margin: 0 auto;
  border: 5px solid #333;
  user-select: none;
}

.row {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
}

.square {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.light { background-color: #eeeed2; }
.dark { background-color: #769656; }
.selected { background-color: #baca44 !important; }

.piece {
  width: 80%;
  height: 80%;
  /* Анімація появи */
  transition: transform 0.2s; 
}
.piece:hover {
  transform: scale(1.1);
}

.chessboard.flipped {
  transform: rotate(180deg);
}
.chessboard.flipped .piece {
  transform: rotate(180deg);
}

.coord-rank {
  position: absolute;
  top: 2px; left: 2px;
  font-size: 10px;
  font-weight: bold;
  color: inherit;
}
.coord-file {
  position: absolute;
  bottom: 2px; right: 2px;
  font-size: 10px;
  font-weight: bold;
}
.chessboard.flipped .coord-rank,
.chessboard.flipped .coord-file {
  transform: rotate(180deg);
}
</style>