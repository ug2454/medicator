import React, { useState } from 'react';
import './LogBP.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const LogBP = () => {
    const [systolic, setSystolic] = useState('');
    const [diastolic, setDiastolic] = useState('');
    const [pulse, setPulse] = useState('');
    const [time, setTime] = useState('');
    const userId = localStorage.getItem('userId');

    const showToast = (message, type = 'error') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = type === 'success' ? 'purple' : 'red';
        toast.style.color = 'white';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '5px';
        toast.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.1)';
        toast.style.zIndex = '1000';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    };



    const handleSubmit = async (e) => {
        e.preventDefault();
        const bpData = {
            systolic: parseInt(systolic, 10),
            diastolic: parseInt(diastolic, 10),
            pulse: parseInt(pulse, 10),
            time,
            userId: parseInt(userId, 10)
        };

        console.log('BP Data:', bpData);
        try {
            const response = await fetch(`${API_BASE_URL}/api/log-bp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bpData)
            });
            if (response.ok) {
                const data = await response.json();
                console.log('BP log successful:', data);
                showToast('Blood pressure logged successfully!', 'success');
                // Optionally, clear the form or show a success message
            } else {
                console.error('BP log failed');
                showToast('Failed to log blood pressure', 'error');
            }
        } catch (error) {
            console.error('Error during BP log:', error);
            showToast('Failed to log blood pressure', 'error');
        }
    };

    return (
        <div className="log-bp-container">
            <h2>Log Blood Pressure</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Systolic:</label>
                    <input
                        title='Enter systolic value'
                        label='Systolic:'
                        placeholder='Enter systolic value'
                        type="number"
                        value={systolic}
                        onChange={(e) => setSystolic(e.target.value)}
                    />
                </div>
                <div>
                    <label>Diastolic:</label>
                    <input
                        title='Enter diastolic value'
                        label='Diastolic:'
                        placeholder='Enter diastolic value'
                        type="number"
                        value={diastolic}
                        onChange={(e) => setDiastolic(e.target.value)}
                    />
                </div>
                <div>
                    <label>Pulse:</label>
                    <input
                        title='Enter pulse value'
                        label='Pulse:'
                        placeholder='Enter pulse value'
                        type="number"
                        value={pulse}
                        onChange={(e) => setPulse(e.target.value)}
                    />
                </div>
                <div>
                    <label>Time:</label>
                    <input
                        title='Enter time'
                        label='Time:'
                        placeholder='Enter time'
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        onFocus={(e) => e.target.showPicker()}
                    />
                </div>
                <button type="submit">Log</button>
            </form>
        </div>
    );
};

export default LogBP;