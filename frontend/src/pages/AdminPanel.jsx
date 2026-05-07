import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import './AdminPanel.css';

const socket = io('');

const AdminPanel = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAdminLoggedIn') === 'true';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [players, setPlayers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [defaultTimer, setDefaultTimer] = useState(45);
  
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editArchived, setEditArchived] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/admin/login', { username, password });
      if (res.data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('isAdminLoggedIn', 'true');
        fetchData();
      }
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  const fetchData = async () => {
    try {
      const pRes = await axios.get(`/api/admin/players?page=${page}&limit=10`);
      setPlayers(pRes.data.data);
      setTotalPages(pRes.data.totalPages);

      const sRes = await axios.get('/api/settings');
      if (sRes.data.defaultTimer) {
        setDefaultTimer(parseInt(sRes.data.defaultTimer));
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      socket.on('queueUpdate', fetchData);
      return () => socket.off('queueUpdate');
    }
  }, [isAuthenticated, page]);

  const handleUpdateTimer = async () => {
    try {
      await axios.post('/api/admin/settings', { key: 'defaultTimer', value: defaultTimer.toString() });
      alert('Timer updated successfully');
    } catch (err) {
      console.error('Error updating timer');
    }
  };

  const handleHardDelete = async (id) => {
    if (window.confirm('Permanently delete this user? This cannot be undone.')) {
      await axios.delete(`/api/admin/players/${id}`);
      fetchData();
    }
  };

  const handleResetAll = async () => {
    if (window.confirm('Are you absolutely sure you want to delete ALL players? This action cannot be undone.')) {
      if (window.confirm('Please confirm again to delete.')) {
        await axios.delete(`/api/admin/players`);
        setPage(1);
        fetchData();
      }
    }
  };

  const handleArchive = (id) => {
    socket.emit('archivePlayer', id);
  };

  const handleRestore = (id) => {
    socket.emit('restorePlayer', id);
  };

  const startEdit = (player) => {
    setEditingPlayer(player.id);
    setEditName(player.name);
    setEditStatus(player.status);
    setEditArchived(player.is_archived === 1);
  };

  const saveEdit = async (id) => {
    await axios.put(`/api/admin/players/${id}`, { name: editName, status: editStatus, is_archived: editArchived ? 1 : 0 });
    setEditingPlayer(null);
    fetchData();
  };

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto' }}>
        <Header isSpaced={true} />
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Admin Login</h2>
          {error && <p style={{ color: 'var(--accent-red)', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="input-field" required />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" required />
            </div>
            <button type="submit" className="btn" style={{ width: '100%' }}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header isSpaced={true} />
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem' }}>Admin Dashboard</h1>
        
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3>Global Settings</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
            <label>Default Timer (Seconds):</label>
            <input 
              type="number" 
              className="input-field" 
              style={{ width: '100px', padding: '0.5rem' }} 
              value={defaultTimer} 
              onChange={e => setDefaultTimer(e.target.value)} 
            />
            <button className="btn" onClick={handleUpdateTimer}>Save Timer</button>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Players Directory</h3>
            <button className="btn" style={{ backgroundColor: '#991b1b', color: 'white', borderColor: '#991b1b', padding: '0.5rem 1rem' }} onClick={handleResetAll}>Reset All Players</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      {editingPlayer === p.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input type="text" className="input-field" style={{ padding: '0.25rem', width: '100px' }} value={editName} onChange={e => setEditName(e.target.value)} />
                          <select className="input-field" style={{ padding: '0.25rem' }} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                            <option value="waiting">waiting</option>
                            <option value="playing">playing</option>
                            <option value="completed">completed</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={editArchived} onChange={e => setEditArchived(e.target.checked)} />
                            Archive
                          </label>
                          <button className="btn" style={{ padding: '0.25rem 0.5rem' }} onClick={() => saveEdit(p.id)}>Save</button>
                          <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setEditingPlayer(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {p.name}
                          {p.is_archived === 1 && <span className="status-badge" style={{backgroundColor: '#555', marginLeft: '8px', color: '#fff'}}>Archived</span>}
                        </div>
                      )}
                    </td>
                    <td><span className={`status-badge status-${p.status}`}>{p.status}</span></td>
                    <td>{new Date(p.created_at).toLocaleString()}</td>
                    <td>
                      {editingPlayer !== p.id && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => startEdit(p)}>Edit</button>
                          {p.is_archived === 0 ? (
                            <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleArchive(p.id)}>Archive</button>
                          ) : (
                            <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleRestore(p.id)}>Restore</button>
                          )}
                          <button className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#991b1b', color: 'white', borderColor: '#991b1b' }} onClick={() => handleHardDelete(p.id)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => (
                <button 
                  key={i + 1} 
                  className={`page-btn ${page === i + 1 ? 'active' : ''}`}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
