import React, { useState } from 'react';
import './MedicalReport.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const MedicalReport = () => {
  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

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
    const userId = localStorage.getItem('userId'); // Assuming userId is stored in localStorage
    const reportData = {
      medicineName,
      dosage,
      doctorNotes,
      followUpDate,
      userId: parseInt(userId, 10)
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/medical-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Medical report saved successfully:', data.message);
        showToast('Medical report saved successfully!', 'success');
        // Optionally, reset the form fields
        setMedicineName('');
        setDosage('');
        setDoctorNotes('');
        setFollowUpDate('');
      } else {
        const errorData = await response.json();
        console.error('Failed to save medical report:', errorData.message);
        showToast('Failed to save medical report: ' + errorData.message);
      }
    } catch (error) {
      console.error('Failed to save medical report:', error);
      showToast('Failed to save medical report: ' + error.message);
    }
  };

  return (
    <div className='main-div'>
      <h1>Medical Report</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Medicine Name:</label>
          <input
            type="text"
            placeholder="Enter medicine name"
            value={medicineName}
            onChange={(e) => setMedicineName(e.target.value)}
          />
        </div>
        <div>
          <label>Dosage:</label>
          <input
            type="date"
            placeholder="Enter dosage end date"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
          />
        </div>
        <div>
          <label>Doctor Notes:</label>
          <textarea
            placeholder="Enter doctor's notes"
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
          />
        </div>
        <div>
          <label>Follow-up Date:</label>
          <input
            type="date"
            placeholder="Enter follow-up date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />
        </div>
        <button className='medicalReportSubmitButton' type="submit">Submit</button>
      </form>
    </div>
  );
};

export default MedicalReport;