from sqlalchemy.future import select
from sqlalchemy import func, distinct, case
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException

from app.models import Question
from app.models import UserProgress

async def fetch_questions_for_user(
    db: AsyncSession,
    user_id: UUID,
    country: str,
    language: str,
    mode: str,
    batch_size: int,
    topics: Optional[List[str]] = None,
    use_fsrs: bool = True,
) -> List[dict]:
    """
    Fetch questions for user with integrated FSRS scheduling
    
    Returns list of dicts with question data and FSRS metadata
    """
    from app.services.fsrs_service import fsrs_service
    
    country = country.lower()
    language = language.lower()
    if mode == 'topics' and not topics:
        mode = 'interval_all'

    if mode == 'interval_all':
        if use_fsrs:
            # FSRS-integrated: Get due questions based on FSRS scheduling
            stmt = (
                select(Question, UserProgress)
                .outerjoin(
                    UserProgress,
                    (Question.id == UserProgress.question_id)
                    & (UserProgress.user_id == user_id)
                )
                .where(
                    # New questions (never answered) OR due for review
                    (UserProgress.user_id == None)
                    | (UserProgress.due <= datetime.utcnow())
                )
            )
        else:
            # Legacy mode: Basic interval logic
            stmt = (
                select(Question)
                .outerjoin(
                    UserProgress,
                    (Question.id == UserProgress.question_id)
                    & (UserProgress.user_id == user_id)
                )
                .where(
                    (UserProgress.due <= datetime.utcnow())
                    | (UserProgress.user_id == None)
                )
            )
    elif mode == 'new_only':
        # Only new questions (never answered)
        if use_fsrs:
            stmt = (
                select(Question, UserProgress)
                .outerjoin(
                    UserProgress,
                    (Question.id == UserProgress.question_id)
                    & (UserProgress.user_id == user_id)
                )
                .where(UserProgress.user_id == None)
            )
        else:
            stmt = (
                select(Question)
                .outerjoin(
                    UserProgress,
                    (Question.id == UserProgress.question_id)
                    & (UserProgress.user_id == user_id)
                )
                .where(UserProgress.user_id == None)
            )
    elif mode == 'incorrect':
        # Only incorrectly answered questions
        if use_fsrs:
            stmt = (
                select(Question, UserProgress)
                .join(
                    UserProgress,
                    (Question.id == UserProgress.question_id)
                    & (UserProgress.user_id == user_id)
                )
                .where(UserProgress.is_correct == False)
            )
        else:
            stmt = (
                select(Question)
                .join(
                    UserProgress,
                    (Question.id == UserProgress.question_id)
                    & (UserProgress.user_id == user_id)
                )
                .where(UserProgress.is_correct == False)
            )
    elif mode == 'topics':
        # Questions from specified topics
        if use_fsrs:
            stmt = (
                select(Question, UserProgress)
                .outerjoin(
                    UserProgress,
                    (Question.id == UserProgress.question_id)
                    & (UserProgress.user_id == user_id)
                )
            )
        else:
            stmt = (
                select(Question)
                .outerjoin(
                    UserProgress,
                    (Question.id == UserProgress.question_id)
                    & (UserProgress.user_id == user_id)
                )
            )
    else:
        raise HTTPException(400, f"Unsupported mode '{mode}'")

    # Filter by country, language and topics
    stmt = stmt.where(Question.country == country)
    stmt = stmt.where(Question.language == language)
    if topics:
        stmt = stmt.where(Question.topic.in_(topics))

    # Sorting and LIMIT
    if use_fsrs and mode in ('interval_all', 'topics'):
        # FSRS-based priority: overdue questions first, then by due date
        priority = case(
            (UserProgress.due < datetime.utcnow(), 0),  # Overdue questions first
            (UserProgress.is_correct == False, 1),      # Then incorrect questions
            (UserProgress.user_id == None, 2),          # Then new questions
            else_=3                                     # Then other questions
        )
        stmt = stmt.order_by(priority, UserProgress.due.asc().nulls_first(), func.random()).limit(batch_size)
    elif mode in ('interval_all', 'topics'):
        # Legacy priority: incorrect first, then random
        priority = case(
            (UserProgress.is_correct == False, 0),
            else_=1
        )
        stmt = stmt.order_by(priority, func.random()).limit(batch_size)
    else:
        stmt = stmt.order_by(func.random()).limit(batch_size)

    result = await db.execute(stmt)
    
    if use_fsrs:
        # Return questions with FSRS metadata
        questions_with_fsrs = []
        for row in result.fetchall():
            question = row[0]  # Question object
            progress = row[1] if len(row) > 1 else None  # UserProgress object or None
            
            # Build question dict with FSRS data
            question_dict = {
                "id": question.id,
                "text": question.text,
                "options": question.options,
                "correct_answer": question.correct_answer,
                "explanation": question.explanation,
                "topic": question.topic,
                "country": question.country,
                "language": question.language,
                "fsrs_data": None
            }
            
            if progress:
                # Get FSRS status for existing progress
                due_status = fsrs_service.get_card_due_status(progress)
                intervals = fsrs_service.get_next_intervals(progress)
                
                question_dict["fsrs_data"] = {
                    "due_date": progress.due,
                    "is_due": due_status['is_due'],
                    "days_until_due": due_status['days_until_due'],
                    "state": due_status['state'],
                    "stability": due_status['stability'],
                    "difficulty": due_status['difficulty'],
                    "reps": progress.reps or 0,
                    "lapses": progress.lapses or 0,
                    "predicted_intervals": intervals
                }
            else:
                # New question - no FSRS data yet
                question_dict["fsrs_data"] = {
                    "due_date": None,
                    "is_due": True,  # New questions are always "due"
                    "days_until_due": 0,
                    "state": "New",
                    "stability": None,
                    "difficulty": None,
                    "reps": 0,
                    "lapses": 0,
                    "predicted_intervals": None
                }
            
            questions_with_fsrs.append(question_dict)
        
        return questions_with_fsrs
    else:
        # Legacy mode: return just Question objects
        return result.scalars().all()

# Функции для получения доступных стран и языков в самом начале сессии
async def get_distinct_countries(db: AsyncSession) -> List[str]:
    q = select(distinct(Question.country))
    result = await db.execute(q)
    return [row[0] for row in result.fetchall() if row[0] is not None]

async def get_distinct_languages(db: AsyncSession) -> List[str]:
    q = select(distinct(Question.language))
    result = await db.execute(q)
    return [row[0] for row in result.fetchall() if row[0] is not None]

# Получаем список тем для юзера
async def fetch_topics(db: AsyncSession, country: str, language: str) -> list[str]:
    q = await db.execute(
        select(distinct(Question.topic))
          .where(Question.country == country)
          .where(Question.language == language)
    )
    return [row[0] for row in q.all()]

async def get_remaining_questions_count(
    db: AsyncSession,
    user_id: UUID,
    country: str,
    language: str,
) -> int:
    """Get count of questions user still needs to answer correctly"""
    country = country.lower()
    language = language.lower()
    
    # Считаем вопросы, которые либо не решались, либо решались неправильно
    stmt = (
        select(func.count(Question.id))
        .outerjoin(
            UserProgress,
            (Question.id == UserProgress.question_id)
            & (UserProgress.user_id == user_id)
        )
        .where(Question.country == country)
        .where(Question.language == language)
        .where(
            (UserProgress.is_correct.is_(None))  # Не решались
            | (UserProgress.is_correct == False)  # Решались неправильно
        )
    )
    
    result = await db.execute(stmt)
    return result.scalar() or 0