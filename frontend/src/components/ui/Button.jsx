import { forwardRef } from 'react';
import cn from './cn';
import Icon from './Icon';

/**
 * The one button (spec 7.1).
 *
 * Flat amber fill, pill radius, fixed heights of 32/40/48/56. The only motion
 * is a press: scale 0.97 over 180ms. No glow, no gradient, no shadow.
 *
 * variant: primary | secondary | tertiary | danger
 * size:    sm (32) | md (40) | lg (48) | xl (56)
 * icon:    icon name placed before the label; iconAfter puts it after.
 * loading: swaps the leading icon for a spinner and blocks activation.
 * as:      render as another element, e.g. as={Link} for a nav button.
 */
const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  tertiary: 'btn-tertiary',
  danger: 'btn-danger',
};

const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg', xl: 'btn-xl' };

// Icon is 20px inside a 40px button; smaller buttons scale down with it.
const ICON_SIZE = { sm: 16, md: 20, lg: 20, xl: 20 };

function Spinner({ size }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="btn-spinner"
    >
      <circle cx="12" cy="12" r={r} opacity="0.25" />
      <path d={`M21 12a9 9 0 0 0-9-9`} strokeDasharray={c} strokeDashoffset={c * 0.7} />
    </svg>
  );
}

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    iconAfter,
    loading = false,
    disabled = false,
    fullWidth = false,
    as: Tag = 'button',
    children,
    className,
    type,
    ...rest
  },
  ref,
) {
  const isOff = disabled || loading;
  const iconSize = ICON_SIZE[size] || 20;
  // A real <button> defaults to type="submit"; links ignore it anyway.
  const typeProp = Tag === 'button' ? { type: type || 'button' } : {};

  return (
    <Tag
      ref={ref}
      className={cn('btn', VARIANTS[variant] || VARIANTS.primary, SIZES[size], {
        'btn-icon': !children,
        'btn-block': fullWidth,
      }, className)}
      disabled={Tag === 'button' ? isOff : undefined}
      aria-disabled={isOff || undefined}
      aria-busy={loading || undefined}
      {...typeProp}
      {...rest}
    >
      {loading ? <Spinner size={iconSize} /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children ? <span className="btn-label">{children}</span> : null}
      {!loading && iconAfter ? <Icon name={iconAfter} size={iconSize} /> : null}
    </Tag>
  );
});

export default Button;