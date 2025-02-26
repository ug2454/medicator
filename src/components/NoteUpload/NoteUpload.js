import React, { useState } from 'react';
import './NoteUpload.css';

const NoteUpload = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            // Create preview for image files
            if (selectedFile.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreview(reader.result);
                };
                reader.readAsDataURL(selectedFile);
            }
        }
    };

    const handleProcessedData = async (data) => {
        // For each medicine in the processed data
        for (const medicine of data.medicines) {
            try {
                // Create a new medical report for each medicine
                const response = await fetch('http://localhost:8080/api/medical-reports', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        medicineName: medicine.name,
                        dosage: medicine.dosage,
                        frequencyType: medicine.frequency,
                        duration: medicine.duration,
                        doctorNotes: data.notes
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to save medicine data');
                }
            } catch (err) {
                console.error('Error saving medicine:', err);
                setError(`Failed to save medicine: ${medicine.name}`);
            }
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file');
            return;
        }

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('note', file);

        try {
            const response = await fetch('http://localhost:8080/api/process-note', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                }
            });

            if (!response.ok) {
                throw new Error('Failed to process note');
            }

            const data = await response.json();
            console.log('Processed data:', data);
            
            // Handle the processed data
            await handleProcessedData(data);
            
            // Show success message
            alert('Note processed and saved successfully!');
            
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="note-upload-container">
            <h2>Upload Doctor's Note</h2>
            <div className="upload-section">
                <div className="file-input-container">
                    <input
                        type="file"
                        onChange={handleFileChange}
                        accept="image/*,.pdf"
                        id="note-file"
                        className="file-input"
                    />
                    <label htmlFor="note-file" className="file-label">
                        {file ? file.name : 'Choose a file'}
                    </label>
                </div>
                
                {preview && (
                    <div className="preview-container">
                        <img src={preview} alt="Preview" className="file-preview" />
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}

                <button 
                    onClick={handleUpload} 
                    disabled={!file || loading}
                    className="upload-button"
                >
                    {loading ? 'Processing...' : 'Upload and Process'}
                </button>
            </div>
        </div>
    );
};

export default NoteUpload; 