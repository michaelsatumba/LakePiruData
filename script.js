const LAKE_PIRU_CAPACITY_ACFT = 83240; // Approximate full capacity of Lake Piru in acre-feet

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

async function fetchLakePiruStorageByRange(startDate, endDate) {
    const siteId = '11109700'; // LK PIRU NR PIRU CA
    const parameterCode = '00054'; // Reservoir storage, acre-feet

    const apiUrl = `https://api.waterdata.usgs.gov/ogcapi/v0/collections/daily/items?f=json&monitoring_location_id=USGS-${siteId}&parameter_code=${parameterCode}&time=${startDate}/${endDate}`;

    const loadingMessage = document.getElementById('loadingMessage');
    const storageDataContainer = document.getElementById('lakePiruStorage');
    const currentSummaryDiv = document.getElementById('currentSummary');
    const chartCanvas = document.getElementById('lakePiruStorageChart'); // Get the canvas element

    loadingMessage.textContent = 'Loading data...';
    storageDataContainer.innerHTML = ''; // Clear previous table data
    currentSummaryDiv.innerHTML = ''; // Clear previous summary data

    // Ensure the canvas context is available before trying to create a chart
    if (!chartCanvas) {
        console.error('Chart canvas element not found!');
        loadingMessage.textContent = 'Error: Chart display area missing.';
        return; // Exit if the canvas isn't there
    }
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2D context from canvas!');
        loadingMessage.textContent = 'Error: Chart rendering context missing.';
        return; // Exit if context isn't available
    }


    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        loadingMessage.style.display = 'none'; // Hide loading message

        if (data.features && data.features.length > 0) {
            // Sort data by date (most recent first)
            data.features.sort((a, b) => new Date(b.properties.time) - new Date(a.properties.time));

            // Get the most recent storage value for the summary
            const latestStorage = data.features[0].properties.value;
            const latestDate = new Date(data.features[0].properties.time);
            const percentCapacity = ((latestStorage / LAKE_PIRU_CAPACITY_ACFT) * 100).toFixed(1);

            const gaugeContainer = document.getElementById('lakePiruGauge');
            gaugeContainer.innerHTML = `
            <div class="gauge-labels">
                <span>E</span>
                <span>F</span>
            </div>
            <div class="gauge-percent">${percentCapacity}%</div>
            <div class="gauge-fill" style="width: ${percentCapacity}%;"></div>
            `;

            // Check if data is stale (older than 7 days)
            const today = new Date();
            const daysOld = Math.floor((today - latestDate) / (1000 * 60 * 60 * 24));
            let warning = '';
            if (daysOld > 7) {
                warning = `<div style="color: orange; font-weight: bold; margin-bottom: 8px;">
                    Warning: Latest data is ${daysOld} days old (last update: ${latestDate.toLocaleDateString('en-US')})
                </div>`;
            }

            currentSummaryDiv.innerHTML = `
                ${warning}
                As of ${latestDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric'})},
                Lake Piru's storage is <span style="font-size:1.1em;">${latestStorage.toLocaleString()} ac-ft</span>,
                which is <span style="font-size:1.1em;">${percentCapacity}%</span> of its capacity.
            `;

            // Prepare data for Chart.js
            // Filter out any data points with null or undefined values if necessary
            const chartData = data.features
                .filter(feature => feature.properties.value !== null && feature.properties.value !== undefined)
                .map(feature => ({
                    x: new Date(feature.properties.time),
                    y: feature.properties.value
                })).reverse(); // Reverse to have oldest data first for the chart

            // Destroy existing chart if it exists and is a valid Chart instance
            if (lakePiruStorageChart instanceof Chart) { // Use instanceof for robust checking
                lakePiruStorageChart.destroy();
                lakePiruStorageChart = null; // Reset to null after destruction
            }

            // Only create the chart if there is data to display
             if (chartData.length > 0) {
                lakePiruStorageChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        datasets: [{
                            label: 'Lake Piru Storage (Acre-Feet)',
                            data: chartData,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            fill: false,
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    unit: 'day',
                                    // CHANGE D to d HERE:
                                    tooltipFormat: 'MMM d, yyyy', // Changed 'MMM D, yyyy' to 'MMM d, yyyy'
                                    displayFormats: {
                                        // CHANGE D to d HERE:
                                        day: 'MMM d', // Changed 'MMM D' to 'MMM d'
                                        month: 'MMM yyyy',
                                        year: 'yyyy'
                                    }
                                },
                                title: {
                                    display: true,
                                    text: 'Date'
                                }
                            },
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Storage (Acre-Feet)'
                                },
                                ticks: {
                                    callback: function(value, index, values) {
                                        return value.toLocaleString();
                                    }
                                }
                            }
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                            label += context.parsed.y.toLocaleString() + ' ac-ft';
                                        }
                                        return label;
                                    }
                                }
                            }
                        }
                    }
                });
            } else {
                storageDataContainer.innerHTML = '<p>No valid storage data found for Lake Piru in the selected period to display on chart.</p>';
                if (lakePiruStorageChart instanceof Chart) {
                    lakePiruStorageChart.destroy();
                    lakePiruStorageChart = null;
                }
            }


            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Storage (Acre-Feet)</th>
                            <th>% Capacity</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.features.forEach(feature => {
                const properties = feature.properties;
                const timestamp = new Date(properties.time);
                const dateString = timestamp.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const value = properties.value;
                const status = properties.approval_status;
                const dailyPercentCapacity = ((value / LAKE_PIRU_CAPACITY_ACFT) * 100).toFixed(1);

                tableHTML += `
                    <tr>
                        <td>${dateString}</td>
                        <td>${value.toLocaleString()}</td>
                        <td>${dailyPercentCapacity}%</td>
                        <td>${status}</td>
                    </tr>
                `;
            });

            tableHTML += `
                    </tbody>
                </table>
            `;
            storageDataContainer.innerHTML = tableHTML;
        } else {
            storageDataContainer.innerHTML = '<p>No reservoir storage data found for Lake Piru in the selected period.</p>';
            if (lakePiruStorageChart instanceof Chart) { // Check before destroying
                lakePiruStorageChart.destroy();
                lakePiruStorageChart = null;
            }
        }

    } catch (error) {
        console.error('Error fetching Lake Piru storage data:', error);
        loadingMessage.style.display = 'none';
        currentSummaryDiv.innerHTML = '';
        storageDataContainer.innerHTML = `<p style="color: red;">Failed to load data: ${error.message}</p>`;
        if (lakePiruStorageChart instanceof Chart) { // Check before destroying
            lakePiruStorageChart.destroy();
            lakePiruStorageChart = null;
        }
    }
}

// function to fetch and display discharge data for Piru Creek below Santa Felicia Dam
async function fetchPiruCreekDischargeByRange(startDate, endDate) {
    const siteId = '11109800'; // PIRU CREEK BLW SANTA FELICIA DAM CA
    const parameterCode = '00060'; // Discharge, cubic feet per second

    const apiUrl = `https://api.waterdata.usgs.gov/ogcapi/v0/collections/daily/items?f=json&monitoring_location_id=USGS-${siteId}&parameter_code=${parameterCode}&time=${startDate}/${endDate}`;

    const loadingMessage = document.getElementById('dischargeLoadingMessage');
    const dischargeDataContainer = document.getElementById('piruCreekDischarge');

    loadingMessage.textContent = 'Loading discharge data...';
    dischargeDataContainer.innerHTML = '';

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        loadingMessage.style.display = 'none';

        if (data.features && data.features.length > 0) {
            // Sort data by date (most recent first)
            data.features.sort((a, b) => new Date(b.properties.time) - new Date(a.properties.time));

            // Get the most recent discharge value for the summary
            const latestDischarge = parseFloat(data.features[0].properties.value);
            const latestDate = new Date(data.features[0].properties.time);

            let summaryHTML = `
                <div class="discharge-summary">
                As of ${latestDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric'})},
                Piru Creek below Santa Felicia Dam discharge is
                <span>${latestDischarge.toLocaleString()} ft³/s</span>.
                </div>
                `;

            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Discharge (ft³/s)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.features.forEach(feature => {
                const properties = feature.properties;
                const timestamp = new Date(properties.time);
                const dateString = timestamp.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const value = parseFloat(properties.value);
                const status = properties.approval_status;

                tableHTML += `
                    <tr>
                        <td>${dateString}</td>
                        <td>${value.toLocaleString()}</td>
                        <td>${status}</td>
                    </tr>
                `;
            });

            tableHTML += `
                    </tbody>
                </table>
            `;

            dischargeDataContainer.innerHTML = summaryHTML + tableHTML;
        } else {
            dischargeDataContainer.innerHTML = '<p>No discharge data found for Piru Creek in the selected period.</p>';
        }
    } catch (error) {
        console.error('Error fetching Piru Creek discharge data:', error);
        loadingMessage.style.display = 'none';
        dischargeDataContainer.innerHTML = `<p style="color: red;">Failed to load discharge data: ${error.message}</p>`;
    }
}

// Listen for date range changes
document.addEventListener('DOMContentLoaded', () => {
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    const fetchBtn = document.getElementById('fetchDataBtn');

    // Set default dates (last 3 months)
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    startInput.value = formatDate(threeMonthsAgo);
    endInput.value = formatDate(today);

    fetchBtn.addEventListener('click', () => {
        const start = startInput.value;
        const end = endInput.value;
        if (start && end && start <= end) {
            fetchLakePiruStorageByRange(start, end);
            fetchPiruCreekDischargeByRange(start, end);
        }
    });

    // Initial load
    fetchLakePiruStorageByRange(startInput.value, endInput.value);
    fetchPiruCreekDischargeByRange(startInput.value, endInput.value);
});