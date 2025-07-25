// FSRS (Free Spaced Repetition Scheduler) Utilities
// Provides FSRS algorithm implementation, card scheduling, and spaced repetition logic
// Based on the FSRS algorithm for optimal learning scheduling

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface FSRSCard {
  id: string
  due: Date
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: CardState
  lastReview: Date | null
}

export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3
}

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4
}

export interface FSRSParameters {
  requestRetention: number
  maximumInterval: number
  w: number[] // 19 parameters for the FSRS algorithm
}

export interface ReviewLog {
  rating: Rating
  state: CardState
  due: Date
  stability: number
  difficulty: number
  elapsedDays: number
  lastElapsedDays: number
  scheduledDays: number
  review: Date
}

export interface SchedulingInfo {
  card: FSRSCard
  reviewLog: ReviewLog
}

export interface SchedulingCards {
  again: SchedulingInfo
  hard: SchedulingInfo
  good: SchedulingInfo
  easy: SchedulingInfo
}

export interface FSRSConfig {
  parameters: FSRSParameters
  timezone: string
  enableFuzz: boolean
  fuzzFactor: number
  maxNewCardsPerDay: number
  maxReviewCardsPerDay: number
}

// ============================================================================
// FSRS Algorithm Implementation
// ============================================================================

export class FSRS {
  private p: FSRSParameters
  private config: FSRSConfig

  constructor(config: FSRSConfig) {
    this.config = config
    this.p = config.parameters
  }

  /**
   * Schedule a card based on rating
   */
  schedule(card: FSRSCard, now: Date): SchedulingCards {
    if (card.state === CardState.New) {
      return this.initDS(card)
    }

    const elapsedDays = this.getElapsedDays(card, now)
    const fuzzedCard = { ...card, elapsedDays }

    return this.nextDS(fuzzedCard, now)
  }

  /**
   * Initialize scheduling for new cards
   */
  private initDS(card: FSRSCard): SchedulingCards {
    const newCard = { ...card }
    const now = new Date()

    const againCard = { ...newCard }
    const againLog = this.createReviewLog(againCard, Rating.Again, now)
    againCard.difficulty = this.initDifficulty(Rating.Again)
    againCard.stability = this.initStability(Rating.Again)
    againCard.due = this.addDays(now, 1)
    againCard.state = CardState.Learning
    againCard.reps = 1

    const hardCard = { ...newCard }
    const hardLog = this.createReviewLog(hardCard, Rating.Hard, now)
    hardCard.difficulty = this.initDifficulty(Rating.Hard)
    hardCard.stability = this.initStability(Rating.Hard)
    hardCard.due = this.addDays(now, 6)
    hardCard.state = CardState.Learning
    hardCard.reps = 1

    const goodCard = { ...newCard }
    const goodLog = this.createReviewLog(goodCard, Rating.Good, now)
    goodCard.difficulty = this.initDifficulty(Rating.Good)
    goodCard.stability = this.initStability(Rating.Good)
    goodCard.due = this.addDays(now, 1)
    goodCard.state = CardState.Learning
    goodCard.reps = 1

    const easyCard = { ...newCard }
    const easyLog = this.createReviewLog(easyCard, Rating.Easy, now)
    easyCard.difficulty = this.initDifficulty(Rating.Easy)
    easyCard.stability = this.initStability(Rating.Easy)
    easyCard.due = this.addDays(now, 4)
    easyCard.state = CardState.Review
    easyCard.reps = 1

    return {
      again: { card: againCard, reviewLog: againLog },
      hard: { card: hardCard, reviewLog: hardLog },
      good: { card: goodCard, reviewLog: goodLog },
      easy: { card: easyCard, reviewLog: easyLog }
    }
  }

  /**
   * Calculate next scheduling for existing cards
   */
  private nextDS(card: FSRSCard, now: Date): SchedulingCards {
    const { stability, difficulty } = card
    const elapsedDays = card.elapsedDays

    const againCard = { ...card }
    const againLog = this.createReviewLog(againCard, Rating.Again, now)
    againCard.difficulty = this.nextDifficulty(difficulty, Rating.Again)
    againCard.stability = this.nextForgetStability(difficulty, stability, elapsedDays)
    againCard.due = this.addDays(now, 0)
    againCard.state = CardState.Relearning
    againCard.lapses += 1

    const hardCard = { ...card }
    const hardLog = this.createReviewLog(hardCard, Rating.Hard, now)
    hardCard.difficulty = this.nextDifficulty(difficulty, Rating.Hard)
    hardCard.stability = this.nextRecallStability(difficulty, stability, elapsedDays, Rating.Hard)
    hardCard.scheduledDays = this.nextInterval(hardCard.stability)
    hardCard.due = this.addDays(now, hardCard.scheduledDays)
    hardCard.state = CardState.Review
    hardCard.reps += 1

    const goodCard = { ...card }
    const goodLog = this.createReviewLog(goodCard, Rating.Good, now)
    goodCard.difficulty = this.nextDifficulty(difficulty, Rating.Good)
    goodCard.stability = this.nextRecallStability(difficulty, stability, elapsedDays, Rating.Good)
    goodCard.scheduledDays = this.nextInterval(goodCard.stability)
    goodCard.due = this.addDays(now, goodCard.scheduledDays)
    goodCard.state = CardState.Review
    goodCard.reps += 1

    const easyCard = { ...card }
    const easyLog = this.createReviewLog(easyCard, Rating.Easy, now)
    easyCard.difficulty = this.nextDifficulty(difficulty, Rating.Easy)
    easyCard.stability = this.nextRecallStability(difficulty, stability, elapsedDays, Rating.Easy)
    easyCard.scheduledDays = this.nextInterval(easyCard.stability)
    easyCard.due = this.addDays(now, easyCard.scheduledDays)
    easyCard.state = CardState.Review
    easyCard.reps += 1

    return {
      again: { card: againCard, reviewLog: againLog },
      hard: { card: hardCard, reviewLog: hardLog },
      good: { card: goodCard, reviewLog: goodLog },
      easy: { card: easyCard, reviewLog: easyLog }
    }
  }

  // ============================================================================
  // FSRS Algorithm Core Functions
  // ============================================================================

  private initStability(rating: Rating): number {
    return Math.max(this.p.w[rating - 1], 0.1)
  }

  private initDifficulty(rating: Rating): number {
    return Math.min(Math.max(this.p.w[4] - this.p.w[5] * (rating - 3), 1), 10)
  }

  private nextInterval(stability: number): number {
    const interval = Math.round(stability * 9 * (1 / this.p.requestRetention - 1))
    return Math.min(Math.max(interval, 1), this.p.maximumInterval)
  }

  private nextDifficulty(difficulty: number, rating: Rating): number {
    const nextD = difficulty - this.p.w[6] * (rating - 3)
    return Math.min(Math.max(this.meanReversion(this.p.w[4], nextD), 1), 10)
  }

  private meanReversion(init: number, current: number): number {
    return this.p.w[7] * init + (1 - this.p.w[7]) * current
  }

  private nextRecallStability(
    difficulty: number,
    stability: number,
    elapsedDays: number,
    rating: Rating
  ): number {
    const hardPenalty = rating === Rating.Hard ? this.p.w[15] : 1
    const easyBonus = rating === Rating.Easy ? this.p.w[16] : 1
    
    return stability * (
      1 + 
      Math.exp(this.p.w[8]) *
      (11 - difficulty) *
      Math.pow(stability, -this.p.w[9]) *
      (Math.exp((1 - elapsedDays / stability) * this.p.w[10]) - 1) *
      hardPenalty *
      easyBonus
    )
  }

  private nextForgetStability(
    difficulty: number,
    stability: number,
    elapsedDays: number
  ): number {
    return this.p.w[11] * Math.pow(difficulty, -this.p.w[12]) * 
           (Math.pow(stability + 1, this.p.w[13]) - 1) * 
           Math.exp((1 - elapsedDays / stability) * this.p.w[14])
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  private getElapsedDays(card: FSRSCard, now: Date): number {
    if (!card.lastReview) return 0
    return Math.max(0, Math.floor((now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24)))
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  private createReviewLog(card: FSRSCard, rating: Rating, now: Date): ReviewLog {
    return {
      rating,
      state: card.state,
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      lastElapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      review: now
    }
  }

  /**
   * Apply fuzzing to intervals to avoid review clustering
   */
  private applyFuzz(interval: number): number {
    if (!this.config.enableFuzz || interval < 2.5) {
      return interval
    }

    const fuzzRange = Math.max(1, Math.floor(interval * this.config.fuzzFactor))
    const minInterval = Math.max(1, interval - fuzzRange)
    const maxInterval = interval + fuzzRange

    return Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Create a new FSRS card
   */
  createCard(id: string): FSRSCard {
    return {
      id,
      due: new Date(),
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: CardState.New,
      lastReview: null
    }
  }

  /**
   * Review a card and get the updated card
   */
  reviewCard(card: FSRSCard, rating: Rating, now: Date = new Date()): FSRSCard {
    const schedulingCards = this.schedule(card, now)
    
    let selectedCard: FSRSCard
    switch (rating) {
      case Rating.Again:
        selectedCard = schedulingCards.again.card
        break
      case Rating.Hard:
        selectedCard = schedulingCards.hard.card
        break
      case Rating.Good:
        selectedCard = schedulingCards.good.card
        break
      case Rating.Easy:
        selectedCard = schedulingCards.easy.card
        break
      default:
        selectedCard = schedulingCards.good.card
    }

    selectedCard.lastReview = now
    return selectedCard
  }

  /**
   * Get cards due for review
   */
  getDueCards(cards: FSRSCard[], now: Date = new Date()): FSRSCard[] {
    return cards.filter(card => card.due <= now)
  }

  /**
   * Get new cards available for learning
   */
  getNewCards(cards: FSRSCard[], limit: number = this.config.maxNewCardsPerDay): FSRSCard[] {
    return cards
      .filter(card => card.state === CardState.New)
      .slice(0, limit)
  }

  /**
   * Calculate retention rate for a set of cards
   */
  calculateRetention(cards: FSRSCard[], days: number = 30): number {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const reviewedCards = cards.filter(card => 
      card.lastReview && card.lastReview >= cutoffDate && card.reps > 0
    )

    if (reviewedCards.length === 0) return 0

    const retainedCards = reviewedCards.filter(card => {
      const daysSinceReview = this.getElapsedDays(card, new Date())
      return daysSinceReview <= card.scheduledDays
    })

    return (retainedCards.length / reviewedCards.length) * 100
  }

  /**
   * Get scheduling preview for all rating options
   */
  getSchedulingPreview(card: FSRSCard, now: Date = new Date()): {
    again: { interval: number; due: Date }
    hard: { interval: number; due: Date }
    good: { interval: number; due: Date }
    easy: { interval: number; due: Date }
  } {
    const schedulingCards = this.schedule(card, now)

    return {
      again: {
        interval: 0,
        due: schedulingCards.again.card.due
      },
      hard: {
        interval: schedulingCards.hard.card.scheduledDays,
        due: schedulingCards.hard.card.due
      },
      good: {
        interval: schedulingCards.good.card.scheduledDays,
        due: schedulingCards.good.card.due
      },
      easy: {
        interval: schedulingCards.easy.card.scheduledDays,
        due: schedulingCards.easy.card.due
      }
    }
  }

  /**
   * Update FSRS parameters
   */
  updateParameters(newParameters: Partial<FSRSParameters>): void {
    this.p = { ...this.p, ...newParameters }
    this.config.parameters = this.p
  }

  /**
   * Get current parameters
   */
  getParameters(): FSRSParameters {
    return { ...this.p }
  }
}

// ============================================================================
// FSRS Card Manager
// ============================================================================

export class FSRSCardManager {
  private fsrs: FSRS
  private cards: Map<string, FSRSCard> = new Map()

  constructor(config: FSRSConfig) {
    this.fsrs = new FSRS(config)
  }

  /**
   * Add a new card
   */
  addCard(id: string): FSRSCard {
    const card = this.fsrs.createCard(id)
    this.cards.set(id, card)
    return card
  }

  /**
   * Review a card
   */
  reviewCard(cardId: string, rating: Rating): FSRSCard | null {
    const card = this.cards.get(cardId)
    if (!card) return null

    const updatedCard = this.fsrs.reviewCard(card, rating)
    this.cards.set(cardId, updatedCard)
    return updatedCard
  }

  /**
   * Get all cards due for review
   */
  getDueCards(): FSRSCard[] {
    return this.fsrs.getDueCards(Array.from(this.cards.values()))
  }

  /**
   * Get new cards for learning
   */
  getNewCards(limit?: number): FSRSCard[] {
    return this.fsrs.getNewCards(Array.from(this.cards.values()), limit)
  }

  /**
   * Get card by ID
   */
  getCard(cardId: string): FSRSCard | undefined {
    return this.cards.get(cardId)
  }

  /**
   * Get all cards
   */
  getAllCards(): FSRSCard[] {
    return Array.from(this.cards.values())
  }

  /**
   * Get cards by state
   */
  getCardsByState(state: CardState): FSRSCard[] {
    return Array.from(this.cards.values()).filter(card => card.state === state)
  }

  /**
   * Calculate overall retention rate
   */
  getRetentionRate(days?: number): number {
    return this.fsrs.calculateRetention(Array.from(this.cards.values()), days)
  }

  /**
   * Get study statistics
   */
  getStudyStats(): {
    total: number
    new: number
    learning: number
    review: number
    relearning: number
    due: number
  } {
    const cards = Array.from(this.cards.values())
    const dueCards = this.fsrs.getDueCards(cards)

    return {
      total: cards.length,
      new: cards.filter(c => c.state === CardState.New).length,
      learning: cards.filter(c => c.state === CardState.Learning).length,
      review: cards.filter(c => c.state === CardState.Review).length,
      relearning: cards.filter(c => c.state === CardState.Relearning).length,
      due: dueCards.length
    }
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultFSRSConfig: FSRSConfig = {
  parameters: {
    requestRetention: 0.9,
    maximumInterval: 36500, // 100 years
    w: [
      0.4072, 1.1829, 3.1262, 15.4722, 7.2102,
      0.5316, 1.0651, 0.0234, 1.616, 0.1544,
      1.0824, 1.9813, 0.0953, 0.2975, 2.2042,
      0.2407, 2.9466, 0.5034, 0.6567
    ]
  },
  timezone: 'UTC',
  enableFuzz: true,
  fuzzFactor: 0.05,
  maxNewCardsPerDay: 20,
  maxReviewCardsPerDay: 200
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert rating number to Rating enum
 */
export function numberToRating(rating: number): Rating {
  switch (rating) {
    case 1: return Rating.Again
    case 2: return Rating.Hard
    case 3: return Rating.Good
    case 4: return Rating.Easy
    default: return Rating.Good
  }
}

/**
 * Get rating display text
 */
export function getRatingText(rating: Rating): string {
  switch (rating) {
    case Rating.Again: return 'Again'
    case Rating.Hard: return 'Hard'
    case Rating.Good: return 'Good'
    case Rating.Easy: return 'Easy'
    default: return 'Unknown'
  }
}

/**
 * Get card state display text
 */
export function getStateText(state: CardState): string {
  switch (state) {
    case CardState.New: return 'New'
    case CardState.Learning: return 'Learning'
    case CardState.Review: return 'Review'
    case CardState.Relearning: return 'Relearning'
    default: return 'Unknown'
  }
}

/**
 * Format interval for display
 */
export function formatInterval(days: number): string {
  if (days < 1) return 'Today'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  if (days < 365) return `${Math.round(days / 30)} months`
  return `${Math.round(days / 365)} years`
}

export default {
  FSRS,
  FSRSCardManager,
  CardState,
  Rating,
  defaultFSRSConfig,
  numberToRating,
  getRatingText,
  getStateText,
  formatInterval
}