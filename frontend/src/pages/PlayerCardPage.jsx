import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './PlayerCardPage.css';
const socket = io('');

const PlayerCardPage = () => {
  const [activePlayer, setActivePlayer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) return;

    let animationFrameId;
    let targetEndTime = 0;
    
    const startAudio = new Audio('/assets/start.wav');
    const endAudio = new Audio('/assets/end.wav');

    const updateTimer = () => {
      if (targetEndTime > 0) {
        const remaining = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
        setTimeLeft(remaining);
        
        if (remaining > 0) {
          animationFrameId = requestAnimationFrame(updateTimer);
        } else {
          targetEndTime = 0;
          endAudio.play().catch(e => console.error("Error playing end.wav:", e));
        }
      }
    };

    socket.emit('requestInitialState');

    socket.on('preparePlayer', (data) => {
      setActivePlayer({ id: data.id, name: data.name });
      setTimeLeft(data.duration);
      targetEndTime = 0;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      
      startAudio.play().catch(e => {
         console.error("Error playing start.wav:", e);
         socket.emit('beginTimer');
      });
      
      startAudio.onended = () => {
        socket.emit('beginTimer');
      };
    });

    socket.on('runTimer', (data) => {
      setActivePlayer(prev => prev ? prev : { id: data.id, name: data.name || '' });
      targetEndTime = Date.now() + data.duration * 1000;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      updateTimer();
    });

    socket.on('playerCompleted', () => {
      setActivePlayer(null);
      setTimeLeft(0);
      targetEndTime = 0;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    });

    return () => {
      socket.off('preparePlayer');
      socket.off('runTimer');
      socket.off('playerCompleted');
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      startAudio.pause();
      endAudio.pause();
    };
  }, [isInitialized]);

  return (
    <div className="player-card-layout">
      {!isInitialized && (
        <div 
          onClick={() => setIsInitialized(true)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', flexDirection: 'column' }}
        >
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--accent-red)' }}>CLICK TO INITIALIZE DISPLAY</h1>
          <p style={{ fontSize: '1.5rem', color: '#ccc' }}>Required to enable audio playback</p>
        </div>
      )}

      <div className="player-card-wrapper">
        <img src="/assets/bg-2.png" alt="Dunk Challenge Background" className="player-card-image" />
        
        <div className="player-content-box">
          {activePlayer ? (
            <>
              <h1 
                className="dynamic-player-name"
                style={{ fontSize: activePlayer.name.length > 15 ? '2.5cqw' : (activePlayer.name.length > 10 ? '3cqw' : '3.5cqw') }}
              >
                {activePlayer.name}
              </h1>
              <div className={`dynamic-timer ${timeLeft <= 5 ? 'pulse-text timer-danger' : ''}`}>
                <span className="timer-digits">{timeLeft}</span><span className="timer-unit">S</span>
              </div>
            </>
          ) : (
            <>
              <h1 className="dynamic-player-name" style={{ color: '#9CA3AF', opacity: 0.5 }}>Player Name</h1>
              <div className="dynamic-timer timer-danger">
                <span className="timer-digits">00</span><span className="timer-unit">S</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerCardPage;
