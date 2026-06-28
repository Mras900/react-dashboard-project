import type { DesignColorOption, DesignRadiusOption, DesignSpacingMode } from './designTypes';

export const colorOptions: Array<{ value: DesignColorOption; label: string; hex: string }> = [
  { value: 'default', label: 'Azul institucional', hex: '#073B91' },
  { value: 'blue', label: 'Azul vivo', hex: '#1B4FD8' },
  { value: 'emerald', label: 'Verde operativo', hex: '#059669' },
  { value: 'slate', label: 'Pizarra', hex: '#172448' },
  { value: 'white', label: 'Blanco', hex: '#FFFFFF' },
  { value: 'soft', label: 'Claro suave', hex: '#F8FAFC' },
];

export const primaryColorOptions = colorOptions.filter((option) => option.value !== 'white' && option.value !== 'soft');
export const backgroundColorOptions = colorOptions.filter((option) => ['default', 'white', 'soft', 'slate'].includes(option.value));
export const cardColorOptions = colorOptions.filter((option) => ['default', 'white', 'soft', 'slate'].includes(option.value));
export const textColorOptions = colorOptions.filter((option) => ['default', 'blue', 'slate', 'white'].includes(option.value));

export const radiusOptions: Array<{ value: DesignRadiusOption; label: string }> = [
  { value: 'default', label: 'Actual' },
  { value: 'compact', label: 'Compacto' },
  { value: 'rounded', label: 'Redondeado' },
];

export const spacingOptions: Array<{ value: DesignSpacingMode; label: string }> = [
  { value: 'compact', label: 'Compacto' },
  { value: 'comfortable', label: 'Comfortable' },
];

export const designTokenValues = {
  primaryColor: {
    default: '#073B91',
    blue: '#1B4FD8',
    emerald: '#059669',
    slate: '#172448',
    white: '#FFFFFF',
    soft: '#F8FAFC',
  },
  backgroundColor: {
    default: '#F8FAFC',
    blue: '#EFF6FF',
    emerald: '#ECFDF5',
    slate: '#0F172A',
    white: '#FFFFFF',
    soft: '#F8FAFC',
  },
  cardColor: {
    default: '#FFFFFF',
    blue: '#EFF6FF',
    emerald: '#ECFDF5',
    slate: '#111827',
    white: '#FFFFFF',
    soft: '#F8FAFC',
  },
  textColor: {
    default: '#172448',
    blue: '#073B91',
    emerald: '#065F46',
    slate: '#172448',
    white: '#EAF0F8',
    soft: '#172448',
  },
  borderRadius: {
    default: '0.5rem',
    compact: '0.375rem',
    rounded: '0.75rem',
  },
  spacingMode: {
    compact: '0.75rem',
    comfortable: '1.25rem',
  },
} as const;

export function isDesignColorOption(value: unknown): value is DesignColorOption {
  return typeof value === 'string' && colorOptions.some((option) => option.value === value);
}

export function isDesignRadiusOption(value: unknown): value is DesignRadiusOption {
  return typeof value === 'string' && radiusOptions.some((option) => option.value === value);
}

export function isDesignSpacingMode(value: unknown): value is DesignSpacingMode {
  return typeof value === 'string' && spacingOptions.some((option) => option.value === value);
}
