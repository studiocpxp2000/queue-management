import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import './QueuePage.css';

const socket = io('');

const QueuePage = () => {
  const [queue, setQueue] = useState([]);
  const [activePlayer, setActivePlayer] = useState(null);
  const [defaultTimer, setDefaultTimer] = useState(45);

  const fetchQueue = async () => {
    try {
      const [qRes, aRes, sRes] = await Promise.all([
        axios.get('/api/queue'),
        axios.get('/api/active-player'),
        axios.get('/api/settings')
      ]);
      setQueue(qRes.data);
      setActivePlayer(aRes.data);
      if (sRes.data.defaultTimer) {
        setDefaultTimer(parseInt(sRes.data.defaultTimer));
      }
    } catch (error) {
      console.error('Error fetching queue data:', error);
    }
  };

  useEffect(() => {
    fetchQueue();
    
    // Auto update every 10 seconds
    const interval = setInterval(fetchQueue, 10000);

    socket.on('queueUpdate', fetchQueue);
    socket.on('preparePlayer', fetchQueue);
    socket.on('playerCompleted', fetchQueue);
    socket.on('settingsUpdate', fetchQueue);

    return () => {
      clearInterval(interval);
      socket.off('queueUpdate');
      socket.off('preparePlayer');
      socket.off('playerCompleted');
      socket.off('settingsUpdate');
    };
  }, []);

  return (
    <div>
      <Header isSpaced={true} />
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Up Next</h1>
        
        {activePlayer && (
          <div className="queue-item active" style={{ marginBottom: '2rem', padding: '1.5rem', borderLeftWidth: '6px' }}>
            <div className="queue-item-info">
              <span className="queue-number">ACTIVE</span>
              <span className="queue-name" style={{ fontSize: '1.5rem' }}>{activePlayer.name}</span>
            </div>
            <span className="queue-time pulse-text">PLAYING NOW</span>
          </div>
        )}

        <div className="queue-list">
          {queue.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No one is in the queue right now.</p>
          ) : (
            queue.map((player, index) => {
              const positionMultiplier = activePlayer ? index + 1 : index;
              const waitTimeSeconds = positionMultiplier * defaultTimer;
              const waitMinutes = Math.floor(waitTimeSeconds / 60);
              const waitSeconds = waitTimeSeconds % 60;
              let timeString = '';
              
              if (waitTimeSeconds === 0) {
                 timeString = 'Next in line';
              } else {
                 timeString = waitMinutes > 0 
                  ? `~ ${waitMinutes}m ${waitSeconds}s` 
                  : `~ ${waitSeconds}s`;
              }

              return (
                <div key={player.id} className="queue-item">
                  <div className="queue-item-info">
                    <span className="queue-number">#{index + 1}</span>
                    <span className="queue-name">{player.name}</span>
                  </div>
                  <span className="queue-time">{timeString}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default QueuePage;
