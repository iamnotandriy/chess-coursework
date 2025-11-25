<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();

const startGame = () => {
  router.push('/game');
};
</script>

<template>
  <div class="home">
    <div class="hero">
      <h1>CHESS <span class="highlight">PLUS</span></h1>
      <p>Classic strategy & Chaos Modes.</p>
      <button @click="startGame" class="play-btn">ENTER LOBBY</button>
    </div>
  </div>
</template>

<style scoped>
.home {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: radial-gradient(circle at center, #2c3e50 0%, #000000 100%);
  color: white;
  text-align: center;
}
h1 { font-size: 4rem; letter-spacing: 5px; margin-bottom: 10px; }
.highlight { color: #42b883; }
p { font-size: 1.2rem; color: #aaa; margin-bottom: 40px; }
.play-btn {
  padding: 15px 50px;
  font-size: 1.5rem;
  background: transparent;
  color: #42b883;
  border: 2px solid #42b883;
  cursor: pointer;
  transition: all 0.3s;
  text-transform: uppercase;
  letter-spacing: 2px;
}
.play-btn:hover { background: #42b883; color: black; box-shadow: 0 0 20px #42b883; }
</style>