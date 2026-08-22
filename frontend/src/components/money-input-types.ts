export interface MoneyInputProps {
  id?: string;
  label?: string;
  valueToman: string;
  onChangeToman: (tomanDigitsGrouped: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  testId?: string;
  theme?: 'dark' | 'light';
}
