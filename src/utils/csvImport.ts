import { ChangeEvent } from 'react';

export interface CSVColumn {
  key: string;
  required: false;
  validate?: (value: string) => boolean;
  csvKey: string;
}

export interface ImportResult<T> {
  success: boolean;
  data?: T[];
  errors?: string[];
}

export const parseCSV = async (
  file: File,
  columns: CSVColumn[],
  transform: (row: Record<string, string>) => any
): Promise<ImportResult<any>> => {
  try {
    const text = await file.text();
    const lines = text.split('\n');
    if (lines.length < 2) {
      return { success: false, errors: ['File is empty or invalid'] };
    }

    const headers = lines[0].trim().split(',').map(h => h.trim().toLowerCase());
    const columnMap = new Map(columns.map(col => [col.csvKey.toLowerCase(), col]));
    
    const data: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by comma but handle quoted values if present
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      // Remove quotes if present
      const cleanValues = values.map(v => v.replace(/^"(.*)"$/, '$1').trim());

      // Pad array with empty strings if needed
      while (cleanValues.length < headers.length) {
        cleanValues.push('');
      }

      const row: Record<string, string> = {};
      let isValid = true;

      headers.forEach((header, index) => {
        const column = columnMap.get(header.toLowerCase());
        if (column) {
          const value = cleanValues[index] || '';
          
          // Only validate non-empty values
          if (value && column.validate && !column.validate(value)) {
            errors.push(`Line ${i + 1}: Invalid value for ${header}`);
            isValid = false;
          }

          row[column.key] = value;
        }
      });

      if (isValid) {
        data.push(transform(row));
      }
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0 ? data : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      success: false,
      errors: ['Failed to parse CSV file']
    };
  }
};

export const handleCSVImport = async (
  event: ChangeEvent<HTMLInputElement>,
  columns: CSVColumn[],
  transform: (row: Record<string, string>) => any,
  onSuccess: (data: any[]) => void,
  onError: (errors: string[]) => void
) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const result = await parseCSV(file, columns, transform);
  if (result.success && result.data) {
    onSuccess(result.data);
  } else if (result.errors) {
    onError(result.errors);
  }

  // Reset the input
  event.target.value = '';
};