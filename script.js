const TARGET_APPS = {
    // Key: Short Brand Name | Value: Official Details
    "PayTM": { "Name": "PayTM - Official", "Publisher": "One97 Comms", "IconHash": "p123q456r789s01t" },
    "PhonePe": { "Name": "PhonePe - Official", "Publisher": "PhonePe Pvt Ltd", "IconHash": "h123i456j789k01l" },
    "GPay": { "Name": "Google Pay", "Publisher": "Google LLC", "IconHash": "g123h456i789j01k" }
};

// Mock data representing apps found in a store search, including "Ground Truth" for testing our model.
const MOCK_CSV_DATA = `
App Name,Package ID,Publisher,Icon Hash (Mock),Impersonating_Target,Ground Truth
PayTM - Official,com.paytm.app,One97 Comms,p123q456r789s01t,PayTM,Genuine
PhonePe - Official,com.phonepe.app,PhonePe Pvt Ltd,h123i456j789k01l,PhonePe,Genuine
Google Pay,com.google.android.apps.nbu.paisa.user,Google LLC,g123h456i789j01k,GPay,Genuine
GPay Loan,com.google.pay.loan.app,Google LLC,g123h456i789j01k,GPay,Genuine
Phonpe Wallet,com.phonpe.wallet.free,XYZ Devs,a345b567c890d12e,PhonePe,Fake
PaytM Update,com.paytm.update,Updates Inc,p123q456r789s01t,PayTM,Fake
PtyM,com.payt.m,Secure Apps LLC,a345b567c890d12e,PayTM,Fake
PhonE Pay,com.phonep.app,Secure Apps LLC,h123i456j789k01l,PhonePe,Fake
G Pay Wallet,com.gpay.wallet.app,Secure Apps LLC,g123h456i789j01k,GPay,Fake
UPI Wallet 2024,com.upi.wallet.pro,Unknown Dev,z987y654x321w00v,PayTM,Fake
`.trim();

// Global variable to hold our processed app data
window.finalResults = [];

// --- 2. Data Parsing ---

function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });
        data.push(row);
    }
    return data;
}

// --- 3. Similarity Check (Levenshtein Distance for Typos) ---
// This function calculates how many changes (edits) are needed to turn string A into string B.
function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = (a[j - 1] === b[i - 1]) ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1, // Deletion
                matrix[i][j - 1] + 1, // Insertion
                matrix[i - 1][j - 1] + cost // Substitution
            );
        }
    }
    return matrix[b.length][a.length];
}

// Converts the distance into a 0-1 ratio (1.0 = perfect match, 0.0 = completely different)
function getNameMatchScore(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    const distance = getLevenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    // Similarity is 1 - (Normalized Distance)
    return maxLen > 0 ? (1 - (distance / maxLen)) : 0; 
}

// --- 4. Feature Extractors (Signals) ---

function get_name_similarity(appName, targetBrand) {
    const target = TARGET_APPS[targetBrand];
    if (!target) return 0.0;
    // Score based on how similar the app name is to the official name.
    return getNameMatchScore(target.Name, appName);
}

function get_publisher_match(publisher, targetBrand) {
    const target = TARGET_APPS[targetBrand];
    if (!target) return 0.0;
    // Score is 1.0 if the publisher names are an exact match, 0.0 otherwise.
    return publisher === target.Publisher ? 1.0 : 0.0;
}

function get_icon_similarity(iconHash, targetBrand) {
    const target = TARGET_APPS[targetBrand];
    if (!target) return 0.0;
    // Score is 1.0 if the icon's hash (digital fingerprint) matches the official one, 0.0 otherwise.
    return iconHash === target.IconHash ? 1.0 : 0.0;
}

// --- 5. Risk Scoring and Classification ---

function calculate_risk_and_classify(df, threshold) {
    // How much each signal contributes to the final risk calculation
    const WEIGHT_NAME = 0.50; // Name dissimilarity is critical
    const WEIGHT_ICON = 0.40; // Icon dissimilarity is critical
    const WEIGHT_PUB = 0.10;  // Publisher mismatch is a strong, definitive signal
    
    // The cutoff point: if the risk score is at or above this value, it's flagged as FAKE.
    const CLASSIFICATION_THRESHOLD = threshold; 

    // Create a fresh copy of data for classification updates
    const classifiedData = JSON.parse(JSON.stringify(df));

    classifiedData.forEach(row => {
        // Feature calculation: only run once on the initial load
        if (typeof row.Name_Match_Score === 'undefined') {
            row.Name_Match_Score = get_name_similarity(row['App Name'], row['Impersonating_Target']);
            row.Publisher_Match = get_publisher_match(row.Publisher, row['Impersonating_Target']);
            row.Icon_Match_Score = get_icon_similarity(row['Icon Hash (Mock)'], row['Impersonating_Target']);
            
            // Risk Score V2 is calculated from the DISSIMILARITY (1 - score)
            // A score closer to 1.0 means HIGH RISK/FAKE.
            row.Risk_Score = (
                (1 - row.Name_Match_Score) * WEIGHT_NAME +    
                (1 - row.Icon_Match_Score) * WEIGHT_ICON +    
                (1 - row.Publisher_Match) * WEIGHT_PUB   
            );
        }

        // Re-classify based on the current threshold set by the user
        row.Classification = row.Risk_Score >= CLASSIFICATION_THRESHOLD ? 'HIGH RISK FAKE' : 'CLEAN';
    });

    return classifiedData;
}

// --- 6. Rendering Functions ---

function filterAndRenderDetectionFeed(data, searchTerm = '') {
    const tbody = document.getElementById('detection-table-body');
    tbody.innerHTML = ''; 
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

    const filteredData = data.filter(row => {
        if (lowerCaseSearchTerm === '') return true;
        
        const appName = row['App Name'].toLowerCase();
        const target = row.Impersonating_Target.toLowerCase();
        
        return appName.includes(lowerCaseSearchTerm) || target.includes(lowerCaseSearchTerm);
    });

    if (filteredData.length === 0 && lowerCaseSearchTerm !== '') {
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-gray-500">No results found for "${searchTerm}".</td></tr>`;
        return;
    }

    filteredData.forEach(row => {
        const isFake = row.Classification === 'HIGH RISK FAKE';
        // Red for HIGH RISK, Green for CLEAN
        const scoreBgClass = isFake ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100';
        const scoreTextClass = isFake ? 'text-red-700' : 'text-green-700';
        
        const tr = document.createElement('tr');
        tr.className = scoreBgClass + ' transition duration-150 ease-in-out cursor-pointer';
        
        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${row['App Name']}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${row.Impersonating_Target}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${row.Name_Match_Score.toFixed(2)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${row.Icon_Match_Score.toFixed(2)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-bold ${scoreTextClass}">${row.Risk_Score.toFixed(2)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-extrabold ${scoreTextClass}">${row.Classification}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${row['Ground Truth']}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Creates a visual card for a key metric
function createMetricCard(title, value, subtitle, color) {
    // Determine Tailwind colors based on a simple string input
    let bgColor, borderColor, valueColor;
    if (color === 'red') {
        bgColor = 'bg-red-50'; borderColor = 'border-red-500'; valueColor = 'text-red-700';
    } else if (color === 'green') {
        bgColor = 'bg-green-50'; borderColor = 'border-green-500'; valueColor = 'text-green-700';
    } else if (color === 'accent') {
        bgColor = 'bg-indigo-50'; borderColor = 'border-indigo-500'; valueColor = 'text-indigo-700';
    } else { // Default/Primary
        bgColor = 'bg-blue-50'; borderColor = 'border-blue-500'; valueColor = 'text-blue-700';
    }

    return `
        <div class="card p-5 ${bgColor} border-l-4 ${borderColor} transition duration-300 hover:shadow-xl hover:scale-[1.02]">
            <p class="text-sm font-medium text-gray-500">${title}</p>
            <p class="text-4xl font-extrabold ${valueColor}">${value}</p>
            <p class="text-xs text-gray-400 mt-1">${subtitle}</p>
        </div>
    `;
}

// Renders the overall model performance metrics
function renderMetrics(data) {
    const metricsOutput = document.getElementById('metrics-output');
    
    // Confusion Matrix Counts:
    let TP = 0, FP = 0, FN = 0, TN = 0; // True Positive, False Positive, etc.

    data.forEach(row => {
        const isPositive = row.Classification === 'HIGH RISK FAKE'; // Model's Prediction (P)
        const isActualFake = row['Ground Truth'] === 'Fake'; // Reality (N)

        if (isPositive && isActualFake) TP++; 
        else if (isPositive && !isActualFake) FP++; 
        else if (!isPositive && isActualFake) FN++; 
        else if (!isPositive && !isActualFake) TN++; 
    });

    // Metric Calculations (Simplified for Display):
    const precision = (TP + FP) > 0 ? TP / (TP + FP) : 0; // Detection Reliability
    const recall = (TP + FN) > 0 ? TP / (TP + FN) : 0;     // Detection Coverage
    const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0; // Balance

    
    metricsOutput.innerHTML = `
        <div class="space-y-2">
            <h3 class="font-bold text-gray-900 mb-1">Confusion Matrix:</h3>
            <p class="text-sm">True Positives (Caught Fakes): <span class="font-bold text-red-600">${TP}</span></p>
            <p class="text-sm">False Positives (Wrongly Flagged Clean App): <span class="font-bold text-yellow-700">${FP}</span></p>
            <p class="text-sm">False Negatives (Missed Fake App): <span class="font-bold text-red-600">${FN}</span></p>
            <p class="text-sm">True Negatives (Correctly Identified Clean App): <span class="font-bold text-green-600">${TN}</span></p>
        </div>
        <div class="pt-4 border-t border-gray-200 mt-4 space-y-3">
            <h3 class="font-bold text-gray-900 mb-1">Key Performance Indicators:</h3>
            <p class="text-xl font-extrabold text-gray-800">Precision: <span class="text-green-600">${precision.toFixed(4)}</span></p>
            <p class="text-xl font-extrabold text-gray-800">Recall: <span class="text-green-600">${recall.toFixed(4)}</span></p>
            <p class="text-xl font-extrabold text-gray-800">F1-Score: <span class="text-green-600">${f1Score.toFixed(4)}</span></p>
        </div>
    `;

    // Render summary cards with simpler titles for the overview
    const summaryContainer = document.getElementById('metrics-summary');
    summaryContainer.innerHTML = `
        ${createMetricCard('Total Apps Scanned', data.length, 'Total Data Points Analyzed', 'primary')}
        ${createMetricCard('Fakes Identified (TP)', TP, 'True Positives (Caught Fakes)', 'red')}
        ${createMetricCard('Detection Reliability (Precision)', `${(precision * 100).toFixed(1)}%`, 'How trustworthy our "Fake" flags are.', 'green')}
        ${createMetricCard('Detection Coverage (Recall)', `${(recall * 100).toFixed(1)}%`, 'Percentage of all fakes that we caught.', 'accent')}
    `;
}

// Renders the specific details needed to report and take down a fake app
function renderTakedownKit(data) {
    const takedownKit = document.getElementById('takedown-kit');
    takedownKit.innerHTML = ''; 

    // Only show apps flagged as HIGH RISK FAKE
    const suspects = data.filter(row => row.Classification === 'HIGH RISK FAKE');

    if (suspects.length === 0) {
        takedownKit.innerHTML = `<p class="text-gray-500 italic p-4 text-center">No **HIGH RISK FAKE** apps detected in the current sample above the active threshold. Lower the threshold to increase sensitivity.</p>`;
        return;
    }

    suspects.forEach((row, index) => {
        const targetApp = TARGET_APPS[row['Impersonating_Target']];
        
        const card = document.createElement('div');
        card.className = 'p-4 rounded-xl bg-white border border-red-300 shadow-md';
        card.innerHTML = `
            <h3 class="text-xl font-extrabold text-red-800 border-b pb-1 mb-2">TAKEDOWN REQUEST #${index + 1}: ${row['App Name']}</h3>
            <p class="text-sm text-gray-700"><strong>Impersonating Brand:</strong> ${row['Impersonating_Target']} (Official Publisher: ${targetApp.Publisher})</p>
            <p class="text-sm text-gray-700 mb-2"><strong>Unique App Identifier (Package ID):</strong> <span class="bg-yellow-100 px-2 py-0.5 rounded text-xs font-mono text-yellow-800">${row['Package ID']}</span></p>
            <ul class="list-disc ml-5 mt-2 text-gray-800 space-y-1 text-sm">
                <li><strong>Final Risk Score:</strong> <span class="font-bold text-red-600">${row.Risk_Score.toFixed(2)}</span> (Score &ge; ${document.getElementById('risk-threshold').value} is HIGH RISK)</li>
                <li><strong>Name Match Score:</strong> ${row.Name_Match_Score.toFixed(2)} (Target: ${targetApp.Name})</li>
                <li><strong>Icon Match Score:</strong> ${row.Icon_Match_Score.toFixed(2)} (1.00 indicates icon hash matches the official icon.)</li>
                <li><strong>Publisher Match:</strong> <span class="font-bold ${row.Publisher_Match === 0 ? 'text-red-600' : 'text-green-600'}">${row.Publisher_Match}</span> (0.00 indicates a critical Mismatch: Suspect Publisher: ${row.Publisher})</li>
            </ul>
            <p class="mt-3 text-red-700 font-bold text-base bg-red-100 p-2 rounded-lg text-center shadow-inner">ACTION RECOMMENDED: IMMEDIATE TAKEDOWN REPORT.</p>
        `;
        takedownKit.appendChild(card);
    });
}

// --- 7. Main Logic Controller ---

function runMainRenderLogic() {
    // 1. Get current settings
    const thresholdInput = document.getElementById('risk-threshold');
    const currentThreshold = parseFloat(thresholdInput.value);
    document.getElementById('threshold-value').textContent = currentThreshold.toFixed(2);
    
    // 2. Recalculate the "HIGH RISK FAKE" classification based on the new threshold
    const classifiedData = calculate_risk_and_classify(window.finalResults, currentThreshold);
    
    // 3. Filter the main table based on the search box
    const searchTerm = document.getElementById('search-input').value;
    filterAndRenderDetectionFeed(classifiedData, searchTerm);
    
    // 4. Update all summary metrics and the Takedown Report
    renderMetrics(classifiedData);
    renderTakedownKit(classifiedData);
}

// --- 8. Initialization (Runs when the page loads) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Parse the initial data
    const rawData = parseCSV(MOCK_CSV_DATA);
    
    // 2. Calculate permanent feature scores (Similarity, Match) once.
    // Use a zero threshold just to ensure the initial scores are calculated on all data.
    window.finalResults = calculate_risk_and_classify(rawData, 0.0); 
    
    // 3. Run the full render cycle with the default threshold (0.40)
    runMainRenderLogic();

    // 4. Set up interactive elements
    document.getElementById('search-input').addEventListener('input', runMainRenderLogic);
    
    const thresholdInput = document.getElementById('risk-threshold');
    // Re-render everything whenever the user adjusts the sensitivity slider
    thresholdInput.addEventListener('input', runMainRenderLogic); 
});