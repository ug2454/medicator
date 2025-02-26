import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link } from 'react-router-dom';
import './Layout.css';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import useAuth from '../../useAuth';

function Layout() {
  const [isMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [username, setUsername] = useState('');
  const dropdownRef = useRef(null);
  const { handleLogout } = useAuth();

  const navigate = useNavigate();
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated !== 'true') {
      navigate('/login');
    } else {
      const storedUsername = localStorage.getItem('username');
      if (storedUsername) {
        setUsername(storedUsername.charAt(0).toUpperCase() + storedUsername.slice(1));
      }
    }
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [dropdownRef]);

  return (
    <div className="layout">
      <header className="navbar">
        <div className="logo">Medicator</div>
        <nav className={`menu ${isMenuOpen ? "open" : ""}`}>
          <ul>
            <li><Link to="/add-medical-report">Add Medical Report</Link></li>
            <li><Link to="/medicine-duration">Medicine Duration</Link></li>
            <li><Link to="/log-bp">Log B.P</Link></li>
            <li><Link to="/bp-chart">B.P Chart</Link></li>
            <li><Link to="/upload-note">Upload Note</Link></li>
            <li className="user-dropdown" ref={dropdownRef}>
              <div onClick={toggleDropdown} className="dropdown-toggle">
                <FontAwesomeIcon icon={faUser} size="lg" />
              </div>
              {isDropdownOpen && (
                <div className="dropdown-card">
                  <p className="username">Hello, {username}!</p>
                  <button className="logout-button" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </li>
          </ul>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;