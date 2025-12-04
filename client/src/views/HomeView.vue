<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import authService from '../services/auth';

const router = useRouter();
const activeCategory = ref('play');
const currentUser = ref(null);
const leaderboard = ref([]);

// ui states
const showAuthModal = ref(false);
const showProfileModal = ref(false);
const showLeaderboardModal = ref(false);
const showPublicProfile = ref(false);
const showSettings = ref(false);
const isLoginMode = ref(true);
const isLoading = ref(false);

// forms
const authForm = ref({ username: '', password: '', confirm: '' });
const authError = ref('');
const profileForm = ref({ bio: '', isPrivate: false, avatar: '' });
const selectedUser = ref(null);

// settings
const useGlassEffects = ref(true);
const boardScale = ref(80);
const themes = [{id:'default',name:'MINT'},{id:'blue',name:'CYBER'},{id:'gold',name:'GOLD'}];
const currentTheme = ref('default');

// helpers
const getRankClass = (rank) => {
  if (rank === 1) return 'rank-gold';
  if (rank === 2) return 'rank-silver';
  if (rank === 3) return 'rank-bronze';
  if (rank <= 100) return 'rank-elite';
  return '';
};

onMounted(async () => {
  await loadUser();
  try { leaderboard.value = await authService.getLeaderboard(); } catch(e){}
  
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

// actions
const handleAuth = async () => {
  authError.value = '';
  if(!authForm.value.username || !authForm.value.password) return authError.value = 'Fill all fields';
  if(!isLoginMode.value && authForm.value.password !== authForm.value.confirm) return authError.value = 'Mismatch';
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
  if (file.size > 2 * 1024 * 1024) { alert('Max 2MB'); return; }
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

const openUserProfile = async (userId) => {
  if (currentUser.value && userId === currentUser.value._id) { 
    showLeaderboardModal.value = false;
    showProfileModal.value = true; 
    return; 
  }
  try {
    const data = await authService.getPublicProfile(userId);
    selectedUser.value = data;
    showLeaderboardModal.value = false;
    showPublicProfile.value = true;
  } catch (e) {}
};

const toggleGlass = (val) => { useGlassEffects.value = val; localStorage.setItem('chess_glass', val); applySettings(); };
const setTheme = (t) => { currentTheme.value = t; localStorage.setItem('chess_theme', t); document.documentElement.setAttribute('data-theme', t); };
const applySettings = () => { document.body.classList.toggle('no-glass', !useGlassEffects.value); const t = localStorage.getItem('chess_theme'); if(t) document.documentElement.setAttribute('data-theme', t); };

const goToGame = (mode) => {
  if (mode === 'ranked' && !currentUser.value) { isLoginMode.value = true; showAuthModal.value = true; return; }
  router.push(`/game?mode=${mode}`);
};

// ОНОВЛЕНЕ МЕНЮ
const menuItems = [
  { id: 'play', label: 'PLAY', desc: 'START JOURNEY', subItems: [
    { label: 'RANKED MATCH', desc: 'COMPETE FOR ELO', action: () => goToGame('standard') },
    { label: 'CASUAL GAME', desc: 'NO RATING LOST', action: () => goToGame('casual') },
    { label: 'LOCAL VERSUS', desc: 'SAME DEVICE', action: () => goToGame('local') }
  ]},
  { id: 'leaderboard', label: 'LEADERBOARD', desc: 'TOP PLAYERS', subItems: [
    { label: 'VIEW RANKINGS', desc: 'SEASON 1 TOP 10', action: () => showLeaderboardModal.value = true }
  ]},
  { id: 'profile', label: 'PROFILE', desc: 'STATS & EDIT', subItems: [
    { label: 'MY PROFILE', desc: 'EDIT & VIEW', action: () => showProfileModal.value = true },
    { label: 'LOGOUT', desc: 'SIGN OUT', action: logout }
  ]},
  { id: 'settings', label: 'SETTINGS', desc: 'CONFIGURE', subItems: [
    { label: 'OPEN SETTINGS', desc: 'GRAPHICS & THEMES', action: () => showSettings.value = true }
  ]}
];
const setActive = (id) => { activeCategory.value = id; };
</script>

<template>
  <div class="home-layout">
    <div class="liquid-background"><div class="blob blob-1"></div><div class="blob blob-2"></div><div class="blob blob-3"></div></div>

    <div class="user-badge glass-panel" v-if="currentUser" @click="showProfileModal = true">
      <img v-if="currentUser.avatar" :src="currentUser.avatar" class="u-avatar-img">
      <div v-else class="u-avatar"></div>
      <div class="u-info"><span class="u-name">{{currentUser.username}}</span><span class="u-rating">{{currentUser.rating}} ELO</span></div>
    </div>
    <div class="user-badge glass-panel login-trigger" v-else @click="showAuthModal = true"><span class="u-name">LOGIN / REGISTER</span></div>

    <div class="menu-center-wrapper">
      <h1 class="game-title">CHESS <span class="accent-text">PLUS</span></h1>
      <div class="menu-container">
        <div class="main-column"><div v-for="item in menuItems" :key="item.id" class="menu-item" :class="{active: activeCategory === item.id}" @mouseenter="setActive(item.id)"><span class="label">{{item.label}}</span></div></div>
        <div class="menu-divider"></div>
        <div class="sub-column">
          <TransitionGroup name="slide-fade"><div v-for="sub in menuItems.find(i=>i.id===activeCategory).subItems" :key="sub.label" class="sub-item" @click="sub.action"><span class="sub-label">{{sub.label}}</span><span class="sub-desc">{{sub.desc}}</span></div></TransitionGroup>
        </div>
      </div>
      <div class="footer">v1.2.0 Stable</div>
    </div>

    <Transition name="fade"><div v-if="showAuthModal" class="auth-overlay" @click.self="showAuthModal = false"><div class="auth-card glass-panel center-content"><h2>{{ isLoginMode ? 'WELCOME' : 'REGISTER' }}</h2><div class="form-body"><div class="input-group"><label>USERNAME</label><input v-model="authForm.username"></div><div class="input-group"><label>PASSWORD</label><input v-model="authForm.password" type="password"></div><div class="input-group" v-if="!isLoginMode"><label>CONFIRM</label><input v-model="authForm.confirm" type="password"></div></div><div v-if="authError" class="error-msg">{{ authError }}</div><button class="btn btn-primary big mt-20" @click="handleAuth" :disabled="isLoading"><span>{{ isLoading ? '...' : (isLoginMode ? 'LOGIN' : 'REGISTER') }}</span></button><p class="switch-mode" @click="isLoginMode = !isLoginMode">{{ isLoginMode ? "Create account" : "Login" }}</p></div></div></Transition>

    <Transition name="fade"><div v-if="showProfileModal" class="auth-overlay" @click.self="showProfileModal = false"><div class="profile-card glass-panel"><div class="profile-header"><div class="avatar-upload"><img v-if="profileForm.avatar" :src="profileForm.avatar" class="big-avatar-img"><div v-else class="big-avatar"></div><label class="upload-btn">📷 <input type="file" @change="handleFileChange" accept="image/*" hidden></label></div><div class="profile-names"><h3>{{ currentUser?.username }}</h3><div class="badges-row"><span class="elo-tag">{{ currentUser?.rating }} ELO</span><span v-if="currentUser?.rank" class="rank-badge" :class="getRankClass(currentUser.rank)">#{{ currentUser.rank }}</span></div><span class="peak-tag">PEAK: {{ currentUser?.highestRating || currentUser?.rating }}</span></div></div><div class="edit-section"><div class="input-group"><label>BIO</label><input v-model="profileForm.bio" placeholder="..."></div><div class="setting-row mt-20"><label>Private Profile</label><label class="switch"><input type="checkbox" v-model="profileForm.isPrivate"><span class="slider"></span></label></div></div><div class="stats-grid"><div class="stat-box"><span class="stat-val text-green">{{ currentUser?.wins }}</span><span class="stat-label">WINS</span></div><div class="stat-box"><span class="stat-val text-gray">{{ currentUser?.draws || 0 }}</span><span class="stat-label">DRAWS</span></div><div class="stat-box"><span class="stat-val text-red">{{ (currentUser?.matches - currentUser?.wins - (currentUser?.draws||0)) }}</span><span class="stat-label">LOSSES</span></div><div class="stat-box"><span class="stat-val">{{ currentUser?.matches }}</span><span class="stat-label">TOTAL</span></div></div><div class="profile-actions"><button class="btn btn-primary" @click="saveProfile" :disabled="isLoading"><span>SAVE</span></button><button class="btn btn-danger" @click="showProfileModal = false"><span>CLOSE</span></button></div></div></div></Transition>

    <Transition name="fade"><div v-if="showSettings" class="auth-overlay" @click.self="showSettings = false"><div class="settings-modal glass-panel"><div class="modal-header"><h3>SETTINGS</h3><button class="btn-icon" @click="showSettings=false">✕</button></div><div class="setting-row"><label>Glass Effects</label><label class="switch"><input type="checkbox" :checked="useGlassEffects" @change="toggleGlass($event.target.checked)"><span class="slider"></span></label></div><div class="setting-group"><label>Theme</label><div class="theme-grid"><button v-for="t in themes" :key="t.id" class="theme-btn" :class="{active:currentTheme===t.id}" @click="setTheme(t.id)">{{t.name}}</button></div></div></div></div></Transition>

    <Transition name="fade"><div v-if="showPublicProfile && selectedUser" class="auth-overlay" @click.self="showPublicProfile = false"><div class="profile-card glass-panel"><div class="profile-header"><img v-if="selectedUser.avatar" :src="selectedUser.avatar" class="big-avatar-img"><div v-else class="big-avatar"></div><div class="profile-names"><h3>{{ selectedUser.username }}</h3><div class="badges-row"><span class="elo-tag">{{ selectedUser.rating }} ELO</span><span v-if="selectedUser.rank" class="rank-badge" :class="getRankClass(selectedUser.rank)">#{{ selectedUser.rank }}</span></div></div></div><p class="bio-text">{{ selectedUser.bio || 'No bio provided.' }}</p><div class="stats-grid"><div class="stat-box"><span class="stat-val text-green">{{ selectedUser.wins }}</span><span class="stat-label">WINS</span></div><div class="stat-box"><span class="stat-val text-gray">{{ selectedUser.draws || 0 }}</span><span class="stat-label">DRAWS</span></div><div class="stat-box"><span class="stat-val">{{ selectedUser.matches }}</span><span class="stat-label">GAMES</span></div></div><div class="profile-actions"><button class="btn btn-danger" @click="showPublicProfile = false"><span>CLOSE</span></button></div></div></div></Transition>

    <Transition name="fade"><div v-if="showLeaderboardModal" class="auth-overlay" @click.self="showLeaderboardModal = false">
      <div class="profile-card glass-panel lb-modal-card">
        <div class="modal-header"><h3>LEADERBOARD</h3><button class="btn-icon" @click="showLeaderboardModal=false">✕</button></div>
        <div class="lb-list-modal">
           <div v-for="(user, index) in leaderboard" :key="user._id" class="lb-row clickable" @click="openUserProfile(user._id)">
              <div class="lb-rank"><span v-if="index < 3" class="rank-badge" :class="getRankClass(index + 1)">#{{ index + 1 }}</span><span v-else class="rank-text">#{{ index + 1 }}</span></div>
              <div class="lb-user">
                <img v-if="user.avatar" :src="user.avatar" class="mini-av">
                <div v-else class="mini-av-ph"></div>
                <div class="lb-names"><span class="lb-name">{{ user.username }}</span><span class="lb-rating">{{ user.rating }} ELO</span></div>
              </div>
           </div>
        </div>
        <div class="profile-actions"><button class="btn btn-danger" @click="showLeaderboardModal = false"><span>CLOSE</span></button></div>
      </div>
    </div></Transition>

  </div>
</template>

<style scoped>
/* leaderboard modal styles */
.lb-modal-card { height: 600px; }
.lb-list-modal { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 5px; width: 100%; }
.lb-row { display: flex; align-items: center; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); transition: 0.2s; text-align: left; }
.lb-row:hover { background: rgba(255,255,255,0.08); transform: translateX(5px); }
.lb-rank {
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 0.8rem;
  color: #666;
  flex-shrink: 0;
}
.lb-user { flex: 1; display: flex; align-items: center; gap: 15px; }
.mini-av { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; border: 1px solid var(--accent); }
.mini-av-ph { width: 40px; height: 40px; border-radius: 8px; background: #333; }
.lb-names { display: flex; flex-direction: column; }
.lb-name { font-weight: 700; font-size: 1rem; line-height: 1.2; }
.lb-rating { font-weight: 500; color: var(--accent); font-size: 0.8rem; }

/* standard styles */
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
.auth-card, .profile-card, .settings-modal { padding: 40px; width: 480px; border-radius: 16px; display: flex; flex-direction: column; gap: 20px; text-align: center; transform: skewX(-2deg); }
.profile-card { width: 550px; }
.form-body { display: flex; flex-direction: column; gap: 15px; width: 100%; }
.input-group { width: 100%; text-align: center; margin-bottom: 5px; }
.input-group label { margin-bottom: 6px; display: block; font-size: 0.75rem; letter-spacing: 1px; color: var(--text-muted); text-align: left; margin-left: 25px; }
.input-group input { width: 90%; padding: 14px; margin: 0 auto; display: block; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-weight: 600; border-radius: 4px; }
.input-group input:focus { border-color: var(--accent); background: rgba(0,0,0,0.4); }
.big-avatar { width: 90px; height: 90px; background: #333; border: 2px solid var(--accent); border-radius: 12px; margin: 0 auto; }
.big-avatar-img { width: 90px; height: 90px; border-radius: 12px; object-fit: cover; border: 2px solid var(--accent); box-shadow: 0 0 20px rgba(0,0,0,0.5); transform: skewX(2deg); }
.avatar-upload { position: relative; cursor: pointer; width: fit-content; margin: 0 auto; }
.upload-btn { position: absolute; bottom: -5px; right: -5px; background: #333; border-radius: 50%; padding: 5px; font-size: 1rem; border: 1px solid var(--accent); cursor: pointer; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; width: 100%; margin-top: 10px; }
.stat-box { background: rgba(255,255,255,0.03); padding: 12px 5px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
.stat-val { font-size: 1.4rem; font-weight: 900; display: block; line-height: 1; margin-bottom: 5px; }
.modal-header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
.setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.setting-group { margin-bottom: 20px; }
.setting-group label { display: block; margin-bottom: 8px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
.setting-group input[type="range"] { width: 100%; accent-color: var(--accent); }
.theme-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
.theme-btn { padding: 10px; font-size: 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #aaa; cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
.theme-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(255,255,255,0.1); }
.switch-mode { cursor: pointer; margin-top: 15px; text-decoration: underline; font-size: 0.9rem; color: #aaa; }
.error-msg { color: var(--danger); margin-bottom: 10px; }
.mt-20 { margin-top: 25px; margin-bottom: 5px; }
.btn.big { width: 100%; }
.footer { margin-top: 50px; font-size: 0.8rem; color: #444; }
.text-green { color: #42b883; } .text-red { color: #ff3333; } .text-gray { color: #aaa; }
.peak-tag { font-size: 0.7rem; color: #888; display: block; margin-top: 5px; }
.badges-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
.badges-row-mini { display: flex; align-items: center; gap: 5px; }
.rank-badge {
  font-size: 0.7rem;
  font-weight: 900;
  padding: 3px 0;
  width: 32px;
  text-align: center;
  border-radius: 4px;
  margin: 0;
  text-transform: uppercase;
  display: inline-block;
  background: rgba(255,255,255,0.1);
  color: #ccc;
}
.profile-actions { display: flex; justify-content: center; gap: 30px; margin-top: 15px; }
.bio-text { font-style: italic; color: #ddd; line-height: 1.5; margin-bottom: 15px; }
.rank-text {
  color: #888;
  font-family: monospace;
  font-size: 0.9rem;
}
.clickable { cursor: pointer; }
.clickable:hover { background: rgba(255,255,255,0.1); }

@keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
.slide-fade-enter-active { transition: all 0.3s ease; }
.slide-fade-leave-active { display: none; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>