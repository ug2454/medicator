import React, { useState } from 'react';
import './Home.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faUser } from "@fortawesome/free-solid-svg-icons";


function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = () => {
    console.log("User logged out!");
    localStorage.setItem('isAuthenticated', 'false'); // Set authentication flag
    // For example, clear user session and redirect to login page
    sessionStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="home">
      {/* Navigation Bar */}
      <header className="navbar">
        <div className="logo">Medicator</div>
        <nav className={`menu ${isMenuOpen ? "open" : ""}`}>
          <ul>
            <li>Add Medical Report</li>
            <li>Medicine Duration</li>
            <li>Log B.P</li>
            <li>B.P Chart</li>
            <li className="user-dropdown">
              <div onClick={toggleDropdown} className="dropdown-toggle">
                <FontAwesomeIcon icon={faUser} size="lg" />
              </div>
              {isDropdownOpen && (
                <div className="dropdown-card">
                  <p className="username">Hello, John Doe</p>
                  <button className="logout-button" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </li>

          </ul>
        </nav>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <h1>Welcome to Medicator</h1>
      </main>
    </div>
  );
};
export default Home;