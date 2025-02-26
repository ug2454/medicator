import React from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-modal" onClick={onClose}>&times;</button>
                <h3>{title}</h3>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal; 