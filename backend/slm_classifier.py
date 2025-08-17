import os, re, json, unicodedata, time, logging, requests
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BIDI_ZW_RE = re.compile(r'[\u200B-\u200F\u2066-\u2069\uFEFF]')
SPACE_MAP = {0x00A0: ' ', 0x202F: ' ', 0x2007: ' '}

def clean_invisibles(s: str) -> str:
    if s is None: return s
    s = unicodedata.normalize('NFKC', s)
    s = s.translate(SPACE_MAP)
    s = BIDI_ZW_RE.sub('', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def keep_start_end(text: str, limit_each=1000):
    text = text or ""
    if len(text) <= 2*limit_each: return text
    return f"{text[:limit_each]} [...] {text[-limit_each:]}"

def approx_tokens(s: str) -> int:
    # Rough: 1 token ~ 4 chars
    return max(1, len(s) // 4)

class SLMClassifier:
    """Local Small Language Model classifier using Ollama"""

    def __init__(self, model_name: str = "mistral:7b-instruct-q4_K_M", base_url: str = "http://localhost:11434"):
        self.model_name = model_name
        self.base_url = base_url.rstrip("/")
        self.chat_url = f"{self.base_url}/api/chat"
        self.gen_url  = f"{self.base_url}/api/generate"
        self._warmup_done = False
        self.num_ctx = 4096     # lighter context for CPU
        self.num_predict = 32   # smaller output for faster generation
        self.num_thread = 12    # optimized thread count
        self.connect_timeout = 10
        self.read_timeout = 600  # allow slow CPU runs
        self.default_batch = 1   # start with 1 email per batch

    # ---------- infra ----------
    def is_ollama_running(self) -> bool:
        try:
            r = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return r.status_code == 200
        except requests.RequestException:
            return False

    def _warmup_model(self):
        if self._warmup_done: return
        try:
            logger.info(f"🔥 Warming up model {self.model_name}...")
            payload = {
                "model": self.model_name,
                "messages": [{"role":"user","content":"ok"}],
                "options": {"num_ctx": 2048, "temperature": 0, "num_thread": self.num_thread},
                "keep_alive": "2h",
                "stream": False
            }
            r = requests.post(self.chat_url, json=payload, timeout=(5,180))
            if r.status_code == 200:
                logger.info(f"✅ Model {self.model_name} warmed up successfully")
                self._warmup_done = True
            else:
                logger.warning(f"⚠️ Warmup HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            logger.warning(f"⚠️ Warmup failed: {e}")

    # ---------- public ----------
    def classify_emails(self, emails: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
        if not self.is_ollama_running():
            logger.error("Ollama server is not running")
            return None

        self._save_debug_data(emails, "raw_emails")

        # process with adaptive batching
        results: List[Dict[str, Any]] = []
        bs = self.default_batch
        i = 0
        while i < len(emails):
            batch = emails[i:i+bs]
            try:
                prompt = self._make_prompt(batch)
                t_in = approx_tokens(prompt)
                
                # Check token budget (stay under 2.5-3k tokens)
                if t_in > 3000:
                    logger.warning(f"⚠️ Prompt too long ({t_in} tokens), reducing batch size")
                    if bs == 1:
                        logger.error("❌ Cannot reduce batch size further, skipping email")
                        i += 1
                        continue
                    bs = max(1, bs // 2)
                    logger.info(f"↘️ Reducing batch size to {bs} and retrying same range")
                    continue
                
                logger.info(f"Batch size={bs} ~{t_in} tokens in prompt")

                self._save_debug_data({
                    "batch_start_index": i, "batch_size": bs,
                    "prompt_length": len(prompt), "token_est": t_in,
                    "prompt": prompt[:20000]  # cap debug size
                }, f"batch_{i//bs+1}_prompt")

                resp = self._call_ollama(prompt)
                if not resp:
                    raise TimeoutError("empty response")

                self._save_debug_data({"raw_response": resp}, f"batch_{i//bs+1}_response")

                parsed = self._parse(resp, expected=len(batch))
                if not parsed:
                    raise ValueError("parse failed")

                results.extend(parsed)
                i += bs
                logger.info(f"✅ Classified {len(parsed)} emails")
            except Exception as e:
                logger.error(f"Batch failed (size={bs}): {e}")
                if bs == 1:
                    return None  # cannot split further
                bs = max(1, bs // 2)
                logger.info(f"↘️ Reducing batch size to {bs} and retrying same range")

        logger.info(f"Successfully classified {len(results)} emails")
        return results

    # ---------- prompt & sanitize ----------
    def _sanitize_email(self, email: Dict[str, Any]) -> Dict[str, Any]:
        subject = clean_invisibles(email.get('subject', ''))
        sender  = clean_invisibles(email.get('sender', ''))
        body    = clean_invisibles(email.get('body', '') or '')

        # strip HTML tags/urls/emails/base64/quotes
        body = re.sub(r'<[^>]+>', ' ', body)
        body = re.sub(r'https?://\S+', ' ', body)
        body = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', ' ', body)
        body = re.sub(r'^>.*$', '', body, flags=re.MULTILINE)
        body = re.sub(r'[A-Za-z0-9+/]{50,}={0,2}', ' ', body)
        body = re.sub(r'\s+', ' ', body).strip()

        # keep beginning + end to preserve key info (stay under 2.5-3k tokens)
        body = keep_start_end(body, limit_each=800)

        return {"subject": subject or "No Subject", "sender": sender or "Unknown", "body": body}

    def _make_prompt(self, emails: List[Dict[str, Any]]) -> str:
        sanitized = [self._sanitize_email(e) for e in emails]
        items = []
        for idx, e in enumerate(sanitized, 1):
            items.append(
                f"Email {idx}:\n"
                f"Subject: {e['subject']}\n"
                f"From: {e['sender']}\n"
                f"Body: {e['body']}\n"
            )
        emails_block = "\n".join(items)

        # minimal instruction (fast)
        prompt = (
            "Classify these emails as job-related or not.\n\n"
            "Output format:\n"
            "[\n"
            '  {"is_job": true/false, "company": "name", "role": "title", "status": "applied/interview/offer/rejected"}\n'
            "]\n\n"
            "Rules:\n"
            "- is_job=true: application confirmations, interviews, offers, rejections\n"
            "- is_job=false: newsletters, alerts, marketing, networking\n"
            "- Use null for unclear values\n\n"
            f"Emails to classify:\n\n{emails_block}\n\n"
            "Return ONLY the JSON array starting with [ and ending with ]."
        )
        return prompt

    # ---------- model calls ----------
    def _call_ollama(self, prompt: str) -> Optional[str]:
        self._warmup_model()
        options = {
            "temperature": 0.1,
            "num_ctx": self.num_ctx,
            "num_predict": self.num_predict,
            "num_thread": self.num_thread,
        }

        # First try /api/chat (non-stream)
        payload_chat = {
            "model": self.model_name,
            "format": "json",
            "options": options,
            "messages": [
                {"role":"system","content":"Reply strictly with valid JSON array. Do not escape quotes or wrap in additional structures. Return ONLY the raw JSON array."},
                {"role":"user","content": prompt}
            ],
            "keep_alive": "2h",
            "stream": False
        }
        t0 = time.monotonic()
        try:
            r = requests.post(self.chat_url, json=payload_chat, timeout=(self.connect_timeout, self.read_timeout))
            r.raise_for_status()
            content = r.json().get("message", {}).get("content", "")
            if content: return content
        except requests.exceptions.Timeout:
            logger.error("⏱️ /api/chat timed out, falling back to /api/generate")
        except Exception as e:
            logger.error(f"/api/chat error: {e}")

        # Fallback: /api/generate (often faster/leaner)
        payload_gen = {
            "model": self.model_name,
            "format": "json",
            "options": options,
            "prompt": f"{prompt}\n\nRespond with ONLY the raw JSON array. Do not escape quotes or wrap in additional structures.",
            "keep_alive": "2h",
            "stream": False
        }
        try:
            r = requests.post(self.gen_url, json=payload_gen, timeout=(self.connect_timeout, self.read_timeout))
            r.raise_for_status()
            return r.json().get("response", "")
        except Exception as e:
            logger.error(f"/api/generate error: {e}")
            return None
        finally:
            logger.info(f"⏱️ call elapsed {time.monotonic()-t0:.1f}s")

    # ---------- parsing ----------
    def _parse(self, text: str, expected: int) -> List[Dict[str, Any]]:
        s = text.strip()
        
        # handle accidental code fences (shouldn't appear with format=json)
        if s.startswith("```"):
            s = s.strip("`")
            # try to remove possible 'json\n'
            s = s.split("\n",1)[-1].strip()
        
        # Try to extract JSON array from malformed responses
        # Handle various malformed patterns
        original_s = s
        logger.info(f"🔍 Processing response: {s[:100]}...")
        
        # Pattern 1: {"[...]": ...} (escaped JSON as key)
        if s.startswith('{"[') and '"]' in s:
            start = s.find('["') + 1
            end = s.find('"]') + 1
            if start > 0 and end > start:
                s = s[start:end]
                logger.warning(f"🔧 Extracted JSON from escaped key pattern: {s[:100]}...")
            else:
                # Alternative extraction for this pattern
                start = s.find('[')
                end = s.find(']') + 1
                if start >= 0 and end > start:
                    s = s[start:end]
                    logger.warning(f"🔧 Alternative extraction from escaped key: {s[:100]}...")
        
        # Pattern 2: {'[...]': ''} (Python dict with JSON string)
        elif s.startswith("{'") and "'{" in s and "}':" in s:
            start = s.find("'{") + 1
            end = s.rfind("}'") + 1
            if start > 0 and end > start:
                s = s[start:end]
                logger.warning(f"🔧 Extracted JSON from Python dict pattern: {s[:100]}...")
        
        # Pattern 3: Just the JSON array part (clean case)
        elif s.startswith('[') and s.endswith(']'):
            logger.info("✅ Clean JSON array detected")
        
        # Pattern 4: Try to find any JSON array in the response
        else:
            # Look for [ and ] and extract everything between
            start = s.find('[')
            end = s.rfind(']')
            if start >= 0 and end > start:
                s = s[start:end+1]
                logger.warning(f"🔧 Extracted JSON array from mixed content: {s[:100]}...")
        
        try:
            data = json.loads(s)
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON parse error: {e}")
            logger.error(f"❌ Original response: {original_s[:200]}...")
            logger.error(f"❌ Cleaned response: {s[:200]}...")
            raise ValueError(f"Invalid JSON: {e}")

        if not isinstance(data, list):
            # Try to wrap single object in array
            if isinstance(data, dict):
                logger.warning(f"⚠️ Got single object instead of array, wrapping: {data}")
                data = [data]
            else:
                raise ValueError(f"Response is not a list or object: {type(data)}")

        # pad/trim to expected length defensively
        if len(data) != expected:
            logger.warning(f"Expected {expected} items, got {len(data)}")

        out = []
        for item in data[:expected]:
            if not isinstance(item, dict): continue
            out.append({
                "is_job": bool(item.get("is_job", False)),
                "company": item.get("company"),  # No default, keep as None if missing
                "role": item.get("role"),        # No default, keep as None if missing
                "status": item.get("status")    # No default, keep as None if missing
            })
        return out

    # ---------- debug ----------
    def _save_debug_data(self, data: Any, filename: str):
        try:
            os.makedirs("debug_logs", exist_ok=True)
            from datetime import datetime
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = f"debug_logs/{filename}_{ts}.json"
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False, default=str)
            logger.info(f"💾 Debug data saved: {path}")
        except Exception as e:
            logger.error(f"Failed to save debug data: {e}")

    def test_connection(self) -> Dict[str, Any]:
        """Test the connection and model availability"""
        try:
            is_running = self.is_ollama_running()
            available_models = []
            if is_running:
                try:
                    response = requests.get(f"{self.base_url}/api/tags", timeout=5)
                    if response.status_code == 200:
                        models = response.json().get("models", [])
                        available_models = [model["name"] for model in models]
                except:
                    pass
            
            return {
                "ollama_running": is_running,
                "available_models": available_models,
                "current_model": self.model_name,
                "base_url": self.base_url
            }
        except Exception as e:
            return {
                "ollama_running": False,
                "error": str(e),
                "current_model": self.model_name,
                "base_url": self.base_url
            }
