import { useLocation } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";
import { Link } from "@/shared/ui/router-link";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { prefetchRoute } from "@/shared/route-prefetch";

import {
  type BreadcrumbSegment,
  getAutoBreadcrumbs,
} from "./auto-breadcrumbs";

export type { BreadcrumbSegment };

export interface Breadcrumb5Props {
  segments?: readonly BreadcrumbSegment[];
  className?: string;
}


export const Breadcrumb5 = ({ segments, className }: Breadcrumb5Props) => {
  const location = useLocation();
  const activeSegments = segments ?? getAutoBreadcrumbs(location.pathname, location.search);

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="gap-1.5 flex-wrap items-center">
        {activeSegments.map((segment, index) => {
          const isCurrent = Boolean(segment.current) || index === activeSegments.length - 1;
          const hasHref = Boolean("href" in segment && segment.href && !isCurrent);

          return (
            <BreadcrumbItem key={`${segment.label}-${index}`}>
              {hasHref && segment.href ? (
                <Link
                  href={segment.href}
                  className="inline-flex items-center text-inherit no-underline"
                  onMouseEnter={() => prefetchRoute(segment.href!)}
                  onFocus={() => prefetchRoute(segment.href!)}
                >
                  <Badge
                    variant="outline"
                    className="border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40 px-2.5 py-0.5 text-xs font-normal transition-all cursor-pointer shadow-2xs"
                  >
                    {segment.label}
                  </Badge>
                </Link>
              ) : (
                <BreadcrumbPage>
                  <Badge
                    variant="outline"
                    className="border-foreground/20 bg-muted/30 text-foreground px-2.5 py-0.5 text-xs font-medium shadow-2xs"
                  >
                    {segment.label}
                  </Badge>
                </BreadcrumbPage>
              )}
              {index < activeSegments.length - 1 ? (
                <BreadcrumbSeparator className="text-muted-foreground/60 inline-flex items-center">
                  <ArrowRightIcon className="size-3.5" />
                </BreadcrumbSeparator>
              ) : null}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default Breadcrumb5;
