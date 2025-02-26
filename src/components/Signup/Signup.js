import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

function Signup() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleBack = () => {
        navigate('/login');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Form Data:', formData);
        if (formData.password !== formData.confirmPassword) {
            console.error('Passwords do not match');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            if (response.ok) {
                const data = await response.json();
                console.log('Signup successful:', data);
                localStorage.setItem('token', data.token); // Store JWT
                localStorage.setItem('isAuthenticated', 'true'); // Set authentication flag
                localStorage.setItem('username', data.username); // Store username
                localStorage.setItem('userId', data.userId); // Store userId
                console.log('username', data.username);
                navigate('/home', { replace: true });// Navigate to the login page or another page
            } else {
                console.error('Signup failed');
            }
        } catch (error) {
            console.error('Error during signup:', error);
        }
    };

    return (
        <div className="signup-page-container">
            <div className="signup-header-container">
                <header className="signup-header">
                    <h1 className="signup-header-text">Medicator</h1>
                </header>
            </div>

            <div className="signup-form-container">
                <button className="back-button" onClick={handleBack}>
                    ←
                </button>
                <h2>Create Account</h2>
                <form onSubmit={handleSubmit} className="signup-form">
                    <div className="form-group">
                        <label htmlFor="username">Username:</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            className="form-input"
                            placeholder="Enter Username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="email"
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
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password:</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            className="form-input"
                            placeholder="Confirm Password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="button-container">
                        <button className="loginButton" type="submit">Sign Up</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Signup;