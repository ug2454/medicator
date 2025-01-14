import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import './Layout.css';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";

function Layout() {
  const [isMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [username, setUsername] = useState('');
  const dropdownRef = useRef(null);

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

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated'); // Remove authentication flag
    localStorage.removeItem('username'); // Remove username
    window.location.href = '/login'; // Redirect to login page
  };

  return (
    <div className="layout">
      <header className="navbar">
        <div className="logo">Medicator</div>
        <nav className={`menu ${isMenuOpen ? "open" : ""}`}>
          <ul>
            <li><a href="/add-medical-report">Add Medical Report</a></li>
            <li><a href="/medicine-duration">Medicine Duration</a></li>
            <li><a href="/log-bp">Log B.P</a></li>
            <li><a href="/bp-chart">B.P Chart</a></li>
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