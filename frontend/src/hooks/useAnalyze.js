import { useState } from 'react';
import { analyzeUrl } from '../utils/api.js';

export function useAnalyze(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function analyze(url) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeUrl(url);
      setResult(data);
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return { analyze, isLoading, result, error };
}
