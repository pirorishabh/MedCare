"""
services.py — IBM watsonx.ai (AI Studio) Text Chat Service
===========================================================
Handles all communication with the IBM watsonx.ai text chat API.

API reference:
  POST {IBM_URL}/ml/v1/text/chat?version=2023-05-29

Required environment variables (see env.example):
  IBM_API_KEY   — IBM Cloud IAM API key
  IBM_PROJECT_ID — watsonx.ai project ID
  IBM_URL       — Regional base URL (e.g. https://au-syd.ml.cloud.ibm.com)
  IBM_MODEL_ID  — Model to use (e.g. ibm/granite-3-8b-instruct)
"""

import time
import logging
import requests
from config import config

logger = logging.getLogger(__name__)


# ============================================================
# AGENT INSTRUCTIONS — Customize AI Behavior Here
# ============================================================

AGENT_NAME = "DoctorTalk"

AGENT_PERSONA = (
    "You are DoctorTalk, a compassionate, knowledgeable, and highly professional "
    "AI Medical Assistant powered by IBM watsonx. You communicate with warmth, clarity, "
    "and empathy. You speak like a trusted healthcare educator — not a cold machine."
)

AGENT_EXPERTISE = [
    "General health education and wellness",
    "Chronic disease information (diabetes, hypertension, heart disease, asthma, COPD, etc.)",
    "Medication explanations (uses, dosages, side effects, interactions)",
    "Laboratory and diagnostic test interpretation",
    "Medical terminology explanations",
    "Symptom education (not diagnosis)",
    "Nutrition, diet, and healthy eating guidance",
    "Exercise and physical activity recommendations",
    "Mental health awareness and stress management",
    "Preventive healthcare and screening guidelines",
    "Sleep hygiene and lifestyle optimization",
    "First aid awareness and emergency recognition",
    "Pediatric and geriatric health education",
    "Women's health and reproductive health education",
]

AGENT_SAFETY_RULES = [
    "NEVER diagnose any medical condition. Always clarify you are providing educational information only.",
    "NEVER recommend specific prescription dosages for individual patients.",
    "NEVER replace professional medical advice, diagnosis, or treatment.",
    "ALWAYS recommend consulting a qualified healthcare professional for personal medical decisions.",
    "ALWAYS include appropriate medical disclaimers when discussing symptoms or treatments.",
    "NEVER provide emergency medical guidance beyond directing users to call emergency services.",
    "NEVER discuss illegal substances, self-harm methods, or dangerous practices.",
    "If a user describes a potential emergency, IMMEDIATELY advise them to call emergency services (911 or local equivalent).",
]

AGENT_RESPONSE_FORMAT = (
    "Use clear, structured responses with headings when covering multiple topics. "
    "Use bullet points for lists. Use **bold** for key terms. "
    "Keep responses concise but comprehensive. "
    "Always end health condition responses with a brief disclaimer."
)

AGENT_DISCLAIMER = (
    "\n\n---\n⚕️ *Medical Disclaimer: This information is for educational purposes only and does not "
    "constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare "
    "professional for personal medical guidance.*"
)

SYSTEM_PROMPT = (
    f"{AGENT_PERSONA}\n\n"
    f"Your expertise covers: {', '.join(AGENT_EXPERTISE[:6])} and more.\n\n"
    f"Response format: {AGENT_RESPONSE_FORMAT}\n\n"
    "Safety: " + " ".join(AGENT_SAFETY_RULES[:4])
)

# ============================================================
# END OF AGENT INSTRUCTIONS
# ============================================================


class WatsonxService:
    """
    Service class for IBM watsonx.ai text generation API.

    Authenticates via IBM Cloud IAM and calls:
      POST {base_url}/ml/v1/text/chat?version=2023-05-29
    """

    IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"
    CHAT_URL = "{base_url}/ml/v1/text/chat?version=2023-05-29"

    def __init__(self):
        self.api_key    = config.IBM_API_KEY
        self.project_id = config.IBM_PROJECT_ID
        self.model_id   = config.IBM_MODEL_ID
        self.base_url   = config.IBM_URL.rstrip("/")

        self._access_token: str | None = None
        self._token_expiry: float = 0.0

    # ── Authentication ────────────────────────────────────────────────────────

    def _get_iam_token(self) -> str:
        """Obtain and cache a valid IBM Cloud IAM access token."""
        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token

        resp = requests.post(
            self.IAM_TOKEN_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                "apikey": self.api_key,
            },
            timeout=30,
        )
        resp.raise_for_status()
        token_data = resp.json()
        self._access_token = token_data["access_token"]
        self._token_expiry = time.time() + token_data.get("expires_in", 3600)
        logger.debug("IAM token refreshed, expires in %ss", token_data.get("expires_in"))
        return self._access_token

    # ── Credential check ──────────────────────────────────────────────────────

    def _is_configured(self) -> bool:
        """Return True only when all required credentials are present."""
        return bool(
            self.api_key
            and self.api_key not in ("", "your_ibm_cloud_api_key_here")
            and self.project_id
            and self.project_id not in ("", "your_watsonx_project_id_here")
        )

    # ── Core Inference ────────────────────────────────────────────────────────

    def generate_text(self, prompt: str, history: list = None) -> dict:
        """
        Send a prompt to IBM watsonx.ai using the /text/chat endpoint.
        This endpoint handles prompt formatting for all model families
        (Granite, Llama, Mistral, etc.) automatically.

        Args:
            prompt:  The current user message.
            history: Optional prior turns as list of {"role", "content"} dicts.

        Returns:
            dict with keys: text, model_id, input_tokens, output_tokens, success
        """
        if not self._is_configured():
            return self._demo_response(prompt)

        try:
            token = self._get_iam_token()
            url = self.CHAT_URL.format(base_url=self.base_url)

            # Build messages array — system + history + current user message
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            for turn in (history or []):
                if turn.get("role") in ("user", "assistant"):
                    messages.append({"role": turn["role"], "content": turn.get("content", "")})
            messages.append({"role": "user", "content": prompt})

            payload = {
                "model_id": self.model_id,
                "project_id": self.project_id,
                "messages": messages,
                "parameters": {
                    "max_tokens": 1024,
                    "temperature": 0,
                },
            }

            logger.debug("Calling watsonx.ai chat: %s model=%s", url, self.model_id)
            resp = requests.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()

            # Response shape:
            # { "choices": [{ "message": { "content": "..." } }],
            #   "usage": { "prompt_tokens": N, "completion_tokens": N } }
            text = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            usage = data.get("usage", {})

            return {
                "text": text,
                "model_id": self.model_id,
                "input_tokens": usage.get("prompt_tokens", 0),
                "output_tokens": usage.get("completion_tokens", 0),
                "success": True,
            }

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response is not None else "N/A"
            body = e.response.text if e.response is not None else ""
            logger.error("watsonx.ai HTTP error %s: %s", status_code, body)
            return {"text": f"API error {status_code}: {body}", "success": False}
        except requests.exceptions.ConnectionError as e:
            logger.error("watsonx.ai connection error: %s", e)
            return {"text": "Connection error: could not reach IBM watsonx.ai. Please check your IBM_URL.", "success": False}
        except requests.exceptions.Timeout:
            logger.error("watsonx.ai request timed out")
            return {"text": "Request timed out. IBM watsonx.ai did not respond in time.", "success": False}
        except Exception as e:
            logger.exception("Unexpected watsonx.ai error")
            return {"text": str(e), "success": False}

    # ── Specialized Medical Methods ───────────────────────────────────────────

    def chat(self, message: str, history: list = None, language: str = "en-IN") -> dict:
        """Process a chat message and instruct the model to answer in the selected language."""
        language_names = {
            "en-IN":"Indian English", "hi-IN":"Hindi", "mr-IN":"Marathi",
            "gu-IN":"Gujarati", "bn-IN":"Bengali", "ta-IN":"Tamil",
            "te-IN":"Telugu", "kn-IN":"Kannada", "ml-IN":"Malayalam",
            "pa-IN":"Punjabi", "ur-IN":"Urdu"
        }
        lang = language_names.get(language, "Indian English")
        prompt = (f"Respond in {lang}. Preserve medical terminology where useful, but explain it simply. "
                  f"The user's message is:\n\n{message}")
        return self.generate_text(prompt, history=history)

    def check_symptoms(self, symptoms: str) -> dict:
        """Analyze symptoms and provide educational health information."""
        prompt = (
            f"A user reports the following symptoms: {symptoms}\n\n"
            "Please provide educational information including:\n"
            "1. **Possible Related Conditions** (educational only, not a diagnosis)\n"
            "2. **Recommended Specialist** to consult\n"
            "3. **Suggested Laboratory Tests** that a doctor might order\n"
            "4. **Lifestyle Recommendations**\n"
            "5. **Emergency Warning Signs** — symptoms requiring immediate medical attention\n\n"
            "IMPORTANT: Clearly state this is educational information, not a medical diagnosis."
        )
        return self.generate_text(prompt)

    def get_disease_info(self, disease: str) -> dict:
        """Retrieve comprehensive educational information about a disease."""
        prompt = (
            f"Provide comprehensive educational information about: {disease}\n\n"
            "Structure your response with these sections:\n"
            "1. Definition\n2. Symptoms\n3. Causes\n4. Risk Factors\n"
            "5. Diagnosis\n6. Treatments\n7. Medications (common)\n"
            "8. Lifestyle Recommendations\n9. Prevention\n10. Frequently Asked Questions"
        )
        return self.generate_text(prompt)

    def get_medication_info(self, medication: str) -> dict:
        """Provide educational information about a medication."""
        prompt = (
            f"Provide educational information about the medication: {medication}\n\n"
            "Include:\n"
            "1. **Drug Class & Mechanism**\n"
            "2. **Common Uses / Indications**\n"
            "3. **Typical Dosage Forms** (general, not patient-specific)\n"
            "4. **Common Side Effects**\n"
            "5. **Serious Side Effects / Warnings**\n"
            "6. **Drug Interactions** (common ones)\n"
            "7. **Contraindications**\n"
            "8. **Special Populations** (pregnancy, elderly, renal/hepatic impairment)\n"
            "9. **Patient Counseling Points**"
        )
        return self.generate_text(prompt)

    def analyze_report(self, report_text: str) -> dict:
        """Explain the content of a medical report in plain language."""
        prompt = (
            "The following is the content of a medical report or document:\n\n"
            f"---\n{report_text[:3000]}\n---\n\n"
            "Please:\n"
            "1. Summarize what this report contains\n"
            "2. Explain any medical terms in plain language\n"
            "3. Highlight any values that appear abnormal (if lab results)\n"
            "4. Explain what the findings generally mean\n"
            "5. Suggest questions the patient might ask their doctor\n\n"
            "Remind the user to discuss these results with their healthcare provider."
        )
        return self.generate_text(prompt)

    def get_health_tip(self) -> dict:
        """Generate a daily health tip."""
        import random
        topics = [
            "hydration and water intake", "sleep hygiene", "stress management",
            "cardiovascular health", "healthy nutrition", "physical activity",
            "mental wellness", "preventive screenings", "immune system support",
            "weight management", "gut health", "bone health",
        ]
        topic = random.choice(topics)
        prompt = (
            f"Share a practical, actionable daily health tip about: {topic}\n"
            "Keep it concise (2-3 sentences), motivating, and evidence-based."
        )
        return self.generate_text(prompt)

    def generate_wellness_plan(self, profile: dict) -> dict:
        """Generate a personalized wellness plan based on user profile."""
        age = profile.get("age", "unknown")
        gender = profile.get("gender", "unknown")
        conditions = profile.get("conditions", "none")
        goals = profile.get("goals", "general wellness")

        prompt = (
            "Create a personalized weekly wellness plan for:\n"
            f"- Age: {age}\n- Gender: {gender}\n"
            f"- Health Conditions: {conditions}\n- Goals: {goals}\n\n"
            "Include sections for:\n"
            "1. Nutrition Plan\n2. Exercise Schedule\n3. Sleep Schedule\n"
            "4. Stress Management\n5. Hydration Goals\n6. Preventive Health Checks\n\n"
            "Make it realistic, practical, and encouraging."
        )
        return self.generate_text(prompt)

    # ── Demo Mode ─────────────────────────────────────────────────────────────

    def _demo_response(self, prompt: str) -> dict:
        """Return a demo response when credentials are not configured."""
        return {
            "text": (
                "👋 **Welcome to DoctorTalk Demo Mode**\n\n"
                "IBM watsonx.ai credentials have not been configured yet. "
                "To enable full AI capabilities:\n\n"
                "1. Copy `env.example` to `.env`\n"
                "2. Set `IBM_API_KEY` — your IBM Cloud IAM API key\n"
                "3. Set `IBM_PROJECT_ID` — your watsonx.ai project ID\n"
                "4. Set `IBM_URL` — your regional watsonx.ai URL\n"
                "5. Optionally set `IBM_MODEL_ID` (default: `ibm/granite-3-8b-instruct`)\n"
                "6. Restart the Flask server\n\n"
                f"**Your question was:** _{prompt[:200]}_\n\n"
                "---\n⚕️ *This is a demo response. Configure your credentials for full functionality.*"
            ),
            "model_id": "demo",
            "input_tokens": 0,
            "output_tokens": 0,
            "success": True,
            "demo": True,
        }


# Singleton instance used by routes.py
watsonx = WatsonxService()
