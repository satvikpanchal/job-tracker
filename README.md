# Job Tracker

A simple **FastAPI + Tailwind CSS** app that automatically tracks job applications from your Gmail inbox.  
It uses the Gmail API to fetch emails and Gemini AI to classify whether the emails are job-related and extract company name, role, and application status.

---

## Features
- Gmail integration (OAuth2)
- AI-powered email parsing using Gemini
- Tracks statuses: `applied`, `interview`, `offer`, `rejected`
- Stores data in CSV files (no database required)
- Simple web UI to view and sync jobs