const LAKE_PIRU_CAPACITY_ACFT = 83240; // Approximate full capacity of Lake Piru in acre-feet

async function fetchLakePiruStorage(timePeriod = 'P3M') {
    const siteId = '11109700'; // LK PIRU NR PIRU CA
    const parameterCode = '00054'; // Reservoir storage, acre-feet

    const apiUrl = `https://api.waterdata.usgs.gov/ogcapi/v0/collections/daily/items?f=json&monitoring_location_id=USGS-${siteId}&parameter_code=${parameterCode}&time=${timePeriod}`;

    const loadingMessage = document.getElementById('loadingMessage');
    const storageDataContainer = document.getElementById('lakePiruStorage');
    const currentSummaryDiv = document.getElementById('currentSummary');

    loadingMessage.textContent = 'Loading data...';
    storageDataContainer.innerHTML = ''; // Clear previous table data
    currentSummaryDiv.innerHTML = ''; // Clear previous summary data

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
        }

    } catch (error) {
        console.error('Error fetching Lake Piru storage data:', error);
        loadingMessage.style.display = 'none';
        currentSummaryDiv.innerHTML = '';
        storageDataContainer.innerHTML = `<p style="color: red;">Failed to load data: ${error.message}</p>`;
    }
}

// Listen for changes to the time period select
document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('timePeriodSelect');
    if (select) {
        select.addEventListener('change', () => {
            fetchLakePiruStorage(select.value);
        });
        fetchLakePiruStorage(select.value); // Initial load
    } else {
        fetchLakePiruStorage(); // Fallback if select not found
    }
});