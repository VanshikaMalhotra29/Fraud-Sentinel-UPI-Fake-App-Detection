from flask import Flask, jsonify, request
import pandas as pd
import numpy as np
from fuzzywuzzy import fuzz
from io import StringIO # Need to import StringIO here

app = Flask(__name__)

# --- 1. CONFIGURATION AND MOCK DATA ---
# This data should eventually be loaded from a database.

TARGET_APPS = {
    "PayTM": {"Name": "PayTM - Official", "Publisher": "One97 Comms", "IconHash": "p123q456r789s01t"},
    "PhonePe": {"Name": "PhonePe - Official", "Publisher": "PhonePe Pvt Ltd", "IconHash": "h123i456j789k01l"},
    "GPay": {"Name": "Google Pay", "Publisher": "Google LLC", "IconHash": "g123h456i789j01k"}
}

MOCK_CSV_DATA = """
App Name,Package ID,Publisher,Icon Hash (Mock),Impersonating_Target,Ground Truth
PayTM - Official,com.paytm.app,One97 Comms,p123q456r789s01t,PayTM,Genuine
PhonePe - Official,com.phonepe.app,PhonePe Pvt Ltd,h123i456j789k01l,PhonePe,Genuine
Google Pay,com.google.android.apps.nbu.paisa.user,Google LLC,g123h456i789j01k,GPay,Genuine
GPay Loan,com.google.pay.loan.app,Google LLC,g123h456i789j01k,GPay,Genuine
Phonpe Wallet,com.phonpe.wallet.free,XYZ Devs,a345b567c890d12e,PhonePe,Fake
PaytM Update,com.paytm.update,Updates Inc,p123q456r789s01t,PayTM,Fake
PtyM,com.payt.m,Secure Apps LLC,a345b567c890d12e,PayTM,Fake
PhonE Pay,com.phonep.app,Secure Apps LLC,h123i456j789k01l,PhonePe,Fake
G Pay Wallet,com.gpay.wallet.app,Secure Apps LLC,g123h456i789k01k,GPay,Fake
UPI Wallet 2024,com.upi.wallet.pro,Unknown Dev,z987y654x321w00v,PayTM,Fake
"""

# Store the processed dataframe globally (simulating a cached result)
global_df = None


# --- 2. FEATURE ENGINEERING & SCORING ---

def get_name_similarity(app_name, target_brand):
    """Calculates name similarity using Levenshtein ratio."""
    target_name = TARGET_APPS.get(target_brand, {}).get("Name", "")
    if not target_name:
        return 0.0
    # fuzzywuzzy returns a score from 0-100. Normalize to 0-1.0.
    return fuzz.ratio(target_name.lower(), app_name.lower()) / 100.0

def get_publisher_match(publisher, target_brand):
    """Checks for exact publisher match."""
    target_publisher = TARGET_APPS.get(target_brand, {}).get("Publisher", "")
    return 1.0 if publisher == target_publisher else 0.0

def get_icon_similarity(icon_hash, target_brand):
    """Checks for exact icon hash match."""
    target_icon_hash = TARGET_APPS.get(target_brand, {}).get("IconHash", "")
    return 1.0 if icon_hash == target_icon_hash else 0.0

def calculate_risk_and_features(df):
    """Calculates all features and the final risk score."""
    
    # ⚠️ Weights for the Rule-Based Model
    WEIGHT_NAME = 0.50
    WEIGHT_ICON = 0.40
    WEIGHT_PUB = 0.10

    df['Name_Match_Score'] = df.apply(
        lambda row: get_name_similarity(row['App Name'], row['Impersonating_Target']), axis=1
    )
    df['Publisher_Match'] = df.apply(
        lambda row: get_publisher_match(row['Publisher'], row['Impersonating_Target']), axis=1
    )
    df['Icon_Match_Score'] = df.apply(
        lambda row: get_icon_similarity(row['Icon Hash (Mock)'], row['Impersonating_Target']), axis=1
    )

    # Risk Score calculation (based on DISSIMILARITY: 1 - score)
    # Score closer to 1.0 means HIGH RISK/FAKE.
    df['Risk_Score'] = (
        (1 - df['Name_Match_Score']) * WEIGHT_NAME +
        (1 - df['Icon_Match_Score']) * WEIGHT_ICON +
        (1 - df['Publisher_Match']) * WEIGHT_PUB
    )
    
    # Round scores for clean presentation
    df['Name_Match_Score'] = df['Name_Match_Score'].round(4)
    df['Icon_Match_Score'] = df['Icon_Match_Score'].round(4)
    df['Risk_Score'] = df['Risk_Score'].round(4)
    df['Publisher_Match'] = df['Publisher_Match'].round(4)
    
    return df

def classify_and_calculate_metrics(df, threshold):
    """Applies classification and computes performance metrics."""
    
    # Apply Classification
    df['Classification'] = np.where(
        df['Risk_Score'] >= threshold, 'HIGH RISK FAKE', 'CLEAN'
    )

    # Calculate Confusion Matrix
    TP = ((df['Classification'] == 'HIGH RISK FAKE') & (df['Ground Truth'] == 'Fake')).sum()
    FP = ((df['Classification'] == 'HIGH RISK FAKE') & (df['Ground Truth'] == 'Genuine')).sum()
    FN = ((df['Classification'] == 'CLEAN') & (df['Ground Truth'] == 'Fake')).sum()
    TN = ((df['Classification'] == 'CLEAN') & (df['Ground Truth'] == 'Genuine')).sum()

    # Calculate Metrics
    precision = TP / (TP + FP) if (TP + FP) > 0 else 0
    recall = TP / (TP + FN) if (TP + FN) > 0 else 0
    f1_score = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    metrics = {
        "TP": int(TP), "FP": int(FP), "FN": int(FN), "TN": int(TN),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1_score, 4),
        "total_scanned": len(df)
    }

    return metrics

# --- 3. API ENDPOINTS ---

# The initialize_data function is now a standard function, no decorator needed.
def initialize_data():
    """Initial processing of mock data before the server starts."""
    global global_df
    # from io import StringIO is now at the top of the file
    df_raw = pd.read_csv(StringIO(MOCK_CSV_DATA))
    global_df = calculate_risk_and_features(df_raw)
    print("Fraud Sentinel Backend Initialized and Scores Calculated.")


@app.route('/api/v1/data', methods=['GET'])
def get_data():
    """Returns the processed app data with classification based on the requested threshold."""
    
    # Get threshold from query parameter (default to 0.40)
    threshold = float(request.args.get('threshold', 0.40))
    
    # Apply classification using the requested threshold
    df_classified = global_df.copy()
    df_classified['Classification'] = np.where(
        df_classified['Risk_Score'] >= threshold, 'HIGH RISK FAKE', 'CLEAN'
    )
    
    # Select columns for the frontend
    display_cols = [
        'App Name', 'Impersonating_Target', 'Name_Match_Score', 
        'Icon_Match_Score', 'Risk_Score', 'Classification', 'Ground Truth',
        'Package ID', 'Publisher_Match', 'Publisher' # Added for Takedown Kit
    ]
    
    return jsonify(df_classified[display_cols].to_dict(orient='records'))

@app.route('/api/v1/metrics', methods=['GET'])
def get_metrics():
    """Returns the model performance metrics based on the requested threshold."""
    
    # Get threshold from query parameter (default to 0.40)
    threshold = float(request.args.get('threshold', 0.40))
    
    metrics = classify_and_calculate_metrics(global_df.copy(), threshold)
    
    return jsonify(metrics)


# --- 4. RUN SERVER ---

if __name__ == '__main__':
    # 💥 CRITICAL FIX: Call the initialization function directly here!
    initialize_data() 
    
    # Start the server and enable CORS for local development (optional, but helpful)
    # For a production environment, set up a proper CORS policy.
    from flask_cors import CORS
    CORS(app)
    app.run(debug=True, port=5000)