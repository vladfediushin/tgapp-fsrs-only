# 🧠 TG App FSRS - Scientifically Optimized Spaced Repetition

A modern telegram driving test application with **FSRS-6** (Free Spaced Repetition Scheduler) algorithm for optimal learning and memory retention.

## ✨ Features

### 🎯 FSRS-6 Algorithm
- **Scientific approach** to spaced repetition based on modern memory research
- **Personalized scheduling** that adapts to individual learning patterns
- **Optimal retention** with minimal review time
- **Predictive difficulty** assessment for each question

### 🚀 Tech Stack
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: React + TypeScript + Zustand
- **Database**: PostgreSQL with Alembic migrations
- **Algorithm**: FSRS-6 for spaced repetition scheduling

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 14+

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/vladfediushin/tgapp-fsrs-only.git
   cd tgapp-fsrs-only
   ```

2. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   cp .env.example .env
   alembic upgrade head
   uvicorn app.main:app --reload
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   npm run dev
   ```

## 🌐 Deployment

📖 **Detailed deployment guide**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🎯 FSRS API Endpoints

- `POST /fsrs/submit-answer` - Submit answer with FSRS rating (1-4)
- `POST /fsrs/submit-batch` - Batch answer submission
- `GET /fsrs/due-questions/{user_id}` - Get questions due for review
- `GET /fsrs/stats/{user_id}` - User's FSRS statistics

**Built with ❤️ for optimal learning and memory retention**
