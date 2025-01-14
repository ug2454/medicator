import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '../Home/Home';
import Login from '../Login/Login';
import Signup from '../Signup/Signup';
import Layout from '../Layout/Layout';
import ProtectedRoute from '../ProtectedRoute/ProtectedRoute';
import MedicalReport from '../MedicalReport/MedicalReport';
import MedicineDuration from '../MedicineDuration/MedicineDuration';
import LogBP from '../LogBP/LogBP';
import BPChart from '../BPChart/BPChart';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Login /></ProtectedRoute>} />
        <Route path="/login" element={<ProtectedRoute><Login /></ProtectedRoute>} />
        <Route path="/signup" element={<ProtectedRoute><Signup /></ProtectedRoute>} />
        <Route path="/" element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/add-medical-report" element={<MedicalReport />} />
          <Route path="/medicine-duration" element={<MedicineDuration />} />
          <Route path="/log-bp" element={<LogBP />} />
          <Route path="/bp-chart" element={<BPChart />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;