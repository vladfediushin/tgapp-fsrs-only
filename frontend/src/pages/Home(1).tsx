// src/pages/Home.tsx - Refactored using Container-Presenter Pattern
import React from 'react'
import HomeContainer from './Home/HomeContainer'

/**
 * Home Component - Refactored using Container-Presenter Pattern
 * 
 * This component has been refactored to separate concerns:
 * - HomeContainer: Handles business logic, data management, and state
 * - HomePresenter: Handles UI rendering and user interactions
 * - HomeErrorBoundary: Handles error boundaries and fallbacks
 * 
 * Benefits of this architecture:
 * - Clear separation of concerns
 * - Improved testability
 * - Better maintainability
 * - Reusable presenter components
 * - Centralized error handling
 * - Integration with unified store system
 */
const Home: React.FC = () => {
  return <HomeContainer />
}

export default Home
