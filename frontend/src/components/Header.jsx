import React from 'react';
import './Header.css';

const Header = ({ isSpaced = false }) => {
  return (
    <div className={`header ${isSpaced ? 'header-spaced' : ''}`}>
      <img src="/assets/TIS-Logo.png" alt="Tissot Logo" className="logo" />
      <img src="/assets/logo-nba.svg" alt="NBA Logo" className="logo" />
    </div>
  );
};

export default Header;
