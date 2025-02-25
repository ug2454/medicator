import React, { useState } from 'react';
import './MedicalReport.css';
import useAuth from '../../useAuth';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const MedicalReport = () => {
  useAuth(); // Use the custom hook to handle token expiration and automatic logout

  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  
  // New state variables for frequency
  const [frequencyType, setFrequencyType] = useState('daily'); // daily, weekly, custom
  const [weeklyDay, setWeeklyDay] = useState('monday');
  const [durationValue, setDurationValue] = useState('');
  const [durationUnit, setDurationUnit] = useState('weeks');

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

    if (!medicineName || !dosage) {
      showToast('Please fill in all required fields');
      return;
    }

    // Calculate end date based on frequency and duration
    let endDate = new Date(dosage); // Start with the dosage date
    
    if (frequencyType === 'weekly' && durationValue) {
      const durationInWeeks = parseInt(durationValue);
      if (durationUnit === 'weeks') {
        endDate.setDate(endDate.getDate() + (durationInWeeks * 7));
      } else if (durationUnit === 'months') {
        endDate.setMonth(endDate.getMonth() + parseInt(durationValue));
      }
    }
    
    const formattedEndDate = endDate.toISOString().split('T')[0];

    // Get the JWT token from localStorage
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${API_BASE_URL}/api/medical-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Add the Authorization header with the JWT token
        },
        body: JSON.stringify({
          medicineName,
          dosage,
          doctorNotes,
          followUpDate,
          userId: parseInt(userId),
          frequencyType,
          weeklyDay: frequencyType === 'weekly' ? weeklyDay : null,
          durationValue: durationValue ? parseInt(durationValue) : null,
          durationUnit,
          endDate: formattedEndDate
        }),
      });

      if (response.ok) {
        showToast('Medical report saved successfully!', 'success');
        // Reset form
        setMedicineName('');
        setDosage('');
        setDoctorNotes('');
        setFollowUpDate('');
        setFrequencyType('daily');
        setWeeklyDay('monday');
        setDurationValue('');
        setDurationUnit('weeks');
      } else {
        showToast('Failed to save medical report');
      }
    } catch (error) {
      console.error('Error saving medical report:', error);
      showToast('An error occurred while saving the medical report');
    }
  };

  return (
    <div className="main-div">
      <h2>Add Medical Report</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="medicineName">Medicine Name</label>
          <input
            type="text"
            id="medicineName"
            placeholder="Enter medicine name"
            value={medicineName}
            onChange={(e) => setMedicineName(e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="dosage">Start Date</label>
          <input
            type="date"
            id="dosage"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
          />
        </div>
        
        {/* Frequency Selection */}
        <div className="form-group">
          <label htmlFor="frequencyType">Frequency</label>
          <select 
            id="frequencyType" 
            value={frequencyType} 
            onChange={(e) => setFrequencyType(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        
        {/* Show day selection if weekly is selected */}
        {frequencyType === 'weekly' && (
          <div className="form-group">
            <label htmlFor="weeklyDay">Day of Week</label>
            <select 
              id="weeklyDay" 
              value={weeklyDay} 
              onChange={(e) => setWeeklyDay(e.target.value)}
            >
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              <option value="saturday">Saturday</option>
              <option value="sunday">Sunday</option>
            </select>
          </div>
        )}
        
        {/* Duration fields */}
        <div className="form-group duration-group">
          <label htmlFor="duration">Duration</label>
          <div className="duration-inputs">
            <input
              type="number"
              id="durationValue"
              placeholder="Duration"
              min="1"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
            />
            <select 
              id="durationUnit" 
              value={durationUnit} 
              onChange={(e) => setDurationUnit(e.target.value)}
            >
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="doctorNotes">Doctor's Notes</label>
          <textarea
            id="doctorNotes"
            placeholder="Enter doctor's notes"
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
          ></textarea>
        </div>
        
        <div className="form-group">
          <label htmlFor="followUpDate">Follow-up Date</label>
          <input
            type="date"
            id="followUpDate"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />
        </div>
        
        <button className='medicalReportSubmitButton' type="submit">Save Report</button>
      </form>
    </div>
  );
};

export default MedicalReport;