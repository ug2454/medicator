import React, { useState, useEffect, useCallback } from 'react';
import './MedicineDuration.css';
import useAuth from '../../useAuth';
import NotesModal from '../Modal/NotesModal';
import { format } from 'date-fns';

const MedicineDuration = () => {
    // Call useAuth at the top level of your component
    useAuth();
    
    const [activeReports, setActiveReports] = useState([]);
    const [expiredReports, setExpiredReports] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [selectedActive, setSelectedActive] = useState([]);
    const [selectedExpired, setSelectedExpired] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    // Add state to track the current date
    const [currentDate, setCurrentDate] = useState(new Date().toDateString());
    // Add state for modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedNotes, setSelectedNotes] = useState('');
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [selectedMedicine, setSelectedMedicine] = useState('');
    
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

    // Add useEffect to check for date changes
    useEffect(() => {
        // Function to check if the date has changed
        const checkDateChange = () => {
            const newDate = new Date().toDateString();
            if (newDate !== currentDate) {
                console.log('Date changed from', currentDate, 'to', newDate);
                setCurrentDate(newDate);
                // Force a re-render by incrementing the refresh trigger
                setRefreshTrigger(prev => prev + 1);
            }
        };
        
        // Check every minute
        const intervalId = setInterval(checkDateChange, 60000);
        
        // Clean up on component unmount
        return () => clearInterval(intervalId);
    }, [currentDate]);

    // Wrap fetchReports in useCallback
    const fetchReports = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/medicine-duration?user_id=${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Raw API response:', data);
                console.log('Doctor Notes in response:', data.map(item => item.doctorNotes));
                
                if (!Array.isArray(data)) {
                    console.error('API response is not an array:', data);
                    return;
                }
                
                const hasIds = data.every(item => item.id !== undefined);
                if (!hasIds) {
                    console.error('Some items are missing IDs:', data);
                }
                
                const currentDate = new Date().toISOString().split('T')[0];
                const active = data.filter(report => report.dosage >= currentDate);
                const expired = data.filter(report => report.dosage < currentDate);
                
                console.log('Active reports with notes:', active.map(report => ({
                    medicineName: report.medicineName,
                    doctorNotes: report.doctorNotes
                })));
                
                setActiveReports(active);
                setExpiredReports(expired);
            } else {
                console.error('Failed to fetch medical reports:', response.status);
                if (response.status === 401) {
                    console.error('Authentication error - token may be invalid or expired');
                }
            }
        } catch (error) {
            console.error('Failed to fetch medical reports:', error);
        }
    }, [userId, token, API_BASE_URL]); // Add dependencies here

    useEffect(() => {
        if (userId && token) {
            fetchReports();
        } else {
            console.error('Missing userId or token');
        }
    }, [userId, API_BASE_URL, token, refreshTrigger, fetchReports]); // Add fetchReports to dependency array

    const formatDate = (date) => {
        // Ensure we're working with a Date object
        const dateObj = date instanceof Date ? date : new Date(date);
        
        const options = { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            timeZone: 'Asia/Kolkata' // Explicitly use IST timezone
        };
        return dateObj.toLocaleDateString('en-GB', options).replace(/ /g, ' - ');
    };

    const formatFrequency = (report) => {
        if (!report.frequencyType) return 'Not specified';
        
        if (report.frequencyType === 'daily') {
            return 'Daily';
        } else if (report.frequencyType === 'weekly') {
            // Capitalize first letter of weeklyDay
            const day = report.weeklyDay ? 
                report.weeklyDay.charAt(0).toUpperCase() + report.weeklyDay.slice(1) : 
                'Not specified';
            return `Weekly (${day})`;
        } else if (report.frequencyType === 'custom') {
            return 'Custom schedule';
        }
        
        return report.frequencyType;
    };

    const handleDelete = async (reportId) => {
        console.log('Attempting to delete report with ID:', reportId);
        
        if (!reportId) {
            showToast('Cannot delete: Report ID is missing');
            return;
        }
        
        if (!window.confirm('Are you sure you want to delete this medicine record?')) {
            return;
        }
        
        setIsDeleting(true);
        setDeletingId(reportId);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/medicine-duration/${reportId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // Trigger a refresh after successful deletion
                setRefreshTrigger(prev => prev + 1);
                showToast('Medicine record deleted successfully', 'success');
            } else {
                console.error('Failed to delete medicine record:', response.status);
                showToast('Failed to delete medicine record');
            }
        } catch (error) {
            console.error('Error deleting medicine record:', error);
            showToast('Error deleting medicine record');
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };

    const handleBulkDelete = async (isActive) => {
        const selectedIds = isActive ? selectedActive : selectedExpired;
        
        if (selectedIds.length === 0) {
            showToast('No items selected for deletion');
            return;
        }
        
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected records?`)) {
            return;
        }
        
        setIsDeleting(true);
        let successCount = 0;
        let failCount = 0;
        
        try {
            // Delete each selected record sequentially
            for (const id of selectedIds) {
                setDeletingId(id);
                const response = await fetch(`${API_BASE_URL}/api/medicine-duration/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    successCount++;
                } else {
                    console.error(`Failed to delete record with ID ${id}:`, response.status);
                    failCount++;
                }
            }
            
            // Update the UI immediately by removing the deleted items
            if (isActive) {
                setActiveReports(prev => prev.filter(report => !selectedIds.includes(report.id)));
                setSelectedActive([]);
            } else {
                setExpiredReports(prev => prev.filter(report => !selectedIds.includes(report.id)));
                setSelectedExpired([]);
            }
            
            // Also trigger a full refresh to ensure data consistency
            setRefreshTrigger(prev => prev + 1);
            
            // Show appropriate message
            if (failCount === 0) {
                showToast(`Successfully deleted ${successCount} records`, 'success');
            } else {
                showToast(`Deleted ${successCount} records, failed to delete ${failCount} records`, 'warning');
            }
        } catch (error) {
            console.error('Error during bulk delete:', error);
            showToast('Error during bulk delete operation');
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };

    const toggleSelectActive = (id) => {
        setSelectedActive(prev => 
            prev.includes(id) 
                ? prev.filter(itemId => itemId !== id) 
                : [...prev, id]
        );
    };

    const toggleSelectExpired = (id) => {
        setSelectedExpired(prev => 
            prev.includes(id) 
                ? prev.filter(itemId => itemId !== id) 
                : [...prev, id]
        );
    };

    const toggleSelectAllActive = () => {
        if (selectedActive.length === activeReports.length) {
            setSelectedActive([]);
        } else {
            setSelectedActive(activeReports.map(report => report.id));
        }
    };

    const toggleSelectAllExpired = () => {
        if (selectedExpired.length === expiredReports.length) {
            setSelectedExpired([]);
        } else {
            setSelectedExpired(expiredReports.map(report => report.id));
        }
    };

    const showToast = (message, type = 'error') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = type === 'success' ? 'purple' : 
                                     type === 'warning' ? 'orange' : 'red';
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

    // Add a function to calculate the next dosage date
    const calculateNextDosage = (report) => {
        if (!report.frequencyType || !report.dosage) return 'Not available';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const startDate = new Date(report.dosage);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(report.end_date);
        endDate.setHours(0, 0, 0, 0);
        
        // If the medication has ended, return "Completed"
        if (endDate < today) {
            return 'Completed';
        }
        
        // If the medication hasn't started yet, return the start date
        if (startDate > today) {
            return formatDate(startDate);
        }
        
        if (report.frequencyType === 'daily') {
            return formatDate(today);
        } else if (report.frequencyType === 'weekly' && report.weeklyDay) {
            // Create a new date object for current week's date
            const currentWeekDate = new Date(startDate.getTime());
            
            // Find the current week's date by adding weeks until we reach or exceed today
            while (currentWeekDate < today) {
                currentWeekDate.setDate(currentWeekDate.getDate() + 7);
            }
            
            // If we've gone past today, go back one week to get current week's date
            if (currentWeekDate > today) {
                currentWeekDate.setDate(currentWeekDate.getDate() - 7);
            }
            
            // If today is past the current week's date, show next week
            if (today > currentWeekDate) {
                currentWeekDate.setDate(currentWeekDate.getDate() + 7);
            }
            
            // If next date is after end date, return completed
            if (currentWeekDate > endDate) {
                return 'Completed';
            }
            
            return formatDate(currentWeekDate);
        } else if (report.frequencyType === 'custom') {
            return 'Custom schedule';
        }
        
        return 'Not available';
    };

    const handleViewNotes = (notes, medicineName) => {
        setSelectedNotes(notes);
        setSelectedMedicine(medicineName);
        setIsNotesModalOpen(true);
    };

    return (
        <div className="medicine-duration">
            <div className="header">
                <h1>Medicine Duration</h1>
            </div>
            <div className="table-container1">
                <div className="table-header">
                    <h2>Active Dosages</h2>
                    {activeReports.length > 0 && (
                        <button 
                            className="bulk-delete-btn" 
                            onClick={() => handleBulkDelete(true)}
                            disabled={isDeleting || selectedActive.length === 0}
                        >
                            {isDeleting ? 'Deleting...' : `Delete Selected (${selectedActive.length})`}
                        </button>
                    )}
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                {activeReports.length > 0 && (
                                    <th>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedActive.length === activeReports.length && activeReports.length > 0}
                                            onChange={toggleSelectAllActive}
                                            disabled={isDeleting}
                                        />
                                    </th>
                                )}
                                <th>Medicine Name</th>
                                <th>Upcoming Dosage</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Frequency</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeReports.length > 0 ? (
                                activeReports.map((report, index) => (
                                    <tr key={index}>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedActive.includes(report.id)}
                                                onChange={() => toggleSelectActive(report.id)}
                                                disabled={isDeleting}
                                            />
                                        </td>
                                        <td>{report.medicineName}</td>
                                        <td>{calculateNextDosage(report)}</td>
                                        <td>{formatDate(report.dosage)}</td>
                                        <td>{formatDate(report.end_date)}</td>
                                        <td>{formatFrequency(report)}</td>
                                        <td>
                                            <button 
                                                className="view-notes-btn"
                                                onClick={() => handleViewNotes(report.doctorNotes, report.medicineName)}
                                                disabled={!report.doctorNotes}
                                            >
                                                {report.doctorNotes ? 'View Notes' : 'No Notes'}
                                            </button>
                                        </td>
                                        <td>
                                            <button 
                                                className="delete-btn" 
                                                onClick={() => handleDelete(report.id)}
                                                disabled={isDeleting && deletingId === report.id}
                                            >
                                                {isDeleting && deletingId === report.id ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="no-data">No active dosages found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="table-container2">
                <div className="table-header">
                    <h2>Expired Dosages</h2>
                    {expiredReports.length > 0 && (
                        <button 
                            className="bulk-delete-btn" 
                            onClick={() => handleBulkDelete(false)}
                            disabled={isDeleting || selectedExpired.length === 0}
                        >
                            {isDeleting ? 'Deleting...' : `Delete Selected (${selectedExpired.length})`}
                        </button>
                    )}
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                {expiredReports.length > 0 && (
                                    <th>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedExpired.length === expiredReports.length && expiredReports.length > 0}
                                            onChange={toggleSelectAllExpired}
                                            disabled={isDeleting}
                                        />
                                    </th>
                                )}
                                <th>Medicine Name</th>
                                <th>Upcoming Dosage</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Frequency</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiredReports.length > 0 ? (
                                expiredReports.map((report, index) => (
                                    <tr key={index}>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedExpired.includes(report.id)}
                                                onChange={() => toggleSelectExpired(report.id)}
                                                disabled={isDeleting}
                                            />
                                        </td>
                                        <td>{report.medicineName}</td>
                                        <td>{calculateNextDosage(report)}</td>
                                        <td>{formatDate(report.dosage)}</td>
                                        <td>{formatDate(report.end_date)}</td>
                                        <td>{formatFrequency(report)}</td>
                                        <td>
                                            <button 
                                                className="view-notes-btn"
                                                onClick={() => handleViewNotes(report.doctorNotes, report.medicineName)}
                                                disabled={!report.doctorNotes}
                                            >
                                                {report.doctorNotes ? 'View Notes' : 'No Notes'}
                                            </button>
                                        </td>
                                        <td>
                                            <button 
                                                className="delete-btn" 
                                                onClick={() => handleDelete(report.id)}
                                                disabled={isDeleting && deletingId === report.id}
                                            >
                                                {isDeleting && deletingId === report.id ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="no-data">No expired dosages found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <footer className="footer">
                <p>&copy; 2025 Medicator. All rights reserved.</p>
            </footer>
            <NotesModal 
                isOpen={isNotesModalOpen}
                onClose={() => setIsNotesModalOpen(false)}
                notes={selectedNotes}
                medicineName={selectedMedicine}
            />
        </div>
    );
};

export default MedicineDuration;