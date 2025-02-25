import React, {  } from 'react';
import './Home.css';
import useAuth from '../../useAuth';

function Home() {
  useAuth(); // Use the custom hook to handle token expiration and automatic logout
  


  return (
    <div className="home">
      {/* Navigation Bar */}
      

      {/* Main Content */}
      <main className="main-content">
        <h1>Welcome to Medicator</h1>
      </main>
    </div>
  );
};
export default Home;