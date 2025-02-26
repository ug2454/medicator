import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value
        }));
    };



    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Form Data:', formData);
        setLoading(true); // Set loading to true when the login process starts
        try {
            console.log("API Base URL=============:", API_BASE_URL);

            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData),
                credentials: 'include'  // This ensures cookies are included
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Login successful');
                // Wait for the cookie to be set
                setTimeout(() => {
                    // Check if data contains the expected properties
                    console.log("username, userId, token", data.username, data.userId, data.token);
                    if (data.username && data.userId) {
                        localStorage.setItem('isAuthenticated', 'true'); // Set authentication flag
                        localStorage.setItem('username', data.username); // Store username
                        localStorage.setItem('userId', data.userId); // Store userId
                        localStorage.setItem('token', data.token); // Store JWT
                        console.log('username', data.username);
                        console.log('TOKEN======', data.token);
                    } else {
                        console.warn('Missing username or userId in response data:', data);
                    }
                    setLoading(false); // Set loading to false when the login process completes
                    navigate('/home', { replace: true }); // Replace the current entry in the history stack
                }, 100); // Adjust the timeout as needed

            } else {
                let errData;
                try {
                    errData = await response.json();
                    console.error('Login failed:', errData.message);
                } catch (err) {
                    console.error('Login failed. No JSON returned', err);
                }
                setLoading(false); // Set loading to false when the login process completes
            }
        } catch (error) {
            console.error('Login failed:', error);
            setLoading(false); // Set loading to false when the login process completes
        }
    };

    const handleSignupClick = () => {
        navigate('/signup');
    };

    return (
        <div className="main-container">
            <div className="header-container">
                <header className="header">
                    <h1 className="header-text">Medicator</h1>
                </header>
            </div>
            <div className="login-container">
                <h1>Login</h1>
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="text"
                            autoComplete="email"
                            id="email"
                            name="email"
                            className="form-input"
                            placeholder="Enter Email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password:</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            className="form-input"
                            placeholder="Enter Password"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="button-container">
                        <button className='loginButton' type="submit" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                        <div className="button-separator"></div>
                        <button className='loginButton' type="button" onClick={handleSignupClick}>Sign Up</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Login;