<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import authService from '../services/auth';

const router = useRouter();
const activeCategory = ref('play');
const currentUser = ref(null);

const showAuthModal = ref(false);
const showProfileModal = ref(false);
const showSettings = ref(false);
const isLoginMode = ref(true);
const authForm = ref({ username: '', password: '', confirm: '' });
const authError = ref('');
const profileForm = ref({ bio: '', isPrivate: false, avatar: '' });
const isLoading = ref(false);

const useGlassEffects = ref(true);
const boardScale = ref(80);
const themes = [{id:'default',name:'MINT'},{id:'blue',name:'CYBER'},{id:'gold',name:'GOLD'}];
const currentTheme = ref('default');

onMounted(async () => {
  await loadUser();
  const glass = localStorage.getItem('chess_glass');
  const theme = localStorage.getItem('chess_theme');
  if(glass !== null) useGlassEffects.value = glass === 'true';
  if(theme) currentTheme.value = theme;
  applySettings();
});

const loadUser = async () => {
  const stats = await authService.getLatestStats();
  if (stats) {
    currentUser.value = stats;
    profileForm.value = { bio: stats.bio || '', isPrivate: stats.isPrivate || false, avatar: stats.avatar || '' };
  } else currentUser.value = null;
};

const handleAuth = async () => {
  authError.value = '';
  if(!authForm.value.username || !authForm.value.password) return authError.value = 'Fill all fields';
  if(!isLoginMode.value && authForm.value.password !== authForm.value.confirm) return authError.value = 'Passwords mismatch';
  isLoading.value = true;
  try {
    if(isLoginMode.value) await authService.login(authForm.value.username, authForm.value.password);
    else { await authService.register(authForm.value.username, authForm.value.password); await authService.login(authForm.value.username, authForm.value.password); }
    await loadUser(); showAuthModal.value = false;
  } catch(e) { authError.value = e.message; } finally { isLoading.value = false; }
};

const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 150000) { alert('File too big! Max 150KB'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => { profileForm.value.avatar = ev.target.result; };
  reader.readAsDataURL(file);
};

const saveProfile = async () => {
  if (!currentUser.value) return;
  isLoading.value = true;
  await authService.updateProfile(currentUser.value._id, profileForm.value);
  await loadUser(); isLoading.value = false; showProfileModal.value = false;
};

const logout = () => { authService.logout(); currentUser.value = null; showProfileModal.value = false; };

const toggleGlass = (val) => { useGlassEffects.value = val; localStorage.setItem('chess_glass', val); applySettings(); };
const setTheme = (t) => { currentTheme.value = t; localStorage.setItem('chess_theme', t); document.documentElement.setAttribute('data-theme', t); };
const applySettings = () => { document.body.classList.toggle('no-glass', !useGlassEffects.value); const t = localStorage.getItem('chess_theme'); if(t) document.documentElement.setAttribute('data-theme', t); };

const goToGame = (mode) => {
  if (mode === 'ranked' && !currentUser.value) { isLoginMode.value = true; showAuthModal.value = true; return; }
  router.push(`/game?mode=${mode}`);
};

const menuItems = [
  { id: 'play', label: 'PLAY', desc: 'START JOURNEY', subItems: [
    { label: 'RANKED MATCH', desc: 'COMPETE FOR ELO', action: () => goToGame('standard') },
    { label: 'CASUAL GAME', desc: 'NO RATING LOST', action: () => goToGame('casual') },
    { label: 'LOCAL VERSUS', desc: 'SAME DEVICE', action: () => goToGame('local') }
  ]},
  { id: 'profile', label: 'PROFILE', desc: 'STATS & EDIT', subItems: [
    { label: 'MY PROFILE', desc: 'EDIT & VIEW', action: () => showProfileModal.value = true },
    { label: 'LOGOUT', desc: 'SIGN OUT', action: logout }
  ]},
  { id: 'settings', label: 'SETTINGS', desc: 'CONFIGURE', subItems: [
    { label: 'OPEN SETTINGS', desc: 'GRAPHICS & THEMES', action: () => showSettings.value = true }
  ]}
];
</script>

<template>
  <div class="home-layout">
    <div class="liquid-background"><div class="blob blob-1"></div><div class="blob blob-2"></div><div class="blob blob-3"></div></div>

    <div class="user-badge glass-panel" v-if="currentUser" @click="showProfileModal = true">
      <img v-if="currentUser.avatar" :src="currentUser.avatar" class="u-avatar-img">
      <div v-else class="u-avatar"></div>
      <div class="u-info"><span class="u-name">{{currentUser.username}}</span><span class="u-rating">{{currentUser.rating}} ELO</span></div>
    </div>
    <div class="user-badge glass-panel login-trigger" v-else @click="showAuthModal = true"><span class="u-name">LOGIN</span></div>

    <Transition name="fade"><div v-if="showAuthModal" class="auth-overlay" @click.self="showAuthModal = false">
      <div class="auth-card glass-panel center-content">
        <h2>{{ isLoginMode ? 'WELCOME' : 'REGISTER' }}</h2>
        <div class="input-group"><label>USERNAME</label><input v-model="authForm.username"></div>
        <div class="input-group"><label>PASSWORD</label><input v-model="authForm.password" type="password"></div>
        <div class="input-group" v-if="!isLoginMode"><label>CONFIRM</label><input v-model="authForm.confirm" type="password"></div>
        <div v-if="authError" class="error-msg">{{ authError }}</div>
        <button class="btn btn-primary big mt-20" @click="handleAuth" :disabled="isLoading"><span>{{ isLoading ? '...' : (isLoginMode ? 'LOGIN' : 'REGISTER') }}</span></button>
        <p class="switch-mode" @click="isLoginMode = !isLoginMode">{{ isLoginMode ? "Create account" : "Login" }}</p>
      </div>
    </div></Transition>

    <Transition name="fade"><div v-if="showProfileModal" class="auth-overlay" @click.self="showProfileModal = false">
      <div class="profile-card glass-panel">
        <div class="profile-header">
          <div class="avatar-upload">
            <img v-if="profileForm.avatar" :src="profileForm.avatar" class="big-avatar-img">
            <div v-else class="big-avatar"></div>
            <label class="upload-btn">📷 <input type="file" @change="handleFileChange" accept="image/*" hidden></label>
          </div>
          <div class="profile-names"><h3>{{ currentUser?.username }}</h3><span class="elo-tag">{{ currentUser?.rating }} ELO</span></div>
        </div>
        <div class="edit-section">
          <div class="input-group"><label>BIO / STATUS</label><input v-model="profileForm.bio" placeholder="Tell about yourself..."></div>
          <div class="setting-row"><label>Private Profile</label><label class="switch"><input type="checkbox" v-model="profileForm.isPrivate"><span class="slider"></span></label></div>
        </div>
        <div class="stats-grid"><div class="stat-box"><span class="stat-val">{{ currentUser?.wins }}</span><span class="stat-label">WINS</span></div><div class="stat-box"><span class="stat-val">{{ currentUser?.matches }}</span><span class="stat-label">GAMES</span></div></div>
        <div class="profile-actions"><button class="btn btn-primary" @click="saveProfile" :disabled="isLoading"><span>SAVE</span></button><button class="btn btn-danger" @click="showProfileModal = false"><span>CLOSE</span></button></div>
      </div>
    </div></Transition>

    <Transition name="fade"><div v-if="showSettings" class="auth-overlay" @click.self="showSettings = false">
      <div class="settings-modal glass-panel">
        <div class="modal-header"><h3>SETTINGS</h3><button class="btn-icon" @click="showSettings=false">✕</button></div>
        <div class="setting-row"><label>Glass Effects</label><label class="switch"><input type="checkbox" :checked="useGlassEffects" @change="toggleGlass($event.target.checked)"><span class="slider"></span></label></div>
        <div class="setting-group"><label>Theme</label><div class="theme-grid"><button v-for="t in themes" :key="t.id" class="theme-btn" :class="{active:currentTheme===t.id}" @click="setTheme(t.id)">{{t.name}}</button></div></div>
      </div>
    </div></Transition>

    <div class="menu-center-wrapper">
      <h1 class="game-title">CHESS <span class="accent-text">PLUS</span></h1>
      <div class="menu-container">
        <div class="main-column"><div v-for="item in menuItems" :key="item.id" class="menu-item" :class="{active: activeCategory === item.id}" @mouseenter="activeCategory=item.id"><span class="label">{{item.label}}</span></div></div>
        <div class="menu-divider"></div>
        <div class="sub-column">
          <TransitionGroup name="slide-fade"><div v-for="sub in menuItems.find(i=>i.id===activeCategory).subItems" :key="sub.label" class="sub-item" @click="sub.action"><span class="sub-label">{{sub.label}}</span><span class="sub-desc">{{sub.desc}}</span></div></TransitionGroup>
        </div>
      </div>
      <div class="footer">v1.1.0 Stable • Online</div>
    </div>
  </div>
</template>

<style scoped>
.home-layout { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; }
.menu-center-wrapper { text-align: center; display: flex; flex-direction: column; align-items: center; z-index: 10; }
.game-title { font-size: 4rem; font-weight: 900; letter-spacing: -2px; margin-bottom: 40px; text-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.accent-text { color: var(--accent); }
.menu-container { display: flex; align-items: stretch; gap: 40px; min-height: 300px; }
.main-column { display: flex; flex-direction: column; gap: 15px; text-align: right; justify-content: center; min-width: 200px; }
.menu-item { font-size: 2.5rem; font-weight: 800; cursor: pointer; color: rgba(255,255,255,0.3); transition: all 0.3s; line-height: 1; }
.menu-item:hover, .menu-item.active { color: #fff; transform: scale(1.05); }
.menu-item.active { color: var(--accent); text-shadow: 0 0 20px var(--accent-glow); }
.menu-divider { width: 2px; background: rgba(255,255,255,0.1); border-radius: 2px; }
.sub-column { display: flex; flex-direction: column; gap: 15px; text-align: left; justify-content: center; min-width: 300px; }
.sub-item { cursor: pointer; padding: 10px 20px; border-left: 2px solid transparent; transition: all 0.2s; opacity: 0; animation: slideIn 0.3s forwards; }
.sub-item:hover { border-left-color: var(--accent); background: rgba(255,255,255,0.05); }
.sub-label { display: block; font-weight: 700; font-size: 1.2rem; }
.sub-desc { display: block; font-size: 0.8rem; color: var(--text-muted); }
.user-badge { position: absolute; top: 30px; right: 30px; display: flex; align-items: center; gap: 15px; padding: 10px 20px; border-radius: 4px; z-index: 50; transform: skewX(-10deg); cursor: pointer; }
.user-badge:hover { background: rgba(255,255,255,0.1); }
.u-avatar { width: 40px; height: 40px; background: var(--accent); border-radius: 4px; transform: skewX(10deg); }
.u-avatar-img { width: 40px; height: 40px; border-radius: 4px; object-fit: cover; transform: skewX(10deg); border: 1px solid var(--accent); }
.u-info { transform: skewX(10deg); text-align: left; }
.u-name { font-weight: 800; font-size: 1rem; display: block; }
.u-rating { font-size: 0.8rem; color: var(--accent); display: block; }
.login-trigger { border: 1px solid var(--accent); color: var(--accent); }
.auth-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 100; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
.auth-card, .profile-card, .settings-modal { padding: 40px; width: 350px; border-radius: 10px; text-align: center; transform: skewX(-2deg); }
.profile-card { width: 500px; }
.input-group { margin-bottom: 15px; text-align: left; }
.input-group input { width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-weight: bold; }
.big-avatar { width: 80px; height: 80px; background: #333; border: 2px solid var(--accent); border-radius: 8px; margin: 0 auto 20px; }
.big-avatar-img { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; border: 2px solid var(--accent); transform: skewX(2deg); }
.avatar-upload { position: relative; cursor: pointer; width: fit-content; margin: 0 auto; }
.upload-btn { position: absolute; bottom: -5px; right: -5px; background: #333; border-radius: 50%; padding: 5px; font-size: 1rem; border: 1px solid var(--accent); cursor: pointer; }
.stats-grid { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }
.stat-box { background: rgba(255,255,255,0.05); padding: 10px; width: 80px; }
.stat-val { font-weight: 900; display: block; font-size: 1.2rem; }
.modal-header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
.setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.theme-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
.theme-btn { padding: 10px; font-size: 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #aaa; cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
.theme-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(255,255,255,0.1); }
.error-msg { color: var(--danger); margin-bottom: 10px; }
.mt-20 { margin-top: 20px; }
.btn.big { width: 100%; }
.footer { margin-top: 50px; font-size: 0.8rem; color: #444; }
@keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
.slide-fade-enter-active { transition: all 0.3s ease; }
.slide-fade-leave-active { display: none; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>