/** Segmented toggle (.seg) — pressed segment is ink on paper, others muted on panel. */
export interface SegmentedControlProps {
  options: { id: string; label: string }[];
  value: string;
  onChange?: (id: string) => void;
  /** aria-label for the group, e.g. "Colour" */
  label?: string;
  style?: React.CSSProperties;
}
export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;
