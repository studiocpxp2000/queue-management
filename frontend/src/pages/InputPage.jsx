import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import './InputPage.css';

const socket = io('http://localhost:3012');

const InputPage = () => {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const [registeredName, setRegisteredName] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [status, setStatus] = useState('waiting');

  const checkStatus = async (id) => {
    try {
      const res = await axios.get(`http://localhost:3012/api/players/${id}/status`);
      setStatus(res.data.status);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWaitTime = async (pid) => {
    try {
      const [qRes, aRes, sRes] = await Promise.all([
        axios.get('http://localhost:3012/api/queue'),
        axios.get('http://localhost:3012/api/active-player'),
        axios.get('http://localhost:3012/api/settings')
      ]);
      const queue = qRes.data;
      const activePlayer = aRes.data;
      const defaultTimer = parseInt(sRes.data.defaultTimer || 45);
      
      const index = queue.findIndex(p => p.id.toString() === pid.toString());
      if (index !== -1) {
        const positionMultiplier = activePlayer ? index + 1 : index;
        const waitTimeSeconds = positionMultiplier * defaultTimer;
        const waitMinutes = Math.floor(waitTimeSeconds / 60);
        const waitSeconds = waitTimeSeconds % 60;
        const formattedTime = `${waitMinutes}:${waitSeconds.toString().padStart(2, '0')}`;
        setWaitTime(formattedTime);
      } else if (status === 'waiting') {
         // If they aren't in queue and are waiting, maybe they just finished
         checkStatus(pid);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const isRegistered = localStorage.getItem('registered');
    let pid = null;
    if (isRegistered) {
      setSubmitted(true);
      setRegisteredName(localStorage.getItem('registeredName'));
      setWaitTime(localStorage.getItem('waitTime'));
      pid = localStorage.getItem('playerId');
      if (pid) {
        setPlayerId(pid);
        checkStatus(pid);
        fetchWaitTime(pid);
      }
    }

    const handleQueueUpdate = () => {
      const currentPid = pid || localStorage.getItem('playerId');
      if (currentPid) {
        fetchWaitTime(currentPid);
        checkStatus(currentPid);
      }
    };

    socket.on('queueUpdate', handleQueueUpdate);
    socket.on('settingsUpdate', handleQueueUpdate);

    socket.on('playerCompleted', (id) => {
      if (id.toString() === localStorage.getItem('playerId')) {
        setStatus('completed');
      }
    });

    socket.on('preparePlayer', (data) => {
      if (data.id.toString() === localStorage.getItem('playerId')) {
        setStatus('playing');
      }
    });

    return () => {
      socket.off('queueUpdate', handleQueueUpdate);
      socket.off('settingsUpdate', handleQueueUpdate);
      socket.off('playerCompleted');
      socket.off('preparePlayer');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await axios.post('http://localhost:3012/api/players', { name });
      if (res.data.success) {
        setSubmitted(true);
        setRegisteredName(name);
        setPlayerId(res.data.id);
        const waitTimeSeconds = res.data.waitTime;
        const waitMinutes = Math.floor(waitTimeSeconds / 60);
        const waitSeconds = waitTimeSeconds % 60;
        const formattedTime = `${waitMinutes}:${waitSeconds.toString().padStart(2, '0')}`;
        setWaitTime(formattedTime);
        
        localStorage.setItem('registered', 'true');
        localStorage.setItem('registeredName', name);
        localStorage.setItem('waitTime', formattedTime);
        localStorage.setItem('playerId', res.data.id.toString());
      }
    } catch (error) {
      console.error('Error submitting name:', error);
    }
  };

  if (submitted) {
    let content;
    if (status === 'completed') {
      content = (
        <>
          <h2 style={{ color: 'var(--accent-red)' }}>Challenge Completed!</h2>
          <br />
          <p>Thank you <strong>{registeredName}</strong> for participating in the Dunk Challenge at Tissot × BUDX NBA House.</p>
          <br />
          <p>We hope you enjoyed the experience!</p>
        </>
      );
    } else if (status === 'playing') {
      content = (
        <>
          <h2 style={{ color: 'var(--accent-red)' }}>It's Your Turn!</h2>
          <br />
          <p>Hi <strong>{registeredName}</strong>, your game has started.</p>
          <br />
          <p>Head to the court immediately and beat the clock!</p>
        </>
      );
    } else {
      content = (
        <>
          <h2 style={{ color: 'var(--accent-red)' }}>You’re on the list!</h2>
          <br />
          <p>Hi <strong>{registeredName}</strong>, you’re successfully registered for the Dunk Challenge at Tissot × BUDX NBA House.</p>
          <br />
          <p>Your estimated wait time is <strong>{waitTime} minutes</strong>.</p>
          <br />
          <p>We’ll notify you when it’s your turn, get ready to beat the clock!</p>
          <br />
          <p>See You!<br/><strong>Team Tissot.</strong></p>
        </>
      );
    }

    return (
      <div>
        <Header />
        <div className="card" style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <div className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Join the Challenge</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Your Name</label>
            <input 
              type="text" 
              className="input-field" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
            />
          </div>
          <button type="submit" className="btn" style={{ width: '100%' }}>Register</button>
        </form>
      </div>
    </div>
  );
};

export default InputPage;
