import { useMemo } from 'react';

export function useScreenInit() {
  return useMemo(() => {
    return {
      activeTab: 'login' 
    };
  }, []);
}