/*
Source: https://opensourceui.in/components/dark-midnight-mesh-background
MIT License

Copyright (c) 2026 Bidyut Kundu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/shared/utils";

export interface DarkMidnightMeshBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

const DarkMidnightMeshBackground = forwardRef<HTMLDivElement, DarkMidnightMeshBackgroundProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="dark-midnight-mesh-background"
        className={cn("relative isolate overflow-hidden bg-[#000000]", className)}
        {...props}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.10)_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.14]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:7px_7px] opacity-[0.06]" />
        <div aria-hidden="true" className="pointer-events-none absolute -inset-8 -z-10 blur-3xl">
          <div className="absolute -top-[16%] -left-[10%] h-[54%] w-[54%] rounded-full bg-[#2DD4BF] opacity-[0.16]" />
          <div className="absolute top-[8%] -right-[12%] h-[48%] w-[48%] rounded-full bg-[#38BDF8] opacity-[0.14]" />
          <div className="absolute -bottom-[18%] left-[20%] h-[50%] w-[50%] rounded-full bg-[#34D399] opacity-[0.12]" />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.75)_1px,transparent_1px)] [background-size:6px_6px] opacity-[0.04]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_center,transparent_54%,rgba(0,0,0,0.42)_100%)]" />
        {children}
      </div>
    );
  }
);
DarkMidnightMeshBackground.displayName = "DarkMidnightMeshBackground";
export { DarkMidnightMeshBackground };
