/**
 * Result readout (.readout): 30px semibold tabular number, 14px muted unit and run name, 13.5px verdict in a status colour, 12.5px muted facts.
 * @startingPoint section="Data" subtitle="Big-number result with verdict and facts" viewport="700x160"
 */
export interface ReadoutProps {
  /** e.g. "R 98.2" */
  value: React.ReactNode;
  /** default "mm tightest bend" */
  unit?: React.ReactNode;
  /** Run name appended after a middle dot */
  name?: React.ReactNode;
  verdict?: React.ReactNode;
  /** Colours the verdict: ok blue, warn amber, bad red */
  tone?: 'ok' | 'warn' | 'bad';
  facts?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Readout(props: ReadoutProps): JSX.Element;
