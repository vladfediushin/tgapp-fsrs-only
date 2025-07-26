import axios, { AxiosResponse } from 'axios'

// Debug environment variables
console.log('=== API Configuration Debug ===');
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('VITE_ENVIRONMENT:', import.meta.env.VITE_ENVIRONMENT);
console.log('PROD mode:', import.meta.env.PROD);
console.log('DEV mode:', import.meta.env.DEV);
console.log('Current origin:', window.location.origin);
console.log('Current hostname:', window.location.hostname);

// API URL с fallback для продакшена
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
                    import.meta.env.VITE_API_URL ||
                    (import.meta.env.PROD
                      ? 'https://tgapp-fsrs-backend.onrender.com'
                      : 'http://localhost:8000');

console.log('=== Final API Configuration ===');
console.log('API Base URL:', API_BASE_URL);
console.log('Timeout:', 10000);
console.log('================================');

// создаём экземпляр axios с базовым URL
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 секунд для продакшена (Render может быть медленнее)
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('=== API Request ===');
    console.log('URL:', config.url);
    console.log('Method:', config.method?.toUpperCase());
    console.log('Base URL:', config.baseURL);
    console.log('Full URL:', `${config.baseURL}${config.url}`);
    console.log('Headers:', config.headers);
    if (config.data) {
      console.log('Request Data:', config.data);
    }
    console.log('==================');
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Interceptor для обработки ошибок и retry
api.interceptors.response.use(
  (response) => {
    console.log('=== API Response ===');
    console.log('URL:', response.config.url);
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Response Headers:', response.headers);
    console.log('Response Data:', response.data);
    console.log('===================');
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.log('=== API Error Debug ===');
    console.log('Error Code:', error.code);
    console.log('Error Message:', error.message);
    console.log('Request URL:', error.config?.url);
    console.log('Request Method:', error.config?.method);
    console.log('Base URL:', error.config?.baseURL);
    console.log('Full URL:', error.config ? `${error.config.baseURL}${error.config.url}` : 'Unknown');
    
    if (error.response) {
      console.log('Response Status:', error.response.status);
      console.log('Response Headers:', error.response.headers);
      console.log('Response Data:', error.response.data);
    } else {
      console.log('No response received - possible CORS or network issue');
      console.log('Current origin:', window.location.origin);
      console.log('Target API:', error.config?.baseURL);
    }
    console.log('=====================');

    // Retry для network errors или 5xx ошибок
    if (
      (error.code === 'ECONNABORTED' ||
       error.code === 'NETWORK_ERROR' ||
       (error.response && error.response.status >= 500)) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      console.log('Retrying failed request...', error.config.url);
      
      // Убираем задержку для более быстрого retry
      return api(originalRequest);
    }

    console.error('API Error:', error.config?.url, error.message);
    return Promise.reject(error);
  }
)

// -------------------------
// Типы для работы с пользователем
// -------------------------

/** Входная схема для создания/обновления пользователя */
export interface UserCreate {
  telegram_id: number
  username?: string
  first_name?: string
  last_name?: string
  exam_country: string
  exam_language: string
  ui_language: string  // FIXED: removed typo from ui_langugage
  exam_date?: string    // OPTIONAL: ISO date string
  daily_goal?: number   // OPTIONAL: daily goal
}

export interface UserSettingsUpdate {
  exam_country?: string   // Made optional
  exam_language?: string  // Made optional
  ui_language?: string    // Made optional
  exam_date?: string      // ISO-строка, optional
  daily_goal?: number     // optional
}

export const createUser = (payload: UserCreate) => {
  return api.post<UserOut>('/users/', payload)
}

export const updateUser = (userId: string, payload: UserSettingsUpdate) => {
  return api.patch<UserOut>(`/users/${userId}`, payload)
}

/** Ответ от сервера при создании/получении пользователя */
export interface UserOut {
  id: string
  created_at: string
  username?: string
  first_name?: string
  last_name?: string
  exam_country?: string
  exam_language?: string
  ui_language?: string
  exam_date?: string     // ISO date string
  daily_goal?: number
}

// -------------------------
// NEW: Exam Settings Types
// -------------------------

export interface ExamSettingsUpdate {
  exam_date?: string  // ISO date string (YYYY-MM-DD)
  daily_goal?: number // 1-100
}

export interface ExamSettingsResponse {
  exam_date?: string
  daily_goal?: number
  days_until_exam?: number
  recommended_daily_goal?: number
}

export const setExamSettings = (userId: string, settings: ExamSettingsUpdate) => {
  return api.post<ExamSettingsResponse>(`/users/${userId}/exam-settings`, settings)
}

export const getExamSettings = (userId: string) => {
  return api.get<ExamSettingsResponse>(`/users/${userId}/exam-settings`)
}

// Получить количество нерешенных вопросов для пользователя
export const getRemainingQuestionsCount = (userId: string, country: string, language: string) => {
  return api.get<{ remaining_count: number }>(`/questions/remaining-count`, {
    params: {
      user_id: userId,
      country,
      language
    }
  })
}

// -------------------------
// Типы и функции для работы с вопросами
// -------------------------

/** Структура одного вопроса из ответа сервера (legacy) */
export interface QuestionOut {
  id: string
  data: {
    question: string
    question_image: string | null
    options: string[]
    correct_index: number
  }
  country: string
  language: string
  topic: string
}

// FSRS-integrated question types
export interface FSRSQuestionData {
  due_date?: string
  is_due: boolean
  days_until_due: number
  state: string  // "New", "Learning", "Review", "Relearning"
  stability?: number
  difficulty?: number
  reps: number
  lapses: number
  predicted_intervals?: {
    again?: { interval_days: number; due_date: string; stability: number; difficulty: number; state: string }
    hard?: { interval_days: number; due_date: string; stability: number; difficulty: number; state: string }
    good?: { interval_days: number; due_date: string; stability: number; difficulty: number; state: string }
    easy?: { interval_days: number; due_date: string; stability: number; difficulty: number; state: string }
  }
}

export interface FSRSQuestionOut {
  id: number
  text: string
  options: string[]
  correct_answer: number
  explanation?: string
  topic: string
  country: string
  language: string
  fsrs_data?: FSRSQuestionData
}

export interface FSRSQuestionsResponse {
  questions: FSRSQuestionOut[]
  fsrs_enabled: boolean
  mode: string
  total_returned: number
}

/** Параметры фильтра для запроса вопросов */
export interface GetQuestionsParams {
  user_id: string
  country?: string
  language?: string
  mode?: string
  batch_size?: number
  topic?: string | string[]
  use_fsrs?: boolean  // New parameter for FSRS integration
}

/**
 * Получить вопросы с сервера (FSRS-integrated by default)
 */
export const getQuestions = (params: GetQuestionsParams) => {
  // Enable FSRS by default
  const fsrsParams = { use_fsrs: true, ...params }
  return api.get<FSRSQuestionsResponse>('/questions/', { params: fsrsParams })
}

/**
 * Получить вопросы с сервера (legacy format)
 */
export const getQuestionsLegacy = (params: GetQuestionsParams) => {
  const legacyParams = { use_fsrs: false, ...params }
  return api.get<QuestionOut[]>('/questions/', { params: legacyParams })
}

// -------------------------
// Типы и функции для статистики и ответов
// -------------------------

/** Статистика пользователя */
export interface UserStats {
  answered: number
  correct: number
  total_questions: number
}

/** Получить статистику пользователя по его ID */
export const getUserStats = (userId: string) => {
  return api.get<UserStats>(`/users/${userId}/stats`)
}

/** Параметры для отправки одного ответа */
export interface AnswerSubmit {
  user_id: string
  question_id: number
  is_correct: boolean
}

/** Отправить ответ пользователя */
export const submitAnswer = (payload: AnswerSubmit) => {
  return api.post('/user_progress/submit_answer', payload)
}

/**Получить юзера по Telegram ID */
/**
 * Возвращает объект пользователя по его telegram_id
 */
export const getUserByTelegramId = async (
  telegramId: number
): Promise<AxiosResponse<UserOut>> => {
  return api.get<UserOut>(`/users/by-telegram-id/${telegramId}`)
}

/** Получить список тем для юзера */
export const getTopics = (country: string, language: string) =>
  api.get<{ topics: string[] }>(
    `/topics?country=${country}&language=${language}`,
  )

/**Дневной прогресс */
export interface DailyProgress {
  questions_mastered_today: number
  date: string
}

export const getDailyProgress = (userId: string, targetDate?: string) => {
  // Если targetDate не передан, используем сегодняшнюю дату в формате YYYY-MM-DD
  const dateToUse = targetDate || new Date().toISOString().split('T')[0]
  const params = `?target_date=${dateToUse}`
  return api.get<DailyProgress>(`/users/${userId}/daily-progress${params}`)
}

// -------------------------
// NEW: Answers by Day
// -------------------------

export interface AnswersByDay {
  date: string;
  total_answers: number;
  correct_answers: number;
  incorrect_answers: number;
}

export const getAnswersByDay = (userId: string, days: number = 7) => {
  return api.get<AnswersByDay[]>(`/users/${userId}/answers-by-day`, {
    params: { days }
  })
}

// -------------------------
// Health Check and Connection Testing
// -------------------------

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  version?: string;
  database?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  responseTime: number;
  error?: string;
  details?: {
    url: string;
    status?: number;
    statusText?: string;
  };
}

/**
 * Test basic API connectivity with health check endpoint
 */
export const testConnection = async (): Promise<ConnectionTestResult> => {
  const startTime = Date.now();
  
  try {
    console.log('=== Testing Backend Connection ===');
    console.log('Target URL:', `${API_BASE_URL}/health`);
    
    const response = await api.get<HealthCheckResponse>('/health');
    const responseTime = Date.now() - startTime;
    
    console.log('✓ Backend connection successful:', response.data);
    console.log(`✓ Response time: ${responseTime}ms`);
    console.log('================================');
    
    return {
      success: true,
      responseTime,
      details: {
        url: `${API_BASE_URL}/health`,
        status: response.status,
        statusText: response.statusText
      }
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    console.error('✗ Backend connection failed:', error);
    console.error(`✗ Failed after: ${responseTime}ms`);
    console.error('================================');
    
    return {
      success: false,
      responseTime,
      error: error.message || 'Unknown error',
      details: {
        url: `${API_BASE_URL}/health`,
        status: error.response?.status,
        statusText: error.response?.statusText
      }
    };
  }
};

/**
 * Test connection with retry mechanism
 */
export const testConnectionWithRetry = async (maxRetries: number = 3): Promise<ConnectionTestResult> => {
  let lastResult: ConnectionTestResult;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`=== Connection Test Attempt ${attempt}/${maxRetries} ===`);
    
    lastResult = await testConnection();
    
    if (lastResult.success) {
      console.log(`✓ Connection successful on attempt ${attempt}`);
      return lastResult;
    }
    
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
      console.log(`✗ Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`✗ All ${maxRetries} connection attempts failed`);
  return lastResult!;
};


export default api