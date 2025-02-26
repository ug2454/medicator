import React from 'react';
import './NotesModal.css';
import { format } from 'date-fns';

const NotesModal = ({ isOpen, onClose, notes, medicineName }) => {
    if (!isOpen) return null;

    return (
        <div className="notes-modal-overlay" onClick={onClose}>
            <div className="notes-modal-content" onClick={e => e.stopPropagation()}>
                <div className="notes-modal-header">
                    <h3>Doctor's Notes</h3>
                    <div className="medicine-info">
                        <span className="medicine-name">{medicineName}</span>
                        <span className="notes-date">
                            {format(new Date(), 'dd MMM yyyy')}
                        </span>
                    </div>
                    <button className="close-notes-modal" onClick={onClose}>&times;</button>
                </div>
                <div className="notes-modal-body">
                    <div className="notes-section">
                        <div className="notes-content">
                            {notes ? (
                                <pre className="formatted-notes">{notes}</pre>
                            ) : (
                                <p className="no-notes">No notes available</p>
                            )}
                        </div>
                    </div>
                    <div className="notes-footer">
                        <button className="print-notes" onClick={() => window.print()}>
                            <i className="fas fa-print"></i> Print Notes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotesModal; 