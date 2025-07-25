# Repeat.tsx Component: React Patterns for Python Developers

## Overview
This document explains the React patterns used in the Repeat.tsx component, specifically designed for Python developers learning React. The component implements a complete FSRS-6 spaced repetition learning system with unified store integration.

## 🔄 Python vs React Concept Mapping

### State Management
```python
# Python Class-based approach
class RepeatSession:
    def __init__(self):
        self.questions = []
        self.current_index = 0
        self.session_stats = {
            'answered': 0,
            'correct': 0
        }
    
    def update_stats(self, is_correct):
        self.session_stats['answered'] += 1
        if is_correct:
            self.session_stats['correct'] += 1
```

```typescript
// React Hook-based approach
const [dueQuestions, setDueQuestions] = useState<FSRSQuestionWithContent[]>([])
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
const [sessionStats, setSessionStats] = useState<FSRSSessionStats>({
  questionsAnswered: 0,
  correctAnswers: 0,
  // ... other fields
})

// Updating state (immutable)
setSessionStats(prev => ({
  ...prev,
  questionsAnswered: prev.questionsAnswered + 1,
  correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0)
}))
```

**Key Difference**: React state is immutable - you create new objects instead of modifying existing ones.

### Async Operations
```python
# Python synchronous style
def load_questions(self):
    try:
        response = requests.get('/api/fsrs/due-questions')
        self.questions = response.json()
        self.loading = False
    except Exception as e:
        self.error = str(e)
        self.loading = False
```

```typescript
// React async with useEffect
useEffect(() => {
  const loadDueQuestions = async () => {
    try {
      setIsLoadingQuestions(true)
      setLoadError(null)
      
      const response = await fsrsApi.getDueQuestions(
        user.id,
        settings.examCountry,
        settings.examLanguage,
        20
      )
      
      setDueQuestions(questionsWithContent)
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setIsLoadingQuestions(false)
    }
  }

  loadDueQuestions()
}, [user?.id, settings.examCountry, settings.examLanguage]) // Dependencies
```

**Key Difference**: React uses useEffect for side effects, with dependency arrays to control when effects run.

## 🎯 Core React Hooks Explained

### 1. useState - State Management
```typescript
const [showAnswer, setShowAnswer] = useState(false)
```
- **Python equivalent**: Instance variable with getter/setter
- **Purpose**: Manages component-local state
- **Re-render trigger**: Calling setter function triggers component re-render

### 2. useEffect - Side Effects
```typescript
useEffect(() => {
  // Effect logic (like Python __init__ or method calls)
  loadDueQuestions()
  
  return () => {
    // Cleanup logic (like Python __del__ or context manager __exit__)
    cleanup()
  }
}, [dependencies]) // When to run effect
```
- **Python equivalent**: `__init__`, decorators, or context managers
- **Purpose**: Handle side effects (API calls, subscriptions, timers)
- **Cleanup**: Return function for cleanup (prevent memory leaks)

### 3. useCallback - Function Memoization
```typescript
const handleRating = useCallback(async (rating: FSRSRating) => {
  // Function logic
}, [currentQuestion, user?.id, isSubmitting]) // Dependencies
```
- **Python equivalent**: `@lru_cache` decorator
- **Purpose**: Prevents function recreation on every render
- **Performance**: Reduces unnecessary child component re-renders

### 4. useMemo - Value Memoization
```typescript
const currentQuestion = useMemo(() => {
  return dueQuestions[currentQuestionIndex] || null
}, [dueQuestions, currentQuestionIndex])
```
- **Python equivalent**: `@property` with caching
- **Purpose**: Expensive calculations only run when dependencies change
- **Performance**: Avoids recalculating on every render

## 🏗️ Component Architecture

### Component Composition
```typescript
// Main component
const Repeat: React.FC = () => {
  return (
    <div>
      <SessionStats stats={sessionStats} />
      <FSRSQuestionCard 
        question={currentQuestion}
        onRate={handleRating}
      />
    </div>
  )
}

// Child component
const FSRSQuestionCard: React.FC<FSRSQuestionCardProps> = ({ 
  question, 
  onRate 
}) => {
  return (
    <div>
      {/* Question UI */}
      <FSRSRatingButtons onRate={onRate} />
    </div>
  )
}