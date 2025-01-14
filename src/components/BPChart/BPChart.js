import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import './BPChart.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const BPChart = () => {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/get-bp-data?user_id=${userId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw fetched data:", data);

        // Validate the structure of `data`
        if (!data || !Array.isArray(data)) {
          console.error("Invalid data format. Expected an array:", data);
          return;
        }

        // Extract dates and times
        const formattedDates = data.map(entry => {
          const [datePart] = entry.created_at.split(" ");
          const [year, month, day] = datePart.split("-");
          return `${year}-${month}-${day}`; // Convert to `yyyy-mm-dd`
        });

        const times = data.map(entry => entry.time); // Extract times

        // Combine dates and times
        const combinedDateTimes = formattedDates.map((formattedDate, index) => {
          return new Date(`${formattedDate}T${times[index]}:00`); // ISO format
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

        // Update chart data
        setChartData({
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
        });
      } catch (error) {
        console.error("Error fetching BP data:", error);
      }
    };

    if (userId) {
      fetchData();
      console.log('userId:', userId);
    } else {
      console.error('userId is not defined');
    }
  }, [userId]);

  return (
    <div className="bp-chart-container">
      <h2>Blood Pressure and Pulse Chart</h2>
      <Line data={chartData} />
    </div>
  );
};

export default BPChart;
