import { useEffect, useState } from 'react';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/suppliers')
      .then(res => res.json())
      .then(data => setSuppliers(data.data || []));
  }, []);

  return { suppliers };
}