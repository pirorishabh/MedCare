# DoctorTalk — AI + Doctor Consultation

This version adds:

- **Multilingual AI voice input/output** with Indian language preferences: English (India), Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi and Urdu. Voice recognition uses the browser Speech Recognition API and AI answers are instructed to use the selected language.
- **Separate doctor authentication** at `/doctor/login` and `/doctor/register`.
- **Doctor dashboard** with appointment queue, accept/complete actions and patient report review.
- **Patient appointment booking** against registered doctors, with status tracking.
- **Video consultation rooms** using WebRTC with database-backed signaling and a Google STUN server.
- **Persistent AI chat history** in SQLite, tied to the logged-in patient.
- **AI chat PDF export** at `/api/chat/export-pdf`; records are generated under `uploads/chat_exports/<patient_id>/`.
- Existing patient login history remains server-side only.

## Run locally

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`.

## Environment

A local `.env` file is included for the supplied IBM watsonx configuration. **Do not commit `.env` to Git.** Rotate the IBM API key if it has been shared publicly and replace the value in `.env`.

For deployment, set the same environment variables in the hosting provider rather than uploading `.env`.

## Doctor workflow

1. Create a doctor account at `/doctor/register`.
2. Sign in at `/doctor/login`.
3. A patient selects the doctor in **Appointments** and requests a slot.
4. The request appears in the doctor's queue.
5. The doctor accepts it.
6. Both sides see a **Video** button for the appointment room.
7. Doctors can review reports associated with patients who have appointments with them.

## Voice workflow

1. Open **Settings → AI Language** and choose the preferred language.
2. In **AI Chat**, press the microphone button and speak.
3. The transcript is sent to IBM watsonx in the selected language.
4. Use the speaker button on an AI response to hear it in the selected locale.

Browser support for Speech Recognition and available voices varies by browser/OS, so "any language" is implemented as a multilingual language selection with the Indian locales above rather than promising every language on every device.

## Security note

This is a student/demo healthcare application. For production use, add HTTPS, CSRF protection, stronger role/permission controls, encrypted medical-file storage, audit logging, secure secret management, a production-grade signaling/video provider, rate limiting and the regulatory/privacy controls required for the deployment jurisdiction.

## Render deployment

### Option A — Render Blueprint
1. Push this project to GitHub (do not commit `.env`, `medassist.db`, or uploaded files).
2. In Render, create a new **Blueprint** from the repository. Render will read `render.yaml`.
3. Enter `IBM_API_KEY` and `IBM_PROJECT_ID` when prompted.
4. Deploy. Render supplies the `PORT` environment variable automatically.

### Option B — Manual Web Service
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT`
- Add the environment variables listed in `env.example`.

### Important
This version is suitable for a demo/hackathon deployment. SQLite data and uploaded files are stored on the Render instance filesystem and are not a durable production database/storage solution. For production, migrate to PostgreSQL plus persistent object storage.

**Security:** never commit `.env` or IBM credentials. Rotate any API key that has been exposed publicly.
