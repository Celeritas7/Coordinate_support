/**
 * Route Studio button. Five variants lifted from index.html: primary (.go), outline (.tools button), small (.ptshead button), link (.presets button / .linkish), icon (.del).
 * @startingPoint section="Actions" subtitle="Primary, outline, small, link and icon buttons" viewport="700x260"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: full-width ink block. outline: panel bg + rule border. small: field bg, tighter padding. link: underlined ok-blue text. icon: bare muted glyph. */
  variant?: 'primary' | 'outline' | 'small' | 'link' | 'icon';
  disabled?: boolean;
  /** When disabled while working, shows the progress cursor (primary button during optimisation). */
  busy?: boolean;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
