/**
 * Route Studio form controls. Field bg, 1px rule border, 4px radius, 7px 8px padding. Also exports Textarea and Select.
 * @startingPoint section="Forms" subtitle="Inputs, textarea, select, checkbox, disclosure" viewport="700x360"
 */
export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** mono (default): 13px IBM Plex Mono for point data. sans: 14px Plex Sans for numeric settings in a FieldGrid. */
  font?: 'mono' | 'sans';
}
export declare function TextInput(props: TextInputProps): JSX.Element;
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { rows?: number; }
export declare function Textarea(props: TextareaProps): JSX.Element;
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: (string | { value: string; label?: string })[];
}
export declare function Select(props: SelectProps): JSX.Element;
