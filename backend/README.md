# Ruta Backend

Backend FastAPI base para migrar la logica funcional desde Streamlit.

## Ejecutar en desarrollo

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
# Editar DATABASE_URL y credenciales CRM en .env
uvicorn main:app --reload --port 8000
```

La persistencia operativa usa exclusivamente PostgreSQL mediante `DATABASE_URL`.
Las tablas se crean al iniciar el backend si la conexión está configurada.

Ejemplos según dónde se ejecute FastAPI:

```dotenv
# FastAPI en PC Windows, PostgreSQL en servidor
DATABASE_URL=postgresql://ruta_user:TU_PASSWORD@192.168.1.93:5432/ruta_dashboard

# FastAPI ejecutándose directamente en el servidor PostgreSQL
DATABASE_URL=postgresql://ruta_user:TU_PASSWORD@127.0.0.1:5432/ruta_dashboard

# FastAPI y PostgreSQL dentro de la misma red Docker
DATABASE_URL=postgresql://ruta_user:TU_PASSWORD@boletas_postgres:5432/ruta_dashboard
```

Reiniciar Uvicorn después de modificar `backend/.env`.

## Probar

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:8000/api/health -UseBasicParsing
```

Endpoints persistentes:

- `POST/GET /api/ruta/visitas-diarias`
- `POST/GET /api/ruta/optimizaciones`
- `GET /api/dashboard/visitas`
