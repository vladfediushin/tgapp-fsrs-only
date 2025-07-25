import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook for debouncing values and function calls
 * Essential for settings updates to prevent excessive API calls
 */

export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      const newTimer = setTimeout(() => {
        callback(...args)
      }, delay)

      setDebounceTimer(newTimer)
    },
    [callback, delay, debounceTimer]
  ) as T

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [debounceTimer])

  return debouncedCallback
}

/**
 * Hook for managing form state with debounced updates
 * Perfect for settings forms where we want immediate UI feedback
 * but delayed API calls
 */
export function useDebouncedForm<T extends Record<string, any>>(
  initialValues: T,
  onUpdate: (values: T) => void,
  delay: number = 500
) {
  const [localValues, setLocalValues] = useState<T>(initialValues)
  const [hasChanges, setHasChanges] = useState(false)

  // Debounced update function
  const debouncedUpdate = useDebouncedCallback(onUpdate, delay)

  // Update local values and trigger debounced update
  const updateValue = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      const newValues = { ...localValues, [key]: value }
      setLocalValues(newValues)
      setHasChanges(true)
      debouncedUpdate(newValues)
    },
    [localValues, debouncedUpdate]
  )

  // Reset form to initial values
  const resetForm = useCallback(() => {
    setLocalValues(initialValues)
    setHasChanges(false)
  }, [initialValues])

  // Update initial values when they change externally
  useEffect(() => {
    setLocalValues(initialValues)
    setHasChanges(false)
  }, [initialValues])

  return {
    values: localValues,
    hasChanges,
    updateValue,
    resetForm,
    setHasChanges
  }
}