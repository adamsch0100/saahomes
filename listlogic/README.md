# ListLogic

Seller pricing presentations for listing agents — interactive live story, print leave-behind, and landscape flipbook from an MLS export.

## Local

```bash
cd listlogic
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill secrets
uvicorn server:app --reload --port 8000
```

Open http://127.0.0.1:8000/saas/

## Production

- Railway project + service: **ListLogic**
- Custom domain: https://listlogic.homes
- Owner console (admin): https://listlogic.homes/saas/admin.html
