import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css';

function Signup() {
    const navigate = useNavigate();
    
    useEffect(() => {
        // Prevent navigation back to the signup or login page
        function preventBackNavigation() {
          console.log("Preventing back navigation on signup or login page.");
          
          // Continuously push state to prevent navigation back
          window.history.pushState(null, "", window.location.href);
          setInterval(function() {
            window.history.pushState(null, "", window.location.href);
          }, 100); // Push new state every 100ms
    
          // Listen for the "back" or "forward" event
          window.addEventListener("popstate", function () {
            console.log("Back navigation detected, redirecting to home page.");
            // Redirect to the home page immediately
            navigate("/home");
          });
        }
    
        // Initialize functions based on the current page
        function initializePage() {
          const currentPath = window.location.pathname;
          console.log("Current page path: " + currentPath);
    
          // Apply the function based on the page
          if (currentPath.endsWith("/signup")) {
            console.log("Detected signup page. Replacing history with signup.");
            preventBackNavigation();
          }
        }
    
        // Call initializePage when the DOM is loaded
        console.log("DOM content loaded. Initializing page.");
        initializePage();
      }, [navigate]);

  return (
    <div className="main-container">
        <div className="header-container">
            <header className="header">
                <h1 className="header-text">Medicator</h1>
            </header>
        </div>
        <div className="signup-container">
            <h1>Sign Up</h1>
            <form action="/signup" method="post">
                <label htmlFor="username">Username:</label>
                <input type="text" id="username" name="username" required />
                <label htmlFor="email">Email:</label>
                <input type="email" id="email" name="email" required />
                <label htmlFor="password">Password:</label>
                <input type="password" id="password" name="password" required />
                <label htmlFor="confirm-password">Confirm Password:</label>
                <input type="password" id="confirm-password" name="confirm-password" required />
                <button type="submit">Sign Up</button>
            </form>
        </div>
    </div>
  );
}

export default Signup;