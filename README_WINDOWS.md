# Windows पर Install & Run करने की पूरी गाइड

यह ऐप **FastAPI (Python) backend + React frontend + Playwright** पर चलता है।
**MongoDB की ज़रूरत नहीं है** — डेटा SQLite फ़ाइल (`backend/gp_crawler.db`) में सेव होता है।

> ⚠️ ज़रूरी: यह ऐप **India के नेटवर्क से** चलाएँ। WB सरकारी साइट (gpims.wb.gov.in) सिर्फ़
> Indian IP से खुलती है। बाहर के सर्वर/VPN से connection timeout होगा।

---

## 1) एक बार का Setup (sirf pehli baar)

### A. ज़रूरी सॉफ्टवेयर इंस्टॉल करें
1. **Python 3.11** → https://www.python.org/downloads/
   - इंस्टॉल करते समय **"Add Python to PATH"** ज़रूर टिक करें।
2. **Node.js 18+ (LTS)** → https://nodejs.org/
3. **Yarn** (Node इंस्टॉल होने के बाद, CMD में):
   ```
   npm install -g yarn
   ```

### B. कोड डाउनलोड करें
Emergent chat में **"Save to GitHub"** बटन दबाएँ → अपने GitHub पर push करें →
फिर अपने PC पर:
```
git clone <aapka-repo-url>
cd <project-folder>
```
(या Emergent से कोड download करके ZIP extract कर लें।)

### C. Backend तैयार करें (CMD/PowerShell खोलें project फ़ोल्डर में)
```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
```

### D. Frontend तैयार करें (नई CMD window में)
```
cd frontend
yarn install
```

### E. Frontend को local backend से जोड़ें
`frontend\.env` फ़ाइल खोलें और पहली लाइन को बदलकर यह कर दें:
```
REACT_APP_BACKEND_URL=http://localhost:8001
```
(बाकी लाइनें वैसी ही रहने दें।)

---

## 2) ऐप चलाना (हर बार)

सबसे आसान तरीका — प्रोजेक्ट फ़ोल्डर में दी गई इन दो फ़ाइलों पर **डबल-क्लिक** करें:
- **`start_backend.bat`**  → backend शुरू होगा (port 8001)
- **`start_frontend.bat`** → browser में dashboard खुल जाएगा (http://localhost:3000)

### या मैन्युअली:
**Terminal 1 (backend):**
```
cd backend
venv\Scripts\activate
uvicorn server:app --host 0.0.0.0 --port 8001
```
**Terminal 2 (frontend):**
```
cd frontend
yarn start
```
फिर browser में खोलें: **http://localhost:3000**

---

## 3) ऐप इस्तेमाल करने का क्रम
1. ऊपर दाईं ओर **FY (Financial Year) बटन** दबाएँ → **"Load from site"** से असली साल की लिस्ट आएगी → जो साल चाहिए वो चुनें (या **"Add a year manually"** से साल खुद डालें — label जैसे `2023 - 2024` और value जैसे `2324`)।
2. **Analyze Website** दबाएँ → "detected successfully" + चुना हुआ साल available दिखना चाहिए।
3. **Test Single GP** → District/SubDivision/Block/GP चुनें → **Test Extraction** → Email व GIS Mobile आने चाहिए।
4. सब ठीक लगे तो **Start Full Crawl** दबाएँ।
5. पूरा होने पर **Export All** → `GP_Contact_Data_<चुना-हुआ-साल>.xlsx` डाउनलोड करें।

> नोट: साल अब **lock नहीं है** — आप कोई भी उपलब्ध financial year चुन सकते हैं। Crawl चलते समय साल बदलना बंद रहता है (पहले Stop करें)।

- बीच में रोकना हो → **Pause/Stop**. बाद में **Resume** करने पर जहाँ रुका था वहीं से चलेगा (डेटा SQLite में सुरक्षित रहता है)।
- fail हुए GP दोबारा try करने के लिए → **Retry Failed**.

---

## अक्सर आने वाली दिक्कतें
- **"Could not reach the website / Timeout"** → आप India के नेटवर्क पर नहीं हैं, या net slow है। Indian broadband/mobile data से चलाएँ।
- **`playwright` browser error** → `python -m playwright install chromium` दोबारा चलाएँ।
- **Port 8001 busy** → पुरानी backend window बंद करें, फिर दोबारा चलाएँ।
- **`yarn` not recognized** → `npm install -g yarn` चलाएँ, CMD दोबारा खोलें।
