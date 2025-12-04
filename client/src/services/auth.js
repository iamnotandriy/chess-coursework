import { SERVER_URL } from '../config';
const API_URL = `${SERVER_URL}/api/auth`;

export default {
  async login(username, password) {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    localStorage.setItem('chess_token', data.token);
    localStorage.setItem('chess_user_id', data.userId);
    return data;
  },
  async register(username, password) {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data;
  },
  async getLeaderboard() {
    try {
      const res = await fetch(`${API_URL}/leaderboard`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) { return []; }
  },
  async getLatestStats() {
    const id = localStorage.getItem('chess_user_id');
    if (!id) return null;
    try {
      const res = await fetch(`${API_URL}/stats/${id}`); 
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  },
  async updateProfile(userId, profileData) {
    const res = await fetch(`${API_URL}/profile/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data;
  },
  async getPublicProfile(userId) {
    const res = await fetch(`${API_URL}/stats/${userId}`);
    if (!res.ok) throw new Error('Failed to load profile');
    return await res.json();
  },
  logout() {
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_user_id');
  },
  getUser() {
    const id = localStorage.getItem('chess_user_id');
    return id ? { id } : null; 
  }
};