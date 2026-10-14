import { Link as RouterLink, type LinkProps } from "react-router-dom";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: ReactNode;
  replace?: boolean;
  viewTransition?: boolean;
};

export function Link({ href, children, replace, className, viewTransition, ...rest }: Props) {
  const external = /^(https?:)?\/\//i.test(href);
  if (external) {
    return (
      <a href={href} className={className} rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  const linkProps: LinkProps = {
    to: href,
    replace,
    className,
    viewTransition,
    ...rest,
  };
  return <RouterLink {...linkProps}>{children}</RouterLink>;
}
