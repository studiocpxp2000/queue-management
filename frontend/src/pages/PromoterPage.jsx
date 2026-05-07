import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import './PromoterPage.css';

const socket = io('');

const PromoterPage = () => {
  const [queue, setQueue] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  const fetchQueue = async () => {
    try {
      const res = await axios.get('/api/queue');
      setQueue(res.data);
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  };

  useEffect(() => {
    fetchQueue();
    socket.on('queueUpdate', fetchQueue);
    return () => socket.off('queueUpdate');
  }, []);

  const handleStart = () => {
    if (!selectedPlayerId) {
      alert("Please select a player first");
      return;
    }
    socket.emit('startPlayer', selectedPlayerId);
    setSelectedPlayerId(null);
  };

  const handleSoftDelete = (playerId) => {
    if (window.confirm("Are you sure you want to remove this player from the queue?")) {
      socket.emit('softDeletePlayer', playerId);
      if (selectedPlayerId === playerId) setSelectedPlayerId(null);
    }
  };

  return (
    <div className="promoter-layout">
      {/* Sticky Header + Control Bar */}
      <div className="promoter-sticky-top">
        <Header isSpaced={true} />
        <div className="promoter-control-bar">
          <h1 className="promoter-title">Promoter Control</h1>
          <button
            className="btn"
            onClick={handleStart}
            disabled={!selectedPlayerId}
            style={{ opacity: selectedPlayerId ? 1 : 0.5 }}
          >
            START GAME
          </button>
        </div>
      </div>

      {/* Scrollable queue list only */}
      <div className="promoter-scroll-area">
        <div className="queue-list">
          {queue.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No one is in the queue right now.</p>
          ) : (
            queue.map((player, index) => (
              <div
                key={player.id}
                className={`queue-item ${selectedPlayerId === player.id ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedPlayerId(player.id)}
              >
                <div className="queue-item-info">
                  <input
                    type="checkbox"
                    checked={selectedPlayerId === player.id}
                    onChange={() => setSelectedPlayerId(player.id)}
                    style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                  />
                  <span className="queue-number">#{index + 1}</span>
                  <span className="queue-name">{player.name}</span>
                </div>
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSoftDelete(player.id);
                  }}
                  title="Remove from queue"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PromoterPage;
