# Fraud-Sentinel-UPI-Fake-App-Detection

Welcome to Fraud Sentinel — our prototype system designed to detect fake UPI apps that look like trusted ones such as Google Pay, PhonePe, and PayTM.

This tool checks for similarity in app names, icons, and publishers to flag suspicious apps and help protect users from scams.

Below you'll find what the system does, how it works, and how you can run it. 

*Real‑time Detection of Fake UPI Mobile Applications* using rule‑based weighted scoring, name similarity, icon hash matching, and publisher validation. Includes an interactive risk threshold controller, confusion matrix metrics, and auto‑generated takedown evidence reports.



# Problem Statement

Fake UPI apps on Android frequently impersonate trusted payment apps like Google Pay, PhonePe, and PayTM to steal user credentials and money. They mimic the *name, icon, and branding*, making it difficult for users to distinguish genuine apps. Our project detects such impersonation attempts using feature‑based analysis.



# Objective

To identify fraudulent/impersonating UPI apps using similarity signals and risk scoring, and provide automated evidence artifacts for takedown support.



#System Architecture


Store Data / Mock Dataset
         |
Feature Extraction
(Name Similarity, Icon Hash Match, Publisher Match)
         |
Weighted Risk Score Model
         |
Dynamic Threshold Classification
         |
Interactive Dashboard + Evidence Kit




# Key Features

*  Name, Icon & Publisher similarity scoring
*  Weighted rule‑based risk scoring (Name:50%, Icon:40%, Publisher:10%)
* Interactive risk threshold slider (adjust precision vs recall)
*  Real‑time confusion matrix & KPI metrics
*  Auto‑generated Takedown Evidence Kit
*  Search & filter by brand or app name
* Mock labelled dataset with ground truth


# Technology Stack

| Component       | Tech                               |
| --------------- | ---------------------------------- |
| Frontend        | HTML, CSS, TailwindCSS, JavaScript |
| Backend API     | Flask (Python)                     |
| Data Processing | Pandas, Numpy                      |
| Similarity      | FuzzyWuzzy + Custom Levenshtein    |
| Mock Dataset    | CSV labelled apps                  |
| Deployment      | Local server / browser             |


# Project Structure


Fraud-Sentinel-UPI/
│── README.md
│── /frontend
│   ├── index.html
│   ├── style.css
│   ├── script.js
│── /backend
│   ├── app.py
│   ├── requirements.txt
│── /sample_data
│   ├── mock_data.csv
│── /screenshots
│── /demo




# Running the Application

### Backend Setup (Flask)


pip install -r requirements.txt
python app.py


Runs at: http://127.0.0.1:5000/

### Frontend

Open index.html in any browser.



##  Model Performance & Metrics

Confusion matrix values auto‑calculated in dashboard:


TP = Caught Fake Apps
FP = Wrongly flagged genuine apps
FN = Missed fake apps
TN = Correct genuine identifications
Precision, Recall, F1‑Score displayed live




# Evidence Kit Output Example

Automatically generated cards include:

* Package ID
* Risk Score
* Name & Icon similarity breakdown
* Publisher mismatch indicator
* Suggested takedown recommendation



# Constraints

* Limited labelled dataset
* No official Play Store API
* Mocked icon hash values
* Only 3 UPI brands supported
* Local execution; no cloud scale


# Current Limitations / Future Scope

| Area     | Current    | Future Improvement                    |
| -------- | ---------- | ------------------------------------- |
| Data     | Mock CSV   | Real scraping + DB                    |
| Model    | Rule‑based | ML anomaly detection                  |
| Evidence | UI display | PDF export + automated takedown email |
| Scope    | 3 apps     | Full digital payments ecosystem       |



## Team Members

* Vanshika Malhotra — Backend & Dataset
* Wagisha Kumar — Frontend & UI
* Vagisha Singh — Research & Model

# Scope

UPI ecosystem only — focused on detecting impersonation of major UPI apps such as Google Pay, PhonePe, and PayTM.

# License

MIT License



## Acknowledgment

Academic prototype for hackathon evaluation. Not for production use.

# Dashboard Preview

Here are a few snapshots from our working prototype interface that highlight the core features of the system:

### System Overview & Metrics Dashboard

<img width="1891" height="913" alt="Screenshot 2025-11-21 151231" src="https://github.com/user-attachments/assets/47715e0c-90b2-4537-886a-d01bc5aec195" />


### Detection Feed Table

<img width="1894" height="922" alt="Screenshot 2025-11-21 151304" src="https://github.com/user-attachments/assets/8d28b030-82b0-428c-a56b-ddbf09b105c8" />


### Takedown Evidence Kit
<img width="1874" height="789" alt="Screenshot 2025-11-21 151337" src="https://github.com/user-attachments/assets/daa10176-b04c-45cd-b97a-67bda65ef035" />

(Screenshot of evidence cards generated for high‑risk apps)

---
