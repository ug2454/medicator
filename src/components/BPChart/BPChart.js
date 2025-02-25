import React, { useEffect, useState } from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import 'chart.js/auto';
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';
import './BPChart.css';
import useAuth from '../../useAuth';

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  annotationPlugin
);

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const BPChart = () => {
  // Call useAuth at the top level of your component
  useAuth();
  
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filteredData, setFilteredData] = useState(null);
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const [stats, setStats] = useState({
    systolicAvg: 0,
    diastolicAvg: 0,
    pulseAvg: 0,
    systolicMax: 0,
    diastolicMax: 0,
    pulseMax: 0
  });
  const [chartType, setChartType] = useState('line');
  const [trends, setTrends] = useState({ systolic: null, diastolic: null, pulse: null });
  const [medications, setMedications] = useState([]);
  const [showMedications, setShowMedications] = useState(false);

  useEffect(() => {
    console.log('API BASE URL==========', API_BASE_URL);
    console.log('UserID:', userId);
    console.log('Token:', token ? 'Present' : 'Missing');
    
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/get-bp-data?user_id=${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw fetched data:", data);
        console.log("Number of data points:", data.length);

        // Validate the structure of `data`
        if (!data || !Array.isArray(data)) {
          console.error("Invalid data format. Expected an array:", data);
          return;
        }

        // Extract dates and times
        const formattedDates = data.map(entry => {
          console.log("Processing entry:", entry);
          const [datePart] = entry.created_at.split(" ");
          const [year, month, day] = datePart.split("-");
          return `${year}-${month}-${day}`; // Convert to `yyyy-mm-dd`
        });

        const times = data.map(entry => entry.time); // Extract times
        console.log("Extracted times:", times);

        // Combine dates and times
        const combinedDateTimes = formattedDates.map((formattedDate, index) => {
          const dateTime = new Date(`${formattedDate}T${times[index]}:00`);
          console.log("Combined DateTime:", dateTime);
          return dateTime;
        });

        // Convert to readable chart labels
        const chartLabels = combinedDateTimes.map(dateObj => {
          const options = {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          };
          return dateObj.toLocaleString("en-US", options);
        });

        // Extract other data points
        const systolic = data.map(entry => entry.systolic);
        const diastolic = data.map(entry => entry.diastolic);
        const pulse = data.map(entry => entry.pulse);

        console.log("Extracted data points:", {
          systolic,
          diastolic,
          pulse
        });

        // Update chart data
        const newChartData = {
          labels: chartLabels,
          datasets: [
            {
              label: "Systolic",
              data: systolic,
              borderColor: "rgba(255, 99, 132, 1)",
              backgroundColor: "rgba(255, 99, 132, 0.2)",
              fill: false,
            },
            {
              label: "Diastolic",
              data: diastolic,
              borderColor: "rgba(54, 162, 235, 1)",
              backgroundColor: "rgba(54, 162, 235, 0.2)",
              fill: false,
            },
            {
              label: "Pulse",
              data: pulse,
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              fill: false,
            },
          ],
        };
        
        console.log("New chart data:", newChartData);
        setChartData(newChartData);

        // Calculate statistics immediately after setting chart data
        if (systolic.length > 0 && diastolic.length > 0 && pulse.length > 0) {
          const newStats = {
            systolicAvg: calculateAverage(systolic),
            diastolicAvg: calculateAverage(diastolic),
            pulseAvg: calculateAverage(pulse),
            systolicMax: calculateMax(systolic),
            diastolicMax: calculateMax(diastolic),
            pulseMax: calculateMax(pulse)
          };
          console.log("Calculated stats:", newStats);
          setStats(newStats);

          // Calculate trends
          const newTrends = {
            systolic: analyzeTrend(systolic),
            diastolic: analyzeTrend(diastolic),
            pulse: analyzeTrend(pulse)
          };
          console.log("Calculated trends:", newTrends);
          setTrends(newTrends);
        } else {
          console.log("No data points available for statistics calculation");
        }
      } catch (error) {
        console.error("Error fetching BP data:", error);
      }
    };

    if (userId && token) {
      fetchData();
    } else {
      console.error('userId or token is not defined', { userId, hasToken: !!token });
    }
  }, [userId, token, API_BASE_URL]);

  useEffect(() => {
    // Fetch medications data
    const fetchMedications = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/medicine-duration?user_id=${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          // Transform the data to match our needs
          const transformedData = data.filter(med => med.dosage).map(med => ({
            name: med.medicine_name,
            created_at: med.dosage // Using dosage date for the vertical line
          }));
          setMedications(transformedData);
        } else {
          console.error('Failed to fetch medications:', response.status);
        }
      } catch (error) {
        console.error("Error fetching medications:", error);
      }
    };

    if (userId && token) {
      fetchMedications();
    }
  }, [userId, token, API_BASE_URL]);

  const handleDateRangeChange = (type, value) => {
    setDateRange(prev => ({ ...prev, [type]: value }));
  };

  const calculateAverage = (data) => {
    if (!data || data.length === 0) return 0;
    return (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1);
  };

  const calculateMax = (data) => {
    if (!data || data.length === 0) return 0;
    return Math.max(...data);
  };

  const analyzeTrend = (data) => {
    // Simple trend analysis - compare last 3 readings
    if (data.length < 3) return null;
    
    const last3 = data.slice(-3);
    if (last3[0] < last3[1] && last3[1] < last3[2]) {
      return 'increasing';
    } else if (last3[0] > last3[1] && last3[1] > last3[2]) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  };

  const getTrendIcon = (trend) => {
    if (trend === 'increasing') return '↑';
    if (trend === 'decreasing') return '↓';
    return '→';
  };

  const getTrendClass = (trend, type) => {
    if (trend === 'increasing' && (type === 'systolic' || type === 'diastolic')) {
      return 'trend-warning';
    }
    if (trend === 'decreasing' && type === 'pulse') {
      return 'trend-warning';
    }
    return 'trend-normal';
  };

  const applyDateFilter = () => {
    if (!dateRange.start || !dateRange.end) return;

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59); // Include the entire end date

    const filteredLabels = [];
    const filteredSystolic = [];
    const filteredDiastolic = [];
    const filteredPulse = [];

    chartData.labels.forEach((label, index) => {
      const currentDate = new Date(label);
      if (currentDate >= startDate && currentDate <= endDate) {
        filteredLabels.push(label);
        filteredSystolic.push(chartData.datasets[0].data[index]);
        filteredDiastolic.push(chartData.datasets[1].data[index]);
        filteredPulse.push(chartData.datasets[2].data[index]);
      }
    });

    const filteredChartData = {
      labels: filteredLabels,
      datasets: [
        {
          ...chartData.datasets[0],
          data: filteredSystolic,
        },
        {
          ...chartData.datasets[1],
          data: filteredDiastolic,
        },
        {
          ...chartData.datasets[2],
          data: filteredPulse,
        },
      ],
    };

    setFilteredData(filteredChartData);
    
    // Update statistics for filtered data
    setStats({
      systolicAvg: calculateAverage(filteredSystolic),
      diastolicAvg: calculateAverage(filteredDiastolic),
      pulseAvg: calculateAverage(filteredPulse),
      systolicMax: calculateMax(filteredSystolic),
      diastolicMax: calculateMax(filteredDiastolic),
      pulseMax: calculateMax(filteredPulse)
    });

    // Update trends only if we have data
    if (filteredSystolic.length > 0) {
      setTrends({
        systolic: analyzeTrend(filteredSystolic),
        diastolic: analyzeTrend(filteredDiastolic),
        pulse: analyzeTrend(filteredPulse)
      });
    } else {
      setTrends({
        systolic: null,
        diastolic: null,
        pulse: null
      });
    }
  };

  const renderChart = () => {
    const currentData = filteredData || chartData;
    const options = {
      responsive: true,
      plugins: {
        annotation: showMedications ? {
          annotations: medications.map((med) => ({
            type: 'line',
            mode: 'vertical',
            scaleID: 'x',
            value: med.created_at,
            borderColor: 'rgba(0, 128, 0, 0.5)',
            borderWidth: 2,
            label: {
              content: med.name,
              enabled: true,
              position: 'top'
            }
          }))
        } : {}
      }
    };

    switch(chartType) {
      case 'bar':
        return <Bar data={currentData} options={options} />;
      case 'scatter':
        // Transform data for scatter plot
        const scatterData = {
          datasets: [
            {
              label: 'Systolic',
              data: currentData.labels.map((label, i) => ({
                x: new Date(label),
                y: currentData.datasets[0].data[i]
              })),
              backgroundColor: 'rgba(255, 99, 132, 0.5)',
            },
            {
              label: 'Diastolic',
              data: currentData.labels.map((label, i) => ({
                x: new Date(label),
                y: currentData.datasets[1].data[i]
              })),
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
            },
            {
              label: 'Pulse',
              data: currentData.labels.map((label, i) => ({
                x: new Date(label),
                y: currentData.datasets[2].data[i]
              })),
              backgroundColor: 'rgba(75, 192, 192, 0.5)',
            }
          ]
        };
        return <Scatter data={scatterData} options={{
          ...options,
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day'
              }
            }
          }
        }} />;
      default:
        return <Line data={currentData} options={options} />;
    }
  };

  const exportAsCSV = () => {
    const headers = ['Date', 'Time', 'Systolic', 'Diastolic', 'Pulse'];
    const dataRows = chartData.labels.map((label, index) => [
      label.split(',')[0], // Date part
      label.split(',')[1].trim(), // Time part
      chartData.datasets[0].data[index], // Systolic
      chartData.datasets[1].data[index], // Diastolic
      chartData.datasets[2].data[index]  // Pulse
    ]);
    
    const csvContent = [
      headers.join(','),
      ...dataRows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'blood_pressure_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add medication markers to the chart
  const getChartWithMedications = () => {
    if (!showMedications || medications.length === 0) {
      return chartData;
    }

    // Clone the chart data
    const newChartData = JSON.parse(JSON.stringify(chartData));
    
    // Add annotations for medication times
    newChartData.annotations = medications.map((med, index) => ({
      type: 'line',
      mode: 'vertical',
      scaleID: 'x',
      value: med.created_at, // Assuming medication has a date field
      borderColor: 'rgba(0, 128, 0, 0.5)',
      borderWidth: 2,
      label: {
        content: med.name,
        enabled: true,
        position: 'top'
      }
    }));
    
    return newChartData;
  };

  return (
    <div className="bp-chart-container">
      <div className="header-actions">
        <h2>Blood Pressure and Pulse Chart</h2>
        <button onClick={exportAsCSV} className="export-btn">Export as CSV</button>
      </div>
      <div className="filter-controls">
        <input 
          type="date" 
          value={dateRange.start} 
          onChange={(e) => handleDateRangeChange('start', e.target.value)} 
        />
        <span>to</span>
        <input 
          type="date" 
          value={dateRange.end} 
          onChange={(e) => handleDateRangeChange('end', e.target.value)} 
        />
        <button onClick={applyDateFilter}>Apply Filter</button>
      </div>
      <div className="chart-controls">
        <button 
          className={chartType === 'line' ? 'active' : ''} 
          onClick={() => setChartType('line')}
        >
          Line Chart
        </button>
        <button 
          className={chartType === 'bar' ? 'active' : ''} 
          onClick={() => setChartType('bar')}
        >
          Bar Chart
        </button>
        <button 
          className={chartType === 'scatter' ? 'active' : ''} 
          onClick={() => setChartType('scatter')}
        >
          Scatter Plot
        </button>
      </div>
      <div className="stats-container">
        <div className="stat-box">
          <h3>Systolic</h3>
          <p>Average: {stats.systolicAvg} mmHg</p>
          <p>Maximum: {stats.systolicMax} mmHg</p>
        </div>
        <div className="stat-box">
          <h3>Diastolic</h3>
          <p>Average: {stats.diastolicAvg} mmHg</p>
          <p>Maximum: {stats.diastolicMax} mmHg</p>
        </div>
        <div className="stat-box">
          <h3>Pulse</h3>
          <p>Average: {stats.pulseAvg} BPM</p>
          <p>Maximum: {stats.pulseMax} BPM</p>
        </div>
      </div>
      {trends.systolic && (
        <div className="trends-container">
          <div className={`trend-item ${getTrendClass(trends.systolic, 'systolic')}`}>
            <span>Systolic Trend: {getTrendIcon(trends.systolic)}</span>
          </div>
          <div className={`trend-item ${getTrendClass(trends.diastolic, 'diastolic')}`}>
            <span>Diastolic Trend: {getTrendIcon(trends.diastolic)}</span>
          </div>
          <div className={`trend-item ${getTrendClass(trends.pulse, 'pulse')}`}>
            <span>Pulse Trend: {getTrendIcon(trends.pulse)}</span>
          </div>
        </div>
      )}
      <div className="chart-controls">
        <label>
          <input 
            type="checkbox" 
            checked={showMedications} 
            onChange={() => setShowMedications(!showMedications)} 
          />
          Show Medication Times
        </label>
      </div>
      {renderChart()}
    </div>
  );
};

export default BPChart;
