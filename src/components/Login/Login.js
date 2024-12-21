import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

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
        try {
            const response = await fetch('http://localhost:8080/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                console.log('Login successful');
                localStorage.setItem('isAuthenticated', 'true'); // Set authentication flag
                navigate('/home', { replace: true }); // Replace the current entry in the history stack
            } else {
                const errorData = await response.json();
                console.error('Login failed:', errorData.message);
            }
        } catch (error) {
            console.error('Login failed:', error);
        }

    }

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
                <form onSubmit={handleSubmit}>
                    <label htmlFor="email">Email:</label>
                    <input
                        type="text"
                        autoComplete="email"
                        id="email"
                        name="email"
                        placeholder="Enter Email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    <br />
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        placeholder="Enter Password"
                        onChange={handleChange}
                        required
                    />
                    <button type="submit">Login</button>
                    <br />
                    <button type="button" onClick={handleSignupClick}>Sign Up</button>
                </form>
            </div>
        </div>
    );
}

export default Login;