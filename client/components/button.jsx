export default function Button({
  children,
  variant = "primary",
  appearance = "fill",
  size = "medium",
  iconOnly = false,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      className={`ui-button ${className}`.trim()}
      data-variant={variant}
      data-appearance={appearance}
      data-size={size}
      data-icon-only={iconOnly || undefined}
    >
      {children}
    </button>
  );
}
