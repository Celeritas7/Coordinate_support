/** Field label with optional muted unit, e.g. "Min radius (mm)". */
export interface LabelProps {
  children: React.ReactNode;
  /** Rendered after the label in regular weight, muted colour: "mm", "(X Y Z per line)", "(stays put)". */
  unit?: React.ReactNode;
  htmlFor?: string;
  style?: React.CSSProperties;
}
export declare function Label(props: LabelProps): JSX.Element;
