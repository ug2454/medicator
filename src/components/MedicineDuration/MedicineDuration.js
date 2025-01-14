import React, { useState, useEffect } from 'react';
import './MedicineDuration.css';

const MedicineDuration = () => {
    const [activeReports, setActiveReports] = useState([]);
    const [expiredReports, setExpiredReports] = useState([]);
    const userId = localStorage.getItem('userId');
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/medicine-duration?user_id=${userId}`);
                if (response.ok) {
                    const data = await response.json();
                    const currentDate = new Date().toISOString().split('T')[0];
                    const active = data.filter(report => report.followUpDate >= currentDate);
                    const expired = data.filter(report => report.followUpDate < currentDate);
                    setActiveReports(active);
                    setExpiredReports(expired);
                } else {
                    console.error('Failed to fetch medical reports');
                }
            } catch (error) {
                console.error('Failed to fetch medical reports:', error);
            }
        };

        fetchReports();
    }, [userId]);

    const formatDate = (dateString) => {
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-GB', options).replace(/ /g, ' - ');
    };

    return (
        <div className="medicine-duration">
            <div className="header">
                <h1>Medicine Duration</h1>
            </div>
            <div className="table-container1">
                <h2>Active Dosages</h2>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine Name</th>
                                <th>Dosage End Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeReports.map((report, index) => (
                                <tr key={index}>
                                    <td>{report.medicineName}</td>
                                    <td>{formatDate(report.dosage)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="table-container2">
                <h2>Expired Dosages</h2>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine Name</th>
                                <th>Dosage End Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiredReports.map((report, index) => (
                                <tr key={index}>
                                    <td>{report.medicineName}</td>
                                    <td>{formatDate(report.dosage)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <footer className="footer">
                <p>&copy; 2025 Medicator. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default MedicineDuration;